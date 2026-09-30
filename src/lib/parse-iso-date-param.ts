/** Minimal ISO date parser for offline (from schedule-data). */
export function parseIsoDateParam(value: string | null | undefined): Date | null {
    if (!value?.trim()) return null;
    const dateOnly = value.trim().split('T')[0]!;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const d = new Date(year, month, day);
    if (
        d.getFullYear() !== year ||
        d.getMonth() !== month ||
        d.getDate() !== day
    ) {
        return null;
    }
    return d;
}
