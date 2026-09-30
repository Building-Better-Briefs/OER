import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
import { useBriefBuilder } from './brief-builder-context';
import { BuilderBriefStatusField } from './builder-brief-status-field';
import { FileDown, Share, SquareArrowOutUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { ExportWebLinkDialog } from './export-weblink-dialog';
import { generatePDF } from '@/components/brief-pdf-document';
import { ScreenRecordingOverlay } from './screen-recording-overlay';

/** Floating export controls (status + export menu). */
export function BuilderFloatingExportBar() {
    const {
        sections,
        currentContent,
        briefMetadata,
        briefId,
        templateKey,
        institutionalAiPolicy,
        selfAssessmentLinkEnabled,
        isStudentPreviewOpen,
        publishAssetsRefreshKey,
        refreshPublishAssets
    } = useBriefBuilder();

    const previewContent = useMemo(
        () => ({
            ...(currentContent ?? {}),
            selfAssessmentLinkEnabled
        }),
        [currentContent, selfAssessmentLinkEnabled]
    );

    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [showRecordingOverlay, setShowRecordingOverlay] = useState(false);
    const [aiPolicyDocument, setAiPolicyDocument] = useState<{
        url: string;
        fileName: string;
        sizeBytes?: number;
    } | null>(null);

    useEffect(() => {
        let isActive = true;
        const loadPublishAssets = async () => {
            try {
                const response = await fetch(`/api/briefs/${briefId}/publish`);
                if (!response.ok) {
                    if (isActive) {
                        setAiPolicyDocument(null);
                    }
                    return;
                }
                const data = (await response.json()) as {
                    aiPolicyDocument?: {
                        url?: string;
                        fileName?: string;
                        sizeBytes?: number;
                    } | null;
                };
                if (!isActive) {
                    return;
                }
                if (
                    data.aiPolicyDocument &&
                    typeof data.aiPolicyDocument.url === 'string' &&
                    typeof data.aiPolicyDocument.fileName === 'string'
                ) {
                    setAiPolicyDocument({
                        url: data.aiPolicyDocument.url,
                        fileName: data.aiPolicyDocument.fileName,
                        sizeBytes: data.aiPolicyDocument.sizeBytes
                    });
                } else {
                    setAiPolicyDocument(null);
                }
            } catch {
                if (isActive) {
                    setAiPolicyDocument(null);
                }
            }
        };
        void loadPublishAssets();
        return () => {
            isActive = false;
        };
    }, [briefId, publishAssetsRefreshKey]);

    if (!briefId) {
        return null;
    }

    const handleExportPDF = async () => {
        setIsExportingPDF(true);
        try {
            const filename = `${briefMetadata.title || 'assessment-brief'}.pdf`;
            await generatePDF(
                briefMetadata,
                previewContent,
                sections,
                filename,
                institutionalAiPolicy,
                aiPolicyDocument
            );
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsExportingPDF(false);
        }
    };

    const handleRecordScreen = () => {
        setShowExportDialog(false);
        setShowRecordingOverlay(true);
    };

    const handleRecordingOverlayOpenChange = (open: boolean) => {
        setShowRecordingOverlay(open);
        if (!open) {
            setShowExportDialog(true);
        }
    };

    return (
        <>
            <div
                data-tour='brief-builder-export-menu'
                className={cn(
                    'z-50 print:hidden flex items-center gap-2 fixed pointer-events-auto',
                    isStudentPreviewOpen
                        ? 'bottom-4 right-7'
                        : 'bottom-6 right-9'
                )}
                onPointerDown={(event) => event.stopPropagation()}>
                <BuilderBriefStatusField className='shadow-lg' />
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            size='lg'
                            className='rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer'>
                            <SquareArrowOutUpRight className='h-5 w-5' />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className='w-56 p-2' align='end'>
                        <div className='flex flex-col gap-1'>
                            <Button
                                variant='link'
                                className='justify-start font-normal cursor-pointer border-b border-border pb-2'
                                onClick={() => setShowExportDialog(true)}>
                                <Share className='mr-3 h-4 w-4' />
                                Export as Web Link
                            </Button>
                            <Button
                                variant='ghost'
                                className='justify-start font-normal cursor-pointer'
                                onClick={() => void handleExportPDF()}
                                disabled={isExportingPDF}>
                                <FileDown className='mr-3 h-4 w-4' />
                                {isExportingPDF
                                    ? 'Generating PDF...'
                                    : 'Export as PDF'}
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <ExportWebLinkDialog
                open={showExportDialog}
                onOpenChange={setShowExportDialog}
                briefId={briefId}
                moduleTitle={briefMetadata.module}
                assignmentTitle={briefMetadata.title}
                refreshKey={publishAssetsRefreshKey}
                onRecordScreen={handleRecordScreen}
                onAssetsChanged={refreshPublishAssets}
            />

            <ScreenRecordingOverlay
                open={showRecordingOverlay}
                onOpenChange={handleRecordingOverlayOpenChange}
                briefId={briefId}
                templateKey={templateKey}
                metadata={briefMetadata}
                content={currentContent}
                sections={sections}
                onUploaded={refreshPublishAssets}
            />
        </>
    );
}
