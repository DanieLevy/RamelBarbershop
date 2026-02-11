/**
 * CustomerEditReservationModal
 *
 * Customer-facing modal to reschedule an existing reservation.
 * - Same barber (enforced — cannot change barber)
 * - Can change service, date, and time
 * - Respects all barber constraints: work hours, breakouts, closures, recurring slots
 * - Respects booking settings: min hours before, max days ahead
 * - Atomic update with optimistic locking
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Calendar, Clock, Scissors, AlertTriangle, ArrowLeftRight, User } from 'lucide-react'
import { cn, generateTimeSlots, parseTimeString, nowInIsrael, getIsraelDayStart, getIsraelDayEnd, getDayKeyInIsrael, getSlotKey, getIsraelDateString, formatTime, formatDateHebrew } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { editReservation } from '@/lib/services/booking.service'
import { getBreakoutsForDate, isSlotInBreakout } from '@/lib/services/breakout.service'
import { format, addDays, isSameDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { showToast } from '@/lib/toast'
import type { BarbershopSettings, Service, WorkDay, BarberBreakout, BarbershopClosure, BarberClosure, ReservationWithDetails } from '@/types/database'
import { Portal } from '@/components/ui/Portal'
import { Button } from '@heroui/react'

// ============================================================================
// Types
// ============================================================================

interface CustomerEditReservationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  reservation: ReservationWithDetails | null
  customerId: string
}

type SlotStatus = 'available' | 'reserved' | 'breakout' | 'past' | 'current'

interface EnhancedSlot {
  timestamp: number
  time: string
  status: SlotStatus
  reason?: string
}

// ============================================================================
// Component
// ============================================================================

export function CustomerEditReservationModal({
  isOpen,
  onClose,
  onSuccess,
  reservation,
  customerId,
}: CustomerEditReservationModalProps) {
  // ── State ──
  const [selectedDate, setSelectedDate] = useState<Date>(nowInIsrael())
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [shopSettings, setShopSettings] = useState<BarbershopSettings | null>(null)
  const [barberWorkDays, setBarberWorkDays] = useState<WorkDay[]>([])
  const [breakouts, setBreakouts] = useState<BarberBreakout[]>([])
  const [barberClosures, setBarberClosures] = useState<BarberClosure[]>([])
  const [shopClosures, setShopClosures] = useState<BarbershopClosure[]>([])
  const [reservedSlots, setReservedSlots] = useState<number[]>([])
  const [maxDaysAhead, setMaxDaysAhead] = useState<number>(21)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)

  const israelNow = nowInIsrael()
  const barberId = reservation?.barber_id || ''
  const barberName = reservation?.users?.fullname || 'הספר'

  // ── Derived: current reservation info ──
  const currentTimeFormatted = reservation ? formatTime(reservation.time_timestamp) : ''
  const currentDateFormatted = reservation ? formatDateHebrew(reservation.date_timestamp) : ''

  // ── Reset state when modal opens ──
  useEffect(() => {
    if (!isOpen || !reservation) return

    const resDate = new Date(reservation.date_timestamp)
    setSelectedDate(resDate)
    setSelectedTime(null)
    setSelectedService(reservation.services as Service || null)
    fetchInitialData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reservation?.id])

  // ── Fetch slots and breakouts when date changes ──
  useEffect(() => {
    if (isOpen && selectedDate && reservation) {
      fetchReservedSlots()
      fetchBreakoutsForSelectedDate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedDate])

  // ── Data fetching ──

  const fetchInitialData = async () => {
    if (!barberId) return
    await Promise.all([
      fetchServices(),
      fetchBarberWorkDays(),
      fetchClosures(),
      fetchShopSettings(),
      fetchBookingSettings(),
    ])
  }

  const fetchShopSettings = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('barbershop_settings')
      .select('*')
      .single()
    if (data) setShopSettings(data as BarbershopSettings)
  }

  const fetchBookingSettings = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('barber_booking_settings')
      .select('max_booking_days_ahead')
      .eq('barber_id', barberId)
      .maybeSingle()
    if (data?.max_booking_days_ahead) {
      setMaxDaysAhead(data.max_booking_days_ahead)
    }
  }

  const fetchServices = async () => {
    setLoadingServices(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('barber_id', barberId)
      .eq('is_active', true)
      .order('price', { ascending: true })
    if (data) setServices(data as Service[])
    setLoadingServices(false)
  }

  const fetchBarberWorkDays = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('work_days')
      .select('*')
      .eq('user_id', barberId)
    if (data) setBarberWorkDays(data as WorkDay[])
  }

  const fetchBreakoutsForSelectedDate = async () => {
    const dateBreakouts = await getBreakoutsForDate(barberId, selectedDate.getTime())
    setBreakouts(dateBreakouts)
  }

  const fetchClosures = async () => {
    const supabase = createClient()
    const todayStr = getIsraelDateString(Date.now())
    const [barberRes, shopRes] = await Promise.all([
      supabase.from('barber_closures').select('*').eq('barber_id', barberId).gte('end_date', todayStr),
      supabase.from('barbershop_closures').select('*').gte('end_date', todayStr),
    ])
    if (barberRes.data) setBarberClosures(barberRes.data as BarberClosure[])
    if (shopRes.data) setShopClosures(shopRes.data as BarbershopClosure[])
  }

  const fetchReservedSlots = async () => {
    if (!reservation) return
    setLoadingSlots(true)
    const supabase = createClient()
    const dayStartMs = getIsraelDayStart(selectedDate)
    const dayEndMs = getIsraelDayEnd(selectedDate)

    const { data } = await supabase
      .from('reservations')
      .select('id, time_timestamp')
      .eq('barber_id', barberId)
      .eq('status', 'confirmed')
      .gte('time_timestamp', dayStartMs)
      .lte('time_timestamp', dayEndMs)

    if (data) {
      setReservedSlots(
        data.filter(r => r.id !== reservation.id).map(r => r.time_timestamp)
      )
    }
    setLoadingSlots(false)
  }

  // ── Work hours for selected date ──
  const currentDayWorkHours = useMemo(() => {
    const dayKey = getDayKeyInIsrael(selectedDate.getTime())
    const barberDaySettings = barberWorkDays.find(wd => wd.day_of_week === dayKey)
    const defaultStart = shopSettings?.work_hours_start || '09:00'
    const defaultEnd = shopSettings?.work_hours_end || '19:00'

    if (barberDaySettings?.is_working && barberDaySettings.start_time && barberDaySettings.end_time) {
      return { start: barberDaySettings.start_time, end: barberDaySettings.end_time, isWorking: true }
    } else if (barberDaySettings && !barberDaySettings.is_working) {
      return { start: defaultStart, end: defaultEnd, isWorking: false }
    }
    return { start: defaultStart, end: defaultEnd, isWorking: true }
  }, [selectedDate, barberWorkDays, shopSettings])

  // ── Closure check ──
  const dateClosureReason = useMemo(() => {
    const dateStr = getIsraelDateString(selectedDate.getTime())
    const shopClosure = shopClosures.find(c => dateStr >= c.start_date && dateStr <= c.end_date)
    if (shopClosure) return shopClosure.reason || 'המספרה סגורה בתאריך זה'
    const barberClosure = barberClosures.find(c => dateStr >= c.start_date && dateStr <= c.end_date)
    if (barberClosure) return barberClosure.reason || 'הספר לא זמין בתאריך זה'
    return null
  }, [selectedDate, shopClosures, barberClosures])

  // ── Max date ──
  const maxDate = useMemo(() => {
    return addDays(israelNow, maxDaysAhead)
  }, [israelNow, maxDaysAhead])

  // ── Generate time slots ──
  const { availableSlots, allSlotsWithStatus } = useMemo(() => {
    if (!reservation) return { availableSlots: [], allSlotsWithStatus: [] }
    const dayKey = getDayKeyInIsrael(selectedDate.getTime())
    const barberDaySettings = barberWorkDays.find(wd => wd.day_of_week === dayKey)

    let workStart: string
    let workEnd: string

    if (barberDaySettings?.is_working && barberDaySettings.start_time && barberDaySettings.end_time) {
      workStart = barberDaySettings.start_time
      workEnd = barberDaySettings.end_time
    } else if (barberDaySettings && !barberDaySettings.is_working) {
      return { availableSlots: [], allSlotsWithStatus: [] }
    } else {
      workStart = shopSettings?.work_hours_start || '09:00'
      workEnd = shopSettings?.work_hours_end || '19:00'
    }

    if (dateClosureReason) return { availableSlots: [], allSlotsWithStatus: [] }

    const { hour: startHour, minute: startMinute } = parseTimeString(workStart)
    const { hour: endHour, minute: endMinute } = parseTimeString(workEnd)
    const allSlots = generateTimeSlots(selectedDate.getTime(), startHour, startMinute, endHour, endMinute, 30)

    const reservedSlotKeys = new Set(reservedSlots.map(ts => getSlotKey(ts)))
    const currentResSlotKey = getSlotKey(reservation.time_timestamp)
    const isSameDateAsRes = isSameDay(selectedDate, new Date(reservation.date_timestamp))
    const now = Date.now()

    const enhancedSlots: EnhancedSlot[] = allSlots.map(slot => {
      const slotKey = getSlotKey(slot.timestamp)

      if (isSameDateAsRes && slotKey === currentResSlotKey) {
        return { ...slot, status: 'current' as SlotStatus, reason: 'התור הנוכחי' }
      }
      if (isSameDay(selectedDate, israelNow) && slot.timestamp < now) {
        return { ...slot, status: 'past' as SlotStatus, reason: 'עבר' }
      }
      if (reservedSlotKeys.has(slotKey)) {
        return { ...slot, status: 'reserved' as SlotStatus, reason: 'תפוס' }
      }
      const breakoutCheck = isSlotInBreakout(slot.timestamp, breakouts, workEnd)
      if (breakoutCheck.blocked) {
        return { ...slot, status: 'breakout' as SlotStatus, reason: breakoutCheck.reason || 'הפסקה' }
      }
      return { ...slot, status: 'available' as SlotStatus }
    })

    return { availableSlots: enhancedSlots.filter(s => s.status === 'available'), allSlotsWithStatus: enhancedSlots }
  }, [selectedDate, shopSettings, reservedSlots, israelNow, barberWorkDays, breakouts, dateClosureReason, reservation])

  // ── Submit ──
  const handleSubmit = async () => {
    if (!reservation) return
    if (!selectedTime && selectedService?.id === reservation.service_id) {
      showToast.error('נא לבחור שעה חדשה')
      return
    }

    setSaving(true)
    try {
      const finalTime = selectedTime || reservation.time_timestamp
      const dayName = getDayKeyInIsrael(finalTime)
      const dateTimestamp = getIsraelDayStart(finalTime)

      const result = await editReservation({
        reservationId: reservation.id,
        barberId: reservation.barber_id,
        callerType: 'customer',
        customerId,
        newTimeTimestamp: finalTime,
        newDateTimestamp: dateTimestamp,
        newDayName: dayName,
        newDayNum: format(selectedDate, 'dd/MM'),
        newServiceId: selectedService?.id !== reservation.service_id ? selectedService?.id : undefined,
        expectedVersion: (reservation as ReservationWithDetails & { version?: number }).version,
      })

      if (!result.success) {
        if (result.concurrencyConflict) {
          showToast.error('התור עודכן. מרענן...')
          onSuccess()
          onClose()
          return
        }
        showToast.error(result.message || 'שגיאה בעדכון התור')
        if (result.error === 'SLOT_ALREADY_TAKEN') {
          await fetchReservedSlots()
          setSelectedTime(null)
        }
        return
      }

      // Notify barber about the reschedule (fire and forget)
      if (reservation.barber_id) {
        fetch('/api/push/notify-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId: reservation.id,
            customerId,
            customerName: reservation.customer_name,
            barberId: reservation.barber_id,
            barberName,
            serviceName: selectedService?.name_he || reservation.services?.name_he || 'שירות',
            appointmentTime: finalTime,
            isReschedule: true,
          })
        }).catch(err => console.error('[CustomerEdit] Push error:', err))
      }

      showToast.success('התור עודכן בהצלחה!')
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error editing reservation:', err)
      showToast.error('שגיאה בעדכון התור')
    } finally {
      setSaving(false)
    }
  }

  // ── Check if submit is possible ──
  const canSubmit = useMemo(() => {
    if (!reservation || saving) return false
    const timeChanged = selectedTime !== null
    const serviceChanged = selectedService?.id !== reservation.service_id
    return timeChanged || serviceChanged
  }, [reservation, selectedTime, selectedService, saving])

  if (!isOpen || !reservation) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="relative w-full sm:max-w-lg sm:mx-4 bg-background-darker sm:bg-background-dark border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col animate-slide-in-up sm:animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                <ArrowLeftRight size={18} className="text-accent-gold" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground-light">שינוי מועד התור</h3>
                <p className="text-foreground-muted text-xs mt-0.5">
                  שנה תאריך, שעה או שירות
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              isIconOnly
              onPress={onClose}
              className="min-w-[40px] w-10 h-10 rounded-full hover:bg-white/5"
              aria-label="סגור"
            >
              <X size={20} className="text-foreground-muted" />
            </Button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 pt-4">
            {/* Current Reservation Card */}
            <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-foreground-muted text-xs mb-2">התור הנוכחי</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <User size={13} className="text-accent-gold" />
                  <span className="text-foreground-light text-sm">{barberName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-accent-gold" />
                  <span className="text-foreground-light text-sm">{currentDateFormatted}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-accent-gold" />
                  <span className="text-foreground-light text-sm">{currentTimeFormatted}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Scissors size={13} className="text-accent-gold" />
                  <span className="text-foreground-light text-sm">{reservation.services?.name_he || 'שירות'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Service Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm flex items-center gap-2">
                  <Scissors size={14} className="text-accent-gold" />
                  שירות
                </label>
                {loadingServices ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 size={18} className="text-accent-gold animate-spin" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {services.map(svc => (
                      <button
                        key={svc.id}
                        onClick={() => setSelectedService(svc)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm transition-all',
                          selectedService?.id === svc.id
                            ? 'bg-accent-gold text-background-dark font-medium'
                            : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.1] border border-white/[0.08]'
                        )}
                      >
                        {svc.name_he}
                        {svc.price && (
                          <span className="mr-1.5 text-xs opacity-70">₪{svc.price}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Date Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm flex items-center gap-2">
                  <Calendar size={14} className="text-accent-gold" />
                  תאריך
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedDate(israelNow); setSelectedTime(null) }}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      isSameDay(selectedDate, israelNow)
                        ? 'bg-accent-gold text-background-dark'
                        : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.1]'
                    )}
                  >
                    היום
                  </button>
                  <button
                    onClick={() => { setSelectedDate(addDays(israelNow, 1)); setSelectedTime(null) }}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      isSameDay(selectedDate, addDays(israelNow, 1))
                        ? 'bg-accent-gold text-background-dark'
                        : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.1]'
                    )}
                  >
                    מחר
                  </button>
                  <input
                    type="date"
                    aria-label="בחר תאריך"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : israelNow
                      setSelectedDate(date)
                      setSelectedTime(null)
                    }}
                    min={format(israelNow, 'yyyy-MM-dd')}
                    max={format(maxDate, 'yyyy-MM-dd')}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-foreground-light text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
                  />
                </div>
              </div>

              {/* Time Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm flex items-center gap-2">
                  <Clock size={14} className="text-accent-gold" />
                  שעה
                </label>

                {loadingSlots ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={20} className="text-accent-gold animate-spin" />
                  </div>
                ) : !currentDayWorkHours.isWorking ? (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-red-400 text-sm text-center">הספר לא עובד ביום זה</p>
                  </div>
                ) : dateClosureReason ? (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-red-400 text-sm text-center">{dateClosureReason}</p>
                  </div>
                ) : allSlotsWithStatus.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-foreground-muted text-sm">אין משבצות ביום זה</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-foreground-muted text-xs">
                      {availableSlots.length} פנויות מתוך {allSlotsWithStatus.length} משבצות
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pb-2">
                      {allSlotsWithStatus.map(slot => {
                        const isUnavailable = slot.status !== 'available' && slot.status !== 'current'
                        const isCurrent = slot.status === 'current'
                        const isSelected = selectedTime === slot.timestamp && !isUnavailable && !isCurrent

                        return (
                          <button
                            key={slot.timestamp}
                            onClick={() => {
                              if (!isUnavailable && !isCurrent) setSelectedTime(slot.timestamp)
                            }}
                            disabled={isUnavailable || isCurrent}
                            title={isCurrent ? `${slot.time} - התור הנוכחי` : isUnavailable ? `${slot.time} - ${slot.reason}` : slot.time}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all tabular-nums relative',
                              isSelected
                                ? 'bg-accent-gold text-background-dark ring-2 ring-accent-gold/50'
                                : isCurrent
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 cursor-not-allowed'
                                  : isUnavailable
                                    ? 'bg-white/[0.02] text-foreground-muted/30 border border-white/[0.04] cursor-not-allowed line-through'
                                    : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.1] border border-white/[0.08]'
                            )}
                            aria-label={isCurrent ? `${slot.time} - התור הנוכחי` : isUnavailable ? `${slot.time} - ${slot.reason}` : `בחר שעה ${slot.time}`}
                            tabIndex={isUnavailable || isCurrent ? -1 : 0}
                          >
                            {slot.time}
                            {isCurrent && (
                              <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-blue-500/80 flex items-center justify-center">
                                <Clock size={7} className="text-white" />
                              </span>
                            )}
                            {isUnavailable && slot.status === 'breakout' && (
                              <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-orange-500/60 flex items-center justify-center">
                                <AlertTriangle size={7} className="text-white" />
                              </span>
                            )}
                            {isUnavailable && slot.status === 'reserved' && (
                              <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-red-500/60 flex items-center justify-center">
                                <X size={7} className="text-white" />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 pt-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted/60">
                        <span className="w-2 h-2 rounded-full bg-blue-500/80" />
                        נוכחי
                      </div>
                      {allSlotsWithStatus.some(s => s.status === 'reserved') && (
                        <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted/60">
                          <span className="w-2 h-2 rounded-full bg-red-500/60" />
                          תפוס
                        </div>
                      )}
                      {allSlotsWithStatus.some(s => s.status === 'breakout') && (
                        <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted/60">
                          <span className="w-2 h-2 rounded-full bg-orange-500/60" />
                          לא זמין
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selection Summary */}
              {canSubmit && (
                <div className="p-3 rounded-xl bg-accent-gold/10 border border-accent-gold/20">
                  <p className="text-accent-gold text-xs font-medium mb-1">השינויים שנבחרו:</p>
                  <div className="flex items-center gap-3 flex-wrap text-sm">
                    {selectedTime && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-accent-gold" />
                          <span className="text-foreground-light">
                            {isSameDay(selectedDate, israelNow) ? 'היום' :
                             isSameDay(selectedDate, addDays(israelNow, 1)) ? 'מחר' :
                             format(selectedDate, 'dd/MM/yyyy', { locale: he })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-accent-gold" />
                          <span className="text-foreground-light">{formatTime(selectedTime)}</span>
                        </div>
                      </>
                    )}
                    {selectedService?.id !== reservation.service_id && selectedService && (
                      <div className="flex items-center gap-1.5">
                        <Scissors size={13} className="text-accent-gold" />
                        <span className="text-foreground-light">{selectedService.name_he}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 sm:p-6 pt-4 border-t border-white/5 flex-shrink-0 bg-background-darker sm:bg-background-dark">
            <Button
              onPress={handleSubmit}
              isDisabled={!canSubmit}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium',
                !canSubmit
                  ? 'bg-foreground-muted/30 text-foreground-muted'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  מעדכן...
                </span>
              ) : (
                'עדכן תור'
              )}
            </Button>
            <Button
              variant="ghost"
              onPress={onClose}
              isDisabled={saving}
              className="px-6 py-3 rounded-xl font-medium border border-white/20 text-foreground-light hover:bg-white/5"
            >
              ביטול
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
