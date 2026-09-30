import Link from '@/components/app-link';
import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseContentWithLinks } from '@/lib/content-parser';
import { cn } from '@/lib/utils';
import {
    AIAS_LEVELS,
    AIAS_POLICY,
    getAiasLevel,
    parseAiPolicy,
    type AiPolicyConfig
} from '@/lib/ai-policies';

type AiPolicyDocumentPreview = {
    url: string;
    fileName: string;
} | null;

type BriefAiPolicyPreviewProps = {
    content: unknown;
    aiPolicyDocument: AiPolicyDocumentPreview;
    forceCompact: boolean;
    showUsageLogLink: boolean;
    viewerSlug?: string;
};

function hasAiPolicyContent(
    aiPolicy: AiPolicyConfig,
    aiPolicyDocument: AiPolicyDocumentPreview
) {
    if (aiPolicy.source === 'upload') {
        return Boolean(aiPolicyDocument?.url);
    }
    if (aiPolicy.source === 'aias') {
        return aiPolicy.aiasLevels.length > 0;
    }
    return Boolean(aiPolicy.assessmentGuidance);
}

export function BriefAiPolicyPreview({
    content,
    aiPolicyDocument,
    forceCompact,
    showUsageLogLink,
    viewerSlug
}: BriefAiPolicyPreviewProps) {
    const aiPolicy = parseAiPolicy(content);
    const selectedLevels = aiPolicy.aiasLevels
        .map((level) => getAiasLevel(level))
        .filter((level): level is NonNullable<typeof level> => Boolean(level));

    if (!hasAiPolicyContent(aiPolicy, aiPolicyDocument)) {
        return (
            <>
                <h2
                    className={cn(
                        'font-extralight tracking-tight',
                        'text-3xl mb-6',
                        'max-sm:text-xl max-sm:mb-3',
                        forceCompact && 'text-xl mb-3'
                    )}>
                    AI Policy
                </h2>
                <p
                    className={cn(
                        'font-light text-muted-foreground',
                        'max-sm:text-xs',
                        forceCompact && 'text-xs'
                    )}>
                    Content not yet added for this section
                </p>
            </>
        );
    }

    return (
        <div data-section-id='ai-policy'>
            <h2
                className={cn(
                    'font-extralight tracking-tight',
                    'text-3xl mb-6',
                    'max-sm:text-xl max-sm:mb-2',
                    forceCompact && 'text-xl mb-2'
                )}>
                AI Policy
            </h2>

            {aiPolicy.source === 'upload' && aiPolicyDocument ? (
                <div
                    className={cn(
                        'font-light leading-relaxed',
                        'text-base mb-6',
                        'max-sm:text-xs max-sm:mb-4',
                        forceCompact && 'text-xs mb-4'
                    )}>
                    <a
                        href={aiPolicyDocument.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-2 rounded-none border px-3 py-2 hover:bg-muted/50 transition-colors'>
                        <Download className='h-4 w-4' />
                        <span className='underline underline-offset-2'>
                            {aiPolicyDocument.fileName}
                        </span>
                    </a>
                </div>
            ) : null}

            {aiPolicy.source === 'aias' && selectedLevels.length > 0 ? (
                <div className='space-y-4 mb-6'>
                    <p
                        className={cn(
                            'font-light text-muted-foreground',
                            'max-sm:text-xs',
                            forceCompact && 'text-xs'
                        )}>
                        This assessment uses the{' '}
                        <a
                            href={AIAS_POLICY.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='underline underline-offset-2 text-foreground'>
                            {AIAS_POLICY.name}
                        </a>
                        . The following levels apply:
                    </p>
                    <div className='space-y-3'>
                        {selectedLevels.map((level) => (
                            <div
                                key={level.level}
                                className='border border-foreground/15 p-4'>
                                <p
                                    className={cn(
                                        'font-normal mb-2',
                                        'max-sm:text-sm',
                                        forceCompact && 'text-sm'
                                    )}>
                                    Level {level.level}: {level.name}
                                </p>
                                <p
                                    className={cn(
                                        'font-light text-muted-foreground mb-3',
                                        'max-sm:text-xs',
                                        forceCompact && 'text-xs'
                                    )}>
                                    {level.description}
                                </p>
                                <p
                                    className={cn(
                                        'font-light leading-relaxed',
                                        'max-sm:text-xs',
                                        forceCompact && 'text-xs'
                                    )}>
                                    <span className='font-normal'>
                                        What this means for you:{' '}
                                    </span>
                                    {level.studentGuidance}
                                </p>
                            </div>
                        ))}
                    </div>
                    <p
                        className={cn(
                            'text-xs font-light text-muted-foreground',
                            forceCompact && 'text-[11px]'
                        )}>
                        {AIAS_POLICY.name} by {AIAS_POLICY.attribution}. Licensed
                        under {AIAS_POLICY.license}.
                    </p>
                </div>
            ) : null}

            {aiPolicy.assessmentGuidance ? (
                <div className='mb-6'>
                    <p
                        className={cn(
                            'font-normal mb-2',
                            'max-sm:text-sm',
                            forceCompact && 'text-sm'
                        )}>
                        Guidance for this assessment
                    </p>
                    <div
                        className={cn(
                            'rounded-none border border-foreground/10 p-4 font-light leading-relaxed',
                            'max-sm:text-xs',
                            forceCompact && 'text-xs'
                        )}>
                        {parseContentWithLinks(aiPolicy.assessmentGuidance)}
                    </div>
                </div>
            ) : null}

            {showUsageLogLink && viewerSlug ? (
                <div className='flex flex-wrap items-center justify-end gap-2'>
                    <Button
                        variant='outline'
                        asChild
                        size='sm'
                        className={cn(
                            'cursor-pointer',
                            'max-sm:text-xs max-sm:px-1.5',
                            forceCompact && 'text-xs px-1.5'
                        )}>
                        <Link
                            href={`/briefs/viewer/${viewerSlug}/ai-usage-log`}
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
                                AI Usage Log
                            </span>
                            <span className='sm:hidden'>AI Log</span>
                        </Link>
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
