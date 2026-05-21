import { useState, useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getGroupMessages, type GroupMessage } from '../api/groups';

export function useGroupMessages(socket: Socket | null, groupId: number | null, senderId: number | null) {
    const [messages, setMessages] = useState<GroupMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore]     = useState(false);
    const cursorRef = useRef<string | null>(null);

    useEffect(() => {
        if (!groupId) return;
        setMessages([]); cursorRef.current = null; setHasMore(false); setIsLoading(true);
        getGroupMessages(groupId, 50)
            .then(({ messages: msgs, hasMore: m, nextCursor }) => {
                setMessages(msgs); setHasMore(m); cursorRef.current = nextCursor;
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [groupId]);

    useEffect(() => {
        if (!socket || !groupId) return;
        socket.emit('join_group', { groupId });
        const handler = (msg: GroupMessage) => {
            if (msg.group_id !== groupId) return;
            setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        };
        // Refresh group list when a member is added/removed
        const handleGroupUpdated = ({ groupId: gid }: { groupId: number }) => {
            if (gid === groupId) {
                // Re-fetch messages to stay in sync (group may have been updated)
                getGroupMessages(groupId, 50)
                    .then(({ messages: msgs }) => setMessages(msgs))
                    .catch(() => {});
            }
        };
        socket.on('group_message',  handler);
        socket.on('group_updated',  handleGroupUpdated);
        return () => {
            socket.off('group_message',  handler);
            socket.off('group_updated',  handleGroupUpdated);
            // Leave the group room on cleanup
            socket.emit('leave_group', { groupId });
        };
    }, [socket, groupId]);

    const loadMore = useCallback(async () => {
        if (!groupId || !hasMore || isLoading || !cursorRef.current) return;
        setIsLoading(true);
        try {
            const { messages: older, hasMore: m, nextCursor } = await getGroupMessages(groupId, 50, cursorRef.current);
            setMessages((prev) => [...older, ...prev]);
            setHasMore(m); cursorRef.current = nextCursor;
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [groupId, hasMore, isLoading]);

    const sendMessage = useCallback((content: string) => {
        if (!socket || !groupId || !content.trim()) return;
        socket.emit('send_group_message', { groupId, content: content.trim() });
    }, [socket, groupId]);

    const sendImage = useCallback((dataUrl: string, mimeType: string) => {
        if (!socket || !groupId) return;
        socket.emit('send_group_image', { groupId, dataUrl, mimeType });
    }, [socket, groupId]);

    return { messages, isLoading, hasMore, loadMore, sendMessage, sendImage };
}
