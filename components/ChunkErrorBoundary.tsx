'use client'

import { Component, type ReactNode } from 'react'
import { reportBug, getEnvironmentInfo, collectChunkDiagnostics } from '@/lib/bug-reporter'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  isChunkError: boolean
  retryExhausted: boolean
  isRecovering: boolean
}

const STORAGE_KEY = '__chunk_recovery'
const MAX_RELOADS_WINDOW_MS = 30_000

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('ChunkLoadError') ||
    error.message.includes('Failed to load chunk') ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Failed to fetch dynamically imported module')
  )
}

function extractChunkUrl(error: Error): string | undefined {
  const match = error.message.match(/\/_next\/static\/chunks\/[^\s"')]+/)
  return match?.[0]
}

async function reportChunkError(error: Error, source: 'error-boundary' | 'manual-reload' | 'aggressive-recovery'): Promise<void> {
  try {
    const chunkUrl = extractChunkUrl(error)
    const diag = await collectChunkDiagnostics('error-boundary', chunkUrl)

    await reportBug(error, 'ChunkLoadError — Stale deployment detected', {
      component: 'ChunkErrorBoundary',
      environment: getEnvironmentInfo(),
      severity: 'high',
      additionalData: {
        chunkDiagnostics: diag,
        recoveryAction: source,
      },
    })
  } catch {
    // Never block recovery if reporting fails
  }
}

async function purgeAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        await new Promise((r) => setTimeout(r, 500))
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' })
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map((n) => caches.delete(n)))
  } catch {
    // caches API may be unavailable
  }

  sessionStorage.setItem(STORAGE_KEY, Date.now().toString())

  const url = window.location.pathname + window.location.search
  const sep = url.includes('?') ? '&' : '?'
  window.location.replace(url + sep + '_cb=' + Date.now())
}

async function aggressiveRecovery(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch { /* ignore */ }

  try {
    const names = await caches.keys()
    await Promise.all(names.map((n) => caches.delete(n)))
  } catch { /* ignore */ }

  sessionStorage.removeItem(STORAGE_KEY)

  const url = window.location.pathname + window.location.search
  const sep = url.includes('?') ? '&' : '?'
  window.location.replace(url + sep + '_cb=' + Date.now())
}

export class ChunkErrorBoundary extends Component<Props, State> {
  private lastError: Error | null = null

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, isChunkError: false, retryExhausted: false, isRecovering: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
    }
  }

  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) return

    this.lastError = error

    const lastReload = Number(sessionStorage.getItem(STORAGE_KEY) || '0')
    const withinWindow = Date.now() - lastReload < MAX_RELOADS_WINDOW_MS

    if (withinWindow) {
      console.warn('[ChunkErrorBoundary] Reload already attempted recently — showing banner')
      reportChunkError(error, 'error-boundary')
      this.setState({ retryExhausted: true })
      return
    }

    console.warn('[ChunkErrorBoundary] Stale chunk detected — reporting and recovering')
    reportChunkError(error, 'error-boundary').finally(() => {
      purgeAndReload()
    })
  }

  handleBannerReload = () => {
    this.setState({ isRecovering: true })

    const error = this.lastError || new Error('Manual reload after ChunkLoadError recovery exhausted')
    if (!this.lastError) error.name = 'ChunkLoadError'

    reportChunkError(error, 'aggressive-recovery').finally(() => {
      aggressiveRecovery()
    })
  }

  render() {
    if (this.state.hasError && this.state.isChunkError && this.state.retryExhausted) {
      return (
        <div className="min-h-screen bg-background-dark flex flex-col">
          {/* Slim top banner */}
          <div
            className="fixed top-0 left-0 right-0 z-[200] animate-slide-down"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="mx-auto max-w-lg px-4 pt-3 pb-2">
              <button
                onClick={this.handleBannerReload}
                disabled={this.state.isRecovering}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-accent-gold/15 to-accent-gold/5 border border-accent-gold/20 backdrop-blur-xl shadow-lg shadow-accent-gold/5 transition-all active:scale-[0.98] disabled:opacity-60"
                aria-label="עדכן גרסה חדשה"
                tabIndex={0}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                    {this.state.isRecovering ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffaa3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffaa3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                    )}
                  </div>
                  <div className="text-right min-w-0">
                    <p className="text-sm font-semibold text-foreground-light leading-tight">
                      {this.state.isRecovering ? 'מעדכן...' : 'גרסה חדשה זמינה'}
                    </p>
                    <p className="text-xs text-foreground-muted leading-tight mt-0.5">
                      {this.state.isRecovering ? 'טוען את הגרסה החדשה' : 'לחץ לטעינת העדכון'}
                    </p>
                  </div>
                </div>
                {!this.state.isRecovering && (
                  <div className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-accent-gold/20 text-accent-gold text-xs font-medium">
                    עדכן
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Clean placeholder body */}
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center opacity-40">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-foreground-muted">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <p className="text-sm text-foreground-muted">
                טוען תוכן...
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (this.state.hasError && !this.state.isChunkError) {
      return (
        <div className="min-h-[300px] flex items-center justify-center p-4">
          <div className="max-w-xs w-full text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <p className="text-foreground-light font-medium mb-1">אירעה שגיאה</p>
            <p className="text-foreground-muted text-xs mb-4">הצוות קיבל התראה אוטומטית</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-white/10 text-foreground-light rounded-xl text-sm font-medium hover:bg-white/15 transition-colors"
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
