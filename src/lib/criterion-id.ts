export function createCriterionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `criterion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function criteriaHaveIds(
    rows: Array<{ id?: string }>
): boolean {
    return (
        rows.length > 0 &&
        rows.every(
            (row) => typeof row.id === 'string' && row.id.trim() !== ''
        )
    );
}
