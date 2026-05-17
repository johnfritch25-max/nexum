/**
 * useUnreadCounts.ts
 * Tracks per-friend unread message counts.
 *
 * Increments when a `receive_message` arrives for a room that is NOT
 * currently active. Resets to 0 when the user opens that conversation.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { Message } from './useMessages';
import { useState } from 'react';

export type UnreadMap = Map<number, number>; // friendId → unread count

export function useUnreadCounts(
    socket: Socket | null,
    currentUserId: number | null,
    activeFriendId: number | null
): {
    unreadCounts: UnreadMap;
    clearUnread: (friendId: number) => void;
} {
    const [unreadCounts, setUnreadCounts] = useState<UnreadMap>(new Map());
    // Keep a ref to activeFriendId so the socket listener always sees the latest value
    const activeFriendRef = useRef(activeFriendId);
    useEffect(() => { activeFriendRef.current = activeFriendId; }, [activeFriendId]);

    useEffect(() => {
        if (!socket || !currentUserId) return;

        const handleMessage = (msg: Message) => {
            // Only count messages sent TO us
            if (msg.senderId === currentUserId) return;

            const friendId = msg.senderId;

            // Don't count if this conversation is currently open
            if (activeFriendRef.current === friendId) return;

            setUnreadCounts((prev) => {
                const next = new Map(prev);
                next.set(friendId, (next.get(friendId) ?? 0) + 1);
                return next;
            });
        };

        socket.on('receive_message', handleMessage);
        return () => { socket.off('receive_message', handleMessage); };
    }, [socket, currentUserId]);

    const clearUnread = useCallback((friendId: number) => {
        setUnreadCounts((prev) => {
            if (!prev.has(friendId)) return prev;
            const next = new Map(prev);
            next.delete(friendId);
            return next;
        });
    }, []);

    return { unreadCounts, clearUnread };
}
