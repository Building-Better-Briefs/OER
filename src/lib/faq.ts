import {
    normalizeRichTextValue,
    richTextToPlainText,
    type RichTextValue
} from '@/lib/rich-text-utils';

export type FaqItem = {
    question: string;
    answer: RichTextValue | string;
};

export function createEmptyFaqItem(): FaqItem {
    return { question: '', answer: '' };
}

function normalizeFaqItem(raw: unknown): FaqItem | null {
    if (typeof raw !== 'object' || raw === null) {
        return null;
    }

    const item = raw as Record<string, unknown>;
    const question =
        typeof item.question === 'string' ? item.question : '';

    return {
        question,
        answer: normalizeRichTextValue(item.answer)
    };
}

export function parseFaqItems(content: unknown): FaqItem[] {
    if (typeof content !== 'object' || content === null) {
        return [];
    }

    const rawItems = (content as { faqItems?: unknown }).faqItems;
    if (!Array.isArray(rawItems)) {
        return [];
    }

    return rawItems
        .map(normalizeFaqItem)
        .filter((item): item is FaqItem => item !== null);
}

function faqItemHasContent(item: FaqItem): boolean {
    if (item.question.trim()) {
        return true;
    }

    return richTextToPlainText(item.answer).trim().length > 0;
}

export function hasFaqContent(items: FaqItem[]): boolean {
    return items.some(faqItemHasContent);
}

export function getVisibleFaqItems(items: FaqItem[]): FaqItem[] {
    return items.filter(faqItemHasContent);
}
