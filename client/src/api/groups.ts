import { fetchWithAuth } from './auth';
const BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export interface Group {
    id: number;
    name: string;
    created_by: number;
    created_at: string;
    member_count: number;
    last_message: string | null;
    last_message_at: string | null;
}

export interface GroupMember {
    id: number;
    username: string;
    display_name: string;
    online_status: string;
}

export interface GroupMessage {
    id: number;
    group_id: number;
    sender_id: number;
    sender_name: string;
    sender_username: string;
    content: string;
    message_type: 'text' | 'image';
    is_deleted: boolean;
    created_at: string;
}

export async function createGroup(name: string, memberIds: number[]): Promise<Group> {
    const res  = await fetchWithAuth(`${BASE}/groups`, { method: 'POST', body: JSON.stringify({ name, memberIds }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to create group.');
    return data.group as Group;
}

export async function getGroups(): Promise<Group[]> {
    const res  = await fetchWithAuth(`${BASE}/groups`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load groups.');
    return data.groups as Group[];
}

export async function getGroupMembers(groupId: number): Promise<GroupMember[]> {
    const res  = await fetchWithAuth(`${BASE}/groups/${groupId}/members`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load members.');
    return data.members as GroupMember[];
}

export async function addGroupMember(groupId: number, userId: number): Promise<void> {
    const res  = await fetchWithAuth(`${BASE}/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ userId }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to add member.');
}

export async function removeGroupMember(groupId: number, userId: number): Promise<void> {
    const res  = await fetchWithAuth(`${BASE}/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to remove member.');
}

export async function getGroupMessages(groupId: number, limit = 50, before?: string): Promise<{ messages: GroupMessage[]; hasMore: boolean; nextCursor: string | null }> {
    const p = new URLSearchParams({ limit: String(limit) });
    if (before) p.set('before', before);
    const res  = await fetchWithAuth(`${BASE}/groups/${groupId}/messages?${p}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load messages.');
    return data;
}
