import React, { useState, useEffect, useRef, Fragment, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import Link from '@/components/app-link';
import { ExternalLink, Settings2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBriefViewerOptional } from '@/viewer-stubs/brief-viewer-context';
import { useBriefBuilderOptional } from '@/builder/brief-builder-context';
import {
    FONT_SIZE_SCALES,
    type FontSize
} from '@/viewer-stubs/brief-viewer-settings';
import { parseContentWithLinks } from '@/lib/content-parser';
import { isBriefSectionEnabled } from '@/lib/brief-sections';
import { isProjectDetailSubsectionVisible } from '@/lib/project-detail-subsections';
import {
    getVisibleCustomSubsections,
    normalizeCustomSubsections,
    parseCustomSubsectionBlockId
} from '@/lib/custom-subsections';
import {
    getVisibleProjectDetailBlockIds,
    normalizeProjectDetailBlockOrder
} from '@/lib/project-detail-block-order';

import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger
} from '@/components/ui/hover-card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

import {
    generateChecklistPDF,
    generateSubmissionFormPDF,
    generateChecklistAndSubmissionFormPDF
} from '@/components/brief-pdf-document';
import { ScheduleGantt } from '@/components/schedule-gantt';
import { SCHEDULE_ASSIGNMENT_PROGRESS_FILL } from '@/lib/schedule-phase-timeline';
import { HorizontalScrollHint } from '@/components/horizontal-scroll-hint';
import { cn } from '@/lib/utils';
import {
    hasSelfAssessmentRubric,
    isSelfAssessmentLinkEnabled
} from '@/lib/self-assessment-link';
import { isAiUsageLogEnabled } from '@/lib/ai-usage-log-link';
import { buildBriefViewerActions } from '@/lib/brief-viewer-actions';
import type { InstitutionalAiPolicy } from '@/lib/institution-config';
import { BriefInstitutionalFooter } from '@/components/brief-institutional-footer';
import { BriefAiPolicyPreview } from '@/components/brief-ai-policy-preview';
import {
    getVisibleFaqItems,
    hasFaqContent,
    parseFaqItems
} from '@/lib/faq';
import {
    loadSubmissionFormValues,
    saveSubmissionFormValues,
    writeSubmissionFormDraft,
    type SubmissionFormValues
} from '@/lib/submission-form-storage';
import {
    buildChecklistItemKeys,
    legacyChecklistStorageKey,
    loadChecklistDraft,
    migrateChecklistDraftToUserScope,
    pruneChecklistItems,
    saveChecklistDraft,
    writeChecklistDraft
} from '@/lib/checklist-storage';
import { useStudentDraftSync } from '@/hooks/use-student-draft-sync';
import {
    isChecklistStarted,
    isSubmissionFormStarted,
    type SyncedDraftEnvelope
} from '@/lib/student-brief-drafts';
import type { SubmissionFormDraftData } from '@/lib/student-brief-drafts';
import {
    BRIEF_METADATA_SECTION_ID,
    useBriefSectionTracking
} from '@/lib/brief-section-tracking';
import { useBriefViewerFocusMode } from '@/hooks/use-brief-viewer-focus-mode';
import { BRIEF_METADATA_FOCUS_ID } from '@/lib/brief-focus-mode';

export interface BriefSection {
    id: string;
    label: string;
    enabled: boolean;
    order: number;
}

export interface BriefMetadata {
    programmeName: string;
    module: string;
    title: string;
    lecturer: string;
    startDate: Date;
    submissionDate: Date;
    individualGroup: string;
}

function RubricCriterionNumberBadge({
    number,
    forceCompact,
    className
}: {
    number: number;
    forceCompact?: boolean;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'brief-rubric-criterion-number inline-flex shrink-0 items-center justify-center rounded-full border border-muted-foreground font-light tabular-nums text-muted-foreground',
                'h-9 w-9 text-base max-sm:h-8 max-sm:w-8 max-sm:text-sm',
                forceCompact && 'h-8 w-8 text-sm',
                className
            )}
            aria-label={`Criterion ${number}`}>
            {number}
        </span>
    );
}

