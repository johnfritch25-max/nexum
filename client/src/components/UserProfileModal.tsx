import React from 'react';
import { useDraggable } from '../hooks/useDraggable';
import type { FriendSummary } from '../api/users';
import type { FriendActivityState } from '../hooks/useFriendActivity';

interface UserProfileModalProps {
    isOpen:    boolean;
    onClose:   () => void;
    profile:   FriendSummary | null;
    activity:  FriendActivityState | null;
    onMessage: () => void;
    onVoiceCall: () => void;
    onVideoCall: () => void;
}

const statusColor = (s: string) =>
    ({ online: 'bg-emerald-400', idle: 'bg-amber-400', do_not_disturb: 'bg-red-500' }[s] ?? 'bg-zinc-500');

const statusLabel = (s: string) =>
    ({ online: 'Online', idle: 'Idle', do_not_disturb: 'Do Not Disturb', offline: 'Offline' }[s] ?? s);

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
    isOpen, onClose, profile, activity, onMessage, onVoiceCall, onVideoCall,
}) => {
    const { modalRef, dragHandleProps } = useDraggable();

    if (!isOpen) return null;

    // Build display data — use profile if available, fall back to activity
    const displayName  = profile?.display_name ?? `User ${activity?.userId ?? ''}`;
    const username     = profile?.username ?? '';
    const bio: null    = null; // bio is not in FriendSummary
    const lastSeen     = profile?.last_seen_at ?? null;
    const initial      = displayName.charAt(0).toUpperCase();
    const onlineStatus = profile?.online_status ?? 'offline';
    const status       = activity?.onlineStatus ?? onlineStatus;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

            <div ref={modalRef} role="dialog" aria-modal="true" aria-label={`${displayName}'s profile`}
                className={[
                    'fixed z-50 bg-zinc-900 flex flex-col shadow-2xl overflow-hidden',
                    'bottom-0 left-0 right-0 rounded-t-2xl max-h-[80vh] sheet-up',
                    'md:bottom-auto md:left-1/2 md:top-1/2',
                    'md:w-[380px] md:rounded-2xl md:border md:border-zinc-800/60 md:animate-scale-in',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag handle mobile */}
                <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
                    <div className="h-1 w-10 rounded-full bg-zinc-700" />
                </div>

                {/* Header — drag handle */}
                <div className={`flex items-center justify-between px-4 h-12 shrink-0 ${dragHandleProps.className}`}
                    onMouseDown={dragHandleProps.onMouseDown}>
                    <span className="text-xs text-zinc-500 font-medium select-none">Profile</span>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="h-7 w-7 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>

                {/* Banner + avatar */}
                <div className="relative shrink-0">
                    {/* Banner */}
                    <div className="h-24 bg-gradient-to-br from-violet-900/60 to-zinc-900" />
                    {/* Avatar */}
                    <div className="absolute -bottom-8 left-5">
                        <div className="relative">
                            <div className="h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-2xl font-bold text-white border-4 border-zinc-900 select-none">
                                {profile?.avatar_url
                                    ? <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                                    : initial}
                            </div>
                            <span aria-hidden="true" className={`absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-zinc-900 ${statusColor(status)}`} />
                        </div>
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 overflow-y-auto px-5 pt-12 pb-5 flex flex-col gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-white leading-tight">{displayName}</h2>
                        <p className="text-sm text-zinc-500">{username ? `@${username}` : ''}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className={`h-2 w-2 rounded-full ${statusColor(status)}`} />
                            <span className="text-xs text-zinc-400">{statusLabel(status)}</span>
                            {activity?.statusIcon && activity?.statusText && (
                                <span className="text-xs text-zinc-400 ml-1">{activity.statusIcon} {activity.statusText}</span>
                            )}
                        </div>
                    </div>

                    {bio && (
                        <div className="bg-zinc-800/50 rounded-xl px-3 py-2.5 border border-zinc-700/30">
                            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">About</p>
                            <p className="text-sm text-zinc-300 leading-relaxed">{bio}</p>
                        </div>
                    )}

                    {lastSeen && status === 'offline' && (
                        <p className="text-xs text-zinc-600">
                            Last seen {new Date(lastSeen).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => { onMessage(); onClose(); }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors active:scale-[0.98]">
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
                                <path d="M14 6c-.762 0-1.52.02-2.271.062C10.157 6.148 9 7.472 9 8.998v2.24c0 1.519 1.147 2.839 2.71 2.935.214.013.428.024.642.034.2.009.385.09.518.224l2.35 2.35a.75.75 0 001.28-.531v-2.07c1.453-.195 2.5-1.463 2.5-2.942V8.998c0-1.526-1.157-2.85-2.729-2.936A41.645 41.645 0 0014 6z" />
                            </svg>
                            Message
                        </button>
                        {status === 'online' && (
                            <>
                                <button type="button" onClick={() => { onVoiceCall(); onClose(); }}
                                    className="h-10 w-10 rounded-xl bg-zinc-800 hover:bg-emerald-600 text-zinc-400 hover:text-white flex items-center justify-center transition-colors active:scale-95" title="Voice call">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                        <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <button type="button" onClick={() => { onVideoCall(); onClose(); }}
                                    className="h-10 w-10 rounded-xl bg-zinc-800 hover:bg-violet-600 text-zinc-400 hover:text-white flex items-center justify-center transition-colors active:scale-95" title="Video call">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                        <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserProfileModal;
