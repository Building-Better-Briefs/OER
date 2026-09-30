import { zipSync } from 'fflate';
import type { BriefMetadata, BriefSection } from '@/components/brief-preview-content';
import {
    generateBriefPDFBlob,
    generateChecklistAndSubmissionFormPDFBlob,
    generateChecklistPDFBlob,
    generateSubmissionFormPDFBlob
} from '@/components/brief-pdf-document';
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
import { isBriefSectionEnabled } from '@/lib/brief-sections';
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

function briefHasExportableChecklistPdf(
    sections: BriefSection[],
    content: unknown
): boolean {
    const hasChecklistEnabled = sections.some(
        (section) =>
            section.id === 'submission-checklist' &&
            isBriefSectionEnabled(section)
    );
    if (!hasChecklistEnabled) {
        return false;
    }
    if (typeof content !== 'object' || content === null) {
        return false;
    }
    const checklistItems = (content as { checklistItems?: unknown })
        .checklistItems;
    return Array.isArray(checklistItems) && checklistItems.length > 0;
}

function briefHasExportableSubmissionFormPdf(
    sections: BriefSection[],
    content: unknown
): boolean {
    const hasSubmissionFormEnabled = sections.some(
        (section) =>
            section.id === 'submission-form' &&
            isBriefSectionEnabled(section)
    );
    if (!hasSubmissionFormEnabled) {
        return false;
    }
    if (typeof content !== 'object' || content === null) {
        return false;
    }
    const submissionFormFields = (content as { submissionFormFields?: unknown })
        .submissionFormFields;
    return (
        Array.isArray(submissionFormFields) && submissionFormFields.length > 0
    );
}

function briefNeedsMultiFileExport(
    sections: BriefSection[],
    content: unknown
): boolean {
    return (
        briefHasExportableLogs(content) ||
        briefHasExportableChecklistPdf(sections, content) ||
        briefHasExportableSubmissionFormPdf(sections, content)
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

async function appendLogPdfsToZip(
    zipFiles: Record<string, Uint8Array>,
    usedNames: Set<string>,
    metadata: BriefMetadata,
    contentRecord: unknown
): Promise<void> {
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
            zipFiles[
                uniqueZipEntryPdfName(log.title || 'Custom Log', usedNames)
            ] = await blobToUint8Array(logBlob);
        }
    }
}

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

    if (!briefNeedsMultiFileExport(sections, contentRecord)) {
        downloadBlob(briefBlob, `${assignmentBasename}.pdf`);
        return 'pdf';
    }

    zipFiles[uniqueZipEntryPdfName(assignmentBasename, usedNames)] =
        await blobToUint8Array(briefBlob);

    const exportChecklist = briefHasExportableChecklistPdf(
        sections,
        contentRecord
    );
    const exportSubmissionForm = briefHasExportableSubmissionFormPdf(
        sections,
        contentRecord
    );

    if (exportChecklist && exportSubmissionForm) {
        const combinedBlob =
            await generateChecklistAndSubmissionFormPDFBlob(content);
        zipFiles[
            uniqueZipEntryPdfName(
                'Submission Checklist and Submission Form',
                usedNames
            )
        ] = await blobToUint8Array(combinedBlob);
    } else {
        if (exportChecklist) {
            const checklistBlob = await generateChecklistPDFBlob(content);
            zipFiles[uniqueZipEntryPdfName('Submission Checklist', usedNames)] =
                await blobToUint8Array(checklistBlob);
        }
        if (exportSubmissionForm) {
            const submissionFormBlob =
                await generateSubmissionFormPDFBlob(content);
            zipFiles[uniqueZipEntryPdfName('Submission Form', usedNames)] =
                await blobToUint8Array(submissionFormBlob);
        }
    }

    await appendLogPdfsToZip(zipFiles, usedNames, metadata, contentRecord);

    const zipBytes = zipSync(zipFiles);
    const zipBlob = new Blob([zipBytes], { type: 'application/zip' });
    downloadBlob(zipBlob, `${assignmentBasename}.zip`);
    return 'zip';
}
