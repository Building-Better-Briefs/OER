import { z } from 'zod';
import { richTextSchema, textField } from '@/lib/brief-schema-primitives';
import {
    normalizeCustomSubsections,
    type CustomSubsection
} from '@/lib/custom-subsections';
import {
    normalizeProjectDetailBlockOrder,
    type BuiltinProjectDetailBlockId
} from '@/lib/project-detail-block-order';
import {
    ensureAssignmentLogsWhenEnabled,
    normalizeAssignmentLogs,
    type AssignmentLogDefinition
} from '@/lib/assignment-logs';
import {
    ASSIGNMENT_SETTING_IDS,
    isRequireAiLogSettingHidden,
    isRequireLogsSettingHidden,
    isRequireNotebookSettingHidden,
    normalizeHiddenAssignmentSettings
} from '@/lib/assignment-settings';
import { REMOVABLE_PROJECT_DETAIL_SUBSECTION_IDS } from '@/lib/project-detail-subsections';
import { ensureRubricCriteriaIds } from '@/lib/rubric-types';

const titledRichItemSchema = z.object({
    title: z.string().max(300),
    description: richTextSchema.optional().default('')
});

const customSubsectionItemSchema = z.object({
    title: z.string().max(300),
    content: richTextSchema.optional().default('')
});

const customSubsectionSchema = z.object({
    id: z.string().uuid(),
    type: z.enum(['text', 'accordion']),
    title: z.string().max(300).optional().default(''),
    subheading: z.string().max(500).optional().default(''),
    content: richTextSchema.optional().default(''),
    items: z.array(customSubsectionItemSchema).max(30).optional().default([])
});

const rubricCriterionSchema = z.object({
    id: z.string().min(1).optional(),
    criterion: z.string().max(300).optional().default(''),
    assessedThrough: textField(2000),
    weighting: z.number().min(0).max(100).optional().default(0),
    learningOutcomes: z
        .array(z.number().int().min(0))
        .max(20)
        .optional()
        .default([]),
    gradeDescriptors: z
        .array(
            z.object({
                grade: z.string().max(50),
                description: richTextSchema.optional().default('')
            })
        )
        .max(10)
        .optional()
        .default([])
});

const schedulePhaseSchema = z.object({
    title: z.string().max(200).optional().default(''),
    timingMode: z.enum(['date', 'weeks']).optional().default('date'),
    startDate: z.string().max(40).optional(),
    endDate: z.string().max(40).optional(),
    weekStart: z.number().int().min(1).max(52).optional(),
    weekEnd: z.number().int().min(1).max(52).optional(),
    instructions: richTextSchema.optional().default('')
});

const assignmentLogFieldSchema = z.object({
    id: z.string().max(100),
    label: z.string().max(200)
});

const assignmentLogSeededMilestoneSchema = z.object({
    id: z.string().max(100),
    name: z.string().max(200),
    date: z.string().max(40).optional().default(''),
    endDate: z.string().max(40).optional()
});

const assignmentLogDefinitionSchema = z.object({
    id: z.string().max(100),
    title: z.string().max(200),
    sharing: z.enum(['individual', 'shared']),
    fields: z.array(assignmentLogFieldSchema).min(1).max(20),
    seededMilestones: z
        .array(assignmentLogSeededMilestoneSchema)
        .max(40)
        .optional()
        .default([])
});

const aiPolicySchema = z.object({
    source: z.union([z.literal('upload'), z.literal('aias'), z.null()]),
    aiasLevels: z
        .array(z.number().int().min(1).max(5))
        .max(5)
        .optional()
        .default([]),
    usageLogEnabled: z.boolean().optional().default(false),
    policyRationale: z.string().max(5000).optional().default(''),
    assessmentGuidance: z.unknown().optional().nullable()
});

