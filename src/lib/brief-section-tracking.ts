'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { observe } from 'react-intersection-observer';
import { BRIEF_METADATA_SECTION_ID } from '@/lib/brief-section-ids';
import { pointerToHeatmapGrid } from '@/lib/brief-mouse-heatmap';
import {
    featureEventKey,
    MAX_FEATURE_COUNT_PER_EVENT,
    MAX_FEATURE_EVENTS_PER_FLUSH,
    normalizeFeatureDetail,
    type ViewerFeatureEvent,
    type ViewerFeatureType
} from '@/lib/brief-viewer-features';

export { BRIEF_METADATA_SECTION_ID };

const FLUSH_INTERVAL_MS = 30_000;
const MAX_DWELL_MS_PER_EVENT = 300_000;
const MAX_CLICKS_PER_EVENT = 100;
const MOUSE_SAMPLE_INTERVAL_MS = 250;
const MAX_MOUSE_CELLS_PER_EVENT = 200;

const pendingFeatureEventsBySlug = new Map<string, Map<string, number>>();

export type EngagementFlushPayload = {
    dwellEvents: Array<{ sectionId: string; durationMs: number }>;
    clickEvents: Array<{ sectionId: string; clickCount: number }>;
    mouseEvents: Array<{ gridX: number; gridY: number; hitCount: number }>;
    featureEvents: Array<{
        feature: ViewerFeatureType;
        detail: string;
        count: number;
    }>;
};

type UseBriefSectionTrackingOptions = {
    viewerSlug: string;
    sectionIds: string[];
    contentRootRef: RefObject<HTMLDivElement | null>;
    metadataRef: RefObject<HTMLElement | null>;
    sectionRefs: RefObject<Record<string, HTMLElement | null>>;
    enabled: boolean;
};

export function queueViewerFeatureEvent(
    viewerSlug: string,
    event: Omit<ViewerFeatureEvent, 'count'> & { count?: number }
) {
    if (!viewerSlug) {
        return;
    }

    const detail = normalizeFeatureDetail(event.feature, event.detail);
    const count = Math.min(
        Math.max(event.count ?? 1, 1),
        MAX_FEATURE_COUNT_PER_EVENT
    );
    const key = featureEventKey(event.feature, detail);

    let slugBuffer = pendingFeatureEventsBySlug.get(viewerSlug);
    if (!slugBuffer) {
        if (pendingFeatureEventsBySlug.size >= 10) {
            return;
        }
        slugBuffer = new Map();
        pendingFeatureEventsBySlug.set(viewerSlug, slugBuffer);
    }

    if (!slugBuffer.has(key) && slugBuffer.size >= MAX_FEATURE_EVENTS_PER_FLUSH) {
        return;
    }

    slugBuffer.set(key, (slugBuffer.get(key) ?? 0) + count);
}

function drainFeatureEventsForSlug(
    viewerSlug: string
): EngagementFlushPayload['featureEvents'] {
    const slugBuffer = pendingFeatureEventsBySlug.get(viewerSlug);
    if (!slugBuffer || slugBuffer.size === 0) {
        return [];
    }

    const events: EngagementFlushPayload['featureEvents'] = [];

    slugBuffer.forEach((count, compositeKey) => {
        const separatorIndex = compositeKey.indexOf(':');
        if (separatorIndex === -1) {
            return;
        }

        const feature = compositeKey.slice(0, separatorIndex) as ViewerFeatureType;
        const detail = compositeKey.slice(separatorIndex + 1);

        events.push({
            feature,
            detail,
            count: Math.min(count, MAX_FEATURE_COUNT_PER_EVENT)
        });
    });

    pendingFeatureEventsBySlug.delete(viewerSlug);
    return events.slice(0, MAX_FEATURE_EVENTS_PER_FLUSH);
}

function resolveSectionId(
    target: EventTarget | null,
    allowedIds: Set<string>
): string | null {
    let node = target instanceof Element ? target : null;
    while (node) {
        const id = node.id;
        if (id && allowedIds.has(id)) {
            return id;
        }
        node = node.parentElement;
    }
    return null;
}

