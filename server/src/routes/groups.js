'use strict';
/**
 * groups.js — Group chat REST routes
 * POST   /groups                    — create a group
 * GET    /groups                    — list my groups
 * POST   /groups/:id/members        — add a member
 * DELETE /groups/:id/members/:uid   — remove a member (or leave)
 * GET    /groups/:id/messages       — paginated message history
 */
const express      = require('express');
const authenticate = require('../middleware/authenticate');
const { pool }     = require('../db');
const { getIo, getUserSocketMap } = require('../socketState');
const router       = express.Router();
router.use(authenticate);

// POST /groups
router.post('/', async (req, res) => {
    const userId = Number(req.user.sub);
    const { name, memberIds = [] } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100)
        return res.status(400).json({ error: 'name must be 1–100 characters.' });
    const uniqueIds = [...new Set([userId, ...memberIds.map(Number).filter(Boolean)])];
    try {
        const [r] = await pool.execute('INSERT INTO group_chats (name, created_by) VALUES (?, ?)', [name.trim(), userId]);
        const gid = r.insertId;
        for (const uid of uniqueIds)
            await pool.execute('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [gid, uid]);
        const [[group]] = await pool.execute('SELECT id, name, created_by, created_at FROM group_chats WHERE id = ?', [gid]);
        return res.status(201).json({ group });
    } catch (e) { console.error('[Groups] create:', e); return res.status(500).json({ error: 'Internal server error.' }); }
});

// GET /groups
router.get('/', async (req, res) => {
    const userId = Number(req.user.sub);
    try {
        const [rows] = await pool.execute(
            `SELECT g.id, g.name, g.created_by, g.created_at,
                    (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count,
                    (SELECT content FROM group_messages WHERE group_id = g.id AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1) AS last_message,
                    (SELECT created_at FROM group_messages WHERE group_id = g.id AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1) AS last_message_at
             FROM group_chats g
             JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
             ORDER BY last_message_at DESC, g.created_at DESC`,
            [userId]
        );
        return res.json({ groups: rows });
    } catch (e) { console.error('[Groups] list:', e); return res.status(500).json({ error: 'Internal server error.' }); }
});

// GET /groups/:id/members
router.get('/:id/members', async (req, res) => {
    const userId  = Number(req.user.sub);
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid group id.' });
    try {
        const [[me]] = await pool.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, userId]);
        if (!me) return res.status(403).json({ error: 'Not a member.' });
        const [rows] = await pool.execute(
            `SELECT u.id, u.username, u.display_name, u.online_status FROM group_members gm
             JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ? ORDER BY u.display_name ASC`,
            [groupId]
        );
        return res.json({ members: rows });
    } catch (e) { console.error('[Groups] members:', e); return res.status(500).json({ error: 'Internal server error.' }); }
});

// POST /groups/:id/members
router.post('/:id/members', async (req, res) => {
    const userId  = Number(req.user.sub);
    const groupId = parseInt(req.params.id, 10);
    const { userId: targetId } = req.body ?? {};
    if (isNaN(groupId) || !targetId) return res.status(400).json({ error: 'Invalid params.' });
    try {
        const [[me]] = await pool.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, userId]);
        if (!me) return res.status(403).json({ error: 'Not a member.' });
        await pool.execute('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, Number(targetId)]);

        // Notify all group members (including the new one) to refresh their group list
        const io = getIo();
        const userSocketMap = getUserSocketMap();
        if (io) {
            // Notify the newly added user directly
            if (userSocketMap) {
                const newMemberSocketId = userSocketMap.get(Number(targetId));
                if (newMemberSocketId) {
                    io.to(newMemberSocketId).emit('group_updated', { groupId });
                }
            }
            // Notify existing group members
            io.to(`group_${groupId}`).emit('group_updated', { groupId });
        }

        return res.json({ message: 'Member added.' });
    } catch (e) { console.error('[Groups] add member:', e); return res.status(500).json({ error: 'Internal server error.' }); }
});
// DELETE /groups/:id/members/:uid
router.delete('/:id/members/:uid', async (req, res) => {
    const userId  = Number(req.user.sub);
    const groupId = parseInt(req.params.id, 10);
    const targetId = parseInt(req.params.uid, 10);
    if (isNaN(groupId) || isNaN(targetId)) return res.status(400).json({ error: 'Invalid params.' });
    // Can remove yourself (leave) or remove others if you're the creator
    try {
        const [[group]] = await pool.execute('SELECT created_by FROM group_chats WHERE id = ? LIMIT 1', [groupId]);
        if (!group) return res.status(404).json({ error: 'Group not found.' });
        if (targetId !== userId && Number(group.created_by) !== userId)
            return res.status(403).json({ error: 'Only the group creator can remove others.' });
        await pool.execute('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, targetId]);
        return res.json({ message: 'Member removed.' });
    } catch (e) { console.error('[Groups] remove member:', e); return res.status(500).json({ error: 'Internal server error.' }); }
});

// GET /groups/:id/messages
router.get('/:id/messages', async (req, res) => {
    const userId  = Number(req.user.sub);
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid group id.' });
    const limit  = Math.min(Math.max(parseInt(req.query.limit ?? '50', 10), 1), 100);
    const before = req.query.before;
    try {
        const [[me]] = await pool.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, userId]);
        if (!me) return res.status(403).json({ error: 'Not a member.' });
        let rows;
        if (before) {
            const d = new Date(before);
            if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid before.' });
            [rows] = await pool.query(
                `SELECT gm.id, gm.group_id, gm.sender_id, gm.content, gm.message_type, gm.is_deleted, gm.created_at,
                        u.display_name AS sender_name, u.username AS sender_username
                 FROM group_messages gm JOIN users u ON u.id = gm.sender_id
                 WHERE gm.group_id = ? AND gm.is_deleted = 0 AND gm.created_at < ?
                 ORDER BY gm.created_at DESC LIMIT ${limit}`,
                [groupId, d]
            );
        } else {
            [rows] = await pool.query(
                `SELECT gm.id, gm.group_id, gm.sender_id, gm.content, gm.message_type, gm.is_deleted, gm.created_at,
                        u.display_name AS sender_name, u.username AS sender_username
                 FROM group_messages gm JOIN users u ON u.id = gm.sender_id
                 WHERE gm.group_id = ? AND gm.is_deleted = 0
                 ORDER BY gm.created_at DESC LIMIT ${limit}`,
                [groupId]
            );
        }
        // Fix: capture cursor BEFORE reversing (oldest message = last in DESC order = first before reverse)
        const hasMore = rows.length === limit;
        const nextCursor = hasMore ? rows[rows.length - 1].created_at : null;
        return res.json({ messages: rows.reverse(), hasMore, nextCursor });
    } catch (e) { console.error('[Groups] messages:', e); return res.status(500).json({ error: 'Internal server error.' }); }
});

module.exports = router;
