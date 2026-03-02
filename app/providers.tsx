'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode, useEffect } from 'react'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'

const STORAGE_KEY = '__chunk_recovery'
const MAX_WINDOW_MS = 10_000

declare global {
  interface Window {
    __APP_BOOTED?: boolean
  }
}

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

    window.__APP_BOOTED = true
    console.log('[Providers:init] React mounted — __APP_BOOTED=true')

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

      console.log('[Providers:recovery] Cache-bust navigating for fresh assets')
      sessionStorage.setItem(STORAGE_KEY, Date.now().toString())
      const u = window.location.pathname + window.location.search
      const sep = u.includes('?') ? '&' : '?'
      window.location.replace(u + sep + '_cb=' + Date.now())
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

    if (window.location.search.includes('_cb=')) {
      try {
        const u = new URL(window.location.href)
        u.searchParams.delete('_cb')
        history.replaceState(null, '', u.pathname + (u.search || '') + u.hash)
      } catch { /* non-critical */ }
    }

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
