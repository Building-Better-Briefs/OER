export const VIEWER_FEATURE_TYPES = [
    'focus_mode',
    'font_size',
    'toc_navigate',
    'tts_listen'
] as const;

export type ViewerFeatureType = (typeof VIEWER_FEATURE_TYPES)[number];

export const FONT_SIZE_DETAILS = ['normal', 'big', 'bigger'] as const;

export type FontSizeDetail = (typeof FONT_SIZE_DETAILS)[number];

export const MAX_FEATURE_DETAIL_LENGTH = 128;
export const MAX_FEATURE_EVENTS_PER_FLUSH = 50;
export const MAX_FEATURE_COUNT_PER_EVENT = 100;

export type ViewerFeatureEvent = {
    feature: ViewerFeatureType;
    detail?: string;
    count: number;
};

export function isViewerFeatureType(value: string): value is ViewerFeatureType {
    return (VIEWER_FEATURE_TYPES as readonly string[]).includes(value);
}

export function isFontSizeDetail(value: string): value is FontSizeDetail {
    return (FONT_SIZE_DETAILS as readonly string[]).includes(value);
}

export function normalizeFeatureDetail(
    feature: ViewerFeatureType,
    detail: string | undefined
): string {
    if (feature === 'focus_mode') {
        return '';
    }
    return detail ?? '';
}

export function featureEventKey(feature: ViewerFeatureType, detail: string) {
    return `${feature}:${detail}`;
}
