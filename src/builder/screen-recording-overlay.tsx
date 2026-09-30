import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BriefPreviewContent } from '@/components/brief-preview-content';
import type { BriefMetadata, BriefSection } from './brief-builder-context';
import { fixRecordingBlob } from '@/lib/fix-recording-blob';
import type { RecordingMetadata } from '@/lib/recording-metadata';
import { Upload, X, Video, Square, Loader2 } from 'lucide-react';
import { useBriefBuilderOptional } from './brief-builder-context';
import { AiFeatureDisabledHint } from '@/components/ai-feature-disabled-hint';
import { AiSettingsEnableMessage } from '@/components/ai-settings-enable-message';
import { parseAiDisabledFromResponse } from '@/lib/ai-access';
import { AI_SETTINGS_ENABLE_HINT } from '@/lib/ai-powered-features';
import { toast } from 'sonner';

interface ScreenRecordingOverlayProps {
    open: boolean;
    briefId: string;
    templateKey: string;
    metadata: BriefMetadata;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    sections: BriefSection[];
    onOpenChange: (open: boolean) => void;
    onUploaded: (recording: RecordingMetadata) => void;
}

const MIME_TYPES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
];

const AUDIO_MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4'
];

const MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024;

const WEBCAM_DIMENSIONS = {
    small: 96,
    medium: 128,
    large: 160
} as const;

type WebcamSize = keyof typeof WEBCAM_DIMENSIONS;

function clampWebcamPosition(
    x: number,
    y: number,
    size: WebcamSize,
    viewport = { width: window.innerWidth, height: window.innerHeight }
) {
    const dim = WEBCAM_DIMENSIONS[size];
    const padding = 8;
    const maxX = viewport.width - dim - padding;
    const maxY = viewport.height - dim - padding;
    return {
        x: Math.max(padding, Math.min(x, maxX)),
        y: Math.max(padding, Math.min(y, maxY))
    };
}

function getDefaultWebcamPosition(size: WebcamSize) {
    const dim = WEBCAM_DIMENSIONS[size];
    return clampWebcamPosition(32, window.innerHeight - 96 - dim, size);
}

