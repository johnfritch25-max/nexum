'use strict';

/**
 * messageHandler.js
 * Handles send_message, send_image, and join_room Socket.io events.
 *
 * Security: senderId in the payload is IGNORED. The authenticated userId
 * from the JWT (socket.data.userId) is always used as the sender, preventing
 * a client from spoofing messages as another user.
 */

const { pool } = require('../db');
const { sanitizeMessageContent } = require('../middleware/sanitize');

// Max image size: 5 MB expressed as a base64 string (~6.8 MB base64)
const MAX_IMAGE_B64_LENGTH = 7_000_000;

/**
 * Builds a deterministic room ID from two user IDs.
 * Always places the lower ID first so both users resolve to the same string.
 */
function buildRoomId(idA, idB) {
    return idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
}

/**
 * Verifies that two users are accepted friends.
 * Prevents messaging strangers or blocked users.
 *
 * @param {number} userA
 * @param {number} userB
 * @returns {Promise<boolean>}
 */
async function areAcceptedFriends(userA, userB) {
    const [uid1, uid2] = userA < userB ? [userA, userB] : [userB, userA];
    const [rows] = await pool.execute(
        `SELECT id FROM friends
         WHERE user_id_1 = ? AND user_id_2 = ? AND status = 'accepted'
         LIMIT 1`,
        [uid1, uid2]
    );
    return rows.length > 0;
}

