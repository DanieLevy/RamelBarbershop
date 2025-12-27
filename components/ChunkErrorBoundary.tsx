'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary specifically for handling chunk load errors
 * during development with Turbopack HMR
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a chunk load error
    const isChunkError = 
      error.name === 'ChunkLoadError' ||
      error.message.includes('ChunkLoadError') ||
      error.message.includes('Failed to load chunk') ||
      error.message.includes('Loading chunk')
    
    if (isChunkError) {
      // Try to reload the page automatically for chunk errors
      if (typeof window !== 'undefined') {
        console.warn('Chunk load error detected, reloading page...')
        window.location.reload()
      }
    }
    
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChunkErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background-dark">
          <div className="text-center p-8">
            <h2 className="text-xl text-foreground-light mb-4">
              אירעה שגיאה בטעינת הדף
            </h2>
            <p className="text-foreground-muted mb-6">
              נסה לרענן את הדף
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90 transition-colors"
            >
              רענן דף
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

