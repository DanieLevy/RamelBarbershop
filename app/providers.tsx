'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode, useEffect } from 'react'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 5 minutes - prevents redundant refetches
            staleTime: 5 * 60 * 1000, // 5 minutes
            // Keep unused data in cache for 30 minutes before garbage collection
            gcTime: 30 * 60 * 1000, // 30 minutes
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            // Don't retry failed queries aggressively - reduces wasted requests
            retry: 1,
          },
        },
      })
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const STORAGE_KEY = 'chunk_reload_ts'
    const MAX_WINDOW_MS = 15_000

    const isChunkError = (msg: string) =>
      msg.includes('ChunkLoadError') ||
      msg.includes('Failed to load chunk') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module')

    const handleRecovery = async () => {
      const last = Number(sessionStorage.getItem(STORAGE_KEY) || '0')
      if (Date.now() - last < MAX_WINDOW_MS) return

      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' })
          await new Promise((r) => setTimeout(r, 300))
        }
        const names = await caches.keys()
        await Promise.all(names.map((n) => caches.delete(n)))
      } catch { /* caches API may be unavailable */ }

      sessionStorage.setItem(STORAGE_KEY, Date.now().toString())
      window.location.reload()
    }

    const handleError = (event: ErrorEvent) => {
      if (isChunkError(event.message)) {
        event.preventDefault()
        handleRecovery()
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || '')
      if (isChunkError(msg)) {
        event.preventDefault()
        handleRecovery()
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
