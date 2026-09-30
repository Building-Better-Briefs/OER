import { isRequireLogsEnabled } from '@/lib/assignment-logs';

/** Lecturer opt-in: assignment requires structured log submission(s). */
export function isRequireLogsSettingEnabled(content: unknown): boolean {
    return isRequireLogsEnabled(content);
}
