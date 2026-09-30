import { createCriterionId, criteriaHaveIds } from '@/lib/criterion-id';
import { normalizeClassGroupStudentNumber } from '@/lib/class-group-assignment';

export type Criterion = {
    id: string;
    heading: string;
    description: string;
    marks: number;
    highlight?: string;
};

export type Student = {
    name: string;
    number: string;
    userId?: number;
    date?: string;
    grade?: string;
    selections?: Record<string, number>;
    feedback?: {
        strengths: string;
        development: string;
        comments: string;
    };
};

export function canSaveGradedStudent(name: string, number: string): boolean {
    return name.trim() !== '' && number.trim() !== '';
}

export function getMissingStudentIdentityMessage(
    name: string,
    number: string,
    action: string
): string | null {
    if (!name.trim()) {
        return `Please enter the student's name before ${action}.`;
    }
    if (!number.trim()) {
        return `Please enter the student's number before ${action}.`;
    }
    return null;
}

export type FeedbackSheetData = {
    id: number;
    module: string;
    assignmentTitle: string;
    weighting: number;
    students: Student[];
    criteria: Criterion[];
};

export type FormativeMilestone = {
    id: string;
    name: string;
    date: string;
    endDate?: string;
};

export type FormativeFeedbackField = {
    id: string;
    label: string;
};

export const DEFAULT_FORMATIVE_FEEDBACK_FIELD_IDS = {
    strengths: 'strengths',
    development: 'development',
    comments: 'comments'
} as const;

export const DEFAULT_FORMATIVE_FEEDBACK_FIELDS: FormativeFeedbackField[] = [
    { id: 'strengths', label: 'Strengths' },
    { id: 'development', label: 'Areas for development' },
    { id: 'comments', label: 'Other comments' }
];

export const MAX_FORMATIVE_FEEDBACK_FIELDS = 20;

export const DEFAULT_FORMATIVE_LOG_TITLE = 'Formative Log';

export function normalizeFormativeLogTitle(raw: unknown): string {
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed) {
            return trimmed;
        }
    }
    return DEFAULT_FORMATIVE_LOG_TITLE;
}

export type FormativeEntry = {
    milestoneId: string;
    studentNumber: string;
    studentName: string;
    values: Record<string, string>;
};

export const MAX_SUPPRESSED_STUDENT_NUMBERS = 500;

export type FeedbackSheetStudentData = {
    students: Student[];
    formativeEntries: FormativeEntry[];
    suppressedStudentNumbers?: string[];
};

export type FeedbackSheetStudentExport = FeedbackSheetStudentData & {
    formativeMilestones?: FormativeMilestone[];
    formativeFeedbackFields?: FormativeFeedbackField[];
    formativeLogTitle?: string;
};

export { criteriaHaveIds, createCriterionId };

export const GRADE_ORDER = [
    'A',
    'B+',
    'B',
    'B-',
    'C+',
    'C',
    'D',
    'F',
    'N/A'
] as const;

type CriterionInput = {
    id?: string;
    heading: string;
    description: string;
    marks: number;
    highlight?: string;
};

export function ensureCriteriaIds(criteria: CriterionInput[]): {
    criteria: Criterion[];
    changed: boolean;
} {
    const seen = new Set<string>();
    let changed = false;

    const normalized = criteria.map((criterion) => {
        let id = typeof criterion.id === 'string' ? criterion.id.trim() : '';
        if (!id || seen.has(id)) {
            id = createCriterionId();
            changed = true;
        }
        seen.add(id);

        const row: Criterion = {
            id,
            heading: criterion.heading,
            description: criterion.description,
            marks: criterion.marks
        };

        if (criterion.highlight && criterion.highlight.trim() !== '') {
            row.highlight = criterion.highlight;
        }

        return row;
    });

    return { criteria: normalized, changed };
}

export function sanitizeScore(value: unknown): number {
    const numeric =
        typeof value === 'number' ? value : parseFloat(String(value));
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.min(100, Math.max(0, numeric));
}

export function pruneSelectionsToCriteria(
    selections: Record<string, number> | undefined,
    criteria: Criterion[]
): Record<string, number> {
    if (!selections) {
        return {};
    }

    const validIds = new Set(criteria.map((criterion) => criterion.id));
    const pruned: Record<string, number> = {};

    for (const [key, value] of Object.entries(selections)) {
        if (validIds.has(key)) {
            pruned[key] = sanitizeScore(value);
        }
    }

    return pruned;
}

