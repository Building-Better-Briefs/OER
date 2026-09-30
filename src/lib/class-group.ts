import { z } from 'zod';
import {
    normalizeClassGroupStudentNumber,
    parseStudentNumberFromEmail
} from '@/lib/class-group-assignment';
import type { Student } from '@/lib/report-grading';

export const MAX_CLASS_GROUP_STUDENTS = 500;
export const CLASS_GROUP_NAME_MAX_LENGTH = 100;
export const CLASS_GROUP_STUDENT_NUMBER_MAX_LENGTH = 50;
export const CLASS_GROUP_STUDENT_NAME_MAX_LENGTH = 100;
/** Client-side rendering cap for the group list (dashboard sheet / pickers). */
export const CLASS_GROUP_LIST_MAX_RENDERED = 200;

const CLASS_GROUP_CODE_PATTERN =
    /^cg-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isClassGroupCode(value: string): boolean {
    return CLASS_GROUP_CODE_PATTERN.test(value);
}

export function generateClassGroupCode(): string {
    return `cg-${crypto.randomUUID()}`;
}

export function truncateClassGroupField(
    value: string,
    maxLength: number
): string {
    const trimmed = value.trim();
    return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
}

export const classGroupStudentSchema = z.object({
    studentNumber: z
        .string()
        .trim()
        .min(1)
        .max(CLASS_GROUP_STUDENT_NUMBER_MAX_LENGTH),
    lastName: z
        .string()
        .trim()
        .max(CLASS_GROUP_STUDENT_NAME_MAX_LENGTH)
        .default(''),
    firstName: z
        .string()
        .trim()
        .max(CLASS_GROUP_STUDENT_NAME_MAX_LENGTH)
        .default('')
});

export type ClassGroupStudent = z.infer<typeof classGroupStudentSchema>;

export type ClassGroupViewerStudent = ClassGroupStudent & {
    firstViewedAt: string | null;
    lastViewedAt: string | null;
};

export type BriefAssignmentViewTimeRow = {
    studentNumber: string;
    email: string;
    firstViewedAt: string | null;
    lastViewedAt: string | null;
};

export type ClassGroupViewTimeIndexEntry = {
    firstViewedAt: string | null;
    lastViewedAt: string | null;
};

function assignmentViewTimeKey(input: {
    studentNumber: string;
    email: string;
}): string | null {
    const storedNumber = normalizeClassGroupStudentNumber(input.studentNumber);
    if (storedNumber) {
        return storedNumber;
    }

    return parseStudentNumberFromEmail(input.email);
}

export function buildClassGroupViewTimeIndex(
    rows: BriefAssignmentViewTimeRow[]
): Map<string, ClassGroupViewTimeIndexEntry> {
    const index = new Map<string, ClassGroupViewTimeIndexEntry>();
    const ambiguousKeys = new Set<string>();

    for (const row of rows) {
        const key = assignmentViewTimeKey(row);
        if (!key) {
            continue;
        }

        const entry: ClassGroupViewTimeIndexEntry = {
            firstViewedAt: row.firstViewedAt,
            lastViewedAt: row.lastViewedAt
        };

        const existing = index.get(key);
        if (existing) {
            ambiguousKeys.add(key);
            continue;
        }

        index.set(key, entry);
    }

    for (const key of ambiguousKeys) {
        index.delete(key);
    }

    return index;
}

export function attachClassGroupViewTimes(
    students: ClassGroupStudent[],
    index: Map<string, ClassGroupViewTimeIndexEntry>
): ClassGroupViewerStudent[] {
    return students.map((student) => {
        const key = normalizeClassGroupStudentNumber(student.studentNumber);
        const entry = key ? index.get(key) : undefined;

        return {
            ...student,
            firstViewedAt: entry?.firstViewedAt ?? null,
            lastViewedAt: entry?.lastViewedAt ?? null
        };
    });
}

