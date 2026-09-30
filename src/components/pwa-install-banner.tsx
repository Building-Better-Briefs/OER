import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PwaInstallOfferPanel } from '@/components/pwa-install-offer-panel';
import { cn } from '@/lib/utils';
import {
    collapseInstallBanner,
    useInstallOfferMode,
    useShowExpandedInstallBanner
} from '@/lib/pwa-install-client';

export function PwaInstallBanner({ className }: { className?: string }) {
    const mode = useInstallOfferMode();
    const showBanner = useShowExpandedInstallBanner();

    if (!showBanner || mode === 'hidden') {
        return null;
    }

    return (
        <div
            role='status'
            className={cn(
                'mt-4 flex w-full items-center gap-3 rounded-none bg-brand/10 px-4 py-3 print:hidden dark:bg-brand/15',
                className
            )}>
            <PwaInstallOfferPanel mode={mode} layout='banner' />
            <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8 shrink-0 text-brand hover:bg-brand/10'
                onClick={() => collapseInstallBanner()}
                aria-label='Close install notice'>
                <X className='size-4' />
            </Button>
        </div>
    );
}
