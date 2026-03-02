'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { reportBug, getEnvironmentInfo, collectChunkDiagnostics } from '@/lib/bug-reporter'
import { AlertTriangle, Home } from 'lucide-react'
import Link from 'next/link'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  component?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  reportId: string | null
  isReporting: boolean
}

function isChunkError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`
  return (
    msg.includes('ChunkLoadError') ||
    msg.includes('Failed to load chunk') ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module')
  )
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reportId: null,
      isReporting: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo, isReporting: true })

    try {
      const additionalData: Record<string, unknown> = {
        componentStack: errorInfo.componentStack,
      }

      if (isChunkError(error)) {
        try {
          const chunkMatch = error.message.match(/\/_next\/static\/chunks\/[^\s"')]+/)
          const diag = await collectChunkDiagnostics('error-boundary', chunkMatch?.[0])
          additionalData.chunkDiagnostics = diag
        } catch { /* non-blocking */ }
      }

      const reportId = await reportBug(
        error,
        'React Error Boundary Caught Error',
        {
          component: this.props.component || 'Unknown',
          environment: getEnvironmentInfo(),
          additionalData,
          severity: isChunkError(error) ? 'high' : 'high',
        }
      )

      this.setState({ reportId, isReporting: false })
    } catch (reportError) {
      console.error('[ErrorBoundary] Failed to report error:', reportError)
      this.setState({ isReporting: false })
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h2 className="text-xl font-bold text-foreground-light mb-2">
              משהו השתבש
            </h2>

            <p className="text-foreground-muted text-sm mb-4">
              אירעה שגיאה בלתי צפויה. הצוות שלנו קיבל התראה אוטומטית.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 p-3 bg-red-500/10 rounded-lg text-left" dir="ltr">
                <p className="text-xs font-mono text-red-400 break-all">
                  {this.state.error.name}: {this.state.error.message}
                </p>
              </div>
            )}

            {this.state.isReporting ? (
              <p className="text-xs text-foreground-muted mb-4">
                מדווח על השגיאה...
              </p>
            ) : this.state.reportId ? (
              <p className="text-xs text-green-500 mb-4">
                השגיאה דווחה (מזהה: {this.state.reportId})
              </p>
            ) : null}

            <div className="flex justify-center">
              <Link
                href="/"
                prefetch={false}
                className="flex items-center gap-2 px-6 py-3 bg-accent-gold text-background-dark rounded-lg font-medium text-sm hover:bg-accent-gold/90 transition-colors"
              >
                <Home className="w-4 h-4" />
                לדף הבית
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
