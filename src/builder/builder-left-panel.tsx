/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import NextLink from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle
} from '@/components/ui/sheet';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useBriefBuilder, BriefSection, type BuilderMode } from './brief-builder-context';
import { BriefReviewNotice } from '@/components/brief-review-notice';
import { CollaboratorsDialog } from '@/components/collaborators-dialog';
import { AiFeatureDisabledHint } from '@/components/ai-feature-disabled-hint';
import { getUserRubrics } from '@/app/actions';
import { BuilderExampleFeedbackFormEditorLoader } from './builder-example-feedback-form-editor-loader';
import {
    Plus,
    GripVertical,
    Eye,
    EyeOff,
    Trash2,
    X,
    Save,
    Check,
    RotateCcw,
    Link,
    Sparkles,
    Pencil,
    ListOrdered,
    HelpCircle,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import {
    DEFAULT_ONE_PAGE_SUMMARY_SUBSECTIONS
} from '@/lib/templates';
import { applySectionVisibility, isBriefSectionEnabled, type SectionVisibility } from '@/lib/brief-sections';
import {
    getHiddenAssignmentSettingIds,
    getVisibleAssignmentSettingIds,
    isAssignmentSettingId,
    isAssignmentSettingVisible,
    type AssignmentSettingId
} from '@/lib/assignment-settings';
import {
    isProjectDetailSubsectionVisible,
    type RemovableProjectDetailSubsectionId
} from '@/lib/project-detail-subsections';
import {
    createEmptyCustomSubsection,
    customSubsectionBlockId,
    hasCustomSubsectionContent,
    normalizeCustomSubsections,
    parseCustomSubsectionBlockId,
    type CustomSubsection,
    type CustomSubsectionType
} from '@/lib/custom-subsections';
import {
    getVisibleProjectDetailBlockIds,
    getProjectDetailBlockLabel,
    normalizeProjectDetailBlockOrder,
    reorderVisibleProjectDetailBlocks
} from '@/lib/project-detail-block-order';
import { normalizeBriefContentSave, type BriefContentSave } from '@/lib/brief-content-schema';
import {
    AssignmentSettingsRestoreBadges,
    CustomSubsectionAccordionRows,
    CustomSubsectionTextRows,
    ProjectDetailAddBadges,
    ProjectDetailBlockDragPreview,
    ProjectDetailGrip,
    SortableProjectDetailBlock
} from './builder-custom-subsections';
import { replaceIso8601InTextWithIrishLocale } from '@/lib/irish-datetime-format';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { parseAiDisabledFromResponse } from '@/lib/ai-access';
import { AI_SETTINGS_ENABLE_HINT } from '@/lib/ai-powered-features';
import { RichTextPlateEditor } from '@/components/rich-text-plate-editor';
import { RichTextValue, richTextToPlainText } from '@/lib/rich-text-utils';
import { RubricSectionEditor } from '@/components/rubric-section-editor';
import { SelfAssessmentLinkOptionFields } from './builder-self-assessment-link-option';
import { BuilderAssignmentSettings } from './builder-assignment-settings';
import {
    createDefaultAssignmentLogDefinition,
    normalizeAssignmentLogs,
    type AssignmentLogDefinition
} from '@/lib/assignment-logs';
import { BuilderAiPolicyEditorLoader } from './builder-ai-policy-editor';
import {
    parseAiPolicy,
    type AiPolicyConfig
} from '@/lib/ai-policies';
import { createEmptyFaqItem, parseFaqItems, type FaqItem } from '@/lib/faq';
import type { RubricCriterion } from '@/lib/rubric-types';
import {
    createEmptyRubricCriterion,
    clonePremadeRubricCriteriaForBrief,
    buildRubricCriteriaFromLearningOutcomes,
    ensureRubricCriteriaIds
} from '@/lib/rubric-types';

function getInitialCustomState(initialContent: any) {
    return normalizeCustomSubsections(
        initialContent?.customSubsections,
        initialContent?.hiddenCustomSubsectionIds
    );
}

interface SortableSectionItemProps {
    section: BriefSection;
    builderMode: BuilderMode;
    onToggle: (id: string) => void;
    onVisibilityChange?: (id: string, visibility: SectionVisibility) => void;
}

type SubmissionFormField = {
    title: string;
    placeholder: string;
    optionalDescription?: string;
};

type RichTextContent = string | RichTextValue;
type ScheduleTimingMode = 'date' | 'weeks';

type SchedulePhase = {
    title: string;
    timingMode: ScheduleTimingMode;
    startDate?: string;
    endDate?: string;
    weekStart?: number;
    weekEnd?: number;
    instructions: RichTextContent;
};

function newSchedulePhaseSortIds(count: number): string[] {
    return Array.from({ length: count }, () => crypto.randomUUID());
}

const DECLARATION_DESCRIPTION =
    'I hereby certify that the material, which I now submit for assessment on the programme of [INSERT_PROGRAMME], is entirely my own work and has not been taken from the work of others except to the extent of such work which has been cited and acknowledged within the text of my own work.';

const getDeclarationDescription = (programme: string) =>
    DECLARATION_DESCRIPTION.replaceAll('[INSERT_PROGRAMME]', programme);

/**
 * Fixed locale, hour cycle, and timezone so SSR (Node) and the browser produce
 * identical strings (avoids hydration mismatch from `undefined` locale or default TZ).
 */
const BRIEF_DATETIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Dublin',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
});

function formatBriefDateTime(value: Date | string | null | undefined): string {
    if (value == null) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return BRIEF_DATETIME_FORMATTER.format(d);
}

function briefDetailLine(value: string | null | undefined): string {
    const t = (value ?? '').trim();
    return t.length > 0 ? t : '—';
}

function weightTotalBadgeClass(
    total: number,
    options?: { neutralWhenZero?: boolean }
): string {
    if (options?.neutralWhenZero && total === 0) {
        return 'inline-flex items-center rounded-none px-2.5 py-0.5 text-base font-semibold tabular-nums bg-muted text-muted-foreground';
    }

    return cn(
        'inline-flex items-center rounded-none px-2.5 py-0.5 text-base font-semibold tabular-nums',
        total === 100
            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
    );
}

function briefRubricHasReplaceableContent(
    criteria: RubricCriterion[]
): boolean {
    return criteria.some((c) => {
        if ((c.criterion || '').trim()) return true;
        if ((c.assessedThrough || '').trim()) return true;
        if (Number(c.weighting) !== 0) return true;
        if ((c.learningOutcomes || []).length > 0) return true;
        return (c.gradeDescriptors || []).some((gd) => {
            if ((gd.grade || '').trim()) return true;
            const plain =
                typeof gd.description === 'string'
                    ? gd.description.trim()
                    : richTextToPlainText(gd.description || '').trim();
            return plain.length > 0;
        });
    });
}

function createDefaultSchedulePhase(): SchedulePhase {
    return {
        title: '',
        timingMode: 'date',
        startDate: '',
        endDate: '',
        weekStart: 1,
        weekEnd: 1,
        instructions: ''
    };
}

function isSelectPortalTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    return Boolean(
        target.closest('[data-slot="select-content"]') ||
            target.closest('[data-radix-select-content]')
    );
}

function SortableSectionItem({
    section,
    builderMode,
    onToggle,
    onVisibilityChange
}: SortableSectionItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: section.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'flex items-center gap-3 p-3 border bg-card transition-all',
                isDragging && 'opacity-50 shadow-lg',
                !isDragging && 'hover:border-primary/50'
            )}>
            <button
                type='button'
                className='cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors'
                {...attributes}
                {...listeners}>
                <GripVertical className='h-5 w-5' />
            </button>

            <Checkbox
                id={`section-${section.id}`}
                checked={section.enabled}
                onCheckedChange={() => onToggle(section.id)}
                disabled={section.visibility === 'required'}
            />

            <div className='flex min-w-0 flex-1 items-center gap-2'>
                <Label
                    htmlFor={`section-${section.id}`}
                    className='min-w-0 flex-1 font-normal cursor-pointer truncate'>
                    {section.label}
                </Label>

                {builderMode === 'template' ? (
                    <div
                        className='shrink-0'
                        onPointerDown={(event) => event.stopPropagation()}>
                        <Select
                            value={section.visibility}
                            onValueChange={(value) =>
                                onVisibilityChange?.(
                                    section.id,
                                    value as SectionVisibility
                                )
                            }>
                            <SelectTrigger
                                className='h-8 w-[9.5rem] text-xs font-light'
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className='z-[125]'>
                                <SelectItem value='required'>
                                    Required
                                </SelectItem>
                                <SelectItem value='recommended'>
                                    Recommended
                                </SelectItem>
                                <SelectItem value='optional'>Optional</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <>
                        {section.visibility === 'required' && (
                            <span className='shrink-0 text-xs text-muted-foreground font-light'>
                                (Required)
                            </span>
                        )}
                        {section.visibility === 'recommended' && (
                            <span className='shrink-0 text-xs text-muted-foreground font-light'>
                                (Recommended)
                            </span>
                        )}
                    </>
                )}
            </div>

            {section.enabled ? (
                <Eye className='h-4 w-4 shrink-0 text-muted-foreground' />
            ) : (
                <EyeOff className='h-4 w-4 shrink-0 text-muted-foreground' />
            )}
        </div>
    );
}

type ScheduleWeekSelectionState = {
    phaseIndex: number;
    anchorWeek: number;
    isDragging: boolean;
} | null;

interface SortableSchedulePhaseCardProps {
    sortId: string;
    phaseIndex: number;
    phase: SchedulePhase;
    assignmentMinDate: string;
    assignmentMaxDate: string;
    weekSlots: number[];
    weekSelectionState: ScheduleWeekSelectionState;
    setWeekSelectionState: React.Dispatch<
        React.SetStateAction<ScheduleWeekSelectionState>
    >;
    updateSchedulePhase: (
        phaseIndex: number,
        updater: (phase: SchedulePhase) => SchedulePhase
    ) => void;
    removeSchedulePhase: (phaseIndex: number) => void;
}

function SortableSchedulePhaseCard({
    sortId,
    phaseIndex,
    phase,
    assignmentMinDate,
    assignmentMaxDate,
    weekSlots,
    weekSelectionState,
    setWeekSelectionState,
    updateSchedulePhase,
    removeSchedulePhase
}: SortableSchedulePhaseCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: sortId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'rounded-none border p-4 space-y-3 bg-background transition-shadow',
                isDragging &&
                    'opacity-90 shadow-lg ring-2 ring-primary/20 z-[130]'
            )}>
            <div className='flex items-start gap-2'>
                <button
                    type='button'
                    className='cursor-grab active:cursor-grabbing touch-none shrink-0 mt-2 text-muted-foreground hover:text-foreground transition-colors'
                    aria-label='Reorder phase'
                    {...attributes}
                    {...listeners}>
                    <GripVertical className='h-5 w-5' />
                </button>
                <Input
                    placeholder='Phase title...'
                    value={phase.title}
                    onChange={(e) =>
                        updateSchedulePhase(phaseIndex, (prev) => ({
                            ...prev,
                            title: e.target.value
                        }))
                    }
                    className='font-light bg-muted/50 focus-visible:bg-muted/80 flex-1'
                />
                <Button
                    type='button'
                    size='icon'
                    variant='ghost'
                    className='shrink-0'
                    onClick={() => removeSchedulePhase(phaseIndex)}>
                    <X className='h-4 w-4' />
                </Button>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-1'>
                    <Label className='text-xs font-light'>Timing mode</Label>
                    <Select
                        value={phase.timingMode}
                        onValueChange={(value: ScheduleTimingMode) =>
                            updateSchedulePhase(phaseIndex, (prev) => ({
                                ...prev,
                                timingMode: value
                            }))
                        }>
                        <SelectTrigger className='font-light'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className='z-[125]'>
                            <SelectItem value='date'>Date range</SelectItem>
                            <SelectItem value='weeks'>Week range</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {phase.timingMode === 'date' ? (
                <div className='grid gap-3 sm:grid-cols-2'>
                    <div className='space-y-1'>
                        <Label className='text-xs font-light'>Start date</Label>
                        <Input
                            type='date'
                            min={assignmentMinDate}
                            max={assignmentMaxDate}
                            value={phase.startDate || ''}
                            onChange={(e) =>
                                updateSchedulePhase(phaseIndex, (prev) => ({
                                    ...prev,
                                    startDate: e.target.value
                                }))
                            }
                            className='font-light bg-muted/50 focus-visible:bg-muted/80'
                        />
                    </div>
                    <div className='space-y-1'>
                        <Label className='text-xs font-light'>End date</Label>
                        <Input
                            type='date'
                            min={assignmentMinDate}
                            max={assignmentMaxDate}
                            value={phase.endDate || ''}
                            onChange={(e) =>
                                updateSchedulePhase(phaseIndex, (prev) => ({
                                    ...prev,
                                    endDate: e.target.value
                                }))
                            }
                            className='font-light bg-muted/50 focus-visible:bg-muted/80'
                        />
                    </div>
                </div>
            ) : (
                <div className='space-y-2'>
                    <p className='text-xs font-light text-muted-foreground'>
                        Click and drag to select a week range.
                    </p>
                    <div
                        className='grid gap-1'
                        style={{
                            gridTemplateColumns: `repeat(${Math.min(
                                weekSlots.length,
                                12
                            )}, minmax(0, 1fr))`
                        }}>
                        {weekSlots.map((weekNum) => {
                            const start = Math.min(
                                Number(phase.weekStart || 1),
                                Number(phase.weekEnd || 1)
                            );
                            const end = Math.max(
                                Number(phase.weekStart || 1),
                                Number(phase.weekEnd || 1)
                            );
                            const isSelected =
                                weekNum >= start && weekNum <= end;
                            return (
                                <button
                                    key={`${phaseIndex}-${weekNum}`}
                                    type='button'
                                    onMouseDown={() => {
                                        setWeekSelectionState({
                                            phaseIndex,
                                            anchorWeek: weekNum,
                                            isDragging: true
                                        });
                                        updateSchedulePhase(
                                            phaseIndex,
                                            (prev) => ({
                                                ...prev,
                                                weekStart: weekNum,
                                                weekEnd: weekNum
                                            })
                                        );
                                    }}
                                    onMouseEnter={() => {
                                        if (
                                            !weekSelectionState?.isDragging ||
                                            weekSelectionState.phaseIndex !==
                                                phaseIndex
                                        ) {
                                            return;
                                        }
                                        const rangeStart = Math.min(
                                            weekSelectionState.anchorWeek,
                                            weekNum
                                        );
                                        const rangeEnd = Math.max(
                                            weekSelectionState.anchorWeek,
                                            weekNum
                                        );
                                        updateSchedulePhase(
                                            phaseIndex,
                                            (prev) => ({
                                                ...prev,
                                                weekStart: rangeStart,
                                                weekEnd: rangeEnd
                                            })
                                        );
                                    }}
                                    className={cn(
                                        'h-9 rounded-none text-[10px] border font-light',
                                        isSelected
                                            ? 'bg-green-100 border-green-500 text-green-800'
                                            : 'bg-muted/50'
                                    )}>
                                    {weekNum}
                                </button>
                            );
                        })}
                    </div>
                    <p className='text-xs font-light text-muted-foreground'>
                        Selected:{' '}
                        {`Weeks ${phase.weekStart || 1}-${phase.weekEnd || 1}`}
                    </p>
                </div>
            )}
            <div className='space-y-1'>
                <Label className='text-xs font-light'>Instructions</Label>
                <RichTextPlateEditor
                    allowHeadings
                    placeholder='Enter phase instructions...'
                    value={phase.instructions}
                    onChange={(nextValue) =>
                        updateSchedulePhase(phaseIndex, (prev) => ({
                            ...prev,
                            instructions: nextValue
                        }))
                    }
                    className='min-h-[80px] font-light bg-muted/50 focus-visible:bg-muted/80 p-1'
                />
            </div>
        </div>
    );
}

// Helper function to parse JSON from AI response, removing markdown code blocks
function parseAIJsonResponse(response: string): unknown {
    let cleanedResponse = response.trim();

    // Remove markdown code blocks if present
    if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse
            .replace(/```json\n?/g, '')
            .replace(/```$/g, '')
            .trim();
    } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/g, '').trim();
    }

    try {
        return JSON.parse(cleanedResponse);
    } catch {
        const start = cleanedResponse.indexOf('{');
        const end = cleanedResponse.lastIndexOf('}');
        if (start !== -1 && end > start) {
            return JSON.parse(cleanedResponse.slice(start, end + 1));
        }
        throw new Error('Could not parse AI response as JSON');
    }
}

function canonicalOnePageSubsectionKey(sub: any, idx: number): string {
    return sub.title || sub.label || String(sub.id ?? idx);
}

/** Turn AI list/object shapes into plain multi-line text for Plate (avoid raw ["...","..." ] display). */
function coerceAiOnePageValueToRichText(raw: unknown): RichTextContent {
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'string') {
        const t = raw.trim();
        if (t.startsWith('[') && t.endsWith(']')) {
            try {
                const parsed = JSON.parse(t) as unknown;
                if (Array.isArray(parsed)) {
                    return coerceAiOnePageValueToRichText(parsed);
                }
            } catch {
                /* keep string */
            }
        }
        return replaceIso8601InTextWithIrishLocale(raw);
    }
    if (Array.isArray(raw)) {
        const lines = raw.map((item) => {
            if (typeof item === 'string') return item;
            if (item !== null && typeof item === 'object') {
                const o = item as Record<string, unknown>;
                if (typeof o.text === 'string') return o.text;
                if (typeof o.label === 'string') return o.label;
                if (typeof o.title === 'string') return o.title;
                if (typeof o.content === 'string') return o.content;
            }
            return String(item ?? '');
        });
        return replaceIso8601InTextWithIrishLocale(
            lines.filter((line) => line.trim().length > 0).join('\n')
        );
    }
    if (typeof raw === 'object') {
        const o = raw as Record<string, unknown>;
        if (typeof o.text === 'string')
            return replaceIso8601InTextWithIrishLocale(o.text);
        if (Array.isArray(o.items)) {
            return coerceAiOnePageValueToRichText(o.items);
        }
        if (Array.isArray(o.lines)) {
            return coerceAiOnePageValueToRichText(o.lines);
        }
        return JSON.stringify(raw);
    }
    return replaceIso8601InTextWithIrishLocale(String(raw));
}

/**
 * AI often returns slightly different key casing/spacing than template titles.
 * Empty editor + long template text passed as Slate placeholder looked like "content in the placeholder".
 */
