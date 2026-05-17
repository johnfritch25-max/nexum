'use strict';

/**
 * webrtcHandler.js
 * WebRTC signaling relay over Socket.io.
 *
 * WebRTC peers cannot exchange SDP offers/answers or ICE candidates directly
 * until a data channel is open. This handler acts as the relay for that
 * initial handshake. Once the peer connection is established, all audio/video
 * data flows directly between clients (P2P) — the server is no longer involved.
 *
 * Signal flow:
 *
 *   Caller                    Server                   Callee
 *   ──────                    ──────                   ──────
 *   webrtc:call_user   ──►   relay to callee  ──►   webrtc:incoming_call
 *   webrtc:answer      ◄──   relay to caller  ◄──   webrtc:answer
 *   webrtc:ice_candidate ──► relay to peer    ──►   webrtc:ice_candidate
 *   webrtc:end_call    ──►   relay to peer    ──►   webrtc:call_ended
 */

/**
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 * @param {Map<number, string>}        userSocketMap  userId → socketId
 */
function registerWebRTCHandlers(socket, io, userSocketMap) {
    const callerId = socket.data.userId;

    // ── webrtc:call_user ─────────────────────────────────────────────────────
    /**
     * Initiates a call to another user.
     * Payload: { targetUserId: number, offer: RTCSessionDescriptionInit }
     */
    socket.on('webrtc:call_user', ({ targetUserId, offer, callType } = {}) => {
        if (typeof targetUserId !== 'number' || !offer) {
            socket.emit('error_event', {
                event:   'webrtc:call_user',
                message: 'targetUserId (number) and offer (RTCSessionDescriptionInit) are required.',
            });
            return;
        }

        if (targetUserId === callerId) {
            socket.emit('error_event', {
                event:   'webrtc:call_user',
                message: 'You cannot call yourself.',
            });
            return;
        }

        const targetSocketId = userSocketMap.get(targetUserId);
        if (!targetSocketId) {
            socket.emit('webrtc:user_unavailable', { targetUserId });
            return;
        }

        const resolvedCallType = callType === 'voice' ? 'voice' : 'video';

        io.to(targetSocketId).emit('webrtc:incoming_call', {
            callerId,
            offer,
            callType: resolvedCallType,
        });

        console.log(`[WebRTC] User ${callerId} calling user ${targetUserId} (${resolvedCallType})`);
    });

    // ── webrtc:answer ────────────────────────────────────────────────────────
    /**
     * Sends the callee's SDP answer back to the caller.
     * Payload: { callerId: number, answer: RTCSessionDescriptionInit }
     */
    socket.on('webrtc:answer', ({ callerId: targetCallerId, answer } = {}) => {
        if (typeof targetCallerId !== 'number' || !answer) {
            socket.emit('error_event', {
                event:   'webrtc:answer',
                message: 'callerId (number) and answer (RTCSessionDescriptionInit) are required.',
            });
            return;
        }

        const callerSocketId = userSocketMap.get(targetCallerId);
        if (!callerSocketId) {
            socket.emit('webrtc:user_unavailable', { targetUserId: targetCallerId });
            return;
        }

        io.to(callerSocketId).emit('webrtc:answer', {
            answererId: callerId,
            answer,
        });

        console.log(`[WebRTC] User ${callerId} answered call from user ${targetCallerId}`);
    });

    // ── webrtc:ice_candidate ─────────────────────────────────────────────────
    /**
     * Relays an ICE candidate to the remote peer.
     * Payload: { targetUserId: number, candidate: RTCIceCandidateInit }
     */
    socket.on('webrtc:ice_candidate', ({ targetUserId, candidate } = {}) => {
        if (typeof targetUserId !== 'number' || !candidate) {
            socket.emit('error_event', {
                event:   'webrtc:ice_candidate',
                message: 'targetUserId (number) and candidate (RTCIceCandidateInit) are required.',
            });
            return;
        }

        const targetSocketId = userSocketMap.get(targetUserId);
        if (!targetSocketId) return; // Peer disconnected — silently drop

        io.to(targetSocketId).emit('webrtc:ice_candidate', {
            fromUserId: callerId,
            candidate,
        });
    });

    // ── webrtc:end_call ──────────────────────────────────────────────────────
    /**
     * Notifies the remote peer that the call has ended.
     * Payload: { targetUserId: number }
     */
    socket.on('webrtc:end_call', ({ targetUserId } = {}) => {
        if (typeof targetUserId !== 'number') return;

        const targetSocketId = userSocketMap.get(targetUserId);
        if (!targetSocketId) return;

        io.to(targetSocketId).emit('webrtc:call_ended', { fromUserId: callerId });
        console.log(`[WebRTC] User ${callerId} ended call with user ${targetUserId}`);
    });

    // ── webrtc:reject_call ───────────────────────────────────────────────────
    /**
     * Notifies the caller that the callee rejected the call.
     * Payload: { callerId: number }
     */
    socket.on('webrtc:reject_call', ({ callerId: targetCallerId } = {}) => {
        if (typeof targetCallerId !== 'number') return;

        const callerSocketId = userSocketMap.get(targetCallerId);
        if (!callerSocketId) return;

        io.to(callerSocketId).emit('webrtc:call_rejected', { rejectedBy: callerId });
        console.log(`[WebRTC] User ${callerId} rejected call from user ${targetCallerId}`);
    });
}

module.exports = { registerWebRTCHandlers };
