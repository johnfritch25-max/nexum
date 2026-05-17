'use strict';

/**
 * messages.js
 * REST routes for message history.
 *
 * GET /messages/:roomId        — paginated message history for a conversation
 * PATCH /messages/:messageId   — edit a message (sender only)
 * DELETE /messages/:messageId  — soft-delete a message (sender only)
 * PATCH /messages/:roomId/read — mark all unread messages in a room as read
 */

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { pool }     = require('../db');

const router = express.Router();

router.use(authenticate);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the deterministic room ID from two user IDs.
 * Mirrors the logic in messageHandler.js.
 */
function buildRoomId(idA, idB) {
    return idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
}

/**
 * Verifies that the authenticated user is a participant in the given room.
 * Room IDs are formatted as "lowerUserId_higherUserId".
 *
 * @param {string} roomId
 * @param {number} userId
 * @returns {boolean}
 */
function isRoomParticipant(roomId, userId) {
    const parts = roomId.split('_');
    if (parts.length !== 2) return false;
    const [a, b] = parts.map(Number);
    return a === userId || b === userId;
}

// ── GET /messages/:roomId ────────────────────────────────────────────────────

/**
 * Returns paginated message history for a room.
 *
 * Query params:
 *   limit  (number, default 50, max 100) — messages per page
 *   before (ISO timestamp)               — cursor: fetch messages older than this
 *
 * Messages are returned newest-first so the client can render them in reverse
 * and implement infinite-scroll upward.
 */
