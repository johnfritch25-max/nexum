/**
 * useToastNotifications.ts
 *
 * Manages a queue of in-app toast notifications.
 * Supports three types:
 *   - message:       Someone sent you a message
 *   - friend_request: Someone added you as a friend
 *   - reaction:      Someone reacted to your post
 */

import { useState, useCallback, useRef } from 'react';

export type ToastType = 'message' | 'friend_request' | 'reaction';

export interface Toast {
    id:        string;
    type:      ToastType;
    title:     string;
    body:      string;
    avatar?:   string;   // first letter of sender name
    createdAt: number;
}

const MAX_TOASTS  = 4;
const AUTO_DISMISS = 5000; // ms

export interface UseToastNotificationsReturn {
    toasts:       Toast[];
    addToast:     (type: ToastType, title: string, body: string, avatar?: string) => void;
    dismissToast: (id: string) => void;
}

export function useToastNotifications(): UseToastNotificationsReturn {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = timersRef.current.get(id);
        if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
    }, []);

    const addToast = useCallback((type: ToastType, title: string, body: string, avatar?: string) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const toast: Toast = { id, type, title, body, avatar, createdAt: Date.now() };

        setToasts((prev) => {
            const next = [toast, ...prev];
            // Keep only the latest MAX_TOASTS
            return next.slice(0, MAX_TOASTS);
        });

        // Auto-dismiss
        const timer = setTimeout(() => dismissToast(id), AUTO_DISMISS);
        timersRef.current.set(id, timer);
    }, [dismissToast]);

    return { toasts, addToast, dismissToast };
}
