/**
 * Single source for rich-text heading spacing + type scale (Plate editor + preview render).
 */
export const RICH_TEXT_HEADING_CLASSES = {
    h1: 'mb-2 mt-4 font-heading text-2xl font-bold tracking-tight',
    h2: 'mb-2 mt-3 font-heading text-xl font-semibold tracking-tight',
    h3: 'mb-2 mt-2 font-heading text-lg font-semibold tracking-tight',
    h4: 'mb-1 mt-2 font-semibold text-base tracking-tight',
    h5: 'mb-1 mt-2 font-semibold text-base tracking-tight',
    h6: 'mb-1 mt-2 font-semibold text-base tracking-tight'
} as const;

export type RichTextHeadingLevel = keyof typeof RICH_TEXT_HEADING_CLASSES;
