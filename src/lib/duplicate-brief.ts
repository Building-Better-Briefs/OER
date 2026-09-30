type JsonValue = unknown;
type InputJsonValue = unknown;

/** Top-level `contents` keys that point at Azure blobs — never clone (original files stay safe). */
export const BLOB_CONTENT_KEYS = [
    'recording',
    'exampleFeedbackForm',
    'aiPolicyDocument'
] as const;

export type DuplicateBriefSource = {
    module: string;
    module_id: number | null;
    title: string;
    lecturer: string;
    start_date: Date;
    submission_date: Date;
    individual_group: string;
    programme_id: number;
    year_group: string | null;
    user_id: number;
    contents: JsonValue;
};

export type DuplicateFeedbackSheetSource = {
    assessors: string;
    date: Date;
    criteria: JsonValue;
    formativeMilestones: JsonValue;
    formativeFeedbackFields: JsonValue;
    formativeLogTitle: string;
};

export type DuplicateFeedbackSheetCreate = {
    assessors: string;
    date: Date;
    criteria: InputJsonValue;
    formativeMilestones: InputJsonValue;
    formativeFeedbackFields: InputJsonValue;
    formativeLogTitle: string;
    user_id: number;
};

export function buildDuplicateTitle(title: string): string {
    return `${title} (Copy)`;
}

export function cloneJsonValue(value: JsonValue): JsonValue {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
}

export function cloneBriefContents(contents: JsonValue | null | undefined): InputJsonValue {
    let cloned: Record<string, unknown>;

    if (contents === null || contents === undefined) {
        cloned = {};
    } else if (typeof contents === 'object' && !Array.isArray(contents)) {
        try {
            cloned = structuredClone(contents) as Record<string, unknown>;
        } catch {
            try {
                cloned = JSON.parse(JSON.stringify(contents)) as Record<string, unknown>;
            } catch {
                cloned = {};
            }
        }
    } else {
        cloned = {};
    }

    for (const key of BLOB_CONTENT_KEYS) {
        delete cloned[key];
    }

    return cloned as InputJsonValue;
}

export function collectCollaboratorIdsForDuplicate(
    originalOwnerId: number,
    collaboratorUserIds: number[],
    duplicatorId: number
): number[] {
    const ids = new Set<number>();

    for (const collaboratorId of collaboratorUserIds) {
        if (collaboratorId !== duplicatorId) {
            ids.add(collaboratorId);
        }
    }

    if (originalOwnerId !== duplicatorId) {
        ids.add(originalOwnerId);
    }

    return Array.from(ids);
}

export function buildDuplicateFeedbackSheetCreates(
    sheets: DuplicateFeedbackSheetSource[],
    duplicatorId: number
): DuplicateFeedbackSheetCreate[] {
    return sheets.map((sheet) => ({
        assessors: sheet.assessors,
        date: sheet.date,
        criteria: cloneJsonValue(sheet.criteria) as InputJsonValue,
        formativeMilestones: cloneJsonValue(sheet.formativeMilestones) as InputJsonValue,
        formativeFeedbackFields: cloneJsonValue(
            sheet.formativeFeedbackFields
        ) as InputJsonValue,
        formativeLogTitle: sheet.formativeLogTitle,
        user_id: duplicatorId
    }));
}
