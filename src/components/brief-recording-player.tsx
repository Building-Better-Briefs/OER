import type { RecordingCaptionsStatus } from '@/lib/recording-metadata';
import { cn } from '@/lib/utils';

type BriefRecordingPlayerProps = {
    videoSrc: string;
    captionsSrc?: string;
    captionsStatus?: RecordingCaptionsStatus;
    captionsLanguage?: string;
    className?: string;
};

function captionsStatusMessage(status?: RecordingCaptionsStatus) {
    if (status === 'unavailable') {
        return 'No audio was captured, so closed captions are not available for this recording.';
    }

    if (status === 'failed') {
        return 'Automatic captions could not be generated for this recording.';
    }

    return null;
}

export function BriefRecordingPlayer({
    videoSrc,
    captionsSrc,
    captionsStatus,
    captionsLanguage = 'en',
    className
}: BriefRecordingPlayerProps) {
    const statusMessage = captionsStatusMessage(captionsStatus);

    return (
        <div className='space-y-2'>
            <video controls src={videoSrc} className={cn(className)}>
                {captionsSrc ? (
                    <track
                        kind='captions'
                        src={captionsSrc}
                        srcLang={captionsLanguage}
                        label='English'
                        default
                    />
                ) : null}
            </video>
            {statusMessage ? (
                <p className='text-xs text-muted-foreground'>{statusMessage}</p>
            ) : null}
        </div>
    );
}