function normalizeOnePageSummaryFromAi(
    parsed: unknown,
    subsections: any[]
): Record<string, RichTextContent> {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
    }
    const record = parsed as Record<string, unknown>;
    const byNormalizedKey = new Map<
        string,
        { originalKey: string; value: unknown }
    >();
    for (const [k, v] of Object.entries(record)) {
        const nk = k.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!byNormalizedKey.has(nk)) {
            byNormalizedKey.set(nk, { originalKey: k, value: v });
        }
    }

    const out: Record<string, RichTextContent> = {};
    subsections.forEach((sub, idx) => {
        const canonical = canonicalOnePageSubsectionKey(sub, idx);
        const targetNorm = canonical.trim().toLowerCase().replace(/\s+/g, ' ');

        let raw: unknown = record[canonical];
        if (raw === undefined) {
            const hit = byNormalizedKey.get(targetNorm);
            if (hit) raw = hit.value;
        }

        out[canonical] = coerceAiOnePageValueToRichText(raw);
    });
    return out;
}

// Helper function to generate AI content
async function generateAIContent(params: {
    context: Record<string, unknown>;
    prompt: string;
    exampleFormat: unknown;
}): Promise<unknown> {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            context: JSON.stringify(params.context, null, 2),
            prompt: params.prompt,
            exampleResponse: `Return ONLY valid JSON in this exact format: ${JSON.stringify(
                params.exampleFormat,
                null,
                2
            )}`
        })
    });

    if (!response.ok) {
        const isAiDisabled = await parseAiDisabledFromResponse(response);
        if (isAiDisabled) {
            throw new Error(AI_SETTINGS_ENABLE_HINT);
        }
        throw new Error('Failed to generate content');
    }

    const data = await response.json();
    const raw = data.response;
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error('Invalid or empty response from AI');
    }
    return parseAIJsonResponse(raw);
}

