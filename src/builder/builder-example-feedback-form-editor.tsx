import { useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBriefBuilder } from './brief-builder-context';
import { Loader2, Trash2, Upload } from 'lucide-react';

type ExampleFeedbackFormMetadata = {
    url: string;
    fileName: string;
    sizeBytes?: number;
};

export function BuilderExampleFeedbackFormEditor({
    exampleFeedbackForm,
    onExampleFeedbackFormChange
}: {
    exampleFeedbackForm: ExampleFeedbackFormMetadata | null;
    onExampleFeedbackFormChange: (
        document: ExampleFeedbackFormMetadata | null
    ) => void;
}) {
    const { briefId, refreshPublishAssets } = useBriefBuilder();
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        setIsUploading(true);
        setUploadError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(
                `/api/briefs/${briefId}/example-feedback-form`,
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
                data.exampleFeedbackForm &&
                typeof data.exampleFeedbackForm.url === 'string' &&
                typeof data.exampleFeedbackForm.fileName === 'string'
            ) {
                onExampleFeedbackFormChange({
                    url: data.exampleFeedbackForm.url,
                    fileName: data.exampleFeedbackForm.fileName,
                    sizeBytes: data.exampleFeedbackForm.sizeBytes
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

    const handleDelete = async () => {
        setIsDeleting(true);
        setUploadError('');
        try {
            const response = await fetch(
                `/api/briefs/${briefId}/example-feedback-form`,
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
            onExampleFeedbackFormChange(null);
            refreshPublishAssets();
        } catch {
            setUploadError('Failed to remove file. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className='border bg-card p-4 sm:p-5 space-y-3'>
            <Label className='font-normal'>Upload Example Form</Label>
            <p className='text-xs font-light text-muted-foreground'>
                Students can download this file from the brief preview and
                published viewer.
            </p>
            <Input
                type='file'
                accept='.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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
            {exampleFeedbackForm ? (
                <div className='flex flex-wrap items-center justify-between gap-2 text-sm font-light'>
                    <a
                        href={exampleFeedbackForm.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='underline underline-offset-2 break-all'>
                        {exampleFeedbackForm.fileName}
                    </a>
                    <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        disabled={isDeleting}
                        onClick={() => void handleDelete()}
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
                    PDF, DOC, or DOCX up to 25MB
                </p>
            )}
            {uploadError ? (
                <p className='text-sm text-destructive'>{uploadError}</p>
            ) : null}
        </div>
    );
}

export function BuilderExampleFeedbackFormEditorLoader() {
    const { briefId, publishAssetsRefreshKey } = useBriefBuilder();
    const [exampleFeedbackForm, setExampleFeedbackForm] =
        useState<ExampleFeedbackFormMetadata | null>(null);

    useEffect(() => {
        let isActive = true;
        const loadDocument = async () => {
            try {
                const response = await fetch(`/api/briefs/${briefId}/publish`);
                if (!response.ok) {
                    if (isActive) {
                        setExampleFeedbackForm(null);
                    }
                    return;
                }
                const data = (await response.json()) as {
                    exampleFeedbackForm?: {
                        url?: string;
                        fileName?: string;
                        sizeBytes?: number;
                    } | null;
                };
                if (!isActive) {
                    return;
                }
                if (
                    data.exampleFeedbackForm &&
                    typeof data.exampleFeedbackForm.url === 'string' &&
                    typeof data.exampleFeedbackForm.fileName === 'string'
                ) {
                    setExampleFeedbackForm({
                        url: data.exampleFeedbackForm.url,
                        fileName: data.exampleFeedbackForm.fileName,
                        sizeBytes: data.exampleFeedbackForm.sizeBytes
                    });
                } else {
                    setExampleFeedbackForm(null);
                }
            } catch {
                if (isActive) {
                    setExampleFeedbackForm(null);
                }
            }
        };
        void loadDocument();
        return () => {
            isActive = false;
        };
    }, [briefId, publishAssetsRefreshKey]);

    return (
        <BuilderExampleFeedbackFormEditor
            exampleFeedbackForm={exampleFeedbackForm}
            onExampleFeedbackFormChange={setExampleFeedbackForm}
        />
    );
}
