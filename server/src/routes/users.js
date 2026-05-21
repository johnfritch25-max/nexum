'use strict';

/**
 * users.js
 * REST routes for user profile and settings management.
 *
 * All routes require a valid JWT (enforced by the authenticate middleware).
 *
 * PATCH /users/me/incognito   — toggle incognito mode on/off
 * GET   /users/me             — fetch the authenticated user's own profile
 * PATCH /users/me             — update display_name, bio, avatar_url
 * GET   /users/me/friends     — list accepted friends with their live status
 */

const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { pool }     = require('../db');

const router = express.Router();

// All routes in this file require authentication
router.use(authenticate);

// ── PATCH /users/me/incognito ────────────────────────────────────────────────

/**
 * Toggles incognito mode for the authenticated user.
 *
 * When enabling incognito the server also clears current_status_icon and
 * current_status_text so friends immediately see a blank activity — matching
 * what the client-side clear_activity_status socket event does, but as a
 * durable REST call that survives page reloads.
 *
 * Body: { is_incognito: boolean }
 */
router.patch('/me/incognito', async (req, res) => {
    const userId     = Number(req.user.sub);
    const { is_incognito } = req.body ?? {};

    if (typeof is_incognito !== 'boolean') {
        return res.status(400).json({ error: 'is_incognito must be a boolean.' });
    }

    try {
        if (is_incognito) {
            // Enabling incognito: persist flag AND wipe live activity
            await pool.execute(
                `UPDATE users
                 SET is_incognito        = 1,
                     current_status_icon = NULL,
                     current_status_text = NULL,
                     updated_at          = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [userId]
            );
        } else {
            // Disabling incognito: only clear the flag
            await pool.execute(
                `UPDATE users
                 SET is_incognito = 0,
                     updated_at   = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [userId]
            );
        }
    } catch (dbError) {
        console.error('[Users] Incognito update error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({
        message:      `Incognito mode ${is_incognito ? 'enabled' : 'disabled'}.`,
        is_incognito,
    });
});

// ── GET /users/search ────────────────────────────────────────────────────────

/**
 * Searches users by username or display_name.
 * Query param: q (string, min 2 chars)
 * Returns up to 20 results, excluding the authenticated user.
 */
