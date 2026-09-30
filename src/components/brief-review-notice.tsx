'use client';

import { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BriefReviewSource } from '@/lib/brief-review-source';

const MESSAGES: Record<BriefReviewSource, string> = {
    import:
        'This brief was created from an uploaded document. AI extraction may be incomplete or inaccurate. Please review all details and builder content before publishing.',
    duplicate:
        'This brief was duplicated from an existing brief. Please review all details and builder content, especially dates and titles, before publishing.'
};

type BriefReviewNoticeProps = {
    briefId: number;
    source: BriefReviewSource;
    className?: string;
};

export function BriefReviewNotice({
    briefId,
    source,
    className
}: BriefReviewNoticeProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const key = `brief-review-dismissed-${briefId}-${source}`;
        // Synchronizes with an external system (sessionStorage) — the
        // sanctioned use of an effect per this rule's own guidance.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisible(sessionStorage.getItem(key) !== '1');
    }, [briefId, source]);

    function dismiss() {
        const key = `brief-review-dismissed-${briefId}-${source}`;
        sessionStorage.setItem(key, '1');
        setVisible(false);
    }

    if (!visible) {
        return null;
    }

    return (
        <div
            role='status'
            className={cn(
                'flex w-fit max-w-prose gap-3 rounded-none border border-amber-200 bg-amber-50 p-4 text-amber-950 print:hidden dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100',
                className
            )}>
            <AlertTriangle className='mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400' />
            <div className='space-y-1'>
                <p className='text-sm font-medium'>Review before publishing</p>
                <p className='text-sm text-amber-900/90 dark:text-amber-100/90'>
                    {MESSAGES[source]}
                </p>
            </div>
            <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8 shrink-0 text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/40'
                onClick={dismiss}
                aria-label='Dismiss notice'>
                <X className='size-4' />
            </Button>
        </div>
    );
}
