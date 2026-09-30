'use client';

import { cloneElement, isValidElement } from 'react';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger
} from '@/components/ui/hover-card';
import { AiSettingsEnableMessage } from '@/components/ai-settings-enable-message';
import { AI_ACCENT_HOVER_CARD_CLASS } from '@/lib/ai-powered-features';
import { cn } from '@/lib/utils';

type AiFeatureDisabledHintProps = {
    enabled: boolean;
    children: React.ReactElement;
    className?: string;
};

export function AiFeatureDisabledHint({
    enabled,
    children,
    className
}: AiFeatureDisabledHintProps) {
    if (enabled) {
        return children;
    }

    if (!isValidElement(children)) {
        return children;
    }

    const disabledChild = cloneElement(children, {
        disabled: true,
        'aria-disabled': true,
        onClick: undefined,
        className: cn(
            (children.props as { className?: string }).className,
            'opacity-60'
        )
    } as Record<string, unknown>);

    return (
        <HoverCard openDelay={0} closeDelay={100}>
            <HoverCardTrigger asChild>
                <span
                    className={cn(
                        'inline-flex cursor-not-allowed',
                        className
                    )}>
                    {disabledChild}
                </span>
            </HoverCardTrigger>
            <HoverCardContent
                align='end'
                className={AI_ACCENT_HOVER_CARD_CLASS}>
                <AiSettingsEnableMessage layout='stacked' />
            </HoverCardContent>
        </HoverCard>
    );
}
