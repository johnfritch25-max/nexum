/**
 * useNotificationSound.ts
 *
 * Manages notification sounds using the Web Audio API (no external files needed).
 * All sounds are synthesized programmatically so they work everywhere.
 *
 * Sounds are stored by key in localStorage under "nexum_notif_sound".
 */

import { useState, useCallback, useRef } from 'react';

export type SoundKey =
    | 'chime'
    | 'pop'
    | 'ding'
    | 'bubble'
    | 'swoosh'
    | 'bell'
    | 'soft'
    | 'none';

export interface SoundOption {
    key:         SoundKey;
    label:       string;
    description: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
    { key: 'chime',  label: '🔔 Chime',    description: 'Classic notification chime'  },
    { key: 'pop',    label: '💬 Pop',       description: 'Soft message pop'            },
    { key: 'ding',   label: '🔔 Ding',      description: 'Single clear ding'           },
    { key: 'bubble', label: '🫧 Bubble',    description: 'Bubbly water drop'           },
    { key: 'swoosh', label: '💨 Swoosh',    description: 'Quick swoosh sound'          },
    { key: 'bell',   label: '🎵 Bell',      description: 'Deep resonant bell'          },
    { key: 'soft',   label: '✨ Soft',      description: 'Gentle soft tone'            },
    { key: 'none',   label: '🔇 Silent',    description: 'No sound'                    },
];

const STORAGE_KEY = 'nexum_notif_sound';

function getStoredSound(): SoundKey {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v && SOUND_OPTIONS.some((s) => s.key === v)) return v as SoundKey;
    } catch { /* ignore */ }
    return 'chime';
}

/** Synthesize a notification sound using Web Audio API */
function playSound(key: SoundKey, ctx: AudioContext): void {
    if (key === 'none') return;

    const now = ctx.currentTime;

    switch (key) {
        case 'chime': {
            // Two-note ascending chime
            [523.25, 659.25].forEach((freq, i) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.12);
                gain.gain.setValueAtTime(0, now + i * 0.12);
                gain.gain.linearRampToValueAtTime(0.35, now + i * 0.12 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
                osc.start(now + i * 0.12);
                osc.stop(now + i * 0.12 + 0.55);
            });
            break;
        }
        case 'pop': {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now); osc.stop(now + 0.2);
            break;
        }
        case 'ding': {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1046.5, now);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc.start(now); osc.stop(now + 0.85);
            break;
        }
        case 'bubble': {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now); osc.stop(now + 0.3);
            break;
        }
        case 'swoosh': {
            const bufferSize = ctx.sampleRate * 0.2;
            const buffer     = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data       = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            const source = ctx.createBufferSource();
            const filter = ctx.createBiquadFilter();
            const gain   = ctx.createGain();
            source.buffer = buffer;
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000, now);
            filter.frequency.exponentialRampToValueAtTime(500, now + 0.2);
            source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            source.start(now); source.stop(now + 0.25);
            break;
        }
        case 'bell': {
            [440, 880, 1320].forEach((freq, i) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.2 / (i + 1), now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
                osc.start(now); osc.stop(now + 1.3);
            });
            break;
        }
        case 'soft': {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(528, now);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.start(now); osc.stop(now + 0.65);
            break;
        }
    }
}

export interface UseNotificationSoundReturn {
    selectedSound:  SoundKey;
    setSound:       (key: SoundKey) => void;
    playPreview:    (key: SoundKey) => void;
    playNotification: () => void;
}

export function useNotificationSound(): UseNotificationSoundReturn {
    const [selectedSound, setSelectedSound] = useState<SoundKey>(getStoredSound);
    const audioCtxRef = useRef<AudioContext | null>(null);

    const getCtx = useCallback((): AudioContext => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioContext();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().catch(() => {});
        }
        return audioCtxRef.current;
    }, []);

    const playPreview = useCallback((key: SoundKey) => {
        try { playSound(key, getCtx()); } catch { /* ignore */ }
    }, [getCtx]);

    const playNotification = useCallback(() => {
        try { playSound(selectedSound, getCtx()); } catch { /* ignore */ }
    }, [selectedSound, getCtx]);

    const setSound = useCallback((key: SoundKey) => {
        setSelectedSound(key);
        try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
    }, []);

    return { selectedSound, setSound, playPreview, playNotification };
}
