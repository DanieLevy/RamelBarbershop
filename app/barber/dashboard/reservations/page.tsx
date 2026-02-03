'use client'

import { useEffect, useState, useMemo, Suspense, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatTime as formatTimeUtil, nowInIsrael, generateTimeSlots, parseTimeString, getIsraelDayStart, getIsraelDayEnd, timestampToIsraelDate, isSameDayInIsrael, getDayKeyInIsrael } from '@/lib/utils'
import { getExternalLinkProps } from '@/lib/utils/external-link'
import { addDays, format, startOfWeek, endOfWeek, isSameDay, parse } from 'date-fns'
import { he } from 'date-fns/locale'
import { Calendar, Phone, X, Plus, ChevronDown, MessageCircle, Repeat } from 'lucide-react'
import type { Reservation, Service, BarbershopSettings, WorkDay } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'
import { getRecurringByBarber } from '@/lib/services/recurring.service'
import { israelDateToTimestamp } from '@/lib/utils'
import { CancelReservationModal } from '@/components/barber/CancelReservationModal'
import { BulkCancelModal } from '@/components/barber/BulkCancelModal'
import { AppointmentDetailModal } from '@/components/barber/AppointmentDetailModal'
import { ManualBookingModal } from '@/components/barber/ManualBookingModal'
import { cancelReservation } from '@/lib/services/booking.service'

interface ReservationWithService extends Reservation {
  services?: Service
  isRecurring?: boolean
}

interface RecurringForDisplay {
  id: string
  time_slot: string
  day_of_week: string
  customer_name: string
  customer_phone: string
  service_name: string
  time_timestamp: number
}

type ViewMode = 'all' | 'upcoming_only' | 'cancelled'
type QuickDateType = 'today' | 'tomorrow' | 'week' | 'all' | 'custom'

// Wrap in Suspense for useSearchParams
export default function ReservationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ReservationsContent />
    </Suspense>
  )
}