router.get('/search', async (req, res) => {
    const userId = Number(req.user.sub);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (q.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
    }

    const pattern = `%${q}%`;

    try {
        const [rows] = await pool.execute(
            `SELECT u.id, u.username, u.display_name, u.avatar_url, u.online_status,
                    f.status AS friendship_status, f.id AS friendship_id, f.requester_id
             FROM users u
             LEFT JOIN friends f ON (
                 (f.user_id_1 = ? AND f.user_id_2 = u.id) OR
                 (f.user_id_2 = ? AND f.user_id_1 = u.id)
             )
             WHERE u.id != ?
               AND (u.username LIKE ? OR u.display_name LIKE ?)
             ORDER BY u.display_name ASC
             LIMIT 20`,
            [userId, userId, userId, pattern, pattern]
        );

        return res.status(200).json({ users: rows });
    } catch (dbError) {
        console.error('[Users] Search error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── PATCH /users/me/status ───────────────────────────────────────────────────
/**
 * Sets a manual custom status (icon + text).
 * Body: { status_icon: string | null, status_text: string | null }
 */
router.patch('/me/status', async (req, res) => {
    const userId = Number(req.user.sub);
    const { status_icon, status_text } = req.body ?? {};
    const icon = status_icon ?? null;
    const text = status_text ?? null;
    if (icon && typeof icon === 'string' && icon.length > 16)
        return res.status(400).json({ error: 'status_icon too long.' });
    if (text && typeof text === 'string' && text.length > 128)
        return res.status(400).json({ error: 'status_text too long.' });
    try {
        await pool.execute(
            'UPDATE users SET current_status_icon = ?, current_status_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [icon, text, userId]
        );
        return res.json({ message: 'Status updated.', status_icon: icon, status_text: text });
    } catch (e) {
        console.error('[Users] status update:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── GET /users/online ────────────────────────────────────────────────────────
/**
 * Returns all currently online users (for Community Hub online list).
 */
router.get('/online', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, username, display_name, online_status FROM users
             WHERE online_status = 'online' AND is_incognito = 0
             ORDER BY display_name ASC LIMIT 50`
        );
        return res.json({ users: rows });
    } catch (e) {
        console.error('[Users] online:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── GET /users/me ────────────────────────────────────────────────────────────

router.get('/me', async (req, res) => {
    const userId = Number(req.user.sub);

    try {
        const [rows] = await pool.execute(
            `SELECT id, username, display_name, email, avatar_url, bio,
                    online_status, current_status_icon, current_status_text,
                    is_incognito, last_seen_at, created_at
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = rows[0];

        // Never expose the password hash
        return res.status(200).json({
            id:                  user.id,
            username:            user.username,
            display_name:        user.display_name,
            email:               user.email,
            avatar_url:          user.avatar_url,
            bio:                 user.bio,
            online_status:       user.online_status,
            current_status_icon: user.is_incognito ? null : user.current_status_icon,
            current_status_text: user.is_incognito ? null : user.current_status_text,
            is_incognito:        user.is_incognito === 1,
            last_seen_at:        user.last_seen_at,
            created_at:          user.created_at,
        });
    } catch (dbError) {
        console.error('[Users] GET /me error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── PATCH /users/me ──────────────────────────────────────────────────────────

/**
 * Updates mutable profile fields.
 * Body (all fields optional): { display_name?, bio?, avatar_url? }
 */
router.patch('/me', async (req, res) => {
    const userId = Number(req.user.sub);
    const { display_name, bio, avatar_url } = req.body ?? {};

    const updates  = [];
    const values   = [];

    if (display_name !== undefined) {
        if (typeof display_name !== 'string' || display_name.trim().length < 1 || display_name.trim().length > 64) {
            return res.status(400).json({ error: 'display_name must be 1–64 characters.' });
        }
        updates.push('display_name = ?');
        values.push(display_name.trim());
    }

    if (bio !== undefined) {
        if (bio !== null && (typeof bio !== 'string' || bio.length > 300)) {
            return res.status(400).json({ error: 'bio must be a string of at most 300 characters, or null.' });
        }
        updates.push('bio = ?');
        values.push(bio === null ? null : bio.trim());
    }

    if (avatar_url !== undefined) {
        if (avatar_url !== null && (typeof avatar_url !== 'string' || avatar_url.length > 2097152)) {
            return res.status(400).json({ error: 'avatar_url must be a string of at most 2 MB, or null.' });
        }
        updates.push('avatar_url = ?');
        values.push(avatar_url);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    try {
        await pool.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
    } catch (dbError) {
        console.error('[Users] PATCH /me error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    return res.status(200).json({ message: 'Profile updated successfully.' });
});

// ── GET /users/:id — public profile (for community) ─────────────────────────
router.get('/:id', async (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId) || targetId <= 0) return res.status(400).json({ error: 'Invalid user id.' });
    try {
        const [rows] = await pool.execute(
            `SELECT id, username, display_name, avatar_url, bio, online_status,
                    CASE WHEN is_incognito = 1 THEN NULL ELSE current_status_icon END AS current_status_icon,
                    CASE WHEN is_incognito = 1 THEN NULL ELSE current_status_text END AS current_status_text,
                    last_seen_at, created_at
             FROM users WHERE id = ? LIMIT 1`,
            [targetId]
        );
        if (!rows.length) return res.status(404).json({ error: 'User not found.' });
        return res.json(rows[0]);
    } catch (e) {
        console.error('[Users] GET /:id:', e);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── GET /users/me/friends ────────────────────────────────────────────────────
/**
 * Returns the authenticated user's accepted friends with their live status.
 * Activity fields are masked to null for friends who have incognito enabled.
 */
router.get('/me/friends', async (req, res) => {
    const userId = Number(req.user.sub);

    try {
        const [rows] = await pool.execute(
            `SELECT
                 u.id,
                 u.username,
                 u.display_name,
                 u.avatar_url,
                 u.online_status,
                 CASE WHEN u.is_incognito = 1 THEN NULL ELSE u.current_status_icon END AS current_status_icon,
                 CASE WHEN u.is_incognito = 1 THEN NULL ELSE u.current_status_text END AS current_status_text,
                 u.last_seen_at
             FROM friends f
             JOIN users u ON u.id = CASE
                 WHEN f.user_id_1 = ? THEN f.user_id_2
                 ELSE f.user_id_1
             END
             WHERE (f.user_id_1 = ? OR f.user_id_2 = ?)
               AND f.status = 'accepted'
             ORDER BY u.online_status = 'online' DESC, u.display_name ASC`,
            [userId, userId, userId]
        );

        return res.status(200).json({ friends: rows });
    } catch (dbError) {
        console.error('[Users] GET /me/friends error:', dbError);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
