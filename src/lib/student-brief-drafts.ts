import type { AiUsageLogDraft } from '@/lib/ai-usage-log-storage';
import type { SelfAssessmentDraft } from '@/lib/self-assessment-storage';
import type { SubmissionFormValues } from '@/lib/submission-form-storage';
import type { StudentDraftKind } from '@/lib/student-brief-drafts-schema';
import type { ChecklistDraftData } from '@/lib/checklist-storage';

export type SyncedDraftEnvelope<T> = {
    data: T;
    revision: number;
    updatedAt: string;
};

export type AiUsageLogDraftData = AiUsageLogDraft;
export type SelfAssessmentDraftData = SelfAssessmentDraft;
export type SubmissionFormDraftData = { values: SubmissionFormValues };
export type ChecklistDraftEnvelopeData = ChecklistDraftData;

export type StudentBriefDraftColumns = {
    aiUsageLog: SyncedDraftEnvelope<AiUsageLogDraftData> | null;
    selfAssessment: SyncedDraftEnvelope<SelfAssessmentDraftData> | null;
    submissionForm: SyncedDraftEnvelope<SubmissionFormDraftData> | null;
    checklist: SyncedDraftEnvelope<ChecklistDraftEnvelopeData> | null;
};

export type HydrateDraftResult<T> = {
    draft: T;
    revision: number | null;
    shouldPush: boolean;
};

function hasText(value: string | undefined): boolean {
    return Boolean(value?.trim());
}

export function isAiUsageLogStarted(draft: AiUsageLogDraftData): boolean {
    if (
        hasText(draft.studentName) ||
        hasText(draft.studentNumber) ||
        draft.declarationConfirmed
    ) {
        return true;
    }
    return draft.entries.some(
        (entry) =>
            hasText(entry.tool) ||
            hasText(entry.purpose) ||
            hasText(entry.howUsed) ||
            hasText(entry.reflection)
    );
}

export function isSelfAssessmentStarted(
    draft: SelfAssessmentDraftData
): boolean {
    if (hasText(draft.studentName) || hasText(draft.studentNumber)) {
        return true;
    }
    if (Object.keys(draft.selections).length > 0) {
        return true;
    }
    return (
        hasText(draft.feedback.strengths) ||
        hasText(draft.feedback.development) ||
        hasText(draft.feedback.comments)
    );
}

export function isSubmissionFormStarted(
    values: SubmissionFormValues
): boolean {
    return Object.values(values).some((value) => hasText(value));
}

export function isChecklistStarted(items: Record<string, boolean>): boolean {
    return Object.values(items).some((checked) => checked === true);
}

export function countAiUsageLogEntries(draft: AiUsageLogDraftData): number {
    return draft.entries.filter(
        (entry) =>
            hasText(entry.tool) ||
            hasText(entry.purpose) ||
            hasText(entry.howUsed) ||
            hasText(entry.reflection)
    ).length;
}

export function mergeChecklistItems(
    local: Record<string, boolean>,
    server: Record<string, boolean>
): Record<string, boolean> {
    const merged: Record<string, boolean> = { ...server };
    for (const [key, value] of Object.entries(local)) {
        merged[key] = value || server[key] === true;
    }
    return merged;
}

export function mergeSubmissionFormValues(
    local: SubmissionFormValues,
    server: SubmissionFormValues
): SubmissionFormValues {
    const keys = new Set([...Object.keys(local), ...Object.keys(server)]);
    const merged: SubmissionFormValues = {};

    for (const key of keys) {
        const localValue = local[key]?.trim() ?? '';
        const serverValue = server[key]?.trim() ?? '';
        if (localValue && serverValue && localValue !== serverValue) {
            merged[key] = local[key];
        } else {
            merged[key] = localValue || serverValue;
        }
    }

    return merged;
}

export function mergeFieldDrafts(
    kind: 'checklist' | 'submissionForm',
    local: ChecklistDraftData | SubmissionFormDraftData,
    server: ChecklistDraftData | SubmissionFormDraftData
): ChecklistDraftData | SubmissionFormDraftData {
    if (kind === 'checklist') {
        return {
            items: mergeChecklistItems(
                (local as ChecklistDraftData).items,
                (server as ChecklistDraftData).items
            )
        };
    }

    return {
        values: mergeSubmissionFormValues(
            (local as SubmissionFormDraftData).values,
            (server as SubmissionFormDraftData).values
        )
    };
}

