'use strict';

/**
 * presenceHandler.js
 * Manages coarse-grained online presence (online / idle / dnd / offline).
 * Broadcasts presence changes to all accepted friends of the affected user.
 */

const { pool } = require('../db');

/**
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
 * Sets a user's online_status in the DB and broadcasts the change to friends.
 *
 * @param {number}                     userId
 * @param {'online'|'idle'|'do_not_disturb'|'offline'} status
 * @param {import('socket.io').Server} io
 * @param {Map<number, string>}        userSocketMap
 */
async function broadcastPresenceChange(userId, status, io, userSocketMap) {
    const validStatuses = ['online', 'idle', 'do_not_disturb', 'offline'];
    if (!validStatuses.includes(status)) return;

    try {
        await pool.execute(
            `UPDATE users
             SET online_status = ?,
                 last_seen_at  = CASE WHEN ? = 'offline' THEN CURRENT_TIMESTAMP ELSE last_seen_at END,
                 updated_at    = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, status, userId]
        );
    } catch (dbError) {
        console.error('[PresenceHandler] DB update error:', dbError);
        return;
    }

    const friendIds = await getAcceptedFriendIds(userId);
    const presencePayload = {
        userId,
        onlineStatus: status,
        updatedAt:    new Date().toISOString(),
    };

    for (const friendId of friendIds) {
        const friendSocketId = userSocketMap.get(friendId);
        if (friendSocketId) {
            io.to(friendSocketId).emit('friend_presence_updated', presencePayload);
        }
    }
}

/**
 * Registers presence-related Socket.io event listeners on a socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 * @param {Map<number, string>}        userSocketMap
 */
function registerPresenceHandlers(socket, io, userSocketMap) {
    /**
     * Event: set_presence
     * Payload: { userId: number, status: 'online'|'idle'|'do_not_disturb'|'offline' }
     */
    socket.on('set_presence', async (payload) => {
        const { userId, status } = payload ?? {};

        if (typeof userId !== 'number' || userId <= 0) {
            socket.emit('error_event', { event: 'set_presence', message: 'Invalid payload: userId (number) is required.' });
            return;
        }

        const validStatuses = ['online', 'idle', 'do_not_disturb', 'offline'];
        if (!validStatuses.includes(status)) {
            socket.emit('error_event', { event: 'set_presence', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.` });
            return;
        }

        await broadcastPresenceChange(userId, status, io, userSocketMap);
        console.log(`[PresenceHandler] User ${userId} set presence to "${status}".`);
    });
}

module.exports = { registerPresenceHandlers, broadcastPresenceChange };
