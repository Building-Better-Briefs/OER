/** Set after a successful install — hides all install UI. */
export const INSTALL_DISMISS_STORAGE_KEY = 'brief-builder-install-dismissed';

/** User closed the dashboard banner — show compact header control instead. */
export const INSTALL_BANNER_COLLAPSED_KEY = 'brief-builder-install-banner-collapsed';

const IOS_OTHER_BROWSER =
    /CriOS|FxiOS|EdgiOS|OPiOS|mercury|DuckDuckGo/i;

const IN_APP_WEBVIEW =
    /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|; wv\)/i;

export function isStandaloneDisplayMode(
    matchStandalone: (query: string) => { matches: boolean } | null
): boolean {
    const queries = [
        '(display-mode: standalone)',
        '(display-mode: fullscreen)',
        '(display-mode: minimal-ui)',
        '(display-mode: window-controls-overlay)'
    ];
    for (const query of queries) {
        const mq = matchStandalone(query);
        if (mq?.matches) {
            return true;
        }
    }
    return false;
}

export function isNavigatorStandalone(
    nav: Navigator | undefined
): boolean {
    if (!nav) return false;
    const ios = nav as Navigator & { standalone?: boolean };
    return ios.standalone === true;
}

export function isInAppWebView(userAgent: string): boolean {
    return IN_APP_WEBVIEW.test(userAgent);
}

/** Chromium desktop/Android where custom install UI or address-bar install applies. */
export function isChromiumInstallBrowser(userAgent: string): boolean {
    if (isInAppWebView(userAgent)) {
        return false;
    }
    if (IOS_OTHER_BROWSER.test(userAgent)) {
        return false;
    }
    return /Chrome|Chromium|Edg\//i.test(userAgent);
}

/** Safari on iPhone, iPad, or iPadOS (Mac UA with touch). */
export function isIosSafariInstallable(
    userAgent: string,
    maxTouchPoints: number
): boolean {
    if (!isSafariBrowser(userAgent)) {
        return false;
    }
    if (/iPhone|iPod/i.test(userAgent)) {
        return true;
    }
    if (/iPad/i.test(userAgent)) {
        return true;
    }
    if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) {
        return true;
    }
    return false;
}

/** WebKit Safari (not Chrome, Edge, Firefox, or in-app browsers). */
export function isSafariBrowser(userAgent: string): boolean {
    if (isInAppWebView(userAgent)) {
        return false;
    }
    if (IOS_OTHER_BROWSER.test(userAgent)) {
        return false;
    }
    if (/Chrome|Chromium|Edg\/|Firefox|FxiOS/i.test(userAgent)) {
        return false;
    }
    return /Safari/i.test(userAgent);
}

/** macOS Safari in a normal browser tab (Add to Dock). */
export function isDesktopSafariInstallable(
    userAgent: string,
    maxTouchPoints: number
): boolean {
    return (
        isSafariBrowser(userAgent) &&
        !isIosSafariInstallable(userAgent, maxTouchPoints)
    );
}

export function isInstallDismissed(storage: Storage | null): boolean {
    if (!storage) return false;
    try {
        return storage.getItem(INSTALL_DISMISS_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function setInstallDismissed(storage: Storage | null): boolean {
    if (!storage) return false;
    try {
        storage.setItem(INSTALL_DISMISS_STORAGE_KEY, '1');
        return true;
    } catch {
        return false;
    }
}

export function isInstallBannerCollapsed(storage: Storage | null): boolean {
    if (!storage) return false;
    try {
        return storage.getItem(INSTALL_BANNER_COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}

export function setInstallBannerCollapsed(storage: Storage | null): boolean {
    if (!storage) return false;
    try {
        storage.setItem(INSTALL_BANNER_COLLAPSED_KEY, '1');
        return true;
    } catch {
        return false;
    }
}

export type InstallBannerMode =
    | 'hidden'
    | 'chromium'
    | 'chromium-manual'
    | 'ios'
    | 'safari-desktop';

export function resolveInstallOfferMode(input: {
    isStandalone: boolean;
    installHidden: boolean;
    hasDeferredPrompt: boolean;
    chromiumInstallHint: boolean;
    isIosSafari: boolean;
    isDesktopSafari: boolean;
    isDev: boolean;
}): InstallBannerMode {
    if (input.isStandalone || input.installHidden) {
        return 'hidden';
    }
    if (input.hasDeferredPrompt) {
        return 'chromium';
    }
    if (input.chromiumInstallHint && !input.isDev) {
        return 'chromium-manual';
    }
    if (input.isIosSafari) {
        return 'ios';
    }
    if (input.isDesktopSafari) {
        return 'safari-desktop';
    }
    return 'hidden';
}

export function shouldShowExpandedInstallBanner(
    offerMode: InstallBannerMode,
    collapsed: boolean
): boolean {
    return offerMode !== 'hidden' && !collapsed;
}

export function shouldShowInstallCompactTrigger(
    offerMode: InstallBannerMode,
    collapsed: boolean
): boolean {
    return offerMode !== 'hidden' && collapsed;
}

export function shouldCaptureBeforeInstallPrompt(input: {
    isStandalone: boolean;
    installHidden: boolean;
}): boolean {
    return !input.isStandalone && !input.installHidden;
}

export function getInstallOfferCopy(mode: InstallBannerMode): {
    title: string;
    description: string;
    showInstallButton: boolean;
} {
    switch (mode) {
        case 'chromium':
            return {
                title: 'Install Brief Builder',
                description:
                    'Standalone window and quicker return visits. Export backups regularly.',
                showInstallButton: true
            };
        case 'chromium-manual':
            return {
                title: 'Install Brief Builder',
                description:
                    'Add to your device for a standalone window and quicker return visits. Export backups regularly.',
                showInstallButton: true
            };
        case 'ios':
            return {
                title: 'Install Brief Builder',
                description:
                    'Tap Share, then Add to Home Screen. Export backups regularly.',
                showInstallButton: false
            };
        case 'safari-desktop':
            return {
                title: 'Install Brief Builder',
                description:
                    'In Safari, open the File menu and choose Add to Dock (or Share → Add to Dock). Export backups regularly.',
                showInstallButton: false
            };
        default:
            return {
                title: 'Install Brief Builder',
                description: '',
                showInstallButton: false
            };
    }
}

/** @deprecated Use resolveInstallOfferMode */
export function resolveInstallBannerMode(input: {
    isStandalone: boolean;
    dismissed: boolean;
    sessionDismissed: boolean;
    hasDeferredPrompt: boolean;
    chromiumInstallHint: boolean;
    isIosSafari: boolean;
    isDev: boolean;
}): InstallBannerMode {
    return resolveInstallOfferMode({
        isStandalone: input.isStandalone,
        installHidden: input.dismissed || input.sessionDismissed,
        hasDeferredPrompt: input.hasDeferredPrompt,
        chromiumInstallHint: input.chromiumInstallHint,
        isIosSafari: input.isIosSafari,
        isDesktopSafari: false,
        isDev: input.isDev
    });
}
