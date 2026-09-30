export const AI_NO_BACKGROUND_USE_NOTE =
    'This app does not use artificial intelligence unless you actively use one of the features below. Browsing, editing, and saving your work does not send data to an AI service.';

export const AI_OPENAI_DISCLOSURE_NOTE =
    'When you use a feature below, relevant content from your briefs or grading work is sent to AI for processing.';

export const AI_SETTINGS_ENABLE_HINT =
    'AI-assisted features are off. Enable them in Settings.';

export const AI_SETTINGS_SAVE_BEFORE_ENABLE_HINT =
    'AI-assisted features are off. Save your brief first, then enable them in Settings.';

/** Tailwind classes — colour source is --ai-accent in src/styles/tokens.css */
export const AI_ACCENT_TEXT_CLASS = 'text-ai-accent';
export const AI_ACCENT_LINK_CLASS =
    'font-semibold text-ai-accent underline underline-offset-4 hover:text-ai-accent-hover hover:underline';
export const AI_ACCENT_PROMINENT_LINK_CLASS =
    'font-medium text-ai-accent hover:text-ai-accent-hover underline-offset-4 hover:underline';
export const AI_ACCENT_HOVER_CARD_CLASS =
    'z-[120] w-72 border-ai-accent/30 bg-ai-accent-subtle shadow-md';

export const AI_LISTEN_UNAVAILABLE_HINT =
    'Listen is not available for this brief.';

export const AI_POWERED_FEATURES = [
    {
        id: 'brief-import',
        title: 'Import brief from document',
        description:
            'Upload a PDF or DOCX when creating a brief. The document text is analysed and mapped into brief sections.',
        audiences: ['staff']
    },
    {
        id: 'one-page-summary',
        title: 'One Page Summary generation',
        description:
            'Generate concise summary text for the One Page Summary section from the rest of your brief.',
        audiences: ['staff']
    },
    {
        id: 'rubric-descriptors',
        title: 'Rubric grade descriptor generation',
        description:
            'Generate grade-band descriptors for a rubric criterion based on your brief context.',
        audiences: ['staff']
    },
    {
        id: 'feedback',
        title: 'Feedback generate and enhance',
        description:
            'Generate or improve strengths and development feedback on feedback sheets from grades and criteria.',
        audiences: ['staff']
    },
    {
        id: 'listen-tts',
        title: 'Listen to section',
        description:
            'Read brief section content aloud using text-to-speech in the student viewer or builder preview. Controlled by your AI setting in Settings.',
        audiences: ['student', 'staff']
    },
    {
        id: 'recording-captions',
        title: 'Screen recording captions',
        description:
            'Automatically transcribe audio when you upload a screen recording to create captions.',
        audiences: ['staff']
    }
] as const;

export type AiPoweredFeatureId = (typeof AI_POWERED_FEATURES)[number]['id'];
export type AiPoweredFeatureAudience =
    (typeof AI_POWERED_FEATURES)[number]['audiences'][number];

export const AI_AUDIENCE_LABELS: Record<AiPoweredFeatureAudience, string> = {
    staff: 'Staff',
    student: 'Student'
};
