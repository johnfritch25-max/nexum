/**
 * useReadReceipts.ts
 * Automatically marks messages as read when a conversation is open.
 *
 * Uses an IntersectionObserver on the message list container so receipts
 * are only sent when the conversation is actually visible on screen
 * (e.g. the tab is in focus and the panel is scrolled into view).
 *
 * Debounces the API call to avoid hammering the server on every render.
 */

import { useEffect, useRef } from 'react';
import { markRoomAsRead } from '../api/messages';

/**
 * @param roomId        The active conversation room ID, or null if none selected.
 * @param containerRef  Ref to the scrollable message list element.
 * @param messageCount  Current number of messages — used to re-trigger when new messages arrive.
 */
export function useReadReceipts(
    roomId: string | null,
    containerRef: React.RefObject<HTMLElement>,
    messageCount: number
): void {
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastMarkedRoom = useRef<string | null>(null);

    useEffect(() => {
        if (!roomId || !containerRef.current) return;

        const markRead = () => {
            // Don't re-send if nothing changed
            if (lastMarkedRoom.current === roomId && messageCount === 0) return;

            if (debounceTimer.current) clearTimeout(debounceTimer.current);

            debounceTimer.current = setTimeout(() => {
                markRoomAsRead(roomId)
                    .then(() => { lastMarkedRoom.current = roomId; })
                    .catch((err) => console.error('[useReadReceipts] markRoomAsRead error:', err));
            }, 800);
        };

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) markRead();
            },
            { threshold: 0.1 }
        );

        observer.observe(containerRef.current);

        // Also mark when the room changes or new messages arrive
        markRead();

        return () => {
            observer.disconnect();
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [roomId, containerRef, messageCount]);
}
