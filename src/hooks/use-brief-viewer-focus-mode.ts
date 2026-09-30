'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type RefObject
} from 'react';
import {
    BRIEF_METADATA_FOCUS_ID,
    buildHeightChunkFocusId,
    buildHeightChunkMaskStyle,
    computeHeightChunkIndex,
    deriveSectionId,
    getFocusBlockId,
    getHeightChunkPx,
    getSectionFocusStrategy,
    getSemanticFocusBlocks,
    hasSemanticFocusBlocks,
    isLongSection,
    parseHeightChunkFocusId
} from '@/lib/brief-focus-mode';

type UseBriefViewerFocusModeOptions = {
    enabled: boolean;
    enabledSectionIds: string[];
    sectionRefs: RefObject<Record<string, HTMLElement | null>>;
    metadataRef: RefObject<HTMLElement | null>;
};

type SectionFocusProps = {
    className: string;
    style?: CSSProperties;
    'data-brief-focus-section'?: string;
};

export function useBriefViewerFocusMode({
    enabled,
    enabledSectionIds,
    sectionRefs,
    metadataRef
}: UseBriefViewerFocusModeOptions) {
    const [activeFocusId, setActiveFocusId] = useState<string | null>(null);
    const activeFocusIdRef = useRef<string | null>(null);
    const focusIntersectionRatios = useRef<Map<string, number>>(new Map());
    const focusBlockElements = useRef<Map<string, HTMLElement>>(new Map());
    const sectionStrategiesRef = useRef<Map<string, ReturnType<typeof getSectionFocusStrategy>>>(
        new Map()
    );
    const [, setLayoutVersion] = useState(0);

    useEffect(() => {
        activeFocusIdRef.current = activeFocusId;
    }, [activeFocusId]);

    const refreshSectionStrategies = useCallback(() => {
        const next = new Map<string, ReturnType<typeof getSectionFocusStrategy>>();
        for (const sectionId of enabledSectionIds) {
            const sectionElement = sectionRefs.current?.[sectionId] ?? null;
            next.set(sectionId, getSectionFocusStrategy(sectionElement));
        }

        let changed = sectionStrategiesRef.current.size !== next.size;
        if (!changed) {
            for (const [sectionId, strategy] of next) {
                if (sectionStrategiesRef.current.get(sectionId) !== strategy) {
                    changed = true;
                    break;
                }
            }
        }

        sectionStrategiesRef.current = next;
        if (changed) {
            setLayoutVersion((version) => version + 1);
        }
    }, [enabledSectionIds, sectionRefs]);

    const getSectionStrategy = useCallback((sectionId: string) => {
        return (
            sectionStrategiesRef.current.get(sectionId) ??
            getSectionFocusStrategy(sectionRefs.current?.[sectionId] ?? null)
        );
    }, [sectionRefs]);

    const getFocusBlockClass = useCallback(
        (blockId: string) => {
            if (!enabled) {
                return 'brief-viewer-focus-active';
            }
            if (!activeFocusId) {
                return 'brief-viewer-focus-active';
            }
            if (blockId === activeFocusId) {
                return 'brief-viewer-focus-active';
            }

            const blockSectionId = deriveSectionId(blockId);
            const activeSectionId = deriveSectionId(activeFocusId);

            if (blockSectionId !== activeSectionId) {
                return 'brief-viewer-focus-muted';
            }

            if (activeFocusId === activeSectionId) {
                return 'brief-viewer-focus-active';
            }

            return 'brief-viewer-focus-muted';
        },
        [activeFocusId, enabled]
    );

    const getPassthroughFocusClass = useCallback(
        (sectionId: string) => {
            if (!enabled || !activeFocusId) {
                return 'brief-viewer-focus-active';
            }
            if (deriveSectionId(activeFocusId) === sectionId) {
                return 'brief-viewer-focus-passthrough';
            }
            return 'brief-viewer-focus-muted';
        },
        [activeFocusId, enabled]
    );

    const getSectionFocusProps = useCallback(
        (sectionId: string): SectionFocusProps => {
            if (!enabled) {
                return { className: 'brief-viewer-focus-active' };
            }

            const strategy = getSectionStrategy(sectionId);
            const activeSectionId = deriveSectionId(activeFocusId);
            const isActiveSection = activeSectionId === sectionId;

            if (strategy === 'whole') {
                return {
                    className: getFocusBlockClass(sectionId)
                };
            }

            if (strategy === 'semantic') {
                if (!isActiveSection) {
                    return {
                        className: 'brief-viewer-focus-muted',
                        'data-brief-focus-section': sectionId
                    };
                }
                return {
                    className: 'brief-viewer-focus-section-current',
                    'data-brief-focus-section': sectionId
                };
            }

            const sectionElement = sectionRefs.current?.[sectionId] ?? null;
            if (!isActiveSection || !sectionElement) {
                return {
                    className: 'brief-viewer-focus-muted',
                    'data-brief-focus-section': sectionId
                };
            }

            const heightFocus = parseHeightChunkFocusId(activeFocusId ?? '');
            const chunkIndex =
                heightFocus?.sectionId === sectionId
                    ? heightFocus.chunkIndex
                    : computeHeightChunkIndex(sectionElement);

            return {
                className: 'brief-viewer-focus-height-window brief-viewer-focus-section-current',
                'data-brief-focus-section': sectionId,
                style: buildHeightChunkMaskStyle(sectionElement, chunkIndex)
            };
        },
        [
            activeFocusId,
            enabled,
            getFocusBlockClass,
            getSectionStrategy,
            sectionRefs
        ]
    );

    // Keep activeFocusId valid whenever enabled/enabledSectionIds change —
    // a self-correcting invariant, not a sync with an external system.
    // Adjusted during render instead of in an effect, faithfully
    // replicating the previous effect's dependency comparison (it
    // deliberately excludes activeFocusId itself, since that also changes
    // from the scroll/intersection-observer effect below).
    const [prevFocusValidityDeps, setPrevFocusValidityDeps] = useState([
        enabled,
        enabledSectionIds
    ]);
    if (
        enabled !== prevFocusValidityDeps[0] ||
        enabledSectionIds !== prevFocusValidityDeps[1]
    ) {
        setPrevFocusValidityDeps([enabled, enabledSectionIds]);

        if (!enabled) {
            // focusIntersectionRatios is cleared by the intersection-
            // observer effect below, which reacts to the same `enabled`
            // transition — refs must not be mutated during render.
            setActiveFocusId(null);
        } else if (enabledSectionIds.length === 0) {
            setActiveFocusId(null);
        } else if (!activeFocusId) {
            setActiveFocusId(BRIEF_METADATA_FOCUS_ID);
        } else if (
            activeFocusId !== BRIEF_METADATA_FOCUS_ID &&
            !enabledSectionIds.includes(activeFocusId) &&
            !enabledSectionIds.includes(deriveSectionId(activeFocusId) ?? '')
        ) {
            setActiveFocusId(BRIEF_METADATA_FOCUS_ID);
        }
    }

    useEffect(() => {
        if (!enabled) {
            return;
        }

        refreshSectionStrategies();

        let resizeFrame: number | null = null;
        const resizeObserver = new ResizeObserver(() => {
            if (resizeFrame !== null) {
                cancelAnimationFrame(resizeFrame);
            }
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = null;
                refreshSectionStrategies();
            });
        });

        for (const sectionId of enabledSectionIds) {
            const sectionElement = sectionRefs.current?.[sectionId];
            if (sectionElement) {
                resizeObserver.observe(sectionElement);
            }
        }

        return () => {
            if (resizeFrame !== null) {
                cancelAnimationFrame(resizeFrame);
            }
            resizeObserver.disconnect();
        };
    }, [enabled, enabledSectionIds, refreshSectionStrategies, sectionRefs]);

    useEffect(() => {
        if (!enabled) {
            focusIntersectionRatios.current.clear();
            return;
        }

        const observedElements: HTMLElement[] = [];

        if (metadataRef.current) {
            observedElements.push(metadataRef.current);
        }

        refreshSectionStrategies();

        for (const sectionId of enabledSectionIds) {
            const sectionElement = sectionRefs.current?.[sectionId];
            if (!sectionElement) {
                continue;
            }

            const strategy = getSectionFocusStrategy(sectionElement);

            if (strategy === 'semantic') {
                observedElements.push(...getSemanticFocusBlocks(sectionElement));
                continue;
            }

            observedElements.push(sectionElement);
        }

        if (observedElements.length === 0) {
            return;
        }

        const pickActiveFromRatios = () => {
            const lastSectionId =
                enabledSectionIds[enabledSectionIds.length - 1];
            const scrollBottom = window.scrollY + window.innerHeight;
            const pageBottom = document.documentElement.scrollHeight;
            const atPageEnd = scrollBottom >= pageBottom - 48;

            if (atPageEnd && lastSectionId) {
                const lastSectionElement = sectionRefs.current?.[lastSectionId];
                if (
                    lastSectionElement &&
                    isLongSection(lastSectionElement) &&
                    !hasSemanticFocusBlocks(lastSectionElement)
                ) {
                    const chunkIndex = computeHeightChunkIndex(lastSectionElement);
                    const nextFocusId = buildHeightChunkFocusId(
                        lastSectionId,
                        chunkIndex
                    );
                    if (nextFocusId !== activeFocusIdRef.current) {
                        setActiveFocusId(nextFocusId);
                    }
                    return;
                }
                if (lastSectionId !== activeFocusIdRef.current) {
                    setActiveFocusId(lastSectionId);
                }
                return;
            }

            const viewportFocusY = window.innerHeight * 0.35;
            let bestId: string | null = null;
            let bestScore = Number.NEGATIVE_INFINITY;

            focusIntersectionRatios.current.forEach((ratio, blockId) => {
                if (ratio <= 0) {
                    return;
                }

                const element = focusBlockElements.current.get(blockId);
                if (!element) {
                    return;
                }

                const rect = element.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const distanceFromFocus = Math.abs(centerY - viewportFocusY);
                const score = ratio * 1000 - distanceFromFocus;

                if (score > bestScore) {
                    bestScore = score;
                    bestId = blockId;
                }
            });

            if (bestId && bestScore > Number.NEGATIVE_INFINITY) {
                const sectionElement = sectionRefs.current?.[bestId] ?? null;
                if (
                    sectionElement &&
                    getSectionFocusStrategy(sectionElement) === 'height'
                ) {
                    const chunkIndex = computeHeightChunkIndex(sectionElement);
                    const nextFocusId = buildHeightChunkFocusId(
                        bestId,
                        chunkIndex
                    );
                    if (nextFocusId !== activeFocusIdRef.current) {
                        setActiveFocusId(nextFocusId);
                    }
                    return;
                }
                if (bestId !== activeFocusIdRef.current) {
                    setActiveFocusId(bestId);
                }
            }
        };

        const updateHeightChunkForActiveSection = () => {
            const currentFocusId = activeFocusIdRef.current;
            const activeSectionId = deriveSectionId(currentFocusId);
            if (!activeSectionId) {
                return;
            }

            const sectionElement = sectionRefs.current?.[activeSectionId];
            if (
                !sectionElement ||
                getSectionFocusStrategy(sectionElement) !== 'height'
            ) {
                return;
            }

            const lastSectionId =
                enabledSectionIds[enabledSectionIds.length - 1];
            const scrollBottom = window.scrollY + window.innerHeight;
            const pageBottom = document.documentElement.scrollHeight;
            const atPageEnd = scrollBottom >= pageBottom - 48;
            const chunkIndex =
                atPageEnd && activeSectionId === lastSectionId
                    ? Math.max(
                          0,
                          Math.ceil(
                              sectionElement.offsetHeight / getHeightChunkPx()
                          ) - 1
                      )
                    : computeHeightChunkIndex(sectionElement);
            const nextFocusId = buildHeightChunkFocusId(
                activeSectionId,
                chunkIndex
            );

            if (nextFocusId !== currentFocusId) {
                setActiveFocusId(nextFocusId);
            }
        };

        const onIntersect = (entries: IntersectionObserverEntry[]) => {
            for (const entry of entries) {
                const blockId = getFocusBlockId(entry.target);
                if (!blockId) {
                    continue;
                }

                focusIntersectionRatios.current.set(
                    blockId,
                    entry.isIntersecting ? entry.intersectionRatio : 0
                );
            }
            pickActiveFromRatios();
            updateHeightChunkForActiveSection();
        };

        const observer = new IntersectionObserver(onIntersect, {
            root: null,
            rootMargin: '-20% 0px 0px 0px',
            threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
        });

        focusBlockElements.current.clear();
        observedElements.forEach((element) => {
            const blockId = getFocusBlockId(element);
            if (blockId) {
                focusBlockElements.current.set(blockId, element);
            }
            observer.observe(element);
        });

        const onScroll = () => {
            pickActiveFromRatios();
            updateHeightChunkForActiveSection();
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        pickActiveFromRatios();
        updateHeightChunkForActiveSection();

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', onScroll);
            focusIntersectionRatios.current.clear();
            focusBlockElements.current.clear();
        };
    }, [
        enabled,
        enabledSectionIds,
        metadataRef,
        refreshSectionStrategies,
        sectionRefs
    ]);

    return {
        activeFocusId,
        getFocusBlockClass,
        getPassthroughFocusClass,
        getSectionFocusProps,
        getSectionStrategy
    };
}
