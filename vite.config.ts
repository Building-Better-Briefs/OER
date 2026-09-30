/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const offlineRoot = path.resolve(__dirname);
const repoRoot = path.resolve(__dirname, '..');

const forbiddenPackages = [
    '@prisma/client',
    'better-auth',
    'libsql',
    '@azure/storage-blob'
];

export default defineConfig({
    root: offlineRoot,
    base: './',
    build: {
        target: 'es2022',
        outDir: 'dist',
        emptyOutDir: true
    },
    plugins: [
        react(),
        tailwindcss(),
        {
            name: 'offline-import-guard',
            resolveId(source, importer) {
                if (!importer) return null;
                if (forbiddenPackages.some((p) => source === p || source.startsWith(p + '/'))) {
                    throw new Error(`Forbidden import in offline app: ${source}`);
                }
                if (source.includes('..\\..\\src') || source.includes('../../src')) {
                    throw new Error(`Import from main src/ is not allowed: ${source}`);
                }
                return null;
            }
        },
        VitePWA({
            registerType: 'prompt',
            includeAssets: [
                'logo.svg',
                'logo-light.svg',
                'logo-dark.svg',
                'BuildingBetterBriefs.pdf'
            ],
            manifest: {
                name: 'Assessment Brief Builder (Offline)',
                short_name: 'Brief Builder',
                description: 'Create assessment briefs offline',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                start_url: './',
                scope: './',
                icons: [
                    {
                        src: 'logo.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any'
                    }
                ]
            },
            workbox: {
                globPatterns: [
                    '**/*.{js,css,html,ico,svg,png,ttf,woff2,webmanifest,pdf}'
                ],
                maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
                navigateFallback: 'index.html'
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(offlineRoot, 'src'),
            '@/viewer-stubs': path.resolve(offlineRoot, 'src/viewer-stubs'),
            '@/builder': path.resolve(offlineRoot, 'src/builder')
        },
        dedupe: ['react', 'react-dom']
    },
    define: {
        'process.env.NEXT_PUBLIC_INSTITUTION_NAME': JSON.stringify('IADT'),
        'process.env.NEXT_PUBLIC_APP_NAME': JSON.stringify(
            'Assessment Brief Builder (Offline)'
        ),
        'process.env.NEXT_PUBLIC_LOGO_URL_LIGHT': JSON.stringify('/logo-light.svg'),
        'process.env.NEXT_PUBLIC_LOGO_URL_DARK': JSON.stringify('/logo-dark.svg'),
        'process.env.NEXT_PUBLIC_INSTITUTION_AI_POLICY_LABEL': JSON.stringify(''),
        'process.env.NEXT_PUBLIC_INSTITUTION_AI_POLICY_URL': JSON.stringify(''),
        'process.env.NEXT_PUBLIC_LOGO_URL': JSON.stringify(''),
        'process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN': JSON.stringify(''),
        'process.env.NEXT_PUBLIC_': JSON.stringify('')
    },
    publicDir: path.resolve(offlineRoot, 'public'),
    server: {
        port: 5173,
        strictPort: true
    },
    test: {
        include: ['src/**/*.test.ts']
    }
});
