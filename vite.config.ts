import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      headers: {
        // Prevent the browser from caching dynamic content files during development.
        // content-meta.json is re-generated on every predev run; snapshot.json is
        // statically imported (Vite resolves it at build time), so no header needed
        // for it.  The service worker is never registered in dev, so no sw.js header.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  };
});
