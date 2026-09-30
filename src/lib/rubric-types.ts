import type { RichTextValue } from '@/lib/rich-text-utils';
import { createCriterionId } from '@/lib/criterion-id';

export type RubricRichText = string | RichTextValue;

export type RubricCriterion = {
    id: string;
    criterion: string;
    assessedThrough: string;
    weighting: number;
    learningOutcomes: number[];
    gradeDescriptors: Array<{ grade: string; description: RubricRichText }>;
};

export type GradeGrouping = 'grouped' | 'separate' | 'custom';

/** Split comma, semicolon, or newline–separated grade band labels. */
export function parseRubricCustomGradeList(input: string): string[] {
    return input
        .split(/[\n,;]+/u)
        .map((g) => g.trim())
        .filter((g) => g.length > 0);
}

export function buildCustomGradeDescriptors(grades: string[]) {
    return grades.map((grade) => ({ grade, description: '' as RubricRichText }));
}

export function createEmptyRubricCriterion(): RubricCriterion {
    return {
        id: createCriterionId(),
        criterion: '',
        assessedThrough: '',
        weighting: 0,
        learningOutcomes: [],
        gradeDescriptors: [{ grade: '', description: '' }]
    };
}

type RubricCriterionInput = {
    id?: string;
    criterion?: string;
    assessedThrough?: string;
    weighting?: number;
    learningOutcomes?: number[];
    gradeDescriptors?: Array<{ grade: string; description: RubricRichText }>;
};

export function ensureRubricCriteriaIds(
    criteria: RubricCriterionInput[]
): { criteria: RubricCriterion[]; changed: boolean } {
    const seen = new Set<string>();
    let changed = false;

    const normalized = criteria.map((row) => {
        const base = {
            ...createEmptyRubricCriterion(),
            ...row,
            learningOutcomes: Array.isArray(row.learningOutcomes)
                ? row.learningOutcomes
                : [],
            gradeDescriptors: Array.isArray(row.gradeDescriptors)
                ? row.gradeDescriptors.map((gd) => ({
                      grade: typeof gd?.grade === 'string' ? gd.grade : '',
                      description:
                          gd?.description !== undefined && gd?.description !== null
                              ? gd.description
                              : ''
                  }))
                : [{ grade: '', description: '' }]
        };

        let id = typeof base.id === 'string' ? base.id.trim() : '';
        if (!id || seen.has(id)) {
            id = createCriterionId();
            changed = true;
        }
        seen.add(id);

        return {
            ...base,
            id,
            criterion: typeof base.criterion === 'string' ? base.criterion : '',
            assessedThrough:
                typeof base.assessedThrough === 'string'
                    ? base.assessedThrough
                    : '',
            weighting: Number(base.weighting) || 0
        };
    });

    return { criteria: normalized, changed };
}

/** Deep-copy saved rubric JSON into brief-local criteria with no LO links. */
export function clonePremadeRubricCriteriaForBrief(raw: unknown): RubricCriterion[] {
    if (!Array.isArray(raw)) {
        return [createEmptyRubricCriterion()];
    }
    try {
        const cloned = JSON.parse(JSON.stringify(raw)) as RubricCriterionInput[];
        if (!Array.isArray(cloned) || cloned.length === 0) {
            return [createEmptyRubricCriterion()];
        }
        return ensureRubricCriteriaIds(
            cloned.map((row) => ({
                ...row,
                learningOutcomes: []
            }))
        ).criteria;
    } catch {
        return [createEmptyRubricCriterion()];
    }
}

/** One rubric criterion per titled learning outcome, linked by index. */
export function buildRubricCriteriaFromLearningOutcomes(
    learningOutcomes: Array<{ title: string; weighting: number }>
): RubricCriterion[] {
    const criteria = learningOutcomes.flatMap((outcome, index) => {
        const title = (outcome.title || '').trim();
        if (!title) return [];

        return [
            {
                ...createEmptyRubricCriterion(),
                criterion: title,
                weighting: Number(outcome.weighting) || 0,
                learningOutcomes: [index]
            }
        ];
    });

    return criteria.length > 0 ? criteria : [createEmptyRubricCriterion()];
}