function ReservationsContent() {
  const searchParams = useSearchParams()
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('ReservationsPage')
  
  // Get URL params from push notification deep links
  const highlightId = searchParams.get('highlight')
  const tabParam = searchParams.get('tab')
  const dateParam = searchParams.get('date')
  
  const [reservations, setReservations] = useState<ReservationWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('all') // 'all' shows unified timeline
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  
  // Date filter state
  const [quickDate, setQuickDate] = useState<QuickDateType>('today')
  const [customDate, setCustomDate] = useState<Date | null>(null)
  
  // Scroll refs for auto-scroll to upcoming
  const upcomingDividerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  
  // Modal states
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean
    reservation: ReservationWithService | null
  }>({ isOpen: false, reservation: null })
  
  const [bulkCancelModal, setBulkCancelModal] = useState<{
    isOpen: boolean
    reservations: ReservationWithService[]
  }>({ isOpen: false, reservations: [] })

  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean
    reservation: ReservationWithService | null
  }>({ isOpen: false, reservation: null })
  
  // Shop settings for work hours
  const [shopSettings, setShopSettings] = useState<BarbershopSettings | null>(null)
  
  // Barber's day-specific work hours
  const [barberWorkDays, setBarberWorkDays] = useState<WorkDay[]>([])
  
  // Toggle for showing empty slots
  const [showEmptySlots, setShowEmptySlots] = useState(true)
  
  // Recurring appointments for today
  const [todaysRecurring, setTodaysRecurring] = useState<RecurringForDisplay[]>([])
  
  // Manual booking modal state
  const [manualBookingModal, setManualBookingModal] = useState<{
    isOpen: boolean
    preselectedDate?: Date | null
    preselectedTime?: number | null
  }>({ isOpen: false, preselectedDate: null, preselectedTime: null })

  useEffect(() => {
    if (barber?.id) {
      fetchReservations()
      fetchShopSettings()
      fetchBarberWorkDays()
      fetchRecurringAppointments()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])
  
  // Handle URL params from push notification deep links
  // This processes highlight, tab, and date params to show the specific reservation
  useEffect(() => {
    if (!highlightId || loading || reservations.length === 0) return
    
    // Find the highlighted reservation
    const targetReservation = reservations.find(r => r.id === highlightId)
    
    if (targetReservation) {
      console.log('[DeepLink] Found target reservation:', highlightId)
      
      // Set visual highlight
      setHighlightedId(highlightId)
      
      // Switch to the correct view based on URL param or reservation status
      if (tabParam === 'cancelled' || targetReservation.status === 'cancelled') {
        setViewMode('cancelled')
      } else {
        setViewMode('all') // Unified timeline
      }
      
      // Set date filter based on URL param or reservation date
      if (dateParam) {
        try {
          const parsedDate = parse(dateParam, 'yyyy-MM-dd', new Date())
          if (!isNaN(parsedDate.getTime())) {
            const israelNow = nowInIsrael()
            if (isSameDay(parsedDate, israelNow)) {
              setQuickDate('today')
              setCustomDate(null)
            } else if (isSameDay(parsedDate, addDays(israelNow, 1))) {
              setQuickDate('tomorrow')
              setCustomDate(null)
            } else {
              setCustomDate(parsedDate)
              setQuickDate('custom')
            }
          }
        } catch (err) {
          console.error('[DeepLink] Failed to parse date param:', dateParam, err)
        }
      } else {
        // No date param - switch to 'all' to ensure the reservation is visible
        setQuickDate('all')
      }
      
      // Auto-open the detail modal after a short delay
      setTimeout(() => {
        setDetailModal({ isOpen: true, reservation: targetReservation })
      }, 300)
      
      // Clear the URL params without page reload
      window.history.replaceState({}, '', '/barber/dashboard/reservations')
      
      // Clear visual highlight after 5 seconds
      setTimeout(() => {
        setHighlightedId(null)
      }, 5000)
    } else {
      console.log('[DeepLink] Target reservation not found:', highlightId)
    }
  }, [highlightId, tabParam, dateParam, loading, reservations])
  
  // Connection status for realtime
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true)
  
  // Real-time subscription for live updates with reconnection logic
  // This ensures the barber sees changes made by customers immediately
  useEffect(() => {
    if (!barber?.id) return
    
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let reconnectAttempts = 0
    const MAX_RECONNECT_ATTEMPTS = 5
    const RECONNECT_DELAY_BASE = 1000 // 1 second
    let reconnectTimeout: NodeJS.Timeout | null = null
    let isUnmounting = false
    
    const setupChannel = () => {
      if (isUnmounting) return
      
      // Clean up existing channel if any
      if (channel) {
        supabase.removeChannel(channel)
      }
      
      // Subscribe to reservation changes for this barber
      channel = supabase
        .channel(`reservations-barber-${barber.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'reservations',
            filter: `barber_id=eq.${barber.id}`
          },
          (payload) => {
            console.log('[Realtime] Reservation change detected:', payload.eventType)
            
            // Refresh data when any change occurs
            // This is simpler and more reliable than trying to merge changes
            fetchReservations()
            
            // Show toast for new bookings
            if (payload.eventType === 'INSERT') {
              const newRes = payload.new as ReservationWithService
              if (newRes.status === 'confirmed') {
                toast.info('תור חדש התקבל!')
              }
            }
            
            // Show toast for cancellations by customer
            if (payload.eventType === 'UPDATE') {
              const updated = payload.new as ReservationWithService
              const old = payload.old as { status?: string }
              if (updated.status === 'cancelled' && old.status === 'confirmed' && updated.cancelled_by === 'customer') {
                toast.warning('לקוח ביטל תור')
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Connected to reservation updates')
            setIsRealtimeConnected(true)
            reconnectAttempts = 0 // Reset on successful connection
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[Realtime] Connection error, status:', status)
            setIsRealtimeConnected(false)
            
            // Attempt reconnection with exponential backoff
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !isUnmounting) {
              const delay = RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts)
              console.log(`[Realtime] Attempting reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)
              
              reconnectTimeout = setTimeout(() => {
                reconnectAttempts++
                setupChannel()
              }, delay)
            } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
              console.error('[Realtime] Max reconnection attempts reached')
              toast.error('התנתק מעדכונים בזמן אמת. רענן את הדף.')
            }
          } else if (status === 'CLOSED') {
            console.log('[Realtime] Channel closed')
            setIsRealtimeConnected(false)
          }
        })
    }
    
    // Initial setup
    setupChannel()
    
    // Heartbeat check - verify connection every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (!isUnmounting && channel) {
        // Force refresh if we haven't received updates in a while
        // This helps catch cases where the connection died silently
        const state = (channel as unknown as { state?: string }).state
        if (state !== 'joined' && state !== 'joining') {
          console.log('[Realtime] Heartbeat detected disconnection, reconnecting...')
          setIsRealtimeConnected(false)
          setupChannel()
        }
      }
    }, 30000)
    
    // Cleanup subscription on unmount
    return () => {
      isUnmounting = true
      console.log('[Realtime] Unsubscribing from reservation updates')
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      clearInterval(heartbeatInterval)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])
  
  const fetchShopSettings = async () => {
    const supabase = createClient()
    // barbershop_settings is a singleton table - fetch the first (only) row
    const { data } = await supabase
      .from('barbershop_settings')
      .select('*')
      .single()
    
    if (data) {
      setShopSettings(data as BarbershopSettings)
    }
  }

  const fetchBarberWorkDays = async () => {
    if (!barber?.id) return
    const supabase = createClient()
    const { data } = await supabase
      .from('work_days')
      .select('*')
      .eq('user_id', barber.id)
    
    if (data) {
      setBarberWorkDays(data as WorkDay[])
    }
  }

  const fetchRecurringAppointments = async () => {
    if (!barber?.id) return
    
    try {
      const recurringData = await getRecurringByBarber(barber.id)
      
      // Convert to display format with calculated timestamps
      const now = Date.now()
      const todayStart = getIsraelDayStart(now)
      const todayDayKey = getDayKeyInIsrael(now)
      
      const displayRecurring: RecurringForDisplay[] = recurringData
        .filter(rec => rec.day_of_week === todayDayKey) // Only today's recurring
        .map(rec => {
          const [hours, minutes] = rec.time_slot.split(':').map(Number)
          const israelDate = timestampToIsraelDate(todayStart)
          const appointmentTime = israelDateToTimestamp(
            israelDate.getFullYear(),
            israelDate.getMonth() + 1,
            israelDate.getDate(),
            hours,
            minutes
          )
          
          const customer = rec.customers as { fullname: string; phone: string } | undefined
          const service = rec.services as { name_he: string } | undefined
          
          return {
            id: rec.id,
            time_slot: rec.time_slot.substring(0, 5),
            day_of_week: rec.day_of_week,
            customer_name: customer?.fullname || 'לקוח קבוע',
            customer_phone: customer?.phone || '',
            service_name: service?.name_he || 'שירות',
            time_timestamp: appointmentTime
          }
        })
        .filter(rec => rec.time_timestamp > now) // Only upcoming
        .sort((a, b) => a.time_timestamp - b.time_timestamp)
      
      setTodaysRecurring(displayRecurring)
    } catch (err) {
      console.error('Error fetching recurring appointments:', err)
    }
  }

  const fetchReservations = async () => {
    if (!barber?.id) return
    
    setLoading(true)
    
    try {
      const supabase = createClient()
      
      // Only select columns needed for the dashboard
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, barber_id, service_id, customer_id, customer_name, customer_phone,
          date_timestamp, time_timestamp, day_name, day_num, status, 
          cancelled_by, cancellation_reason, version, created_at, barber_notes,
          services (id, name_he, duration, price)
        `)
        .eq('barber_id', barber.id)
        .order('time_timestamp', { ascending: true })
      
      if (error) {
        console.error('Error fetching reservations:', error)
        await report(new Error(error.message), 'Fetching barber reservations')
        toast.error('שגיאה בטעינת התורים')
        return
      }
      
      setReservations((data as ReservationWithService[]) || [])
    } catch (err) {
      console.error('Error fetching reservations:', err)
      await report(err, 'Fetching barber reservations (exception)')
      toast.error('שגיאה בטעינת התורים')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelReservation = async (id: string, reason?: string) => {
    setUpdatingId(id)
    
    // Get reservation details before cancelling for notification
    const reservation = reservations.find(r => r.id === id)
    if (!reservation) {
      toast.error('התור לא נמצא')
      setUpdatingId(null)
      return
    }
    
    try {
      // Use optimistic locking with version check
      const currentVersion = (reservation as ReservationWithService & { version?: number }).version || 1
      
      // Use the centralized cancelReservation service (bypasses RLS via API)
      const result = await cancelReservation(id, 'barber', reason || undefined, currentVersion)
      
      if (!result.success) {
        if (result.concurrencyConflict) {
          toast.error('התור עודכן על ידי אחר. מרענן...')
          await fetchReservations()
          setCancelModal({ isOpen: false, reservation: null })
          setUpdatingId(null)
          return
        }
        
        console.error('Error cancelling reservation:', result.error)
        await report(new Error(result.error || 'Unknown error'), 'Cancelling reservation', 'high')
        toast.error(result.error || 'שגיאה בביטול התור')
        return
      }
      
      // Send push notification to customer (fire and forget)
      if (reservation?.customer_id) {
        console.log('[Barber Cancel] Sending push notification to customer:', reservation.customer_id)
        fetch('/api/push/notify-cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId: id,
            customerId: reservation.customer_id,
            barberId: barber?.id,
            cancelledBy: 'barber',
            customerName: reservation.customer_name,
            barberName: barber?.fullname || 'הספר',
            serviceName: reservation.services?.name_he || 'שירות',
            appointmentTime: reservation.time_timestamp,
            reason
          })
        })
          .then(res => res.json())
          .then(data => console.log('[Barber Cancel] Push notification result:', data))
          .catch(err => console.error('[Barber Cancel] Push notification error:', err))
      } else {
        console.log('[Barber Cancel] No customer_id found, cannot send push notification')
      }
      
      toast.success('התור בוטל בהצלחה')
      setCancelModal({ isOpen: false, reservation: null })
      await fetchReservations()
    } catch (err) {
      console.error('Error cancelling reservation:', err)
      toast.error('שגיאה בביטול התור')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleBulkCancel = async (reason?: string) => {
    const toCancel = bulkCancelModal.reservations
    if (toCancel.length === 0) return
    
    setUpdatingId('bulk')
    
    try {
      for (const res of toCancel) {
        // Use the centralized cancelReservation service (bypasses RLS via API)
        const result = await cancelReservation(res.id, 'barber', reason || undefined)
        
        if (!result.success) {
          console.warn('[Bulk Cancel] Failed to cancel:', res.id, result.error)
          // Continue with other cancellations even if one fails
        }
        
        // Send push notification to each customer (fire and forget)
        if (res.customer_id) {
          console.log('[Bulk Cancel] Sending push notification to customer:', res.customer_id)
          fetch('/api/push/notify-cancellation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reservationId: res.id,
              customerId: res.customer_id,
              barberId: barber?.id,
              cancelledBy: 'barber',
              customerName: res.customer_name,
              barberName: barber?.fullname || 'הספר',
              serviceName: res.services?.name_he || 'שירות',
              appointmentTime: res.time_timestamp,
              reason
            })
          })
            .then(r => r.json())
            .then(data => console.log('[Bulk Cancel] Push result:', data))
            .catch(err => console.error('[Bulk Cancel] Push error:', err))
        }
      }
      
      toast.success(`${toCancel.length} תורים בוטלו בהצלחה`)
      setBulkCancelModal({ isOpen: false, reservations: [] })
      await fetchReservations()
    } catch (err) {
      console.error('Error bulk cancelling:', err)
      await report(err, 'Bulk cancelling reservations', 'high')
      toast.error('שגיאה בביטול התורים')
    } finally {
      setUpdatingId(null)
    }
  }

  // Normalize timestamp
  const normalizeTs = (ts: number): number => {
    if (ts < 946684800000) return ts * 1000
    return ts
  }

  // Format phone number for WhatsApp (Israeli format)
  // WhatsApp requires international format without + or spaces
  // e.g., "050-1234567" -> "972501234567"
  const formatPhoneForWhatsApp = (phone: string): string => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '')
    
    // Handle Israeli numbers
    if (cleaned.startsWith('0')) {
      // Replace leading 0 with 972 (Israel country code)
      cleaned = '972' + cleaned.substring(1)
    } else if (!cleaned.startsWith('972')) {
      // If doesn't start with 972, add it
      cleaned = '972' + cleaned
    }
    
    return cleaned
  }

  const formatTime = (timestamp: number): string => {
    return formatTimeUtil(normalizeTs(timestamp))
  }

  const now = Date.now()
  const israelNow = nowInIsrael()

  // Get date range based on quickDate - USING ISRAEL TIMEZONE
  const getDateRange = (): { startMs: number | null; endMs: number | null } => {
    switch (quickDate) {
      case 'today':
        return { startMs: getIsraelDayStart(israelNow), endMs: getIsraelDayEnd(israelNow) }
      case 'tomorrow':
        const tomorrow = addDays(israelNow, 1)
        return { startMs: getIsraelDayStart(tomorrow), endMs: getIsraelDayEnd(tomorrow) }
      case 'week':
        const weekStart = startOfWeek(israelNow, { weekStartsOn: 0 })
        const weekEnd = endOfWeek(israelNow, { weekStartsOn: 0 })
        return { startMs: getIsraelDayStart(weekStart), endMs: getIsraelDayEnd(weekEnd) }
      case 'custom':
        if (customDate) {
          return { startMs: getIsraelDayStart(customDate), endMs: getIsraelDayEnd(customDate) }
        }
        return { startMs: null, endMs: null }
      default:
        return { startMs: null, endMs: null }
    }
  }

  // Smart date display - USING ISRAEL TIMEZONE
  const getSmartDateTime = (timestamp: number): { date: string; time: string; isToday: boolean } => {
    const normalizedTs = normalizeTs(timestamp)
    const resDate = timestampToIsraelDate(normalizedTs)
    const isToday = isSameDayInIsrael(normalizedTs, Date.now())
    const tomorrowMs = Date.now() + (24 * 60 * 60 * 1000)
    const isTomorrow = isSameDayInIsrael(normalizedTs, tomorrowMs)
    
    let dateStr = ''
    if (isToday) {
      dateStr = 'היום'
    } else if (isTomorrow) {
      dateStr = 'מחר'
    } else {
      dateStr = format(resDate, 'dd/MM', { locale: he })
    }
    
    return { date: dateStr, time: formatTime(normalizedTs), isToday }
  }

  // Filter reservations with unified timeline support
  const filteredReservations = useMemo(() => {
    let filtered = [...reservations]
    const { startMs, endMs } = getDateRange()
    
    // Date filter
    if (startMs && endMs) {
      filtered = filtered.filter(res => {
        const resTime = normalizeTs(res.time_timestamp)
        return resTime >= startMs && resTime <= endMs
      })
    }
    
    // View mode filter
    switch (viewMode) {
      case 'all':
        // Unified view: show both past and upcoming, exclude cancelled
        filtered = filtered.filter(res => res.status !== 'cancelled')
        break
      case 'upcoming_only':
        // Only upcoming confirmed appointments
        filtered = filtered.filter(res => 
          normalizeTs(res.time_timestamp) > now && res.status === 'confirmed'
        )
        break
      case 'cancelled':
        // Only cancelled
        filtered = filtered.filter(res => res.status === 'cancelled')
        break
    }
    
    // Sort by time_timestamp for proper chronological order
    filtered.sort((a, b) => normalizeTs(a.time_timestamp) - normalizeTs(b.time_timestamp))
    
    return filtered
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, quickDate, customDate, viewMode, now])
  
  // Split reservations into past and upcoming for the unified view
  const { pastReservations, upcomingReservations } = useMemo(() => {
    if (viewMode !== 'all') {
      return { pastReservations: [], upcomingReservations: filteredReservations }
    }
    
    const past: ReservationWithService[] = []
    const upcoming: ReservationWithService[] = []
    
    filteredReservations.forEach((res) => {
      if (normalizeTs(res.time_timestamp) > now) {
        upcoming.push(res)
      } else {
        past.push(res)
      }
    })
    
    return { pastReservations: past, upcomingReservations: upcoming }
  }, [filteredReservations, viewMode, now])
  
  // Generate timeline with empty slots for single-day views
  type TimelineItem = 
    | { type: 'reservation'; data: ReservationWithService; isPast: boolean }
    | { type: 'empty'; timestamp: number; time: string }
    | { type: 'divider'; label: string }
  
  const timelineItems = useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = []
    
    // For unified view ('all'), build a timeline with past, divider, and upcoming
    if (viewMode === 'all') {
      // Add past reservations
      pastReservations.forEach(res => {
        items.push({ type: 'reservation', data: res, isPast: true })
      })
      
      // Add divider between past and upcoming if both exist
      if (pastReservations.length > 0 && upcomingReservations.length > 0) {
        items.push({ type: 'divider', label: 'תורים קרובים' })
      } else if (pastReservations.length > 0 && upcomingReservations.length === 0) {
        items.push({ type: 'divider', label: 'אין תורים נוספים היום' })
      } else if (pastReservations.length === 0 && upcomingReservations.length > 0) {
        // No past, just show upcoming without divider
      }
      
      // Add upcoming reservations with empty slots if enabled
      if (showEmptySlots && (quickDate === 'today' || quickDate === 'tomorrow' || quickDate === 'custom')) {
        // Get the selected date
        let selectedDate: Date
        if (quickDate === 'today') {
          selectedDate = israelNow
        } else if (quickDate === 'tomorrow') {
          selectedDate = addDays(israelNow, 1)
        } else if (quickDate === 'custom' && customDate) {
          selectedDate = customDate
        } else {
          // Just add upcoming without empty slots
          upcomingReservations.forEach(res => {
            items.push({ type: 'reservation', data: res, isPast: false })
          })
          return items
        }
        
        // Get work hours
        const dayKey = getDayKeyInIsrael(selectedDate.getTime())
        const barberDaySettings = barberWorkDays.find(wd => wd.day_of_week === dayKey)
        
        let workStart: string
        let workEnd: string
        
        if (barberDaySettings && barberDaySettings.is_working && barberDaySettings.start_time && barberDaySettings.end_time) {
          workStart = barberDaySettings.start_time
          workEnd = barberDaySettings.end_time
        } else if (barberDaySettings && !barberDaySettings.is_working) {
          // Barber not working, but may still have manual bookings (outside hours)
          // Show all reservations chronologically (no empty slots for non-working days)
          upcomingReservations.forEach(res => {
            items.push({ type: 'reservation', data: res, isPast: false })
          })
          return items
        } else {
          workStart = shopSettings?.work_hours_start || '09:00'
          workEnd = shopSettings?.work_hours_end || '19:00'
        }
        
        const { hour: startHour, minute: startMinute } = parseTimeString(workStart)
        const { hour: endHour, minute: endMinute } = parseTimeString(workEnd)
        
        const allSlots = generateTimeSlots(
          selectedDate.getTime(),
          startHour,
          startMinute,
          endHour,
          endMinute,
          30
        )
        
        // Track which reservations have been added to avoid duplicates
        const addedReservationIds = new Set<string>()
        
        for (const slot of allSlots) {
          // Only show future slots
          if (slot.timestamp <= now) continue
          
          const reservation = upcomingReservations.find(res => 
            Math.abs(normalizeTs(res.time_timestamp) - slot.timestamp) < 60000
          )
          
          if (reservation) {
            items.push({ type: 'reservation', data: reservation, isPast: false })
            addedReservationIds.add(reservation.id)
          } else {
            items.push({ type: 'empty', timestamp: slot.timestamp, time: slot.time })
          }
        }
        
        // Add any reservations that fall OUTSIDE work hours (weren't matched to slots)
        // These are typically manual bookings made by the barber
        const orphanReservations = upcomingReservations.filter(res => !addedReservationIds.has(res.id))
        if (orphanReservations.length > 0) {
          // Insert orphan reservations at their correct chronological position
          for (const orphan of orphanReservations) {
            const orphanTs = normalizeTs(orphan.time_timestamp)
            // Find the right position in items array
            let insertIndex = items.length
            for (let i = 0; i < items.length; i++) {
              const item = items[i]
              if (item.type === 'divider') continue
              const itemTs = item.type === 'reservation' 
                ? normalizeTs(item.data.time_timestamp) 
                : item.timestamp
              if (orphanTs < itemTs) {
                insertIndex = i
                break
              }
            }
            items.splice(insertIndex, 0, { type: 'reservation', data: orphan, isPast: false })
          }
        }
      } else {
        // No empty slots, just add upcoming
        upcomingReservations.forEach(res => {
          items.push({ type: 'reservation', data: res, isPast: false })
        })
      }
      
      return items
    }
    
    // For other views, just map the filtered reservations
    return filteredReservations.map(res => ({ 
      type: 'reservation' as const, 
      data: res, 
      isPast: normalizeTs(res.time_timestamp) <= now 
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredReservations, pastReservations, upcomingReservations, quickDate, customDate, viewMode, shopSettings, barberWorkDays, showEmptySlots, now])
  
  // Auto-scroll to upcoming section when data loads
  const scrollToUpcoming = useCallback(() => {
    if (upcomingDividerRef.current && !hasScrolledRef.current) {
      setTimeout(() => {
        upcomingDividerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        hasScrolledRef.current = true
      }, 100)
    }
  }, [])
  
  // Trigger scroll when timeline loads
  useEffect(() => {
    if (!loading && viewMode === 'all' && pastReservations.length > 0 && upcomingReservations.length > 0) {
      scrollToUpcoming()
    }
  }, [loading, viewMode, pastReservations.length, upcomingReservations.length, scrollToUpcoming])
  
  // Reset scroll flag when date filter changes
  useEffect(() => {
    hasScrolledRef.current = false
  }, [quickDate, customDate])
  
  // Get selected date for manual booking
  const getSelectedDate = (): Date | null => {
    if (quickDate === 'today') return israelNow
    if (quickDate === 'tomorrow') return addDays(israelNow, 1)
    if (quickDate === 'custom' && customDate) return customDate
    return null
  }

  // View counts
  const getViewCounts = () => {
    const { startMs, endMs } = getDateRange()
    let base = [...reservations]
    
    if (startMs && endMs) {
      base = base.filter(res => {
        const resTime = normalizeTs(res.time_timestamp)
        return resTime >= startMs && resTime <= endMs
      })
    }
    
    const upcoming = base.filter(r => normalizeTs(r.time_timestamp) > now && r.status === 'confirmed').length
    const past = base.filter(r => normalizeTs(r.time_timestamp) <= now && r.status !== 'cancelled').length
    const cancelled = base.filter(r => r.status === 'cancelled').length
    
    return {
      all: upcoming + past, // Total active (past + upcoming)
      upcoming,
      past,
      cancelled
    }
  }

  const counts = getViewCounts()

  // View mode options with improved UX
  const viewModes: { key: ViewMode; label: string; count: number; description?: string }[] = [
    { key: 'all', label: 'הכל', count: counts.all, description: 'קודמים + קרובים' },
    { key: 'upcoming_only', label: 'קרובים בלבד', count: counts.upcoming },
    { key: 'cancelled', label: 'מבוטלים', count: counts.cancelled },
  ]

  // Quick date chips
  const quickDateChips: { key: QuickDateType; label: string }[] = [
    { key: 'today', label: 'היום' },
    { key: 'tomorrow', label: 'מחר' },
    { key: 'week', label: 'השבוע' },
    { key: 'all', label: 'הכל' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Connection Status Indicator */}
      {!isRealtimeConnected && (
        <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-amber-400 text-sm">מתחבר מחדש לעדכונים בזמן אמת...</span>
          <button
            onClick={() => {
              fetchReservations()
              toast.info('מרענן נתונים...')
            }}
            className="mr-auto text-amber-400 hover:text-amber-300 text-sm underline"
          >
            רענן ידנית
          </button>
        </div>
      )}
      
      {/* Header with Add Button */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-medium text-foreground-light">תורים של לקוחות</h1>
            <p className="text-foreground-muted text-sm mt-0.5">ניהול תורים שנקבעו על ידי לקוחות</p>
          </div>
          {isRealtimeConnected && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded-full" title="מחובר לעדכונים בזמן אמת">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-green-400 text-xs">חי</span>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            const selectedDate = quickDate === 'today' ? israelNow : 
                                quickDate === 'tomorrow' ? addDays(israelNow, 1) : 
                                quickDate === 'custom' && customDate ? customDate : null
            setManualBookingModal({ isOpen: true, preselectedDate: selectedDate, preselectedTime: null })
          }}
          className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90 transition-all text-sm"
        >
          <Plus size={16} strokeWidth={2} />
          הוסף תור
        </button>
      </div>

      {/* Today's Recurring Appointments Section */}
      {quickDate === 'today' && todaysRecurring.length > 0 && (
        <div className="mb-4 bg-purple-500/5 border border-purple-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Repeat size={12} className="text-purple-400" />
            </div>
            <h3 className="text-sm font-medium text-purple-300">תורים קבועים להיום</h3>
          </div>
          <div className="space-y-1.5">
            {todaysRecurring.map(rec => (
              <div 
                key={rec.id}
                className="flex items-center gap-3 py-2 px-3 bg-purple-500/10 rounded-lg"
              >
                <div className="flex flex-col items-center w-10">
                  <span className="text-sm font-medium text-purple-400">{rec.time_slot}</span>
                </div>
                <div className="w-0.5 h-6 bg-purple-400/40 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground-light truncate">{rec.customer_name}</p>
                  <p className="text-xs text-foreground-muted truncate">{rec.service_name}</p>
                </div>
                {rec.customer_phone && (
                  <a
                    href={`tel:${rec.customer_phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                    aria-label="התקשר"
                  >
                    <Phone size={14} className="text-purple-400" />
                  </a>
                )}
                <span className="text-[10px] text-purple-400/60 bg-purple-500/20 px-1.5 py-0.5 rounded-full">קבוע</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Date Filter Chips - Compact Design */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {quickDateChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => {
              setQuickDate(chip.key)
              setCustomDate(null)
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              quickDate === chip.key
                ? 'bg-accent-gold text-background-dark'
                : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.08]'
            )}
          >
            {chip.label}
          </button>
        ))}
        
        {/* Clickable Date Display with hidden picker */}
        <div className="relative">
          <input
            type="date"
            value={(() => {
              if (quickDate === 'today') return format(israelNow, 'yyyy-MM-dd')
              if (quickDate === 'tomorrow') return format(addDays(israelNow, 1), 'yyyy-MM-dd')
              if (quickDate === 'custom' && customDate) return format(customDate, 'yyyy-MM-dd')
              return ''
            })()}
            onChange={(e) => {
              const date = e.target.value ? new Date(e.target.value) : null
              if (date) {
                if (isSameDay(date, israelNow)) {
                  setQuickDate('today')
                  setCustomDate(null)
                } else if (isSameDay(date, addDays(israelNow, 1))) {
                  setQuickDate('tomorrow')
                  setCustomDate(null)
                } else {
                  setCustomDate(date)
                  setQuickDate('custom')
                }
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="בחר תאריך"
          />
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all',
            'bg-white/[0.05] text-foreground-light hover:bg-white/[0.08] border border-white/[0.06]'
          )}>
            <Calendar size={12} className="text-accent-gold" />
            <span>
              {quickDate === 'today' && format(israelNow, 'd/M', { locale: he })}
              {quickDate === 'tomorrow' && format(addDays(israelNow, 1), 'd/M', { locale: he })}
              {quickDate === 'week' && `${format(startOfWeek(israelNow, { weekStartsOn: 0 }), 'd/M')} - ${format(endOfWeek(israelNow, { weekStartsOn: 0 }), 'd/M')}`}
              {quickDate === 'all' && 'הכל'}
              {quickDate === 'custom' && customDate && format(customDate, 'd/M', { locale: he })}
            </span>
          </div>
        </div>
      </div>

      {/* View Mode Selector - Compact Pills */}
      <div className="flex gap-1.5 mb-3 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
        {viewModes.map((mode) => (
          <button
            key={mode.key}
            onClick={() => {
              setViewMode(mode.key)
              hasScrolledRef.current = false // Reset scroll on mode change
            }}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
              viewMode === mode.key
                ? 'bg-white/[0.1] text-foreground-light shadow-sm'
                : 'text-foreground-muted hover:text-foreground-light'
            )}
          >
            {mode.label}
            <span className={cn(
              'px-1.5 py-0.5 rounded text-xs min-w-[20px]',
              viewMode === mode.key
                ? 'bg-accent-gold/20 text-accent-gold'
                : 'bg-white/[0.08] text-foreground-muted'
            )}>
              {mode.count}
            </span>
          </button>
        ))}
      </div>
      
      {/* Quick Info Bar - Unified view indicator */}
      {viewMode === 'all' && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <ChevronDown size={12} className="text-accent-gold animate-bounce" />
            <span>גלול למעלה לתורים קודמים</span>
          </div>
          
          {/* Toggle Empty Slots - Only for single day views */}
          {(quickDate === 'today' || quickDate === 'tomorrow' || quickDate === 'custom') && (
            <label className="flex items-center gap-2 text-xs text-foreground-muted cursor-pointer">
              <span>משבצות פנויות</span>
              <button
                onClick={() => setShowEmptySlots(!showEmptySlots)}
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative flex-shrink-0',
                  showEmptySlots ? 'bg-accent-gold' : 'bg-white/10'
                )}
                aria-checked={showEmptySlots}
                role="switch"
              >
                <div className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all',
                  showEmptySlots ? 'right-0.5' : 'left-0.5'
                )} />
              </button>
            </label>
          )}
        </div>
      )}
      
      {/* Toggle Empty Slots for upcoming_only view */}
      {viewMode === 'upcoming_only' && (quickDate === 'today' || quickDate === 'tomorrow' || quickDate === 'custom') && (
        <div className="flex items-center justify-end mb-3">
          <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
            <span>הצג משבצות פנויות</span>
            <button
              onClick={() => setShowEmptySlots(!showEmptySlots)}
              className={cn(
                'w-12 h-7 rounded-full transition-colors relative flex-shrink-0',
                showEmptySlots ? 'bg-accent-gold' : 'bg-white/10'
              )}
              aria-checked={showEmptySlots}
              role="switch"
            >
              <div className={cn(
                'absolute top-1 w-5 h-5 rounded-full bg-white transition-all',
                showEmptySlots ? 'right-1' : 'left-1'
              )} />
            </button>
          </label>
        </div>
      )}

      {/* Reservations List */}
      <div ref={containerRef} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        {timelineItems.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={40} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted text-sm">
              {viewMode === 'cancelled' ? 'אין תורים מבוטלים' : 'אין תורים להציג'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {timelineItems.map((item, index) => {
              // Divider between past and upcoming
              if (item.type === 'divider') {
                return (
                  <div
                    key={`divider-${index}`}
                    ref={upcomingDividerRef}
                    className="sticky top-0 z-10 bg-background-dark/95 backdrop-blur-sm border-y border-accent-gold/30 px-4 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-accent-gold/30" />
                      <span className="text-accent-gold text-xs font-medium px-2">
                        {item.label}
                      </span>
                      <div className="flex-1 h-px bg-accent-gold/30" />
                    </div>
                  </div>
                )
              }
              
              if (item.type === 'empty') {
                // Empty slot row
                return (
                  <div
                    key={`empty-${item.timestamp}`}
                    className="flex items-center gap-3 px-3 sm:px-4 py-2 transition-all hover:bg-white/[0.02] group"
                  >
                    {/* Time Display */}
                    <div className="flex flex-col items-center shrink-0 w-12">
                      <span className="text-lg font-bold tabular-nums text-foreground-muted/50">
                        {item.time}
                      </span>
                    </div>
                    
                    {/* Empty indicator */}
                    <div className="w-1 h-6 rounded-full shrink-0 bg-white/[0.08]" />
                    
                    {/* Empty content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground-muted/40 text-xs">פנוי</p>
                    </div>
                    
                    {/* Add button */}
                    <button
                      onClick={() => {
                        setManualBookingModal({
                          isOpen: true,
                          preselectedDate: getSelectedDate(),
                          preselectedTime: item.timestamp
                        })
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-foreground-muted/50 hover:bg-accent-gold/20 hover:text-accent-gold transition-colors opacity-0 group-hover:opacity-100"
                      title="הוסף תור"
                      aria-label="הוסף תור"
                    >
                      <Plus size={16} strokeWidth={2} />
                    </button>
                  </div>
                )
              }
              
              // Reservation row
              const res = item.data
              const smartDate = getSmartDateTime(res.time_timestamp)
              const isUpcoming = normalizeTs(res.time_timestamp) > now && res.status === 'confirmed'
              const isCancelled = res.status === 'cancelled'
              const isPast = item.isPast && res.status !== 'cancelled'
              const isHighlighted = highlightedId === res.id
              
              return (
                <div
                  key={res.id}
                  onClick={() => setDetailModal({ isOpen: true, reservation: res })}
                  className={cn(
                    'flex items-center gap-3 px-3 sm:px-4 py-3 transition-all cursor-pointer hover:bg-white/[0.03]',
                    isPast && 'opacity-50 bg-white/[0.01]',
                    isCancelled && 'opacity-60',
                    isHighlighted && 'bg-accent-gold/10 ring-2 ring-accent-gold/50 ring-inset animate-pulse'
                  )}
                >
                  {/* Time Display - Before indicator */}
                  <div className="flex flex-col items-center shrink-0 w-12">
                    <span className={cn(
                      'text-lg font-medium tabular-nums',
                      isUpcoming ? 'text-accent-gold' : isPast ? 'text-foreground-muted/60' : 'text-foreground-muted'
                    )}>
                      {smartDate.time}
                    </span>
                    <span className="text-[10px] text-foreground-muted/70">
                      {smartDate.isToday ? 'היום' : smartDate.date}
                    </span>
                  </div>
                  
                  {/* Status Line */}
                  <div className={cn(
                    'w-1 h-10 rounded-full shrink-0',
                    isCancelled ? 'bg-red-500/60' : isUpcoming ? 'bg-accent-gold' : 'bg-foreground-muted/20'
                  )} />
                  
                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        'text-foreground-light font-medium text-sm truncate',
                        isCancelled && 'line-through decoration-foreground-muted/50'
                      )}>
                        {res.customer_name}
                      </p>
                      {/* Past indicator badge */}
                      {isPast && !isCancelled && (
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-foreground-muted/60 text-[10px] shrink-0">
                          הסתיים
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-foreground-muted text-xs truncate',
                      isCancelled && 'line-through decoration-foreground-muted/30'
                    )}>
                      {res.services?.name_he || 'שירות'}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* WhatsApp */}
                    {res.customer_phone && (
                      <a
                        {...getExternalLinkProps(`https://wa.me/${formatPhoneForWhatsApp(res.customer_phone)}`)}
                        onClick={(e) => {
                          e.stopPropagation()
                          const linkProps = getExternalLinkProps(`https://wa.me/${formatPhoneForWhatsApp(res.customer_phone)}`)
                          if (linkProps.onClick) linkProps.onClick(e)
                        }}
                        className="icon-btn p-2 rounded-lg hover:bg-green-500/10 transition-colors"
                        aria-label="שלח הודעה בוואטסאפ"
                        title="וואטסאפ"
                      >
                        <MessageCircle size={16} strokeWidth={1.5} className="text-green-500" />
                      </a>
                    )}
                    
                    {/* Phone */}
                    <a
                      href={`tel:${res.customer_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="icon-btn p-2 rounded-lg hover:bg-accent-gold/10 transition-colors"
                      aria-label="התקשר"
                      title="התקשר"
                    >
                      <Phone size={16} strokeWidth={1.5} className="text-accent-gold" />
                    </a>
                    
                    {/* Cancel - Only for upcoming appointments */}
                    {res.status === 'confirmed' && isUpcoming && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setCancelModal({ isOpen: true, reservation: res })
                        }}
                        disabled={updatingId === res.id}
                        className={cn(
                          'icon-btn p-2 rounded-lg transition-colors',
                          updatingId === res.id
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-red-500/10 text-red-400'
                        )}
                        aria-label="בטל"
                      >
                        <X size={16} strokeWidth={1.5} />
                      </button>
                    )}
                    
                    {/* Cancelled Badge */}
                    {isCancelled && (
                      <span className="px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-xs shrink-0">
                        בוטל
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <CancelReservationModal
        isOpen={cancelModal.isOpen}
        reservation={cancelModal.reservation}
        onClose={() => setCancelModal({ isOpen: false, reservation: null })}
        onConfirm={async (reason) => {
          if (cancelModal.reservation) {
            await handleCancelReservation(cancelModal.reservation.id, reason)
          }
        }}
        isLoading={updatingId === cancelModal.reservation?.id}
      />

      <BulkCancelModal
        isOpen={bulkCancelModal.isOpen}
        reservations={bulkCancelModal.reservations}
        selectedDate={quickDate === 'custom' ? customDate : quickDate === 'today' ? israelNow : quickDate === 'tomorrow' ? addDays(israelNow, 1) : null}
        onClose={() => setBulkCancelModal({ isOpen: false, reservations: [] })}
        onConfirm={handleBulkCancel}
        isLoading={updatingId === 'bulk'}
      />

      <AppointmentDetailModal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal({ isOpen: false, reservation: null })}
        reservation={detailModal.reservation}
        variant="barber"
      />

      <ManualBookingModal
        isOpen={manualBookingModal.isOpen}
        onClose={() => setManualBookingModal({ isOpen: false, preselectedDate: null, preselectedTime: null })}
        onSuccess={fetchReservations}
        barberId={barber?.id || ''}
        barberName={barber?.fullname || ''}
        shopSettings={shopSettings}
        preselectedDate={manualBookingModal.preselectedDate}
        preselectedTime={manualBookingModal.preselectedTime}
      />

    </div>
  )
}