function formatElapsed(totalSeconds: number) {
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

export function ScreenRecordingOverlay({
    open,
    briefId,
    templateKey,
    metadata,
    content,
    sections,
    onOpenChange,
    onUploaded
}: ScreenRecordingOverlayProps) {
    const builderContext = useBriefBuilderOptional();
    const useAI = builderContext?.useAI ?? false;
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const webcamStreamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const recordedAudioBlobRef = useRef<Blob | null>(null);
    const timerRef = useRef<number | null>(null);
    const recordingStartedAtRef = useRef<number | null>(null);
    const recordedDurationSecondsRef = useRef(0);
    const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
    const isDraggingWebcamRef = useRef(false);
    const webcamDragOffsetRef = useRef({ x: 0, y: 0 });

    const [error, setError] = useState('');
    const [isRequestingCapture, setIsRequestingCapture] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isProcessingRecording, setIsProcessingRecording] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    // Mirrors recordedDurationSecondsRef for display — refs cannot be read
    // during render, so the JSX below reads this state instead.
    const [recordedDurationSeconds, setRecordedDurationSeconds] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordedUrl, setRecordedUrl] = useState('');
    const [showWebcamPreview, setShowWebcamPreview] = useState(false);
    const [webcamSize, setWebcamSize] = useState<WebcamSize>('medium');
    const [webcamPosition, setWebcamPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [isDraggingWebcam, setIsDraggingWebcam] = useState(false);
    const [audioStatus, setAudioStatus] = useState('');

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const stopTracks = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    const stopWebcamTracks = useCallback(() => {
        if (webcamStreamRef.current) {
            webcamStreamRef.current
                .getTracks()
                .forEach((track) => track.stop());
            webcamStreamRef.current = null;
        }
        if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = null;
        }
    }, []);

    const resetRecorderState = useCallback(() => {
        clearTimer();
        setIsRecording(false);
        setIsRequestingCapture(false);
        setAudioStatus('');
        mediaRecorderRef.current = null;
        audioRecorderRef.current = null;
        stopTracks();
    }, [clearTimer, stopTracks]);

    const stopRecording = useCallback(() => {
        const audioRecorder = audioRecorderRef.current;
        if (audioRecorder && audioRecorder.state !== 'inactive') {
            audioRecorder.stop();
        }

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }
    }, []);

    const cleanup = useCallback(() => {
        stopRecording();
        resetRecorderState();
        stopWebcamTracks();
        setShowWebcamPreview(false);
        setWebcamPosition(null);
        isDraggingWebcamRef.current = false;
        setIsDraggingWebcam(false);
    }, [resetRecorderState, stopRecording, stopWebcamTracks]);

    useEffect(() => {
        if (!open) {
            // Releases external resources (recorders, media tracks) and
            // resets local UI state together when the overlay closes —
            // the sanctioned "synchronize with an external system" use of
            // an effect per this rule's own guidance.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            cleanup();
            setError('');
            setIsProcessingRecording(false);
            recordingStartedAtRef.current = null;
            recordedDurationSecondsRef.current = 0;
            setRecordedDurationSeconds(0);
            recordedAudioBlobRef.current = null;
            setElapsedSeconds(0);
            if (recordedUrl) {
                URL.revokeObjectURL(recordedUrl);
            }
            setRecordedUrl('');
            setRecordedBlob(null);
        }

        return () => {
            cleanup();
            if (recordedUrl) {
                URL.revokeObjectURL(recordedUrl);
            }
        };
    }, [cleanup, open, recordedUrl]);

    useEffect(() => {
        if (
            showWebcamPreview &&
            webcamStreamRef.current &&
            webcamVideoRef.current
        ) {
            webcamVideoRef.current.srcObject = webcamStreamRef.current;
            webcamVideoRef.current.play().catch(() => {
                // Autoplay can be blocked by browser policies.
            });
        }
    }, [showWebcamPreview]);

    // Position the webcam overlay when it becomes visible or its size
    // changes. Adjusted during render, faithfully replicating the previous
    // useEffect's dependency comparison, instead of in a useEffect.
    const webcamPositionDeps = [showWebcamPreview, webcamSize];
    const [prevWebcamPositionDeps, setPrevWebcamPositionDeps] =
        useState(webcamPositionDeps);
    if (
        webcamPositionDeps.some((dep, i) => dep !== prevWebcamPositionDeps[i])
    ) {
        setPrevWebcamPositionDeps(webcamPositionDeps);
        if (showWebcamPreview) {
            setWebcamPosition((current) =>
                current
                    ? clampWebcamPosition(current.x, current.y, webcamSize)
                    : getDefaultWebcamPosition(webcamSize)
            );
        }
    }

    useEffect(() => {
        if (!showWebcamPreview) {
            return;
        }

        const handleResize = () => {
            setWebcamPosition((current) =>
                current
                    ? clampWebcamPosition(current.x, current.y, webcamSize)
                    : getDefaultWebcamPosition(webcamSize)
            );
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [showWebcamPreview, webcamSize]);

    const selectedMimeType = useMemo(
        () =>
            MIME_TYPES.find(
                (mimeType) =>
                    typeof MediaRecorder !== 'undefined' &&
                    MediaRecorder.isTypeSupported(mimeType)
            ) ?? 'video/webm',
        []
    );

    const selectedAudioMimeType = useMemo(
        () =>
            AUDIO_MIME_TYPES.find(
                (mimeType) =>
                    typeof MediaRecorder !== 'undefined' &&
                    MediaRecorder.isTypeSupported(mimeType)
            ) ?? 'audio/webm',
        []
    );

    const handleStartRecording = async () => {
        setError('');
        setRecordedBlob(null);
        recordedAudioBlobRef.current = null;
        if (recordedUrl) {
            URL.revokeObjectURL(recordedUrl);
            setRecordedUrl('');
        }

        if (
            typeof navigator === 'undefined' ||
            !navigator.mediaDevices?.getDisplayMedia
        ) {
            setError(
                'Your browser does not support screen recording. Please use a recent version of Chrome, Edge, or Firefox.'
            );
            return;
        }

        setIsRequestingCapture(true);

        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            const audioTracks: MediaStreamTrack[] = [
                ...displayStream.getAudioTracks()
            ];

            try {
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: true
                });
                audioTracks.push(...micStream.getAudioTracks());
            } catch {
                setAudioStatus(
                    'Microphone not available. Recording will use shared tab/system audio only.'
                );
            }

            if (audioTracks.length === 0) {
                setAudioStatus(
                    'No audio source detected. Recording will be video only.'
                );
            }

            const combinedStream = new MediaStream([
                ...displayStream.getVideoTracks(),
                ...audioTracks
            ]);
            streamRef.current = combinedStream;
            chunksRef.current = [];
            audioChunksRef.current = [];
            recordedAudioBlobRef.current = null;
            setElapsedSeconds(0);

            const recorder = new MediaRecorder(combinedStream, {
                mimeType: selectedMimeType
            });
            mediaRecorderRef.current = recorder;

            if (audioTracks.length > 0) {
                const audioStream = new MediaStream(audioTracks);
                const audioRecorder = new MediaRecorder(audioStream, {
                    mimeType: selectedAudioMimeType
                });
                audioRecorderRef.current = audioRecorder;

                audioRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                audioRecorder.onerror = () => {
                    setError('Audio capture failed. Captions may be unavailable.');
                };
            }

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            const finalizeAudioBlob = () =>
                new Promise<Blob | null>((resolve) => {
                    const audioRecorder = audioRecorderRef.current;
                    if (!audioRecorder) {
                        resolve(
                            audioChunksRef.current.length > 0
                                ? new Blob(audioChunksRef.current, {
                                      type: selectedAudioMimeType
                                  })
                                : null
                        );
                        return;
                    }

                    if (audioRecorder.state === 'inactive') {
                        resolve(
                            audioChunksRef.current.length > 0
                                ? new Blob(audioChunksRef.current, {
                                      type:
                                          audioRecorder.mimeType ||
                                          selectedAudioMimeType
                                  })
                                : null
                        );
                        return;
                    }

                    audioRecorder.onstop = () => {
                        resolve(
                            audioChunksRef.current.length > 0
                                ? new Blob(audioChunksRef.current, {
                                      type:
                                          audioRecorder.mimeType ||
                                          selectedAudioMimeType
                                  })
                                : null
                        );
                    };
                    audioRecorder.stop();
                });

            recorder.onstop = () => {
                const durationMs = recordingStartedAtRef.current
                    ? Date.now() - recordingStartedAtRef.current
                    : 0;
                recordingStartedAtRef.current = null;
                const finalDurationSeconds = Math.max(
                    1,
                    Math.round(durationMs / 1000)
                );
                recordedDurationSecondsRef.current = finalDurationSeconds;
                setRecordedDurationSeconds(finalDurationSeconds);

                void (async () => {
                    setIsProcessingRecording(true);

                    const audioBlob = await finalizeAudioBlob();
                    recordedAudioBlobRef.current = audioBlob;

                    const rawBlob = new Blob(chunksRef.current, {
                        type: recorder.mimeType || selectedMimeType
                    });

                    if (rawBlob.size > MAX_UPLOAD_SIZE_BYTES) {
                        setError(
                            'Recording is larger than 200MB. Please record a shorter clip.'
                        );
                        setRecordedBlob(null);
                        setRecordedUrl('');
                        recordedAudioBlobRef.current = null;
                        recordedDurationSecondsRef.current = 0;
                        setRecordedDurationSeconds(0);
                        resetRecorderState();
                        setIsProcessingRecording(false);
                        return;
                    }

                    let blob = rawBlob;

                    try {
                        if (durationMs > 0) {
                            blob = await fixRecordingBlob(rawBlob, durationMs);
                        }
                    } catch {
                        // Fall back to the raw blob if duration metadata cannot be patched.
                    }

                    const nextUrl = URL.createObjectURL(blob);
                    setRecordedBlob(blob);
                    setRecordedUrl(nextUrl);
                    resetRecorderState();
                    setIsProcessingRecording(false);
                })();
            };

            recorder.onerror = () => {
                setError('Recording failed. Please try again.');
                resetRecorderState();
            };

            const displayTrack = displayStream.getVideoTracks()[0];
            if (displayTrack) {
                displayTrack.onended = () => {
                    stopRecording();
                };
            }

            recordingStartedAtRef.current = Date.now();
            if (audioRecorderRef.current) {
                audioRecorderRef.current.start(250);
            }
            recorder.start(250);
            setIsRecording(true);
            timerRef.current = window.setInterval(() => {
                setElapsedSeconds((prev) => prev + 1);
            }, 1000);
        } catch {
            setError(
                'Screen recording permission was denied or cancelled. Please try again.'
            );
        } finally {
            setIsRequestingCapture(false);
        }
    };

    const toggleWebcamPreview = async () => {
        setError('');
        if (showWebcamPreview) {
            setShowWebcamPreview(false);
            stopWebcamTracks();
            return;
        }

        try {
            const webcamStream = await navigator.mediaDevices.getUserMedia({
                video: true
            });
            webcamStreamRef.current = webcamStream;
            setWebcamPosition(getDefaultWebcamPosition(webcamSize));
            setShowWebcamPreview(true);
            if (webcamVideoRef.current) {
                webcamVideoRef.current.srcObject = webcamStream;
                await webcamVideoRef.current.play();
            }
        } catch {
            setError(
                'Unable to access webcam preview. Check camera permissions and try again.'
            );
            setShowWebcamPreview(false);
        }
    };

    const handleUpload = async () => {
        if (!recordedBlob) {
            setError('Record a video before uploading.');
            return;
        }

        setIsUploading(true);
        setError('');

        try {
            const extension = recordedBlob.type.includes('mp4')
                ? 'mp4'
                : 'webm';
            const fileName = `brief-${briefId}-recording-${Date.now()}.${extension}`;
            const file = new File([recordedBlob], fileName, {
                type: recordedBlob.type || 'video/webm'
            });
            const formData = new FormData();
            formData.append('file', file);
            formData.append(
                'durationSeconds',
                String(recordedDurationSecondsRef.current || elapsedSeconds)
            );

            const audioBlob = recordedAudioBlobRef.current;
            if (audioBlob && audioBlob.size > 0) {
                const audioExtension = audioBlob.type.includes('mp4')
                    ? 'mp4'
                    : 'webm';
                formData.append(
                    'audio',
                    new File(
                        [audioBlob],
                        `brief-${briefId}-recording-audio-${Date.now()}.${audioExtension}`,
                        { type: audioBlob.type || 'audio/webm' }
                    )
                );
            }

            const response = await fetch(`/api/briefs/${briefId}/recording`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                const isAiDisabled = await parseAiDisabledFromResponse(response);
                if (isAiDisabled) {
                    toast.error(AI_SETTINGS_ENABLE_HINT);
                }
                setError(
                    isAiDisabled
                        ? AI_SETTINGS_ENABLE_HINT
                        : data.error || 'Failed to upload recording.'
                );
                return;
            }

            onUploaded(data.recording as RecordingMetadata);
            onOpenChange(false);
        } catch {
            setError('Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
    };

    const handleWebcamPointerDown = (
        event: React.PointerEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        isDraggingWebcamRef.current = true;
        setIsDraggingWebcam(true);
        const rect = event.currentTarget.getBoundingClientRect();
        webcamDragOffsetRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    };

    const handleWebcamPointerMove = (
        event: React.PointerEvent<HTMLDivElement>
    ) => {
        if (!isDraggingWebcamRef.current) {
            return;
        }

        setWebcamPosition(
            clampWebcamPosition(
                event.clientX - webcamDragOffsetRef.current.x,
                event.clientY - webcamDragOffsetRef.current.y,
                webcamSize
            )
        );
    };

    const endWebcamDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingWebcamRef.current) {
            return;
        }

        isDraggingWebcamRef.current = false;
        setIsDraggingWebcam(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    if (!open) {
        return null;
    }

    const webcamDimension = WEBCAM_DIMENSIONS[webcamSize];
    const resolvedWebcamPosition =
        webcamPosition ?? getDefaultWebcamPosition(webcamSize);

    return (
        <div
            className='fixed inset-0 z-[1100] bg-background'
            data-screen-recording-overlay>
            <div className='h-full min-h-0 flex flex-col'>
                <div className='border-b px-6 py-4 flex items-center justify-between gap-4'>
                    <div>
                        <h2 className='text-base font-medium'>
                            Record Screen for Web Link
                        </h2>
                        <p className='text-sm text-muted-foreground'>
                            Keep this preview fullscreen, choose this tab/screen
                            in the prompt, then record your walkthrough with
                            audio.
                        </p>
                    </div>
                    <div className='flex items-center gap-2'>
                        {showWebcamPreview ? (
                            <div className='flex items-center gap-1 rounded-none border px-2 py-1 bg-background/90'>
                                <span className='text-xs text-muted-foreground mr-1'>
                                    Size
                                </span>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant={
                                        webcamSize === 'small'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className='h-7 px-2 text-xs'
                                    onClick={() => setWebcamSize('small')}>
                                    S
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant={
                                        webcamSize === 'medium'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className='h-7 px-2 text-xs'
                                    onClick={() => setWebcamSize('medium')}>
                                    M
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    variant={
                                        webcamSize === 'large'
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className='h-7 px-2 text-xs'
                                    onClick={() => setWebcamSize('large')}>
                                    L
                                </Button>
                            </div>
                        ) : null}
                        <Button
                            variant='outline'
                            onClick={toggleWebcamPreview}
                            disabled={isRequestingCapture || isUploading}>
                            <Video className='h-4 w-4 mr-2' />
                            {showWebcamPreview ? 'Hide Webcam' : 'Show Webcam'}
                        </Button>
                        <Button variant='outline' onClick={handleClose}>
                            <X className='h-4 w-4 mr-2' />
                            Close
                        </Button>
                        {!isRecording ? (
                            <AiFeatureDisabledHint enabled={useAI}>
                                <Button
                                    onClick={handleStartRecording}
                                    disabled={
                                        isRequestingCapture || isUploading
                                    }>
                                    {isRequestingCapture ? (
                                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                    ) : (
                                        <Video className='h-4 w-4 mr-2' />
                                    )}
                                    {isRequestingCapture
                                        ? 'Waiting for permission...'
                                        : 'Start Recording'}
                                </Button>
                            </AiFeatureDisabledHint>
                        ) : (
                            <Button
                                variant='destructive'
                                onClick={stopRecording}
                                disabled={isUploading}>
                                <Square className='h-4 w-4 mr-2' />
                                Stop ({formatElapsed(elapsedSeconds)})
                            </Button>
                        )}
                    </div>
                </div>

                <div className='flex-1 min-h-0 overflow-auto bg-muted/30 p-6'>
                    <div className='max-w-5xl mx-auto border bg-card shadow-sm relative'>
                        <BriefPreviewContent
                            briefId={briefId}
                            metadata={metadata}
                            content={content}
                            sections={sections}
                            templateKey={templateKey}
                        />
                    </div>
                </div>

                {showWebcamPreview ? (
                    <div
                        role='presentation'
                        title='Drag to move'
                        className={`fixed rounded-full overflow-hidden border-[3px] border-brand shadow-lg bg-black z-[1200] touch-none select-none ${
                            isDraggingWebcam ? 'cursor-grabbing' : 'cursor-grab'
                        }`}
                        style={{
                            left: resolvedWebcamPosition.x,
                            top: resolvedWebcamPosition.y,
                            width: webcamDimension,
                            height: webcamDimension
                        }}
                        onPointerDown={handleWebcamPointerDown}
                        onPointerMove={handleWebcamPointerMove}
                        onPointerUp={endWebcamDrag}
                        onPointerCancel={endWebcamDrag}>
                        <video
                            ref={webcamVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className='h-full w-full object-cover scale-x-[-1] pointer-events-none'
                        />
                    </div>
                ) : null}

                <div className='border-t px-6 py-4 space-y-3'>
                    {audioStatus ? (
                        <p className='text-sm text-muted-foreground'>
                            {audioStatus}
                        </p>
                    ) : null}
                    {isProcessingRecording ? (
                        <p className='text-sm text-muted-foreground flex items-center gap-2'>
                            <Loader2 className='h-4 w-4 animate-spin' />
                            Preparing recording preview…
                        </p>
                    ) : recordedUrl ? (
                        <div className='space-y-3'>
                            <p className='text-sm font-medium'>
                                Recording ready (
                                {formatElapsed(
                                    recordedDurationSeconds || elapsedSeconds
                                )}
                                )
                            </p>
                            <video
                                src={recordedUrl}
                                controls
                                className='w-full max-w-xl rounded-none border bg-black'
                            />
                            <div className='flex items-center gap-2'>
                                <AiFeatureDisabledHint enabled={useAI}>
                                    <Button
                                        onClick={handleUpload}
                                        disabled={
                                            isUploading || isProcessingRecording
                                        }>
                                        {isUploading ? (
                                            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                        ) : (
                                            <Upload className='h-4 w-4 mr-2' />
                                        )}
                                        {isUploading
                                            ? 'Uploading and generating captions…'
                                            : 'Upload Recording'}
                                    </Button>
                                </AiFeatureDisabledHint>
                                <Button
                                    variant='outline'
                                    onClick={() => {
                                        if (recordedUrl) {
                                            URL.revokeObjectURL(recordedUrl);
                                        }
                                        setRecordedBlob(null);
                                        setRecordedUrl('');
                                        setElapsedSeconds(0);
                                        recordedDurationSecondsRef.current = 0;
                                        setRecordedDurationSeconds(0);
                                    }}
                                    disabled={isUploading}>
                                    Discard
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className='text-sm text-muted-foreground'>
                            No recording yet. Start recording to capture this
                            fullscreen preview.
                        </p>
                    )}

                    {error ? (
                        error === AI_SETTINGS_ENABLE_HINT ? (
                            <AiSettingsEnableMessage />
                        ) : (
                            <p className='text-sm text-destructive'>{error}</p>
                        )
                    ) : null}
                </div>
            </div>
        </div>
    );
}
