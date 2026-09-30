import { useEffect } from 'react';

const RESIZABLE_PAGE_SELECTOR =
    '.brief-builder-page';

function isResizablePanelsPageActive() {
    return document.querySelector(RESIZABLE_PAGE_SELECTOR) !== null;
}

function isWithinResizablePage(target: EventTarget | null) {
    if (!(target instanceof Element)) {
        return false;
    }
    return target.closest(RESIZABLE_PAGE_SELECTOR) !== null;
}

function clearStuckInteractionStyles() {
    const { body, documentElement } = document;

    // Drag libraries can occasionally leave global interaction styles behind
    // if pointerup is missed (e.g. released outside viewport).
    body.style.removeProperty('cursor');
    body.style.removeProperty('user-select');
    body.style.removeProperty('-webkit-user-select');
    body.style.removeProperty('pointer-events');
    documentElement.style.removeProperty('cursor');
    documentElement.style.removeProperty('user-select');
    documentElement.style.removeProperty('-webkit-user-select');

    // If a resize separator kept focus after drag, wheel can feel "dead"
    // until another click. Blurring it restores normal wheel routing.
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement?.hasAttribute('data-slot')) {
        const slot = activeElement.getAttribute('data-slot');
        if (slot === 'resizable-handle') {
            activeElement.blur();
        }
    }
}

function getPanelScrollContainers() {
    return {
        left: document.querySelector(
            '[data-panel-scroll-container="left"]'
        ) as HTMLElement | null,
        right: document.querySelector(
            '[data-panel-scroll-container="right"]'
        ) as HTMLElement | null
    };
}

export function ResizablePanelsInteractionReset() {
    useEffect(() => {
        const handler = () => {
            if (!isResizablePanelsPageActive()) {
                return;
            }
            clearStuckInteractionStyles();
        };

        const wheelRecovery = (event: WheelEvent) => {
            if (!isWithinResizablePage(event.target)) {
                return;
            }
            clearStuckInteractionStyles();
        };

        const wheelRouter = (event: WheelEvent) => {
            if (!isWithinResizablePage(event.target)) {
                return;
            }

            const target = event.target as HTMLElement | null;
            if (!target) {
                return;
            }

            // Let the fullscreen recording overlay use native overflow scrolling.
            if (target.closest('[data-screen-recording-overlay]')) {
                return;
            }

            const { left: leftContainer, right: rightContainer } =
                getPanelScrollContainers();

            let scrollContainer = target.closest(
                '[data-panel-scroll-container]'
            ) as HTMLElement | null;

            if (!scrollContainer && leftContainer && rightContainer) {
                // Fallback routing by cursor X when event target is retargeted
                // away from panel subtree (observed intermittently after drag).
                const leftRect = leftContainer.getBoundingClientRect();
                const rightRect = rightContainer.getBoundingClientRect();
                if (
                    event.clientX >= leftRect.left &&
                    event.clientX <= leftRect.right
                ) {
                    scrollContainer = leftContainer;
                } else if (
                    event.clientX >= rightRect.left &&
                    event.clientX <= rightRect.right
                ) {
                    scrollContainer = rightContainer;
                }
            }

            if (!scrollContainer) {
                return;
            }
            if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
                return;
            }

            scrollContainer.scrollTop += event.deltaY;
            event.preventDefault();
        };

        const events: Array<keyof WindowEventMap> = [
            'pointerup',
            'mouseup',
            'touchend',
            'dragend',
            'blur',
            'pointercancel'
        ];

        events.forEach((eventName) => {
            window.addEventListener(eventName, handler, { passive: true });
        });
        window.addEventListener('wheel', wheelRecovery, {
            capture: true,
            passive: true
        });
        window.addEventListener('wheel', wheelRouter, {
            capture: true,
            passive: false
        });
        document.addEventListener('visibilitychange', handler, {
            passive: true
        });

        return () => {
            events.forEach((eventName) => {
                window.removeEventListener(eventName, handler);
            });
            window.removeEventListener('wheel', wheelRecovery, {
                capture: true
            });
            window.removeEventListener('wheel', wheelRouter, {
                capture: true
            });
            document.removeEventListener('visibilitychange', handler);
        };
    }, []);

    return null;
}
