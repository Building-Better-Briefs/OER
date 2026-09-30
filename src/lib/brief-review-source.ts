export type BriefReviewSource = 'import' | 'duplicate';

export function isBriefReviewSource(
    value: string | null | undefined
): value is BriefReviewSource {
    return value === 'import' || value === 'duplicate';
}

export function parseBriefReviewSource(
    value: string | null | undefined
): BriefReviewSource | null {
    return isBriefReviewSource(value) ? value : null;
}
