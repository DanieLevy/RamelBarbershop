'use client'

import { useState } from 'react'
import { reportBug, getEnvironmentInfo } from '@/lib/bug-reporter'
import { trySafe, reportSupabaseError, reportFirebaseError } from '@/lib/bug-reporter/helpers'
import { useBugReporter } from '@/hooks/useBugReporter'
import { Bug, Database, Flame, Server, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

type TestStatus = 'idle' | 'running' | 'success' | 'error'

interface TestResult {
  status: TestStatus
  reportId?: string | null
  message?: string
}

export default function DebugPage() {
  const { report } = useBugReporter('DebugPage')
  
  const [test1, setTest1] = useState<TestResult>({ status: 'idle' })
  const [test2, setTest2] = useState<TestResult>({ status: 'idle' })
  const [test3, setTest3] = useState<TestResult>({ status: 'idle' })

  // Test 1: Simulate a Database/API Error
  const runTest1 = async () => {
    setTest1({ status: 'running' })
    
    try {
      // Simulate a Supabase database error
      const mockSupabaseError = {
        message: 'relation "nonexistent_table" does not exist',
        code: '42P01',
        details: 'The table you are trying to query does not exist in the database',
        hint: 'Check the table name and ensure migrations have been run',
      }
      
      const reportId = await reportSupabaseError(
        mockSupabaseError,
        'Fetching user profile data from dashboard',
        {
          table: 'nonexistent_table',
          operation: 'select',
          user: {
            type: 'barber',
            id: 'test-barber-123',
            name: 'Test Barber',
            email: 'test@example.com',
          },
        }
      )
      
      if (reportId) {
        setTest1({ status: 'success', reportId, message: 'Database error reported successfully!' })
        toast.success('Test 1 passed - Bug report sent!')
      } else {
        setTest1({ status: 'error', message: 'Failed to send report (check email config)' })
        toast.error('Test 1 failed - Report not sent')
      }
    } catch (err) {
      setTest1({ status: 'error', message: String(err) })
      toast.error('Test 1 failed with exception')
    }
  }

  // Test 2: Simulate a Firebase Authentication Error
  const runTest2 = async () => {
    setTest2({ status: 'running' })
    
    try {
      // Simulate a Firebase auth error
      const mockFirebaseError = {
        code: 'auth/invalid-verification-code',
        message: 'The verification code entered is invalid. Please check the code and try again.',
      }
      
      const reportId = await reportFirebaseError(
        mockFirebaseError,
        'OTP verification during customer login',
        {
          user: {
            type: 'customer',
            phone: '0501234567',
          },
          phone: '0501234567',
        }
      )
      
      if (reportId) {
        setTest2({ status: 'success', reportId, message: 'Firebase auth error reported successfully!' })
        toast.success('Test 2 passed - Bug report sent!')
      } else {
        setTest2({ status: 'error', message: 'Failed to send report (check email config)' })
        toast.error('Test 2 failed - Report not sent')
      }
    } catch (err) {
      setTest2({ status: 'error', message: String(err) })
      toast.error('Test 2 failed with exception')
    }
  }

  // Test 3: Simulate an Unhandled JavaScript Exception
  const runTest3 = async () => {
    setTest3({ status: 'running' })
    
    try {
      // Use trySafe to catch and report an error
      const result = await trySafe(
        async () => {
          // Simulate an async operation that throws
          await new Promise((_, reject) => {
            setTimeout(() => {
              reject(new TypeError("Cannot read properties of undefined (reading 'map')"))
            }, 500)
          })
        },
        'Rendering barber list component with undefined data',
        {
          component: 'BarberListComponent',
          user: {
            type: 'guest',
          },
          additionalData: {
            barberId: 'undefined',
            attemptedAction: 'map over barber.services',
            componentState: {
              isLoading: false,
              hasData: false,
            },
          },
          severity: 'high',
        }
      )
      
      if (!result.success && result.reportId) {
        setTest3({ status: 'success', reportId: result.reportId, message: 'JavaScript exception reported successfully!' })
        toast.success('Test 3 passed - Bug report sent!')
      } else if (!result.success) {
        setTest3({ status: 'error', message: 'Failed to send report (check email config)' })
        toast.error('Test 3 failed - Report not sent')
      }
    } catch (err) {
      setTest3({ status: 'error', message: String(err) })
      toast.error('Test 3 failed with exception')
    }
  }

  const StatusIcon = ({ status }: { status: TestStatus }) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-400" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background-dark p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
            <Bug className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground-light mb-2">
            Bug Reporter Debug Page
          </h1>
          <p className="text-foreground-muted text-sm">
            Test the automated bug reporting system with real-world error scenarios
          </p>
        </div>

        {/* Info Card */}
        <div className="glass-card p-4 mb-6 border-l-4 border-amber-500">
          <p className="text-amber-400 text-sm">
            <strong>Note:</strong> Make sure you have configured your Resend API key in <code className="bg-white/10 px-1 rounded">.env.local</code> to receive emails.
          </p>
        </div>

        {/* Test Cards */}
        <div className="space-y-4">
          {/* Test 1: Database Error */}
          <div className="glass-card p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Database className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground-light mb-1">
                  Test 1: Database Query Error
                </h3>
                <p className="text-foreground-muted text-sm mb-3">
                  Simulates a Supabase error when querying a non-existent table. 
                  This represents what happens when a barber tries to access data that doesn&apos;t exist.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={runTest1}
                    disabled={test1.status === 'running'}
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                      test1.status === 'running'
                        ? 'bg-purple-500/30 text-purple-300 cursor-not-allowed'
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                    )}
                  >
                    {test1.status === 'running' ? 'Sending...' : 'Trigger Error'}
                  </button>
                  <StatusIcon status={test1.status} />
                </div>
                {test1.reportId && (
                  <p className="mt-2 text-xs text-green-400 font-mono">
                    Report ID: {test1.reportId}
                  </p>
                )}
                {test1.status === 'error' && test1.message && (
                  <p className="mt-2 text-xs text-red-400">
                    {test1.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Test 2: Firebase Auth Error */}
          <div className="glass-card p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Flame className="w-6 h-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground-light mb-1">
                  Test 2: Firebase Auth Error
                </h3>
                <p className="text-foreground-muted text-sm mb-3">
                  Simulates a Firebase authentication error when a customer enters an invalid OTP code.
                  This represents failed phone verification during login.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={runTest2}
                    disabled={test2.status === 'running'}
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                      test2.status === 'running'
                        ? 'bg-orange-500/30 text-orange-300 cursor-not-allowed'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    )}
                  >
                    {test2.status === 'running' ? 'Sending...' : 'Trigger Error'}
                  </button>
                  <StatusIcon status={test2.status} />
                </div>
                {test2.reportId && (
                  <p className="mt-2 text-xs text-green-400 font-mono">
                    Report ID: {test2.reportId}
                  </p>
                )}
                {test2.status === 'error' && test2.message && (
                  <p className="mt-2 text-xs text-red-400">
                    {test2.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Test 3: JavaScript Exception */}
          <div className="glass-card p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Server className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground-light mb-1">
                  Test 3: JavaScript Runtime Exception
                </h3>
                <p className="text-foreground-muted text-sm mb-3">
                  Simulates a common JavaScript TypeError when trying to iterate over undefined data.
                  This represents component rendering errors with missing data.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={runTest3}
                    disabled={test3.status === 'running'}
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                      test3.status === 'running'
                        ? 'bg-red-500/30 text-red-300 cursor-not-allowed'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    )}
                  >
                    {test3.status === 'running' ? 'Sending...' : 'Trigger Error'}
                  </button>
                  <StatusIcon status={test3.status} />
                </div>
                {test3.reportId && (
                  <p className="mt-2 text-xs text-green-400 font-mono">
                    Report ID: {test3.reportId}
                  </p>
                )}
                {test3.status === 'error' && test3.message && (
                  <p className="mt-2 text-xs text-red-400">
                    {test3.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link 
            href="/"
            className="text-accent-gold hover:underline text-sm"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Technical Info */}
        <div className="mt-8 glass-card p-4">
          <h4 className="text-sm font-semibold text-foreground-light mb-2">
            Environment Info
          </h4>
          <pre className="text-xs text-foreground-muted bg-black/30 p-3 rounded-lg overflow-x-auto">
            {JSON.stringify(getEnvironmentInfo(), null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

