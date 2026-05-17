/**
 * useIncognitoMode.ts
 *
 * Owns the full incognito mode lifecycle:
 *  - Persists preference to localStorage across reloads.
 *  - On ENABLE: stops the desktop process scanner, emits clear_activity_status.
 *  - On DISABLE: restarts the scanner; next tick re-detects the active process.
 *  - Platform-aware: scanner calls are no-ops on web/mobile (dynamic import guard).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { setIncognito as persistIncognito } from '../api/users';

const STORAGE_KEY = 'messenger_incognito';

// Detect Tauri at runtime — avoids bundling desktop APIs in web/mobile builds
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface UseIncognitoModeReturn {
    isIncognito: boolean;
    toggleIncognito: () => void;
    enableIncognito: () => void;
    disableIncognito: () => void;
}

/**
 * @param socket  Active Socket.io client instance.
 * @param userId  Authenticated user's DB id.
 */
export function useIncognitoMode(
    socket: Socket | null,
    userId: number | null
): UseIncognitoModeReturn {
    const [isIncognito, setIsIncognito] = useState<boolean>(() => {
        try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
        catch { return false; }
    });

    // Stable ref so the scanner's getter always reads the latest value
    const isIncognitoRef = useRef(isIncognito);
    isIncognitoRef.current = isIncognito;

    // ── Scanner lifecycle (desktop only) ─────────────────────────────────────
    useEffect(() => {
        if (!IS_TAURI || !socket || !userId) return;

        let stopFn: (() => void) | null = null;

        if (!isIncognito) {
            import('../utils/processScanner').then(({ startProcessScanner, stopProcessScanner }) => {
                startProcessScanner(socket, userId, () => isIncognitoRef.current);
                stopFn = stopProcessScanner;
            });
        }

        return () => { if (stopFn) stopFn(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isIncognito, socket, userId]);

    // ── Server notification ───────────────────────────────────────────────────
    const notifyServer = useCallback(
        (nextIncognito: boolean) => {
            if (!socket || !userId) return;
            if (nextIncognito) {
                // Wipe the activity icon from the server immediately via socket
                socket.emit('clear_activity_status', { userId });
            }
            // Persist the flag to the DB via REST so it survives page reloads
            persistIncognito(nextIncognito).catch((err) => {
                console.error('[useIncognitoMode] Failed to persist incognito state:', err);
            });
        },
        [socket, userId]
    );

    // ── State setters ─────────────────────────────────────────────────────────
    const applyIncognito = useCallback(
        (next: boolean) => {
            setIsIncognito(next);
            isIncognitoRef.current = next;
            try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
            notifyServer(next);
        },
        [notifyServer]
    );

    const enableIncognito  = useCallback(() => applyIncognito(true),  [applyIncognito]);
    const disableIncognito = useCallback(() => applyIncognito(false), [applyIncognito]);
    const toggleIncognito  = useCallback(() => applyIncognito(!isIncognitoRef.current), [applyIncognito]);

    return { isIncognito, toggleIncognito, enableIncognito, disableIncognito };
}
