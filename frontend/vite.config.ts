import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const currentDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    root: currentDir,
    plugins: [react(), tailwindcss()],
    build: {
        outDir: '../public/build',
        emptyOutDir: true,
        rollupOptions: {
            input: `${currentDir}/index.html`,
        },
    },
    server: {
        port: 3001,
        host: true,
        proxy: {
            '/api': {
                target: 'http://localhost',
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
