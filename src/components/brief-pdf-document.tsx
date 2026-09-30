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
/**
 * Rubric section title: larger than generic headings so "Rubric" is not placed
 * when only a sliver of page remains (avoids overlap with the first criterion
 * table). Do not wrap the title + table in `View wrap={false}` — nested
 * `wrap={false}` with each criterion box triggers layout bugs at page breaks.
 */
const PDF_RUBRIC_TITLE_MIN_PRESENCE_AHEAD = 380;
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

/** One bordered rubric table (a single criterion and its grade rows). */
function RubricCriterionBox({ criterion }: { criterion: RubricCriterionPDF }) {
    return (
        <View
            wrap={false}
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
                        <Text style={pdfStyles.textMuted}>
                            Content not yet added for this section
                        </Text>
                    );
                }

                return (
                    <View>
                        <Text
                            style={pdfStyles.sectionTitle}
                            minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                        >
                            Project Details
                        </Text>
                        <View style={{ border: `1 solid ${PDF_BORDER}` }}>
                            {visibleProjectDetailBlockIds.map((blockId) => {
                                if (
                                    blockId === 'project-overview-content' &&
                                    hasOverview
                                ) {
                                    return (
                                <View
                                    key={blockId}
                                    wrap={false}
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
                                    return (
                                <React.Fragment key={blockId}>
                                    <View
                                        wrap={false}
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
                                </React.Fragment>
                                    );
                                }

                                if (
                                    blockId === 'key-expectations' &&
                                    hasKeyExpectations
                                ) {
                                    return (
                                <View
                                    key={blockId}
                                    wrap={false}
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
                                    return (
                                <View
                                    key={blockId}
                                    wrap={false}
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
                                    return (
                                <View
                                    key={blockId}
                                    wrap={false}
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
                                    if (!subsection) return null;

                                    if (subsection.type === 'accordion') {
                                        return (
                                            <View
                                                key={blockId}
                                                wrap={false}
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

                                    return (
                                        <View
                                            key={blockId}
                                            wrap={false}
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

                                return null;
                            })}
                        </View>
                    </View>
                );
            }

            case 'rubric': {
                if (
                    !content.rubricCriteria ||
                    content.rubricCriteria.length === 0
                ) {
                    return (
                        <View>
                            <Text
                                style={pdfStyles.sectionTitle}
                                minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                            >
                                Rubric
                            </Text>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </View>
                    );
                }

                const criteria = content.rubricCriteria as RubricCriterionPDF[];

                return (
                    <View>
                        <Text
                            style={pdfStyles.sectionTitle}
                            minPresenceAhead={
                                PDF_RUBRIC_TITLE_MIN_PRESENCE_AHEAD
                            }
                        >
                            Rubric
                        </Text>
                        {criteria.map((criterion, i) => (
                            <RubricCriterionBox
                                key={`rubric-criterion-${i}`}
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
                        <View>
                            <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                                One Page Summary
                            </Text>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </View>
                    );
                }

                return (
                    <View>
                        <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                            One Page Summary
                        </Text>
                        <View style={{ border: `1 solid ${PDF_BORDER}` }}>
                            {Object.entries(content.onePageSummaryContent).map(
                                ([key, value]) => (
                                    <View
                                        key={key}
                                        wrap={false}
                                        style={pdfStyles.gridRow}>
                                        <View style={pdfStyles.gridLabel}>
                                            <Text {...PDF_LABEL_TEXT_PROPS}>
                                                {key}
                                            </Text>
                                        </View>
                                        <View style={pdfStyles.gridContent}>
                                            <Text style={pdfStyles.text}>
                                                {parseContentWithLinks(
                                                    value as string
                                                )}
                                            </Text>
                                        </View>
                                    </View>
                                )
                            )}
                        </View>
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
                        <View>
                            <Text
                                style={pdfStyles.sectionTitle}
                                minPresenceAhead={
                                    PDF_HEADING_MIN_PRESENCE_AHEAD
                                }>
                                Schedule
                            </Text>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </View>
                    );
                }

                return (
                    <View>
                        <Text
                            style={pdfStyles.sectionTitle}
                            minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}>
                            Schedule
                        </Text>
                        {scheduleViews.table !== false && (
                            <View style={{ border: `1 solid ${PDF_BORDER}` }}>
                                {schedulePhases.map(
                                    (
                                        phase: {
                                            title?: string;
                                            timingMode?: 'date' | 'weeks';
                                            startDate?: string;
                                            endDate?: string;
                                            weekStart?: number;
                                            weekEnd?: number;
                                            instructions?: string;
                                        },
                                        idx: number
                                    ) => {
                                        const timingLabel =
                                            phase.timingMode === 'weeks'
                                                ? `Weeks ${phase.weekStart || 1}-${phase.weekEnd || 1}`
                                                : `${phase.startDate ? formatDate(new Date(phase.startDate)) : 'Start TBD'} - ${phase.endDate ? formatDate(new Date(phase.endDate)) : 'End TBD'}`;
                                        return (
                                            <View
                                                key={idx}
                                                style={{
                                                    flexDirection: 'row',
                                                    borderBottom:
                                                        idx <
                                                        schedulePhases.length - 1
                                                            ? `1 solid ${PDF_BORDER}`
                                                            : 'none'
                                                }}>
                                                <View
                                                    style={{
                                                        width: PDF_COL_LABEL,
                                                        borderRight: `1 solid ${PDF_BORDER}`,
                                                        padding: PDF_BOX_PAD
                                                    }}>
                                                    <Text
                                                        style={{
                                                            fontWeight: 'normal'
                                                        }}
                                                        {...PDF_LABEL_TEXT_PROPS}>
                                                        {phase.title ||
                                                            `Phase ${idx + 1}`}
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            marginTop: 4,
                                                            fontSize: 11,
                                                            color: PDF_MUTED,
                                                            fontWeight: 'light'
                                                        }}
                                                        {...PDF_LABEL_TEXT_PROPS}>
                                                        {timingLabel}
                                                    </Text>
                                                </View>
                                                <View
                                                    style={{
                                                        width: PDF_COL_CONTENT,
                                                        padding: PDF_BOX_PAD
                                                    }}>
                                                    <Text style={pdfStyles.text}>
                                                        {parseContentWithLinks(
                                                            phase.instructions ||
                                                                ''
                                                        )}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    }
                                )}
                            </View>
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
                        <View>
                            <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                                Submission Form
                            </Text>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </View>
                    );
                }

                return (
                    <View>
                        <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                            Submission Form
                        </Text>
                        <View
                            style={{
                                border: `1 solid ${PDF_BORDER}`,
                                padding: PDF_BOX_PAD
                            }}
                        >
                            {content.submissionFormFields.map(
                                (
                                    field: {
                                        title: string;
                                        description?: string;
                                        placeholder?: string;
                                        optionalDescription?: string;
                                    },
                                    idx: number
                                ) => {
                                    const isDeclarationField =
                                        field.title.trim().toLowerCase() ===
                                        'declaration';
                                    const placeholderText =
                                        field.placeholder ||
                                        field.description ||
                                        '';
                                    const helperDescription = (
                                        field.optionalDescription || ''
                                    ).replaceAll(
                                        '[INSERT_PROGRAMME]',
                                        metadata.programmeName || 'the programme'
                                    );
                                    return (
                                        <View
                                            key={idx}
                                            wrap={false}
                                            style={pdfStyles.formField}>
                                            <Text style={pdfStyles.formLabel}>
                                                {field.title}
                                            </Text>
                                            {helperDescription && (
                                                <Text
                                                    style={{
                                                        fontSize: 10,
                                                        lineHeight: 1.3,
                                                        marginBottom: 8,
                                                        color: '#666',
                                                        fontWeight: 'light'
                                                    }}>
                                                    {parseContentWithLinks(
                                                        helperDescription
                                                    )}
                                                </Text>
                                            )}
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
                                }
                            )}
                        </View>
                    </View>
                );
            }

            case 'submission-checklist': {
                if (
                    !content.checklistItems ||
                    content.checklistItems.length === 0
                ) {
                    return (
                        <View>
                            <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                                Submission Checklist
                            </Text>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </View>
                    );
                }

                return (
                    <View>
                        <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                            Submission Checklist
                        </Text>
                        <View
                            style={{
                                border: `1 solid ${PDF_BORDER}`,
                                padding: PDF_BOX_PAD
                            }}
                        >
                            {content.checklistItems.map(
                                (item: string, idx: number) => (
                                    <View
                                        key={idx}
                                        wrap={false}
                                        style={[
                                            pdfStyles.checklistItem,
                                            {
                                                borderBottom:
                                                    idx <
                                                    content.checklistItems
                                                        .length -
                                                        1
                                                    ? `1 dashed ${PDF_BORDER}`
                                                    : 'none',
                                                paddingBottom: 6
                                            }
                                        ]}>
                                        <View style={pdfStyles.checkbox} />
                                        <Text
                                            style={{
                                                flex: 1,
                                                fontWeight: 'light', // font-light
                                                fontSize: 13
                                            }}>
                                            {item}
                                        </Text>
                                    </View>
                                )
                            )}
                        </View>
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
                        <View>
                            <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                                {sectionTitle}
                            </Text>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </View>
                    );
                }

                return (
                    <View>
                        <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                            {sectionTitle}
                        </Text>
                        <View style={{ border: `1 solid ${PDF_BORDER}` }}>
                            {items.map(
                                (
                                    item: {
                                        title: string;
                                        description: string;
                                    },
                                    idx: number
                                ) => (
                                    <View
                                        key={idx}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'flex-start',
                                            borderBottom:
                                                idx < items.length - 1
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
                                                style={{
                                                    fontWeight: 'normal'
                                                }}
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
                                                {parseContentWithLinks(
                                                    item.description || ''
                                                )}
                                            </Text>
                                        </View>
                                    </View>
                                )
                            )}
                        </View>
                    </View>
                );
            }

            case 'faq': {
                const sectionTitle = 'Frequently Asked Questions';
                const faqItems = getVisibleFaqItems(parseFaqItems(content));

                if (!hasFaqContent(faqItems)) {
                    return (
                        <View>
                            <Text
                                style={pdfStyles.sectionTitle}
                                minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}>
                                {sectionTitle}
                            </Text>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </View>
                    );
                }

                return (
                    <View>
                        <Text
                            style={pdfStyles.sectionTitle}
                            minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}>
                            {sectionTitle}
                        </Text>
                        <View style={{ border: `1 solid ${PDF_BORDER}` }}>
                            {faqItems.map((item, idx) => (
                                <View
                                    key={idx}
                                    wrap={false}
                                    style={{
                                        padding: PDF_BOX_PAD,
                                        borderBottom:
                                            idx < faqItems.length - 1
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
                                        {parseContentWithLinks(
                                            item.answer || ''
                                        )}
                                    </Text>
                                </View>
                            ))}
                        </View>
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
                        <View>
                            <Text
                                style={pdfStyles.sectionTitle}
                                minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}>
                                AI Policy
                            </Text>
                            <Text style={pdfStyles.textMuted}>
                                Content not yet added for this section
                            </Text>
                        </View>
                    );
                }

                return (
                    <View>
                        <Text
                            style={pdfStyles.sectionTitle}
                            minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}>
                            AI Policy
                        </Text>
                        {hasUploadPolicy && aiPolicyDocument ? (
                            <Text style={pdfStyles.text}>
                                Policy document: {aiPolicyDocument.fileName}
                            </Text>
                        ) : null}
                        {hasAiasPolicy ? (
                            <View style={{ marginTop: 8 }}>
                                <Text style={pdfStyles.text}>
                                    {AIAS_POLICY.name} — permitted levels:
                                </Text>
                                {selectedLevels.map((level) => (
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
                        ) : null}
                        {hasGuidance ? (
                            <View
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
                        ) : null}
                        {aiPolicy.usageLogEnabled ? (
                            <Text
                                style={{
                                    ...pdfStyles.textMuted,
                                    marginTop: 8
                                }}>
                                Students may complete an AI Usage Log for this
                                assessment.
                            </Text>
                        ) : null}
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
    programmeLabel = 'the programme'
}: {
    field: SubmissionFormFieldDef;
    idx: number;
    totalFields: number;
    values?: SubmissionFormValues;
    programmeLabel?: string;
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
            wrap={false}
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
    checkedItems = {}
}: {
    item: string;
    idx: number;
    totalItems: number;
    checkedItems?: Record<string, boolean>;
}) {
    const itemKey = `checklist-${idx}-${item}`;
    const isChecked = Boolean(checkedItems[itemKey]);

    return (
        <View
            key={idx}
            wrap={false}
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
                        <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                            Submission Checklist
                        </Text>
                        <Text style={pdfStyles.text}>
                            Content not yet added for this section
                        </Text>
                    </View>
                </Page>
            </Document>
        );
    }

    return (
        <Document>
            <Page size='A4' style={pdfStyles.page}>
                <View style={pdfStyles.documentCard}>
                    <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                        Submission Checklist
                    </Text>
                    <View
                        style={{
                            border: `1 solid ${PDF_BORDER}`,
                            padding: PDF_BOX_PAD
                        }}
                    >
                    {content.checklistItems.map((item: string, idx: number) => (
                        <ChecklistItemPdfRow
                            key={idx}
                            item={item}
                            idx={idx}
                            totalItems={content.checklistItems.length}
                            checkedItems={checkedItems}
                        />
                    ))}
                    </View>
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
                        <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                            Submission Form
                        </Text>
                        <Text style={pdfStyles.text}>
                            Content not yet added for this section
                        </Text>
                    </View>
                </Page>
            </Document>
        );
    }

    return (
        <Document>
            <Page size='A4' style={pdfStyles.page}>
                <View style={pdfStyles.documentCard}>
                    <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                        Submission Form
                    </Text>
                    <View
                        style={{
                            border: `1 solid ${PDF_BORDER}`,
                            padding: PDF_BOX_PAD
                        }}
                    >
                    {content.submissionFormFields.map(
                        (field: SubmissionFormFieldDef, idx: number) => (
                            <SubmissionFormFieldPdfRow
                                key={idx}
                                field={field}
                                idx={idx}
                                totalFields={
                                    content.submissionFormFields.length
                                }
                                values={submissionFormValues}
                            />
                        )
                    )}
                    </View>
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
                {hasChecklist && (
                    <View style={{ marginBottom: PDF_SECTION_DIVIDER_GAP }}>
                        <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                            Submission Checklist
                        </Text>
                        <View
                            style={{
                                border: `1 solid ${PDF_BORDER}`,
                                padding: PDF_BOX_PAD
                            }}>
                            {content.checklistItems.map(
                                (item: string, idx: number) => (
                                    <ChecklistItemPdfRow
                                        key={idx}
                                        item={item}
                                        idx={idx}
                                        totalItems={
                                            content.checklistItems.length
                                        }
                                        checkedItems={checkedItems}
                                    />
                                )
                            )}
                        </View>
                    </View>
                )}

                {hasSubmissionForm && (
                    <View>
                        <Text
                        style={pdfStyles.sectionTitle}
                        minPresenceAhead={PDF_HEADING_MIN_PRESENCE_AHEAD}
                    >
                            Submission Form
                        </Text>
                        <View
                            style={{
                                border: `1 solid ${PDF_BORDER}`,
                                padding: PDF_BOX_PAD
                            }}>
                            {content.submissionFormFields.map(
                                (field: SubmissionFormFieldDef, idx: number) => (
                                    <SubmissionFormFieldPdfRow
                                        key={idx}
                                        field={field}
                                        idx={idx}
                                        totalFields={
                                            content.submissionFormFields.length
                                        }
                                        values={submissionFormValues}
                                    />
                                )
                            )}
                        </View>
                    </View>
                )}

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

// Export function to generate and open Checklist PDF in new tab
export async function generateChecklistPDF(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    options: BriefPrintFormOptions = {}
): Promise<void> {
    const doc = (
        <ChecklistPDFDocument
            content={content}
            checkedItems={options.checkedItems}
        />
    );
    await openPDFInNewTab(doc);
}

// Export function to generate and open Submission Form PDF in new tab
export async function generateSubmissionFormPDF(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    options: BriefPrintFormOptions = {}
): Promise<void> {
    const doc = (
        <SubmissionFormPDFDocument
            content={content}
            submissionFormValues={options.submissionFormValues}
        />
    );
    await openPDFInNewTab(doc);
}

// Export function to generate and open Checklist and Submission Form PDF in new tab
export async function generateChecklistAndSubmissionFormPDF(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    options: BriefPrintFormOptions = {}
): Promise<void> {
    const doc = (
        <ChecklistAndSubmissionFormPDFDocument
            content={content}
            submissionFormValues={options.submissionFormValues}
            checkedItems={options.checkedItems}
        />
    );
    await openPDFInNewTab(doc);
}
