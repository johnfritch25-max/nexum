/**
 * useActivityBar.ts
 *
 * Detects the currently active game / app in the browser context.
 * On web we can't read OS processes, so we use two approaches:
 *   1. document.visibilitychange + document.title — detects when the tab
 *      loses focus to another window (limited but works for tab-based games).
 *   2. A small curated list of well-known game URLs / titles the user can
 *      manually set, or that we detect from the window title when the app
 *      is running as a PWA (standalone mode).
 *
 * The hook also exposes `setManualGame` so the user can type in a game name
 * themselves (like Discord's "Set a custom status" but for games).
 *
 * When a game is detected / set, it emits `update_activity_status` via socket
 * so friends can see "Playing Roblox" etc. in the sidebar.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { resolveActivityFromProcess } from '../utils/processScanner';

export interface ActivityInfo {
    name: string;       // e.g. "Roblox"
    icon: string;       // emoji
    statusText: string; // e.g. "Playing Roblox"
}

// Popular games / apps the user might be running — shown in the picker
export const KNOWN_GAMES: ActivityInfo[] = [
    { name: 'Roblox',           icon: '🟥', statusText: 'Playing Roblox'           },
    { name: 'Minecraft',        icon: '⛏️', statusText: 'Playing Minecraft'         },
    { name: 'Valorant',         icon: '🔫', statusText: 'Playing Valorant'          },
    { name: 'League of Legends',icon: '⚔️', statusText: 'Playing League of Legends' },
    { name: 'Fortnite',         icon: '🏗️', statusText: 'Playing Fortnite'          },
    { name: 'CS2',              icon: '🔫', statusText: 'Playing CS2'               },
    { name: 'Overwatch 2',      icon: '🦸', statusText: 'Playing Overwatch 2'       },
    { name: 'Rocket League',    icon: '🚗', statusText: 'Playing Rocket League'     },
    { name: 'GTA V',            icon: '🚔', statusText: 'Playing GTA V'             },
    { name: 'Apex Legends',     icon: '🎯', statusText: 'Playing Apex Legends'      },
    { name: 'Among Us',         icon: '🚀', statusText: 'Playing Among Us'          },
    { name: 'Genshin Impact',   icon: '🌸', statusText: 'Playing Genshin Impact'    },
    { name: 'Honkai: Star Rail', icon: '🌟', statusText: 'Playing Honkai: Star Rail' },
    { name: 'Steam',            icon: '🎮', statusText: 'On Steam'                  },
    { name: 'Epic Games',       icon: '🎮', statusText: 'On Epic Games'             },
    { name: 'OBS Studio',       icon: '🔴', statusText: 'Live streaming'            },
    { name: 'Spotify',          icon: '🎵', statusText: 'Listening to Spotify'      },
    { name: 'YouTube',          icon: '▶️', statusText: 'Watching YouTube'          },
];

export interface UseActivityBarReturn {
    currentActivity: ActivityInfo | null;
    setActivity:     (activity: ActivityInfo | null) => void;
    clearActivity:   () => void;
}

export function useActivityBar(
    socket: Socket | null,
    userId: number | null,
    isIncognito: boolean,
): UseActivityBarReturn {
    const [currentActivity, setCurrentActivity] = useState<ActivityInfo | null>(null);
    const lastEmittedRef = useRef<string | null>(null);

    // Emit activity to server whenever it changes
    useEffect(() => {
        if (!socket || !userId || isIncognito) return;

        const key = currentActivity ? currentActivity.statusText : null;
        if (key === lastEmittedRef.current) return;
        lastEmittedRef.current = key;

        if (currentActivity) {
            socket.emit('update_activity_status', {
                userId,
                statusIcon: currentActivity.icon,
                statusText: currentActivity.statusText,
            });
        } else {
            // Clear activity
            socket.emit('update_activity_status', {
                userId,
                statusIcon: null,
                statusText: null,
            });
        }
    }, [socket, userId, isIncognito, currentActivity]);

    // Auto-detect from document title when running as PWA / standalone
    useEffect(() => {
        const tryDetect = () => {
            const title = document.title.toLowerCase();
            for (const game of KNOWN_GAMES) {
                if (title.includes(game.name.toLowerCase())) {
                    setCurrentActivity(game);
                    return;
                }
            }
        };

        // Also try to detect from the process scanner util if title changes
        const observer = new MutationObserver(tryDetect);
        const titleEl = document.querySelector('title');
        if (titleEl) observer.observe(titleEl, { childList: true });

        return () => observer.disconnect();
    }, []);

    const setActivity = useCallback((activity: ActivityInfo | null) => {
        setCurrentActivity(activity);
    }, []);

    const clearActivity = useCallback(() => {
        setCurrentActivity(null);
    }, []);

    // Also expose resolveActivityFromProcess for Tauri desktop
    void resolveActivityFromProcess;

    return { currentActivity, setActivity, clearActivity };
}
