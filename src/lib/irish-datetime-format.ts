import type { Descendant } from 'platejs';

import { normalizeRichTextValue, type RichTextValue } from '@/lib/rich-text-utils';

/** ISO 8601 dates / datetimes as distinct tokens (not substrings of longer digit runs). */
const ISO_8601_TOKEN =
    /\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const IRISH_DATETIME_FORMATTER = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    dateStyle: 'medium',
    timeStyle: 'short'
});

/** Stable locale/timezone formatting for SSR and client (avoids hydration mismatch). */
export function formatAppDatetime(
    value: Date | string | null | undefined,
    fallback = '—'
): string {
    if (value == null || value === '') {
        return fallback;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return fallback;
    }
    return IRISH_DATETIME_FORMATTER.format(date);
}

function formatIsoMatch(match: string): string {
    const trimmed = match.trim();
    const dateOnly = DATE_ONLY.exec(trimmed);
    if (dateOnly) {
        const y = Number(dateOnly[1]);
        const m = Number(dateOnly[2]);
        const d = Number(dateOnly[3]);
        if (!y || !m || !d) return match;
        const inst = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        return new Intl.DateTimeFormat('en-IE', {
            timeZone: 'Europe/Dublin',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(inst);
    }

    const dt = new Date(trimmed);
    if (Number.isNaN(dt.getTime())) return match;

    const hasClock = /[T ]\d{2}:\d{2}/.test(trimmed);
    if (hasClock) {
        return formatAppDatetime(dt);
    }
    return new Intl.DateTimeFormat('en-IE', {
        timeZone: 'Europe/Dublin',
        dateStyle: 'long'
    }).format(dt);
}

/**
 * Replace ISO 8601 date/datetime segments with Irish locale strings (Europe/Dublin).
 */
export function replaceIso8601InTextWithIrishLocale(text: string): string {
    if (!text) return text;
    return text.replace(ISO_8601_TOKEN, (chunk, offset, full) => {
        const prev = offset > 0 ? full[offset - 1] : '';
        const next = offset + chunk.length < full.length ? full[offset + chunk.length] : '';
        if (/\d/.test(prev) || /\d/.test(next)) return chunk;
        return formatIsoMatch(chunk);
    });
}

function mapDescendantIsoDates(node: Descendant): Descendant {
    const n = node as Record<string, unknown>;
    if (typeof n.text === 'string') {
        return {
            ...n,
            text: replaceIso8601InTextWithIrishLocale(n.text)
        } as Descendant;
    }
    if (Array.isArray(n.children)) {
        return {
            ...n,
            children: (n.children as Descendant[]).map(mapDescendantIsoDates)
        } as Descendant;
    }
    return node;
}

/** Apply ISO→Irish formatting to every text leaf in a Plate value. */
export function replaceIso8601InRichTextValue(value: unknown): RichTextValue {
    const norm = normalizeRichTextValue(value);
    return norm.map(mapDescendantIsoDates);
}
