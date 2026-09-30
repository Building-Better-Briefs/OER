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
import {
    getInstitutionAiPolicy,
    type InstitutionalAiPolicy
} from '@/lib/institution-config';
import { isSampleBriefId } from '@/lib/sample-brief-ids';

export const SCHEMA_VERSION = 1;
export const INSTITUTIONAL_POLICY_LABEL_MAX = 200;
export const INSTITUTIONAL_POLICY_URL_MAX = 2000;
const DB_NAME = 'abb-offline';
const DB_VERSION = 1;
const META_SAMPLES_SEEDED_KEY = 'samplesSeeded';

type SamplesSeededMeta = { version: 1; seeded: boolean };

let samplesEnsureCacheHit = false;
let samplesEnsurePromise: Promise<void> | null = null;

export type BriefMetadataRecord = {
    programme: string;
    module: string;
    title: string;
    lecturer: string;
    startDate: string;
    submissionDate: string;
    individualGroup: string;
    institutionalPolicyLabel?: string;
    institutionalPolicyUrl?: string;
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
    individualGroup: z.string().min(1).max(500),
    institutionalPolicyLabel: z
        .string()
        .max(INSTITUTIONAL_POLICY_LABEL_MAX)
        .optional()
        .default(''),
    institutionalPolicyUrl: z
        .string()
        .max(INSTITUTIONAL_POLICY_URL_MAX)
        .optional()
        .default('')
});

/**
 * Per-brief institutional footer link when both label and URL are set;
 * otherwise falls back to institution config (incomplete pairs use fallback).
 */
export function resolveInstitutionalAiPolicy(
    metadata: Pick<
        BriefMetadataRecord,
        'institutionalPolicyLabel' | 'institutionalPolicyUrl'
    >
): InstitutionalAiPolicy {
    const label = metadata.institutionalPolicyLabel?.trim() ?? '';
    const url = metadata.institutionalPolicyUrl?.trim() ?? '';
    if (label && url) {
        return { label, url };
    }
    return getInstitutionAiPolicy();
}

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
        individualGroup: record.metadata.individualGroup,
        institutionalPolicyLabel:
            record.metadata.institutionalPolicyLabel ?? '',
        institutionalPolicyUrl: record.metadata.institutionalPolicyUrl ?? ''
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
    institutionalPolicyLabel: string;
    institutionalPolicyUrl: string;
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
        individualGroup: input.individualGroup.trim(),
        institutionalPolicyLabel: input.institutionalPolicyLabel.trim(),
        institutionalPolicyUrl: input.institutionalPolicyUrl.trim()
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
    const sections = seeded.sections as BriefSection[];
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
    if (isSampleBriefId(id)) return;
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

/** @returns true when seeding is finished (success, skipped, or already done). */
async function runEnsureSampleBriefs(): Promise<boolean> {
    const db = await getDb();
    const existingMeta = await db.get('meta', META_SAMPLES_SEEDED_KEY);
    if (existingMeta) {
        return true;
    }

    const { buildSampleBriefs } = await import('@/lib/sample-briefs');
    let samples: LocalBriefRecord[];
    try {
        samples = buildSampleBriefs();
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error('[ensureSampleBriefs] build failed', error);
        }
        return false;
    }

    for (const record of samples) {
        const sectionsParsed = briefSectionSnapshotsSchema.safeParse(
            record.contents.sections
        );
        const contentParsed = parseBriefContentSave(record.contents.content);
        if (!sectionsParsed.success || !contentParsed.success) {
            if (import.meta.env.DEV) {
                console.error(
                    '[ensureSampleBriefs] validation failed',
                    sectionsParsed.success ? null : sectionsParsed.error,
                    contentParsed.success ? null : contentParsed.error
                );
            }
            return false;
        }
    }

    try {
        const tx = db.transaction(['briefs', 'meta'], 'readwrite');
        const metaStore = tx.objectStore('meta');
        const briefsStore = tx.objectStore('briefs');

        const metaInTx = await metaStore.get(META_SAMPLES_SEEDED_KEY);
        if (metaInTx) {
            await tx.done;
            return true;
        }

        const all = await briefsStore.getAll();
        const activeCount = all.filter((brief) => !brief.deletedAt).length;
        const metaValue: SamplesSeededMeta =
            activeCount === 0
                ? { version: 1, seeded: true }
                : { version: 1, seeded: false };

        if (activeCount === 0) {
            for (const record of samples) {
                await briefsStore.put(record);
            }
        }
        await metaStore.put(metaValue, META_SAMPLES_SEEDED_KEY);
        await tx.done;
        return true;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            return false;
        }
        throw error;
    }
}

/** Seeds built-in sample briefs once when the dashboard is empty (first visit). */
export async function ensureSampleBriefs(): Promise<void> {
    if (samplesEnsureCacheHit) {
        return;
    }
    if (!samplesEnsurePromise) {
        samplesEnsurePromise = runEnsureSampleBriefs()
            .then((finished) => {
                if (finished) {
                    samplesEnsureCacheHit = true;
                }
            })
            .catch((error) => {
                if (import.meta.env.DEV) {
                    console.error('[ensureSampleBriefs]', error);
                }
            })
            .finally(() => {
                samplesEnsurePromise = null;
            });
    }
    await samplesEnsurePromise;
}
