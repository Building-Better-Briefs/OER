import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextPlateEditor } from '@/components/rich-text-plate-editor';
import { useBriefBuilder } from './brief-builder-context';
import {
    AIAS_LEVELS,
    AIAS_POLICY,
    type AiPolicyConfig,
    type AiPolicySource
} from '@/lib/ai-policies';
import type { InstitutionalAiPolicy } from '@/lib/institution-config';
import { Loader2, Trash2, Upload } from 'lucide-react';

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
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [uploadError, setUploadError] = useState('');

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

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || builderMode === 'template' || !briefId) {
            return;
        }

        setIsUploading(true);
        setUploadError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(
                `/api/briefs/${briefId}/ai-policy-document`,
                { method: 'POST', body: formData }
            );
            const responseType = response.headers.get('content-type') || '';
            const data = responseType.includes('application/json')
                ? await response.json()
                : { error: await response.text() };

            if (!response.ok) {
                setUploadError(
                    typeof data.error === 'string'
                        ? data.error
                        : 'Failed to upload file.'
                );
                return;
            }

            if (
                data.aiPolicyDocument &&
                typeof data.aiPolicyDocument.url === 'string' &&
                typeof data.aiPolicyDocument.fileName === 'string'
            ) {
                onAiPolicyDocumentChange({
                    url: data.aiPolicyDocument.url,
                    fileName: data.aiPolicyDocument.fileName,
                    sizeBytes: data.aiPolicyDocument.sizeBytes
                });
                onAiPolicyChange({
                    ...aiPolicy,
                    source: 'upload',
                    aiasLevels: []
                });
                refreshPublishAssets();
            }
        } catch {
            setUploadError('Failed to upload file. Please try again.');
        } finally {
            setIsUploading(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    };

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
                <div className='flex flex-col gap-2 sm:flex-row sm:gap-4'>
                    <label className='flex items-center gap-2 text-sm font-light cursor-pointer'>
                        <input
                            type='radio'
                            name='ai-policy-source'
                            checked={aiPolicy.source === 'upload'}
                            onChange={() => setSource('upload')}
                        />
                        Upload a policy PDF
                    </label>
                    <label className='flex items-center gap-2 text-sm font-light cursor-pointer'>
                        <input
                            type='radio'
                            name='ai-policy-source'
                            checked={aiPolicy.source === 'aias'}
                            onChange={() => void handleSwitchToAias()}
                        />
                        Use AI Assessment Scale (AIAS)
                    </label>
                </div>
            </div>

            {aiPolicy.source ? (
                <>
            {aiPolicy.source === 'upload' ? (
                <div className='space-y-3 rounded-none border border-dashed p-4'>
                    <Label className='font-normal text-sm'>
                        Policy document (PDF)
                    </Label>
                    <Input
                        type='file'
                        accept='.pdf,application/pdf'
                        disabled={isUploading}
                        onChange={(event) => void handleUpload(event)}
                        className='font-light bg-muted/50 focus-visible:bg-muted/80 p-1'
                    />
                    {isUploading ? (
                        <p className='text-xs font-light text-muted-foreground flex items-center gap-2'>
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                            Uploading…
                        </p>
                    ) : null}
                    {aiPolicyDocument ? (
                        <div className='flex flex-wrap items-center justify-between gap-2 text-sm font-light'>
                            <span>{aiPolicyDocument.fileName}</span>
                            <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                disabled={isDeleting}
                                onClick={() => void handleDeleteDocument()}
                                className='h-8 px-2 text-destructive hover:text-destructive'>
                                {isDeleting ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                ) : (
                                    <Trash2 className='h-4 w-4' />
                                )}
                                <span className='sr-only'>Remove file</span>
                            </Button>
                        </div>
                    ) : (
                        <p className='text-xs font-light text-muted-foreground flex items-center gap-1.5'>
                            <Upload className='h-3.5 w-3.5' />
                            PDF up to 25MB
                        </p>
                    )}
                </div>
            ) : null}

            {aiPolicy.source === 'aias' ? (
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
            ) : null}

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
                The institutional policy link{' '}
                <a
                    href={institutionalPolicy.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='underline underline-offset-2 text-foreground'>
                    {institutionalPolicy.label}
                </a>{' '}
                always appears in the brief footer.
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
