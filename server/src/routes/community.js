'use strict';

/**
 * community.js — REST routes for the Community Hub
 *
 * GET    /community/posts              — paginated feed (newest first)
 * POST   /community/posts              — create a post
 * DELETE /community/posts/:id          — soft-delete own post
 * POST   /community/posts/:id/react    — toggle a reaction (emoji)
 * GET    /community/posts/:id/comments — list comments on a post
 * POST   /community/posts/:id/comments — add a comment
 * DELETE /community/comments/:id       — soft-delete own comment
 */

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { pool }     = require('../db');

const router = express.Router();
router.use(authenticate);

const ALLOWED_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

// ── helpers ───────────────────────────────────────────────────────────────────

async function enrichPosts(rows, userId) {
    if (!rows.length) return [];
    const ids          = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');

    const [reactions] = await pool.execute(
        `SELECT post_id, emoji, COUNT(*) AS cnt,
                MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
         FROM post_reactions WHERE post_id IN (${placeholders})
         GROUP BY post_id, emoji`,
        [userId, ...ids]
    );

    const [comments] = await pool.execute(
        `SELECT post_id, COUNT(*) AS cnt FROM post_comments
         WHERE post_id IN (${placeholders}) AND is_deleted = 0
         GROUP BY post_id`,
        ids
    );

    const reactionMap = {};
    for (const r of reactions) {
        if (!reactionMap[r.post_id]) reactionMap[r.post_id] = [];
        reactionMap[r.post_id].push({
            emoji:       r.emoji,
            count:       Number(r.cnt),
            reactedByMe: r.reacted_by_me === 1,
        });
    }
    const commentMap = {};
    for (const c of comments) commentMap[c.post_id] = Number(c.cnt);

    return rows.map((p) => ({
        ...p,
        reactions:    reactionMap[p.id] ?? [],
        commentCount: commentMap[p.id]  ?? 0,
    }));
}

