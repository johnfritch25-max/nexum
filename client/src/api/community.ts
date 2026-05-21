import { fetchWithAuth } from './auth';

const BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export interface PostReaction {
    emoji: string;
    count: number;
    reactedByMe: boolean;
}

export interface Post {
    id: number;
    author_id: number;
    author_name: string;
    author_username: string;
    author_avatar: string | null;
    content: string;
    image_url: string | null;
    is_deleted: boolean;
    created_at: string;
    reactions: PostReaction[];
    commentCount: number;
}

export interface Comment {
    id: number;
    post_id: number;
    author_id: number;
    author_name: string;
    author_username: string;
    author_avatar: string | null;
    content: string;
    is_deleted: boolean;
    created_at: string;
}

export async function getPosts(limit = 20, before?: string): Promise<{ posts: Post[]; hasMore: boolean; nextCursor: string | null }> {
    const p = new URLSearchParams({ limit: String(limit) });
    if (before) p.set('before', before);
    const res  = await fetchWithAuth(`${BASE}/community/posts?${p}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load posts.');
    return data;
}

export async function createPost(content: string, image_url?: string | null): Promise<Post> {
    const res  = await fetchWithAuth(`${BASE}/community/posts`, {
        method: 'POST',
        body:   JSON.stringify({ content, image_url: image_url ?? null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to create post.');
    return data.post as Post;
}

export async function deletePost(postId: number): Promise<void> {
    const res  = await fetchWithAuth(`${BASE}/community/posts/${postId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to delete post.');
}

export async function reactToPost(postId: number, emoji: string): Promise<{ action: 'added' | 'removed'; emoji: string }> {
    const res  = await fetchWithAuth(`${BASE}/community/posts/${postId}/react`, {
        method: 'POST',
        body:   JSON.stringify({ emoji }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to react.');
    return data;
}

export async function getComments(postId: number): Promise<Comment[]> {
    const res  = await fetchWithAuth(`${BASE}/community/posts/${postId}/comments`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load comments.');
    return data.comments as Comment[];
}

export async function addComment(postId: number, content: string): Promise<Comment> {
    const res  = await fetchWithAuth(`${BASE}/community/posts/${postId}/comments`, {
        method: 'POST',
        body:   JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to add comment.');
    return data.comment as Comment;
}

export async function deleteComment(commentId: number): Promise<void> {
    const res  = await fetchWithAuth(`${BASE}/community/comments/${commentId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to delete comment.');
}
