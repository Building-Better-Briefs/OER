import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import {
    parseBriefContentSave,
    normalizeBriefContentSave,
    type BriefContentSave
} from '@/lib/brief-content-schema';
import { briefSectionSnapshotsSchema } from '@/lib/brief-template';
import { BLOB_CONTENT_KEYS } from '@/lib/duplicate-brief';
import {
    buildBriefContentsFromTemplate,
    parseResolvedTemplate
} from '@/lib/brief-template';
import { DEFAULT_BRIEF_TEMPLATE } from '@/lib/templates';
import {
    formatDateField,
    formatDatetimeLocalField,
    parseDateField,
    parseDatetimeLocalField
} from '@/lib/brief-form-dates';
import type { BriefSection } from '@/builder/brief-builder-context';

export const SCHEMA_VERSION = 1;
const DB_NAME = 'abb-offline';
const DB_VERSION = 1;

export type BriefMetadataRecord = {
    programme: string;
    module: string;
    title: string;
    lecturer: string;
    startDate: string;
    submissionDate: string;
    individualGroup: string;
};

export type LocalBriefRecord = {
    schemaVersion: number;
    id: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
    metadata: BriefMetadataRecord;
    contents: {
        sections: BriefSection[];
        content: BriefContentSave;
        updatedAt: string;
    };
};

const metadataSchema = z.object({
    programme: z.string().min(1).max(200),
    module: z.string().min(1).max(200),
    title: z.string().min(1).max(500),
    lecturer: z.string().min(1).max(2000),
    startDate: z.string().min(1),
    submissionDate: z.string().min(1),
    individualGroup: z.string().min(1).max(500)
});

interface AbbDb extends DBSchema {
    briefs: {
        key: string;
        value: LocalBriefRecord;
        indexes: { 'by-updated': string };
    };
    meta: {
        key: string;
        value: unknown;
    };
}

let dbPromise: Promise<IDBPDatabase<AbbDb>> | null = null;

function getDb() {
    if (!dbPromise) {
        dbPromise = openDB<AbbDb>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore('briefs', { keyPath: 'id' });
                store.createIndex('by-updated', 'updatedAt');
                db.createObjectStore('meta');
            }
        });
    }
    return dbPromise;
}

function stripBlobs(content: BriefContentSave): BriefContentSave {
    const clone = { ...content } as Record<string, unknown>;
    for (const key of BLOB_CONTENT_KEYS) {
        delete clone[key];
    }
    const parsed = parseBriefContentSave(clone);
    if (!parsed.success) return content;
    return normalizeBriefContentSave(parsed.data);
}

export function metadataToForm(record: LocalBriefRecord) {
    const start = parseDateField(record.metadata.startDate);
    const submission = parseDatetimeLocalField(record.metadata.submissionDate);
    return {
        programme: record.metadata.programme,
        module: record.metadata.module,
        title: record.metadata.title,
        lecturer: record.metadata.lecturer,
        startDate: start ? formatDateField(start) : '',
        submissionDate: submission ? formatDatetimeLocalField(submission) : '',
        individualGroup: record.metadata.individualGroup
    };
}

export function metadataFromForm(input: {
    programme: string;
    module: string;
    title: string;
    lecturer: string;
    startDate: string;
    submissionDate: string;
    individualGroup: string;
}): BriefMetadataRecord {
    const start = parseDateField(input.startDate);
    const submission = parseDatetimeLocalField(input.submissionDate);
    if (!start || !submission) {
        throw new Error('Invalid dates');
    }
    return metadataSchema.parse({
        programme: input.programme.trim(),
        module: input.module.trim(),
        title: input.title.trim(),
        lecturer: input.lecturer.trim(),
        startDate: formatDateField(start),
        submissionDate: formatDatetimeLocalField(submission),
        individualGroup: input.individualGroup.trim()
    });
}

export function toBuilderMetadata(record: LocalBriefRecord) {
    const start = parseDateField(record.metadata.startDate)!;
    const submission = parseDatetimeLocalField(record.metadata.submissionDate)!;
    return {
        programmeName: record.metadata.programme,
        module: record.metadata.module,
        title: record.metadata.title,
        lecturer: record.metadata.lecturer,
        startDate: start,
        submissionDate: submission,
        individualGroup: record.metadata.individualGroup
    };
}

