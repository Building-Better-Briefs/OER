import { z } from 'zod';
import {
    normalizeBriefContentSave,
    parseBriefContentSave,
    type BriefContentSave
} from '@/lib/brief-content-schema';
import { BLOB_CONTENT_KEYS, cloneJsonValue } from '@/lib/duplicate-brief';
import {
    hasEnabledBriefSection,
    normalizeBriefSections,
    type BriefSectionLike,
    type SectionVisibility
} from '@/lib/brief-sections';
import { DEFAULT_BRIEF_TEMPLATE } from '@/lib/templates';

export type { SectionVisibility };

export type BriefLayoutSection = {
    id: string;
    label: string;
    visibility: SectionVisibility;
    enabled?: boolean;
    subsections?: unknown[];
    criteria?: unknown[];
    checklist?: unknown[];
    form?: unknown[];
    faqItems?: unknown[];
    schedulePhases?: unknown[];
    scheduleViews?: { table: boolean; gantt: boolean };
    exampleForm?: string;
    [key: string]: unknown;
};

export type BriefLayoutTemplate = {
    slug: string;
    name: string;
    sections: BriefLayoutSection[];
};

export type TemplateLinkType = 'ai-policy' | 'other';

export type TemplateLink = {
    id: string;
    type: TemplateLinkType;
    label: string;
    url: string;
};

export type ParsedBriefTemplate = {
    slug: string;
    name: string;
    sections: BriefLayoutSection[];
    content: BriefContentSave;
    links: TemplateLink[];
    usedFallback: boolean;
};

export const KNOWN_SECTION_IDS = DEFAULT_BRIEF_TEMPLATE.sections.map(
    (section) => section.id
) as readonly string[];

export const DEFAULT_TEMPLATE_SLUG = 'default';

const httpUrlSchema = z
    .string()
    .trim()
    .max(2000)
    .refine(
        (value) => value === '' || /^https?:\/\//i.test(value),
        'URL must use http or https'
    );

export const templateLinkSchema = z.object({
    id: z.string().uuid(),
    type: z.enum(['ai-policy', 'other']),
    label: z.string().trim().min(1).max(200),
    url: httpUrlSchema.refine((value) => value.length > 0, 'URL is required')
});

export const templateLinksSchema = z
    .array(templateLinkSchema)
    .max(20)
    .default([]);

const layoutSectionSchema = z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(300),
    visibility: z.enum(['required', 'recommended', 'optional']),
    enabled: z.boolean().optional()
});

export const templateSectionsSchema = z
    .array(layoutSectionSchema)
    .min(1)
    .superRefine((sections, ctx) => {
        validateKnownSectionIds(sections, ctx);
    });

export const briefSectionSnapshotSchema = z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(300),
    visibility: z.enum(['required', 'recommended', 'optional']),
    enabled: z.boolean(),
    order: z.number().int().min(0)
});

export const briefSectionSnapshotsSchema = z
    .array(briefSectionSnapshotSchema)
    .superRefine((sections, ctx) => {
        validateKnownSectionIds(sections, ctx);

        const expectedCount = KNOWN_SECTION_IDS.length;
        if (sections.length !== expectedCount) {
            ctx.addIssue({
                code: 'custom',
                message: `Expected ${expectedCount} sections`,
                path: []
            });
        }
    });

function validateKnownSectionIds(
    sections: { id: string }[],
    ctx: z.RefinementCtx
): void {
    const ids = new Set<string>();
    for (const [index, section] of sections.entries()) {
        if (!KNOWN_SECTION_IDS.includes(section.id)) {
            ctx.addIssue({
                code: 'custom',
                message: `Unknown section id: ${section.id}`,
                path: [index, 'id']
            });
        }
        if (ids.has(section.id)) {
            ctx.addIssue({
                code: 'custom',
                message: `Duplicate section id: ${section.id}`,
                path: [index, 'id']
            });
        }
        ids.add(section.id);
    }

    for (const knownId of KNOWN_SECTION_IDS) {
        if (!ids.has(knownId)) {
            ctx.addIssue({
                code: 'custom',
                message: `Missing section id: ${knownId}`,
                path: []
            });
        }
    }
}

