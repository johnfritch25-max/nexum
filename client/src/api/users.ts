/**
 * users.ts
 * Fetch wrappers for the /users REST endpoints.
 */

import { fetchWithAuth } from './auth';

const BASE_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export interface UserProfile {
    id: number;
    username: string;
    display_name: string;
    email: string;
    avatar_url: string | null;
    bio: string | null;
    online_status: string;
    current_status_icon: string | null;
    current_status_text: string | null;
    is_incognito: boolean;
    last_seen_at: string | null;
    created_at: string;
}

export interface FriendSummary {
    id: number;
    username: string;
    display_name: string;
    avatar_url: string | null;
    online_status: string;
    current_status_icon: string | null;
    current_status_text: string | null;
    last_seen_at: string | null;
}

export interface SearchUserResult {
    id: number;
    username: string;
    display_name: string;
    avatar_url: string | null;
    online_status: string;
    friendship_status: 'pending' | 'accepted' | 'blocked' | null;
    friendship_id: number | null;
    requester_id: number | null;
}

export async function searchUsers(q: string): Promise<SearchUserResult[]> {
    const res = await fetchWithAuth(`${BASE_URL}/users/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Search failed.');
    return data.users as SearchUserResult[];
}

export async function getMe(): Promise<UserProfile> {
    const res = await fetchWithAuth(`${BASE_URL}/users/me`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to fetch profile.');
    return data as UserProfile;
}

export async function updateProfile(fields: {
    display_name?: string;
    bio?: string | null;
    avatar_url?: string | null;
}): Promise<void> {
    const res = await fetchWithAuth(`${BASE_URL}/users/me`, {
        method: 'PATCH',
        body:   JSON.stringify(fields),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to update profile.');
}

export async function setIncognito(isIncognito: boolean): Promise<void> {
    const res = await fetchWithAuth(`${BASE_URL}/users/me/incognito`, {
        method: 'PATCH',
        body:   JSON.stringify({ is_incognito: isIncognito }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to update incognito setting.');
}

export async function getFriends(): Promise<FriendSummary[]> {
    const res = await fetchWithAuth(`${BASE_URL}/users/me/friends`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to fetch friends.');
    return data.friends as FriendSummary[];
}

export async function setCustomStatus(statusIcon: string | null, statusText: string | null): Promise<void> {
    const res = await fetchWithAuth(`${BASE_URL}/users/me/status`, {
        method: 'PATCH',
        body:   JSON.stringify({ status_icon: statusIcon, status_text: statusText }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to update status.');
}

export interface OnlineUser {
    id: number;
    username: string;
    display_name: string;
    online_status: string;
}

export async function getOnlineUsers(): Promise<OnlineUser[]> {
    const res = await fetchWithAuth(`${BASE_URL}/users/online`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to fetch online users.');
    return data.users as OnlineUser[];
}

export async function getUserById(id: number): Promise<UserProfile> {
    const res = await fetchWithAuth(`${BASE_URL}/users/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to fetch user.');
    return data as UserProfile;
}