/**
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
function registerMessageHandlers(socket, io) {
    // The authenticated sender — always from the verified JWT, never from payload
    const authenticatedSenderId = socket.data.userId;

    /**
     * Event: send_message
     * Payload: { receiverId: number, content: string }
     *
     * Note: senderId is intentionally NOT read from the payload.
     */
    socket.on('send_message', async (payload) => {
        const { receiverId, content } = payload ?? {};

        if (typeof receiverId !== 'number' || receiverId <= 0) {
            socket.emit('error_event', {
                event:   'send_message',
                message: 'receiverId (number) is required.',
            });
            return;
        }

        if (typeof content !== 'string' || content.trim().length === 0) {
            socket.emit('error_event', {
                event:   'send_message',
                message: 'content must be a non-empty string.',
            });
            return;
        }

        if (content.length > 4000) {
            socket.emit('error_event', {
                event:   'send_message',
                message: 'Message content exceeds the 4000-character limit.',
            });
            return;
        }

        if (receiverId === authenticatedSenderId) {
            socket.emit('error_event', {
                event:   'send_message',
                message: 'You cannot send a message to yourself.',
            });
            return;
        }

        // Verify friendship before allowing the message
        let friends;
        try {
            friends = await areAcceptedFriends(authenticatedSenderId, receiverId);
        } catch (err) {
            console.error('[MessageHandler] Friend check error:', err);
            socket.emit('error_event', { event: 'send_message', message: 'Server error.' });
            return;
        }

        if (!friends) {
            socket.emit('error_event', {
                event:   'send_message',
                message: 'You can only message accepted friends.',
            });
            return;
        }

        const sanitizedContent = sanitizeMessageContent(content);
        const roomId           = buildRoomId(authenticatedSenderId, receiverId);

        let insertedId;
        try {
            const [result] = await pool.execute(
                `INSERT INTO messages (sender_id, receiver_id, room_id, content, message_type)
                 VALUES (?, ?, ?, ?, 'text')`,
                [authenticatedSenderId, receiverId, roomId, sanitizedContent]
            );
            insertedId = result.insertId;
        } catch (dbError) {
            console.error('[MessageHandler] DB insert error:', dbError);
            socket.emit('error_event', {
                event:   'send_message',
                message: 'Failed to persist message. Please try again.',
            });
            return;
        }

        const outboundMessage = {
            id:          insertedId,
            roomId,
            senderId:    authenticatedSenderId,
            receiverId,
            content:     sanitizedContent,
            messageType: 'text',
            isEdited:    false,
            isDeleted:   false,
            readAt:      null,
            createdAt:   new Date().toISOString(),
        };

        io.to(roomId).emit('receive_message', outboundMessage);
    });

    /**
     * Event: send_image
     * Payload: { receiverId: number, dataUrl: string, mimeType: string }
     *
     * dataUrl is a base64-encoded data URL (e.g. "data:image/jpeg;base64,...")
     * Stored directly in the messages table with message_type = 'image'.
     * Max size: 5 MB (original file) — enforced via base64 string length.
     */
    socket.on('send_image', async (payload) => {
        const { receiverId, dataUrl, mimeType } = payload ?? {};

        if (typeof receiverId !== 'number' || receiverId <= 0) {
            socket.emit('error_event', {
                event:   'send_image',
                message: 'receiverId (number) is required.',
            });
            return;
        }

        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
            socket.emit('error_event', {
                event:   'send_image',
                message: 'dataUrl must be a valid image data URL.',
            });
            return;
        }

        // Validate MIME type — only allow common image formats
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const resolvedMime = typeof mimeType === 'string' ? mimeType : '';
        if (!allowedMimes.includes(resolvedMime)) {
            socket.emit('error_event', {
                event:   'send_image',
                message: 'Only JPEG, PNG, GIF, and WebP images are supported.',
            });
            return;
        }

        if (dataUrl.length > MAX_IMAGE_B64_LENGTH) {
            socket.emit('error_event', {
                event:   'send_image',
                message: 'Image exceeds the 5 MB size limit.',
            });
            return;
        }

        if (receiverId === authenticatedSenderId) {
            socket.emit('error_event', {
                event:   'send_image',
                message: 'You cannot send an image to yourself.',
            });
            return;
        }

        let friends;
        try {
            friends = await areAcceptedFriends(authenticatedSenderId, receiverId);
        } catch (err) {
            console.error('[MessageHandler] Friend check error (image):', err);
            socket.emit('error_event', { event: 'send_image', message: 'Server error.' });
            return;
        }

        if (!friends) {
            socket.emit('error_event', {
                event:   'send_image',
                message: 'You can only send images to accepted friends.',
            });
            return;
        }

        const roomId = buildRoomId(authenticatedSenderId, receiverId);

        let insertedId;
        try {
            const [result] = await pool.execute(
                `INSERT INTO messages (sender_id, receiver_id, room_id, content, message_type)
                 VALUES (?, ?, ?, ?, 'image')`,
                [authenticatedSenderId, receiverId, roomId, dataUrl]
            );
            insertedId = result.insertId;
        } catch (dbError) {
            console.error('[MessageHandler] DB insert error (image):', dbError);
            socket.emit('error_event', {
                event:   'send_image',
                message: 'Failed to persist image. Please try again.',
            });
            return;
        }

        const outboundMessage = {
            id:          insertedId,
            roomId,
            senderId:    authenticatedSenderId,
            receiverId,
            content:     dataUrl,
            messageType: 'image',
            isEdited:    false,
            isDeleted:   false,
            readAt:      null,
            createdAt:   new Date().toISOString(),
        };

        io.to(roomId).emit('receive_message', outboundMessage);
    });

    /**
     * Event: typing_start
     * Payload: { receiverId: number }
     * Broadcasts to the other participant that this user is typing.
     */
    socket.on('typing_start', ({ receiverId } = {}) => {
        if (typeof receiverId !== 'number' || receiverId <= 0) return;
        const roomId = buildRoomId(authenticatedSenderId, receiverId);
        socket.to(roomId).emit('friend_typing', { userId: authenticatedSenderId, isTyping: true });
    });

    /**
     * Event: typing_stop
     * Payload: { receiverId: number }
     */
    socket.on('typing_stop', ({ receiverId } = {}) => {
        if (typeof receiverId !== 'number' || receiverId <= 0) return;
        const roomId = buildRoomId(authenticatedSenderId, receiverId);
        socket.to(roomId).emit('friend_typing', { userId: authenticatedSenderId, isTyping: false });
    });

    /**
     * Event: join_room
     * Payload: { receiverId: number }
     *
     * The authenticated user's ID is used as one side of the room.
     * The client only needs to supply the other participant's ID.
     */
    socket.on('join_room', ({ receiverId } = {}) => {
        if (typeof receiverId !== 'number' || receiverId <= 0) {
            socket.emit('error_event', {
                event:   'join_room',
                message: 'receiverId (number) is required.',
            });
            return;
        }

        const roomId = buildRoomId(authenticatedSenderId, receiverId);
        socket.join(roomId);
        console.log(`[MessageHandler] User ${authenticatedSenderId} joined room ${roomId}`);
        socket.emit('room_joined', { roomId });
    });
}

module.exports = { registerMessageHandlers, buildRoomId };
