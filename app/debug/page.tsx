'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  Send, User, Bell, RefreshCw, Users, ArrowRight, AlertCircle, CheckCircle, 
  X, Info, Smartphone, Monitor, Eye, Check
} from 'lucide-react'

interface PushSubscriptionRow {
  id: string
  customer_id: string | null
  barber_id: string | null
  device_type: string
  device_name: string | null
  is_active: boolean | null
  endpoint: string
  last_used: string | null
  created_at: string | null
  user_agent: string | null
  consecutive_failures: number | null
  last_delivery_status: string | null
  p256dh: string
  auth: string
  // Enriched data
  customer_name?: string | null
  customer_phone?: string | null
  barber_name?: string | null
  barber_email?: string | null
}

interface NotificationForm {
  title: string
  body: string
  url: string
}

// Device icon component
const DeviceIcon = ({ type }: { type: string }) => {
  if (type === 'desktop') return <Monitor size={14} />
  return <Smartphone size={14} />
}

// Format date helper
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'לא ידוע'
  const date = new Date(dateStr)
  return date.toLocaleDateString('he-IL', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Subscription detail modal
function SubscriptionDetailModal({ 
  subscription, 
  onClose 
}: { 
  subscription: PushSubscriptionRow | null
  onClose: () => void 
}) {
  if (!subscription) return null

  const userType = subscription.barber_id ? 'barber' : 'customer'
  const userName = subscription.barber_name || subscription.customer_name || 'לא ידוע'
  const userContact = subscription.barber_email || subscription.customer_phone || 'לא ידוע'

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-background-darker border border-white/10 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-background-darker">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              userType === 'barber' ? 'bg-blue-500/20' : 'bg-green-500/20'
            )}>
              {userType === 'barber' ? <Users size={20} className="text-blue-400" /> : <User size={20} className="text-green-400" />}
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground-light">{userName}</h3>
              <p className="text-xs text-foreground-muted">{userType === 'barber' ? 'ספר' : 'לקוח'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-foreground-muted hover:text-foreground-light transition-colors rounded-full hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* User Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground-light flex items-center gap-2">
              <User size={14} className="text-accent-gold" />
              פרטי משתמש
            </h4>
            <div className="bg-white/5 rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-muted">שם</span>
                <span className="text-foreground-light">{userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">{userType === 'barber' ? 'אימייל' : 'טלפון'}</span>
                <span className="text-foreground-light" dir="ltr">{userContact}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">מזהה</span>
                <span className="text-foreground-light text-xs font-mono" dir="ltr">
                  {(subscription.barber_id || subscription.customer_id || '').slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>

          {/* Device Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground-light flex items-center gap-2">
              <Smartphone size={14} className="text-accent-gold" />
              פרטי מכשיר
            </h4>
            <div className="bg-white/5 rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-foreground-muted">סוג</span>
                <span className="text-foreground-light flex items-center gap-2">
                  <DeviceIcon type={subscription.device_type} />
                  {subscription.device_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">שם מכשיר</span>
                <span className="text-foreground-light">{subscription.device_name || 'לא ידוע'}</span>
              </div>
              {subscription.user_agent && (
                <div className="pt-2 border-t border-white/5">
                  <span className="text-foreground-muted text-xs block mb-1">User Agent</span>
                  <span className="text-foreground-light text-xs font-mono break-all" dir="ltr">
                    {subscription.user_agent.slice(0, 100)}...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Subscription Status */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground-light flex items-center gap-2">
              <Bell size={14} className="text-accent-gold" />
              סטטוס מנוי
            </h4>
            <div className="bg-white/5 rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-foreground-muted">פעיל</span>
                <span className={cn(
                  'flex items-center gap-1',
                  subscription.is_active ? 'text-green-400' : 'text-red-400'
                )}>
                  {subscription.is_active ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {subscription.is_active ? 'כן' : 'לא'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">נרשם בתאריך</span>
                <span className="text-foreground-light">{formatDate(subscription.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">שימוש אחרון</span>
                <span className="text-foreground-light">{formatDate(subscription.last_used)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">סטטוס שליחה אחרון</span>
                <span className={cn(
                  subscription.last_delivery_status === 'success' ? 'text-green-400' : 
                  subscription.last_delivery_status === 'failed' ? 'text-red-400' : 'text-foreground-muted'
                )}>
                  {subscription.last_delivery_status || 'לא נשלח עדיין'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">כשלונות רצופים</span>
                <span className={cn(
                  (subscription.consecutive_failures || 0) > 0 ? 'text-amber-400' : 'text-foreground-light'
                )}>
                  {subscription.consecutive_failures || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Endpoint (technical) */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground-light flex items-center gap-2">
              <Info size={14} className="text-accent-gold" />
              מידע טכני
            </h4>
            <div className="bg-white/5 rounded-xl p-3 space-y-2 text-xs">
              <div>
                <span className="text-foreground-muted block mb-1">Subscription ID</span>
                <span className="text-foreground-light font-mono break-all" dir="ltr">{subscription.id}</span>
              </div>
              <div>
                <span className="text-foreground-muted block mb-1">Endpoint</span>
                <span className="text-foreground-light font-mono break-all" dir="ltr">
                  {subscription.endpoint.slice(0, 60)}...
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DebugPage() {
  const router = useRouter()
  const { isAdmin, isLoggedIn, isInitialized } = useBarberAuthStore()
  
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(new Set())
  const [detailSubscription, setDetailSubscription] = useState<PushSubscriptionRow | null>(null)
  const [form, setForm] = useState<NotificationForm>({
    title: 'הודעת בדיקה',
    body: 'זוהי הודעת בדיקה מהמערכת',
    url: '/',
  })
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; sent?: number; failed?: number } | null>(null)

  // Check admin access
  useEffect(() => {
    if (isInitialized && (!isLoggedIn || !isAdmin)) {
      router.replace('/barber/login')
    }
  }, [isInitialized, isLoggedIn, isAdmin, router])

  // Fetch subscriptions
  const fetchSubscriptions = async () => {
    setLoading(true)
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching subscriptions:', error)
      toast.error('שגיאה בטעינת המנויים')
      setLoading(false)
      return
    }

    // Enrich with user data
    const enrichedData: PushSubscriptionRow[] = []
    
    for (const sub of data || []) {
      const enriched: PushSubscriptionRow = { ...sub }
      
      if (sub.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('fullname, phone')
          .eq('id', sub.customer_id)
          .single()
        enriched.customer_name = customer?.fullname
        enriched.customer_phone = customer?.phone
      }
      
      if (sub.barber_id) {
        const { data: barber } = await supabase
          .from('users')
          .select('fullname, email')
          .eq('id', sub.barber_id)
          .single()
        enriched.barber_name = barber?.fullname
        enriched.barber_email = barber?.email
      }
      
      enrichedData.push(enriched)
    }
    
    setSubscriptions(enrichedData)
    setLoading(false)
  }

  useEffect(() => {
    if (isInitialized && isLoggedIn && isAdmin) {
      fetchSubscriptions()
    }
  }, [isInitialized, isLoggedIn, isAdmin])

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedSubscriptions(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Select all
  const selectAll = () => {
    if (selectedSubscriptions.size === subscriptions.length) {
      setSelectedSubscriptions(new Set())
    } else {
      setSelectedSubscriptions(new Set(subscriptions.map(s => s.id)))
    }
  }

  // Select by type
  const selectByType = (type: 'barber' | 'customer') => {
    const filtered = subscriptions.filter(s => type === 'barber' ? s.barber_id : s.customer_id)
    setSelectedSubscriptions(new Set(filtered.map(s => s.id)))
  }

  // Send custom notification
  const handleSendNotification = async () => {
    if (selectedSubscriptions.size === 0) {
      toast.error('בחר לפחות מנוי אחד לשליחה')
      return
    }
    
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('נדרש כותרת ותוכן')
      return
    }

    setSending(true)
    setSendResult(null)

    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const subId of selectedSubscriptions) {
      try {
        const response = await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: subId,
            title: form.title,
            body: form.body,
            url: form.url || '/',
          }),
        })

        if (response.ok) {
          sent++
        } else {
          failed++
          const result = await response.json()
          errors.push(result.error || 'Unknown error')
        }
      } catch (error) {
        failed++
        errors.push(String(error))
      }
    }

    if (sent > 0) {
      setSendResult({ 
        success: true, 
        message: `נשלחו ${sent} הודעות בהצלחה${failed > 0 ? `, ${failed} נכשלו` : ''}`,
        sent,
        failed
      })
      toast.success(`נשלחו ${sent} הודעות!`)
    } else {
      setSendResult({ success: false, message: errors[0] || 'כל השליחות נכשלו', sent: 0, failed })
      toast.error('שליחה נכשלה')
    }

    setSending(false)
    fetchSubscriptions() // Refresh to update last_used
  }

  // Group subscriptions
  const customerSubs = subscriptions.filter(s => s.customer_id)
  const barberSubs = subscriptions.filter(s => s.barber_id)

  if (!isInitialized || loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-foreground-muted">טוען...</div>
      </div>
    )
  }

  if (!isLoggedIn || !isAdmin) {
    return null
  }

  return (
    <main className="min-h-screen bg-background-dark pt-8 pb-32 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-medium text-foreground-light mb-1">
              🔧 Debug - Push Notifications
            </h1>
            <p className="text-foreground-muted text-sm">
              שליחת התראות מותאמות אישית למשתמשים רשומים
            </p>
          </div>
          <button
            onClick={fetchSubscriptions}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-foreground-light hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>רענן</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-gold/10 flex items-center justify-center">
                <Bell size={20} className="text-accent-gold" />
              </div>
              <div>
                <p className="text-2xl font-medium text-foreground-light">{subscriptions.length}</p>
                <p className="text-xs text-foreground-muted">סה״כ פעילים</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <User size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-medium text-foreground-light">{customerSubs.length}</p>
                <p className="text-xs text-foreground-muted">לקוחות</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-medium text-foreground-light">{barberSubs.length}</p>
                <p className="text-xs text-foreground-muted">ספרים</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Check size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-medium text-foreground-light">{selectedSubscriptions.size}</p>
                <p className="text-xs text-foreground-muted">נבחרו</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Subscription List - 3 columns */}
          <div className="lg:col-span-3 glass-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-medium text-foreground-light">בחר נמענים</h2>
              <div className="flex items-center gap-2 text-xs">
                <button 
                  onClick={selectAll}
                  className="px-3 py-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-foreground-muted hover:text-foreground-light"
                >
                  {selectedSubscriptions.size === subscriptions.length ? 'בטל הכל' : 'בחר הכל'}
                </button>
                <button 
                  onClick={() => selectByType('barber')}
                  className="px-3 py-1.5 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors text-blue-400"
                >
                  ספרים
                </button>
                <button 
                  onClick={() => selectByType('customer')}
                  className="px-3 py-1.5 bg-green-500/10 rounded-lg hover:bg-green-500/20 transition-colors text-green-400"
                >
                  לקוחות
                </button>
              </div>
            </div>
            
            {subscriptions.length === 0 ? (
              <p className="text-foreground-muted text-sm py-8 text-center">אין מנויים פעילים</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {/* Barbers */}
                {barberSubs.length > 0 && (
                  <>
                    <p className="text-xs text-foreground-muted font-medium uppercase tracking-wide mb-2 sticky top-0 bg-background-darker py-1">
                      ספרים ({barberSubs.length})
                    </p>
                    {barberSubs.map((sub) => (
                      <div
                        key={sub.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all',
                          selectedSubscriptions.has(sub.id)
                            ? 'bg-accent-gold/10 border-accent-gold/30'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                        )}
                      >
                        <button
                          onClick={() => toggleSelection(sub.id)}
                          className={cn(
                            'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                            selectedSubscriptions.has(sub.id)
                              ? 'bg-accent-gold border-accent-gold'
                              : 'border-white/20 hover:border-white/40'
                          )}
                        >
                          {selectedSubscriptions.has(sub.id) && <Check size={14} className="text-background-dark" />}
                        </button>
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                          'bg-blue-500/10'
                        )}>
                          <Users size={14} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground-light truncate">
                            {sub.barber_name || 'ספר לא ידוע'}
                          </p>
                          <p className="text-xs text-foreground-muted truncate flex items-center gap-2">
                            <DeviceIcon type={sub.device_type} />
                            <span>{sub.device_type}</span>
                            <span className="text-white/20">•</span>
                            <span>{formatDate(sub.created_at).split(',')[0]}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => setDetailSubscription(sub)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:text-accent-gold hover:bg-white/5 transition-colors"
                          title="פרטים נוספים"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
                
                {/* Customers */}
                {customerSubs.length > 0 && (
                  <>
                    <p className="text-xs text-foreground-muted font-medium uppercase tracking-wide mb-2 mt-4 sticky top-0 bg-background-darker py-1">
                      לקוחות ({customerSubs.length})
                    </p>
                    {customerSubs.map((sub) => (
                      <div
                        key={sub.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all',
                          selectedSubscriptions.has(sub.id)
                            ? 'bg-accent-gold/10 border-accent-gold/30'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                        )}
                      >
                        <button
                          onClick={() => toggleSelection(sub.id)}
                          className={cn(
                            'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                            selectedSubscriptions.has(sub.id)
                              ? 'bg-accent-gold border-accent-gold'
                              : 'border-white/20 hover:border-white/40'
                          )}
                        >
                          {selectedSubscriptions.has(sub.id) && <Check size={14} className="text-background-dark" />}
                        </button>
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                          'bg-green-500/10'
                        )}>
                          <User size={14} className="text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground-light truncate">
                            {sub.customer_name || 'לקוח לא ידוע'}
                          </p>
                          <p className="text-xs text-foreground-muted truncate flex items-center gap-2">
                            <DeviceIcon type={sub.device_type} />
                            <span>{sub.device_type}</span>
                            <span className="text-white/20">•</span>
                            <span>{formatDate(sub.created_at).split(',')[0]}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => setDetailSubscription(sub)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:text-accent-gold hover:bg-white/5 transition-colors"
                          title="פרטים נוספים"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Notification Form - 2 columns */}
          <div className="lg:col-span-2 glass-card p-5">
            <h2 className="text-lg font-medium text-foreground-light mb-4">תוכן ההודעה</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-foreground-muted mb-1">כותרת</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="הזן כותרת..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground-light placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
                />
              </div>
              
              <div>
                <label className="block text-sm text-foreground-muted mb-1">תוכן</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="הזן תוכן ההודעה..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground-light placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/50 resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-foreground-muted mb-1">קישור (אופציונלי)</label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="/"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground-light placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
                />
              </div>

              {/* Preview */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-xs text-foreground-muted mb-2">תצוגה מקדימה</p>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-gold/20 flex items-center justify-center shrink-0">
                    <Bell size={18} className="text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground-light">{form.title || 'כותרת'}</p>
                    <p className="text-xs text-foreground-muted">{form.body || 'תוכן ההודעה'}</p>
                  </div>
                </div>
              </div>

              {/* Result */}
              {sendResult && (
                <div className={cn(
                  'flex items-start gap-2 p-3 rounded-xl',
                  sendResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                )}>
                  {sendResult.success ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                  <div className="text-sm">
                    <p>{sendResult.message}</p>
                    {sendResult.sent !== undefined && (
                      <p className="text-xs opacity-70 mt-1">
                        נשלחו: {sendResult.sent} | נכשלו: {sendResult.failed}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleSendNotification}
                disabled={selectedSubscriptions.size === 0 || sending}
                className={cn(
                  'w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                  selectedSubscriptions.size > 0 && !sending
                    ? 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
                    : 'bg-white/10 text-foreground-muted cursor-not-allowed'
                )}
              >
                {sending ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>שולח {selectedSubscriptions.size} הודעות...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>
                      {selectedSubscriptions.size > 0 
                        ? `שלח ל-${selectedSubscriptions.size} נמענים`
                        : 'בחר נמענים לשליחה'
                      }
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <h3 className="text-sm font-medium text-foreground-light mb-2">📋 מידע על מנויים</h3>
          <ul className="text-xs text-foreground-muted space-y-1">
            <li>• כל מנוי מייצג מכשיר ספציפי (לא משתמש) - משתמש יכול להיות רשום ממספר מכשירים</li>
            <li>• משתמש שהתנתק ונכנס עם חשבון אחר מעדכן את המנוי הקיים לחשבון החדש</li>
            <li>• מנויי לקוח וספר נפרדים - אותו מכשיר יכול להיות רשום לשניהם</li>
            <li>• מנויים לא פעילים (אחרי 90 יום ללא שימוש או 5 כשלונות) מוסרים אוטומטית</li>
            <li>• לחצו על 👁️ לצפייה בפרטים מלאים של כל מנוי</li>
          </ul>
        </div>

        {/* Back link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/barber/dashboard')}
            className="inline-flex items-center gap-2 text-foreground-muted hover:text-accent-gold transition-colors"
          >
            <ArrowRight size={16} />
            <span>חזרה לדאשבורד</span>
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      <SubscriptionDetailModal 
        subscription={detailSubscription} 
        onClose={() => setDetailSubscription(null)} 
      />
    </main>
  )
}
