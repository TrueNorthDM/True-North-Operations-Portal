import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// .mts so it's loaded as ESM (@vitejs/plugin-react v6 is ESM-only, and the
// project's package.json is not "type": "module"). jsdom for component tests;
// the `@/*` alias mirrors tsconfig so imports resolve like they do in the app.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
