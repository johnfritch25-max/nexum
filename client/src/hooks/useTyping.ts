/**
 * useTyping.ts
 * Manages typing indicator state for a conversation.
 *
 * - Emits typing_start / typing_stop to the server as the user types.
 * - Listens for friend_typing events and exposes `friendIsTyping`.
 * - Auto-stops after 3 s of inactivity (debounced).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { Socket } from 'socket.io-client';

export interface UseTypingReturn {
    /** Whether the conversation partner is currently typing */
    friendIsTyping: boolean;
    /** Call this whenever the local user's draft changes */
    onTyping: () => void;
    /** Call this when the user sends a message (stops typing immediately) */
    onSent: () => void;
}

const STOP_DELAY_MS = 3000;

export function useTyping(
    socket: Socket | null,
    senderId: number | null,
    receiverId: number | null
): UseTypingReturn {
    const [friendIsTyping, setFriendIsTyping] = useState(false);
    const isTypingRef    = useRef(false);
    const stopTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const friendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Emit helpers ──────────────────────────────────────────────────────────
    const emitStart = useCallback(() => {
        if (!socket || !senderId || !receiverId) return;
        socket.emit('typing_start', { receiverId });
    }, [socket, senderId, receiverId]);

    const emitStop = useCallback(() => {
        if (!socket || !senderId || !receiverId) return;
        socket.emit('typing_stop', { receiverId });
    }, [socket, senderId, receiverId]);

    // ── Called on every draft keystroke ───────────────────────────────────────
    const onTyping = useCallback(() => {
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            emitStart();
        }
        // Reset the auto-stop timer
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = setTimeout(() => {
            isTypingRef.current = false;
            emitStop();
        }, STOP_DELAY_MS);
    }, [emitStart, emitStop]);

    // ── Called when a message is sent ─────────────────────────────────────────
    const onSent = useCallback(() => {
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        if (isTypingRef.current) {
            isTypingRef.current = false;
            emitStop();
        }
    }, [emitStop]);

    // ── Reset when conversation changes ───────────────────────────────────────
    useEffect(() => {
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        if (isTypingRef.current && socket && senderId && receiverId) {
            socket.emit('typing_stop', { receiverId });
        }
        isTypingRef.current = false;
        setFriendIsTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [receiverId]);

    // ── Listen for friend typing events ───────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const handleFriendTyping = ({ userId, isTyping }: { userId: number; isTyping: boolean }) => {
            if (userId !== receiverId) return;

            setFriendIsTyping(isTyping);

            // Auto-clear after 5 s in case stop event is missed
            if (friendTimerRef.current) clearTimeout(friendTimerRef.current);
            if (isTyping) {
                friendTimerRef.current = setTimeout(() => setFriendIsTyping(false), 5000);
            }
        };

        socket.on('friend_typing', handleFriendTyping);
        return () => { socket.off('friend_typing', handleFriendTyping); };
    }, [socket, receiverId]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => () => {
        if (stopTimerRef.current)   clearTimeout(stopTimerRef.current);
        if (friendTimerRef.current) clearTimeout(friendTimerRef.current);
    }, []);

    return { friendIsTyping, onTyping, onSent };
}
