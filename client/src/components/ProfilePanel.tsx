import React, { useState, useEffect } from 'react';
import { updateProfile, setCustomStatus } from '../api/users';
import { useTheme } from '../hooks/useTheme';
import { useDraggable } from '../hooks/useDraggable';

interface ProfilePanelProps {
    isOpen: boolean; onClose: () => void;
    displayName: string; bio: string | null; username: string;
    onSaved: (newDisplayName: string, newBio: string | null) => void;
}

const STATUS_PRESETS = [
    { icon: '🎮', text: 'Gaming' },
    { icon: '💻', text: 'Coding' },
    { icon: '🎵', text: 'Listening to music' },
    { icon: '📚', text: 'Studying' },
    { icon: '😴', text: 'Away' },
    { icon: '🔴', text: 'Do not disturb' },
];

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ isOpen, onClose, displayName, bio, username, onSaved }) => {
    const { theme, toggleTheme } = useTheme();

    const [nameVal,     setNameVal]     = useState(displayName);
    const [bioVal,      setBioVal]      = useState(bio ?? '');
    const [isSaving,    setIsSaving]    = useState(false);
    const [error,       setError]       = useState<string | null>(null);
    const [saved,       setSaved]       = useState(false);

    // Custom status
    const [statusIcon,  setStatusIcon]  = useState('');
    const [statusText,  setStatusText]  = useState('');
    const [statusSaved, setStatusSaved] = useState(false);
    const [statusSaving,setStatusSaving]= useState(false);

    useEffect(() => {
        if (isOpen) {
            setNameVal(displayName);
            setBioVal(bio ?? '');
            setError(null);
            setSaved(false);
            setStatusSaved(false);
        }
    }, [isOpen, displayName, bio]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = nameVal.trim();
        const trimmedBio  = bioVal.trim() || null;
        if (trimmedName.length < 1 || trimmedName.length > 64) { setError('Display name must be 1–64 characters.'); return; }
        if (trimmedBio && trimmedBio.length > 300) { setError('Bio must be at most 300 characters.'); return; }
        setIsSaving(true); setError(null);
        try {
            await updateProfile({ display_name: trimmedName, bio: trimmedBio });
            onSaved(trimmedName, trimmedBio);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save.'); }
        finally { setIsSaving(false); }
    };

    const handleStatusSave = async () => {
        setStatusSaving(true);
        try {
            await setCustomStatus(statusIcon || null, statusText || null);
            setStatusSaved(true);
            setTimeout(() => setStatusSaved(false), 2000);
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update status.'); }
        finally { setStatusSaving(false); }
    };

    const handleClearStatus = async () => {
        setStatusIcon(''); setStatusText('');
        try { await setCustomStatus(null, null); } catch { /* ignore */ }
    };

    const { modalRef, dragHandleProps } = useDraggable();

    if (!isOpen) return null;
    const initial = nameVal.charAt(0).toUpperCase() || username.charAt(0).toUpperCase();

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

            <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Edit profile"
                className={[
                    'fixed z-50 bg-zinc-900 flex flex-col shadow-2xl',
                    'bottom-0 left-0 right-0 rounded-t-2xl max-h-[92vh] sheet-up',
                    'md:bottom-auto md:left-1/2 md:top-1/2',
                    'md:w-[440px] md:max-h-[85vh] md:rounded-2xl md:border md:border-zinc-800/60 md:animate-scale-in',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
            >

                <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
                    <div className="h-1 w-10 rounded-full bg-zinc-700" />
                </div>

                <div className={`h-14 flex items-center justify-between px-4 border-b border-zinc-800/60 shrink-0 ${dragHandleProps.className}`}
                    onMouseDown={dragHandleProps.onMouseDown}>
                    <h2 className="text-sm font-semibold text-white select-none">Profile & Settings</h2>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-3xl font-bold text-white select-none ring-4 ring-violet-500/20">
                            {initial}
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-white">{nameVal || displayName}</p>
                            <p className="text-xs text-zinc-500">@{username}</p>
                        </div>
                    </div>

                    {/* Profile form */}
                    <section>
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Profile</p>
                        <form onSubmit={handleSave} className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-name" className="text-xs font-medium text-zinc-400">Display Name</label>
                                <input id="profile-name" type="text" value={nameVal} onChange={(e) => setNameVal(e.target.value)} maxLength={64}
                                    className="bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors"
                                    placeholder="Your display name" />
                                <p className="text-[10px] text-zinc-600 text-right">{nameVal.length}/64</p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="profile-bio" className="text-xs font-medium text-zinc-400">Bio <span className="text-zinc-600 font-normal">(optional)</span></label>
                                <textarea id="profile-bio" value={bioVal} onChange={(e) => setBioVal(e.target.value)} maxLength={300} rows={2}
                                    className="bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors resize-none"
                                    placeholder="Tell people a bit about yourself…" />
                                <p className="text-[10px] text-zinc-600 text-right">{bioVal.length}/300</p>
                            </div>
                            {error && <p className="text-xs text-red-400 px-1">{error}</p>}
                            <button type="submit" disabled={isSaving || (nameVal.trim() === displayName && (bioVal.trim() || null) === bio)}
                                className={['w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]',
                                    saved ? 'bg-emerald-600 text-white' : isSaving ? 'bg-violet-700 text-white/70 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed'].join(' ')}>
                                {saved ? '✓ Saved' : isSaving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </form>
                    </section>

                    {/* Custom status */}
                    <section>
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Custom Status</p>
                        <div className="flex flex-col gap-2">
                            {/* Presets */}
                            <div className="flex flex-wrap gap-1.5">
                                {STATUS_PRESETS.map((p) => (
                                    <button key={p.text} type="button"
                                        onClick={() => { setStatusIcon(p.icon); setStatusText(p.text); }}
                                        className={['flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-all active:scale-95',
                                            statusIcon === p.icon && statusText === p.text
                                                ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                                                : 'bg-zinc-800 border-zinc-700/40 text-zinc-400 hover:border-zinc-600'].join(' ')}>
                                        <span>{p.icon}</span><span>{p.text}</span>
                                    </button>
                                ))}
                            </div>
                            {/* Custom input */}
                            <div className="flex gap-2">
                                <input type="text" value={statusIcon} onChange={(e) => setStatusIcon(e.target.value)} maxLength={4}
                                    placeholder="😊" aria-label="Status emoji"
                                    className="w-14 bg-zinc-800 border border-zinc-700/50 rounded-xl px-2 py-2 text-sm text-white text-center placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors" />
                                <input type="text" value={statusText} onChange={(e) => setStatusText(e.target.value)} maxLength={60}
                                    placeholder="What are you up to?" aria-label="Status text"
                                    className="flex-1 bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors" />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={handleStatusSave} disabled={statusSaving}
                                    className={['flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]',
                                        statusSaved ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50'].join(' ')}>
                                    {statusSaved ? '✓ Set' : statusSaving ? '…' : 'Set Status'}
                                </button>
                                <button type="button" onClick={handleClearStatus}
                                    className="px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors active:scale-[0.98]">
                                    Clear
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Theme */}
                    <section>
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Appearance</p>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/30">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{theme === 'dark' ? '🌙' : '☀️'}</span>
                                <div>
                                    <p className="text-sm font-medium text-white">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
                                    <p className="text-xs text-zinc-500">Switch appearance</p>
                                </div>
                            </div>
                            {theme === 'dark' ? (
                                <button type="button" role="switch" aria-checked="true" aria-label="Disable dark mode"
                                    onClick={toggleTheme}
                                    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-violet-600 transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
                                    <span aria-hidden="true" className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-message transition-transform duration-300 translate-x-5" />
                                </button>
                            ) : (
                                <button type="button" role="switch" aria-checked="false" aria-label="Enable dark mode"
                                    onClick={toggleTheme}
                                    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-zinc-700 transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
                                    <span aria-hidden="true" className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-message transition-transform duration-300 translate-x-0" />
                                </button>
                            )}
                        </div>
                    </section>

                </div>
                <div className="safe-bottom md:hidden" />
            </div>
        </>
    );
};

export default ProfilePanel;
