import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BriefRecordingPlayer } from '@/components/brief-recording-player';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import type { RecordingMetadata } from '@/lib/recording-metadata';
import { Copy, Check, ExternalLink, Trash2, Video } from 'lucide-react';
import { useBriefBuilderOptional } from './brief-builder-context';
import { BuilderBriefStatusField } from './builder-brief-status-field';
import { AiFeatureDisabledHint } from '@/components/ai-feature-disabled-hint';
import { isBriefStatusValue } from '@/lib/brief-status';
import { listClassGroups } from '@/app/actions';
import type { ClassGroupSummary } from '@/lib/class-group';

interface ExportWebLinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    briefId: string;
    moduleTitle: string;
    assignmentTitle: string;
    refreshKey?: number;
    onRecordScreen: () => void;
    onAssetsChanged?: () => void;
}

function recordingCaptionsLabel(recording: RecordingMetadata) {
    if (recording.captionsStatus === 'ready') {
        return 'Captions ready';
    }

    if (recording.captionsStatus === 'unavailable') {
        return 'No audio for captions';
    }

    if (recording.captionsStatus === 'failed') {
        return 'Captions failed';
    }

    return null;
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function ExportWebLinkDialog({
    open,
    onOpenChange,
    briefId,
    moduleTitle,
    assignmentTitle,
    refreshKey = 0,
    onRecordScreen,
    onAssetsChanged
}: ExportWebLinkDialogProps) {
    const builderContext = useBriefBuilderOptional();
    const briefStatus = builderContext?.briefStatus ?? 'DRAFT';
    const useAI = builderContext?.useAI ?? false;
    const [slug, setSlug] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [recording, setRecording] = useState<RecordingMetadata | null>(null);
    const [isDeletingRecording, setIsDeletingRecording] = useState(false);
    const hadSlugOnOpenRef = useRef(false);
    const [isBriefOwner, setIsBriefOwner] = useState(false);
    const [attachedClassGroup, setAttachedClassGroup] = useState<{
        code: string;
        name: string;
    } | null>(null);
    const [isEditingClassGroup, setIsEditingClassGroup] = useState(false);
    const [classGroupCode, setClassGroupCode] = useState('');
    const [classGroupName, setClassGroupName] = useState('');
    const [studentGroupOnly, setStudentGroupOnly] = useState(false);
    const [ownClassGroups, setOwnClassGroups] = useState<
        ClassGroupSummary[] | null
    >(null);
    const [isLoadingClassGroups, setIsLoadingClassGroups] = useState(false);

    const loadOwnClassGroups = useCallback(async () => {
        setIsLoadingClassGroups(true);
        try {
            const result = await listClassGroups();
            if (result.status === 'ok') {
                setOwnClassGroups(result.groups);
            } else {
                setOwnClassGroups([]);
                if (result.status === 'error') {
                    console.error('Failed to load class groups:', result.error);
                }
            }
        } finally {
            setIsLoadingClassGroups(false);
        }
    }, []);

    const loadExistingData = useCallback(async () => {
        try {
            const response = await fetch(`/api/briefs/${briefId}/publish`);
            if (response.ok) {
                const data = await response.json();
                if (data.slug) {
                    setSlug(data.slug);
                    setIsSaved(true);
                    hadSlugOnOpenRef.current = true;
                } else {
                    hadSlugOnOpenRef.current = false;
                    // Generate slug only if none exists
                    const generatedSlug = slugify(
                        `${moduleTitle} ${assignmentTitle}`
                    );
                    setSlug(generatedSlug);
                }
                if (data.password) {
                    setPassword(data.password);
                } else {
                    setPassword('');
                }
                if (isBriefStatusValue(data.status)) {
                    builderContext?.syncBriefStatus(data.status);
                }

                if (data.recording) {
                    setRecording(data.recording as RecordingMetadata);
                } else {
                    setRecording(null);
                }

                setIsBriefOwner(Boolean(data.isBriefOwner));
                setIsEditingClassGroup(false);
                if (data.classGroup) {
                    setAttachedClassGroup(data.classGroup);
                    setClassGroupCode(data.classGroup.code);
                    setClassGroupName(data.classGroup.name);
                    setStudentGroupOnly(Boolean(data.studentGroupOnly));
                    if (data.studentGroupOnly) {
                        setPassword('');
                    }
                } else {
                    setAttachedClassGroup(null);
                    setClassGroupCode('');
                    setClassGroupName('');
                    setStudentGroupOnly(false);
                }
                void loadOwnClassGroups();
            } else {
                hadSlugOnOpenRef.current = false;
                const generatedSlug = slugify(
                    `${moduleTitle} ${assignmentTitle}`
                );
                setSlug(generatedSlug);
            }
        } catch (error) {
            console.error('Error loading publish data:', error);
            hadSlugOnOpenRef.current = false;
            const generatedSlug = slugify(`${moduleTitle} ${assignmentTitle}`);
            setSlug(generatedSlug);
        }
    }, [assignmentTitle, briefId, builderContext, loadOwnClassGroups, moduleTitle]);

    const handleDialogOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            builderContext?.dismissPublishHint();
            setError('');
            setCopied(false);
        }
        onOpenChange(nextOpen);
    };

    // Load existing data or generate initial slug when dialog opens.
    // Synchronizes with an external system (network fetch) — the
    // sanctioned use of an effect per this rule's own guidance.
    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            void loadExistingData();
            void loadOwnClassGroups();
        }
    }, [loadExistingData, loadOwnClassGroups, open, refreshKey]);

    const handleSave = async () => {
        setIsLoading(true);
        setError('');

        const createdFirstSlug = !hadSlugOnOpenRef.current;

        const useGroupOnlyAccess = Boolean(classGroupCode && studentGroupOnly);

        try {
            const response = await fetch(`/api/briefs/${briefId}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    slug,
                    password: useGroupOnlyAccess ? null : password || null,
                    classGroup: classGroupCode
                        ? { code: classGroupCode, name: classGroupName }
                        : null,
                    studentGroupOnly: classGroupCode ? studentGroupOnly : false
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to save');
                return;
            }

            setIsSaved(true);
            hadSlugOnOpenRef.current = true;
            builderContext?.setViewerSlug(slug);

            if (isBriefStatusValue(data.status)) {
                builderContext?.syncBriefStatus(data.status);
            }

            setIsEditingClassGroup(false);
            if (data.classGroup) {
                setAttachedClassGroup(data.classGroup);
                setClassGroupCode(data.classGroup.code);
                setClassGroupName(data.classGroup.name);
                setStudentGroupOnly(Boolean(data.studentGroupOnly));
                if (data.studentGroupOnly) {
                    setPassword('');
                }
            } else {
                setAttachedClassGroup(null);
                setClassGroupCode('');
                setClassGroupName('');
                setStudentGroupOnly(false);
            }
            if (data.classGroupConflict) {
                setError(
                    'Another user already attached a class group to this assignment.'
                );
            }

            if (createdFirstSlug && briefStatus === 'DRAFT') {
                builderContext?.triggerPublishHint();
            }
        } catch (error) {
            console.error('Error saving publish data:', error);
            setError('Failed to save. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyLink = () => {
        const url = `${window.location.origin}/briefs/viewer/${slug}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenLink = () => {
        const url = `${window.location.origin}/briefs/viewer/${slug}`;
        window.open(url, '_blank');
    };

    const handleSlugChange = (value: string) => {
        setSlug(slugify(value));
        setIsSaved(false);
    };

    const handlePasswordChange = (value: string) => {
        setPassword(value);
        setIsSaved(false);
    };

    const handleClassGroupSelect = (value: string) => {
        setIsSaved(false);
        if (value === 'none') {
            setClassGroupCode('');
            setClassGroupName('');
            setStudentGroupOnly(false);
            return;
        }
        const found = ownClassGroups?.find(
            (group) => group.groupCode === value
        );
        setClassGroupCode(value);
        setClassGroupName(found?.name ?? '');
        setStudentGroupOnly(true);
    };

    const handleStartChangeClassGroup = () => {
        setIsEditingClassGroup(true);
        void loadOwnClassGroups();
    };

    const handleCancelChangeClassGroup = () => {
        setIsEditingClassGroup(false);
        setClassGroupCode(attachedClassGroup?.code ?? '');
        setClassGroupName(attachedClassGroup?.name ?? '');
    };

    const handleClearClassGroup = () => {
        setClassGroupCode('');
        setClassGroupName('');
        setStudentGroupOnly(false);
        setIsEditingClassGroup(true);
        void loadOwnClassGroups();
    };

    const handleDeleteRecording = async () => {
        setIsDeletingRecording(true);
        setError('');
        try {
            const response = await fetch(`/api/briefs/${briefId}/recording`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'Failed to delete recording.');
                return;
            }
            setRecording(null);
            onAssetsChanged?.();
        } catch {
            setError('Failed to delete recording. Please try again.');
        } finally {
            setIsDeletingRecording(false);
        }
    };

    const viewerUrl = `${
        typeof window !== 'undefined' ? window.location.origin : ''
    }/briefs/viewer/${slug}`;

    const showPasswordField = !classGroupCode || !studentGroupOnly;

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent className='flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[550px]'>
                <DialogHeader className='shrink-0 px-6 pt-6 pb-2'>
                    <DialogTitle>Export as Web Link</DialogTitle>
                    <DialogDescription>
                        Create a shareable link for students to view this brief.
                        Restrict access with a class group, an optional password,
                        or both.
                    </DialogDescription>
                </DialogHeader>

                <div className='min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 py-4'>
                    <div className='space-y-2'>
                        <Label htmlFor='slug'>URL Slug</Label>
                        <Input
                            id='slug'
                            value={slug}
                            onChange={(e) => handleSlugChange(e.target.value)}
                            placeholder='module-assignment-title'
                        />
                        <p className='text-xs text-muted-foreground'>
                            This will be used in the URL. Only lowercase
                            letters, numbers, and hyphens allowed.
                        </p>
                    </div>

                    <div className='space-y-2'>
                        <Label>Class Group</Label>
                        {attachedClassGroup && !isEditingClassGroup ? (
                            <div className='flex items-center justify-between gap-2 rounded-none border p-3'>
                                <span className='text-sm font-medium'>
                                    {attachedClassGroup.name ||
                                        'Untitled group'}
                                </span>
                                {isBriefOwner ? (
                                    <div className='flex gap-2'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={
                                                handleStartChangeClassGroup
                                            }>
                                            Change
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='ghost'
                                            size='sm'
                                            className='text-destructive hover:text-destructive'
                                            onClick={handleClearClassGroup}>
                                            Clear
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className='space-y-2'>
                                <Select
                                    value={classGroupCode || 'none'}
                                    onValueChange={handleClassGroupSelect}
                                    disabled={isLoadingClassGroups}>
                                    <SelectTrigger className='w-full'>
                                        <SelectValue
                                            placeholder={
                                                isLoadingClassGroups
                                                    ? 'Loading...'
                                                    : 'No class group'
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent className='z-[10000]'>
                                        <SelectItem value='none'>
                                            No class group
                                        </SelectItem>
                                        {ownClassGroups?.map((group) => (
                                            <SelectItem
                                                key={group.groupCode}
                                                value={group.groupCode}>
                                                {group.name ||
                                                    'Untitled group'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {ownClassGroups !== null &&
                                ownClassGroups.length === 0 &&
                                !isLoadingClassGroups ? (
                                    <p className='text-xs text-muted-foreground'>
                                        You have no saved class groups yet.
                                        Create one from Dashboard → Class
                                        Groups.
                                    </p>
                                ) : null}
                                {attachedClassGroup && isEditingClassGroup ? (
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleCancelChangeClassGroup}>
                                        Cancel
                                    </Button>
                                ) : null}
                                <p className='text-xs text-muted-foreground'>
                                    Attach one of your saved class groups
                                    (Dashboard → Class Groups). Save to apply.
                                </p>
                            </div>
                        )}
                        {classGroupCode ? (
                            <div className='flex items-start gap-3 rounded-none border p-3'>
                                <Checkbox
                                    id='student-group-only'
                                    checked={studentGroupOnly}
                                    disabled={!isBriefOwner}
                                    onCheckedChange={(checked) => {
                                        setStudentGroupOnly(checked === true);
                                        setIsSaved(false);
                                    }}
                                />
                                <div className='space-y-1'>
                                    <Label
                                        htmlFor='student-group-only'
                                        className='text-sm font-medium'>
                                        Student group only
                                    </Label>
                                    <p className='text-xs text-muted-foreground'>
                                        When enabled, only students in the
                                        attached class group can view this
                                        brief. Uncheck to allow anyone with the
                                        link to view it.
                                    </p>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {showPasswordField ? (
                        <div className='space-y-2'>
                            <Label htmlFor='password'>Password (Optional)</Label>
                            <Input
                                id='password'
                                type='password'
                                value={password}
                                onChange={(e) =>
                                    handlePasswordChange(e.target.value)
                                }
                                placeholder='Leave empty for no password'
                            />
                            <p className='text-xs text-muted-foreground'>
                                If set, viewers will need this password to open
                                the brief.
                            </p>
                        </div>
                    ) : null}

                    <div className='space-y-2'>
                        <Label>Screen Recording</Label>
                        <div className='rounded-none border bg-muted/20 p-3 space-y-3'>
                            <p className='text-xs text-muted-foreground'>
                                Record a fullscreen screencast walkthrough and
                                attach it to this web link.
                            </p>
                            <AiFeatureDisabledHint enabled={useAI}>
                                <Button
                                    type='button'
                                    variant='outline'
                                    onClick={onRecordScreen}>
                                    <Video className='h-4 w-4' />
                                    {recording
                                        ? 'Replace Recording'
                                        : 'Record Screen'}
                                </Button>
                            </AiFeatureDisabledHint>

                            {recording ? (
                                <div className='space-y-2'>
                                    <BriefRecordingPlayer
                                        videoSrc={recording.url}
                                        captionsSrc={
                                            recording.captionsStatus ===
                                            'ready'
                                                ? `/api/briefs/${briefId}/recording/captions`
                                                : undefined
                                        }
                                        captionsStatus={
                                            recording.captionsStatus
                                        }
                                        captionsLanguage={
                                            recording.captionsLanguage
                                        }
                                        className='max-h-48 w-full rounded-none border bg-black object-contain'
                                    />
                                    <div className='flex items-center justify-between text-xs text-muted-foreground'>
                                        <span>{recording.fileName}</span>
                                        <span className='flex items-center gap-2'>
                                            {recordingCaptionsLabel(
                                                recording
                                            ) ? (
                                                <span>
                                                    {recordingCaptionsLabel(
                                                        recording
                                                    )}
                                                </span>
                                            ) : null}
                                            <span>
                                                {Math.round(
                                                    recording.sizeBytes /
                                                        (1024 * 1024)
                                                )}
                                                MB
                                            </span>
                                        </span>
                                    </div>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        onClick={handleDeleteRecording}
                                        disabled={isDeletingRecording}
                                        className='text-destructive hover:text-destructive'>
                                        <Trash2 className='h-4 w-4 mr-2' />
                                        {isDeletingRecording
                                            ? 'Removing...'
                                            : 'Remove Recording'}
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {isSaved && (
                        <div className='space-y-2'>
                            <Label>Shareable Link</Label>
                            <div className='flex gap-2'>
                                <Input
                                    value={viewerUrl}
                                    readOnly
                                    className='font-mono text-xs'
                                />
                                <Button
                                    type='button'
                                    size='icon'
                                    variant='outline'
                                    onClick={handleCopyLink}>
                                    {copied ? (
                                        <Check className='h-4 w-4' />
                                    ) : (
                                        <Copy className='h-4 w-4' />
                                    )}
                                </Button>
                                <Button
                                    type='button'
                                    size='icon'
                                    variant='outline'
                                    onClick={handleOpenLink}>
                                    <ExternalLink className='h-4 w-4' />
                                </Button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className='text-sm text-destructive bg-destructive/10 p-3 rounded-none'>
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className='shrink-0 flex-col gap-3 border-t bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between'>
                    {builderContext ? (
                        <BuilderBriefStatusField className='w-full border-0 bg-transparent p-0 shadow-none sm:w-auto' />
                    ) : (
                        <span />
                    )}
                    <div className='flex w-full justify-end gap-2 sm:w-auto'>
                        <Button
                            variant='outline'
                            onClick={() => handleDialogOpenChange(false)}>
                            Close
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isLoading || !slug}
                            className='min-w-[100px]'>
                            {isLoading
                                ? 'Saving...'
                                : isSaved
                                  ? 'Saved'
                                  : 'Update'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
