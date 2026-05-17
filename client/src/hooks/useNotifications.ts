/**
 * useNotifications.ts
 * - Updates browser tab title with unread count
 * - Fires desktop push notifications for new messages (when tab is not focused)
 */
import { useEffect, useRef } from 'react';

const BASE_TITLE = 'Nexum';

export function useNotifications(totalUnread: number, latestMessage?: { senderName: string; content: string; messageType: string }) {
    const permissionRef = useRef<NotificationPermission>('default');

    // Request permission once on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then((p) => { permissionRef.current = p; });
        } else if ('Notification' in window) {
            permissionRef.current = Notification.permission;
        }
    }, []);

    // Update tab title
    useEffect(() => {
        document.title = totalUnread > 0 ? `(${totalUnread}) ${BASE_TITLE}` : BASE_TITLE;
        return () => { document.title = BASE_TITLE; };
    }, [totalUnread]);

    // Desktop push notification
    useEffect(() => {
        if (!latestMessage) return;
        if (document.hasFocus()) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const body = latestMessage.messageType === 'image' ? '📷 Image' : latestMessage.content.slice(0, 80);
        const n = new Notification(latestMessage.senderName, { body, icon: '/favicon.ico', tag: 'nexum-msg' });
        n.onclick = () => { window.focus(); n.close(); };
    }, [latestMessage]);
}
