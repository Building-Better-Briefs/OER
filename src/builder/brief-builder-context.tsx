import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    ReactNode,
    Dispatch,
    SetStateAction
} from 'react';
import type { BriefReviewSource } from '@/lib/brief-review-source';
import { isBriefStatusValue, type BriefStatusValue } from '@/lib/brief-status';
import type { BriefLayoutTemplate } from '@/lib/brief-template';
import type { InstitutionalAiPolicy } from '@/lib/institution-config';
import {
    readBuilderStudentPreviewOpen,
    writeBuilderStudentPreviewOpen
} from '@/lib/builder-preview-preference';

export interface BriefSection {
    id: string;
    label: string;
    visibility: 'required' | 'recommended' | 'optional';
    enabled: boolean;
    order: number;
}

export interface BriefMetadata {
    /** Display name from DB (`programmes.name`); preferred over template label in UI. */
    programmeName: string;
    module: string;
    title: string;
    lecturer: string;
    startDate: Date;
    submissionDate: Date;
    individualGroup: string;
}

export type PreviewLayoutController = {
    applyPreviewOpen: (open: boolean) => void;
};

export type BuilderMode = 'brief' | 'template';

interface BriefBuilderContextType {
    builderMode: BuilderMode;
    briefId?: string;
    templateKey: string;
    layoutTemplate: BriefLayoutTemplate;
    institutionalAiPolicy: InstitutionalAiPolicy;
    saveBriefContent?: (content: unknown) => Promise<boolean>;
    saveBriefStructure?: (sections: BriefSection[]) => Promise<boolean>;
    briefContent: string;
    setBriefContent: (content: string) => void;
    sections: BriefSection[];
    setSections: (sections: BriefSection[]) => void;
    /** When false, the student preview panel is collapsed and the editor is centered. */
    isStudentPreviewOpen: boolean;
    setStudentPreviewOpen: Dispatch<SetStateAction<boolean>>;
    /** Updates preview visibility, persists preference, and applies panel layout synchronously. */
    setStudentPreviewOpenWithLayout: (open: boolean) => void;
    registerPreviewLayoutController: (
        controller: PreviewLayoutController | null
    ) => void;
    previewMode: 'desktop' | 'mobile';
    setPreviewMode: (mode: 'desktop' | 'mobile') => void;
    isDirty: boolean;
    setIsDirty: (dirty: boolean) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentContent: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateContent: (content: any) => void;
    /** Merge fields into preview content without marking the brief dirty. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mergePreviewContent: (patch: Record<string, any>) => void;
    briefMetadata: BriefMetadata;
    /** Public viewer slug for preview links (when published). */
    viewerSlug?: string;
    setViewerSlug: (slug: string) => void;
    briefStatus: BriefStatusValue;
    isStatusSaving: boolean;
    statusError: string | null;
    setBriefStatus: (status: BriefStatusValue) => Promise<boolean>;
    syncBriefStatus: (status: BriefStatusValue) => void;
    showPublishHint: boolean;
    triggerPublishHint: () => void;
    dismissPublishHint: () => void;
    selfAssessmentLinkEnabled: boolean;
    setSelfAssessmentLinkEnabled: (enabled: boolean) => void;
    publishAssetsRefreshKey: number;
    refreshPublishAssets: () => void;
    reviewSource: BriefReviewSource | null;
    useAI: boolean;
    moduleRubricsEnabled: boolean;
    accessRole: 'owner' | 'collaborator';
}

const BriefBuilderContext = createContext<BriefBuilderContextType | undefined>(
    undefined
);

export function useBriefBuilder() {
    const context = useContext(BriefBuilderContext);
    if (!context) {
        throw new Error(
            'useBriefBuilder must be used within a BriefBuilderProvider'
        );
    }
    return context;
}

export function useBriefBuilderOptional() {
    return useContext(BriefBuilderContext);
}

