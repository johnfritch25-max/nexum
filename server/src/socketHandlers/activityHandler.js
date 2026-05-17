'use strict';

/**
 * activityHandler.js
 * Handles the `update_activity_status` and `clear_activity_status` events.
 *
 * Flow for update_activity_status:
 *  1. Validate payload.
 *  2. Check is_incognito in DB — silently drop if true.
 *  3. Persist new icon/text to users table.
 *  4. Broadcast to all connected accepted friends.
 */

const { pool } = require('../db');

/**
 * Fetches accepted friend IDs for a given user.
 *
 * @param {number} userId
 * @returns {Promise<number[]>}
 */
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

/**
 * Registers activity-status Socket.io event listeners on a socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 * @param {Map<number, string>}        userSocketMap  userId → socketId
 */
function registerActivityHandlers(socket, io, userSocketMap) {
    /**
     * Event: update_activity_status
     * Payload: { userId: number, statusIcon: string, statusText: string }
     */
    socket.on('update_activity_status', async (payload) => {
        const { userId, statusIcon, statusText } = payload ?? {};

        if (typeof userId !== 'number' || userId <= 0) {
            socket.emit('error_event', { event: 'update_activity_status', message: 'Invalid payload: userId (number) is required.' });
            return;
        }
        if (typeof statusIcon !== 'string' || statusIcon.trim().length === 0) {
            socket.emit('error_event', { event: 'update_activity_status', message: 'Invalid payload: statusIcon (non-empty string) is required.' });
            return;
        }
        if (typeof statusText !== 'string' || statusText.trim().length === 0) {
            socket.emit('error_event', { event: 'update_activity_status', message: 'Invalid payload: statusText (non-empty string) is required.' });
            return;
        }

        // Check incognito — server-side second line of defense
        let isIncognito = false;
        try {
            const [rows] = await pool.execute(
                'SELECT is_incognito FROM users WHERE id = ? LIMIT 1',
                [userId]
            );
            if (rows.length === 0) {
                socket.emit('error_event', { event: 'update_activity_status', message: 'User not found.' });
                return;
            }
            isIncognito = rows[0].is_incognito === 1;
        } catch (dbError) {
            console.error('[ActivityHandler] DB incognito check error:', dbError);
            socket.emit('error_event', { event: 'update_activity_status', message: 'Server error during status update.' });
            return;
        }

        if (isIncognito) {
            console.log(`[ActivityHandler] User ${userId} is incognito — activity update suppressed.`);
            return;
        }

        // Persist
        try {
            await pool.execute(
                `UPDATE users
                 SET current_status_icon = ?,
                     current_status_text = ?,
                     updated_at          = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [statusIcon.trim(), statusText.trim(), userId]
            );
        } catch (dbError) {
            console.error('[ActivityHandler] DB update error:', dbError);
            socket.emit('error_event', { event: 'update_activity_status', message: 'Failed to persist activity status.' });
            return;
        }

        // Broadcast to connected friends
        const activityPayload = {
            userId,
            statusIcon: statusIcon.trim(),
            statusText: statusText.trim(),
            updatedAt:  new Date().toISOString(),
        };

        let friendIds;
        try {
            friendIds = await getAcceptedFriendIds(userId);
        } catch (dbError) {
            console.error('[ActivityHandler] DB friend fetch error:', dbError);
            return;
        }

        for (const friendId of friendIds) {
            const friendSocketId = userSocketMap.get(friendId);
            if (friendSocketId) {
                io.to(friendSocketId).emit('friend_activity_updated', activityPayload);
            }
        }

        console.log(
            `[ActivityHandler] User ${userId} activity → "${statusIcon.trim()} ${statusText.trim()}" ` +
            `broadcast to ${friendIds.length} friend(s).`
        );
    });

    /**
     * Event: clear_activity_status
     * Clears icon/text — called when incognito is enabled or all apps close.
     * Payload: { userId: number }
     */
    socket.on('clear_activity_status', async (payload) => {
        const { userId } = payload ?? {};

        if (typeof userId !== 'number' || userId <= 0) {
            socket.emit('error_event', { event: 'clear_activity_status', message: 'Invalid payload: userId (number) is required.' });
            return;
        }

        try {
            await pool.execute(
                `UPDATE users
                 SET current_status_icon = NULL,
                     current_status_text = NULL,
                     updated_at          = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [userId]
            );
        } catch (dbError) {
            console.error('[ActivityHandler] DB clear error:', dbError);
            return;
        }

        let friendIds;
        try {
            friendIds = await getAcceptedFriendIds(userId);
        } catch {
            return;
        }

        const clearPayload = {
            userId,
            statusIcon: null,
            statusText: null,
            updatedAt:  new Date().toISOString(),
        };

        for (const friendId of friendIds) {
            const friendSocketId = userSocketMap.get(friendId);
            if (friendSocketId) {
                io.to(friendSocketId).emit('friend_activity_updated', clearPayload);
            }
        }

        console.log(`[ActivityHandler] User ${userId} activity cleared — broadcast to ${friendIds.length} friend(s).`);
    });
}

module.exports = { registerActivityHandlers };
