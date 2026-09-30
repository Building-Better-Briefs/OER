export const BRIEF_STATUS_VALUES = ['DRAFT', 'PUBLISHED'] as const;

export type BriefStatusValue = (typeof BRIEF_STATUS_VALUES)[number];

export const BRIEF_STATUS_OPTIONS: ReadonlyArray<{
    value: BriefStatusValue;
    label: string;
}> = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PUBLISHED', label: 'Published' }
];

const BRIEF_STATUS_LABELS: Record<BriefStatusValue, string> = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published'
};

export function isBriefStatusValue(value: unknown): value is BriefStatusValue {
    return (
        typeof value === 'string' &&
        (BRIEF_STATUS_VALUES as readonly string[]).includes(value)
    );
}

export function formatBriefStatus(value: BriefStatusValue | null | undefined) {
    if (!value) {
        return '';
    }
    return BRIEF_STATUS_LABELS[value];
}

export function isBriefPublished(status: BriefStatusValue): boolean {
    return status === 'PUBLISHED';
}

export function canStudentViewBriefContent(status: BriefStatusValue): boolean {
    return isBriefPublished(status);
}
