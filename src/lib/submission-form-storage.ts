export type SubmissionFormValues = Record<string, string>;

const LEGACY_STORAGE_KEY = 'submissionFormValues';

export type StoredSubmissionFormDraft = {
    values: SubmissionFormValues;
    updatedAt?: string;
    revision?: number;
};

export function submissionFormFieldKey(index: number, title: string): string {
    return `submission-field-${index}-${title}`;
}

export function submissionFormSignedKey(index: number, title: string): string {
    return `${submissionFormFieldKey(index, title)}-signed`;
}

export function submissionFormStorageKey(
    briefId: string,
    userId?: number | null
): string {
    if (userId != null) {
        return `submissionFormValues:${briefId}:${userId}`;
    }
    return `submissionFormValues:${briefId}`;
}

function parseStoredValues(raw: string): SubmissionFormValues | null {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return null;
        }

        const record = parsed as Record<string, unknown>;
        if (record.values && typeof record.values === 'object' && !Array.isArray(record.values)) {
            const values: SubmissionFormValues = {};
            for (const [key, value] of Object.entries(
                record.values as Record<string, unknown>
            )) {
                if (typeof key === 'string' && typeof value === 'string') {
                    values[key] = value;
                }
            }
            return values;
        }

        const values: SubmissionFormValues = {};
        for (const [key, value] of Object.entries(record)) {
            if (typeof key === 'string' && typeof value === 'string') {
                values[key] = value;
            }
        }
        return values;
    } catch {
        return null;
    }
}

function parseWrappedDraft(raw: string): StoredSubmissionFormDraft | null {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return null;
        }

        const record = parsed as Record<string, unknown>;
        if (record.values && typeof record.values === 'object') {
            const values = parseStoredValues(JSON.stringify({ values: record.values }));
            if (!values) {
                return null;
            }
            return {
                values,
                updatedAt:
                    typeof record.updatedAt === 'string'
                        ? record.updatedAt
                        : undefined,
                revision:
                    typeof record.revision === 'number'
                        ? record.revision
                        : undefined
            };
        }

        const legacyValues = parseStoredValues(raw);
        return legacyValues ? { values: legacyValues } : null;
    } catch {
        return null;
    }
}

export function loadSubmissionFormDraft(input: {
    briefId: string;
    userId?: number | null;
}): StoredSubmissionFormDraft | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const keys: string[] = [];
    if (input.userId != null) {
        keys.push(submissionFormStorageKey(input.briefId, input.userId));
    }
    keys.push(submissionFormStorageKey(input.briefId));

    for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (!stored) {
            continue;
        }
        const parsed = parseWrappedDraft(stored);
        if (parsed) {
            return parsed;
        }
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) {
        return null;
    }

    const migrated = parseWrappedDraft(legacy);
    if (!migrated) {
        return null;
    }

    writeSubmissionFormDraft(input.briefId, migrated, input.userId);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrated;
}

export function loadSubmissionFormValues(
    briefId: string | undefined,
    userId?: number | null
): SubmissionFormValues {
    if (!briefId) {
        return {};
    }

    return (
        loadSubmissionFormDraft({ briefId, userId })?.values ?? {}
    );
}

export function writeSubmissionFormDraft(
    briefId: string,
    draft: StoredSubmissionFormDraft,
    userId?: number | null
): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(
            submissionFormStorageKey(briefId, userId),
            JSON.stringify(draft)
        );
    } catch {
        // Safari private mode / quota
    }
}

export function saveSubmissionFormValues(
    briefId: string | undefined,
    values: SubmissionFormValues,
    userId?: number | null
): void {
    if (typeof window === 'undefined' || !briefId) {
        return;
    }

    writeSubmissionFormDraft(
        briefId,
        {
            values,
            updatedAt: new Date().toISOString()
        },
        userId
    );
}

export function pruneSubmissionFormValues(
    values: SubmissionFormValues,
    validKeys: Set<string>
): SubmissionFormValues {
    const pruned: SubmissionFormValues = {};
    for (const [key, value] of Object.entries(values)) {
        if (validKeys.has(key)) {
            pruned[key] = value;
        }
    }
    return pruned;
}

export function getSubmissionFieldValue(
    values: SubmissionFormValues,
    index: number,
    field: { title: string },
    options?: { signed?: boolean }
): string {
    const key = options?.signed
        ? submissionFormSignedKey(index, field.title)
        : submissionFormFieldKey(index, field.title);
    return values[key]?.trim() ?? '';
}
