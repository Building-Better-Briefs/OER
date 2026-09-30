const STUDENT_LOGIN_NEXT_PATTERN =
    /^\/briefs\/viewer\/([a-zA-Z0-9_-]+)(?:\/(self-assessment|ai-usage-log|logs))?$/;

export type ParsedStudentLoginNext = {
    path: string;
    slug: string;
};

export function parseStudentLoginNext(
    value: string | null | undefined
): ParsedStudentLoginNext | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed || !trimmed.startsWith('/')) {
        return null;
    }

    if (
        trimmed.includes('?') ||
        trimmed.includes('#') ||
        trimmed.includes('//') ||
        trimmed.includes('\\') ||
        trimmed.includes('..') ||
        trimmed.includes('.')
    ) {
        return null;
    }

    let decoded = trimmed;
    try {
        const once = decodeURIComponent(trimmed);
        if (once !== trimmed) {
            const twice = decodeURIComponent(once);
            if (twice !== once) {
                return null;
            }
            decoded = once;
        }
    } catch {
        return null;
    }

    if (decoded !== trimmed) {
        const matchAfterDecode = decoded.match(STUDENT_LOGIN_NEXT_PATTERN);
        if (!matchAfterDecode) {
            return null;
        }
        return { path: decoded, slug: matchAfterDecode[1] };
    }

    const match = trimmed.match(STUDENT_LOGIN_NEXT_PATTERN);
    if (!match) {
        return null;
    }

    return { path: trimmed, slug: match[1] };
}

export { buildStudentLoginNextHref } from '@/lib/class-group-assignment';

export function parsePositiveInt(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string' && /^\d+$/.test(value)) {
        const parsed = Number(value);
        return parsed > 0 ? parsed : null;
    }

    return null;
}

export function parsePositiveBriefId(value: unknown): number | null {
    return parsePositiveInt(value);
}
