export type RecordingCaptionsStatus = 'ready' | 'unavailable' | 'failed';

export interface RecordingMetadata {
    url: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    blobName: string;
    createdAt: string;
    durationSeconds: number | null;
    captionsBlobName?: string;
    captionsLanguage?: string;
    captionsStatus?: RecordingCaptionsStatus;
    captionsError?: string;
}

export function getRecordingFromContents(
    contents: Record<string, unknown>
): Record<string, unknown> | null {
    const recording = contents.recording;
    if (typeof recording === 'object' && recording !== null) {
        return recording as Record<string, unknown>;
    }
    return null;
}
