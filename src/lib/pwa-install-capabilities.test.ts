import { describe, expect, it, vi } from 'vitest';
import {
    INSTALL_DISMISS_STORAGE_KEY,
    isChromiumInstallBrowser,
    isDesktopSafariInstallable,
    isInAppWebView,
    isSafariBrowser,
    isInstallDismissed,
    isIosSafariInstallable,
    isNavigatorStandalone,
    isStandaloneDisplayMode,
    resolveInstallOfferMode,
    setInstallDismissed,
    shouldCaptureBeforeInstallPrompt,
    shouldShowExpandedInstallBanner,
    shouldShowInstallCompactTrigger
} from '@/lib/pwa-install-capabilities';

describe('isStandaloneDisplayMode', () => {
    it('returns true when any display-mode query matches', () => {
        const match = vi.fn((query: string) => ({
            matches: query.includes('standalone')
        }));
        expect(isStandaloneDisplayMode(match)).toBe(true);
    });

    it('returns false when no query matches', () => {
        const match = vi.fn(() => ({ matches: false }));
        expect(isStandaloneDisplayMode(match)).toBe(false);
    });
});

describe('isNavigatorStandalone', () => {
    it('detects iOS standalone', () => {
        expect(
            isNavigatorStandalone({ standalone: true } as unknown as Navigator)
        ).toBe(true);
        expect(isNavigatorStandalone({} as unknown as Navigator)).toBe(false);
    });
});

describe('isIosSafariInstallable', () => {
    it('accepts iPhone Safari', () => {
        expect(
            isIosSafariInstallable(
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                5
            )
        ).toBe(true);
    });

    it('rejects Chrome on iOS', () => {
        expect(
            isIosSafariInstallable(
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
                5
            )
        ).toBe(false);
    });

    it('accepts iPad with Macintosh UA', () => {
        expect(
            isIosSafariInstallable(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
                5
            )
        ).toBe(true);
    });
});

describe('isInAppWebView', () => {
    it('detects common in-app browsers', () => {
        expect(isInAppWebView('FBAN/FBIOS')).toBe(true);
        expect(isInAppWebView('Mozilla/5.0 Instagram')).toBe(true);
        expect(isInAppWebView('Mozilla/5.0 Chrome/120')).toBe(false);
    });
});

describe('install dismiss storage', () => {
    it('reads and writes dismissal flag', () => {
        const data = new Map<string, string>();
        const storage = {
            getItem(key: string) {
                return data.get(key) ?? null;
            },
            setItem(key: string, value: string) {
                data.set(key, value);
            }
        } as unknown as Storage;

        expect(isInstallDismissed(storage)).toBe(false);
        expect(setInstallDismissed(storage)).toBe(true);
        expect(isInstallDismissed(storage)).toBe(true);
        expect(storage.getItem(INSTALL_DISMISS_STORAGE_KEY)).toBe('1');
    });

    it('handles storage errors', () => {
        const storage = {
            getItem() {
                throw new Error('blocked');
            },
            setItem() {
                throw new Error('blocked');
            }
        } as unknown as Storage;

        expect(isInstallDismissed(storage)).toBe(false);
        expect(setInstallDismissed(storage)).toBe(false);
    });
});

describe('isSafariBrowser', () => {
    it('detects desktop Safari', () => {
        expect(
            isSafariBrowser(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
            )
        ).toBe(true);
    });

    it('rejects Chrome posing as Safari', () => {
        expect(
            isSafariBrowser(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
        ).toBe(false);
    });
});

describe('isDesktopSafariInstallable', () => {
    it('is true for Mac Safari without touch', () => {
        const ua =
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
        expect(isDesktopSafariInstallable(ua, 0)).toBe(true);
        expect(isIosSafariInstallable(ua, 0)).toBe(false);
    });
});

describe('isChromiumInstallBrowser', () => {
    it('detects desktop Chrome', () => {
        expect(
            isChromiumInstallBrowser(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
        ).toBe(true);
    });

    it('rejects iOS Chrome', () => {
        expect(
            isChromiumInstallBrowser(
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1'
            )
        ).toBe(false);
    });
});

describe('resolveInstallOfferMode', () => {
    it('prefers chromium when deferred prompt exists', () => {
        expect(
            resolveInstallOfferMode({
                isStandalone: false,
                installHidden: false,
                hasDeferredPrompt: true,
                chromiumInstallHint: true,
                isIosSafari: true,
                isDesktopSafari: false,
                isDev: false
            })
        ).toBe('chromium');
    });

    it('shows manual chromium hint when SW ready but no prompt', () => {
        expect(
            resolveInstallOfferMode({
                isStandalone: false,
                installHidden: false,
                hasDeferredPrompt: false,
                chromiumInstallHint: true,
                isIosSafari: false,
                isDesktopSafari: false,
                isDev: false
            })
        ).toBe('chromium-manual');
    });

    it('shows iOS instructions when eligible', () => {
        expect(
            resolveInstallOfferMode({
                isStandalone: false,
                installHidden: false,
                hasDeferredPrompt: false,
                chromiumInstallHint: false,
                isIosSafari: true,
                isDesktopSafari: false,
                isDev: false
            })
        ).toBe('ios');
    });

    it('shows iOS instructions in dev for UI testing', () => {
        expect(
            resolveInstallOfferMode({
                isStandalone: false,
                installHidden: false,
                hasDeferredPrompt: false,
                chromiumInstallHint: false,
                isIosSafari: true,
                isDesktopSafari: false,
                isDev: true
            })
        ).toBe('ios');
    });

    it('shows desktop Safari instructions', () => {
        expect(
            resolveInstallOfferMode({
                isStandalone: false,
                installHidden: false,
                hasDeferredPrompt: false,
                chromiumInstallHint: false,
                isIosSafari: false,
                isDesktopSafari: true,
                isDev: false
            })
        ).toBe('safari-desktop');
    });
});

describe('banner vs compact trigger', () => {
    it('shows one surface at a time', () => {
        expect(shouldShowExpandedInstallBanner('chromium', false)).toBe(true);
        expect(shouldShowInstallCompactTrigger('chromium', false)).toBe(false);
        expect(shouldShowExpandedInstallBanner('chromium', true)).toBe(false);
        expect(shouldShowInstallCompactTrigger('chromium', true)).toBe(true);
    });
});

describe('shouldCaptureBeforeInstallPrompt', () => {
    it('blocks capture when install hidden or standalone', () => {
        expect(
            shouldCaptureBeforeInstallPrompt({
                isStandalone: true,
                installHidden: false
            })
        ).toBe(false);
        expect(
            shouldCaptureBeforeInstallPrompt({
                isStandalone: false,
                installHidden: true
            })
        ).toBe(false);
    });
});
