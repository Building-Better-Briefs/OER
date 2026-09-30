import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    dismissInstallBanner,
    runInstallPrompt,
    useInstallBannerMode,
    useInstallPrompting
} from '@/lib/pwa-install-client';

export function PwaInstallBanner({ className }: { className?: string }) {
    const mode = useInstallBannerMode();
    const prompting = useInstallPrompting();

    if (mode === 'hidden') {
        return null;
    }

    const isChromium = mode === 'chromium';

    return (
        <div
            role='status'
            className={cn(
                'mt-4 flex w-full max-w-prose flex-wrap items-start gap-3 rounded-none border border-border bg-muted/30 p-4 print:hidden',
                className
            )}>
            <Download
                className='mt-0.5 size-5 shrink-0 text-muted-foreground'
                aria-hidden
            />
            <div className='min-w-0 flex-1 space-y-2'>
                <p className='text-sm font-medium'>Install Brief Builder</p>
                <p className='text-sm font-light text-muted-foreground'>
                    {isChromium
                        ? 'Add to your device for a standalone window and quicker return visits. Export backups regularly — install does not replace backup.'
                        : 'Tap Share, then Add to Home Screen for offline access. Export backups regularly.'}
                </p>
                {isChromium ? (
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='font-light rounded-none'
                        disabled={prompting}
                        onClick={() => void runInstallPrompt()}>
                        {prompting ? 'Opening…' : 'Install'}
                    </Button>
                ) : null}
            </div>
            <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8 shrink-0 text-muted-foreground'
                onClick={() => dismissInstallBanner()}
                aria-label='Dismiss install notice'>
                <X className='size-4' />
            </Button>
        </div>
    );
}