export const programmeSlugSchema = z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug must be lowercase letters, numbers, and hyphens'
    );

export function slugifyTemplateName(name: string): string {
    const base = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return base || 'template';
}

function mergeSectionWithDefault(
    section: BriefLayoutSection
): BriefLayoutSection {
    const defaultSection = DEFAULT_BRIEF_TEMPLATE.sections.find(
        (candidate) => candidate.id === section.id
    );
    if (!defaultSection) {
        return section;
    }
    return {
        ...defaultSection,
        ...section,
        id: section.id,
        label: section.label || defaultSection.label,
        visibility: section.visibility ?? defaultSection.visibility
    };
}

export function mergeSectionsWithDefault(
    sections: BriefLayoutSection[]
): BriefLayoutSection[] {
    if (!Array.isArray(sections) || sections.length === 0) {
        return [...DEFAULT_BRIEF_TEMPLATE.sections] as BriefLayoutSection[];
    }

    const byId = new Map(
        sections
            .filter((section) => KNOWN_SECTION_IDS.includes(section.id))
            .map((section) => [section.id, mergeSectionWithDefault(section)])
    );

    const orderedKnown = DEFAULT_BRIEF_TEMPLATE.sections.map((defaultSection) => {
        return byId.get(defaultSection.id) ?? { ...defaultSection };
    });

    return orderedKnown as BriefLayoutSection[];
}

function emptyBriefContent(): BriefContentSave {
    const parsed = parseBriefContentSave({});
    if (!parsed.success) {
        throw new Error('Failed to build empty brief content');
    }
    return normalizeBriefContentSave(parsed.data);
}

export function parseTemplateLinks(links: unknown): TemplateLink[] {
    const parsed = templateLinksSchema.safeParse(links);
    if (!parsed.success) {
        return [];
    }
    return parsed.data;
}

export function parseTemplateSections(sections: unknown): BriefLayoutSection[] {
    if (!Array.isArray(sections)) {
        return mergeSectionsWithDefault([]);
    }

    const parsedRows: BriefLayoutSection[] = [];
    for (const row of sections) {
        const parsed = layoutSectionSchema.safeParse(row);
        if (parsed.success) {
            parsedRows.push(
                mergeSectionWithDefault(parsed.data as BriefLayoutSection)
            );
            continue;
        }

        const id =
            typeof row === 'object' &&
            row !== null &&
            'id' in row &&
            typeof row.id === 'string'
                ? row.id
                : '';
        if (KNOWN_SECTION_IDS.includes(id)) {
            parsedRows.push(
                mergeSectionWithDefault({
                    id,
                    label: '',
                    visibility: 'optional'
                })
            );
        }
    }

    return mergeSectionsWithDefault(parsedRows);
}

export type ParseBriefSectionSnapshotsResult =
    | { success: true; sections: BriefSectionSnapshot[] }
    | { success: false; error: string };

export function parseBriefSectionSnapshotsForWrite(
    sections: unknown
): ParseBriefSectionSnapshotsResult {
    if (!Array.isArray(sections)) {
        return { success: false, error: 'Sections must be an array' };
    }

    const parsed = briefSectionSnapshotsSchema.safeParse(sections);
    if (!parsed.success) {
        return {
            success: false,
            error: parsed.error.issues[0]?.message ?? 'Invalid sections'
        };
    }

    const normalized = normalizeBriefSections(
        parsed.data
    ) as BriefSectionSnapshot[];

    if (!hasEnabledBriefSection(normalized)) {
        return {
            success: false,
            error: 'At least one section must be enabled'
        };
    }

    return { success: true, sections: normalized };
}

