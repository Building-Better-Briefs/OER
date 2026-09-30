import { criteriaHaveIds } from '@/lib/criterion-id';
import type { RubricCriterion } from '@/lib/rubric-types';

export type SelfAssessmentFeedback = {
    strengths: string;
    development: string;
    comments: string;
};

export type SelfAssessmentDraft = {
    studentName: string;
    studentNumber: string;
    date: string;
    selections: Record<string, string>;
    feedback: SelfAssessmentFeedback;
    updatedAt: string;
};

export type StoredSelfAssessmentDraft = SelfAssessmentDraft & {
    revision?: number;
};

export const SELF_ASSESSMENT_GRADE_OPTIONS = [
    'A',
    'B+',
    'B',
    'B-',
    'C+',
    'C',
    'D',
    'F'
] as const;

export type SelfAssessmentGrade = (typeof SELF_ASSESSMENT_GRADE_OPTIONS)[number];

const VALID_GRADES = new Set<string>(SELF_ASSESSMENT_GRADE_OPTIONS);

/** Numeric mark used when a letter grade is selected (weighted for overall grade). */
export const LETTER_GRADE_TO_SCORE: Record<SelfAssessmentGrade, number> = {
    A: 90,
    'B+': 75,
    B: 65,
    'B-': 57.5,
    'C+': 52.5,
    C: 45,
    D: 35,
    F: 0
};

/** Convert a weighted-average percentage to a letter grade. */
export function scoreToLetterGrade(score: number): SelfAssessmentGrade {
    if (score >= 82.5) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 61.25) return 'B';
    if (score >= 55) return 'B-';
    if (score >= 48.75) return 'C+';
    if (score >= 40) return 'C';
    if (score >= 17.5) return 'D';
    return 'F';
}

export type SelfAssessmentOverallGrade =
    | { status: 'pending' }
    | { status: 'ready'; letterGrade: SelfAssessmentGrade; percentage: number };

export function calculateSelfAssessmentOverallGrade(
    selections: Record<string, string>,
    criteriaRows: RubricCriterion[]
): SelfAssessmentOverallGrade {
    if (criteriaRows.length === 0) {
        return { status: 'pending' };
    }

    let weightedSum = 0;
    let totalWeight = 0;
    const unweightedScores: number[] = [];

    for (const row of criteriaRows) {
        const letter = selections[row.id];
        if (!letter) {
            return { status: 'pending' };
        }

        const score = LETTER_GRADE_TO_SCORE[letter as SelfAssessmentGrade];
        if (score === undefined) {
            return { status: 'pending' };
        }

        const weight = Number(row.weighting) || 0;
        if (weight > 0) {
            weightedSum += score * weight;
            totalWeight += weight;
        } else {
            unweightedScores.push(score);
        }
    }

    let percentage: number;
    if (totalWeight > 0) {
        percentage = weightedSum / totalWeight;
    } else if (unweightedScores.length === criteriaRows.length) {
        percentage =
            unweightedScores.reduce((sum, value) => sum + value, 0) /
            unweightedScores.length;
    } else {
        return { status: 'pending' };
    }

    return {
        status: 'ready',
        letterGrade: scoreToLetterGrade(percentage),
        percentage: Math.round(percentage * 10) / 10
    };
}

export function selfAssessmentStorageKey(
    briefId: string,
    userId?: number | null
): string {
    if (userId != null) {
        return `selfAssessment:${briefId}:${userId}`;
    }
    return `selfAssessment:${briefId}`;
}

export function createEmptySelfAssessmentDraft(): SelfAssessmentDraft {
    return {
        studentName: '',
        studentNumber: '',
        date: new Date().toISOString().slice(0, 10),
        selections: {},
        feedback: {
            strengths: '',
            development: '',
            comments: ''
        },
        updatedAt: new Date().toISOString()
    };
}

export function pruneSelfAssessmentSelections(
    selections: Record<string, string> | undefined,
    criteriaRows: RubricCriterion[]
): Record<string, string> {
    if (!selections) {
        return {};
    }

    const validIds = new Set(criteriaRows.map((row) => row.id));
    const pruned: Record<string, string> = {};

    for (const [key, value] of Object.entries(selections)) {
        if (!validIds.has(key)) {
            continue;
        }
        if (typeof value === 'string' && VALID_GRADES.has(value)) {
            pruned[key] = value;
        }
    }

    return pruned;
}

export function normalizeSelfAssessmentDraft(
    draft: SelfAssessmentDraft,
    criteriaRows: RubricCriterion[]
): SelfAssessmentDraft {
    return {
        ...draft,
        selections: pruneSelfAssessmentSelections(
            draft.selections,
            criteriaRows
        )
    };
}

export { criteriaHaveIds };

export function loadSelfAssessmentDraft(input: {
    briefId: string;
    userId?: number | null;
}): StoredSelfAssessmentDraft | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const keys: string[] = [];
    if (input.userId != null) {
        keys.push(selfAssessmentStorageKey(input.briefId, input.userId));
    }
    keys.push(selfAssessmentStorageKey(input.briefId));

    for (const key of keys) {
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                continue;
            }

            const parsed = JSON.parse(raw) as Partial<StoredSelfAssessmentDraft>;
            const empty = createEmptySelfAssessmentDraft();

            return {
                studentName:
                    typeof parsed.studentName === 'string'
                        ? parsed.studentName
                        : empty.studentName,
                studentNumber:
                    typeof parsed.studentNumber === 'string'
                        ? parsed.studentNumber
                        : empty.studentNumber,
                date:
                    typeof parsed.date === 'string' ? parsed.date : empty.date,
                selections:
                    parsed.selections &&
                    typeof parsed.selections === 'object' &&
                    !Array.isArray(parsed.selections)
                        ? (parsed.selections as Record<string, string>)
                        : empty.selections,
                feedback: {
                    strengths:
                        typeof parsed.feedback?.strengths === 'string'
                            ? parsed.feedback.strengths
                            : empty.feedback.strengths,
                    development:
                        typeof parsed.feedback?.development === 'string'
                            ? parsed.feedback.development
                            : empty.feedback.development,
                    comments:
                        typeof parsed.feedback?.comments === 'string'
                            ? parsed.feedback.comments
                            : empty.feedback.comments
                },
                updatedAt:
                    typeof parsed.updatedAt === 'string'
                        ? parsed.updatedAt
                        : new Date().toISOString(),
                revision:
                    typeof parsed.revision === 'number'
                        ? parsed.revision
                        : undefined
            };
        } catch {
            continue;
        }
    }

    return null;
}

export function writeSelfAssessmentDraft(
    briefId: string,
    draft: StoredSelfAssessmentDraft,
    userId?: number | null
): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            selfAssessmentStorageKey(briefId, userId),
            JSON.stringify(draft)
        );
    } catch {
        // Safari private mode / quota
    }
}

export function saveSelfAssessmentDraft(
    briefId: string,
    draft: SelfAssessmentDraft,
    userId?: number | null
): void {
    const stored = draft as StoredSelfAssessmentDraft;
    writeSelfAssessmentDraft(
        briefId,
        {
            ...stored,
            updatedAt: new Date().toISOString()
        },
        userId
    );
}

export function selectionsToNumericScores(
    selections: Record<string, string>
): Record<string, number> {
    const numeric: Record<string, number> = {};

    for (const [criterionId, letter] of Object.entries(selections)) {
        const score =
            LETTER_GRADE_TO_SCORE[letter as SelfAssessmentGrade];
        if (score !== undefined) {
            numeric[criterionId] = score;
        }
    }

    return numeric;
}
