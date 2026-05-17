import { useState, useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import {
    getPosts, createPost, deletePost, reactToPost,
    getComments, addComment, deleteComment,
    type Post, type Comment, type PostReaction,
} from '../api/community';

export type { Post, Comment, PostReaction };

export interface UseCommunityReturn {
    posts:          Post[];
    isLoading:      boolean;
    hasMore:        boolean;
    loadMore:       () => Promise<void>;
    submitPost:     (content: string, imageUrl?: string | null) => Promise<void>;
    removePost:     (postId: number) => Promise<void>;
    toggleReaction: (postId: number, emoji: string) => Promise<void>;
    // comments
    comments:       Record<number, Comment[]>;
    loadComments:   (postId: number) => Promise<void>;
    submitComment:  (postId: number, content: string) => Promise<void>;
    removeComment:  (postId: number, commentId: number) => Promise<void>;
}

export function useCommunity(socket: Socket | null): UseCommunityReturn {
    const [posts,     setPosts]     = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore,   setHasMore]   = useState(false);
    const [comments,  setComments]  = useState<Record<number, Comment[]>>({});
    const cursorRef = useRef<string | null>(null);

    // ── Initial load ──────────────────────────────────────────────────────────
    useEffect(() => {
        setIsLoading(true);
        getPosts(20)
            .then(({ posts: p, hasMore: m, nextCursor }) => {
                setPosts(p);
                setHasMore(m);
                cursorRef.current = nextCursor;
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    // ── Load more ─────────────────────────────────────────────────────────────
    const loadMore = useCallback(async () => {
        if (!hasMore || isLoading || !cursorRef.current) return;
        setIsLoading(true);
        try {
            const { posts: older, hasMore: m, nextCursor } = await getPosts(20, cursorRef.current);
            setPosts((prev) => [...prev, ...older]);
            setHasMore(m);
            cursorRef.current = nextCursor;
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [hasMore, isLoading]);

    // ── Submit post ───────────────────────────────────────────────────────────
    const submitPost = useCallback(async (content: string, imageUrl?: string | null) => {
        const post = await createPost(content, imageUrl);
        // Broadcast via socket so other tabs/users see it instantly
        socket?.emit('community:post_created', post);
        // Also add locally (socket echo will deduplicate)
        setPosts((prev) => [post, ...prev]);
    }, [socket]);

    // ── Remove post ───────────────────────────────────────────────────────────
    const removePost = useCallback(async (postId: number) => {
        await deletePost(postId);
        socket?.emit('community:post_deleted', { postId });
        setPosts((prev) => prev.filter((p) => p.id !== postId));
    }, [socket]);

    // ── Toggle reaction ───────────────────────────────────────────────────────
    const toggleReaction = useCallback(async (postId: number, emoji: string) => {
        await reactToPost(postId, emoji);
        // Re-fetch reactions for this post to get accurate counts
        const { posts: fresh } = await getPosts(1);
        // Optimistic update: flip locally
        setPosts((prev) => prev.map((p) => {
            if (p.id !== postId) return p;
            const existing = p.reactions.find((r) => r.emoji === emoji);
            let reactions: PostReaction[];
            if (existing) {
                reactions = existing.reactedByMe
                    ? p.reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r).filter((r) => r.count > 0)
                    : p.reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r);
            } else {
                reactions = [...p.reactions, { emoji, count: 1, reactedByMe: true }];
            }
            socket?.emit('community:reacted', { postId, reactions });
            return { ...p, reactions };
        }));
        void fresh; // suppress unused warning
    }, [socket]);

    // ── Load comments ─────────────────────────────────────────────────────────
    const loadComments = useCallback(async (postId: number) => {
        const list = await getComments(postId);
        setComments((prev) => ({ ...prev, [postId]: list }));
    }, []);

    // ── Submit comment ────────────────────────────────────────────────────────
    const submitComment = useCallback(async (postId: number, content: string) => {
        const comment = await addComment(postId, content);
        socket?.emit('community:comment_created', { postId, comment });
        setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), comment] }));
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
    }, [socket]);

    // ── Remove comment ────────────────────────────────────────────────────────
    const removeComment = useCallback(async (postId: number, commentId: number) => {
        await deleteComment(commentId);
        socket?.emit('community:comment_deleted', { postId, commentId });
        setComments((prev) => ({ ...prev, [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId) }));
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
    }, [socket]);

    // ── Real-time socket events ───────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onNewPost = (post: Post) => {
            setPosts((prev) => prev.some((p) => p.id === post.id) ? prev : [post, ...prev]);
        };
        const onDeletePost = ({ postId }: { postId: number }) => {
            setPosts((prev) => prev.filter((p) => p.id !== postId));
        };
        const onReaction = ({ postId, reactions }: { postId: number; reactions: PostReaction[] }) => {
            setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, reactions } : p));
        };
        const onNewComment = ({ postId, comment }: { postId: number; comment: Comment }) => {
            setComments((prev) => {
                const existing = prev[postId] ?? [];
                if (existing.some((c) => c.id === comment.id)) return prev;
                return { ...prev, [postId]: [...existing, comment] };
            });
            setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
        };
        const onDeleteComment = ({ postId, commentId }: { postId: number; commentId: number }) => {
            setComments((prev) => ({ ...prev, [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId) }));
            setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
        };

        socket.on('community:new_post',       onNewPost);
        socket.on('community:delete_post',    onDeletePost);
        socket.on('community:reaction',       onReaction);
        socket.on('community:new_comment',    onNewComment);
        socket.on('community:delete_comment', onDeleteComment);

        return () => {
            socket.off('community:new_post',       onNewPost);
            socket.off('community:delete_post',    onDeletePost);
            socket.off('community:reaction',       onReaction);
            socket.off('community:new_comment',    onNewComment);
            socket.off('community:delete_comment', onDeleteComment);
        };
    }, [socket]);

    return { posts, isLoading, hasMore, loadMore, submitPost, removePost, toggleReaction, comments, loadComments, submitComment, removeComment };
}
