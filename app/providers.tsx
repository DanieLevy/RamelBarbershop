'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode, useEffect } from 'react'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'

const STORAGE_KEY = '__chunk_recovery'
const MAX_WINDOW_MS = 30_000

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
          },
        },
      })
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    console.log('[Providers:init] Global chunk error listeners registered')

    const isChunkError = (msg: string) =>
      msg.includes('ChunkLoadError') ||
      msg.includes('Failed to load chunk') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module')

    const handleRecovery = (errorMessage: string, source: string) => {
      const last = Number(sessionStorage.getItem(STORAGE_KEY) || '0')
      const elapsed = Date.now() - last
      console.log(`[Providers:recovery] source=${source} elapsed=${elapsed}ms cooldown=${MAX_WINDOW_MS}ms error="${errorMessage.slice(0, 120)}"`)

      if (elapsed < MAX_WINDOW_MS) {
        console.log('[Providers:recovery] Within cooldown — skipping reload')
        return
      }

      console.log('[Providers:recovery] Reloading page')
      sessionStorage.setItem(STORAGE_KEY, Date.now().toString())
      window.location.reload()
    }

    const handleError = (event: ErrorEvent) => {
      if (isChunkError(event.message)) {
        console.warn(`[Providers:error] Chunk error caught — message="${event.message.slice(0, 120)}" filename=${event.filename || 'unknown'} lineno=${event.lineno}`)
        event.preventDefault()
        handleRecovery(event.message, 'window.error')
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || '')
      if (isChunkError(msg)) {
        console.warn(`[Providers:rejection] Chunk rejection caught — message="${msg.slice(0, 120)}"`)
        event.preventDefault()
        handleRecovery(msg, 'unhandledrejection')
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return (
    <ChunkErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ChunkErrorBoundary>
  )
}
