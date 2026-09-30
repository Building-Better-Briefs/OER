import type { CSSProperties } from 'react';

export const BRIEF_METADATA_FOCUS_ID = 'brief-metadata';

const LONG_SECTION_HEIGHT_RATIO = 0.85;
const HEIGHT_CHUNK_RATIO = 0.75;
const VIEWPORT_FOCUS_BIAS = 0.35;
const MASK_FADE_PCT = 8;

export function getLongSectionThresholdPx(): number {
    if (typeof window === 'undefined') {
        return 680;
    }
    return Math.max(480, window.innerHeight * LONG_SECTION_HEIGHT_RATIO);
}

export function getHeightChunkPx(): number {
    if (typeof window === 'undefined') {
        return 600;
    }
    return Math.max(400, window.innerHeight * HEIGHT_CHUNK_RATIO);
}

export function isLongSection(element: HTMLElement): boolean {
    return element.offsetHeight > getLongSectionThresholdPx();
}

export function getSemanticFocusBlocks(
    sectionElement: HTMLElement
): HTMLElement[] {
    return Array.from(
        sectionElement.querySelectorAll<HTMLElement>('[data-brief-focus-id]')
    );
}

export function hasSemanticFocusBlocks(sectionElement: HTMLElement): boolean {
    return getSemanticFocusBlocks(sectionElement).length > 0;
}

export function deriveSectionId(focusId: string | null): string | null {
    if (!focusId) {
        return null;
    }
    if (focusId === BRIEF_METADATA_FOCUS_ID) {
        return BRIEF_METADATA_FOCUS_ID;
    }
    if (focusId.includes('--height-')) {
        return focusId.split('--height-')[0] ?? focusId;
    }
    const separatorIndex = focusId.indexOf('--');
    if (separatorIndex === -1) {
        return focusId;
    }
    return focusId.slice(0, separatorIndex);
}

export function buildHeightChunkFocusId(
    sectionId: string,
    chunkIndex: number
): string {
    return `${sectionId}--height-${chunkIndex}`;
}

export function parseHeightChunkFocusId(focusId: string): {
    sectionId: string;
    chunkIndex: number;
} | null {
    const match = focusId.match(/^(.+)--height-(\d+)$/);
    if (!match) {
        return null;
    }
    return {
        sectionId: match[1],
        chunkIndex: Number(match[2])
    };
}

export function computeHeightChunkIndex(
    sectionElement: HTMLElement,
    chunkSize = getHeightChunkPx()
): number {
    const rect = sectionElement.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    const viewportFocusPoint =
        window.scrollY + window.innerHeight * VIEWPORT_FOCUS_BIAS;
    const offsetInSection = viewportFocusPoint - sectionTop;
    const maxIndex = Math.max(
        0,
        Math.ceil(sectionElement.offsetHeight / chunkSize) - 1
    );
    return Math.min(maxIndex, Math.max(0, Math.floor(offsetInSection / chunkSize)));
}

export function buildHeightChunkMaskStyle(
    sectionElement: HTMLElement,
    chunkIndex: number,
    chunkSize = getHeightChunkPx()
): CSSProperties {
    const sectionHeight = Math.max(sectionElement.offsetHeight, 1);
    const chunkStart = chunkIndex * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, sectionHeight);
    const startPct = Math.max(0, (chunkStart / sectionHeight) * 100);
    const endPct = Math.min(100, (chunkEnd / sectionHeight) * 100);
    const fade = Math.min(MASK_FADE_PCT, (endPct - startPct) / 4);
    const fadeStart = Math.max(0, startPct - fade);
    const fadeEnd = Math.min(100, endPct + fade);

    const maskImage = `linear-gradient(to bottom, transparent 0%, transparent ${fadeStart}%, black ${startPct}%, black ${endPct}%, transparent ${fadeEnd}%, transparent 100%)`;

    return {
        WebkitMaskImage: maskImage,
        maskImage
    };
}

export type SectionFocusStrategy =
    | 'whole'
    | 'semantic'
    | 'height';

export function getSectionFocusStrategy(
    sectionElement: HTMLElement | null
): SectionFocusStrategy {
    if (!sectionElement || !isLongSection(sectionElement)) {
        return 'whole';
    }
    if (hasSemanticFocusBlocks(sectionElement)) {
        return 'semantic';
    }
    return 'height';
}

export function getFocusBlockId(element: Element): string | null {
    const focusId = element.getAttribute('data-brief-focus-id');
    if (focusId) {
        return focusId;
    }
    if (element.id) {
        return element.id;
    }
    return null;
}
