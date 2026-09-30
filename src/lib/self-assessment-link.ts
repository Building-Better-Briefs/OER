/** Whether the brief has at least one non-empty rubric criterion (required for self-assessment). */
export function hasSelfAssessmentRubric(content: unknown): boolean {
    if (typeof content !== 'object' || content === null) {
        return false;
    }

    const rubricCriteria = (content as { rubricCriteria?: unknown })
        .rubricCriteria;
    if (!Array.isArray(rubricCriteria)) {
        return false;
    }

    return rubricCriteria.some(
        (row: { criterion?: string }) =>
            typeof row.criterion === 'string' &&
            row.criterion.trim().length > 0
    );
}

/** Lecturer opt-in for the self-assessment link on the public brief viewer (defaults to on). */
export function isSelfAssessmentLinkEnabled(content: unknown): boolean {
    if (!hasSelfAssessmentRubric(content)) {
        return false;
    }

    if (typeof content !== 'object' || content === null) {
        return false;
    }

    const enabled = (content as { selfAssessmentLinkEnabled?: unknown })
        .selfAssessmentLinkEnabled;

    return enabled !== false;
}
