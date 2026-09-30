import type { RichTextValue } from '@/lib/rich-text-utils';
import { richTextToPlainText } from '@/lib/rich-text-utils';

export type CustomSubsectionType = 'text' | 'accordion';

export type RichTextContent = string | RichTextValue;

export type CustomSubsectionItem = {
    title: string;
    content: RichTextContent;
};

export type CustomSubsection = {
    id: string;
    type: CustomSubsectionType;
    title: string;
    subheading: string;
    content: RichTextContent;
    items: CustomSubsectionItem[];
};

function newSubsectionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyCustomItem(): CustomSubsectionItem {
    return { title: '', content: '' };
}

export function createEmptyCustomSubsection(
    type: CustomSubsectionType
): CustomSubsection {
    return {
        id: newSubsectionId(),
        type,
        title: '',
        subheading: '',
        content: '',
        items: type === 'accordion' ? [emptyCustomItem()] : []
    };
}

export function customSubsectionBlockId(id: string): string {
    return `custom:${id}`;
}

export function parseCustomSubsectionBlockId(
    blockId: string
): string | null {
    if (!blockId.startsWith('custom:')) return null;
    return blockId.slice('custom:'.length) || null;
}

export function isCustomSubsectionVisible(
    id: string,
    hiddenIds: string[] | undefined | null
): boolean {
    return !hiddenIds?.includes(id);
}

export function getCustomSubsectionRestoreLabel(
    subsection: Pick<CustomSubsection, 'title' | 'type'>
): string {
    const title = subsection.title?.trim();
    if (title) return title;
    return subsection.type === 'accordion' ? 'Accordion' : 'Text';
}

export function getVisibleCustomSubsections(
    subsections: CustomSubsection[],
    hiddenIds: string[] | undefined | null
): CustomSubsection[] {
    return subsections.filter((s) => isCustomSubsectionVisible(s.id, hiddenIds));
}

export function hasVisibleCustomSubsections(
    subsections: CustomSubsection[] | undefined | null,
    hiddenIds: string[] | undefined | null
): boolean {
    return getVisibleCustomSubsections(subsections || [], hiddenIds).length > 0;
}

function normalizeCustomSubsection(raw: unknown): CustomSubsection {
    const entry =
        typeof raw === 'object' && raw !== null
            ? (raw as Record<string, unknown>)
            : {};

    const type: CustomSubsectionType =
        entry.type === 'accordion' ? 'accordion' : 'text';

    const id =
        typeof entry.id === 'string' && entry.id.trim()
            ? entry.id.trim()
            : newSubsectionId();

    const title = typeof entry.title === 'string' ? entry.title : '';
    const subheading =
        typeof entry.subheading === 'string' ? entry.subheading : '';
    const content =
        entry.content !== undefined && entry.content !== null
            ? (entry.content as RichTextContent)
            : '';

    let items: CustomSubsectionItem[] = [];
    if (type === 'accordion') {
        if (Array.isArray(entry.items) && entry.items.length > 0) {
            items = entry.items.map((item) => {
                const row =
                    typeof item === 'object' && item !== null
                        ? (item as Record<string, unknown>)
                        : {};
                return {
                    title: typeof row.title === 'string' ? row.title : '',
                    content:
                        row.content !== undefined && row.content !== null
                            ? (row.content as RichTextContent)
                            : ''
                };
            });
        } else {
            items = [emptyCustomItem()];
        }
    }

    return { id, type, title, subheading, content, items };
}

export function hasCustomSubsectionContent(
    subsection: Pick<
        CustomSubsection,
        'title' | 'subheading' | 'content' | 'type' | 'items'
    >
): boolean {
    if (subsection.title?.trim()) return true;
    if (subsection.subheading?.trim()) return true;
    if (richTextToPlainText(subsection.content).trim()) return true;
    if (subsection.type === 'accordion') {
        return (subsection.items ?? []).some(
            (item) =>
                item.title?.trim() ||
                richTextToPlainText(item.content).trim()
        );
    }
    return false;
}

export function normalizeCustomSubsections(
    raw: unknown,
    hiddenIds: string[] | undefined | null = []
): { subsections: CustomSubsection[]; hiddenIds: string[] } {
    const list = Array.isArray(raw) ? raw : [];
    const subsections = list.map(normalizeCustomSubsection);

    const validIds = new Set(subsections.map((s) => s.id));
    const dedupedHidden = Array.from(
        new Set(
            (Array.isArray(hiddenIds) ? hiddenIds : []).filter(
                (id): id is string =>
                    typeof id === 'string' && validIds.has(id)
            )
        )
    );

    const prunedSubsections = subsections.filter(
        (subsection) =>
            hasCustomSubsectionContent(subsection) ||
            !dedupedHidden.includes(subsection.id)
    );
    const prunedHidden = dedupedHidden.filter((id) =>
        prunedSubsections.some((subsection) => subsection.id === id)
    );

    return { subsections: prunedSubsections, hiddenIds: prunedHidden };
}
