export const ASSIGNMENT_SETTING_IDS = [
    'require-logs',
    'require-ai-log'
] as const;

export type AssignmentSettingId = (typeof ASSIGNMENT_SETTING_IDS)[number];

export const ASSIGNMENT_SETTING_LABELS: Record<AssignmentSettingId, string> =
    {
        'require-logs': 'Logs',
        'require-ai-log': 'AI Log'
    };

export function isAssignmentSettingId(
    id: string
): id is AssignmentSettingId {
    return ASSIGNMENT_SETTING_IDS.includes(id as AssignmentSettingId);
}

export function isAssignmentSettingVisible(
    settingId: string,
    hiddenSettings: string[] | undefined | null
): boolean {
    return !hiddenSettings?.includes(settingId);
}

export function getVisibleAssignmentSettingIds(
    hiddenSettings: string[] | undefined | null
): AssignmentSettingId[] {
    return ASSIGNMENT_SETTING_IDS.filter((id) =>
        isAssignmentSettingVisible(id, hiddenSettings)
    );
}

export function getHiddenAssignmentSettingIds(
    hiddenSettings: string[] | undefined | null
): AssignmentSettingId[] {
    return ASSIGNMENT_SETTING_IDS.filter(
        (id) => !isAssignmentSettingVisible(id, hiddenSettings)
    );
}

export function normalizeHiddenAssignmentSettings(
    hiddenSettings: string[] | undefined | null
): AssignmentSettingId[] {
    return Array.from(
        new Set(
            (hiddenSettings ?? []).filter((id): id is AssignmentSettingId =>
                isAssignmentSettingId(id)
            )
        )
    );
}

export function isRequireNotebookSettingHidden(
    _hiddenSettings?: string[] | undefined | null
): boolean {
    return true;
}

export function isRequireLogsSettingHidden(
    hiddenSettings: string[] | undefined | null
): boolean {
    return !isAssignmentSettingVisible('require-logs', hiddenSettings);
}

export function isRequireAiLogSettingHidden(
    hiddenSettings: string[] | undefined | null
): boolean {
    return !isAssignmentSettingVisible('require-ai-log', hiddenSettings);
}
