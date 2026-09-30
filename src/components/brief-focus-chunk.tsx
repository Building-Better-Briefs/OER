'use client';

import { cn } from '@/lib/utils';
import type { HTMLAttributes, ReactNode } from 'react';

type BriefFocusChunkProps = HTMLAttributes<HTMLDivElement> & {
    id: string;
    enabled?: boolean;
    focusClassName?: string;
    children: ReactNode;
};

export function BriefFocusChunk({
    id,
    enabled = true,
    focusClassName,
    className,
    children,
    ...props
}: BriefFocusChunkProps) {
    return (
        <div
            {...props}
            className={cn(className, enabled ? focusClassName : undefined)}
            {...(enabled ? { 'data-brief-focus-id': id } : {})}>
            {children}
        </div>
    );
}
