import React, { createContext, useContext } from 'react';
import { useDndContext } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, GripVertical, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { RichTextPlateEditor } from '@/components/rich-text-plate-editor';
import {
    ASSIGNMENT_SETTING_LABELS,
    isAssignmentSettingId,
    type AssignmentSettingId
} from '@/lib/assignment-settings';
import {
    PROJECT_DETAIL_SUBSECTION_LABELS,
    isRemovableProjectDetailSubsection,
    type RemovableProjectDetailSubsectionId
} from '@/lib/project-detail-subsections';
import {
    type CustomSubsection,
    type CustomSubsectionItem,
    type RichTextContent
} from '@/lib/custom-subsections';

type SortableBlockHandle = {
    attributes: React.HTMLAttributes<HTMLElement>;
    listeners: Record<string, unknown> | undefined;
};

const SortableBlockContext = createContext<SortableBlockHandle | null>(null);

export function ProjectDetailGrip({ className }: { className?: string }) {
    const handle = useContext(SortableBlockContext);

    return (
        <button
            type='button'
            className={cn(
                'cursor-grab active:cursor-grabbing touch-none shrink-0 text-muted-foreground hover:text-foreground transition-colors',
                className
            )}
            aria-label='Reorder subsection'
            {...handle?.attributes}
            {...handle?.listeners}>
            <GripVertical className='h-4 w-4' />
        </button>
    );
}

export function ProjectDetailBlockDragPreview({ label }: { label: string }) {
    return (
        <div className='flex items-center gap-2 rounded-none border-2 border-primary bg-background px-4 py-3 shadow-lg'>
            <GripVertical className='h-4 w-4 shrink-0 text-primary' />
            <span className='font-normal text-sm'>{label}</span>
        </div>
    );
}

export function SortableProjectDetailBlock({
    sortId,
    children,
    className
}: {
    sortId: string;
    children: React.ReactNode;
    className?: string;
}) {
    const { active, over } = useDndContext();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: sortId });

    const isDropTarget =
        active != null && over?.id === sortId && active.id !== sortId;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <SortableBlockContext.Provider value={{ attributes, listeners }}>
            <div
                ref={setNodeRef}
                style={style}
                className={cn(
                    'relative',
                    isDragging && 'opacity-30',
                    className
                )}>
                {isDropTarget && (
                    <div
                        aria-hidden
                        className='pointer-events-none absolute inset-x-0 top-0 z-10 h-1 -translate-y-1/2 bg-primary'
                    />
                )}
                <div className='grid min-w-0 grid-cols-1 md:grid-cols-[min(15rem,36%)_minmax(0,1fr)]'>
                    {children}
                </div>
            </div>
        </SortableBlockContext.Provider>
    );
}

type AssignmentSettingsRestoreBadgesProps = {
    hiddenSettingIds: string[];
    onRestore: (id: AssignmentSettingId) => void;
    className?: string;
};

export function AssignmentSettingsRestoreBadges({
    hiddenSettingIds,
    onRestore,
    className
}: AssignmentSettingsRestoreBadgesProps) {
    const hiddenSettings = hiddenSettingIds.filter(isAssignmentSettingId);

    if (hiddenSettings.length === 0) {
        return null;
    }

    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
            <span className='text-xs font-light text-muted-foreground'>
                Add:
            </span>
            {hiddenSettings.map((settingId) => (
                <button
                    key={settingId}
                    type='button'
                    onClick={() => onRestore(settingId)}
                    className='cursor-pointer inline-flex items-center gap-1 rounded-none border border-transparent bg-foreground px-1 py-0.5 text-xs font-normal text-background transition-colors hover:bg-foreground/80'>
                    <Plus className='h-3 w-3 text-background' />
                    {ASSIGNMENT_SETTING_LABELS[settingId]}
                </button>
            ))}
        </div>
    );
}

type ProjectDetailAddBadgesProps = {
    hiddenBuiltinSubsections: string[];
    onRestoreBuiltin: (id: RemovableProjectDetailSubsectionId) => void;
    onAddText: () => void;
    onAddAccordion: () => void;
    className?: string;
};