router.get('/:roomId', async (req, res) => {
    const userId = req.user.sub;
    const { roomId } = req.params;

    if (!isRoomParticipant(roomId, userId)) {
        return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    const rawLimit  = parseInt(req.query.limit ?? '50', 10);
    const limit     = Math.min(Math.max(rawLimit, 1), 100);
    const before    = req.query.before;

    let rows;
    try {
        if (before) {
            const beforeDate = new Date(before);
            if (isNaN(beforeDate.getTime())) {
                return res.status(400).json({ error: 'Invalid "before" timestamp.' });
            }

            [rows] = await pool.execute(
                `SELECT id, sender_id, receiver_id, room_id, content, message_type,
                        is_edited, is_deleted, read_at, created_at, updated_at
                 FROM messages
                 WHERE room_id   = ?
                   AND is_deleted = 0
                   AND created_at < ?
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [roomId, beforeDate, limit]
            );
        } else {
            [rows] = await pool.execute(
                `SELECT id, sender_id, receiver_id, room_id, content, message_type,
                        is_edited, is_deleted, read_at, created_at, updated_at
                 FROM messages
                 WHERE room_id    = ?
                   AND is_deleted = 0
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [roomId, limit]
            );
        }
    } catch (dbError) {
        console.error('[Messages] GET history error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    // Determine if there are more messages before the oldest one returned
    const hasMore = rows.length === limit;

    return res.status(200).json({
        messages: rows,
        hasMore,
        nextCursor: hasMore ? rows[rows.length - 1].created_at : null,
    });
});

// ── PATCH /messages/:messageId ───────────────────────────────────────────────

/**
 * Edits the content of a message. Only the original sender may edit.
 * Body: { content: string }
 */
router.patch('/:messageId', async (req, res) => {
    const userId    = req.user.sub;
    const messageId = parseInt(req.params.messageId, 10);
    const { content } = req.body ?? {};

    if (isNaN(messageId) || messageId <= 0) {
        return res.status(400).json({ error: 'Invalid messageId.' });
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'content must be a non-empty string.' });
    }

    if (content.length > 4000) {
        return res.status(400).json({ error: 'content exceeds the 4000-character limit.' });
    }

    // Fetch the message to verify ownership
    let message;
    try {
        const [rows] = await pool.execute(
            'SELECT id, sender_id, is_deleted FROM messages WHERE id = ? LIMIT 1',
            [messageId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        message = rows[0];
    } catch (dbError) {
        console.error('[Messages] PATCH fetch error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    if (message.sender_id !== userId) {
        return res.status(403).json({ error: 'You can only edit your own messages.' });
    }

    if (message.is_deleted) {
        return res.status(409).json({ error: 'Cannot edit a deleted message.' });
    }

    try {
        await pool.execute(
            `UPDATE messages
             SET content    = ?,
                 is_edited  = 1,
                 updated_at = CURRENT_TIMESTAMP(3)
             WHERE id = ?`,
            [content.trim(), messageId]
        );
    } catch (dbError) {
        console.error('[Messages] PATCH update error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({ message: 'Message updated.', id: messageId, content: content.trim() });
});

// ── DELETE /messages/:messageId ──────────────────────────────────────────────

/**
 * Soft-deletes a message. Only the original sender may delete.
 * The row is kept in the DB; clients should render "Message deleted" in its place.
 */
router.delete('/:messageId', async (req, res) => {
    const userId    = req.user.sub;
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(messageId) || messageId <= 0) {
        return res.status(400).json({ error: 'Invalid messageId.' });
    }

    let message;
    try {
        const [rows] = await pool.execute(
            'SELECT id, sender_id, is_deleted FROM messages WHERE id = ? LIMIT 1',
            [messageId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        message = rows[0];
    } catch (dbError) {
        console.error('[Messages] DELETE fetch error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    if (message.sender_id !== userId) {
        return res.status(403).json({ error: 'You can only delete your own messages.' });
    }

    if (message.is_deleted) {
        return res.status(409).json({ error: 'Message is already deleted.' });
    }

    try {
        await pool.execute(
            `UPDATE messages
             SET is_deleted = 1,
                 content    = '',
                 updated_at = CURRENT_TIMESTAMP(3)
             WHERE id = ?`,
            [messageId]
        );
    } catch (dbError) {
        console.error('[Messages] DELETE update error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({ message: 'Message deleted.', id: messageId });
});

// ── PATCH /messages/:roomId/read ─────────────────────────────────────────────

/**
 * Marks all unread messages in a room as read for the authenticated user.
 * Only marks messages where the authenticated user is the receiver.
 */
router.patch('/:roomId/read', async (req, res) => {
    const userId = req.user.sub;
    const { roomId } = req.params;

    if (!isRoomParticipant(roomId, userId)) {
        return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE messages
             SET read_at    = CURRENT_TIMESTAMP(3),
                 updated_at = CURRENT_TIMESTAMP(3)
             WHERE room_id     = ?
               AND receiver_id = ?
               AND read_at     IS NULL
               AND is_deleted  = 0`,
            [roomId, userId]
        );

        return res.status(200).json({
            message:      'Messages marked as read.',
            updatedCount: result.affectedRows,
        });
    } catch (dbError) {
        console.error('[Messages] read receipt error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── POST /messages/:messageId/react ─────────────────────────────────────────
/**
 * Toggle a reaction on a message. Only participants in the room may react.
 * Body: { emoji: string }
 */
router.post('/:messageId/react', async (req, res) => {
    const userId    = req.user.sub;
    const messageId = parseInt(req.params.messageId, 10);
    const { emoji = '❤️' } = req.body ?? {};
    const ALLOWED = ['❤️','👍','😂','😮','😢','🔥','👎'];
    if (isNaN(messageId)) return res.status(400).json({ error: 'Invalid messageId.' });
    if (!ALLOWED.includes(emoji)) return res.status(400).json({ error: 'Invalid emoji.' });
    try {
        const [[msg]] = await pool.execute('SELECT room_id FROM messages WHERE id = ? LIMIT 1', [messageId]);
        if (!msg) return res.status(404).json({ error: 'Message not found.' });
        if (!isRoomParticipant(msg.room_id, userId)) return res.status(403).json({ error: 'Not a participant.' });
        const [[existing]] = await pool.execute('SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ? LIMIT 1', [messageId, userId, emoji]);
        if (existing) {
            await pool.execute('DELETE FROM message_reactions WHERE id = ?', [existing.id]);
            return res.json({ action: 'removed', emoji, messageId });
        }
        await pool.execute('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)', [messageId, userId, emoji]);
        return res.json({ action: 'added', emoji, messageId });
    } catch (e) { console.error('[Messages] react:', e); return res.status(500).json({ error: 'Internal server error.' }); }
});

// ── GET /messages/:messageId/reactions ───────────────────────────────────────
router.get('/:messageId/reactions', async (req, res) => {
    const userId    = req.user.sub;
    const messageId = parseInt(req.params.messageId, 10);
    if (isNaN(messageId)) return res.status(400).json({ error: 'Invalid messageId.' });
    try {
        const [[msg]] = await pool.execute('SELECT room_id FROM messages WHERE id = ? LIMIT 1', [messageId]);
        if (!msg) return res.status(404).json({ error: 'Message not found.' });
        if (!isRoomParticipant(msg.room_id, userId)) return res.status(403).json({ error: 'Not a participant.' });
        const [rows] = await pool.execute(
            `SELECT emoji, COUNT(*) AS cnt, MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS reacted_by_me
             FROM message_reactions WHERE message_id = ? GROUP BY emoji`,
            [userId, messageId]
        );
        return res.json({ reactions: rows.map((r) => ({ emoji: r.emoji, count: Number(r.cnt), reactedByMe: r.reacted_by_me === 1 })) });
    } catch (e) { console.error('[Messages] reactions:', e); return res.status(500).json({ error: 'Internal server error.' }); }
});

module.exports = router;
