import React from 'react';
import { format } from 'date-fns';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    pdf,
    Font,
    Link
} from '@react-pdf/renderer';
import type { BriefMetadata, BriefSection } from './brief-preview-content';
import { splitTextByBareUrls } from '@/lib/autolink-text';
import { replaceIso8601InTextWithIrishLocale } from '@/lib/irish-datetime-format';
import { richTextToPlainText } from '@/lib/rich-text-utils';
import { isBriefSectionEnabled } from '@/lib/brief-sections';
import { isProjectDetailSubsectionVisible } from '@/lib/project-detail-subsections';
import {
    getVisibleCustomSubsections,
    normalizeCustomSubsections,
    parseCustomSubsectionBlockId
} from '@/lib/custom-subsections';
import {
    getVisibleProjectDetailBlockIds,
    normalizeProjectDetailBlockOrder
} from '@/lib/project-detail-block-order';
import {
    getAiasLevel,
    hasAssessmentGuidance,
    parseAiPolicy,
    AIAS_POLICY
} from '@/lib/ai-policies';
import type { InstitutionalAiPolicy } from '@/lib/institution-config';
import {
    getVisibleFaqItems,
    hasFaqContent,
    parseFaqItems
} from '@/lib/faq';
import {
    getSubmissionFieldValue,
    type SubmissionFormValues
} from '@/lib/submission-form-storage';

// Register Geist Sans font to match web version
// Using local font files from public/fonts folder
// React-pdf supports TTF and WOFF formats
Font.register({
    family: 'Geist',
    fonts: [
        {
            src: '/fonts/Geist/ttf/Geist-Thin.ttf',
            fontWeight: 100 // thin
        },
        {
            src: '/fonts/Geist/ttf/Geist-ExtraLight.ttf',
            fontWeight: 200 // ultralight
        },
        {
            src: '/fonts/Geist/ttf/Geist-Light.ttf',
            fontWeight: 300 // light
        },
        {
            src: '/fonts/Geist/ttf/Geist-Regular.ttf',
            fontWeight: 400 // normal
        },
        {
            src: '/fonts/Geist/ttf/Geist-Medium.ttf',
            fontWeight: 500 // medium
        },
        {
            src: '/fonts/Geist/ttf/Geist-SemiBold.ttf',
            fontWeight: 600 // semibold
        },
        {
            src: '/fonts/Geist/ttf/Geist-Bold.ttf',
            fontWeight: 700 // bold
        }
    ]
});

// PDF page + card: white page, border token, foreground
const PDF_BORDER = '#e5e7eb';
const PDF_PAGE_BG = '#ffffff';
/** Insets on every page when content flows across page breaks. */
const PDF_PAGE_TOP_MARGIN = 36;
const PDF_PAGE_BOTTOM_MARGIN = 36;
/** Page body inset (was 32). */
const PDF_DOCUMENT_PAD = 18;
/** Padding inside bordered cells / form boxes (was 16). */
const PDF_BOX_PAD = 8;
/** Rubric table cell padding (was 12). */
const PDF_RUBRIC_PAD = 6;
const PDF_MUTED = '#737373';
const PDF_FOREGROUND = '#171717';
/** Between major title / section blocks. */
const PDF_TITLE_BLOCK_GAP = 14;
const PDF_SECTION_DIVIDER_GAP = 20;
const PDF_BELOW_METADATA = 20;
const PDF_RUBRIC_CRITERION_GAP = 20;
/** Two-column sections: narrow label / wide content (metadata, project details, one-page summary). */
const PDF_COL_LABEL = '30%';
const PDF_COL_CONTENT = '70%';
/**
 * Hints the layout engine not to end a page between a heading and the start of
 * the following content (see react-pdf `minPresenceAhead`, in points).
 */
const PDF_HEADING_MIN_PRESENCE_AHEAD = 120;
/** No mid-word breaks in narrow label columns (react-pdf: whole words wrap to the next line). */
const PDF_LABEL_TEXT_PROPS = {
    hyphenationCallback: (word: string) => [word]
} as const;

// PDF Styles
const pdfStyles = StyleSheet.create({
    page: {
        paddingTop: PDF_PAGE_TOP_MARGIN,
        paddingLeft: 0,
        paddingRight: 0,
        paddingBottom: PDF_PAGE_BOTTOM_MARGIN,
        fontSize: 13,
        fontFamily: 'Geist',
        backgroundColor: PDF_PAGE_BG
    },
    documentCard: {
        width: '100%',
        backgroundColor: '#ffffff',
        padding: PDF_DOCUMENT_PAD
    },
    title: {
        fontSize: 29,
        marginBottom: PDF_TITLE_BLOCK_GAP,
        fontWeight: '200',
        letterSpacing: -0.5,
        color: PDF_FOREGROUND
    },
    sectionTitle: {
        fontSize: 24,
        marginTop: 0,
        marginBottom: PDF_TITLE_BLOCK_GAP,
        fontWeight: '200',
        letterSpacing: -0.4,
        color: PDF_FOREGROUND
    },
    textMuted: {
        fontSize: 13,
        lineHeight: 1.35,
        fontWeight: 'light',
        color: PDF_MUTED
    },
    metadataRow: {
        flexDirection: 'row',
        borderBottom: `1 solid ${PDF_BORDER}`
    },
    metadataLabel: {
        width: PDF_COL_LABEL,
        fontWeight: 'normal',
        padding: PDF_BOX_PAD,
        borderRight: `1 solid ${PDF_BORDER}`
    },
    metadataValue: {
        width: PDF_COL_CONTENT,
        fontWeight: 'light',
        padding: PDF_BOX_PAD
    },
    gridRow: {
        flexDirection: 'row',
        borderBottom: `1 solid ${PDF_BORDER}`
    },
    gridLabel: {
        width: PDF_COL_LABEL,
        padding: PDF_BOX_PAD,
        borderRight: `1 solid ${PDF_BORDER}`,
        borderBottom: `1 solid ${PDF_BORDER}`,
        fontWeight: 'normal'
    },
    gridContent: {
        width: PDF_COL_CONTENT,
        padding: PDF_BOX_PAD,
        borderBottom: `1 solid ${PDF_BORDER}`
    },
    text: {
        marginBottom: 0,
        lineHeight: 1.4,
        fontWeight: 'light',
        color: PDF_FOREGROUND
    },
    learningOutcome: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottom: `1 solid ${PDF_BORDER}`,
        paddingVertical: PDF_BOX_PAD,
        paddingLeft: PDF_BOX_PAD,
        gap: 8
    },
    learningOutcomeNumber: {
        fontSize: 29,
        fontWeight: '100',
        marginRight: 0
    },
    learningOutcomeText: {
        flex: 1,
        fontWeight: 'light',
        fontSize: 13
    },
    learningOutcomeWeight: {
        minWidth: 60,
        alignItems: 'center',
        justifyContent: 'center',
        borderLeft: `1 solid ${PDF_BORDER}`,
        padding: PDF_BOX_PAD
    },
    rubricTable: {
        marginTop: 4,
        border: `1 solid ${PDF_BORDER}`
    },
    rubricHeader: {
        flexDirection: 'row',
        borderBottom: `1 solid ${PDF_BORDER}`,
        backgroundColor: '#ffffff'
    },
    rubricHeaderCell: {
        paddingHorizontal: PDF_RUBRIC_PAD,
        paddingVertical: PDF_RUBRIC_PAD,
        borderRight: `1 solid ${PDF_BORDER}`,
        borderBottom: `1 solid ${PDF_BORDER}`,
        fontWeight: '200',
        fontSize: 19
    },
    rubricRow: {
        flexDirection: 'row',
        borderBottom: `1 solid ${PDF_BORDER}`
    },
    rubricCell: {
        paddingHorizontal: PDF_RUBRIC_PAD,
        paddingVertical: PDF_RUBRIC_PAD,
        borderRight: `1 solid ${PDF_BORDER}`,
        fontSize: 13,
        fontWeight: 'light'
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8 // gap between checkbox and text
    },
    checkbox: {
        width: 12,
        height: 12,
        border: `1 solid ${PDF_FOREGROUND}`,
        marginRight: 8,
        marginTop: 2
    },
    formField: {
        marginBottom: 10,
        paddingBottom: 10,
        borderBottom: `1 solid ${PDF_BORDER}`
    },
    formLabel: {
        fontWeight: 'normal', // font-normal
        marginBottom: 6
    }
});

