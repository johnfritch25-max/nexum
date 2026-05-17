import React, { useState, useRef, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { useGroupMessages } from '../hooks/useGroupMessages';
import { getGroupMembers, addGroupMember, type GroupMember } from '../api/groups';
import { getFriends } from '../api/users';
import type { Group } from '../api/groups';

interface GroupChatProps {
    socket:      Socket | null;
    userId:      number;
    group:       Group;
    onBack:      () => void;
}

export const GroupChat: React.FC<GroupChatProps> = ({ socket, userId, group, onBack }) => {
    const { messages, isLoading, hasMore, loadMore, sendMessage, sendImage } = useGroupMessages(socket, group.id, userId);
    const [draft, setDraft]           = useState('');
    const [showMembers, setShowMembers] = useState(false);
    const [members, setMembers]       = useState<GroupMember[]>([]);
    const [addingId, setAddingId]     = useState<number | null>(null);
    const [friends, setFriends]       = useState<{ id: number; display_name: string; username: string }[]>([]);
    const listRef                     = useRef<HTMLDivElement>(null);
    const imageInputRef               = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    const openMembers = async () => {
        const [m, f] = await Promise.all([getGroupMembers(group.id), getFriends()]);
        setMembers(m);
        setFriends(f);
        setShowMembers(true);
    };

    const handleAddMember = async (friendId: number) => {
        setAddingId(friendId);
        try {
            await addGroupMember(group.id, friendId);
            const m = await getGroupMembers(group.id);
            setMembers(m);
        } catch { /* ignore */ }
        finally { setAddingId(null); }
    };

    const memberIds = new Set(members.map((m) => m.id));

    return (
        <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="h-14 shrink-0 flex items-center gap-3 px-3 sm:px-4 border-b border-zinc-800/60 bg-zinc-900/30">
                <button type="button" onClick={onBack} aria-label="Back" className="md:hidden h-8 w-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors shrink-0">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
                </button>
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-fuchsia-600 to-violet-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {group.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{group.name}</p>
                    <p className="text-[10px] text-zinc-500">{group.member_count} members</p>
                </div>
                {/* Add member button */}
                <button type="button" onClick={openMembers} aria-label="Manage members"
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors shrink-0">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M11 5a3 3 0 11-6 0 3 3 0 016 0zM2.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 018 18a9.953 9.953 0 01-5.385-1.572zM16.25 5.75a.75.75 0 00-1.5 0v2h-2a.75.75 0 000 1.5h2v2a.75.75 0 001.5 0v-2h2a.75.75 0 000-1.5h-2v-2z" />
                    </svg>
                </button>
            </div>

            {/* Members panel */}
            {showMembers && (
                <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-900/50 px-4 py-3 flex flex-col gap-3 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-zinc-400">Members ({members.length})</p>
                        <button type="button" onClick={() => setShowMembers(false)} aria-label="Close"
                            className="text-zinc-500 hover:text-white text-xs transition-colors">✕</button>
                    </div>
                    {/* Current members */}
                    <div className="flex flex-wrap gap-1.5">
                        {members.map((m) => (
                            <span key={m.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700/40 text-xs text-zinc-300">
                                <span className="h-4 w-4 rounded-full bg-violet-600 flex items-center justify-center text-[9px] font-bold text-white">{m.display_name.charAt(0).toUpperCase()}</span>
                                {m.display_name}
                            </span>
                        ))}
                    </div>
                    {/* Friends to add */}
                    {friends.filter((f) => !memberIds.has(f.id)).length > 0 && (
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">Add friends</p>
                            {friends.filter((f) => !memberIds.has(f.id)).map((f) => (
                                <div key={f.id} className="flex items-center gap-2 py-1">
                                    <div className="h-6 w-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
                                        {f.display_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="flex-1 text-xs text-zinc-300 truncate">{f.display_name}</span>
                                    <button type="button" onClick={() => handleAddMember(f.id)} disabled={addingId === f.id}
                                        className="h-6 px-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-medium transition-colors disabled:opacity-50 active:scale-95">
                                        {addingId === f.id ? '…' : '+ Add'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Messages */}
            <div ref={listRef} role="log" aria-label="Group messages" aria-live="polite"
                className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 flex flex-col gap-1 panel-slide-in">
                {hasMore && (
                    <button type="button" onClick={loadMore} disabled={isLoading}
                        className="self-center mb-2 text-xs text-violet-400 hover:text-violet-300 disabled:text-zinc-600 transition-colors rounded-xl px-3 py-1.5 bg-zinc-800/60 border border-zinc-700/60">
                        {isLoading ? 'Loading...' : 'Load older'}
                    </button>
                )}
                {isLoading && messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center"><div className="h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-zinc-800/60 flex items-center justify-center text-3xl">👥</div>
                        <p className="text-sm font-medium text-zinc-300">No messages yet</p>
                        <p className="text-xs text-zinc-600">Say hello to the group!</p>
                    </div>
                ) : messages.map((msg, i) => {
                    const isMine    = msg.sender_id === userId;
                    const prevMsg   = messages[i - 1];
                    const isGrouped = prevMsg && prevMsg.sender_id === msg.sender_id && (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 60000;
                    return (
                        <div key={msg.id} className={`flex bubble-in ${isMine ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}>
                            {!isMine && !isGrouped && (
                                <div className="h-7 w-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0 mr-2 mt-0.5">
                                    {msg.sender_name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {!isMine && isGrouped && <div className="w-7 mr-2 shrink-0" />}
                            <div className={`max-w-[80%] sm:max-w-[65%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                {!isMine && !isGrouped && <p className="text-[10px] text-zinc-500 px-1 mb-0.5">{msg.sender_name}</p>}
                                <div className={[
                                    msg.message_type === 'image' ? 'rounded-2xl overflow-hidden shadow-message' : 'px-3.5 py-2 rounded-2xl text-sm shadow-message leading-relaxed',
                                    msg.is_deleted ? 'bg-zinc-800/60 text-zinc-500 italic border border-zinc-700/40 px-3.5 py-2'
                                        : msg.message_type === 'image' ? (isMine ? 'bg-gradient-to-br from-violet-600 to-violet-700 rounded-br-sm' : 'bg-zinc-800 rounded-bl-sm border border-zinc-700/30')
                                        : isMine ? 'bg-gradient-to-br from-violet-600 to-violet-700 text-white rounded-br-sm' : 'bg-zinc-800 text-zinc-100 rounded-bl-sm border border-zinc-700/30',
                                ].join(' ')}>
                                    {msg.is_deleted ? <p className="text-sm">Message deleted</p>
                                        : msg.message_type === 'image' ? <img src={msg.content} alt="Shared image" className="max-w-[240px] sm:max-w-[260px] max-h-[300px] object-contain cursor-pointer block" onClick={() => window.open(msg.content, '_blank')} loading="lazy" />
                                        : <p className="break-words whitespace-pre-wrap">{msg.content}</p>}
                                </div>
                                <time dateTime={msg.created_at} className="text-[10px] text-zinc-600 mt-0.5 px-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </time>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Compose */}
            <div className="shrink-0 px-3 sm:px-4 pt-2 pb-20 md:pb-4">
                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="sr-only" aria-hidden="true"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return; }
                        const reader = new FileReader();
                        reader.onload = () => { sendImage(reader.result as string, file.type); };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                    }} />
                <form onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; sendMessage(draft); setDraft(''); }}
                    aria-label="Send a group message"
                    className={['flex items-center gap-2 rounded-2xl px-3 sm:px-4 py-2.5 border transition-all duration-200',
                        draft.trim() ? 'bg-zinc-800 border-violet-600/50 shadow-glow-sm' : 'bg-zinc-800/60 border-zinc-700/50'].join(' ')}>
                    <button type="button" onClick={() => imageInputRef.current?.click()} aria-label="Attach image"
                        className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors active:scale-95">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909.47.47a.75.75 0 11-1.06 1.06L6.53 8.091a.75.75 0 00-1.06 0l-2.97 2.97zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" /></svg>
                    </button>
                    <label htmlFor="group-msg-input" className="sr-only">Type a group message</label>
                    <input id="group-msg-input" type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
                        placeholder={`Message ${group.name}…`} maxLength={4000} autoComplete="off"
                        className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none" />
                    <button type="submit" disabled={!draft.trim()} aria-label="Send"
                        className={['shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95',
                            draft.trim() ? 'bg-violet-600 hover:bg-violet-500 text-white hover:scale-110' : 'bg-zinc-700 text-zinc-600 cursor-not-allowed'].join(' ')}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" /></svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default GroupChat;
