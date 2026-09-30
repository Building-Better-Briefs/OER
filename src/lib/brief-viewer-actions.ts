import {
    isBriefSectionEnabled,
    type BriefSectionLike
} from '@/lib/brief-sections';
import { isRequireLogsSettingEnabled } from '@/lib/require-logs';

export type BriefViewerActionIcon = 'printer' | 'external-link';

export type BriefViewerPrintKind =
    | 'checklist'
    | 'submission-form'
    | 'checklist-and-submission-form';

export type BriefViewerActionDescriptor =
    | {
          id: string;
          label: string;
          icon: BriefViewerActionIcon;
          kind: 'print';
          printKind: BriefViewerPrintKind;
      }
    | {
          id: string;
          label: string;
          icon: BriefViewerActionIcon;
          kind: 'link';
          href: string;
          external?: boolean;
      };

export type BriefViewerAction =
    | { id: string; label: string; icon: BriefViewerActionIcon; onSelect: () => void }
    | {
          id: string;
          label: string;
          icon: BriefViewerActionIcon;
          href: string;
          external?: boolean;
      };

export type BuildBriefViewerActionsInput = {
    sections: BriefSectionLike[];
    content: unknown;
    viewerSlug: string;
    showAiUsageLogLink: boolean;
    showSelfAssessmentLink: boolean;
    showAssignmentLogsLink?: boolean;
    printHandlers: {
        printChecklist: () => void;
        printSubmissionForm: () => void;
        printChecklistAndSubmissionForm: () => void;
    };
};

export type DescribeBriefViewerActionsInput = Omit<
    BuildBriefViewerActionsInput,
    'printHandlers'
>;

function hasChecklistItems(content: unknown): boolean {
    if (typeof content !== 'object' || content === null) {
        return false;
    }

    const checklistItems = (content as { checklistItems?: unknown })
        .checklistItems;
    return Array.isArray(checklistItems) && checklistItems.length > 0;
}

function hasSubmissionFormFields(content: unknown): boolean {
    if (typeof content !== 'object' || content === null) {
        return false;
    }

    const submissionFormFields = (content as { submissionFormFields?: unknown })
        .submissionFormFields;
    return (
        Array.isArray(submissionFormFields) && submissionFormFields.length > 0
    );
}

export function describeBriefViewerActions({
    sections,
    content,
    viewerSlug,
    showAiUsageLogLink,
    showSelfAssessmentLink,
    showAssignmentLogsLink = isRequireLogsSettingEnabled(content)
}: DescribeBriefViewerActionsInput): BriefViewerActionDescriptor[] {
    const actions: BriefViewerActionDescriptor[] = [];

    const hasChecklistEnabled = sections.some(
        (section) =>
            section.id === 'submission-checklist' &&
            isBriefSectionEnabled(section)
    );
    const hasSubmissionFormEnabled = sections.some(
        (section) =>
            section.id === 'submission-form' && isBriefSectionEnabled(section)
    );
    const bothEnabled = hasChecklistEnabled && hasSubmissionFormEnabled;

    if (bothEnabled) {
        actions.push({
            id: 'print-checklist-and-submission-form',
            label: 'Print Checklist and Submission Form',
            icon: 'printer',
            kind: 'print',
            printKind: 'checklist-and-submission-form'
        });
    } else if (hasChecklistEnabled && hasChecklistItems(content)) {
        actions.push({
            id: 'print-checklist',
            label: 'Print Checklist',
            icon: 'printer',
            kind: 'print',
            printKind: 'checklist'
        });
    } else if (
        hasSubmissionFormEnabled &&
        hasSubmissionFormFields(content)
    ) {
        actions.push({
            id: 'print-submission-form',
            label: 'Print Submission Form',
            icon: 'printer',
            kind: 'print',
            printKind: 'submission-form'
        });
    }

    if (showAiUsageLogLink) {
        actions.push({
            id: 'ai-usage-log',
            label: 'AI Usage Log',
            icon: 'external-link',
            kind: 'link',
            href: `/briefs/viewer/${viewerSlug}/ai-usage-log`,
            external: true
        });
    }

    if (showSelfAssessmentLink) {
        actions.push({
            id: 'self-assessment',
            label: 'Student Self-Assessment Form',
            icon: 'external-link',
            kind: 'link',
            href: `/briefs/viewer/${viewerSlug}/self-assessment`,
            external: true
        });
    }

    if (showAssignmentLogsLink) {
        actions.push({
            id: 'assignment-logs',
            label: 'Logs',
            icon: 'external-link',
            kind: 'link',
            href: `/briefs/viewer/${viewerSlug}/logs`,
            external: true
        });
    }

    return actions;
}

export function buildBriefViewerActions({
    sections,
    content,
    viewerSlug,
    showAiUsageLogLink,
    showSelfAssessmentLink,
    showAssignmentLogsLink,
    printHandlers
}: BuildBriefViewerActionsInput): BriefViewerAction[] {
    const descriptors = describeBriefViewerActions({
        sections,
        content,
        viewerSlug,
        showAiUsageLogLink,
        showSelfAssessmentLink,
        showAssignmentLogsLink
    });

    return descriptors.map((action) => {
        if (action.kind === 'link') {
            return {
                id: action.id,
                label: action.label,
                icon: action.icon,
                href: action.href,
                external: action.external
            };
        }

        const onSelect =
            action.printKind === 'checklist'
                ? printHandlers.printChecklist
                : action.printKind === 'submission-form'
                  ? printHandlers.printSubmissionForm
                  : printHandlers.printChecklistAndSubmissionForm;

        return {
            id: action.id,
            label: action.label,
            icon: action.icon,
            onSelect
        };
    });
}