export const BriefContentSaveSchema = z
    .object({
        learningOutcomes: z
            .array(
                z.object({
                    title: z.string().max(500),
                    weighting: z.number().min(0).max(100).optional().default(0)
                })
            )
            .max(20)
            .optional()
            .default([]),
        keyExpectations: z.array(titledRichItemSchema).max(20).optional().default([]),
        deliverables: z.array(titledRichItemSchema).max(20).optional().default([]),
        resources: z.array(titledRichItemSchema).max(20).optional().default([]),
        rubricCriteria: z
            .array(rubricCriterionSchema)
            .max(20)
            .optional()
            .default([]),
        howWorkMarked: z.array(titledRichItemSchema).max(15).optional().default([]),
        checklistItems: z.array(z.string().max(500)).max(30).optional().default([]),
        subheadings: z
            .record(z.string().max(80), richTextSchema)
            .optional()
            .default({}),
        onePageSummaryContent: z
            .record(z.string().max(80), richTextSchema)
            .optional()
            .default({}),
        submissionFormFields: z
            .array(
                z.object({
                    title: z.string().max(200),
                    placeholder: textField(500),
                    optionalDescription: textField(2000)
                })
            )
            .max(15)
            .optional()
            .default([]),
        customSubsections: z
            .array(customSubsectionSchema)
            .max(30)
            .optional()
            .default([]),
        hiddenProjectDetailSubsections: z
            .array(z.enum(REMOVABLE_PROJECT_DETAIL_SUBSECTION_IDS))
            .max(10)
            .optional()
            .default([]),
        hiddenCustomSubsectionIds: z
            .array(z.string().uuid())
            .max(30)
            .optional()
            .default([]),
        projectDetailBlockOrder: z
            .array(z.string().max(80))
            .max(40)
            .optional()
            .default([]),
        schedulePhases: z
            .array(schedulePhaseSchema)
            .max(15)
            .optional()
            .default([]),
        scheduleViews: z
            .object({
                table: z.boolean(),
                gantt: z.boolean()
            })
            .optional()
            .default({ table: true, gantt: false }),
        selfAssessmentLinkEnabled: z.boolean().optional().default(false),
        hiddenAssignmentSettings: z
            .array(z.enum(ASSIGNMENT_SETTING_IDS))
            .max(10)
            .optional()
            .default([]),
        requireNotebook: z.boolean().optional().default(false),
        requireLogs: z.boolean().optional().default(false),
        requireAiLog: z.boolean().optional().default(false),
        assignmentLogs: z
            .array(assignmentLogDefinitionSchema)
            .max(8)
            .optional()
            .default([]),
        aiPolicy: aiPolicySchema.optional().default({
            source: null,
            aiasLevels: [],
            usageLogEnabled: false,
            policyRationale: '',
            assessmentGuidance: null
        }),
        faqItems: z
            .array(
                z.object({
                    question: z.string().max(500),
                    answer: textField(5000)
                })
            )
            .max(20)
            .optional()
            .default([])
    })
    .strip();

export type BriefContentSave = z.infer<typeof BriefContentSaveSchema>;

export function parseBriefContentSave(data: unknown) {
    return BriefContentSaveSchema.safeParse(data);
}

export function normalizeBriefContentSave(
    data: BriefContentSave,
    templateBuiltinIds?: readonly BuiltinProjectDetailBlockId[]
): BriefContentSave & {
    customSubsections: CustomSubsection[];
} {
    const { subsections, hiddenIds } = normalizeCustomSubsections(
        data.customSubsections,
        data.hiddenCustomSubsectionIds
    );

    const projectDetailBlockOrder = normalizeProjectDetailBlockOrder(
        data.projectDetailBlockOrder,
        subsections,
        templateBuiltinIds
    );

    const rubricCriteria = ensureRubricCriteriaIds(
        (data.rubricCriteria ?? []) as Parameters<
            typeof ensureRubricCriteriaIds
        >[0]
    ).criteria;

    const hiddenAssignmentSettings = normalizeHiddenAssignmentSettings(
        data.hiddenAssignmentSettings
    );

    const aiLogHidden = isRequireAiLogSettingHidden(hiddenAssignmentSettings);
    const aiLogEnabled = aiLogHidden
        ? false
        : Boolean(data.requireAiLog || data.aiPolicy?.usageLogEnabled);

    return {
        ...data,
        customSubsections: subsections,
        hiddenCustomSubsectionIds: hiddenIds,
        projectDetailBlockOrder,
        hiddenProjectDetailSubsections: Array.from(
            new Set(data.hiddenProjectDetailSubsections)
        ),
        hiddenAssignmentSettings,
        requireNotebook: isRequireNotebookSettingHidden(
            hiddenAssignmentSettings
        )
            ? false
            : Boolean(data.requireNotebook),
        requireLogs: isRequireLogsSettingHidden(hiddenAssignmentSettings)
            ? false
            : Boolean(data.requireLogs),
        requireAiLog: aiLogEnabled,
        assignmentLogs: ensureAssignmentLogsWhenEnabled({
            requireLogs: isRequireLogsSettingHidden(hiddenAssignmentSettings)
                ? false
                : Boolean(data.requireLogs),
            assignmentLogs: normalizeAssignmentLogs(data.assignmentLogs)
        }) as AssignmentLogDefinition[],
        aiPolicy: {
            ...data.aiPolicy,
            usageLogEnabled: aiLogEnabled
        },
        rubricCriteria
    };
}
