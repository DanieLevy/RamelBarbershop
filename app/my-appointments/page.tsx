'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/AppHeader'
import { toast } from 'react-toastify'
import { cn } from '@/lib/utils'
import { FaCalendarAlt, FaClock, FaCut, FaUser, FaTimes, FaCheck, FaHistory } from 'react-icons/fa'
import type { ReservationWithDetails } from '@/types/database'

type TabType = 'upcoming' | 'past' | 'cancelled'

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
    if (customer?.id) {
      fetchReservations()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id])

  const fetchReservations = async () => {
    if (!customer?.id) return
    
    setLoading(true)
    
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          services (*),
          users (*)
        `)
        .eq('customer_id', customer.id)
        .order('date_timestamp', { ascending: false })
      
      if (error) {
        console.error('Error fetching reservations:', error)
        toast.error('שגיאה בטעינת התורים')
        return
      }
      
      setReservations((data as ReservationWithDetails[]) || [])
    } catch (err) {
      console.error('Error fetching reservations:', err)
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
      const { error } = await (supabase.from('reservations') as any)
        .update({ status: 'cancelled' })
        .eq('id', reservationId)
      
      if (error) {
        console.error('Error cancelling reservation:', error)
        toast.error('שגיאה בביטול התור')
        return
      }
      
      toast.success('התור בוטל בהצלחה')
      fetchReservations()
    } catch (err) {
      console.error('Error cancelling reservation:', err)
      toast.error('שגיאה בביטול התור')
    } finally {
      setCancellingId(null)
    }
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('he-IL', { 
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  const isUpcoming = (reservation: ReservationWithDetails): boolean => {
    const now = Date.now()
    return reservation.time_timestamp > now && reservation.status === 'confirmed'
  }

  const isPast = (reservation: ReservationWithDetails): boolean => {
    const now = Date.now()
    return reservation.time_timestamp <= now && reservation.status !== 'cancelled'
  }

  const isCancelled = (reservation: ReservationWithDetails): boolean => {
    return reservation.status === 'cancelled'
  }

  const filteredReservations = reservations.filter(r => {
    switch (activeTab) {
      case 'upcoming': return isUpcoming(r)
      case 'past': return isPast(r)
      case 'cancelled': return isCancelled(r)
      default: return true
    }
  })

  if (!isInitialized || isLoading) {
    return (
      <>
        <AppHeader />
        <main className="relative top-24 min-h-screen px-4 py-8">
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-foreground-muted">טוען...</p>
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
      
      <main className="relative top-24 min-h-screen px-4 py-8 pb-24">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl text-foreground-light font-medium">
              התורים שלי
            </h1>
            <p className="text-foreground-muted mt-2">
              שלום {customer?.fullname}, כאן תוכל לצפות ולנהל את התורים שלך
            </p>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-background-card rounded-xl p-1">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
                activeTab === 'upcoming'
                  ? 'bg-accent-gold text-background-dark'
                  : 'text-foreground-muted hover:text-foreground-light'
              )}
            >
              <FaCalendarAlt className="w-3.5 h-3.5" />
              <span>קרובים</span>
            </button>
            
            <button
              onClick={() => setActiveTab('past')}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
                activeTab === 'past'
                  ? 'bg-accent-gold text-background-dark'
                  : 'text-foreground-muted hover:text-foreground-light'
              )}
            >
              <FaHistory className="w-3.5 h-3.5" />
              <span>עברו</span>
            </button>
            
            <button
              onClick={() => setActiveTab('cancelled')}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
                activeTab === 'cancelled'
                  ? 'bg-accent-gold text-background-dark'
                  : 'text-foreground-muted hover:text-foreground-light'
              )}
            >
              <FaTimes className="w-3.5 h-3.5" />
              <span>בוטלו</span>
            </button>
          </div>
          
          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-foreground-muted">טוען תורים...</p>
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-12 bg-background-card rounded-xl border border-white/10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-foreground-muted/10 flex items-center justify-center">
                <FaCalendarAlt className="w-8 h-8 text-foreground-muted" />
              </div>
              <p className="text-foreground-muted">
                {activeTab === 'upcoming' && 'אין תורים קרובים'}
                {activeTab === 'past' && 'אין תורים שעברו'}
                {activeTab === 'cancelled' && 'אין תורים מבוטלים'}
              </p>
              {activeTab === 'upcoming' && (
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 px-6 py-2 bg-accent-gold text-background-dark rounded-lg font-medium hover:bg-accent-gold/90 transition-colors"
                >
                  קבע תור חדש
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className={cn(
                    'bg-background-card border rounded-xl p-5 transition-all',
                    reservation.status === 'cancelled' 
                      ? 'border-red-500/30 opacity-70' 
                      : isUpcoming(reservation)
                        ? 'border-accent-gold/30'
                        : 'border-white/10'
                  )}
                >
                  {/* Status Badge */}
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
                      {reservation.status === 'cancelled' && 'בוטל'}
                      {reservation.status === 'completed' && 'הושלם'}
                      {reservation.status === 'confirmed' && isUpcoming(reservation) && 'מאושר'}
                      {reservation.status === 'confirmed' && !isUpcoming(reservation) && 'הסתיים'}
                    </div>
                    
                    {isUpcoming(reservation) && (
                      <button
                        onClick={() => handleCancelReservation(reservation.id)}
                        disabled={cancellingId === reservation.id}
                        className={cn(
                          'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                          cancellingId === reservation.id
                            ? 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        )}
                      >
                        {cancellingId === reservation.id ? 'מבטל...' : 'בטל תור'}
                      </button>
                    )}
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <FaCalendarAlt className="w-4 h-4 text-accent-gold flex-shrink-0" />
                      <span className="text-foreground-light">
                        {formatDate(reservation.date_timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <FaClock className="w-4 h-4 text-accent-gold flex-shrink-0" />
                      <span className="text-foreground-light" dir="ltr">
                        {formatTime(reservation.time_timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <FaCut className="w-4 h-4 text-accent-gold flex-shrink-0" />
                      <span className="text-foreground-light">
                        {reservation.services?.name_he || 'שירות'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <FaUser className="w-4 h-4 text-accent-gold flex-shrink-0" />
                      <span className="text-foreground-light">
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
                </div>
              ))}
            </div>
          )}
          
          {/* Back Button */}
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-foreground-muted hover:text-foreground-light text-sm transition-colors"
            >
              ← חזרה לדף הבית
            </button>
          </div>
        </div>
      </main>
    </>
  )
}

