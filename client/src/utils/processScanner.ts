/**
 * processScanner.ts
 *
 * Desktop-only utility that:
 *  1. Periodically invokes the Tauri Rust command `get_active_process`.
 *  2. Maps the returned executable name to a human-readable label and emoji.
 *  3. Dispatches `update_activity_status` to the WebSocket server when the
 *     active process changes.
 *  4. Respects incognito mode — scanning is fully suspended when active.
 *
 * Only imported by the Tauri desktop build. Web/mobile builds never call
 * startProcessScanner() because the dynamic import is guarded by IS_TAURI.
 */

import type { Socket } from 'socket.io-client';

// Tauri's invoke is loaded dynamically at runtime only when running inside
// the desktop app. On web this import never executes, preventing a crash.
type InvokeFn = (cmd: string) => Promise<unknown>;
let _invoke: InvokeFn | null = null;

async function getInvoke(): Promise<InvokeFn | null> {
    if (_invoke) return _invoke;
    try {
        const mod = await import('@tauri-apps/api/core');
        _invoke = mod.invoke as InvokeFn;
        return _invoke;
    } catch {
        return null;
    }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ActiveProcessInfo {
    process_name: string;
    window_title: string;
}

export interface ResolvedActivity {
    processName: string;
    windowTitle: string;
    statusIcon: string;
    statusText: string;
}

// ── Process → Activity mapping ───────────────────────────────────────────────
// Keys are lowercase substrings matched against the executable name.

const PROCESS_MAP: Array<{ match: string; icon: string; label: string }> = [
    // Development tools
    { match: 'code',             icon: '💻', label: 'Coding in VS Code'          },
    { match: 'cursor',           icon: '💻', label: 'Coding in Cursor'           },
    { match: 'webstorm',         icon: '💻', label: 'Coding in WebStorm'         },
    { match: 'rider',            icon: '💻', label: 'Coding in Rider'            },
    { match: 'intellij',         icon: '💻', label: 'Coding in IntelliJ'         },
    { match: 'pycharm',          icon: '🐍', label: 'Coding in PyCharm'          },
    { match: 'android studio',   icon: '📱', label: 'Building in Android Studio' },
    { match: 'xcode',            icon: '🍎', label: 'Building in Xcode'          },
    // Browsers
    { match: 'chrome',           icon: '🌐', label: 'Browsing the web'           },
    { match: 'firefox',          icon: '🦊', label: 'Browsing with Firefox'      },
    { match: 'safari',           icon: '🧭', label: 'Browsing with Safari'       },
    { match: 'msedge',           icon: '🌐', label: 'Browsing with Edge'         },
    { match: 'brave',            icon: '🦁', label: 'Browsing with Brave'        },
    // Communication
    { match: 'discord',          icon: '🎮', label: 'On Discord'                 },
    { match: 'slack',            icon: '💬', label: 'On Slack'                   },
    { match: 'teams',            icon: '💼', label: 'In a Teams meeting'         },
    { match: 'zoom',             icon: '📹', label: 'In a Zoom call'             },
    { match: 'skype',            icon: '📞', label: 'On Skype'                   },
    // Media
    { match: 'spotify',          icon: '🎵', label: 'Listening to Spotify'       },
    { match: 'vlc',              icon: '🎬', label: 'Watching a video'           },
    { match: 'obs',              icon: '🔴', label: 'Live streaming'             },
    // Games
    { match: 'minecraft',        icon: '⛏️', label: 'Playing Minecraft'          },
    { match: 'steam',            icon: '🎮', label: 'On Steam'                   },
    { match: 'epicgames',        icon: '🎮', label: 'On Epic Games'              },
    { match: 'leagueclient',     icon: '⚔️', label: 'Playing League of Legends'  },
    { match: 'valorant',         icon: '🔫', label: 'Playing Valorant'           },
    { match: 'fortnite',         icon: '🏗️', label: 'Playing Fortnite'           },
    { match: 'cs2',              icon: '🔫', label: 'Playing CS2'                },
    { match: 'csgo',             icon: '🔫', label: 'Playing CS:GO'              },
    { match: 'overwatch',        icon: '🦸', label: 'Playing Overwatch'          },
    { match: 'rocketleague',     icon: '🚗', label: 'Playing Rocket League'      },
    // Productivity
    { match: 'figma',            icon: '🎨', label: 'Designing in Figma'         },
    { match: 'photoshop',        icon: '🖼️', label: 'Editing in Photoshop'       },
    { match: 'blender',          icon: '🧊', label: 'Creating in Blender'        },
    { match: 'notion',           icon: '📝', label: 'Writing in Notion'          },
    { match: 'word',             icon: '📄', label: 'Writing in Word'            },
    { match: 'excel',            icon: '📊', label: 'Working in Excel'           },
    { match: 'windowsterminal',  icon: '⌨️', label: 'In Windows Terminal'        },
    { match: 'powershell',       icon: '⌨️', label: 'In PowerShell'              },
    { match: 'iterm',            icon: '⌨️', label: 'In iTerm2'                  },
    { match: 'terminal',         icon: '⌨️', label: 'In the terminal'            },
];

const FALLBACK_ACTIVITY = { statusIcon: '🖥️', statusText: 'On their computer' };

/**
 * Maps a raw executable name to a display icon and label.
 */
export function resolveActivityFromProcess(
    processName: string
): Pick<ResolvedActivity, 'statusIcon' | 'statusText'> {
    const lower = processName.toLowerCase();
    for (const entry of PROCESS_MAP) {
        if (lower.includes(entry.match)) {
            return { statusIcon: entry.icon, statusText: entry.label };
        }
    }
    return { ...FALLBACK_ACTIVITY };
}

// ── Scanner state ────────────────────────────────────────────────────────────

let scanIntervalId: ReturnType<typeof setInterval> | null = null;
let lastProcessName = '';

/**
 * Starts the periodic process scanner.
 *
 * @param socket       Active Socket.io client instance.
 * @param userId       Authenticated user's DB id.
 * @param isIncognito  Reactive getter — checked before each scan tick.
 * @param intervalMs   Poll interval in milliseconds (default 10 000).
 */
export function startProcessScanner(
    socket: Socket,
    userId: number,
    isIncognito: () => boolean,
    intervalMs = 10_000
): void {
    if (scanIntervalId !== null) {
        console.warn('[ProcessScanner] Already running. Call stopProcessScanner() first.');
        return;
    }

    console.log(`[ProcessScanner] Starting — ${intervalMs}ms interval for user ${userId}.`);

    const scan = async (): Promise<void> => {
        if (isIncognito()) return;

        const invoke = await getInvoke();
        if (!invoke) return; // not running inside Tauri desktop

        let info: ActiveProcessInfo;
        try {
            info = await invoke('get_active_process') as ActiveProcessInfo;
        } catch (err) {
            console.debug('[ProcessScanner] get_active_process error:', err);
            return;
        }

        // Only dispatch when the process actually changes
        if (info.process_name === lastProcessName) return;

        lastProcessName = info.process_name;

        const { statusIcon, statusText } = resolveActivityFromProcess(info.process_name);

        socket.emit('update_activity_status', { userId, statusIcon, statusText });

        console.log(`[ProcessScanner] Activity → ${statusIcon} "${statusText}" (${info.process_name})`);
    };

    void scan();
    scanIntervalId = setInterval(() => void scan(), intervalMs);
}

/**
 * Stops the scanner and resets state.
 * Call this when incognito is enabled or the component unmounts.
 */
export function stopProcessScanner(): void {
    if (scanIntervalId !== null) {
        clearInterval(scanIntervalId);
        scanIntervalId = null;
        lastProcessName = '';
        console.log('[ProcessScanner] Stopped.');
    }
}
