import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            manifest: {
                name: 'Nexum',
                short_name: 'Nexum',
                description: 'Real-time messenger and community platform by Johnfritch R. Garcia',
                theme_color: '#7c3aed',
                background_color: '#09090b',
                display: 'standalone',
                orientation: 'portrait-primary',
                start_url: '/',
                scope: '/',
                id: '/',
                icons: [
                    {
                        src: '/favicon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                ],
            },
            workbox: {
                // Cache app shell and static assets
                globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
                // Don't cache API calls — always go to network
                navigateFallback: 'index.html',
                navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/messages/, /^\/friends/, /^\/users/, /^\/community/, /^\/groups/, /^\/health/],
                runtimeCaching: [
                    {
                        // Cache Google Fonts
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                        },
                    },
                ],
            },
        }),
    ],
    server: { port: 5173, strictPort: true },
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        target: ['es2021', 'chrome100', 'safari13'],
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
    },
});
