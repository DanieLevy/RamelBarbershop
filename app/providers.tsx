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
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  // Handle chunk load errors globally during development
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleError = (event: ErrorEvent) => {
      if (
        event.message.includes('ChunkLoadError') ||
        event.message.includes('Failed to load chunk') ||
        event.message.includes('Loading chunk')
      ) {
        console.warn('Chunk load error detected, attempting reload...')
        event.preventDefault()
        window.location.reload()
      }
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  return (
    <ChunkErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ChunkErrorBoundary>
  )
}