export async function listBriefs(): Promise<LocalBriefRecord[]> {
    const db = await getDb();
    const all = await db.getAll('briefs');
    return all
        .filter((b) => !b.deletedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getBrief(id: string): Promise<LocalBriefRecord | undefined> {
    const db = await getDb();
    return db.get('briefs', id);
}

export async function createBrief(metadata: BriefMetadataRecord): Promise<LocalBriefRecord> {
    const parsed = parseResolvedTemplate({
        slug: DEFAULT_BRIEF_TEMPLATE.slug,
        name: DEFAULT_BRIEF_TEMPLATE.name,
        sections: DEFAULT_BRIEF_TEMPLATE.sections,
        content: {},
        links: []
    });
    const seeded = buildBriefContentsFromTemplate(parsed);
    const sections = seeded.sections.map((s) =>
        s.id === 'example-feedback' ? { ...s, enabled: false } : s
    ) as BriefSection[];
    const now = new Date().toISOString();
    const record: LocalBriefRecord = {
        schemaVersion: SCHEMA_VERSION,
        id: crypto.randomUUID(),
        revision: 1,
        createdAt: now,
        updatedAt: now,
        metadata,
        contents: {
            sections,
            content: stripBlobs(seeded.content),
            updatedAt: now
        }
    };
    const db = await getDb();
    await db.put('briefs', record);
    return record;
}

export type WriteResult =
    | { ok: true; record: LocalBriefRecord }
    | { ok: false; reason: 'conflict' | 'not_found' | 'invalid' | 'quota' };

export async function writeBrief(
    record: LocalBriefRecord,
    expectedRevision: number
): Promise<WriteResult> {
    const sectionsParsed = briefSectionSnapshotsSchema.safeParse(record.contents.sections);
    const contentParsed = parseBriefContentSave(record.contents.content);
    if (!sectionsParsed.success || !contentParsed.success) {
        return { ok: false, reason: 'invalid' };
    }
    const normalized = stripBlobs(contentParsed.data);
    const next: LocalBriefRecord = {
        ...record,
        contents: {
            ...record.contents,
            content: normalized,
            updatedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString(),
        revision: expectedRevision + 1
    };
    try {
        const db = await getDb();
        const existing = await db.get('briefs', record.id);
        if (!existing) return { ok: false, reason: 'not_found' };
        if (existing.revision !== expectedRevision) {
            return { ok: false, reason: 'conflict' };
        }
        await db.put('briefs', next);
        return { ok: true, record: next };
    } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            return { ok: false, reason: 'quota' };
        }
        throw e;
    }
}

export async function softDeleteBrief(id: string): Promise<void> {
    const db = await getDb();
    const existing = await db.get('briefs', id);
    if (!existing) return;
    await db.put('briefs', {
        ...existing,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revision: existing.revision + 1
    });
}

export async function duplicateBrief(source: LocalBriefRecord): Promise<LocalBriefRecord> {
    const now = new Date().toISOString();
    const copy: LocalBriefRecord = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        revision: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: undefined,
        metadata: {
            ...source.metadata,
            title: `${source.metadata.title} (copy)`
        },
        contents: {
            ...source.contents,
            updatedAt: now
        }
    };
    const db = await getDb();
    await db.put('briefs', copy);
    return copy;
}

export async function exportAllBriefs(): Promise<Blob> {
    const briefs = await listBriefs();
    const payload = {
        format: 'abb-bundle',
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        briefs
    };
    return new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json'
    });
}

export async function importBriefsFromFile(file: File): Promise<number> {
    const text = await file.text();
    const data = JSON.parse(text) as { briefs?: LocalBriefRecord[] };
    if (!Array.isArray(data.briefs)) {
        throw new Error('Invalid backup file');
    }
    const db = await getDb();
    const tx = db.transaction('briefs', 'readwrite');
    let count = 0;
    for (const brief of data.briefs) {
        await tx.store.put(brief);
        count++;
    }
    await tx.done;
    return count;
}

export async function requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage?.persist) return false;
    try {
        return await navigator.storage.persist();
    } catch {
        return false;
    }
}
