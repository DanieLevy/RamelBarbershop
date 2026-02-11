/**
 * Admin All-Barbers Reservations View
 *
 * Allows the admin to:
 * - View any barber's reservations timeline
 * - Create reservations for any barber (ManualBookingModal)
 * - Edit reservations for any barber (EditReservationModal with admin callerType)
 * - Cancel reservations for any barber
 *
 * Reuses the same components and hooks as the barber's own reservations page.
 * Admin-only: guarded by isAdmin check.
 */

'use client'

import { useEffect, useState, useMemo, Suspense, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/lib/toast'
import {
  cn,
  formatTime as formatTimeUtil,
  nowInIsrael,
  getIsraelDayStart,
  getIsraelDayEnd,
  timestampToIsraelDate,
  isSameDayInIsrael,
  getDayKeyInIsrael,
  normalizeTimestampFormat,
  israelDateToTimestamp,
} from '@/lib/utils'
import { addDays, format, startOfWeek, endOfWeek } from 'date-fns'
import { he } from 'date-fns/locale'
import { Calendar, Plus, ChevronDown, Repeat, Shield, Users } from 'lucide-react'
import { Phone } from 'lucide-react'
import type { Reservation, Service, BarbershopSettings, WorkDay, User } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'
import { getRecurringByBarber } from '@/lib/services/recurring.service'
import { CancelReservationModal } from '@/components/barber/CancelReservationModal'
import { BulkCancelModal } from '@/components/barber/BulkCancelModal'
import { AppointmentDetailModal } from '@/components/barber/AppointmentDetailModal'
import { ManualBookingModal } from '@/components/barber/ManualBookingModal'
import { EditReservationModal } from '@/components/barber/EditReservationModal'
import { cancelReservation } from '@/lib/services/booking.service'
import { Button, Switch } from '@heroui/react'
import { useReservationsRealtime } from '@/hooks/useReservationsRealtime'
import { useTimelineItems, type TimelineItem } from '@/hooks/useTimelineItems'
import { ReservationRow } from '@/components/barber/reservations/ReservationRow'
import { EmptySlotRow } from '@/components/barber/reservations/EmptySlotRow'
import { DateFilterChips } from '@/components/barber/reservations/DateFilterChips'
import { ViewModeSelector } from '@/components/barber/reservations/ViewModeSelector'
import Image from 'next/image'

// ============================================================
// Types
// ============================================================

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

const normalizeTs = normalizeTimestampFormat

// ============================================================
// Page Component
// ============================================================

export default function AdminAllBarbersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminAllBarbersContent />
    </Suspense>
  )
}

