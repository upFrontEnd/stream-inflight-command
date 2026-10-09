import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  root,
  base: isGitHubPages ? '/stream-inflight-command/' : '/',
  server: {
    port: 5183,
    strictPort: true,
    open: true,
  },
  css: {
    devSourcemap: true,
  },
});