interface BriefBuilderProviderProps {
    children: ReactNode;
    builderMode?: BuilderMode;
    briefId?: string;
    templateKey: string;
    layoutTemplate: BriefLayoutTemplate;
    institutionalAiPolicy: InstitutionalAiPolicy;
    saveBriefContent?: (content: unknown) => Promise<boolean>;
    saveBriefStructure?: (sections: BriefSection[]) => Promise<boolean>;
    initialSections?: BriefSection[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent?: any;
    briefMetadata: BriefMetadata;
    viewerSlug?: string;
    initialStatus?: BriefStatusValue;
    reviewSource?: BriefReviewSource | null;
    useAI: boolean;
    moduleRubricsEnabled?: boolean;
    accessRole?: 'owner' | 'collaborator';
}

export function BriefBuilderProvider({
    children,
    builderMode = 'brief',
    briefId,
    templateKey,
    layoutTemplate,
    institutionalAiPolicy,
    saveBriefContent,
    saveBriefStructure,
    initialSections = [],
    initialContent = null,
    briefMetadata,
    viewerSlug: initialViewerSlug,
    initialStatus = 'DRAFT',
    reviewSource = null,
    useAI,
    moduleRubricsEnabled = false,
    accessRole = 'owner'
}: BriefBuilderProviderProps) {
    const [briefContent, setBriefContent] = useState('');
    const [sections, setSections] = useState<BriefSection[]>(initialSections);
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>(
        'desktop'
    );
    const [isStudentPreviewOpen, setStudentPreviewOpenState] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [currentContent, setCurrentContent] = useState<any>(initialContent);
    const [viewerSlug, setViewerSlugState] = useState<string | undefined>(
        initialViewerSlug
    );
    const [briefStatus, setBriefStatusState] =
        useState<BriefStatusValue>(initialStatus);
    const [isStatusSaving, setIsStatusSaving] = useState(false);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [showPublishHint, setShowPublishHint] = useState(false);
    const isStatusSavingRef = useRef(false);
    const [selfAssessmentLinkEnabled, setSelfAssessmentLinkEnabledState] =
        useState(initialContent?.selfAssessmentLinkEnabled !== false);
    const [publishAssetsRefreshKey, setPublishAssetsRefreshKey] = useState(0);
    const previewLayoutControllerRef = useRef<PreviewLayoutController | null>(
        null
    );

    const registerPreviewLayoutController = useCallback(
        (controller: PreviewLayoutController | null) => {
            previewLayoutControllerRef.current = controller;
        },
        []
    );

    const persistStudentPreviewOpen = useCallback(
        (value: SetStateAction<boolean>) => {
            setStudentPreviewOpenState((prev) => {
                const next =
                    typeof value === 'function' ? value(prev) : value;
                if (next !== prev) {
                    writeBuilderStudentPreviewOpen(next);
                }
                return next;
            });
        },
        []
    );

    const setStudentPreviewOpenWithLayout = useCallback((open: boolean) => {
        writeBuilderStudentPreviewOpen(open);
        setStudentPreviewOpenState(open);
        previewLayoutControllerRef.current?.applyPreviewOpen(open);
    }, []);

    useEffect(() => {
        // Synchronizes with an external system (localStorage) on mount —
        // the sanctioned use of an effect per this rule's own guidance.
        const storedOpen = readBuilderStudentPreviewOpen();
        if (!storedOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStudentPreviewOpenState(false);
        }
    }, []);

    const refreshPublishAssets = useCallback(() => {
        if (builderMode === 'template') {
            return;
        }
        setPublishAssetsRefreshKey((current) => current + 1);
    }, [builderMode]);

    const setViewerSlug = useCallback((slug: string) => {
        setViewerSlugState(slug);
    }, []);

    const triggerPublishHint = useCallback(() => {
        setShowPublishHint(true);
    }, []);

    const dismissPublishHint = useCallback(() => {
        setShowPublishHint(false);
    }, []);

    const syncBriefStatus = useCallback((status: BriefStatusValue) => {
        setBriefStatusState(status);
    }, []);

    const setBriefStatus = useCallback(
        async (status: BriefStatusValue): Promise<boolean> => {
            syncBriefStatus(status);
            return true;
        },
        [syncBriefStatus]
    );

    const setSelfAssessmentLinkEnabled = useCallback((enabled: boolean) => {
        setSelfAssessmentLinkEnabledState(enabled);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCurrentContent((prev: any) => ({
            ...(prev ?? {}),
            selfAssessmentLinkEnabled: enabled
        }));
        setIsDirty(true);
    }, []);

    const setBriefContentDirty = useCallback((content: string) => {
        setBriefContent(content);
        setIsDirty(true);
    }, []);

    const setSectionsDirty = useCallback((newSections: BriefSection[]) => {
        setSections(newSections);
        setIsDirty(true);
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateContent = useCallback((content: any) => {
        setCurrentContent(content);
        if (typeof content?.selfAssessmentLinkEnabled === 'boolean') {
            setSelfAssessmentLinkEnabledState(
                content.selfAssessmentLinkEnabled
            );
        }
    }, []);

    const mergePreviewContent = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (patch: Record<string, any>) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setCurrentContent((prev: any) => ({
                ...(prev ?? {}),
                ...patch
            }));
        },
        []
    );

    const value: BriefBuilderContextType = useMemo(
        () => ({
            builderMode,
            briefId,
            templateKey,
            layoutTemplate,
            institutionalAiPolicy,
            saveBriefContent,
            saveBriefStructure,
            briefContent,
            setBriefContent: setBriefContentDirty,
            sections,
            setSections: setSectionsDirty,
            isStudentPreviewOpen,
            setStudentPreviewOpen: persistStudentPreviewOpen,
            setStudentPreviewOpenWithLayout,
            registerPreviewLayoutController,
            previewMode,
            setPreviewMode,
            isDirty,
            setIsDirty,
            initialContent,
            currentContent,
            updateContent,
            mergePreviewContent,
            briefMetadata,
            viewerSlug,
            setViewerSlug,
            briefStatus,
            isStatusSaving,
            statusError,
            setBriefStatus,
            syncBriefStatus,
            showPublishHint,
            triggerPublishHint,
            dismissPublishHint,
            selfAssessmentLinkEnabled,
            setSelfAssessmentLinkEnabled,
            publishAssetsRefreshKey,
            refreshPublishAssets,
            reviewSource,
            useAI,
            moduleRubricsEnabled,
            accessRole
        }),
        [
            builderMode,
            briefId,
            templateKey,
            layoutTemplate,
            institutionalAiPolicy,
            saveBriefContent,
            saveBriefStructure,
            briefContent,
            setBriefContentDirty,
            sections,
            setSectionsDirty,
            isStudentPreviewOpen,
            persistStudentPreviewOpen,
            setStudentPreviewOpenWithLayout,
            registerPreviewLayoutController,
            previewMode,
            isDirty,
            initialContent,
            currentContent,
            updateContent,
            mergePreviewContent,
            briefMetadata,
            viewerSlug,
            setViewerSlug,
            briefStatus,
            isStatusSaving,
            statusError,
            setBriefStatus,
            syncBriefStatus,
            showPublishHint,
            triggerPublishHint,
            dismissPublishHint,
            selfAssessmentLinkEnabled,
            setSelfAssessmentLinkEnabled,
            publishAssetsRefreshKey,
            refreshPublishAssets,
            reviewSource,
            useAI,
            moduleRubricsEnabled,
            accessRole
        ]
    );

    return (
        <BriefBuilderContext.Provider value={value}>
            {children}
        </BriefBuilderContext.Provider>
    );
}
