export type SectionVisibility = 'required' | 'recommended' | 'optional';

export type BriefSectionLike = {
    id: string;
    enabled?: boolean;
    visibility?: SectionVisibility;
};

/** Whether a brief section should appear in preview, viewer, and PDF. */
export function isBriefSectionEnabled(section: BriefSectionLike): boolean {
    if (section.visibility === 'required') {
        return true;
    }
    if (section.enabled === false) {
        return false;
    }
    if (section.enabled === true) {
        return true;
    }
    // Legacy rows without `enabled`: optional sections stay off by default.
    return section.visibility !== 'optional';
}

export function normalizeBriefSection<T extends BriefSectionLike>(section: T): T {
    return {
        ...section,
        enabled: isBriefSectionEnabled(section)
    };
}

export function normalizeBriefSections<T extends BriefSectionLike>(
    sections: T[]
): T[] {
    return sections.map(normalizeBriefSection);
}

export function applySectionVisibility<T extends BriefSectionLike>(
    section: T,
    visibility: SectionVisibility
): T {
    return normalizeBriefSection({ ...section, visibility });
}

export function hasEnabledBriefSection(sections: BriefSectionLike[]): boolean {
    return sections.some((section) => isBriefSectionEnabled(section));
}

