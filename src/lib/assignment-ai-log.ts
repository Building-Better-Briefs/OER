import {
    getAssignmentLogDefinition,
    isRequireLogsEnabled,
    type AssignmentLogDefinition
} from '@/lib/assignment-logs';
import { parseAiPolicy } from '@/lib/ai-policies';

export const AI_ASSIGNMENT_LOG_DEFINITION_ID = 'ai-usage-log';

export const AI_ASSIGNMENT_LOG_TITLE = 'AI Usage Log';

const CANONICAL_AI_LOG_DEFINITION: AssignmentLogDefinition = {
    id: AI_ASSIGNMENT_LOG_DEFINITION_ID,
    title: AI_ASSIGNMENT_LOG_TITLE,
    sharing: 'individual',
    fields: [
        { id: 'tool', label: 'AI tool used' },
        { id: 'purpose', label: 'Purpose / task' },
        { id: 'howUsed', label: 'How the output was used or modified' },
        { id: 'reflection', label: 'Reflection / critical evaluation' }
    ],
    seededMilestones: []
};

export function getCanonicalAiLogDefinition(): AssignmentLogDefinition {
    return CANONICAL_AI_LOG_DEFINITION;
}

export function isAiLogDefinitionId(logDefinitionId: string): boolean {
    return logDefinitionId === AI_ASSIGNMENT_LOG_DEFINITION_ID;
}

export function defaultAiLogEntryName(index: number): string {
    return `Entry ${Math.max(1, index)}`;
}

export function isAiLogEnabled(content: unknown): boolean {
    if (typeof content !== 'object' || content === null) {
        return false;
    }

    const record = content as {
        requireAiLog?: unknown;
        aiPolicy?: { usageLogEnabled?: unknown };
    };

    if (record.requireAiLog === true) {
        return true;
    }

    const aiPolicy = parseAiPolicy(content);
    return aiPolicy.usageLogEnabled === true;
}

export function resolveAssignmentLogDefinition(
    content: unknown,
    logDefinitionId: string
): AssignmentLogDefinition | null {
    if (isAiLogDefinitionId(logDefinitionId)) {
        return isAiLogEnabled(content) ? getCanonicalAiLogDefinition() : null;
    }

    return getAssignmentLogDefinition(content, logDefinitionId);
}

export function canWriteStudentLog(
    content: unknown,
    logDefinitionId: string
): boolean {
    if (isAiLogDefinitionId(logDefinitionId)) {
        return isAiLogEnabled(content);
    }

    return isRequireLogsEnabled(content);
}
