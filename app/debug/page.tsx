'use client'

import { useState, useEffect } from 'react'
import { getEnvironmentInfo, type EnvironmentInfo } from '@/lib/bug-reporter'
import { trySafe, reportSupabaseError, reportFirebaseError } from '@/lib/bug-reporter/helpers'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePWA } from '@/hooks/usePWA'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { 
  Bug, 
  Database, 
  Flame, 
  Server, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Bell, 
  BellRing, 
  Smartphone, 
  Monitor,
  Send,
  Users,
  Radio,
  RefreshCw,
  Trash2,
  ChevronDown,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

type TabType = 'bugs' | 'push'
type TestStatus = 'idle' | 'running' | 'success' | 'error'

interface TestResult {
  status: TestStatus
  reportId?: string | null
  message?: string
}

interface PushSubscriptionInfo {
  id: string
  customer_id: string | null
  barber_id: string | null
  device_type: string
  device_name: string | null
  is_active: boolean
  last_used: string
  created_at: string
}

export default function DebugPage() {
  const [activeTab, setActiveTab] = useState<TabType>('push')
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null)

  // Get environment info on client side only to avoid hydration mismatch
  useEffect(() => {
    setEnvInfo(getEnvironmentInfo())
  }, [])

  return (
    <div className="min-h-screen bg-background-dark text-foreground-light p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent-gold/20 flex items-center justify-center">
            <Bug className="w-6 h-6 text-accent-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground-light">Debug Panel</h1>
            <p className="text-sm text-foreground-muted">Developer tools and diagnostics</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('push')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all',
              activeTab === 'push'
                ? 'bg-accent-gold text-background-dark'
                : 'text-foreground-muted hover:text-foreground-light hover:bg-white/5'
            )}
          >
            <Bell size={18} />
            <span>Push Notifications</span>
          </button>
          <button
            onClick={() => setActiveTab('bugs')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all',
              activeTab === 'bugs'
                ? 'bg-accent-gold text-background-dark'
                : 'text-foreground-muted hover:text-foreground-light hover:bg-white/5'
            )}
          >
            <Bug size={18} />
            <span>Bug Reports</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'push' ? (
          <PushNotificationDebug />
        ) : (
          <BugReportDebug />
        )}

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
// Bug Report Debug Section
// =============================================================================

