'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode, useEffect } from 'react'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'
import { reportBug, getEnvironmentInfo, collectChunkDiagnostics } from '@/lib/bug-reporter'

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

    const extractChunkUrl = (msg: string) => {
      const match = msg.match(/\/_next\/static\/chunks\/[^\s"')]+/)
      return match?.[0]
    }

    const handleRecovery = async (errorMessage: string) => {
      const last = Number(sessionStorage.getItem(STORAGE_KEY) || '0')
      if (Date.now() - last < MAX_WINDOW_MS) {
        console.log('[Providers] Chunk recovery within cooldown — skipping')
        return
      }

      console.log('[Providers] Chunk error — starting recovery:', errorMessage)
      const chunkUrl = extractChunkUrl(errorMessage)

      try {
        const diag = await collectChunkDiagnostics('global-handler', chunkUrl)
        await reportBug(
          new Error(errorMessage),
          'ChunkLoadError — Global handler recovery (providers.tsx)',
          {
            component: 'ProvidersGlobalHandler',
            environment: getEnvironmentInfo(),
            severity: 'high',
            additionalData: { chunkDiagnostics: diag },
          }
        )
      } catch {
        // Never block recovery if reporting fails
      }

      console.log('[Providers] Unregistering all SWs + clearing caches')
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map((r) => r.unregister()))
        }
        const names = await caches.keys()
        await Promise.all(names.map((n) => caches.delete(n)))
      } catch { /* caches API may be unavailable */ }

      sessionStorage.setItem(STORAGE_KEY, Date.now().toString())

      const url = window.location.pathname + window.location.search
      const sep = url.includes('?') ? '&' : '?'
      const target = url + sep + '_cb=' + Date.now()
      console.log('[Providers] Cleanup done — navigating to:', target)
      window.location.replace(target)
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
