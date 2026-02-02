'use client'

import { useEffect, useState, useMemo } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getExternalLinkProps } from '@/lib/utils/external-link'
import { 
  Users, 
  Search, 
  MessageCircle, 
  Bell, 
  BellOff, 
  Calendar, 
  User,
  Phone,
  Smartphone,
  X,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  History
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { useBugReporter } from '@/hooks/useBugReporter'

// Types
interface CustomerWithStats {
  id: string
  fullname: string
  phone: string
  email: string | null
  created_at: string | null
  is_blocked: boolean | null
  totalAppointments: number
  upcomingAppointments: number
  lastAppointment: number | null
  firstAppointment: number | null
  hasPushEnabled: boolean
  deviceCount: number
}


// Phone formatting for WhatsApp
const formatPhoneForWhatsApp = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.substring(1)
  } else if (!cleaned.startsWith('972')) {
    cleaned = '972' + cleaned
  }
  
  return cleaned
}

// Format phone for display
const formatPhoneDisplay = (phone: string): string => {
  if (!phone) return ''
  // Handle walkin placeholder phones
  if (phone.startsWith('walkin-')) return 'לקוח ללא טלפון'
  return phone
}

export default function MyCustomersPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('MyCustomersPage')
  
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'total'>('recent')
  const [sortDesc, setSortDesc] = useState(true)
  
  // Push modal state
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null)
  const [pushTitle, setPushTitle] = useState('')
  const [pushBody, setPushBody] = useState('')
  const [sendingPush, setSendingPush] = useState(false)

  useEffect(() => {
    if (barber?.id) {
      fetchCustomers()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])

  const fetchCustomers = async () => {
    if (!barber?.id) return
    
    setLoading(true)
    const supabase = createClient()
    const now = Date.now()
    
    try {
      // 1. Get all reservations for this barber (both past and future)
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('customer_id, customer_name, customer_phone, time_timestamp, status')
        .eq('barber_id', barber.id)
        .not('customer_id', 'is', null)
        .order('time_timestamp', { ascending: false })
      
      if (resError) {
        console.error('Error fetching reservations:', resError)
        await report(new Error(resError.message), 'Fetching customer reservations')
        toast.error('שגיאה בטעינת הנתונים')
        setLoading(false)
        return
      }
      
      if (!reservations || reservations.length === 0) {
        setCustomers([])
        setLoading(false)
        return
      }
      
      // 2. Get unique customer IDs
      const customerIds = [...new Set(reservations.map(r => r.customer_id).filter(Boolean))] as string[]
      
      // 3. Get customer details
      const { data: customersData, error: custError } = await supabase
        .from('customers')
        .select('id, fullname, phone, email, created_at, is_blocked')
        .in('id', customerIds)
      
      if (custError) {
        console.error('Error fetching customers:', custError)
        await report(new Error(custError.message), 'Fetching customer details')
        toast.error('שגיאה בטעינת פרטי הלקוחות')
        setLoading(false)
        return
      }
      
      // 4. Get push subscription status for all customers
      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('customer_id')
        .in('customer_id', customerIds)
        .eq('is_active', true)
      
      if (subError) {
        console.error('Error fetching subscriptions:', subError)
        // Don't fail - just continue without push status
      }
      
      // Create a map of customer subscriptions
      const subscriptionMap = new Map<string, number>()
      subscriptions?.forEach(sub => {
        if (!sub.customer_id) return
        const count = subscriptionMap.get(sub.customer_id) || 0
        subscriptionMap.set(sub.customer_id, count + 1)
      })
      
      // 5. Calculate stats for each customer
      const customerStatsMap = new Map<string, {
        totalAppointments: number
        upcomingAppointments: number
        lastAppointment: number | null
        firstAppointment: number | null
      }>()
      
      reservations.forEach(res => {
        if (!res.customer_id) return
        
        const existing = customerStatsMap.get(res.customer_id) || {
          totalAppointments: 0,
          upcomingAppointments: 0,
          lastAppointment: null,
          firstAppointment: null
        }
        
        if (res.status === 'confirmed') {
          existing.totalAppointments++
          
          if (res.time_timestamp > now) {
            existing.upcomingAppointments++
          }
          
          // Track last (most recent past) and first appointment
          if (res.time_timestamp <= now) {
            if (!existing.lastAppointment || res.time_timestamp > existing.lastAppointment) {
              existing.lastAppointment = res.time_timestamp
            }
          }
          
          if (!existing.firstAppointment || res.time_timestamp < existing.firstAppointment) {
            existing.firstAppointment = res.time_timestamp
          }
        }
        
        customerStatsMap.set(res.customer_id, existing)
      })
      
      // 6. Combine all data
      const enrichedCustomers: CustomerWithStats[] = (customersData || []).map(cust => {
        const stats = customerStatsMap.get(cust.id) || {
          totalAppointments: 0,
          upcomingAppointments: 0,
          lastAppointment: null,
          firstAppointment: null
        }
        
        return {
          ...cust,
          ...stats,
          hasPushEnabled: subscriptionMap.has(cust.id),
          deviceCount: subscriptionMap.get(cust.id) || 0
        }
      })
      
      setCustomers(enrichedCustomers)
    } catch (err) {
      console.error('Error in fetchCustomers:', err)
      await report(err, 'Fetching customers (exception)')
      toast.error('שגיאה בטעינת הלקוחות')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let result = [...customers]
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter(c => 
        c.fullname.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        c.email?.toLowerCase().includes(query)
      )
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.fullname.localeCompare(b.fullname, 'he')
          break
        case 'recent':
          comparison = (b.lastAppointment || 0) - (a.lastAppointment || 0)
          break
        case 'total':
          comparison = b.totalAppointments - a.totalAppointments
          break
      }
      
      return sortDesc ? comparison : -comparison
    })
    
    return result
  }, [customers, searchQuery, sortBy, sortDesc])

  // Handle sending push notification
  const handleSendPush = async () => {
    if (!selectedCustomer || !pushTitle.trim() || !pushBody.trim()) {
      toast.error('נא למלא כותרת ותוכן ההודעה')
      return
    }
    
    setSendingPush(true)
    
    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          title: pushTitle.trim(),
          body: pushBody.trim(),
          url: '/my-appointments',
          barberName: barber?.fullname,
          senderId: barber?.id
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success('ההודעה נשלחה בהצלחה!')
        closePushModal()
      } else {
        console.error('Push send failed:', result)
        await report(new Error(result.error || 'Push send failed'), 'Sending push notification')
        toast.error(result.error || 'שגיאה בשליחת ההודעה')
      }
    } catch (err) {
      console.error('Error sending push:', err)
      await report(err, 'Sending push notification (exception)')
      toast.error('שגיאה בשליחת ההודעה')
    } finally {
      setSendingPush(false)
    }
  }

  const openPushModal = (customer: CustomerWithStats) => {
    setSelectedCustomer(customer)
    setPushTitle('')
    setPushBody('')
    setPushModalOpen(true)
  }

  const closePushModal = () => {
    setPushModalOpen(false)
    setSelectedCustomer(null)
    setPushTitle('')
    setPushBody('')
  }

  // Stats
  const stats = useMemo(() => {
    const total = customers.length
    const withPush = customers.filter(c => c.hasPushEnabled).length
    const withUpcoming = customers.filter(c => c.upcomingAppointments > 0).length
    
    return { total, withPush, withUpcoming }
  }, [customers])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-medium text-foreground-light flex items-center gap-2">
          <Users size={24} className="text-accent-gold" />
          הלקוחות שלי
        </h1>
        <p className="text-foreground-muted text-sm mt-0.5">
          כל הלקוחות שקבעו אצלך תור
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground-light">{stats.total}</p>
          <p className="text-foreground-muted text-xs">סה״כ לקוחות</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.withPush}</p>
          <p className="text-foreground-muted text-xs">עם התראות</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-accent-gold">{stats.withUpcoming}</p>
          <p className="text-foreground-muted text-xs">עם תור קרוב</p>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש לפי שם או טלפון..."
            className="w-full p-3 pr-10 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold/50"
          />
        </div>
        
        {/* Sort */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'recent' | 'total')}
            className="px-3 py-2 rounded-xl bg-background-card border border-white/10 text-foreground-light text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
          >
            <option value="recent">לפי תור אחרון</option>
            <option value="name">לפי שם</option>
            <option value="total">לפי כמות תורים</option>
          </select>
          <button
            onClick={() => setSortDesc(!sortDesc)}
            className="p-2 rounded-xl bg-background-card border border-white/10 text-foreground-muted hover:text-foreground-light transition-colors flex items-center justify-center"
            aria-label={sortDesc ? 'סדר עולה' : 'סדר יורד'}
          >
            {sortDesc ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* Customers List */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users size={40} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted text-sm">
              {searchQuery ? 'לא נמצאו לקוחות התואמים לחיפוש' : 'עדיין אין לקוחות'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors',
                  customer.is_blocked && 'opacity-50'
                )}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-accent-gold" />
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground-light font-medium truncate">
                      {customer.fullname}
                    </p>
                    {customer.is_blocked && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                        חסום
                      </span>
                    )}
                    {customer.upcomingAppointments > 0 && (
                      <span className="text-[10px] bg-accent-gold/20 text-accent-gold px-1.5 py-0.5 rounded">
                        {customer.upcomingAppointments} תורים קרובים
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-foreground-muted text-xs mt-0.5">
                    <span className="flex items-center gap-1" dir="ltr">
                      <Phone size={10} />
                      {formatPhoneDisplay(customer.phone)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {customer.totalAppointments} תורים
                    </span>
                    {customer.lastAppointment && (
                      <span className="flex items-center gap-1 hidden sm:flex">
                        <History size={10} />
                        {formatDistanceToNow(customer.lastAppointment, { addSuffix: true, locale: he })}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Push Status Indicator */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {customer.hasPushEnabled ? (
                    <div 
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20"
                      title={`מותקן (${customer.deviceCount} מכשירים)`}
                    >
                      <Smartphone size={12} className="text-green-400" />
                      <span className="text-green-400 text-[10px] hidden sm:inline">אפליקציה</span>
                    </div>
                  ) : (
                    <div 
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.08]"
                      title="לא מותקן"
                    >
                      <BellOff size={12} className="text-foreground-muted/50" />
                      <span className="text-foreground-muted/50 text-[10px] hidden sm:inline">ללא</span>
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* WhatsApp */}
                  {customer.phone && !customer.phone.startsWith('walkin-') && (
                    <a
                      {...getExternalLinkProps(`https://wa.me/${formatPhoneForWhatsApp(customer.phone)}`)}
                      className="p-2 rounded-lg hover:bg-green-500/10 transition-colors flex items-center justify-center"
                      aria-label="שלח הודעה בוואטסאפ"
                      title="וואטסאפ"
                    >
                      <MessageCircle size={18} className="text-green-500" />
                    </a>
                  )}
                  
                  {/* Send Push */}
                  {customer.hasPushEnabled && (
                    <button
                      onClick={() => openPushModal(customer)}
                      className="p-2 rounded-lg hover:bg-accent-gold/10 transition-colors flex items-center justify-center"
                      aria-label="שלח התראה"
                      title="שלח התראה"
                    >
                      <Bell size={18} className="text-accent-gold" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
        <div className="flex gap-3">
          <Smartphone size={18} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-300/80">
            <p className="font-medium text-blue-300 mb-1">מה זה ״אפליקציה״?</p>
            <p>
              לקוחות שהתקינו את האפליקציה יכולים לקבל התראות ישירות למכשיר. 
              לחץ על פעמון כדי לשלוח הודעה מותאמת אישית.
            </p>
          </div>
        </div>
      </div>

      {/* Push Modal */}
      {pushModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full sm:max-w-md sm:mx-4 bg-background-darker sm:bg-background-dark border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-in-up sm:animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
              <div>
                <h3 className="text-lg font-medium text-foreground-light">שליחת התראה</h3>
                <p className="text-foreground-muted text-xs mt-0.5">
                  ל{selectedCustomer.fullname}
                </p>
              </div>
              <button
                onClick={closePushModal}
                className="p-2 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center"
                aria-label="סגור"
              >
                <X size={20} className="text-foreground-muted" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Title Input */}
              <div className="flex flex-col gap-2">
                <label htmlFor="push-title" className="text-foreground-light text-sm">
                  כותרת ההודעה *
                </label>
                <input
                  id="push-title"
                  type="text"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="לדוגמה: תזכורת חשובה"
                  maxLength={50}
                  className="w-full p-3 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold"
                />
                <p className="text-foreground-muted/50 text-xs text-left" dir="ltr">
                  {pushTitle.length}/50
                </p>
              </div>
              
              {/* Body Input */}
              <div className="flex flex-col gap-2">
                <label htmlFor="push-body" className="text-foreground-light text-sm">
                  תוכן ההודעה *
                </label>
                <textarea
                  id="push-body"
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  placeholder="כתוב את ההודעה שתישלח ללקוח..."
                  rows={4}
                  maxLength={200}
                  className="w-full p-3 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold resize-none"
                />
                <p className="text-foreground-muted/50 text-xs text-left" dir="ltr">
                  {pushBody.length}/200
                </p>
              </div>
              
              {/* Preview */}
              {(pushTitle || pushBody) && (
                <div className="bg-background-card border border-white/10 rounded-xl p-3">
                  <p className="text-foreground-muted text-xs mb-2">תצוגה מקדימה (כפי שיראה הלקוח):</p>
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                      <Bell size={18} className="text-accent-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground-light font-medium text-sm truncate">
                        {pushTitle ? `💬 ${barber?.fullname}: ${pushTitle}` : 'כותרת ההודעה'}
                      </p>
                      <p className="text-foreground-muted text-xs line-clamp-2">
                        {pushBody || 'תוכן ההודעה יופיע כאן...'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 p-5 border-t border-white/5 flex-shrink-0">
              <button
                onClick={handleSendPush}
                disabled={sendingPush || !pushTitle.trim() || !pushBody.trim()}
                className={cn(
                  'flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                  sendingPush || !pushTitle.trim() || !pushBody.trim()
                    ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                    : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
                )}
              >
                {sendingPush ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    שולח...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    שלח התראה
                  </>
                )}
              </button>
              <button
                onClick={closePushModal}
                disabled={sendingPush}
                className="px-6 py-3 rounded-xl font-medium border border-white/20 text-foreground-light hover:bg-white/5 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
