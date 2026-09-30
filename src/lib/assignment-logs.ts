import {
    DEFAULT_FORMATIVE_FEEDBACK_FIELDS,
    isFormativeEntryEmpty,
    MAX_FORMATIVE_FEEDBACK_FIELDS,
    type FormativeFeedbackField,
    type FormativeMilestone
} from '@/lib/report-grading';
import { AI_ASSIGNMENT_LOG_DEFINITION_ID } from '@/lib/assignment-ai-log';

export const MAX_ASSIGNMENT_LOGS = 8;
export const MAX_SEEDED_MILESTONES_PER_LOG = 40;
export const MAX_EXTRA_LOG_ENTRIES = 100;
export const DEFAULT_NEW_LOG_ENTRY_NAME = 'Sprint review';
export const MAX_LOG_TEAM_MEMBERS = 8;
export const MAX_LOG_FIELD_VALUE_LENGTH = 10_000;
export const MAX_LOG_STAFF_NOTE_LENGTH = 10_000;
export const DEFAULT_ASSIGNMENT_LOG_TITLE = 'Log';

export type AssignmentLogSharing = 'individual' | 'shared';

export type AssignmentLogField = FormativeFeedbackField;

export type AssignmentLogSeededMilestone = FormativeMilestone;

export type AssignmentLogDefinition = {
    id: string;
    title: string;
    sharing: AssignmentLogSharing;
    fields: AssignmentLogField[];
    seededMilestones: AssignmentLogSeededMilestone[];
};

