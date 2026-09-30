import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import type { BriefStatusValue } from '@/lib/brief-status';
import { cn } from '@/lib/utils';

type BriefStatusFieldProps = {
    value: BriefStatusValue;
    onChange: (value: BriefStatusValue) => void;
    disabled?: boolean;
    isSaving?: boolean;
    showPublishHint?: boolean;
    onDismissPublishHint?: () => void;
    className?: string;
};

export function BriefStatusField({
    value,
    onChange,
    disabled = false,
    isSaving = false,
    showPublishHint = false,
    onDismissPublishHint,
    className
}: BriefStatusFieldProps) {
    const [hintOpen, setHintOpen] = useState(false);
    const isDisabled = disabled || isSaving;
    const isPublished = value === 'PUBLISHED';

    // Re-derive hintOpen only when showPublishHint/value actually change —
    // hintOpen can also be closed manually via the Tooltip's onOpenChange,
    // so this must not re-run every render (that would re-open a hint the
    // user just dismissed before the parent prop update lands). Adjusted
    // during render instead of in an effect.
    const [prevHintDeps, setPrevHintDeps] = useState([
        showPublishHint,
        value
    ]);
    if (
        showPublishHint !== prevHintDeps[0] ||
        value !== prevHintDeps[1]
    ) {
        setPrevHintDeps([showPublishHint, value]);
        setHintOpen(showPublishHint && value === 'DRAFT');
    }

    const applyStatus = (checked: boolean) => {
        const status: BriefStatusValue = checked ? 'PUBLISHED' : 'DRAFT';
        if (status === value) {
            return;
        }
        if (checked) {
            setHintOpen(false);
            onDismissPublishHint?.();
        }
        onChange(status);
    };

    const control = (
        <div
            className={cn(
                'inline-flex items-center gap-2 rounded-none border border-border bg-background px-3 py-2 shadow-sm',
                className
            )}
            role='group'
            aria-label='Brief status'>
            <button
                type='button'
                disabled={isDisabled}
                onClick={() => applyStatus(false)}
                className={cn(
                    'cursor-pointer select-none border-0 bg-transparent p-0 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    !isPublished
                        ? 'text-amber-800 dark:text-amber-200'
                        : 'text-muted-foreground'
                )}>
                Draft
            </button>

            <Switch
                checked={isPublished}
                disabled={isDisabled}
                onCheckedChange={applyStatus}
                aria-label='Publish brief'
                className={cn(
                    'data-[state=unchecked]:bg-amber-300 dark:data-[state=unchecked]:bg-amber-800/70',
                    'data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-600'
                )}
            />

            <button
                type='button'
                disabled={isDisabled}
                onClick={() => applyStatus(true)}
                className={cn(
                    'min-w-[4.5rem] cursor-pointer select-none border-0 bg-transparent p-0 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    isPublished
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : 'text-muted-foreground'
                )}>
                {isPublished ? 'Published' : 'Publish'}
            </button>
        </div>
    );

    if (!showPublishHint) {
        return control;
    }

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip
                open={hintOpen}
                onOpenChange={(open) => {
                    setHintOpen(open);
                    if (!open) {
                        onDismissPublishHint?.();
                    }
                }}>
                <TooltipTrigger asChild>{control}</TooltipTrigger>
                <TooltipContent side='top' className='max-w-xs'>
                    Publish this brief so students can view the content.
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