export function normalizeStudentSelections(
    student: Student,
    criteria: Criterion[]
): Student {
    const pruned = pruneSelectionsToCriteria(student.selections, criteria);
    const selections: Record<string, number> = { ...pruned };

    for (const criterion of criteria) {
        if (selections[criterion.id] === undefined) {
            selections[criterion.id] = 0;
        }
    }

    return {
        ...student,
        selections
    };
}

export function normalizeFeedbackSheetCriteriaForStorage(
    raw: unknown
): Criterion[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const parsed: CriterionInput[] = raw
        .filter((row) => row && typeof row === 'object')
        .map((row) => {
            const o = row as Record<string, unknown>;
            return {
                id: typeof o.id === 'string' ? o.id : undefined,
                heading: typeof o.heading === 'string' ? o.heading : '',
                description:
                    typeof o.description === 'string' ? o.description : '',
                marks:
                    typeof o.marks === 'number'
                        ? o.marks
                        : Number(o.marks) || 0,
                highlight:
                    typeof o.highlight === 'string' ? o.highlight : undefined
            };
        });

    return ensureCriteriaIds(parsed).criteria;
}

export function parseGradeToNumber(grade: string): number {
    const gradeMap: Record<string, number> = {
        A: 85,
        'B+': 75,
        B: 65,
        'B-': 57.5,
        'C+': 52.5,
        C: 45,
        D: 37.5,
        F: 17.5
    };

    const normalizedGrade = grade.trim();
    if (gradeMap[normalizedGrade]) {
        return gradeMap[normalizedGrade];
    }

    const percentage = parseFloat(grade.replace('%', ''));
    if (!isNaN(percentage)) {
        return percentage;
    }

    return 0;
}

export function numberToGrade(num: number): string {
    if (num >= 80) return 'A';
    if (num >= 70) return 'B+';
    if (num >= 60) return 'B';
    if (num >= 55) return 'B-';
    if (num >= 50) return 'C+';
    if (num >= 40) return 'C';
    if (num >= 35) return 'D';
    return 'F';
}

export function calculatePercentageFromSelections(
    student: Student,
    criteria: Criterion[]
): number | null {
    if (!student.selections || !criteria) return null;

    let totalScore = 0;
    let totalMarks = 0;

    for (const criterion of criteria) {
        const selectedScore = student.selections[criterion.id];
        if (
            selectedScore !== undefined &&
            selectedScore !== null &&
            !isNaN(selectedScore)
        ) {
            totalScore += (selectedScore / 100) * criterion.marks;
            totalMarks += criterion.marks;
        }
    }

    if (totalMarks === 0) return null;
    return Math.round((totalScore / totalMarks) * 100 * 10) / 10;
}

export function formatGradeWithPercentage(
    grade: string,
    percentage: number | null
): string {
    if (!grade || grade === '-' || grade === 'N/A') {
        return grade;
    }

    if (percentage !== null && !isNaN(percentage)) {
        return `${grade} (${Math.round(percentage)}%)`;
    }

    const parsedPercentage = parseFloat(grade.replace('%', ''));
    if (!isNaN(parsedPercentage)) {
        return grade.includes('%')
            ? grade
            : `${grade} (${Math.round(parsedPercentage)}%)`;
    }

    return grade;
}

export function loadStudentsFromStorage(feedbackSheetId: number): Student[] {
    if (typeof window === 'undefined') {
        return [];
    }

    const storageKey = `feedbackSheet_${feedbackSheetId}_students`;
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
        return [];
    }

    try {
        const data = JSON.parse(stored);
        return parseFeedbackSheetStudentData(data).students;
    } catch {
        return [];
    }
}

function createMilestoneId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getFormativeEntryKey(entry: Pick<
    FormativeEntry,
    'milestoneId' | 'studentNumber'
>): string {
    const milestoneId = entry.milestoneId.trim();
    const studentNumber = normalizeClassGroupStudentNumber(entry.studentNumber);
    return `${milestoneId}:${studentNumber}`;
}

export function getFormativeEntryForStudent(
    entries: FormativeEntry[],
    milestoneId: string,
    studentNumber: string
): FormativeEntry | undefined {
    const normalizedNumber = normalizeClassGroupStudentNumber(studentNumber);
    if (!normalizedNumber) return undefined;
    return entries.find(
        (entry) =>
            entry.milestoneId === milestoneId &&
            normalizeClassGroupStudentNumber(entry.studentNumber) ===
                normalizedNumber
    );
}

