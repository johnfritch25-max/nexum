import React, { useState, useEffect, useRef } from 'react';
import { createGroup } from '../api/groups';
import type { Group } from '../api/groups';
import { getFriends, type FriendSummary } from '../api/users';
import { useDraggable } from '../hooks/useDraggable';

interface CreateGroupModalProps {
    isOpen:    boolean;
    onClose:   () => void;
    onCreated: (group: Group) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose, onCreated }) => {
    const [name,       setName]       = useState('');
    const [friends,    setFriends]    = useState<FriendSummary[]>([]);
    const [selected,   setSelected]   = useState<Set<number>>(new Set());
    const [isLoading,  setIsLoading]  = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error,      setError]      = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setName(''); setSelected(new Set()); setError(null);
        setTimeout(() => inputRef.current?.focus(), 60);
        setIsLoading(true);
        getFriends().then(setFriends).catch(() => setError('Failed to load friends.')).finally(() => setIsLoading(false));
    }, [isOpen]);

    const toggleFriend = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            const numId = Number(id);
            next.has(numId) ? next.delete(numId) : next.add(numId);
            return next;
        });
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { setError('Group name is required.'); return; }
        setIsCreating(true); setError(null);
        try {
            const group = await createGroup(name.trim(), Array.from(selected).map(Number));
            onCreated(group);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create group.');
        } finally {
            setIsCreating(false);
        }
    };

    const { modalRef, dragHandleProps } = useDraggable();

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

            <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Create group"
                className={[
                    'fixed z-[60] bg-zinc-900 flex flex-col shadow-2xl',
                    'bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh] sheet-up',
                    'md:bottom-auto md:left-1/2 md:top-1/2',
                    'md:w-[440px] md:max-h-[80vh] md:rounded-2xl md:border md:border-zinc-800/60 md:animate-scale-in',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
            >

                {/* Drag handle — mobile only */}
                <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
                    <div className="h-1 w-10 rounded-full bg-zinc-700" />
                </div>

                {/* Header — drag handle on desktop */}
                <div className={`h-14 flex items-center justify-between px-4 border-b border-zinc-800/60 shrink-0 ${dragHandleProps.className}`}
                    onMouseDown={dragHandleProps.onMouseDown}>
                    <h2 className="text-sm font-semibold text-white select-none">Create Group</h2>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleCreate} className="flex-1 overflow-y-auto flex flex-col">
                    <div className="p-4 flex flex-col gap-4">

                        {/* Group name */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="group-name" className="text-xs font-medium text-zinc-400">Group Name</label>
                            <input
                                ref={inputRef}
                                id="group-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={100}
                                placeholder="e.g. Study Group, Game Night…"
                                className="bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors"
                            />
                            <p className="text-[10px] text-zinc-600 text-right">{name.length}/100</p>
                        </div>

                        {/* Add members */}
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-medium text-zinc-400">
                                Add Members
                                {selected.size > 0 && (
                                    <span className="ml-1.5 text-violet-400">({selected.size} selected)</span>
                                )}
                            </p>

                            {isLoading ? (
                                <div className="flex justify-center py-6">
                                    <div className="h-5 w-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : friends.length === 0 ? (
                                <p className="text-xs text-zinc-600 text-center py-4">No friends to add yet.</p>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {friends.map((f) => {
                                        const isSelected = selected.has(f.id);
                                        return (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => toggleFriend(f.id)}
                                                className={[
                                                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left',
                                                    isSelected
                                                        ? 'bg-violet-600/20 border border-violet-500/40'
                                                        : 'hover:bg-zinc-800/60 border border-transparent',
                                                ].join(' ')}
                                            >
                                                <div className={[
                                                    'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 transition-all',
                                                    isSelected ? 'bg-gradient-to-br from-violet-500 to-violet-700' : 'bg-zinc-700',
                                                ].join(' ')}>
                                                    {f.display_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">{f.display_name}</p>
                                                    <p className="text-xs text-zinc-500 truncate">@{f.username}</p>
                                                </div>
                                                {/* Checkbox indicator */}
                                                <div className={[
                                                    'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                                                    isSelected ? 'bg-violet-600 border-violet-600' : 'border-zinc-600',
                                                ].join(' ')}>
                                                    {isSelected && (
                                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-white">
                                                            <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {error && <p className="text-xs text-red-400">{error}</p>}
                    </div>

                    {/* Footer */}
                    <div className="px-4 pb-4 pt-2 shrink-0 border-t border-zinc-800/40 safe-bottom md:safe-bottom-0">
                        <div className="flex gap-2 pt-3">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors active:scale-[0.98]">
                                Cancel
                            </button>
                            <button type="submit" disabled={isCreating || !name.trim()}
                                className={[
                                    'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]',
                                    isCreating || !name.trim()
                                        ? 'bg-violet-700/50 text-white/50 cursor-not-allowed'
                                        : 'bg-violet-600 hover:bg-violet-500 text-white',
                                ].join(' ')}>
                                {isCreating ? 'Creating…' : `Create${selected.size > 0 ? ` with ${selected.size + 1}` : ''}`}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
};

export default CreateGroupModal;
