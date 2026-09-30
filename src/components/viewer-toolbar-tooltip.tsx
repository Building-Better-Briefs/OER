'use client';

import type { ReactNode } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';

export function tooltipSideForPlacement(
    placement: 'top' | 'sidebar' | 'mobile-bottom'
): 'top' | 'right' | 'bottom' | 'left' {
    switch (placement) {
        case 'sidebar':
            return 'left';
        case 'mobile-bottom':
            return 'top';
        default:
            return 'bottom';
    }
}

export function ViewerToolbarTooltipProvider({
    children
}: {
    children: ReactNode;
}) {
    return (
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    );
}

export function ViewerToolbarTooltip({
    label,
    enabled = true,
    side,
    children
}: {
    label: string;
    enabled?: boolean;
    side: 'top' | 'right' | 'bottom' | 'left';
    children: ReactNode;
}) {
    if (!enabled) {
        return children;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side} sideOffset={8}>
                {label}
            </TooltipContent>
        </Tooltip>
    );
}
