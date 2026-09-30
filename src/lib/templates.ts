export type InstitutionalAiPolicy = {
  label: string;
  url: string;
};

import { getInstitutionAiPolicy } from '@/lib/institution-config';

export const templates = [
  {
    id: 'default',
    slug: 'default',
    name: 'Default',
    sections: [
      {
        id: 'project-details',
        label: 'Project Details',
        visibility: 'required',
        subsections: [
          {
            id: 'project-overview-content',
            label: 'Project Overview'
          },
          {
            id: 'learning-outcomes',
            label: 'Learning Outcomes Assessed',
            outcomes: [{
              title: 'Explain the main concepts of user experience and interaction design',
              weighting: 25
            }]
          },
          {
            id: 'key-expectations',
            label: 'Key Expectations',
            subheading: 'Your project must clearly demonstrate',
            expectations: [{
              title: 'Problem Identification',
              description: 'A well-defined problem with clear significance'
            }]
          },
          {
            id: 'deliverables',
            label: 'Deliverables',
            subheading: 'Your submission should include links to:',
            deliverables: [
              {
                title: 'FigJam Board (Individual + Group links)',
                description: 'A well-defined problem with clear significance'
              }
            ]
          },
          {
            id: 'resources',
            label: 'Resources',
            subheading: 'Use the following resources to help you:',
            resources: [
              {
                title: 'Research findings and competitive analysis',
                description: 'Use this resource to help you identify the problem and the target users.'
              }
            ]
          }
        ]
      },
      {
        id: 'rubric',
        label: 'Rubric',
        visibility: 'required',
        criteria: [
          {
            criterion: 'Problem Identification',
            assessedThrough: 'FigJam boards, presentation, and evidence of process.',
            weighting: 25,
            learningOutcomes: [1, 2],
            gradeDescriptors: [
              {
                grade: 'A',
                description: 'A well-defined problem with clear significance'
              }
            ]
          }
        ]
      },
      {
        id: 'example-feedback',
        label: 'Example Grading and Feedback Form',
        visibility: 'optional',
        exampleForm: 'example_grading_sheet.pdf'
      },
      {
        id: 'how-work-is-marked',
        label: 'How your work is marked',
        visibility: 'recommended',
        subsections: [
          {
            title: 'Collaboration + Iteration',
            description: 'To award marks fairly, I must be able to see each student’s ongoing contribution, engagement, and progress throughout the project.'
          },
        ]
      },
      {
        id: 'submission-checklist',
        label: 'Submission Checklist',
        visibility: 'recommended',
        checklist: [
          {
            title: 'FigJam Board (Group)',
          }
        ]
      },
      {
        id: 'one-page-summary',
        label: 'One Page Summary',
        visibility: 'recommended',
        subsections: [
          {
            title: 'Overview',
            description: 'A group project (3–5 students) where you design, prototype and evaluate a high-fidelity interactive product using Figma and FigJam.'
          },
          {
            title: 'Key Dates',
            description: 'Start: Week beginning 15th September 2025 End: Week beginning 8th December 2025 Presentation: In class Friday 12th December 2025'
          },

          {
            title: 'Weighting Summary',
            description: ''
          },
          {
            title: 'Project Schedule',
            description: ''
          }

        ]
      },
      {
        id: 'submission-form',
        label: 'Submission Form',
        visibility: 'recommended',
        form: [
          {
            title: 'Name',
            description: 'e.g. Stefan Paz'
          },
          {
            title: 'Student Number',
            description: 'e.g. N00123456'
          }
        ]
      },
      {
        id: 'ai-policy',
        label: 'AI Policy',
        visibility: 'recommended'
      },
      {
        id: 'faq',
        label: 'Frequently Asked Questions',
        visibility: 'optional',
        faqItems: [{ question: '', answer: '' }]
      },
      {
        id: 'schedule',
        label: 'Schedule',
        visibility: 'recommended',
        schedulePhases: [
          {
            title: 'Phase 1',
            timingMode: 'date',
            startDate: '',
            endDate: '',
            weekStart: 1,
            weekEnd: 1,
            instructions: ''
          }
        ],
        scheduleViews: {
          table: true,
          gantt: false
        }
      }

    ]
  }
];

export const DEFAULT_BRIEF_TEMPLATE = templates.find((t) => t.id === 'default')!;

/** Resolve layout template; falls back to `default` when key is unknown or missing in code. */
export function resolveBriefTemplate(templateKey: string) {
    const primary = templates.find((t) => t.id === templateKey);
    if (primary) return primary;
    return DEFAULT_BRIEF_TEMPLATE;
}

/** @deprecated Use institutionalAiPolicy prop from server instead. */
export function getInstitutionalAiPolicy(
    _templateKey: string
): InstitutionalAiPolicy {
    return getInstitutionAiPolicy();
}

/** Subsections for One Page Summary when template lookup fails (must match keys used in the UI). */
export const DEFAULT_ONE_PAGE_SUMMARY_SUBSECTIONS =
    DEFAULT_BRIEF_TEMPLATE?.sections.find(
        (s) => s.id === 'one-page-summary'
    )?.subsections ?? [];