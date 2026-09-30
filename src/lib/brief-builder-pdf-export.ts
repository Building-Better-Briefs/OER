import { zipSync } from 'fflate';
import type { BriefMetadata, BriefSection } from '@/components/brief-preview-content';
import { generateBriefPDFBlob } from '@/components/brief-pdf-document';
import { renderStudentAssignmentLogPDFBlob } from '@/components/student-assignment-log-pdf-document';
import type { InstitutionalAiPolicy } from '@/lib/institution-config';
import {
    defaultAiLogEntryName,
    getCanonicalAiLogDefinition,
    isAiLogEnabled
} from '@/lib/assignment-ai-log';
import {
    DEFAULT_NEW_LOG_ENTRY_NAME,
    isRequireLogsEnabled,
    parseAssignmentLogsFromBriefContent
} from '@/lib/assignment-logs';
import {
    downloadBlob,
    sanitizeExportBasename,
    uniqueZipEntryPdfName
} from '@/lib/download-blob';

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
    return new Uint8Array(await blob.arrayBuffer());
}

function briefHasExportableLogs(content: unknown): boolean {
    const contentRecord = content ?? {};
    return (
        isAiLogEnabled(contentRecord) || isRequireLogsEnabled(contentRecord)
    );
}

export type BriefBuilderPdfExportInput = {
    metadata: BriefMetadata;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    sections: BriefSection[];
    institutionalAiPolicy?: InstitutionalAiPolicy;
    aiPolicyDocument?: { url: string; fileName: string } | null;
};

export async function downloadBriefBuilderExportZip(
    input: BriefBuilderPdfExportInput
): Promise<'pdf' | 'zip'> {
    const {
        metadata,
        content,
        sections,
        institutionalAiPolicy = { label: '', url: '' },
        aiPolicyDocument = null
    } = input;

    const zipFiles: Record<string, Uint8Array> = {};
    const usedNames = new Set<string>();

    const assignmentBasename = sanitizeExportBasename(
        metadata.title || 'assessment-brief',
        'assessment-brief'
    );

    const contentRecord = content ?? {};

    const briefBlob = await generateBriefPDFBlob(
        metadata,
        content,
        sections,
        institutionalAiPolicy,
        aiPolicyDocument
    );

    if (!briefHasExportableLogs(contentRecord)) {
        downloadBlob(briefBlob, `${assignmentBasename}.pdf`);
        return 'pdf';
    }

    zipFiles[uniqueZipEntryPdfName(assignmentBasename, usedNames)] =
        await blobToUint8Array(briefBlob);

    if (isAiLogEnabled(contentRecord)) {
        const definition = getCanonicalAiLogDefinition();
        const aiLogBlob = await renderStudentAssignmentLogPDFBlob({
            module: metadata.module,
            assignmentTitle: metadata.title,
            lecturer: metadata.lecturer,
            logTitle: definition.title,
            entryName: defaultAiLogEntryName(1),
            entryDate: '',
            entryEndDate: null,
            studentsDisplay: '',
            fields: definition.fields,
            values: {}
        });
        zipFiles[uniqueZipEntryPdfName('AI Log', usedNames)] =
            await blobToUint8Array(aiLogBlob);
    }

    if (isRequireLogsEnabled(contentRecord)) {
        const logs = parseAssignmentLogsFromBriefContent(contentRecord);
        for (const log of logs) {
            const entryName =
                log.seededMilestones[0]?.name?.trim() ||
                DEFAULT_NEW_LOG_ENTRY_NAME;
            const logBlob = await renderStudentAssignmentLogPDFBlob({
                module: metadata.module,
                assignmentTitle: metadata.title,
                lecturer: metadata.lecturer,
                logTitle: log.title,
                entryName,
                entryDate: log.seededMilestones[0]?.date ?? '',
                entryEndDate: log.seededMilestones[0]?.endDate ?? null,
                studentsDisplay: '',
                fields: log.fields,
                values: {}
            });
            zipFiles[uniqueZipEntryPdfName(log.title || 'Custom Log', usedNames)] =
                await blobToUint8Array(logBlob);
        }
    }

    const zipBytes = zipSync(zipFiles);
    const zipBlob = new Blob([zipBytes], { type: 'application/zip' });
    downloadBlob(zipBlob, `${assignmentBasename}.zip`);
    return 'zip';
}
