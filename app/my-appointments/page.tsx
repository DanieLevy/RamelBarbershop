'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/AppHeader'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppointmentDetailModal } from '@/components/barber/AppointmentDetailModal'
import { showToast } from '@/lib/toast'
import { cn, formatTime as formatTimeUtil, timestampToIsraelDate, nowInIsrael, isSameDayInIsrael, normalizeTimestampFormat } from '@/lib/utils'
import { Calendar, Scissors, User, X, History, ChevronRight, LogIn, Info, AlertCircle, Repeat, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReservationWithDetails, CustomerRecurringAppointment } from '@/types/database'
import { LoginModal } from '@/components/LoginModal'
import { useBugReporter } from '@/hooks/useBugReporter'
import { useHaptics } from '@/hooks/useHaptics'
import ErrorBoundary from '@/components/ErrorBoundary'
import { cancelReservation } from '@/lib/services/booking.service'
import { CancelBlockedModal } from '@/components/booking/CancelBlockedModal'
import { getRecurringByCustomer } from '@/lib/services/recurring.service'
import { Button } from '@heroui/react'

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
          <main className="main-content-offset min-h-screen px-4 py-8">
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
  
  // Get URL params from push notification deep links
  const highlightId = searchParams.get('highlight')
  const tabParam = searchParams.get('tab') as TabType | null
  
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [recurringAppointments, setRecurringAppointments] = useState<CustomerRecurringAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean
    reservation: ReservationWithDetails | null
  }>({ isOpen: false, reservation: null })
  
  // Cancel blocked modal state
  const [cancelBlockedModal, setCancelBlockedModal] = useState<{
    isOpen: boolean
    reservation: ReservationWithDetails | null
    hoursUntil: number
    minCancelHours: number
  }>({ isOpen: false, reservation: null, hoursUntil: 0, minCancelHours: 3 })
  
  // Cache for barber cancellation settings
  const [barberCancelSettings, setBarberCancelSettings] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (customer?.id || customer?.phone) {
      fetchReservations()
      fetchRecurringAppointments()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, customer?.phone])

  const fetchRecurringAppointments = async () => {
    if (!customer?.id) return
    
    try {
      const recurring = await getRecurringByCustomer(customer.id)
      setRecurringAppointments(recurring)
    } catch (err) {
      console.error('Error fetching recurring appointments:', err)
      // Don't show error toast - recurring is optional display
      // On mobile Safari "Load failed" is common during app wake-up
      // The data is non-critical so we silently fail
    }
  }

  // Handle URL params from push notification deep links
  // This processes highlight and tab params to show the specific reservation
  useEffect(() => {
    if (!highlightId || loading || reservations.length === 0) return
    
    // Find the highlighted reservation
    const targetReservation = reservations.find(r => r.id === highlightId)
    
    if (targetReservation) {
      console.log('[DeepLink] Found target reservation:', highlightId)
      
      // Set visual highlight
      setHighlightedId(highlightId)
      
      // Switch to the correct tab based on URL param or reservation status
      if (tabParam) {
        setActiveTab(tabParam)
      } else {
        // Determine which tab the reservation belongs to
        const now = Date.now()
        const resTime = normalizeTimestampFormat(targetReservation.time_timestamp)
        
        if (targetReservation.status === 'cancelled') {
          setActiveTab('cancelled')
        } else if (resTime <= now) {
          setActiveTab('past')
        } else {
          setActiveTab('upcoming')
        }
      }
      
      // Auto-open the detail modal
      setTimeout(() => {
        setDetailModal({ isOpen: true, reservation: targetReservation })
      }, 300)
      
      // Clear the URL params without page reload
      window.history.replaceState({}, '', '/my-appointments')
      
      // Clear visual highlight after 5 seconds
      setTimeout(() => {
        setHighlightedId(null)
      }, 5000)
    }
  }, [highlightId, tabParam, loading, reservations])

  const fetchReservations = async () => {
    if (!customer) return
    
    setLoading(true)
    
    try {
      const supabase = createClient()
      
      // Only select necessary fields for performance
      // Include version for optimistic locking
      // IMPORTANT: date_timestamp is required for AppointmentDetailModal
      let query = supabase
        .from('reservations')
        .select(`
          id, 
          date_timestamp,
          time_timestamp, 
          status, 
          customer_name,
          customer_phone,
          barber_notes,
          cancelled_by, 
          cancellation_reason,
          barber_id, 
          service_id,
          version,
          created_at,
          services (id, name_he, price), 
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
        showToast.error('שגיאה בטעינת התורים')
        return
      }
      
      setReservations((data as ReservationWithDetails[]) || [])
    } catch (err) {
      console.error('Error fetching reservations:', err)
      await report(err, 'Fetching customer reservations (exception)')
      showToast.error('שגיאה בטעינת התורים')
    } finally {
      setLoading(false)
    }
  }

  // Get barber's minimum cancel hours setting from barber_booking_settings
  const getBarberMinCancelHours = async (barberId: string): Promise<number> => {
    // Check cache first
    if (barberCancelSettings.has(barberId)) {
      return barberCancelSettings.get(barberId)!
    }
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('barber_booking_settings')
        .select('min_cancel_hours')
        .eq('barber_id', barberId)
        .single()
      
      if (error || !data) {
        // Default to 2 hours if no setting found
        return 2
      }
      
      const minHours = data.min_cancel_hours ?? 2
      
      // Cache the result
      setBarberCancelSettings(prev => new Map(prev).set(barberId, minHours))
      
      return minHours
    } catch (err) {
      console.error('Error fetching barber cancel settings:', err)
      return 2 // Default fallback
    }
  }

  const handleCancelReservation = async (reservationId: string) => {
    // Get reservation details before cancelling for notification
    const reservation = reservations.find(r => r.id === reservationId)
    if (!reservation) {
      showToast.error('התור לא נמצא')
      return
    }
    
    // Check if cancellation is blocked by time restriction
    if (reservation.barber_id) {
      const minCancelHours = await getBarberMinCancelHours(reservation.barber_id)
      
      if (minCancelHours > 0) {
        const now = Date.now()
        const resTime = normalizeTimestampFormat(reservation.time_timestamp)
        const hoursUntil = (resTime - now) / (1000 * 60 * 60)
        
        if (hoursUntil < minCancelHours && hoursUntil > 0) {
          // Show the cancel blocked modal
          setCancelBlockedModal({
            isOpen: true,
            reservation,
            hoursUntil,
            minCancelHours
          })
          return
        }
      }
    }
    
    // Standard cancellation flow
    const confirmed = window.confirm('האם אתה בטוח שברצונך לבטל את התור?')
    if (!confirmed) return
    
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
          showToast.error('התור עודכן על ידי אחר. מרענן...')
          await fetchReservations() // Refresh to get latest data
          return
        }
        
        await report(new Error(result.error || 'Unknown cancellation error'), 'Cancelling customer reservation')
        showToast.error(result.error || 'שגיאה בביטול התור')
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
      showToast.success('התור בוטל בהצלחה')
      await fetchReservations()
    } catch (err) {
      console.error('Error cancelling reservation:', err)
      await report(err, 'Cancelling customer reservation (exception)')
      showToast.error('שגיאה בביטול התור')
    } finally {
      setCancellingId(null)
    }
  }

  // Use shared timestamp format normalization
  const normalizeTimestamp = normalizeTimestampFormat

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
        <main className="main-content-offset min-h-screen px-4 py-8">
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
        <main className="main-content-offset min-h-screen bg-background-dark">
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
                
                <Button
                  variant="primary"
                  onPress={() => setShowLoginModal(true)}
                  className="w-full"
                  size="lg"
                >
                  <LogIn size={20} strokeWidth={2} />
                  <span>התחבר עכשיו</span>
                </Button>
                
                <div className="mt-6 pt-6 border-t border-white/10 flex flex-col items-center">
                  <p className="text-foreground-muted text-sm mb-3">עדיין לא קבעת תור?</p>
                  <Button
                    variant="ghost"
                    onPress={() => router.push('/')}
                    className="text-accent-gold text-sm"
                  >
                    קבע תור חדש ←
                  </Button>
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
      
      <main id="main-content" tabIndex={-1} className="bg-background-dark outline-none pb-24">
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
              <Button
                variant="primary"
                onPress={() => router.push('/')}
                className="shrink-0 w-10 h-10 rounded-sm"
                size="sm"
              >
                <Calendar size={14} strokeWidth={2} />
                <span className="hidden sm:inline">תור חדש</span>
                <span className="sm:hidden">+</span>
              </Button>
            </div>
            
            {/* Recurring Appointments Section */}
            {recurringAppointments.length > 0 && (
              <div className="mb-6">
                <GlassCard className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Repeat size={16} className="text-purple-400" />
                    </div>
                    <h2 className="text-base font-medium text-foreground-light">תורים קבועים</h2>
                  </div>
                  <div className="space-y-2">
                    {recurringAppointments.map(rec => (
                      <div 
                        key={rec.id}
                        className="flex items-center justify-between gap-3 py-2 px-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center w-12">
                            <span className="text-sm font-medium text-purple-400">{rec.time_slot.substring(0, 5)}</span>
                            <span className="text-xs text-foreground-muted">יום {rec.day_of_week_hebrew}</span>
                          </div>
                          <div className="border-l border-white/10 h-8" />
                          <div>
                            <p className="text-sm text-foreground-light">{rec.barber_name}</p>
                            <p className="text-xs text-foreground-muted flex items-center gap-1">
                              <Scissors size={10} />
                              {rec.service_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-purple-400/60 bg-purple-500/10 px-2 py-1 rounded-full">
                          <Clock size={10} />
                          <span>כל שבוע</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            )}
            
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
                  <Button
                    variant="primary"
                    onPress={() => router.push('/')}
                  >
                    קבע תור חדש
                  </Button>
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
                          <Button
                            variant="ghost"
                            isIconOnly
                            onPress={() => setDetailModal({ isOpen: true, reservation })}
                            className="min-w-[40px] w-10 h-10"
                            aria-label="פרטים"
                          >
                            <Info size={16} strokeWidth={1.5} className="text-foreground-muted" />
                          </Button>
                          
                          {/* Cancel - only for upcoming */}
                          {upcoming && (
                            <Button
                              variant="ghost"
                              isIconOnly
                              onPress={() => handleCancelReservation(reservation.id)}
                              isDisabled={cancellingId === reservation.id}
                              className={cn(
                                'min-w-[40px] w-10 h-10',
                                cancellingId !== reservation.id && 'hover:bg-red-500/10 text-red-400'
                              )}
                              aria-label="בטל"
                            >
                              <X size={16} strokeWidth={1.5} />
                            </Button>
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
              <Button
                variant="ghost"
                onPress={() => router.push('/')}
                className="text-foreground-muted text-sm"
              >
                <ChevronRight size={12} strokeWidth={1.5} />
                <span>חזרה לדף הבית</span>
              </Button>
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

      {/* Cancel Blocked Modal */}
      {cancelBlockedModal.reservation && (
        <CancelBlockedModal
          isOpen={cancelBlockedModal.isOpen}
          onClose={() => setCancelBlockedModal({ isOpen: false, reservation: null, hoursUntil: 0, minCancelHours: 3 })}
          reservationId={cancelBlockedModal.reservation.id}
          barberId={cancelBlockedModal.reservation.barber_id}
          barberName={cancelBlockedModal.reservation.users?.fullname || 'הספר'}
          customerId={customer?.id || ''}
          customerName={customer?.fullname || cancelBlockedModal.reservation.customer_name}
          serviceName={cancelBlockedModal.reservation.services?.name_he || 'שירות'}
          appointmentTime={cancelBlockedModal.reservation.time_timestamp}
          hoursUntil={cancelBlockedModal.hoursUntil}
          minCancelHours={cancelBlockedModal.minCancelHours}
        />
      )}
    </>
  )
}
