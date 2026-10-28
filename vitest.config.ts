import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    env: { TZ: 'Europe/Berlin' },
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs', 'mcp/**/*.test.ts'],
  },
});
