'use strict';

/**
 * friends.js
 * REST routes for the friend relationship lifecycle.
 *
 * POST   /friends/request          — send a friend request
 * PATCH  /friends/request/:id      — accept or decline a pending request
 * DELETE /friends/:id              — remove an accepted friend or cancel a request
 * POST   /friends/block/:userId    — block a user
 * DELETE /friends/block/:userId    — unblock a user
 * GET    /friends/requests/pending — list incoming pending requests
 */

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { pool }     = require('../db');

const router = express.Router();

router.use(authenticate);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the canonical (lower_id, higher_id) pair for a friendship row.
 */
function canonicalPair(idA, idB) {
    return idA < idB ? [idA, idB] : [idB, idA];
}

// ── POST /friends/request ────────────────────────────────────────────────────

/**
 * Sends a friend request to another user.
 * Body: { targetUserId: number }
 */
router.post('/request', async (req, res) => {
    const requesterId  = req.user.sub;
    const { targetUserId } = req.body ?? {};

    if (typeof targetUserId !== 'number' || targetUserId <= 0) {
        return res.status(400).json({ error: 'targetUserId (number) is required.' });
    }

    if (targetUserId === requesterId) {
        return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    }

    // Verify target user exists
    try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE id = ? LIMIT 1', [targetUserId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Target user not found.' });
        }
    } catch (dbError) {
        console.error('[Friends] Request user check error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    const [uid1, uid2] = canonicalPair(requesterId, targetUserId);

    // Check for an existing relationship
    try {
        const [existing] = await pool.execute(
            'SELECT id, status FROM friends WHERE user_id_1 = ? AND user_id_2 = ? LIMIT 1',
            [uid1, uid2]
        );

        if (existing.length > 0) {
            const { status } = existing[0];
            if (status === 'accepted') return res.status(409).json({ error: 'You are already friends.' });
            if (status === 'pending')  return res.status(409).json({ error: 'A friend request already exists.' });
            if (status === 'blocked')  return res.status(403).json({ error: 'This action is not allowed.' });
        }
    } catch (dbError) {
        console.error('[Friends] Request existing check error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    let insertedId;
    try {
        const [result] = await pool.execute(
            `INSERT INTO friends (user_id_1, user_id_2, requester_id, status)
             VALUES (?, ?, ?, 'pending')`,
            [uid1, uid2, requesterId]
        );
        insertedId = result.insertId;
    } catch (dbError) {
        console.error('[Friends] Request insert error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(201).json({ message: 'Friend request sent.', friendshipId: insertedId });
});

// ── PATCH /friends/request/:id ───────────────────────────────────────────────

/**
 * Accepts or declines a pending friend request.
 * Only the non-requester (the recipient) may respond.
 * Body: { action: 'accept' | 'decline' }
 */
router.patch('/request/:id', async (req, res) => {
    const userId       = req.user.sub;
    const friendshipId = parseInt(req.params.id, 10);
    const { action }   = req.body ?? {};

    if (isNaN(friendshipId) || friendshipId <= 0) {
        return res.status(400).json({ error: 'Invalid friendship id.' });
    }

    if (action !== 'accept' && action !== 'decline') {
        return res.status(400).json({ error: 'action must be "accept" or "decline".' });
    }

    let friendship;
    try {
        const [rows] = await pool.execute(
            'SELECT id, user_id_1, user_id_2, requester_id, status FROM friends WHERE id = ? LIMIT 1',
            [friendshipId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Friend request not found.' });
        }

        friendship = rows[0];
    } catch (dbError) {
        console.error('[Friends] PATCH fetch error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    // Only the recipient (not the requester) can respond
    if (friendship.requester_id === userId) {
        return res.status(403).json({ error: 'You cannot respond to your own friend request.' });
    }

    // Ensure the authenticated user is actually part of this friendship
    if (friendship.user_id_1 !== userId && friendship.user_id_2 !== userId) {
        return res.status(403).json({ error: 'This friend request is not addressed to you.' });
    }

    if (friendship.status !== 'pending') {
        return res.status(409).json({ error: 'This request has already been responded to.' });
    }

    if (action === 'decline') {
        try {
            await pool.execute('DELETE FROM friends WHERE id = ?', [friendshipId]);
        } catch (dbError) {
            console.error('[Friends] Decline delete error:', dbError);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        return res.status(200).json({ message: 'Friend request declined.' });
    }

    // Accept
    try {
        await pool.execute(
            `UPDATE friends SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [friendshipId]
        );
    } catch (dbError) {
        console.error('[Friends] Accept update error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({ message: 'Friend request accepted.' });
});

// ── DELETE /friends/:id ──────────────────────────────────────────────────────

/**
 * Removes an accepted friendship or cancels a pending request.
 * Either participant may remove the friendship.
 * The requester may cancel their own pending request.
 */
router.delete('/:id', async (req, res) => {
    const userId       = req.user.sub;
    const friendshipId = parseInt(req.params.id, 10);

    if (isNaN(friendshipId) || friendshipId <= 0) {
        return res.status(400).json({ error: 'Invalid friendship id.' });
    }

    let friendship;
    try {
        const [rows] = await pool.execute(
            'SELECT id, user_id_1, user_id_2, requester_id, status FROM friends WHERE id = ? LIMIT 1',
            [friendshipId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Friendship not found.' });
        }

        friendship = rows[0];
    } catch (dbError) {
        console.error('[Friends] DELETE fetch error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    if (friendship.user_id_1 !== userId && friendship.user_id_2 !== userId) {
        return res.status(403).json({ error: 'You are not part of this friendship.' });
    }

    // Blocked relationships can only be removed via the unblock endpoint
    if (friendship.status === 'blocked') {
        return res.status(403).json({ error: 'Use the unblock endpoint to remove a block.' });
    }

    try {
        await pool.execute('DELETE FROM friends WHERE id = ?', [friendshipId]);
    } catch (dbError) {
        console.error('[Friends] DELETE error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({ message: 'Friendship removed.' });
});

// ── POST /friends/block/:userId ──────────────────────────────────────────────

/**
 * Blocks a user. Overwrites any existing pending/accepted relationship.
 */
router.post('/block/:userId', async (req, res) => {
    const blockerId  = req.user.sub;
    const blockedId  = parseInt(req.params.userId, 10);

    if (isNaN(blockedId) || blockedId <= 0) {
        return res.status(400).json({ error: 'Invalid userId.' });
    }

    if (blockedId === blockerId) {
        return res.status(400).json({ error: 'You cannot block yourself.' });
    }

    const [uid1, uid2] = canonicalPair(blockerId, blockedId);

    try {
        // Upsert: if a relationship exists, overwrite it; otherwise insert
        await pool.execute(
            `INSERT INTO friends (user_id_1, user_id_2, requester_id, status)
             VALUES (?, ?, ?, 'blocked')
             ON DUPLICATE KEY UPDATE
                 status       = 'blocked',
                 requester_id = VALUES(requester_id),
                 updated_at   = CURRENT_TIMESTAMP`,
            [uid1, uid2, blockerId]
        );
    } catch (dbError) {
        console.error('[Friends] Block error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({ message: 'User blocked.' });
});

// ── DELETE /friends/block/:userId ────────────────────────────────────────────

/**
 * Unblocks a user. Only the user who initiated the block may unblock.
 */
router.delete('/block/:userId', async (req, res) => {
    const blockerId = req.user.sub;
    const blockedId = parseInt(req.params.userId, 10);

    if (isNaN(blockedId) || blockedId <= 0) {
        return res.status(400).json({ error: 'Invalid userId.' });
    }

    const [uid1, uid2] = canonicalPair(blockerId, blockedId);

    try {
        const [rows] = await pool.execute(
            'SELECT id, requester_id, status FROM friends WHERE user_id_1 = ? AND user_id_2 = ? LIMIT 1',
            [uid1, uid2]
        );

        if (rows.length === 0 || rows[0].status !== 'blocked') {
            return res.status(404).json({ error: 'No block found for this user.' });
        }

        if (rows[0].requester_id !== blockerId) {
            return res.status(403).json({ error: 'You did not initiate this block.' });
        }

        await pool.execute('DELETE FROM friends WHERE id = ?', [rows[0].id]);
    } catch (dbError) {
        console.error('[Friends] Unblock error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({ message: 'User unblocked.' });
});

// ── GET /friends/requests/pending ───────────────────────────────────────────

/**
 * Returns all pending friend requests directed at the authenticated user.
 */
router.get('/requests/pending', async (req, res) => {
    const userId = req.user.sub;

    try {
        const [rows] = await pool.execute(
            `SELECT
                 f.id            AS friendship_id,
                 f.created_at    AS requested_at,
                 u.id            AS requester_id,
                 u.username,
                 u.display_name,
                 u.avatar_url
             FROM friends f
             JOIN users u ON u.id = f.requester_id
             WHERE (f.user_id_1 = ? OR f.user_id_2 = ?)
               AND f.status       = 'pending'
               AND f.requester_id != ?
             ORDER BY f.created_at DESC`,
            [userId, userId, userId]
        );

        return res.status(200).json({ requests: rows });
    } catch (dbError) {
        console.error('[Friends] Pending requests error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
