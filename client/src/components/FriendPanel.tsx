import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { searchUsers, type SearchUserResult } from '../api/users';
import { sendFriendRequest, respondToFriendRequest, getPendingRequests, blockUser, unblockUser, type PendingRequest } from '../api/friends';
import { useDraggable } from '../hooks/useDraggable';

interface FriendPanelProps {
    isOpen:        boolean;
    onClose:       () => void;
    onFriendAdded: () => void;
    currentUserId: number;
    socket:        Socket | null;
}

export const FriendPanel: React.FC<FriendPanelProps> = ({ isOpen, onClose, onFriendAdded, currentUserId, socket }) => {
    const [tab, setTab]                     = useState<'search' | 'requests'>('requests');
    const [query, setQuery]                 = useState('');
    const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
    const [isSearching, setIsSearching]     = useState(false);
    const [pendingReqs, setPendingReqs]     = useState<PendingRequest[]>([]);
    const [loadingReqs, setLoadingReqs]     = useState(false);
    const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
    const [error, setError]                 = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef    = useRef<HTMLInputElement>(null);

    const refreshPending = useCallback(() => {
        setLoadingReqs(true);
        getPendingRequests().then(setPendingReqs).catch(() => setError('Failed to load requests.')).finally(() => setLoadingReqs(false));
    }, []);

    useEffect(() => {
        if (isOpen && tab === 'search') setTimeout(() => inputRef.current?.focus(), 80);
    }, [isOpen, tab]);

    useEffect(() => {
        if (!isOpen || tab !== 'requests') return;
        refreshPending();
    }, [isOpen, tab, refreshPending]);

    // Real-time: refresh pending requests when a new friend request arrives
    useEffect(() => {
        if (!socket) return;
        const handler = () => refreshPending();
        socket.on('friend_request_received', handler);
        return () => { socket.off('friend_request_received', handler); };
    }, [socket, refreshPending]);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.trim().length < 2) { setSearchResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setIsSearching(true); setError(null);
            try { setSearchResults(await searchUsers(query.trim())); }
            catch { setError('Search failed. Try again.'); }
            finally { setIsSearching(false); }
        }, 350);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query]);

    const handleSendRequest = useCallback(async (targetUserId: number) => {
        setActionLoading((p) => ({ ...p, [targetUserId]: true }));
        try {
            await sendFriendRequest(targetUserId);
            setSearchResults((prev) => prev.map((u) => u.id === targetUserId ? { ...u, friendship_status: 'pending', requester_id: currentUserId } : u));
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
        finally { setActionLoading((p) => ({ ...p, [targetUserId]: false })); }
    }, [currentUserId]);

    const handleBlock = useCallback(async (targetUserId: number) => {
        try {
            await blockUser(targetUserId);
            setSearchResults((prev) => prev.map((u) => u.id === targetUserId ? { ...u, friendship_status: 'blocked', requester_id: currentUserId } : u));
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to block.'); }
    }, [currentUserId]);

    const handleUnblock = useCallback(async (targetUserId: number) => {
        try {
            await unblockUser(targetUserId);
            setSearchResults((prev) => prev.map((u) => u.id === targetUserId ? { ...u, friendship_status: null, requester_id: null } : u));
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to unblock.'); }
    }, []);

    const handleRespond = useCallback(async (friendshipId: number, action: 'accept' | 'decline') => {
        setActionLoading((p) => ({ ...p, [friendshipId]: true }));
        try {
            await respondToFriendRequest(friendshipId, action);
            setPendingReqs((prev) => prev.filter((r) => r.friendship_id !== friendshipId));
            if (action === 'accept') onFriendAdded();
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
        finally { setActionLoading((p) => ({ ...p, [friendshipId]: false })); }
    }, [onFriendAdded]);

    const { modalRef, dragHandleProps } = useDraggable();

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

            <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Friends"
                className={[
                    'fixed z-50 bg-zinc-900 flex flex-col shadow-2xl',
                    'bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh] sheet-up',
                    'md:bottom-auto md:left-1/2 md:top-1/2',
                    'md:w-[440px] md:max-h-[80vh] md:rounded-2xl md:border md:border-zinc-800/60 md:animate-scale-in',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
            >

                {/* Drag handle (mobile only) */}
                <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
                    <div className="h-1 w-10 rounded-full bg-zinc-700" />
                </div>

                {/* Header — drag handle on desktop */}
                <div className={`h-14 flex items-center justify-between px-4 border-b border-zinc-800/60 shrink-0 ${dragHandleProps.className}`}
                    onMouseDown={dragHandleProps.onMouseDown}>
                    <h2 className="text-sm font-semibold text-white select-none">Friends</h2>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-800/60 shrink-0">
                    {(['requests', 'search'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => { setTab(t); setError(null); }}
                            className={['flex-1 py-3 text-xs font-medium transition-colors relative', tab === t ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'].join(' ')}>
                            {t === 'requests' ? (
                                <span className="flex items-center justify-center gap-1.5">
                                    Requests
                                    {pendingReqs.length > 0 && (
                                        <span className="h-4 min-w-4 px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">{pendingReqs.length}</span>
                                    )}
                                </span>
                            ) : 'Add Friend'}
                            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full tab-pip" />}
                        </button>
                    ))}
                </div>

                {error && <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-red-950/60 border border-red-900/60 text-xs text-red-400">{error}</div>}

                <div className="flex-1 overflow-y-auto">
                    {tab === 'requests' && (
                        <div className="p-3 flex flex-col gap-2">
                            {loadingReqs ? (
                                <div className="flex justify-center py-8"><div className="h-5 w-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
                            ) : pendingReqs.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-10 text-center">
                                    <span className="text-3xl">📭</span>
                                    <p className="text-sm text-zinc-400">No pending requests</p>
                                    <p className="text-xs text-zinc-600">Switch to "Add Friend" to find people</p>
                                </div>
                            ) : pendingReqs.map((req) => (
                                <div key={req.friendship_id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/30">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                        {req.display_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{req.display_name}</p>
                                        <p className="text-xs text-zinc-500 truncate">@{req.username}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button type="button" disabled={actionLoading[req.friendship_id]} onClick={() => handleRespond(req.friendship_id, 'accept')} aria-label={`Accept ${req.display_name}`}
                                            className="h-8 w-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center transition-colors disabled:opacity-50 active:scale-95">
                                            {actionLoading[req.friendship_id] ? <div className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin" /> : (
                                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </button>
                                        <button type="button" disabled={actionLoading[req.friendship_id]} onClick={() => handleRespond(req.friendship_id, 'decline')} aria-label={`Decline ${req.display_name}`}
                                            className="h-8 w-8 rounded-xl bg-zinc-700 hover:bg-red-700 flex items-center justify-center transition-colors disabled:opacity-50 active:scale-95">
                                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'search' && (
                        <div className="p-3 flex flex-col gap-3">
                            <div className="relative">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none">
                                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                </svg>
                                <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username or name…"
                                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl pl-9 pr-3 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors" />
                                {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />}
                            </div>
                            {query.trim().length < 2 ? (
                                <p className="text-xs text-zinc-600 text-center py-4">Type at least 2 characters to search</p>
                            ) : searchResults.length === 0 && !isSearching ? (
                                <p className="text-xs text-zinc-500 text-center py-4">No users found</p>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    {searchResults.map((u) => (
                                        <SearchResultRow key={u.id} user={u} currentUserId={currentUserId} isLoading={!!actionLoading[u.id]} onSendRequest={handleSendRequest} onBlock={handleBlock} onUnblock={handleUnblock} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Safe area bottom padding on mobile */}
                <div className="safe-bottom md:hidden" />
            </div>
        </>
    );
};

const statusColor = (s: string) => ({ online: 'bg-emerald-400', idle: 'bg-amber-400', do_not_disturb: 'bg-red-500' }[s] ?? 'bg-zinc-500');

const SearchResultRow: React.FC<{
    user: SearchUserResult; currentUserId: number; isLoading: boolean;
    onSendRequest: (id: number) => void; onBlock: (id: number) => void; onUnblock: (id: number) => void;
}> = ({ user, currentUserId, isLoading, onSendRequest, onBlock, onUnblock }) => {
    const status = user.friendship_status;
    let actionBtn: React.ReactNode = null;
    if (status === 'accepted') {
        actionBtn = <span className="text-[10px] text-emerald-400 font-medium px-2 py-1 rounded-lg bg-emerald-950/50 border border-emerald-900/40">Friends</span>;
    } else if (status === 'pending') {
        actionBtn = <span className="text-[10px] text-zinc-400 font-medium px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700/40">{user.requester_id === currentUserId ? 'Sent' : 'Received'}</span>;
    } else if (status === 'blocked') {
        actionBtn = (
            <button type="button" onClick={() => onUnblock(user.id)} aria-label={`Unblock ${user.display_name}`}
                className="h-8 px-3 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-400 text-xs font-medium border border-red-900/40 transition-colors active:scale-95">
                Unblock
            </button>
        );
    } else {
        actionBtn = (
            <div className="flex gap-1.5">
                <button type="button" disabled={isLoading} onClick={() => onSendRequest(user.id)} aria-label={`Add ${user.display_name}`}
                    className="h-8 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1 active:scale-95">
                    {isLoading ? <div className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin" /> : (
                        <><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M8.75 3.75a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z" /></svg>Add</>
                    )}
                </button>
                <button type="button" onClick={() => onBlock(user.id)} aria-label={`Block ${user.display_name}`} title="Block user"
                    className="h-8 w-8 rounded-xl bg-zinc-800 hover:bg-red-900/60 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-colors active:scale-95">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zM3.47 4.53l8 8a5.5 5.5 0 01-8-8zm1.06-1.06a5.5 5.5 0 018 8l-8-8z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors">
            <div className="relative shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-sm font-bold text-white">{user.display_name.charAt(0).toUpperCase()}</div>
                <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 ${statusColor(user.online_status)}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.display_name}</p>
                <p className="text-xs text-zinc-500 truncate">@{user.username}</p>
            </div>
            {actionBtn}
        </div>
    );
};

export default FriendPanel;
