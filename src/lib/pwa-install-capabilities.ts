export const INSTALL_DISMISS_STORAGE_KEY = 'brief-builder-install-dismissed';

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

export function isIosSafariInstallable(
    userAgent: string,
    maxTouchPoints: number
): boolean {
    if (IOS_OTHER_BROWSER.test(userAgent)) {
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

export type InstallBannerMode = 'hidden' | 'chromium' | 'ios';

export function resolveInstallBannerMode(input: {
    isStandalone: boolean;
    dismissed: boolean;
    sessionDismissed: boolean;
    hasDeferredPrompt: boolean;
    isIosSafari: boolean;
    isDev: boolean;
}): InstallBannerMode {
    if (input.isStandalone || input.dismissed || input.sessionDismissed) {
        return 'hidden';
    }
    if (input.hasDeferredPrompt) {
        return 'chromium';
    }
    if (input.isIosSafari && !input.isDev) {
        return 'ios';
    }
    return 'hidden';
}

export function shouldCaptureBeforeInstallPrompt(input: {
    isStandalone: boolean;
    dismissed: boolean;
    sessionDismissed: boolean;
}): boolean {
    return (
        !input.isStandalone &&
        !input.dismissed &&
        !input.sessionDismissed
    );
}
