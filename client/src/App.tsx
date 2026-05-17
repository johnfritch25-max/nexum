import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ErrorBoundary }              from './components/ErrorBoundary';
import { AuthForm }                   from './components/AuthForm';
import { IncognitoToggle }            from './components/IncognitoToggle';
import { CallOverlay }                from './components/CallOverlay';
import { FriendPanel }                from './components/FriendPanel';
import { ProfilePanel }               from './components/ProfilePanel';
import { CommunityHub }               from './components/CommunityHub';
import { GroupChat }                  from './components/GroupChat';
import { CreateGroupModal }           from './components/CreateGroupModal';
import { AboutModal }                 from './components/AboutModal';
import { UserProfileModal }           from './components/UserProfileModal';
import { useAuth }                    from './hooks/useAuth';
import { useSocket }                  from './hooks/useSocket';
import { useIncognitoMode }           from './hooks/useIncognitoMode';
import { useMessages }                from './hooks/useMessages';
import { useFriendActivity }          from './hooks/useFriendActivity';
import { useWebRTC }                  from './hooks/useWebRTC';
import { useReadReceipts }            from './hooks/useReadReceipts';
import { useConversationTransition }  from './hooks/useConversationTransition';
import { useTyping }                  from './hooks/useTyping';
import { useUnreadCounts }            from './hooks/useUnreadCounts';
import { useNotifications }           from './hooks/useNotifications';
import { useInstallPrompt }           from './hooks/useInstallPrompt';
import { editMessage, deleteMessage } from './api/messages';
import { getMe }                      from './api/users';
import { getGroups, type Group }      from './api/groups';

export default function App(): React.ReactElement {
    return <ErrorBoundary><AppInner /></ErrorBoundary>;
}

function AppInner(): React.ReactElement {
    const { user, isLoading, error, login, register, logout } = useAuth();
    if (isLoading) return (
        <div className="h-full bg-zinc-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 animate-pulse" />
                <p className="text-zinc-500 text-sm">Loading…</p>
            </div>
        </div>
    );
    if (!user) return <AuthForm onLogin={login} onRegister={register} error={error} isLoading={isLoading} />;
    return <MessengerShell userId={user.id} displayName={user.display_name} username={user.username} onLogout={logout} />;
}

interface ShellProps { userId: number; displayName: string; username: string; onLogout: () => void; }

