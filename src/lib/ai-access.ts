export const AI_DISABLED_ERROR = 'AI features are disabled';
export const AI_DISABLED_CODE = 'ai_disabled' as const;

export const SPEECH_TEXT_MAX_LENGTH = 4096;

export async function parseAiDisabledFromResponse(
    response: Response
): Promise<boolean> {
    if (response.status !== 403) {
        return false;
    }

    try {
        const data = (await response.clone().json()) as { code?: string };
        return data.code === AI_DISABLED_CODE;
    } catch {
        return false;
    }
}
