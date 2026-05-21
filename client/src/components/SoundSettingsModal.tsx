/**
 * SoundSettingsModal.tsx
 *
 * Modal for choosing the notification sound.
 * Shows all available sounds with a preview button for each.
 */

import React from 'react';
import { SOUND_OPTIONS, type SoundKey } from '../hooks/useNotificationSound';
import { useDraggable } from '../hooks/useDraggable';

interface SoundSettingsModalProps {
    isOpen:        boolean;
    onClose:       () => void;
    selectedSound: SoundKey;
    onSelect:      (key: SoundKey) => void;
    onPreview:     (key: SoundKey) => void;
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
    isOpen, onClose, selectedSound, onSelect, onPreview,
}) => {
    const { modalRef, dragHandleProps } = useDraggable();

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label="Notification Sound Settings"
                className={[
                    'fixed z-[70] bg-zinc-900 flex flex-col shadow-2xl',
                    'bottom-0 left-0 right-0 rounded-t-2xl sheet-up',
                    'md:bottom-auto md:left-1/2 md:top-1/2',
                    'md:w-[400px] md:rounded-2xl md:border md:border-zinc-800/60 md:animate-scale-in',
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
                        <h2 className="text-sm font-semibold text-white select-none">Notification Sound</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
                    >
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-500 px-4 pt-3 pb-1">
                    Choose a sound for messages, friend requests, and reactions. Click the play button to preview.
                </p>

                {/* Sound list */}
                <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
                    {SOUND_OPTIONS.map((opt) => {
                        const isSelected = selectedSound === opt.key;
                        return (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => onSelect(opt.key)}
                                className={[
                                    'flex items-center gap-3 px-3 py-3 rounded-xl w-full text-left transition-all',
                                    isSelected
                                        ? 'bg-violet-600/20 border border-violet-500/40'
                                        : 'hover:bg-zinc-800/60 border border-transparent',
                                ].join(' ')}
                            >
                                {/* Selected indicator */}
                                <div className={[
                                    'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                                    isSelected ? 'border-violet-500 bg-violet-500' : 'border-zinc-600',
                                ].join(' ')}>
                                    {isSelected && (
                                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                    )}
                                </div>

                                {/* Label */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium leading-tight ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                        {opt.label}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">{opt.description}</p>
                                </div>

                                {/* Preview button */}
                                {opt.key !== 'none' && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onPreview(opt.key); }}
                                        aria-label={`Preview ${opt.label}`}
                                        className="shrink-0 h-8 w-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors active:scale-95"
                                    >
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-300">
                                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                        </svg>
                                    </button>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-zinc-800/60 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors active:scale-[0.98]"
                    >
                        Done
                    </button>
                </div>

                <div className="safe-bottom md:hidden" />
            </div>
        </>
    );
};

export default SoundSettingsModal;
