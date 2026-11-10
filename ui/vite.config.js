import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { soundsPlugin } from './vite-plugin-sounds.js';

const root = fileURLToPath(new URL('.', import.meta.url));

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  plugins: [vue(), soundsPlugin()],
  root,
  base: isGitHubPages ? '/stream-inflight-command/' : '/',
  build: {
    rollupOptions: {
      // Deux pages : le dashboard, et l'overlay sons à mettre en Browser Source OBS.
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        overlay: fileURLToPath(new URL('overlay.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5183,
    strictPort: true,
    open: true,
  },
  css: {
    devSourcemap: true,
  },
});