export function getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

export function formatMilestoneDisplayName(name: string): string {
    const trimmed = name.trim();
    return trimmed || 'Untitled';
}

export function normalizeFormativeMilestones(raw: unknown): FormativeMilestone[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const seen = new Set<string>();
    const normalized: FormativeMilestone[] = [];
    const today = getTodayDateString();

    for (const row of raw) {
        if (!row || typeof row !== 'object') continue;
        const o = row as Record<string, unknown>;
        let id = typeof o.id === 'string' ? o.id.trim() : '';
        if (!id || seen.has(id)) {
            id = createMilestoneId();
        }
        seen.add(id);

        const name = typeof o.name === 'string' ? o.name : '';
        const rawDate = typeof o.date === 'string' ? o.date.trim() : '';
        const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
        const rawEndDate =
            typeof o.endDate === 'string' ? o.endDate.trim() : '';
        const endDate = /^\d{4}-\d{2}-\d{2}$/.test(rawEndDate)
            ? rawEndDate
            : today;

        normalized.push({ id, name, date, endDate });
    }

    return normalized;
}

function createFieldId(): string {
    return createCriterionId();
}

export function normalizeFormativeFeedbackFields(
    raw: unknown
): FormativeFeedbackField[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        return [...DEFAULT_FORMATIVE_FEEDBACK_FIELDS];
    }

    const seen = new Set<string>();
    const normalized: FormativeFeedbackField[] = [];

    for (const row of raw) {
        if (!row || typeof row !== 'object') continue;
        const o = row as Record<string, unknown>;
        let id = typeof o.id === 'string' ? o.id.trim() : '';
        if (!id || seen.has(id)) {
            id = createFieldId();
        }
        seen.add(id);
        const label = typeof o.label === 'string' ? o.label : '';
        normalized.push({ id, label });
        if (normalized.length >= MAX_FORMATIVE_FEEDBACK_FIELDS) {
            break;
        }
    }

    return normalized.length > 0
        ? normalized
        : [...DEFAULT_FORMATIVE_FEEDBACK_FIELDS];
}

export function getEmptyFormativeValues(
    fields: FormativeFeedbackField[]
): Record<string, string> {
    const values: Record<string, string> = {};
    for (const field of fields) {
        values[field.id] = '';
    }
    return values;
}

export function mergeFormativeValues(
    fields: FormativeFeedbackField[],
    values?: Record<string, string>
): Record<string, string> {
    const merged = getEmptyFormativeValues(fields);
    if (!values) return merged;

    const validIds = new Set(fields.map((f) => f.id));
    for (const [key, value] of Object.entries(values)) {
        if (validIds.has(key) && typeof value === 'string') {
            merged[key] = value;
        }
    }
    return merged;
}

export function pruneFormativeEntryValues(
    entries: FormativeEntry[],
    validFieldIds: string[]
): FormativeEntry[] {
    const validIds = new Set(validFieldIds);
    return entries.map((entry) => {
        const values: Record<string, string> = {};
        for (const [key, value] of Object.entries(entry.values)) {
            if (validIds.has(key)) {
                values[key] = value;
            }
        }
        return { ...entry, values };
    });
}

export function isFormativeEntryEmpty(
    entry: FormativeEntry,
    fieldIds: string[]
): boolean {
    return fieldIds.every(
        (id) => !(entry.values[id] ?? '').trim()
    );
}

export function fieldsConfigEqual(
    a: FormativeFeedbackField[],
    b: FormativeFeedbackField[]
): boolean {
    if (a.length !== b.length) return false;
    return a.every(
        (field, index) =>
            field.id === b[index]?.id && field.label === b[index]?.label
    );
}

export function milestonesConfigEqual(
    a: FormativeMilestone[],
    b: FormativeMilestone[]
): boolean {
    if (a.length !== b.length) return false;
    return a.every(
        (m, i) =>
            m.id === b[i]?.id &&
            m.name === b[i]?.name &&
            m.date === b[i]?.date &&
            (m.endDate ?? '') === (b[i]?.endDate ?? '')
    );
}