function MessengerShell({ userId, displayName: initName, username, onLogout }: ShellProps): React.ReactElement {
    const { socket, isConnected }    = useSocket(userId);
    const incognito                  = useIncognitoMode(socket, userId);
    const { friendActivity, isLoading: friendsLoading, friendProfiles, refresh: refreshFriends } = useFriendActivity(socket, userId);
    const webrtc                     = useWebRTC(socket, userId);
    const { canInstall, install }    = useInstallPrompt();

    const [displayName, setDisplayName] = useState(initName);
    const [bio, setBio]                 = useState<string | null>(null);
    useEffect(() => { getMe().then((p) => setBio(p.bio)).catch(() => {}); }, []);

    const friendList = Array.from(friendActivity.values());
    const [activeFriendId, setActiveFriendId] = useState<number | null>(null);
    const { transitionKey } = useConversationTransition(activeFriendId);

    // Views & panels
    const [activeView,       setActiveView]       = useState<'messages' | 'community' | 'groups'>('messages');
    const [sidebarOpen,      setSidebarOpen]      = useState(false);   // mobile drawer
    const [friendPanelOpen,  setFriendPanelOpen]  = useState(false);
    const [profilePanelOpen, setProfilePanelOpen] = useState(false);
    const [aboutOpen,        setAboutOpen]        = useState(false);
    const [viewingUserId,    setViewingUserId]    = useState<number | null>(null);

    // Groups
    const [groups, setGroups]               = useState<Group[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
    useEffect(() => { getGroups().then(setGroups).catch(() => {}); }, []);

    const { unreadCounts, clearUnread } = useUnreadCounts(socket, userId, activeFriendId);
    const totalUnread = Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0);

    const handleSelectFriend = useCallback((fid: number) => {
        setActiveFriendId(fid);
        clearUnread(fid);
        setFriendPanelOpen(false);
        setSidebarOpen(false);
    }, [clearUnread]);

    useEffect(() => {
        if (activeFriendId === null && friendList.length > 0) {
            handleSelectFriend((friendList.find((f) => f.onlineStatus === 'online') ?? friendList[0]).userId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [friendList.length]);

    const { messages, isLoadingHistory, hasMore, loadMore, sendMessage, sendImage } = useMessages(socket, userId, activeFriendId);
    const { friendIsTyping, onTyping, onSent } = useTyping(socket, userId, activeFriendId);

    const [draft, setDraft]       = useState('');
    const messageListRef          = useRef<HTMLDivElement>(null);
    const imageInputRef           = useRef<HTMLInputElement>(null);
    const [editingId, setEditingId]   = useState<number | null>(null);
    const [editDraft, setEditDraft]   = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const editInputRef = useRef<HTMLInputElement>(null);
    const [ctxMenu, setCtxMenu] = useState<{ msgId: number; x: number; y: number; isMine: boolean } | null>(null);

    const roomId = activeFriendId ? (userId < activeFriendId ? `${userId}_${activeFriendId}` : `${activeFriendId}_${userId}`) : null;
    useReadReceipts(roomId, messageListRef, messages.length);
    useEffect(() => { const el = messageListRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);
    useEffect(() => { if (!ctxMenu) return; const close = () => setCtxMenu(null); window.addEventListener('click', close); return () => window.removeEventListener('click', close); }, [ctxMenu]);
    useEffect(() => { if (editingId !== null) setTimeout(() => editInputRef.current?.focus(), 30); }, [editingId]);

    const activeFriend     = activeFriendId ? friendActivity.get(activeFriendId) : null;
    const activeFriendName = activeFriendId ? (friendProfiles.get(activeFriendId)?.display_name ?? `User ${activeFriendId}`) : '';
    const callerName       = webrtc.incomingCallFrom ? (friendProfiles.get(webrtc.incomingCallFrom)?.display_name ?? `User ${webrtc.incomingCallFrom}`) : activeFriendName;
    const statusColor      = (s: string) => ({ online: 'bg-emerald-400', idle: 'bg-amber-400', do_not_disturb: 'bg-red-500' }[s] ?? 'bg-zinc-500');
    const myInitial        = displayName.charAt(0).toUpperCase();

    // Notifications — must be after activeFriendName and messages are declared
    const latestMsg = messages.length > 0 ? messages[messages.length - 1] : undefined;
    const latestForNotif = latestMsg && latestMsg.senderId !== userId ? {
        senderName:  activeFriendName,
        content:     latestMsg.content,
        messageType: latestMsg.messageType,
    } : undefined;
    useNotifications(totalUnread, latestForNotif);

    const handleEditSave = useCallback(async () => {
        if (!editingId || !editDraft.trim()) return;
        setEditLoading(true);
        try { await editMessage(editingId, editDraft.trim()); }
        catch (err) { console.error('[Edit]', err); }
        finally { setEditLoading(false); setEditingId(null); setEditDraft(''); }
    }, [editingId, editDraft]);

    const handleDelete = useCallback(async (msgId: number) => {
        try { await deleteMessage(msgId); } catch (err) { console.error('[Delete]', err); }
    }, []);

    // ── Sidebar content (shared between drawer and desktop panel) ─────────────
    const SidebarContent = (
        <>
            {/* Header */}
            <div className="h-14 flex items-center px-3 border-b border-zinc-800/60 shrink-0 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shrink-0">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                            <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
                            <path d="M14 6c-.762 0-1.52.02-2.271.062C10.157 6.148 9 7.472 9 8.998v2.24c0 1.519 1.147 2.839 2.71 2.935.214.013.428.024.642.034.2.009.385.09.518.224l2.35 2.35a.75.75 0 001.28-.531v-2.07c1.453-.195 2.5-1.463 2.5-2.942V8.998c0-1.526-1.157-2.85-2.729-2.936A41.645 41.645 0 0014 6z" />
                        </svg>
                    </div>
                    <span className="font-bold text-white text-sm tracking-tight truncate">Nexum</span>
                </div>
                <button type="button" onClick={() => { setFriendPanelOpen((p) => !p); setProfilePanelOpen(false); }} aria-label="Friends"
                    className="relative h-7 w-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors shrink-0">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M11 5a3 3 0 11-6 0 3 3 0 016 0zM2.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 018 18a9.953 9.953 0 01-5.385-1.572zM16.25 5.75a.75.75 0 00-1.5 0v2h-2a.75.75 0 000 1.5h2v2a.75.75 0 001.5 0v-2h2a.75.75 0 000-1.5h-2v-2z" />
                    </svg>
                    {totalUnread > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">{totalUnread > 99 ? '99+' : totalUnread}</span>}
                </button>
            </div>

            {/* Friends list */}
            <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-2 py-1.5">Friends — {friendList.length}</p>
                {friendsLoading ? (
                    <div className="flex flex-col gap-1 px-2 py-1">
                        {[1,2,3].map(i => (
                            <div key={i} className="flex items-center gap-2 py-1.5">
                                <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse shrink-0" />
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <div className="h-2.5 w-24 bg-zinc-800 rounded animate-pulse" />
                                    <div className="h-2 w-16 bg-zinc-800/60 rounded animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : friendList.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-6 text-center px-2">
                        <p className="text-xs text-zinc-600 italic">No friends yet.</p>
                        <button type="button" onClick={() => setFriendPanelOpen(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">+ Add someone</button>
                    </div>
                ) : friendList.map((friend) => {
                    const profile  = friendProfiles.get(friend.userId);
                    const name     = profile?.display_name ?? `User ${friend.userId}`;
                    const isActive = activeFriendId === friend.userId;
                    const unread   = unreadCounts.get(friend.userId) ?? 0;
                    return (
                        <button key={friend.userId} type="button" onClick={() => handleSelectFriend(friend.userId)}
                            aria-current={isActive ? 'true' : undefined}
                            className={['group flex items-center gap-2.5 rounded-xl px-2 py-2 w-full text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500',
                                isActive ? 'bg-violet-600/20 text-white' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'].join(' ')}>
                            <div className="relative shrink-0"
                                onClick={(e) => { e.stopPropagation(); setViewingUserId(friend.userId); }}>
                                <div className={['h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold select-none transition-all duration-200 cursor-pointer hover:ring-2 hover:ring-violet-400',
                                    isActive ? 'bg-gradient-to-br from-violet-500 to-violet-700 text-white scale-105' : 'bg-zinc-700 text-zinc-300'].join(' ')}>
                                    {name.charAt(0).toUpperCase()}
                                </div>
                                <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 presence-dot ${statusColor(friend.onlineStatus)}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate leading-tight">{name}</p>
                                {friend.statusIcon && friend.statusText
                                    ? <p className="text-[10px] text-zinc-500 truncate leading-tight">{friend.statusIcon} {friend.statusText}</p>
                                    : <p className="text-[10px] text-zinc-600 leading-tight capitalize">{friend.onlineStatus.replace('_', ' ')}</p>}
                            </div>
                            {unread > 0 && !isActive && (
                                <span className="shrink-0 min-w-[18px] px-1 h-[18px] rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">{unread > 99 ? '99+' : unread}</span>
                            )}
                            {friend.onlineStatus === 'online' && webrtc.callStatus === 'idle' && unread === 0 && (
                                <div className="opacity-0 group-hover:opacity-100 shrink-0 flex gap-1">
                                    <button type="button" onClick={(e) => { e.stopPropagation(); webrtc.startCall(friend.userId, 'voice'); }} aria-label={`Voice call ${name}`} className="h-6 w-6 rounded-md bg-zinc-700 hover:bg-emerald-600 flex items-center justify-center transition-all">
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M3.5 2A1.5 1.5 0 002 3.5v.003c0 5.523 4.474 9.997 9.997 9.997H12A1.5 1.5 0 0013.5 12v-1.232a1.5 1.5 0 00-1.158-1.464l-1.755-.44a1.5 1.5 0 00-1.58.595l-.36.51a9.024 9.024 0 01-3.116-3.116l.51-.36a1.5 1.5 0 00.595-1.58l-.44-1.755A1.5 1.5 0 004.732 2H3.5z" /></svg>
                                    </button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); webrtc.startCall(friend.userId, 'video'); }} aria-label={`Video call ${name}`} className="h-6 w-6 rounded-md bg-zinc-700 hover:bg-violet-600 flex items-center justify-center transition-all">
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M2 4.5A2.5 2.5 0 014.5 2h5A2.5 2.5 0 0112 4.5v.31l2.124-1.35A.75.75 0 0115 4.102v7.796a.75.75 0 01-1.124.65L12 11.19v.31A2.5 2.5 0 019.5 14h-5A2.5 2.5 0 012 11.5v-7z" /></svg>
                                    </button>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* User panel */}
            <div className="h-14 shrink-0 border-t border-zinc-800/60 flex items-center gap-2.5 px-3">
                <button type="button" onClick={() => { setProfilePanelOpen((p) => !p); setFriendPanelOpen(false); }} aria-label="Edit profile" className="relative shrink-0 group">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-xs font-bold text-white select-none group-hover:ring-2 group-hover:ring-violet-400 transition-all">{myInitial}</div>
                    <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-emerald-400" />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate leading-tight">{displayName}</p>
                    <p className="text-[10px] text-zinc-500 leading-tight">{incognito.isIncognito ? '👻 Incognito' : '● Online'}</p>
                </div>
                <button type="button" onClick={onLogout} aria-label="Sign out" className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-1.08a.75.75 0 10-1.004-1.114l-2.5 2.5a.75.75 0 000 1.114l2.5 2.5a.75.75 0 101.004-1.114l-1.048-1.08h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
                    </svg>
                </button>
                <button type="button" onClick={() => setAboutOpen(true)} aria-label="About Nexum" title="About"
                    className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </>
    );

    return (
        <>
            <CallOverlay {...webrtc} remoteName={callerName} />
            <FriendPanel isOpen={friendPanelOpen} onClose={() => setFriendPanelOpen(false)} onFriendAdded={refreshFriends} currentUserId={userId} />
            <ProfilePanel isOpen={profilePanelOpen} onClose={() => setProfilePanelOpen(false)} displayName={displayName} bio={bio} username={username} onSaved={(n, b) => { setDisplayName(n); setBio(b); }} />
            <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
            <UserProfileModal
                isOpen={viewingUserId !== null}
                onClose={() => setViewingUserId(null)}
                profile={viewingUserId ? (friendProfiles.get(viewingUserId) ?? null) : null}
                activity={viewingUserId ? (friendActivity.get(viewingUserId) ?? null) : null}
                onMessage={() => { if (viewingUserId) handleSelectFriend(viewingUserId); }}
                onVoiceCall={() => { if (viewingUserId) webrtc.startCall(viewingUserId, 'voice'); }}
                onVideoCall={() => { if (viewingUserId) webrtc.startCall(viewingUserId, 'video'); }}
            />
            <CreateGroupModal
                isOpen={createGroupOpen}
                onClose={() => setCreateGroupOpen(false)}
                onCreated={(g) => { setGroups((prev) => [g, ...prev]); setActiveGroupId(g.id); setActiveView('groups'); }}
            />

            {/* Context menu */}
            {ctxMenu && (
                <div role="menu" className="fixed z-50 bg-zinc-800 border border-zinc-700/60 rounded-xl shadow-2xl py-1 min-w-[140px] text-sm"
                    onClick={(e) => e.stopPropagation()}
                    ref={(el) => { if (el) { el.style.top = `${ctxMenu.y}px`; el.style.left = `${ctxMenu.x}px`; } }}>
                    {ctxMenu.isMine && (
                        <button role="menuitem" type="button" className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                            onClick={() => { const msg = messages.find((m) => m.id === ctxMenu.msgId); if (msg) { setEditingId(msg.id); setEditDraft(msg.content); } setCtxMenu(null); }}>
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400"><path d="M13.488 2.513a1.75 1.75 0 00-2.475 0L6.75 6.774a2.75 2.75 0 00-.596.892l-.848 2.047a.75.75 0 00.98.98l2.047-.848a2.75 2.75 0 00.892-.596l4.261-4.263a1.75 1.75 0 000-2.474z" /></svg>
                            Edit
                        </button>
                    )}
                    {ctxMenu.isMine && (
                        <button role="menuitem" type="button" className="w-full text-left px-3 py-2 text-red-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                            onClick={() => { handleDelete(ctxMenu.msgId); setCtxMenu(null); }}>
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 000 1.5h.3l.815 8.15A1.5 1.5 0 005.357 15h5.285a1.5 1.5 0 001.493-1.35l.815-8.15h.3a.75.75 0 000-1.5H11v-.75A2.25 2.25 0 008.75 1h-1.5A2.25 2.25 0 005 3.25z" clipRule="evenodd" /></svg>
                            Delete
                        </button>
                    )}
                    <button role="menuitem" type="button" className="w-full text-left px-3 py-2 text-zinc-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                        onClick={() => { navigator.clipboard.writeText(messages.find((m) => m.id === ctxMenu.msgId)?.content ?? ''); setCtxMenu(null); }}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M3.5 2A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h5a1.5 1.5 0 001.5-1.5v-.5h1v.5a2.5 2.5 0 01-2.5 2.5h-5A2.5 2.5 0 011 12.5v-9A2.5 2.5 0 013.5 1h5A2.5 2.5 0 0111 3.5V4h-1v-.5A1.5 1.5 0 008.5 2h-5z" /><path d="M7.5 4A1.5 1.5 0 006 5.5v9A1.5 1.5 0 007.5 16h5a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0012.5 4h-5z" /></svg>
                        Copy
                    </button>
                </div>
            )}

            {/* ── Mobile sidebar drawer ── */}
            {sidebarOpen && (
                <>
                    <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
                    <aside className="fixed top-0 left-0 bottom-0 z-40 w-72 flex flex-col bg-zinc-900 border-r border-zinc-800/60 shadow-2xl drawer-in md:hidden">
                        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800/60 shrink-0">
                            <span className="font-bold text-white text-sm">Nexum</span>
                            <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"
                                className="h-8 w-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden">{SidebarContent}</div>
                        <div className="safe-bottom" />
                    </aside>
                </>
            )}

            {/* ── Main layout ── */}
            <div className="h-full flex bg-zinc-950 text-white overflow-hidden">

                {/* Desktop nav rail */}
                <nav className="hidden md:flex w-14 shrink-0 flex-col items-center py-3 gap-1 border-r border-zinc-800/60 bg-zinc-950" aria-label="Main navigation">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center mb-2 shrink-0">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                            <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
                            <path d="M14 6c-.762 0-1.52.02-2.271.062C10.157 6.148 9 7.472 9 8.998v2.24c0 1.519 1.147 2.839 2.71 2.935.214.013.428.024.642.034.2.009.385.09.518.224l2.35 2.35a.75.75 0 001.28-.531v-2.07c1.453-.195 2.5-1.463 2.5-2.942V8.998c0-1.526-1.157-2.85-2.729-2.936A41.645 41.645 0 0014 6z" />
                        </svg>
                    </div>
                    <NavRailBtn label="Messages" active={activeView === 'messages'} badge={totalUnread} onClick={() => setActiveView('messages')}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                            <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
                            <path d="M14 6c-.762 0-1.52.02-2.271.062C10.157 6.148 9 7.472 9 8.998v2.24c0 1.519 1.147 2.839 2.71 2.935.214.013.428.024.642.034.2.009.385.09.518.224l2.35 2.35a.75.75 0 001.28-.531v-2.07c1.453-.195 2.5-1.463 2.5-2.942V8.998c0-1.526-1.157-2.85-2.729-2.936A41.645 41.645 0 0014 6z" />
                        </svg>
                    </NavRailBtn>
                    <NavRailBtn label="Community" active={activeView === 'community'} onClick={() => setActiveView('community')}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                        </svg>
                    </NavRailBtn>
                    <NavRailBtn label="Groups" active={activeView === 'groups'} onClick={() => setActiveView('groups')}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                            <path d="M2 4.5A2.5 2.5 0 014.5 2h11a2.5 2.5 0 010 5h-11A2.5 2.5 0 012 4.5zM2.75 9.083a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75zM2.75 12.663a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75zM2.75 16.25a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75z" />
                        </svg>
                    </NavRailBtn>
                    <div className="flex-1" />
                    {canInstall && (
                        <button type="button" onClick={install} aria-label="Install Nexum app" title="Install App"
                            className="h-9 w-9 rounded-xl flex items-center justify-center text-violet-400 hover:text-white hover:bg-violet-600 transition-all mb-1 animate-pulse-slow">
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                            </svg>
                        </button>
                    )}
                    <span className={`h-2 w-2 rounded-full mb-1 presence-dot transition-all duration-500 ${isConnected ? 'bg-emerald-400 connected-pulse' : 'bg-zinc-600'}`} title={isConnected ? 'Connected' : 'Disconnected'} />
                </nav>

                {/* Desktop sidebar */}
                {activeView === 'messages' && (
                    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-zinc-800/60 bg-zinc-900/50">
                        {SidebarContent}
                    </aside>
                )}

                {/* Community view */}
                {activeView === 'community' && <CommunityHub socket={socket} userId={userId} displayName={displayName} />}

                {/* Groups view */}
                {activeView === 'groups' && (
                    <div className="flex-1 flex min-w-0">
                        {/* Groups sidebar */}
                        <div className={['flex flex-col border-r border-zinc-800/60 bg-zinc-900/50', activeGroup ? 'hidden md:flex w-64' : 'flex flex-1 md:flex-none md:w-64'].join(' ')}>
                            <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-800/60 shrink-0">
                                <p className="text-sm font-semibold text-white">Groups</p>
                                <button type="button" aria-label="Create group"
                                    onClick={() => setCreateGroupOpen(true)}
                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                    </svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
                                {groups.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 py-8 text-center px-3">
                                        <span className="text-3xl">👥</span>
                                        <p className="text-xs text-zinc-600">No groups yet.</p>
                                        <p className="text-xs text-zinc-600">Tap + to create one.</p>
                                    </div>
                                ) : groups.map((g) => (
                                    <button key={g.id} type="button" onClick={() => setActiveGroupId(g.id)}
                                        aria-current={activeGroupId === g.id ? 'true' : undefined}
                                        className={['flex items-center gap-2.5 rounded-xl px-2 py-2 w-full text-left transition-all duration-150',
                                            activeGroupId === g.id ? 'bg-violet-600/20 text-white' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'].join(' ')}>
                                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-fuchsia-600 to-violet-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                            {g.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium truncate">{g.name}</p>
                                            <p className="text-[10px] text-zinc-600 truncate">{g.member_count} members</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Group chat area */}
                        {activeGroup ? (
                            <GroupChat socket={socket} userId={userId} group={activeGroup} onBack={() => setActiveGroupId(null)} />
                        ) : (
                            <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-center bg-zinc-950">
                                <div className="h-16 w-16 rounded-2xl bg-zinc-800/60 flex items-center justify-center text-3xl">👥</div>
                                <p className="text-sm font-medium text-zinc-300">Select a group to chat</p>
                                <p className="text-xs text-zinc-600">Or create a new one with +</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Messages view */}
                {activeView === 'messages' && (
                    <div className="flex-1 flex flex-col min-w-0">

                        {/* Chat header */}
                        <div className="h-14 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-zinc-800/60 bg-zinc-900/30 safe-top">
                            <div className="flex items-center gap-2 min-w-0">
                                {/* Mobile: hamburger */}
                                <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open contacts"
                                    className="md:hidden h-8 w-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors shrink-0">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                        <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                {activeFriend ? (
                                    <div className="flex items-center gap-2 animate-slide-right min-w-0" key={`hdr-${transitionKey}`}>
                                        <div className="relative shrink-0 cursor-pointer"
                                            onClick={() => activeFriendId && setViewingUserId(activeFriendId)}>
                                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-xs font-bold text-white hover:ring-2 hover:ring-violet-400 transition-all">
                                                {activeFriendName.charAt(0).toUpperCase()}
                                            </div>
                                            <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 presence-dot ${statusColor(activeFriend.onlineStatus)}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white leading-tight truncate">{activeFriendName}</p>
                                            {friendIsTyping ? (
                                                <p className="text-[11px] text-violet-400 leading-tight flex items-center gap-1">
                                                    <span className="flex gap-0.5"><span className="typing-dot h-1 w-1 rounded-full bg-violet-400 inline-block" /><span className="typing-dot h-1 w-1 rounded-full bg-violet-400 inline-block" /><span className="typing-dot h-1 w-1 rounded-full bg-violet-400 inline-block" /></span>
                                                    typing…
                                                </p>
                                            ) : activeFriend.statusIcon && activeFriend.statusText ? (
                                                <p className="text-[11px] text-zinc-400 leading-tight status-fade truncate">{activeFriend.statusIcon} {activeFriend.statusText}</p>
                                            ) : (
                                                <p className="text-[11px] text-zinc-500 leading-tight capitalize status-fade">{activeFriend.onlineStatus.replace('_', ' ')}</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-zinc-500 truncate">Select a friend to chat</p>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {activeFriend && webrtc.callStatus === 'idle' && (
                                    <>
                                        <button type="button" onClick={() => webrtc.startCall(activeFriendId!, 'voice')} aria-label="Voice call" title="Voice call"
                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
                                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" /></svg>
                                        </button>
                                        <button type="button" onClick={() => webrtc.startCall(activeFriendId!, 'video')} aria-label="Video call" title="Video call"
                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
                                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" /></svg>
                                        </button>
                                    </>
                                )}
                                <div className="hidden sm:block"><IncognitoToggle {...incognito} compact /></div>
                                <div className={['hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium transition-all duration-500',
                                    isConnected ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60' : 'bg-zinc-800 text-zinc-500 border border-zinc-700/40'].join(' ')}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400 connected-pulse' : 'bg-zinc-500'}`} />
                                    {isConnected ? 'Live' : 'Offline'}
                                </div>
                                {/* Mobile connection dot */}
                                <span className={`sm:hidden h-2 w-2 rounded-full presence-dot ${isConnected ? 'bg-emerald-400 connected-pulse' : 'bg-zinc-600'}`} />
                            </div>
                        </div>

                        {/* Message list */}
                        <div key={transitionKey} ref={messageListRef} role="log" aria-label="Conversation messages" aria-live="polite"
                            className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-1 panel-slide-in">
                            {hasMore && (
                                <button type="button" onClick={loadMore} disabled={isLoadingHistory}
                                    className="self-center mb-2 text-xs text-violet-400 hover:text-violet-300 disabled:text-zinc-600 transition-colors rounded-xl px-3 py-1.5 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60">
                                    {isLoadingHistory ? 'Loading...' : 'Load older messages'}
                                </button>
                            )}
                            {isLoadingHistory ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
                                    <div className="h-16 w-16 rounded-2xl bg-zinc-800/60 flex items-center justify-center text-3xl">{activeFriendId ? '👋' : '💬'}</div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">{activeFriendId ? `Start a conversation with ${activeFriendName}` : 'No conversation selected'}</p>
                                        <p className="text-xs text-zinc-600 mt-0.5">{activeFriendId ? 'Say hello!' : 'Tap the menu to pick a friend'}</p>
                                    </div>
                                </div>
                            ) : messages.map((msg, i) => {
                                const isMine    = msg.senderId === userId;
                                const prevMsg   = messages[i - 1];
                                const isGrouped = prevMsg && prevMsg.senderId === msg.senderId && (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 60000;
                                const isEditing = editingId === msg.id;
                                return (
                                    <div key={msg.id} className={`flex bubble-in ${isMine ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
                                        onContextMenu={(e) => { if (msg.isDeleted || msg.messageType === 'image') return; e.preventDefault(); setCtxMenu({ msgId: msg.id, x: e.clientX, y: e.clientY, isMine }); }}>
                                        {!isMine && !isGrouped && <div className="h-7 w-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0 mr-2 mt-0.5">{activeFriendName.charAt(0).toUpperCase()}</div>}
                                        {!isMine && isGrouped && <div className="w-7 mr-2 shrink-0" />}
                                        <div className={`max-w-[80%] sm:max-w-[65%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                            {isEditing ? (
                                                <div className="flex items-center gap-1.5 w-full">
                                                    <input ref={editInputRef} id={`edit-${msg.id}`} type="text" aria-label="Edit message" value={editDraft}
                                                        onChange={(e) => setEditDraft(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') { setEditingId(null); setEditDraft(''); } }}
                                                        maxLength={4000} className="flex-1 bg-zinc-700 border border-violet-500/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none" />
                                                    <button type="button" onClick={handleEditSave} disabled={editLoading || !editDraft.trim()} className="h-8 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs disabled:opacity-50 transition-colors">{editLoading ? '…' : 'Save'}</button>
                                                    <button type="button" onClick={() => { setEditingId(null); setEditDraft(''); }} className="h-8 px-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs transition-colors">✕</button>
                                                </div>
                                            ) : (
                                                <div className={[
                                                    msg.messageType === 'image' && !msg.isDeleted ? 'rounded-2xl overflow-hidden shadow-message' : 'px-3.5 py-2 rounded-2xl text-sm shadow-message leading-relaxed',
                                                    msg.isDeleted ? 'bg-zinc-800/60 text-zinc-500 italic border border-zinc-700/40 px-3.5 py-2'
                                                        : msg.messageType === 'image' ? (isMine ? 'bg-gradient-to-br from-violet-600 to-violet-700 rounded-br-sm' : 'bg-zinc-800 rounded-bl-sm border border-zinc-700/30')
                                                        : isMine ? 'bg-gradient-to-br from-violet-600 to-violet-700 text-white rounded-br-sm' : 'bg-zinc-800 text-zinc-100 rounded-bl-sm border border-zinc-700/30',
                                                ].join(' ')}>
                                                    {msg.isDeleted ? <p className="text-sm">Message deleted</p>
                                                        : msg.messageType === 'image' ? <img src={msg.content} alt="Shared image" className="max-w-[240px] sm:max-w-[260px] max-h-[300px] sm:max-h-[320px] object-contain cursor-pointer block" onClick={() => window.open(msg.content, '_blank')} loading="lazy" />
                                                        : <p className="break-words whitespace-pre-wrap">{msg.content}</p>}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1 mt-0.5 px-1">
                                                {msg.isEdited && !msg.isDeleted && <span className="text-[10px] text-zinc-600">edited ·</span>}
                                                <time dateTime={msg.createdAt} className="text-[10px] text-zinc-600">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                                                {isMine && msg.readAt && <span aria-label="Read" className="text-[10px] text-violet-400">✓✓</span>}
                                            </div>
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
                                    if (!file || !activeFriendId) return;
                                    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return; }
                                    const reader = new FileReader();
                                    reader.onload = () => { sendImage(reader.result as string, file.type); };
                                    reader.readAsDataURL(file);
                                    e.target.value = '';
                                }} />
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                if (!draft.trim()) return;
                                const btn = (e.currentTarget as HTMLFormElement).querySelector('button[type="submit"]');
                                if (btn) { btn.classList.remove('send-pop'); void (btn as HTMLElement).offsetWidth; btn.classList.add('send-pop'); }
                                sendMessage(draft); onSent(); setDraft('');
                            }} aria-label="Send a message"
                                className={['flex items-center gap-2 rounded-2xl px-3 sm:px-4 py-2.5 border transition-all duration-200',
                                    draft.trim() ? 'bg-zinc-800 border-violet-600/50 shadow-glow-sm' : 'bg-zinc-800/60 border-zinc-700/50'].join(' ')}>
                                <button type="button" disabled={!activeFriendId || !isConnected} aria-label="Attach image" onClick={() => imageInputRef.current?.click()}
                                    className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909.47.47a.75.75 0 11-1.06 1.06L6.53 8.091a.75.75 0 00-1.06 0l-2.97 2.97zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" /></svg>
                                </button>
                                <label htmlFor="msg-input" className="sr-only">Type a message</label>
                                <input id="msg-input" type="text" value={draft}
                                    onChange={(e) => { setDraft(e.target.value); if (e.target.value) onTyping(); }}
                                    placeholder={activeFriendId ? `Message ${activeFriendName}…` : 'Select a friend first'}
                                    maxLength={4000} autoComplete="off" disabled={!activeFriendId}
                                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none disabled:opacity-40 transition-opacity duration-200" />
                                <button type="submit" disabled={!draft.trim() || !isConnected || !activeFriendId} aria-label="Send message"
                                    className={['shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95',
                                        draft.trim() && isConnected && activeFriendId ? 'bg-violet-600 hover:bg-violet-500 text-white hover:scale-110' : 'bg-zinc-700 text-zinc-600 cursor-not-allowed'].join(' ')}>
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" /></svg>
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Mobile bottom tab bar ── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800/60 flex items-center safe-bottom" aria-label="Bottom navigation">
                <MobileTabBtn label="Messages" active={activeView === 'messages'} badge={totalUnread}
                    onClick={() => { setActiveView('messages'); setSidebarOpen(false); }}>
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
                        <path d="M14 6c-.762 0-1.52.02-2.271.062C10.157 6.148 9 7.472 9 8.998v2.24c0 1.519 1.147 2.839 2.71 2.935.214.013.428.024.642.034.2.009.385.09.518.224l2.35 2.35a.75.75 0 001.28-.531v-2.07c1.453-.195 2.5-1.463 2.5-2.942V8.998c0-1.526-1.157-2.85-2.729-2.936A41.645 41.645 0 0014 6z" />
                    </svg>
                </MobileTabBtn>
                <MobileTabBtn label="Community" active={activeView === 'community'}
                    onClick={() => { setActiveView('community'); setSidebarOpen(false); }}>
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                    </svg>
                </MobileTabBtn>
                <MobileTabBtn label="Groups" active={activeView === 'groups'}
                    onClick={() => { setActiveView('groups'); setSidebarOpen(false); }}>
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M2 4.5A2.5 2.5 0 014.5 2h11a2.5 2.5 0 010 5h-11A2.5 2.5 0 012 4.5zM2.75 9.083a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75zM2.75 12.663a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75zM2.75 16.25a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75z" />
                    </svg>
                </MobileTabBtn>
                <MobileTabBtn label="Contacts" active={sidebarOpen}
                    onClick={() => { setSidebarOpen((p) => !p); setActiveView('messages'); }}>
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" />
                    </svg>
                </MobileTabBtn>
                <MobileTabBtn label="Profile" active={profilePanelOpen}
                    onClick={() => { setProfilePanelOpen((p) => !p); setFriendPanelOpen(false); }}>
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-[10px] font-bold text-white">{myInitial}</div>
                </MobileTabBtn>
                {canInstall && (
                    <MobileTabBtn label="Install" active={false} onClick={install}>
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                            <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                        </svg>
                    </MobileTabBtn>
                )}
            </nav>
        </>
    );
}

// ── Desktop nav rail button ───────────────────────────────────────────────────
function NavRailBtn({ label, active, badge, onClick, children }: {
    label: string; active: boolean; badge?: number; onClick: () => void; children: React.ReactNode;
}): React.ReactElement {
    return (
        <div className="relative group">
            <button type="button" onClick={onClick} aria-label={label} aria-current={active ? 'page' : undefined}
                className={['h-10 w-10 rounded-2xl flex items-center justify-center transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500',
                    active ? 'bg-violet-600 text-white shadow-glow-violet scale-105' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 hover:rounded-xl'].join(' ')}>
                {children}
            </button>
            {!!badge && badge > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
            <div className="absolute left-12 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="bg-zinc-800 border border-zinc-700/60 text-white text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap shadow-xl">{label}</div>
            </div>
        </div>
    );
}

// ── Mobile bottom tab button ──────────────────────────────────────────────────
function MobileTabBtn({ label, active, badge, onClick, children }: {
    label: string; active: boolean; badge?: number; onClick: () => void; children: React.ReactNode;
}): React.ReactElement {
    return (
        <button type="button" onClick={onClick} aria-label={label} aria-current={active ? 'page' : undefined}
            className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors focus-visible:outline-none">
            <div className={['transition-all duration-200', active ? 'text-violet-400 scale-110' : 'text-zinc-500'].join(' ')}>
                {children}
            </div>
            <span className={['text-[10px] font-medium transition-colors', active ? 'text-violet-400' : 'text-zinc-600'].join(' ')}>{label}</span>
            {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-violet-500 tab-pip" />}
            {!!badge && badge > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-14px)] h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </button>
    );
}
