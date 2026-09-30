import { useCallback, useEffect, useRef } from 'react';
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle
} from '@/components/ui/resizable';
import { useBriefBuilder } from './brief-builder-context';
import { BuilderLeftPanel } from './builder-left-panel';
import { BuilderRightPanel } from './builder-right-panel';
import { OfflineExportBar } from './offline-export-bar';
import { cn } from '@/lib/utils';
import { useClientMounted } from '@/hooks/use-client-mounted';
import { useGroupRef, type Layout } from 'react-resizable-panels';

const PANEL_CONTENT = 'builder-content';
const PANEL_PREVIEW = 'builder-student-preview';

const SPLIT_FALLBACK: Layout = {
    [PANEL_CONTENT]: 50,
    [PANEL_PREVIEW]: 50
};

const HIDDEN_PREVIEW: Layout = {
    [PANEL_CONTENT]: 100,
    [PANEL_PREVIEW]: 0
};

const PREVIEW_FOCUS_LAYOUT: Layout = {
    [PANEL_CONTENT]: 40,
    [PANEL_PREVIEW]: 60
};

function BuilderPanelsLayoutSkeleton() {
    return (
        <div
            className='flex h-full w-full border-none print:!block print:!w-full'
            aria-hidden='true'>
            <div className='min-h-0 min-w-0 flex-1 bg-card print:hidden' />
            <div className='hidden w-px shrink-0 bg-border print:hidden sm:block' />
            <div className='min-h-0 min-w-0 flex-1 bg-muted/20 print:hidden' />
        </div>
    );
}

export function BuilderPanelsLayout({
    previewFocusLayout = false
}: {
    previewFocusLayout?: boolean;
}) {
    const mounted = useClientMounted();
    const {
        isStudentPreviewOpen,
        setStudentPreviewOpen,
        registerPreviewLayoutController,
        builderMode
    } = useBriefBuilder();
    const groupRef = useGroupRef();
    const layoutWhileSplitRef = useRef<Layout | null>(null);
    const isApplyingPreviewLayoutRef = useRef(false);
    const hasAppliedPreviewFocusLayoutRef = useRef(false);

    const applyPreviewOpenLayout = useCallback(
        (open: boolean) => {
            const group = groupRef.current;
            if (!group) {
                return;
            }

            isApplyingPreviewLayoutRef.current = true;
            try {
                if (!open) {
                    const current = group.getLayout();
                    const previewPct = current[PANEL_PREVIEW] ?? 0;
                    if (previewPct > 1) {
                        layoutWhileSplitRef.current = current;
                    }
                    group.setLayout(HIDDEN_PREVIEW);
                } else {
                    const saved = layoutWhileSplitRef.current;
                    group.setLayout(
                        saved &&
                            typeof saved[PANEL_PREVIEW] === 'number' &&
                            saved[PANEL_PREVIEW] > 1
                            ? saved
                            : SPLIT_FALLBACK
                    );
                }
            } catch {
                // Group may not be ready yet; ignore and let a later attempt apply.
            } finally {
                requestAnimationFrame(() => {
                    isApplyingPreviewLayoutRef.current = false;
                });
            }
        },
        [groupRef]
    );

    useEffect(() => {
        registerPreviewLayoutController({
            applyPreviewOpen: applyPreviewOpenLayout
        });
        return () => {
            registerPreviewLayoutController(null);
        };
    }, [applyPreviewOpenLayout, registerPreviewLayoutController]);

    useEffect(() => {
        if (previewFocusLayout) {
            if (hasAppliedPreviewFocusLayoutRef.current) {
                return;
            }

            let cancelled = false;
            let attempts = 0;
            const maxAttempts = 30;

            const applyPreviewFocus = () => {
                if (cancelled || attempts++ > maxAttempts) {
                    return;
                }
                const group = groupRef.current;
                if (!group) {
                    requestAnimationFrame(applyPreviewFocus);
                    return;
                }

                hasAppliedPreviewFocusLayoutRef.current = true;
                isApplyingPreviewLayoutRef.current = true;
                try {
                    setStudentPreviewOpen(true);
                    group.setLayout(PREVIEW_FOCUS_LAYOUT);
                } catch {
                    hasAppliedPreviewFocusLayoutRef.current = false;
                    requestAnimationFrame(applyPreviewFocus);
                    return;
                } finally {
                    requestAnimationFrame(() => {
                        isApplyingPreviewLayoutRef.current = false;
                    });
                }
            };

            const frame = requestAnimationFrame(() => {
                requestAnimationFrame(applyPreviewFocus);
            });

            return () => {
                cancelled = true;
                cancelAnimationFrame(frame);
            };
        }

        if (isStudentPreviewOpen) {
            return;
        }

        let cancelled = false;
        let attempts = 0;
        const maxAttempts = 30;

        const applyHidden = () => {
            if (cancelled || attempts++ > maxAttempts) {
                return;
            }
            if (!groupRef.current) {
                requestAnimationFrame(applyHidden);
                return;
            }
            applyPreviewOpenLayout(false);
        };

        const frame = requestAnimationFrame(() => {
            requestAnimationFrame(applyHidden);
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
        };
    }, [
        applyPreviewOpenLayout,
        groupRef,
        isStudentPreviewOpen,
        previewFocusLayout,
        setStudentPreviewOpen
    ]);

    const handleLayoutChange = useCallback(
        (layout: Layout) => {
            if (isApplyingPreviewLayoutRef.current) {
                return;
            }

            const previewPct = layout[PANEL_PREVIEW];
            if (typeof previewPct !== 'number') {
                return;
            }

            const collapsed = previewPct <= 1;
            setStudentPreviewOpen((prev) => {
                const next = !collapsed;
                return prev === next ? prev : next;
            });
        },
        [setStudentPreviewOpen]
    );

    // Radix and react-resizable-panels use React useId; with React 19 + Next.js
    // the SSR and hydration trees can diverge enough to shift those IDs. Skip
    // them until the client has mounted (same pattern as brief-viewer menus).
    if (!mounted) {
        return <BuilderPanelsLayoutSkeleton />;
    }

    return (
        <>
            <ResizablePanelGroup
            data-tour='brief-builder-split'
            id='brief-builder-panels'
            groupRef={groupRef}
            orientation='horizontal'
            disableCursor
            onLayoutChange={handleLayoutChange}
            className='border-none print:!block print:!w-full transition-all duration-300'>
            <ResizablePanel
                defaultSize='50%'
                minSize='40%'
                id={PANEL_CONTENT}
                className='min-h-0 min-w-0 print:hidden'>
                <BuilderLeftPanel />
            </ResizablePanel>
            <ResizableHandle
                data-tour='brief-builder-panel-resize'
                withHandle
                className={cn(
                    'print:hidden',
                    !isStudentPreviewOpen &&
                        'pointer-events-none opacity-0 max-w-0 min-w-0 overflow-hidden border-0 px-0 [&>div]:hidden'
                )}
            />
            <ResizablePanel
                id={PANEL_PREVIEW}
                defaultSize='50%'
                minSize='0%'
                maxSize='100%'
                className='min-h-0 min-w-2xl print:!block print:!w-full print:!max-w-full print:!flex-[1_1_100%] print:!basis-full print:!min-w-full print:!grow print:!shrink-0 transition-all duration-300'>
                <BuilderRightPanel />
            </ResizablePanel>
        </ResizablePanelGroup>
            <OfflineExportBar />
        </>
    );
}
