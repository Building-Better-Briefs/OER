import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InstitutionalAiPolicy } from '@/lib/templates';

type BriefInstitutionalFooterProps = {
    policy: InstitutionalAiPolicy;
    className?: string;
    compact?: boolean;
    actions?: ReactNode;
};

export function BriefInstitutionalFooter({
    policy,
    className,
    compact = false,
    actions
}: BriefInstitutionalFooterProps) {
    if (!policy.label.trim() || !policy.url.trim()) {
        return null;
    }

    return (
        <footer
            className={cn(
                'border-t border-foreground/20 pt-6 mt-8',
                'max-sm:pt-4 max-sm:mt-4',
                compact && 'pt-4 mt-4',
                className
            )}>
            <div
                className={cn(
                    'flex flex-wrap items-center gap-x-6 gap-y-3',
                    actions && 'justify-between'
                )}>
                <p
                    className={cn(
                        'text-sm font-light text-muted-foreground',
                        'max-sm:text-xs',
                        compact && 'text-xs'
                    )}>
                    Institutional policy:{' '}
                    <a
                        href={policy.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 text-foreground underline underline-offset-2 hover:text-primary'>
                        {policy.label}
                        <ExternalLink
                            className={cn(
                                'h-3.5 w-3.5 shrink-0 opacity-70',
                                compact && 'h-3 w-3'
                            )}
                            aria-hidden
                        />
                    </a>
                </p>
                {actions ? (
                    <div className='flex flex-wrap items-center gap-2'>
                        {actions}
                    </div>
                ) : null}
            </div>
        </footer>
    );
}
