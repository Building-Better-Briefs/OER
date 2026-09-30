const BARE_URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>\[\]()]+/gi;

const TRAILING_PUNCTUATION_RE = /[.,;:!?)]+$/;

export type AutolinkSegment =
    | { kind: 'text'; value: string }
    | { kind: 'url'; display: string; href: string };

export function normalizeBareUrlHref(url: string): string {
    return url.startsWith('www.') ? `https://${url}` : url;
}

export function isSafeHttpUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function trimTrailingPunctuation(url: string): string {
    return url.replace(TRAILING_PUNCTUATION_RE, '');
}

export function splitTextByBareUrls(text: string): AutolinkSegment[] {
    if (!text) return [];

    const segments: AutolinkSegment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    BARE_URL_REGEX.lastIndex = 0;
    while ((match = BARE_URL_REGEX.exec(text)) !== null) {
        const rawUrl = trimTrailingPunctuation(match[0]);
        if (!rawUrl) continue;

        const href = normalizeBareUrlHref(rawUrl);
        if (!isSafeHttpUrl(href)) continue;

        if (match.index > lastIndex) {
            segments.push({
                kind: 'text',
                value: text.slice(lastIndex, match.index)
            });
        }

        segments.push({
            kind: 'url',
            display: rawUrl,
            href
        });

        lastIndex = match.index + rawUrl.length;
    }

    if (lastIndex < text.length) {
        segments.push({ kind: 'text', value: text.slice(lastIndex) });
    }

    return segments.length > 0 ? segments : [{ kind: 'text', value: text }];
}
