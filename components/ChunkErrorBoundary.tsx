'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  isChunkError: boolean
  retryExhausted: boolean
}

const STORAGE_KEY = 'chunk_reload_ts'
const MAX_RELOADS_WINDOW_MS = 15_000

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('ChunkLoadError') ||
    error.message.includes('Failed to load chunk') ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Failed to fetch dynamically imported module')
  )
}

async function purgeStaleChunksAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' })
      await new Promise((r) => setTimeout(r, 300))
    }

    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map((n) => caches.delete(n)))
  } catch {
    // caches API may be unavailable in some contexts
  }

  sessionStorage.setItem(STORAGE_KEY, Date.now().toString())
  window.location.reload()
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, isChunkError: false, retryExhausted: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
    }
  }

  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) return

    const lastReload = Number(sessionStorage.getItem(STORAGE_KEY) || '0')
    const withinWindow = Date.now() - lastReload < MAX_RELOADS_WINDOW_MS

    if (withinWindow) {
      console.warn('[ChunkErrorBoundary] Reload already attempted recently — showing fallback UI')
      this.setState({ retryExhausted: true })
      return
    }

    console.warn('[ChunkErrorBoundary] Stale chunk detected — clearing caches and reloading')
    purgeStaleChunksAndReload()
  }

  handleManualReload = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    purgeStaleChunksAndReload()
  }

  render() {
    if (this.state.hasError && this.state.isChunkError && this.state.retryExhausted) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background-dark">
          <div className="text-center p-8 max-w-sm">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent-gold/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffaa3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </div>
            <h2 className="text-xl text-foreground-light mb-2 font-semibold">
              גרסה חדשה זמינה
            </h2>
            <p className="text-foreground-muted mb-6 text-sm leading-relaxed">
              האפליקציה עודכנה. לחץ על הכפתור כדי לטעון את הגרסה החדשה.
            </p>
            <button
              onClick={this.handleManualReload}
              className="px-6 py-3 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90 transition-colors"
              aria-label="טען גרסה חדשה"
            >
              טען גרסה חדשה
            </button>
          </div>
        </div>
      )
    }

    if (this.state.hasError && !this.state.isChunkError) {
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
              aria-label="רענן דף"
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