export function milestoneIdSet(milestones: FormativeMilestone[]): Set<string> {
    return new Set(milestones.map((m) => m.id));
}

/** Skip applying RSC props that would undo a persist this tab just completed. */
export function shouldApplyIncomingMilestones(args: {
    incoming: FormativeMilestone[];
    local: FormativeMilestone[];
    lastSaved: FormativeMilestone[];
}): boolean {
    const { incoming, local, lastSaved } = args;
    if (milestonesConfigEqual(incoming, local)) return false;
    if (milestonesConfigEqual(incoming, lastSaved)) return false;
    const incomingIds = milestoneIdSet(incoming);
    for (const id of milestoneIdSet(lastSaved)) {
        if (!incomingIds.has(id)) return false;
    }
    return true;
}

export function shouldApplyIncomingFeedbackFields(args: {
    incoming: FormativeFeedbackField[];
    local: FormativeFeedbackField[];
    lastSaved: FormativeFeedbackField[];
}): boolean {
    const { incoming, local, lastSaved } = args;
    if (fieldsConfigEqual(incoming, local)) return false;
    if (fieldsConfigEqual(incoming, lastSaved)) return false;
    const incomingIds = new Set(incoming.map((f) => f.id));
    for (const field of lastSaved) {
        if (!incomingIds.has(field.id)) return false;
    }
    return true;
}

function normalizeFormativeEntry(raw: unknown): FormativeEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const milestoneId =
        typeof o.milestoneId === 'string' ? o.milestoneId.trim() : '';
    const studentNumber = normalizeClassGroupStudentNumber(
        typeof o.studentNumber === 'string' ? o.studentNumber : ''
    );
    if (!milestoneId || !studentNumber) return null;

    let values: Record<string, string> = {};
    if (o.values && typeof o.values === 'object' && !Array.isArray(o.values)) {
        for (const [key, value] of Object.entries(
            o.values as Record<string, unknown>
        )) {
            if (typeof value === 'string') {
                values[key] = value;
            }
        }
    } else {
        values = {
            [DEFAULT_FORMATIVE_FEEDBACK_FIELD_IDS.strengths]:
                typeof o.strengths === 'string' ? o.strengths : '',
            [DEFAULT_FORMATIVE_FEEDBACK_FIELD_IDS.development]:
                typeof o.development === 'string' ? o.development : '',
            [DEFAULT_FORMATIVE_FEEDBACK_FIELD_IDS.comments]:
                typeof o.comments === 'string' ? o.comments : ''
        };
    }

    return {
        milestoneId,
        studentNumber,
        studentName:
            typeof o.studentName === 'string' ? o.studentName.trim() : '',
        values
    };
}

function flattenLegacyFormativeLog(raw: unknown): FormativeEntry[] {
    if (!Array.isArray(raw)) return [];

    const entries: FormativeEntry[] = [];
    for (const milestone of raw) {
        if (!milestone || typeof milestone !== 'object') continue;
        const m = milestone as Record<string, unknown>;
        const milestoneId =
            typeof m.id === 'string' ? m.id.trim() : '';
        if (!milestoneId || !Array.isArray(m.entries)) continue;

        for (const entry of m.entries) {
            const normalized = normalizeFormativeEntry(entry);
            if (normalized) {
                entries.push({ ...normalized, milestoneId });
            }
        }
    }
    return entries;
}

export function normalizeSuppressedStudentNumbers(
    raw: unknown
): string[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const value of raw) {
        if (typeof value !== 'string') {
            continue;
        }
        const number = normalizeClassGroupStudentNumber(value);
        if (!number || seen.has(number)) {
            continue;
        }
        seen.add(number);
        normalized.push(number);
        if (normalized.length >= MAX_SUPPRESSED_STUDENT_NUMBERS) {
            break;
        }
    }

    return normalized;
}

export function shouldFlushGradesPayload(
    current: string,
    lastFlushed: string | null
): boolean {
    return lastFlushed !== current;
}

export function studentGradingRichness(student: Student): number {
    let score = 0;
    const grade = student.grade?.trim() ?? '';
    if (grade && grade !== 'Pending') {
        score += 4;
    }

    const selections = student.selections ?? {};
    if (
        Object.values(selections).some(
            (value) => typeof value === 'number' && value > 0
        )
    ) {
        score += 2;
    }

    const feedback = student.feedback;
    if (feedback?.strengths?.trim()) {
        score += 1;
    }
    if (feedback?.development?.trim()) {
        score += 1;
    }
    if (feedback?.comments?.trim()) {
        score += 1;
    }
    if (student.date?.trim()) {
        score += 1;
    }

    return score;
}

