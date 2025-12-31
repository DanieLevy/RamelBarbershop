'use client'

import { useEffect, useState, useMemo } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatTime as formatTimeUtil, nowInIsrael, generateTimeSlots, parseTimeString } from '@/lib/utils'
import { startOfDay, endOfDay, addDays, format, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
import { he } from 'date-fns/locale'
import { Calendar, Phone, X, Plus } from 'lucide-react'
import type { Reservation, Service, BarbershopSettings } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'
import { CancelReservationModal } from '@/components/barber/CancelReservationModal'
import { BulkCancelModal } from '@/components/barber/BulkCancelModal'
import { AppointmentDetailModal } from '@/components/barber/AppointmentDetailModal'
import { ManualBookingModal } from '@/components/barber/ManualBookingModal'

interface ReservationWithService extends Reservation {
  services?: Service
}

type TabType = 'upcoming' | 'past' | 'cancelled'
type QuickDateType = 'today' | 'tomorrow' | 'week' | 'all' | 'custom'

export default function ReservationsPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('ReservationsPage')
  
  const [reservations, setReservations] = useState<ReservationWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  
  // Date filter state
  const [quickDate, setQuickDate] = useState<QuickDateType>('today')
  const [customDate, setCustomDate] = useState<Date | null>(null)
  
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
  
  // Toggle for showing empty slots
  const [showEmptySlots, setShowEmptySlots] = useState(true)
  
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

  const fetchReservations = async () => {
    if (!barber?.id) return
    
    setLoading(true)
    
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('reservations')
        .select('*, services(*)')
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
    
    try {
      const supabase = createClient()
      
      const { error } = await supabase.from('reservations')
        .update({ 
          status: 'cancelled',
          cancelled_by: 'barber',
          cancellation_reason: reason || null
        })
        .eq('id', id)
      
      if (error) {
        console.error('Error cancelling reservation:', error)
        await report(error instanceof Error ? error : new Error(String(error)), 'Cancelling reservation', 'high')
        toast.error('שגיאה בביטול התור')
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
      const supabase = createClient()
      
      for (const res of toCancel) {
        await supabase.from('reservations')
          .update({ 
            status: 'cancelled',
            cancelled_by: 'barber',
            cancellation_reason: reason || null
          })
          .eq('id', res.id)
        
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

  const formatTime = (timestamp: number): string => {
    return formatTimeUtil(normalizeTs(timestamp))
  }

  const now = Date.now()
  const israelNow = nowInIsrael()

  // Get date range based on quickDate
  const getDateRange = (): { start: Date | null; end: Date | null } => {
    switch (quickDate) {
      case 'today':
        return { start: startOfDay(israelNow), end: endOfDay(israelNow) }
      case 'tomorrow':
        const tomorrow = addDays(israelNow, 1)
        return { start: startOfDay(tomorrow), end: endOfDay(tomorrow) }
      case 'week':
        return { start: startOfWeek(israelNow, { weekStartsOn: 0 }), end: endOfWeek(israelNow, { weekStartsOn: 0 }) }
      case 'custom':
        if (customDate) {
          return { start: startOfDay(customDate), end: endOfDay(customDate) }
        }
        return { start: null, end: null }
      default:
        return { start: null, end: null }
    }
  }

  // Smart date display
  const getSmartDateTime = (timestamp: number): { date: string; time: string; isToday: boolean } => {
    const normalizedTs = normalizeTs(timestamp)
    const resDate = new Date(normalizedTs)
    const isToday = isSameDay(resDate, israelNow)
    const isTomorrow = isSameDay(resDate, addDays(israelNow, 1))
    
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

  // Filter reservations
  const filteredReservations = useMemo(() => {
    let filtered = [...reservations]
    const { start, end } = getDateRange()
    
    // Date filter
    if (start && end) {
      filtered = filtered.filter(res => {
        const resTime = normalizeTs(res.time_timestamp)
        return resTime >= start.getTime() && resTime <= end.getTime()
      })
    }
    
    // Tab filter
    switch (activeTab) {
      case 'upcoming':
        filtered = filtered.filter(res => 
          normalizeTs(res.time_timestamp) > now && res.status === 'confirmed'
        )
        break
      case 'past':
        filtered = filtered.filter(res => 
          normalizeTs(res.time_timestamp) < now && res.status !== 'cancelled'
        )
        break
      case 'cancelled':
        filtered = filtered.filter(res => res.status === 'cancelled')
        break
    }
    
    return filtered
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, quickDate, customDate, activeTab, now])
  
  // Generate timeline with empty slots for single-day views
  type TimelineItem = 
    | { type: 'reservation'; data: ReservationWithService }
    | { type: 'empty'; timestamp: number; time: string }
  
  const timelineItems = useMemo((): TimelineItem[] => {
    // Only show empty slots for single-day views and upcoming tab
    if (!showEmptySlots || quickDate === 'week' || quickDate === 'all' || activeTab !== 'upcoming') {
      return filteredReservations.map(res => ({ type: 'reservation' as const, data: res }))
    }
    
    // Get the selected date
    let selectedDate: Date
    if (quickDate === 'today') {
      selectedDate = israelNow
    } else if (quickDate === 'tomorrow') {
      selectedDate = addDays(israelNow, 1)
    } else if (quickDate === 'custom' && customDate) {
      selectedDate = customDate
    } else {
      return filteredReservations.map(res => ({ type: 'reservation' as const, data: res }))
    }
    
    // Get work hours from shop settings
    const workStart = shopSettings?.work_hours_start || '09:00'
    const workEnd = shopSettings?.work_hours_end || '19:00'
    const { hour: startHour, minute: startMinute } = parseTimeString(workStart)
    const { hour: endHour, minute: endMinute } = parseTimeString(workEnd)
    
    // Generate all time slots for the day
    const allSlots = generateTimeSlots(
      selectedDate.getTime(),
      startHour,
      startMinute,
      endHour,
      endMinute,
      30
    )
    
    // Build timeline
    const timeline: TimelineItem[] = []
    
    for (const slot of allSlots) {
      // Skip past slots for today
      if (isSameDay(selectedDate, israelNow) && slot.timestamp < now) {
        continue
      }
      
      // Check if this slot is reserved
      const reservation = filteredReservations.find(res => 
        Math.abs(normalizeTs(res.time_timestamp) - slot.timestamp) < 60000 // within 1 minute
      )
      
      if (reservation) {
        timeline.push({ type: 'reservation', data: reservation })
      } else {
        timeline.push({ type: 'empty', timestamp: slot.timestamp, time: slot.time })
      }
    }
    
    return timeline
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredReservations, quickDate, customDate, activeTab, shopSettings, showEmptySlots, now])
  
  // Get selected date for manual booking
  const getSelectedDate = (): Date | null => {
    if (quickDate === 'today') return israelNow
    if (quickDate === 'tomorrow') return addDays(israelNow, 1)
    if (quickDate === 'custom' && customDate) return customDate
    return null
  }

  // Tab counts
  const getTabCounts = () => {
    const { start, end } = getDateRange()
    let base = [...reservations]
    
    if (start && end) {
      base = base.filter(res => {
        const resTime = normalizeTs(res.time_timestamp)
        return resTime >= start.getTime() && resTime <= end.getTime()
      })
    }
    
    return {
      upcoming: base.filter(r => normalizeTs(r.time_timestamp) > now && r.status === 'confirmed').length,
      past: base.filter(r => normalizeTs(r.time_timestamp) < now && r.status !== 'cancelled').length,
      cancelled: base.filter(r => r.status === 'cancelled').length
    }
  }

  const counts = getTabCounts()

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'upcoming', label: 'קרובים', count: counts.upcoming },
    { key: 'past', label: 'קודמים', count: counts.past },
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
      {/* Header with Add Button */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-medium text-foreground-light">תורים של לקוחות</h1>
          <p className="text-foreground-muted text-sm mt-0.5">ניהול תורים שנקבעו על ידי לקוחות</p>
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

      {/* Tabs - Compact Pills */}
      <div className="flex gap-1.5 mb-4 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
              activeTab === tab.key
                ? 'bg-white/[0.1] text-foreground-light shadow-sm'
                : 'text-foreground-muted hover:text-foreground-light'
            )}
          >
            {tab.label}
            <span className={cn(
              'px-1.5 py-0.5 rounded text-xs min-w-[20px]',
              activeTab === tab.key
                ? 'bg-accent-gold/20 text-accent-gold'
                : 'bg-white/[0.08] text-foreground-muted'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Toggle Empty Slots - Only for single day views */}
      {(quickDate === 'today' || quickDate === 'tomorrow' || quickDate === 'custom') && activeTab === 'upcoming' && (
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
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        {timelineItems.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={40} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted text-sm">אין תורים להציג</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {timelineItems.map((item) => {
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
                      className="p-1.5 rounded-lg bg-white/[0.05] text-foreground-muted/50 hover:bg-accent-gold/20 hover:text-accent-gold transition-colors opacity-0 group-hover:opacity-100"
                      title="הוסף תור"
                    >
                      <Plus size={14} strokeWidth={2} />
                    </button>
                  </div>
                )
              }
              
              // Reservation row
              const res = item.data
              const smartDate = getSmartDateTime(res.time_timestamp)
              const isUpcoming = normalizeTs(res.time_timestamp) > now && res.status === 'confirmed'
              const isCancelled = res.status === 'cancelled'
              
              return (
                <div
                  key={res.id}
                  onClick={() => setDetailModal({ isOpen: true, reservation: res })}
                  className={cn(
                    'flex items-center gap-3 px-3 sm:px-4 py-3 transition-all cursor-pointer hover:bg-white/[0.03]',
                    isCancelled && 'opacity-60'
                  )}
                >
                  {/* Time Display - Before indicator */}
                  <div className="flex flex-col items-center shrink-0 w-12">
                    <span className={cn(
                      'text-lg font-medium tabular-nums',
                      isUpcoming ? 'text-accent-gold' : 'text-foreground-muted'
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
                    isCancelled ? 'bg-red-500/60' : isUpcoming ? 'bg-accent-gold' : 'bg-foreground-muted/30'
                  )} />
                  
                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-foreground-light font-medium text-sm truncate',
                      isCancelled && 'line-through'
                    )}>
                      {res.customer_name}
                    </p>
                    <p className="text-foreground-muted text-xs truncate">
                      {res.services?.name_he || 'שירות'}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Phone */}
                    <a
                      href={`tel:${res.customer_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="icon-btn p-2 rounded-lg hover:bg-accent-gold/10 transition-colors"
                      aria-label="התקשר"
                    >
                      <Phone size={16} strokeWidth={1.5} className="text-accent-gold" />
                    </a>
                    
                    {/* Cancel */}
                    {res.status === 'confirmed' && (
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
