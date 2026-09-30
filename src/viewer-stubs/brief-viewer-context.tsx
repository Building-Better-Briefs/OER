import {
    createContext,
    useCallback,
    useContext,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction
} from 'react';
import type { BriefViewerAction } from '@/lib/brief-viewer-actions';
import {
    DEFAULT_BRIEF_VIEWER_TOOLBAR_VISIBILITY,
    readStoredAudioSettings,
    type AudioSettings,
    type BriefViewerToolbarVisibility,
    type FontSize
} from '@/viewer-stubs/brief-viewer-settings';

export type BriefViewerTocEntry = {
    id: string;
    label: string;
};

type BriefViewerContextValue = {
    focusModeEnabled: boolean;
    setFocusModeEnabled: Dispatch<SetStateAction<boolean>>;
    tocEntries: BriefViewerTocEntry[];
    setTocEntries: Dispatch<SetStateAction<BriefViewerTocEntry[]>>;
    registerScrollToBriefSection: (handler: (sectionId: string) => void) => void;
    scrollToBriefSection: (sectionId: string) => void;
    fontSize: FontSize;
    setFontSize: Dispatch<SetStateAction<FontSize>>;
    audioSettings: AudioSettings;
    setAudioSettings: Dispatch<SetStateAction<AudioSettings>>;
    viewerActions: BriefViewerAction[];
    setViewerActions: Dispatch<SetStateAction<BriefViewerAction[]>>;
    toolbarVisibility: BriefViewerToolbarVisibility;
    viewerSlug?: string;
    trackEngagement: boolean;
    showDarkMode: boolean;
};

const BriefViewerContext = createContext<BriefViewerContextValue | null>(null);

export function useBriefViewerOptional() {
    return useContext(BriefViewerContext);
}

/** Builder preview: no student viewer chrome; context methods are no-ops. */
export function BriefViewerProvider({ children }: { children: ReactNode }) {
    const [focusModeEnabled, setFocusModeEnabled] = useState(false);
    const [tocEntries, setTocEntries] = useState<BriefViewerTocEntry[]>([]);
    const [fontSize, setFontSize] = useState<FontSize>('normal');
    const [audioSettings, setAudioSettings] = useState(readStoredAudioSettings);
    const [viewerActions, setViewerActions] = useState<BriefViewerAction[]>(
        []
    );
    const scrollRef = useCallback((_handler: (sectionId: string) => void) => {}, []);
    const scrollToBriefSection = useCallback((_sectionId: string) => {}, []);

    const value: BriefViewerContextValue = {
        focusModeEnabled,
        setFocusModeEnabled,
        tocEntries,
        setTocEntries,
        registerScrollToBriefSection: scrollRef,
        scrollToBriefSection,
        fontSize,
        setFontSize,
        audioSettings,
        setAudioSettings,
        viewerActions,
        setViewerActions,
        toolbarVisibility: DEFAULT_BRIEF_VIEWER_TOOLBAR_VISIBILITY,
        trackEngagement: false,
        showDarkMode: true
    };

    return (
        <BriefViewerContext.Provider value={value}>
            {children}
        </BriefViewerContext.Provider>
    );
}