export function hasStudentGradingData(student: Student): boolean {
    return studentGradingRichness(student) > 0;
}

/** Prefer graded fields from `gradedSource` onto `roster` rows matched by student number. */
export function overlayStudentGradesByNumber(
    roster: Student[],
    gradedSource: Student[]
): Student[] {
    const byNumber = new Map<string, Student>();

    for (const student of gradedSource) {
        const number = normalizeClassGroupStudentNumber(student.number);
        if (!number) {
            continue;
        }

        const existing = byNumber.get(number);
        if (
            !existing ||
            studentGradingRichness(student) >= studentGradingRichness(existing)
        ) {
            byNumber.set(number, student);
        }
    }

    return roster.map((student, index) => {
        const number = normalizeClassGroupStudentNumber(student.number);
        const gradedByNumber = number ? byNumber.get(number) : undefined;
        const gradedByIndex =
            !number &&
            gradedSource[index] &&
            studentGradingRichness(gradedSource[index]!) >
                studentGradingRichness(student)
                ? gradedSource[index]
                : undefined;
        const graded = gradedByNumber ?? gradedByIndex;

        if (
            !graded ||
            studentGradingRichness(graded) <= studentGradingRichness(student)
        ) {
            return student;
        }

        return {
            ...student,
            date: graded.date ?? student.date,
            grade: graded.grade ?? student.grade,
            selections: graded.selections ?? student.selections,
            feedback: graded.feedback ?? student.feedback
        };
    });
}

export function shouldPreferLocalGradesMirror(
    loaded: FeedbackSheetStudentData,
    stored: FeedbackSheetStudentData
): boolean {
    if (loaded.students.some(hasStudentGradingData)) {
        return false;
    }

    return stored.students.some(hasStudentGradingData);
}

export function shouldRestoreRemoteGradesDraft(input: {
    baseSerialized: string;
    loadedSerialized: string;
    draftSerialized: string;
}): boolean {
    return (
        input.baseSerialized === input.loadedSerialized &&
        input.draftSerialized !== input.loadedSerialized
    );
}

export function sortFormativeEntries(entries: FormativeEntry[]): FormativeEntry[] {
    return [...entries].sort((a, b) =>
        getFormativeEntryKey(a).localeCompare(getFormativeEntryKey(b))
    );
}

export function canonicalizeFeedbackSheetPayload(
    data: FeedbackSheetStudentData,
    milestones?: FormativeMilestone[],
    fields?: FormativeFeedbackField[],
    logTitle?: string
): string {
    const suppressedStudentNumbers = normalizeSuppressedStudentNumbers(
        data.suppressedStudentNumbers ?? []
    );
    const formativeEntries = sortFormativeEntries(data.formativeEntries);
    return serializeFeedbackSheetStudentData(
        {
            students: data.students,
            formativeEntries,
            suppressedStudentNumbers
        },
        milestones,
        fields,
        logTitle
    );
}

export type SaveGradesRemoteStatus = 'none' | 'skipped' | 'flushed' | 'failed';

export type SaveGradesDataResult = {
    committed: boolean;
    serialized: string;
    remote: SaveGradesRemoteStatus;
};

export function parseFeedbackSheetStudentData(
    raw: unknown
): FeedbackSheetStudentData {
    if (Array.isArray(raw)) {
        return { students: raw as Student[], formativeEntries: [] };
    }

    if (!raw || typeof raw !== 'object') {
        return { students: [], formativeEntries: [] };
    }

    const o = raw as Record<string, unknown>;
    const students = Array.isArray(o.students) ? (o.students as Student[]) : [];
    const suppressedStudentNumbers = normalizeSuppressedStudentNumbers(
        o.suppressedStudentNumbers
    );

    let formativeEntries: FormativeEntry[] = [];
    if (Array.isArray(o.formativeEntries)) {
        formativeEntries = o.formativeEntries
            .map(normalizeFormativeEntry)
            .filter((entry): entry is FormativeEntry => entry !== null);
    } else if (Array.isArray(o.formativeLog)) {
        formativeEntries = flattenLegacyFormativeLog(o.formativeLog);
    }

    return { students, formativeEntries, suppressedStudentNumbers };
}

