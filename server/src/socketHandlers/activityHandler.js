'use strict';

/**
 * activityHandler.js
 * Handles activity status updates AND profile updates (display_name, avatar_url).
 */

const { pool } = require('../db');

async function getAcceptedFriendIds(userId) {
    const [rows] = await pool.execute(
        `SELECT
             CASE WHEN user_id_1 = ? THEN user_id_2 ELSE user_id_1 END AS friend_id
         FROM friends
         WHERE (user_id_1 = ? OR user_id_2 = ?)
           AND status = 'accepted'`,
        [userId, userId, userId]
    );
    return rows.map((r) => r.friend_id);
}

function registerActivityHandlers(socket, io, userSocketMap) {
    // ── update_activity_status ────────────────────────────────────────────────
    socket.on('update_activity_status', async (payload) => {
        const { userId, statusIcon, statusText } = payload ?? {};

        if (typeof userId !== 'number' || userId <= 0) {
            socket.emit('error_event', { event: 'update_activity_status', message: 'Invalid payload: userId (number) is required.' });
            return;
        }

        // Allow null/null to clear activity
        const icon = statusIcon ?? null;
        const text = statusText ?? null;

        let isIncognito = false;
        try {
            const [rows] = await pool.execute('SELECT is_incognito FROM users WHERE id = ? LIMIT 1', [userId]);
            if (rows.length === 0) { socket.emit('error_event', { event: 'update_activity_status', message: 'User not found.' }); return; }
            isIncognito = rows[0].is_incognito === 1;
        } catch (dbError) {
            console.error('[ActivityHandler] DB incognito check error:', dbError);
            return;
        }

        if (isIncognito) return;

        try {
            await pool.execute(
                `UPDATE users SET current_status_icon = ?, current_status_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [icon, text, userId]
            );
        } catch (dbError) {
            console.error('[ActivityHandler] DB update error:', dbError);
            return;
        }

        const activityPayload = { userId, statusIcon: icon, statusText: text, updatedAt: new Date().toISOString() };
        let friendIds;
        try { friendIds = await getAcceptedFriendIds(userId); } catch { return; }
        for (const friendId of friendIds) {
            const sid = userSocketMap.get(friendId);
            if (sid) io.to(sid).emit('friend_activity_updated', activityPayload);
        }
    });

    // ── clear_activity_status ─────────────────────────────────────────────────
    socket.on('clear_activity_status', async (payload) => {
        const { userId } = payload ?? {};
        if (typeof userId !== 'number' || userId <= 0) return;
        try {
            await pool.execute(
                `UPDATE users SET current_status_icon = NULL, current_status_text = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [userId]
            );
        } catch { return; }
        let friendIds;
        try { friendIds = await getAcceptedFriendIds(userId); } catch { return; }
        const clearPayload = { userId, statusIcon: null, statusText: null, updatedAt: new Date().toISOString() };
        for (const friendId of friendIds) {
            const sid = userSocketMap.get(friendId);
            if (sid) io.to(sid).emit('friend_activity_updated', clearPayload);
        }
    });

    // ── profile_updated ───────────────────────────────────────────────────────
    // Emitted by the client after PATCH /users/me succeeds.
    // Broadcasts the new display_name and avatar_url to all online friends
    // so their sidebar updates in real-time without a page reload.
    socket.on('profile_updated', async (payload) => {
        const { userId, displayName, avatarUrl } = payload ?? {};
        if (typeof userId !== 'number' || userId <= 0) return;

        let friendIds;
        try { friendIds = await getAcceptedFriendIds(userId); } catch { return; }

        const updatePayload = {
            userId,
            displayName: displayName ?? null,
            avatarUrl:   avatarUrl   ?? null,
            updatedAt:   new Date().toISOString(),
        };

        for (const friendId of friendIds) {
            const sid = userSocketMap.get(friendId);
            if (sid) io.to(sid).emit('friend_profile_updated', updatePayload);
        }

        console.log(`[ActivityHandler] User ${userId} profile broadcast to ${friendIds.length} friend(s).`);
    });
}

module.exports = { registerActivityHandlers };