export function ProjectDetailAddBadges({
    hiddenBuiltinSubsections,
    onRestoreBuiltin,
    onAddText,
    onAddAccordion,
    className
}: ProjectDetailAddBadgesProps) {
    const removableBuiltin = hiddenBuiltinSubsections.filter(
        isRemovableProjectDetailSubsection
    );

    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
            <span className='text-xs font-light text-muted-foreground'>
                Add:
            </span>
            <button
                type='button'
                onClick={onAddText}
                className='cursor-pointer inline-flex items-center gap-1 rounded-none border border-transparent bg-foreground px-1 py-0.5 text-xs font-normal text-background transition-colors hover:bg-foreground/80'>
                <Plus className='h-3 w-3 text-background' />
                Text
            </button>
            <button
                type='button'
                onClick={onAddAccordion}
                className='cursor-pointer inline-flex items-center gap-1 rounded-none border border-transparent bg-foreground px-1 py-0.5 text-xs font-normal text-background transition-colors hover:bg-foreground/80'>
                <Plus className='h-3 w-3 text-background' />
                Accordion
            </button>
            {removableBuiltin.map((subsectionId) => (
                <button
                    key={subsectionId}
                    type='button'
                    onClick={() => onRestoreBuiltin(subsectionId)}
                    className='cursor-pointer inline-flex items-center gap-1 rounded-none border border-transparent bg-foreground px-1 py-0.5 text-xs font-normal text-background transition-colors hover:bg-foreground/80'>
                    <Plus className='h-3 w-3 text-background' />
                    {PROJECT_DETAIL_SUBSECTION_LABELS[subsectionId]}
                </button>
            ))}
        </div>
    );
}

type CustomSubsectionTextRowsProps = {
    subsection: CustomSubsection;
    onUpdate: (patch: Partial<CustomSubsection>) => void;
    onHide: () => void;
};

export function CustomSubsectionTextRows({
    subsection,
    onUpdate,
    onHide
}: CustomSubsectionTextRowsProps) {
    return (
        <>
            <div className='md:border-r border-b'>
                <div className='font-normal h-full flex flex-col justify-between p-4 sm:py-4 sm:px-4'>
                    <div className='flex items-start gap-2 mb-2'>
                        <ProjectDetailGrip className='mt-1' />
                        <div className='flex-1 min-w-0 space-y-2'>
                            <div className='flex items-center justify-between gap-2'>
                                <Input
                                    placeholder='Subsection title...'
                                    value={subsection.title}
                                    onChange={(e) =>
                                        onUpdate({ title: e.target.value })
                                    }
                                    className='font-normal border-0 shadow-none focus-visible:ring-0 p-1 h-auto flex-1 bg-muted/50 focus-visible:bg-muted/80'
                                />
                                <Button
                                    type='button'
                                    size='icon'
                                    variant='ghost'
                                    onClick={onHide}
                                    className='shrink-0 text-destructive hover:text-destructive'
                                    aria-label='Hide subsection'>
                                    <X className='h-4 w-4' />
                                </Button>
                            </div>
                            <Input
                                placeholder='Section subheading...'
                                value={subsection.subheading}
                                onChange={(e) =>
                                    onUpdate({ subheading: e.target.value })
                                }
                                className='font-light text-sm border-0 shadow-none focus-visible:ring-0 bg-muted/50 focus-visible:bg-muted/80 p-1 h-auto'
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div className='col-span-1 border-b'>
                <RichTextPlateEditor
                    placeholder='Subsection content...'
                    value={subsection.content}
                    onChange={(nextValue) => onUpdate({ content: nextValue })}
                    className='min-h-[80px] font-light leading-relaxed p-4 sm:pb-4 sm:px-4 border-0 bg-muted/50 focus-visible:bg-muted/80 p-1'
                />
            </div>
        </>
    );
}

type CustomSubsectionAccordionRowsProps = {
    subsection: CustomSubsection;
    onUpdate: (patch: Partial<CustomSubsection>) => void;
    onHide: () => void;
    onAddItem: () => void;
    onRemoveItem: (itemIndex: number) => void;
    onUpdateItem: (
        itemIndex: number,
        patch: Partial<CustomSubsectionItem>
    ) => void;
};

