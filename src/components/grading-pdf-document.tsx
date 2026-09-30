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

interface Criterion {
    id: string;
    heading: string;
    description: string;
    marks: number;
    highlight?: string;
}

interface Student {
    name: string;
    number: string;
    date?: string;
    grade?: string;
    selections?: Record<string, number>;
    feedback?: {
        strengths: string;
        development: string;
        comments: string;
    };
}

interface GradingPDFDocumentProps {
    module: string;
    assignmentTitle: string;
    assessors: string;
    criteria: Criterion[];
    student: Student;
    showDescription: boolean;
    showMarks: boolean;
    showFeedback: boolean;
    documentTitle?: string;
}

const gradeOptions = ['A', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'];

// Convert numeric score (0-100) to letter grade
const getLetterGradeFromScore = (
    score: number | undefined | null
): string | null => {
    if (score === undefined || score === null || isNaN(score)) {
        return null;
    }

    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 55) return 'B-';
    if (score >= 50) return 'C+';
    if (score >= 40) return 'C';
    if (score >= 35) return 'D';
    return 'F';
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
    gradingTable: {
        marginBottom: 20,
        border: '1 solid #000'
    },
    gradingHeader: {
        flexDirection: 'row',
        borderBottom: '1 solid #000',
        backgroundColor: '#f5f5f5'
    },
    gradingHeaderCell: {
        padding: 8,
        borderRight: '1 solid #000',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
        width: '8.75%' // Each grade column is 8.75% of total width
    },
    gradingHeaderCellCategory: {
        padding: 8,
        borderRight: '1 solid #000',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
        width: '17.5%' // Each category spans 2 columns (2 * 8.75%)
    },
    gradingHeaderCellLarge: {
        padding: 8,
        borderRight: '1 solid #000',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'left',
        width: '30%' // Criteria column is 30% of total width
    },
    gradingRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #e5e5e5'
    },
    gradingCell: {
        padding: 8,
        borderRight: '1 solid #e5e5e5',
        fontSize: 10,
        textAlign: 'center',
        minHeight: 40,
        width: '8.75%' // Each grade column is 8.75% of total width
    },
    gradingCellLarge: {
        padding: 8,
        borderRight: '1 solid #e5e5e5',
        fontSize: 10,
        textAlign: 'left',
        minHeight: 40,
        width: '30%' // Criteria column is 30% of total width
    },
    criterionHeading: {
        fontWeight: 'bold',
        marginBottom: 4
    },
    criterionDescription: {
        fontSize: 9,
        color: '#666',
        marginBottom: 4
    },
    criterionHighlight: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#0000ff',
        marginTop: 4
    },
    criterionMarks: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#666',
        marginTop: 4
    },
    selectedGrade: {
        fontWeight: 'bold',
        fontSize: 14
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

const GradingPDFDocument = ({
    module,
    assignmentTitle,
    assessors,
    criteria,
    student,
    showDescription,
    showMarks,
    showFeedback,
    documentTitle
}: GradingPDFDocumentProps) => {
    const title =
        documentTitle ?? `${module} — Grading and Feedback`;

    return (
        <Document>
            <Page size='A4' style={pdfStyles.page}>
                {/* Title */}
                <Text style={pdfStyles.title}>{title}</Text>

                {/* Student and Module Details */}
                <View style={pdfStyles.detailsTable}>
                    <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>Module:</Text>
                        <Text style={pdfStyles.detailsValue}>{module}</Text>
                    </View>
                    <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>
                            Assignment title:
                        </Text>
                        <Text style={pdfStyles.detailsValue}>
                            {assignmentTitle}
                        </Text>
                    </View>
                    <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>Assessor(s):</Text>
                        <Text style={pdfStyles.detailsValue}>{assessors}</Text>
                    </View>
                    <View style={pdfStyles.detailsRow}>
                        <Text style={pdfStyles.detailsLabel}>Student:</Text>
                        <Text style={pdfStyles.detailsValue}>
                            {student.name}
                        </Text>
                    </View>
                    {student.number && (
                        <View style={pdfStyles.detailsRow}>
                            <Text style={pdfStyles.detailsLabel}>Number:</Text>
                            <Text style={pdfStyles.detailsValue}>
                                {student.number}
                            </Text>
                        </View>
                    )}
                    <View
                        style={[
                            pdfStyles.detailsRow,
                            { borderBottom: 'none' }
                        ]}>
                        <Text style={pdfStyles.detailsLabel}>Date:</Text>
                        <Text style={pdfStyles.detailsValue}>
                            {formatPdfDate(student.date)}
                        </Text>
                        <Text
                            style={[
                                pdfStyles.detailsLabel,
                                { marginLeft: 20 }
                            ]}>
                            Grade:
                        </Text>
                        <Text
                            style={[
                                { color: '#0000ff' },
                                pdfStyles.detailsValue,
                                { fontWeight: 'bold' }
                            ]}>
                            {student.grade || 'Pending'}
                        </Text>
                    </View>
                </View>

                {/* Grading Table */}
                <View style={pdfStyles.gradingTable}>
                    {/* Header Row 1 - Categories */}
                    <View style={pdfStyles.gradingHeader}>
                        <View style={pdfStyles.gradingHeaderCellLarge}>
                            <Text>Assessment criteria</Text>
                        </View>
                        <View style={pdfStyles.gradingHeaderCellCategory}>
                            <Text>Excellent/very good</Text>
                        </View>
                        <View style={pdfStyles.gradingHeaderCellCategory}>
                            <Text>Good/satisfactory</Text>
                        </View>
                        <View style={pdfStyles.gradingHeaderCellCategory}>
                            <Text>Fair/pass</Text>
                        </View>
                        <View
                            style={[
                                pdfStyles.gradingHeaderCellCategory,
                                { borderRight: 'none' }
                            ]}>
                            <Text>Poor/fail</Text>
                        </View>
                    </View>

                    {/* Header Row 2 - Grade Letters */}
                    <View style={pdfStyles.gradingHeader}>
                        <View style={pdfStyles.gradingHeaderCellLarge}>
                            <Text></Text>
                        </View>
                        {gradeOptions.map((grade, index) => {
                            const isLastInPair = index % 2 === 1;
                            const isLast = index === gradeOptions.length - 1;
                            return (
                                <View
                                    key={grade}
                                    style={[
                                        pdfStyles.gradingHeaderCell,
                                        {
                                            borderRight:
                                                isLast || isLastInPair
                                                    ? '1 solid #000'
                                                    : '1 solid #e5e5e5'
                                        }
                                    ]}>
                                    <Text>{grade}</Text>
                                </View>
                            );
                        })}
                    </View>

                    {/* Criteria Rows */}
                    {criteria.map((criterion) => {
                        const selectedScore =
                            student.selections?.[criterion.id];
                        const selectedGrade =
                            getLetterGradeFromScore(selectedScore);
                        return (
                            <View key={criterion.id} style={pdfStyles.gradingRow}>
                                <View style={pdfStyles.gradingCellLarge}>
                                    <Text style={pdfStyles.criterionHeading}>
                                        {criterion.heading}
                                    </Text>
                                    {showDescription && (
                                        <Text
                                            style={
                                                pdfStyles.criterionDescription
                                            }>
                                            {criterion.description}
                                        </Text>
                                    )}
                                    {criterion.highlight && (
                                        <Text
                                            style={
                                                pdfStyles.criterionHighlight
                                            }>
                                            {criterion.highlight}
                                        </Text>
                                    )}
                                    {showMarks && (
                                        <Text style={pdfStyles.criterionMarks}>
                                            {criterion.marks} Marks
                                        </Text>
                                    )}
                                </View>
                                {gradeOptions.map((grade, gradeIndex) => {
                                    const isSelected = selectedGrade === grade;
                                    const isLastInPair = gradeIndex % 2 === 1;
                                    const isLast =
                                        gradeIndex === gradeOptions.length - 1;
                                    return (
                                        <View
                                            key={grade}
                                            style={[
                                                pdfStyles.gradingCell,
                                                {
                                                    backgroundColor: isSelected
                                                        ? '#e5e7eb'
                                                        : 'transparent',
                                                    borderRight:
                                                        isLast || isLastInPair
                                                            ? '1 solid #000'
                                                            : '1 solid #e5e5e5'
                                                }
                                            ]}>
                                            {isSelected && (
                                                <Text
                                                    style={
                                                        pdfStyles.selectedGrade
                                                    }>
                                                    X
                                                </Text>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })}
                </View>

                {/* Feedback Sections */}
                {showFeedback && (
                    <>
                        <View style={pdfStyles.feedbackSection}>
                            <View style={pdfStyles.feedbackBox} wrap={false}>
                                <Text style={pdfStyles.feedbackLabel}>
                                    Strengths
                                </Text>
                                <View style={pdfStyles.feedbackText}>
                                    {renderMarkdownFeedback(
                                        student.feedback?.strengths || ''
                                    )}
                                </View>
                            </View>
                        </View>

                        <View style={pdfStyles.feedbackSection}>
                            <View style={pdfStyles.feedbackBox} wrap={false}>
                                <Text style={pdfStyles.feedbackLabel}>
                                    Areas for development
                                </Text>
                                <View style={pdfStyles.feedbackText}>
                                    {renderMarkdownFeedback(
                                        student.feedback?.development || ''
                                    )}
                                </View>
                            </View>
                        </View>

                        <View style={pdfStyles.feedbackSection}>
                            <View style={pdfStyles.feedbackBox} wrap={false}>
                                <Text style={pdfStyles.feedbackLabel}>
                                    Other comments
                                </Text>
                                <View style={pdfStyles.feedbackText}>
                                    {renderMarkdownFeedback(
                                        student.feedback?.comments || ''
                                    )}
                                </View>
                            </View>
                        </View>
                    </>
                )}
            </Page>
        </Document>
    );
};

// Export function to generate PDF
export async function generateGradingPDF(
    module: string,
    assignmentTitle: string,
    assessors: string,
    criteria: Criterion[],
    student: Student,
    showDescription: boolean,
    showMarks: boolean,
    showFeedback: boolean,
    filename: string = 'feedback.pdf'
): Promise<void> {
    const doc = (
        <GradingPDFDocument
            module={module}
            assignmentTitle={assignmentTitle}
            assessors={assessors}
            criteria={criteria}
            student={student}
            showDescription={showDescription}
            showMarks={showMarks}
            showFeedback={showFeedback}
        />
    );
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export type { Criterion, Student };

async function openPDFInNewTab(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: React.ReactElement<any>
): Promise<void> {
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

export async function generateSelfAssessmentPDF(
    module: string,
    assignmentTitle: string,
    assessors: string,
    criteria: Criterion[],
    student: Student
): Promise<void> {
    const doc = (
        <GradingPDFDocument
            module={module}
            assignmentTitle={assignmentTitle}
            assessors={assessors}
            criteria={criteria}
            student={student}
            showDescription={true}
            showMarks={true}
            showFeedback={true}
            documentTitle='Student Self-Assessment Form'
        />
    );
    await openPDFInNewTab(doc);
}

export default GradingPDFDocument;
