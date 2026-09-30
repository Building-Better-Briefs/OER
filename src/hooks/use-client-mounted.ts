import { useSyncExternalStore } from 'react';

function subscribe() {
    // The client-mounted flag never changes after the initial client
    // render, so there is nothing to subscribe to — return a no-op
    // unsubscribe.
    return () => {};
}

function getClientSnapshot() {
    return true;
}

function getServerSnapshot() {
    return false;
}

/**
 * True once React has hydrated on the client — use to skip Radix on SSR /
 * first paint and avoid useId hydration drift.
 *
 * Implemented with `useSyncExternalStore` (server snapshot `false`, client
 * snapshot `true`) rather than `setState` in an effect: this is the
 * pattern React's own tooling recommends for "is this the client" checks,
 * and it avoids an extra render pass.
 */
export function useClientMounted() {
    return useSyncExternalStore(
        subscribe,
        getClientSnapshot,
        getServerSnapshot
    );
}
