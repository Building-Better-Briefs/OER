import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { PwaInstallOfferPanel } from '@/components/pwa-install-offer-panel';
import {
    useInstallOfferMode,
    useShowInstallCompactTrigger
} from '@/lib/pwa-install-client';

export function PwaInstallHeaderButton() {
    const mode = useInstallOfferMode();
    const showTrigger = useShowInstallCompactTrigger();
    const [open, setOpen] = useState(false);

    if (!showTrigger || mode === 'hidden') {
        return null;
    }

    return (
        <>
            <Button
                type='button'
                variant='ghost'
                size='sm'
                className='print:hidden'
                onClick={() => setOpen(true)}>
                <Download className='size-4' aria-hidden />
                Install
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className='rounded-none sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>Install Brief Builder</DialogTitle>
                    </DialogHeader>
                    <PwaInstallOfferPanel mode={mode} layout='dialog' />
                </DialogContent>
            </Dialog>
        </>
    );
}
