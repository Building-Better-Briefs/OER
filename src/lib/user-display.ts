export function normalizeSearchQuery(query: string): string {
    return query.trim().toLowerCase();
}

export function getUserDisplayLabel(user: {
    displayName: string | null;
    username: string;
    email?: string;
}): string {
    const displayName = user.displayName?.trim();
    if (displayName) {
        return displayName;
    }

    const username = user.username.trim();
    if (username) {
        return username;
    }

    return user.email?.trim() || '';
}

/** Append a name to a newline-separated field; skip duplicates (case-insensitive per line). */
export function appendNameToMultilineField(
    current: string,
    name: string
): string {
    const trimmedName = name.trim();
    if (!trimmedName) {
        return current;
    }

    const lines = current
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const key = trimmedName.toLowerCase();
    if (lines.some((line) => line.toLowerCase() === key)) {
        return current;
    }

    return current.trim() ? `${current.trim()}\n${trimmedName}` : trimmedName;
}
