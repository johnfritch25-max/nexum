import React from 'react';
import { useDraggable } from '../hooks/useDraggable';

interface AboutModalProps {
    isOpen:  boolean;
    onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
    const { modalRef, dragHandleProps } = useDraggable();

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

            <div ref={modalRef} role="dialog" aria-modal="true" aria-label="About Nexum"
                className={[
                    'fixed z-50 bg-zinc-900 flex flex-col shadow-2xl',
                    'bottom-0 left-0 right-0 rounded-t-2xl max-h-[90vh] sheet-up',
                    'md:bottom-auto md:left-1/2 md:top-1/2',
                    'md:w-[520px] md:max-h-[85vh] md:rounded-2xl md:border md:border-zinc-800/60 md:animate-scale-in',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag handle — mobile */}
                <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
                    <div className="h-1 w-10 rounded-full bg-zinc-700" />
                </div>

                {/* Header */}
                <div className={`h-14 flex items-center justify-between px-5 border-b border-zinc-800/60 shrink-0 ${dragHandleProps.className}`}
                    onMouseDown={dragHandleProps.onMouseDown}>
                    <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shrink-0">
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                                <path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
                                <path d="M14 6c-.762 0-1.52.02-2.271.062C10.157 6.148 9 7.472 9 8.998v2.24c0 1.519 1.147 2.839 2.71 2.935.214.013.428.024.642.034.2.009.385.09.518.224l2.35 2.35a.75.75 0 001.28-.531v-2.07c1.453-.195 2.5-1.463 2.5-2.942V8.998c0-1.526-1.157-2.85-2.729-2.936A41.645 41.645 0 0014 6z" />
                            </svg>
                        </div>
                        <h2 className="text-sm font-semibold text-white select-none">About Nexum</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">

                    {/* App identity */}
                    <div className="flex flex-col items-center gap-3 py-2">
                        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-glow-violet">
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-white">
                                <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 00-1.032-.211 50.89 50.89 0 00-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 002.433 3.984L7.28 21.53A.75.75 0 016 21v-4.03a48.527 48.527 0 01-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979z" />
                                <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 001.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0015.75 7.5z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-white tracking-tight">Nexum</h1>
                            <p className="text-xs text-violet-400 font-medium mt-0.5">Version 1.0.0</p>
                            <p className="text-xs text-zinc-500 mt-1">Real-time Messenger &amp; Community Platform</p>
                        </div>
                    </div>

                    {/* Description */}
                    <section className="flex flex-col gap-3">
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">About</p>
                        <div className="flex flex-col gap-3 text-sm text-zinc-300 leading-relaxed">
                            <p>
                                <span className="font-semibold text-white">Nexum</span> is a full-featured, real-time communication platform built for modern users who demand speed, privacy, and a rich social experience — all in one place.
                            </p>
                            <p>
                                At its core, Nexum delivers instant messaging with end-to-end presence awareness, letting you see when your friends are online, what they're up to, and connect with them through text, images, voice calls, and high-definition video calls — all powered by WebRTC peer-to-peer technology, meaning your media streams directly between devices without passing through a central server.
                            </p>
                            <p>
                                Beyond one-on-one conversations, Nexum features a <span className="text-violet-400 font-medium">Community Hub</span> — a shared social feed where all users can post updates, share images, react with emojis, and engage through comments in real time. Think of it as a built-in social network that lives alongside your private chats.
                            </p>
                            <p>
                                <span className="font-semibold text-white">Group Chats</span> let you bring multiple friends together in a single conversation, with full support for text and image sharing. Create a group in seconds, add members from your friends list, and start collaborating instantly.
                            </p>
                            <p>
                                Nexum respects your privacy with a built-in <span className="text-violet-400 font-medium">Incognito Mode</span> — when enabled, your activity status and process information are completely hidden from your friends, and all background scanning is paused. You're in control of what others see.
                            </p>
                            <p>
                                The platform also features a smart <span className="font-semibold text-white">Activity Status</span> system. On the desktop app (powered by Tauri), Nexum can detect which application you're currently using — whether you're gaming, coding, or listening to music — and automatically share that as your status with friends, similar to Discord's rich presence.
                            </p>
                            <p>
                                Every detail of the user experience has been carefully crafted: message reactions, read receipts, typing indicators, unread badges, desktop push notifications, a draggable modal system, and a fully responsive design that works beautifully on mobile, tablet, and desktop screens.
                            </p>
                            <p>
                                Built with a modern tech stack — <span className="text-zinc-200">React 18</span>, <span className="text-zinc-200">TypeScript</span>, <span className="text-zinc-200">Tailwind CSS</span>, <span className="text-zinc-200">Node.js</span>, <span className="text-zinc-200">Socket.io</span>, <span className="text-zinc-200">MySQL</span>, and <span className="text-zinc-200">WebRTC</span> — Nexum is designed to be fast, secure, and scalable.
                            </p>
                        </div>
                    </section>

                    {/* Features grid */}
                    <section className="flex flex-col gap-3">
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Features</p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { icon: '💬', label: 'Real-time Messaging' },
                                { icon: '📷', label: 'Image Sharing' },
                                { icon: '📞', label: 'Voice Calls' },
                                { icon: '🎥', label: 'Video Calls' },
                                { icon: '👥', label: 'Group Chats' },
                                { icon: '🌐', label: 'Community Hub' },
                                { icon: '👻', label: 'Incognito Mode' },
                                { icon: '🎮', label: 'Activity Status' },
                                { icon: '❤️', label: 'Reactions' },
                                { icon: '🔔', label: 'Notifications' },
                                { icon: '🌙', label: 'Dark / Light Theme' },
                                { icon: '📱', label: 'Fully Responsive' },
                            ].map((f) => (
                                <div key={f.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/30">
                                    <span className="text-base shrink-0">{f.icon}</span>
                                    <span className="text-xs text-zinc-300 font-medium">{f.label}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Tech stack */}
                    <section className="flex flex-col gap-3">
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Tech Stack</p>
                        <div className="flex flex-wrap gap-1.5">
                            {['React 18', 'TypeScript', 'Tailwind CSS', 'Vite', 'Node.js', 'Express', 'Socket.io', 'MySQL', 'WebRTC', 'JWT Auth', 'Tauri'].map((t) => (
                                <span key={t} className="px-2.5 py-1 rounded-lg bg-violet-600/15 border border-violet-500/25 text-violet-300 text-xs font-medium">
                                    {t}
                                </span>
                            ))}
                        </div>
                    </section>

                    {/* Developer */}
                    <section className="flex flex-col gap-3">
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Developer</p>
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-violet-950/40 to-zinc-900 border border-violet-800/30">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-glow-violet">
                                J
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Johnfritch R. Garcia</p>
                                <p className="text-xs text-violet-400 font-medium mt-0.5">Full-Stack Developer</p>
                                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                                    Designed and built Nexum from the ground up — architecture, backend, real-time systems, UI/UX, and desktop integration.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Footer */}
                    <div className="flex flex-col items-center gap-1 pt-2 pb-1 border-t border-zinc-800/40">
                        <p className="text-xs text-zinc-600">© 2025 Nexum · Johnfritch R. Garcia</p>
                        <p className="text-[10px] text-zinc-700">All rights reserved.</p>
                    </div>

                </div>
            </div>
        </>
    );
};

export default AboutModal;
