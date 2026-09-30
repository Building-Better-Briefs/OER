'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { saveStudentBriefDraft } from '@/app/actions';
import {
    mergeFieldDrafts,
    resolveHydratedDraft,
    wrapDraftForSave,
    type SyncedDraftEnvelope
} from '@/lib/student-brief-drafts';
import type { StudentDraftKind } from '@/lib/student-brief-drafts-schema';
import { studentDraftOwnerKey } from '@/lib/checklist-storage';
import {
    applyStudentIdentityDefaults,
    type StudentIdentityDefaults
} from '@/lib/student-identity';

const DEBOUNCE_MS = 300;

type UseStudentDraftSyncOptions<T> = {
    kind: StudentDraftKind;
    briefId: string;
    studentUserId?: number | null;
    syncEnabled?: boolean;
    initialServerDraft?: SyncedDraftEnvelope<T> | null;
    identityDefaults?: StudentIdentityDefaults;
    loadLocal: () => (T & { revision?: number }) | null;
    writeLocal: (draft: T) => void;
    saveLocal: (draft: T) => void;
    createEmpty: () => T;
    isStarted: (draft: T) => boolean;
    toEnvelopeData: (draft: T) => T;
    fromEnvelopeData: (data: T, revision?: number) => T & { revision?: number };
    onHydrated?: (draft: T) => void;
};

type DraftWithRevision = { revision?: number };

type SaveResponse<TPayload> =
    | { ok: true; revision: number; updatedAt: string }
    | { ok: false; error: string }
    | {
          ok: false;
          conflict: true;
          serverDraft: SyncedDraftEnvelope<TPayload>;
          revision: number;
          updatedAt: string;
      };

