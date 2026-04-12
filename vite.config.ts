import { existsSync, readFileSync } from 'node:fs'

import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

function resolveBase() {
  const customDomain = resolveCustomDomain()

  if (customDomain) {
    return '/'
  }

  if (!process.env.GITHUB_ACTIONS) {
    return '/'
  }

  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const owner = process.env.GITHUB_REPOSITORY_OWNER

  if (!repoName) {
    return '/'
  }

  if (owner && repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
    return '/'
  }

  return `/${repoName}/`
}

function resolveCustomDomain() {
  if (!existsSync('CNAME')) {
    return ''
  }

  return readFileSync('CNAME', 'utf8').trim()
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', ...configDefaults.exclude],
  },
})
