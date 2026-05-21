'use strict';
/**
 * groupHandler.js — Socket.io handler for group chat messages
 */
const { pool } = require('../db');
const { sanitizeMessageContent } = require('../middleware/sanitize');

function registerGroupHandlers(socket, io) {
    const senderId = socket.data.userId;

    // join_group — join the socket room for a group
    socket.on('join_group', ({ groupId } = {}) => {
        if (typeof groupId !== 'number') return;
        socket.join(`group_${groupId}`);
    });

    // leave_group — leave the socket room for a group
    socket.on('leave_group', ({ groupId } = {}) => {
        if (typeof groupId !== 'number') return;
        socket.leave(`group_${groupId}`);
    });

    // notify_group_update — tell a specific user their group list changed
    socket.on('group_member_added', async ({ groupId, targetUserId } = {}) => {
        if (typeof groupId !== 'number' || typeof targetUserId !== 'number') return;
        const { getIo, getUserSocketMap } = require('../socketState');
        const io = getIo();
        const userSocketMap = getUserSocketMap();
        if (io && userSocketMap) {
            const targetSocketId = userSocketMap.get(targetUserId);
            if (targetSocketId) io.to(targetSocketId).emit('group_updated', { groupId });
        }
        io && io.to(`group_${groupId}`).emit('group_updated', { groupId });
    });

    // send_group_message
    socket.on('send_group_message', async ({ groupId, content } = {}) => {
        if (typeof groupId !== 'number' || typeof content !== 'string' || !content.trim()) return;
        if (content.length > 4000) { socket.emit('error_event', { event: 'send_group_message', message: 'Too long.' }); return; }
        try {
            const [[member]] = await pool.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, senderId]);
            if (!member) { socket.emit('error_event', { event: 'send_group_message', message: 'Not a member.' }); return; }
            const sanitized = sanitizeMessageContent(content);
            const [result] = await pool.execute('INSERT INTO group_messages (group_id, sender_id, content) VALUES (?, ?, ?)', [groupId, senderId, sanitized]);
            const [[msg]] = await pool.execute(
                `SELECT gm.id, gm.group_id, gm.sender_id, gm.content, gm.message_type, gm.is_deleted, gm.created_at,
                        u.display_name AS sender_name, u.username AS sender_username
                 FROM group_messages gm JOIN users u ON u.id = gm.sender_id WHERE gm.id = ?`,
                [result.insertId]
            );
            io.to(`group_${groupId}`).emit('group_message', msg);
        } catch (e) { console.error('[GroupHandler]', e); }
    });

    // send_group_image
    socket.on('send_group_image', async ({ groupId, dataUrl, mimeType } = {}) => {
        if (typeof groupId !== 'number' || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return;
        if (dataUrl.length > 7_000_000) { socket.emit('error_event', { event: 'send_group_image', message: 'Image too large.' }); return; }
        try {
            const [[member]] = await pool.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, senderId]);
            if (!member) return;
            const [result] = await pool.execute('INSERT INTO group_messages (group_id, sender_id, content, message_type) VALUES (?, ?, ?, "image")', [groupId, senderId, dataUrl]);
            const [[msg]] = await pool.execute(
                `SELECT gm.id, gm.group_id, gm.sender_id, gm.content, gm.message_type, gm.is_deleted, gm.created_at,
                        u.display_name AS sender_name, u.username AS sender_username
                 FROM group_messages gm JOIN users u ON u.id = gm.sender_id WHERE gm.id = ?`,
                [result.insertId]
            );
            io.to(`group_${groupId}`).emit('group_message', msg);
        } catch (e) { console.error('[GroupHandler] image:', e); }
    });
}

module.exports = { registerGroupHandlers };
