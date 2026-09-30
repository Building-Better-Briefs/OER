import { useEffect, useSyncExternalStore } from 'react';
import { Contrast } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    ViewerToolbarTooltip
} from '@/components/viewer-toolbar-tooltip';
import { useClientMounted } from '@/hooks/use-client-mounted';

const STORAGE_KEY = 'brief-viewer-high-contrast';
const CHANGE_EVENT = 'brief-viewer-high-contrast-change';

type HighContrastToggleProps = {
    variant?: 'default' | 'viewer';
    iconOnly?: boolean;
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
};

function applyHighContrast(enabled: boolean) {
    document.querySelectorAll('.brief-viewer-page').forEach((element) => {
        element.classList.toggle('brief-viewer-high-contrast', enabled);
    });
}

// Persisted high-contrast flag, modeled as an external store so reading it
// satisfies `react-hooks/set-state-in-effect` via `useSyncExternalStore`
// (server snapshot `false`, client snapshot from localStorage) instead of
// reading localStorage and calling setState inside an effect.
function subscribe(callback: () => void) {
    window.addEventListener(CHANGE_EVENT, callback);
    window.addEventListener('storage', callback);
    return () => {
        window.removeEventListener(CHANGE_EVENT, callback);
        window.removeEventListener('storage', callback);
    };
}

function getSnapshot() {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
}

function getServerSnapshot() {
    return false;
}

function setHighContrastPersisted(enabled: boolean) {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function HighContrastToggle({
    variant = 'default',
    iconOnly = false,
    tooltipSide = 'bottom'
}: HighContrastToggleProps) {
    const isHighContrast = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    );
    const mounted = useClientMounted();

    // Keeps an external system (the DOM) in sync with the latest state —
    // the sanctioned use of an effect.
    useEffect(() => {
        applyHighContrast(isHighContrast);
    }, [isHighContrast]);

    function toggleHighContrast() {
        setHighContrastPersisted(!isHighContrast);
    }

    if (variant !== 'viewer') {
        return null;
    }

    const label = isHighContrast
        ? 'Disable high contrast'
        : 'Enable high contrast';

    return (
        <ViewerToolbarTooltip
            label={isHighContrast ? 'Standard contrast' : 'High contrast'}
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
                    mounted && isHighContrast && 'bg-transparent text-brand'
                )}
                suppressHydrationWarning
                aria-pressed={mounted ? isHighContrast : false}
                aria-label={label}
                onClick={toggleHighContrast}>
                <Contrast
                    className={cn('h-4 w-4 shrink-0', !iconOnly && 'sm:mr-1.5')}
                    aria-hidden
                />
                {!iconOnly ? (
                    <span className='hidden sm:inline'>
                        {isHighContrast ? 'Standard' : 'High contrast'}
                    </span>
                ) : null}
            </Button>
        </ViewerToolbarTooltip>
    );
}
