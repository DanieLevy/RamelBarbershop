'use client'

import { useEffect, useState, useMemo } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatTime as formatTimeUtil, formatDateHebrew, nowInIsrael } from '@/lib/utils'
import { startOfDay, endOfDay, addDays, format, isSameDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { Calendar, Phone, X, Clock, ChevronLeft, ChevronRight, Users, Scissors, Ban } from 'lucide-react'
import type { Reservation, Service } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'
import { CancelReservationModal } from '@/components/barber/CancelReservationModal'
import { BulkCancelModal } from '@/components/barber/BulkCancelModal'

interface ReservationWithService extends Reservation {
  services?: Service
}

type TabType = 'all' | 'upcoming' | 'past' | 'cancelled'

export default function ReservationsPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('ReservationsPage')
  
  const [reservations, setReservations] = useState<ReservationWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  
  // Date filter state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | null>(null)
  const [isRangeMode, setIsRangeMode] = useState(false)
  
  // Modal states
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean
    reservation: ReservationWithService | null
  }>({ isOpen: false, reservation: null })
  
  const [bulkCancelModal, setBulkCancelModal] = useState<{
    isOpen: boolean
    reservations: ReservationWithService[]
  }>({ isOpen: false, reservations: [] })

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
    
    try {
      const supabase = createClient()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('reservations') as any)
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
      
      // Cancel all reservations
      for (const res of toCancel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('reservations') as any)
          .update({ 
            status: 'cancelled',
            cancelled_by: 'barber',
            cancellation_reason: reason || null
          })
          .eq('id', res.id)
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

  // Normalize timestamp - handle both seconds and milliseconds
  const normalizeTs = (ts: number): number => {
    if (ts < 946684800000) return ts * 1000
    return ts
  }

  const formatTime = (timestamp: number): string => {
    return formatTimeUtil(normalizeTs(timestamp))
  }

  const now = Date.now()
  const israelNow = nowInIsrael()
  const todayStart = startOfDay(israelNow)
  const todayEnd = endOfDay(israelNow)

  // Smart date display: "היום 14:30" or "28/12 14:30"
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
    
    return {
      date: dateStr,
      time: formatTime(normalizedTs),
      isToday,
    }
  }

  // Filter reservations by date and tab
  const filteredReservations = useMemo(() => {
    let filtered = [...reservations]
    
    // Date filter
    if (selectedDate) {
      const startMs = startOfDay(selectedDate).getTime()
      const endMs = isRangeMode && dateRangeEnd 
        ? endOfDay(dateRangeEnd).getTime()
        : endOfDay(selectedDate).getTime()
      
      filtered = filtered.filter(res => {
        const resTime = normalizeTs(res.time_timestamp)
        return resTime >= startMs && resTime <= endMs
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
      // 'all' - no additional filter
    }
    
    return filtered
  }, [reservations, selectedDate, dateRangeEnd, isRangeMode, activeTab, now])

  // Get reservations for bulk cancel (only confirmed, selected date)
  const bulkCancellableReservations = useMemo(() => {
    if (!selectedDate) return []
    
    const startMs = startOfDay(selectedDate).getTime()
    const endMs = isRangeMode && dateRangeEnd 
      ? endOfDay(dateRangeEnd).getTime()
      : endOfDay(selectedDate).getTime()
    
    return reservations.filter(res => {
      const resTime = normalizeTs(res.time_timestamp)
      return resTime >= startMs && resTime <= endMs && res.status === 'confirmed'
    })
  }, [reservations, selectedDate, dateRangeEnd, isRangeMode])

  const tabs: { key: TabType; label: string; count: number }[] = [
    { 
      key: 'all', 
      label: 'הכל', 
      count: filteredReservations.filter(r => r.status !== 'cancelled').length 
    },
    { 
      key: 'upcoming', 
      label: 'קרובים', 
      count: filteredReservations.filter(r => normalizeTs(r.time_timestamp) > now && r.status === 'confirmed').length 
    },
    { 
      key: 'past', 
      label: 'קודמים', 
      count: filteredReservations.filter(r => normalizeTs(r.time_timestamp) < now && r.status !== 'cancelled').length 
    },
    { 
      key: 'cancelled', 
      label: 'מבוטלים', 
      count: filteredReservations.filter(r => r.status === 'cancelled').length 
    },
  ]

  // Quick date buttons
  const quickDates = [
    { label: 'היום', date: israelNow },
    { label: 'מחר', date: addDays(israelNow, 1) },
    { label: 'הכל', date: null },
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
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-foreground-light">תורים של לקוחות</h1>
        <p className="text-foreground-muted mt-1">ניהול תורים שנקבעו על ידי לקוחות</p>
      </div>

      {/* Date Filter Section */}
      <div className="mb-6 p-4 bg-background-card border border-white/10 rounded-xl">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-foreground-muted text-sm">סינון לפי תאריך:</span>
          
          {/* Quick Buttons */}
          {quickDates.map((qd) => (
            <button
              key={qd.label}
              onClick={() => {
                setSelectedDate(qd.date)
                setDateRangeEnd(null)
                setIsRangeMode(false)
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                (qd.date === null && selectedDate === null) || 
                (qd.date && selectedDate && isSameDay(qd.date, selectedDate) && !isRangeMode)
                  ? 'bg-accent-gold text-background-dark'
                  : 'bg-white/5 text-foreground-muted hover:text-foreground-light hover:bg-white/10'
              )}
            >
              {qd.label}
            </button>
          ))}
          
          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              const date = e.target.value ? new Date(e.target.value) : null
              setSelectedDate(date)
              if (!isRangeMode) setDateRangeEnd(null)
            }}
            className="px-3 py-1.5 rounded-lg text-sm bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold/50"
          />
          
          {/* Range Mode Toggle */}
          <button
            onClick={() => setIsRangeMode(!isRangeMode)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-all',
              isRangeMode
                ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
                : 'bg-white/5 text-foreground-muted hover:text-foreground-light border border-transparent'
            )}
          >
            טווח תאריכים
          </button>
        </div>
        
        {/* Date Range End */}
        {isRangeMode && selectedDate && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-foreground-muted text-sm">עד:</span>
            <input
              type="date"
              value={dateRangeEnd ? format(dateRangeEnd, 'yyyy-MM-dd') : ''}
              onChange={(e) => setDateRangeEnd(e.target.value ? new Date(e.target.value) : null)}
              min={format(selectedDate, 'yyyy-MM-dd')}
              className="px-3 py-1.5 rounded-lg text-sm bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold/50"
            />
          </div>
        )}
        
        {/* Bulk Cancel Button */}
        {selectedDate && bulkCancellableReservations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setBulkCancelModal({
                isOpen: true,
                reservations: bulkCancellableReservations
              })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm"
            >
              <Ban size={16} strokeWidth={1.5} />
              בטל את כל התורים ({bulkCancellableReservations.length})
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5',
              activeTab === tab.key
                ? 'bg-accent-gold text-background-dark'
                : 'bg-background-card border border-white/10 text-foreground-muted hover:text-foreground-light'
            )}
          >
            {tab.label}
            <span className={cn(
              'px-1.5 py-0.5 rounded text-xs',
              activeTab === tab.key
                ? 'bg-background-dark/20 text-background-dark'
                : 'bg-white/10 text-foreground-muted'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Reservations List */}
      <div className="bg-background-card border border-white/10 rounded-2xl overflow-hidden">
        {filteredReservations.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={48} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted">אין תורים להציג</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredReservations.map((res) => {
              const smartDate = getSmartDateTime(res.time_timestamp)
              const isUpcoming = normalizeTs(res.time_timestamp) > now && res.status === 'confirmed'
              
              return (
                <div
                  key={res.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-all',
                    res.status === 'cancelled' && 'opacity-60',
                    isUpcoming && 'bg-accent-gold/5'
                  )}
                >
                  {/* Status Indicator */}
                  <div className={cn(
                    'w-1.5 h-10 rounded-full flex-shrink-0',
                    res.status === 'cancelled'
                      ? 'bg-red-500'
                      : res.status === 'completed'
                        ? 'bg-green-500'
                        : isUpcoming
                          ? 'bg-accent-gold'
                          : 'bg-blue-500'
                  )} />
                  
                  {/* Customer Name */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-foreground-light font-medium truncate',
                      res.status === 'cancelled' && 'line-through'
                    )}>
                      {res.customer_name}
                    </p>
                    <p className="text-foreground-muted text-xs truncate">
                      {res.services?.name_he || 'שירות'}
                    </p>
                  </div>
                  
                  {/* Date & Time */}
                  <div className="text-left flex-shrink-0">
                    <p className={cn(
                      'text-sm font-medium',
                      smartDate.isToday ? 'text-accent-gold' : 'text-foreground-light'
                    )}>
                      {smartDate.time}
                    </p>
                    <p className="text-foreground-muted text-xs">
                      {smartDate.date}
                    </p>
                  </div>
                  
                  {/* Phone Icon */}
                  <a
                    href={`tel:${res.customer_phone}`}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                    title={res.customer_phone}
                  >
                    <Phone size={16} strokeWidth={1.5} className="text-accent-gold" />
                  </a>
                  
                  {/* Cancel Button - only for confirmed upcoming */}
                  {res.status === 'confirmed' && (
                    <button
                      onClick={() => setCancelModal({ isOpen: true, reservation: res })}
                      disabled={updatingId === res.id}
                      className={cn(
                        'p-2 rounded-full transition-colors flex-shrink-0',
                        updatingId === res.id
                          ? 'text-foreground-muted cursor-not-allowed'
                          : 'text-red-400 hover:bg-red-500/10'
                      )}
                      title="בטל תור"
                    >
                      <X size={16} strokeWidth={1.5} />
                    </button>
                  )}
                  
                  {/* Cancelled Badge */}
                  {res.status === 'cancelled' && (
                    <span className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs flex-shrink-0">
                      בוטל
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cancel Reservation Modal */}
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

      {/* Bulk Cancel Modal */}
      <BulkCancelModal
        isOpen={bulkCancelModal.isOpen}
        reservations={bulkCancelModal.reservations}
        selectedDate={selectedDate}
        onClose={() => setBulkCancelModal({ isOpen: false, reservations: [] })}
        onConfirm={handleBulkCancel}
        isLoading={updatingId === 'bulk'}
      />
    </div>
  )
}
