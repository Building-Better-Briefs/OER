import { richTextToPlainText } from '@/lib/rich-text-utils';

export type AiPolicySource = 'upload' | 'aias' | null;

export type AiPolicyConfig = {
    source: AiPolicySource;
    aiasLevels: number[];
    usageLogEnabled: boolean;
    policyRationale: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assessmentGuidance: any;
};

export type AiasLevel = {
    level: number;
    name: string;
    description: string;
    studentGuidance: string;
};

export const AIAS_POLICY = {
    id: 'aias',
    name: 'AI Assessment Scale (AIAS)',
    url: 'https://aiassessmentscale.com/',
    license: 'CC BY-NC-SA 4.0',
    attribution:
        'Mike Perkins, Leon Furze, Jasper Roe, and Jason MacVaugh'
} as const;

export const AIAS_LEVELS: AiasLevel[] = [
    {
        level: 1,
        name: 'No AI',
        description:
            'The assessment is completed entirely without AI assistance in a controlled environment, ensuring that students rely solely on their existing knowledge, understanding, and skills.',
        studentGuidance:
            'You must not use AI at any point during the assessment. You must demonstrate your core skills and knowledge.'
    },
    {
        level: 2,
        name: 'AI Planning',
        description:
            'AI may be used for pre-task activities such as brainstorming, outlining and initial research. Assessments should emphasise the ability to develop and refine these ideas independently.',
        studentGuidance:
            'You may use AI for planning, idea development, and research. Your final submission should show how you have developed and refined these ideas.'
    },
    {
        level: 3,
        name: 'AI Collaboration',
        description:
            'AI may be used to help complete the task, including idea generation, drafting, feedback, and refinement. Students should critically evaluate and modify AI suggested outputs.',
        studentGuidance:
            'You may use AI to assist with specific tasks such as drafting text, refining and evaluating your work. You must critically evaluate and modify any AI-generated content you use.'
    },
    {
        level: 4,
        name: 'Full AI',
        description:
            'AI may be used to complete any elements of the task, with students directing AI to achieve the assessment goals.',
        studentGuidance:
            'You may use AI extensively throughout your work either as you wish, or as specifically directed in your assessment. Focus on directing AI to achieve your goals while demonstrating your critical thinking.'
    },
    {
        level: 5,
        name: 'AI Exploration',
        description:
            'AI is used creatively to enhance problem-solving, generate novel insights, or develop innovative solutions. Students and educators co-design assessments to explore unique AI applications.',
        studentGuidance:
            'You should use AI creatively to solve the task, potentially co-designing new approaches with your instructor.'
    }
];

export function createDefaultAiPolicy(): AiPolicyConfig {
    return {
        source: 'aias',
        aiasLevels: [],
        usageLogEnabled: false,
        policyRationale: '',
        assessmentGuidance: null
    };
}

function normalizeAiasLevels(value: unknown): number[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(
            (level): level is number =>
                typeof level === 'number' &&
                Number.isInteger(level) &&
                level >= 1 &&
                level <= 5
        )
        .sort((a, b) => a - b);
}

export function parseAiPolicy(content: unknown): AiPolicyConfig {
    const defaults = createDefaultAiPolicy();

    if (typeof content !== 'object' || content === null) {
        return defaults;
    }

    const raw = (content as { aiPolicy?: unknown }).aiPolicy;
    if (typeof raw !== 'object' || raw === null) {
        return defaults;
    }

    const policy = raw as Record<string, unknown>;
    const source = policy.source === 'upload' ? 'upload' : 'aias';

    return {
        source,
        aiasLevels: normalizeAiasLevels(policy.aiasLevels),
        usageLogEnabled: policy.usageLogEnabled === true,
        policyRationale:
            typeof policy.policyRationale === 'string'
                ? policy.policyRationale
                : defaults.policyRationale,
        assessmentGuidance:
            policy.assessmentGuidance !== undefined
                ? policy.assessmentGuidance
                : defaults.assessmentGuidance
    };
}

export function getAiasLevel(level: number): AiasLevel | undefined {
    return AIAS_LEVELS.find((entry) => entry.level === level);
}

export function hasAssessmentGuidance(value: unknown): boolean {
    return richTextToPlainText(value).trim().length > 0;
}
