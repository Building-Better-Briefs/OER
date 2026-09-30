import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf
} from '@react-pdf/renderer';
import { renderMarkdownFeedback } from '@/lib/pdf-markdown-feedback';
import { formatPdfDate } from '@/lib/pdf-date';
import type { AssignmentLogField } from '@/lib/assignment-logs';

type StudentAssignmentLogPDFDocumentProps = {
    module: string;
    assignmentTitle: string;
    lecturer: string;
    logTitle: string;
    entryName: string;
    entryDate: string;
    entryEndDate: string | null;
    studentsDisplay: string;
    fields: AssignmentLogField[];
    values: Record<string, string>;
};

const pdfStyles = StyleSheet.create({
    page: {
        padding: 40,
        paddingBottom: 60,
        fontSize: 12,
        fontFamily: 'Helvetica'
    },
    title: {
        fontSize: 24,
        marginBottom: 20,
        fontWeight: 'bold'
    },
    detailsTable: {
        marginBottom: 20,
        borderBottom: '1 solid #000'
    },
    detailsRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #e5e5e5',
        paddingVertical: 8
    },
    detailsLabel: {
        width: 120,
        fontWeight: 'bold',
        paddingRight: 10
    },
    detailsValue: {
        flex: 1
    },
    feedbackSection: {
        marginTop: 16
    },
    feedbackBox: {
        border: '1 solid #000'
    },
    feedbackLabel: {
        fontWeight: 'bold',
        fontSize: 12,
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 6
    },
    feedbackText: {
        paddingHorizontal: 10,
        paddingBottom: 10,
        minHeight: 52,
        fontSize: 10,
        lineHeight: 1.5
    }
});

function getFieldDisplayLabel(label: string): string {
    const trimmed = label.trim();
    return trimmed || 'Untitled field';
}

function StudentAssignmentLogPDFDocument({
    module,
    assignmentTitle,
    lecturer,
    logTitle,
    entryName,
    entryDate,
    entryEndDate,
    studentsDisplay,
    fields,
    values
}: StudentAssignmentLogPDFDocumentProps) {
    const startDate = entryDate ? formatPdfDate(entryDate) : '';
    const endDate = entryEndDate ? formatPdfDate(entryEndDate) : null;
    const showEndDate = endDate !== null && endDate !== startDate;

    return (
        <Document title={`${module} — ${logTitle}`}>
            <Page size='A4' style={pdfStyles.page}>
                <Text style={pdfStyles.title}>
                    {module} — {logTitle}
                </Text>

                <View style={pdfStyles.detailsTable}>
                    <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>
                            Assignment title:
                        </Text>
                        <Text style={pdfStyles.detailsValue}>
                            {assignmentTitle}
                        </Text>
                    </View>
                    <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>Lecturer:</Text>
                        <Text style={pdfStyles.detailsValue}>{lecturer}</Text>
                    </View>
                    <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>Entry:</Text>
                        <Text style={pdfStyles.detailsValue}>{entryName}</Text>
                    </View>
                    {startDate ? (
                        <View style={pdfStyles.detailsRow}>
                            <Text style={pdfStyles.detailsLabel}>
                                {showEndDate ? 'Start date:' : 'Date:'}
                            </Text>
                            <Text style={pdfStyles.detailsValue}>
                                {startDate}
                            </Text>
                        </View>
                    ) : null}
                    {showEndDate ? (
                        <View style={pdfStyles.detailsRow}>
                            <Text style={pdfStyles.detailsLabel}>
                                End date:
                            </Text>
                            <Text style={pdfStyles.detailsValue}>
                                {endDate}
                            </Text>
                        </View>
                    ) : null}
                    <View
                        style={[
                            pdfStyles.detailsRow,
                            { borderBottom: 'none' }
                        ]}>
                        <Text style={pdfStyles.detailsLabel}>Student:</Text>
                        <Text style={pdfStyles.detailsValue}>
                            {studentsDisplay}
                        </Text>
                    </View>
                </View>

                {fields.map((field) => (
                    <View key={field.id} style={pdfStyles.feedbackSection}>
                        <View style={pdfStyles.feedbackBox} wrap={false}>
                            <Text style={pdfStyles.feedbackLabel}>
                                {getFieldDisplayLabel(field.label)}
                            </Text>
                            <View style={pdfStyles.feedbackText}>
                                {renderMarkdownFeedback(values[field.id] ?? '')}
                            </View>
                        </View>
                    </View>
                ))}
            </Page>
        </Document>
    );
}

export async function renderStudentAssignmentLogPDFBlob(
    params: StudentAssignmentLogPDFDocumentProps
): Promise<Blob> {
    const doc = (
        <StudentAssignmentLogPDFDocument
            module={params.module}
            assignmentTitle={params.assignmentTitle}
            lecturer={params.lecturer}
            logTitle={params.logTitle}
            entryName={params.entryName}
            entryDate={params.entryDate}
            entryEndDate={params.entryEndDate}
            studentsDisplay={params.studentsDisplay}
            fields={params.fields}
            values={params.values}
        />
    );
    return pdf(doc).toBlob();
}

export async function generateStudentAssignmentLogPDF(
    params: StudentAssignmentLogPDFDocumentProps & { filename: string }
): Promise<void> {
    const blob = await renderStudentAssignmentLogPDFBlob(params);
    const { downloadBlob } = await import('@/lib/download-blob');
    downloadBlob(blob, `${params.filename}.pdf`);
}
