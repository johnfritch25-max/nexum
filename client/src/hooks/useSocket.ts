/**
 * useSocket.ts
 * Manages the Socket.io client connection lifecycle.
 * Creates one socket per userId, authenticates on connect, cleans up on unmount.
 *
 * Uses state (not just a ref) for the socket instance so consumers re-render
 * once the socket is ready rather than receiving null on the first render.
 */

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getStoredToken } from '../api/auth';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export interface UseSocketReturn {
    socket: Socket | null;
    isConnected: boolean;
}

/**
 * @param userId  Authenticated user's DB id. Pass null to skip connecting.
 */
export function useSocket(userId: number | null): UseSocketReturn {
    const [socket, setSocket]           = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!userId) return;

        const token = getStoredToken();

        const newSocket = io(SERVER_URL, {
            transports:           ['websocket', 'polling'],
            reconnection:         true,
            reconnectionDelay:    1000,
            reconnectionAttempts: 10,
            // JWT passed as handshake auth — verified server-side before any event fires
            auth: { token: token ? `Bearer ${token}` : '' },
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
            console.log(`[Socket] Connected: ${newSocket.id}`);
        });

        newSocket.on('disconnect', (reason) => {
            setIsConnected(false);
            console.log(`[Socket] Disconnected: ${reason}`);
        });

        newSocket.on('connect_error', (err) => {
            console.error('[Socket] Connection error:', err.message);
        });

        newSocket.on('error_event', (payload: { event: string; message: string }) => {
            console.error(`[Socket] Server error on "${payload.event}":`, payload.message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            setSocket(null);
            setIsConnected(false);
        };
    }, [userId]);

    return { socket, isConnected };
}
