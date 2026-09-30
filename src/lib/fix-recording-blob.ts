import ysFixWebmDuration from 'fix-webm-duration';

/**
 * MediaRecorder WebM blobs often lack duration metadata, which breaks native
 * video progress bars. Patch duration before upload (new recordings only).
 */
export function fixRecordingBlob(
    blob: Blob,
    durationMs: number
): Promise<Blob> {
    if (!blob.type.includes('webm') || durationMs <= 0) {
        return Promise.resolve(blob);
    }

    return ysFixWebmDuration(blob, durationMs);
}