export function BuilderLeftPanel() {
    const {
        sections,
        setSections,
        briefId,
        templateKey,
        layoutTemplate,
        builderMode,
        saveBriefContent,
        saveBriefStructure,
        initialContent,
        briefMetadata,
        setIsDirty,
        updateContent,
        mergePreviewContent,
        isStudentPreviewOpen,
        setStudentPreviewOpenWithLayout,
        selfAssessmentLinkEnabled,
        reviewSource,
        refreshPublishAssets,
        useAI,
        moduleRubricsEnabled,
        accessRole
    } = useBriefBuilder();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const structureSheetSnapshotRef = useRef<BriefSection[] | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showHeaderButton, setShowHeaderButton] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [isAtBottom, setIsAtBottom] = useState(false);
    const [isAtTop, setIsAtTop] = useState(true);
    const [isSectionHelperVisible, setIsSectionHelperVisible] = useState(false);
    const [isScheduleSheetOpen, setIsScheduleSheetOpen] = useState(false);
    const programmeDisplayName =
        briefMetadata.programmeName.trim() || templateKey;

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const changeStructureButtonRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Form state for dynamic sections - initialize with saved data if available
    const [learningOutcomes, setLearningOutcomes] = useState<
        Array<{ title: string; weighting: number }>
    >(initialContent?.learningOutcomes || [{ title: '', weighting: 0 }]);
    const [keyExpectations, setKeyExpectations] = useState<
        Array<{ title: string; description: RichTextContent }>
    >(initialContent?.keyExpectations || [{ title: '', description: '' }]);
    const [deliverables, setDeliverables] = useState<
        Array<{ title: string; description: RichTextContent }>
    >(initialContent?.deliverables || [{ title: '', description: '' }]);
    const [resources, setResources] = useState<
        Array<{ title: string; description: RichTextContent }>
    >(initialContent?.resources || [{ title: '', description: '' }]);
    const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>(
        () =>
            ensureRubricCriteriaIds(
                initialContent?.rubricCriteria?.length
                    ? (initialContent.rubricCriteria as RubricCriterion[])
                    : [createEmptyRubricCriterion()]
            ).criteria
    );
    const [savedRubricsForApply, setSavedRubricsForApply] = useState<
        Array<{ id: number; name: string; criteria: unknown }>
    >([]);
    const [selectedPremadeRubricId, setSelectedPremadeRubricId] =
        useState<string>('');
    const [isModuleRubricPickerOpen, setIsModuleRubricPickerOpen] =
        useState(false);
    const [replaceRubricDialogOpen, setReplaceRubricDialogOpen] =
        useState(false);
    const [replaceRubricDialogSource, setReplaceRubricDialogSource] = useState<
        'premade' | 'learning-outcomes'
    >('premade');
    const pendingRubricApplyRef = useRef<(() => void) | null>(null);
    const [
        replaceOnePageSummaryDialogOpen,
        setReplaceOnePageSummaryDialogOpen
    ] = useState(false);
    const [scheduleValidationDialogOpen, setScheduleValidationDialogOpen] =
        useState(false);
    const [revertConfirmDialogOpen, setRevertConfirmDialogOpen] =
        useState(false);
    const pendingOnePageSummarySubsectionsRef = useRef<any[] | null>(null);

    useEffect(() => {
        if (!moduleRubricsEnabled) {
            return;
        }

        let cancelled = false;
        void getUserRubrics().then((list) => {
            if (cancelled) return;
            setSavedRubricsForApply(
                (list || []).map((r) => ({
                    id: r.id,
                    name: r.name,
                    criteria: r.criteria
                }))
            );
        });
        return () => {
            cancelled = true;
        };
    }, [moduleRubricsEnabled]);

    const confirmReplaceRubricIfNeeded = useCallback(
        (
            source: 'premade' | 'learning-outcomes',
            apply: () => void
        ) => {
            if (briefRubricHasReplaceableContent(rubricCriteria)) {
                setReplaceRubricDialogSource(source);
                pendingRubricApplyRef.current = apply;
                setReplaceRubricDialogOpen(true);
                return;
            }
            apply();
        },
        [rubricCriteria]
    );

    const handleConfirmReplaceRubric = useCallback(() => {
        pendingRubricApplyRef.current?.();
        pendingRubricApplyRef.current = null;
        setReplaceRubricDialogOpen(false);
    }, []);

    const performApplyPremadeRubric = useCallback(() => {
        const id = Number(selectedPremadeRubricId);
        if (!Number.isFinite(id)) return;
        const rubric = savedRubricsForApply.find((r) => r.id === id);
        if (!rubric) return;
        setRubricCriteria(clonePremadeRubricCriteriaForBrief(rubric.criteria));
        setIsDirty(true);
    }, [selectedPremadeRubricId, savedRubricsForApply, setIsDirty]);

    const performApplyLearningOutcomesToRubric = useCallback(() => {
        setRubricCriteria(
            buildRubricCriteriaFromLearningOutcomes(learningOutcomes)
        );
        setIsDirty(true);
    }, [learningOutcomes, setIsDirty]);

    const applyPremadeRubricToBrief = useCallback(() => {
        const id = Number(selectedPremadeRubricId);
        if (!Number.isFinite(id)) return;
        const rubric = savedRubricsForApply.find((r) => r.id === id);
        if (!rubric) return;
        confirmReplaceRubricIfNeeded('premade', performApplyPremadeRubric);
    }, [
        selectedPremadeRubricId,
        savedRubricsForApply,
        confirmReplaceRubricIfNeeded,
        performApplyPremadeRubric
    ]);

    const applyLearningOutcomesToRubric = useCallback(() => {
        confirmReplaceRubricIfNeeded(
            'learning-outcomes',
            performApplyLearningOutcomesToRubric
        );
    }, [
        confirmReplaceRubricIfNeeded,
        performApplyLearningOutcomesToRubric
    ]);
    const [howWorkMarked, setHowWorkMarked] = useState<
        Array<{ title: string; description: RichTextContent }>
    >(initialContent?.howWorkMarked || [{ title: '', description: '' }]);
    const [checklistItems, setChecklistItems] = useState<string[]>(
        initialContent?.checklistItems || ['']
    );
    const [subheadings, setSubheadings] = useState<{
        [key: string]: RichTextContent;
    }>(initialContent?.subheadings || {});
    const [onePageSummaryContent, setOnePageSummaryContent] = useState<{
        [key: string]: RichTextContent;
    }>(initialContent?.onePageSummaryContent || {});
    const [submissionFormFields, setSubmissionFormFields] = useState<
        SubmissionFormField[]
    >(
        initialContent?.submissionFormFields?.map(
            (
                field: {
                    title?: string;
                    description?: string;
                    placeholder?: string;
                    optionalDescription?: string;
                } = {}
            ) => ({
                title: field.title || '',
                placeholder: field.placeholder || field.description || '',
                optionalDescription:
                    field.optionalDescription ||
                    (field.title?.trim().toLowerCase() === 'declaration'
                        ? getDeclarationDescription(programmeDisplayName)
                        : '')
            })
        ) || [{ title: '', placeholder: '', optionalDescription: '' }]
    );
    const [customSubsections, setCustomSubsections] = useState<CustomSubsection[]>(
        () => getInitialCustomState(initialContent).subsections
    );
    const [hiddenCustomSubsectionIds, setHiddenCustomSubsectionIds] =
        useState<string[]>(
            () => getInitialCustomState(initialContent).hiddenIds
        );
    const [hiddenProjectDetailSubsections, setHiddenProjectDetailSubsections] =
        useState<string[]>(
            initialContent?.hiddenProjectDetailSubsections || []
        );
    const [projectDetailBlockOrder, setProjectDetailBlockOrder] = useState<
        string[]
    >(        () =>
        normalizeProjectDetailBlockOrder(
            initialContent?.projectDetailBlockOrder,
            getInitialCustomState(initialContent).subsections
        )
    );
    const [schedulePhases, setSchedulePhases] = useState<SchedulePhase[]>(
        initialContent?.schedulePhases?.length
            ? initialContent.schedulePhases
            : [createDefaultSchedulePhase()]
    );
    const [schedulePhaseIds, setSchedulePhaseIds] = useState<string[]>(() =>
        newSchedulePhaseSortIds(
            initialContent?.schedulePhases?.length
                ? initialContent.schedulePhases.length
                : 1
        )
    );
    const [scheduleViews, setScheduleViews] = useState<{
        table: boolean;
        gantt: boolean;
    }>(
        initialContent?.scheduleViews || {
            table: true,
            gantt: false
        }
    );
    const [requireNotebook, setRequireNotebook] = useState(
        Boolean(initialContent?.requireNotebook)
    );
    const [requireLogs, setRequireLogs] = useState(
        Boolean(initialContent?.requireLogs)
    );
    const [requireAiLog, setRequireAiLog] = useState(() => {
        if (initialContent?.requireAiLog === true) {
            return true;
        }
        return Boolean(parseAiPolicy(initialContent).usageLogEnabled);
    });
    const [assignmentLogs, setAssignmentLogs] = useState<
        AssignmentLogDefinition[]
    >(() => normalizeAssignmentLogs(initialContent?.assignmentLogs));
    const [hiddenAssignmentSettings, setHiddenAssignmentSettings] = useState<
        AssignmentSettingId[]
    >(initialContent?.hiddenAssignmentSettings || []);
    const [aiPolicy, setAiPolicy] = useState<AiPolicyConfig>(() => {
        const parsed = parseAiPolicy(initialContent);
        const enabled =
            initialContent?.requireAiLog === true ||
            parsed.usageLogEnabled === true;
        return {
            ...parsed,
            usageLogEnabled: enabled
        };
    });
    const [faqItems, setFaqItems] = useState<FaqItem[]>(() => {
        const parsed = parseFaqItems(initialContent);
        return parsed.length > 0 ? parsed : [createEmptyFaqItem()];
    });
    const [weekSelectionState, setWeekSelectionState] =
        useState<ScheduleWeekSelectionState>(null);
    const assignmentStartDate = new Date(briefMetadata.startDate);
    const assignmentEndDate = new Date(briefMetadata.submissionDate);
    const assignmentDurationMs = Math.max(
        assignmentEndDate.getTime() - assignmentStartDate.getTime(),
        0
    );
    const totalAssignmentWeeks = Math.max(
        1,
        Math.ceil(assignmentDurationMs / (1000 * 60 * 60 * 24 * 7))
    );
    const weekSlots = Array.from(
        { length: totalAssignmentWeeks },
        (_, idx) => idx + 1
    );
    const hasConfiguredSchedule = schedulePhases.some((phase) => {
        const hasText = Boolean(phase.title?.trim() || phase.instructions);
        if (phase.timingMode === 'weeks') {
            return hasText || Boolean(phase.weekStart && phase.weekEnd);
        }
        return hasText || Boolean(phase.startDate || phase.endDate);
    });
    const scheduleCtaLabel = hasConfiguredSchedule
        ? 'Edit Schedule'
        : 'Create Schedule';
    const schedulePhaseSummaries = schedulePhases
        .map((phase, idx) => {
            const title = phase.title?.trim() || `Phase ${idx + 1}`;
            const timing =
                phase.timingMode === 'weeks'
                    ? `Weeks ${phase.weekStart || 1}-${phase.weekEnd || 1}`
                    : phase.startDate && phase.endDate
                      ? `${phase.startDate} to ${phase.endDate}`
                      : phase.startDate
                        ? `Starts ${phase.startDate}`
                        : phase.endDate
                          ? `Ends ${phase.endDate}`
                          : 'Timing not set';
            const hasDetails = Boolean(
                phase.title?.trim() ||
                phase.instructions ||
                phase.startDate ||
                phase.endDate ||
                phase.timingMode === 'weeks'
            );
            return hasDetails ? { title, timing } : null;
        })
        .filter(
            (phase): phase is { title: string; timing: string } =>
                phase !== null
        );
    const rubricTotalPercentage = rubricCriteria.reduce(
        (total, criterion) => total + (Number(criterion.weighting) || 0),
        0
    );
    const learningOutcomesTotalPercentage = learningOutcomes.reduce(
        (total, outcome) => total + (Number(outcome.weighting) || 0),
        0
    );
    const learningOutcomesHasWeighting = learningOutcomes.some(
        (outcome) => (Number(outcome.weighting) || 0) > 0
    );
    const titledLearningOutcomesCount = learningOutcomes.filter((outcome) =>
        outcome.title.trim()
    ).length;
    const canMapRubricToLearningOutcomes =
        isProjectDetailSubsectionVisible(
            'learning-outcomes',
            hiddenProjectDetailSubsections
        ) && titledLearningOutcomesCount > 0;
    const canOfferSelfAssessmentLink = rubricCriteria.some(
        (row) => String(row.criterion || '').trim().length > 0
    );

    useEffect(() => {
        mergePreviewContent({ rubricCriteria });
    }, [mergePreviewContent, rubricCriteria]);

    useEffect(() => {
        mergePreviewContent({
            aiPolicy,
            policyRationale: aiPolicy.policyRationale,
            assessmentGuidance: aiPolicy.assessmentGuidance
        });
    }, [
        mergePreviewContent,
        aiPolicy,
        aiPolicy.policyRationale,
        aiPolicy.assessmentGuidance
    ]);

    useEffect(() => {
        mergePreviewContent({ faqItems });
    }, [mergePreviewContent, faqItems]);

    useEffect(() => {
        mergePreviewContent({ hiddenProjectDetailSubsections });
    }, [mergePreviewContent, hiddenProjectDetailSubsections]);

    useEffect(() => {
        mergePreviewContent({
            customSubsections,
            hiddenCustomSubsectionIds,
            projectDetailBlockOrder,
            hiddenProjectDetailSubsections
        });
    }, [
        mergePreviewContent,
        customSubsections,
        hiddenCustomSubsectionIds,
        projectDetailBlockOrder,
        hiddenProjectDetailSubsections
    ]);

    const template = layoutTemplate;

    const resolveOnePageSummarySubsections = useCallback(
        (passed?: unknown[] | null) => {
            if (Array.isArray(passed) && passed.length > 0) {
                return passed;
            }
            const fromProgramme = template?.sections.find(
                (s) => s.id === 'one-page-summary'
            )?.subsections;
            if (Array.isArray(fromProgramme) && fromProgramme.length > 0) {
                return fromProgramme;
            }
            return DEFAULT_ONE_PAGE_SUMMARY_SUBSECTIONS;
        },
        [template]
    );

    const onePageSummaryHasReplacableContent = useCallback(() => {
        return Object.values(onePageSummaryContent).some((v) =>
            richTextToPlainText(v ?? '').trim()
        );
    }, [onePageSummaryContent]);

    // Get enabled sections sorted by order
    const enabledSections = sections
        .filter((s) => isBriefSectionEnabled(s))
        .sort((a, b) => a.order - b.order)
        .map((section) => {
            // Get full section data from template
            const templateSection = template?.sections.find(
                (ts) => ts.id === section.id
            );
            return { ...section, templateData: templateSection };
        });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );
    const schedulePhaseDragSensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 10 }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );
    const projectDetailDragSensors = schedulePhaseDragSensors;
    const [projectDetailDragActiveId, setProjectDetailDragActiveId] =
        useState<string | null>(null);
    const visibleProjectDetailBlockIds = useMemo(
        () =>
            getVisibleProjectDetailBlockIds(
                projectDetailBlockOrder,
                hiddenProjectDetailSubsections,
                hiddenCustomSubsectionIds
            ),
        [
            projectDetailBlockOrder,
            hiddenProjectDetailSubsections,
            hiddenCustomSubsectionIds
        ]
    );
    const activeSection =
        enabledSections.find((section) => section.id === activeSectionId) ||
        enabledSections[0];

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = sections.findIndex((s) => s.id === active.id);
            const newIndex = sections.findIndex((s) => s.id === over.id);

            const reorderedSections = arrayMove(sections, oldIndex, newIndex);
            const updatedSections = reorderedSections.map((section, index) => ({
                ...section,
                order: index
            }));

            setSections(updatedSections);
        }
    }

    function handleSchedulePhaseDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const aid = String(active.id);
        const oid = String(over.id);
        let oldIndex = -1;
        let newIndex = -1;
        setSchedulePhaseIds((currentIds) => {
            oldIndex = currentIds.indexOf(aid);
            newIndex = currentIds.indexOf(oid);
            if (oldIndex < 0 || newIndex < 0) return currentIds;
            return arrayMove(currentIds, oldIndex, newIndex);
        });
        if (oldIndex >= 0 && newIndex >= 0) {
            setSchedulePhases((phases) =>
                arrayMove(phases, oldIndex, newIndex)
            );
            setIsDirty(true);
        }
    }

    function handleProjectDetailDragStart(event: DragStartEvent) {
        setProjectDetailDragActiveId(String(event.active.id));
    }

    function handleProjectDetailBlockDragEnd(event: DragEndEvent) {
        setProjectDetailDragActiveId(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const reordered = reorderVisibleProjectDetailBlocks(
            projectDetailBlockOrder,
            hiddenProjectDetailSubsections,
            hiddenCustomSubsectionIds,
            String(active.id),
            String(over.id)
        );
        if (reordered) {
            setProjectDetailBlockOrder(reordered);
            setIsDirty(true);
        }
    }

    function handleToggleSection(sectionId: string) {
        const target = sections.find((section) => section.id === sectionId);
        if (target?.visibility === 'required') {
            return;
        }

        const updatedSections = sections.map((section) =>
            section.id === sectionId
                ? { ...section, enabled: !section.enabled }
                : section
        );
        setSections(updatedSections);
    }

    function handleVisibilityChange(
        sectionId: string,
        visibility: SectionVisibility
    ) {
        const updatedSections = sections.map((section) =>
            section.id === sectionId
                ? applySectionVisibility(section, visibility)
                : section
        );
        setSections(updatedSections);
    }

    function openStructureSheet() {
        structureSheetSnapshotRef.current = sections.map((section) => ({
            ...section
        }));
        setIsSheetOpen(true);
    }

    function handleStructureSheetOpenChange(open: boolean) {
        if (open) {
            setIsSheetOpen(true);
            return;
        }

        if (structureSheetSnapshotRef.current) {
            setSections(structureSheetSnapshotRef.current);
            structureSheetSnapshotRef.current = null;
        }
        setIsSheetOpen(false);
    }

    async function handleSaveStructure() {
        setIsSaving(true);
        try {
            if (saveBriefStructure) {
                const ok = await saveBriefStructure(sections);
                if (ok) {
                    structureSheetSnapshotRef.current = null;
                    setIsSheetOpen(false);
                    setIsDirty(false);
                } else {
                    alert('Failed to save template structure');
                }
                return;
            }

            if (!briefId) {
                return;
            }

            const response = await fetch(`/api/briefs/${briefId}/structure`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sections })
            });

            if (response.ok) {
                structureSheetSnapshotRef.current = null;
                setIsSheetOpen(false);
                setIsDirty(false);
                console.log('Structure saved successfully');
            } else {
                const errorData = await response.json();
                console.error('Failed to save structure:', errorData);
                alert(
                    `Failed to save structure: ${
                        errorData.error || 'Unknown error'
                    }`
                );
            }
        } catch (error) {
            console.error('Failed to save structure:', error);
            alert(
                `Error saving structure: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        } finally {
            setIsSaving(false);
        }
    }

    // Helper functions for array management
    const addLearningOutcome = () => {
        setLearningOutcomes([...learningOutcomes, { title: '', weighting: 0 }]);
    };

    const removeLearningOutcome = (index: number) => {
        setLearningOutcomes(learningOutcomes.filter((_, i) => i !== index));
    };

    const addKeyExpectation = () => {
        setKeyExpectations([
            ...keyExpectations,
            { title: '', description: '' }
        ]);
    };

    const removeKeyExpectation = (index: number) => {
        setKeyExpectations(keyExpectations.filter((_, i) => i !== index));
    };

    const addDeliverable = () => {
        setDeliverables([...deliverables, { title: '', description: '' }]);
    };

    const removeDeliverable = (index: number) => {
        setDeliverables(deliverables.filter((_, i) => i !== index));
    };

    const addResource = () => {
        setResources([...resources, { title: '', description: '' }]);
    };

    const removeResource = (index: number) => {
        setResources(resources.filter((_, i) => i !== index));
    };

    const addRubricCriterionFromOverlay = () => {
        setRubricCriteria((prev) => [...prev, createEmptyRubricCriterion()]);
        setIsDirty(true);
    };

    const addHowWorkMarked = () => {
        setHowWorkMarked([...howWorkMarked, { title: '', description: '' }]);
    };

    const removeHowWorkMarked = (index: number) => {
        setHowWorkMarked(howWorkMarked.filter((_, i) => i !== index));
    };

    const addFaqItem = () => {
        setFaqItems([...faqItems, createEmptyFaqItem()]);
    };

    const removeFaqItem = (index: number) => {
        setFaqItems(faqItems.filter((_, i) => i !== index));
    };

    const addChecklistItem = () => {
        setChecklistItems([...checklistItems, '']);
    };

    const removeChecklistItem = (index: number) => {
        setChecklistItems(checklistItems.filter((_, i) => i !== index));
    };

    const addSubmissionFormField = () => {
        setSubmissionFormFields([
            ...submissionFormFields,
            { title: '', placeholder: '', optionalDescription: '' }
        ]);
    };

    const addSubmissionDeclarationField = () => {
        setSubmissionFormFields([
            ...submissionFormFields,
            {
                title: 'Declaration',
                placeholder: 'Signed',
                optionalDescription:
                    getDeclarationDescription(programmeDisplayName)
            }
        ]);
    };

    const removeSubmissionFormField = (index: number) => {
        setSubmissionFormFields(
            submissionFormFields.filter((_, i) => i !== index)
        );
    };

    const addCustomSubsection = (type: CustomSubsectionType) => {
        const created = createEmptyCustomSubsection(type);
        setCustomSubsections((prev) => [...prev, created]);
        setProjectDetailBlockOrder((prev) => [
            ...prev,
            customSubsectionBlockId(created.id)
        ]);
        setIsDirty(true);
    };

    const hideCustomSubsection = (id: string) => {
        const subsection = customSubsections.find((entry) => entry.id === id);
        if (!subsection) return;

        if (!hasCustomSubsectionContent(subsection)) {
            setCustomSubsections((prev) =>
                prev.filter((entry) => entry.id !== id)
            );
            setProjectDetailBlockOrder((prev) =>
                prev.filter(
                    (blockId) => blockId !== customSubsectionBlockId(id)
                )
            );
            setHiddenCustomSubsectionIds((prev) =>
                prev.filter((subsectionId) => subsectionId !== id)
            );
            setIsDirty(true);
            return;
        }

        if (hiddenCustomSubsectionIds.includes(id)) return;
        setHiddenCustomSubsectionIds((prev) => [...prev, id]);
        setIsDirty(true);
    };

    const updateCustomSubsection = (
        id: string,
        patch: Partial<CustomSubsection>
    ) => {
        setCustomSubsections((prev) =>
            prev.map((subsection) =>
                subsection.id === id ? { ...subsection, ...patch } : subsection
            )
        );
        setIsDirty(true);
    };

    const addCustomSubsectionItem = (subsectionId: string) => {
        setCustomSubsections((prev) =>
            prev.map((subsection) => {
                if (subsection.id !== subsectionId) return subsection;
                return {
                    ...subsection,
                    items: [
                        ...(subsection.items || []),
                        { title: '', content: '' }
                    ]
                };
            })
        );
        setIsDirty(true);
    };

    const removeCustomSubsectionItem = (
        subsectionId: string,
        itemIndex: number
    ) => {
        setCustomSubsections((prev) =>
            prev.map((subsection) => {
                if (subsection.id !== subsectionId) return subsection;
                const items = subsection.items || [];
                if (items.length <= 1) return subsection;
                return {
                    ...subsection,
                    items: items.filter((_, idx) => idx !== itemIndex)
                };
            })
        );
        setIsDirty(true);
    };

    const updateCustomSubsectionItem = (
        subsectionId: string,
        itemIndex: number,
        patch: Partial<CustomSubsection['items'][number]>
    ) => {
        setCustomSubsections((prev) =>
            prev.map((subsection) => {
                if (subsection.id !== subsectionId) return subsection;
                const items = [...(subsection.items || [])];
                if (!items[itemIndex]) return subsection;
                items[itemIndex] = { ...items[itemIndex], ...patch };
                return { ...subsection, items };
            })
        );
        setIsDirty(true);
    };

    const removeProjectDetailSubsection = (
        subsectionId: RemovableProjectDetailSubsectionId
    ) => {
        if (hiddenProjectDetailSubsections.includes(subsectionId)) return;
        setHiddenProjectDetailSubsections([
            ...hiddenProjectDetailSubsections,
            subsectionId
        ]);
        setIsDirty(true);
    };

    const restoreProjectDetailSubsection = (
        subsectionId: RemovableProjectDetailSubsectionId
    ) => {
        setHiddenProjectDetailSubsections(
            hiddenProjectDetailSubsections.filter((id) => id !== subsectionId)
        );
        setIsDirty(true);
    };

    const hideAssignmentSetting = (settingId: AssignmentSettingId) => {
        if (hiddenAssignmentSettings.includes(settingId)) return;
        setHiddenAssignmentSettings([...hiddenAssignmentSettings, settingId]);
        if (settingId === 'require-notebook') {
            setRequireNotebook(false);
        }
        if (settingId === 'require-logs') {
            setRequireLogs(false);
        }
        if (settingId === 'require-ai-log') {
            setRequireAiLog(false);
            setAiPolicy((current) => ({
                ...current,
                usageLogEnabled: false
            }));
        }
        setIsDirty(true);
    };

    const restoreAssignmentSetting = (settingId: AssignmentSettingId) => {
        setHiddenAssignmentSettings(
            hiddenAssignmentSettings.filter((id) => id !== settingId)
        );
        setIsDirty(true);
    };

    const normalizeSchedulePhases = (
        phases: SchedulePhase[]
    ): SchedulePhase[] => {
        const normalized = phases
            .map((phase) => ({
                ...phase,
                title: phase.title?.trim() || '',
                startDate: phase.startDate || '',
                endDate: phase.endDate || '',
                weekStart: Number(phase.weekStart) || 1,
                weekEnd: Number(phase.weekEnd) || 1,
                instructions: phase.instructions || ''
            }))
            .filter((phase) => {
                const hasTiming =
                    phase.timingMode === 'weeks'
                        ? Boolean(phase.weekStart && phase.weekEnd)
                        : Boolean(phase.startDate || phase.endDate);
                return Boolean(phase.title || phase.instructions || hasTiming);
            });

        return normalized.length ? normalized : [createDefaultSchedulePhase()];
    };

    const formatDateForInput = (date: Date) => {
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
    };

    const assignmentMinDate = formatDateForInput(assignmentStartDate);
    const assignmentMaxDate = formatDateForInput(assignmentEndDate);

    const addSchedulePhase = () => {
        setSchedulePhases((prev) => [...prev, createDefaultSchedulePhase()]);
        setSchedulePhaseIds((prev) => [...prev, crypto.randomUUID()]);
        setIsDirty(true);
    };

    const removeSchedulePhase = (phaseIndex: number) => {
        if (schedulePhases.length === 1) {
            setSchedulePhases([createDefaultSchedulePhase()]);
            setSchedulePhaseIds([crypto.randomUUID()]);
            setIsDirty(true);
            return;
        }
        setSchedulePhases((prev) =>
            prev.filter((_, idx) => idx !== phaseIndex)
        );
        setSchedulePhaseIds((prev) =>
            prev.filter((_, idx) => idx !== phaseIndex)
        );
        setIsDirty(true);
    };

    const updateSchedulePhase = (
        phaseIndex: number,
        updater: (phase: SchedulePhase) => SchedulePhase
    ) => {
        setSchedulePhases((prev) =>
            prev.map((phase, idx) =>
                idx === phaseIndex ? updater(phase) : phase
            )
        );
    };

    const hasInvalidSchedulePhases = () => {
        return schedulePhases.some((phase) => {
            if (phase.timingMode === 'weeks') {
                const start = Number(phase.weekStart);
                const end = Number(phase.weekEnd);
                if (!Number.isFinite(start) || !Number.isFinite(end))
                    return true;
                if (start < 1 || end < 1) return true;
                if (start > end) return true;
                if (end > totalAssignmentWeeks) return true;
                return false;
            }

            if (
                (phase.startDate && !phase.endDate) ||
                (!phase.startDate && phase.endDate)
            ) {
                return true;
            }
            if (!phase.startDate || !phase.endDate) return false;
            if (phase.startDate > phase.endDate) return true;
            if (assignmentMinDate && phase.startDate < assignmentMinDate)
                return true;
            if (assignmentMaxDate && phase.endDate > assignmentMaxDate)
                return true;
            return false;
        });
    };

    // Helper function to insert example link into textarea or input
    const insertExampleLink = (
        element: HTMLTextAreaElement | HTMLInputElement
    ) => {
        const exampleLink = '[example](https://www.example.com)';
        const start = element.selectionStart || 0;
        const end = element.selectionEnd || 0;
        const currentValue = element.value;

        // Insert the example link at cursor position
        const newValue =
            currentValue.substring(0, start) +
            exampleLink +
            currentValue.substring(end);

        // Return the new value and the position to set cursor after the inserted text
        return {
            newValue,
            cursorPosition: start + exampleLink.length
        };
    };

    const buildContentDataForSave = useCallback((): BriefContentSave => {
        return normalizeBriefContentSave({
            learningOutcomes,
            keyExpectations,
            deliverables,
            resources,
            rubricCriteria,
            howWorkMarked,
            checklistItems,
            subheadings,
            onePageSummaryContent,
            submissionFormFields: submissionFormFields.map((field) => ({
                title: field.title,
                placeholder: field.placeholder,
                optionalDescription: field.optionalDescription || ''
            })),
            customSubsections,
            hiddenProjectDetailSubsections:
                hiddenProjectDetailSubsections.filter(
                    (id): id is RemovableProjectDetailSubsectionId =>
                        (
                            [
                                'learning-outcomes',
                                'key-expectations',
                                'deliverables',
                                'resources'
                            ] as const
                        ).includes(id as RemovableProjectDetailSubsectionId)
                ),
            hiddenCustomSubsectionIds,
            projectDetailBlockOrder,
            schedulePhases: normalizeSchedulePhases(schedulePhases),
            scheduleViews: {
                table: Boolean(scheduleViews.table),
                gantt: Boolean(scheduleViews.gantt)
            },
            hiddenAssignmentSettings: hiddenAssignmentSettings.filter(
                (id): id is AssignmentSettingId => isAssignmentSettingId(id)
            ),
            requireNotebook: Boolean(requireNotebook),
            requireLogs: Boolean(requireLogs),
            requireAiLog: Boolean(requireAiLog),
            assignmentLogs,
            selfAssessmentLinkEnabled,
            aiPolicy: {
                source: aiPolicy.source,
                aiasLevels: aiPolicy.aiasLevels,
                usageLogEnabled: Boolean(requireAiLog),
                policyRationale: aiPolicy.policyRationale,
                assessmentGuidance: aiPolicy.assessmentGuidance
            },
            faqItems: faqItems.map((item) => ({
                question: item.question,
                answer:
                    typeof item.answer === 'string'
                        ? item.answer
                        : richTextToPlainText(item.answer)
            }))
        } as BriefContentSave);
    }, [
        learningOutcomes,
        keyExpectations,
        deliverables,
        resources,
        rubricCriteria,
        howWorkMarked,
        checklistItems,
        subheadings,
        onePageSummaryContent,
        submissionFormFields,
        customSubsections,
        hiddenProjectDetailSubsections,
        hiddenCustomSubsectionIds,
        projectDetailBlockOrder,
        schedulePhases,
        scheduleViews,
        hiddenAssignmentSettings,
        requireNotebook,
        requireLogs,
        requireAiLog,
        assignmentLogs,
        selfAssessmentLinkEnabled,
        aiPolicy,
        faqItems
    ]);

    const contentFingerprint = useMemo(
        () => JSON.stringify(buildContentDataForSave()),
        [buildContentDataForSave]
    );

    const savedContentSnapshotRef = useRef<BriefContentSave | null>(null);
    const savedSnapshotInitializedRef = useRef(false);
    const [savedContentFingerprint, setSavedContentFingerprint] = useState<
        string | null
    >(null);

    useEffect(() => {
        if (savedSnapshotInitializedRef.current) return;
        savedSnapshotInitializedRef.current = true;
        const initial = buildContentDataForSave();
        savedContentSnapshotRef.current = structuredClone(initial);
        setSavedContentFingerprint(JSON.stringify(initial));
    }, [buildContentDataForSave]);

    const hasUnsavedContentChanges = useMemo(
        () =>
            savedContentFingerprint !== null &&
            contentFingerprint !== savedContentFingerprint,
        [contentFingerprint, savedContentFingerprint]
    );

    useEffect(() => {
        if (savedContentFingerprint === null) return;
        if (contentFingerprint !== savedContentFingerprint) {
            setIsDirty(true);
        }
    }, [contentFingerprint, savedContentFingerprint, setIsDirty]);

    const applySavedContentSnapshot = useCallback(
        (snapshot: BriefContentSave) => {
            setLearningOutcomes(snapshot.learningOutcomes);
            setKeyExpectations(
                snapshot.keyExpectations as Array<{
                    title: string;
                    description: RichTextContent;
                }>
            );
            setDeliverables(
                snapshot.deliverables as Array<{
                    title: string;
                    description: RichTextContent;
                }>
            );
            setResources(
                snapshot.resources as Array<{
                    title: string;
                    description: RichTextContent;
                }>
            );
            setRubricCriteria(snapshot.rubricCriteria as RubricCriterion[]);
            setHowWorkMarked(
                snapshot.howWorkMarked as Array<{
                    title: string;
                    description: RichTextContent;
                }>
            );
            setChecklistItems(snapshot.checklistItems);
            setSubheadings(
                snapshot.subheadings as { [key: string]: RichTextContent }
            );
            setOnePageSummaryContent(
                snapshot.onePageSummaryContent as {
                    [key: string]: RichTextContent;
                }
            );
            setSubmissionFormFields(
                snapshot.submissionFormFields.map((field) => ({
                    title: field.title,
                    placeholder: field.placeholder,
                    optionalDescription: field.optionalDescription || ''
                }))
            );
            setCustomSubsections(
                snapshot.customSubsections as CustomSubsection[]
            );
            setHiddenCustomSubsectionIds(snapshot.hiddenCustomSubsectionIds);
            setHiddenProjectDetailSubsections(
                snapshot.hiddenProjectDetailSubsections
            );
            setProjectDetailBlockOrder(snapshot.projectDetailBlockOrder);
            setSchedulePhases(
                (snapshot.schedulePhases?.length
                    ? snapshot.schedulePhases
                    : [createDefaultSchedulePhase()]) as SchedulePhase[]
            );
            setSchedulePhaseIds(
                newSchedulePhaseSortIds(
                    snapshot.schedulePhases?.length
                        ? snapshot.schedulePhases.length
                        : 1
                )
            );
            setScheduleViews({
                table: Boolean(snapshot.scheduleViews?.table),
                gantt: Boolean(snapshot.scheduleViews?.gantt)
            });
            setRequireNotebook(Boolean(snapshot.requireNotebook));
            setRequireLogs(Boolean(snapshot.requireLogs));
            setRequireAiLog(
                Boolean(
                    snapshot.requireAiLog ?? snapshot.aiPolicy.usageLogEnabled
                )
            );
            setAssignmentLogs(
                normalizeAssignmentLogs(snapshot.assignmentLogs)
            );
            setHiddenAssignmentSettings(
                (snapshot.hiddenAssignmentSettings ?? []).filter(
                    (id): id is AssignmentSettingId =>
                        isAssignmentSettingId(id)
                )
            );
            setAiPolicy({
                source: snapshot.aiPolicy.source,
                aiasLevels: snapshot.aiPolicy.aiasLevels ?? [],
                usageLogEnabled: Boolean(
                    snapshot.requireAiLog ?? snapshot.aiPolicy.usageLogEnabled
                ),
                policyRationale: snapshot.aiPolicy.policyRationale ?? '',
                assessmentGuidance: snapshot.aiPolicy.assessmentGuidance
            });
            const revertedFaq = snapshot.faqItems ?? [];
            setFaqItems(
                revertedFaq.length > 0 ? revertedFaq : [createEmptyFaqItem()]
            );
            updateContent(snapshot);
        },
        [updateContent]
    );

    const handleConfirmRevertContent = useCallback(() => {
        const snapshot = savedContentSnapshotRef.current;
        if (!snapshot) return;
        applySavedContentSnapshot(structuredClone(snapshot));
        setSavedContentFingerprint(JSON.stringify(snapshot));
        setIsDirty(false);
        refreshPublishAssets();
        setRevertConfirmDialogOpen(false);
    }, [
        applySavedContentSnapshot,
        refreshPublishAssets,
        setIsDirty
    ]);

    const handleSaveContent = async (): Promise<boolean> => {
        setIsSaving(true);
        try {
            if (hasInvalidSchedulePhases()) {
                setScheduleValidationDialogOpen(true);
                return false;
            }

            if (
                aiPolicy.source === 'aias' &&
                aiPolicy.aiasLevels.length === 0
            ) {
                alert(
                    'Select at least one AI Assessment Scale level, or choose a different policy source.'
                );
                return false;
            }

            const contentData = buildContentDataForSave();

            if (saveBriefContent) {
                const ok = await saveBriefContent(contentData);
                if (!ok) {
                    alert('Failed to save template content');
                    return false;
                }

                setCustomSubsections(contentData.customSubsections as CustomSubsection[]);
                setHiddenCustomSubsectionIds(contentData.hiddenCustomSubsectionIds);
                setProjectDetailBlockOrder(contentData.projectDetailBlockOrder);
                updateContent(contentData);
                savedContentSnapshotRef.current = structuredClone(contentData);
                setSavedContentFingerprint(JSON.stringify(contentData));
                setIsDirty(false);
                return true;
            }

            if (!briefId) {
                return false;
            }

            const response = await fetch(`/api/briefs/${briefId}/content`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(contentData)
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Save failed:', errorData);
                if (response.status === 400 && errorData.issues) {
                    const fieldErrors = errorData.issues?.fieldErrors || {};
                    const messages = Object.entries(fieldErrors)
                        .flatMap(([field, errs]) =>
                            (Array.isArray(errs) ? errs : []).map(
                                (msg) => `${field}: ${msg}`
                            )
                        )
                        .slice(0, 5)
                        .join('\n');
                    alert(
                        `Failed to save: ${errorData.error || 'Invalid content'}${messages ? `\n\n${messages}` : ''}`
                    );
                } else {
                    alert(
                        `Failed to save: ${errorData.error || 'Unknown error'}`
                    );
                }
                return false;
            }

            const result = await response.json();
            console.log('Content saved successfully:', result);

            setCustomSubsections(contentData.customSubsections as CustomSubsection[]);
            setHiddenCustomSubsectionIds(contentData.hiddenCustomSubsectionIds);
            setProjectDetailBlockOrder(contentData.projectDetailBlockOrder);
            updateContent(contentData);
            savedContentSnapshotRef.current = structuredClone(contentData);
            setSavedContentFingerprint(JSON.stringify(contentData));
            setIsDirty(false);
            return true;
        } catch (error) {
            console.error('Failed to save content:', error);
            alert(
                `Error saving content: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to gather full brief context for AI generation
    const getBriefContext = () => ({
        briefName: briefMetadata?.title || 'Untitled Brief',
        briefModule: briefMetadata?.module || 'Untitled Module',
        briefLecturer: briefMetadata?.lecturer || 'Untitled Lecturer',
        briefStartDate: briefMetadata?.startDate || 'Untitled Start Date',
        briefSubmissionDate:
            briefMetadata?.submissionDate || 'Untitled Submission Date',
        briefIndividualGroup:
            briefMetadata?.individualGroup || 'Untitled Individual Group',
        title: initialContent?.title || 'Untitled Brief',
        /** Human-readable programme name for AI prompts (`programmes.name`, not `template_key`). */
        programme: programmeDisplayName,
        overview: richTextToPlainText(
            subheadings['project-overview-content'] || ''
        ),
        customSubsections: customSubsections.map((section) => ({
            ...section,
            content: richTextToPlainText(section.content),
            items: section.items?.map((item) => ({
                ...item,
                content: richTextToPlainText(item.content)
            }))
        })),
        learningOutcomes: learningOutcomes.filter((lo) => lo.title),
        keyExpectations: keyExpectations.filter((ke) => ke.title),
        deliverables: deliverables.filter((d) => d.title),
        resources: resources.filter((r) => r.title),
        rubricCriteria: rubricCriteria.filter((rc) => rc.criterion),
        howWorkMarked: howWorkMarked.filter((hwm) => hwm.title),
        checklistItems: checklistItems.filter((item) => item),
        submissionFormFields: submissionFormFields.filter((f) => f.title),
        schedulePhases: normalizeSchedulePhases(schedulePhases)
    });

    // Generate one-page summary using AI (expects non-empty resolved subsections)
    const runGenerateOnePageSummary = async (subsections: any[]) => {
        setIsGeneratingSummary(true);
        try {
            const exampleFormat = subsections.reduce(
                (acc, sub, idx) => {
                    const key = canonicalOnePageSubsectionKey(sub, idx);
                    acc[key] = 'Generated content here...';
                    return acc;
                },
                {} as Record<string, string>
            );

            const exactJsonKeys = subsections
                .map((sub, idx) => canonicalOnePageSubsectionKey(sub, idx))
                .join('", "');

            const parsedContent = await generateAIContent({
                context: getBriefContext(),
                prompt:
                    'Write a concise, plain language summary that allows a student to understand the assignment in under two minutes. Include headings such as Overview, Key Dates, Weighting Summary, Project Schedule. Format your response as valid JSON with each subsection title as a key and the content as the value. For the Overview section: One to three sentences only. State whether it is individual or group work. State what the student will make or do. Name the core tools if relevant. For the Key Dates section: use List format using dashes to separate each item. Pull dates directly from the assessment brief details such as start date and submission datetime. Write dates and times in plain student-facing language for Ireland (for example day, month name, year, and local time when relevant). If the brief context shows technical ISO timestamps, translate them into that readable form rather than pasting raw ISO strings. Include the start and end dates of the project. For the Weighting Summary section: use List format using dashes to separate each item. Describe what learning is assessed and how students may demonstrate it. Use neutral language that does not assume all students submit artefacts. Summarise tangible outputs or assessment activities only where they are explicitly stated. Do not invent submission formats. For the Project Schedule section: List all the phases along with the start/end dates of each phase of the project as short bullet points using dashes for each item, in logical order. Do not include deadlines unless explicitly stated in the brief. Use ISO 8601 format for the dates. Do not include any other text or commentary. Do not include any markdown code blocks or formatting, no emojis, icons, tables, No em dashes, No extra commentary or explanations. Return ONLY the raw JSON object. Include all the required fields in the JSON object. IMPORTANT: Every JSON value MUST be a single plain string. For lists, put each bullet on its own line inside that string (lines starting with dash and space), never use JSON arrays as values. CRITICAL: Each JSON property key MUST match exactly one of these strings (same spelling and casing): "' +
                    exactJsonKeys +
                    '".',
                exampleFormat
            });

            setOnePageSummaryContent(
                normalizeOnePageSummaryFromAi(parsedContent, subsections)
            );
            setIsDirty(true);
        } catch (error) {
            console.error('Failed to generate summary:', error);
            alert(
                `Error generating summary: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const requestGenerateOnePageSummary = (passedSubsections: any[]) => {
        const resolved = resolveOnePageSummarySubsections(passedSubsections);
        if (!resolved.length) {
            alert(
                'Could not determine One Page Summary fields. Try reloading the page.'
            );
            return;
        }
        if (onePageSummaryHasReplacableContent()) {
            pendingOnePageSummarySubsectionsRef.current = resolved;
            setReplaceOnePageSummaryDialogOpen(true);
            return;
        }
        void runGenerateOnePageSummary(resolved);
    };

    // Track scroll position to show/hide header button
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        const changeStructureButton = changeStructureButtonRef.current;

        if (!scrollContainer || !changeStructureButton) return;

        const handleScroll = () => {
            const buttonRect = changeStructureButton.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();

            // Show header button when change structure button is scrolled past
            const isButtonHidden = buttonRect.bottom < containerRect.top;
            setShowHeaderButton(isButtonHidden);

            // Hide helper overlay when user reaches very bottom of the panel
            const bottomThreshold = 12;
            const atBottom =
                scrollContainer.scrollTop + scrollContainer.clientHeight >=
                scrollContainer.scrollHeight - bottomThreshold;
            setIsAtBottom(atBottom);

            // Hide helper overlay at the top of the panel
            const topThreshold = 12;
            setIsAtTop(scrollContainer.scrollTop <= topThreshold);
        };

        handleScroll();
        scrollContainer.addEventListener('scroll', handleScroll);
        return () =>
            scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    // Track currently viewed section in the left panel for dynamic overlay controls
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer || enabledSections.length === 0) {
            return;
        }

        const updateActiveSection = () => {
            const containerTop = scrollContainer.getBoundingClientRect().top;
            let closestSectionId = enabledSections[0]?.id ?? null;
            let closestDistance = Number.POSITIVE_INFINITY;

            enabledSections.forEach((section) => {
                const sectionEl = sectionRefs.current[section.id];
                if (!sectionEl) return;

                const distance = Math.abs(
                    sectionEl.getBoundingClientRect().top - containerTop - 24
                );

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestSectionId = section.id;
                }
            });

            setActiveSectionId(closestSectionId);
        };

        updateActiveSection();
        scrollContainer.addEventListener('scroll', updateActiveSection);
        window.addEventListener('resize', updateActiveSection);

        return () => {
            scrollContainer.removeEventListener('scroll', updateActiveSection);
            window.removeEventListener('resize', updateActiveSection);
        };
    }, [enabledSections]);

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            setWeekSelectionState((prev) =>
                prev ? { ...prev, isDragging: false } : null
            );
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, []);

    return (
        <div className='relative flex h-full min-h-0 w-full flex-col bg-card'>
            <div
                className='flex items-center justify-between gap-4 border-b bg-background p-4 px-6'
                data-tour='brief-builder-content-toolbar'>
                <div className='min-w-0'>
                    <h2 className='text-xl font-normal tracking-tight'>
                        Content{' '}
                        <span className='text-muted-foreground text-sm'>
                            <p className='text-sm font-light text-muted-foreground'>
                                Build your assessment brief by adding content
                            </p>
                        </span>
                    </h2>
                </div>

                {/* Save button in header - shows when scrolled past Change Structure */}
                {/* {showHeaderButton && ( */}

                <div className='flex shrink-0 items-center gap-2'>
                    {builderMode === 'brief' && briefId ? (
                        <>
                            <div className='border border-brand'>
                                <CollaboratorsDialog
                                    briefId={parseInt(briefId, 10)}
                                    accessRole={accessRole}
                                />
                            </div>
                            <div className='border border-brand'>
                                <Button
                                    variant='outline'
                                    asChild
                                    size='sm'
                                    className='font-normal cursor-pointer '>
                                    <NextLink
                                        href={`/briefs/${briefId}/edit`}
                                        className='border'>
                                        <Pencil className=' h-4 w-4' />
                                        Edit Details
                                    </NextLink>
                                </Button>
                            </div>
                        </>
                    ) : null}
                    <div className='border border-brand'>
                        <Button
                            variant='outline'
                            size='sm'
                            className='font-normal cursor-pointer'
                            onClick={openStructureSheet}>
                            <ListOrdered className='h-4 w-4' />
                            Brief Structure
                        </Button>
                    </div>
                    {!isStudentPreviewOpen && (
                        <Button
                            type='button'
                            variant='default'
                            size='sm'
                            className='font-normal cursor-pointer'
                            onClick={() => setStudentPreviewOpenWithLayout(true)}
                            title='Show student preview panel'>
                            <Eye className='h-4 w-4 mr-1.5' />
                            Show Preview
                        </Button>
                    )}
                </div>
            </div>

            <div className='flex min-h-0 flex-1 flex-col dotted-background'>
            <div
                ref={scrollContainerRef}
                data-panel-scroll-container='left'
                data-tour='brief-builder-editor-area'
                className='flex-1 min-h-0 overflow-y-auto overscroll-y-contain'>
                <div
                    className={cn(
                        'min-w-0',
                        !isStudentPreviewOpen && 'mx-auto w-full max-w-7xl'
                    )}>
                <div className='min-w-0 space-y-8 p-8'>
                    {/* <div ref={changeStructureButtonRef}>
                        <Button
                            size='sm'
                            className='font-normal cursor-pointer mb-6'
                            onClick={openStructureSheet}>
                            <Form className='mr-2 h-4 w-4' />
                            Change Structure
                        </Button>
                    </div> */}

                    <Sheet open={isSheetOpen} onOpenChange={handleStructureSheetOpenChange}>
                        <SheetContent
                            side='left'
                            className='w-[400px] sm:w-[540px] flex flex-col'
                            onPointerDownOutside={(event) => {
                                if (isSelectPortalTarget(event.target)) {
                                    event.preventDefault();
                                }
                            }}
                            onFocusOutside={(event) => {
                                if (isSelectPortalTarget(event.target)) {
                                    event.preventDefault();
                                }
                            }}>
                            <SheetHeader>
                                <SheetTitle className='font-normal tracking-tight'>
                                    Brief Structure
                                </SheetTitle>
                                <SheetDescription className='font-light'>
                                    {builderMode === 'template'
                                        ? 'Set whether each section is required, recommended, or optional. Uncheck a section to hide it by default on new briefs.'
                                        : 'Reorder sections by dragging and toggle visibility'}
                                </SheetDescription>
                            </SheetHeader>

                            <div className='flex-1 overflow-y-auto mt-6 pr-2'>
                                <DndContext
                                    id='brief-sections-sort'
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}>
                                    <SortableContext
                                        items={sections.map((s) => s.id)}
                                        strategy={verticalListSortingStrategy}>
                                        <div className='space-y-2'>
                                            {sections.map((section) => (
                                                <SortableSectionItem
                                                    key={section.id}
                                                    section={section}
                                                    builderMode={builderMode}
                                                    onToggle={
                                                        handleToggleSection
                                                    }
                                                    onVisibilityChange={
                                                        builderMode ===
                                                        'template'
                                                            ? handleVisibilityChange
                                                            : undefined
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            </div>

                            <div className='border-t pt-4 mt-4 flex gap-2'>
                                <Button
                                    variant='link'
                                    onClick={() => {
                                        if (structureSheetSnapshotRef.current) {
                                            setSections(
                                                structureSheetSnapshotRef.current
                                            );
                                            structureSheetSnapshotRef.current =
                                                null;
                                        }
                                        setIsSheetOpen(false);
                                    }}
                                    className='flex-1 font-normal'>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveStructure}
                                    disabled={isSaving}
                                    className='flex-1 font-normal'>
                                    {isSaving ? 'Saving...' : 'Save Structure'}
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                    <Sheet
                        open={isScheduleSheetOpen}
                        onOpenChange={setIsScheduleSheetOpen}>
                        <SheetContent
                            side='left'
                            className='w-full sm:max-w-2xl flex flex-col'>
                            <SheetHeader>
                                <SheetTitle className='font-normal tracking-tight'>
                                    Schedule
                                </SheetTitle>
                                <SheetDescription className='font-light'>
                                    Add timeline phases using either exact dates
                                    or a week-range picker. Drag phases by the
                                    grip to reorder.
                                </SheetDescription>
                            </SheetHeader>
                            <div className='flex-1 overflow-y-auto mt-6 space-y-4 pr-2'>
                                <DndContext
                                    id='schedule-phases-sort'
                                    sensors={schedulePhaseDragSensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleSchedulePhaseDragEnd}>
                                    <SortableContext
                                        items={schedulePhaseIds}
                                        strategy={verticalListSortingStrategy}>
                                        <div className='space-y-4'>
                                            {schedulePhases.map(
                                                (phase, phaseIndex) => {
                                                    const sortId =
                                                        schedulePhaseIds[
                                                            phaseIndex
                                                        ];
                                                    if (!sortId) return null;
                                                    return (
                                                        <SortableSchedulePhaseCard
                                                            key={sortId}
                                                            sortId={sortId}
                                                            phaseIndex={
                                                                phaseIndex
                                                            }
                                                            phase={phase}
                                                            assignmentMinDate={
                                                                assignmentMinDate
                                                            }
                                                            assignmentMaxDate={
                                                                assignmentMaxDate
                                                            }
                                                            weekSlots={
                                                                weekSlots
                                                            }
                                                            weekSelectionState={
                                                                weekSelectionState
                                                            }
                                                            setWeekSelectionState={
                                                                setWeekSelectionState
                                                            }
                                                            updateSchedulePhase={
                                                                updateSchedulePhase
                                                            }
                                                            removeSchedulePhase={
                                                                removeSchedulePhase
                                                            }
                                                        />
                                                    );
                                                }
                                            )}
                                        </div>
                                    </SortableContext>
                                </DndContext>

                                {hasInvalidSchedulePhases() && (
                                    <p className='text-xs text-red-600 font-light'>
                                        One or more phase timings are invalid.
                                        Date ranges must sit inside assignment
                                        dates, and week selections must be a
                                        valid range.
                                    </p>
                                )}
                                <div className='flex justify-end '>
                                    <div className='flex items-center gap-2'>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            onClick={addSchedulePhase}
                                            className='font-light'>
                                            <Plus className='h-4 w-4 mr-1' />
                                            Add Phase
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className='border-t pt-4 mt-4 flex gap-2 shrink-0'>
                                {/* <Button
                                    variant='link'
                                    type='button'
                                    onClick={() =>
                                        setIsScheduleSheetOpen(false)
                                    }
                                    disabled={isSaving}
                                    className='flex-1 font-normal'>
                                    Cancel
                                </Button> */}
                                <Button
                                    type='button'
                                    onClick={async () => {
                                        const ok = await handleSaveContent();
                                        if (ok) setIsScheduleSheetOpen(false);
                                    }}
                                    disabled={isSaving}
                                    className='flex-1 font-normal'>
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>

                    {reviewSource && briefId ? (
                        <div className='sticky -top-0 z-40 -mx-8 mb-4 flex justify-center px-8 py-2'>
                            <BriefReviewNotice
                                briefId={parseInt(briefId, 10)}
                                source={reviewSource}
                                className='shadow-md'
                            />
                        </div>
                    ) : null}

                    {/* Dynamic Section Rendering */}
                    <div className='space-y-12'>
                        {enabledSections.map((section) => (
                            <div
                                key={section.id}
                                ref={(node) => {
                                    sectionRefs.current[section.id] = node;
                                }}
                                className='space-y-6'>
                                {section.id === 'project-details' &&
                                    section.templateData?.subsections && (
                                        <>
                                            <div className='flex flex-wrap items-center justify-between gap-4'>
                                                <h3 className='font-extralight tracking-tight text-3xl min-w-0'>
                                                    Brief Details
                                                </h3>
                                                {/* {briefMetadata.individualGroup.trim() ? (
                                                    <Badge
                                                        variant='secondary'
                                                        className='font-normal shrink-0'>
                                                        {
                                                            briefMetadata.individualGroup
                                                        }
                                                    </Badge>
                                                ) : null} */}
                                            </div>
                                            <div className='rounded-none border bg-card p-4 sm:p-5'>
                                                <dl className='grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm min-w-0'>
                                                <div className='min-w-0'>
                                                    <dt className='font-light text-muted-foreground'>
                                                        Programme
                                                    </dt>
                                                    <dd className='font-normal mt-0.5 break-words'>
                                                        {programmeDisplayName}
                                                    </dd>
                                                </div>
                                                <div className='min-w-0'>
                                                    <dt className='font-light text-muted-foreground'>
                                                        Module
                                                    </dt>
                                                    <dd className='font-normal mt-0.5 break-words'>
                                                        {briefDetailLine(
                                                            briefMetadata.module
                                                        )}
                                                    </dd>
                                                </div>
                                                <div className='sm:col-span-2 min-w-0'>
                                                    <dt className='font-light text-muted-foreground'>
                                                        Assignment title
                                                    </dt>
                                                    <dd className='font-normal mt-0.5 break-words'>
                                                        {briefDetailLine(
                                                            briefMetadata.title
                                                        )}
                                                    </dd>
                                                </div>
                                                <div className='sm:col-span-2 min-w-0'>
                                                    <dt className='font-light text-muted-foreground'>
                                                        Lecturer(s)
                                                    </dt>
                                                    <dd className='font-normal mt-0.5 break-words'>
                                                        {briefDetailLine(
                                                            briefMetadata.lecturer
                                                        )}
                                                    </dd>
                                                </div>
                                                <div className='min-w-0'>
                                                    <dt className='font-light text-muted-foreground'>
                                                        Start
                                                    </dt>
                                                    <dd className='font-normal mt-0.5'>
                                                        {formatBriefDateTime(
                                                            briefMetadata.startDate
                                                        )}
                                                    </dd>
                                                </div>
                                                <div className='min-w-0'>
                                                    <dt className='font-light text-muted-foreground'>
                                                        Submission
                                                    </dt>
                                                    <dd className='font-normal mt-0.5'>
                                                        {formatBriefDateTime(
                                                            briefMetadata.submissionDate
                                                        )}
                                                    </dd>
                                                </div>
                                            </dl>
                                            </div>
                                            {(getVisibleAssignmentSettingIds(
                                                hiddenAssignmentSettings
                                            ).length > 0 ||
                                                (builderMode === 'template' &&
                                                    getHiddenAssignmentSettingIds(
                                                        hiddenAssignmentSettings
                                                    ).length > 0)) && (
                                                <div className='space-y-3'>
                                                    {getVisibleAssignmentSettingIds(
                                                        hiddenAssignmentSettings
                                                    ).length > 0 ? (
                                                        <h4 className='font-extralight tracking-tight text-xl min-w-0'>
                                                            Settings
                                                        </h4>
                                                    ) : null}
                                                    <BuilderAssignmentSettings
                                                        showRequireNotebook={isAssignmentSettingVisible(
                                                            'require-notebook',
                                                            hiddenAssignmentSettings
                                                        )}
                                                        requireNotebook={
                                                            requireNotebook
                                                        }
                                                        onRequireNotebookChange={(
                                                            checked
                                                        ) => {
                                                            setRequireNotebook(
                                                                checked
                                                            );
                                                            setIsDirty(true);
                                                        }}
                                                        onHideRequireNotebook={
                                                            builderMode ===
                                                            'template'
                                                                ? () =>
                                                                      hideAssignmentSetting(
                                                                          'require-notebook'
                                                                      )
                                                                : undefined
                                                        }
                                                        showRequireLogs={isAssignmentSettingVisible(
                                                            'require-logs',
                                                            hiddenAssignmentSettings
                                                        )}
                                                        requireLogs={requireLogs}
                                                        assignmentLogs={
                                                            assignmentLogs.length >
                                                                0 || !requireLogs
                                                                ? assignmentLogs
                                                                : [
                                                                      createDefaultAssignmentLogDefinition()
                                                                  ]
                                                        }
                                                        onRequireLogsChange={(
                                                            checked
                                                        ) => {
                                                            setRequireLogs(
                                                                checked
                                                            );
                                                            if (
                                                                checked &&
                                                                assignmentLogs.length ===
                                                                    0
                                                            ) {
                                                                setAssignmentLogs(
                                                                    [
                                                                        createDefaultAssignmentLogDefinition()
                                                                    ]
                                                                );
                                                            }
                                                            setIsDirty(true);
                                                        }}
                                                        onAssignmentLogsChange={(
                                                            nextLogs
                                                        ) => {
                                                            setAssignmentLogs(
                                                                nextLogs
                                                            );
                                                            setIsDirty(true);
                                                        }}
                                                        onHideRequireLogs={
                                                            builderMode ===
                                                            'template'
                                                                ? () =>
                                                                      hideAssignmentSetting(
                                                                          'require-logs'
                                                                      )
                                                                : undefined
                                                        }
                                                        showRequireAiLog={isAssignmentSettingVisible(
                                                            'require-ai-log',
                                                            hiddenAssignmentSettings
                                                        )}
                                                        requireAiLog={
                                                            requireAiLog
                                                        }
                                                        onRequireAiLogChange={(
                                                            checked
                                                        ) => {
                                                            setRequireAiLog(
                                                                checked
                                                            );
                                                            setAiPolicy(
                                                                (current) => ({
                                                                    ...current,
                                                                    usageLogEnabled:
                                                                        checked
                                                                })
                                                            );
                                                            setIsDirty(true);
                                                        }}
                                                        onHideRequireAiLog={
                                                            builderMode ===
                                                            'template'
                                                                ? () =>
                                                                      hideAssignmentSetting(
                                                                          'require-ai-log'
                                                                      )
                                                                : undefined
                                                        }
                                                    />
                                                    {builderMode ===
                                                        'template' &&
                                                    getHiddenAssignmentSettingIds(
                                                        hiddenAssignmentSettings
                                                    ).length > 0 ? (
                                                        <AssignmentSettingsRestoreBadges
                                                            hiddenSettingIds={
                                                                hiddenAssignmentSettings
                                                            }
                                                            onRestore={
                                                                restoreAssignmentSetting
                                                            }
                                                        />
                                                    ) : null}
                                                </div>
                                            )}
                                        </>
                                    )}
                                <div className='flex items-start justify-between gap-4 flex-wrap'>
                                    <div className='min-w-0 space-y-2'>
                                        <h3 className='font-extralight tracking-tight text-3xl min-w-0 flex items-center gap-3'>
                                            <span>{section.label}</span>
                                            {section.id === 'rubric' && (
                                                <span
                                                    className={weightTotalBadgeClass(
                                                        rubricTotalPercentage
                                                    )}>
                                                    {rubricTotalPercentage}%
                                                </span>
                                            )}
                                        </h3>
                                        {section.id === 'project-details' && (
                                            <ProjectDetailAddBadges
                                                hiddenBuiltinSubsections={
                                                    hiddenProjectDetailSubsections
                                                }
                                                onRestoreBuiltin={
                                                    restoreProjectDetailSubsection
                                                }
                                                onAddText={() =>
                                                    addCustomSubsection('text')
                                                }
                                                onAddAccordion={() =>
                                                    addCustomSubsection(
                                                        'accordion'
                                                    )
                                                }
                                                className='mt-1 -mb-4'
                                            />
                                        )}
                                    </div>
                                    {section.id === 'submission-form' && (
                                        <div className='flex items-center gap-2 shrink-0'>
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='link'
                                                onClick={
                                                    addSubmissionDeclarationField
                                                }
                                                className='font-light'>
                                                <Plus className='h-4 w-4 mr-1' />
                                                Add Declaration
                                            </Button>
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='link'
                                                onClick={addSubmissionFormField}
                                                className='font-light'>
                                                <Plus className='h-4 w-4 mr-1' />
                                                Add Field
                                            </Button>
                                        </div>
                                    )}
                                    {section.id === 'submission-checklist' && (
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='link'
                                            onClick={addChecklistItem}
                                            className='font-light shrink-0'>
                                            <Plus className='h-4 w-4 mr-1' />
                                            Add Item
                                        </Button>
                                    )}
                                    {section.id === 'schedule' && (
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            onClick={() =>
                                                setIsScheduleSheetOpen(true)
                                            }
                                            className='font-light shrink-0'>
                                            <Pencil className='h-4 w-4 mr-1' />
                                            {scheduleCtaLabel}
                                        </Button>
                                    )}

                                    {section.id === 'one-page-summary' && (
                                        <AiFeatureDisabledHint enabled={useAI}>
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='outline'
                                                onClick={() =>
                                                    requestGenerateOnePageSummary(
                                                        section.templateData
                                                            ?.subsections || []
                                                    )
                                                }
                                                disabled={isGeneratingSummary}
                                                className='font-light'>
                                                <Sparkles className='h-4 w-4 mr-1' />
                                                {isGeneratingSummary
                                                    ? 'Generating...'
                                                    : 'Generate'}
                                            </Button>
                                        </AiFeatureDisabledHint>
                                    )}
                                </div>

                                {/* Project Details Section */}
                                {section.id === 'project-details' &&
                                    section.templateData?.subsections && (
                                        <DndContext
                                            id='project-details-subsections-sort'
                                            sensors={projectDetailDragSensors}
                                            collisionDetection={closestCenter}
                                            onDragStart={
                                                handleProjectDetailDragStart
                                            }
                                            onDragEnd={
                                                handleProjectDetailBlockDragEnd
                                            }
                                            onDragCancel={() =>
                                                setProjectDetailDragActiveId(
                                                    null
                                                )
                                            }>
                                            <SortableContext
                                                items={
                                                    visibleProjectDetailBlockIds
                                                }
                                                strategy={
                                                    verticalListSortingStrategy
                                                }>
                                                <div className='border bg-card mb-0 border-b-0'>
                                                    {visibleProjectDetailBlockIds.map(
                                                        (blockId) => (
                                                            <SortableProjectDetailBlock
                                                                key={blockId}
                                                                sortId={blockId}>
                                                                {(() => {
                                                    // Project Overview
                                                    if (
                                                        blockId ===
                                                        'project-overview-content'
                                                    ) {
                                                        return (
                                                            <React.Fragment
                                                                key={blockId}>
                                                                <div className='md:border-r border-b'>
                                                                    <div className='font-normal p-4 sm:py-4 sm:px-4 flex items-start gap-2'>
                                                                        <ProjectDetailGrip className='mt-0.5' />
                                                                        <p>
                                                                            Project
                                                                            Overview
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className='col-span-1 border-b'>
                                                                    <RichTextPlateEditor
                                                                        placeholder='Enter project overview...'
                                                                        className='min-h-[100px] font-light leading-relaxed p-4 sm:pb-4 sm:px-4 border-0 rounded-none bg-muted/50 focus-visible:bg-muted/80 p-1 dark:bg-input/30 dark:focus-visible:bg-input/50'
                                                                        value={
                                                                            subheadings[
                                                                                blockId
                                                                            ] ||
                                                                            ''
                                                                        }
                                                                        onChange={(
                                                                            nextValue
                                                                        ) =>
                                                                            setSubheadings(
                                                                                {
                                                                                    ...subheadings,
                                                                                    [blockId]:
                                                                                        nextValue
                                                                                }
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }

                                                    // Learning Outcomes
                                                    if (
                                                        blockId ===
                                                        'learning-outcomes'
                                                    ) {
                                                        return (
                                                            <React.Fragment
                                                                key={blockId}>
                                                                <div
                                                                    className='md:border-r row-span-1 border-b min-w-0'
                                                                    style={{
                                                                        gridRow: `span ${learningOutcomes.length + 1}`
                                                                    }}>
                                                                    <div className='font-normal h-full flex flex-col justify-between p-4 sm:py-4 sm:px-4 min-w-0 gap-2'>
                                                                        <div className='flex items-start gap-2 min-w-0'>
                                                                            <ProjectDetailGrip className='mt-1' />
                                                                            <div className='min-w-0 space-y-2 flex-1'>
                                                                            <div className='flex items-start justify-between gap-2'>
                                                                                <p className='break-normal leading-snug pr-0 flex items-center gap-2 flex-wrap'>
                                                                                    <span>
                                                                                        Learning
                                                                                        Outcomes
                                                                                        Assessed
                                                                                    </span>
                                                                                    <span
                                                                                        className={weightTotalBadgeClass(
                                                                                            learningOutcomesTotalPercentage,
                                                                                            {
                                                                                                neutralWhenZero: true
                                                                                            }
                                                                                        )}>
                                                                                        {
                                                                                            learningOutcomesTotalPercentage
                                                                                        }
                                                                                        %
                                                                                    </span>
                                                                                </p>
                                                                                <Button
                                                                                    type='button'
                                                                                    size='icon'
                                                                                    variant='ghost'
                                                                                    onClick={() =>
                                                                                        removeProjectDetailSubsection(
                                                                                            'learning-outcomes'
                                                                                        )
                                                                                    }
                                                                                    className='shrink-0 h-7 w-7 text-destructive hover:text-destructive'
                                                                                    aria-label='Remove Learning Outcomes Assessed'>
                                                                                    <X className='h-4 w-4' />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                        </div>
                                                                        <p
                                                                            className={cn(
                                                                                'font-light text-sm',
                                                                                learningOutcomesHasWeighting &&
                                                                                    learningOutcomesTotalPercentage !==
                                                                                        100
                                                                                    ? 'text-red-600 dark:text-red-400'
                                                                                    : 'text-muted-foreground'
                                                                            )}>
                                                                            {learningOutcomesHasWeighting
                                                                                ? learningOutcomesTotalPercentage ===
                                                                                  100
                                                                                    ? 'Weightings total 100%.'
                                                                                    : 'Weightings must total 100%.'
                                                                                : 'Weighting is optional.'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                {learningOutcomes.map(
                                                                    (
                                                                        outcome,
                                                                        loIdx
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                loIdx
                                                                            }
                                                                            className='col-span-1 min-w-0 border-b'>
                                                                            <div
                                                                                className='grid min-w-0 gap-4'
                                                                                style={{
                                                                                    gridTemplateColumns:
                                                                                        'minmax(0, 1fr) auto'
                                                                                }}>
                                                                                <div className='font-light col-span-1 flex items-start gap-3 min-w-0'>
                                                                                    <div className='flex items-start gap-3 py-4 pl-4 flex-1 min-w-0'>
                                                                                        <span className='font-thin leading-none flex-shrink-0 text-2xl pt-0.5'>
                                                                                            {String.fromCharCode(
                                                                                                0x245f +
                                                                                                    loIdx +
                                                                                                    1
                                                                                            )}
                                                                                        </span>
                                                                                        <Textarea
                                                                                            placeholder='Learning outcome title...'
                                                                                            value={
                                                                                                outcome.title
                                                                                            }
                                                                                            onChange={(
                                                                                                e
                                                                                            ) => {
                                                                                                const updated =
                                                                                                    [
                                                                                                        ...learningOutcomes
                                                                                                    ];
                                                                                                updated[
                                                                                                    loIdx
                                                                                                ].title =
                                                                                                    e.target.value;
                                                                                                setLearningOutcomes(
                                                                                                    updated
                                                                                                );
                                                                                            }}
                                                                                            rows={
                                                                                                1
                                                                                            }
                                                                                            className='font-light border-0 shadow-none focus-visible:ring-0 p-0 rounded-none min-h-0 min-w-0 w-full resize-none leading-relaxed field-sizing-content md:text-sm bg-muted/50 focus-visible:bg-muted/80 p-1 dark:bg-input/30 dark:focus-visible:bg-input/50'
                                                                                        />
                                                                                    </div>
                                                                                    {learningOutcomes.length >
                                                                                        1 && (
                                                                                        <Button
                                                                                            type='button'
                                                                                            size='icon'
                                                                                            variant='ghost'
                                                                                            onClick={() =>
                                                                                                removeLearningOutcome(
                                                                                                    loIdx
                                                                                                )
                                                                                            }
                                                                                            className='remove-button-outline shrink-0 mr-2 mt-3.5 h-7 w-7'>
                                                                                            <Trash2 className='h-4 w-4' />
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                                <div className='col-span-1 border-l flex items-center justify-center p-4 sm:py-4 sm:px-4'>
                                                                                    <Input
                                                                                        type='number'
                                                                                        placeholder='%'
                                                                                        min='0'
                                                                                        max='100'
                                                                                        value={
                                                                                            outcome.weighting ||
                                                                                            ''
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) => {
                                                                                            const updated =
                                                                                                [
                                                                                                    ...learningOutcomes
                                                                                                ];
                                                                                            updated[
                                                                                                loIdx
                                                                                            ].weighting =
                                                                                                parseInt(
                                                                                                    e
                                                                                                        .target
                                                                                                        .value
                                                                                                ) ||
                                                                                                0;
                                                                                            setLearningOutcomes(
                                                                                                updated
                                                                                            );
                                                                                        }}
                                                                                        className='font-light border-0 shadow-none focus-visible:ring-0 text-center w-16 bg-muted/50 focus-visible:bg-muted/80 p-1'
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                )}
                                                                <div className='col-span-1 border-b p-2 sm:p-2'>
                                                                    <div className='flex justify-end'>
                                                                        <Button
                                                                            type='button'
                                                                            size='sm'
                                                                            variant='ghost'
                                                                            onClick={
                                                                                addLearningOutcome
                                                                            }
                                                                            className='add-button'>
                                                                            <Plus className='h-3 w-3' />
                                                                            Add
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }

                                                    // Key Expectations
                                                    if (
                                                        blockId ===
                                                        'key-expectations'
                                                    ) {
                                                        return (
                                                            <React.Fragment
                                                                key={blockId}>
                                                                <div
                                                                    className='md:border-r row-span-1 border-b'
                                                                    style={{
                                                                        gridRow: `span ${
                                                                            (keyExpectations.length ||
                                                                                1) +
                                                                            1
                                                                        }`
                                                                    }}>
                                                                    <div className='font-normal h-full flex flex-col justify-between p-4 sm:py-4 sm:px-4'>
                                                                        <div className='mb-2'>
                                                                            <div className='flex items-start gap-2'>
                                                                                <ProjectDetailGrip className='mt-1' />
                                                                                <div className='flex items-start justify-between gap-2 flex-1 min-w-0'>
                                                                                <p>
                                                                                    Key
                                                                                    Expectations
                                                                                </p>
                                                                                <Button
                                                                                    type='button'
                                                                                    size='icon'
                                                                                    variant='ghost'
                                                                                    onClick={() =>
                                                                                        removeProjectDetailSubsection(
                                                                                            'key-expectations'
                                                                                        )
                                                                                    }
                                                                                    className='shrink-0 h-7 w-7 text-destructive hover:text-destructive'
                                                                                    aria-label='Remove Key Expectations'>
                                                                                    <X className='h-4 w-4' />
                                                                                </Button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <Input
                                                                            placeholder='Section subheading...'
                                                                            value={richTextToPlainText(
                                                                                subheadings[
                                                                                    'key-expectations'
                                                                                ] ||
                                                                                    ''
                                                                            )}
                                                                            onChange={(
                                                                                e
                                                                            ) =>
                                                                                setSubheadings(
                                                                                    {
                                                                                        ...subheadings,
                                                                                        'key-expectations':
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                    }
                                                                                )
                                                                            }
                                                                            className='font-light text-sm border-0 shadow-none focus-visible:ring-0 bg-muted/50 focus-visible:bg-muted/80 p-1 h-auto'
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {keyExpectations.length >
                                                                0 ? (
                                                                    keyExpectations.map(
                                                                        (
                                                                            expectation,
                                                                            expIdx
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    expIdx
                                                                                }
                                                                                className='col-span-1 border-b'>
                                                                                <details open className='group p-4 sm:pb-4 sm:px-4'>
                                                                                    <summary className='flex justify-between items-start gap-2 cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5'>
                                                                                        <Input
                                                                                            placeholder='Title...'
                                                                                            value={
                                                                                                expectation.title
                                                                                            }
                                                                                            onChange={(
                                                                                                e
                                                                                            ) => {
                                                                                                const updated =
                                                                                                    [
                                                                                                        ...keyExpectations
                                                                                                    ];
                                                                                                updated[
                                                                                                    expIdx
                                                                                                ].title =
                                                                                                    e.target.value;
                                                                                                setKeyExpectations(
                                                                                                    updated
                                                                                                );
                                                                                            }}
                                                                                            className='font-light border-0 shadow-none focus-visible:ring-0 p-1 h-auto flex-1 bg-muted/50 focus-visible:bg-muted/80'
                                                                                            onClick={(
                                                                                                e
                                                                                            ) =>
                                                                                                e.stopPropagation()
                                                                                            }
                                                                                        />
                                                                                        <span
                                                                                            className='font-thin flex-shrink-0 transition-all text-2xl'
                                                                                            aria-hidden='true'>
                                                                                            <span className='group-open:hidden'>
                                                                                                +
                                                                                            </span>
                                                                                            <span className='hidden group-open:inline'>
                                                                                                –
                                                                                            </span>
                                                                                        </span>
                                                                                    </summary>
                                                                                    <div className='mt-2 space-y-2'>
                                                                                        <RichTextPlateEditor
                                                                                            placeholder='Description...'
                                                                                            value={
                                                                                                expectation.description
                                                                                            }
                                                                                            onChange={(
                                                                                                nextValue
                                                                                            ) => {
                                                                                                const updated =
                                                                                                    [
                                                                                                        ...keyExpectations
                                                                                                    ];
                                                                                                updated[
                                                                                                    expIdx
                                                                                                ].description =
                                                                                                    nextValue;
                                                                                                setKeyExpectations(
                                                                                                    updated
                                                                                                );
                                                                                            }}
                                                                                            className='min-h-[60px] font-light leading-relaxed border-0 shadow-none focus-visible:ring-0 p-1 bg-muted/50 focus-visible:bg-muted/80'
                                                                                        />
                                                                                        {keyExpectations.length >
                                                                                            1 && (
                                                                                            <div className='flex justify-end pt-2'>
                                                                                                <Button
                                                                                                    type='button'
                                                                                                    size='icon'
                                                                                                    variant='ghost'
                                                                                                    onClick={() =>
                                                                                                        removeKeyExpectation(
                                                                                                            expIdx
                                                                                                        )
                                                                                                    }
                                                                                                    className='remove-button-outline'>
                                                                                                    <Trash2 className='h-4 w-4' />
                                                                                                </Button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </details>
                                                                            </div>
                                                                        )
                                                                    )
                                                                ) : (
                                                                    <div className='col-span-1 border-b p-4 sm:pb-4 sm:px-4'>
                                                                        <p className='font-light text-sm text-muted-foreground'>
                                                                            No
                                                                            expectations
                                                                            yet.
                                                                            Click
                                                                            &quot;Add&quot;
                                                                            to
                                                                            create
                                                                            one.
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                <div className='col-span-1 border-b p-2 sm:p-2'>
                                                                    <div className='flex justify-end'>
                                                                        <Button
                                                                            type='button'
                                                                            size='sm'
                                                                            variant='ghost'
                                                                            onClick={
                                                                                addKeyExpectation
                                                                            }
                                                                            className='add-button'>
                                                                            <Plus className='h-3 w-3' />
                                                                            Add
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }

                                                    // Deliverables
                                                    if (
                                                        blockId ===
                                                        'deliverables'
                                                    ) {
                                                        return (
                                                            <React.Fragment
                                                                key={blockId}>
                                                                <div
                                                                    className='md:border-r row-span-1 border-b'
                                                                    style={{
                                                                        gridRow: `span ${
                                                                            (deliverables.length ||
                                                                                1) +
                                                                            1
                                                                        }`
                                                                    }}>
                                                                    <div className='font-normal h-full flex flex-col justify-between p-4 sm:py-4 sm:px-4'>
                                                                        <div className='mb-2'>
                                                                            <div className='flex items-start gap-2'>
                                                                                <ProjectDetailGrip className='mt-1' />
                                                                                <div className='flex items-start justify-between gap-2 flex-1 min-w-0'>
                                                                                <p>
                                                                                    Deliverables
                                                                                </p>
                                                                                <Button
                                                                                    type='button'
                                                                                    size='icon'
                                                                                    variant='ghost'
                                                                                    onClick={() =>
                                                                                        removeProjectDetailSubsection(
                                                                                            'deliverables'
                                                                                        )
                                                                                    }
                                                                                    className='shrink-0 h-7 w-7 text-destructive hover:text-destructive'
                                                                                    aria-label='Remove Deliverables'>
                                                                                    <X className='h-4 w-4' />
                                                                                </Button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <Input
                                                                            placeholder='Section subheading...'
                                                                            value={richTextToPlainText(
                                                                                subheadings[
                                                                                    'deliverables'
                                                                                ] ||
                                                                                    ''
                                                                            )}
                                                                            onChange={(
                                                                                e
                                                                            ) =>
                                                                                setSubheadings(
                                                                                    {
                                                                                        ...subheadings,
                                                                                        deliverables:
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                    }
                                                                                )
                                                                            }
                                                                            className='font-light text-sm border-0 shadow-none focus-visible:ring-0 bg-muted/50 focus-visible:bg-muted/80 p-1 h-auto'
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {deliverables.length >
                                                                0 ? (
                                                                    deliverables.map(
                                                                        (
                                                                            deliverable,
                                                                            delIdx
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    delIdx
                                                                                }
                                                                                className='col-span-1 border-b'>
                                                                                <details open className='group p-4 sm:pb-4 sm:px-4'>
                                                                                    <summary className='flex justify-between items-start gap-2 cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5'>
                                                                                        <Input
                                                                                            placeholder='Title...'
                                                                                            value={
                                                                                                deliverable.title
                                                                                            }
                                                                                            onChange={(
                                                                                                e
                                                                                            ) => {
                                                                                                const updated =
                                                                                                    [
                                                                                                        ...deliverables
                                                                                                    ];
                                                                                                updated[
                                                                                                    delIdx
                                                                                                ].title =
                                                                                                    e.target.value;
                                                                                                setDeliverables(
                                                                                                    updated
                                                                                                );
                                                                                            }}
                                                                                            className='font-light border-0 shadow-none focus-visible:ring-0 p-1 h-auto flex-1 bg-muted/50 focus-visible:bg-muted/80'
                                                                                            onClick={(
                                                                                                e
                                                                                            ) =>
                                                                                                e.stopPropagation()
                                                                                            }
                                                                                        />
                                                                                        <span
                                                                                            className='font-thin flex-shrink-0 transition-all text-2xl'
                                                                                            aria-hidden='true'>
                                                                                            <span className='group-open:hidden'>
                                                                                                +
                                                                                            </span>
                                                                                            <span className='hidden group-open:inline'>
                                                                                                –
                                                                                            </span>
                                                                                        </span>
                                                                                    </summary>
                                                                                    <div className='mt-2 space-y-2'>
                                                                                        <RichTextPlateEditor
                                                                                            placeholder='Description...'
                                                                                            value={
                                                                                                deliverable.description
                                                                                            }
                                                                                            onChange={(
                                                                                                nextValue
                                                                                            ) => {
                                                                                                const updated =
                                                                                                    [
                                                                                                        ...deliverables
                                                                                                    ];
                                                                                                updated[
                                                                                                    delIdx
                                                                                                ].description =
                                                                                                    nextValue;
                                                                                                setDeliverables(
                                                                                                    updated
                                                                                                );
                                                                                            }}
                                                                                            className='min-h-[60px] font-light leading-relaxed border-0 shadow-none focus-visible:ring-0 p-1 bg-muted/50 focus-visible:bg-muted/80'
                                                                                        />
                                                                                        {deliverables.length >
                                                                                            1 && (
                                                                                            <div className='flex justify-end pt-2'>
                                                                                                <Button
                                                                                                    type='button'
                                                                                                    size='icon'
                                                                                                    variant='ghost'
                                                                                                    onClick={() =>
                                                                                                        removeDeliverable(
                                                                                                            delIdx
                                                                                                        )
                                                                                                    }
                                                                                                    className='remove-button-outline'>
                                                                                                    <Trash2 className='h-4 w-4' />
                                                                                                </Button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </details>
                                                                            </div>
                                                                        )
                                                                    )
                                                                ) : (
                                                                    <div className='col-span-1 border-b p-4 sm:pb-4 sm:px-4'>
                                                                        <p className='font-light text-sm text-muted-foreground'>
                                                                            No
                                                                            deliverables
                                                                            yet.
                                                                            Click
                                                                            &quot;Add&quot;
                                                                            to
                                                                            create
                                                                            one.
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                <div className='col-span-1 border-b p-2 sm:p-2'>
                                                                    <div className='flex justify-end'>
                                                                        <Button
                                                                            type='button'
                                                                            size='sm'
                                                                            variant='ghost'
                                                                            onClick={
                                                                                addDeliverable
                                                                            }
                                                                            className='add-button'>
                                                                            <Plus className='h-3 w-3' />
                                                                            Add
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }

                                                    // Resources
                                                    if (
                                                        blockId ===
                                                        'resources'
                                                    ) {
                                                        return (
                                                            <React.Fragment
                                                                key={blockId}>
                                                                <div
                                                                    className='md:border-r row-span-1 border-b'
                                                                    style={{
                                                                        gridRow: `span ${
                                                                            (resources.length ||
                                                                                1) +
                                                                            1
                                                                        }`
                                                                    }}>
                                                                    <div className='font-normal h-full flex flex-col justify-between p-4 sm:py-4 sm:px-4'>
                                                                        <div className='mb-2'>
                                                                            <div className='flex items-start gap-2'>
                                                                                <ProjectDetailGrip className='mt-1' />
                                                                                <div className='flex items-start justify-between gap-2 flex-1 min-w-0'>
                                                                                <p>
                                                                                    Resources
                                                                                </p>
                                                                                <Button
                                                                                    type='button'
                                                                                    size='icon'
                                                                                    variant='ghost'
                                                                                    onClick={() =>
                                                                                        removeProjectDetailSubsection(
                                                                                            'resources'
                                                                                        )
                                                                                    }
                                                                                    className='shrink-0 h-7 w-7 text-destructive hover:text-destructive'
                                                                                    aria-label='Remove Resources'>
                                                                                    <X className='h-4 w-4' />
                                                                                </Button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <Input
                                                                            placeholder='Section subheading...'
                                                                            value={richTextToPlainText(
                                                                                subheadings[
                                                                                    'resources'
                                                                                ] ||
                                                                                    ''
                                                                            )}
                                                                            onChange={(
                                                                                e
                                                                            ) =>
                                                                                setSubheadings(
                                                                                    {
                                                                                        ...subheadings,
                                                                                        resources:
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                    }
                                                                                )
                                                                            }
                                                                            className='font-light text-sm border-0 shadow-none focus-visible:ring-0 bg-muted/50 focus-visible:bg-muted/80 p-1 h-auto'
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {resources.length >
                                                                0 ? (
                                                                    resources.map(
                                                                        (
                                                                            resource,
                                                                            resIdx
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    resIdx
                                                                                }
                                                                                className='col-span-1 border-b'>
                                                                                <details open className='group p-4 sm:pb-4 sm:px-4'>
                                                                                    <summary className='flex justify-between items-start gap-2 cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5'>
                                                                                        <Input
                                                                                            placeholder='Title...'
                                                                                            value={
                                                                                                resource.title
                                                                                            }
                                                                                            onChange={(
                                                                                                e
                                                                                            ) => {
                                                                                                const updated =
                                                                                                    [
                                                                                                        ...resources
                                                                                                    ];
                                                                                                updated[
                                                                                                    resIdx
                                                                                                ].title =
                                                                                                    e.target.value;
                                                                                                setResources(
                                                                                                    updated
                                                                                                );
                                                                                            }}
                                                                                            className='font-light border-0 shadow-none focus-visible:ring-0 p-1 h-auto flex-1 bg-muted/50 focus-visible:bg-muted/80'
                                                                                            onClick={(
                                                                                                e
                                                                                            ) =>
                                                                                                e.stopPropagation()
                                                                                            }
                                                                                        />
                                                                                        <span
                                                                                            className='font-thin flex-shrink-0 transition-all text-2xl'
                                                                                            aria-hidden='true'>
                                                                                            <span className='group-open:hidden'>
                                                                                                +
                                                                                            </span>
                                                                                            <span className='hidden group-open:inline'>
                                                                                                –
                                                                                            </span>
                                                                                        </span>
                                                                                    </summary>
                                                                                    <div className='mt-2 space-y-2'>
                                                                                        <RichTextPlateEditor
                                                                                            placeholder='Description...'
                                                                                            value={
                                                                                                resource.description
                                                                                            }
                                                                                            onChange={(
                                                                                                nextValue
                                                                                            ) => {
                                                                                                const updated =
                                                                                                    [
                                                                                                        ...resources
                                                                                                    ];
                                                                                                updated[
                                                                                                    resIdx
                                                                                                ].description =
                                                                                                    nextValue;
                                                                                                setResources(
                                                                                                    updated
                                                                                                );
                                                                                            }}
                                                                                            className='min-h-[60px] font-light leading-relaxed border-0 shadow-none focus-visible:ring-0 p-1 bg-muted/50 focus-visible:bg-muted/80'
                                                                                        />
                                                                                        {resources.length >
                                                                                            1 && (
                                                                                            <div className='flex justify-end pt-2'>
                                                                                                <Button
                                                                                                    type='button'
                                                                                                    size='icon'
                                                                                                    variant='ghost'
                                                                                                    onClick={() =>
                                                                                                        removeResource(
                                                                                                            resIdx
                                                                                                        )
                                                                                                    }
                                                                                                    className='remove-button-outline'>
                                                                                                    <Trash2 className='h-4 w-4' />
                                                                                                </Button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </details>
                                                                            </div>
                                                                        )
                                                                    )
                                                                ) : (
                                                                    <div className='col-span-1 border-b p-4 sm:pb-4 sm:px-4'>
                                                                        <p className='font-light text-sm text-muted-foreground'>
                                                                            No
                                                                            resources
                                                                            yet.
                                                                            Click
                                                                            &quot;Add&quot;
                                                                            to
                                                                            create
                                                                            one.
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                <div className='col-span-1 border-b p-2 sm:p-2'>
                                                                    <div className='flex justify-end'>
                                                                        <Button
                                                                            type='button'
                                                                            size='sm'
                                                                            variant='ghost'
                                                                            onClick={
                                                                                addResource
                                                                            }
                                                                            className='add-button'>
                                                                            <Plus className='h-3 w-3' />
                                                                            Add
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }

                                                    const customId =
                                                        parseCustomSubsectionBlockId(
                                                            blockId
                                                        );
                                                    if (customId) {
                                                        const subsection =
                                                            customSubsections.find(
                                                                (entry) =>
                                                                    entry.id ===
                                                                    customId
                                                            );
                                                        if (!subsection) {
                                                            return null;
                                                        }
                                                        if (
                                                            subsection.type ===
                                                            'accordion'
                                                        ) {
                                                            return (
                                                                <CustomSubsectionAccordionRows
                                                                    subsection={
                                                                        subsection
                                                                    }
                                                                    onUpdate={(
                                                                        patch
                                                                    ) =>
                                                                        updateCustomSubsection(
                                                                            customId,
                                                                            patch
                                                                        )
                                                                    }
                                                                    onHide={() =>
                                                                        hideCustomSubsection(
                                                                            customId
                                                                        )
                                                                    }
                                                                    onAddItem={() =>
                                                                        addCustomSubsectionItem(
                                                                            customId
                                                                        )
                                                                    }
                                                                    onRemoveItem={(
                                                                        itemIndex
                                                                    ) =>
                                                                        removeCustomSubsectionItem(
                                                                            customId,
                                                                            itemIndex
                                                                        )
                                                                    }
                                                                    onUpdateItem={(
                                                                        itemIndex,
                                                                        patch
                                                                    ) =>
                                                                        updateCustomSubsectionItem(
                                                                            customId,
                                                                            itemIndex,
                                                                            patch
                                                                        )
                                                                    }
                                                                />
                                                            );
                                                        }
                                                        return (
                                                            <CustomSubsectionTextRows
                                                                subsection={
                                                                    subsection
                                                                }
                                                                onUpdate={(
                                                                    patch
                                                                ) =>
                                                                    updateCustomSubsection(
                                                                        customId,
                                                                        patch
                                                                    )
                                                                }
                                                                onHide={() =>
                                                                    hideCustomSubsection(
                                                                        customId
                                                                    )
                                                                }
                                                            />
                                                        );
                                                    }

                                                    return null;
                                                                })()}
                                                            </SortableProjectDetailBlock>
                                                        )
                                                    )}
                                                </div>
                                                <ProjectDetailAddBadges
                                                    hiddenBuiltinSubsections={
                                                        hiddenProjectDetailSubsections
                                                    }
                                                    onRestoreBuiltin={
                                                        restoreProjectDetailSubsection
                                                    }
                                                    onAddText={() =>
                                                        addCustomSubsection(
                                                            'text'
                                                        )
                                                    }
                                                    onAddAccordion={() =>
                                                        addCustomSubsection(
                                                            'accordion'
                                                        )
                                                    }
                                                    className='pt-4 border-t px-2'
                                                />
                                            </SortableContext>
                                            <DragOverlay dropAnimation={null}>
                                                {projectDetailDragActiveId ? (
                                                    <ProjectDetailBlockDragPreview
                                                        label={getProjectDetailBlockLabel(
                                                            projectDetailDragActiveId,
                                                            customSubsections
                                                        )}
                                                    />
                                                ) : null}
                                            </DragOverlay>
                                        </DndContext>
                                    )}

                                {/* Rubric Section */}
                                {section.id === 'rubric' && (
                                    <div className='space-y-4'>
                                        {moduleRubricsEnabled ? (
                                            <div className='rounded-none bg-white border border-dashed border-border/60 bg-muted/20 p-3'>
                                                <button
                                                    type='button'
                                                    onClick={() =>
                                                        setIsModuleRubricPickerOpen(
                                                            (open) => !open
                                                        )
                                                    }
                                                    className='flex w-full items-center gap-2 text-left hover:opacity-80 transition-opacity'>
                                                    {isModuleRubricPickerOpen ? (
                                                        <ChevronDown className='h-4 w-4 shrink-0' />
                                                    ) : (
                                                        <ChevronRight className='h-4 w-4 shrink-0' />
                                                    )}
                                                    <span className='text-sm font-light'>
                                                        Use Module Rubric
                                                    </span>
                                                </button>
                                                {isModuleRubricPickerOpen && (
                                                    <div className='mt-3 flex flex-wrap items-end gap-3 border-t border-border/60 pt-3'>
                                                        <div className='space-y-1'>
                                                            <Label className='text-xs font-light'>
                                                                Choose a saved rubric
                                                            </Label>
                                                            <Select
                                                                value={
                                                                    selectedPremadeRubricId
                                                                }
                                                                onValueChange={
                                                                    setSelectedPremadeRubricId
                                                                }>
                                                                <SelectTrigger className='w-[min(100%,260px)] font-light rounded-none'>
                                                                    <SelectValue placeholder='Choose a saved rubric…' />
                                                                </SelectTrigger>
                                                                <SelectContent className='z-[120]'>
                                                                    {savedRubricsForApply.map(
                                                                        (r) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    r.id
                                                                                }
                                                                                value={String(
                                                                                    r.id
                                                                                )}
                                                                                className='cursor-pointer'>
                                                                                {
                                                                                    r.name
                                                                                }
                                                                            </SelectItem>
                                                                        )
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <Button
                                                            type='button'
                                                            size='sm'
                                                            variant='secondary'
                                                            className='font-light'
                                                            disabled={
                                                                !selectedPremadeRubricId
                                                            }
                                                            onClick={
                                                                applyPremadeRubricToBrief
                                                            }>
                                                            Apply copy to brief
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                        {canMapRubricToLearningOutcomes && (
                                            <div className='flex flex-wrap items-center justify-between gap-3 rounded-none bg-white border border-dashed border-border/60 bg-muted/20 p-3'>
                                                <div className='min-w-0 space-y-1'>
                                                    <p className='text-sm font-light'>
                                                        Map to Learning Outcomes
                                                        above
                                                    </p>
                                                    <p className='text-xs font-light text-muted-foreground'>
                                                        Would you like to create one criterion per
                                                        learning outcome above and link
                                                        them automatically?
                                                    </p>
                                                </div>
                                                <Button
                                                    type='button'
                                                    size='sm'
                                                    variant='secondary'
                                                    className='font-light shrink-0'
                                                    onClick={
                                                        applyLearningOutcomesToRubric
                                                    }>
                                                    Map to LOs
                                                </Button>
                                            </div>
                                        )}
                                        <Dialog
                                            open={replaceRubricDialogOpen}
                                            onOpenChange={(open) => {
                                                setReplaceRubricDialogOpen(
                                                    open
                                                );
                                                if (!open) {
                                                    pendingRubricApplyRef.current =
                                                        null;
                                                }
                                            }}>
                                            <DialogContent className='rounded-none sm:max-w-md'>
                                                <DialogHeader>
                                                    <DialogTitle>
                                                        Replace assessment
                                                        criteria?
                                                    </DialogTitle>
                                                    <DialogDescription>
                                                        {replaceRubricDialogSource ===
                                                        'learning-outcomes'
                                                            ? 'Replace the current assessment criteria with one criterion per learning outcome, linked to each outcome? This overwrites what you have now.'
                                                            : 'Replace the current assessment criteria in this brief with a copy of the selected rubric? This overwrites what you have now.'}
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter>
                                                    <Button
                                                        type='button'
                                                        variant='outline'
                                                        className='font-light rounded-none'
                                                        onClick={() =>
                                                            setReplaceRubricDialogOpen(
                                                                false
                                                            )
                                                        }>
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type='button'
                                                        variant='destructive'
                                                        className='font-light rounded-none'
                                                        onClick={
                                                            handleConfirmReplaceRubric
                                                        }>
                                                        Replace
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                        <RubricSectionEditor
                                            rubricCriteria={rubricCriteria}
                                            setRubricCriteria={
                                                setRubricCriteria
                                            }
                                            learningOutcomesMode='brief'
                                            learningOutcomes={learningOutcomes}
                                            onCriteriaEdited={() =>
                                                setIsDirty(true)
                                            }
                                            getDescriptorAiContext={
                                                getBriefContext
                                            }
                                            isSaving={isSaving}
                                            onSheetPersist={handleSaveContent}
                                            useAI={useAI}
                                        />
                                        <SelfAssessmentLinkOptionFields
                                            canOfferLink={
                                                canOfferSelfAssessmentLink
                                            }
                                        />
                                    </div>
                                )}

                                {/* How Work is Marked */}
                                {section.id === 'how-work-is-marked' && (
                                    <div className='grid min-w-0 grid-cols-1 md:grid-cols-[min(15rem,36%)_minmax(0,1fr)] border bg-card'>
                                        {howWorkMarked.length > 0 ? (
                                            howWorkMarked.map((item, idx) => (
                                                <React.Fragment key={idx}>
                                                    <div className='md:border-r border-b bg-card'>
                                                        <div className='font-normal h-full flex flex-col justify-between p-4 sm:py-4 sm:px-4'>
                                                            <div className='flex items-start justify-between mb-2 gap-2'>
                                                                <Textarea
                                                                    placeholder='Title...'
                                                                    value={
                                                                        item.title
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) => {
                                                                        const updated =
                                                                            [
                                                                                ...howWorkMarked
                                                                            ];
                                                                        updated[
                                                                            idx
                                                                        ].title =
                                                                            e.target.value;
                                                                        setHowWorkMarked(
                                                                            updated
                                                                        );
                                                                    }}
                                                                    className='font-normal border-0 shadow-none focus-visible:ring-0 p-1 h-auto min-h-[2.5rem] flex-1 bg-muted/50 focus-visible:bg-muted/80 resize-none whitespace-pre-wrap break-words'
                                                                />
                                                                {howWorkMarked.length >
                                                                    1 && (
                                                                    <Button
                                                                        type='button'
                                                                        size='icon'
                                                                        variant='ghost'
                                                                        onClick={() =>
                                                                            removeHowWorkMarked(
                                                                                idx
                                                                            )
                                                                        }
                                                                        className='shrink-0'>
                                                                        <X className='h-4 w-4' />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className='col-span-1 border-b'>
                                                        <RichTextPlateEditor
                                                            placeholder='Description...'
                                                            value={
                                                                item.description
                                                            }
                                                            onChange={(
                                                                nextValue
                                                            ) => {
                                                                const updated =
                                                                    [
                                                                        ...howWorkMarked
                                                                    ];
                                                                updated[
                                                                    idx
                                                                ].description =
                                                                    nextValue;
                                                                setHowWorkMarked(
                                                                    updated
                                                                );
                                                            }}
                                                            className='min-h-[60px] font-light leading-relaxed p-2 sm:pb-2 sm:px-3 border-0 bg-muted/50 focus-visible:bg-muted/80 dark:bg-input/30 dark:focus-visible:bg-input/50'
                                                        />
                                                        {idx ===
                                                            howWorkMarked.length -
                                                                1 && (
                                                            <Button
                                                                type='button'
                                                                size='sm'
                                                                variant='link'
                                                                onClick={
                                                                    addHowWorkMarked
                                                                }
                                                                className='font-light ml-auto flex items-center '>
                                                                <Plus className='h-3 w-3 mr-1' />
                                                                Add
                                                            </Button>
                                                        )}
                                                    </div>
                                                </React.Fragment>
                                            ))
                                        ) : (
                                            <>
                                                <div className='md:border-r border-b'>
                                                    <div className='font-normal h-full flex flex-col justify-between p-4 sm:py-4 sm:px-4'>
                                                        <p>Marking Criteria</p>
                                                        <Button
                                                            type='button'
                                                            size='sm'
                                                            variant='ghost'
                                                            onClick={
                                                                addHowWorkMarked
                                                            }
                                                            className='font-light h-7 text-xs mt-2'>
                                                            <Plus className='h-3 w-3 mr-1' />
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className='col-span-1 border-b p-4 sm:pb-4 sm:px-4'>
                                                    <p className='font-light text-sm text-muted-foreground'>
                                                        No marking criteria yet.
                                                        Click &quot;Add&quot; to
                                                        create one.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Submission Checklist */}
                                {section.id === 'schedule' && (
                                    <div className='space-y-4 border p-4 bg-card'>
                                        <div className='flex flex-wrap items-center gap-3'>
                                            {/* <Button
                                                type='button'
                                                size='sm'
                                                variant='outline'
                                                onClick={() =>
                                                    setIsScheduleSheetOpen(true)
                                                }
                                                className='font-light'>
                                                <Pencil className='h-4 w-4 mr-1' />
                                                {scheduleCtaLabel}
                                            </Button> */}
                                            <p className='text-xs text-muted-foreground font-light'>
                                                Build phases in a sheet and
                                                choose how this appears for
                                                students.
                                            </p>
                                        </div>
                                        <div className='space-y-2'>
                                            <Label className='font-normal text-sm'>
                                                Student preview display options
                                            </Label>
                                            <div className='grid gap-2 sm:grid-cols-2'>
                                                <label className='flex items-center gap-2 rounded-none border p-3'>
                                                    <Checkbox
                                                        checked={
                                                            scheduleViews.table
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            setScheduleViews({
                                                                ...scheduleViews,
                                                                table: Boolean(
                                                                    checked
                                                                )
                                                            })
                                                        }
                                                    />
                                                    <span className='text-sm font-light'>
                                                        Table view
                                                    </span>
                                                </label>
                                                <label className='flex items-center gap-2 rounded-none border p-3'>
                                                    <Checkbox
                                                        checked={
                                                            scheduleViews.gantt
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            setScheduleViews({
                                                                ...scheduleViews,
                                                                gantt: Boolean(
                                                                    checked
                                                                )
                                                            })
                                                        }
                                                    />
                                                    <span className='text-sm font-light'>
                                                        Gantt chart
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className='space-y-2'>
                                            <Label className='font-normal text-sm'>
                                                Phase summary
                                            </Label>
                                            {schedulePhaseSummaries.length >
                                            0 ? (
                                                <div className='rounded-none border divide-y'>
                                                    {schedulePhaseSummaries.map(
                                                        (phase, idx) => (
                                                            <div
                                                                key={`${phase.title}-${idx}`}
                                                                className='p-3'>
                                                                <p className='text-sm font-normal'>
                                                                    {
                                                                        phase.title
                                                                    }
                                                                </p>
                                                                <p className='text-xs text-muted-foreground font-light mt-1'>
                                                                    {
                                                                        phase.timing
                                                                    }
                                                                </p>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            ) : (
                                                <p className='text-xs text-muted-foreground font-light'>
                                                    No phases added yet.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Submission Checklist */}
                                {section.id === 'submission-checklist' && (
                                    <div className='space-y-4'>
                                        {/* <Label className='font-normal'>
                                            Checklist Items
                                        </Label> */}
                                        <div className='space-y-2'>
                                            {checklistItems.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className='flex gap-2 items-center bg-card'>
                                                    <Input
                                                        placeholder='Checklist item...'
                                                        value={item}
                                                        onChange={(e) => {
                                                            const updated = [
                                                                ...checklistItems
                                                            ];
                                                            updated[idx] =
                                                                e.target.value;
                                                            setChecklistItems(
                                                                updated
                                                            );
                                                        }}
                                                        className='font-light bg-muted/50 focus-visible:bg-muted/80 p-1'
                                                    />
                                                    {checklistItems.length >
                                                        1 && (
                                                        <Button
                                                            type='button'
                                                            size='icon'
                                                            variant='ghost'
                                                            onClick={() =>
                                                                removeChecklistItem(
                                                                    idx
                                                                )
                                                            }
                                                            className='shrink-0'>
                                                            <X className='h-4 w-4' />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* One Page Summary */}
                                {section.id === 'one-page-summary' &&
                                    (() => {
                                        const onePageSubs =
                                            resolveOnePageSummarySubsections(
                                                section.templateData
                                                    ?.subsections
                                            );
                                        return onePageSubs.length > 0 ? (
                                            <div className='space-y-4'>
                                                {onePageSubs.map(
                                                    (sub: any, idx) => {
                                                        const fieldKey =
                                                            sub.title ||
                                                            sub.label ||
                                                            String(
                                                                sub.id ?? idx
                                                            );
                                                        return (
                                                            <div
                                                                key={`${fieldKey}-${idx}`}
                                                                className='space-y-2 bg-card border border-foreground/15 p-4'>
                                                                <Label className='font-bolder'>
                                                                    {sub.title ||
                                                                        sub.label ||
                                                                        fieldKey}
                                                                </Label>
                                                                <div className='space-y-2'>
                                                                    <RichTextPlateEditor
                                                                        placeholder={`Write the ${fieldKey} summary for students…`}
                                                                        value={
                                                                            onePageSummaryContent[
                                                                                fieldKey
                                                                            ] ||
                                                                            ''
                                                                        }
                                                                        onChange={(
                                                                            nextValue
                                                                        ) =>
                                                                            setOnePageSummaryContent(
                                                                                {
                                                                                    ...onePageSummaryContent,
                                                                                    [fieldKey]:
                                                                                        nextValue
                                                                                }
                                                                            )
                                                                        }
                                                                        className='min-h-[80px] font-light bg-muted/50 focus-visible:bg-muted/80 p-1'
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        ) : null;
                                    })()}

                                {/* AI Policy */}
                                {section.id === 'ai-policy' && (
                                    <BuilderAiPolicyEditorLoader
                                        aiPolicy={aiPolicy}
                                        onAiPolicyChange={(policy) => {
                                            setAiPolicy(policy);
                                            setRequireAiLog(
                                                Boolean(policy.usageLogEnabled)
                                            );
                                            setIsDirty(true);
                                        }}
                                        showUsageLogCheckbox={isAssignmentSettingVisible(
                                            'require-ai-log',
                                            hiddenAssignmentSettings
                                        )}
                                    />
                                )}

                                {/* FAQ */}
                                {section.id === 'faq' && (
                                    <div className='border bg-card'>
                                        {faqItems.length > 0 ? (
                                            <>
                                            {faqItems.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className='border-b p-4 sm:pb-4 sm:px-4 space-y-2'>
                                                    <div className='flex items-start gap-2'>
                                                        <Input
                                                            placeholder='Question...'
                                                            value={
                                                                item.question
                                                            }
                                                            onChange={(e) => {
                                                                const updated =
                                                                    [
                                                                        ...faqItems
                                                                    ];
                                                                updated[
                                                                    idx
                                                                ].question =
                                                                    e.target.value;
                                                                setFaqItems(
                                                                    updated
                                                                );
                                                            }}
                                                            className='font-light border-0 shadow-none focus-visible:ring-0 p-1 h-auto flex-1 bg-muted/50 focus-visible:bg-muted/80'
                                                        />
                                                        {faqItems.length >
                                                            1 && (
                                                            <Button
                                                                type='button'
                                                                size='icon'
                                                                variant='ghost'
                                                                onClick={() =>
                                                                    removeFaqItem(
                                                                        idx
                                                                    )
                                                                }
                                                                className='remove-button-outline shrink-0'>
                                                                <Trash2 className='h-4 w-4' />
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <details className='group'>
                                                        <summary className='flex justify-between items-center gap-2 cursor-pointer font-normal list-none text-sm text-muted-foreground transition-all duration-200 hover:translate-x-0.5'>
                                                            <span>Answer</span>
                                                            <span
                                                                className='font-thin flex-shrink-0 text-2xl'
                                                                aria-hidden='true'>
                                                                <span className='group-open:hidden'>
                                                                    +
                                                                </span>
                                                                <span className='hidden group-open:inline'>
                                                                    –
                                                                </span>
                                                            </span>
                                                        </summary>
                                                        <div className='mt-2'>
                                                            <RichTextPlateEditor
                                                                placeholder='Answer...'
                                                                value={
                                                                    item.answer
                                                                }
                                                                onChange={(
                                                                    nextValue
                                                                ) => {
                                                                    const updated =
                                                                        [
                                                                            ...faqItems
                                                                        ];
                                                                    updated[
                                                                        idx
                                                                    ].answer =
                                                                        nextValue;
                                                                    setFaqItems(
                                                                        updated
                                                                    );
                                                                }}
                                                                className='min-h-[60px] font-light leading-relaxed border-0 shadow-none focus-visible:ring-0 p-1 bg-muted/50 focus-visible:bg-muted/80'
                                                            />
                                                        </div>
                                                    </details>
                                                </div>
                                            ))}
                                            <div className='p-2 sm:p-2'>
                                                <div className='flex justify-end'>
                                                    <Button
                                                        type='button'
                                                        size='sm'
                                                        variant='ghost'
                                                        onClick={addFaqItem}
                                                        className='add-button'>
                                                        <Plus className='h-3 w-3' />
                                                        Add
                                                    </Button>
                                                </div>
                                            </div>
                                            </>
                                        ) : (
                                            <div className='p-4 sm:py-4 sm:px-4 space-y-3'>
                                                <p className='text-sm text-muted-foreground font-light'>
                                                    No questions yet. Add
                                                    questions students have
                                                    asked outside the app,
                                                    with clear answers.
                                                </p>
                                                <Button
                                                    type='button'
                                                    size='sm'
                                                    variant='ghost'
                                                    onClick={addFaqItem}
                                                    className='add-button'>
                                                    <Plus className='h-3 w-3 mr-1' />
                                                    Add
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Example Feedback Form */}
                                {section.id === 'example-feedback' && (
                                    <BuilderExampleFeedbackFormEditorLoader />
                                )}

                                {/* Submission Form */}
                                {section.id === 'submission-form' && (
                                    <div className='space-y-3'>
                                        {submissionFormFields.map(
                                            (field, idx) => (
                                                <div
                                                    key={idx}
                                                    className='relative grid min-w-0 gap-3 bg-card border p-3 md:grid-cols-[min(15rem,36%)_minmax(0,1fr)]'>
                                                    {submissionFormFields.length >
                                                        1 && (
                                                        <Button
                                                            type='button'
                                                            size='icon'
                                                            variant='ghost'
                                                            onClick={() =>
                                                                removeSubmissionFormField(
                                                                    idx
                                                                )
                                                            }
                                                            className='absolute right-2 top-2 h-7 w-7'>
                                                            <X className='h-4 w-4' />
                                                        </Button>
                                                    )}
                                                    <div className='space-y-3'>
                                                        <div className='space-y-2'>
                                                            <Label className='text-sm font-light'>
                                                                Field Title
                                                            </Label>
                                                            <Input
                                                                placeholder='e.g., Name, Student Number'
                                                                value={
                                                                    field.title
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    const updated =
                                                                        [
                                                                            ...submissionFormFields
                                                                        ];
                                                                    updated[
                                                                        idx
                                                                    ].title =
                                                                        e.target.value;
                                                                    setSubmissionFormFields(
                                                                        updated
                                                                    );
                                                                }}
                                                                className='font-light bg-muted/50 focus-visible:bg-muted/80 p-1'
                                                            />
                                                        </div>
                                                        <div className='space-y-2'>
                                                            <div className='flex items-center justify-between'>
                                                                <Label className='text-sm font-light'>
                                                                    Example
                                                                </Label>
                                                                {/* dont show link if it is a declaration field */}
                                                                {field.title
                                                                    .trim()
                                                                    .toLowerCase() !==
                                                                    'declaration' && (
                                                                    <Button
                                                                        type='button'
                                                                        size='sm'
                                                                        variant='ghost'
                                                                        onClick={(
                                                                            e
                                                                        ) => {
                                                                            const input =
                                                                                (
                                                                                    e.target as HTMLElement
                                                                                )
                                                                                    .closest(
                                                                                        '.space-y-2'
                                                                                    )
                                                                                    ?.querySelector(
                                                                                        'input'
                                                                                    ) as HTMLInputElement;
                                                                            if (
                                                                                input
                                                                            ) {
                                                                                const result =
                                                                                    insertExampleLink(
                                                                                        input
                                                                                    );
                                                                                const updated =
                                                                                    [
                                                                                        ...submissionFormFields
                                                                                    ];
                                                                                updated[
                                                                                    idx
                                                                                ].placeholder =
                                                                                    result.newValue;
                                                                                setSubmissionFormFields(
                                                                                    updated
                                                                                );
                                                                                setTimeout(
                                                                                    () => {
                                                                                        input.focus();
                                                                                        input.setSelectionRange(
                                                                                            result.cursorPosition,
                                                                                            result.cursorPosition
                                                                                        );
                                                                                    },
                                                                                    0
                                                                                );
                                                                            }
                                                                        }}
                                                                        className='h-7 text-xs font-light'>
                                                                        <Link className='h-3 w-3 mr-1' />
                                                                        Insert
                                                                        Link
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <Input
                                                                placeholder='e.g., Stefan Paz, N00123456'
                                                                value={
                                                                    field.placeholder
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    const updated =
                                                                        [
                                                                            ...submissionFormFields
                                                                        ];
                                                                    updated[
                                                                        idx
                                                                    ].placeholder =
                                                                        e.target.value;
                                                                    setSubmissionFormFields(
                                                                        updated
                                                                    );
                                                                }}
                                                                className='font-light text-xs bg-muted/50 focus-visible:bg-muted/80 p-1'
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className='space-y-2'>
                                                        <Label className='text-sm font-light'>
                                                            Optional Description
                                                        </Label>
                                                        <Textarea
                                                            placeholder='Displayed above the student input (optional)'
                                                            value={
                                                                field.optionalDescription ||
                                                                ''
                                                            }
                                                            onChange={(e) => {
                                                                const updated =
                                                                    [
                                                                        ...submissionFormFields
                                                                    ];
                                                                updated[
                                                                    idx
                                                                ].optionalDescription =
                                                                    e.target.value;
                                                                setSubmissionFormFields(
                                                                    updated
                                                                );
                                                            }}
                                                            className='min-h-[96px] font-light text-xs bg-muted/50 focus-visible:bg-muted/80 p-1'
                                                        />
                                                        {/* <div className='space-y-1'>
                                                                <Label className='text-xs font-light text-muted-foreground'>
                                                                    Student
                                                                    Input
                                                                    Preview
                                                                </Label>
                                                                <Input
                                                                    value=''
                                                                    placeholder={
                                                                        field.placeholder ||
                                                                        'Student input field'
                                                                    }
                                                                    readOnly
                                                                    className='font-light'
                                                                />
                                                            </div> */}
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                </div>
            </div>

            <footer
                className={cn(
                    'shrink-0 border-t bg-background print:hidden',
                    !isStudentPreviewOpen && 'mx-auto w-full max-w-7xl'
                )}
                data-tour='brief-builder-save'>
                <div className='flex items-center justify-between gap-4 px-6 py-3'>
                    <div>
                        {activeSection ? (
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                className='font-normal cursor-pointer'
                                onClick={() =>
                                    setIsSectionHelperVisible(
                                        !isSectionHelperVisible
                                    )
                                }>
                                {isSectionHelperVisible
                                    ? 'Hide Helper'
                                    : 'Show Helper'}
                                <HelpCircle className='h-4 w-4' />
                            </Button>
                        ) : null}
                    </div>
                    <div className='flex items-center gap-2'>
                        <Button
                            onClick={() => setRevertConfirmDialogOpen(true)}
                            disabled={isSaving || !hasUnsavedContentChanges}
                            size='sm'
                            variant='outline'
                            title='Discard unsaved changes and restore last saved version'
                            className='font-normal cursor-pointer'>
                            <RotateCcw className='h-4 w-4' />
                            Revert
                        </Button>
                        <Button
                            onClick={handleSaveContent}
                            disabled={isSaving || !hasUnsavedContentChanges}
                            size='sm'
                            variant={
                                hasUnsavedContentChanges ? 'default' : 'outline'
                            }
                            title={
                                isSaving
                                    ? 'Saving your changes'
                                    : hasUnsavedContentChanges
                                      ? 'You have unsaved changes'
                                      : 'All changes saved'
                            }
                            className={cn(
                                'font-normal cursor-pointer',
                                !hasUnsavedContentChanges &&
                                    !isSaving &&
                                    'border-green-600 text-green-600 hover:bg-transparent hover:text-green-600 dark:border-green-400 dark:text-green-400 dark:hover:text-green-400 disabled:opacity-100'
                            )}>
                            {isSaving ? (
                                'Saving...'
                            ) : hasUnsavedContentChanges ? (
                                <>
                                    <Save className='h-4 w-4' />
                                    Save Content
                                </>
                            ) : (
                                <>
                                    <Check className='h-4 w-4' />
                                    Saved
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </footer>
            </div>

            {/* Dynamic section helper overlay */}
            {activeSection && (
                <>
                    {isSectionHelperVisible ? (
                        <div className='absolute bottom-[4.5rem] left-6 z-40 w-[320px] rounded-none border bg-card/95 backdrop-blur p-4 shadow-lg'>
                            <div className='flex items-start justify-between gap-2'>
                                <div className='min-w-0 flex-1'>
                                    <p className='text-xs text-muted-foreground font-light'>
                                        Section Helper
                                    </p>
                                    <h4 className='text-sm font-normal'>
                                        {activeSection.label}
                                    </h4>
                                </div>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    className='shrink-0 h-8 text-xs font-light text-muted-foreground'
                                    onClick={() =>
                                        setIsSectionHelperVisible(false)
                                    }>
                                    Hide
                                </Button>
                            </div>

                            {activeSection.id === 'rubric' && (
                                <div className='mt-3 space-y-3 bg-card'>
                                    <div className='flex items-center gap-2'>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            onClick={
                                                addRubricCriterionFromOverlay
                                            }
                                            className='font-light'>
                                            <Plus className='h-4 w-4' />
                                            Add Criterion
                                        </Button>
                                    </div>
                                    <div className='rounded-none border p-2'>
                                        <p className='text-xs text-muted-foreground font-light'>
                                            Total Criteria
                                        </p>
                                        <p className='text-sm font-normal'>
                                            {rubricCriteria.length}
                                        </p>
                                    </div>
                                    <div className='space-y-1'>
                                        <p className='text-xs text-muted-foreground font-light'>
                                            Criterion Names
                                        </p>
                                        {rubricCriteria
                                            .slice(0, 3)
                                            .map((criterion, idx) => (
                                                <p
                                                    key={idx}
                                                    className='text-xs font-light truncate'>
                                                    {criterion.criterion ||
                                                        `Criterion ${idx + 1}`}
                                                </p>
                                            ))}
                                    </div>
                                    <SelfAssessmentLinkOptionFields
                                        canOfferLink={canOfferSelfAssessmentLink}
                                    />
                                    <p className='text-xs text-muted-foreground font-light'>
                                        Self-assessment link is{' '}
                                        {selfAssessmentLinkEnabled &&
                                        canOfferSelfAssessmentLink
                                            ? 'enabled'
                                            : 'hidden'}{' '}
                                        on the public brief.
                                    </p>
                                </div>
                            )}

                            {activeSection.id === 'project-details' && (
                                <div className='mt-3 space-y-3'>
                                    <div className='grid grid-cols-2 gap-2'>
                                        {isProjectDetailSubsectionVisible(
                                            'learning-outcomes',
                                            hiddenProjectDetailSubsections
                                        ) && (
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='outline'
                                                onClick={addLearningOutcome}
                                                className='justify-start font-light'>
                                                <Plus className='h-4 w-4 mr-1' />
                                                Outcome
                                            </Button>
                                        )}
                                        {isProjectDetailSubsectionVisible(
                                            'key-expectations',
                                            hiddenProjectDetailSubsections
                                        ) && (
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='outline'
                                                onClick={addKeyExpectation}
                                                className='justify-start font-light'>
                                                <Plus className='h-4 w-4 mr-1' />
                                                Expectation
                                            </Button>
                                        )}
                                        {isProjectDetailSubsectionVisible(
                                            'deliverables',
                                            hiddenProjectDetailSubsections
                                        ) && (
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='outline'
                                                onClick={addDeliverable}
                                                className='justify-start font-light'>
                                                <Plus className='h-4 w-4 mr-1' />
                                                Deliverable
                                            </Button>
                                        )}
                                        {isProjectDetailSubsectionVisible(
                                            'resources',
                                            hiddenProjectDetailSubsections
                                        ) && (
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='outline'
                                                onClick={addResource}
                                                className='justify-start font-light'>
                                                <Plus className='h-4 w-4 mr-1' />
                                                Resource
                                            </Button>
                                        )}
                                    </div>
                                    <div className='space-y-2 rounded-none border p-2'>
                                        <p className='text-xs text-muted-foreground font-light'>
                                            Section at a glance
                                        </p>
                                        <div className='grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-light'>
                                            {isProjectDetailSubsectionVisible(
                                                'learning-outcomes',
                                                hiddenProjectDetailSubsections
                                            ) && (
                                                <>
                                                    <p>Outcomes</p>
                                                    <p className='text-right'>
                                                        {
                                                            learningOutcomes.length
                                                        }
                                                    </p>
                                                    <p>Outcome Weighting</p>
                                                    <p
                                                        className={cn(
                                                            'text-right font-semibold',
                                                            learningOutcomesHasWeighting &&
                                                                (learningOutcomesTotalPercentage ===
                                                                100
                                                                    ? 'text-green-600 dark:text-green-400'
                                                                    : 'text-red-600 dark:text-red-400')
                                                        )}>
                                                        {
                                                            learningOutcomesTotalPercentage
                                                        }
                                                        %
                                                    </p>
                                                </>
                                            )}
                                            {isProjectDetailSubsectionVisible(
                                                'key-expectations',
                                                hiddenProjectDetailSubsections
                                            ) && (
                                                <>
                                                    <p>Expectations</p>
                                                    <p className='text-right'>
                                                        {
                                                            keyExpectations.length
                                                        }
                                                    </p>
                                                </>
                                            )}
                                            {isProjectDetailSubsectionVisible(
                                                'deliverables',
                                                hiddenProjectDetailSubsections
                                            ) && (
                                                <>
                                                    <p>Deliverables</p>
                                                    <p className='text-right'>
                                                        {deliverables.length}
                                                    </p>
                                                </>
                                            )}
                                            {isProjectDetailSubsectionVisible(
                                                'resources',
                                                hiddenProjectDetailSubsections
                                            ) && (
                                                <>
                                                    <p>Resources</p>
                                                    <p className='text-right'>
                                                        {resources.length}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <p className='text-xs text-muted-foreground font-light'>
                                        Use the X on a subsection label to hide
                                        it from the brief. Use the Add: tags
                                        above or below Project Details to add
                                        or restore subsections.
                                    </p>
                                </div>
                            )}

                            {activeSection.id === 'how-work-is-marked' && (
                                <div className='mt-3 space-y-3'>
                                    <Button
                                        type='button'
                                        size='sm'
                                        variant='outline'
                                        onClick={addHowWorkMarked}
                                        className='w-full justify-start font-light'>
                                        <Plus className='h-4 w-4 mr-1' />
                                        Add Marking Item
                                    </Button>
                                    <p className='text-xs text-muted-foreground font-light'>
                                        {howWorkMarked.length} marking item
                                        {howWorkMarked.length === 1
                                            ? ''
                                            : 's'}{' '}
                                        in this section.
                                    </p>
                                </div>
                            )}

                            {activeSection.id === 'faq' && (
                                <div className='mt-3 space-y-3'>
                                    <Button
                                        type='button'
                                        size='sm'
                                        variant='outline'
                                        onClick={addFaqItem}
                                        className='w-full justify-start font-light'>
                                        <Plus className='h-4 w-4 mr-1' />
                                        Add Question
                                    </Button>
                                    <p className='text-xs text-muted-foreground font-light'>
                                        {faqItems.length} FAQ item
                                        {faqItems.length === 1 ? '' : 's'} in
                                        this section.
                                    </p>
                                </div>
                            )}

                            {activeSection.id === 'submission-checklist' && (
                                <div className='mt-3 space-y-3'>
                                    <Button
                                        type='button'
                                        size='sm'
                                        variant='outline'
                                        onClick={addChecklistItem}
                                        className='w-full justify-start font-light'>
                                        <Plus className='h-4 w-4 mr-1' />
                                        Add Checklist Item
                                    </Button>
                                    <p className='text-xs text-muted-foreground font-light'>
                                        {checklistItems.length} checklist item
                                        {checklistItems.length === 1 ? '' : 's'}
                                        .
                                    </p>
                                </div>
                            )}

                            {activeSection.id === 'submission-form' && (
                                <div className='mt-3 space-y-3'>
                                    <Button
                                        type='button'
                                        size='sm'
                                        variant='outline'
                                        onClick={addSubmissionFormField}
                                        className='w-full justify-start font-light'>
                                        <Plus className='h-4 w-4 mr-1' />
                                        Add Form Field
                                    </Button>
                                    <p className='text-xs text-muted-foreground font-light'>
                                        {submissionFormFields.length} form field
                                        {submissionFormFields.length === 1
                                            ? ''
                                            : 's'}
                                        .
                                    </p>
                                </div>
                            )}

                            {activeSection.id === 'schedule' && (
                                <div className='mt-3 space-y-3'>
                                    <Button
                                        type='button'
                                        size='sm'
                                        variant='outline'
                                        onClick={() =>
                                            setIsScheduleSheetOpen(true)
                                        }
                                        className='w-full justify-start font-light'>
                                        <Pencil className='h-4 w-4 mr-1' />
                                        {scheduleCtaLabel}
                                    </Button>
                                    <p className='text-xs text-muted-foreground font-light'>
                                        {schedulePhases.length} phase
                                        {schedulePhases.length === 1 ? '' : 's'}
                                        . Table view is{' '}
                                        {scheduleViews.table
                                            ? 'enabled'
                                            : 'disabled'}
                                        .
                                    </p>
                                    {schedulePhaseSummaries.length > 0 && (
                                        <div className='rounded-none border p-2 space-y-1'>
                                            {schedulePhaseSummaries
                                                .slice(0, 3)
                                                .map((phase, idx) => (
                                                    <p
                                                        key={`${phase.title}-${idx}`}
                                                        className='text-xs font-light text-muted-foreground'>
                                                        {phase.title}:{' '}
                                                        {phase.timing}
                                                    </p>
                                                ))}
                                            {schedulePhaseSummaries.length >
                                                3 && (
                                                <p className='text-xs font-light text-muted-foreground'>
                                                    +{' '}
                                                    {schedulePhaseSummaries.length -
                                                        3}{' '}
                                                    more phases
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeSection.id === 'one-page-summary' && (
                                <div className='mt-3 space-y-3'>
                                    <AiFeatureDisabledHint enabled={useAI}>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            onClick={() =>
                                                requestGenerateOnePageSummary(
                                                    activeSection.templateData
                                                        ?.subsections || []
                                                )
                                            }
                                            disabled={isGeneratingSummary}
                                            className='w-full justify-start font-light'>
                                            <Sparkles className='h-4 w-4 mr-1' />
                                            {isGeneratingSummary
                                                ? 'Generating...'
                                                : 'Generate'}
                                        </Button>
                                    </AiFeatureDisabledHint>
                                    <p className='text-xs text-muted-foreground font-light'>
                                        Quick-generate concise summary content
                                        for this section.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : null}
                </>
            )}

            <Dialog
                open={scheduleValidationDialogOpen}
                onOpenChange={setScheduleValidationDialogOpen}>
                <DialogContent className='rounded-none sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>Invalid schedule</DialogTitle>
                        <DialogDescription>
                            Schedule has invalid timing values. Please fix date
                            ranges or week selections before saving.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type='button'
                            className='font-light rounded-none'
                            onClick={() =>
                                setScheduleValidationDialogOpen(false)
                            }>
                            OK
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={replaceOnePageSummaryDialogOpen}
                onOpenChange={(open) => {
                    setReplaceOnePageSummaryDialogOpen(open);
                    if (!open) {
                        pendingOnePageSummarySubsectionsRef.current = null;
                    }
                }}>
                <DialogContent className='rounded-none sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>Replace One Page Summary?</DialogTitle>
                        <DialogDescription>
                            Generating again will replace the current One Page
                            Summary content with new AI-generated text.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            className='font-light rounded-none'
                            onClick={() =>
                                setReplaceOnePageSummaryDialogOpen(false)
                            }>
                            Cancel
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            className='font-light rounded-none'
                            onClick={() => {
                                const subs =
                                    pendingOnePageSummarySubsectionsRef.current;
                                setReplaceOnePageSummaryDialogOpen(false);
                                pendingOnePageSummarySubsectionsRef.current =
                                    null;
                                if (subs?.length) {
                                    void runGenerateOnePageSummary(subs);
                                }
                            }}>
                            Replace content
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={revertConfirmDialogOpen}
                onOpenChange={setRevertConfirmDialogOpen}>
                <DialogContent className='rounded-none sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>Discard unsaved changes?</DialogTitle>
                        <DialogDescription>
                            This restores brief content to the last saved
                            version.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            className='font-light rounded-none'
                            onClick={() => setRevertConfirmDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            className='font-light rounded-none'
                            onClick={handleConfirmRevertContent}>
                            Revert changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
