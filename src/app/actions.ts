/** Offline stubs — no server. */
import type { ClassGroupSummary } from '@/lib/class-group';

export type ListClassGroupsResult =
    | { status: 'unconfigured' }
    | { status: 'error'; error: string }
    | { status: 'ok'; groups: ClassGroupSummary[] };

export async function listClassGroups(): Promise<ListClassGroupsResult> {
    return { status: 'unconfigured' };
}

export type SavedRubricRow = {
    id: number;
    name: string;
    criteria: unknown;
};

export async function getUserRubrics(): Promise<SavedRubricRow[]> {
    return [];
}

export async function saveStudentBriefDraft(_input: {
    briefId: unknown;
    kind: string;
    payload: unknown;
    baseRevision: number | null;
}): Promise<
    | { ok: true; revision: number; updatedAt: string }
    | { ok: false; error: string }
> {
    return {
        ok: true,
        revision: 1,
        updatedAt: new Date().toISOString()
    };
}
