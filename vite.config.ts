import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Don't inline assets larger than 10 kB (default 4 kB) — avoids base64 bloat
    assetsInlineLimit: 10_240,
    // Raise the chunk-size warning threshold for Monaco (it's large by design)
    chunkSizeWarningLimit: 3_000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Isolate Monaco into its own chunk — ~2 MB, lazy-loaded by the editor
          if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
            return 'monaco';
          }
          // Group Firebase SDK together
          if (id.includes('firebase')) {
            return 'firebase';
          }
          // All other node_modules → vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
});
