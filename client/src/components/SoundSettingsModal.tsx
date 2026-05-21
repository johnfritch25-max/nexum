/**
 * SoundSettingsModal.tsx
 *
 * Two-tab modal:
 *   Tab 1 — Notification Sound  (messages, friend requests, reactions)
 *   Tab 2 — Ringtone            (incoming call)
 *
 * Each tab lets you:
 *   • Pick a built-in synthesized sound
 *   • Upload your own audio file (MP3 / WAV / OGG / M4A / AAC)
 *   • Preview any sound before selecting
 */

import React, { useRef, useState } from 'react';
import { SOUND_OPTIONS, type SoundKey } from '../hooks/useNotificationSound';
import { useDraggable } from '../hooks/useDraggable';

const ACCEPTED_AUDIO = 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/x-m4a,.mp3,.wav,.ogg,.m4a,.aac';
const MAX_FILE_MB    = 2;

interface SoundSettingsModalProps {
    isOpen:        boolean;
    onClose:       () => void;

    // Notification sound
    selectedSound:     SoundKey;
    customFileName:    string | null;
    onSelectSound:     (key: SoundKey) => void;
    onUploadSound:     (file: File) => Promise<void>;
    onRemoveSound:     () => void;
    onPreviewSound:    (key: SoundKey) => void;

