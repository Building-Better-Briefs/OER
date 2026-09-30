export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function sanitizeExportBasename(
    name: string,
    fallback: string = 'export'
): string {
    const cleaned = name
        .trim()
        .replace(/[^\w.\- ()]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^\.+/, '')
        .slice(0, 120);
    return cleaned || fallback;
}

export function uniqueZipEntryPdfName(
    baseName: string,
    usedLowercase: Set<string>
): string {
    const stem = sanitizeExportBasename(
        baseName.replace(/\.pdf$/i, ''),
        'document'
    );
    let candidate = `${stem}.pdf`;
    let suffix = 2;
    while (usedLowercase.has(candidate.toLowerCase())) {
        candidate = `${stem} (${suffix}).pdf`;
        suffix += 1;
    }
    usedLowercase.add(candidate.toLowerCase());
    return candidate;
}
