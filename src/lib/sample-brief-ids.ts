export const SAMPLE_BRIEF_ID_JOURNAL =
    '11111111-1111-4111-8111-111111111101';
export const SAMPLE_BRIEF_ID_GROUP =
    '11111111-1111-4111-8111-111111111102';

const SAMPLE_BRIEF_IDS = new Set<string>([
    SAMPLE_BRIEF_ID_JOURNAL,
    SAMPLE_BRIEF_ID_GROUP
]);

export function isSampleBriefId(id: string): boolean {
    return SAMPLE_BRIEF_IDS.has(id);
}