    // Ringtone
    customRingtoneName:   string | null;
    onUploadRingtone:     (file: File) => Promise<void>;
    onRemoveRingtone:     () => void;
    onPreviewRingtone:    () => void;
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
    isOpen, onClose,
    selectedSound, customFileName, onSelectSound, onUploadSound, onRemoveSound, onPreviewSound,
    customRingtoneName, onUploadRingtone, onRemoveRingtone, onPreviewRingtone,
}) => {
    const { modalRef, dragHandleProps } = useDraggable();
    const [tab, setTab]           = useState<'notification' | 'ringtone'>('notification');
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploading, setUploading]     = useState(false);

    const notifFileRef    = useRef<HTMLInputElement>(null);
    const ringtoneFileRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = async (
        e: React.ChangeEvent<HTMLInputElement>,
        handler: (f: File) => Promise<void>
    ) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
            setUploadError(`File too large. Max ${MAX_FILE_MB} MB.`);
            return;
        }
        setUploadError(null);
        setUploading(true);
        try { await handler(file); }
        catch (err) { setUploadError(err instanceof Error ? err.message : 'Upload failed.'); }
        finally { setUploading(false); }
    };

    return (
        <>
            <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label="Sound Settings"
                className={[
                    'fixed z-[70] bg-zinc-900 flex flex-col shadow-2xl',
                    'bottom-0 left-0 right-0 rounded-t-2xl sheet-up max-h-[90vh]',
                    'md:bottom-auto md:left-1/2 md:top-1/2',
                    'md:w-[420px] md:max-h-[80vh] md:rounded-2xl md:border md:border-zinc-800/60 md:animate-scale-in',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Mobile drag handle */}
                <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
                    <div className="h-1 w-10 rounded-full bg-zinc-700" />
                </div>

                {/* Header */}
                <div
                    className={`h-14 flex items-center justify-between px-4 border-b border-zinc-800/60 shrink-0 ${dragHandleProps.className}`}
                    onMouseDown={dragHandleProps.onMouseDown}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🔔</span>
                        <h2 className="text-sm font-semibold text-white select-none">Sound Settings</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-800/60 shrink-0">
                    {(['notification', 'ringtone'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => { setTab(t); setUploadError(null); }}
                            className={['flex-1 py-3 text-xs font-medium transition-colors relative', tab === t ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'].join(' ')}>
                            {t === 'notification' ? '💬 Notification' : '📞 Ringtone'}
                            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {uploadError && (
                    <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-950/60 border border-red-900/60 text-xs text-red-400 shrink-0">
                        {uploadError}
                    </div>
                )}

                {/* ── Notification Sound Tab ── */}
                {tab === 'notification' && (
                    <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
                        <p className="text-[11px] text-zinc-500 px-1 pb-1">
                            Plays when you receive a message, friend request, or reaction.
                        </p>

                        {/* Upload custom file */}
                        <input ref={notifFileRef} type="file" accept={ACCEPTED_AUDIO} className="sr-only" aria-hidden="true"
                            onChange={(e) => handleFileChange(e, onUploadSound)} />

                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/40 mb-1">
                            <span className="text-lg shrink-0">📁</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-zinc-200 leading-tight">
                                    {customFileName ? customFileName : 'Upload your own sound'}
                                </p>
                                <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                                    MP3, WAV, OGG, M4A — max {MAX_FILE_MB} MB
                                </p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                {customFileName && (
                                    <>
                                        <button type="button" onClick={() => onPreviewSound('custom')} aria-label="Preview custom sound"
                                            className="h-8 w-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors active:scale-95">
                                            <PlayIcon />
                                        </button>
                                        <button type="button" onClick={onRemoveSound} aria-label="Remove custom sound"
                                            className="h-8 w-8 rounded-lg bg-zinc-700 hover:bg-red-700 flex items-center justify-center transition-colors active:scale-95">
                                            <TrashIcon />
                                        </button>
                                    </>
                                )}
                                <button type="button" disabled={uploading} onClick={() => notifFileRef.current?.click()}
                                    aria-label="Choose file"
                                    className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-50 active:scale-95">
                                    {uploading ? '…' : customFileName ? 'Change' : 'Browse'}
                                </button>
                            </div>
                        </div>

                        {/* Use custom if uploaded */}
                        {customFileName && (
                            <button type="button" onClick={() => onSelectSound('custom')}
                                className={['flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-all border',
                                    selectedSound === 'custom' ? 'bg-violet-600/20 border-violet-500/40' : 'hover:bg-zinc-800/60 border-transparent'].join(' ')}>
                                <RadioDot selected={selectedSound === 'custom'} />
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium leading-tight ${selectedSound === 'custom' ? 'text-white' : 'text-zinc-300'}`}>
                                        📁 {customFileName}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">Your uploaded sound</p>
                                </div>
                            </button>
                        )}

                        <div className="h-px bg-zinc-800/60 my-1" />

                        {/* Built-in sounds */}
                        {SOUND_OPTIONS.filter((o) => o.key !== 'custom').map((opt) => {
                            const isSelected = selectedSound === opt.key;
                            return (
                                <button key={opt.key} type="button" onClick={() => onSelectSound(opt.key)}
                                    className={['flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-all border',
                                        isSelected ? 'bg-violet-600/20 border-violet-500/40' : 'hover:bg-zinc-800/60 border-transparent'].join(' ')}>
                                    <RadioDot selected={isSelected} />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium leading-tight ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{opt.label}</p>
                                        <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">{opt.description}</p>
                                    </div>
                                    {opt.key !== 'none' && (
                                        <button type="button" onClick={(e) => { e.stopPropagation(); onPreviewSound(opt.key); }}
                                            aria-label={`Preview ${opt.label}`}
                                            className="shrink-0 h-8 w-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors active:scale-95">
                                            <PlayIcon />
                                        </button>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ── Ringtone Tab ── */}
                {tab === 'ringtone' && (
                    <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-3">
                        <p className="text-[11px] text-zinc-500 px-1">
                            Plays when someone calls you. Upload your own ringtone or use the built-in one.
                        </p>

                        <input ref={ringtoneFileRef} type="file" accept={ACCEPTED_AUDIO} className="sr-only" aria-hidden="true"
                            onChange={(e) => handleFileChange(e, onUploadRingtone)} />

                        {/* Custom ringtone card */}
                        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40">
                            <div className="h-10 w-10 rounded-xl bg-zinc-700 flex items-center justify-center text-xl shrink-0">
                                {customRingtoneName ? '🎵' : '📁'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white leading-tight truncate">
                                    {customRingtoneName ?? 'No custom ringtone'}
                                </p>
                                <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                                    {customRingtoneName ? 'Custom ringtone active' : `MP3, WAV, OGG, M4A — max ${MAX_FILE_MB} MB`}
                                </p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                {customRingtoneName && (
                                    <>
                                        <button type="button" onClick={onPreviewRingtone} aria-label="Preview ringtone"
                                            className="h-8 w-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors active:scale-95">
                                            <PlayIcon />
                                        </button>
                                        <button type="button" onClick={onRemoveRingtone} aria-label="Remove ringtone"
                                            className="h-8 w-8 rounded-lg bg-zinc-700 hover:bg-red-700 flex items-center justify-center transition-colors active:scale-95">
                                            <TrashIcon />
                                        </button>
                                    </>
                                )}
                                <button type="button" disabled={uploading} onClick={() => ringtoneFileRef.current?.click()}
                                    aria-label="Choose ringtone file"
                                    className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-50 active:scale-95">
                                    {uploading ? '…' : customRingtoneName ? 'Change' : 'Browse'}
                                </button>
                            </div>
                        </div>

                        {/* Built-in ringtone info */}
                        <div className={['flex items-center gap-3 px-3 py-3 rounded-xl border transition-all',
                            !customRingtoneName ? 'bg-violet-600/20 border-violet-500/40' : 'bg-zinc-800/40 border-zinc-700/30'].join(' ')}>
                            <RadioDot selected={!customRingtoneName} />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium leading-tight ${!customRingtoneName ? 'text-white' : 'text-zinc-400'}`}>
                                    🔔 Built-in ringtone
                                </p>
                                <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">Classic DRING DRING pattern</p>
                            </div>
                            {customRingtoneName && (
                                <button type="button" onClick={onRemoveRingtone}
                                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium">
                                    Use this
                                </button>
                            )}
                        </div>

                        <p className="text-[10px] text-zinc-600 px-1 text-center">
                            Outgoing call dial tone and call connected/ended sounds always use built-in audio.
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 py-3 border-t border-zinc-800/60 shrink-0">
                    <button type="button" onClick={onClose}
                        className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors active:scale-[0.98]">
                        Done
                    </button>
                </div>
                <div className="safe-bottom md:hidden" />
            </div>
        </>
    );
};

// ── Small reusable pieces ─────────────────────────────────────────────────────

const RadioDot: React.FC<{ selected: boolean }> = ({ selected }) => (
    <div className={['h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
        selected ? 'border-violet-500 bg-violet-500' : 'border-zinc-600'].join(' ')}>
        {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
    </div>
);

const PlayIcon = () => (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-300">
        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
    </svg>
);

const TrashIcon = () => (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
);

export default SoundSettingsModal;
