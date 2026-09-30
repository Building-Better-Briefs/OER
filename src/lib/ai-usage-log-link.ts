import { isBriefSectionEnabled, type BriefSectionLike } from '@/lib/brief-sections';
import { isAiLogEnabled } from '@/lib/assignment-ai-log';

export function isAiPolicySectionEnabled(sections: BriefSectionLike[]): boolean {
    const section = sections.find((entry) => entry.id === 'ai-policy');
    if (!section) {
        return false;
    }
    return isBriefSectionEnabled(section);
}

/** Student AI Usage Log is available when the lecturer opted in (not gated on AI Policy section). */
export function isAiUsageLogEnabled(
    content: unknown,
    _sections?: BriefSectionLike[]
): boolean {
    return isAiLogEnabled(content);
}