export function CustomSubsectionAccordionRows({
    subsection,
    onUpdate,
    onHide,
    onAddItem,
    onRemoveItem,
    onUpdateItem
}: CustomSubsectionAccordionRowsProps) {
    const items = subsection.items?.length
        ? subsection.items
        : [{ title: '', content: '' }];
    const rowSpan = (items.length || 1) + 1;

    return (
        <>
            <div
                className='md:border-r row-span-1 border-b'
                style={{ gridRow: `span ${rowSpan}` }}>
                <div className='font-normal h-full flex flex-col justify-between p-4 sm:py-4 sm:px-4'>
                    <div className='flex items-start gap-2 mb-2'>
                        <ProjectDetailGrip className='mt-1' />
                        <div className='flex-1 min-w-0 space-y-2'>
                            <div className='flex items-start justify-between gap-2'>
                                <Input
                                    placeholder='Subsection title...'
                                    value={subsection.title}
                                    onChange={(e) =>
                                        onUpdate({ title: e.target.value })
                                    }
                                    className='font-normal border-0 shadow-none focus-visible:ring-0 p-1 h-auto flex-1 bg-muted/50 focus-visible:bg-muted/80'
                                />
                                <Button
                                    type='button'
                                    size='icon'
                                    variant='ghost'
                                    onClick={onHide}
                                    className='shrink-0 h-7 w-7 text-destructive hover:text-destructive'
                                    aria-label='Hide subsection'>
                                    <X className='h-4 w-4' />
                                </Button>
                            </div>
                            <Input
                                placeholder='Section subheading...'
                                value={subsection.subheading}
                                onChange={(e) =>
                                    onUpdate({ subheading: e.target.value })
                                }
                                className='font-light text-sm border-0 shadow-none focus-visible:ring-0 bg-muted/50 focus-visible:bg-muted/80 p-1 h-auto'
                            />
                        </div>
                    </div>
                </div>
            </div>
            {items.map((item, itemIdx) => (
                <div key={itemIdx} className='col-span-1 border-b'>
                    <details open className='group p-4 sm:pb-4 sm:px-4'>
                        <summary className='flex justify-between items-start gap-2 cursor-pointer font-normal list-none relative transition-all duration-200 hover:translate-x-0.5'>
                            <Input
                                placeholder='Title...'
                                value={item.title}
                                onChange={(e) =>
                                    onUpdateItem(itemIdx, {
                                        title: e.target.value
                                    })
                                }
                                className='font-light border-0 shadow-none focus-visible:ring-0 p-1 h-auto flex-1 bg-muted/50 focus-visible:bg-muted/80'
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span
                                className='font-thin flex-shrink-0 transition-all text-2xl'
                                aria-hidden='true'>
                                <span className='group-open:hidden'>+</span>
                                <span className='hidden group-open:inline'>
                                    –
                                </span>
                            </span>
                        </summary>
                        <div className='mt-2 space-y-2'>
                            <RichTextPlateEditor
                                placeholder='Description...'
                                value={item.content}
                                onChange={(nextValue) =>
                                    onUpdateItem(itemIdx, {
                                        content: nextValue as RichTextContent
                                    })
                                }
                                className='min-h-[60px] font-light leading-relaxed border-0 shadow-none focus-visible:ring-0 p-1 bg-muted/50 focus-visible:bg-muted/80'
                            />
                            {items.length > 1 && (
                                <div className='flex justify-end pt-2'>
                                    <Button
                                        type='button'
                                        size='icon'
                                        variant='ghost'
                                        onClick={() => onRemoveItem(itemIdx)}
                                        className='remove-button-outline'>
                                        <Trash2 className='h-4 w-4' />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </details>
                </div>
            ))}
            <div className='col-span-1 border-b p-2 sm:p-2'>
                <div className='flex justify-end'>
                    <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        onClick={onAddItem}
                        className='add-button'>
                        <Plus className='h-3 w-3' />
                        Add
                    </Button>
                </div>
            </div>
        </>
    );
}
