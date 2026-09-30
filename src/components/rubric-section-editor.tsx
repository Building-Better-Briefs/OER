import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
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
    Plus,
    GripVertical,
    Trash2,
    Save,
    ChevronDown,
    Sparkles
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
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
import { AiFeatureDisabledHint } from '@/components/ai-feature-disabled-hint';
import { parseAiDisabledFromResponse } from '@/lib/ai-access';
import { AI_SETTINGS_ENABLE_HINT } from '@/lib/ai-powered-features';
import { RichTextPlateEditor } from '@/components/rich-text-plate-editor';
import { richTextToPlainText } from '@/lib/rich-text-utils';
import type { RubricCriterion } from '@/lib/rubric-types';
import {
    GradeGrouping,
    parseRubricCustomGradeList,
    buildCustomGradeDescriptors,
    createEmptyRubricCriterion
} from '@/lib/rubric-types';

function parseAIJsonResponse(response: string): unknown {
    let cleanedResponse = response.trim();

    if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse
            .replace(/```json\n?/g, '')
            .replace(/```$/g, '')
            .trim();
    } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/g, '').trim();
    }

    return JSON.parse(cleanedResponse);
}

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
    return parseAIJsonResponse(data.response);
}

interface SortableRubricCriterionCardProps {
    id: string;
    criterion: RubricCriterion;
    index: number;
    isSelected: boolean;
    canDelete: boolean;
    onOpen: () => void;
    onDelete: () => void;
}

function SortableRubricCriterionCard({
    id,
    criterion,
    index,
    isSelected,
    canDelete,
    onOpen,
    onDelete
}: SortableRubricCriterionCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm',
                isSelected && 'border-primary',
                isDragging && 'opacity-60 shadow-lg'
            )}>
            <div className='mb-2 flex items-center justify-between gap-2 items-center'>
                <div className='flex items-center gap-2'>
                    <button
                        type='button'
                        className='cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors'
                        aria-label={`Drag criterion ${index + 1}`}
                        {...attributes}
                        {...listeners}>
                        <GripVertical className='h-4 w-4' />
                    </button>
                    <p className='text-xs text-muted-foreground font-light'>
                        Criterion {index + 1}
                    </p>
                </div>
                <div className='flex items-center gap-2'>
                    <p className='text-xs text-muted-foreground font-light'>
                        {criterion.weighting || 0}%
                    </p>
                    {canDelete && (
                        <button
                            type='button'
                            aria-label={`Delete criterion ${index + 1}`}
                            className='text-muted-foreground hover:text-destructive transition-colors'
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}>
                            <Trash2 className='h-4 w-4' />
                        </button>
                    )}
                </div>
            </div>

            <button
                type='button'
                onClick={onOpen}
                className='w-full text-left cursor-pointer'>
                <h4 className='font-normal text-sm leading-snug line-clamp-2'>
                    {criterion.criterion.trim() || 'Untitled Criterion'}
                </h4>
                <p className='mt-3 line-clamp-2 text-xs text-muted-foreground font-light'>
                    {criterion.assessedThrough.trim() ||
                        'No assessed-through description yet.'}
                </p>
                <div className='mt-4 flex items-center gap-2 text-xs text-muted-foreground font-light'>
                    <span className='border px-2 py-1'>
                        LOs: {criterion.learningOutcomes.length}
                    </span>
                    <span className='border px-2 py-1'>
                        Grades: {criterion.gradeDescriptors.length}
                    </span>
                </div>
            </button>
        </div>
    );
}

export type RubricSectionEditorProps = {
    rubricCriteria: RubricCriterion[];
    setRubricCriteria: React.Dispatch<
        React.SetStateAction<RubricCriterion[]>
    >;
    learningOutcomesMode: 'none' | 'brief';
    learningOutcomes?: Array<{ title: string; weighting: number }>;
    /** Brief builder: marks dirty on edits; omit or no-op on standalone rubric pages. */
    onCriteriaEdited?: () => void;
    getDescriptorAiContext: () => Record<string, unknown>;
    isSaving?: boolean;
    /** Brief builder persists full brief; standalone closes sheet without server round-trip here. */
    onSheetPersist?: () => Promise<boolean>;
    useAI: boolean;
};