export function parseTemplateContent(content: unknown): BriefContentSave {
    const parsed = parseBriefContentSave(content ?? {});
    if (!parsed.success) {
        return emptyBriefContent();
    }
    return normalizeBriefContentSave(parsed.data);
}

export function parseResolvedTemplate(row: {
    slug: string;
    name: string;
    sections: unknown;
    content: unknown;
    links?: unknown;
}): ParsedBriefTemplate {
    let usedFallback = false;
    let sections = parseTemplateSections(row.sections);
    if (!Array.isArray(row.sections) || sections.length === 0) {
        usedFallback = true;
        sections = mergeSectionsWithDefault([]);
    }

    const content = parseTemplateContent(row.content);
    const links = parseTemplateLinks(row.links ?? []);

    return {
        slug: row.slug || DEFAULT_TEMPLATE_SLUG,
        name: row.name || 'Default',
        sections,
        content,
        links,
        usedFallback
    };
}

export function toBriefLayoutTemplate(
    parsed: ParsedBriefTemplate
): BriefLayoutTemplate {
    return {
        slug: parsed.slug,
        name: parsed.name,
        sections: parsed.sections
    };
}

export type BriefSectionSnapshot = BriefSectionLike & {
    id: string;
    label: string;
    visibility: SectionVisibility;
    enabled: boolean;
    order: number;
};

export function mapCatalogToBriefSections(
    sections: BriefLayoutSection[]
): BriefSectionSnapshot[] {
    return normalizeBriefSections(
        sections.map((section, index) => ({
            id: section.id,
            label: section.label,
            visibility: section.visibility,
            enabled:
                section.enabled ??
                (section.visibility === 'required' ||
                    section.visibility === 'recommended'),
            order: index
        }))
    );
}

export function mergeBriefSectionsIntoCatalog(
    catalog: BriefLayoutSection[],
    sections: BriefSectionSnapshot[]
): BriefLayoutSection[] {
    const catalogById = new Map(catalog.map((section) => [section.id, section]));
    const ordered = normalizeBriefSections(sections).sort(
        (a, b) => a.order - b.order
    );

    const merged: BriefLayoutSection[] = [];
    for (const section of ordered) {
        const catalogSection = catalogById.get(section.id);
        if (!catalogSection) {
            continue;
        }
        merged.push({
            ...catalogSection,
            label: section.label,
            visibility: section.visibility,
            enabled: section.enabled
        });
    }

    const mergedIds = new Set(merged.map((section) => section.id));
    for (const section of catalog) {
        if (!mergedIds.has(section.id)) {
            merged.push(section);
        }
    }

    return merged;
}

function stripBlobKeysFromContent(
    content: BriefContentSave
): BriefContentSave {
    const cloned = cloneJsonValue(content as never) as Record<string, unknown>;
    for (const key of BLOB_CONTENT_KEYS) {
        delete cloned[key];
    }
    const reparsed = parseBriefContentSave(cloned);
    if (!reparsed.success) {
        return content;
    }
    return normalizeBriefContentSave(reparsed.data);
}

export function buildBriefContentsFromTemplate(
    parsed: ParsedBriefTemplate
): {
    sections: BriefSectionSnapshot[];
    content: BriefContentSave;
    updatedAt: string;
} {
    const sections = mapCatalogToBriefSections(parsed.sections);
    const content = stripBlobKeysFromContent(
        cloneJsonValue(parsed.content as never) as BriefContentSave
    );

    return {
        sections,
        content,
        updatedAt: new Date().toISOString()
    };
}

export function programmeTemplateSlug(programme: {
    template?: { slug: string } | null;
}): string {
    return programme.template?.slug ?? DEFAULT_TEMPLATE_SLUG;
}

export function cloneTemplateLinks(links: TemplateLink[]): TemplateLink[] {
    return links.map((link) => ({
        ...link,
        id: crypto.randomUUID()
    }));
}
