import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      // Shared API contract — single source of truth in the `shared` workspace.
      '@client-iptv/shared': path.resolve(rootDir, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
