export const REMOVABLE_PROJECT_DETAIL_SUBSECTION_IDS = [
    'learning-outcomes',
    'key-expectations',
    'deliverables',
    'resources'
] as const;

export type RemovableProjectDetailSubsectionId =
    (typeof REMOVABLE_PROJECT_DETAIL_SUBSECTION_IDS)[number];

export const PROJECT_DETAIL_SUBSECTION_LABELS: Record<
    RemovableProjectDetailSubsectionId,
    string
> = {
    'learning-outcomes': 'Learning Outcomes Assessed',
    'key-expectations': 'Key Expectations',
    deliverables: 'Deliverables',
    resources: 'Resources'
};

export function isRemovableProjectDetailSubsection(
    subsectionId: string
): subsectionId is RemovableProjectDetailSubsectionId {
    return REMOVABLE_PROJECT_DETAIL_SUBSECTION_IDS.includes(
        subsectionId as RemovableProjectDetailSubsectionId
    );
}

export function isProjectDetailSubsectionVisible(
    subsectionId: string,
    hiddenSubsections: string[] | undefined | null
): boolean {
    return !hiddenSubsections?.includes(subsectionId);
}
