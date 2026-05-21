/**
 * useWebRTC.ts
 * Manages a WebRTC peer-to-peer audio/video call session.
 *
 * Signaling is relayed through the Socket.io server (webrtcHandler.js).
 * Once the peer connection is established, all media flows directly P2P.
 *
 * Usage:
 *   const call = useWebRTC(socket, userId);
 *   call.startCall(friendId);   // initiate
 *   call.acceptCall();          // answer incoming
 *   call.rejectCall();          // decline incoming
 *   call.endCall();             // hang up
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CallStatus =
    | 'idle'
    | 'calling'       // we initiated, waiting for answer
    | 'incoming'      // we received an offer, not yet answered
    | 'connected'     // peer connection established
    | 'ended';        // call finished or rejected

export type CallType = 'video' | 'voice';

export interface UseWebRTCReturn {
    callStatus:         CallStatus;
    callType:           CallType;
    localStream:        MediaStream | null;
    remoteStream:       MediaStream | null;
    incomingCallFrom:   number | null;   // userId of the caller when status === 'incoming'
    startCall:          (targetUserId: number, type?: CallType) => Promise<void>;
    acceptCall:         () => Promise<void>;
    rejectCall:         () => void;
    endCall:            () => void;
    toggleMute:         () => void;
    toggleCamera:       () => void;
    toggleScreenShare:  () => Promise<void>;
    isMuted:            boolean;
    isCameraOff:        boolean;
    isScreenSharing:    boolean;
}

// ── STUN servers (public Google STUN — replace with TURN for production) ──────
const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRTC(
    socket: Socket | null,
    userId: number | null
): UseWebRTCReturn {
    const [callStatus,       setCallStatus]       = useState<CallStatus>('idle');
    const [callType,         setCallType]         = useState<CallType>('video');
    const [localStream,      setLocalStream]      = useState<MediaStream | null>(null);
    const [remoteStream,     setRemoteStream]     = useState<MediaStream | null>(null);
    const [incomingCallFrom, setIncomingCallFrom] = useState<number | null>(null);
    const [isMuted,          setIsMuted]          = useState(false);
    const [isCameraOff,      setIsCameraOff]      = useState(false);
    const [isScreenSharing,  setIsScreenSharing]  = useState(false);

    const peerConnectionRef   = useRef<RTCPeerConnection | null>(null);
    const localStreamRef      = useRef<MediaStream | null>(null);
    const screenStreamRef     = useRef<MediaStream | null>(null);
    const pendingOfferRef   = useRef<RTCSessionDescriptionInit | null>(null);
    const remoteUserIdRef   = useRef<number | null>(null);
    const callTypeRef       = useRef<CallType>('video');

    // ── Cleanup helper ────────────────────────────────────────────────────────
    const cleanup = useCallback(() => {
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;

        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;

        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;

        setLocalStream(null);
        setRemoteStream(null);
        setIncomingCallFrom(null);
        setIsMuted(false);
        setIsCameraOff(false);
        setIsScreenSharing(false);
        pendingOfferRef.current  = null;
        remoteUserIdRef.current  = null;
        callTypeRef.current      = 'video';
    }, []);

    // ── Create RTCPeerConnection ──────────────────────────────────────────────
    const createPeerConnection = useCallback((targetUserId: number): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        remoteUserIdRef.current = targetUserId;

        // Send ICE candidates to the remote peer via the signaling server
        pc.onicecandidate = ({ candidate }) => {
            if (candidate && socket) {
                socket.emit('webrtc:ice_candidate', { targetUserId, candidate });
            }
        };

        // Receive remote media tracks
        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0] ?? null);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                setCallStatus('connected');
            }
            if (
                pc.connectionState === 'disconnected' ||
                pc.connectionState === 'failed' ||
                pc.connectionState === 'closed'
            ) {
                cleanup();
                setCallStatus('ended');
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    }, [socket, cleanup]);

    // ── Acquire local media ───────────────────────────────────────────────────
    const getLocalMedia = useCallback(async (type: CallType): Promise<MediaStream> => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === 'video',
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
    }, []);

    // ── Initiate a call ───────────────────────────────────────────────────────
    const startCall = useCallback(async (targetUserId: number, type: CallType = 'video') => {
        if (!socket || !userId) return;
        if (callStatus !== 'idle') return;

        callTypeRef.current = type;
        setCallType(type);
        setCallStatus('calling');

        try {
            const stream = await getLocalMedia(type);
            const pc     = createPeerConnection(targetUserId);

            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket.emit('webrtc:call_user', { targetUserId, offer, callType: type });
        } catch (err) {
            console.error('[WebRTC] startCall error:', err);
            cleanup();
            setCallStatus('idle');
        }
    }, [socket, userId, callStatus, getLocalMedia, createPeerConnection, cleanup]);

    // ── Accept an incoming call ───────────────────────────────────────────────
    const acceptCall = useCallback(async () => {
        if (!socket || !incomingCallFrom || !pendingOfferRef.current) return;

        setCallStatus('connected');

        try {
            const stream = await getLocalMedia(callTypeRef.current);
            const pc     = createPeerConnection(incomingCallFrom);

            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit('webrtc:answer', { callerId: incomingCallFrom, answer });
        } catch (err) {
            console.error('[WebRTC] acceptCall error:', err);
            cleanup();
            setCallStatus('idle');
        }
    }, [socket, incomingCallFrom, getLocalMedia, createPeerConnection, cleanup]);

    // ── Reject an incoming call ───────────────────────────────────────────────
    const rejectCall = useCallback(() => {
        if (!socket || !incomingCallFrom) return;
        socket.emit('webrtc:reject_call', { callerId: incomingCallFrom });
        cleanup();
        setCallStatus('idle');
    }, [socket, incomingCallFrom, cleanup]);

    // ── End an active call ────────────────────────────────────────────────────
    const endCall = useCallback(() => {
        if (!socket || !remoteUserIdRef.current) return;
        socket.emit('webrtc:end_call', { targetUserId: remoteUserIdRef.current });
        cleanup();
        setCallStatus('ended');
        // Reset to idle after a brief moment so the UI can show "call ended"
        setTimeout(() => setCallStatus('idle'), 2000);
    }, [socket, cleanup]);

    // ── Toggle mute ───────────────────────────────────────────────────────────
    const toggleMute = useCallback(() => {
        if (!localStreamRef.current) return;
        localStreamRef.current.getAudioTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setIsMuted((prev) => !prev);
    }, []);

    // ── Toggle camera ─────────────────────────────────────────────────────────
    const toggleCamera = useCallback(() => {
        if (!localStreamRef.current) return;
        localStreamRef.current.getVideoTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setIsCameraOff((prev) => !prev);
    }, []);

    // ── Toggle screen share (game stream) ─────────────────────────────────────
    const toggleScreenShare = useCallback(async () => {
        const pc = peerConnectionRef.current;

        // ── Stop screen share ──────────────────────────────────────────────
        if (isScreenSharing) {
            screenStreamRef.current?.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;

            // Restore camera track in the peer connection
            const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
            if (pc && camTrack) {
                const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(camTrack);
            }

            // Restore camera track in local preview stream
            if (localStreamRef.current) {
                const audioTracks = localStreamRef.current.getAudioTracks();
                const camStream = new MediaStream([...audioTracks, ...(camTrack ? [camTrack] : [])]);
                setLocalStream(camStream);
            }

            setIsScreenSharing(false);
            return;
        }

        // ── Start screen share ─────────────────────────────────────────────
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: { ideal: 30, max: 60 } },
                audio: true,   // capture system audio if browser supports it
            });
            screenStreamRef.current = screenStream;

            const screenVideoTrack = screenStream.getVideoTracks()[0];

            // Replace video track in the peer connection so remote sees the screen
            if (pc) {
                const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(screenVideoTrack);
                } else {
                    // Voice call — add the screen track
                    pc.addTrack(screenVideoTrack, screenStream);
                }
            }

            // Show screen in local preview
            const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
            const previewStream = new MediaStream([...audioTracks, screenVideoTrack]);
            setLocalStream(previewStream);
            setIsScreenSharing(true);

            // When user clicks "Stop sharing" in the browser's native bar
            screenVideoTrack.onended = () => {
                screenStreamRef.current?.getTracks().forEach((t) => t.stop());
                screenStreamRef.current = null;

                const camTrack2 = localStreamRef.current?.getVideoTracks()[0] ?? null;
                if (pc && camTrack2) {
                    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(camTrack2).catch(() => {});
                }
                if (localStreamRef.current) {
                    const audio = localStreamRef.current.getAudioTracks();
                    setLocalStream(new MediaStream([...audio, ...(camTrack2 ? [camTrack2] : [])]));
                }
                setIsScreenSharing(false);
            };
        } catch (err: unknown) {
            // User cancelled the picker — not an error
            if (err instanceof Error && err.name !== 'NotAllowedError') {
                console.error('[WebRTC] getDisplayMedia error:', err);
            }
        }
    }, [isScreenSharing]);

    // ── Socket event listeners ────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        // Incoming call from another user
        const onIncomingCall = ({ callerId, offer, callType: incomingType }: {
            callerId: number;
            offer: RTCSessionDescriptionInit;
            callType?: CallType;
        }) => {
            if (callStatus !== 'idle') {
                // Already in a call — auto-reject
                socket.emit('webrtc:reject_call', { callerId });
                return;
            }
            const resolvedType: CallType = incomingType === 'voice' ? 'voice' : 'video';
            callTypeRef.current      = resolvedType;
            setCallType(resolvedType);
            pendingOfferRef.current  = offer;
            setIncomingCallFrom(callerId);
            setCallStatus('incoming');
        };

        // Remote peer answered our call
        const onAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
            const pc = peerConnectionRef.current;
            if (!pc) return;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
                console.error('[WebRTC] setRemoteDescription error:', err);
            }
        };

        // ICE candidate from remote peer
        const onIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
            const pc = peerConnectionRef.current;
            if (!pc || !candidate) return;
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error('[WebRTC] addIceCandidate error:', err);
            }
        };

        // Remote peer ended the call
        const onCallEnded = () => {
            cleanup();
            setCallStatus('ended');
            setTimeout(() => setCallStatus('idle'), 2000);
        };

        // Remote peer rejected our call
        const onCallRejected = () => {
            cleanup();
            setCallStatus('ended');
            setTimeout(() => setCallStatus('idle'), 2000);
        };

        // Remote peer is unavailable (not connected)
        const onUserUnavailable = () => {
            cleanup();
            setCallStatus('idle');
        };

        socket.on('webrtc:incoming_call',   onIncomingCall);
        socket.on('webrtc:answer',          onAnswer);
        socket.on('webrtc:ice_candidate',   onIceCandidate);
        socket.on('webrtc:call_ended',      onCallEnded);
        socket.on('webrtc:call_rejected',   onCallRejected);
        socket.on('webrtc:user_unavailable', onUserUnavailable);

        return () => {
            socket.off('webrtc:incoming_call',   onIncomingCall);
            socket.off('webrtc:answer',          onAnswer);
            socket.off('webrtc:ice_candidate',   onIceCandidate);
            socket.off('webrtc:call_ended',      onCallEnded);
            socket.off('webrtc:call_rejected',   onCallRejected);
            socket.off('webrtc:user_unavailable', onUserUnavailable);
        };
    }, [socket, callStatus, cleanup]);

    // Cleanup on unmount
    useEffect(() => () => cleanup(), [cleanup]);

    return {
        callStatus,
        callType,
        localStream,
        remoteStream,
        incomingCallFrom,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
        isMuted,
        isCameraOff,
        isScreenSharing,
    };
}
