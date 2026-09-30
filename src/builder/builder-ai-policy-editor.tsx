import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RichTextPlateEditor } from '@/components/rich-text-plate-editor';
import { useBriefBuilder } from './brief-builder-context';
import {
    AIAS_LEVELS,
    AIAS_POLICY,
    hasAssessmentGuidance,
    type AiPolicyConfig,
    type AiPolicySource
} from '@/lib/ai-policies';
import type { InstitutionalAiPolicy } from '@/lib/institution-config';
import { OFFLINE_ROUTES } from '@/lib/offline-routes';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

type AiPolicyDocumentMetadata = {
    url: string;
    fileName: string;
    sizeBytes?: number;
};

type BuilderAiPolicyEditorProps = {
    aiPolicy: AiPolicyConfig;
    onAiPolicyChange: (policy: AiPolicyConfig) => void;
    aiPolicyDocument: AiPolicyDocumentMetadata | null;
    onAiPolicyDocumentChange: (
        document: AiPolicyDocumentMetadata | null
    ) => void;
    showUsageLogCheckbox?: boolean;
};

export function BuilderAiPolicyEditor({
    aiPolicy,
    onAiPolicyChange,
    aiPolicyDocument,
    onAiPolicyDocumentChange,
    showUsageLogCheckbox = true
}: BuilderAiPolicyEditorProps) {
    const {
        briefId,
        builderMode,
        institutionalAiPolicy,
        setIsDirty,
        refreshPublishAssets
    } = useBriefBuilder();
    const institutionalPolicy: InstitutionalAiPolicy = institutionalAiPolicy;
    const [isDeleting, setIsDeleting] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [showGuidanceEditor, setShowGuidanceEditor] = useState(() =>
        hasAssessmentGuidance(aiPolicy.assessmentGuidance)
    );

    useEffect(() => {
        if (hasAssessmentGuidance(aiPolicy.assessmentGuidance)) {
            setShowGuidanceEditor(true);
        }
    }, [aiPolicy.assessmentGuidance]);

    const setSource = useCallback(
        (source: AiPolicySource) => {
            onAiPolicyChange({
                ...aiPolicy,
                source,
                aiasLevels: source === 'aias' ? aiPolicy.aiasLevels : []
            });
            setIsDirty(true);
        },
        [aiPolicy, onAiPolicyChange, setIsDirty]
    );

    const toggleAiasLevel = useCallback(
        (level: number, checked: boolean) => {
            const nextLevels = checked
                ? [...new Set([...aiPolicy.aiasLevels, level])].sort(
                      (a, b) => a - b
                  )
                : aiPolicy.aiasLevels.filter((value) => value !== level);
            onAiPolicyChange({
                ...aiPolicy,
                source: 'aias',
                aiasLevels: nextLevels
            });
            setIsDirty(true);
        },
        [aiPolicy, onAiPolicyChange, setIsDirty]
    );

    const handleDeleteDocument = async () => {
        if (builderMode === 'template' || !briefId) {
            return;
        }
        setIsDeleting(true);
        setUploadError('');
        try {
            const response = await fetch(
                `/api/briefs/${briefId}/ai-policy-document`,
                { method: 'DELETE' }
            );
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                setUploadError(
                    typeof data.error === 'string'
                        ? data.error
                        : 'Failed to remove file.'
                );
                return;
            }
            onAiPolicyDocumentChange(null);
            refreshPublishAssets();
        } catch {
            setUploadError('Failed to remove file. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSwitchToAias = async () => {
        if (aiPolicyDocument) {
            await handleDeleteDocument();
        }
        setSource('aias');
    };

    return (
        <div className='space-y-5 border bg-card p-4 sm:p-5'>
            <div className='space-y-3'>
                <Label className='font-normal'>Assessment AI policy</Label>
                {aiPolicy.source === 'upload' ? (
                    <p className='text-sm font-light text-muted-foreground'>
                        This brief uses a legacy uploaded policy PDF. Switch to
                        the AI Assessment Scale (AIAS) to continue editing the
                        policy here.
                    </p>
                ) : (
                    <p className='text-sm font-light'>
                        AI Assessment Scale (AIAS)
                    </p>
                )}
            </div>

            {aiPolicy.source === 'upload' ? (
                <div className='space-y-3'>
                    {aiPolicyDocument ? (
                        <p className='text-sm font-light'>
                            Uploaded file: {aiPolicyDocument.fileName}
                        </p>
                    ) : null}
                    <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        disabled={isDeleting}
                        onClick={() => void handleSwitchToAias()}>
                        {isDeleting ? (
                            <>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                Switching…
                            </>
                        ) : (
                            'Use AI Assessment Scale (AIAS)'
                        )}
                    </Button>
                </div>
            ) : null}

            {aiPolicy.source !== 'upload' ? (
                <>
                <div className='space-y-3'>
                    <p className='text-sm font-light text-muted-foreground'>
                        Select one or more levels permitted for this assessment.
                    </p>
                    <div className='space-y-3'>
                        {AIAS_LEVELS.map((level) => (
                            <label
                                key={level.level}
                                className='flex items-start gap-3 rounded-none border p-3 cursor-pointer hover:bg-muted/30'>
                                <Checkbox
                                    checked={aiPolicy.aiasLevels.includes(
                                        level.level
                                    )}
                                    onCheckedChange={(checked) =>
                                        toggleAiasLevel(
                                            level.level,
                                            checked === true
                                        )
                                    }
                                    className='mt-0.5'
                                />
                                <span className='space-y-1'>
                                    <span className='block text-sm font-normal'>
                                        Level {level.level}: {level.name}
                                    </span>
                                    <span className='block text-xs font-light text-muted-foreground'>
                                        {level.description}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>
                    <p className='text-xs font-light text-muted-foreground'>
                        Source:{' '}
                        <a
                            href={AIAS_POLICY.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='underline underline-offset-2'>
                            {AIAS_POLICY.name}
                        </a>{' '}
                        ({AIAS_POLICY.license})
                    </p>
                </div>

            {showGuidanceEditor ? (
                <div className='space-y-2'>
                    <Label className='font-normal'>
                        Guidance for this assessment
                    </Label>
                    <div className='rounded-none border p-3'>
                        <RichTextPlateEditor
                            value={aiPolicy.assessmentGuidance}
                            onChange={(value) => {
                                onAiPolicyChange({
                                    ...aiPolicy,
                                    assessmentGuidance: value
                                });
                                setIsDirty(true);
                            }}
                            placeholder='When and how may students use AI in this specific assessment?'
                        />
                    </div>
                </div>
            ) : (
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='font-light'
                    onClick={() => setShowGuidanceEditor(true)}>
                    Add guidance for this assessment
                </Button>
            )}

            {showUsageLogCheckbox ? (
                <label className='flex items-start gap-3 rounded-none border p-3 cursor-pointer'>
                    <Checkbox
                        checked={aiPolicy.usageLogEnabled}
                        onCheckedChange={(checked) => {
                            onAiPolicyChange({
                                ...aiPolicy,
                                usageLogEnabled: checked === true
                            });
                            setIsDirty(true);
                        }}
                        className='mt-0.5'
                    />
                    <span className='space-y-1'>
                        <span className='block text-sm font-normal'>
                            Include AI Usage Log
                        </span>
                        <span className='block text-xs font-light text-muted-foreground'>
                            Students complete a structured AI log after the
                            brief is published.
                        </span>
                    </span>
                </label>
            ) : null}

            <div className='rounded-none bg-muted/40 p-3 text-xs font-light text-muted-foreground'>
                {institutionalPolicy.label.trim() && institutionalPolicy.url.trim() ? (
                    <>
                        The institutional policy link{' '}
                        <a
                            href={institutionalPolicy.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='underline underline-offset-2 text-foreground'>
                            {institutionalPolicy.label}
                        </a>{' '}
                        appears in the brief footer. Change it under{' '}
                        {builderMode === 'brief' && briefId ? (
                            <Link
                                to={OFFLINE_ROUTES.briefEdit(briefId)}
                                className='underline underline-offset-2 text-foreground'>
                                Edit details
                            </Link>
                        ) : (
                            'Edit details'
                        )}
                        .
                    </>
                ) : (
                    <>
                        Optional institutional policy link in the brief footer.
                        Set link text and URL under{' '}
                        {builderMode === 'brief' && briefId ? (
                            <Link
                                to={OFFLINE_ROUTES.briefEdit(briefId)}
                                className='underline underline-offset-2 text-foreground'>
                                Edit details
                            </Link>
                        ) : (
                            'Edit details'
                        )}
                        .
                    </>
                )}
            </div>

            {uploadError ? (
                <p className='text-sm text-destructive'>{uploadError}</p>
            ) : null}
                </>
            ) : null}
        </div>
    );
}

export function BuilderAiPolicyEditorLoader({
    aiPolicy,
    onAiPolicyChange,
    showUsageLogCheckbox = true
}: {
    aiPolicy: AiPolicyConfig;
    onAiPolicyChange: (policy: AiPolicyConfig) => void;
    showUsageLogCheckbox?: boolean;
}) {
    const { briefId, publishAssetsRefreshKey } = useBriefBuilder();
    const [aiPolicyDocument, setAiPolicyDocument] =
        useState<AiPolicyDocumentMetadata | null>(null);

    useEffect(() => {
        let isActive = true;
        const loadDocument = async () => {
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
        void loadDocument();
        return () => {
            isActive = false;
        };
    }, [briefId, publishAssetsRefreshKey]);

    return (
        <BuilderAiPolicyEditor
            aiPolicy={aiPolicy}
            onAiPolicyChange={onAiPolicyChange}
            aiPolicyDocument={aiPolicyDocument}
            onAiPolicyDocumentChange={setAiPolicyDocument}
            showUsageLogCheckbox={showUsageLogCheckbox}
        />
    );
}
