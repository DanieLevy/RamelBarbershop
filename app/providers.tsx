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
