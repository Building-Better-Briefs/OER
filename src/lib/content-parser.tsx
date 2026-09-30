import React from 'react';
import { splitTextByBareUrls } from '@/lib/autolink-text';
import {
    replaceIso8601InRichTextValue,
    replaceIso8601InTextWithIrishLocale
} from '@/lib/irish-datetime-format';
import {
    isRichTextValue,
    renderRichTextValue
} from '@/lib/rich-text-utils';

function appendBareUrlLinks(
    segment: string,
    parts: (string | React.ReactElement)[],
    keyCounter: { value: number }
): void {
    for (const piece of splitTextByBareUrls(segment)) {
        if (piece.kind === 'text') {
            if (piece.value) parts.push(piece.value);
            continue;
        }

        parts.push(
            <a
                key={`url-${keyCounter.value++}`}
                href={piece.href}
                target='_blank'
                rel='noopener noreferrer'
                className='text-foreground hover:text-brand underline underline-offset-4 decoration-1 transition-colors'>
                {piece.display}
            </a>
        );
    }
}

/**
 * Parses markdown-style content and converts it to React elements.
 * Supports:
 * - Links: [text](url)
 * - Bare URLs: https://example.com and www.example.com
 * - Bold: **text**
 * - Italic: *text*
 * - Line breaks: newlines are converted to <br> tags
 *
 * @param text - The text content to parse
 * @returns An array of React elements and strings, or the original text if empty
 */
export function parseContentWithLinks(
    text: unknown
): (string | React.ReactElement)[] | string | null {
    if (isRichTextValue(text)) {
        return [
            <div key='rich-text' className='[&_strong]:font-semibold'>
                {renderRichTextValue(replaceIso8601InRichTextValue(text))}
            </div>
        ];
    }

    if (typeof text !== 'string') return null;
    if (!text) return null;

    const textWithIrishDates = replaceIso8601InTextWithIrishLocale(text);

    // Split text by newlines to handle line breaks
    const lines = textWithIrishDates.split('\n');
    const result: (string | React.ReactElement)[] = [];
    const keyCounter = { value: 0 };

    // Helper function to parse markdown in a text segment
    const parseMarkdown = (
        segment: string
    ): (string | React.ReactElement)[] => {
        if (!segment) return [];

        const parts: (string | React.ReactElement)[] = [];
        let processedIndex = 0;

        // Find all markdown patterns (links, bold, italic) with their positions
        const patterns: Array<{
            type: 'link' | 'bold' | 'italic';
            start: number;
            end: number;
            content: string;
            url?: string;
        }> = [];

        // Find links [text](url)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        while ((match = linkRegex.exec(segment)) !== null) {
            patterns.push({
                type: 'link',
                start: match.index,
                end: match.index + match[0].length,
                content: match[1],
                url: match[2]
            });
        }

        // Find bold **text** (but not if it's part of a link)
        const boldRegex = /\*\*([^*]+)\*\*/g;
        while ((match = boldRegex.exec(segment)) !== null) {
            // Check if this bold is inside a link pattern
            const isInsideLink = patterns.some(
                (p) =>
                    p.type === 'link' &&
                    match!.index >= p.start &&
                    match!.index < p.end
            );
            if (!isInsideLink) {
                patterns.push({
                    type: 'bold',
                    start: match.index,
                    end: match.index + match[0].length,
                    content: match[1]
                });
            }
        }

        // Find italic *text* (but not if it's part of a link or bold)
        // We need to avoid matching ** which is bold
        // Match *text* where text doesn't contain * and is not part of **text**
        const italicRegex = /\*([^*\n]+?)\*/g;
        let italicMatch;
        // Reset regex lastIndex to ensure we start from the beginning
        italicRegex.lastIndex = 0;
        while ((italicMatch = italicRegex.exec(segment)) !== null) {
            const matchStart = italicMatch.index;
            const matchEnd = matchStart + italicMatch[0].length;

            // Check if this is actually part of bold (**text**)
            // by checking the character immediately before and after the match
            const charBefore = matchStart > 0 ? segment[matchStart - 1] : '';
            const charAfter =
                matchEnd < segment.length ? segment[matchEnd] : '';

            // Skip if this is part of bold (has * immediately before or after)
            if (charBefore === '*' || charAfter === '*') {
                continue;
            }

            // Check if this italic match is completely inside a link or bold pattern
            const isInsideOther = patterns.some((p) => {
                // Check if the entire italic match is inside the pattern
                return matchStart >= p.start && matchEnd <= p.end;
            });

            if (!isInsideOther && italicMatch[1].trim().length > 0) {
                patterns.push({
                    type: 'italic',
                    start: matchStart,
                    end: matchEnd,
                    content: italicMatch[1]
                });
            }
        }

        // Sort patterns by start position
        patterns.sort((a, b) => a.start - b.start);

        // Process patterns in order
        patterns.forEach((pattern) => {
            if (pattern.start > processedIndex) {
                const beforeText = segment.substring(
                    processedIndex,
                    pattern.start
                );
                if (beforeText) {
                    appendBareUrlLinks(beforeText, parts, keyCounter);
                }
            }

            switch (pattern.type) {
                case 'link':
                    parts.push(
                        <a
                            key={`link-${keyCounter.value++}`}
                            href={pattern.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-foreground hover:text-brand underline underline-offset-4 decoration-1 transition-colors'>
                            {parseMarkdown(pattern.content)}
                        </a>
                    );
                    break;
                case 'bold':
                    parts.push(
                        <strong key={`bold-${keyCounter.value++}`}>
                            {parseMarkdown(pattern.content)}
                        </strong>
                    );
                    break;
                case 'italic':
                    parts.push(
                        <em key={`italic-${keyCounter.value++}`}>
                            {parseMarkdown(pattern.content)}
                        </em>
                    );
                    break;
            }

            processedIndex = pattern.end;
        });

        if (processedIndex < segment.length) {
            const remainingText = segment.substring(processedIndex);
            if (remainingText) {
                appendBareUrlLinks(remainingText, parts, keyCounter);
            }
        }

        if (parts.length === 0) {
            appendBareUrlLinks(segment, parts, keyCounter);
            return parts.length > 0 ? parts : [segment];
        }

        return parts;
    };

    lines.forEach((line, lineIndex) => {
        // Parse markdown in each line
        const parsedLine = parseMarkdown(line);
        result.push(...parsedLine);

        // Add <br> tag after each line except the last one
        if (lineIndex < lines.length - 1) {
            result.push(<br key={`br-${keyCounter.value++}`} />);
        }
    });

    return result.length > 0 ? result : text;
}