function mapToPayload(
    dwell: Map<string, number>,
    clicks: Map<string, number>,
    mouse: Map<string, number>,
    featureEvents: EngagementFlushPayload['featureEvents']
): EngagementFlushPayload {
    const dwellEvents: EngagementFlushPayload['dwellEvents'] = [];
    const clickEvents: EngagementFlushPayload['clickEvents'] = [];
    const mouseEvents: EngagementFlushPayload['mouseEvents'] = [];

    dwell.forEach((durationMs, sectionId) => {
        if (durationMs > 0) {
            dwellEvents.push({
                sectionId,
                durationMs: Math.min(durationMs, MAX_DWELL_MS_PER_EVENT)
            });
        }
    });

    clicks.forEach((clickCount, sectionId) => {
        if (clickCount > 0) {
            clickEvents.push({
                sectionId,
                clickCount: Math.min(clickCount, MAX_CLICKS_PER_EVENT)
            });
        }
    });

    mouse.forEach((hitCount, key) => {
        if (hitCount <= 0) {
            return;
        }
        const [gridXRaw, gridYRaw] = key.split(',');
        const gridX = Number(gridXRaw);
        const gridY = Number(gridYRaw);
        if (!Number.isInteger(gridX) || !Number.isInteger(gridY)) {
            return;
        }
        mouseEvents.push({ gridX, gridY, hitCount });
    });

    return { dwellEvents, clickEvents, mouseEvents, featureEvents };
}

async function sendEngagement(
    viewerSlug: string,
    payload: EngagementFlushPayload
): Promise<void> {
    if (
        payload.dwellEvents.length === 0 &&
        payload.clickEvents.length === 0 &&
        payload.mouseEvents.length === 0 &&
        payload.featureEvents.length === 0
    ) {
        return;
    }

    const url = `/api/briefs/viewer/${encodeURIComponent(viewerSlug)}/engagement`;
    const body = JSON.stringify(payload);

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(
            url,
            new Blob([body], { type: 'application/json' })
        );
        return;
    }

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
    });
}

