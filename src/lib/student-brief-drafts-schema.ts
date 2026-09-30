import { z } from 'zod';
import { SELF_ASSESSMENT_GRADE_OPTIONS } from '@/lib/self-assessment-storage';

const MAX_STRING = 10_000;
const MAX_AI_ENTRIES = 100;
const MAX_RECORD_KEYS = 200;

const trimmedString = z.string().max(MAX_STRING);

export const aiUsageLogEntrySchema = z.object({
    id: z.string().max(100),
    date: z.string().max(50),
    tool: trimmedString,
    purpose: trimmedString,
    howUsed: trimmedString,
    reflection: trimmedString
});

export const aiUsageLogDataSchema = z.object({
    studentName: trimmedString,
    studentNumber: trimmedString,
    entries: z.array(aiUsageLogEntrySchema).max(MAX_AI_ENTRIES),
    declarationConfirmed: z.boolean(),
    updatedAt: z.string().max(50).optional()
});

export const selfAssessmentFeedbackSchema = z.object({
    strengths: trimmedString,
    development: trimmedString,
    comments: trimmedString
});

export const selfAssessmentDataSchema = z.object({
    studentName: trimmedString,
    studentNumber: trimmedString,
    date: z.string().max(50),
    selections: z
        .record(z.string().max(100), z.enum(SELF_ASSESSMENT_GRADE_OPTIONS))
        .refine((record) => Object.keys(record).length <= MAX_RECORD_KEYS),
    feedback: selfAssessmentFeedbackSchema,
    updatedAt: z.string().max(50).optional()
});

export const submissionFormDataSchema = z.object({
    values: z
        .record(z.string().max(200), trimmedString)
        .refine((record) => Object.keys(record).length <= MAX_RECORD_KEYS)
});

export const checklistDataSchema = z.object({
    items: z
        .record(z.string().max(500), z.boolean())
        .refine((record) => Object.keys(record).length <= MAX_RECORD_KEYS)
});

export const syncedDraftEnvelopeSchema = <T extends z.ZodType>(dataSchema: T) =>
    z.object({
        data: dataSchema,
        revision: z.number().int().nonnegative(),
        updatedAt: z.string().max(50)
    });

export const aiUsageLogEnvelopeSchema =
    syncedDraftEnvelopeSchema(aiUsageLogDataSchema);
export const selfAssessmentEnvelopeSchema = syncedDraftEnvelopeSchema(
    selfAssessmentDataSchema
);
export const submissionFormEnvelopeSchema = syncedDraftEnvelopeSchema(
    submissionFormDataSchema
);
export const checklistEnvelopeSchema =
    syncedDraftEnvelopeSchema(checklistDataSchema);

export const STUDENT_DRAFT_KINDS = [
    'aiUsageLog',
    'selfAssessment',
    'submissionForm',
    'checklist'
] as const;

export type StudentDraftKind = (typeof STUDENT_DRAFT_KINDS)[number];

export function parseDraftEnvelope(
    schema: z.ZodType,
    value: unknown
): unknown | null {
    const result = schema.safeParse(value);
    return result.success ? result.data : null;
}
