import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function autoVersionServiceWorker() {
  return {
    name: 'auto-version-sw',
    apply: 'build',
    closeBundle() {
      const swDistPath = path.resolve(process.cwd(), 'dist', 'sw.js');
      if (fs.existsSync(swDistPath)) {
        let content = fs.readFileSync(swDistPath, 'utf8');
        const buildVersion = `v-${Date.now().toString(36)}`;
        content = content.replace(
          /const CACHE_NAME = ['"][^'"]+['"];/,
          `const CACHE_NAME = 'nexa-cbt-${buildVersion}';\n// Auto-generated build version: ${buildVersion} (${new Date().toISOString()})`
        );
        fs.writeFileSync(swDistPath, content, 'utf8');
        console.log(`[SW Plugin] Successfully stamped dist/sw.js with cache name: nexa-cbt-${buildVersion}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), autoVersionServiceWorker()],
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          xlsx: ['xlsx'],
          ExamRoom: ['./src/views/ExamRoom.jsx'],
        },
      },
    },
  },
});
