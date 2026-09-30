import { describe, expect, it } from 'vitest';
import { briefSectionSnapshotsSchema } from '@/lib/brief-template';
import { parseBriefContentSave } from '@/lib/brief-content-schema';
import {
    parseDateField,
    parseDatetimeLocalField
} from '@/lib/brief-form-dates';
import { buildSampleBriefs } from '@/lib/sample-briefs';
import { isSampleBriefId } from '@/lib/sample-brief-ids';
import { hasAssessmentGuidance } from '@/lib/ai-policies';

describe('buildSampleBriefs', () => {
    it('returns two valid sample records', () => {
        const briefs = buildSampleBriefs();
        expect(briefs).toHaveLength(2);

        for (const record of briefs) {
            expect(isSampleBriefId(record.id)).toBe(true);

            const sectionsParsed = briefSectionSnapshotsSchema.safeParse(
                record.contents.sections
            );
            expect(sectionsParsed.success).toBe(true);

            const contentParsed = parseBriefContentSave(
                record.contents.content
            );
            expect(contentParsed.success).toBe(true);

            expect(parseDateField(record.metadata.startDate)).not.toBeNull();
            expect(
                parseDatetimeLocalField(record.metadata.submissionDate)
            ).not.toBeNull();
            const start = parseDateField(record.metadata.startDate)!;
            const submission = parseDatetimeLocalField(
                record.metadata.submissionDate
            )!;
            expect(submission.getTime()).toBeGreaterThan(start.getTime());
        }
    });

    it('includes Journal log and declaration on the journal sample', () => {
        const journal = buildSampleBriefs()[0];
        expect(journal.metadata.title).toContain('Journal');
        expect(journal.contents.content.requireLogs).toBe(true);
        expect(journal.contents.content.assignmentLogs?.[0]?.title).toBe(
            'Journal'
        );
        expect(journal.contents.content.aiPolicy?.aiasLevels).toEqual([2]);
        const declaration = journal.contents.content.submissionFormFields?.find(
            (field) => field.title.toLowerCase() === 'declaration'
        );
        expect(declaration).toBeDefined();
        expect(declaration?.optionalDescription).toContain(
            journal.metadata.programme
        );
        expect(
            hasAssessmentGuidance(journal.contents.content.aiPolicy?.assessmentGuidance)
        ).toBe(true);
    });
});
