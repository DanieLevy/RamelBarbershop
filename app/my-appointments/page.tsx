'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/AppHeader'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { GlassCard } from '@/components/ui/GlassCard'
import { toast } from 'sonner'
import { cn, formatDateHebrew, formatTime as formatTimeUtil } from '@/lib/utils'
import { Calendar, Clock, Scissors, User, X, History, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReservationWithDetails } from '@/types/database'

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
  
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    if (isInitialized && !isLoggedIn) {
      router.replace('/')
    }
  }, [isInitialized, isLoggedIn, router])

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
      
      // Fetch by customer_id OR by phone number (fallback for old reservations)
      let query = supabase
        .from('reservations')
        .select(`
          *,
          services (*),
          users (*)
        `)
        .order('time_timestamp', { ascending: false })
      
      if (customer.id) {
        // Use OR to get reservations by customer_id or phone
        query = query.or(`customer_id.eq.${customer.id},customer_phone.eq.${customer.phone}`)
      } else if (customer.phone) {
        query = query.eq('customer_phone', customer.phone)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error fetching reservations:', error)
        toast.error('שגיאה בטעינת התורים')
        return
      }
      
      setReservations((data as ReservationWithDetails[]) || [])
    } catch (err) {
      console.error('Error fetching reservations:', err)
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
      
      // Perform the update
      const { data, error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('reservations') as any)
        .update({ status: 'cancelled' })
        .eq('id', reservationId)
        .select('id, status') as { data: { id: string; status: string }[] | null; error: unknown }
      
      if (error) {
        console.error('Error cancelling reservation:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        toast.error(`שגיאה בביטול התור: ${(error as Error)?.message || 'נסה שוב'}`)
        return
      }
      
      // Verify the update actually happened
      if (!data || data.length === 0) {
        console.error('No data returned after update - cancellation may have failed')
        toast.error('שגיאה בביטול התור - לא נמצא התור')
        return
      }
      
      // Check if status was actually updated
      const updated = data[0]
      if (updated.status !== 'cancelled') {
        console.error('Status was not updated to cancelled:', updated)
        toast.error('שגיאה בביטול התור - הסטטוס לא עודכן')
        return
      }
      
      toast.success('התור בוטל בהצלחה')
      
      // Refresh data from server to ensure sync
      await fetchReservations()
    } catch (err) {
      console.error('Error cancelling reservation:', err)
      toast.error('שגיאה בביטול התור')
    } finally {
      setCancellingId(null)
    }
  }

  // Normalize timestamp - handle both seconds and milliseconds
  const normalizeTimestamp = (ts: number): number => {
    if (ts < 946684800000) {
      return ts * 1000
    }
    return ts
  }

  const formatDate = (timestamp: number): string => {
    return formatDateHebrew(normalizeTimestamp(timestamp))
  }

  const formatTime = (timestamp: number): string => {
    return formatTimeUtil(normalizeTimestamp(timestamp))
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

  // Get status display text
  const getStatusText = (reservation: ReservationWithDetails): string => {
    if (reservation.status === 'cancelled') return 'בוטל'
    if (reservation.status === 'completed') return 'הושלם'
    if (isUpcoming(reservation)) return 'קרוב'
    return 'הסתיים'
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

  if (!isLoggedIn) {
    return null
  }

  return (
    <>
      <AppHeader />
      
      <main className="relative top-20 sm:top-24 min-h-screen bg-background-dark">
        <div className="container-mobile py-6 sm:py-8 pb-24">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl text-foreground-light font-medium">
                התורים שלי
              </h1>
              <p className="text-foreground-muted mt-2 text-sm sm:text-base">
                שלום {customer?.fullname}, כאן תוכל לצפות ולנהל את התורים שלך
              </p>
            </div>
            
            {/* Tabs - horizontal scroll on mobile */}
            <div className="flex gap-1 sm:gap-2 mb-6 bg-background-card rounded-xl p-1 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex-1 min-w-[90px] py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap',
                      activeTab === tab.key
                        ? 'bg-accent-gold text-background-dark'
                        : 'text-foreground-muted hover:text-foreground-light'
                    )}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full',
                        activeTab === tab.key
                          ? 'bg-background-dark/20'
                          : 'bg-white/10'
                      )}>
                        {tab.count}
                      </span>
                    )}
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
              <div className="flex flex-col gap-3 sm:gap-4">
                {filteredReservations.map((reservation) => (
                  <GlassCard
                    key={reservation.id}
                    variant="default"
                    padding="md"
                    className={cn(
                      'transition-all',
                      reservation.status === 'cancelled' 
                        ? 'border-red-500/30 opacity-70' 
                        : isUpcoming(reservation)
                          ? 'border-accent-gold/30'
                          : ''
                    )}
                  >
                    {/* Status Badge & Cancel Button */}
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium',
                        reservation.status === 'cancelled' 
                          ? 'bg-red-500/20 text-red-400'
                          : reservation.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : isUpcoming(reservation)
                              ? 'bg-accent-gold/20 text-accent-gold'
                              : 'bg-blue-500/20 text-blue-400'
                      )}>
                        {getStatusText(reservation)}
                      </div>
                      
                      {isUpcoming(reservation) && (
                        <button
                          onClick={() => handleCancelReservation(reservation.id)}
                          disabled={cancellingId === reservation.id}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all touch-btn',
                            cancellingId === reservation.id
                              ? 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
                              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95'
                          )}
                        >
                          {cancellingId === reservation.id ? 'מבטל...' : 'בטל תור'}
                        </button>
                      )}
                    </div>
                    
                    {/* Details - responsive grid */}
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} strokeWidth={1.5} className="text-accent-gold flex-shrink-0" />
                        <span className="text-foreground-light text-sm truncate">
                          {formatDate(reservation.date_timestamp)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock size={16} strokeWidth={1.5} className="text-accent-gold flex-shrink-0" />
                        <span className="text-foreground-light text-sm" dir="ltr">
                          {formatTime(reservation.time_timestamp)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Scissors size={16} strokeWidth={1.5} className="text-accent-gold flex-shrink-0" />
                        <span className="text-foreground-light text-sm truncate">
                          {reservation.services?.name_he || 'שירות'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <User size={16} strokeWidth={1.5} className="text-accent-gold flex-shrink-0" />
                        <span className="text-foreground-light text-sm truncate">
                          {reservation.users?.fullname || 'ספר'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Price */}
                    {reservation.services?.price && (
                      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                        <span className="text-foreground-muted text-sm">מחיר:</span>
                        <span className="text-accent-gold font-bold">₪{reservation.services.price}</span>
                      </div>
                    )}
                  </GlassCard>
                ))}
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
    </>
  )
}