export function useStudentDraftSync<T>({
    kind,
    briefId,
    studentUserId,
    syncEnabled = false,
    initialServerDraft = null,
    identityDefaults,
    loadLocal,
    writeLocal,
    saveLocal,
    createEmpty,
    isStarted,
    toEnvelopeData,
    fromEnvelopeData,
    onHydrated
}: UseStudentDraftSyncOptions<T>) {
    const [hydrated, setHydrated] = useState(false);
    const [serverSavedVisible, setServerSavedVisible] = useState(false);
    const revisionRef = useRef<number | null>(initialServerDraft?.revision ?? null);
    const pendingDraftRef = useRef<T | null>(null);
    const debounceRef = useRef<number | null>(null);
    const inFlightRef = useRef(false);
    const queuedRef = useRef(false);
    const generationRef = useRef(0);
    const hideSavedRef = useRef<number | null>(null);
    const shouldPushAfterHydrateRef = useRef(false);

    const loadLocalRef = useRef(loadLocal);
    const writeLocalRef = useRef(writeLocal);
    const saveLocalRef = useRef(saveLocal);
    const createEmptyRef = useRef(createEmpty);
    const isStartedRef = useRef(isStarted);
    const toEnvelopeDataRef = useRef(toEnvelopeData);
    const fromEnvelopeDataRef = useRef(fromEnvelopeData);
    const onHydratedRef = useRef(onHydrated);
    const initialServerDraftRef = useRef(initialServerDraft);
    const identityDefaultsRef = useRef(identityDefaults);

    // Latest-callback ref idiom: these callbacks/values are read from async
    // continuations (debounced saves, server responses, conflict merges)
    // that must always see the newest closures without re-running the
    // hydrate/save effects below. Re-running those effects on every prop
    // change would re-hydrate from local/server storage and overwrite
    // in-progress student edits — see Phase 6 constraints. Assigning during
    // render (rather than in an effect) guarantees the refs are current
    // before any handler set up during this render can fire, and it works
    // today, so this is a justified disable rather than a restructure.
    /* eslint-disable react-hooks/refs -- see justification above */
    loadLocalRef.current = loadLocal;
    writeLocalRef.current = writeLocal;
    saveLocalRef.current = saveLocal;
    createEmptyRef.current = createEmpty;
    isStartedRef.current = isStarted;
    toEnvelopeDataRef.current = toEnvelopeData;
    fromEnvelopeDataRef.current = fromEnvelopeData;
    onHydratedRef.current = onHydrated;
    initialServerDraftRef.current = initialServerDraft;
    identityDefaultsRef.current = identityDefaults;
    /* eslint-enable react-hooks/refs */

    const shouldSync =
        syncEnabled && studentUserId != null && typeof studentUserId === 'number';

    const pushToServer = useCallback(
        async (draft: T): Promise<boolean> => {
            if (!shouldSync) {
                return true;
            }

            const envelope = wrapDraftForSave(
                toEnvelopeDataRef.current(draft),
                revisionRef.current ?? 0,
                new Date().toISOString()
            );

            const result = (await saveStudentBriefDraft({
                briefId,
                kind,
                payload: envelope,
                baseRevision: revisionRef.current
            })) as SaveResponse<T>;

            if (result.ok) {
                if (result.revision > 0) {
                    revisionRef.current = result.revision;
                    writeLocalRef.current(
                        fromEnvelopeDataRef.current(
                            toEnvelopeDataRef.current(draft),
                            result.revision
                        )
                    );
                }
                setServerSavedVisible(true);
                if (hideSavedRef.current) {
                    window.clearTimeout(hideSavedRef.current);
                }
                hideSavedRef.current = window.setTimeout(() => {
                    setServerSavedVisible(false);
                }, 2000);
                return true;
            }

            if ('conflict' in result && result.conflict) {
                const server = result.serverDraft;
                if (kind === 'checklist' || kind === 'submissionForm') {
                    const merged = mergeFieldDrafts(
                        kind,
                        toEnvelopeDataRef.current(draft) as never,
                        server.data as never
                    );
                    const mergedDraft = fromEnvelopeDataRef.current(
                        merged as T,
                        server.revision
                    );
                    writeLocalRef.current(mergedDraft);
                    onHydratedRef.current?.(mergedDraft);
                    revisionRef.current = server.revision;
                    toast.message('Updated elsewhere — your changes were merged.');

                    const retry = (await saveStudentBriefDraft({
                        briefId,
                        kind,
                        payload: wrapDraftForSave(
                            merged as T,
                            server.revision,
                            new Date().toISOString()
                        ),
                        baseRevision: server.revision
                    })) as SaveResponse<T>;

                    if (retry.ok) {
                        revisionRef.current = retry.revision;
                        writeLocalRef.current(
                            fromEnvelopeDataRef.current(
                                merged as T,
                                retry.revision
                            )
                        );
                        return true;
                    }

                    if ('conflict' in retry && retry.conflict) {
                        const pulled = fromEnvelopeDataRef.current(
                            retry.serverDraft.data,
                            retry.serverDraft.revision
                        );
                        writeLocalRef.current(pulled);
                        onHydratedRef.current?.(pulled);
                        revisionRef.current = retry.serverDraft.revision;
                    }
                } else {
                    const pulled = fromEnvelopeDataRef.current(
                        server.data,
                        server.revision
                    );
                    writeLocalRef.current(pulled);
                    onHydratedRef.current?.(pulled);
                    revisionRef.current = server.revision;
                }

                toast.message('Showing the latest saved version.');
                return false;
            }

            return false;
        },
        [briefId, kind, shouldSync]
    );

    const flushSave = useCallback(async () => {
        const draft = pendingDraftRef.current;
        if (!draft || !shouldSync) {
            return;
        }

        if (inFlightRef.current) {
            queuedRef.current = true;
            return;
        }

        inFlightRef.current = true;
        const generation = ++generationRef.current;

        try {
            await pushToServer(draft);
        } finally {
            inFlightRef.current = false;
            if (queuedRef.current && generation === generationRef.current) {
                queuedRef.current = false;
                void flushSave();
            }
        }
    }, [pushToServer, shouldSync]);

    const scheduleSave = useCallback(
        (draft: T) => {
            pendingDraftRef.current = draft;
            if (!shouldSync) {
                return;
            }

            if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
            }

            debounceRef.current = window.setTimeout(() => {
                debounceRef.current = null;
                void flushSave();
            }, DEBOUNCE_MS);
        },
        [flushSave, shouldSync]
    );

    const persistDraft = useCallback(
        (draft: T, options?: { immediateServer?: boolean }) => {
            saveLocalRef.current(draft);
            pendingDraftRef.current = draft;

            if (!hydrated) {
                return;
            }

            if (options?.immediateServer) {
                if (debounceRef.current) {
                    window.clearTimeout(debounceRef.current);
                    debounceRef.current = null;
                }
                void flushSave();
                return;
            }

            scheduleSave(draft);
        },
        [flushSave, hydrated, scheduleSave]
    );

    useEffect(() => {
        const ownerKey = studentDraftOwnerKey(briefId);
        const storedOwner = window.localStorage.getItem(ownerKey);
        const local = loadLocalRef.current();
        const serverDraft = initialServerDraftRef.current;
        const identity = identityDefaultsRef.current;

        shouldPushAfterHydrateRef.current = false;

        const finalizeHydratedDraft = (
            draft: T,
            shouldPushFromResolved: boolean
        ) => {
            const preDefault = draft;
            const withDefaults =
                identity != null
                    ? (applyStudentIdentityDefaults(
                          preDefault as T & {
                              studentName?: string | null;
                              studentNumber?: string | null;
                          },
                          identity
                      ) as T)
                    : preDefault;

            writeLocalRef.current(withDefaults);
            revisionRef.current =
                (withDefaults as DraftWithRevision).revision ?? revisionRef.current;
            onHydratedRef.current?.(withDefaults);

            if (
                shouldPushFromResolved &&
                shouldSync &&
                isStartedRef.current(preDefault)
            ) {
                pendingDraftRef.current = withDefaults;
                shouldPushAfterHydrateRef.current = true;
            }
        };

        if (
            shouldSync &&
            storedOwner &&
            storedOwner !== String(studentUserId)
        ) {
            if (serverDraft) {
                const pulled = fromEnvelopeDataRef.current(
                    serverDraft.data,
                    serverDraft.revision
                );
                revisionRef.current = serverDraft.revision;
                finalizeHydratedDraft(pulled, false);
            } else {
                finalizeHydratedDraft(createEmptyRef.current(), false);
                revisionRef.current = null;
            }
        } else if (!local && !serverDraft) {
            revisionRef.current = null;
            finalizeHydratedDraft(createEmptyRef.current(), false);
        } else {
            const resolved = resolveHydratedDraft(
                local as DraftWithRevision | null,
                serverDraft as SyncedDraftEnvelope<DraftWithRevision> | null,
                (draft) => isStartedRef.current(draft as T)
            );
            const draft = fromEnvelopeDataRef.current(
                resolved.draft as T,
                resolved.revision ?? undefined
            );
            revisionRef.current = resolved.revision;
            finalizeHydratedDraft(draft, resolved.shouldPush);
        }

        if (shouldSync) {
            window.localStorage.setItem(ownerKey, String(studentUserId));
        }

        // Synchronizes with external systems (localStorage + the server
        // draft prop) — the sanctioned use of an effect per this rule's
        // own guidance. Per Phase 6 constraints, do not defer this into a
        // transition/microtask: persistDraft early-returns while
        // `!hydrated`, so widening this window leaves edits local-only for
        // longer.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHydrated(true);
    }, [briefId, studentUserId, shouldSync, kind]);

    useEffect(() => {
        if (!hydrated || !shouldSync || !shouldPushAfterHydrateRef.current) {
            return;
        }

        shouldPushAfterHydrateRef.current = false;
        void flushSave();
    }, [flushSave, hydrated, shouldSync]);

    useEffect(() => {
        if (!shouldSync) {
            return;
        }

        const handleFlush = () => {
            if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
            void flushSave();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                handleFlush();
            }
        };

        window.addEventListener('pagehide', handleFlush);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('pagehide', handleFlush);
            document.removeEventListener('visibilitychange', handleVisibility);
            handleFlush();
        };
    }, [flushSave, shouldSync]);

    // Optional hardening (Phase 6): hideSavedRef's timeout previously had
    // no cleanup, so setServerSavedVisible(false) could fire after unmount.
    useEffect(() => {
        return () => {
            if (hideSavedRef.current) {
                window.clearTimeout(hideSavedRef.current);
            }
        };
    }, []);

    return {
        hydrated,
        serverSavedVisible,
        persistDraft,
        flushSave
    };
}
