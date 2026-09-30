import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    ViewerToolbarTooltip
} from '@/components/viewer-toolbar-tooltip';

const THEME_STORAGE_KEY = 'theme';
const THEME_CHANGE_EVENT = 'app-theme-change';

type Theme = 'light' | 'dark';

type DarkModeToggleProps = {
    variant?: 'default' | 'viewer';
    iconOnly?: boolean;
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
};

function getStoredTheme(): Theme {
    if (typeof window === 'undefined') {
        return 'light';
    }

    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
        ? 'dark'
        : 'light';
}

function getIsDarkSnapshot() {
    return getStoredTheme() === 'dark';
}

function subscribeToTheme(callback: () => void) {
    window.addEventListener(THEME_CHANGE_EVENT, callback);
    window.addEventListener('storage', callback);

    return () => {
        window.removeEventListener(THEME_CHANGE_EVENT, callback);
        window.removeEventListener('storage', callback);
    };
}

function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
}

function useTheme() {
    const isDark = useSyncExternalStore(
        subscribeToTheme,
        getIsDarkSnapshot,
        () => false
    );

    useEffect(() => {
        applyTheme(getStoredTheme());
    }, []);

    function toggleTheme() {
        applyTheme(isDark ? 'light' : 'dark');
    }

    return { isDark, toggleTheme };
}

export function DarkModeToggle({
    variant = 'default',
    iconOnly = false,
    tooltipSide = 'bottom'
}: DarkModeToggleProps) {
    const { isDark, toggleTheme } = useTheme();
    const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

    if (variant === 'viewer') {
        return (
            <ViewerToolbarTooltip
                label={isDark ? 'Light mode' : 'Dark mode'}
                enabled={iconOnly}
                side={tooltipSide}>
                <Button
                    type='button'
                    variant='ghost'
                    size={iconOnly ? 'icon' : 'sm'}
                    className={cn(
                        'font-normal cursor-pointer',
                        iconOnly && 'size-9 shrink-0',
                        !iconOnly && 'max-sm:h-8 max-sm:min-w-8 max-sm:px-1.5',
                        isDark && 'bg-transparent text-brand'
                    )}
                    aria-pressed={isDark}
                    aria-label={label}
                    onClick={toggleTheme}
                    suppressHydrationWarning>
                    {isDark ? (
                        <Sun
                            className={cn(
                                'h-4 w-4 shrink-0',
                                !iconOnly && 'sm:mr-1.5'
                            )}
                            aria-hidden
                        />
                    ) : (
                        <Moon
                            className={cn(
                                'h-4 w-4 shrink-0',
                                !iconOnly && 'sm:mr-1.5'
                            )}
                            aria-hidden
                        />
                    )}
                    {!iconOnly ? (
                        <span className='hidden sm:inline'>
                            {isDark ? 'Light' : 'Dark'}
                        </span>
                    ) : null}
                </Button>
            </ViewerToolbarTooltip>
        );
    }

    return (
        <button
            className='theme-toggle'
            type='button'
            aria-pressed={isDark}
            aria-label={label}
            onClick={toggleTheme}
            suppressHydrationWarning>
            <span className='theme-toggle__icon' aria-hidden='true'>
                {isDark ? (
                    <Sun className='size-[1.375rem]' />
                ) : (
                    <Moon className='size-[1.375rem]' />
                )}
            </span>
            <span className='visually-hidden'>{label}</span>
        </button>
    );
}
