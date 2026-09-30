'use client';

import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBriefBuilder } from './brief-builder-context';
import { toast } from 'sonner';

export function OfflineExportBar() {
    const {
        sections,
        currentContent,
        briefMetadata,
        selfAssessmentLinkEnabled
    } = useBriefBuilder();
    const [busy, setBusy] = useState(false);

    const handleExport = async () => {
        setBusy(true);
        try {
            const { generatePDF } = await import('@/components/brief-pdf-document');
            const previewContent = {
                ...(currentContent ?? {}),
                selfAssessmentLinkEnabled
            };
            const filename = `${briefMetadata.title || 'assessment-brief'}.pdf`;
            await generatePDF(
                briefMetadata,
                previewContent,
                sections,
                filename,
                { label: '', url: '' },
                null
            );
            toast.success('PDF downloaded');
        } catch (e) {
            console.error(e);
            toast.error('Could not generate PDF');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className='fixed bottom-6 right-6 z-50 print:hidden'>
            <Button
                size='lg'
                className='rounded-full shadow-lg'
                disabled={busy}
                onClick={() => void handleExport()}>
                <FileDown className='mr-2 h-4 w-4' />
                {busy ? 'Generating…' : 'Download PDF'}
            </Button>
        </div>
    );
}
