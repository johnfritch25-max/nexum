/**
 * useCallSounds.ts
 *
 * Synthesizes all call-related sounds using the Web Audio API.
 * No audio files required — everything is generated programmatically.
 *
 * Sounds:
 *   incoming  — classic phone ringtone (loops until call is answered/rejected)
 *   outgoing  — dial tone beeps (loops until answered/cancelled)
 *   connected — short ascending "call connected" chime
 *   ended     — short descending "call ended" tone
 */

import { useEffect, useRef } from 'react';
import type { CallStatus } from './useWebRTC';

// ── Audio context singleton ───────────────────────────────────────────────────

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext {
    if (!sharedCtx || sharedCtx.state === 'closed') {
        sharedCtx = new AudioContext();
    }
    if (sharedCtx.state === 'suspended') {
        sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
}

// ── One-shot sounds ───────────────────────────────────────────────────────────

function playConnected(): void {
    try {
        const ctx = getCtx();
        const now = ctx.currentTime;
        // Two quick ascending notes — "boop boop"
        [880, 1108.73].forEach((freq, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    } catch { /* ignore */ }
}

function playEnded(): void {
    try {
        const ctx = getCtx();
        const now = ctx.currentTime;
        // Two descending notes — "boop boop" going down
        [880, 659.25].forEach((freq, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.12);
            gain.gain.setValueAtTime(0, now + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.4);
        });
    } catch { /* ignore */ }
}

// ── Looping ringtone (incoming call) ─────────────────────────────────────────
// Classic "DRING DRING" pattern: two short bursts, then silence, repeat

function startRingtone(): () => void {
    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const ring = () => {
        if (stopped) return;
        try {
            const ctx = getCtx();
            const now = ctx.currentTime;

            // Two-burst ring: 400ms on, 200ms off, 400ms on, 1200ms silence
            const burst = (startTime: number) => {
                const osc1  = ctx.createOscillator();
                const osc2  = ctx.createOscillator();
                const gain  = ctx.createGain();
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);

                osc1.type = 'square';
                osc2.type = 'square';
                osc1.frequency.setValueAtTime(480, startTime);
                osc2.frequency.setValueAtTime(620, startTime);

                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
                gain.gain.setValueAtTime(0.12, startTime + 0.38);
                gain.gain.linearRampToValueAtTime(0, startTime + 0.4);

                osc1.start(startTime); osc1.stop(startTime + 0.42);
                osc2.start(startTime); osc2.stop(startTime + 0.42);
            };

            burst(now);          // first burst
            burst(now + 0.6);    // second burst (after 200ms gap)
            // total pattern = 0 + 0.4 + 0.2 gap + 0.4 = 1.0s, then 1.2s silence = 2.2s cycle
        } catch { /* ignore */ }

        timeoutId = setTimeout(ring, 2200);
    };

    ring();

    return () => {
        stopped = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
    };
}

// ── Looping dial tone (outgoing call) ────────────────────────────────────────
// Standard US dial tone pattern: 1s on, 3s off

function startDialTone(): () => void {
    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const beep = () => {
        if (stopped) return;
        try {
            const ctx = getCtx();
            const now = ctx.currentTime;

            const osc1  = ctx.createOscillator();
            const osc2  = ctx.createOscillator();
            const gain  = ctx.createGain();
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            // Standard DTMF dial tone: 350 Hz + 440 Hz
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(350, now);
            osc2.frequency.setValueAtTime(440, now);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gain.gain.setValueAtTime(0.15, now + 0.95);
            gain.gain.linearRampToValueAtTime(0, now + 1.0);

            osc1.start(now); osc1.stop(now + 1.05);
            osc2.start(now); osc2.stop(now + 1.05);
        } catch { /* ignore */ }

        // 1s tone + 3s silence = 4s cycle
        timeoutId = setTimeout(beep, 4000);
    };

    beep();

    return () => {
        stopped = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
    };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCallSounds(callStatus: CallStatus): void {
    const prevStatusRef = useRef<CallStatus>('idle');
    const stopLoopRef   = useRef<(() => void) | null>(null);

    useEffect(() => {
        const prev = prevStatusRef.current;
        const curr = callStatus;
        prevStatusRef.current = curr;

        // Stop any looping sound when status changes
        if (stopLoopRef.current) {
            stopLoopRef.current();
            stopLoopRef.current = null;
        }

        if (curr === 'incoming') {
            // Start ringtone loop
            stopLoopRef.current = startRingtone();
        } else if (curr === 'calling') {
            // Start dial tone loop
            stopLoopRef.current = startDialTone();
        } else if (curr === 'connected' && (prev === 'calling' || prev === 'incoming')) {
            // Call just connected — play connected chime
            playConnected();
        } else if (curr === 'ended' && prev !== 'idle' && prev !== 'ended') {
            // Call just ended — play ended tone
            playEnded();
        }

        // Cleanup on unmount or next status change
        return () => {
            if (stopLoopRef.current) {
                stopLoopRef.current();
                stopLoopRef.current = null;
            }
        };
    }, [callStatus]);
}