function BugReportDebug() {
  const [test1, setTest1] = useState<TestResult>({ status: 'idle' })
  const [test2, setTest2] = useState<TestResult>({ status: 'idle' })
  const [test3, setTest3] = useState<TestResult>({ status: 'idle' })

  // Test 1: Simulate a Database/API Error
  const runTest1 = async () => {
    setTest1({ status: 'running' })
    
    try {
      const mockSupabaseError = {
        message: 'relation "nonexistent_table" does not exist',
        code: '42P01',
        details: 'The table you are trying to query does not exist in the database',
        hint: 'Check the table name and ensure migrations have been run',
      }
      
      const reportId = await reportSupabaseError(
        mockSupabaseError,
        'Fetching user profile data from dashboard',
        { table: 'users', operation: 'select' }
      )
      
      setTest1({ 
        status: 'success', 
        reportId,
        message: 'Database error report sent successfully!'
      })
      toast.success('Bug report sent!')
    } catch (error) {
      setTest1({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      })
      toast.error('Failed to send report')
    }
  }

  // Test 2: Simulate a Firebase Authentication Error
  const runTest2 = async () => {
    setTest2({ status: 'running' })
    
    try {
      const mockFirebaseError = {
        code: 'auth/invalid-phone-number',
        message: 'The phone number is not in a valid format',
        name: 'FirebaseError',
      }
      
      const reportId = await reportFirebaseError(
        mockFirebaseError,
        'Sending OTP to user phone number during booking',
        { phone: '+972-invalid' }
      )
      
      setTest2({ 
        status: 'success', 
        reportId,
        message: 'Firebase error report sent successfully!'
      })
      toast.success('Bug report sent!')
    } catch (error) {
      setTest2({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      })
      toast.error('Failed to send report')
    }
  }

  // Test 3: Simulate a JavaScript Runtime Error
  const runTest3 = async () => {
    setTest3({ status: 'running' })
    
    try {
      const result = await trySafe(
        async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const obj: any = null
          return obj.someProperty.nestedProperty
        },
        'Processing payment confirmation callback',
        { component: 'PaymentProcessor' }
      )
      
      if (result.success) {
        setTest3({ status: 'success', message: 'Operation succeeded (unexpected!)' })
      } else {
        setTest3({ 
          status: 'success', 
          reportId: result.reportId,
          message: 'Runtime error caught and reported!'
        })
        toast.success('Bug report sent!')
      }
    } catch (error) {
      setTest3({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      })
      toast.error('Failed to send report')
    }
  }

  const renderTestCard = (
    title: string,
    description: string,
    icon: React.ReactNode,
    result: TestResult,
    onRun: () => void
  ) => (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-foreground-light">{title}</h3>
          <p className="text-xs text-foreground-muted mt-1">{description}</p>
        </div>
      </div>
      
      <button
        onClick={onRun}
        disabled={result.status === 'running'}
        className={cn(
          'w-full py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
          result.status === 'running'
            ? 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
        )}
      >
        {result.status === 'running' ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Simulating...</span>
          </>
        ) : (
          <>
            <Bug size={16} />
            <span>Trigger Error</span>
          </>
        )}
      </button>
      
      {result.status === 'success' && (
        <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 p-2 rounded-lg">
          <CheckCircle size={14} />
          <span>{result.message}</span>
        </div>
      )}
      {result.reportId && (
        <p className="text-xs text-foreground-muted font-mono">
          Report ID: {result.reportId}
        </p>
      )}
      {result.status === 'error' && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 p-2 rounded-lg">
          <AlertTriangle size={14} />
          <span>{result.message}</span>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
          <Bug className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground-light">
            Bug Report Testing
          </h2>
          <p className="text-xs text-foreground-muted">
            Simulate errors and verify bug reports are sent correctly
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {renderTestCard(
          'Database Error',
          'Simulates a Supabase database query failure',
          <Database className="w-5 h-5 text-red-400" />,
          test1,
          runTest1
        )}
        {renderTestCard(
          'Firebase Error',
          'Simulates a Firebase authentication failure',
          <Flame className="w-5 h-5 text-red-400" />,
          test2,
          runTest2
        )}
        {renderTestCard(
          'Runtime Error',
          'Simulates a JavaScript null reference exception',
          <Server className="w-5 h-5 text-red-400" />,
          test3,
          runTest3
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Push Notification Debug Section
// =============================================================================

function PushNotificationDebug() {
  const push = usePushNotifications()
  const pwa = usePWA()
  const { customer, isLoggedIn: isCustomerLoggedIn } = useAuthStore()
  const { barber, isLoggedIn: isBarberLoggedIn } = useBarberAuthStore()
  
  // State
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [allSubscriptions, setAllSubscriptions] = useState<PushSubscriptionInfo[]>([])
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>('status')
  
  // Send options
  const [sendMode, setSendMode] = useState<'self' | 'user' | 'broadcast'>('self')
  const [targetUserId, setTargetUserId] = useState('')
  const [testTitle, setTestTitle] = useState('🔔 התראת בדיקה')
  const [testBody, setTestBody] = useState('זוהי התראת בדיקה מעמוד הדיבאג')

  // Fetch all subscriptions (admin feature)
  const fetchAllSubscriptions = async () => {
    setLoadingSubscriptions(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setAllSubscriptions(data || [])
    } catch (err) {
      console.error('Error fetching subscriptions:', err)
      toast.error('שגיאה בטעינת המנויים')
    } finally {
      setLoadingSubscriptions(false)
    }
  }

  // Delete a subscription
  const handleDeleteSubscription = async (id: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setAllSubscriptions(prev => prev.filter(s => s.id !== id))
      toast.success('המנוי נמחק')
    } catch (err) {
      console.error('Error deleting subscription:', err)
      toast.error('שגיאה במחיקת המנוי')
    }
  }

  // Send test notification
  const sendTestNotification = async () => {
    setSendingTest(true)
    setTestResult(null)

    try {
      const body: Record<string, unknown> = {
        title: testTitle,
        body: testBody,
        url: '/debug',
        tag: 'debug-test',
        requireInteraction: false
      }

      // Determine target based on mode
      if (sendMode === 'broadcast') {
        body.broadcast = true
      } else if (sendMode === 'user' && targetUserId) {
        // Check if it's a customer or barber ID
        const supabase = createClient()
        const { data: customerData } = await supabase
          .from('customers')
          .select('id')
          .eq('id', targetUserId)
          .single()
        
        if (customerData) {
          body.customerIds = [targetUserId]
        } else {
          body.barberIds = [targetUserId]
        }
      } else {
        // Self - current user
        if (isCustomerLoggedIn && customer?.id) {
          body.customerIds = [customer.id]
        } else if (isBarberLoggedIn && barber?.id) {
          body.barberIds = [barber.id]
        } else {
          throw new Error('יש להתחבר כדי לשלוח התראה לעצמך')
        }
      }

      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        setTestResult({ success: true, message: `נשלחה בהצלחה ל-${data.sent} מכשירים (${data.failed} נכשלו)` })
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

  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  // Get status badge
  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => (
    <span className={cn(
      'text-xs px-2 py-0.5 rounded-full font-medium',
      condition ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    )}>
      {condition ? trueText : falseText}
    </span>
  )

  return (
    <div className="space-y-4">
      {/* Section: System Status */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => toggleSection('status')}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-foreground-light">System Status</h3>
              <p className="text-xs text-foreground-muted">Push notification system status</p>
            </div>
          </div>
          <ChevronDown className={cn(
            'text-foreground-muted transition-transform',
            expandedSection === 'status' && 'rotate-180'
          )} />
        </button>
        
        {expandedSection === 'status' && (
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <span className="text-xs text-foreground-muted">Push Supported</span>
                {getStatusBadge(push.isSupported, 'Yes', 'No')}
              </div>
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
              <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <span className="text-xs text-foreground-muted">Subscribed</span>
                {getStatusBadge(push.isSubscribed, 'Yes', 'No')}
              </div>
              <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <span className="text-xs text-foreground-muted">PWA Mode</span>
                {getStatusBadge(pwa.isStandalone, 'Yes', 'No')}
              </div>
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
              <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <span className="text-xs text-foreground-muted">Logged In</span>
                {getStatusBadge(isCustomerLoggedIn || isBarberLoggedIn, 
                  isCustomerLoggedIn ? 'Customer' : 'Barber', 'No')}
              </div>
            </div>
            
            {/* Quick subscribe button */}
            {push.isSupported && !push.isSubscribed && (
              <button
                onClick={() => push.subscribe()}
                disabled={push.isLoading}
                className="w-full py-2.5 bg-accent-gold text-background-dark rounded-lg font-medium hover:bg-accent-gold/90 transition-all flex items-center justify-center gap-2"
              >
                {push.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                <span>Subscribe to Push</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Section: Send Test Notification */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => toggleSection('send')}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Send className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-foreground-light">Send Test Notification</h3>
              <p className="text-xs text-foreground-muted">Send to self, specific user, or broadcast</p>
            </div>
          </div>
          <ChevronDown className={cn(
            'text-foreground-muted transition-transform',
            expandedSection === 'send' && 'rotate-180'
          )} />
        </button>
        
        {expandedSection === 'send' && (
          <div className="px-4 pb-4 space-y-4">
            {/* Send Mode Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setSendMode('self')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
                  sendMode === 'self'
                    ? 'bg-accent-gold text-background-dark'
                    : 'bg-white/5 text-foreground-muted hover:bg-white/10'
                )}
              >
                <Smartphone size={14} />
                <span>To Self</span>
              </button>
              <button
                onClick={() => setSendMode('user')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
                  sendMode === 'user'
                    ? 'bg-accent-gold text-background-dark'
                    : 'bg-white/5 text-foreground-muted hover:bg-white/10'
                )}
              >
                <Users size={14} />
                <span>To User</span>
              </button>
              <button
                onClick={() => setSendMode('broadcast')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
                  sendMode === 'broadcast'
                    ? 'bg-accent-gold text-background-dark'
                    : 'bg-white/5 text-foreground-muted hover:bg-white/10'
                )}
              >
                <Radio size={14} />
                <span>Broadcast</span>
              </button>
            </div>

            {/* Target User ID Input (for user mode) */}
            {sendMode === 'user' && (
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="Customer or Barber UUID"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-foreground-light placeholder:text-foreground-muted focus:outline-none focus:border-accent-gold/50"
              />
            )}

            {/* Message Content */}
            <div className="space-y-3">
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="Notification Title"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-foreground-light placeholder:text-foreground-muted focus:outline-none focus:border-accent-gold/50"
              />
              <input
                type="text"
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                placeholder="Notification Body"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-foreground-light placeholder:text-foreground-muted focus:outline-none focus:border-accent-gold/50"
              />
            </div>

            {/* Send Button */}
            <button
              onClick={sendTestNotification}
              disabled={sendingTest || (sendMode === 'user' && !targetUserId)}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all',
                sendingTest || (sendMode === 'user' && !targetUserId)
                  ? 'bg-green-500/30 text-green-300 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              )}
            >
              {sendingTest ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <BellRing size={18} />
                  <span>Send Test Notification</span>
                </>
              )}
            </button>

            {/* Result */}
            {testResult && (
              <div className={cn(
                'flex items-center gap-2 p-3 rounded-lg',
                testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              )}>
                {testResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <span className="text-sm">{testResult.message}</span>
              </div>
            )}

            {sendMode === 'broadcast' && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle size={12} />
                <span>Warning: This will send to ALL subscribed users!</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Section: My Devices */}
      {push.devices.length > 0 && (
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => toggleSection('devices')}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-foreground-light">My Devices ({push.devices.length})</h3>
                <p className="text-xs text-foreground-muted">Registered push subscriptions</p>
              </div>
            </div>
            <ChevronDown className={cn(
              'text-foreground-muted transition-transform',
              expandedSection === 'devices' && 'rotate-180'
            )} />
          </button>
          
          {expandedSection === 'devices' && (
            <div className="px-4 pb-4 space-y-2">
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
                  <button
                    onClick={() => push.removeDevice(device.id)}
                    className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section: All Subscriptions (Admin) */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => {
            toggleSection('all')
            if (expandedSection !== 'all') {
              fetchAllSubscriptions()
            }
          }}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-medium text-foreground-light">All Subscriptions</h3>
              <p className="text-xs text-foreground-muted">View all registered devices (Admin)</p>
            </div>
          </div>
          <ChevronDown className={cn(
            'text-foreground-muted transition-transform',
            expandedSection === 'all' && 'rotate-180'
          )} />
        </button>
        
        {expandedSection === 'all' && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground-muted">
                {allSubscriptions.length} subscriptions total
              </span>
              <button
                onClick={fetchAllSubscriptions}
                disabled={loadingSubscriptions}
                className="p-2 text-foreground-muted hover:text-foreground-light transition-colors"
              >
                <RefreshCw size={14} className={cn(loadingSubscriptions && 'animate-spin')} />
              </button>
            </div>
            
            {loadingSubscriptions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-foreground-muted" />
              </div>
            ) : allSubscriptions.length === 0 ? (
              <p className="text-center text-foreground-muted py-4">No subscriptions found</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {allSubscriptions.map((sub) => (
                  <div key={sub.id} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {sub.device_type === 'desktop' ? (
                          <Monitor size={14} className="text-foreground-muted" />
                        ) : (
                          <Smartphone size={14} className="text-foreground-muted" />
                        )}
                        <div>
                          <p className="text-xs text-foreground-light">{sub.device_name || 'Unknown Device'}</p>
                          <p className="text-[10px] text-foreground-muted font-mono">
                            {sub.customer_id ? `Customer: ${sub.customer_id.slice(0, 8)}...` :
                             sub.barber_id ? `Barber: ${sub.barber_id.slice(0, 8)}...` : 'No user'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded',
                          sub.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        )}>
                          {sub.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => handleDeleteSubscription(sub.id)}
                          className="p-1 text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-foreground-muted">
                      <span>Created: {new Date(sub.created_at).toLocaleDateString('he-IL')}</span>
                      <span>Last: {new Date(sub.last_used).toLocaleDateString('he-IL')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