// ── GET /community/posts ──────────────────────────────────────────────────────
router.get('/posts', async (req, res) => {
    const userId = Number(req.user.sub);
    // Clamp limit and embed directly — safe because it's an integer we control
    const limit  = Math.min(Math.max(parseInt(req.query.limit ?? '20', 10), 1), 50);
    const before = req.query.before;

    try {
        let rows;
        if (before) {
            const d = new Date(before);
            if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid before timestamp.' });
            [rows] = await pool.query(
                `SELECT p.id, p.author_id, p.content, p.image_url, p.is_deleted, p.created_at,
                        u.display_name AS author_name, u.username AS author_username, u.avatar_url AS author_avatar
                 FROM posts p JOIN users u ON u.id = p.author_id
                 WHERE p.is_deleted = 0 AND p.created_at < ?
                 ORDER BY p.created_at DESC LIMIT ${limit}`,
                [d]
            );
        } else {
            [rows] = await pool.query(
                `SELECT p.id, p.author_id, p.content, p.image_url, p.is_deleted, p.created_at,
                        u.display_name AS author_name, u.username AS author_username, u.avatar_url AS author_avatar
                 FROM posts p JOIN users u ON u.id = p.author_id
                 WHERE p.is_deleted = 0
                 ORDER BY p.created_at DESC LIMIT ${limit}`
            );
        }

        const enriched = await enrichPosts(rows, userId);
        return res.json({
            posts:      enriched,
            hasMore:    rows.length === limit,
            nextCursor: rows.length ? rows[rows.length - 1].created_at : null,
        });
    } catch (e) {
        console.error('[Community] GET posts:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── POST /community/posts ─────────────────────────────────────────────────────
router.post('/posts', async (req, res) => {
    const userId = Number(req.user.sub);
    const { content, image_url } = req.body ?? {};

    if (typeof content !== 'string' || content.trim().length === 0)
        return res.status(400).json({ error: 'content is required.' });
    if (content.trim().length > 2000)
        return res.status(400).json({ error: 'content exceeds 2000 characters.' });
    if (image_url && typeof image_url === 'string' && image_url.length > 7_000_000)
        return res.status(400).json({ error: 'Image exceeds 5 MB.' });

    try {
        const [result] = await pool.execute(
            'INSERT INTO posts (author_id, content, image_url) VALUES (?, ?, ?)',
            [userId, content.trim(), image_url ?? null]
        );
        const [[post]] = await pool.execute(
            `SELECT p.id, p.author_id, p.content, p.image_url, p.is_deleted, p.created_at,
                    u.display_name AS author_name, u.username AS author_username, u.avatar_url AS author_avatar
             FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`,
            [result.insertId]
        );
        return res.status(201).json({ post: { ...post, reactions: [], commentCount: 0 } });
    } catch (e) {
        console.error('[Community] POST post:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── DELETE /community/posts/:id ───────────────────────────────────────────────
router.delete('/posts/:id', async (req, res) => {
    const userId = Number(req.user.sub);
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post id.' });

    try {
        const [[post]] = await pool.execute(
            'SELECT author_id FROM posts WHERE id = ? LIMIT 1', [postId]
        );
        if (!post) return res.status(404).json({ error: 'Post not found.' });
        if (Number(post.author_id) !== userId) return res.status(403).json({ error: 'Not your post.' });
        await pool.execute('UPDATE posts SET is_deleted = 1 WHERE id = ?', [postId]);
        return res.json({ message: 'Post deleted.' });
    } catch (e) {
        console.error('[Community] DELETE post:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── POST /community/posts/:id/react ──────────────────────────────────────────
router.post('/posts/:id/react', async (req, res) => {
    const userId = Number(req.user.sub);
    const postId = parseInt(req.params.id, 10);
    const { emoji = '❤️' } = req.body ?? {};

    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post id.' });
    if (!ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Invalid emoji.' });

    try {
        // Find any existing reaction by this user on this post (any emoji)
        const [[existing]] = await pool.execute(
            'SELECT id, emoji FROM post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1',
            [postId, userId]
        );

        if (existing) {
            if (existing.emoji === emoji) {
                // Same emoji — toggle off (remove)
                await pool.execute('DELETE FROM post_reactions WHERE id = ?', [existing.id]);
                return res.json({ action: 'removed', emoji });
            } else {
                // Different emoji — replace (update)
                await pool.execute('UPDATE post_reactions SET emoji = ? WHERE id = ?', [emoji, existing.id]);
                return res.json({ action: 'replaced', emoji, previous: existing.emoji });
            }
        }

        // No existing reaction — add new
        await pool.execute(
            'INSERT INTO post_reactions (post_id, user_id, emoji) VALUES (?, ?, ?)',
            [postId, userId, emoji]
        );
        return res.json({ action: 'added', emoji });
    } catch (e) {
        console.error('[Community] react:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── GET /community/posts/:id/comments ────────────────────────────────────────
router.get('/posts/:id/comments', async (req, res) => {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post id.' });

    try {
        const [rows] = await pool.execute(
            `SELECT c.id, c.post_id, c.author_id, c.content, c.is_deleted, c.created_at,
                    u.display_name AS author_name, u.username AS author_username, u.avatar_url AS author_avatar
             FROM post_comments c JOIN users u ON u.id = c.author_id
             WHERE c.post_id = ? AND c.is_deleted = 0
             ORDER BY c.created_at ASC`,
            [postId]
        );
        return res.json({ comments: rows });
    } catch (e) {
        console.error('[Community] GET comments:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── POST /community/posts/:id/comments ───────────────────────────────────────
router.post('/posts/:id/comments', async (req, res) => {
    const userId = Number(req.user.sub);
    const postId = parseInt(req.params.id, 10);
    const { content } = req.body ?? {};

    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post id.' });
    if (typeof content !== 'string' || content.trim().length === 0)
        return res.status(400).json({ error: 'content is required.' });
    if (content.trim().length > 1000)
        return res.status(400).json({ error: 'Comment exceeds 1000 characters.' });

    try {
        const [result] = await pool.execute(
            'INSERT INTO post_comments (post_id, author_id, content) VALUES (?, ?, ?)',
            [postId, userId, content.trim()]
        );
        const [[comment]] = await pool.execute(
            `SELECT c.id, c.post_id, c.author_id, c.content, c.is_deleted, c.created_at,
                    u.display_name AS author_name, u.username AS author_username, u.avatar_url AS author_avatar
             FROM post_comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
            [result.insertId]
        );
        return res.status(201).json({ comment });
    } catch (e) {
        console.error('[Community] POST comment:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── DELETE /community/comments/:id ───────────────────────────────────────────
router.delete('/comments/:id', async (req, res) => {
    const userId    = Number(req.user.sub);
    const commentId = parseInt(req.params.id, 10);
    if (isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment id.' });

    try {
        const [[c]] = await pool.execute(
            'SELECT author_id FROM post_comments WHERE id = ? LIMIT 1', [commentId]
        );
        if (!c) return res.status(404).json({ error: 'Comment not found.' });
        if (Number(c.author_id) !== userId) return res.status(403).json({ error: 'Not your comment.' });
        await pool.execute('UPDATE post_comments SET is_deleted = 1 WHERE id = ?', [commentId]);
        return res.json({ message: 'Comment deleted.' });
    } catch (e) {
        console.error('[Community] DELETE comment:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
