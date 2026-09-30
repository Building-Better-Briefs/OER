'use client';

import Link from '@/components/app-link';
import { useBriefBuilderOptional } from '@/builder/brief-builder-context';
import {
    AI_ACCENT_LINK_CLASS,
    AI_ACCENT_TEXT_CLASS,
    AI_SETTINGS_ENABLE_HINT,
    AI_SETTINGS_SAVE_BEFORE_ENABLE_HINT
} from '@/lib/ai-powered-features';
import { cn } from '@/lib/utils';

type AiSettingsEnableMessageProps = {
    className?: string;
    textClassName?: string;
    linkClassName?: string;
    showLink?: boolean;
    as?: 'p' | 'span' | 'div';
    layout?: 'inline' | 'stacked';
};

function useAiSettingsMessageState() {
    const builderContext = useBriefBuilderOptional();
    const saveBeforeSettings = Boolean(builderContext?.isDirty);

    return {
        hint: saveBeforeSettings
            ? AI_SETTINGS_SAVE_BEFORE_ENABLE_HINT
            : AI_SETTINGS_ENABLE_HINT,
        showSettingsLink: !saveBeforeSettings
    };
}

export function AiSettingsEnableMessage({
    className,
    textClassName,
    linkClassName,
    showLink = true,
    as: Tag = 'p',
    layout = 'inline'
}: AiSettingsEnableMessageProps) {
    const { hint, showSettingsLink } = useAiSettingsMessageState();
    const canLink = showLink && showSettingsLink;

    if (layout === 'stacked') {
        return (
            <div className={cn('space-y-2', className)}>
                <p
                    className={cn(
                        'text-sm leading-snug',
                        AI_ACCENT_TEXT_CLASS,
                        textClassName
                    )}>
                    {hint}
                </p>
                {canLink ? (
                    <Link
                        href='/settings'
                        className={cn(
                            'inline-block text-sm',
                            AI_ACCENT_LINK_CLASS,
                            linkClassName
                        )}>
                        Open Settings
                    </Link>
                ) : null}
            </div>
        );
    }

    return (
        <Tag
            className={cn(
                'text-sm',
                AI_ACCENT_TEXT_CLASS,
                className,
                textClassName
            )}>
            {hint}
            {canLink ? (
                <>
                    {' '}
                    <Link
                        href='/settings'
                        className={cn(AI_ACCENT_LINK_CLASS, linkClassName)}>
                        Open Settings
                    </Link>
                </>
            ) : null}
        </Tag>
    );
}
