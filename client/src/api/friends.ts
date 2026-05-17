/**
 * friends.ts
 * Fetch wrappers for the /friends REST endpoints.
 * Uses fetchWithAuth for automatic token refresh on 401.
 */

import { fetchWithAuth } from './auth';

const BASE_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export interface PendingRequest {
    friendship_id: number;
    requested_at: string;
    requester_id: number;
    username: string;
    display_name: string;
    avatar_url: string | null;
}

/** POST /friends/request */
export async function sendFriendRequest(targetUserId: number): Promise<{ friendshipId: number }> {
    const res  = await fetchWithAuth(`${BASE_URL}/friends/request`, {
        method: 'POST',
        body:   JSON.stringify({ targetUserId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to send friend request.');
    return { friendshipId: data.friendshipId };
}

/** PATCH /friends/request/:id */
export async function respondToFriendRequest(
    friendshipId: number,
    action: 'accept' | 'decline'
): Promise<void> {
    const res  = await fetchWithAuth(`${BASE_URL}/friends/request/${friendshipId}`, {
        method: 'PATCH',
        body:   JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to respond to friend request.');
}

/** DELETE /friends/:id */
export async function removeFriend(friendshipId: number): Promise<void> {
    const res  = await fetchWithAuth(`${BASE_URL}/friends/${friendshipId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to remove friend.');
}

/** POST /friends/block/:userId */
export async function blockUser(userId: number): Promise<void> {
    const res  = await fetchWithAuth(`${BASE_URL}/friends/block/${userId}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to block user.');
}

/** DELETE /friends/block/:userId */
export async function unblockUser(userId: number): Promise<void> {
    const res  = await fetchWithAuth(`${BASE_URL}/friends/block/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to unblock user.');
}

/** GET /friends/requests/pending */
export async function getPendingRequests(): Promise<PendingRequest[]> {
    const res  = await fetchWithAuth(`${BASE_URL}/friends/requests/pending`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to fetch pending requests.');
    return data.requests as PendingRequest[];
}