export function resolveHydratedDraft<T extends { revision?: number }>(
    local: T | null,
    server: SyncedDraftEnvelope<T> | null,
    isStarted: (draft: T) => boolean
): HydrateDraftResult<T> {
    const localRevision = local?.revision ?? 0;
    const serverRevision = server?.revision ?? 0;

    if (!local && !server) {
        return { draft: {} as T, revision: null, shouldPush: false };
    }

    if (!local && server) {
        return {
            draft: { ...server.data, revision: server.revision },
            revision: server.revision,
            shouldPush: false
        };
    }

    if (local && !server) {
        return {
            draft: local,
            revision: null,
            shouldPush: isStarted(local)
        };
    }

    if (local && server) {
        if (serverRevision > localRevision) {
            return {
                draft: { ...server.data, revision: server.revision },
                revision: server.revision,
                shouldPush: false
            };
        }

        if (localRevision > serverRevision) {
            return {
                draft: local,
                revision: localRevision,
                shouldPush: isStarted(local)
            };
        }

        return {
            draft: local,
            revision: localRevision,
            shouldPush: false
        };
    }

    return { draft: {} as T, revision: null, shouldPush: false };
}

export function wrapDraftForSave<T>(
    data: T,
    revision: number,
    updatedAt: string
): SyncedDraftEnvelope<T> {
    return { data, revision, updatedAt };
}

export function isDraftKindStarted(
    kind: StudentDraftKind,
    envelope: SyncedDraftEnvelope<unknown>
): boolean {
    switch (kind) {
        case 'aiUsageLog':
            return isAiUsageLogStarted(
                envelope.data as AiUsageLogDraftData
            );
        case 'selfAssessment':
            return isSelfAssessmentStarted(
                envelope.data as SelfAssessmentDraftData
            );
        case 'submissionForm':
            return isSubmissionFormStarted(
                (envelope.data as SubmissionFormDraftData).values
            );
        case 'checklist':
            return isChecklistStarted(
                (envelope.data as ChecklistDraftEnvelopeData).items
            );
        default:
            return false;
    }
}

export function deriveAssignmentDraftStatus(input: {
    checklistItems: string[];
    submissionFormFieldCount: number;
    checklist: SyncedDraftEnvelope<ChecklistDraftEnvelopeData> | null;
    submissionForm: SyncedDraftEnvelope<SubmissionFormDraftData> | null;
    aiUsageLog: SyncedDraftEnvelope<AiUsageLogDraftData> | null;
    selfAssessment: SyncedDraftEnvelope<SelfAssessmentDraftData> | null;
}): {
    checklistChecked: number;
    checklistTotal: number;
    submissionFormStarted: boolean;
    aiUsageLogEntries: number;
    selfAssessmentStarted: boolean;
    printCheckedItems: Record<string, boolean>;
    printSubmissionFormValues: SubmissionFormValues;
} {
    const validKeys = new Set(
        input.checklistItems.map((item, idx) => `checklist-${idx}-${item}`)
    );

    const checklistItems = input.checklist?.data.items ?? {};
    const prunedChecklist: Record<string, boolean> = {};
    let checklistChecked = 0;

    for (const key of validKeys) {
        if (checklistItems[key]) {
            prunedChecklist[key] = true;
            checklistChecked += 1;
        }
    }

    const formValues = input.submissionForm?.data.values ?? {};
    const prunedForm: SubmissionFormValues = {};
    for (const [key, value] of Object.entries(formValues)) {
        if (key.startsWith('submission-field-') && hasText(value)) {
            prunedForm[key] = value;
        }
    }

    return {
        checklistChecked,
        checklistTotal: input.checklistItems.length,
        submissionFormStarted:
            input.submissionFormFieldCount > 0 &&
            isSubmissionFormStarted(prunedForm),
        aiUsageLogEntries: input.aiUsageLog
            ? countAiUsageLogEntries(input.aiUsageLog.data)
            : 0,
        selfAssessmentStarted: input.selfAssessment
            ? isSelfAssessmentStarted(input.selfAssessment.data)
            : false,
        printCheckedItems: prunedChecklist,
        printSubmissionFormValues: prunedForm
    };
}

export function resolveAiUsageLogEntryCountForStatus(
    studentLogFilledCount: number,
    draftCount: number
): number {
    return studentLogFilledCount > 0 ? studentLogFilledCount : draftCount;
}

export function formatAssignmentDraftStatusLine(status: {
    checklistChecked: number;
    checklistTotal: number;
    submissionFormStarted: boolean;
    aiUsageLogEntries: number;
    selfAssessmentStarted: boolean;
    logFilledEntryCount?: number;
}): string | null {
    const parts: string[] = [];

    if (status.checklistTotal > 0 && status.checklistChecked > 0) {
        parts.push(
            `Checklist ${status.checklistChecked}/${status.checklistTotal}`
        );
    }
    if (status.submissionFormStarted) {
        parts.push('Form started');
    }
    if (status.aiUsageLogEntries > 0) {
        parts.push(
            `AI log ${status.aiUsageLogEntries} ${status.aiUsageLogEntries === 1 ? 'entry' : 'entries'}`
        );
    }
    if (status.selfAssessmentStarted) {
        parts.push('Self-assessment started');
    }
    if ((status.logFilledEntryCount ?? 0) > 0) {
        const count = status.logFilledEntryCount ?? 0;
        parts.push(
            `Logs ${count} ${count === 1 ? 'entry' : 'entries'}`
        );
    }

    return parts.length > 0 ? parts.join(' · ') : null;
}