export function RubricSectionEditor({
    rubricCriteria,
    setRubricCriteria,
    learningOutcomesMode,
    learningOutcomes = [],
    onCriteriaEdited,
    getDescriptorAiContext,
    isSaving = false,
    onSheetPersist,
    useAI
}: RubricSectionEditorProps) {
    const [selectedCriterionIndex, setSelectedCriterionIndex] = useState<
        number | null
    >(null);
    const [
        isGeneratingDescriptorSuggestions,
        setIsGeneratingDescriptorSuggestions
    ] = useState(false);
    const [isDescriptorPopoverOpen, setIsDescriptorPopoverOpen] =
        useState(false);
    const [descriptorGradeGrouping, setDescriptorGradeGrouping] =
        useState<GradeGrouping>('grouped');
    const [descriptorCustomGradeList, setDescriptorCustomGradeList] = useState(
        'A / B+, B / B-, C+ / C, D / F'
    );

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const selectedCriterion =
        selectedCriterionIndex !== null
            ? rubricCriteria[selectedCriterionIndex] || null
            : null;

    const bumpEdited = useCallback(() => {
        onCriteriaEdited?.();
    }, [onCriteriaEdited]);

    const updateRubricCriteria = (
        updater: (criteria: RubricCriterion[]) => RubricCriterion[]
    ) => {
        setRubricCriteria((prev) => updater(prev));
        bumpEdited();
    };

    const updateRubricCriterion = (
        criterionIndex: number,
        updater: (criterion: RubricCriterion) => RubricCriterion
    ) => {
        updateRubricCriteria((prev) =>
            prev.map((criterion, index) =>
                index === criterionIndex ? updater(criterion) : criterion
            )
        );
    };

    const addRubricCriterion = () => {
        const newCriterion = createEmptyRubricCriterion();
        const newIndex = rubricCriteria.length;
        setRubricCriteria((prev) => [...prev, newCriterion]);
        bumpEdited();
        setSelectedCriterionIndex(newIndex);
    };

    const removeRubricCriterion = (index: number) => {
        updateRubricCriteria((prev) => prev.filter((_, i) => i !== index));
        setSelectedCriterionIndex((prev) => {
            if (prev === null) return null;
            if (prev === index) return null;
            if (prev > index) return prev - 1;
            return prev;
        });
    };

    const handleRubricDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = Number(
            String(active.id).replace('rubric-criterion-', '')
        );
        const newIndex = Number(
            String(over.id).replace('rubric-criterion-', '')
        );

        if (
            Number.isNaN(oldIndex) ||
            Number.isNaN(newIndex) ||
            oldIndex < 0 ||
            newIndex < 0
        ) {
            return;
        }

        setRubricCriteria((prev) => arrayMove(prev, oldIndex, newIndex));
        bumpEdited();
        setSelectedCriterionIndex((prev) => {
            if (prev === null) return null;
            if (prev === oldIndex) return newIndex;
            if (oldIndex < prev && prev <= newIndex) return prev - 1;
            if (newIndex <= prev && prev < oldIndex) return prev + 1;
            return prev;
        });
    };

    const addGradeDescriptor = (criterionIndex: number) => {
        updateRubricCriterion(criterionIndex, (criterion) => ({
            ...criterion,
            gradeDescriptors: [
                ...criterion.gradeDescriptors,
                {
                    grade: '',
                    description: ''
                }
            ]
        }));
    };

    const addPresetGradeDescriptors = (
        criterionIndex: number,
        presetType: 'grouped' | 'separate'
    ) => {
        let nextDescriptors: Array<{ grade: string; description: string }> = [];
        if (presetType === 'grouped') {
            nextDescriptors = [
                { grade: 'A/B+', description: '' },
                { grade: 'B/B-', description: '' },
                { grade: 'C+/C', description: '' },
                { grade: 'D/F', description: '' }
            ];
        }
        if (presetType === 'separate') {
            nextDescriptors = [
                { grade: 'A', description: '' },
                { grade: 'B+', description: '' },
                { grade: 'B', description: '' },
                { grade: 'B-', description: '' },
                { grade: 'C+', description: '' },
                { grade: 'C', description: '' },
                { grade: 'D', description: '' },
                { grade: 'F', description: '' }
            ];
        }
        updateRubricCriterion(criterionIndex, (criterion) => ({
            ...criterion,
            gradeDescriptors: nextDescriptors
        }));
    };

    const removeGradeDescriptor = (
        criterionIndex: number,
        descriptorIndex: number
    ) => {
        updateRubricCriterion(criterionIndex, (criterion) => ({
            ...criterion,
            gradeDescriptors: criterion.gradeDescriptors.filter(
                (_, i) => i !== descriptorIndex
            )
        }));
    };

    const createDefaultGradeDescriptors = (
        grouping: GradeGrouping,
        customGrades: string[] | null
    ) => {
        if (grouping === 'custom' && customGrades && customGrades.length > 0) {
            return buildCustomGradeDescriptors(customGrades);
        }
        if (grouping === 'grouped') {
            return [
                { grade: 'A/B+', description: '' },
                { grade: 'B/B-', description: '' },
                { grade: 'C+/C', description: '' },
                { grade: 'D/F', description: '' }
            ];
        }
        return [
            { grade: 'A', description: '' },
            { grade: 'B+', description: '' },
            { grade: 'B', description: '' },
            { grade: 'B-', description: '' },
            { grade: 'C+', description: '' },
            { grade: 'C', description: '' },
            { grade: 'D', description: '' },
            { grade: 'F', description: '' }
        ];
    };

    const handleGenerateGradeDescriptorsForCriterion = async (
        criterionIndex: number,
        gradeGrouping: GradeGrouping,
        customGradeListRaw: string
    ) => {
        const customParsed =
            gradeGrouping === 'custom'
                ? parseRubricCustomGradeList(customGradeListRaw)
                : null;
        if (
            gradeGrouping === 'custom' &&
            (!customParsed || customParsed.length < 2)
        ) {
            alert(
                'Please enter at least two custom grade band labels (comma- or line-separated).'
            );
            return;
        }

        setIsGeneratingDescriptorSuggestions(true);

        try {
            const customGradesForPrompt = customParsed ?? null;

            const gradesInstruction =
                gradeGrouping === 'custom' && customGradesForPrompt
                    ? `Use gradeDescriptors with these exact grade labels only, in this order (one descriptor row per label): ${customGradesForPrompt.join(' | ')}. Do not add, remove, or rename grade rows.`
                    : gradeGrouping === 'grouped'
                      ? 'Use grouped gradeDescriptors for these grade bands only: A/B+, B/B-, C+/C, D/F.'
                      : 'Use separate gradeDescriptors for these grades only: A, B+, B, B-, C+, C, D, F.';

            const exampleGradeDescriptors =
                gradeGrouping === 'custom' && customGradesForPrompt
                    ? customGradesForPrompt.map((label, i) => ({
                          grade: label,
                          description:
                              i === 0
                                  ? 'Defines the problem with clear scope and strong evidence.'
                                  : i === 1
                                    ? 'Defines the problem clearly with good evidence.'
                                    : 'Descriptor text for this band.'
                      }))
                    : null;

            const criterionToGenerate = rubricCriteria[criterionIndex];
            if (!criterionToGenerate) {
                throw new Error('Criterion not found.');
            }

            const selectedLearningOutcomes =
                criterionToGenerate.learningOutcomes
                    .map((idx) => learningOutcomes[idx]?.title)
                    .filter((title): title is string => Boolean(title));

            const parsedContent = await generateAIContent({
                context: getDescriptorAiContext(),
                prompt: `Using the brief context, generate grade descriptors for ONE assessment criterion.
Criterion: "${criterionToGenerate.criterion || 'Untitled Criterion'}"
Assessed through: "${criterionToGenerate.assessedThrough || 'Not specified'}"
Weighting: ${criterionToGenerate.weighting || 0}%
Linked learning outcomes: ${
                    selectedLearningOutcomes.length > 0
                        ? selectedLearningOutcomes.join(' | ')
                        : 'None selected'
                }
${gradesInstruction}
Return only gradeDescriptors. Keep descriptors concise, specific, and aligned to this criterion.`,
                exampleFormat: {
                    gradeDescriptors: exampleGradeDescriptors
                        ? exampleGradeDescriptors
                        : createDefaultGradeDescriptors(
                              gradeGrouping,
                              customGradesForPrompt
                          )
                }
            });

            const generatedGradeDescriptorsRaw = Array.isArray(parsedContent)
                ? parsedContent
                : Array.isArray((parsedContent as { gradeDescriptors?: unknown })?.gradeDescriptors)
                  ? (parsedContent as { gradeDescriptors: unknown[] })
                        .gradeDescriptors
                  : null;

            if (!generatedGradeDescriptorsRaw) {
                throw new Error('Generated grade descriptors are not valid.');
            }

            const generatedGradeDescriptors = generatedGradeDescriptorsRaw
                .map((descriptor: unknown) => {
                    const d = descriptor as {
                        grade?: unknown;
                        description?: unknown;
                    };
                    return {
                        grade:
                            typeof d?.grade === 'string'
                                ? d.grade.trim()
                                : '',
                        description:
                            typeof d?.description === 'string'
                                ? d.description.trim()
                                : ''
                    };
                })
                .filter(
                    (descriptor: { grade: string; description: string }) =>
                        descriptor.grade.length > 0
                );

            if (generatedGradeDescriptors.length === 0) {
                throw new Error('No valid grade descriptors were generated.');
            }

            updateRubricCriterion(criterionIndex, (criterion) => ({
                ...criterion,
                gradeDescriptors: generatedGradeDescriptors
            }));
            setIsDescriptorPopoverOpen(false);
        } catch (error) {
            console.error('Failed to generate grade descriptors:', error);
            alert(
                `Error generating grade descriptors: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        } finally {
            setIsGeneratingDescriptorSuggestions(false);
        }
    };

    // Clamp the selection when criteria are removed. Adjusted during render
    // instead of in an effect — self-terminating invariant, no external
    // system involved.
    if (
        selectedCriterionIndex !== null &&
        (selectedCriterionIndex < 0 ||
            selectedCriterionIndex >= rubricCriteria.length)
    ) {
        setSelectedCriterionIndex(null);
    }

    return (
        <div className='space-y-4'>
            <div className='flex items-center justify-between'>
                <Label className='font-normal'>Assessment Criteria</Label>
                <Button
                    type='button'
                    size='sm'
                    variant='link'
                    onClick={addRubricCriterion}
                    className='font-light'>
                    <Plus className='h-4 w-4 mr-1' />
                    Add Criterion
                </Button>
            </div>
            <DndContext
                id='rubric-criteria-sort'
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleRubricDragEnd}>
                <SortableContext
                    items={rubricCriteria.map(
                        (_, idx) => `rubric-criterion-${idx}`
                    )}
                    strategy={verticalListSortingStrategy}>
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                        {rubricCriteria.map((criterion, critIdx) => (
                            <SortableRubricCriterionCard
                                key={`rubric-criterion-${critIdx}`}
                                id={`rubric-criterion-${critIdx}`}
                                criterion={criterion}
                                index={critIdx}
                                isSelected={
                                    selectedCriterionIndex === critIdx
                                }
                                canDelete={rubricCriteria.length > 1}
                                onOpen={() =>
                                    setSelectedCriterionIndex(critIdx)
                                }
                                onDelete={() =>
                                    removeRubricCriterion(critIdx)
                                }
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            <Sheet
                open={selectedCriterionIndex !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedCriterionIndex(null);
                    }
                }}>
                <SheetContent
                    side='left'
                    className='w-full overflow-y-auto sm:max-w-3xl'>
                    <SheetHeader>
                        <SheetTitle>
                            {selectedCriterionIndex !== null
                                ? `Criterion ${selectedCriterionIndex + 1}`
                                : 'Criterion'}
                        </SheetTitle>
                        <SheetDescription>
                            Edit criterion details,
                            {learningOutcomesMode === 'brief'
                                ? ' learning outcomes, and '
                                : ' '}
                            grade descriptors.
                        </SheetDescription>
                    </SheetHeader>
                    {selectedCriterionIndex !== null &&
                        selectedCriterion && (
                            <div className='mt-6 space-y-4 pb-6'>
                                <div className='flex items-center justify-end gap-2'>
                                    {rubricCriteria.length > 1 && (
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='destructive'
                                            onClick={() =>
                                                removeRubricCriterion(
                                                    selectedCriterionIndex
                                                )
                                            }>
                                            <Trash2 className='h-4 w-4' />
                                        </Button>
                                    )}
                                    {onSheetPersist ? (
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='default'
                                            disabled={isSaving}
                                            onClick={async () => {
                                                const ok =
                                                    await onSheetPersist();
                                                if (ok) {
                                                    setSelectedCriterionIndex(
                                                        null
                                                    );
                                                }
                                            }}>
                                            <Save className='h-4 w-4' />
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </Button>
                                    ) : (
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='outline'
                                            onClick={() =>
                                                setSelectedCriterionIndex(null)
                                            }>
                                            Done
                                        </Button>
                                    )}
                                </div>
                                <div className='grid gap-0 border md:grid-cols-[2fr_2.3fr_1.3fr] bg-card'>
                                    <div className='border-b p-3 md:border-b-0 md:border-r'>
                                        <Label className='text-xs font-light tracking-wide text-muted-foreground'>
                                            Criterion Name
                                        </Label>
                                        <Input
                                            placeholder='e.g., Problem Identification'
                                            value={selectedCriterion.criterion}
                                            onChange={(e) =>
                                                updateRubricCriterion(
                                                    selectedCriterionIndex,
                                                    (criterionValue) => ({
                                                        ...criterionValue,
                                                        criterion:
                                                            e.target.value
                                                    })
                                                )
                                            }
                                            className='mt-2 font-light bg-muted/50 focus-visible:bg-muted/80 p-1'
                                        />
                                    </div>
                                    <div className='border-b p-3 md:border-b-0 md:border-r'>
                                        <Label className='text-xs font-light tracking-wide text-muted-foreground'>
                                            Assessed Through
                                        </Label>
                                        <Textarea
                                            placeholder='How this criterion is assessed...'
                                            value={
                                                selectedCriterion.assessedThrough
                                            }
                                            onChange={(e) =>
                                                updateRubricCriterion(
                                                    selectedCriterionIndex,
                                                    (criterionValue) => ({
                                                        ...criterionValue,
                                                        assessedThrough:
                                                            e.target.value
                                                    })
                                                )
                                            }
                                            className='mt-2 min-h-[60px] font-light bg-muted/50 focus-visible:bg-muted/80 p-1'
                                        />
                                    </div>
                                    <div className='p-3'>
                                        <Label className='text-xs font-light tracking-wide text-muted-foreground'>
                                            Weighting (%)
                                        </Label>
                                        <Input
                                            type='number'
                                            placeholder='25'
                                            value={
                                                selectedCriterion.weighting ||
                                                ''
                                            }
                                            onChange={(e) =>
                                                updateRubricCriterion(
                                                    selectedCriterionIndex,
                                                    (criterionValue) => ({
                                                        ...criterionValue,
                                                        weighting:
                                                            parseInt(
                                                                e.target
                                                                    .value
                                                            ) || 0
                                                    })
                                                )
                                            }
                                            className='mt-2 font-light bg-muted/50 focus-visible:bg-muted/80 p-1'
                                        />
                                    </div>
                                </div>
                                {learningOutcomesMode === 'brief' && (
                                    <div className='border p-3 bg-card'>
                                        <Label className='text-xs font-light tracking-wide text-muted-foreground'>
                                            Learning Outcomes
                                            <span className='text-xs text-muted-foreground font-light'>
                                                {' '}
                                                (Optional)
                                            </span>
                                        </Label>
                                        <div className='mt-2 space-y-2'>
                                            {learningOutcomes.map(
                                                (lo, loIdx) => (
                                                    <div
                                                        key={loIdx}
                                                        className='flex items-center space-x-2'>
                                                        <Checkbox
                                                            id={`rubric-sheet-${selectedCriterionIndex}-lo-${loIdx}`}
                                                            checked={selectedCriterion.learningOutcomes.includes(
                                                                loIdx
                                                            )}
                                                            onCheckedChange={(
                                                                checked
                                                            ) =>
                                                                updateRubricCriterion(
                                                                    selectedCriterionIndex,
                                                                    (
                                                                        criterionValue
                                                                    ) => ({
                                                                        ...criterionValue,
                                                                        learningOutcomes:
                                                                            checked
                                                                                ? Array.from(
                                                                                      new Set(
                                                                                          [
                                                                                              ...criterionValue.learningOutcomes,
                                                                                              loIdx
                                                                                          ]
                                                                                      )
                                                                                  )
                                                                                : criterionValue.learningOutcomes.filter(
                                                                                      (
                                                                                          idx
                                                                                      ) =>
                                                                                          idx !==
                                                                                          loIdx
                                                                                  )
                                                                    })
                                                                )
                                                            }
                                                        />
                                                        <Label
                                                            htmlFor={`rubric-sheet-${selectedCriterionIndex}-lo-${loIdx}`}
                                                            className='cursor-pointer text-sm font-light'>
                                                            LO
                                                            {loIdx + 1}:{' '}
                                                            {lo.title ||
                                                                'Untitled'}
                                                        </Label>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className='border p-3 bg-card'>
                                    <div className='mb-2 flex items-center justify-between'>
                                        <Label className='text-xs font-light tracking-wide text-muted-foreground'>
                                            Grade Descriptors
                                        </Label>
                                        <div className='flex items-center gap-0'>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type='button'
                                                        size='sm'
                                                        variant='link'
                                                        className='px-1 font-light'>
                                                        <ChevronDown className='h-3 w-3' />
                                                        Preset
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align='end'>
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            addPresetGradeDescriptors(
                                                                selectedCriterionIndex,
                                                                'grouped'
                                                            )
                                                        }>
                                                        Grouped
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            addPresetGradeDescriptors(
                                                                selectedCriterionIndex,
                                                                'separate'
                                                            )
                                                        }>
                                                        Separate
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AiFeatureDisabledHint enabled={useAI}>
                                                <Popover
                                                    open={
                                                        useAI
                                                            ? isDescriptorPopoverOpen
                                                            : false
                                                    }
                                                    onOpenChange={
                                                        useAI
                                                            ? setIsDescriptorPopoverOpen
                                                            : undefined
                                                    }>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type='button'
                                                            size='sm'
                                                            variant='link'
                                                            className='px-1 font-light'>
                                                            <Sparkles className='h-3 w-3' />
                                                            Generate
                                                        </Button>
                                                    </PopoverTrigger>
                                                <PopoverContent
                                                    align='end'
                                                    className='w-80 space-y-3 z-[120]'>
                                                    <div className='space-y-1 z-[120]'>
                                                        <p className='text-sm font-normal'>
                                                            Generate Grade
                                                            Descriptors
                                                        </p>
                                                        <p className='text-xs text-muted-foreground font-light'>
                                                            AI will use context
                                                            and this criterion.
                                                        </p>
                                                    </div>
                                                    <div className='space-y-2 z-[125]'>
                                                        <Label className='text-xs font-light text-muted-foreground z-[125]'>
                                                            Grade Grouping
                                                        </Label>
                                                        <Select
                                                            value={
                                                                descriptorGradeGrouping
                                                            }
                                                            onValueChange={(
                                                                value
                                                            ) =>
                                                                setDescriptorGradeGrouping(
                                                                    value as GradeGrouping
                                                                )
                                                            }>
                                                            <SelectTrigger className='h-8'>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className='z-[125]'>
                                                                <SelectItem value='grouped'>
                                                                    Grouped
                                                                </SelectItem>
                                                                <SelectItem value='separate'>
                                                                    Separate
                                                                </SelectItem>
                                                                <SelectItem value='custom'>
                                                                    Custom
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {descriptorGradeGrouping ===
                                                        'custom' && (
                                                        <div className='space-y-2'>
                                                            <Label className='text-xs font-light text-muted-foreground'>
                                                                Custom grade
                                                                labels
                                                            </Label>
                                                            <Textarea
                                                                value={
                                                                    descriptorCustomGradeList
                                                                }
                                                                onChange={(e) =>
                                                                    setDescriptorCustomGradeList(
                                                                        e.target
                                                                            .value
                                                                    )
                                                                }
                                                                placeholder='A / B+, B / B-, C+ / C, D / F'
                                                                className='min-h-[88px] font-light text-sm'
                                                            />
                                                        </div>
                                                    )}
                                                    <div className='flex items-center justify-end gap-2'>
                                                        <Button
                                                            type='button'
                                                            variant='ghost'
                                                            size='sm'
                                                            onClick={() =>
                                                                setIsDescriptorPopoverOpen(
                                                                    false
                                                                )
                                                            }
                                                            disabled={
                                                                isGeneratingDescriptorSuggestions
                                                            }>
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            type='button'
                                                            size='sm'
                                                            onClick={() =>
                                                                handleGenerateGradeDescriptorsForCriterion(
                                                                    selectedCriterionIndex,
                                                                    descriptorGradeGrouping,
                                                                    descriptorCustomGradeList
                                                                )
                                                            }
                                                            disabled={
                                                                isGeneratingDescriptorSuggestions
                                                            }>
                                                            {isGeneratingDescriptorSuggestions
                                                                ? 'Generating...'
                                                                : 'Generate'}
                                                        </Button>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                            </AiFeatureDisabledHint>
                                        </div>
                                    </div>
                                    <div className='border'>
                                        <div className='grid grid-cols-[9rem_1fr] border-b bg-muted/20'>
                                            <div className='border-r p-2 text-xs font-normal'>
                                                Grade
                                            </div>
                                            <div className='p-2 text-xs font-normal'>
                                                Descriptor
                                            </div>
                                        </div>
                                        {selectedCriterion.gradeDescriptors.map(
                                            (descriptor, descIdx) => (
                                                <div
                                                    key={`grade-desc-${selectedCriterionIndex}-${descIdx}`}
                                                    className='grid grid-cols-[9rem_1fr] border-b last:border-b-0'>
                                                    <div className='space-y-2 border-r p-2'>
                                                        <Input
                                                            placeholder='A, B+, etc.'
                                                            value={
                                                                descriptor.grade
                                                            }
                                                            onChange={(e) =>
                                                                updateRubricCriterion(
                                                                    selectedCriterionIndex,
                                                                    (
                                                                        criterionValue
                                                                    ) => ({
                                                                        ...criterionValue,
                                                                        gradeDescriptors:
                                                                            criterionValue.gradeDescriptors.map(
                                                                                (
                                                                                    item,
                                                                                    itemIdx
                                                                                ) =>
                                                                                    itemIdx ===
                                                                                    descIdx
                                                                                        ? {
                                                                                              ...item,
                                                                                              grade: e
                                                                                                  .target
                                                                                                  .value
                                                                                          }
                                                                                        : item
                                                                            )
                                                                    })
                                                                )
                                                            }
                                                            className='h-8 text-sm font-light bg-muted/50 focus-visible:bg-muted/80 p-1'
                                                        />
                                                        {selectedCriterion
                                                            .gradeDescriptors
                                                            .length > 1 && (
                                                            <Button
                                                                type='button'
                                                                size='sm'
                                                                variant='ghost'
                                                                onClick={() =>
                                                                    removeGradeDescriptor(
                                                                        selectedCriterionIndex,
                                                                        descIdx
                                                                    )
                                                                }
                                                                className='h-7 w-full text-xs font-light text-red-500 hover:text-red-600 dark:hover:bg-red-500/10 hover:bg-red-500/10'>
                                                                Remove
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div className='space-y-2 p-2'>
                                                        <RichTextPlateEditor
                                                            key={`descriptor-editor-${selectedCriterionIndex}-${descIdx}`}
                                                            placeholder='Description for this grade...'
                                                            value={
                                                                descriptor.description
                                                            }
                                                            onChange={(
                                                                nextValue
                                                            ) =>
                                                                updateRubricCriterion(
                                                                    selectedCriterionIndex,
                                                                    (
                                                                        criterionValue
                                                                    ) => ({
                                                                        ...criterionValue,
                                                                        gradeDescriptors:
                                                                            criterionValue.gradeDescriptors.map(
                                                                                (
                                                                                    item,
                                                                                    itemIdx
                                                                                ) =>
                                                                                    itemIdx ===
                                                                                    descIdx
                                                                                        ? {
                                                                                              ...item,
                                                                                              description:
                                                                                                  nextValue
                                                                                          }
                                                                                        : item
                                                                            )
                                                                    })
                                                                )
                                                            }
                                                            className='min-h-[56px] border-0 p-1 text-sm font-light focus-visible:ring-0 bg-muted/50 focus-visible:bg-muted/80'
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                    <div className='flex justify-end pt-2'>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='link'
                                            onClick={() =>
                                                addGradeDescriptor(
                                                    selectedCriterionIndex
                                                )
                                            }
                                            className='font-light'>
                                            <Plus className='mr-1 h-3 w-3' />
                                            Add Grade
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
