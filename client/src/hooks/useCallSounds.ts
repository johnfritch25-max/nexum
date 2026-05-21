/**
 * useCallSounds.ts
 *
 * Manages all call-related sounds.
 * - Built-in: synthesized via Web Audio API
 * - Custom ringtone: user uploads a file, stored as base64 in localStorage
 *
 * Storage keys:
 *   nexum_custom_ringtone       — base64 data URL of custom ringtone
 *   nexum_custom_ringtone_name  — file name for display
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CallStatus } from './useWebRTC';

// ── Storage keys ──────────────────────────────────────────────────────────────
const RINGTONE_DATA_KEY = 'nexum_custom_ringtone';
const RINGTONE_NAME_KEY = 'nexum_custom_ringtone_name';

export function getCustomRingtoneDataUrl(): string | null {
    try { return localStorage.getItem(RINGTONE_DATA_KEY); } catch { return null; }
}
export function getCustomRingtoneName(): string | null {
    try { return localStorage.getItem(RINGTONE_NAME_KEY); } catch { return null; }
}

// ── Audio context singleton ───────────────────────────────────────────────────
let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext {
    if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AudioContext();
    if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
    return sharedCtx;
}

// ── One-shot sounds ───────────────────────────────────────────────────────────
function playConnected(): void {
    try {
        const ctx = getCtx(); const now = ctx.currentTime;
        [880, 1108.73].forEach((freq, i) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
            osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.3);
        });
    } catch { /* ignore */ }
}

function playEnded(): void {
    try {
        const ctx = getCtx(); const now = ctx.currentTime;
        [880, 659.25].forEach((freq, i) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.12);
            gain.gain.setValueAtTime(0, now + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
            osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.4);
        });
    } catch { /* ignore */ }
}

// ── Looping custom ringtone via <Audio> ───────────────────────────────────────
function startCustomRingtone(dataUrl: string): () => void {
    const audio = new Audio(dataUrl);
    audio.loop   = true;
    audio.volume = 0.8;
    audio.play().catch(() => {});
    return () => { audio.pause(); audio.src = ''; };
}

// ── Looping built-in ringtone ─────────────────────────────────────────────────
function startRingtone(): () => void {
    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const ring = () => {
        if (stopped) return;
        try {
            const ctx = getCtx(); const now = ctx.currentTime;
            const burst = (startTime: number) => {
                const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();
                osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
                osc1.type = 'square'; osc2.type = 'square';
                osc1.frequency.setValueAtTime(480, startTime);
                osc2.frequency.setValueAtTime(620, startTime);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
                gain.gain.setValueAtTime(0.12, startTime + 0.38);
                gain.gain.linearRampToValueAtTime(0, startTime + 0.4);
                osc1.start(startTime); osc1.stop(startTime + 0.42);
                osc2.start(startTime); osc2.stop(startTime + 0.42);
            };
            burst(now); burst(now + 0.6);
        } catch { /* ignore */ }
        timeoutId = setTimeout(ring, 2200);
    };
    ring();
    return () => { stopped = true; if (timeoutId !== null) clearTimeout(timeoutId); };
}

// ── Looping dial tone ─────────────────────────────────────────────────────────
function startDialTone(): () => void {
    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const beep = () => {
        if (stopped) return;
        try {
            const ctx = getCtx(); const now = ctx.currentTime;
            const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
            osc1.type = 'sine'; osc2.type = 'sine';
            osc1.frequency.setValueAtTime(350, now); osc2.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gain.gain.setValueAtTime(0.15, now + 0.95); gain.gain.linearRampToValueAtTime(0, now + 1.0);
            osc1.start(now); osc1.stop(now + 1.05);
            osc2.start(now); osc2.stop(now + 1.05);
        } catch { /* ignore */ }
        timeoutId = setTimeout(beep, 4000);
    };
    beep();
    return () => { stopped = true; if (timeoutId !== null) clearTimeout(timeoutId); };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseCallSoundsReturn {
    customRingtoneName:    string | null;
    uploadCustomRingtone:  (file: File) => Promise<void>;
    removeCustomRingtone:  () => void;
    previewCustomRingtone: () => void;
}

export function useCallSounds(callStatus: CallStatus): UseCallSoundsReturn {
    const prevStatusRef = useRef<CallStatus>('idle');
    const stopLoopRef   = useRef<(() => void) | null>(null);
    const [customRingtoneName, setCustomRingtoneName] = useState<string | null>(getCustomRingtoneName);

    useEffect(() => {
        const prev = prevStatusRef.current;
        const curr = callStatus;
        prevStatusRef.current = curr;

        // Stop any looping sound on status change
        if (stopLoopRef.current) { stopLoopRef.current(); stopLoopRef.current = null; }

        if (curr === 'incoming') {
            const customUrl = getCustomRingtoneDataUrl();
            stopLoopRef.current = customUrl ? startCustomRingtone(customUrl) : startRingtone();
        } else if (curr === 'calling') {
            stopLoopRef.current = startDialTone();
        } else if (curr === 'connected' && (prev === 'calling' || prev === 'incoming')) {
            playConnected();
        } else if (curr === 'ended' && prev !== 'idle' && prev !== 'ended') {
            playEnded();
        }

        return () => {
            if (stopLoopRef.current) { stopLoopRef.current(); stopLoopRef.current = null; }
        };
    }, [callStatus]);

    const uploadCustomRingtone = useCallback(async (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                try {
                    localStorage.setItem(RINGTONE_DATA_KEY, dataUrl);
                    localStorage.setItem(RINGTONE_NAME_KEY, file.name);
                } catch {
                    reject(new Error('File too large. Try a shorter clip (< 1 MB).'));
                    return;
                }
                setCustomRingtoneName(file.name);
                resolve();
            };
            reader.onerror = () => reject(new Error('Failed to read file.'));
            reader.readAsDataURL(file);
        });
    }, []);

    const removeCustomRingtone = useCallback(() => {
        try {
            localStorage.removeItem(RINGTONE_DATA_KEY);
            localStorage.removeItem(RINGTONE_NAME_KEY);
        } catch { /* ignore */ }
        setCustomRingtoneName(null);
    }, []);

    const previewCustomRingtone = useCallback(() => {
        const dataUrl = getCustomRingtoneDataUrl();
        if (!dataUrl) return;
        const audio = new Audio(dataUrl);
        audio.volume = 0.8;
        audio.play().catch(() => {});
        // Auto-stop after 3s preview
        setTimeout(() => { audio.pause(); audio.src = ''; }, 3000);
    }, []);

    return { customRingtoneName, uploadCustomRingtone, removeCustomRingtone, previewCustomRingtone };
}
