import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    getInstallOfferCopy,
    type InstallBannerMode
} from '@/lib/pwa-install-capabilities';
import { runInstallPrompt, useInstallPrompting } from '@/lib/pwa-install-client';

type PwaInstallOfferPanelProps = {
    mode: InstallBannerMode;
    layout: 'banner' | 'dialog';
};

export function PwaInstallOfferPanel({
    mode,
    layout
}: PwaInstallOfferPanelProps) {
    const prompting = useInstallPrompting();
    const { title, description, showInstallButton } = getInstallOfferCopy(mode);

    if (layout === 'dialog') {
        return (
            <div className='space-y-4'>
                <div className='flex gap-3'>
                    <Download
                        className='mt-0.5 size-5 shrink-0 text-brand'
                        aria-hidden
                    />
                    <p className='text-sm font-light text-muted-foreground'>
                        {description}
                    </p>
                </div>
                {showInstallButton ? (
                    <Button
                        type='button'
                        className='w-full font-light rounded-none sm:w-auto'
                        disabled={prompting}
                        onClick={() => void runInstallPrompt()}>
                        {prompting ? 'Opening…' : 'Install'}
                    </Button>
                ) : null}
            </div>
        );
    }

    return (
        <>
            <Download
                className='size-5 shrink-0 text-brand'
                aria-hidden
            />
            <div className='min-w-0 flex-1'>
                <p className='text-sm font-medium leading-snug'>{title}</p>
                <p className='text-xs font-light leading-snug text-muted-foreground'>
                    {description}
                </p>
            </div>
            {showInstallButton ? (
                <Button
                    type='button'
                    size='sm'
                    className='shrink-0 font-light rounded-none'
                    disabled={prompting}
                    onClick={() => void runInstallPrompt()}>
                    {prompting ? 'Opening…' : 'Install'}
                </Button>
            ) : null}
        </>
    );
}
