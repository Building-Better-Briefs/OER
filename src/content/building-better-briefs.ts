export type BriefsContentLink = {
    label: string;
    href: string;
    external?: boolean;
};

export type BriefsContentBlock = {
    id: string;
    title?: string;
    paragraphs?: string[];
    bullets?: string[];
    links?: BriefsContentLink[];
};

const CC_BY_NC_SA =
    'https://creativecommons.org/licenses/by-nc-sa/4.0/';

export const SUMMARY_BLOCK_IDS = ['lead', 'oer', 'ack', 'overview'] as const;

export const BUILDING_BETTER_BRIEFS_BLOCKS: BriefsContentBlock[] = [
    {
        id: 'lead',
        title:
            'Building Better Briefs: A UDL Approach to Transparent and Inclusive Assessment',
        paragraphs: [
            'HEA Open Education: Supporting Policy and Practice.',
            'Institute of Art, Design + Technology, Ireland · Published 2026'
        ]
    },
    {
        id: 'oer',
        title: 'Description',
        paragraphs: [
            'An open educational resource for higher education staff who design assessment briefs. It provides a structured approach to writing clear, consistent and accessible briefs, aligning learning outcomes, assessment tasks and assessment criteria. It includes reusable guidance and a brief template that can be adapted across disciplines.'
        ]
    },
    {
        id: 'ack',
        title: 'Acknowledgement',
        paragraphs: [
            'Developed with support from the IADT Teaching and Learning Office.'
        ]
    },
    {
        id: 'overview',
        title: 'Project overview',
        paragraphs: [
            'This SATLE-supported project explores how assessment briefs can become clearer, more accessible and easier to use.',
            'The OER combines research-informed guidance with a downloadable brief builder that runs locally in a web browser—no account, no backend, and no student information sent to an external server.'
        ]
    },
    {
        id: 'funding',
        title: 'Funding and licence',
        paragraphs: [
            'Funded through the Strategic Alignment of Teaching and Learning Enhancement Funding (SATLE), administered by the Higher Education Authority and the National Forum for the Enhancement of Teaching and Learning in Higher Education.',
            'Building Better Briefs © 2026 by Stefan Paz Berrios and Mohammed Cherbatji is licensed under CC BY-NC-SA 4.0. The materials may be shared and adapted for non-commercial use with attribution. Adaptations must use the same licence.',
            'Licence scope applies to the presentation, written guidance and reusable brief template. Software source code, IADT branding and third-party material are excluded.'
        ],
        links: [
            {
                label: 'CC BY-NC-SA 4.0',
                href: CC_BY_NC_SA,
                external: true
            }
        ]
    },
    {
        id: 'problem',
        title: 'Why clearer briefs matter',
        paragraphs: [
            'How can we make assessment briefs clearer for students? Many students struggle with ambiguity rather than ability.',
            'Assessment briefs and rubrics are often difficult to interpret, inconsistent across modules, written using abstract academic language, and inaccessible in structure and format.',
            'Students from different backgrounds, disciplines and levels of experience often interpret the same assessment criteria in very different ways. As complexity increases, students may spend more time decoding assessment requirements than engaging with their learning.'
        ]
    },
    {
        id: 'opportunity',
        title: 'The opportunity',
        paragraphs: [
            'Assessment briefs can support learning as well as communicate requirements. A well-designed brief helps students understand what they need to do, why they are doing it, and how their work will be assessed.',
            'Different disciplines value different forms of knowledge, process, evidence and expression. A consistent structure should still allow lecturers to adapt the brief to their subject and assessment.'
        ]
    },
    {
        id: 'principles',
        title: 'Design principles',
        paragraphs: ['The OER follows a small set of practical principles:'],
        bullets: [
            'Clear, student-facing language',
            'Alignment between outcomes, tasks and criteria',
            'Consistent information structure',
            'Accessible presentation',
            'Flexibility across disciplines'
        ]
    },
    {
        id: 'oer-tool',
        title: 'The OER',
        paragraphs: [
            'The stripped-back OER supports clearer and more inclusive assessment design:'
        ],
        bullets: [
            'A guided assessment brief builder',
            'A consistent brief structure',
            'Clear student-facing content',
            'Alignment between outcomes, tasks and criteria',
            'Alignment between what students should learn, what they must do and how their work will be assessed',
            'A preview of the completed brief',
            'PDF export'
        ]
    },
    {
        id: 'building',
        title: 'Building a brief',
        paragraphs: [
            'The builder guides the lecturer through the main sections:'
        ],
        bullets: [
            'Module and assessment details',
            'Assessment task',
            'Learning outcomes',
            'Submission requirements',
            'Assessment criteria and rubrics',
            'Preview and export'
        ]
    },
    {
        id: 'structure',
        title: 'Consistent structure',
        paragraphs: [
            'A repeated structure helps students find important information across different assessment briefs. The structure remains consistent while the content can be adapted for different disciplines.'
        ]
    },
    {
        id: 'cognitive-load',
        title: 'Reduced cognitive load',
        paragraphs: [
            'Information is divided into clear sections so that students can focus on one part of the brief at a time—chunking information into smaller elements in line with UDL practice.'
        ]
    },
    {
        id: 'responsive',
        title: 'Responsive presentation',
        paragraphs: [
            'The completed brief adapts to different screen sizes so students can read the brief on a computer, tablet or phone.'
        ]
    },
    {
        id: 'alignment',
        title: 'Assessment alignment',
        paragraphs: [
            'The builder prompts lecturers to connect the assessment task, the learning outcomes and the assessment criteria. This helps students understand how the different parts of the assessment relate to each other.'
        ]
    },
    {
        id: 'local',
        title: 'Local by design',
        paragraphs: ['The OER runs locally in a web browser:'],
        bullets: [
            'No account required',
            'No backend required',
            'No student information collected',
            'No information sent to an external server'
        ]
    },
    {
        id: 'pdf-export',
        title: 'PDF export',
        paragraphs: [
            'Once the brief is complete, the lecturer can preview and export it as a PDF. The PDF can then be shared through institutional platforms.'
        ]
    },
    {
        id: 'authors',
        title: 'Authors',
        paragraphs: [
            'Stefan Paz Berrios and Mohammed Cherbatji'
        ]
    },
    {
        id: 'contacts',
        title: 'Project contacts',
        links: [
            {
                label: 'Dr Selina Guinness — Head of Teaching and Learning, NFETL Associate and SATLE Lead',
                href: 'mailto:selina.guinness@iadt.ie'
            },
            {
                label: 'Mohammed Cherbatji — Lecturer, Computing, IADT',
                href: 'mailto:mohammed.cherbatji@iadt.ie'
            },
            {
                label: 'Stefan Paz Berrios — Lecturer, UX + Design, IADT',
                href: 'mailto:stefan.pazberrios@iadt.ie'
            }
        ]
    },
    {
        id: 'references',
        title: 'References',
        bullets: [
            'Andrade, H. (2010) A review of rubric use in higher education, Assessment & Evaluation in Higher Education, 35(4), pp. 435–448.',
            'Bearman, M. et al. (2017) How university teachers design assessments: a cross-disciplinary study, Higher Education, 73, pp. 799–815.',
            'Brookhart, S.M. (2018) Appropriate criteria: Key to effective rubrics, Frontiers in Education, 3, article 22.',
            'Panadero, E. (2020) A critical review of the arguments against the use of rubrics, Assessment & Evaluation in Higher Education, 45(7), pp. 1075–1095.',
            'Ragupathi, K. (2020) Beyond fairness and consistency in grading: The role of rubrics, in Assessment in Higher Education: Volume I. Singapore: Springer, pp. 43–56.',
            'Taylor, B. (2024) Rubrics in higher education: an exploration of students’ perspectives on rubric design and use, Assessment & Evaluation in Higher Education, 49(2), pp. 236–253.'
        ]
    }
];

const summaryIdSet = new Set<string>(SUMMARY_BLOCK_IDS);

export function blocksForSummary(): BriefsContentBlock[] {
    return BUILDING_BETTER_BRIEFS_BLOCKS.filter((b) =>
        summaryIdSet.has(b.id)
    );
}

export function blocksForReadMore(): BriefsContentBlock[] {
    return BUILDING_BETTER_BRIEFS_BLOCKS;
}