function AdminAllBarbersContent() {
  const router = useRouter()
  const { barber, isAdmin, isInitialized } = useBarberAuthStore()
  const { report } = useBugReporter('AdminAllBarbersPage')

  // ── Admin guard ──
  useEffect(() => {
    if (isInitialized && !isAdmin) {
      router.replace('/barber/dashboard')
    }
  }, [isInitialized, isAdmin, router])

  // ── All barbers list ──
  const [allBarbers, setAllBarbers] = useState<User[]>([])
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null)
  const [loadingBarbers, setLoadingBarbers] = useState(true)

  // ── Reservations state (for selected barber) ──
  const [reservations, setReservations] = useState<ReservationWithService[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Date filter
  const [quickDate, setQuickDate] = useState<QuickDateType>('today')
  const [customDate, setCustomDate] = useState<Date | null>(null)

  // Scroll refs
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

  const [shopSettings, setShopSettings] = useState<BarbershopSettings | null>(null)
  const [barberWorkDays, setBarberWorkDays] = useState<WorkDay[]>([])
  const [showEmptySlots, setShowEmptySlots] = useState(true)
  const [todaysRecurring, setTodaysRecurring] = useState<RecurringForDisplay[]>([])

  const [manualBookingModal, setManualBookingModal] = useState<{
    isOpen: boolean
    preselectedDate?: Date | null
    preselectedTime?: number | null
  }>({ isOpen: false, preselectedDate: null, preselectedTime: null })

  const [editModal, setEditModal] = useState<{
    isOpen: boolean
    reservation: ReservationWithService | null
  }>({ isOpen: false, reservation: null })

  // ── Computed: selected barber object ──
  const selectedBarber = useMemo(
    () => allBarbers.find((b) => b.id === selectedBarberId) || null,
    [allBarbers, selectedBarberId]
  )

  // ============================================================
  // Fetch barbers list
  // ============================================================

  useEffect(() => {
    const fetchBarbers = async () => {
      setLoadingBarbers(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_barber', true)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) {
        console.error('[Admin] Error fetching barbers:', error)
        showToast.error('שגיאה בטעינת רשימת הספרים')
      } else if (data) {
        setAllBarbers(data as User[])
        // Auto-select the first non-admin barber, or the first barber
        const firstNonAdmin = data.find((b) => b.role !== 'admin')
        if (firstNonAdmin) {
          setSelectedBarberId(firstNonAdmin.id)
        } else if (data.length > 0) {
          setSelectedBarberId(data[0].id)
        }
      }
      setLoadingBarbers(false)
    }

    if (isAdmin) {
      fetchBarbers()
      fetchShopSettings()
    }
  }, [isAdmin])

  // ============================================================
  // Fetch data for selected barber
  // ============================================================

  const fetchReservations = useCallback(async () => {
    if (!selectedBarberId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, barber_id, service_id, customer_id, customer_name, customer_phone,
          date_timestamp, time_timestamp, day_name, day_num, status,
          cancelled_by, cancellation_reason, version, created_at, barber_notes,
          services (id, name_he, duration, price)
        `)
        .eq('barber_id', selectedBarberId)
        .order('time_timestamp', { ascending: true })

      if (error) {
        console.error('[Admin] Error fetching reservations:', error)
        await report(new Error(error.message), 'Fetching barber reservations (admin)')
        showToast.error('שגיאה בטעינת התורים')
        return
      }

      setReservations((data as ReservationWithService[]) || [])
    } catch (err) {
      console.error('[Admin] Error fetching reservations:', err)
      await report(err, 'Fetching barber reservations (admin, exception)')
      showToast.error('שגיאה בטעינת התורים')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBarberId])

  const fetchShopSettings = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('barbershop_settings').select('*').single()
    if (data) setShopSettings(data as BarbershopSettings)
  }

  const fetchBarberWorkDays = useCallback(async () => {
    if (!selectedBarberId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('work_days')
      .select('*')
      .eq('user_id', selectedBarberId)
    if (data) setBarberWorkDays(data as WorkDay[])
  }, [selectedBarberId])

  const fetchRecurringAppointments = useCallback(async () => {
    if (!selectedBarberId) return

    try {
      const recurringData = await getRecurringByBarber(selectedBarberId)
      const nowMs = Date.now()
      const todayStart = getIsraelDayStart(nowMs)
      const todayDayKey = getDayKeyInIsrael(nowMs)

      const displayRecurring: RecurringForDisplay[] = recurringData
        .filter((rec) => rec.day_of_week === todayDayKey)
        .map((rec) => {
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
            time_timestamp: appointmentTime,
          }
        })
        .filter((rec) => rec.time_timestamp > nowMs)
        .sort((a, b) => a.time_timestamp - b.time_timestamp)

      setTodaysRecurring(displayRecurring)
    } catch (err) {
      console.error('[Admin] Error fetching recurring:', err)
    }
  }, [selectedBarberId])

  // Fetch all data when barber changes
  useEffect(() => {
    if (selectedBarberId) {
      fetchReservations()
      fetchBarberWorkDays()
      fetchRecurringAppointments()
      // Reset scroll
      hasScrolledRef.current = false
    }
  }, [selectedBarberId, fetchReservations, fetchBarberWorkDays, fetchRecurringAppointments])

  // Realtime
  const { isRealtimeConnected } = useReservationsRealtime({
    barberId: selectedBarberId || undefined,
    onRefresh: fetchReservations,
  })

  // ============================================================
  // Handlers
  // ============================================================

  const handleCancelReservation = async (id: string, reason?: string) => {
    setUpdatingId(id)
    const reservation = reservations.find((r) => r.id === id)
    if (!reservation) {
      showToast.error('התור לא נמצא')
      setUpdatingId(null)
      return
    }

    try {
      const currentVersion = (reservation as ReservationWithService & { version?: number }).version || 1
      const result = await cancelReservation(id, 'barber', reason || undefined, currentVersion)

      if (!result.success) {
        if (result.concurrencyConflict) {
          showToast.error('התור עודכן על ידי אחר. מרענן...')
          await fetchReservations()
          setCancelModal({ isOpen: false, reservation: null })
          setUpdatingId(null)
          return
        }
        console.error('[Admin] Error cancelling:', result.error)
        await report(new Error(result.error || 'Unknown error'), 'Admin cancelling reservation', 'high')
        showToast.error(result.error || 'שגיאה בביטול התור')
        return
      }

      // Push notification to customer
      if (reservation?.customer_id) {
        fetch('/api/push/notify-cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId: id,
            customerId: reservation.customer_id,
            barberId: selectedBarberId,
            cancelledBy: 'barber',
            customerName: reservation.customer_name,
            barberName: selectedBarber?.fullname || 'הספר',
            serviceName: reservation.services?.name_he || 'שירות',
            appointmentTime: reservation.time_timestamp,
            reason,
          }),
        })
          .then((res) => res.json())
          .then((data) => console.log('[Admin Cancel] Push result:', data))
          .catch((err) => console.error('[Admin Cancel] Push error:', err))
      }

      showToast.success('התור בוטל בהצלחה')
      setCancelModal({ isOpen: false, reservation: null })
      await fetchReservations()
    } catch (err) {
      console.error('[Admin] Cancel error:', err)
      showToast.error('שגיאה בביטול התור')
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
        const result = await cancelReservation(res.id, 'barber', reason || undefined)
        if (!result.success) console.warn('[Admin Bulk] Failed:', res.id, result.error)

        if (res.customer_id) {
          fetch('/api/push/notify-cancellation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reservationId: res.id,
              customerId: res.customer_id,
              barberId: selectedBarberId,
              cancelledBy: 'barber',
              customerName: res.customer_name,
              barberName: selectedBarber?.fullname || 'הספר',
              serviceName: res.services?.name_he || 'שירות',
              appointmentTime: res.time_timestamp,
              reason,
            }),
          }).catch((err) => console.error('[Admin Bulk] Push error:', err))
        }
      }

      showToast.success(`${toCancel.length} תורים בוטלו בהצלחה`)
      setBulkCancelModal({ isOpen: false, reservations: [] })
      await fetchReservations()
    } catch (err) {
      console.error('[Admin] Bulk cancel error:', err)
      showToast.error('שגיאה בביטול התורים')
    } finally {
      setUpdatingId(null)
    }
  }

  const formatPhoneForWhatsApp = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('0')) cleaned = '972' + cleaned.substring(1)
    else if (!cleaned.startsWith('972')) cleaned = '972' + cleaned
    return cleaned
  }

  const formatTime = (timestamp: number): string => formatTimeUtil(normalizeTs(timestamp))

  // ============================================================
  // Computed values
  // ============================================================

  const now = Date.now()
  const israelNow = nowInIsrael()

  const getDateRange = (): { startMs: number | null; endMs: number | null } => {
    switch (quickDate) {
      case 'today':
        return { startMs: getIsraelDayStart(israelNow), endMs: getIsraelDayEnd(israelNow) }
      case 'tomorrow': {
        const tomorrow = addDays(israelNow, 1)
        return { startMs: getIsraelDayStart(tomorrow), endMs: getIsraelDayEnd(tomorrow) }
      }
      case 'week': {
        const weekStart = startOfWeek(israelNow, { weekStartsOn: 0 })
        const weekEnd = endOfWeek(israelNow, { weekStartsOn: 0 })
        return { startMs: getIsraelDayStart(weekStart), endMs: getIsraelDayEnd(weekEnd) }
      }
      case 'custom':
        if (customDate) return { startMs: getIsraelDayStart(customDate), endMs: getIsraelDayEnd(customDate) }
        return { startMs: null, endMs: null }
      default:
        return { startMs: null, endMs: null }
    }
  }

  const getSmartDateTime = (timestamp: number): { date: string; time: string; isToday: boolean } => {
    const normalizedTs = normalizeTs(timestamp)
    const resDate = timestampToIsraelDate(normalizedTs)
    const isToday = isSameDayInIsrael(normalizedTs, Date.now())
    const tomorrowMs = Date.now() + 24 * 60 * 60 * 1000
    const isTomorrow = isSameDayInIsrael(normalizedTs, tomorrowMs)

    let dateStr = ''
    if (isToday) dateStr = 'היום'
    else if (isTomorrow) dateStr = 'מחר'
    else dateStr = format(resDate, 'dd/MM', { locale: he })

    return { date: dateStr, time: formatTime(normalizedTs), isToday }
  }

  const filteredReservations = useMemo(() => {
    let filtered = [...reservations]
    const { startMs, endMs } = getDateRange()

    if (startMs && endMs) {
      filtered = filtered.filter((res) => {
        const resTime = normalizeTs(res.time_timestamp)
        return resTime >= startMs && resTime <= endMs
      })
    }

    switch (viewMode) {
      case 'all':
        filtered = filtered.filter((res) => res.status !== 'cancelled')
        break
      case 'upcoming_only':
        filtered = filtered.filter((res) => normalizeTs(res.time_timestamp) > now && res.status === 'confirmed')
        break
      case 'cancelled':
        filtered = filtered.filter((res) => res.status === 'cancelled')
        break
    }

    filtered.sort((a, b) => normalizeTs(a.time_timestamp) - normalizeTs(b.time_timestamp))
    return filtered
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, quickDate, customDate, viewMode, now])

  const { pastReservations, upcomingReservations } = useMemo(() => {
    if (viewMode !== 'all') return { pastReservations: [], upcomingReservations: filteredReservations }
    const past: ReservationWithService[] = []
    const upcoming: ReservationWithService[] = []
    filteredReservations.forEach((res) => {
      if (normalizeTs(res.time_timestamp) > now) upcoming.push(res)
      else past.push(res)
    })
    return { pastReservations: past, upcomingReservations: upcoming }
  }, [filteredReservations, viewMode, now])

  const getSelectedDate = (): Date | null => {
    if (quickDate === 'today') return israelNow
    if (quickDate === 'tomorrow') return addDays(israelNow, 1)
    if (quickDate === 'custom' && customDate) return customDate
    return null
  }

  const timelineItems = useTimelineItems({
    filteredReservations,
    pastReservations,
    upcomingReservations,
    quickDate,
    customDate,
    viewMode,
    showEmptySlots,
    shopSettings,
    barberWorkDays,
    now,
    selectedDate: getSelectedDate(),
  })

  // Auto-scroll
  const scrollToUpcoming = useCallback(() => {
    if (upcomingDividerRef.current && !hasScrolledRef.current) {
      setTimeout(() => {
        upcomingDividerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        hasScrolledRef.current = true
      }, 100)
    }
  }, [])

  useEffect(() => {
    if (!loading && viewMode === 'all' && pastReservations.length > 0 && upcomingReservations.length > 0) {
      scrollToUpcoming()
    }
  }, [loading, viewMode, pastReservations.length, upcomingReservations.length, scrollToUpcoming])

  useEffect(() => {
    hasScrolledRef.current = false
  }, [quickDate, customDate])

  // View counts
  const getViewCounts = () => {
    const { startMs, endMs } = getDateRange()
    let base = [...reservations]
    if (startMs && endMs) {
      base = base.filter((res) => {
        const resTime = normalizeTs(res.time_timestamp)
        return resTime >= startMs && resTime <= endMs
      })
    }
    const upcoming = base.filter((r) => normalizeTs(r.time_timestamp) > now && r.status === 'confirmed').length
    const past = base.filter((r) => normalizeTs(r.time_timestamp) <= now && r.status !== 'cancelled').length
    const cancelled = base.filter((r) => r.status === 'cancelled').length
    return { all: upcoming + past, upcoming, past, cancelled }
  }

  const counts = getViewCounts()
  const viewModes: { key: ViewMode; label: string; count: number; description?: string }[] = [
    { key: 'all', label: 'הכל', count: counts.all, description: 'קודמים + קרובים' },
    { key: 'upcoming_only', label: 'קרובים בלבד', count: counts.upcoming },
    { key: 'cancelled', label: 'מבוטלים', count: counts.cancelled },
  ]

  // ============================================================
  // Render
  // ============================================================

  if (!isInitialized || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Page Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
          <Shield size={18} className="text-accent-gold" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-medium text-foreground-light">לוחות ספרים</h1>
          <p className="text-foreground-muted text-sm mt-0.5">צפייה וניהול תורים של כל הספרים</p>
        </div>
      </div>

      {/* ── Barber Picker ── */}
      {loadingBarbers ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : allBarbers.length === 0 ? (
        <div className="text-center py-8">
          <Users size={32} className="text-foreground-muted/30 mx-auto mb-2" />
          <p className="text-foreground-muted text-sm">אין ספרים פעילים</p>
        </div>
      ) : (
        <div className="mb-5">
          <p className="text-foreground-muted text-xs mb-2">בחר ספר:</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {allBarbers.map((b) => {
              const isSelected = b.id === selectedBarberId
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBarberId(b.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 border',
                    isSelected
                      ? 'bg-accent-gold/15 border-accent-gold/40 text-accent-gold'
                      : 'bg-white/[0.03] border-white/[0.06] text-foreground-muted hover:bg-white/[0.06] hover:text-foreground-light'
                  )}
                  aria-label={`הצג את לוח התורים של ${b.fullname}`}
                  aria-pressed={isSelected}
                  tabIndex={0}
                >
                  {b.img_url ? (
                    <Image
                      src={b.img_url}
                      alt={b.fullname}
                      width={28}
                      height={28}
                      className="w-7 h-7 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-accent-gold/20 flex items-center justify-center text-accent-gold text-xs font-bold">
                      {b.fullname.charAt(0)}
                    </div>
                  )}
                  {b.fullname}
                  {b.role === 'admin' && (
                    <span className="text-[10px] bg-accent-gold/20 text-accent-gold px-1.5 py-0.5 rounded-full">מנהל</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Selected Barber Content ── */}
      {selectedBarberId && selectedBarber && (
        <>
          {/* Realtime indicator */}
          {!isRealtimeConnected && (
            <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-400 text-sm">מתחבר מחדש...</span>
              <Button
                onPress={() => {
                  fetchReservations()
                  showToast.info('מרענן...')
                }}
                variant="ghost"
                className="mr-auto text-amber-400 text-sm underline"
              >
                רענן
              </Button>
            </div>
          )}

          {/* Header + Add button for selected barber */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-medium text-foreground-light">
                  תורים של {selectedBarber.fullname}
                </h2>
                <p className="text-foreground-muted text-xs mt-0.5">ניהול מנהל</p>
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
                const selectedDate = getSelectedDate()
                setManualBookingModal({ isOpen: true, preselectedDate: selectedDate, preselectedTime: null })
              }}
              className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90 transition-all text-sm"
              aria-label="הוסף תור חדש"
              tabIndex={0}
            >
              <Plus size={16} strokeWidth={2} />
              הוסף תור
            </button>
          </div>

          {/* Today's Recurring */}
          {quickDate === 'today' && todaysRecurring.length > 0 && (
            <div className="mb-4 bg-purple-500/5 border border-purple-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Repeat size={12} className="text-purple-400" />
                </div>
                <h3 className="text-sm font-medium text-purple-300">תורים קבועים להיום</h3>
              </div>
              <div className="space-y-1.5">
                {todaysRecurring.map((rec) => (
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
                    <span className="text-[10px] text-purple-400/60 bg-purple-500/20 px-1.5 py-0.5 rounded-full">
                      קבוע
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date Filters */}
          <DateFilterChips
            quickDate={quickDate}
            customDate={customDate}
            israelNow={israelNow}
            onQuickDateChange={setQuickDate}
            onCustomDateChange={setCustomDate}
          />

          {/* View Mode */}
          <ViewModeSelector
            viewMode={viewMode}
            viewModes={viewModes}
            onViewModeChange={(mode) => {
              setViewMode(mode)
              hasScrolledRef.current = false
            }}
          />

          {/* Quick Info Bar */}
          {viewMode === 'all' && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs text-foreground-muted">
                <ChevronDown size={12} className="text-accent-gold animate-bounce" />
                <span>גלול למעלה לתורים קודמים</span>
              </div>
              {(quickDate === 'today' || quickDate === 'tomorrow' || quickDate === 'custom') && (
                <label className="flex items-center gap-2 text-xs text-foreground-muted cursor-pointer">
                  <span>משבצות פנויות</span>
                  <Switch isSelected={showEmptySlots} onChange={setShowEmptySlots}>
                    <Switch.Control className={cn(showEmptySlots ? 'bg-accent-gold' : 'bg-white/10')}>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </label>
              )}
            </div>
          )}

          {viewMode === 'upcoming_only' &&
            (quickDate === 'today' || quickDate === 'tomorrow' || quickDate === 'custom') && (
              <div className="flex items-center justify-end mb-3">
                <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
                  <span>הצג משבצות פנויות</span>
                  <Switch isSelected={showEmptySlots} onChange={setShowEmptySlots}>
                    <Switch.Control className={cn('w-12 h-7', showEmptySlots ? 'bg-accent-gold' : 'bg-white/10')}>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </label>
              </div>
            )}

          {/* Reservations List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
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
                  {timelineItems.map((item: TimelineItem, index: number) => {
                    if (item.type === 'divider') {
                      return (
                        <div
                          key={`divider-${index}`}
                          ref={upcomingDividerRef}
                          className="sticky top-0 z-10 bg-background-dark/95 backdrop-blur-sm border-y border-accent-gold/30 px-4 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-accent-gold/30" />
                            <span className="text-accent-gold text-xs font-medium px-2">{item.label}</span>
                            <div className="flex-1 h-px bg-accent-gold/30" />
                          </div>
                        </div>
                      )
                    }

                    if (item.type === 'empty') {
                      return (
                        <EmptySlotRow
                          key={`empty-${item.timestamp}`}
                          timestamp={item.timestamp}
                          time={item.time}
                          onBook={(timestamp) => {
                            setManualBookingModal({
                              isOpen: true,
                              preselectedDate: getSelectedDate(),
                              preselectedTime: timestamp,
                            })
                          }}
                        />
                      )
                    }

                    const res = item.data
                    const smartDate = getSmartDateTime(res.time_timestamp)
                    const isUpcoming = normalizeTs(res.time_timestamp) > now && res.status === 'confirmed'
                    const isCancelled = res.status === 'cancelled'
                    const isPastItem = item.isPast && res.status !== 'cancelled'

                    return (
                      <ReservationRow
                        key={res.id}
                        reservation={res}
                        smartDate={smartDate}
                        isUpcoming={isUpcoming}
                        isCancelled={isCancelled}
                        isPast={isPastItem}
                        isHighlighted={false}
                        updatingId={updatingId}
                        onDetail={(r) => setDetailModal({ isOpen: true, reservation: r })}
                        onCancel={(r) => setCancelModal({ isOpen: true, reservation: r })}
                        onEdit={(r) => setEditModal({ isOpen: true, reservation: r })}
                        formatPhoneForWhatsApp={formatPhoneForWhatsApp}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

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
            selectedDate={
              quickDate === 'custom'
                ? customDate
                : quickDate === 'today'
                  ? israelNow
                  : quickDate === 'tomorrow'
                    ? addDays(israelNow, 1)
                    : null
            }
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
            barberId={selectedBarberId}
            barberName={selectedBarber.fullname}
            shopSettings={shopSettings}
            preselectedDate={manualBookingModal.preselectedDate}
            preselectedTime={manualBookingModal.preselectedTime}
          />

          <EditReservationModal
            isOpen={editModal.isOpen}
            onClose={() => setEditModal({ isOpen: false, reservation: null })}
            onSuccess={fetchReservations}
            reservation={editModal.reservation}
            barberId={selectedBarberId}
            barberName={selectedBarber.fullname}
            shopSettings={shopSettings}
            callerType="admin"
            adminId={barber?.id}
          />
        </>
      )}
    </div>
  )
}
