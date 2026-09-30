import { describe, expect, it, vi } from 'vitest';
import {
    INSTALL_DISMISS_STORAGE_KEY,
    isInAppWebView,
    isInstallDismissed,
    isIosSafariInstallable,
    isNavigatorStandalone,
    isStandaloneDisplayMode,
    resolveInstallBannerMode,
    setInstallDismissed,
    shouldCaptureBeforeInstallPrompt
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

describe('resolveInstallBannerMode', () => {
    it('prefers chromium when deferred prompt exists', () => {
        expect(
            resolveInstallBannerMode({
                isStandalone: false,
                dismissed: false,
                sessionDismissed: false,
                hasDeferredPrompt: true,
                isIosSafari: true,
                isDev: false
            })
        ).toBe('chromium');
    });

    it('shows iOS instructions when eligible', () => {
        expect(
            resolveInstallBannerMode({
                isStandalone: false,
                dismissed: false,
                sessionDismissed: false,
                hasDeferredPrompt: false,
                isIosSafari: true,
                isDev: false
            })
        ).toBe('ios');
    });

    it('hides iOS instructions in dev', () => {
        expect(
            resolveInstallBannerMode({
                isStandalone: false,
                dismissed: false,
                sessionDismissed: false,
                hasDeferredPrompt: false,
                isIosSafari: true,
                isDev: true
            })
        ).toBe('hidden');
    });
});

describe('shouldCaptureBeforeInstallPrompt', () => {
    it('blocks capture when dismissed or standalone', () => {
        expect(
            shouldCaptureBeforeInstallPrompt({
                isStandalone: true,
                dismissed: false,
                sessionDismissed: false
            })
        ).toBe(false);
        expect(
            shouldCaptureBeforeInstallPrompt({
                isStandalone: false,
                dismissed: true,
                sessionDismissed: false
            })
        ).toBe(false);
    });
});
