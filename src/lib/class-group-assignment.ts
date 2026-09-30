import { institutionConfig, getStudentEmail } from '@/lib/institution-config';

export function normalizeClassGroupStudentNumber(value: string): string {
    return value.trim().toUpperCase();
}

export function parseStudentNumberFromEmail(email: string): string | null {
    const trimmed = email.trim().toLowerCase();
    const domain = institutionConfig.studentEmailDomain.trim().toLowerCase();
    if (!domain) {
        return null;
    }

    const at = trimmed.lastIndexOf('@');
    if (at <= 0) {
        return null;
    }

    const localPart = trimmed.slice(0, at);
    const emailDomain = trimmed.slice(at + 1);
    if (emailDomain !== domain) {
        return null;
    }

    const normalized = normalizeClassGroupStudentNumber(localPart);
    return normalized.length > 0 ? normalized : null;
}

export function buildStudentLoginNextHref(viewerPath: string): string {
    const params = new URLSearchParams({ next: viewerPath });
    return `/student/login?${params.toString()}`;
}

export function buildStudentEmailsFromNumbers(numbers: string[]): string[] {
    const domain = institutionConfig.studentEmailDomain.trim();
    if (!domain) {
        return [];
    }

    const seen = new Set<string>();
    const emails: string[] = [];

    for (const raw of numbers) {
        const number = normalizeClassGroupStudentNumber(raw);
        if (!number || seen.has(number)) {
            continue;
        }
        seen.add(number);
        emails.push(getStudentEmail(number).toLowerCase());
    }

    return emails;
}
