'use client'

import { useState, useEffect } from 'react'
import { getEnvironmentInfo, type EnvironmentInfo } from '@/lib/bug-reporter'
import { trySafe, reportSupabaseError, reportFirebaseError } from '@/lib/bug-reporter/helpers'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePWA } from '@/hooks/usePWA'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { Bug, Database, Flame, Server, CheckCircle, AlertTriangle, Loader2, Bell, BellRing, Smartphone, Monitor } from 'lucide-react'
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
  const [test1, setTest1] = useState<TestResult>({ status: 'idle' })
  const [test2, setTest2] = useState<TestResult>({ status: 'idle' })
  const [test3, setTest3] = useState<TestResult>({ status: 'idle' })
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null)

  // Get environment info on client side only to avoid hydration mismatch
  useEffect(() => {
    setEnvInfo(getEnvironmentInfo())
  }, [])

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

        {/* Push Notification Debug Section */}
        <PushNotificationDebug />

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
            {envInfo ? JSON.stringify(envInfo, null, 2) : 'Loading...'}
          </pre>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Push Notification Debug Component
// =============================================================================

function PushNotificationDebug() {
  const push = usePushNotifications()
  const pwa = usePWA()
  const { customer, isLoggedIn: isCustomerLoggedIn } = useAuthStore()
  const { barber, isLoggedIn: isBarberLoggedIn } = useBarberAuthStore()
  
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [subscriptionCount, setSubscriptionCount] = useState<number | null>(null)

  // Fetch subscription count on mount
  useEffect(() => {
    fetchSubscriptionCount()
  }, [])

  const fetchSubscriptionCount = async () => {
    try {
      const response = await fetch('/api/push/vapid-key')
      const data = await response.json()
      if (data.configured) {
        // Get count from a simple API call (we'll use the status endpoint)
        setSubscriptionCount(push.devices.length)
      }
    } catch (err) {
      console.error('Error fetching subscription count:', err)
    }
  }

  // Send a test notification to current user
  const sendTestNotification = async () => {
    if (!push.isSubscribed) {
      toast.error('יש להירשם להתראות קודם')
      return
    }

    setSendingTest(true)
    setTestResult(null)

    try {
      const body: Record<string, unknown> = {
        title: '🔔 התראת בדיקה',
        body: 'זוהי התראת בדיקה מעמוד הדיבאג. אם אתה רואה את זה, ההתראות עובדות!',
        url: '/debug',
        tag: 'debug-test',
        requireInteraction: false
      }

      // Target current user
      if (isCustomerLoggedIn && customer?.id) {
        body.customerIds = [customer.id]
      } else if (isBarberLoggedIn && barber?.id) {
        body.barberIds = [barber.id]
      } else {
        throw new Error('יש להתחבר כדי לשלוח התראת בדיקה')
      }

      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        setTestResult({ success: true, message: `נשלחה בהצלחה ל-${data.sent} מכשירים` })
        toast.success('התראת בדיקה נשלחה!')
      } else {
        setTestResult({ success: false, message: data.error || 'שגיאה בשליחה' })
        toast.error('שגיאה בשליחת התראה')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      setTestResult({ success: false, message })
      toast.error(message)
    } finally {
      setSendingTest(false)
    }
  }

  // Get status badge color
  const getStatusColor = (condition: boolean) => {
    return condition ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
  }

  return (
    <div className="mt-8 space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Bell className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground-light">
            Push Notifications Debug
          </h2>
          <p className="text-xs text-foreground-muted">
            Test push notification system and view status
          </p>
        </div>
      </div>

      {/* Status Grid */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground-light mb-3">System Status</h3>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Push Supported */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
            <span className="text-xs text-foreground-muted">Push Supported</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(push.isSupported))}>
              {push.isSupported ? 'Yes' : 'No'}
            </span>
          </div>

          {/* Permission */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
            <span className="text-xs text-foreground-muted">Permission</span>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              push.permission === 'granted' ? 'bg-green-500/20 text-green-400' :
              push.permission === 'denied' ? 'bg-red-500/20 text-red-400' :
              'bg-amber-500/20 text-amber-400'
            )}>
              {push.permission}
            </span>
          </div>

          {/* Subscribed */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
            <span className="text-xs text-foreground-muted">Subscribed</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(push.isSubscribed))}>
              {push.isSubscribed ? 'Yes' : 'No'}
            </span>
          </div>

          {/* PWA Installed */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
            <span className="text-xs text-foreground-muted">PWA Installed</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(pwa.isStandalone))}>
              {pwa.isStandalone ? 'Yes' : 'No'}
            </span>
          </div>

          {/* Device Type */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
            <span className="text-xs text-foreground-muted">Device</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/10 text-foreground-light flex items-center gap-1">
              {pwa.deviceOS === 'ios' || pwa.deviceOS === 'android' ? (
                <Smartphone size={10} />
              ) : (
                <Monitor size={10} />
              )}
              {pwa.deviceOS}
            </span>
          </div>

          {/* User Logged In */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
            <span className="text-xs text-foreground-muted">Logged In</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(isCustomerLoggedIn || isBarberLoggedIn))}>
              {isCustomerLoggedIn ? 'Customer' : isBarberLoggedIn ? 'Barber' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Registered Devices */}
      {push.devices.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium text-foreground-light mb-3">
            Registered Devices ({push.devices.length})
          </h3>
          <div className="space-y-2">
            {push.devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  {device.deviceType === 'desktop' ? (
                    <Monitor size={14} className="text-foreground-muted" />
                  ) : (
                    <Smartphone size={14} className="text-foreground-muted" />
                  )}
                  <div>
                    <p className="text-xs text-foreground-light">{device.deviceName || 'Unknown'}</p>
                    <p className="text-[10px] text-foreground-muted font-mono">{device.id.slice(0, 8)}...</p>
                  </div>
                </div>
                <span className="text-[10px] text-foreground-muted">
                  {new Date(device.lastUsed).toLocaleDateString('he-IL')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Send Button */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-foreground-light mb-3">Send Test Notification</h3>
        
        {!push.isSubscribed ? (
          <div className="text-center py-4">
            <AlertTriangle size={24} className="text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-foreground-muted mb-3">
              {push.isSupported 
                ? 'יש להירשם להתראות כדי לבדוק שליחה'
                : 'הדפדפן אינו תומך בהתראות'}
            </p>
            {push.isSupported && (
              <button
                onClick={() => push.subscribe()}
                disabled={push.isLoading}
                className="px-4 py-2 bg-accent-gold text-background-dark rounded-lg text-sm font-medium hover:bg-accent-gold/90 transition-colors"
              >
                {push.isLoading ? 'מירשם...' : 'הרשמה להתראות'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={sendTestNotification}
              disabled={sendingTest}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all',
                sendingTest
                  ? 'bg-blue-500/30 text-blue-300 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              )}
            >
              {sendingTest ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>שולח...</span>
                </>
              ) : (
                <>
                  <BellRing size={18} />
                  <span>שלח התראת בדיקה</span>
                </>
              )}
            </button>

            {testResult && (
              <div className={cn(
                'flex items-center gap-2 p-3 rounded-lg',
                testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              )}>
                {testResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <span className="text-sm">{testResult.message}</span>
              </div>
            )}

            <p className="text-xs text-foreground-muted text-center">
              ההתראה תישלח לכל המכשירים הרשומים שלך. נסה לסגור את האפליקציה ולבדוק שההתראה מגיעה.
            </p>
          </div>
        )}
      </div>

      {/* VAPID Key Info */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-foreground-light mb-2">VAPID Configuration</h3>
        <div className="bg-black/30 p-3 rounded-lg">
          <p className="text-xs text-foreground-muted font-mono break-all">
            Public Key: {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.slice(0, 30)}...
          </p>
        </div>
      </div>
    </div>
  )
}

