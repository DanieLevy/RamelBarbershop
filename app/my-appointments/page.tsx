'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/AppHeader'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppointmentDetailModal } from '@/components/barber/AppointmentDetailModal'
import { toast } from 'sonner'
import { cn, formatTime as formatTimeUtil, timestampToIsraelDate, nowInIsrael, isSameDayInIsrael } from '@/lib/utils'
import { Calendar, Scissors, User, X, History, ChevronRight, LogIn, Info, AlertCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReservationWithDetails } from '@/types/database'
import { LoginModal } from '@/components/LoginModal'
import { useBugReporter } from '@/hooks/useBugReporter'
import { useHaptics } from '@/hooks/useHaptics'
import ErrorBoundary from '@/components/ErrorBoundary'
import { cancelReservation } from '@/lib/services/booking.service'

type TabType = 'upcoming' | 'past' | 'cancelled'

interface Tab {
  key: TabType
  label: string
  icon: LucideIcon
  count: number
}

// Wrap the main component to use Suspense for useSearchParams and ErrorBoundary for error handling
export default function MyAppointmentsPage() {
  return (
    <ErrorBoundary component="MyAppointmentsPage">
      <Suspense fallback={
        <>
          <AppHeader />
          <main className="relative top-24 min-h-screen px-4 py-8">
            <div className="flex flex-col items-center justify-center py-20">
              <ScissorsLoader size="lg" text="טוען..." />
            </div>
          </main>
        </>
      }>
        <MyAppointmentsContent />
      </Suspense>
    </ErrorBoundary>
  )
}

function MyAppointmentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { customer, isLoggedIn, isLoading, isInitialized } = useAuthStore()
  const { report } = useBugReporter('MyAppointmentsPage')
  const haptics = useHaptics()
  
  // Get highlight param from URL (from push notification deep link)
  const highlightId = searchParams.get('highlight')
  
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean
    reservation: ReservationWithDetails | null
  }>({ isOpen: false, reservation: null })

  useEffect(() => {
    if (customer?.id || customer?.phone) {
      fetchReservations()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, customer?.phone])

  // Handle highlight param from push notification deep link
  useEffect(() => {
    if (!highlightId || loading || reservations.length === 0) return
    
    // Find the highlighted reservation
    const targetReservation = reservations.find(r => r.id === highlightId)
    
    if (targetReservation) {
      // Set visual highlight
      setHighlightedId(highlightId)
      
      // Determine which tab the reservation belongs to
      const now = Date.now()
      const resTime = targetReservation.time_timestamp < 946684800000 
        ? targetReservation.time_timestamp * 1000 
        : targetReservation.time_timestamp
      
      if (targetReservation.status === 'cancelled') {
        setActiveTab('cancelled')
      } else if (resTime <= now) {
        setActiveTab('past')
      } else {
        setActiveTab('upcoming')
      }
      
      // Auto-open the detail modal
      setTimeout(() => {
        setDetailModal({ isOpen: true, reservation: targetReservation })
      }, 300)
      
      // Clear the highlight param from URL without page reload
      window.history.replaceState({}, '', '/my-appointments')
      
      // Clear visual highlight after 5 seconds
      setTimeout(() => {
        setHighlightedId(null)
      }, 5000)
    }
  }, [highlightId, loading, reservations])

  const fetchReservations = async () => {
    if (!customer) return
    
    setLoading(true)
    
    try {
      const supabase = createClient()
      
      // Only select necessary fields for performance
      // Include version for optimistic locking
      let query = supabase
        .from('reservations')
        .select(`
          id, 
          time_timestamp, 
          status, 
          customer_name, 
          cancelled_by, 
          barber_id, 
          service_id,
          version,
          services (id, name_he), 
          users (id, fullname)
        `)
        .order('time_timestamp', { ascending: false })
      
      if (customer.id) {
        query = query.or(`customer_id.eq.${customer.id},customer_phone.eq.${customer.phone}`)
      } else if (customer.phone) {
        query = query.eq('customer_phone', customer.phone)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error fetching reservations:', error)
        await report(new Error(error.message), 'Fetching customer reservations')
        toast.error('שגיאה בטעינת התורים')
        return
      }
      
      setReservations((data as ReservationWithDetails[]) || [])
    } catch (err) {
      console.error('Error fetching reservations:', err)
      await report(err, 'Fetching customer reservations (exception)')
      toast.error('שגיאה בטעינת התורים')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelReservation = async (reservationId: string) => {
    const confirmed = window.confirm('האם אתה בטוח שברצונך לבטל את התור?')
    if (!confirmed) return
    
    // Get reservation details before cancelling for notification
    const reservation = reservations.find(r => r.id === reservationId)
    if (!reservation) {
      toast.error('התור לא נמצא')
      return
    }
    
    setCancellingId(reservationId)
    
    try {
      // Get current version for optimistic locking
      const currentVersion = (reservation as ReservationWithDetails & { version?: number }).version || 1
      
      // Use the centralized booking service for cancellation
      const result = await cancelReservation(
        reservationId,
        'customer',
        undefined, // No reason from customer UI
        currentVersion
      )
      
      if (!result.success) {
        console.error('Error cancelling reservation:', result.error)
        
        if (result.concurrencyConflict) {
          toast.error('התור עודכן על ידי אחר. מרענן...')
          await fetchReservations() // Refresh to get latest data
          return
        }
        
        await report(new Error(result.error || 'Unknown cancellation error'), 'Cancelling customer reservation')
        toast.error(result.error || 'שגיאה בביטול התור')
        return
      }
      
      // Send push notification to barber (fire and forget)
      if (reservation?.barber_id) {
        fetch('/api/push/notify-cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            customerId: customer?.id,
            barberId: reservation.barber_id,
            cancelledBy: 'customer',
            customerName: customer?.fullname || reservation.customer_name,
            barberName: reservation.users?.fullname || 'הספר',
            serviceName: reservation.services?.name_he || 'שירות',
            appointmentTime: reservation.time_timestamp
          })
        }).catch(err => console.log('Push notification error:', err))
      }
      
      haptics.medium() // Haptic feedback for cancellation
      toast.success('התור בוטל בהצלחה')
      await fetchReservations()
    } catch (err) {
      console.error('Error cancelling reservation:', err)
      await report(err, 'Cancelling customer reservation (exception)')
      toast.error('שגיאה בביטול התור')
    } finally {
      setCancellingId(null)
    }
  }

  // Normalize timestamp
  const normalizeTimestamp = (ts: number): number => {
    if (ts < 946684800000) return ts * 1000
    return ts
  }

  const isUpcoming = (reservation: ReservationWithDetails): boolean => {
    const now = Date.now()
    const resTime = normalizeTimestamp(reservation.time_timestamp)
    return resTime > now && reservation.status === 'confirmed'
  }

  const isPast = (reservation: ReservationWithDetails): boolean => {
    const now = Date.now()
    const resTime = normalizeTimestamp(reservation.time_timestamp)
    return resTime <= now && reservation.status !== 'cancelled'
  }

  const isCancelled = (reservation: ReservationWithDetails): boolean => {
    return reservation.status === 'cancelled'
  }

  // Smart date/time display - using Israel timezone
  const getSmartDateTime = (timestamp: number): { date: string; time: string; isToday: boolean } => {
    const normalizedTs = normalizeTimestamp(timestamp)
    const resDate = timestampToIsraelDate(normalizedTs)
    const today = nowInIsrael()
    const tomorrowMs = today.getTime() + 24 * 60 * 60 * 1000
    const isToday = isSameDayInIsrael(normalizedTs, today.getTime())
    const isTomorrow = isSameDayInIsrael(normalizedTs, tomorrowMs)
    
    let dateStr = ''
    if (isToday) dateStr = 'היום'
    else if (isTomorrow) dateStr = 'מחר'
    else dateStr = resDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
    
    return { date: dateStr, time: formatTimeUtil(normalizedTs), isToday }
  }

  const filteredReservations = reservations.filter(r => {
    switch (activeTab) {
      case 'upcoming': return isUpcoming(r)
      case 'past': return isPast(r)
      case 'cancelled': return isCancelled(r)
      default: return true
    }
  })

  const tabs: Tab[] = [
    { key: 'upcoming', label: 'קרובים', icon: Calendar, count: reservations.filter(isUpcoming).length },
    { key: 'past', label: 'עברו', icon: History, count: reservations.filter(isPast).length },
    { key: 'cancelled', label: 'בוטלו', icon: X, count: reservations.filter(isCancelled).length },
  ]

  if (!isInitialized || isLoading) {
    return (
      <>
        <AppHeader />
        <main className="relative top-24 min-h-screen px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <ScissorsLoader size="lg" text="טוען..." />
          </div>
        </main>
      </>
    )
  }

  // Show login prompt for guests
  if (!isLoggedIn) {
    return (
      <>
        <AppHeader />
        <main className="relative top-20 sm:top-24 min-h-screen bg-background-dark">
          <div className="container-mobile py-8 sm:py-12 pb-24">
            <div className="max-w-md mx-auto">
              <GlassCard className="text-center py-12 px-6">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-gold/10 flex items-center justify-center">
                  <Calendar size={40} strokeWidth={1} className="text-accent-gold" />
                </div>
                
                <h1 className="text-2xl text-foreground-light font-medium mb-3">
                  התורים שלי
                </h1>
                
                <p className="text-foreground-muted mb-8 leading-relaxed">
                  התחבר כדי לראות את התורים שלך,
                  <br />
                  לנהל הזמנות ולקבל תזכורות
                </p>
                
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90 transition-all hover:scale-[1.02]"
                >
                  <LogIn size={20} strokeWidth={2} />
                  <span>התחבר עכשיו</span>
                </button>
                
                <div className="mt-6 pt-6 border-t border-white/10 flex flex-col items-center">
                  <p className="text-foreground-muted text-sm mb-3">עדיין לא קבעת תור?</p>
                  <button
                    onClick={() => router.push('/')}
                    className="text-accent-gold hover:underline text-sm font-medium"
                  >
                    קבע תור חדש ←
                  </button>
                </div>
              </GlassCard>
            </div>
          </div>
        </main>
        
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </>
    )
  }

  return (
    <>
      <AppHeader />
      
      <main id="main-content" tabIndex={-1} className="relative top-20 sm:top-24 min-h-screen bg-background-dark outline-none">
        <div className="container-mobile py-6 sm:py-8 pb-24">
          <div className="max-w-2xl mx-auto">
            {/* Header with New Appointment Button */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl text-foreground-light font-medium">
                  התורים שלי
                </h1>
                <p className="text-foreground-muted text-sm mt-0.5">
                  שלום {customer?.fullname}
                </p>
              </div>
              
              {/* Quick New Appointment Button */}
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-1.5 px-3 py-2 bg-accent-gold text-background-dark rounded-xl text-sm font-medium hover:bg-accent-gold/90 transition-all hover:scale-[1.02] shrink-0"
              >
                <Calendar size={14} strokeWidth={2} />
                <span className="hidden sm:inline">תור חדש</span>
                <span className="sm:hidden">+</span>
              </button>
            </div>
            
            {/* Tabs - Compact Pills */}
            <div className="flex gap-1.5 mb-4 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
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
                    <Icon size={14} strokeWidth={1.5} />
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
                )
              })}
            </div>
            
            {/* Content */}
            {loading ? (
              <div className="flex flex-col items-center py-16">
                <ScissorsLoader size="md" text="טוען תורים..." />
              </div>
            ) : filteredReservations.length === 0 ? (
              <GlassCard className="flex flex-col items-center text-center py-12">
                <div className="w-16 h-16 mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <Calendar size={32} strokeWidth={1} className="text-foreground-muted" />
                </div>
                <p className="text-foreground-muted mb-4">
                  {activeTab === 'upcoming' && 'אין תורים קרובים'}
                  {activeTab === 'past' && 'אין תורים שעברו'}
                  {activeTab === 'cancelled' && 'אין תורים מבוטלים'}
                </p>
                {activeTab === 'upcoming' && (
                  <button
                    onClick={() => router.push('/')}
                    className="px-6 py-3 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90 transition-all hover:scale-[1.02]"
                  >
                    קבע תור חדש
                  </button>
                )}
              </GlassCard>
            ) : (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="divide-y divide-white/[0.04]">
                  {filteredReservations.map((reservation) => {
                    const smartDate = getSmartDateTime(reservation.time_timestamp)
                    const upcoming = isUpcoming(reservation)
                    const cancelled = isCancelled(reservation)
                    const isHighlighted = highlightedId === reservation.id
                    
                    return (
                      <div
                        key={reservation.id}
                        onClick={() => setDetailModal({ isOpen: true, reservation })}
                        className={cn(
                          'flex items-center gap-3 px-3 sm:px-4 py-3 transition-all cursor-pointer hover:bg-white/[0.03]',
                          cancelled && 'opacity-60',
                          isHighlighted && 'bg-accent-gold/10 ring-2 ring-accent-gold/50 ring-inset animate-pulse'
                        )}
                      >
                        {/* Time Display - Before indicator */}
                        <div className="flex flex-col items-center shrink-0 w-14">
                          <span className={cn(
                            'text-lg font-medium tabular-nums',
                            cancelled ? 'text-red-400/60' : upcoming ? 'text-accent-gold' : 'text-foreground-muted'
                          )}>
                            {smartDate.time}
                          </span>
                          <span className={cn(
                            'text-xs',
                            smartDate.isToday ? 'text-accent-gold' : 'text-foreground-muted'
                          )}>
                            {smartDate.date}
                          </span>
                        </div>
                        
                        {/* Status Line */}
                        <div className={cn(
                          'w-1 h-12 rounded-full shrink-0',
                          cancelled ? 'bg-red-500/60' : upcoming ? 'bg-accent-gold' : 'bg-foreground-muted/30'
                        )} />
                        
                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          {/* Barber & Service */}
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
                            <span className="font-medium text-foreground-light text-sm truncate">
                              {reservation.users?.fullname || 'ספר'}
                            </span>
                          </div>
                          
                          {/* Service */}
                          <p className="text-foreground-muted text-xs flex items-center gap-1.5">
                            <Scissors size={11} />
                            <span className="truncate">{reservation.services?.name_he || 'שירות'}</span>
                          </p>
                          
                          {/* Cancelled info */}
                          {cancelled && reservation.cancelled_by && (
                            <div className="flex items-center gap-1 mt-1.5 text-xs text-red-400/80">
                              <AlertCircle className="w-3 h-3" />
                              <span>
                                {reservation.cancelled_by === 'barber' ? 'בוטל ע״י הספר' : 'בוטל על ידך'}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Info */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetailModal({ isOpen: true, reservation })
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/[0.08] transition-colors"
                            aria-label="פרטים"
                          >
                            <Info size={16} strokeWidth={1.5} className="text-foreground-muted" />
                          </button>
                          
                          {/* Cancel - only for upcoming */}
                          {upcoming && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelReservation(reservation.id)
                              }}
                              disabled={cancellingId === reservation.id}
                              className={cn(
                                'w-10 h-10 flex items-center justify-center rounded-lg transition-colors',
                                cancellingId === reservation.id
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-red-500/10 text-red-400'
                              )}
                              aria-label="בטל"
                            >
                              <X size={16} strokeWidth={1.5} />
                            </button>
                          )}
                          
                          {/* Cancelled Badge */}
                          {cancelled && (
                            <span className="px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-xs shrink-0">
                              בוטל
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Back Button */}
            <div className="mt-8 text-center">
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground-light text-sm transition-colors py-2"
              >
                <ChevronRight size={12} strokeWidth={1.5} />
                <span>חזרה לדף הבית</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      <AppointmentDetailModal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal({ isOpen: false, reservation: null })}
        reservation={detailModal.reservation}
        variant="customer"
      />
    </>
  )
}
