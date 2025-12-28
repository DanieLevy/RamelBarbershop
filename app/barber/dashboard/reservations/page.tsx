'use client'

import { useEffect, useState } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatTime as formatTimeUtil, formatDateHebrew, nowInIsrael } from '@/lib/utils'
import { startOfDay, endOfDay } from 'date-fns'
import { Calendar, Phone, Check, X, Clock } from 'lucide-react'
import type { Reservation, Service } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

interface ReservationWithService extends Reservation {
  services?: Service
}

type TabType = 'upcoming' | 'today' | 'past' | 'cancelled'

export default function ReservationsPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('ReservationsPage')
  
  const [reservations, setReservations] = useState<ReservationWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('today')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

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

  const handleUpdateStatus = async (id: string, status: 'completed' | 'cancelled') => {
    setUpdatingId(id)
    
    try {
      const supabase = createClient()
      
      const { data, error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('reservations') as any)
        .update({ status })
        .eq('id', id)
        .select('id, status') as { data: { id: string; status: string }[] | null; error: unknown }
      
      if (error) {
        console.error('Error updating reservation:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        await report(error instanceof Error ? error : new Error(String(error)), 'Updating reservation status', 'high')
        toast.error(`שגיאה בעדכון הסטטוס: ${(error as Error)?.message || 'נסה שוב'}`)
        return
      }
      
      // Verify the update actually happened
      if (!data || data.length === 0) {
        console.error('No data returned after update')
        toast.error('שגיאה בעדכון - לא נמצא התור')
        return
      }
      
      const updated = data[0]
      if (updated.status !== status) {
        console.error('Status was not updated:', updated)
        toast.error('שגיאה בעדכון - הסטטוס לא השתנה')
        return
      }
      
      const messages: Record<string, string> = {
        completed: 'התור סומן כהושלם',
        cancelled: 'התור בוטל בהצלחה',
      }
      toast.success(messages[status])
      
      // Refresh data from server
      await fetchReservations()
    } catch (err) {
      console.error('Error updating reservation:', err)
      toast.error('שגיאה בעדכון הסטטוס')
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

  const formatDate = (timestamp: number): string => {
    return formatDateHebrew(normalizeTs(timestamp))
  }

  // Get status display text - no "מאושר", use "קרוב" for upcoming
  const getStatusText = (res: ReservationWithService): string => {
    if (res.status === 'cancelled') return 'בוטל'
    if (res.status === 'completed') return 'הושלם'
    const resTime = normalizeTs(res.time_timestamp)
    if (resTime > Date.now()) return 'קרוב'
    return 'עבר'
  }

  const now = Date.now()
  const israelNow = nowInIsrael()
  const todayStartMs = startOfDay(israelNow).getTime()
  const todayEndMs = endOfDay(israelNow).getTime()

  const isUpcoming = (res: ReservationWithService): boolean => {
    const resTime = normalizeTs(res.time_timestamp)
    return resTime > now && res.status === 'confirmed'
  }

  const filteredReservations = reservations.filter((res) => {
    const resTime = normalizeTs(res.time_timestamp)
    switch (activeTab) {
      case 'upcoming':
        return resTime > now && res.status === 'confirmed'
      case 'today':
        return resTime >= todayStartMs && 
               resTime <= todayEndMs && 
               res.status !== 'cancelled'
      case 'past':
        return resTime < now && res.status !== 'cancelled'
      case 'cancelled':
        return res.status === 'cancelled'
      default:
        return true
    }
  })

  const tabs: { key: TabType; label: string; count: number }[] = [
    { 
      key: 'today', 
      label: 'היום', 
      count: reservations.filter(r => {
        const t = normalizeTs(r.time_timestamp)
        return t >= todayStartMs && t <= todayEndMs && r.status !== 'cancelled'
      }).length 
    },
    { 
      key: 'upcoming', 
      label: 'קרובים', 
      count: reservations.filter(r => normalizeTs(r.time_timestamp) > now && r.status === 'confirmed').length 
    },
    { 
      key: 'past', 
      label: 'קודמים', 
      count: reservations.filter(r => normalizeTs(r.time_timestamp) < now && r.status !== 'cancelled').length 
    },
    { 
      key: 'cancelled', 
      label: 'מבוטלים', 
      count: reservations.filter(r => r.status === 'cancelled').length 
    },
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
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-foreground-light">התורים שלי</h1>
        <p className="text-foreground-muted mt-1">ניהול כל התורים שלך</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2',
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
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        {filteredReservations.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={48} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted">אין תורים להציג</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReservations.map((res) => (
              <div
                key={res.id}
                className={cn(
                  'p-4 rounded-xl border transition-all',
                  res.status === 'cancelled'
                    ? 'bg-red-500/5 border-red-500/20'
                    : res.status === 'completed'
                      ? 'bg-green-500/5 border-green-500/20'
                      : isUpcoming(res)
                        ? 'bg-accent-gold/5 border-accent-gold/20'
                        : 'bg-background-dark border-white/5'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center',
                      res.status === 'cancelled'
                        ? 'bg-red-500/20 text-red-400'
                        : res.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-accent-gold/20 text-accent-gold'
                    )}>
                      <Calendar size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-foreground-light font-medium">{res.customer_name}</p>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded',
                          res.status === 'cancelled'
                            ? 'bg-red-500/20 text-red-400'
                            : res.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : isUpcoming(res)
                                ? 'bg-accent-gold/20 text-accent-gold'
                                : 'bg-blue-500/20 text-blue-400'
                        )}>
                          {getStatusText(res)}
                        </span>
                      </div>
                      <p className="text-foreground-muted text-sm mb-2">
                        {res.services?.name_he || 'שירות'} • ₪{res.services?.price}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-foreground-muted">
                          <Clock size={12} strokeWidth={1.5} />
                          {formatTime(res.time_timestamp)}
                        </span>
                        <span className="flex items-center gap-1 text-foreground-muted">
                          <Calendar size={12} strokeWidth={1.5} />
                          {formatDate(res.time_timestamp)}
                        </span>
                      </div>
                      <a
                        href={`tel:${res.customer_phone}`}
                        className="flex items-center gap-1 text-accent-gold text-sm mt-2 hover:underline"
                      >
                        <Phone size={12} strokeWidth={1.5} />
                        {res.customer_phone}
                      </a>
                    </div>
                  </div>
                  
                  {/* Actions - only for upcoming confirmed reservations */}
                  {res.status === 'confirmed' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateStatus(res.id, 'completed')}
                        disabled={updatingId === res.id}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          updatingId === res.id
                            ? 'text-foreground-muted cursor-not-allowed'
                            : 'text-green-400 hover:bg-green-500/10'
                        )}
                        title="סמן כהושלם"
                      >
                        <Check size={16} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('האם לבטל את התור? הלקוח יראה שהתור בוטל.')) {
                            handleUpdateStatus(res.id, 'cancelled')
                          }
                        }}
                        disabled={updatingId === res.id}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          updatingId === res.id
                            ? 'text-foreground-muted cursor-not-allowed'
                            : 'text-red-400 hover:bg-red-500/10'
                        )}
                        title="בטל תור"
                      >
                        <X size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
