'use strict';

/**
 * communityHandler.js
 * Broadcasts community events to all connected clients.
 *
 * Events emitted to ALL sockets:
 *   community:new_post      — a new post was created
 *   community:delete_post   — a post was soft-deleted
 *   community:reaction      — a reaction was toggled
 *   community:new_comment   — a new comment was added
 *   community:delete_comment — a comment was soft-deleted
 */

function registerCommunityHandlers(socket, io) {
    // Join the shared community room on connect
    socket.join('community');

    socket.on('community:post_created', (post) => {
        io.to('community').emit('community:new_post', post);
    });

    socket.on('community:post_deleted', ({ postId }) => {
        io.to('community').emit('community:delete_post', { postId });
    });

    socket.on('community:reacted', ({ postId, reactions }) => {
        io.to('community').emit('community:reaction', { postId, reactions });
    });

    socket.on('community:comment_created', ({ postId, comment }) => {
        io.to('community').emit('community:new_comment', { postId, comment });
    });

    socket.on('community:comment_deleted', ({ postId, commentId }) => {
        io.to('community').emit('community:delete_comment', { postId, commentId });
    });
}

module.exports = { registerCommunityHandlers };
