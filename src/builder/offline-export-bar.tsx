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
        selfAssessmentLinkEnabled,
        institutionalAiPolicy
    } = useBriefBuilder();
    const [busy, setBusy] = useState(false);

    const handleExport = async () => {
        setBusy(true);
        try {
            const { downloadBriefBuilderExportZip } = await import(
                '@/lib/brief-builder-pdf-export'
            );
            const previewContent = {
                ...(currentContent ?? {}),
                selfAssessmentLinkEnabled
            };
            const format = await downloadBriefBuilderExportZip({
                metadata: briefMetadata,
                content: previewContent,
                sections,
                institutionalAiPolicy,
                aiPolicyDocument: null
            });
            toast.success(
                format === 'zip' ? 'ZIP downloaded' : 'PDF downloaded'
            );
        } catch (e) {
            console.error(e);
            toast.error('Could not generate export');
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
