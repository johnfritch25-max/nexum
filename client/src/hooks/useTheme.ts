/**
 * useTheme.ts
 * Dark / light theme toggle, persisted to localStorage.
 * Applies a `data-theme` attribute on <html> which CSS variables respond to.
 */
import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem('nexum-theme');
        if (stored === 'light' || stored === 'dark') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('nexum-theme', theme);
        // Toggle Tailwind dark class
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

    return { theme, toggleTheme };
}
