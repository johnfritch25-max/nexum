/**
 * useMessages.ts
 * Manages message state for a single conversation room.
 *
 * On mount:
 *  1. Fetches the last 50 messages from the REST API (history).
 *  2. Joins the Socket.io room to receive new real-time messages.
 *  3. Deduplicates incoming socket messages against the loaded history.
 *
 * Exposes sendMessage and a loadMore function for infinite-scroll pagination.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getMessageHistory } from '../api/messages';

export interface Message {
    id: number;
    roomId: string;
    senderId: number;
    receiverId: number;
    content: string;
    messageType: 'text' | 'image';
    isEdited: boolean;
    isDeleted: boolean;
    readAt: string | null;
    createdAt: string;
}

export interface UseMessagesReturn {
    messages: Message[];
    isLoadingHistory: boolean;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    sendMessage: (content: string) => void;
    sendImage: (dataUrl: string, mimeType: string) => void;
}

/** Converts a REST MessageRecord to the local Message shape. */
function normaliseRecord(r: {
    id: number; sender_id: number; receiver_id: number; room_id: string;
    content: string; message_type?: string;
    is_edited: boolean | number; is_deleted: boolean | number;
    read_at: string | null; created_at: string;
}): Message {
    return {
        id:          r.id,
        roomId:      r.room_id,
        senderId:    r.sender_id,
        receiverId:  r.receiver_id,
        content:     r.content,
        messageType: r.message_type === 'image' ? 'image' : 'text',
        isEdited:    Boolean(r.is_edited),
        isDeleted:   Boolean(r.is_deleted),
        readAt:      r.read_at,
        createdAt:   r.created_at,
    };
}

/**
 * @param socket      Active Socket.io client instance.
 * @param senderId    Current user's DB id.
 * @param receiverId  Conversation partner's DB id.
 */
export function useMessages(
    socket: Socket | null,
    senderId: number | null,
    receiverId: number | null
): UseMessagesReturn {
    const [messages, setMessages]           = useState<Message[]>([]);
    const [isLoadingHistory, setIsLoading]  = useState(false);
    const [hasMore, setHasMore]             = useState(false);
    const cursorRef                         = useRef<string | null>(null);

    // Build the room ID the same way the server does
    const roomId = senderId && receiverId
        ? (senderId < receiverId ? `${senderId}_${receiverId}` : `${receiverId}_${senderId}`)
        : null;

    // ── Load initial history ──────────────────────────────────────────────────
    useEffect(() => {
        if (!roomId) return;

        setMessages([]);
        cursorRef.current = null;
        setHasMore(false);
        setIsLoading(true);

        // Try to load from localStorage cache first for instant display
        const cacheKey = `nexum_msgs_${roomId}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached) as Message[];
                if (parsed.length > 0) setMessages(parsed);
            }
        } catch { /* ignore */ }

        getMessageHistory(roomId, 50)
            .then(({ messages: records, hasMore: more, nextCursor }) => {
                const sorted = records.map(normaliseRecord).reverse();
                setMessages(sorted);
                setHasMore(more);
                cursorRef.current = nextCursor;
                // Cache for next reload
                try { localStorage.setItem(cacheKey, JSON.stringify(sorted)); } catch { /* ignore */ }
            })
            .catch((err) => {
                console.error('[useMessages] Failed to load history:', err);
                // Keep showing cached messages on error
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [roomId]);

    // ── Join Socket.io room ───────────────────────────────────────────────────
    useEffect(() => {
        if (!socket || !senderId || !receiverId) return;

        socket.emit('join_room', { senderId, receiverId });

        const handleReceiveMessage = (message: Message) => {
            setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                const next = [...prev, message];
                // Update cache
                if (roomId) {
                    try { localStorage.setItem(`nexum_msgs_${roomId}`, JSON.stringify(next.slice(-50))); } catch { /* ignore */ }
                }
                return next;
            });
        };

        socket.on('receive_message', handleReceiveMessage);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
        };
    }, [socket, senderId, receiverId]);

    // ── Load more (older messages) ────────────────────────────────────────────
    const loadMore = useCallback(async () => {
        if (!roomId || !hasMore || isLoadingHistory || !cursorRef.current) return;

        setIsLoading(true);
        try {
            const { messages: records, hasMore: more, nextCursor } = await getMessageHistory(
                roomId, 50, cursorRef.current
            );
            // Prepend older messages at the top
            setMessages((prev) => [...records.map(normaliseRecord).reverse(), ...prev]);
            setHasMore(more);
            cursorRef.current = nextCursor;
        } catch (err) {
            console.error('[useMessages] Failed to load more:', err);
        } finally {
            setIsLoading(false);
        }
    }, [roomId, hasMore, isLoadingHistory]);

    // ── Send ──────────────────────────────────────────────────────────────────
    const sendMessage = useCallback(
        (content: string) => {
            if (!socket || !senderId || !receiverId || !content.trim()) return;
            socket.emit('send_message', { senderId, receiverId, content: content.trim() });
        },
        [socket, senderId, receiverId]
    );

    // ── Send image ────────────────────────────────────────────────────────────
    const sendImage = useCallback(
        (dataUrl: string, mimeType: string) => {
            if (!socket || !senderId || !receiverId) return;
            socket.emit('send_image', { senderId, receiverId, dataUrl, mimeType });
        },
        [socket, senderId, receiverId]
    );

    return { messages, isLoadingHistory, hasMore, loadMore, sendMessage, sendImage };
}
