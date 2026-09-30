import { parseIsoDateParam } from '@/lib/parse-iso-date-param';

export function parseDateField(value: string | null | undefined): Date | null {
    if (!value?.trim()) {
        return null;
    }

    const dateOnly = value.trim().split('T')[0]!;
    return parseIsoDateParam(dateOnly);
}

export function formatDateField(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseDatetimeLocalField(
    value: string | null | undefined
): Date | null {
    if (!value?.trim()) {
        return null;
    }

    const trimmed = value.trim();
    const [datePart, timePart] = trimmed.split('T');
    if (!datePart) {
        return null;
    }

    const base = parseIsoDateParam(datePart);
    if (!base) {
        return null;
    }

    if (!timePart) {
        return base;
    }

    const [hoursStr, minutesStr] = timePart.split(':');
    const hours = Number.parseInt(hoursStr ?? '0', 10);
    const minutes = Number.parseInt(minutesStr ?? '0', 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return base;
    }

    const result = new Date(base);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

export function formatDatetimeLocalField(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${formatDateField(date)}T${hours}:${minutes}`;
}
