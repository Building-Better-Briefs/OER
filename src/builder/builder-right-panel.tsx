import { Button } from '@/components/ui/button';
import { useBriefBuilder } from './brief-builder-context';
import {
    Monitor,
    Smartphone,
    ChevronsRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { BriefPreviewContent } from '@/components/brief-preview-content';
import { isExampleFeedbackSectionEnabled } from '@/lib/brief-sections';

export function BuilderRightPanel() {
    const {
        previewMode,
        setPreviewMode,
        sections,
        currentContent,
        briefMetadata,
        briefId,
        builderMode,
        viewerSlug,
        templateKey,
        institutionalAiPolicy,
        selfAssessmentLinkEnabled,
        setStudentPreviewOpenWithLayout,
        publishAssetsRefreshKey
    } = useBriefBuilder();

    const previewContent = useMemo(
        () => ({
            ...(currentContent ?? {}),
            selfAssessmentLinkEnabled
        }),
        [currentContent, selfAssessmentLinkEnabled]
    );

    const [exampleFeedbackForm, setExampleFeedbackForm] = useState<{
        url: string;
        fileName: string;
        sizeBytes?: number;
    } | null>(null);
    const [aiPolicyDocument, setAiPolicyDocument] = useState<{
        url: string;
        fileName: string;
        sizeBytes?: number;
    } | null>(null);

    useEffect(() => {
        setExampleFeedbackForm(null);
        setAiPolicyDocument(null);
    }, [briefId, publishAssetsRefreshKey]);

    return (
        <div className='h-full min-h-0 flex flex-col relative print:block print:h-auto'>
            <div
                className='border-b p-4 px-6 flex items-center justify-between print:hidden'
                data-tour='brief-builder-preview-toolbar'>
                <div>
                    <h2 className='text-xl font-normal tracking-tight'>
                        Student Preview
                        <span className='text-muted-foreground text-sm'>
                            <p className='text-sm font-light text-muted-foreground'>
                                Preview how students will see this brief
                            </p>
                        </span>
                    </h2>
                </div>

                <div className='flex items-center gap-2'>
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setPreviewMode('desktop')}
                        className={`font-normal cursor-pointer ${
                            previewMode === 'desktop'
                                ? ' bg-transparent text-brand'
                                : ''
                        }`}>
                        <Monitor className='h-4 w-4 mr-1.5' />
                        Desktop
                    </Button>

                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setPreviewMode('mobile')}
                        className={`font-normal cursor-pointer ${
                            previewMode === 'mobile'
                                ? ' bg-transparent text-brand'
                                : ''
                        }`}>
                        <Smartphone className='h-4 w-4 mr-1.5' />
                        Mobile
                    </Button>
                    <Button
                        type='button'
                        variant='default'
                        size='sm'
                        className='font-normal cursor-pointer'
                        onClick={() => setStudentPreviewOpenWithLayout(false)}
                        title='Hide preview and focus on editing'>
                        Hide Preview
                        <ChevronsRight className='h-4 w-4' />
                    </Button>
                </div>
            </div>

            <div
                data-panel-scroll-container='right'
                className='flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-6 pb-6 pt-4 bg-muted/40 print:!p-0 print:!bg-white print:!overflow-visible print:!block print:!w-full print:!max-w-full print:!m-0'>
                <div
                    id='student-preview-content'
                    className={cn(
                        'mx-auto bg-card border shadow-sm transition-all duration-300 print:!border-0 print:!shadow-none print:!max-w-full print:!w-full print:!mx-0',
                        previewMode === 'desktop' && 'w-full',
                        previewMode === 'mobile' &&
                            'max-w-[375px] rounded-none border shadow-sm'
                    )}>
                    <BriefPreviewContent
                        briefId={briefId}
                        metadata={briefMetadata}
                        content={previewContent}
                        sections={sections}
                        viewerSlug={viewerSlug}
                        templateKey={templateKey}
                        institutionalAiPolicy={institutionalAiPolicy}
                        exampleFeedbackForm={
                            isExampleFeedbackSectionEnabled(sections)
                                ? exampleFeedbackForm
                                : null
                        }
                        aiPolicyDocument={aiPolicyDocument}
                        previewLayout={previewMode}
                        className={
                            previewMode === 'mobile' ? 'mobile-preview' : ''
                        }
                    />
                </div>
            </div>
        </div>
    );
}