function renderPlainTextWithPdfLinks(
    text: string,
    keyCounter: { value: number }
): (string | React.ReactElement)[] {
    const parts: (string | React.ReactElement)[] = [];

    for (const piece of splitTextByBareUrls(text)) {
        if (piece.kind === 'text') {
            if (piece.value) parts.push(piece.value);
            continue;
        }

        parts.push(
            <Link
                key={`url-${keyCounter.value++}`}
                src={piece.href}
                style={{ color: '#0000EE', textDecoration: 'underline' }}>
                {piece.display}
            </Link>
        );
    }

    return parts;
}

// Helper function to parse markdown links and bare URLs for PDF output
const parseContentWithLinks = (
    text: unknown
): string | (string | React.ReactElement)[] => {
    if (text == null) return '';
    const richTextValue = richTextToPlainText(text);
    const str =
        typeof text === 'string' || richTextValue
            ? replaceIso8601InTextWithIrishLocale(
                  typeof text === 'string' ? text : richTextValue
              )
            : typeof text === 'number' || typeof text === 'boolean'
              ? String(text)
              : '';
    if (str === '') return '';

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;
    const keyCounter = { value: 0 };

    while ((match = linkRegex.exec(str)) !== null) {
        if (match.index > lastIndex) {
            parts.push(
                ...renderPlainTextWithPdfLinks(
                    str.substring(lastIndex, match.index),
                    keyCounter
                )
            );
        }

        const linkText = match[1];
        const url = match[2];
        parts.push(
            <Link
                key={`link-${keyCounter.value++}`}
                src={url}
                style={{ color: '#0000EE', textDecoration: 'underline' }}>
                {linkText}
            </Link>
        );

        lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < str.length) {
        parts.push(
            ...renderPlainTextWithPdfLinks(str.substring(lastIndex), keyCounter)
        );
    }

    if (parts.length === 0) {
        const linkified = renderPlainTextWithPdfLinks(str, keyCounter);
        return linkified.length > 0 ? linkified : str;
    }

    return parts;
};

type RubricCriterionPDF = {
    criterion: string;
    assessedThrough: string;
    weighting: string;
    learningOutcomes: number[];
    gradeDescriptors: Array<{
        grade: string;
        description: string;
    }>;
};

function PdfSectionStart({
    title,
    children,
    breakWithContent = true
}: {
    title: string;
    children: React.ReactNode;
    breakWithContent?: boolean;
}) {
    const titleNode = <Text style={pdfStyles.sectionTitle}>{title}</Text>;
    if (!breakWithContent) {
        return (
            <View>
                {titleNode}
                {children}
            </View>
        );
    }
    return (
        <View wrap={false}>
            {titleNode}
            {children}
        </View>
    );
}

function pdfRowWrapProps(unbreakable: boolean): { wrap?: false } {
    return unbreakable ? { wrap: false } : {};
}

/** One bordered rubric table (a single criterion and its grade rows). */
function RubricCriterionBox({
    criterion,
    unbreakable = true
}: {
    criterion: RubricCriterionPDF;
    unbreakable?: boolean;
}) {
    return (
        <View
            {...pdfRowWrapProps(unbreakable)}
            style={{
                marginBottom: PDF_RUBRIC_CRITERION_GAP,
                border: `1 solid ${PDF_BORDER}`
            }}>
            <View style={pdfStyles.rubricHeader}>
                <View
                    style={[
                        pdfStyles.rubricHeaderCell,
                        { flex: 2 } // 2fr
                    ]}>
                    <Text {...PDF_LABEL_TEXT_PROPS}>Criteria</Text>
                </View>
                <View
                    style={[
                        pdfStyles.rubricHeaderCell,
                        { flex: 2.3 } // 2.3fr
                    ]}>
                    <Text>Assessed Through</Text>
                </View>
                <View
                    style={[
                        pdfStyles.rubricHeaderCell,
                        { flex: 1.3 } // 1.3fr
                    ]}>
                    <Text>Weighting</Text>
                </View>
            </View>
            <View style={pdfStyles.rubricRow}>
                <View style={[pdfStyles.rubricCell, { flex: 2 }]}>
                    <Text {...PDF_LABEL_TEXT_PROPS}>
                        {criterion.criterion}
                    </Text>
                    <Text
                        style={{
                            fontWeight: 'extralight',
                            fontSize: 11,
                            marginTop: 5
                        }}
                        {...PDF_LABEL_TEXT_PROPS}>
                        {criterion.learningOutcomes
                            .map((lo) => `LO${lo + 1}`)
                            .join(', ')}
                    </Text>
                </View>
                <View style={[pdfStyles.rubricCell, { flex: 2.3 }]}>
                    <Text>{criterion.assessedThrough}</Text>
                </View>
                <View style={[pdfStyles.rubricCell, { flex: 1.3 }]}>
                    <Text>{criterion.weighting}</Text>
                </View>
            </View>
            {criterion.gradeDescriptors.map(
                (
                    gd: {
                        grade: string;
                        description: string;
                    },
                    gIdx: number
                ) => (
                    <View key={gIdx} style={pdfStyles.rubricRow}>
                        <View
                            style={[
                                pdfStyles.rubricCell,
                                { flex: 0.8 }
                            ]}>
                            <Text
                                style={{
                                    fontWeight: 'normal'
                                }}
                                {...PDF_LABEL_TEXT_PROPS}>
                                {gd.grade}
                            </Text>
                        </View>
                        <View
                            style={[
                                pdfStyles.rubricCell,
                                {
                                    flex: 3,
                                    borderRight: 'none'
                                }
                            ]}>
                            <Text style={pdfStyles.text}>
                                {parseContentWithLinks(gd.description)}
                            </Text>
                        </View>
                    </View>
                )
            )}
        </View>
    );
}

// PDF Document Component
interface BriefPDFDocumentProps {
    metadata: BriefMetadata;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    sections: BriefSection[];
    templateKey?: string;
    institutionalAiPolicy?: InstitutionalAiPolicy;
    aiPolicyDocument?: {
        url: string;
        fileName: string;
    } | null;
}

