'use client'

import { useEffect, useState, useMemo } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatTime as formatTimeUtil, nowInIsrael } from '@/lib/utils'
import { startOfDay, endOfDay, addDays, format, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
import { he } from 'date-fns/locale'
import { Calendar, Phone, X, Clock, Ban, Info } from 'lucide-react'
import type { Reservation, Service } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'
import { CancelReservationModal } from '@/components/barber/CancelReservationModal'
import { BulkCancelModal } from '@/components/barber/BulkCancelModal'
import { AppointmentDetailModal } from '@/components/barber/AppointmentDetailModal'

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

  useEffect(() => {
    if (barber?.id) {
      fetchReservations()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])

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

  // Bulk cancellable reservations
  const bulkCancellableReservations = useMemo(() => {
    const { start, end } = getDateRange()
    if (!start || !end) return []
    
    return reservations.filter(res => {
      const resTime = normalizeTs(res.time_timestamp)
      return resTime >= start.getTime() && resTime <= end.getTime() && res.status === 'confirmed'
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, quickDate, customDate])

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
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-medium text-foreground-light">תורים של לקוחות</h1>
        <p className="text-foreground-muted text-sm mt-0.5">ניהול תורים שנקבעו על ידי לקוחות</p>
      </div>

      {/* Date Filter Chips - Horizontal Scroll */}
      <div className="mb-4 -mx-4 px-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {quickDateChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => {
                setQuickDate(chip.key)
                setCustomDate(null)
              }}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0',
                quickDate === chip.key
                  ? 'bg-accent-gold text-background-dark shadow-lg shadow-accent-gold/20'
                  : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.1] border border-white/[0.08]'
              )}
            >
              {chip.label}
            </button>
          ))}
          
          {/* Custom Date Picker Chip */}
          <div className="relative shrink-0">
            <input
              type="date"
              value={customDate ? format(customDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : null
                setCustomDate(date)
                if (date) setQuickDate('custom')
              }}
              className={cn(
                'w-32 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer',
                'bg-white/[0.05] border border-white/[0.08] text-foreground-light',
                'focus:outline-none focus:ring-2 focus:ring-accent-gold/50',
                quickDate === 'custom' && 'bg-accent-gold/20 border-accent-gold/30 text-accent-gold'
              )}
            />
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

      {/* Bulk Cancel Button */}
      {quickDate !== 'all' && bulkCancellableReservations.length > 1 && (
        <button
          onClick={() => setBulkCancelModal({
            isOpen: true,
            reservations: bulkCancellableReservations
          })}
          className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm font-medium"
        >
          <Ban size={16} strokeWidth={1.5} />
          בטל את כל התורים ({bulkCancellableReservations.length})
        </button>
      )}

      {/* Reservations List */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        {filteredReservations.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={40} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted text-sm">אין תורים להציג</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filteredReservations.map((res) => {
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
                    <p className="text-foreground-muted text-xs truncate flex items-center gap-1.5">
                      <span>{res.services?.name_he || 'שירות'}</span>
                      <span className="text-foreground-muted/50">•</span>
                      <Clock size={11} className="inline" />
                      <span>{smartDate.time}</span>
                      <span className={cn(smartDate.isToday && 'text-accent-gold')}>
                        {smartDate.date}
                      </span>
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Info icon */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailModal({ isOpen: true, reservation: res })
                      }}
                      className="icon-btn p-2 rounded-lg hover:bg-white/[0.08] transition-colors"
                      aria-label="פרטים"
                    >
                      <Info size={16} strokeWidth={1.5} className="text-foreground-muted" />
                    </button>
                    
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
    </div>
  )
}
