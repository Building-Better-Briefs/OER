export type AiUsageLogEntry = {
    id: string;
    date: string;
    tool: string;
    purpose: string;
    howUsed: string;
    reflection: string;
};

export type AiUsageLogDraft = {
    studentName: string;
    studentNumber: string;
    entries: AiUsageLogEntry[];
    declarationConfirmed: boolean;
    updatedAt: string;
};

export type StoredAiUsageLogDraft = AiUsageLogDraft & {
    revision?: number;
};

export function aiUsageLogStorageKey(
    briefId: string,
    userId?: number | null
): string {
    if (userId != null) {
        return `aiUsageLog:${briefId}:${userId}`;
    }
    return `aiUsageLog:${briefId}`;
}

export function createEmptyAiUsageLogDraft(): AiUsageLogDraft {
    return {
        studentName: '',
        studentNumber: '',
        entries: [],
        declarationConfirmed: false,
        updatedAt: new Date().toISOString()
    };
}

export function createEmptyAiUsageLogEntry(): AiUsageLogEntry {
    return {
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        tool: '',
        purpose: '',
        howUsed: '',
        reflection: ''
    };
}

function normalizeEntry(value: unknown): AiUsageLogEntry | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const entry = value as Partial<AiUsageLogEntry>;
    return {
        id:
            typeof entry.id === 'string' && entry.id.trim()
                ? entry.id
                : crypto.randomUUID(),
        date:
            typeof entry.date === 'string'
                ? entry.date
                : new Date().toISOString().slice(0, 10),
        tool: typeof entry.tool === 'string' ? entry.tool : '',
        purpose: typeof entry.purpose === 'string' ? entry.purpose : '',
        howUsed: typeof entry.howUsed === 'string' ? entry.howUsed : '',
        reflection:
            typeof entry.reflection === 'string' ? entry.reflection : ''
    };
}

function normalizeDraft(parsed: Partial<StoredAiUsageLogDraft>): StoredAiUsageLogDraft {
    const empty = createEmptyAiUsageLogDraft();

    return {
        studentName:
            typeof parsed.studentName === 'string'
                ? parsed.studentName
                : empty.studentName,
        studentNumber:
            typeof parsed.studentNumber === 'string'
                ? parsed.studentNumber
                : empty.studentNumber,
        entries: Array.isArray(parsed.entries)
            ? parsed.entries
                  .map(normalizeEntry)
                  .filter((entry): entry is AiUsageLogEntry => entry !== null)
            : empty.entries,
        declarationConfirmed: parsed.declarationConfirmed === true,
        updatedAt:
            typeof parsed.updatedAt === 'string'
                ? parsed.updatedAt
                : new Date().toISOString(),
        revision:
            typeof parsed.revision === 'number' ? parsed.revision : undefined
    };
}

export function loadAiUsageLogDraft(input: {
    briefId: string;
    userId?: number | null;
}): StoredAiUsageLogDraft | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const keys: string[] = [];
    if (input.userId != null) {
        keys.push(aiUsageLogStorageKey(input.briefId, input.userId));
    }
    keys.push(aiUsageLogStorageKey(input.briefId));

    for (const key of keys) {
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                continue;
            }

            const parsed = JSON.parse(raw) as Partial<StoredAiUsageLogDraft>;
            return normalizeDraft(parsed);
        } catch {
            continue;
        }
    }

    return null;
}

export function writeAiUsageLogDraft(
    briefId: string,
    draft: StoredAiUsageLogDraft,
    userId?: number | null
): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            aiUsageLogStorageKey(briefId, userId),
            JSON.stringify(draft)
        );
    } catch {
        // Safari private mode / quota
    }
}

export function saveAiUsageLogDraft(
    briefId: string,
    draft: AiUsageLogDraft,
    userId?: number | null
): void {
    const stored = draft as StoredAiUsageLogDraft;
    writeAiUsageLogDraft(
        briefId,
        {
            ...stored,
            updatedAt: new Date().toISOString()
        },
        userId
    );
}
