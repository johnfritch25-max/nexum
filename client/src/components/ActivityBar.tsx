/**
 * ActivityBar.tsx
 *
 * Shows at the bottom of the sidebar.
 * - Auto-detected activity (from browser tab title) shows with a ⚡ badge
 * - Manual activity shows with a 🎮 badge
 * - Away status shows when window has been unfocused for 5+ minutes
 * - Click to open the manual picker (override auto-detection)
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ActivityInfo } from '../hooks/useActivityBar';
import { KNOWN_GAMES } from '../hooks/useActivityBar';

interface ActivityBarProps {
    activity:      ActivityInfo | null;
    isAway:        boolean;
    onSetActivity: (a: ActivityInfo | null) => void;
    onStream:      () => void;
    isStreaming:   boolean;
    callActive:    boolean;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
    activity, isAway, onSetActivity, onStream, isStreaming, callActive,
}) => {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [search, setSearch]         = useState('');
    const pickerRef                   = useRef<HTMLDivElement>(null);
    const searchRef                   = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!pickerOpen) return;
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setPickerOpen(false); setSearch('');
            }
        };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [pickerOpen]);

    useEffect(() => {
        if (pickerOpen) setTimeout(() => searchRef.current?.focus(), 50);
    }, [pickerOpen]);

    const filtered = search.trim()
        ? KNOWN_GAMES.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
        : KNOWN_GAMES;

    // ── Away state ────────────────────────────────────────────────────────────
    if (isAway && !activity) {
        return (
            <div className="mx-2 mb-1 px-3 py-2 rounded-xl bg-zinc-800/40 border border-zinc-700/30 flex items-center gap-2">
                <span className="text-amber-400 text-sm shrink-0">😴</span>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold leading-tight">Status</p>
                    <p className="text-xs font-medium text-amber-400 leading-tight">Away</p>
                </div>
                <button type="button" onClick={() => { onSetActivity(null); setPickerOpen(true); }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
                    Set
                </button>
            </div>
        );
    }

    // ── No activity ───────────────────────────────────────────────────────────
    if (!activity) {
        return (
            <div className="relative">
                {pickerOpen && (
                    <ActivityPicker ref={pickerRef} search={search} onSearch={setSearch}
                        searchRef={searchRef} filtered={filtered}
                        onSelect={(g) => { onSetActivity(g); setPickerOpen(false); setSearch(''); }}
                        onClose={() => { setPickerOpen(false); setSearch(''); }} />
                )}
                <button type="button" onClick={() => setPickerOpen((p) => !p)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors rounded-lg text-xs"
                    aria-label="Set game activity">
                    <GamepadIcon />
                    <span>Set activity…</span>
                    <span className="ml-auto text-[10px] text-zinc-600">manual</span>
                </button>
            </div>
        );
    }

    // ── Activity active ───────────────────────────────────────────────────────
    return (
        <div className="relative">
            {pickerOpen && (
                <ActivityPicker ref={pickerRef} search={search} onSearch={setSearch}
                    searchRef={searchRef} filtered={filtered}
                    onSelect={(g) => { onSetActivity(g); setPickerOpen(false); setSearch(''); }}
                    onClose={() => { setPickerOpen(false); setSearch(''); }}
                    showClear onClear={() => { onSetActivity(null); setPickerOpen(false); setSearch(''); }} />
            )}

            <div className="mx-2 mb-1 rounded-xl bg-zinc-800/70 border border-zinc-700/40 overflow-hidden">
                <button type="button" onClick={() => setPickerOpen((p) => !p)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-700/40 transition-colors text-left group"
                    aria-label={`Change activity: ${activity.name}`}>
                    {/* Icon */}
                    <div className="h-9 w-9 rounded-lg bg-zinc-700 flex items-center justify-center text-xl shrink-0 border border-zinc-600/40 group-hover:border-violet-500/40 transition-colors select-none">
                        {activity.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        {/* Auto vs manual badge */}
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold leading-tight flex items-center gap-1">
                            {activity.source === 'auto' ? (
                                <><span className="text-emerald-400">⚡</span> Auto-detected</>
                            ) : (
                                <><span>🎮</span> Playing a game</>
                            )}
                        </p>
                        <p className="text-xs font-semibold text-white truncate leading-tight mt-0.5">{activity.name}</p>
                    </div>
                    {/* Stream button */}
                    <button type="button"
                        onClick={(e) => { e.stopPropagation(); onStream(); }}
                        disabled={!callActive}
                        title={callActive ? (isStreaming ? 'Stop streaming' : 'Stream') : 'Start a call first to stream'}
                        aria-label={isStreaming ? 'Stop streaming' : 'Stream'}
                        className={['shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-all',
                            isStreaming
                                ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/40'
                                : callActive
                                    ? 'bg-zinc-700 hover:bg-violet-600 text-zinc-300 hover:text-white'
                                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'].join(' ')}>
                        <StreamIcon />
                    </button>
                </button>

                {/* Streaming indicator */}
                {isStreaming && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-950/60 border-t border-green-900/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                        <span className="text-[10px] text-green-400 font-semibold flex-1">Streaming {activity.name}</span>
                        <button type="button" onClick={onStream}
                            className="text-[10px] text-green-300 hover:text-white transition-colors font-medium">
                            Stop
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Activity Picker ───────────────────────────────────────────────────────────

interface PickerProps {
    search:    string;
    onSearch:  (v: string) => void;
    searchRef: React.RefObject<HTMLInputElement>;
    filtered:  ActivityInfo[];
    onSelect:  (g: ActivityInfo) => void;
    onClose:   () => void;
    showClear?: boolean;
    onClear?:  () => void;
}

const ActivityPicker = React.forwardRef<HTMLDivElement, PickerProps>(
    ({ search, onSearch, searchRef, filtered, onSelect, onClose, showClear, onClear }, ref) => (
        <div ref={ref}
            className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div>
                    <p className="text-xs font-semibold text-white">Set Activity</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Auto-detects browser tabs · Manual override below</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close picker"
                    className="h-5 w-5 rounded flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                    </svg>
                </button>
            </div>

            {/* Auto-detect info banner */}
            <div className="mx-3 mb-2 px-2.5 py-2 rounded-lg bg-emerald-950/40 border border-emerald-900/40 flex items-start gap-2">
                <span className="text-emerald-400 text-sm shrink-0 mt-0.5">⚡</span>
                <p className="text-[10px] text-emerald-300 leading-relaxed">
                    Activity auto-detects from your browser tabs (YouTube, Roblox web, Spotify, etc.). Open a game or app in another tab and it will appear here automatically.
                </p>
            </div>

            <div className="px-3 pb-2">
                <input ref={searchRef} type="text" value={search} onChange={(e) => onSearch(e.target.value)}
                    placeholder="Search or type a game name…"
                    className="w-full bg-zinc-800 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/60" />
            </div>

            <div className="max-h-52 overflow-y-auto px-1.5 pb-1.5 flex flex-col gap-0.5">
                {showClear && (
                    <button type="button" onClick={onClear}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-800 transition-colors w-full text-left">
                        <div className="h-7 w-7 rounded-md bg-zinc-700 flex items-center justify-center text-sm shrink-0">✕</div>
                        <span className="text-xs text-zinc-400">Clear activity</span>
                    </button>
                )}
                {filtered.length === 0 ? (
                    <p className="text-xs text-zinc-600 text-center py-4">No games found</p>
                ) : filtered.map((g) => (
                    <button key={g.name} type="button" onClick={() => onSelect(g)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-800 transition-colors w-full text-left group">
                        <div className="h-7 w-7 rounded-md bg-zinc-700 flex items-center justify-center text-sm shrink-0 group-hover:bg-zinc-600 transition-colors">
                            {g.icon}
                        </div>
                        <span className="text-xs text-zinc-300 group-hover:text-white transition-colors truncate">{g.name}</span>
                    </button>
                ))}
            </div>
        </div>
    )
);
ActivityPicker.displayName = 'ActivityPicker';

const GamepadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
        <path fillRule="evenodd" d="M10 2a8 8 0 100 16A8 8 0 0010 2zM6.5 9.5a.5.5 0 000 1h1v1a.5.5 0 001 0v-1h1a.5.5 0 000-1h-1v-1a.5.5 0 00-1 0v1h-1zm5.25-1a.75.75 0 100 1.5.75.75 0 000-1.5zm1.5 2.5a.75.75 0 100 1.5.75.75 0 000-1.5z" clipRule="evenodd" />
    </svg>
);

const StreamIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
    </svg>
);

export default ActivityBar;
