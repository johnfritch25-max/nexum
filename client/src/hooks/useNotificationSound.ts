/**
 * useNotificationSound.ts
 *
 * Manages notification sounds.
 * - Built-in sounds: synthesized via Web Audio API
 * - Custom sound: user uploads an audio file (MP3/WAV/OGG/M4A),
 *   stored as a base64 data URL in localStorage under "nexum_custom_notif_sound"
 *
 * Selected sound key stored under "nexum_notif_sound".
 * Custom file name stored under "nexum_custom_notif_name".
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
    | 'custom'
    | 'none';

export interface SoundOption {
    key:         SoundKey;
    label:       string;
    description: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
    { key: 'chime',  label: '🔔 Chime',       description: 'Classic notification chime'  },
    { key: 'pop',    label: '💬 Pop',          description: 'Soft message pop'            },
    { key: 'ding',   label: '🔔 Ding',         description: 'Single clear ding'           },
    { key: 'bubble', label: '🫧 Bubble',       description: 'Bubbly water drop'           },
    { key: 'swoosh', label: '💨 Swoosh',       description: 'Quick swoosh sound'          },
    { key: 'bell',   label: '🎵 Bell',         description: 'Deep resonant bell'          },
    { key: 'soft',   label: '✨ Soft',         description: 'Gentle soft tone'            },
    { key: 'custom', label: '📁 Custom file',  description: 'Upload your own sound file'  },
    { key: 'none',   label: '🔇 Silent',       description: 'No sound'                    },
];

const STORAGE_KEY        = 'nexum_notif_sound';
const CUSTOM_DATA_KEY    = 'nexum_custom_notif_sound';
const CUSTOM_NAME_KEY    = 'nexum_custom_notif_name';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStoredSound(): SoundKey {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v && SOUND_OPTIONS.some((s) => s.key === v)) return v as SoundKey;
    } catch { /* ignore */ }
    return 'chime';
}

function getCustomDataUrl(): string | null {
    try { return localStorage.getItem(CUSTOM_DATA_KEY); } catch { return null; }
}

function getCustomFileName(): string | null {
    try { return localStorage.getItem(CUSTOM_NAME_KEY); } catch { return null; }
}

/** Play a custom audio file from a data URL */
function playDataUrl(dataUrl: string): void {
    const audio = new Audio(dataUrl);
    audio.volume = 0.8;
    audio.play().catch(() => {});
}

/** Synthesize a built-in notification sound using Web Audio API */
function playBuiltIn(key: SoundKey, ctx: AudioContext): void {
    if (key === 'none' || key === 'custom') return;
    const now = ctx.currentTime;

    switch (key) {
        case 'chime': {
            [523.25, 659.25].forEach((freq, i) => {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + i * 0.12);
                gain.gain.setValueAtTime(0, now + i * 0.12);
                gain.gain.linearRampToValueAtTime(0.35, now + i * 0.12 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
                osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.55);
            }); break;
        }
        case 'pop': {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
            gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now); osc.stop(now + 0.2); break;
        }
        case 'ding': {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination); osc.type = 'triangle';
            osc.frequency.setValueAtTime(1046.5, now);
            gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc.start(now); osc.stop(now + 0.85); break;
        }
        case 'bubble': {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
            gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now); osc.stop(now + 0.3); break;
        }
        case 'swoosh': {
            const bufferSize = ctx.sampleRate * 0.2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            const source = ctx.createBufferSource(); const filter = ctx.createBiquadFilter(); const gain = ctx.createGain();
            source.buffer = buffer; filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000, now); filter.frequency.exponentialRampToValueAtTime(500, now + 0.2);
            source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            source.start(now); source.stop(now + 0.25); break;
        }
        case 'bell': {
            [440, 880, 1320].forEach((freq, i) => {
                const osc = ctx.createOscillator(); const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.2 / (i + 1), now); gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
                osc.start(now); osc.stop(now + 1.3);
            }); break;
        }
        case 'soft': {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
            osc.frequency.setValueAtTime(528, now);
            gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.start(now); osc.stop(now + 0.65); break;
        }
    }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseNotificationSoundReturn {
    selectedSound:    SoundKey;
    customFileName:   string | null;
    setSound:         (key: SoundKey) => void;
    uploadCustomSound:(file: File) => Promise<void>;
    removeCustomSound:() => void;
    playPreview:      (key: SoundKey) => void;
    playNotification: () => void;
}

export function useNotificationSound(): UseNotificationSoundReturn {
    const [selectedSound,  setSelectedSound]  = useState<SoundKey>(getStoredSound);
    const [customFileName, setCustomFileName] = useState<string | null>(getCustomFileName);
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

    const setSound = useCallback((key: SoundKey) => {
        setSelectedSound(key);
        try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
    }, []);

    /** Read a File, store as base64, switch to custom */
    const uploadCustomSound = useCallback(async (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                try {
                    localStorage.setItem(CUSTOM_DATA_KEY, dataUrl);
                    localStorage.setItem(CUSTOM_NAME_KEY, file.name);
                    localStorage.setItem(STORAGE_KEY, 'custom');
                } catch {
                    reject(new Error('File too large to store. Try a shorter clip (< 1 MB).'));
                    return;
                }
                setCustomFileName(file.name);
                setSelectedSound('custom');
                resolve();
            };
            reader.onerror = () => reject(new Error('Failed to read file.'));
            reader.readAsDataURL(file);
        });
    }, []);

    const removeCustomSound = useCallback(() => {
        try {
            localStorage.removeItem(CUSTOM_DATA_KEY);
            localStorage.removeItem(CUSTOM_NAME_KEY);
            localStorage.setItem(STORAGE_KEY, 'chime');
        } catch { /* ignore */ }
        setCustomFileName(null);
        setSelectedSound('chime');
    }, []);

    const playPreview = useCallback((key: SoundKey) => {
        if (key === 'custom') {
            const dataUrl = getCustomDataUrl();
            if (dataUrl) playDataUrl(dataUrl);
            return;
        }
        try { playBuiltIn(key, getCtx()); } catch { /* ignore */ }
    }, [getCtx]);

    const playNotification = useCallback(() => {
        if (selectedSound === 'custom') {
            const dataUrl = getCustomDataUrl();
            if (dataUrl) playDataUrl(dataUrl);
            return;
        }
        try { playBuiltIn(selectedSound, getCtx()); } catch { /* ignore */ }
    }, [selectedSound, getCtx]);

    return {
        selectedSound, customFileName,
        setSound, uploadCustomSound, removeCustomSound,
        playPreview, playNotification,
    };
}
