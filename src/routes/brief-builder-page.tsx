import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    getBrief,
    toBuilderMetadata,
    writeBrief,
    type LocalBriefRecord
} from '@/lib/brief-store';
import {
    mapCatalogToBriefSections,
    parseResolvedTemplate,
    toBriefLayoutTemplate,
    type BriefSectionSnapshot
} from '@/lib/brief-template';
import { normalizeBriefSections } from '@/lib/brief-sections';
import { DEFAULT_BRIEF_TEMPLATE } from '@/lib/templates';
import { getInstitutionAiPolicy } from '@/lib/institution-config';
import {
    BriefBuilderProvider,
    type BriefSection
} from '@/builder/brief-builder-context';
import { BuilderPanelsLayout } from '@/builder/builder-panels-layout';
import { BuilderInteractionReset } from '@/builder/interaction-reset';
import { parseBriefContentSave, normalizeBriefContentSave } from '@/lib/brief-content-schema';
import { toast } from 'sonner';
import { OFFLINE_ROUTES } from '@/lib/offline-routes';

function mergeSections(
    saved: BriefSection[],
    templateSections: BriefSectionSnapshot[]
): BriefSection[] {
    const savedById = new Map(saved.map((s) => [s.id, s]));
    const mergedExisting = saved.map((section) => {
        const t = templateSections.find((x) => x.id === section.id);
        return t
            ? { ...section, label: t.label, visibility: t.visibility }
            : section;
    });
    const missing = templateSections
        .filter((s) => !savedById.has(s.id))
        .map((section, idx) => ({
            ...section,
            order: mergedExisting.length + idx
        }));
    return normalizeBriefSections([...mergedExisting, ...missing]) as BriefSection[];
}

export function BriefBuilderPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState<LocalBriefRecord | null>(null);

    useEffect(() => {
        if (!id) {
            navigate(OFFLINE_ROUTES.dashboard);
            return;
        }
        void getBrief(id).then((b) => {
            if (!b) {
                toast.error('Brief not found');
                navigate(OFFLINE_ROUTES.dashboard);
                return;
            }
            setRecord(b);
        });
    }, [id, navigate]);

    const layout = useMemo(() => {
        const parsed = parseResolvedTemplate({
            slug: DEFAULT_BRIEF_TEMPLATE.slug,
            name: DEFAULT_BRIEF_TEMPLATE.name,
            sections: DEFAULT_BRIEF_TEMPLATE.sections,
            content: {},
            links: []
        });
        return toBriefLayoutTemplate(parsed);
    }, []);

    const bootstrap = useMemo(() => {
        if (!record) return null;
        const templateSections = mapCatalogToBriefSections(layout.sections);
        const sections = mergeSections(
            record.contents.sections as BriefSection[],
            templateSections
        );
        return {
            sections,
            content: record.contents.content
        };
    }, [record, layout]);

    const persistContent = useCallback(
        async (contentData: unknown) => {
            if (!record) return false;
            const parsed = parseBriefContentSave(contentData);
            if (!parsed.success) {
                toast.error('Invalid content');
                return false;
            }
            const normalized = normalizeBriefContentSave(parsed.data);
            const next: LocalBriefRecord = {
                ...record,
                contents: {
                    ...record.contents,
                    content: normalized,
                    updatedAt: new Date().toISOString()
                }
            };
            const result = await writeBrief(next, record.revision);
            if (!result.ok) {
                toast.error('Save failed');
                return false;
            }
            setRecord(result.record);
            toast.success('Saved');
            return true;
        },
        [record]
    );

    const persistStructure = useCallback(
        async (sections: BriefSection[]) => {
            if (!record) return false;
            const next: LocalBriefRecord = {
                ...record,
                contents: {
                    ...record.contents,
                    sections,
                    updatedAt: new Date().toISOString()
                }
            };
            const result = await writeBrief(next, record.revision);
            if (!result.ok) {
                toast.error('Save failed');
                return false;
            }
            setRecord(result.record);
            toast.success('Structure saved');
            return true;
        },
        [record]
    );

    if (!record || !bootstrap) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                Loading builder…
            </div>
        );
    }

    return (
        <BriefBuilderProvider
            builderMode='brief'
            briefId={record.id}
            templateKey={layout.slug}
            layoutTemplate={layout}
            institutionalAiPolicy={getInstitutionAiPolicy()}
            initialSections={bootstrap.sections}
            initialContent={bootstrap.content}
            briefMetadata={toBuilderMetadata(record)}
            saveBriefContent={persistContent}
            saveBriefStructure={persistStructure}
            useAI={false}
            moduleRubricsEnabled={false}>
            <BuilderInteractionReset />
            <div className='brief-builder-page relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-background'>
                <header className='shrink-0 border-b px-4 py-4'>
                    <div className='flex items-center justify-between'>
                        <Button variant='ghost' size='sm' asChild>
                            <Link to={OFFLINE_ROUTES.dashboard}>
                                ← Dashboard
                            </Link>
                        </Button>
                        <h1 className='text-xl font-normal tracking-tight'>
                            Brief Builder
                        </h1>
                        <Button variant='outline' size='sm' asChild>
                            <Link to={`/briefs/${record.id}/edit`}>
                                Edit details
                            </Link>
                        </Button>
                    </div>
                </header>
                <main className='min-h-0 flex-1 overflow-hidden'>
                    <BuilderPanelsLayout />
                </main>
            </div>
        </BriefBuilderProvider>
    );
}
