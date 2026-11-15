import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// vitest config is typed against defineConfig from vitest/config
import { defineConfig as defineTestConfig, mergeConfig } from 'vitest/config'

const testConfig = defineTestConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    passWithNoTests: true,
    css: true,
    exclude: ['**/node_modules/**', '**/.worktrees/**', '**/.superpowers/**', '**/dist/**'],
  },
})

export default mergeConfig(
  defineConfig({
    plugins: [react()],
    // GitHub Pages serves a project site under /<repo>/
    base: process.env.GITHUB_ACTIONS ? '/pardeh/' : '/',
  }),
  testConfig,
)
