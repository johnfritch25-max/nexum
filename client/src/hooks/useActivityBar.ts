/**
 * useActivityBar.ts
 *
 * Auto-detects what the user is doing using browser-available signals:
 *
 * 1. Page Visibility API — when the user leaves the Nexum tab, we check
 *    the document.title of the page they came from (not possible) BUT we
 *    can detect "away" and clear activity.
 *
 * 2. Window focus/blur — when the window loses focus, start a timer.
 *    If they don't come back in 30s, set status to "Away".
 *
 * 3. Browser tab title scanning — when Nexum is a PWA in standalone mode,
 *    other "tabs" are separate windows. We watch our own title for changes
 *    that indicate a game (e.g. Roblox web player changes the page title).
 *
 * 4. navigator.userActivation — detect if user is actively interacting.
 *
 * 5. Manual override — user can still manually set/clear from the activity bar.
 *
 * NOTE: Browsers cannot read OS process lists. This is a hard security limit.
 * The Tauri desktop build uses the real process scanner (processScanner.ts).
 * For web, we use the signals above + a smart "what are you doing?" prompt.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';

// Detect if running inside Tauri desktop app
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface ActivityInfo {
    name:       string;   // e.g. "Roblox"
    icon:       string;   // emoji
    statusText: string;   // e.g. "Playing Roblox"
    source:     'auto' | 'manual';
}

// ── Known activities matched against browser tab titles ───────────────────────
// These fire when the user has Nexum open as a PWA alongside a browser game,
// or when a game/app updates the document title.
const TITLE_PATTERNS: Array<{ match: string | RegExp; icon: string; label: string }> = [
    // Games (browser-based)
    { match: /roblox/i,           icon: '🟥', label: 'Playing Roblox'            },
    { match: /minecraft/i,        icon: '⛏️', label: 'Playing Minecraft'          },
    { match: /fortnite/i,         icon: '🏗️', label: 'Playing Fortnite'           },
    { match: /among us/i,         icon: '🚀', label: 'Playing Among Us'           },
    { match: /genshin/i,          icon: '🌸', label: 'Playing Genshin Impact'     },
    { match: /honkai/i,           icon: '🌟', label: 'Playing Honkai: Star Rail'  },
    { match: /league of legends/i,icon: '⚔️', label: 'Playing League of Legends'  },
    { match: /valorant/i,         icon: '🔫', label: 'Playing Valorant'           },
    { match: /apex legends/i,     icon: '🎯', label: 'Playing Apex Legends'       },
    { match: /rocket league/i,    icon: '🚗', label: 'Playing Rocket League'      },
    { match: /overwatch/i,        icon: '🦸', label: 'Playing Overwatch'          },
    { match: /cs2|counter-strike/i,icon: '🔫',label: 'Playing CS2'               },
    { match: /steam/i,            icon: '🎮', label: 'On Steam'                   },
    // Media
    { match: /youtube/i,          icon: '▶️', label: 'Watching YouTube'           },
    { match: /netflix/i,          icon: '🎬', label: 'Watching Netflix'           },
    { match: /twitch/i,           icon: '🟣', label: 'Watching Twitch'            },
    { match: /spotify/i,          icon: '🎵', label: 'Listening to Spotify'       },
    { match: /soundcloud/i,       icon: '🎵', label: 'Listening to SoundCloud'    },
    // Productivity
    { match: /figma/i,            icon: '🎨', label: 'Designing in Figma'         },
    { match: /notion/i,           icon: '📝', label: 'Writing in Notion'          },
    { match: /github/i,           icon: '💻', label: 'Coding on GitHub'           },
    { match: /vs code|vscode/i,   icon: '💻', label: 'Coding in VS Code'          },
    { match: /google docs/i,      icon: '📄', label: 'Writing in Google Docs'     },
    { match: /google sheets/i,    icon: '📊', label: 'Working in Google Sheets'   },
];

// Popular games for the manual picker (shown as suggestions)
export const KNOWN_GAMES: ActivityInfo[] = [
    { name: 'Roblox',            icon: '🟥', statusText: 'Playing Roblox',            source: 'manual' },
    { name: 'Minecraft',         icon: '⛏️', statusText: 'Playing Minecraft',          source: 'manual' },
    { name: 'Valorant',          icon: '🔫', statusText: 'Playing Valorant',           source: 'manual' },
    { name: 'League of Legends', icon: '⚔️', statusText: 'Playing League of Legends',  source: 'manual' },
    { name: 'Fortnite',          icon: '🏗️', statusText: 'Playing Fortnite',           source: 'manual' },
    { name: 'CS2',               icon: '🔫', statusText: 'Playing CS2',                source: 'manual' },
    { name: 'Overwatch 2',       icon: '🦸', statusText: 'Playing Overwatch 2',        source: 'manual' },
    { name: 'Rocket League',     icon: '🚗', statusText: 'Playing Rocket League',      source: 'manual' },
    { name: 'GTA V',             icon: '🚔', statusText: 'Playing GTA V',              source: 'manual' },
    { name: 'Apex Legends',      icon: '🎯', statusText: 'Playing Apex Legends',       source: 'manual' },
    { name: 'Among Us',          icon: '🚀', statusText: 'Playing Among Us',           source: 'manual' },
    { name: 'Genshin Impact',    icon: '🌸', statusText: 'Playing Genshin Impact',     source: 'manual' },
    { name: 'Honkai: Star Rail', icon: '🌟', statusText: 'Playing Honkai: Star Rail',  source: 'manual' },
    { name: 'Roblox (web)',      icon: '🟥', statusText: 'Playing Roblox',             source: 'manual' },
    { name: 'YouTube',           icon: '▶️', statusText: 'Watching YouTube',           source: 'manual' },
    { name: 'Spotify',           icon: '🎵', statusText: 'Listening to Spotify',       source: 'manual' },
    { name: 'Twitch',            icon: '🟣', statusText: 'Watching Twitch',            source: 'manual' },
    { name: 'Netflix',           icon: '🎬', statusText: 'Watching Netflix',           source: 'manual' },
    { name: 'OBS Studio',        icon: '🔴', statusText: 'Live streaming',             source: 'manual' },
];

function matchTitle(title: string): ActivityInfo | null {
    const lower = title.toLowerCase();
    for (const p of TITLE_PATTERNS) {
        const matched = typeof p.match === 'string'
            ? lower.includes(p.match.toLowerCase())
            : p.match.test(title);
        if (matched) {
            return { name: p.label, icon: p.icon, statusText: p.label, source: 'auto' };
        }
    }
    return null;
}

const AWAY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes unfocused = Away

export interface UseActivityBarReturn {
    currentActivity:  ActivityInfo | null;
    isAway:           boolean;
    setActivity:      (activity: ActivityInfo | null) => void;
    clearActivity:    () => void;
}

export function useActivityBar(
    socket:      Socket | null,
    userId:      number | null,
    isIncognito: boolean,
): UseActivityBarReturn {
    const [currentActivity, setCurrentActivity] = useState<ActivityInfo | null>(null);
    const [isAway,          setIsAway]          = useState(false);
    const lastEmittedRef  = useRef<string | null>(null);
    const awayTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
    const manualOverride  = useRef(false); // true when user manually set activity

    // ── Emit to server when activity changes ──────────────────────────────────
    useEffect(() => {
        if (!socket || !userId || isIncognito) return;
        const key = currentActivity ? currentActivity.statusText : null;
        if (key === lastEmittedRef.current) return;
        lastEmittedRef.current = key;
        socket.emit('update_activity_status', {
            userId,
            statusIcon: currentActivity?.icon  ?? null,
            statusText: currentActivity?.statusText ?? null,
        });
    }, [socket, userId, isIncognito, currentActivity]);

    // ── Auto-detect from document title (works for browser-based games/apps) ──
    useEffect(() => {
        const scan = () => {
            if (manualOverride.current) return; // don't override manual picks
            const detected = matchTitle(document.title);
            setCurrentActivity((prev) => {
                // Only update if different
                if (detected?.statusText === prev?.statusText) return prev;
                return detected;
            });
        };

        // Watch for title changes (e.g. YouTube updates title with song name)
        const titleEl = document.querySelector('title');
        const observer = new MutationObserver(scan);
        if (titleEl) observer.observe(titleEl, { childList: true });

        scan(); // run once on mount
        return () => observer.disconnect();
    }, []);

    // ── Away detection via window focus/blur ──────────────────────────────────
    useEffect(() => {
        const onFocus = () => {
            if (awayTimerRef.current) { clearTimeout(awayTimerRef.current); awayTimerRef.current = null; }
            setIsAway(false);
        };

        const onBlur = () => {
            awayTimerRef.current = setTimeout(() => {
                setIsAway(true);
                // If no manual activity set, clear auto activity when away
                if (!manualOverride.current) {
                    setCurrentActivity(null);
                }
            }, AWAY_TIMEOUT_MS);
        };

        window.addEventListener('focus', onFocus);
        window.addEventListener('blur',  onBlur);
        return () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur',  onBlur);
            if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
        };
    }, []);

    // ── Manual set ────────────────────────────────────────────────────────────
    const setActivity = useCallback((activity: ActivityInfo | null) => {
        manualOverride.current = activity !== null;
        setCurrentActivity(activity);
        setIsAway(false);
    }, []);

    const clearActivity = useCallback(() => {
        manualOverride.current = false;
        setCurrentActivity(null);
    }, []);

    // ── Tauri desktop: use real OS process scanner ────────────────────────────
    useEffect(() => {
        if (!IS_TAURI || !socket || !userId || isIncognito) return;

        // Dynamically import to avoid crashing on web
        let stopped = false;
        import('../utils/processScanner').then(({ startProcessScanner, stopProcessScanner }) => {
            if (stopped) return;
            startProcessScanner(socket, userId, () => isIncognito, 5_000);
            // Override setCurrentActivity with process scanner results via socket echo
        }).catch(() => {});

        return () => {
            stopped = true;
            import('../utils/processScanner').then(({ stopProcessScanner }) => {
                stopProcessScanner();
            }).catch(() => {});
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [IS_TAURI, socket, userId, isIncognito]);

    return { currentActivity, isAway, setActivity, clearActivity };
}
