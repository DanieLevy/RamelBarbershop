'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/AppHeader'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppointmentDetailModal } from '@/components/barber/AppointmentDetailModal'
import { toast } from 'sonner'
import { cn, formatTime as formatTimeUtil } from '@/lib/utils'
import { Calendar, Clock, Scissors, User, X, History, ChevronRight, LogIn, Info, Phone, AlertCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReservationWithDetails } from '@/types/database'
import { LoginModal } from '@/components/LoginModal'
import { useBugReporter } from '@/hooks/useBugReporter'
import { isSameDay, addDays } from 'date-fns'

type TabType = 'upcoming' | 'past' | 'cancelled'

interface Tab {
  key: TabType
  label: string
  icon: LucideIcon
  count: number
}

export default function MyAppointmentsPage() {
  const router = useRouter()
  const { customer, isLoggedIn, isLoading, isInitialized } = useAuthStore()
  const { report } = useBugReporter('MyAppointmentsPage')
  
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
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

  const fetchReservations = async () => {
    if (!customer) return
    
    setLoading(true)
    
    try {
      const supabase = createClient()
      
      let query = supabase
        .from('reservations')
        .select(`*, services (*), users (*)`)
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
    
    setCancellingId(reservationId)
    
    try {
      const supabase = createClient()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('reservations') as any)
        .update({ status: 'cancelled', cancelled_by: 'customer' })
        .eq('id', reservationId)
        .select('id, status') as { data: { id: string; status: string }[] | null; error: unknown }
      
      if (error) {
        console.error('Error cancelling reservation:', error)
        await report(new Error((error as Error)?.message || 'Unknown cancellation error'), 'Cancelling customer reservation')
        toast.error(`שגיאה בביטול התור`)
        return
      }
      
      if (!data || data.length === 0) {
        toast.error('שגיאה בביטול התור - לא נמצא התור')
        return
      }
      
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

  // Smart date/time display
  const getSmartDateTime = (timestamp: number): { date: string; time: string; isToday: boolean } => {
    const normalizedTs = normalizeTimestamp(timestamp)
    const resDate = new Date(normalizedTs)
    const today = new Date()
    const tomorrow = addDays(today, 1)
    const isToday = isSameDay(resDate, today)
    const isTomorrow = isSameDay(resDate, tomorrow)
    
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
                
                <div className="mt-6 pt-6 border-t border-white/10">
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
      
      <main className="relative top-20 sm:top-24 min-h-screen bg-background-dark">
        <div className="container-mobile py-6 sm:py-8 pb-24">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-xl sm:text-2xl text-foreground-light font-medium">
                התורים שלי
              </h1>
              <p className="text-foreground-muted text-sm mt-0.5">
                שלום {customer?.fullname}
              </p>
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
              <GlassCard className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
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
                    
                    return (
                      <div
                        key={reservation.id}
                        onClick={() => setDetailModal({ isOpen: true, reservation })}
                        className={cn(
                          'flex items-center gap-3 px-3 sm:px-4 py-3 transition-all cursor-pointer hover:bg-white/[0.03]',
                          cancelled && 'opacity-60'
                        )}
                      >
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
                          
                          {/* Service & Time */}
                          <p className="text-foreground-muted text-xs flex items-center gap-1.5">
                            <Scissors size={11} />
                            <span className="truncate max-w-[80px]">{reservation.services?.name_he || 'שירות'}</span>
                            <span className="text-foreground-muted/50">•</span>
                            <Clock size={11} />
                            <span>{smartDate.time}</span>
                            <span className={cn(smartDate.isToday && 'text-accent-gold')}>
                              {smartDate.date}
                            </span>
                          </p>
                          
                          {/* Cancelled info */}
                          {cancelled && reservation.cancelled_by && (
                            <div className="flex items-center gap-1 mt-1.5 text-xs text-red-400/80">
                              <AlertCircle className="w-3 h-3" />
                              <span>
                                בוטל ע&quot;י {reservation.cancelled_by === 'barber' ? 'הספר' : 'אתה'}
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
                            className="p-2 rounded-lg hover:bg-white/[0.08] transition-colors"
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
                                'p-2 rounded-lg transition-colors',
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