/** Rubric LO badge: hover on pointer devices, tap/click to toggle on touch. */
function RubricLearningOutcomeBadge({
    outcomeIndex,
    title,
    forceCompact,
    className
}: {
    outcomeIndex: number;
    title: string;
    forceCompact?: boolean;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const label = `LO${outcomeIndex + 1}`;

    return (
        <HoverCard open={open} onOpenChange={setOpen}>
            <HoverCardTrigger asChild>
                <button
                    type='button'
                    className={cn(
                        'font-light text-muted-foreground rounded-full border text-center border-muted-foreground inline-block cursor-pointer align-middle hover:text-brand hover:bg-brand/10 hover:border-brand',
                        'px-2 py-1 text-xs',
                        'max-sm:px-1 max-sm:py-0.5 max-sm:text-[8px]',
                        forceCompact && 'px-1 py-0.5 text-[8px]',
                        className
                    )}
                    aria-label={`Learning outcome ${outcomeIndex + 1}: ${title}`}
                    aria-expanded={open}
                    onClick={() => setOpen((prev) => !prev)}>
                    {label}
                </button>
            </HoverCardTrigger>
            <HoverCardContent>
                <div className='flex items-center gap-2'>
                    <span
                        className={cn(
                            'max-sm:text-xs',
                            forceCompact && 'text-xs'
                        )}>
                        {title}
                    </span>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}

function PreviewDate({
    date,
    forceCompact
}: {
    date: Date | string;
    forceCompact?: boolean;
}) {
    // Parse outside the JSX so no JSX is constructed inside a try/catch —
    // React does not run this synchronously, so a try/catch around a
    // `return <jsx />` never actually catches a rendering error.
    let parsed: Date | null = null;
    try {
        const candidate = new Date(date);
        if (!Number.isNaN(candidate.getTime())) {
            parsed = candidate;
        }
    } catch {
        parsed = null;
    }

    if (!parsed) {
        return <>Not set</>;
    }
    if (forceCompact) {
        return <>{format(parsed, 'do MMMM yy')}</>;
    }
    return (
        <>
            <span className='hidden sm:inline'>
                {format(parsed, 'do MMMM yyyy')}
            </span>
            <span className='sm:hidden'>{format(parsed, 'do MMMM yy')}</span>
        </>
    );
}

interface BriefPreviewContentProps {
    metadata: BriefMetadata;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    sections: BriefSection[];
    aiPolicyDocument?: {
        url: string;
        fileName: string;
        sizeBytes?: number;
    } | null;
    templateKey?: string;
    institutionalAiPolicy?: InstitutionalAiPolicy;
    className?: string;
    /** Builder preview pane mode — narrows layout without relying on viewport breakpoints */
    previewLayout?: 'desktop' | 'mobile';
    variant?: 'default' | 'viewer';
    briefId?: string;
    viewerSlug?: string;
    isInsightsPage?: boolean;
    /** When false, section/mouse engagement is not sent (e.g. lecturer preview). */
    trackEngagement?: boolean;
    syncEnabled?: boolean;
    studentUserId?: number | null;
    initialChecklistDraft?: SyncedDraftEnvelope<{ items: Record<string, boolean> }> | null;
    initialSubmissionFormDraft?: SyncedDraftEnvelope<SubmissionFormDraftData> | null;
    /** Viewer deep-link: scroll once to this section id after mount. */
    initialScrollSectionId?: string | null;
}

export function BriefPreviewContent({
    metadata,
    content,
    sections,
    aiPolicyDocument = null,
    templateKey,
    institutionalAiPolicy,
    className = '',
    previewLayout,
    variant = 'default',
    briefId,
    viewerSlug,
    isInsightsPage = false,
    trackEngagement = true,
    syncEnabled = false,
    studentUserId = null,
    initialChecklistDraft = null,
    initialSubmissionFormDraft = null,
    initialScrollSectionId = null
}: BriefPreviewContentProps) {
    const forceCompact =
        className === 'mobile-preview' || previewLayout === 'mobile';
    const isViewer = variant === 'viewer';
    const builderContext = useBriefBuilderOptional();
    const viewerContext = useBriefViewerOptional();
    const focusModeEnabled = isViewer
        ? (viewerContext?.focusModeEnabled ?? false)
        : false;

    const contentRootRef = useRef<HTMLDivElement | null>(null);
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
    const metadataRef = useRef<HTMLDivElement | null>(null);
    const printHandlersRef = useRef({
        printChecklist: () => {},
        printSubmissionForm: () => {},
        printChecklistAndSubmissionForm: () => {}
    });

    const enabledSections = useMemo(
        () =>
            sections
                .filter((section) => isBriefSectionEnabled(section))
                .sort((a, b) => a.order - b.order),
        [sections]
    );
    const displaySections = enabledSections;
    const enabledSectionIds = useMemo(
        () => displaySections.map((section) => section.id),
        [displaySections]
    );

    const {
        getFocusBlockClass,
        getPassthroughFocusClass,
        getSectionFocusProps
    } = useBriefViewerFocusMode({
        enabled: isViewer && focusModeEnabled,
        enabledSectionIds,
        sectionRefs,
        metadataRef
    });

    const focusChunksEnabled = isViewer && focusModeEnabled;

    const focusChunkProps = useCallback(
        (id: string, className?: string) => ({
            ...(focusChunksEnabled ? { 'data-brief-focus-id': id } : {}),
            className: cn(
                className,
                focusChunksEnabled ? getFocusBlockClass(id) : undefined
            )
        }),
        [focusChunksEnabled, getFocusBlockClass]
    );

    const passthroughTitleProps = useCallback(
        (sectionId: string, className?: string) => ({
            ...(focusChunksEnabled ? { 'data-brief-focus-passthrough': '' } : {}),
            className: cn(
                className,
                focusChunksEnabled
                    ? getPassthroughFocusClass(sectionId)
                    : undefined
            )
        }),
        [focusChunksEnabled, getPassthroughFocusClass]
    );

    const scrollToBriefSectionById = useCallback(
        (sectionId: string) => {
            const sectionElement =
                sectionRefs.current[sectionId] ??
                document.getElementById(sectionId);
            if (!sectionElement) {
                return;
            }

            const scrollOffset = isViewer ? 80 : 24;
            const panelContainer = contentRootRef.current?.closest(
                '[data-panel-scroll-container]'
            ) as HTMLElement | null;

            if (panelContainer) {
                const containerRect = panelContainer.getBoundingClientRect();
                const elRect = sectionElement.getBoundingClientRect();
                const top =
                    panelContainer.scrollTop +
                    (elRect.top - containerRect.top) -
                    scrollOffset;
                panelContainer.scrollTo({
                    top: Math.max(0, top),
                    behavior: 'smooth'
                });
                return;
            }

            const top =
                window.scrollY +
                sectionElement.getBoundingClientRect().top -
                scrollOffset;
            window.scrollTo({
                top: Math.max(0, top),
                behavior: 'smooth'
            });
        },
        [isViewer]
    );

    // React Compiler is not enabled (see cleanup plan audit), so this has
    // no runtime effect today; it's the to-do list for when it is.
    const checklistItemKeys = useMemo(
        // eslint-disable-next-line react-hooks/preserve-manual-memoization
        () =>
            buildChecklistItemKeys(
                Array.isArray(content?.checklistItems)
                    ? content.checklistItems
                    : []
            ),
        [content?.checklistItems]
    );

    const hasChecklist =
        Array.isArray(content?.checklistItems) &&
        content.checklistItems.length > 0;
    const hasSubmissionForm =
        Array.isArray(content?.submissionFormFields) &&
        content.submissionFormFields.length > 0;

    const resolvedBriefId = briefId ?? `${metadata.title}-${metadata.module}`;

    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
        {}
    );
    const [submissionFormValues, setSubmissionFormValues] = useState<
        SubmissionFormValues
    >({});

    const { hydrated: checklistHydrated, persistDraft: persistChecklistDraft, flushSave: flushChecklistSave } =
        useStudentDraftSync<{ items: Record<string, boolean> }>({
            kind: 'checklist',
            briefId: resolvedBriefId,
            studentUserId,
            syncEnabled: syncEnabled && hasChecklist && Boolean(briefId),
            initialServerDraft: initialChecklistDraft,
            loadLocal: () => {
                if (!briefId) {
                    const legacy = loadChecklistDraft({
                        briefId: resolvedBriefId,
                        legacyTitle: metadata.title,
                        legacyModule: metadata.module
                    });
                    return legacy ? { items: legacy.items, revision: legacy.revision } : null;
                }

                if (studentUserId != null) {
                    migrateChecklistDraftToUserScope({
                        briefId,
                        userId: studentUserId,
                        legacyTitle: metadata.title,
                        legacyModule: metadata.module
                    });
                }

                const loaded = loadChecklistDraft({
                    briefId,
                    userId: studentUserId,
                    legacyTitle: metadata.title,
                    legacyModule: metadata.module
                });
                return loaded
                    ? { items: loaded.items, revision: loaded.revision }
                    : null;
            },
            writeLocal: (draft) => {
                if (!briefId) {
                    try {
                        window.localStorage.setItem(
                            legacyChecklistStorageKey(
                                metadata.title,
                                metadata.module
                            ),
                            JSON.stringify(draft)
                        );
                    } catch {
                        // ignore
                    }
                    return;
                }
                writeChecklistDraft(
                    briefId,
                    {
                        items: draft.items,
                        revision:
                            typeof (draft as { revision?: number }).revision ===
                            'number'
                                ? (draft as { revision?: number }).revision
                                : undefined
                    },
                    studentUserId
                );
            },
            saveLocal: (draft) => {
                if (!briefId) {
                    try {
                        window.localStorage.setItem(
                            legacyChecklistStorageKey(
                                metadata.title,
                                metadata.module
                            ),
                            JSON.stringify({
                                items: draft.items,
                                updatedAt: new Date().toISOString()
                            })
                        );
                    } catch {
                        // ignore
                    }
                    return;
                }
                saveChecklistDraft(briefId, draft.items, studentUserId);
            },
            createEmpty: () => ({ items: {} }),
            isStarted: (draft) => isChecklistStarted(draft.items ?? {}),
            toEnvelopeData: (draft) => ({
                items: pruneChecklistItems(draft.items, checklistItemKeys)
            }),
            fromEnvelopeData: (data, revision) => ({
                items: pruneChecklistItems(data.items ?? {}, checklistItemKeys),
                revision
            }),
            onHydrated: (draft) => {
                setCheckedItems(draft.items ?? {});
            }
        });

    const {
        hydrated: submissionHydrated,
        persistDraft: persistSubmissionDraft,
        flushSave: flushSubmissionSave
    } = useStudentDraftSync<SubmissionFormDraftData>({
        kind: 'submissionForm',
        briefId: resolvedBriefId,
        studentUserId,
        syncEnabled: syncEnabled && hasSubmissionForm && Boolean(briefId),
        initialServerDraft: initialSubmissionFormDraft,
        loadLocal: () => {
            const loaded = briefId
                ? loadSubmissionFormValues(briefId, studentUserId)
                : loadSubmissionFormValues(resolvedBriefId);
            return loaded && Object.keys(loaded).length > 0
                ? { values: loaded }
                : briefId
                  ? null
                  : { values: loaded };
        },
        writeLocal: (draft) => {
            if (!briefId) {
                return;
            }
            writeSubmissionFormDraft(
                briefId,
                {
                    values: draft.values,
                    revision:
                        typeof (draft as { revision?: number }).revision ===
                        'number'
                            ? (draft as { revision?: number }).revision
                            : undefined
                },
                studentUserId
            );
        },
        saveLocal: (draft) => {
            if (!briefId) {
                saveSubmissionFormValues(resolvedBriefId, draft.values);
                return;
            }
            saveSubmissionFormValues(briefId, draft.values, studentUserId);
        },
        createEmpty: () => ({ values: {} }),
        isStarted: (draft) => isSubmissionFormStarted(draft.values ?? {}),
        toEnvelopeData: (draft) => draft,
        fromEnvelopeData: (data, revision) => ({
            values: data.values ?? {},
            revision
        }),
        onHydrated: (draft) => {
            setSubmissionFormValues(draft.values ?? {});
        }
    });

    const draftsHydrated =
        (!hasChecklist || checklistHydrated) &&
        (!hasSubmissionForm || submissionHydrated);

    // State to track font size preference (builder preview only)
    const [localFontSize, setLocalFontSize] = useState<FontSize>('normal');

    const fontSize = isViewer
        ? (viewerContext?.fontSize ?? 'normal')
        : localFontSize;

    const handleCheckboxChange = (itemKey: string) => {
        if (!draftsHydrated) {
            return;
        }

        setCheckedItems((prev) => {
            const next = {
                ...prev,
                [itemKey]: !prev[itemKey]
            };
            persistChecklistDraft({ items: next });
            return next;
        });
    };

    const handleSubmissionFormChange = (fieldKey: string, value: string) => {
        if (!draftsHydrated) {
            return;
        }

        setSubmissionFormValues((prev) => {
            const next = {
                ...prev,
                [fieldKey]: value
            };
            persistSubmissionDraft({ values: next });
            return next;
        });
    };

    const printFormOptions = {
        submissionFormValues,
        checkedItems
    };

    const handlePrintChecklist = async () => {
        try {
            await flushChecklistSave();
            await generateChecklistPDF(content, printFormOptions);
        } catch (error) {
            console.error('Error generating checklist PDF:', error);
        }
    };

    const handlePrintSubmissionForm = async () => {
        try {
            await flushSubmissionSave();
            await generateSubmissionFormPDF(content, printFormOptions);
        } catch (error) {
            console.error('Error generating submission form PDF:', error);
        }
    };

    const handlePrintChecklistAndSubmissionForm = async () => {
        try {
            await Promise.all([flushChecklistSave(), flushSubmissionSave()]);
            await generateChecklistAndSubmissionFormPDF(content, printFormOptions);
        } catch (error) {
            console.error(
                'Error generating checklist and submission form PDF:',
                error
            );
        }
    };

    // Latest-callback ref: printHandlersRef is only ever invoked from user
    // clicks (via setViewerActions below), so a one-commit delay from
    // writing it in an effect instead of during render is harmless, and
    // refs must not be written during render.
    useEffect(() => {
        printHandlersRef.current = {
            printChecklist: handlePrintChecklist,
            printSubmissionForm: handlePrintSubmissionForm,
            printChecklistAndSubmissionForm:
                handlePrintChecklistAndSubmissionForm
        };
    });

    const effectiveViewerSlug = viewerSlug ?? builderContext?.viewerSlug;
    const showSelfAssessmentLink = Boolean(effectiveViewerSlug) && (
        builderContext
            ? builderContext.selfAssessmentLinkEnabled &&
              hasSelfAssessmentRubric(content)
            : isSelfAssessmentLinkEnabled(content)
    );
    const resolvedInstitutionalPolicy =
        institutionalAiPolicy ??
        builderContext?.institutionalAiPolicy ?? { label: '', url: '' };
    const showAiUsageLogLink = Boolean(effectiveViewerSlug) && (
        builderContext
            ? isAiUsageLogEnabled(content, sections)
            : isAiUsageLogEnabled(content, sections)
    );

    useEffect(() => {
        const setViewerActions = viewerContext?.setViewerActions;
        if (!isViewer || !setViewerActions || !effectiveViewerSlug) {
            return;
        }

        setViewerActions(
            buildBriefViewerActions({
                sections,
                content,
                viewerSlug: effectiveViewerSlug,
                showAiUsageLogLink,
                showSelfAssessmentLink,
                printHandlers: {
                    printChecklist: () =>
                        printHandlersRef.current.printChecklist(),
                    printSubmissionForm: () =>
                        printHandlersRef.current.printSubmissionForm(),
                    printChecklistAndSubmissionForm: () =>
                        printHandlersRef.current.printChecklistAndSubmissionForm()
                }
            })
        );

        return () => {
            setViewerActions([]);
        };
    }, [
        isViewer,
        viewerContext?.setViewerActions,
        effectiveViewerSlug,
        sections,
        content,
        showAiUsageLogLink,
        showSelfAssessmentLink
    ]);

    const renderSectionContent = (sectionId: string) => {
        if (!content) return null;

        switch (sectionId) {
            case 'project-details':
                const hiddenProjectDetailSubsections =
                    content?.hiddenProjectDetailSubsections;
                const hasOverview =
                    content?.subheadings?.['project-overview-content'];
                const hasKeyExpectations =
                    isProjectDetailSubsectionVisible(
                        'key-expectations',
                        hiddenProjectDetailSubsections
                    ) && content?.subheadings?.['key-expectations'];
                const hasLearningOutcomes =
                    isProjectDetailSubsectionVisible(
                        'learning-outcomes',
                        hiddenProjectDetailSubsections
                    ) &&
                    content?.learningOutcomes &&
                    content.learningOutcomes.length > 0;
                const hasDeliverables =
                    isProjectDetailSubsectionVisible(
                        'deliverables',
                        hiddenProjectDetailSubsections
                    ) &&
                    content?.deliverables &&
                    content.deliverables.length > 0;
                const hasResources =
                    isProjectDetailSubsectionVisible(
                        'resources',
                        hiddenProjectDetailSubsections
                    ) &&
                    content?.resources &&
                    content.resources.length > 0;
                const { subsections: normalizedCustomSubsections } =
                    normalizeCustomSubsections(
                        content?.customSubsections,
                        content?.hiddenCustomSubsectionIds
                    );
                const visibleProjectDetailBlockIds =
                    getVisibleProjectDetailBlockIds(
                        normalizeProjectDetailBlockOrder(
                            content?.projectDetailBlockOrder,
                            normalizedCustomSubsections
                        ),
                        hiddenProjectDetailSubsections,
                        content?.hiddenCustomSubsectionIds
                    );

                const hasVisibleCustomSubsections =
                    getVisibleCustomSubsections(
                        normalizedCustomSubsections,
                        content?.hiddenCustomSubsectionIds
                    ).some(
                        (subsection) =>
                            Boolean(subsection.title?.trim()) ||
                            Boolean(
                                typeof subsection.content === 'string'
                                    ? subsection.content.trim()
                                    : subsection.content
                            ) ||
                            (subsection.type === 'accordion' &&
                                subsection.items?.some(
                                    (item) =>
                                        item.title?.trim() ||
                                        (typeof item.content === 'string'
                                            ? item.content.trim()
                                            : item.content)
                                ))
                    );

                if (
                    !hasOverview &&
                    !hasLearningOutcomes &&
                    !hasKeyExpectations &&
                    !hasDeliverables &&
                    !hasResources &&
                    !hasVisibleCustomSubsections
                ) {
                    return (
                        <p
                            className={cn('font-light text-muted-foreground', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                            Content not yet added for this section
                        </p>
                    );
                }

                const projectDetailsRowClass =
                    'grid grid-cols-1 md:grid-cols-[15rem_1fr] border-b last:border-b-0';

                return (
                    <>
                        <h2
                            {...passthroughTitleProps(
                                'project-details',
                                cn(
                                    'font-extralight tracking-tight',
                                    'text-3xl mb-6',
                                    'max-sm:text-xl max-sm:mb-3',
                                    forceCompact && 'text-xl mb-3'
                                )
                            )}>
                            Project Details
                        </h2>
                        <div className='border'>
                            {visibleProjectDetailBlockIds.map((blockId) => {
                                if (
                                    blockId === 'project-overview-content' &&
                                    hasOverview
                                ) {
                                    return (
                                <div
                                    key={blockId}
                                    {...focusChunkProps(
                                        'project-details--overview',
                                        projectDetailsRowClass
                                    )}>
                                    <div className='md:border-r'>
                                        <div
                                            className={cn('font-normal', 'p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                            <p>Project Overview</p>
                                        </div>
                                    </div>
                                    <div data-section-id='project-overview'>
                                        <div
                                            className={cn('font-light leading-relaxed', 'p-4 sm:pb-4 sm:px-4', 'max-sm:text-xs max-sm:pb-2 max-sm:px-3 max-sm:pt-2', forceCompact && 'text-xs pb-2 px-3 pt-2')}>
                                            {parseContentWithLinks(
                                                content.subheadings[
                                                    'project-overview-content'
                                                ]
                                            )}
                                        </div>
                                    </div>
                                </div>
                                    );
                                }

                                if (
                                    blockId === 'learning-outcomes' &&
                                    hasLearningOutcomes
                                ) {
                                    return (
                                <div
                                    key={blockId}
                                    {...focusChunkProps(
                                        'project-details--learning-outcomes',
                                        projectDetailsRowClass
                                    )}>
                                    <div className='md:border-r'>
                                        <div
                                            className={cn('font-normal h-full flex flex-col justify-between', 'p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3 max-sm:gap-2', forceCompact && 'py-2 px-3 gap-2')}>
                                            <p>Learning Outcomes Assessed</p>
                                            {enabledSectionIds.includes(
                                                'rubric'
                                            ) ? (
                                                <p
                                                    className={cn(
                                                        'font-light',
                                                        'text-sm',
                                                        'max-sm:text-[10px]',
                                                        forceCompact &&
                                                            'text-[10px]'
                                                    )}>
                                                    <a
                                                        href='#rubric'
                                                        className='text-foreground hover:text-brand underline underline-offset-2 decoration-1 transition-colors'
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            scrollToBriefSectionById(
                                                                'rubric'
                                                            );
                                                        }}>
                                                        (See Rubric Below)↓
                                                    </a>
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div>
                                        {content.learningOutcomes.map(
                                            (
                                                lo: {
                                                    title: string;
                                                    weighting: number;
                                                },
                                                idx: number
                                            ) => (
                                                <div
                                                    key={idx}
                                                    className={cn('grid gap-2 border-b last:border-b-0', 'gap-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}
                                                    style={{
                                                        gridTemplateColumns:
                                                            lo.weighting > 0
                                                                ? '1fr auto'
                                                                : '1fr'
                                                    }}>
                                                    <div
                                                        className={cn(
                                                            'font-light col-span-1 flex items-center',
                                                            'gap-3 py-4 pl-4',
                                                            'max-sm:gap-2',
                                                            forceCompact && 'gap-2',
                                                            lo.weighting <= 0 &&
                                                                cn('pr-4', forceCompact && '')
                                                        )}>
                                                        <span
                                                            className={cn(
                                                                'brief-lo-assessed-number font-thin leading-none flex-shrink-0',
                                                                'text-2xl',
                                                                'max-sm:text-xl',
                                                                forceCompact && 'text-xl'
                                                            )}>
                                                            {String.fromCharCode(
                                                                0x245f + idx + 1
                                                            )}
                                                        </span>
                                                        <p
                                                            className={cn('font-light', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                                            {lo.title}
                                                        </p>
                                                    </div>
                                                    {lo.weighting > 0 && (
                                                        <div
                                                            className={cn('col-span-1 border-l flex items-center justify-center', 'p-4 sm:py-4 sm:px-4', 'max-sm:px-2', forceCompact && 'px-2')}>
                                                            <span
                                                                className={cn('font-extralight slashed-zero-nums', 'text-xl', 'max-sm:text-sm', forceCompact && 'text-sm')}>
                                                                {lo.weighting}%
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                                    );
                                }

                                if (
                                    blockId === 'key-expectations' &&
                                    hasKeyExpectations
                                ) {
                                    return (
                                <div
                                    key={blockId}
                                    {...focusChunkProps(
                                        'project-details--key-expectations',
                                        projectDetailsRowClass
                                    )}>
                                    <div className='md:border-r'>
                                        <div
                                            className={cn('font-normal h-full flex flex-col justify-between', 'p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                            <p>Key Expectations</p>
                                            <div
                                                className={cn('font-light', 'text-sm', 'max-sm:text-[10px] max-sm:mt-1', forceCompact && 'text-[10px] mt-1')}>
                                                {content.subheadings?.[
                                                    'key-expectations'
                                                ] &&
                                                    parseContentWithLinks(
                                                        content.subheadings?.[
                                                            'key-expectations'
                                                        ]
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                    <div data-section-id='key-expectations'>
                                        {content.keyExpectations.map(
                                            (
                                                expectation: {
                                                    title: string;
                                                    description: string;
                                                },
                                                idx: number
                                            ) => (
                                                <details
                                                    key={idx}
                                                    className={cn(
                                                        'group',
                                                        'p-4 sm:pb-4 sm:px-4',
                                                        'max-sm:py-2 max-sm:px-3',
                                                        forceCompact && 'py-2 px-3'
                                                    )}>
                                                    <summary
                                                        className={cn('flex justify-between items-start gap-2 cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5 hover:text-brand dark:hover:text-brand', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                                        <span>{expectation.title}</span>
                                                        <span
                                                            className={cn('font-thin flex-shrink-0 transition-all group-open:content-[\'–\']', 'text-2xl', 'max-sm:text-lg', forceCompact && 'text-lg')}
                                                            aria-hidden='true'>
                                                            <span className='group-open:hidden'>+</span>
                                                            <span className='hidden group-open:inline'>–</span>
                                                        </span>
                                                    </summary>
                                                    <div
                                                        className={cn('font-light leading-relaxed', 'mt-2', 'max-sm:mt-1 max-sm:text-xs', forceCompact && 'mt-1 text-xs')}>
                                                        {parseContentWithLinks(
                                                            expectation.description
                                                        )}
                                                    </div>
                                                </details>
                                            )
                                        )}
                                    </div>
                                </div>
                                    );
                                }

                                if (
                                    blockId === 'deliverables' &&
                                    hasDeliverables
                                ) {
                                    return (
                                <div
                                    key={blockId}
                                    {...focusChunkProps(
                                        'project-details--deliverables',
                                        projectDetailsRowClass
                                    )}>
                                    <div className='md:border-r'>
                                        <div
                                            className={cn('font-normal h-full flex flex-col justify-between', 'p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                            <p>Deliverables</p>
                                            <div
                                                className={cn('font-light', 'text-sm', 'max-sm:text-[10px] max-sm:mt-1', forceCompact && 'text-[10px] mt-1')}>
                                                {content.subheadings?.[
                                                    'deliverables'
                                                ] &&
                                                    parseContentWithLinks(
                                                        content.subheadings?.[
                                                            'deliverables'
                                                        ]
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                    <div data-section-id='deliverables'>
                                        {content.deliverables.map(
                                            (
                                                deliverable: {
                                                    title: string;
                                                    description: string;
                                                },
                                                idx: number
                                            ) => (
                                                <details
                                                    key={idx}
                                                    className={cn(
                                                        'group',
                                                        'p-4 sm:pb-4 sm:px-4',
                                                        'max-sm:py-2 max-sm:px-3',
                                                        forceCompact && 'py-2 px-3'
                                                    )}>
                                                    <summary
                                                        className={cn('flex justify-between items-start gap-2 cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5 hover:text-brand dark:hover:text-brand', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                                        <span>{deliverable.title}</span>
                                                        <span
                                                            className={cn('font-thin flex-shrink-0 transition-all group-open:content-[\'–\']', 'text-2xl', 'max-sm:text-lg', forceCompact && 'text-lg')}
                                                            aria-hidden='true'>
                                                            <span className='group-open:hidden'>+</span>
                                                            <span className='hidden group-open:inline'>–</span>
                                                        </span>
                                                    </summary>
                                                    <div
                                                        className={cn('font-light leading-relaxed', 'mt-2', 'max-sm:mt-1 max-sm:text-xs', forceCompact && 'mt-1 text-xs')}>
                                                        {parseContentWithLinks(
                                                            deliverable.description
                                                        )}
                                                    </div>
                                                </details>
                                            )
                                        )}
                                    </div>
                                </div>
                                    );
                                }

                                if (blockId === 'resources' && hasResources) {
                                    return (
                                <div
                                    key={blockId}
                                    {...focusChunkProps(
                                        'project-details--resources',
                                        projectDetailsRowClass
                                    )}>
                                    <div className='md:border-r'>
                                        <div
                                            className={cn('font-normal h-full flex flex-col justify-between', 'p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                            <p>Resources</p>
                                            <div
                                                className={cn('font-light', 'text-sm', 'max-sm:text-[10px] max-sm:mt-1', forceCompact && 'text-[10px] mt-1')}>
                                                {content.subheadings?.[
                                                    'resources'
                                                ] &&
                                                    parseContentWithLinks(
                                                        content.subheadings?.[
                                                            'resources'
                                                        ]
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                    <div data-section-id='resources'>
                                        {content.resources.map(
                                            (
                                                resource: {
                                                    title: string;
                                                    description: string;
                                                },
                                                idx: number
                                            ) => (
                                                <details
                                                    key={idx}
                                                    className={cn(
                                                        'group',
                                                        'p-4 sm:pb-4 sm:px-4',
                                                        'max-sm:py-2 max-sm:px-3',
                                                        forceCompact && 'py-2 px-3'
                                                    )}>
                                                    <summary
                                                        className={cn('flex justify-between items-start gap-2 cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5 hover:text-brand dark:hover:text-brand', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                                        <span>{resource.title}</span>
                                                        <span
                                                            className={cn('font-thin flex-shrink-0 transition-all group-open:content-[\'–\']', 'text-2xl', 'max-sm:text-lg', forceCompact && 'text-lg')}
                                                            aria-hidden='true'>
                                                            <span className='group-open:hidden'>+</span>
                                                            <span className='hidden group-open:inline'>–</span>
                                                        </span>
                                                    </summary>
                                                    <div
                                                        className={cn('font-light leading-relaxed', 'mt-2', 'max-sm:mt-1 max-sm:text-xs', forceCompact && 'mt-1 text-xs')}>
                                                        {parseContentWithLinks(
                                                            resource.description
                                                        )}
                                                    </div>
                                                </details>
                                            )
                                        )}
                                    </div>
                                </div>
                                    );
                                }

                                const customId =
                                    parseCustomSubsectionBlockId(blockId);
                                if (customId) {
                                    const subsection =
                                        normalizedCustomSubsections.find(
                                            (entry) => entry.id === customId
                                        );
                                    if (!subsection) return null;

                                    if (subsection.type === 'accordion') {
                                        return (
                                            <div
                                                key={blockId}
                                                {...focusChunkProps(
                                                    `project-details--custom-${customId}`,
                                                    projectDetailsRowClass
                                                )}>
                                                <div className='md:border-r'>
                                                    <div
                                                        className={cn(
                                                            'font-normal h-full flex flex-col justify-between',
                                                            'p-4 sm:py-4 sm:px-4',
                                                            'max-sm:py-2 max-sm:px-3',
                                                            forceCompact &&
                                                                'py-2 px-3'
                                                        )}>
                                                        <p>{subsection.title}</p>
                                                        {subsection.subheading ? (
                                                            <p
                                                                className={cn(
                                                                    'font-light text-sm',
                                                                    'max-sm:text-[10px] max-sm:mt-1',
                                                                    forceCompact &&
                                                                        'text-[10px] mt-1'
                                                                )}>
                                                                {parseContentWithLinks(
                                                                    subsection.subheading
                                                                )}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div>
                                                    {(subsection.items || []).map(
                                                        (item, idx) => (
                                                            <details
                                                                key={idx}
                                                                className={cn(
                                                                    'group',
                                                                    'p-4 sm:pb-4 sm:px-4',
                                                                    'max-sm:py-2 max-sm:px-3',
                                                                    forceCompact &&
                                                                        'py-2 px-3'
                                                                )}>
                                                                <summary
                                                                    className={cn(
                                                                        'flex justify-between items-start gap-2 cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5 hover:text-brand dark:hover:text-brand',
                                                                        '',
                                                                        'max-sm:text-xs',
                                                                        forceCompact &&
                                                                            'text-xs'
                                                                    )}>
                                                                    <span>
                                                                        {
                                                                            item.title
                                                                        }
                                                                    </span>
                                                                    <span
                                                                        className={cn(
                                                                            "font-thin flex-shrink-0 transition-all group-open:content-['–']",
                                                                            'text-2xl',
                                                                            'max-sm:text-lg',
                                                                            forceCompact &&
                                                                                'text-lg'
                                                                        )}
                                                                        aria-hidden='true'>
                                                                        <span className='group-open:hidden'>
                                                                            +
                                                                        </span>
                                                                        <span className='hidden group-open:inline'>
                                                                            –
                                                                        </span>
                                                                    </span>
                                                                </summary>
                                                                <div
                                                                    className={cn(
                                                                        'font-light leading-relaxed',
                                                                        'mt-2',
                                                                        'max-sm:mt-1 max-sm:text-xs',
                                                                        forceCompact &&
                                                                            'mt-1 text-xs'
                                                                    )}>
                                                                    {parseContentWithLinks(
                                                                        item.content
                                                                    )}
                                                                </div>
                                                            </details>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={blockId}
                                            {...focusChunkProps(
                                                `project-details--custom-${customId}`,
                                                projectDetailsRowClass
                                            )}>
                                            <div className='md:border-r'>
                                                <div
                                                    className={cn(
                                                        'font-normal h-full flex flex-col justify-between',
                                                        'p-4 sm:py-4 sm:px-4',
                                                        'max-sm:py-2 max-sm:px-3',
                                                        forceCompact && 'py-2 px-3'
                                                    )}>
                                                    <p>{subsection.title}</p>
                                                    {subsection.subheading ? (
                                                        <p
                                                            className={cn(
                                                                'font-light text-sm',
                                                                'max-sm:text-[10px] max-sm:mt-1',
                                                                forceCompact &&
                                                                    'text-[10px] mt-1'
                                                            )}>
                                                            {parseContentWithLinks(
                                                                subsection.subheading
                                                            )}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div
                                                className={cn(
                                                    'p-4 sm:pb-4 sm:px-4',
                                                    'max-sm:py-2 max-sm:px-3',
                                                    forceCompact && 'py-2 px-3'
                                                )}>
                                                <div
                                                    className={cn(
                                                        'font-light leading-relaxed',
                                                        '',
                                                        'max-sm:text-xs',
                                                        forceCompact && 'text-xs'
                                                    )}>
                                                    {parseContentWithLinks(
                                                        subsection.content
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return null;
                            })}
                        </div>
                    </>
                );

            // case 'key-expectations':
            //     if (
            //         !content.keyExpectations ||
            //         content.keyExpectations.length === 0
            //     ) {
            //         return (
            //             <p
            //                 className={`font-light text-muted-foreground ${
            //                     cn('', 'max-sm:text-xs', forceCompact && 'text-xs')
            //                 }`}>
            //                 Content not yet added for this section
            //             </p>
            //         );
            //     }
            //     return (
            //         <div
            //             className={
            //                 className === 'mobile-preview'
            //                     ? 'space-y-2'
            //                     : 'space-y-4'
            //             }>
            //             {content.subheadings?.['key-expectations'] && (
            //                 <p
            //                     className={`font-light mb-4 ${
            //                         className === 'mobile-preview'
            //                             ? 'text-xs'
            //                             : ''
            //                     }`}>
            //                     {content.subheadings['key-expectations']}
            //                 </p>
            //             )}
            //             {content.keyExpectations.map(
            //                 (
            //                     exp: { title: string; description: string },
            //                     idx: number
            //                 ) => (
            //                     <details key={idx} className='group' open>
            //                         <summary
            //                             className={`flex justify-between items-center cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5 hover:text-blue-700 dark:hover:text-orange-600 ${
            //                                 className === 'mobile-preview'
            //                                     ? 'text-xs'
            //                                     : ''
            //                             }`}>
            //                             <span>{exp.title}</span>
            //                             <span
            //                                 className={`font-thin flex-shrink-0 transition-all ${
            //                                     className === 'mobile-preview'
            //                                         ? 'text-lg'
            //                                         : 'text-2xl'
            //                                 }`}
            //                                 aria-hidden='true'>
            //                                 <span className='group-open:hidden'>
            //                                     +
            //                                 </span>
            //                                 <span className='hidden group-open:inline'>
            //                                     –
            //                                 </span>
            //                             </span>
            //                         </summary>
            //                         <div
            //                             className={`font-light leading-relaxed ${
            //                                 className === 'mobile-preview'
            //                                     ? 'mt-1 text-xs'
            //                                     : 'mt-2'
            //                             }`}>
            //                             {parseContentWithLinks(exp.description)}
            //                         </div>
            //                     </details>
            //                 )
            //             )}
            //         </div>
            //     );

            // case 'deliverables':
            //     if (
            //         !content.deliverables ||
            //         content.deliverables.length === 0
            //     ) {
            //         return (
            //             <>
            //                 <h2
            //                     className={`font-extralight tracking-tight ${
            //                         className === 'mobile-preview'
            //                             ? 'text-xl mb-3'
            //                             : 'text-3xl mb-6'
            //                     }`}>
            //                     Deliverables
            //                 </h2>
            //                 <p
            //                     className={`font-light text-muted-foreground ${
            //                         className === 'mobile-preview'
            //                             ? 'text-xs'
            //                             : ''
            //                     }`}>
            //                     Content not yet added for this section
            //                 </p>
            //             </>
            //         );
            //     }
            //     return (
            //         <div
            //             className={
            //                 className === 'mobile-preview'
            //                     ? 'space-y-2'
            //                     : 'space-y-4'
            //             }>
            //             {content.deliverables.map(
            //                 (
            //                     del: { title: string; description: string },
            //                     idx: number
            //                 ) => (
            //                     <details key={idx} className='group'>
            //                         <summary
            //                             className={`cursor-pointer font-normal list-none flex justify-between items-center ${
            //                                 className === 'mobile-preview'
            //                                     ? 'text-xs'
            //                                     : ''
            //                             }`}>
            //                             <span>{del.title}</span>
            //                             <span
            //                                 className={`${
            //                                     className === 'mobile-preview'
            //                                         ? 'text-lg'
            //                                         : 'text-2xl'
            //                                 } font-thin transition-transform group-open:rotate-45`}>
            //                                 +
            //                             </span>
            //                         </summary>
            //                         <div
            //                             className={`pl-0 font-light ${
            //                                 className === 'mobile-preview'
            //                                     ? 'mt-1 text-xs'
            //                                     : 'mt-2'
            //                             }`}>
            //                             {parseContentWithLinks(del.description)}
            //                         </div>
            //                     </details>
            //                 )
            //             )}
            //         </div>
            //     );

            case 'rubric':
                if (
                    !content.rubricCriteria ||
                    content.rubricCriteria.length === 0
                ) {
                    return (
                        <>
                            <h2
                                className={cn('font-extralight tracking-tight', 'text-3xl mb-6', 'max-sm:text-xl max-sm:mb-3', forceCompact && 'text-xl mb-3')}>
                                Rubric
                            </h2>
                            <p className='font-light text-muted-foreground'>
                                Content not yet added for this section
                            </p>
                        </>
                    );
                }
                const isMobile = forceCompact;
                return (
                    <>
                        <HorizontalScrollHint
                            className='w-full col-span-full'
                            header={
                                <h2
                                    {...passthroughTitleProps(
                                        'rubric',
                                        cn(
                                            'font-extralight tracking-tight',
                                            'text-3xl',
                                            'max-sm:text-xl',
                                            forceCompact && 'text-xl'
                                        )
                                    )}>
                                    Rubric
                                </h2>
                            }
                            headerClassName={cn(
                                forceCompact && 'mb-3'
                            )}>
                            {content.rubricCriteria.map(
                                (
                                    criterion: {
                                        criterion: string;
                                        assessedThrough: string;
                                        weighting: string;
                                        learningOutcomes: number[];
                                        gradeDescriptors: Array<{
                                            grade: string;
                                            description: string;
                                        }>;
                                    },
                                    idx: number
                                ) => {
                                    const criterionNumber = idx + 1;
                                    const criterionWrapperClass = cn(
                                        'w-full border last:mb-0',
                                        '',
                                        ' max-sm:min-w-[600px]',
                                        forceCompact && 'mb-8 min-w-[600px]'
                                    );
                                    const criterionBody = (
                                        <>
                                            <div
                                                className={cn(
                                                    'w-full grid border-b [grid-template-rows:auto_auto]',
                                                    '[grid-template-columns:1.5fr_2.8fr_1.3fr]',
                                                    'max-sm:[grid-template-columns:1.2fr_2.3fr_1fr]',
                                                    forceCompact &&
                                                    '[grid-template-columns:1.2fr_2.3fr_1fr]'
                                                )}>
                                                {/* Criteria column — spans header + body rows */}
                                                <div
                                                    className={cn(
                                                        'row-span-2 brief-rubric-col-header text-left font-extralight border-r border-border bg-card h-full flex items-center',
                                                        'pl-3 py-3 pr-3',
                                                        'max-sm:pl-1.5 max-sm:py-1.5 max-sm:pr-1.5',
                                                        !isViewer && 'text-2xl',
                                                        !isViewer &&
                                                        forceCompact &&
                                                        'text-xs pl-1.5 py-1.5 pr-1.5'
                                                    )}>
                                                    {criterion.learningOutcomes?.length ? (
                                                        <p
                                                            className={cn(
                                                                'font-normal leading-snug',
                                                                !isViewer &&
                                                                    'text-lg max-sm:text-[12px]',
                                                                !isViewer &&
                                                                    forceCompact &&
                                                                    'text-[13px]',
                                                                isViewer &&
                                                                    'text-sm max-sm:text-[11px]',
                                                                forceCompact &&
                                                                    isViewer &&
                                                                    'text-[11px]'
                                                            )}>
                                                            
                                                            <span
                                                                className={cn(
                                                                    'font-extralight leading-snug tracking-tight mb-1',
                                                                    'text-sm max-sm:text-xs',
                                                                    forceCompact && 'text-xs'
                                                                )}>
                                                                <span className='max-sm:hidden'>
                                                                    This criterion
                                                                    assesses learning
                                                                    outcomes:{' '}
                                                                </span>
                                                                <span className='hidden max-sm:inline'>
                                                                    Assesses:{' '}
                                                                </span>
                                                            </span>
                                                            <span className={cn('inline-flex flex-wrap items-center gap-1 align-middle', isMobile && 'text-xs')}>
                                                                {criterion.learningOutcomes.map(
                                                                    (
                                                                        learningOutcome: number,
                                                                        index: number
                                                                    ) => {
                                                                        const lo =
                                                                            content
                                                                                .learningOutcomes?.[
                                                                                learningOutcome
                                                                            ];
                                                                        if (!lo) {
                                                                            return null;
                                                                        }
                                                                        return (
                                                                            <RubricLearningOutcomeBadge
                                                                                key={
                                                                                    index
                                                                                }
                                                                                outcomeIndex={
                                                                                    learningOutcome
                                                                                }
                                                                                title={
                                                                                    lo.title
                                                                                }
                                                                                forceCompact={
                                                                                    forceCompact
                                                                                }
                                                                            />
                                                                        );
                                                                    }
                                                                )}
                                                            </span>
                                                        </p>
                                                    ) : !isViewer ? (
                                                        <span>Criteria</span>
                                                    ) : null}
                                                </div>
                                                <div
                                                    className={cn(
                                                        'brief-rubric-col-header text-left font-extralight border-r border-b border-border bg-card h-full flex items-center',
                                                        'pl-3 py-3 pr-3',
                                                        'max-sm:pl-1.5 max-sm:py-1.5 max-sm:pr-1.5',
                                                        !isViewer && 'text-2xl',
                                                        !isViewer &&
                                                        forceCompact &&
                                                        'text-xs pl-1.5 py-1.5 pr-1.5'
                                                    )}>
                                                    Assessed Through
                                                </div>
                                                <div
                                                    className={cn(
                                                        'brief-rubric-col-header text-left font-extralight border-b border-border bg-card h-full flex items-center',
                                                        'pl-3 py-3 pr-0',
                                                        'max-sm:pl-1.5 max-sm:py-1.5 max-sm:pr-0',
                                                        !isViewer && 'text-2xl',
                                                        !isViewer &&
                                                        forceCompact &&
                                                        'text-xs pl-1.5 py-1.5 pr-0'
                                                    )}>
                                                    Weighting %
                                                </div>

                                                {/* Body Row */}
                                                <div
                                                    className={cn(
                                                        'brief-rubric-col-body brief-rubric-col-body--assessed border-r border-border font-normal h-full flex',
                                                        'pl-3 py-3 pr-3',
                                                        'max-sm:pl-1.5 max-sm:py-1.5 max-sm:pr-1.5',
                                                        !isViewer && 'text-sm max-sm:text-[11px]',
                                                        !isViewer &&
                                                        forceCompact &&
                                                        'text-[13px] pl-1.5 py-1.5 pr-1.5'
                                                    )}>
                                                    {criterion.assessedThrough}
                                                </div>
                                                <div
                                                    className={cn(
                                                        'brief-rubric-weighting font-extralight tabular-nums text-center slashed-zero-nums h-full flex',
                                                        'pl-3 py-3 pr-0',
                                                        'max-sm:pl-1.5 max-sm:py-1.5 max-sm:pr-0',
                                                        !isViewer && 'text-3xl max-sm:text-base',
                                                        !isViewer &&
                                                        forceCompact &&
                                                        'text-[15px] pl-1.5 py-1.5 pr-0'
                                                    )}>
                                                    {criterion.weighting}
                                                </div>
                                            </div>
                                            <table className='w-full min-w-full'>
                                                <thead>
                                                    <tr className='border-b'>
                                                        <th
                                                            className={cn(
                                                                'text-left border-r font-medium',
                                                                'p-3 w-20',
                                                                'max-sm:p-1.5 max-sm:text-xs max-sm:w-16',
                                                                forceCompact &&
                                                                'p-1.5 text-xs w-16'
                                                            )}>
                                                            Grade
                                                        </th>
                                                        <th
                                                            className={cn('text-left', cn('p-3', 'max-sm:p-1.5 max-sm:text-xs', forceCompact && 'p-1.5 text-xs'), 'font-medium')}>
                                                            Descriptor
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {criterion.gradeDescriptors?.map(
                                                        (
                                                            grade: {
                                                                grade: string;
                                                                description: string;
                                                            },
                                                            gIdx: number
                                                        ) => (
                                                            <tr
                                                                key={gIdx}
                                                                className='border-b last:border-0'>
                                                                <td
                                                                    className={cn('border-r font-normal', 'p-3', 'max-sm:p-1.5 max-sm:text-xs', forceCompact && 'p-1.5 text-xs')}>
                                                                    {grade.grade}
                                                                </td>
                                                                <td
                                                                    className={cn('font-light', 'p-3', 'max-sm:p-1.5 max-sm:text-xs', forceCompact && 'p-1.5 text-xs')}>
                                                                    {parseContentWithLinks(
                                                                        grade.description
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </>
                                    );

                                    if (isViewer) {
                                        return (
                                            <details
                                                key={idx}
                                                {...focusChunkProps(
                                                    `rubric--criterion-${idx}`,
                                                    cn(
                                                        'group',
                                                        !forceCompact &&
                                                            'open:mb-6 max-sm:open:mb-4',
                                                        criterionWrapperClass
                                                    )
                                                )}
                                            >
                                                {/* second row  onwards should not have a border-t*/}
                                                <summary className={cn('hover:text-brand flex cursor-pointer select-none list-none items-center justify-between gap-3 border-b bg-card px-3 py-3 max-sm:gap-2 max-sm:px-2 max-sm:py-2 [&::-webkit-details-marker]:hidden', idx > 0 && '-mt-1 border-t')}>
                                                    <div className='flex min-w-0 flex-1 items-center gap-3 max-sm:gap-2'>
                                                        <RubricCriterionNumberBadge
                                                            number={criterionNumber}
                                                            forceCompact={
                                                                forceCompact
                                                            }
                                                        />
                                                        <span
                                                            className={cn(
                                                                'min-w-0 font-normal line-clamp-2',
                                                                'text-lg max-sm:text-sm',
                                                                forceCompact &&
                                                                'text-sm'
                                                            )}>
                                                            {criterion.criterion}
                                                        </span>
                                                    </div>
                                                    <div className='flex shrink-0 items-center gap-3 max-sm:gap-2'>
                                                        {criterion.weighting ? (
                                                            <span
                                                                className={cn(
                                                                    'font-extralight tabular-nums slashed-zero-nums group-open:hidden',
                                                                    'text-2xl max-sm:text-lg',
                                                                    forceCompact &&
                                                                    'text-lg'
                                                                )}>
                                                                {
                                                                    criterion.weighting
                                                                }
                                                                %
                                                            </span>
                                                        ) : null}
                                                        <span
                                                            className='font-thin text-2xl max-sm:text-lg'
                                                            aria-hidden='true'>
                                                            <span className='group-open:hidden'>
                                                                +
                                                            </span>
                                                            <span className='hidden group-open:inline'>
                                                                –
                                                            </span>
                                                        </span>
                                                    </div>
                                                </summary>
                                                {criterionBody}
                                            </details>
                                        );
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            {...focusChunkProps(
                                                `rubric--criterion-${idx}`,
                                                criterionWrapperClass
                                            )}>
                                            {criterionBody}
                                        </div>
                                    );
                                }
                            )}
                        </HorizontalScrollHint>
                    </>
                );

            case 'one-page-summary':
                const hasOnePageContent =
                    content.onePageSummaryContent &&
                    Object.keys(content.onePageSummaryContent).length > 0;

                if (!hasOnePageContent) {
                    return (
                        <>
                            <h2
                                className={cn('font-extralight tracking-tight', 'text-3xl mb-6', 'max-sm:text-xl max-sm:mb-3', forceCompact && 'text-xl mb-3')}>
                                One Page Summary
                            </h2>
                            <p
                                className={cn('font-light text-muted-foreground', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                Content not yet added for this section
                            </p>
                        </>
                    );
                }
                return (
                    <div data-section-id='one-page-summary'>
                        <h2
                            {...passthroughTitleProps(
                                'one-page-summary',
                                cn(
                                    'font-extralight tracking-tight',
                                    'text-3xl mb-6',
                                    'max-sm:text-xl max-sm:mb-2',
                                    forceCompact && 'text-xl mb-2'
                                )
                            )}>
                            One Page Summary
                        </h2>

                        <div className='grid grid-cols-1 md:grid-cols-[15rem_1fr] border'>
                            {content.onePageSummaryContent &&
                                Object.entries(
                                    content.onePageSummaryContent
                                ).map(([key, value]) => (
                                    <Fragment key={key}>
                                        <div className='md:border-r border-b'>
                                            <div
                                                className={cn('font-normal h-full flex flex-col justify-between', 'p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                                <p>{key}</p>
                                            </div>
                                        </div>
                                        <div
                                            {...focusChunkProps(
                                                `one-page-summary--${key}`,
                                                'col-span-1 border-b'
                                            )}>
                                            <div
                                                className={cn('p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                                <div
                                                    className={cn('font-light leading-relaxed', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                                    {parseContentWithLinks(
                                                        value as string
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Fragment>
                                ))}
                        </div>
                        {/* <div
                            className={
                                cn('space-y-4', 'max-sm:space-y-2', forceCompact && 'space-y-2')
                            }>
                            {Object.entries(
                                content.onePageSummaryContent || {}
                            ).map(([key, value]) => (
                                <div
                                    key={key}
                                    className={cn('border-b last:border-0', 'pb-4', 'max-sm:pb-2', forceCompact && 'pb-2')}>
                                    <h4
                                        className={cn('font-normal capitalize', 'mb-2', 'max-sm:mb-1 max-sm:text-xs', forceCompact && 'mb-1 text-xs')}>
                                        {content.subheadings?.[key] ||
                                            key.replace(/-/g, ' ')}
                                    </h4>
                                    <p
                                        className={cn('font-light', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                        {value as string}
                                    </p>
                                </div>
                            ))}
                           
                        </div> */}
                    </div>
                );

            case 'schedule': {
                const views = content.scheduleViews || {
                    table: true,
                    gantt: false
                };
                const phases = Array.isArray(content.schedulePhases)
                    ? content.schedulePhases
                    : [];
                const hasScheduleContent = phases.length > 0;
                const now = new Date();
                const assignmentStart = new Date(metadata.startDate);
                const assignmentEnd = new Date(metadata.submissionDate);
                const assignmentDurationMs = Math.max(
                    assignmentEnd.getTime() - assignmentStart.getTime(),
                    1
                );
                const elapsedMs = Math.min(
                    Math.max(now.getTime() - assignmentStart.getTime(), 0),
                    assignmentDurationMs
                );
                const assignmentProgressPct = Math.round(
                    (elapsedMs / assignmentDurationMs) * 100
                );
                const totalWeeks = Math.max(
                    1,
                    Math.ceil(assignmentDurationMs / (1000 * 60 * 60 * 24 * 7))
                );
                const currentWeek = Math.min(
                    totalWeeks,
                    Math.max(
                        1,
                        Math.ceil(
                            (now.getTime() - assignmentStart.getTime()) /
                            (1000 * 60 * 60 * 24 * 7)
                        )
                    )
                );
                const currentPhaseIndex = phases.findIndex(
                    (phase: {
                        timingMode?: 'date' | 'weeks';
                        startDate?: string;
                        endDate?: string;
                        weekStart?: number;
                        weekEnd?: number;
                    }) => {
                        if (phase.timingMode === 'weeks') {
                            const start = Number(phase.weekStart || 1);
                            const end = Number(phase.weekEnd || start);
                            return currentWeek >= start && currentWeek <= end;
                        }
                        if (!phase.startDate || !phase.endDate) return false;
                        const phaseStart = new Date(phase.startDate);
                        const phaseEnd = new Date(phase.endDate);
                        return now >= phaseStart && now <= phaseEnd;
                    }
                );
                const currentPhase =
                    currentPhaseIndex >= 0 ? phases[currentPhaseIndex] : null;
                const currentPhaseLabel = currentPhase
                    ? currentPhase.title || `Phase ${currentPhaseIndex + 1}`
                    : 'No active phase right now';

                if (!hasScheduleContent) {
                    return (
                        <>
                            <h2
                                className={cn('font-extralight tracking-tight', 'text-3xl mb-6', 'max-sm:text-xl max-sm:mb-3', forceCompact && 'text-xl mb-3')}>
                                Schedule
                            </h2>
                            <p
                                className={cn('font-light text-muted-foreground', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                Content not yet added for this section
                            </p>
                        </>
                    );
                }

                const scheduleRowClass =
                    'grid grid-cols-1 md:grid-cols-[15rem_1fr] border-b last:border-b-0';

                return (
                    <div data-section-id='schedule'>
                        <div className='flex items-center justify-between'>
                            <h2
                                {...passthroughTitleProps(
                                    'schedule',
                                    cn(
                                        'font-extralight tracking-tight',
                                        'text-3xl mb-6',
                                        'max-sm:text-xl max-sm:mb-2',
                                        forceCompact && 'text-xl mb-2'
                                    )
                                )}>
                                Schedule
                            </h2>
                        </div>
                        <div
                            {...focusChunkProps(
                                'schedule--progress',
                                cn(
                                    'border rounded-none bg-muted/20',
                                    'mb-5 p-4',
                                    'max-sm:mb-3 max-sm:p-2.5',
                                    forceCompact && 'mb-3 p-2.5'
                                )
                            )}>
                            <div className='flex items-center gap-2 flex-wrap mb-2'>
                                <span className='text-xs font-light text-muted-foreground'>
                                    Current phase
                                </span>
                                <span className='inline-flex items-center rounded-none bg-[#B0CFC7] px-2 py-0.5 text-xs font-normal text-[#134F47]'>
                                    {currentPhaseLabel}
                                </span>
                            </div>
                            <div className='w-full h-2 rounded-none bg-muted overflow-hidden'>
                                <div
                                    className='h-full transition-all duration-300'
                                    style={{
                                        width: `${assignmentProgressPct}%`,
                                        ...SCHEDULE_ASSIGNMENT_PROGRESS_FILL
                                    }}
                                />
                            </div>
                            <p
                                className={cn('font-light text-muted-foreground mt-2', 'text-xs', 'max-sm:text-[10px]', forceCompact && 'text-[10px]')}>
                                Assignment progress: {assignmentProgressPct}%
                                complete (currently in week {currentWeek} of{' '}
                                {totalWeeks}).
                            </p>
                        </div>
                        {views.table !== false && (
                            <div className='border mb-5 max-sm:mb-3'>
                                {phases.map(
                                    (
                                        phase: {
                                            title?: string;
                                            timingMode?: 'date' | 'weeks';
                                            startDate?: string;
                                            endDate?: string;
                                            weekStart?: number;
                                            weekEnd?: number;
                                            instructions?: string;
                                        },
                                        idx: number
                                    ) => {
                                        const timingLabel =
                                            phase.timingMode === 'weeks' ? (
                                                `Weeks ${phase.weekStart || 1}-${phase.weekEnd || 1}`
                                            ) : (
                                                <>
                                                    {phase.startDate ? (
                                                        <PreviewDate
                                                            date={
                                                                phase.startDate
                                                            }
                                                            forceCompact={
                                                                forceCompact
                                                            }
                                                        />
                                                    ) : (
                                                        'Start TBD'
                                                    )}
                                                    {' - '}
                                                    {phase.endDate ? (
                                                        <PreviewDate
                                                            date={phase.endDate}
                                                            forceCompact={
                                                                forceCompact
                                                            }
                                                        />
                                                    ) : (
                                                        'End TBD'
                                                    )}
                                                </>
                                            );

                                        return (
                                            <div
                                                key={idx}
                                                {...focusChunkProps(
                                                    `schedule--phase-${idx}`,
                                                    scheduleRowClass
                                                )}>
                                                <div className='md:border-r'>
                                                    <div
                                                        className={cn('font-normal h-full flex flex-col justify-between', 'p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                                        <p>
                                                            {phase.title ||
                                                                `Phase ${idx + 1}`}
                                                        </p>
                                                        <p className='text-xs font-light text-muted-foreground mt-2'>
                                                            {timingLabel}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div
                                                    className={cn('p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                                    <div
                                                        className={cn('font-light leading-relaxed', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                                        {parseContentWithLinks(
                                                            phase.instructions
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        )}
                        {views.gantt ? (
                            <div {...focusChunkProps('schedule--gantt')}>
                                <ScheduleGantt
                                    phases={phases}
                                    assignmentStart={assignmentStart}
                                    assignmentEnd={assignmentEnd}
                                    now={now}
                                    compact={forceCompact}
                                    layout={forceCompact ? 'mobile' : 'responsive'}
                                />
                            </div>
                        ) : null}
                    </div>
                );
            }

            case 'submission-form':
                if (
                    !content.submissionFormFields ||
                    content.submissionFormFields.length === 0
                ) {
                    return (
                        <>
                            <h2
                                className={cn('font-extralight tracking-tight', 'text-3xl mb-6', 'max-sm:text-xl max-sm:mb-3', forceCompact && 'text-xl mb-3')}>
                                Submission Form
                            </h2>
                            <p
                                className={cn('font-light text-muted-foreground', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                Content not yet added for this section
                            </p>
                        </>
                    );
                }

                return (
                    <>
                        <h2
                            {...passthroughTitleProps(
                                'submission-form',
                                cn(
                                    'font-extralight tracking-tight',
                                    'text-3xl mb-6',
                                    'max-sm:text-xl max-sm:mb-2',
                                    forceCompact && 'text-xl mb-2'
                                )
                            )}>
                            Submission Form
                        </h2>
                        <div
                            id='printable-submission-form'
                            {...focusChunkProps(
                                'submission-form--content',
                                'grid grid-cols-1 border md:grid-cols-[15rem_1fr]'
                            )}>
                            {content.submissionFormFields.map(
                                (
                                    field: {
                                        title: string;
                                        description?: string;
                                        placeholder?: string;
                                        optionalDescription?: string;
                                    },
                                    idx: number
                                ) => {
                                    const fieldKey = `submission-field-${idx}-${field.title}`;
                                    const isDeclarationField =
                                        field.title.trim().toLowerCase() ===
                                        'declaration';
                                    const placeholderText =
                                        field.placeholder ||
                                        field.description ||
                                        '';
                                    const helperDescription = (
                                        field.optionalDescription || ''
                                    ).replaceAll(
                                        '[INSERT_PROGRAMME]',
                                        metadata.programmeName || 'the programme'
                                    );
                                    return (
                                        <Fragment key={idx}>
                                            <div className='border-b md:border-r'>
                                                <div
                                                    className={cn('flex h-full flex-col justify-between', 'p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                                    <label
                                                        className={cn('font-normal block', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                                        {field.title}
                                                    </label>
                                                    <div
                                                        className={cn('font-light text-muted-foreground', 'text-xs mt-3 leading-relaxed', 'max-sm:text-[10px] max-sm:mt-2', forceCompact && 'text-[10px] mt-2')}>
                                                        {isDeclarationField
                                                            ? ''
                                                            : parseContentWithLinks(
                                                                placeholderText
                                                            )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className='border-b'>
                                                <div
                                                    className={cn('p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                                    {helperDescription && (
                                                        <div
                                                            className={cn('font-light text-muted-foreground', 'mb-2 text-xs leading-relaxed', 'max-sm:mb-1.5 max-sm:text-[10px] max-sm:leading-tight', forceCompact && 'mb-1.5 text-[10px] leading-tight')}>
                                                            {parseContentWithLinks(
                                                                helperDescription
                                                            )}
                                                        </div>
                                                    )}
                                                    {!isDeclarationField && (
                                                        <input
                                                            type='text'
                                                            value={
                                                                submissionFormValues[
                                                                fieldKey
                                                                ] || ''
                                                            }
                                                            onChange={(e) =>
                                                                handleSubmissionFormChange(
                                                                    fieldKey,
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            className={cn('w-full border rounded-none bg-card', 'px-3 py-2', 'max-sm:px-2 max-sm:py-1.5 max-sm:text-xs', forceCompact && 'px-2 py-1.5 text-xs')}
                                                            placeholder=''
                                                        />
                                                    )}
                                                    {isDeclarationField && (
                                                        <div className='mt-2 flex items-center gap-2'>
                                                            <span className='font-normal text-xs'>
                                                                Signed:
                                                            </span>
                                                            <input
                                                                type='text'
                                                                value={
                                                                    submissionFormValues[
                                                                    `${fieldKey}-signed`
                                                                    ] || ''
                                                                }
                                                                onChange={(e) =>
                                                                    handleSubmissionFormChange(
                                                                        `${fieldKey}-signed`,
                                                                        e.target
                                                                            .value
                                                                    )
                                                                }
                                                                className={cn('flex-1 border rounded-none bg-card', 'px-3 py-2', 'max-sm:px-2 max-sm:py-1.5 max-sm:text-xs', forceCompact && 'px-2 py-1.5 text-xs')}
                                                                placeholder=''
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Fragment>
                                    );
                                }
                            )}
                        </div>
                        {renderSubmissionFormActionBar({
                            showSelfAssessment:
                                selfAssessmentLinkBesideSubmissionForm
                        })}
                    </>
                );

            case 'submission-checklist':
                if (
                    !content ||
                    !content.checklistItems ||
                    content.checklistItems.length === 0
                ) {
                    return (
                        <>
                            <p
                                className={cn('font-light text-muted-foreground', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                Content not yet added for this section
                            </p>
                        </>
                    );
                }
                return (
                    <>
                        <div className='flex items-center justify-between'>
                            <h2
                                {...passthroughTitleProps(
                                    'submission-checklist',
                                    cn(
                                        'font-extralight tracking-tight',
                                        'text-3xl mb-6',
                                        'max-sm:text-xl max-sm:mb-2',
                                        forceCompact && 'text-xl mb-2'
                                    )
                                )}>
                                Submission Checklist
                            </h2>
                        </div>
                        <div
                            id='printable-checklist'
                            className={cn('border', 'p-4', 'max-sm:p-3', forceCompact && 'p-3')}>
                            <div className='flex items-center align-middle justify-between print:hidden'></div>
                            <ul
                                className={
                                    cn('space-y-2', 'max-sm:space-y-1.5', forceCompact && 'space-y-1.5')
                                }>
                                {content.checklistItems.map(
                                    (item: string, idx: number) => {
                                        const itemKey = `checklist-${idx}-${item}`;
                                        return (
                                            <li
                                                key={idx}
                                                {...focusChunkProps(
                                                    `submission-checklist--item-${idx}`,
                                                    cn(
                                                        'font-light border-b border-dashed custom-checkbox-wrapper',
                                                        'pb-2',
                                                        'max-sm:text-xs max-sm:pb-1.5',
                                                        forceCompact &&
                                                            'text-xs pb-1.5'
                                                    )
                                                )}>
                                                <label className='custom-checkbox-label'>
                                                    <input
                                                        type='checkbox'
                                                        checked={
                                                            checkedItems[
                                                            itemKey
                                                            ] || false
                                                        }
                                                        onChange={() =>
                                                            handleCheckboxChange(
                                                                itemKey
                                                            )
                                                        }
                                                        className='custom-checkbox-input'
                                                    />
                                                    <span className='custom-checkbox-text'>
                                                        {item}
                                                    </span>
                                                </label>
                                            </li>
                                        );
                                    }
                                )}
                            </ul>
                        </div>
                    </>
                );

            case 'how-work-is-marked':
                if (
                    !content.howWorkMarked ||
                    content.howWorkMarked.length === 0
                ) {
                    return (
                        <>
                            <h2
                                className={cn('font-extralight tracking-tight', 'text-3xl mb-6', 'max-sm:text-xl max-sm:mb-3', forceCompact && 'text-xl mb-3')}>
                                How Work is Marked
                            </h2>
                            <p
                                className={cn('font-light text-muted-foreground', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                Content not yet added for this section
                            </p>
                        </>
                    );
                }
                return (
                    <div data-section-id='how-work-marked'>
                        <h2
                            className={cn('font-extralight tracking-tight', 'text-3xl mb-6', 'max-sm:text-xl max-sm:mb-2', forceCompact && 'text-xl mb-2')}>
                            How Work is Marked
                        </h2>
                        <div className='grid grid-cols-1 md:grid-cols-[15rem_1fr] border'>
                            {content.howWorkMarked.map(
                                (
                                    item: {
                                        title: string;
                                        description: string;
                                    },
                                    idx: number
                                ) => (
                                    <Fragment key={idx}>
                                        <div className='md:border-r border-b'>
                                            <div
                                                className={cn('font-normal h-full flex flex-col justify-between', 'p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                                <p>{item.title}</p>
                                            </div>
                                        </div>
                                        <div className='col-span-1 border-b'>
                                            <div
                                                className={cn('p-4 sm:py-4 sm:px-4', 'max-sm:py-2 max-sm:px-3', forceCompact && 'py-2 px-3')}>
                                                <div
                                                    className={cn('font-light leading-relaxed', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                                                    {parseContentWithLinks(
                                                        item.description
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Fragment>
                                )
                            )}
                        </div>
                    </div>
                );

            case 'ai-policy':
                return (
                    <BriefAiPolicyPreview
                        content={content}
                        aiPolicyDocument={aiPolicyDocument}
                        forceCompact={forceCompact}
                        showUsageLogLink={showAiUsageLogLink}
                        viewerSlug={effectiveViewerSlug}
                    />
                );

            case 'faq': {
                const faqItems = parseFaqItems(content);
                const visibleFaqItems = getVisibleFaqItems(faqItems);

                if (!hasFaqContent(faqItems)) {
                    return (
                        <>
                            <h2
                                className={cn(
                                    'font-extralight tracking-tight',
                                    'text-3xl mb-6',
                                    'max-sm:text-xl max-sm:mb-3',
                                    forceCompact && 'text-xl mb-3'
                                )}>
                                Frequently Asked Questions
                            </h2>
                            <p
                                className={cn(
                                    'font-light text-muted-foreground',
                                    '',
                                    'max-sm:text-xs',
                                    forceCompact && 'text-xs'
                                )}>
                                Content not yet added for this section
                            </p>
                        </>
                    );
                }

                return (
                    <div data-section-id='faq'>
                        <h2
                            {...passthroughTitleProps(
                                'faq',
                                cn(
                                    'font-extralight tracking-tight',
                                    'text-3xl mb-6',
                                    'max-sm:text-xl max-sm:mb-3',
                                    forceCompact && 'text-xl mb-3'
                                )
                            )}>
                            Frequently Asked Questions
                        </h2>
                        <div className='border'>
                            {visibleFaqItems.map((item, idx) => (
                                <details
                                    key={idx}
                                    {...focusChunkProps(
                                        `faq--item-${idx}`,
                                        cn(
                                            'group border-b last:border-b-0',
                                            'p-4 sm:pb-4 sm:px-4',
                                            'max-sm:py-2 max-sm:px-3',
                                            forceCompact && 'py-2 px-3'
                                        )
                                    )}>
                                    <summary
                                        className={cn(
                                            'flex justify-between items-start gap-2 cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5 hover:text-brand dark:hover:text-brand',
                                            '',
                                            'max-sm:text-xs',
                                            forceCompact && 'text-xs'
                                        )}>
                                        <span>{item.question}</span>
                                        <span
                                            className={cn(
                                                'font-thin flex-shrink-0 transition-all',
                                                'text-2xl',
                                                'max-sm:text-lg',
                                                forceCompact && 'text-lg'
                                            )}
                                            aria-hidden='true'>
                                            <span className='group-open:hidden'>
                                                +
                                            </span>
                                            <span className='hidden group-open:inline'>
                                                –
                                            </span>
                                        </span>
                                    </summary>
                                    <div
                                        className={cn(
                                            'font-light leading-relaxed',
                                            'mt-2',
                                            'max-sm:mt-1 max-sm:text-xs',
                                            forceCompact && 'mt-1 text-xs'
                                        )}>
                                        {parseContentWithLinks(item.answer)}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                );
            }

            default:
                return (
                    <p
                        className={cn('font-light text-muted-foreground', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                        Content not yet added for this section
                    </p>
                );
        }
    };

    const hasSubmissionFormInPreview = enabledSections.some(
        (section) => section.id === 'submission-form'
    );

    useBriefSectionTracking({
        viewerSlug: viewerSlug ?? '',
        sectionIds: enabledSectionIds,
        contentRootRef,
        metadataRef,
        sectionRefs,
        enabled: isViewer && Boolean(viewerSlug) && trackEngagement
    });

    const renderSelfAssessmentLinkButton = () =>
        showSelfAssessmentLink ? (
            <Button
                variant='outline'
                asChild
                size='sm'
                className={cn(
                    'cursor-pointer',
                    '',
                    'max-sm:text-xs max-sm:px-1.5',
                    forceCompact && 'text-xs px-1.5'
                )}>
                <Link
                    href={`/briefs/viewer/${effectiveViewerSlug}/self-assessment`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1.5'>
                    <ExternalLink
                        className={cn(
                            'h-3.5 w-3.5 shrink-0 opacity-70',
                            'max-sm:h-2.5 max-sm:w-2.5',
                            forceCompact && 'h-2.5 w-2.5'
                        )}
                        aria-hidden
                    />
                    <span className='hidden sm:inline'>
                        Student Self-Assessment Form
                    </span>
                    <span className='sm:hidden'>Self-Assessment</span>
                </Link>
            </Button>
        ) : null;

    const renderSubmissionFormActionBar = (options: {
        showSelfAssessment?: boolean;
    }) => {
        const showSelfAssessment = options.showSelfAssessment ?? false;
        if (!showSelfAssessment) {
            return null;
        }

        return (
            <div
                className={cn(
                    'flex flex-wrap items-center justify-end gap-2',
                    'mt-3',
                    'max-sm:mt-2',
                    forceCompact && 'mt-2'
                )}>
                {renderSelfAssessmentLinkButton()}
            </div>
        );
    };

    const submissionFormHasFields = Boolean(
        content?.submissionFormFields?.length
    );
    const selfAssessmentLinkBesideSubmissionForm =
        !isViewer &&
        showSelfAssessmentLink &&
        hasSubmissionFormInPreview &&
        submissionFormHasFields;

    const renderStandaloneSelfAssessmentLink = () =>
        showSelfAssessmentLink &&
        !selfAssessmentLinkBesideSubmissionForm &&
        !isViewer ? (
            <section
                id='self-assessment-link'
                className={cn(
                    'border-t border-foreground/20',
                    isViewer && viewerScrollMarginClass,
                    'pt-4',
                    'max-sm:pt-3',
                    forceCompact && 'pt-3'
                )}>
                <div className='flex flex-wrap items-center justify-end gap-2'>
                    {renderSelfAssessmentLinkButton()}
                </div>
            </section>
        ) : null;

    useEffect(() => {
        const setTocEntries = viewerContext?.setTocEntries;
        if (!isViewer || !setTocEntries) {
            return;
        }

        const syncToc = () => {
            setTocEntries([
                {
                    id: 'brief-metadata',
                    label: 'Assignment details'
                },
                ...displaySections.map((section) => {
                    const sectionElement = sectionRefs.current[section.id];
                    const heading =
                        sectionElement
                            ?.querySelector('h2')
                            ?.textContent?.trim() || section.label;

                    return {
                        id: section.id,
                        label: heading
                    };
                })
            ]);
        };

        syncToc();
        const frame = requestAnimationFrame(syncToc);

        return () => {
            cancelAnimationFrame(frame);
            setTocEntries([]);
        };
    }, [isViewer, viewerContext?.setTocEntries, displaySections, content]);

    const registerScrollToBriefSection =
        viewerContext?.registerScrollToBriefSection;
    const scrollToBriefSection = viewerContext?.scrollToBriefSection;
    const initialScrollDoneRef = useRef(false);

    useEffect(() => {
        if (!isViewer || !registerScrollToBriefSection) {
            return;
        }

        registerScrollToBriefSection((sectionId: string) => {
            const sectionElement =
                sectionId === 'brief-metadata'
                    ? metadataRef.current
                    : sectionRefs.current[sectionId] ??
                    document.getElementById(sectionId);

            if (!sectionElement) {
                return;
            }

            const scrollOffset = 80;

            const top =
                window.scrollY +
                sectionElement.getBoundingClientRect().top -
                scrollOffset;

            window.scrollTo({
                top: Math.max(0, top),
                behavior: 'smooth'
            });
        });

        return () => {
            registerScrollToBriefSection(() => { });
        };
    }, [isViewer, registerScrollToBriefSection]);

    useEffect(() => {
        if (
            !isViewer ||
            !initialScrollSectionId ||
            !scrollToBriefSection ||
            initialScrollDoneRef.current
        ) {
            return;
        }

        let attempts = 0;
        let frame = 0;

        const tryScroll = () => {
            const sectionElement =
                initialScrollSectionId === 'brief-metadata'
                    ? metadataRef.current
                    : sectionRefs.current[initialScrollSectionId] ??
                      document.getElementById(initialScrollSectionId);

            if (sectionElement) {
                scrollToBriefSection(initialScrollSectionId);
                initialScrollDoneRef.current = true;
                return;
            }

            attempts += 1;
            if (attempts < 12) {
                frame = requestAnimationFrame(tryScroll);
            }
        };

        frame = requestAnimationFrame(tryScroll);

        return () => {
            cancelAnimationFrame(frame);
        };
    }, [
        isViewer,
        initialScrollSectionId,
        scrollToBriefSection,
        displaySections
    ]);

    const viewerScrollMarginClass = isViewer ? 'scroll-mt-20 max-sm:scroll-mt-16' : '';

    const fontSizeScale = FONT_SIZE_SCALES[fontSize];

    return (
        <div
            ref={contentRootRef}
            className={cn(
                'print:!p-0',
                isInsightsPage ? 'p-0' : 'p-8',
                showSelfAssessmentLink && 'pb-6 max-sm:pb-6',
                isViewer ? 'max-sm:p-0' : 'max-sm:p-3',
                !isViewer && forceCompact && 'p-3',
                className,
                'brief-preview font-size-scalable bg-card'
            )}
            style={
                {
                    '--font-scale': fontSizeScale,
                    fontSize: `${fontSizeScale * 100}%`
                } as React.CSSProperties & { '--font-scale': number }
            }>
            {/* Header with title and display settings */}
            <div
                className={cn('relative flex items-center justify-between', 'pb-6', 'max-sm:pb-4', forceCompact && 'pb-4')}>
                <h1
                    className={cn(
                        'min-w-0 font-extralight tracking-tight',
                        'text-4xl',
                        'max-sm:text-2xl',
                        forceCompact && 'text-2xl'
                    )}>
                    Assessment Brief
                </h1>
                {!isViewer ? (
                    <div className='flex flex-wrap items-center justify-end gap-2'>
                        {/* Display Settings */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    className={cn('gap-2', 'h-9', 'max-sm:text-xs max-sm:h-7 max-sm:px-2', forceCompact && 'text-xs h-7 px-2')}>
                                    <Settings2
                                        className={
                                            cn('h-4 w-4', 'max-sm:h-3 max-sm:w-3', forceCompact && 'h-3 w-3')
                                        }
                                    />
                                    <span
                                        className={
                                            'hidden sm:inline'
                                        }>
                                        Display
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                                <DropdownMenuRadioGroup
                                    value={fontSize}
                                    onValueChange={(value) =>
                                        setLocalFontSize(value as FontSize)
                                    }>
                                    <DropdownMenuRadioItem value='normal'>
                                        Medium
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value='big'>
                                        Big
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value='bigger'>
                                        Bigger
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ) : null}
            </div>

            {/* Programme and module details at the top */}
            <div
                id={BRIEF_METADATA_FOCUS_ID}
                ref={metadataRef}
                className={cn(
                    'border',
                    'mb-8',
                    'max-sm:mb-4',
                    forceCompact && 'mb-4',
                    viewerScrollMarginClass,
                    getFocusBlockClass(BRIEF_METADATA_FOCUS_ID)
                )}>
                <div className='grid grid-cols-1 md:grid-cols-[200px_1fr] border-b'>
                    <div
                        className={cn('md:border-r font-normal', 'p-4', 'max-sm:px-3 max-sm:py-2 max-sm:text-xs', forceCompact && 'px-3 py-2 text-xs')}>
                        Programme
                    </div>
                    <div
                        className={cn('md:pt-4 pt-0 font-light', 'p-4', 'max-sm:px-3 max-sm:py-2 max-sm:text-xs', forceCompact && 'px-3 py-2 text-xs')}>
                        {metadata.programmeName}
                    </div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-[200px_1fr] border-b'>
                    <div
                        className={cn('md:border-r font-normal', 'p-4', 'max-sm:px-3 max-sm:py-2 max-sm:text-xs', forceCompact && 'px-3 py-2 text-xs')}>
                        Module
                    </div>
                    <div
                        className={cn('md:pt-4 pt-0 font-light', 'p-4', 'max-sm:px-3 max-sm:py-2 max-sm:text-xs', forceCompact && 'px-3 py-2 text-xs')}>
                        {metadata.module}
                    </div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-[200px_1fr] border-b'>
                    <div
                        className={cn('md:border-r font-normal', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        Assignment title
                    </div>
                    <div
                        className={cn('md:pt-4 pt-0 font-light', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        {metadata.title}
                    </div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-[200px_1fr] border-b'>
                    <div
                        className={cn('md:border-r font-normal', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        Lecturer(s)
                    </div>
                    <div
                        className={cn('md:pt-4 pt-0 font-light', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        {metadata.lecturer.split('\n').map((name, index) => (
                            <span key={index}>
                                {name}
                                {index <
                                    metadata.lecturer.split('\n').length - 1 &&
                                    ', '}
                            </span>
                        ))}
                    </div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-[200px_1fr] border-b'>
                    <div
                        className={cn('md:border-r font-normal', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        Start date
                    </div>
                    <div
                        className={cn('md:pt-4 pt-0 font-light', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        <PreviewDate date={metadata.startDate} />
                    </div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-[200px_1fr] border-b'>
                    <div
                        className={cn('md:border-r font-normal', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        Submission date
                    </div>
                    <div
                        className={cn('md:pt-4 pt-0 font-light', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        <PreviewDate date={metadata.submissionDate} />
                    </div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-[200px_1fr]'>
                    <div
                        className={cn('md:border-r font-normal', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        Individual / group
                    </div>
                    <div
                        className={cn('md:pt-4 pt-0 font-light', 'p-4', 'max-sm:p-2 max-sm:text-xs', forceCompact && 'p-2 text-xs')}>
                        {metadata.individualGroup}
                    </div>
                </div>
            </div>

            {/* Sections in order */}
            {displaySections.length === 0 ? (
                <>
                    <div
                        className={cn('text-center border-2 border-dashed rounded-none', 'mt-8 py-12', 'max-sm:mt-3 max-sm:py-4', forceCompact && 'mt-3 py-4')}>
                        <p
                            className={cn('text-muted-foreground font-light', '', 'max-sm:text-xs', forceCompact && 'text-xs')}>
                            Enable sections to see the preview
                        </p>
                    </div>
                    <BriefInstitutionalFooter
                        policy={resolvedInstitutionalPolicy}
                        compact={forceCompact}
                        actions={
                            isViewer && showSelfAssessmentLink
                                ? renderSelfAssessmentLinkButton()
                                : undefined
                        }
                    />
                </>
            ) : (
                <div
                    className={cn('space-y-8', 'max-sm:space-y-3', forceCompact && 'space-y-3')}>
                    {/*
                        getSectionFocusProps reads sectionRefs.current to
                        compute this render's focus styling from the last
                        committed DOM measurement — a deliberate one-commit-
                        stale read (correct pattern, see the ref callback
                        just below that populates sectionRefs on commit),
                        not a bug. Restructuring this cross-cutting focus-
                        mode hook is out of scope for this lint cleanup.
                    */}
                    {/* eslint-disable-next-line react-hooks/refs */}
                    {displaySections.map((section) => {
                        const sectionFocusProps = getSectionFocusProps(
                            section.id
                        );

                        return (
                            <section
                                key={section.id}
                                id={section.id}
                                ref={(element) => {
                                    sectionRefs.current[section.id] = element;
                                }}
                                data-brief-focus-section={
                                    sectionFocusProps['data-brief-focus-section']
                                }
                                style={sectionFocusProps.style}
                                className={cn(
                                    'border-t border-foreground/20',
                                    !isViewer &&
                                        'scroll-mt-24 max-sm:scroll-mt-20',
                                    isViewer && viewerScrollMarginClass,
                                    'pt-8 mb-4 max-sm:mb-2',
                                    'max-sm:pt-3',
                                    forceCompact && 'pt-3',
                                    sectionFocusProps.className
                                )}>
                                {renderSectionContent(section.id)}
                            </section>
                        );
                    })}
                    {renderStandaloneSelfAssessmentLink()}
                    <BriefInstitutionalFooter
                        policy={resolvedInstitutionalPolicy}
                        compact={forceCompact}
                        actions={
                            isViewer && showSelfAssessmentLink
                                ? renderSelfAssessmentLinkButton()
                                : undefined
                        }
                    />
                </div>
            )}
        </div>
    );
}
