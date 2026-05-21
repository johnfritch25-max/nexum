/**
 * ToastNotification.tsx
 *
 * Renders a stack of in-app toast notifications in the top-right corner.
 * Each toast slides in, auto-dismisses after 5s, and has a progress bar.
 */

import React, { useEffect, useState } from 'react';
import type { Toast, ToastType } from '../hooks/useToastNotifications';

interface ToastContainerProps {
    toasts:       Toast[];
    onDismiss:    (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;

    return (
        <div
            aria-live="polite"
            aria-label="Notifications"
            className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-[340px] max-w-[calc(100vw-2rem)]"
        >
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

const AUTO_DISMISS = 5000;

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
    const [progress, setProgress] = useState(100);
    const [visible,  setVisible]  = useState(false);

    // Slide in
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(t);
    }, []);

    // Progress bar countdown
    useEffect(() => {
        const start = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const pct = Math.max(0, 100 - (elapsed / AUTO_DISMISS) * 100);
            setProgress(pct);
            if (pct === 0) clearInterval(interval);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    const { icon, accent, bg } = typeStyles(toast.type);

    return (
        <div
            role="alert"
            className={[
                'pointer-events-auto relative overflow-hidden rounded-2xl shadow-2xl border transition-all duration-300',
                bg, 'border-zinc-700/60',
                visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8',
            ].join(' ')}
        >
            {/* Progress bar */}
            <div
                className={`absolute top-0 left-0 h-0.5 transition-[width] duration-[50ms] ${accent}`}
                style={{ width: `${progress}%` }}
            />

            <div className="flex items-start gap-3 px-4 py-3">
                {/* Icon / Avatar */}
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg shrink-0 font-bold ${accent.replace('bg-', 'bg-').replace('-500', '-950/60')} border border-zinc-700/40`}>
                    {toast.avatar
                        ? <span className="text-sm text-white">{toast.avatar}</span>
                        : <span>{icon}</span>
                    }
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-xs font-semibold text-white leading-tight truncate">{toast.title}</p>
                    <p className="text-xs text-zinc-400 leading-snug mt-0.5 line-clamp-2">{toast.body}</p>
                </div>

                {/* Close */}
                <button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    aria-label="Dismiss notification"
                    className="shrink-0 h-6 w-6 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors mt-0.5"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                        <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

function typeStyles(type: ToastType): { icon: string; accent: string; bg: string } {
    switch (type) {
        case 'message':
            return { icon: '💬', accent: 'bg-violet-500', bg: 'bg-zinc-900' };
        case 'friend_request':
            return { icon: '👋', accent: 'bg-emerald-500', bg: 'bg-zinc-900' };
        case 'reaction':
            return { icon: '❤️', accent: 'bg-pink-500', bg: 'bg-zinc-900' };
        default:
            return { icon: '🔔', accent: 'bg-zinc-500', bg: 'bg-zinc-900' };
    }
}

export default ToastContainer;
