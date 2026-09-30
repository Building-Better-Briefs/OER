import { useCallback, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import {
    INSTALL_BANNER_COLLAPSED_KEY,
    INSTALL_DISMISS_STORAGE_KEY,
    isChromiumInstallBrowser,
    isInstallBannerCollapsed,
    isInstallDismissed,
    isInAppWebView,
    isDesktopSafariInstallable,
    isIosSafariInstallable,
    isNavigatorStandalone,
    isStandaloneDisplayMode,
    resolveInstallOfferMode,
    setInstallBannerCollapsed,
    setInstallDismissed,
    shouldCaptureBeforeInstallPrompt,
    shouldShowExpandedInstallBanner,
    shouldShowInstallCompactTrigger,
    type InstallBannerMode
} from '@/lib/pwa-install-capabilities';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let bannerCollapsedSession = false;
let prompting = false;
let serviceWorkerReady = false;
const listeners = new Set<Listener>();

function emit() {
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getIsStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        isStandaloneDisplayMode((q) => window.matchMedia(q)) ||
        isNavigatorStandalone(window.navigator)
    );
}

function getInstallHidden(): boolean {
    if (typeof window === 'undefined') return false;
    return isInstallDismissed(window.localStorage);
}

function getBannerCollapsed(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        bannerCollapsedSession ||
        isInstallBannerCollapsed(window.localStorage)
    );
}

function getHasDeferredPrompt(): boolean {
    return deferredPrompt !== null;
}

function getOfferModeSnapshot(): InstallBannerMode {
    if (typeof window === 'undefined') return 'hidden';
    const ua = window.navigator.userAgent;
    if (isInAppWebView(ua)) {
        return 'hidden';
    }
    const maxTouchPoints = window.navigator.maxTouchPoints;
    const isIosSafari = isIosSafariInstallable(ua, maxTouchPoints);
    const isDesktopSafari = isDesktopSafariInstallable(ua, maxTouchPoints);
    const chromiumInstallHint =
        serviceWorkerReady &&
        isChromiumInstallBrowser(ua) &&
        !getHasDeferredPrompt();

    return resolveInstallOfferMode({
        isStandalone: getIsStandalone(),
        installHidden: getInstallHidden(),
        hasDeferredPrompt: getHasDeferredPrompt(),
        chromiumInstallHint,
        isIosSafari,
        isDesktopSafari,
        isDev: import.meta.env.DEV
    });
}

function onBeforeInstallPrompt(event: Event) {
    const e = event as BeforeInstallPromptEvent;
    if (
        !shouldCaptureBeforeInstallPrompt({
            isStandalone: getIsStandalone(),
            installHidden: getInstallHidden()
        })
    ) {
        return;
    }
    e.preventDefault();
    deferredPrompt = e;
    emit();
}

function onAppInstalled() {
    deferredPrompt = null;
    setInstallDismissed(
        typeof window !== 'undefined' ? window.localStorage : null
    );
    emit();
}

function onStorage(event: StorageEvent) {
    if (
        event.key === INSTALL_DISMISS_STORAGE_KEY ||
        event.key === INSTALL_BANNER_COLLAPSED_KEY
    ) {
        emit();
    }
}

function onDisplayModeChange() {
    emit();
}

let bootstrapped = false;

/** Older builds stored banner close as permanent dismiss; treat as collapsed. */
function migrateLegacyInstallDismiss() {
    if (typeof window === 'undefined') return;
    if (getIsStandalone()) return;
    const storage = window.localStorage;
    if (!isInstallDismissed(storage)) return;
    try {
        storage.removeItem(INSTALL_DISMISS_STORAGE_KEY);
        setInstallBannerCollapsed(storage);
    } catch {
        bannerCollapsedSession = true;
    }
}

function bootstrapPwaInstallClient() {
    if (bootstrapped || typeof window === 'undefined') {
        return;
    }
    bootstrapped = true;

    migrateLegacyInstallDismiss();

    if ('serviceWorker' in navigator) {
        if (navigator.serviceWorker.controller) {
            serviceWorkerReady = true;
        }
        void navigator.serviceWorker.ready.then(() => {
            serviceWorkerReady = true;
            emit();
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            serviceWorkerReady = true;
            emit();
        });
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    window.addEventListener('storage', onStorage);

    const queries = [
        '(display-mode: standalone)',
        '(display-mode: fullscreen)',
        '(display-mode: minimal-ui)',
        '(display-mode: window-controls-overlay)'
    ];
    for (const query of queries) {
        window.matchMedia(query).addEventListener('change', onDisplayModeChange);
    }
}

bootstrapPwaInstallClient();

export function useInstallOfferMode(): InstallBannerMode {
    return useSyncExternalStore(
        subscribe,
        getOfferModeSnapshot,
        () => 'hidden' as InstallBannerMode
    );
}

/** @deprecated Use useInstallOfferMode */
export function useInstallBannerMode(): InstallBannerMode {
    return useInstallOfferMode();
}

export function useShowExpandedInstallBanner(): boolean {
    return useSyncExternalStore(
        subscribe,
        () =>
            shouldShowExpandedInstallBanner(
                getOfferModeSnapshot(),
                getBannerCollapsed()
            ),
        () => false
    );
}

export function useShowInstallCompactTrigger(): boolean {
    return useSyncExternalStore(
        subscribe,
        () =>
            shouldShowInstallCompactTrigger(
                getOfferModeSnapshot(),
                getBannerCollapsed()
            ),
        () => false
    );
}

export function useInstallPrompting(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => prompting,
        () => false
    );
}

export function collapseInstallBanner(): void {
    bannerCollapsedSession = true;
    setInstallBannerCollapsed(
        typeof window !== 'undefined' ? window.localStorage : null
    );
    emit();
}

/** @deprecated Use collapseInstallBanner */
export function dismissInstallBanner(): void {
    collapseInstallBanner();
}

export function hasDeferredInstallPrompt(): boolean {
    return deferredPrompt !== null;
}

export function useHasDeferredInstallPrompt(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => deferredPrompt !== null,
        () => false
    );
}

export function runInstallPrompt(): Promise<void> {
    const promptEvent = deferredPrompt;
    if (prompting) {
        return Promise.resolve();
    }
    if (!promptEvent) {
        toast.message('Install from Chrome', {
            description:
                'Use the install icon in the address bar, or open the menu (⋮) and choose Install Brief Builder.'
        });
        return Promise.resolve();
    }
    prompting = true;
    emit();
    return promptEvent
        .prompt()
        .then(() => promptEvent.userChoice)
        .then((choice) => {
            deferredPrompt = null;
            if (choice.outcome === 'accepted') {
                setInstallDismissed(window.localStorage);
            }
        })
        .catch(() => {
            deferredPrompt = null;
        })
        .finally(() => {
            prompting = false;
            emit();
        });
}

export function useCollapseInstallBanner(): () => void {
    return useCallback(() => collapseInstallBanner(), []);
}
