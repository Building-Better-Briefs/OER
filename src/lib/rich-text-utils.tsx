import React from 'react';
import type { Descendant } from 'platejs';

import { RICH_TEXT_HEADING_CLASSES } from '@/lib/rich-text-heading-classes';

export type RichTextValue = Descendant[];

function createEmptyRichTextValue(): RichTextValue {
    return [{ type: 'p', children: [{ text: '' }] }];
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function sanitizeTextNode(node: Record<string, unknown>): Descendant {
    return {
        ...node,
        text: typeof node.text === 'string' ? node.text : ''
    } as Descendant;
}

function sanitizeDescendantNode(node: unknown): Descendant | null {
    if (!isObjectRecord(node)) return null;

    if ('text' in node) {
        return sanitizeTextNode(node);
    }

    if (!Array.isArray(node.children)) {
        return null;
    }

    const sanitizedChildren = node.children
        .map((child) => sanitizeDescendantNode(child))
        .filter((child): child is Descendant => child !== null);

    return {
        ...node,
        type: typeof node.type === 'string' ? node.type : 'p',
        children:
            sanitizedChildren.length > 0
                ? sanitizedChildren
                : [{ text: '' } as Descendant]
    } as Descendant;
}

function sanitizeRichTextValue(value: unknown): RichTextValue {
    if (!Array.isArray(value)) return createEmptyRichTextValue();

    const sanitizedNodes = value
        .map((node) => {
            const sanitizedNode = sanitizeDescendantNode(node);
            if (!sanitizedNode) return null;

            const recordNode = sanitizedNode as Record<string, unknown>;
            if ('text' in recordNode) {
                // Slate expects block nodes at the top level. Wrap loose text nodes.
                return {
                    type: 'p',
                    children: [sanitizedNode]
                } as Descendant;
            }

            return sanitizedNode;
        })
        .filter((node): node is Descendant => node !== null);

    return sanitizedNodes.length > 0 ? sanitizedNodes : createEmptyRichTextValue();
}

export function isRichTextValue(value: unknown): value is RichTextValue {
    return (
        Array.isArray(value) &&
        value.every(
            (node) =>
                typeof node === 'object' &&
                node !== null &&
                'children' in node &&
                Array.isArray((node as Record<string, unknown>).children)
        )
    );
}

export function stringToRichTextValue(value: string): RichTextValue {
    if (!value) return createEmptyRichTextValue();

    const paragraphs = value.split('\n').map((line) => ({
        type: 'p',
        children: [{ text: line }]
    }));

    return paragraphs.length > 0 ? paragraphs : createEmptyRichTextValue();
}

export function normalizeRichTextValue(value: unknown): RichTextValue {
    if (isRichTextValue(value)) return sanitizeRichTextValue(value);
    if (Array.isArray(value)) return sanitizeRichTextValue(value);
    if (typeof value === 'string') return stringToRichTextValue(value);
    return createEmptyRichTextValue();
}

function renderLeaf(node: Record<string, unknown>, key: string): React.ReactNode {
    let rendered: React.ReactNode =
        typeof node.text === 'string' ? node.text : '';
    if (node.bold) {
        rendered = (
            <strong key={`${key}-bold`} className='font-bold'>
                {rendered}
            </strong>
        );
    }
    if (node.italic) rendered = <em key={`${key}-italic`}>{rendered}</em>;
    return <React.Fragment key={key}>{rendered}</React.Fragment>;
}

function renderNode(node: Descendant, key: string): React.ReactNode {
    const currentNode = node as Record<string, unknown>;
    if (typeof currentNode.text === 'string') {
        return renderLeaf(currentNode, key);
    }

    const children =
        Array.isArray(currentNode.children)
            ? (currentNode.children as Descendant[]).map((child, index) =>
            renderNode(child, `${key}-child-${index}`)
              )
            : null;

    if (currentNode.type === 'a') {
        return (
            <a
                key={key}
                href={
                    typeof currentNode.url === 'string' ? currentNode.url : '#'
                }
                target='_blank'
                rel='noopener noreferrer'
                className='text-foreground hover:text-brand underline underline-offset-4 decoration-1 transition-colors'>
                {children}
            </a>
        );
    }

    if (currentNode.type === 'ul') {
        return (
            <ul key={key} className='my-2 list-none pl-7'>
                {children}
            </ul>
        );
    }

    if (currentNode.type === 'ol') {
        return (
            <ol key={key} className='my-2 list-none pl-7'>
                {children}
            </ol>
        );
    }

    if (currentNode.type === 'li') {
        return (
            <li key={key} className='list-none'>
                <span aria-hidden='true' className='mr-2'>
                    —
                </span>
                {children}
            </li>
        );
    }

    // Plate wraps list item text/content in a dedicated child node.
    if (currentNode.type === 'lic') {
        return <React.Fragment key={key}>{children}</React.Fragment>;
    }

    if (currentNode.type === 'p') {
        return (
            <p key={key} className='mb-2 last:mb-0'>
                {children}
            </p>
        );
    }

    if (
        currentNode.type === 'h1' ||
        currentNode.type === 'h2' ||
        currentNode.type === 'h3' ||
        currentNode.type === 'h4' ||
        currentNode.type === 'h5' ||
        currentNode.type === 'h6'
    ) {
        const level = currentNode.type as keyof typeof RICH_TEXT_HEADING_CLASSES;
        const className = RICH_TEXT_HEADING_CLASSES[level];
        const Tag = level;
        return (
            <Tag key={key} className={className}>
                {children}
            </Tag>
        );
    }

    return <React.Fragment key={key}>{children}</React.Fragment>;
}

export function renderRichTextValue(value: unknown): React.ReactNode {
    const normalized = normalizeRichTextValue(value);
    const rendered: React.ReactNode[] = [];
    let index = 0;

    const isOrderedListStyle = (style: string) =>
        ['decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'].includes(style);

    while (index < normalized.length) {
        const currentNode = normalized[index] as Record<string, unknown>;
        const listStyleType =
            typeof currentNode.listStyleType === 'string'
                ? currentNode.listStyleType
                : null;

        if (!listStyleType) {
            rendered.push(renderNode(normalized[index], `node-${index}`));
            index += 1;
            continue;
        }

        const currentIndent =
            typeof currentNode.indent === 'number' ? currentNode.indent : 0;
        const listTag = isOrderedListStyle(listStyleType) ? 'ol' : 'ul';
        const ListTag = listTag as 'ol' | 'ul';
        const items: React.ReactNode[] = [];

        while (index < normalized.length) {
            const candidate = normalized[index] as Record<string, unknown>;
            const candidateStyle =
                typeof candidate.listStyleType === 'string'
                    ? candidate.listStyleType
                    : null;
            const candidateIndent =
                typeof candidate.indent === 'number' ? candidate.indent : 0;

            if (
                !candidateStyle ||
                candidateStyle !== listStyleType ||
                candidateIndent !== currentIndent
            ) {
                break;
            }

            const candidateChildren = Array.isArray(candidate.children)
                ? (candidate.children as Descendant[]).map((child, childIndex) =>
                      renderNode(child, `node-${index}-child-${childIndex}`)
                  )
                : null;

            items.push(
                <li key={`node-${index}`} className='list-none'>
                    <span aria-hidden='true' className='mr-2'>
                        —
                    </span>
                    {candidateChildren}
                </li>
            );
            index += 1;
        }

        rendered.push(
            <ListTag
                key={`list-${index}`}
                className='my-2 pl-7'
                style={{
                    listStyleType: 'none',
                    marginLeft: currentIndent > 0 ? `${currentIndent * 12}px` : undefined
                }}>
                {items}
            </ListTag>
        );
    }

    return rendered;
}

export function richTextToPlainText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (!isRichTextValue(value)) return '';

    const collect = (node: Descendant): string => {
        const currentNode = node as Record<string, unknown>;
        if (typeof currentNode.text === 'string') return currentNode.text;
        if (!Array.isArray(currentNode.children)) return '';
        return (currentNode.children as Descendant[]).map(collect).join('');
    };

    return value.map(collect).join('\n');
}
