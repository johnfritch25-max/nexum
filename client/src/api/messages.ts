/**
 * messages.ts
 * Fetch wrappers for the /messages REST endpoints.
 * Uses fetchWithAuth for automatic token refresh on 401.
 */

import { fetchWithAuth } from './auth';

const BASE_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export interface MessageRecord {
    id: number;
    sender_id: number;
    receiver_id: number;
    room_id: string;
    content: string;
    message_type: 'text' | 'image';
    is_edited: boolean;
    is_deleted: boolean;
    read_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface MessageHistoryResponse {
    messages: MessageRecord[];
    hasMore: boolean;
    nextCursor: string | null;
}

/** GET /messages/:roomId — paginated history, newest-first */
export async function getMessageHistory(
    roomId: string,
    limit = 50,
    before?: string
): Promise<MessageHistoryResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);

    const res  = await fetchWithAuth(`${BASE_URL}/messages/${roomId}?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to fetch message history.');
    return data as MessageHistoryResponse;
}

/** PATCH /messages/:messageId — edit content (sender only) */
export async function editMessage(messageId: number, content: string): Promise<void> {
    const res  = await fetchWithAuth(`${BASE_URL}/messages/${messageId}`, {
        method: 'PATCH',
        body:   JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to edit message.');
}

/** DELETE /messages/:messageId — soft-delete (sender only) */
export async function deleteMessage(messageId: number): Promise<void> {
    const res  = await fetchWithAuth(`${BASE_URL}/messages/${messageId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to delete message.');
}

/** PATCH /messages/:roomId/read — mark all unread messages as read */
export async function markRoomAsRead(roomId: string): Promise<void> {
    const res  = await fetchWithAuth(`${BASE_URL}/messages/${roomId}/read`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to mark messages as read.');
}

export interface MessageReaction { emoji: string; count: number; reactedByMe: boolean; }

/** POST /messages/:messageId/react — toggle a reaction */
export async function reactToMessage(messageId: number, emoji: string): Promise<{ action: 'added' | 'removed'; emoji: string }> {
    const res  = await fetchWithAuth(`${BASE_URL}/messages/${messageId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to react.');
    return data;
}

/** GET /messages/:messageId/reactions */
export async function getMessageReactions(messageId: number): Promise<MessageReaction[]> {
    const res  = await fetchWithAuth(`${BASE_URL}/messages/${messageId}/reactions`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load reactions.');
    return data.reactions as MessageReaction[];
}
