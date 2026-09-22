import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  server: {
    port: 5183,
    strictPort: true,
    open: true,
  },
});