export function serializeFeedbackSheetStudentData(
    data: FeedbackSheetStudentData,
    milestones?: FormativeMilestone[],
    fields?: FormativeFeedbackField[],
    logTitle?: string
): string {
    const payload: FeedbackSheetStudentExport = {
        students: data.students,
        formativeEntries: data.formativeEntries
    };
    if (
        data.suppressedStudentNumbers &&
        data.suppressedStudentNumbers.length > 0
    ) {
        payload.suppressedStudentNumbers = data.suppressedStudentNumbers;
    }
    if (milestones && milestones.length > 0) {
        payload.formativeMilestones = milestones;
    }
    if (fields && fields.length > 0) {
        payload.formativeFeedbackFields = fields;
    }
    if (logTitle && logTitle.trim()) {
        payload.formativeLogTitle = normalizeFormativeLogTitle(logTitle);
    }
    return JSON.stringify(payload, null, 2);
}

export function upsertFormativeEntry(
    entries: FormativeEntry[],
    entry: FormativeEntry,
    fieldIds: string[]
): FormativeEntry[] {
    const key = getFormativeEntryKey(entry);
    const index = entries.findIndex(
        (row) => getFormativeEntryKey(row) === key
    );

    if (isFormativeEntryEmpty(entry, fieldIds)) {
        if (index === -1) {
            return entries;
        }
        return entries.filter((_, i) => i !== index);
    }

    if (index === -1) {
        return [...entries, entry];
    }
    const updated = [...entries];
    updated[index] = entry;
    return updated;
}

export function pruneFormativeEntries(
    entries: FormativeEntry[],
    context: { milestoneIds: string[]; studentNumbers: string[] }
): FormativeEntry[] {
    const milestoneIds = new Set(context.milestoneIds);
    const studentNumbers = new Set(
        context.studentNumbers
            .map((number) => normalizeClassGroupStudentNumber(number))
            .filter(Boolean)
    );

    return entries.filter(
        (entry) =>
            milestoneIds.has(entry.milestoneId) &&
            studentNumbers.has(
                normalizeClassGroupStudentNumber(entry.studentNumber)
            )
    );
}

export function getLatestMilestoneId(
    milestones: FormativeMilestone[]
): string | null {
    return milestones.at(-1)?.id ?? null;
}

export function getNextMilestoneName(milestones: FormativeMilestone[]): string {
    const usedNumbers = new Set<number>();
    for (const milestone of milestones) {
        const match = /^Milestone\s+(\d+)$/i.exec(milestone.name.trim());
        if (match) {
            usedNumbers.add(parseInt(match[1], 10));
        }
    }
    let next = 1;
    while (usedNumbers.has(next)) {
        next += 1;
    }
    return `Milestone ${next}`;
}

export function mergeFormativeMilestones(
    existing: FormativeMilestone[],
    imported: FormativeMilestone[]
): FormativeMilestone[] {
    const byId = new Map(existing.map((m) => [m.id, m]));
    for (const milestone of imported) {
        byId.set(milestone.id, milestone);
    }
    return Array.from(byId.values());
}

export function sortStudentsBySurname<T extends { studentName?: string; name?: string }>(
    items: T[],
    nameKey: 'studentName' | 'name' = 'studentName'
): T[] {
    const getSurname = (name: string): string => {
        const parts = name.trim().split(/\s+/);
        return parts.length > 0 ? parts[parts.length - 1] : name;
    };

    return [...items].sort((a, b) => {
        const nameA = (nameKey === 'studentName' ? a.studentName : a.name) ?? '';
        const nameB = (nameKey === 'studentName' ? b.studentName : b.name) ?? '';

        const comparison = getSurname(nameA).localeCompare(
            getSurname(nameB),
            undefined,
            { sensitivity: 'base', numeric: true }
        );

        if (comparison === 0) {
            const firstNameA = nameA.trim().split(/\s+/)[0] || '';
            const firstNameB = nameB.trim().split(/\s+/)[0] || '';
            return firstNameA.localeCompare(firstNameB, undefined, {
                sensitivity: 'base',
                numeric: true
            });
        }

        return comparison;
    });
}

export function normalizeGradeLabel(grade: string | undefined): string {
    if (!grade || !grade.trim()) {
        return 'N/A';
    }
    return grade.trim();
}
