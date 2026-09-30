export type ChecklistDraftData = {
    items: Record<string, boolean>;
};

export type ChecklistDraftEnvelope = {
    data: ChecklistDraftData;
    revision: number;
    updatedAt: string;
};

export type StoredChecklistDraft = {
    items: Record<string, boolean>;
    updatedAt?: string;
    revision?: number;
};

export function checklistStorageKey(
    briefId: string,
    userId?: number | null
): string {
    if (userId != null) {
        return `checklistItems:${briefId}:${userId}`;
    }
    return `checklistItems:${briefId}`;
}

export function legacyChecklistStorageKey(title: string, module: string): string {
    return `checklistItems-${title}-${module}`;
}

export function studentDraftOwnerKey(briefId: string): string {
    return `studentDraftOwner:${briefId}`;
}

function parseStoredItems(raw: string): Record<string, boolean> | null {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return null;
        }

        const items: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof key === 'string' && typeof value === 'boolean') {
                items[key] = value;
            }
        }
        return items;
    } catch {
        return null;
    }
}

function parseWrappedDraft(raw: string): StoredChecklistDraft | null {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return null;
        }

        const record = parsed as Record<string, unknown>;
        if (record.items && typeof record.items === 'object' && !Array.isArray(record.items)) {
            const items = parseStoredItems(JSON.stringify(record.items));
            if (!items) {
                return null;
            }
            return {
                items,
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

        const legacyItems = parseStoredItems(raw);
        return legacyItems ? { items: legacyItems } : null;
    } catch {
        return null;
    }
}

export function loadChecklistDraft(input: {
    briefId: string;
    userId?: number | null;
    legacyTitle?: string;
    legacyModule?: string;
}): StoredChecklistDraft | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const keysToTry: string[] = [];
    if (input.userId != null) {
        keysToTry.push(checklistStorageKey(input.briefId, input.userId));
    }
    keysToTry.push(checklistStorageKey(input.briefId));
    if (input.legacyTitle && input.legacyModule) {
        keysToTry.push(
            legacyChecklistStorageKey(input.legacyTitle, input.legacyModule)
        );
    }

    for (const key of keysToTry) {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            continue;
        }
        const parsed = parseWrappedDraft(raw);
        if (parsed) {
            return parsed;
        }
    }

    return null;
}

export function writeChecklistDraft(
    briefId: string,
    draft: StoredChecklistDraft,
    userId?: number | null
): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            checklistStorageKey(briefId, userId),
            JSON.stringify(draft)
        );
    } catch {
        // Safari private mode / quota
    }
}

export function saveChecklistDraft(
    briefId: string,
    items: Record<string, boolean>,
    userId?: number | null
): void {
    writeChecklistDraft(
        briefId,
        {
            items,
            updatedAt: new Date().toISOString()
        },
        userId
    );
}

export function migrateChecklistDraftToUserScope(input: {
    briefId: string;
    userId: number;
    legacyTitle?: string;
    legacyModule?: string;
}): StoredChecklistDraft | null {
    const loaded = loadChecklistDraft({
        briefId: input.briefId,
        legacyTitle: input.legacyTitle,
        legacyModule: input.legacyModule
    });

    if (!loaded) {
        return null;
    }

    writeChecklistDraft(input.briefId, loaded, input.userId);

    if (typeof window !== 'undefined') {
        try {
            window.localStorage.removeItem(checklistStorageKey(input.briefId));
            if (input.legacyTitle && input.legacyModule) {
                window.localStorage.removeItem(
                    legacyChecklistStorageKey(
                        input.legacyTitle,
                        input.legacyModule
                    )
                );
            }
        } catch {
            // ignore
        }
    }

    return loaded;
}

export function pruneChecklistItems(
    items: Record<string, boolean>,
    validKeys: Set<string>
): Record<string, boolean> {
    const pruned: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(items)) {
        if (validKeys.has(key)) {
            pruned[key] = value;
        }
    }
    return pruned;
}

export function buildChecklistItemKeys(
    checklistItems: string[]
): Set<string> {
    return new Set(
        checklistItems.map((item, idx) => `checklist-${idx}-${item}`)
    );
}
