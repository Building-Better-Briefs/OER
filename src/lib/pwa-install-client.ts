import { useCallback, useSyncExternalStore } from 'react';
import {
    INSTALL_DISMISS_STORAGE_KEY,
    isInstallDismissed,
    isInAppWebView,
    isIosSafariInstallable,
    isNavigatorStandalone,
    isStandaloneDisplayMode,
    resolveInstallBannerMode,
    setInstallDismissed,
    shouldCaptureBeforeInstallPrompt,
    type InstallBannerMode
} from '@/lib/pwa-install-capabilities';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let sessionDismissed = false;
let prompting = false;
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

function getDismissed(): boolean {
    if (typeof window === 'undefined') return false;
    return isInstallDismissed(window.localStorage);
}

function getHasDeferredPrompt(): boolean {
    return deferredPrompt !== null;
}

function getBannerModeSnapshot(): InstallBannerMode {
    if (typeof window === 'undefined') return 'hidden';
    const ua = window.navigator.userAgent;
    if (isInAppWebView(ua)) {
        return 'hidden';
    }
    const isIosSafari = isIosSafariInstallable(
        ua,
        window.navigator.maxTouchPoints
    );
    return resolveInstallBannerMode({
        isStandalone: getIsStandalone(),
        dismissed: getDismissed(),
        sessionDismissed,
        hasDeferredPrompt: getHasDeferredPrompt(),
        isIosSafari,
        isDev: import.meta.env.DEV
    });
}

function onBeforeInstallPrompt(event: Event) {
    const e = event as BeforeInstallPromptEvent;
    if (getIsStandalone()) {
        return;
    }
    if (
        !shouldCaptureBeforeInstallPrompt({
            isStandalone: getIsStandalone(),
            dismissed: getDismissed(),
            sessionDismissed
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
    if (event.key === INSTALL_DISMISS_STORAGE_KEY) {
        emit();
    }
}

function onDisplayModeChange() {
    emit();
}

let bootstrapped = false;

function bootstrapPwaInstallClient() {
    if (bootstrapped || typeof window === 'undefined') {
        return;
    }
    bootstrapped = true;

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

export function useInstallBannerMode(): InstallBannerMode {
    return useSyncExternalStore(
        subscribe,
        getBannerModeSnapshot,
        () => 'hidden' as InstallBannerMode
    );
}

export function useInstallPrompting(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => prompting,
        () => false
    );
}

export function dismissInstallBanner(): void {
    sessionDismissed = true;
    setInstallDismissed(
        typeof window !== 'undefined' ? window.localStorage : null
    );
    emit();
}

export function runInstallPrompt(): Promise<void> {
    const promptEvent = deferredPrompt;
    if (!promptEvent || prompting) {
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

export function useDismissInstallBanner(): () => void {
    return useCallback(() => dismissInstallBanner(), []);
}