export const classGroupSummarySchema = z.object({
    groupCode: z.string().trim().min(1),
    name: z.string().trim().default(''),
    studentCount: z.number().int().nonnegative().optional()
});

export type ClassGroupSummary = z.infer<typeof classGroupSummarySchema>;

export const classGroupSchema = z.object({
    groupCode: z.string().trim().min(1),
    name: z.string().trim().default(''),
    students: z.array(classGroupStudentSchema).max(MAX_CLASS_GROUP_STUDENTS)
});

export type ClassGroup = z.infer<typeof classGroupSchema>;

/**
 * Parses "number,lastName,firstName" lines (same format as the feedback
 * sheet Students panel). Blank student numbers are skipped and duplicate
 * numbers keep the first occurrence.
 */
export function parseClassGroupRosterLines(text: string): ClassGroupStudent[] {
    const lines = text.split('\n').filter((line) => line.trim());
    const seenNumbers = new Set<string>();
    const students: ClassGroupStudent[] = [];

    for (const line of lines) {
        const [rawNumber, rawLastName, rawFirstName] = line.split(',');
        const studentNumber = truncateClassGroupField(
            normalizeClassGroupStudentNumber(
                (rawNumber ?? '').replace(/["]+/g, '')
            ),
            CLASS_GROUP_STUDENT_NUMBER_MAX_LENGTH
        );

        if (!studentNumber || seenNumbers.has(studentNumber)) {
            continue;
        }
        seenNumbers.add(studentNumber);

        students.push({
            studentNumber,
            lastName: truncateClassGroupField(
                (rawLastName ?? '').replace(/["]+/g, ''),
                CLASS_GROUP_STUDENT_NAME_MAX_LENGTH
            ),
            firstName: truncateClassGroupField(
                (rawFirstName ?? '').replace(/["]+/g, ''),
                CLASS_GROUP_STUDENT_NAME_MAX_LENGTH
            )
        });

        if (students.length >= MAX_CLASS_GROUP_STUDENTS) {
            break;
        }
    }

    return students;
}

export function formatClassGroupStudentName(
    student: Pick<ClassGroupStudent, 'firstName' | 'lastName'>
): string {
    return `${student.firstName} ${student.lastName}`.trim();
}

export function mapClassGroupStudentToGradingStudent(
    student: ClassGroupStudent
): Student {
    const name = formatClassGroupStudentName(student);
    return {
        name: name || 'Unknown',
        number: normalizeClassGroupStudentNumber(student.studentNumber),
        date: '',
        grade: '',
        selections: {},
        feedback: {
            strengths: '',
            development: '',
            comments: ''
        }
    };
}

export type MergeClassGroupResult = {
    roster: Student[];
    added: number;
    skipped: number;
};

function normalizeRosterStudentNumber(number: string): string {
    return normalizeClassGroupStudentNumber(number);
}

/** Merge a class group roster into a grading roster, de-duplicating by student number. */
export function mergeClassGroupIntoRoster(
    roster: Student[],
    classGroupStudents: ClassGroupStudent[],
    options?: { suppressedNumbers?: string[] }
): MergeClassGroupResult {
    const suppressed = new Set(
        (options?.suppressedNumbers ?? []).map(normalizeRosterStudentNumber)
    );
    const existingNumbers = new Set(
        roster
            .map((student) => normalizeRosterStudentNumber(student.number))
            .filter(Boolean)
    );
    const next = [...roster];
    let added = 0;
    let skipped = 0;

    for (const student of classGroupStudents) {
        const studentNumber = normalizeRosterStudentNumber(
            student.studentNumber
        );
        if (!studentNumber) {
            skipped += 1;
            continue;
        }
        if (suppressed.has(studentNumber) || existingNumbers.has(studentNumber)) {
            skipped += 1;
            continue;
        }
        existingNumbers.add(studentNumber);
        next.push(mapClassGroupStudentToGradingStudent(student));
        added += 1;
    }

    return { roster: next, added, skipped };
}
