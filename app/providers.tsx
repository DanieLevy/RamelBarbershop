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

    const isChunkError = (msg: string) =>
      msg.includes('ChunkLoadError') ||
      msg.includes('Failed to load chunk') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module')

    const handleRecovery = (errorMessage: string) => {
      const last = Number(sessionStorage.getItem(STORAGE_KEY) || '0')
      if (Date.now() - last < MAX_WINDOW_MS) {
        console.log('[Providers] Chunk recovery within cooldown — skipping')
        return
      }

      console.log('[Providers] Chunk error — reloading:', errorMessage)
      sessionStorage.setItem(STORAGE_KEY, Date.now().toString())
      window.location.reload()
    }

    const handleError = (event: ErrorEvent) => {
      if (isChunkError(event.message)) {
        event.preventDefault()
        handleRecovery(event.message)
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || '')
      if (isChunkError(msg)) {
        event.preventDefault()
        handleRecovery(msg)
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
