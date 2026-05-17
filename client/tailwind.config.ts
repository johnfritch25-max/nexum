import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                brand: {
                    50:  '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
                    400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
                    800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
                },
                surface: {
                    DEFAULT: '#18181b', raised: '#1c1c1f',
                    overlay: '#27272a', border: '#2e2e33',
                },
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
            },
            boxShadow: {
                'glow-violet': '0 0 20px -4px rgba(124, 58, 237, 0.5)',
                'glow-sm':     '0 0 10px -2px rgba(124, 58, 237, 0.3)',
                'message':     '0 1px 2px rgba(0,0,0,0.4)',
            },
            transitionTimingFunction: {
                'spring':      'cubic-bezier(0.34, 1.56, 0.64, 1)',
                'smooth':      'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                'snappy':      'cubic-bezier(0.4, 0, 0.2, 1)',
            },
            transitionDuration: {
                '80':  '80ms',
                '250': '250ms',
                '350': '350ms',
                '400': '400ms',
            },
            animation: {
                'fade-in':      'fadeIn 200ms ease both',
                'slide-up':     'slideUp 250ms cubic-bezier(0.34,1.56,0.64,1) both',
                'slide-right':  'slideRight 200ms cubic-bezier(0.25,0.46,0.45,0.94) both',
                'scale-in':     'scaleIn 150ms cubic-bezier(0.34,1.56,0.64,1) both',
                'pulse-slow':   'pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
                'spin-smooth':  'spin 0.8s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%':   { opacity: '0', transform: 'translateY(4px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%':   { opacity: '0', transform: 'translateY(14px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideRight: {
                    '0%':   { opacity: '0', transform: 'translateX(-8px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                scaleIn: {
                    '0%':   { opacity: '0', transform: 'scale(0.92)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
