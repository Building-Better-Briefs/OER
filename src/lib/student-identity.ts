import { CLASS_GROUP_STUDENT_NUMBER_MAX_LENGTH } from '@/lib/class-group';
import { normalizeClassGroupStudentNumber } from '@/lib/class-group-assignment';
import { parsePositiveInt } from '@/lib/student-assignments';

export type StudentIdentityDefaults = {
    studentName?: string | null;
    studentNumber?: string | null;
};

export function pickStudentFormName(input: {
    cachedStudentName?: string | null;
    displayName?: string | null;
}): string {
    return input.cachedStudentName?.trim() || input.displayName?.trim() || '';
}

export function applyStudentIdentityDefaults<
    T extends { studentName?: string | null; studentNumber?: string | null }
>(draft: T, identity: StudentIdentityDefaults): T {
    const name = identity.studentName?.trim() ?? '';
    const number = identity.studentNumber?.trim() ?? '';

    let next = draft;
    if (!(draft.studentName ?? '').trim() && name) {
        next = { ...next, studentName: name };
    }
    if (!(draft.studentNumber ?? '').trim() && number) {
        next = { ...next, studentNumber: number };
    }
    return next;
}

export function buildRosterNumberFromSavedStudent(input: {
    draftStudentNumber: string;
    cachedStudentNumber: string | null;
}): string {
    const cachedNumber = input.cachedStudentNumber?.trim() ?? '';
    if (cachedNumber) {
        return cachedNumber;
    }
    return input.draftStudentNumber.trim();
}

export type RosterStudentNumberUpdate = {
    userId: number;
    studentNumber: string;
};

export function collectRosterStudentNumberUpdates(
    students: Array<{ userId?: number; number?: string }>,
    allowedUserIds: Iterable<number>
): RosterStudentNumberUpdate[] {
    const allowed = new Set(allowedUserIds);
    const byUserId = new Map<number, string>();

    for (const student of students) {
        const userId = parsePositiveInt(student.userId);
        if (userId === null || !allowed.has(userId)) {
            continue;
        }

        const studentNumber = normalizeClassGroupStudentNumber(
            student.number ?? ''
        );
        if (
            !studentNumber ||
            studentNumber.length > CLASS_GROUP_STUDENT_NUMBER_MAX_LENGTH
        ) {
            continue;
        }

        byUserId.set(userId, studentNumber);
    }

    return [...byUserId.entries()].map(([userId, studentNumber]) => ({
        userId,
        studentNumber
    }));
}
