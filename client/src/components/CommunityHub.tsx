import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { useCommunity, type Post, type Comment } from '../hooks/useCommunity';
import { getOnlineUsers, type OnlineUser } from '../api/users';

interface CommunityHubProps {
    socket:        Socket | null;
    userId:        number;
    displayName:   string;
    avatarUrl?:    string | null;
    onViewProfile: (userId: number) => void;
}

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export const CommunityHub: React.FC<CommunityHubProps> = ({ socket, userId, displayName, avatarUrl, onViewProfile }) => {
    const hub = useCommunity(socket);
    const [postDraft, setPostDraft] = useState('');
    const [postImage, setPostImage] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const postImageRef = useRef<HTMLInputElement>(null);

    // Load online users
    useEffect(() => {
        getOnlineUsers().then(setOnlineUsers).catch(() => {});
        const interval = setInterval(() => getOnlineUsers().then(setOnlineUsers).catch(() => {}), 30_000);
        return () => clearInterval(interval);
    }, []);

    // Filtered posts by search
    const filteredPosts = searchQuery.trim()
        ? hub.posts.filter((p) =>
            p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.author_name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : hub.posts;

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!postDraft.trim() && !postImage) return;
        setIsPosting(true); setPostError(null);
        try { await hub.submitPost(postDraft.trim(), postImage); setPostDraft(''); setPostImage(null); }
        catch (err) { setPostError(err instanceof Error ? err.message : 'Failed to post.'); }
        finally { setIsPosting(false); }
    };

    return (
        <div className="flex-1 flex min-w-0 bg-zinc-950 overflow-hidden">
            {/* Main feed column */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Header */}
            <div className="h-14 shrink-0 flex items-center px-4 sm:px-5 border-b border-zinc-800/60 bg-zinc-900/30 gap-3">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-tight">Community Hub</p>
                    <p className="text-[11px] text-zinc-500 leading-tight hidden sm:block">Share with everyone on Nexum</p>
                </div>
                {/* Desktop search */}
                <div className="relative hidden sm:block">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none">
                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                    </svg>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search posts…" aria-label="Search posts"
                        className="bg-zinc-800 border border-zinc-700/50 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors w-44" />
                    {searchQuery && (
                        <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" /></svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile search */}
            <div className="sm:hidden px-3 py-2 border-b border-zinc-800/40">
                <div className="relative">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none">
                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                    </svg>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search posts…" aria-label="Search posts"
                        className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-5 flex flex-col gap-3 sm:gap-4">

                    {/* Compose */}
                    <form onSubmit={handlePost} className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-3 sm:p-4 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5">
                                {avatarUrl
                                    ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                                    : displayName.charAt(0).toUpperCase()}
                            </div>
                            <textarea value={postDraft} onChange={(e) => setPostDraft(e.target.value)}
                                placeholder="What's on your mind?" maxLength={2000} rows={3}
                                aria-label="Post content"
                                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none resize-none leading-relaxed min-h-[60px]" />
                        </div>

                        {postImage && (
                            <div className="relative ml-12">
                                <img src={postImage} alt="Post preview" className="max-h-48 rounded-xl object-contain border border-zinc-700/40 w-full" />
                                <button type="button" onClick={() => setPostImage(null)} aria-label="Remove image"
                                    className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-zinc-900/90 flex items-center justify-center text-zinc-300 hover:text-white transition-colors">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                                        <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {postError && <p className="text-xs text-red-400 ml-12">{postError}</p>}

                        <div className="flex items-center justify-between ml-12">
                            <div className="flex gap-1.5">
                                <input ref={postImageRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="sr-only" aria-hidden="true"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        if (file.size > 5 * 1024 * 1024) { setPostError('Image must be under 5 MB.'); return; }
                                        const reader = new FileReader();
                                        reader.onload = () => setPostImage(reader.result as string);
                                        reader.readAsDataURL(file);
                                        e.target.value = '';
                                    }} />
                                <button type="button" onClick={() => postImageRef.current?.click()} aria-label="Attach image"
                                    className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors active:scale-95">
                                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                        <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909.47.47a.75.75 0 11-1.06 1.06L6.53 8.091a.75.75 0 00-1.06 0l-2.97 2.97zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-600 hidden sm:block">{postDraft.length}/2000</span>
                                <button type="submit" disabled={isPosting || (!postDraft.trim() && !postImage)}
                                    className="h-8 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors active:scale-95">
                                    {isPosting ? 'Posting…' : 'Post'}
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Search label */}
                    {searchQuery.trim() && (
                        <p className="text-xs text-zinc-500 px-1">
                            {filteredPosts.length === 0 ? 'No posts match your search.' : `${filteredPosts.length} result${filteredPosts.length !== 1 ? 's' : ''} for "${searchQuery}"`}
                        </p>
                    )}

                    {/* Feed */}
                    {hub.isLoading && hub.posts.length === 0 ? (
                        <div className="flex justify-center py-12">
                            <div className="h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredPosts.length === 0 && !searchQuery ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <span className="text-5xl">🌐</span>
                            <p className="text-sm font-medium text-zinc-300">No posts yet</p>
                            <p className="text-xs text-zinc-600">Be the first to share something!</p>
                        </div>
                    ) : (
                        <>
                            {filteredPosts.map((post) => (
                                <PostCard key={post.id} post={post} userId={userId}
                                    comments={hub.comments[post.id]}
                                    onReact={hub.toggleReaction} onDelete={hub.removePost}
                                    onLoadComments={hub.loadComments} onSubmitComment={hub.submitComment}
                                    onDeleteComment={hub.removeComment}
                                    onViewProfile={onViewProfile} />
                            ))}
                            {hub.hasMore && !searchQuery && (
                                <button type="button" onClick={hub.loadMore} disabled={hub.isLoading}
                                    className="self-center text-xs text-violet-400 hover:text-violet-300 disabled:text-zinc-600 transition-colors py-2 px-4 rounded-xl bg-zinc-900 border border-zinc-800/60">
                                    {hub.isLoading ? 'Loading…' : 'Load more posts'}
                                </button>
                            )}
                        </>
                    )}

                    <div className="h-4 md:hidden" />
                </div>
            </div>
            </div>

            {/* Online users sidebar — desktop only */}
            {onlineUsers.length > 0 && (
                <aside className="hidden lg:flex w-52 shrink-0 flex-col border-l border-zinc-800/60 bg-zinc-900/30 overflow-y-auto">
                    <div className="px-4 py-3 border-b border-zinc-800/40 shrink-0">
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Online — {onlineUsers.length}</p>
                    </div>
                    <div className="flex flex-col gap-0.5 p-2">
                        {onlineUsers.map((u) => (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => onViewProfile(u.id)}
                                aria-label={`View ${u.display_name}'s profile`}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors text-left w-full group"
                            >
                                <div className="relative shrink-0">
                                    <div className="h-7 w-7 rounded-full overflow-hidden bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-xs font-bold text-white group-hover:ring-2 group-hover:ring-violet-400 transition-all">
                                        {u.avatar_url
                                            ? <img src={u.avatar_url} alt={u.display_name} className="w-full h-full object-cover" />
                                            : u.display_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-zinc-900 bg-emerald-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-zinc-300 truncate group-hover:text-white transition-colors">{u.display_name}</p>
                                    <p className="text-[10px] text-zinc-600 truncate">@{u.username}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </aside>
            )}
        </div>
    );
};

// ── Post card ─────────────────────────────────────────────────────────────────

interface PostCardProps {
    post: Post; userId: number; comments: Comment[] | undefined;
    onReact: (postId: number, emoji: string) => Promise<void>;
    onDelete: (postId: number) => Promise<void>;
    onLoadComments: (postId: number) => Promise<void>;
    onSubmitComment: (postId: number, content: string) => Promise<void>;
    onDeleteComment: (postId: number, commentId: number) => Promise<void>;
    onViewProfile: (userId: number) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, userId, comments, onReact, onDelete, onLoadComments, onSubmitComment, onDeleteComment, onViewProfile }) => {
    const [showComments,  setShowComments]  = useState(false);
    const [commentDraft,  setCommentDraft]  = useState('');
    const [isCommenting,  setIsCommenting]  = useState(false);
    const [showEmojiPick, setShowEmojiPick] = useState(false);
    const [isDeleting,    setIsDeleting]    = useState(false);

    const handleToggleComments = async () => {
        if (!showComments && !comments) await onLoadComments(post.id);
        setShowComments((v) => !v);
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentDraft.trim()) return;
        setIsCommenting(true);
        try { await onSubmitComment(post.id, commentDraft.trim()); setCommentDraft(''); }
        finally { setIsCommenting(false); }
    };

    const timeAgo = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    };

    return (
        <article className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden bubble-in">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <button
                    type="button"
                    onClick={() => onViewProfile(post.author_id)}
                    aria-label={`View ${post.author_name}'s profile`}
                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-full overflow-hidden bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-sm font-bold text-white shrink-0 hover:ring-2 hover:ring-violet-400 transition-all active:scale-95"
                >
                    {post.author_avatar
                        ? <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
                        : post.author_name.charAt(0).toUpperCase()}
                </button>
                <div className="flex-1 min-w-0">
                    <button
                        type="button"
                        onClick={() => onViewProfile(post.author_id)}
                        className="text-sm font-semibold text-white leading-tight truncate hover:underline text-left"
                    >
                        {post.author_name}
                    </button>
                    <p className="text-[10px] text-zinc-500 leading-tight">@{post.author_username} · {timeAgo(post.created_at)}</p>
                </div>
                {post.author_id === userId && (
                    <button type="button" onClick={() => { setIsDeleting(true); onDelete(post.id).finally(() => setIsDeleting(false)); }}
                        disabled={isDeleting} aria-label="Delete post"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-40 active:scale-95">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 000 1.5h.3l.815 8.15A1.5 1.5 0 005.357 15h5.285a1.5 1.5 0 001.493-1.35l.815-8.15h.3a.75.75 0 000-1.5H11v-.75A2.25 2.25 0 008.75 1h-1.5A2.25 2.25 0 005 3.25zm2.25-.75a.75.75 0 00-.75.75V4h3v-.75a.75.75 0 00-.75-.75h-1.5z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>

            {post.content && <p className="px-4 pb-3 text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>}

            {post.image_url && (
                <div className="px-4 pb-3">
                    <img src={post.image_url} alt="Post image" loading="lazy"
                        className="w-full max-h-80 sm:max-h-96 object-contain rounded-xl border border-zinc-800/60 cursor-pointer"
                        onClick={() => window.open(post.image_url!, '_blank')} />
                </div>
            )}

            {/* Footer — React + Comments in same row like Facebook */}
            <div className="px-4 pb-3 border-t border-zinc-800/40 pt-2.5">
                {/* Reaction counts row */}
                {post.reactions.filter((r) => r.count > 0).length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        {post.reactions.filter((r) => r.count > 0).map((r) => (
                            <button key={r.emoji} type="button" onClick={() => onReact(post.id, r.emoji)}
                                className={['flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all active:scale-95',
                                    r.reactedByMe ? 'bg-violet-600/20 border-violet-500/50 text-violet-300' : 'bg-zinc-800 border-zinc-700/40 text-zinc-400 hover:border-zinc-600'].join(' ')}>
                                <span>{r.emoji}</span><span className="font-medium">{r.count}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Action buttons row */}
                <div className="flex items-center gap-2">
                    {/* React button with floating emoji picker */}
                    <div className="relative">
                        {showEmojiPick && (
                            <div className="absolute bottom-10 left-0 z-30 flex items-center gap-1 bg-zinc-800/95 backdrop-blur-sm border border-zinc-700/60 rounded-full px-3 py-2 shadow-2xl animate-scale-in"
                                onMouseLeave={() => setShowEmojiPick(false)}>
                                {EMOJIS.map((em) => (
                                    <button key={em} type="button"
                                        onClick={() => { onReact(post.id, em); setShowEmojiPick(false); }}
                                        aria-label={`React with ${em}`}
                                        className="text-2xl hover:scale-150 active:scale-125 transition-transform duration-150 p-0.5 rounded-full hover:bg-zinc-700/50">
                                        {em}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button type="button"
                            onMouseEnter={() => setShowEmojiPick(true)}
                            onTouchStart={() => setShowEmojiPick((v) => !v)}
                            onClick={() => {
                                const myReaction = post.reactions.find((r) => r.reactedByMe);
                                if (myReaction) { onReact(post.id, myReaction.emoji); }
                                else { setShowEmojiPick((v) => !v); }
                            }}
                            className={['flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95',
                                post.reactions.some((r) => r.reactedByMe)
                                    ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                                    : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'].join(' ')}>
                            {post.reactions.find((r) => r.reactedByMe)
                                ? <><span className="text-base leading-none">{post.reactions.find((r) => r.reactedByMe)?.emoji}</span><span>Reacted</span></>
                                : <><span>👍</span><span>React</span></>
                            }
                        </button>
                    </div>

                    {/* Comments button */}
                    <button type="button" onClick={handleToggleComments}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all active:scale-95">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M1 8.74c0 .983.713 1.825 1.69 1.943L3 10.698V13a.75.75 0 001.28.53l1.82-1.82A3.484 3.484 0 007.5 12h1c1.933 0 3.5-1.567 3.5-3.5v-1C12 5.567 10.433 4 8.5 4h-1C5.567 4 4 5.567 4 7.5v.5H2.75A.75.75 0 002 8.74z" clipRule="evenodd" />
                        </svg>
                        {post.commentCount} {post.commentCount === 1 ? 'Comment' : 'Comments'}
                    </button>
                </div>
            </div>

            {/* Comments */}
            {showComments && (
                <div className="border-t border-zinc-800/40 px-4 py-3 flex flex-col gap-2.5">
                    {!comments ? (
                        <div className="flex justify-center py-3"><div className="h-4 w-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
                    ) : comments.length === 0 ? (
                        <p className="text-xs text-zinc-600 text-center py-2">No comments yet. Be the first!</p>
                    ) : comments.map((c) => (
                        <CommentRow key={c.id} comment={c} userId={userId} postId={post.id} onDelete={onDeleteComment} onViewProfile={onViewProfile} />
                    ))}
                    <form onSubmit={handleComment} className="flex items-center gap-2 mt-1">
                        <input type="text" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)}
                            placeholder="Write a comment…" maxLength={1000} aria-label="Write a comment"
                            className="flex-1 bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors" />
                        <button type="submit" disabled={isCommenting || !commentDraft.trim()}
                            className="h-8 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium transition-colors active:scale-95">
                            {isCommenting ? '…' : 'Send'}
                        </button>
                    </form>
                </div>
            )}
        </article>
    );
};

const CommentRow: React.FC<{ comment: Comment; userId: number; postId: number; onDelete: (postId: number, commentId: number) => Promise<void>; onViewProfile: (userId: number) => void; }> = ({ comment, userId, postId, onDelete, onViewProfile }) => {
    const timeAgo = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m`;
        return `${Math.floor(m / 60)}h`;
    };
    return (
        <div className="flex items-start gap-2 group">
            <button
                type="button"
                onClick={() => onViewProfile(comment.author_id)}
                aria-label={`View ${comment.author_name}'s profile`}
                className="h-7 w-7 rounded-full overflow-hidden bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0 mt-0.5 hover:ring-2 hover:ring-violet-400 transition-all active:scale-95"
            >
                {comment.author_avatar
                    ? <img src={comment.author_avatar} alt={comment.author_name} className="w-full h-full object-cover" />
                    : comment.author_name.charAt(0).toUpperCase()}
            </button>
            <div className="flex-1 min-w-0">
                <div className="bg-zinc-800/60 rounded-xl px-3 py-2">
                    <button type="button" onClick={() => onViewProfile(comment.author_id)}
                        className="text-xs font-semibold text-zinc-300 mr-1.5 hover:underline">
                        {comment.author_name}
                    </button>
                    <span className="text-xs text-zinc-200 break-words">{comment.content}</span>
                </div>
                <p className="text-[10px] text-zinc-600 mt-0.5 px-1">{timeAgo(comment.created_at)}</p>
            </div>
            {comment.author_id === userId && (
                <button type="button" onClick={() => onDelete(postId, comment.id)} aria-label="Delete comment"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 transition-all mt-1 shrink-0 active:scale-95">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
                        <path d="M5 3.25V4H3.25a.75.75 0 000 1.5h.3l.5 5A1.5 1.5 0 005.543 12h.914A1.5 1.5 0 007.95 10.5l.5-5h.3a.75.75 0 000-1.5H7v-.75A1.75 1.75 0 005.25 1.5h-.5A1.75 1.75 0 003 3.25z" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default CommunityHub;