const BriefPDFDocument = ({
    metadata,
    content,
    sections,
    templateKey = 'default',
    institutionalAiPolicy,
    aiPolicyDocument = null
}: BriefPDFDocumentProps) => {
    const formatDate = (date: Date) => {
        try {
            return format(new Date(date), 'do MMMM yyyy');
        } catch {
            return 'Not set';
        }
    };

    const enabledSections = sections
        .filter((section) => isBriefSectionEnabled(section))
        .sort((a, b) => a.order - b.order);

    const pdfSections = enabledSections.filter(
        (section) => section.id !== 'example-feedback'
    );
    const institutionalPolicy =
        institutionalAiPolicy ?? { label: '', url: '' };

    const renderPDFSectionContent = (sectionId: string) => {
        if (!content) return null;

        switch (sectionId) {
            case 'project-details': {
                const hiddenProjectDetailSubsections =
                    content?.hiddenProjectDetailSubsections;
                const hasOverview =
                    content?.subheadings?.['project-overview-content'];
                const hasLearningOutcomes =
                    isProjectDetailSubsectionVisible(
                        'learning-outcomes',
                        hiddenProjectDetailSubsections
                    ) &&
                    content?.learningOutcomes &&
                    content.learningOutcomes.length > 0;
                const hasKeyExpectations =
                    isProjectDetailSubsectionVisible(
                        'key-expectations',
                        hiddenProjectDetailSubsections
                    ) && content?.subheadings?.['key-expectations'];
                const hasDeliverables =
                    isProjectDetailSubsectionVisible(
                        'deliverables',
                        hiddenProjectDetailSubsections
                    ) &&
                    content?.deliverables &&
                    content.deliverables.length > 0;
                const hasResources =
                    isProjectDetailSubsectionVisible(
                        'resources',
                        hiddenProjectDetailSubsections
                    ) &&
                    content?.resources &&
                    content.resources.length > 0;
                const { subsections: normalizedCustomSubsections } =
                    normalizeCustomSubsections(
                        content?.customSubsections,
                        content?.hiddenCustomSubsectionIds
                    );
                const visibleProjectDetailBlockIds =
                    getVisibleProjectDetailBlockIds(
                        normalizeProjectDetailBlockOrder(
                            content?.projectDetailBlockOrder,
                            normalizedCustomSubsections
                        ),
                        hiddenProjectDetailSubsections,
                        content?.hiddenCustomSubsectionIds
                    );
                const hasVisibleCustomSubsections =
                    getVisibleCustomSubsections(
                        normalizedCustomSubsections,
                        content?.hiddenCustomSubsectionIds
                    ).some(
                        (subsection) =>
                            Boolean(subsection.title?.trim()) ||
                            Boolean(
                                typeof subsection.content === 'string'
                                    ? subsection.content.trim()
                                    : richTextToPlainText(subsection.content)
                            ) ||
                            (subsection.type === 'accordion' &&
                                subsection.items?.some(
                                    (item) =>
                                        item.title?.trim() ||
                                        richTextToPlainText(item.content)
                                ))
                    );

                if (
                    !hasOverview &&
                    !hasLearningOutcomes &&
                    !hasKeyExpectations &&
                    !hasDeliverables &&
                    !hasResources &&
                    !hasVisibleCustomSubsections
                ) {
                    return (
                        <PdfSectionStart title='Project Details'>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    );
                }

                const projectDetailRowNodes: React.ReactElement[] = [];
                visibleProjectDetailBlockIds.forEach((blockId) => {
                    const rowUnbreakable = projectDetailRowNodes.length > 0;
                                if (
                                    blockId === 'project-overview-content' &&
                                    hasOverview
                                ) {
                                    projectDetailRowNodes.push(
                                <View
                                    key={blockId}
                                    {...pdfRowWrapProps(rowUnbreakable)}
                                    style={pdfStyles.gridRow}>
                                    <View style={pdfStyles.gridLabel}>
                                        <Text {...PDF_LABEL_TEXT_PROPS}>
                                            Project Overview
                                        </Text>
                                    </View>
                                    <View style={pdfStyles.gridContent}>
                                        <Text style={pdfStyles.text}>
                                            {parseContentWithLinks(
                                                content.subheadings[
                                                    'project-overview-content'
                                                ]
                                            )}
                                        </Text>
                                    </View>
                                </View>
                                    );
                                }

                                if (
                                    blockId === 'learning-outcomes' &&
                                    hasLearningOutcomes
                                ) {
                                    projectDetailRowNodes.push(
                                    <View
                                        key={blockId}
                                        {...pdfRowWrapProps(rowUnbreakable)}
                                        style={pdfStyles.gridRow}>
                                        <View style={pdfStyles.gridLabel}>
                                            <Text {...PDF_LABEL_TEXT_PROPS}>
                                                Learning Outcomes Assessed
                                            </Text>
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    marginTop: 5,
                                                    fontWeight: 'light',
                                                    color: PDF_MUTED
                                                }}
                                                {...PDF_LABEL_TEXT_PROPS}>
                                                (See Rubric Below)↓
                                            </Text>
                                        </View>
                                        <View style={{ width: PDF_COL_CONTENT }}>
                                            {content.learningOutcomes.map(
                                                (
                                                    lo: {
                                                        title: string;
                                                        weighting: number;
                                                    },
                                                    idx: number
                                                ) => (
                                                    <View
                                                        key={idx}
                                                        wrap={false}
                                                        style={[
                                                            pdfStyles.learningOutcome,
                                                            lo.weighting > 0
                                                                ? {
                                                                      flexDirection:
                                                                          'row'
                                                                  }
                                                                : {}
                                                        ]}>
                                                        <Text
                                                            style={
                                                                pdfStyles.learningOutcomeNumber
                                                            }>
                                                            {String.fromCharCode(
                                                                0x245f + idx + 1
                                                            )}
                                                        </Text>
                                                        <Text
                                                            style={
                                                                pdfStyles.learningOutcomeText
                                                            }>
                                                            {lo.title}
                                                        </Text>
                                                        {lo.weighting > 0 && (
                                                            <View
                                                                style={
                                                                    pdfStyles.learningOutcomeWeight
                                                                }>
                                                                <Text
                                                                    style={{
                                                                        fontSize: 16,
                                                                        fontWeight:
                                                                            'ultralight',
                                                                        textAlign:
                                                                            'center'
                                                                    }}>
                                                                    {
                                                                        lo.weighting
                                                                    }
                                                                    %
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                )
                                            )}
                                        </View>
                                    </View>
                                    );
                                }

                                if (
                                    blockId === 'key-expectations' &&
                                    hasKeyExpectations
                                ) {
                                    projectDetailRowNodes.push(
                                <View
                                    key={blockId}
                                    {...pdfRowWrapProps(rowUnbreakable)}
                                    style={pdfStyles.gridRow}>
                                    <View style={pdfStyles.gridLabel}>
                                        <Text {...PDF_LABEL_TEXT_PROPS}>
                                            Key Expectations
                                        </Text>
                                        {content.subheadings?.[
                                            'key-expectations'
                                        ] && (
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    marginTop: 5,
                                                    fontWeight: 'light'
                                                }}
                                                {...PDF_LABEL_TEXT_PROPS}>
                                                {parseContentWithLinks(
                                                    content.subheadings[
                                                        'key-expectations'
                                                    ]
                                                )}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={pdfStyles.gridContent}>
                                        {content.keyExpectations?.map(
                                            (
                                                expectation: {
                                                    title: string;
                                                    description: string;
                                                },
                                                idx: number
                                            ) => (
                                                <View
                                                    key={idx}
                                                    wrap={false}
                                                    style={{
                                                        marginBottom: 6
                                                    }}>
                                                    <Text
                                                        style={{
                                                            fontWeight:
                                                                'normal',
                                                            marginBottom: 4
                                                        }}>
                                                        {expectation.title}
                                                    </Text>
                                                    <Text
                                                        style={pdfStyles.text}>
                                                        {parseContentWithLinks(
                                                            expectation.description
                                                        )}
                                                    </Text>
                                                </View>
                                            )
                                        )}
                                    </View>
                                </View>
                                    );
                                }

                                if (
                                    blockId === 'deliverables' &&
                                    hasDeliverables
                                ) {
                                    projectDetailRowNodes.push(
                                <View
                                    key={blockId}
                                    {...pdfRowWrapProps(rowUnbreakable)}
                                    style={pdfStyles.gridRow}>
                                    <View style={pdfStyles.gridLabel}>
                                        <Text {...PDF_LABEL_TEXT_PROPS}>
                                            Deliverables
                                        </Text>
                                        {content.subheadings?.[
                                            'deliverables'
                                        ] && (
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    marginTop: 5,
                                                    fontWeight: 'light'
                                                }}
                                                {...PDF_LABEL_TEXT_PROPS}>
                                                {parseContentWithLinks(
                                                    content.subheadings[
                                                        'deliverables'
                                                    ]
                                                )}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={pdfStyles.gridContent}>
                                        {content.deliverables.map(
                                            (
                                                deliverable: {
                                                    title: string;
                                                    description: string;
                                                },
                                                idx: number
                                            ) => (
                                                <View
                                                    key={idx}
                                                    wrap={false}
                                                    style={{
                                                        marginBottom: 6
                                                    }}>
                                                    <Text
                                                        style={{
                                                            fontWeight:
                                                                'normal',
                                                            marginBottom: 4
                                                        }}>
                                                        {deliverable.title}
                                                    </Text>
                                                    <Text
                                                        style={pdfStyles.text}>
                                                        {parseContentWithLinks(
                                                            deliverable.description
                                                        )}
                                                    </Text>
                                                </View>
                                            )
                                        )}
                                    </View>
                                </View>
                                    );
                                }

                                if (blockId === 'resources' && hasResources) {
                                    projectDetailRowNodes.push(
                                <View
                                    key={blockId}
                                    {...pdfRowWrapProps(rowUnbreakable)}
                                    style={pdfStyles.gridRow}>
                                    <View style={pdfStyles.gridLabel}>
                                        <Text {...PDF_LABEL_TEXT_PROPS}>
                                            Resources
                                        </Text>
                                        {content.subheadings?.['resources'] && (
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    marginTop: 5,
                                                    fontWeight: 'light'
                                                }}
                                                {...PDF_LABEL_TEXT_PROPS}>
                                                {parseContentWithLinks(
                                                    content.subheadings[
                                                        'resources'
                                                    ]
                                                )}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={pdfStyles.gridContent}>
                                        {content.resources.map(
                                            (
                                                resource: {
                                                    title: string;
                                                    description: string;
                                                },
                                                idx: number
                                            ) => (
                                                <View
                                                    key={idx}
                                                    wrap={false}
                                                    style={{
                                                        marginBottom: 6
                                                    }}>
                                                    <Text
                                                        style={{
                                                            fontWeight:
                                                                'normal',
                                                            marginBottom: 4
                                                        }}>
                                                        {resource.title}
                                                    </Text>
                                                    <Text
                                                        style={pdfStyles.text}>
                                                        {parseContentWithLinks(
                                                            resource.description
                                                        )}
                                                    </Text>
                                                </View>
                                            )
                                        )}
                                    </View>
                                </View>
                                    );
                                }

                                const customId =
                                    parseCustomSubsectionBlockId(blockId);
                                if (customId) {
                                    const subsection =
                                        normalizedCustomSubsections.find(
                                            (entry) => entry.id === customId
                                        );
                                    if (!subsection) return;

                                    if (subsection.type === 'accordion') {
                                        projectDetailRowNodes.push(
                                            <View
                                                key={blockId}
                                                {...pdfRowWrapProps(rowUnbreakable)}
                                                style={pdfStyles.gridRow}>
                                                <View style={pdfStyles.gridLabel}>
                                                    <Text {...PDF_LABEL_TEXT_PROPS}>
                                                        {subsection.title}
                                                    </Text>
                                                    {subsection.subheading ? (
                                                        <Text
                                                            style={{
                                                                fontSize: 11,
                                                                marginTop: 5,
                                                                fontWeight:
                                                                    'light'
                                                            }}
                                                            {...PDF_LABEL_TEXT_PROPS}>
                                                            {parseContentWithLinks(
                                                                subsection.subheading
                                                            )}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                <View style={pdfStyles.gridContent}>
                                                    {(subsection.items || []).map(
                                                        (item, idx) => (
                                                            <View
                                                                key={idx}
                                                                wrap={false}
                                                                style={{
                                                                    marginBottom: 6
                                                                }}>
                                                                <Text
                                                                    style={{
                                                                        fontWeight:
                                                                            'normal',
                                                                        marginBottom: 4
                                                                    }}>
                                                                    {item.title}
                                                                </Text>
                                                                <Text
                                                                    style={
                                                                        pdfStyles.text
                                                                    }>
                                                                    {parseContentWithLinks(
                                                                        item.content
                                                                    )}
                                                                </Text>
                                                            </View>
                                                        )
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    }

                                    projectDetailRowNodes.push(
                                        <View
                                            key={blockId}
                                            {...pdfRowWrapProps(rowUnbreakable)}
                                            style={pdfStyles.gridRow}>
                                            <View style={pdfStyles.gridLabel}>
                                                <Text {...PDF_LABEL_TEXT_PROPS}>
                                                    {subsection.title}
                                                </Text>
                                                {subsection.subheading ? (
                                                    <Text
                                                        style={{
                                                            fontSize: 11,
                                                            marginTop: 5,
                                                            fontWeight: 'light'
                                                        }}
                                                        {...PDF_LABEL_TEXT_PROPS}>
                                                        {parseContentWithLinks(
                                                            subsection.subheading
                                                        )}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            <View style={pdfStyles.gridContent}>
                                                <Text style={pdfStyles.text}>
                                                    {parseContentWithLinks(
                                                        subsection.content
                                                    )}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                }
                });

                const [firstProjectRow, ...restProjectRows] =
                    projectDetailRowNodes;

                return (
                    <View>
                        <PdfSectionStart title='Project Details'>
                            <View style={{ border: `1 solid ${PDF_BORDER}` }}>
                                {firstProjectRow}
                            </View>
                        </PdfSectionStart>
                        {restProjectRows.length > 0 ? (
                            <View
                                style={{
                                    borderLeft: `1 solid ${PDF_BORDER}`,
                                    borderRight: `1 solid ${PDF_BORDER}`,
                                    borderBottom: `1 solid ${PDF_BORDER}`
                                }}>
                                {restProjectRows}
                            </View>
                        ) : null}
                    </View>
                );
            }

            case 'rubric': {
                if (
                    !content.rubricCriteria ||
                    content.rubricCriteria.length === 0
                ) {
                    return (
                        <PdfSectionStart title='Rubric'>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    );
                }

                const criteria = content.rubricCriteria as RubricCriterionPDF[];
                const [firstCriterion, ...restCriteria] = criteria;

                return (
                    <View>
                        <PdfSectionStart title='Rubric'>
                            <RubricCriterionBox
                                criterion={firstCriterion}
                                unbreakable={false}
                            />
                        </PdfSectionStart>
                        {restCriteria.map((criterion, i) => (
                            <RubricCriterionBox
                                key={`rubric-criterion-${i + 1}`}
                                criterion={criterion}
                            />
                        ))}
                    </View>
                );
            }

            case 'one-page-summary': {
                if (
                    !content.onePageSummaryContent ||
                    Object.keys(content.onePageSummaryContent).length === 0
                ) {
                    return (
                        <PdfSectionStart title='One Page Summary'>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    );
                }

                const summaryEntries = Object.entries(
                    content.onePageSummaryContent
                );
                const [firstEntry, ...restEntries] = summaryEntries;

                const renderSummaryRow = (
                    [key, value]: [string, unknown],
                    unbreakable: boolean
                ) => (
                    <View
                        key={key}
                        {...pdfRowWrapProps(unbreakable)}
                        style={pdfStyles.gridRow}>
                        <View style={pdfStyles.gridLabel}>
                            <Text {...PDF_LABEL_TEXT_PROPS}>{key}</Text>
                        </View>
                        <View style={pdfStyles.gridContent}>
                            <Text style={pdfStyles.text}>
                                {parseContentWithLinks(value as string)}
                            </Text>
                        </View>
                    </View>
                );

                return (
                    <View>
                        <PdfSectionStart title='One Page Summary'>
                            <View style={{ border: `1 solid ${PDF_BORDER}` }}>
                                {renderSummaryRow(firstEntry, false)}
                            </View>
                        </PdfSectionStart>
                        {restEntries.length > 0 ? (
                            <View
                                style={{
                                    borderLeft: `1 solid ${PDF_BORDER}`,
                                    borderRight: `1 solid ${PDF_BORDER}`,
                                    borderBottom: `1 solid ${PDF_BORDER}`
                                }}>
                                {restEntries.map((entry) =>
                                    renderSummaryRow(entry, true)
                                )}
                            </View>
                        ) : null}
                    </View>
                );
            }

            case 'schedule': {
                const schedulePhases = Array.isArray(content.schedulePhases)
                    ? content.schedulePhases
                    : [];
                const scheduleViews = content.scheduleViews || {
                    table: true,
                    gantt: false
                };
                if (!schedulePhases.length) {
                    return (
                        <PdfSectionStart title='Schedule'>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    );
                }

                const renderSchedulePhase = (
                    phase: {
                        title?: string;
                        timingMode?: 'date' | 'weeks';
                        startDate?: string;
                        endDate?: string;
                        weekStart?: number;
                        weekEnd?: number;
                        instructions?: string;
                    },
                    idx: number,
                    total: number
                ) => {
                    const timingLabel =
                        phase.timingMode === 'weeks'
                            ? `Weeks ${phase.weekStart || 1}-${phase.weekEnd || 1}`
                            : `${phase.startDate ? formatDate(new Date(phase.startDate)) : 'Start TBD'} - ${phase.endDate ? formatDate(new Date(phase.endDate)) : 'End TBD'}`;
                    const isLastRow = idx >= total - 1;
                    const labelCellStyle = isLastRow
                        ? {
                              ...pdfStyles.gridLabel,
                              borderBottom: 'none' as const
                          }
                        : pdfStyles.gridLabel;
                    const contentCellStyle = isLastRow
                        ? {
                              ...pdfStyles.gridContent,
                              borderBottom: 'none' as const
                          }
                        : pdfStyles.gridContent;

                    return (
                        <View key={idx} style={pdfStyles.gridRow}>
                            <View
                                style={{
                                    ...labelCellStyle,
                                    flexDirection: 'column'
                                }}>
                                <Text
                                    style={{ fontWeight: 'normal' }}
                                    {...PDF_LABEL_TEXT_PROPS}>
                                    {phase.title || `Phase ${idx + 1}`}
                                </Text>
                                <Text
                                    style={{
                                        marginTop: 4,
                                        fontSize: 11,
                                        lineHeight: 1.35,
                                        color: PDF_MUTED,
                                        fontWeight: 'light'
                                    }}>
                                    {timingLabel}
                                </Text>
                            </View>
                            <View style={contentCellStyle}>
                                <Text style={pdfStyles.text}>
                                    {parseContentWithLinks(
                                        phase.instructions || ''
                                    )}
                                </Text>
                            </View>
                        </View>
                    );
                };

                return (
                    <View>
                        {scheduleViews.table !== false ? (
                            <>
                                <Text
                                    style={pdfStyles.sectionTitle}
                                    minPresenceAhead={
                                        PDF_HEADING_MIN_PRESENCE_AHEAD
                                    }>
                                    Schedule
                                </Text>
                                <View
                                    style={{
                                        border: `1 solid ${PDF_BORDER}`
                                    }}>
                                    {schedulePhases.map(
                                        (
                                            phase: (typeof schedulePhases)[number],
                                            idx: number
                                        ) =>
                                            renderSchedulePhase(
                                                phase,
                                                idx,
                                                schedulePhases.length
                                            )
                                    )}
                                </View>
                            </>
                        ) : (
                            <PdfSectionStart title='Schedule'>
                                <Text style={pdfStyles.textMuted}>
                                    Schedule table is hidden for this brief.
                                </Text>
                            </PdfSectionStart>
                        )}
                    </View>
                );
            }

            case 'submission-form': {
                if (
                    !content.submissionFormFields ||
                    content.submissionFormFields.length === 0
                ) {
                    return (
                        <PdfSectionStart title='Submission Form'>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    );
                }

                const formFields = content.submissionFormFields as Array<{
                    title: string;
                    description?: string;
                    placeholder?: string;
                    optionalDescription?: string;
                }>;
                const [firstFormField, ...restFormFields] = formFields;

                const renderBriefFormField = (
                    field: {
                        title: string;
                        description?: string;
                        placeholder?: string;
                        optionalDescription?: string;
                    },
                    idx: number,
                    unbreakable: boolean
                ) => {
                    const isDeclarationField =
                        field.title.trim().toLowerCase() === 'declaration';
                    const placeholderText =
                        field.placeholder || field.description || '';
                    const helperDescription = (
                        field.optionalDescription || ''
                    ).replaceAll(
                        '[INSERT_PROGRAMME]',
                        metadata.programmeName || 'the programme'
                    );
                    const breakWithContent =
                        isDeclarationField &&
                        helperDescription.length > 1200;
                    const fieldNode = (
                        <View
                            key={idx}
                            {...pdfRowWrapProps(unbreakable)}
                            style={pdfStyles.formField}>
                            <Text style={pdfStyles.formLabel}>{field.title}</Text>
                            {helperDescription ? (
                                <Text
                                    style={{
                                        fontSize: 10,
                                        lineHeight: 1.3,
                                        marginBottom: 8,
                                        color: '#666',
                                        fontWeight: 'light'
                                    }}>
                                    {parseContentWithLinks(helperDescription)}
                                </Text>
                            ) : null}
                            {isDeclarationField ? (
                                <Text
                                    style={{
                                        fontSize: 10,
                                        color: '#888',
                                        fontWeight: 'light'
                                    }}>
                                    Signed: ____________________
                                </Text>
                            ) : (
                                <Text
                                    style={{
                                        fontSize: 10,
                                        color: '#888',
                                        fontWeight: 'light'
                                    }}>
                                    {placeholderText}: ____________________
                                </Text>
                            )}
                        </View>
                    );
                    if (idx === 0) {
                        return (
                            <PdfSectionStart
                                title='Submission Form'
                                breakWithContent={!breakWithContent}>
                                <View
                                    style={{
                                        border: `1 solid ${PDF_BORDER}`,
                                        padding: PDF_BOX_PAD
                                    }}>
                                    {fieldNode}
                                </View>
                            </PdfSectionStart>
                        );
                    }
                    return fieldNode;
                };

                return (
                    <View>
                        {renderBriefFormField(firstFormField, 0, false)}
                        {restFormFields.length > 0 ? (
                            <View
                                style={{
                                    borderLeft: `1 solid ${PDF_BORDER}`,
                                    borderRight: `1 solid ${PDF_BORDER}`,
                                    borderBottom: `1 solid ${PDF_BORDER}`,
                                    padding: PDF_BOX_PAD
                                }}>
                                {restFormFields.map((field, idx) =>
                                    renderBriefFormField(
                                        field,
                                        idx + 1,
                                        true
                                    )
                                )}
                            </View>
                        ) : null}
                    </View>
                );
            }

            case 'submission-checklist': {
                if (
                    !content.checklistItems ||
                    content.checklistItems.length === 0
                ) {
                    return (
                        <PdfSectionStart title='Submission Checklist'>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    );
                }

                const checklistItems = content.checklistItems as string[];
                const [firstChecklistItem, ...restChecklistItems] =
                    checklistItems;

                const renderChecklistRow = (
                    item: string,
                    idx: number,
                    total: number,
                    unbreakable: boolean
                ) => (
                    <View
                        key={idx}
                        {...pdfRowWrapProps(unbreakable)}
                        style={[
                            pdfStyles.checklistItem,
                            {
                                borderBottom:
                                    idx < total - 1
                                        ? `1 dashed ${PDF_BORDER}`
                                        : 'none',
                                paddingBottom: 6
                            }
                        ]}>
                        <View style={pdfStyles.checkbox} />
                        <Text
                            style={{
                                flex: 1,
                                fontWeight: 'light',
                                fontSize: 13
                            }}>
                            {item}
                        </Text>
                    </View>
                );

                return (
                    <View>
                        <PdfSectionStart title='Submission Checklist'>
                            <View
                                style={{
                                    border: `1 solid ${PDF_BORDER}`,
                                    padding: PDF_BOX_PAD
                                }}>
                                {renderChecklistRow(
                                    firstChecklistItem,
                                    0,
                                    checklistItems.length,
                                    false
                                )}
                            </View>
                        </PdfSectionStart>
                        {restChecklistItems.length > 0 ? (
                            <View
                                style={{
                                    borderLeft: `1 solid ${PDF_BORDER}`,
                                    borderRight: `1 solid ${PDF_BORDER}`,
                                    borderBottom: `1 solid ${PDF_BORDER}`,
                                    padding: PDF_BOX_PAD
                                }}>
                                {restChecklistItems.map((item, idx) =>
                                    renderChecklistRow(
                                        item,
                                        idx + 1,
                                        checklistItems.length,
                                        true
                                    )
                                )}
                            </View>
                        ) : null}
                    </View>
                );
            }

            case 'how-work-is-marked': {
                const sectionTitle = 'How Work is Marked';
                const items = content.howWorkMarked;
                if (
                    !Array.isArray(items) ||
                    items.length === 0 ||
                    !items.some(
                        (row: { title?: string; description?: string }) =>
                            (row.title && row.title.trim() !== '') ||
                            (row.description && row.description.trim() !== '')
                    )
                ) {
                    return (
                        <PdfSectionStart title={sectionTitle}>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    );
                }

                const markedItems = items as Array<{
                    title: string;
                    description: string;
                }>;
                const [firstMarkedItem, ...restMarkedItems] = markedItems;

                const renderMarkedRow = (
                    item: { title: string; description: string },
                    idx: number,
                    total: number
                ) => (
                    <View
                        key={idx}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            borderBottom:
                                idx < total - 1
                                    ? `1 solid ${PDF_BORDER}`
                                    : 'none'
                        }}>
                        <View
                            style={{
                                width: PDF_COL_LABEL,
                                padding: PDF_BOX_PAD,
                                borderRight: `1 solid ${PDF_BORDER}`
                            }}>
                            <Text
                                style={{ fontWeight: 'normal' }}
                                {...PDF_LABEL_TEXT_PROPS}>
                                {item.title || ''}
                            </Text>
                        </View>
                        <View
                            style={{
                                width: PDF_COL_CONTENT,
                                padding: PDF_BOX_PAD
                            }}>
                            <Text style={pdfStyles.text}>
                                {parseContentWithLinks(item.description || '')}
                            </Text>
                        </View>
                    </View>
                );

                return (
                    <View>
                        <PdfSectionStart title={sectionTitle}>
                            <View style={{ border: `1 solid ${PDF_BORDER}` }}>
                                {renderMarkedRow(
                                    firstMarkedItem,
                                    0,
                                    markedItems.length
                                )}
                            </View>
                        </PdfSectionStart>
                        {restMarkedItems.length > 0 ? (
                            <View
                                style={{
                                    borderLeft: `1 solid ${PDF_BORDER}`,
                                    borderRight: `1 solid ${PDF_BORDER}`,
                                    borderBottom: `1 solid ${PDF_BORDER}`
                                }}>
                                {restMarkedItems.map((item, idx) =>
                                    renderMarkedRow(
                                        item,
                                        idx + 1,
                                        markedItems.length
                                    )
                                )}
                            </View>
                        ) : null}
                    </View>
                );
            }

            case 'faq': {
                const sectionTitle = 'Frequently Asked Questions';
                const faqItems = getVisibleFaqItems(parseFaqItems(content));

                if (!hasFaqContent(faqItems)) {
                    return (
                        <PdfSectionStart title={sectionTitle}>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    );
                }

                const [firstFaqItem, ...restFaqItems] = faqItems;

                const renderFaqItem = (
                    item: { question: string; answer: unknown },
                    idx: number,
                    total: number,
                    unbreakable: boolean
                ) => (
                    <View
                        key={idx}
                        {...pdfRowWrapProps(unbreakable)}
                        style={{
                            padding: PDF_BOX_PAD,
                            borderBottom:
                                idx < total - 1
                                    ? `1 solid ${PDF_BORDER}`
                                    : 'none'
                        }}>
                        <Text
                            style={{
                                fontWeight: 'normal',
                                marginBottom: 4
                            }}>
                            {item.question || ''}
                        </Text>
                        <Text style={pdfStyles.text}>
                            {parseContentWithLinks(item.answer || '')}
                        </Text>
                    </View>
                );

                return (
                    <View>
                        <PdfSectionStart title={sectionTitle}>
                            <View style={{ border: `1 solid ${PDF_BORDER}` }}>
                                {renderFaqItem(
                                    firstFaqItem,
                                    0,
                                    faqItems.length,
                                    false
                                )}
                            </View>
                        </PdfSectionStart>
                        {restFaqItems.length > 0 ? (
                            <View
                                style={{
                                    borderLeft: `1 solid ${PDF_BORDER}`,
                                    borderRight: `1 solid ${PDF_BORDER}`,
                                    borderBottom: `1 solid ${PDF_BORDER}`
                                }}>
                                {restFaqItems.map((item, idx) =>
                                    renderFaqItem(
                                        item,
                                        idx + 1,
                                        faqItems.length,
                                        true
                                    )
                                )}
                            </View>
                        ) : null}
                    </View>
                );
            }

            case 'ai-policy': {
                const aiPolicy = parseAiPolicy(content);
                const selectedLevels = aiPolicy.aiasLevels
                    .map((level) => getAiasLevel(level))
                    .filter(
                        (level): level is NonNullable<typeof level> =>
                            Boolean(level)
                    );
                const hasUploadPolicy =
                    aiPolicy.source === 'upload' && Boolean(aiPolicyDocument);
                const hasAiasPolicy =
                    aiPolicy.source === 'aias' && selectedLevels.length > 0;
                const hasGuidance = hasAssessmentGuidance(
                    aiPolicy.assessmentGuidance
                );

                if (!hasUploadPolicy && !hasAiasPolicy && !hasGuidance) {
                    return (
                        <PdfSectionStart title='AI Policy'>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    );
                }

                const aiPolicyParts: React.ReactNode[] = [];

                if (hasUploadPolicy && aiPolicyDocument) {
                    aiPolicyParts.push(
                        <Text key='upload' style={pdfStyles.text}>
                            Policy document: {aiPolicyDocument.fileName}
                        </Text>
                    );
                }

                if (hasAiasPolicy) {
                    const [firstLevel, ...restLevels] = selectedLevels;
                    aiPolicyParts.push(
                        <View key='aias-intro' style={{ marginTop: 8 }}>
                            <Text style={pdfStyles.text}>
                                {AIAS_POLICY.name} — permitted levels:
                            </Text>
                            <View
                                style={{
                                    marginTop: 8,
                                    padding: PDF_BOX_PAD,
                                    border: `1 solid ${PDF_BORDER}`
                                }}>
                                <Text style={{ fontWeight: 'normal' }}>
                                    Level {firstLevel.level}: {firstLevel.name}
                                </Text>
                                <Text style={pdfStyles.text}>
                                    {firstLevel.studentGuidance}
                                </Text>
                            </View>
                        </View>
                    );
                    if (restLevels.length > 0) {
                        aiPolicyParts.push(
                            <View key='aias-rest' style={{ marginTop: 8 }}>
                                {restLevels.map((level) => (
                                    <View
                                        key={level.level}
                                        style={{
                                            marginTop: 8,
                                            padding: PDF_BOX_PAD,
                                            border: `1 solid ${PDF_BORDER}`
                                        }}>
                                        <Text style={{ fontWeight: 'normal' }}>
                                            Level {level.level}: {level.name}
                                        </Text>
                                        <Text style={pdfStyles.text}>
                                            {level.studentGuidance}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        );
                    }
                }

                if (hasGuidance) {
                    aiPolicyParts.push(
                        <View
                            key='guidance'
                            style={{
                                marginTop: 10,
                                padding: PDF_BOX_PAD,
                                border: `1 solid ${PDF_BORDER}`
                            }}>
                            <Text style={{ fontWeight: 'normal' }}>
                                Guidance for this assessment
                            </Text>
                            <Text style={pdfStyles.text}>
                                {parseContentWithLinks(
                                    aiPolicy.assessmentGuidance
                                )}
                            </Text>
                        </View>
                    );
                }

                if (aiPolicy.usageLogEnabled) {
                    aiPolicyParts.push(
                        <Text
                            key='usage-log'
                            style={{
                                ...pdfStyles.textMuted,
                                marginTop: 8
                            }}>
                            Students may complete an AI Usage Log for this
                            assessment.
                        </Text>
                    );
                }

                const [firstAiPolicyPart, ...restAiPolicyParts] =
                    aiPolicyParts;

                return (
                    <View>
                        <PdfSectionStart title='AI Policy'>
                            {firstAiPolicyPart}
                        </PdfSectionStart>
                        {restAiPolicyParts}
                    </View>
                );
            }

            default:
                return (
                    <Text style={pdfStyles.textMuted}>
                        Content not yet added for this section
                    </Text>
                );
        }
    };

    return (
        <Document>
            <Page size='A4' style={pdfStyles.page}>
                <View style={pdfStyles.documentCard}>
                    <Text
                        style={pdfStyles.title}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                        Assessment Brief
                    </Text>

                    {/* Metadata — grid matches viewer `md:grid-cols-[200px_1fr] border` */}
                    <View
                        style={{
                            border: `1 solid ${PDF_BORDER}`,
                            marginBottom: PDF_BELOW_METADATA
                        }}>
                        <View wrap={false} style={pdfStyles.metadataRow}>
                            <View style={pdfStyles.metadataLabel}>
                                <Text style={{ fontWeight: 'normal' }} {...PDF_LABEL_TEXT_PROPS}>Programme</Text>
                            </View>
                            <View style={pdfStyles.metadataValue}>
                                <Text
                                    style={{
                                        fontWeight: 'light',
                                        color: PDF_FOREGROUND
                                    }}>
                                    {metadata.programmeName}
                                </Text>
                            </View>
                        </View>
                        <View wrap={false} style={pdfStyles.metadataRow}>
                            <View style={pdfStyles.metadataLabel}>
                                <Text style={{ fontWeight: 'normal' }} {...PDF_LABEL_TEXT_PROPS}>Module</Text>
                            </View>
                            <View style={pdfStyles.metadataValue}>
                                <Text
                                    style={{
                                        fontWeight: 'light',
                                        color: PDF_FOREGROUND
                                    }}>
                                    {metadata.module}
                                </Text>
                            </View>
                        </View>
                        <View wrap={false} style={pdfStyles.metadataRow}>
                            <View style={pdfStyles.metadataLabel}>
                                <Text style={{ fontWeight: 'normal' }} {...PDF_LABEL_TEXT_PROPS}>
                                    Assignment title
                                </Text>
                            </View>
                            <View style={pdfStyles.metadataValue}>
                                <Text
                                    style={{
                                        fontWeight: 'light',
                                        color: PDF_FOREGROUND
                                    }}>
                                    {metadata.title}
                                </Text>
                            </View>
                        </View>
                        <View wrap={false} style={pdfStyles.metadataRow}>
                            <View style={pdfStyles.metadataLabel}>
                                <Text style={{ fontWeight: 'normal' }} {...PDF_LABEL_TEXT_PROPS}>
                                    Lecturer(s)
                                </Text>
                            </View>
                            <View style={pdfStyles.metadataValue}>
                                <Text
                                    style={{
                                        fontWeight: 'light',
                                        color: PDF_FOREGROUND
                                    }}>
                                    {metadata.lecturer.split('\n').join(', ')}
                                </Text>
                            </View>
                        </View>
                        <View wrap={false} style={pdfStyles.metadataRow}>
                            <View style={pdfStyles.metadataLabel}>
                                <Text style={{ fontWeight: 'normal' }} {...PDF_LABEL_TEXT_PROPS}>
                                    Start date
                                </Text>
                            </View>
                            <View style={pdfStyles.metadataValue}>
                                <Text
                                    style={{
                                        fontWeight: 'light',
                                        color: PDF_FOREGROUND
                                    }}>
                                    {formatDate(metadata.startDate)}
                                </Text>
                            </View>
                        </View>
                        <View wrap={false} style={pdfStyles.metadataRow}>
                            <View style={pdfStyles.metadataLabel}>
                                <Text style={{ fontWeight: 'normal' }} {...PDF_LABEL_TEXT_PROPS}>
                                    Submission date
                                </Text>
                            </View>
                            <View style={pdfStyles.metadataValue}>
                                <Text
                                    style={{
                                        fontWeight: 'light',
                                        color: PDF_FOREGROUND
                                    }}>
                                    {formatDate(metadata.submissionDate)}
                                </Text>
                            </View>
                        </View>
                        <View
                            wrap={false}
                            style={[
                                pdfStyles.metadataRow,
                                { borderBottom: 'none' }
                            ]}>
                            <View style={pdfStyles.metadataLabel}>
                                <Text style={{ fontWeight: 'normal' }} {...PDF_LABEL_TEXT_PROPS}>
                                    Individual / group
                                </Text>
                            </View>
                            <View style={pdfStyles.metadataValue}>
                                <Text
                                    style={{
                                        fontWeight: 'light',
                                        color: PDF_FOREGROUND
                                    }}>
                                    {metadata.individualGroup}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Sections (example-feedback is omitted from PDF export) */}
                    {enabledSections.length === 0 ? (
                        <View
                            style={{
                                padding: PDF_TITLE_BLOCK_GAP,
                                border: `2 dashed ${PDF_BORDER}`,
                                borderRadius: 4
                            }}>
                            <Text
                                style={{
                                    textAlign: 'center',
                                    color: PDF_MUTED,
                                    fontWeight: 'light',
                                    fontSize: 13
                                }}>
                                Enable sections to see the preview
                            </Text>
                        </View>
                    ) : pdfSections.length === 0 ? null : (
                        <View>
                            {pdfSections.map((section, index) => (
                                <View
                                    key={section.id}
                                    style={{
                                        marginTop:
                                            index === 0 ? 0 : PDF_SECTION_DIVIDER_GAP,
                                        borderTop: '1 solid rgba(0, 0, 0, 0.15)',
                                        paddingTop: PDF_SECTION_DIVIDER_GAP
                                    }}>
                                    {renderPDFSectionContent(section.id)}
                                </View>
                            ))}
                        </View>
                    )}
                    {institutionalPolicy.label.trim() &&
                    institutionalPolicy.url.trim() ? (
                        <View
                            style={{
                                marginTop: PDF_SECTION_DIVIDER_GAP,
                                borderTop: '1 solid rgba(0, 0, 0, 0.15)',
                                paddingTop: PDF_SECTION_DIVIDER_GAP
                            }}>
                            <Text style={pdfStyles.textMuted}>
                                Institutional policy:{' '}
                                <Link src={institutionalPolicy.url}>
                                    {institutionalPolicy.label}
                                </Link>
                            </Text>
                        </View>
                    ) : null}
                </View>
            </Page>
        </Document>
    );
};

export async function generateBriefPDFBlob(
    metadata: BriefMetadata,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    sections: BriefSection[],
    institutionalAiPolicy: InstitutionalAiPolicy = { label: '', url: '' },
    aiPolicyDocument: { url: string; fileName: string } | null = null
): Promise<Blob> {
    const doc = (
        <BriefPDFDocument
            metadata={metadata}
            content={content}
            sections={sections}
            templateKey='default'
            institutionalAiPolicy={institutionalAiPolicy}
            aiPolicyDocument={aiPolicyDocument}
        />
    );
    return pdf(doc).toBlob();
}

// Export function to generate PDF
export async function generatePDF(
    metadata: BriefMetadata,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    sections: BriefSection[],
    filename: string = 'assessment-brief.pdf',
    institutionalAiPolicy: InstitutionalAiPolicy = { label: '', url: '' },
    aiPolicyDocument: { url: string; fileName: string } | null = null
): Promise<void> {
    const blob = await generateBriefPDFBlob(
        metadata,
        content,
        sections,
        institutionalAiPolicy,
        aiPolicyDocument
    );
    const { downloadBlob } = await import('@/lib/download-blob');
    downloadBlob(blob, filename);
}

// PDF Document Component for Checklist Only
type SubmissionFormFieldDef = {
    title: string;
    description?: string;
    placeholder?: string;
    optionalDescription?: string;
};

export type BriefPrintFormOptions = {
    submissionFormValues?: SubmissionFormValues;
    checkedItems?: Record<string, boolean>;
};

const pdfFormValueEmpty = {
    fontSize: 10,
    color: '#888',
    fontWeight: 'light' as const
};

const pdfFormValueFilled = {
    fontSize: 11,
    color: '#111',
    fontWeight: 'normal' as const,
    lineHeight: 1.35
};

function SubmissionFormFieldPdfRow({
    field,
    idx,
    totalFields,
    values = {},
    programmeLabel = 'the programme',
    unbreakable = true
}: {
    field: SubmissionFormFieldDef;
    idx: number;
    totalFields: number;
    values?: SubmissionFormValues;
    programmeLabel?: string;
    unbreakable?: boolean;
}) {
    const isDeclarationField =
        field.title.trim().toLowerCase() === 'declaration';
    const placeholderText = field.placeholder || field.description || '';
    const helperDescription = (field.optionalDescription || '').replaceAll(
        '[INSERT_PROGRAMME]',
        programmeLabel
    );
    const fieldValue = isDeclarationField
        ? getSubmissionFieldValue(values, idx, field, { signed: true })
        : getSubmissionFieldValue(values, idx, field);

    return (
        <View
            key={idx}
            {...pdfRowWrapProps(unbreakable)}
            style={[
                pdfStyles.formField,
                {
                    borderBottom:
                        idx < totalFields - 1
                            ? `1 solid ${PDF_BORDER}`
                            : 'none',
                    paddingBottom: 10
                }
            ]}>
            <Text style={pdfStyles.formLabel}>{field.title}</Text>
            {helperDescription ? (
                <Text
                    style={{
                        fontSize: 10,
                        lineHeight: 1.3,
                        marginBottom: 8,
                        color: '#666',
                        fontWeight: 'light'
                    }}>
                    {parseContentWithLinks(helperDescription)}
                </Text>
            ) : null}
            {isDeclarationField ? (
                <Text
                    style={
                        fieldValue ? pdfFormValueFilled : pdfFormValueEmpty
                    }>
                    Signed: {fieldValue || '____________________'}
                </Text>
            ) : fieldValue ? (
                <Text style={pdfFormValueFilled}>{fieldValue}</Text>
            ) : (
                <Text style={pdfFormValueEmpty}>
                    {placeholderText}: ____________________
                </Text>
            )}
        </View>
    );
}

function ChecklistItemPdfRow({
    item,
    idx,
    totalItems,
    checkedItems = {},
    unbreakable = true
}: {
    item: string;
    idx: number;
    totalItems: number;
    checkedItems?: Record<string, boolean>;
    unbreakable?: boolean;
}) {
    const itemKey = `checklist-${idx}-${item}`;
    const isChecked = Boolean(checkedItems[itemKey]);

    return (
        <View
            key={idx}
            {...pdfRowWrapProps(unbreakable)}
            style={[
                pdfStyles.checklistItem,
                {
                    borderBottom:
                        idx < totalItems - 1
                            ? `1 dashed ${PDF_BORDER}`
                            : 'none',
                    paddingBottom: 6
                }
            ]}>
            <View
                style={[
                    pdfStyles.checkbox,
                    ...(isChecked
                        ? [{ backgroundColor: PDF_FOREGROUND }]
                        : [])
                ]}
            />
            <Text
                style={{
                    flex: 1,
                    fontWeight: 'light',
                    fontSize: 13
                }}>
                {item}
            </Text>
        </View>
    );
}

const ChecklistPDFDocument = ({
    content,
    checkedItems = {}
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    checkedItems?: Record<string, boolean>;
}) => {
    if (!content.checklistItems || content.checklistItems.length === 0) {
        return (
            <Document>
                <Page size='A4' style={pdfStyles.page}>
                    <View style={pdfStyles.documentCard}>
                        <PdfSectionStart title='Submission Checklist'>
                            <Text style={pdfStyles.text}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    </View>
                </Page>
            </Document>
        );
    }

    const checklistItems = content.checklistItems as string[];
    const [firstItem, ...restItems] = checklistItems;

    return (
        <Document>
            <Page size='A4' style={pdfStyles.page}>
                <View style={pdfStyles.documentCard}>
                    <PdfSectionStart title='Submission Checklist'>
                        <View
                            style={{
                                border: `1 solid ${PDF_BORDER}`,
                                padding: PDF_BOX_PAD
                            }}>
                            <ChecklistItemPdfRow
                                item={firstItem}
                                idx={0}
                                totalItems={checklistItems.length}
                                checkedItems={checkedItems}
                                unbreakable={false}
                            />
                        </View>
                    </PdfSectionStart>
                    {restItems.length > 0 ? (
                        <View
                            style={{
                                borderLeft: `1 solid ${PDF_BORDER}`,
                                borderRight: `1 solid ${PDF_BORDER}`,
                                borderBottom: `1 solid ${PDF_BORDER}`,
                                padding: PDF_BOX_PAD
                            }}>
                            {restItems.map((item: string, idx: number) => (
                                <ChecklistItemPdfRow
                                    key={idx + 1}
                                    item={item}
                                    idx={idx + 1}
                                    totalItems={checklistItems.length}
                                    checkedItems={checkedItems}
                                />
                            ))}
                        </View>
                    ) : null}
                </View>
            </Page>
        </Document>
    );
};

// PDF Document Component for Submission Form Only
const SubmissionFormPDFDocument = ({
    content,
    submissionFormValues = {}
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    submissionFormValues?: SubmissionFormValues;
}) => {
    if (
        !content.submissionFormFields ||
        content.submissionFormFields.length === 0
    ) {
        return (
            <Document>
                <Page size='A4' style={pdfStyles.page}>
                    <View style={pdfStyles.documentCard}>
                        <PdfSectionStart title='Submission Form'>
                            <Text style={pdfStyles.text}>
                                Content not yet added for this section
                            </Text>
                        </PdfSectionStart>
                    </View>
                </Page>
            </Document>
        );
    }

    const formFields = content.submissionFormFields as SubmissionFormFieldDef[];
    const [firstField, ...restFields] = formFields;

    return (
        <Document>
            <Page size='A4' style={pdfStyles.page}>
                <View style={pdfStyles.documentCard}>
                    <PdfSectionStart title='Submission Form'>
                        <View
                            style={{
                                border: `1 solid ${PDF_BORDER}`,
                                padding: PDF_BOX_PAD
                            }}>
                            <SubmissionFormFieldPdfRow
                                field={firstField}
                                idx={0}
                                totalFields={formFields.length}
                                values={submissionFormValues}
                                unbreakable={false}
                            />
                        </View>
                    </PdfSectionStart>
                    {restFields.length > 0 ? (
                        <View
                            style={{
                                borderLeft: `1 solid ${PDF_BORDER}`,
                                borderRight: `1 solid ${PDF_BORDER}`,
                                borderBottom: `1 solid ${PDF_BORDER}`,
                                padding: PDF_BOX_PAD
                            }}>
                            {restFields.map(
                                (field: SubmissionFormFieldDef, idx: number) => (
                                    <SubmissionFormFieldPdfRow
                                        key={idx + 1}
                                        field={field}
                                        idx={idx + 1}
                                        totalFields={formFields.length}
                                        values={submissionFormValues}
                                    />
                                )
                            )}
                        </View>
                    ) : null}
                </View>
            </Page>
        </Document>
    );
};

// PDF Document Component for Both Checklist and Submission Form
const ChecklistAndSubmissionFormPDFDocument = ({
    content,
    submissionFormValues = {},
    checkedItems = {}
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any;
    submissionFormValues?: SubmissionFormValues;
    checkedItems?: Record<string, boolean>;
}) => {
    const hasChecklist =
        content.checklistItems && content.checklistItems.length > 0;
    const hasSubmissionForm =
        content.submissionFormFields && content.submissionFormFields.length > 0;

    return (
        <Document>
            <Page size='A4' style={pdfStyles.page}>
                <View style={pdfStyles.documentCard}>
                {hasChecklist && (() => {
                    const checklistItems = content.checklistItems as string[];
                    const [firstItem, ...restItems] = checklistItems;
                    return (
                        <View style={{ marginBottom: PDF_SECTION_DIVIDER_GAP }}>
                            <PdfSectionStart title='Submission Checklist'>
                                <View
                                    style={{
                                        border: `1 solid ${PDF_BORDER}`,
                                        padding: PDF_BOX_PAD
                                    }}>
                                    <ChecklistItemPdfRow
                                        item={firstItem}
                                        idx={0}
                                        totalItems={checklistItems.length}
                                        checkedItems={checkedItems}
                                        unbreakable={false}
                                    />
                                </View>
                            </PdfSectionStart>
                            {restItems.length > 0 ? (
                                <View
                                    style={{
                                        borderLeft: `1 solid ${PDF_BORDER}`,
                                        borderRight: `1 solid ${PDF_BORDER}`,
                                        borderBottom: `1 solid ${PDF_BORDER}`,
                                        padding: PDF_BOX_PAD
                                    }}>
                                    {restItems.map(
                                        (item: string, idx: number) => (
                                            <ChecklistItemPdfRow
                                                key={idx + 1}
                                                item={item}
                                                idx={idx + 1}
                                                totalItems={
                                                    checklistItems.length
                                                }
                                                checkedItems={checkedItems}
                                            />
                                        )
                                    )}
                                </View>
                            ) : null}
                        </View>
                    );
                })()}

                {hasSubmissionForm && (() => {
                    const formFields =
                        content.submissionFormFields as SubmissionFormFieldDef[];
                    const [firstField, ...restFields] = formFields;
                    return (
                        <View>
                            <PdfSectionStart title='Submission Form'>
                                <View
                                    style={{
                                        border: `1 solid ${PDF_BORDER}`,
                                        padding: PDF_BOX_PAD
                                    }}>
                                    <SubmissionFormFieldPdfRow
                                        field={firstField}
                                        idx={0}
                                        totalFields={formFields.length}
                                        values={submissionFormValues}
                                        unbreakable={false}
                                    />
                                </View>
                            </PdfSectionStart>
                            {restFields.length > 0 ? (
                                <View
                                    style={{
                                        borderLeft: `1 solid ${PDF_BORDER}`,
                                        borderRight: `1 solid ${PDF_BORDER}`,
                                        borderBottom: `1 solid ${PDF_BORDER}`,
                                        padding: PDF_BOX_PAD
                                    }}>
                                    {restFields.map(
                                        (
                                            field: SubmissionFormFieldDef,
                                            idx: number
                                        ) => (
                                            <SubmissionFormFieldPdfRow
                                                key={idx + 1}
                                                field={field}
                                                idx={idx + 1}
                                                totalFields={formFields.length}
                                                values={submissionFormValues}
                                            />
                                        )
                                    )}
                                </View>
                            ) : null}
                        </View>
                    );
                })()}

                {!hasChecklist && !hasSubmissionForm && (
                    <Text style={pdfStyles.text}>
                        Content not yet added for these sections
                    </Text>
                )}
                </View>
            </Page>
        </Document>
    );
};

// Helper function to open PDF in new tab
async function openPDFInNewTab(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: React.ReactElement<any>
): Promise<void> {
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up the URL after a delay to allow the browser to load it
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

export async function generateChecklistPDFBlob(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    options: BriefPrintFormOptions = {}
): Promise<Blob> {
    const doc = (
        <ChecklistPDFDocument
            content={content}
            checkedItems={options.checkedItems}
        />
    );
    return pdf(doc).toBlob();
}

export async function generateSubmissionFormPDFBlob(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    options: BriefPrintFormOptions = {}
): Promise<Blob> {
    const doc = (
        <SubmissionFormPDFDocument
            content={content}
            submissionFormValues={options.submissionFormValues}
        />
    );
    return pdf(doc).toBlob();
}

// Export function to generate and open Checklist PDF in new tab
export async function generateChecklistPDF(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    options: BriefPrintFormOptions = {}
): Promise<void> {
    await openPDFInNewTab(
        <ChecklistPDFDocument
            content={content}
            checkedItems={options.checkedItems}
        />
    );
}

// Export function to generate and open Submission Form PDF in new tab
export async function generateSubmissionFormPDF(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    options: BriefPrintFormOptions = {}
): Promise<void> {
    await openPDFInNewTab(
        <SubmissionFormPDFDocument
            content={content}
            submissionFormValues={options.submissionFormValues}
        />
    );
}

export async function generateChecklistAndSubmissionFormPDFBlob(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    options: BriefPrintFormOptions = {}
): Promise<Blob> {
    const doc = (
        <ChecklistAndSubmissionFormPDFDocument
            content={content}
            submissionFormValues={options.submissionFormValues}
            checkedItems={options.checkedItems}
        />
    );
    return pdf(doc).toBlob();
}

// Export function to generate and open Checklist and Submission Form PDF in new tab
export async function generateChecklistAndSubmissionFormPDF(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    options: BriefPrintFormOptions = {}
): Promise<void> {
    await openPDFInNewTab(
        <ChecklistAndSubmissionFormPDFDocument
            content={content}
            submissionFormValues={options.submissionFormValues}
            checkedItems={options.checkedItems}
        />
    );
}
