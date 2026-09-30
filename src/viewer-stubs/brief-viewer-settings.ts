export const FONT_SIZE_SCALES = {
    normal: 1,
    big: 1.25,
    bigger: 1.35
} as const;

export type FontSize = keyof typeof FONT_SIZE_SCALES;

export type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type PlaybackSpeed = '0.75' | '1' | '1.25' | '1.5';

export type AudioSettings = {
    voice: VoiceOption;
    speed: PlaybackSpeed;
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
    voice: 'alloy',
    speed: '1'
};

export type BriefViewerToolbarVisibility = {
    showContents: boolean;
    showFocus: boolean;
    showAudio: boolean;
    showActions: boolean;
};

export const DEFAULT_BRIEF_VIEWER_TOOLBAR_VISIBILITY: BriefViewerToolbarVisibility =
    {
        showContents: true,
        showFocus: true,
        showAudio: true,
        showActions: true
    };

/** Toolbar controls hidden on the student self-assessment page. */
export const SELF_ASSESSMENT_TOOLBAR_VISIBILITY: BriefViewerToolbarVisibility = {
    showContents: false,
    showFocus: false,
    showAudio: false,
    showActions: false
};

/** Toolbar controls hidden on the student AI usage log page. */
export const AI_USAGE_LOG_TOOLBAR_VISIBILITY: BriefViewerToolbarVisibility = {
    showContents: false,
    showFocus: false,
    showAudio: false,
    showActions: false
};

export function readStoredAudioSettings(): AudioSettings {
    if (typeof window === 'undefined') {
        return DEFAULT_AUDIO_SETTINGS;
    }

    const storedSettings = window.localStorage.getItem('audioSettings');
    if (!storedSettings) {
        return DEFAULT_AUDIO_SETTINGS;
    }

    try {
        return JSON.parse(storedSettings) as AudioSettings;
    } catch {
        return DEFAULT_AUDIO_SETTINGS;
    }
}