function createLogId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `log-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createFieldId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `field-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createMilestoneId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `milestone-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDefaultAssignmentLogFields(): AssignmentLogField[] {
    return DEFAULT_FORMATIVE_FEEDBACK_FIELDS.map((field) => ({
        id: field.id,
        label: field.label
    }));
}

export function createDefaultAssignmentLogDefinition(): AssignmentLogDefinition {
    return {
        id: createLogId(),
        title: DEFAULT_ASSIGNMENT_LOG_TITLE,
        sharing: 'individual',
        fields: createDefaultAssignmentLogFields(),
        seededMilestones: []
    };
}

function normalizeSharing(value: unknown): AssignmentLogSharing {
    return value === 'shared' ? 'shared' : 'individual';
}

function normalizeField(value: unknown, index: number): AssignmentLogField | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const field = value as Partial<AssignmentLogField>;
    const id =
        typeof field.id === 'string' && field.id.trim()
            ? field.id.trim()
            : createFieldId();
    const label =
        typeof field.label === 'string' && field.label.trim()
            ? field.label.trim().slice(0, 200)
            : `Field ${index + 1}`;

    return { id, label };
}

function normalizeMilestone(
    value: unknown,
    index: number
): AssignmentLogSeededMilestone | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const milestone = value as Partial<AssignmentLogSeededMilestone>;
    const id =
        typeof milestone.id === 'string' && milestone.id.trim()
            ? milestone.id.trim()
            : createMilestoneId();
    const name =
        typeof milestone.name === 'string'
            ? milestone.name.trim().slice(0, 200)
            : `Milestone ${index + 1}`;
    const date =
        typeof milestone.date === 'string' ? milestone.date.slice(0, 40) : '';
    const endDate =
        typeof milestone.endDate === 'string'
            ? milestone.endDate.slice(0, 40)
            : undefined;

    return {
        id,
        name,
        date,
        ...(endDate ? { endDate } : {})
    };
}

export function normalizeAssignmentLogDefinition(
    value: unknown
): AssignmentLogDefinition | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const raw = value as Partial<AssignmentLogDefinition>;
    const fields = (Array.isArray(raw.fields) ? raw.fields : [])
        .map((field, index) => normalizeField(field, index))
        .filter((field): field is AssignmentLogField => field !== null)
        .slice(0, MAX_FORMATIVE_FEEDBACK_FIELDS);

    const seededMilestones = (
        Array.isArray(raw.seededMilestones) ? raw.seededMilestones : []
    )
        .map((milestone, index) => normalizeMilestone(milestone, index))
        .filter(
            (milestone): milestone is AssignmentLogSeededMilestone =>
                milestone !== null
        )
        .slice(0, MAX_SEEDED_MILESTONES_PER_LOG);

    const title =
        typeof raw.title === 'string' && raw.title.trim()
            ? raw.title.trim().slice(0, 200)
            : DEFAULT_ASSIGNMENT_LOG_TITLE;

    return {
        id:
            typeof raw.id === 'string' && raw.id.trim()
                ? raw.id.trim()
                : createLogId(),
        title,
        sharing: normalizeSharing(raw.sharing),
        fields:
            fields.length > 0 ? fields : createDefaultAssignmentLogFields(),
        seededMilestones
    };
}

export function normalizeAssignmentLogs(
    logs: unknown
): AssignmentLogDefinition[] {
    if (!Array.isArray(logs)) {
        return [];
    }

    const seenIds = new Set<string>();
    const normalized: AssignmentLogDefinition[] = [];

    for (const log of logs) {
        const entry = normalizeAssignmentLogDefinition(log);
        if (
            !entry ||
            seenIds.has(entry.id) ||
            entry.id === AI_ASSIGNMENT_LOG_DEFINITION_ID
        ) {
            continue;
        }
        seenIds.add(entry.id);
        normalized.push(entry);
        if (normalized.length >= MAX_ASSIGNMENT_LOGS) {
            break;
        }
    }

    return normalized;
}

export function ensureAssignmentLogsWhenEnabled(input: {
    requireLogs: boolean;
    assignmentLogs: AssignmentLogDefinition[];
}): AssignmentLogDefinition[] {
    if (!input.requireLogs) {
        return input.assignmentLogs;
    }

    if (input.assignmentLogs.length > 0) {
        return input.assignmentLogs;
    }

    return [createDefaultAssignmentLogDefinition()];
}

export function getAssignmentLogFieldIds(
    fields: AssignmentLogField[]
): string[] {
    return fields.map((field) => field.id);
}

export function isAssignmentLogEntryEmpty(
    values: Record<string, string>,
    fieldIds: string[]
): boolean {
    return isFormativeEntryEmpty(
        { milestoneId: '', studentNumber: '', studentName: '', values },
        fieldIds
    );
}

export function pruneAssignmentLogValues(
    values: Record<string, string>,
    validFieldIds: string[]
): Record<string, string> {
    const validIds = new Set(validFieldIds);
    const pruned: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
        if (validIds.has(key) && typeof value === 'string') {
            pruned[key] = value.slice(0, MAX_LOG_FIELD_VALUE_LENGTH);
        }
    }
    return pruned;
}

export function parseAssignmentLogsFromBriefContent(
    content: unknown
): AssignmentLogDefinition[] {
    if (typeof content !== 'object' || content === null) {
        return [];
    }

    const record = content as { assignmentLogs?: unknown };
    return normalizeAssignmentLogs(record.assignmentLogs);
}

export function isRequireLogsEnabled(content: unknown): boolean {
    if (typeof content !== 'object' || content === null) {
        return false;
    }

    const record = content as {
        requireLogs?: unknown;
        assignmentLogs?: unknown;
    };

    if (record.requireLogs !== true) {
        return false;
    }

    return normalizeAssignmentLogs(record.assignmentLogs).length > 0;
}

export function getAssignmentLogDefinition(
    content: unknown,
    logDefinitionId: string
): AssignmentLogDefinition | null {
    const logs = parseAssignmentLogsFromBriefContent(content);
    return logs.find((log) => log.id === logDefinitionId) ?? null;
}

export function isSeededEntryUntouched(entry: {
    revision: number;
    hasContent: boolean;
}): boolean {
    return entry.revision === 0 && !entry.hasContent;
}

export type AssignmentLogTeamMemberDisplay = {
    name: string;
    studentNumber: string;
};

export function formatAssignmentLogStudentDisplay(input: {
    sharing: AssignmentLogSharing;
    studentName: string;
    studentNumber: string;
    teamMembers: AssignmentLogTeamMemberDisplay[];
    ownerName?: string | null;
}): string {
    if (input.sharing === 'shared') {
        const members = input.teamMembers
            .map((member) => {
                const name = member.name.trim();
                const number = member.studentNumber.trim();
                if (name && number) {
                    return `${name} (${number})`;
                }
                return name || number;
            })
            .filter(Boolean);

        if (members.length > 0) {
            return members.join(', ');
        }

        const owner = input.ownerName?.trim();
        if (owner) {
            return owner;
        }

        return 'Team log';
    }

    const name = input.studentName.trim();
    const number = input.studentNumber.trim();
    if (name && number) {
        return `${name} (${number})`;
    }
    return name || number || 'Student';
}

export function shouldShowAssignmentLogEntryUpdatedAt(entry: {
    id: number;
    revision: number;
    hasContent: boolean;
    updatedAt: string | null;
}): boolean {
    return (
        entry.id > 0 &&
        entry.updatedAt != null &&
        (entry.revision > 0 || entry.hasContent)
    );
}

export function buildAssignmentLogPdfFilename(input: {
    studentName: string;
    studentNumber: string;
    logTitle: string;
    entryName: string;
}): string {
    const parts = [
        input.studentNumber.trim() || input.studentName.trim() || 'student',
        input.logTitle.trim() || 'log',
        input.entryName.trim() || 'entry'
    ];
    return parts
        .join('_')
        .replace(/[^\w.-]+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 120);
}

export { createLogId, createFieldId, createMilestoneId };
