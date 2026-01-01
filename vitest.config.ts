import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env files including .env.local
  const env = loadEnv(mode || 'test', process.cwd(), '')
  
  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./__tests__/setup.ts'],
      include: ['**/__tests__/**/*.test.{ts,tsx}'],
      exclude: ['node_modules', '_archive', '.next'],
      // Pass environment variables to tests
      env: {
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules',
          '_archive',
          '.next',
          '**/*.d.ts',
          '**/types/**',
          'vitest.config.ts',
        ],
      },
      // Increase timeout for integration tests
      testTimeout: 30000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  }
})

