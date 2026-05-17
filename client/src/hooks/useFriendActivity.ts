/**
 * useFriendActivity.ts
 * Maintains a live map of friend activity and presence states.
 *
 * On mount: fetches the friend list from the REST API to seed initial state.
 * Then listens for real-time socket events to keep the map current.
 */

import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getFriends, type FriendSummary } from '../api/users';

export interface FriendActivityState {
    userId: number;
    onlineStatus: 'online' | 'idle' | 'do_not_disturb' | 'offline';
    statusIcon: string | null;
    statusText: string | null;
    updatedAt: string;
}

export type FriendActivityMap = Map<number, FriendActivityState>;

export interface UseFriendActivityReturn {
    friendActivity: FriendActivityMap;
    friendProfiles: Map<number, FriendSummary>;
    isLoading: boolean;
    refresh: () => void;
}

/**
 * @param socket  Active Socket.io client instance.
 * @param userId  Authenticated user's DB id — used to trigger the initial fetch.
 */
export function useFriendActivity(
    socket: Socket | null,
    userId: number | null
): UseFriendActivityReturn {
    const [friendActivity, setFriendActivity] = useState<FriendActivityMap>(new Map());
    const [friendProfiles, setFriendProfiles] = useState<Map<number, FriendSummary>>(new Map());
    const [isLoading, setIsLoading]           = useState(false);
    const [refreshTick, setRefreshTick]       = useState(0);

    const refresh = () => setRefreshTick((t) => t + 1);

    // ── Seed from REST API ────────────────────────────────────────────────────
    useEffect(() => {
        if (!userId) return;

        setIsLoading(true);
        getFriends()
            .then((friends) => {
                const activityMap = new Map<number, FriendActivityState>();
                const profileMap  = new Map<number, FriendSummary>();

                for (const f of friends) {
                    activityMap.set(f.id, {
                        userId:       f.id,
                        onlineStatus: (f.online_status as FriendActivityState['onlineStatus']) ?? 'offline',
                        statusIcon:   f.current_status_icon,
                        statusText:   f.current_status_text,
                        updatedAt:    f.last_seen_at ?? new Date().toISOString(),
                    });
                    profileMap.set(f.id, f);
                }

                setFriendActivity(activityMap);
                setFriendProfiles(profileMap);
            })
            .catch((err) => {
                console.error('[useFriendActivity] Failed to load friends:', err);
            })
            .finally(() => setIsLoading(false));
    }, [userId, refreshTick]);

    // ── Real-time updates ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const handleActivityUpdate = (payload: {
            userId: number;
            statusIcon: string | null;
            statusText: string | null;
            updatedAt: string;
        }) => {
            setFriendActivity((prev) => {
                const next     = new Map(prev);
                const existing = next.get(payload.userId);
                next.set(payload.userId, {
                    userId:       payload.userId,
                    onlineStatus: existing?.onlineStatus ?? 'online',
                    statusIcon:   payload.statusIcon,
                    statusText:   payload.statusText,
                    updatedAt:    payload.updatedAt,
                });
                return next;
            });
        };

        const handlePresenceUpdate = (payload: {
            userId: number;
            onlineStatus: FriendActivityState['onlineStatus'];
            updatedAt: string;
        }) => {
            setFriendActivity((prev) => {
                const next     = new Map(prev);
                const existing = next.get(payload.userId);
                next.set(payload.userId, {
                    userId:       payload.userId,
                    onlineStatus: payload.onlineStatus,
                    statusIcon:   existing?.statusIcon ?? null,
                    statusText:   existing?.statusText ?? null,
                    updatedAt:    payload.updatedAt,
                });
                return next;
            });
        };

        socket.on('friend_activity_updated', handleActivityUpdate);
        socket.on('friend_presence_updated', handlePresenceUpdate);

        return () => {
            socket.off('friend_activity_updated', handleActivityUpdate);
            socket.off('friend_presence_updated', handlePresenceUpdate);
        };
    }, [socket]);

    return { friendActivity, friendProfiles, isLoading, refresh };
}