export function useBriefSectionTracking({
    viewerSlug,
    sectionIds,
    contentRootRef,
    metadataRef,
    sectionRefs,
    enabled
}: UseBriefSectionTrackingOptions) {
    const ratiosRef = useRef<Map<string, number>>(new Map());
    const dwellPendingRef = useRef<Map<string, number>>(new Map());
    const clickPendingRef = useRef<Map<string, number>>(new Map());
    const mousePendingRef = useRef<Map<string, number>>(new Map());
    const activeSectionRef = useRef<string | null>(null);
    const activeSinceRef = useRef<number | null>(null);
    const lastMouseSampleRef = useRef(0);

    useEffect(() => {
        if (!enabled || !viewerSlug) {
            return;
        }

        const trackedIds = [BRIEF_METADATA_SECTION_ID, ...sectionIds];
        const allowedIds = new Set(trackedIds);

        const accumulateActiveDwell = () => {
            if (
                document.hidden ||
                !activeSectionRef.current ||
                activeSinceRef.current === null
            ) {
                return;
            }

            const elapsed = Date.now() - activeSinceRef.current;
            if (elapsed <= 0) {
                return;
            }

            const sectionId = activeSectionRef.current;
            dwellPendingRef.current.set(
                sectionId,
                (dwellPendingRef.current.get(sectionId) ?? 0) + elapsed
            );
            activeSinceRef.current = Date.now();
        };

        const pickActiveSection = () => {
            let bestId: string | null = null;
            let bestRatio = 0;

            ratiosRef.current.forEach((ratio, sectionId) => {
                if (ratio > bestRatio) {
                    bestRatio = ratio;
                    bestId = sectionId;
                }
            });

            if (bestId && bestRatio > 0) {
                if (bestId !== activeSectionRef.current) {
                    accumulateActiveDwell();
                    activeSectionRef.current = bestId;
                    activeSinceRef.current = Date.now();
                }
            } else {
                accumulateActiveDwell();
                activeSectionRef.current = null;
                activeSinceRef.current = null;
            }
        };

        const flush = () => {
            accumulateActiveDwell();
            const featureEvents = drainFeatureEventsForSlug(viewerSlug);
            const payload = mapToPayload(
                dwellPendingRef.current,
                clickPendingRef.current,
                mousePendingRef.current,
                featureEvents
            );
            dwellPendingRef.current.clear();
            clickPendingRef.current.clear();
            mousePendingRef.current.clear();
            void sendEngagement(viewerSlug, payload);
        };

        const unobservers: Array<() => void> = [];
        let frameId = 0;
        let intervalId = 0;
        let root: HTMLDivElement | null = null;
        let onClick: ((event: MouseEvent) => void) | null = null;
        let onPointerMove: ((event: PointerEvent) => void) | null = null;

        const recordMousePosition = (clientX: number, clientY: number) => {
            if (document.hidden || mousePendingRef.current.size >= MAX_MOUSE_CELLS_PER_EVENT) {
                return;
            }

            const content = contentRootRef.current;
            if (!content) {
                return;
            }

            const now = Date.now();
            if (now - lastMouseSampleRef.current < MOUSE_SAMPLE_INTERVAL_MS) {
                return;
            }
            lastMouseSampleRef.current = now;

            const grid = pointerToHeatmapGrid(content, clientX, clientY);
            if (!grid) {
                return;
            }

            const key = `${grid.gridX},${grid.gridY}`;
            mousePendingRef.current.set(
                key,
                (mousePendingRef.current.get(key) ?? 0) + 1
            );
        };

        const setup = () => {
            unobservers.forEach((unobserve) => unobserve());
            unobservers.length = 0;

            const observedElements: Array<{ id: string; el: HTMLElement }> =
                [];

            if (metadataRef.current) {
                observedElements.push({
                    id: BRIEF_METADATA_SECTION_ID,
                    el: metadataRef.current
                });
            }

            for (const sectionId of sectionIds) {
                const element = sectionRefs.current[sectionId];
                if (element) {
                    observedElements.push({ id: sectionId, el: element });
                }
            }

            if (observedElements.length === 0) {
                frameId = window.requestAnimationFrame(setup);
                return;
            }

            for (const { id, el } of observedElements) {
                const unobserve = observe(
                    el,
                    (inView, entry) => {
                        ratiosRef.current.set(
                            id,
                            inView ? entry.intersectionRatio : 0
                        );
                        pickActiveSection();
                    },
                    {
                        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
                        rootMargin: '-20% 0px 0px 0px'
                    }
                );
                unobservers.push(unobserve);
            }

            root = contentRootRef.current;
            onClick = (event: MouseEvent) => {
                const sectionId = resolveSectionId(event.target, allowedIds);
                if (!sectionId) {
                    return;
                }
                clickPendingRef.current.set(
                    sectionId,
                    (clickPendingRef.current.get(sectionId) ?? 0) + 1
                );
            };

            if (root && onClick) {
                root.addEventListener('click', onClick, true);
            }

            onPointerMove = (event: PointerEvent) => {
                if (event.pointerType === 'touch') {
                    return;
                }
                recordMousePosition(event.clientX, event.clientY);
            };
            window.addEventListener('pointermove', onPointerMove, {
                passive: true
            });
        };

        frameId = window.requestAnimationFrame(setup);

        const onVisibilityChange = () => {
            if (document.hidden) {
                accumulateActiveDwell();
                activeSinceRef.current = null;
            } else if (activeSectionRef.current) {
                activeSinceRef.current = Date.now();
            }
        };

        const onPageHide = () => {
            flush();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('pagehide', onPageHide);
        intervalId = window.setInterval(flush, FLUSH_INTERVAL_MS);

        return () => {
            window.cancelAnimationFrame(frameId);
            unobservers.forEach((unobserve) => unobserve());
            if (root && onClick) {
                root.removeEventListener('click', onClick, true);
            }
            if (onPointerMove) {
                window.removeEventListener('pointermove', onPointerMove);
            }
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('pagehide', onPageHide);
            window.clearInterval(intervalId);
            flush();
            pendingFeatureEventsBySlug.delete(viewerSlug);
        };
    }, [
        contentRootRef,
        enabled,
        metadataRef,
        sectionIds,
        sectionRefs,
        viewerSlug
    ]);
}
