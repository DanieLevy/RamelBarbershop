/**
 * EditReservationModal Component
 *
 * Allows the barber to reschedule an existing reservation to a new date/time.
 * Reuses the same availability logic as ManualBookingModal:
 * - Respects barber work hours (per-day)
 * - Respects breakouts (breaks)
 * - Respects closures (barber + shop)
 * - Respects recurring appointment slots
 * - Shows reserved vs available slots
 * - Excludes the current reservation's slot from "reserved" (self-exclusion)
 *
 * The reservation ID is preserved — only date/time fields are updated.
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Calendar, Clock, AlertTriangle, Pencil, ArrowLeftRight, ChevronDown } from 'lucide-react'
import { cn, generateTimeSlots, parseTimeString, nowInIsrael, getIsraelDayStart, getIsraelDayEnd, getDayKeyInIsrael, getSlotKey, getIsraelDateString, formatTime, formatDateHebrew } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { editReservation } from '@/lib/services/booking.service'
import { getBreakoutsForDate, isSlotInBreakout } from '@/lib/services/breakout.service'
import { format, addDays, isSameDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { showToast } from '@/lib/toast'
import type { BarbershopSettings, Service, WorkDay, BarberBreakout, BarbershopClosure, BarberClosure, Reservation } from '@/types/database'
import { Portal } from '@/components/ui/Portal'
import { Button } from '@heroui/react'

// ============================================================================
// Types
// ============================================================================

interface ReservationWithService extends Reservation {
  services?: Service
}

interface EditReservationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  reservation: ReservationWithService | null
  barberId: string
  barberName?: string
  shopSettings: BarbershopSettings | null
  callerType?: 'barber' | 'admin'
  adminId?: string
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

export function EditReservationModal({
  isOpen,
  onClose,
  onSuccess,
  reservation,
  barberId,
  barberName,
  shopSettings,
  callerType = 'barber',
  adminId,
}: EditReservationModalProps) {
  // ── State ──
  const [selectedDate, setSelectedDate] = useState<Date>(nowInIsrael())
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [barberWorkDays, setBarberWorkDays] = useState<WorkDay[]>([])
  const [breakouts, setBreakouts] = useState<BarberBreakout[]>([])
  const [barberClosures, setBarberClosures] = useState<BarberClosure[]>([])
  const [shopClosures, setShopClosures] = useState<BarbershopClosure[]>([])
  const [reservedSlots, setReservedSlots] = useState<number[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showUnavailable, setShowUnavailable] = useState(false)

  const israelNow = nowInIsrael()

  // ── Derived: current reservation info ──
  const currentTimeFormatted = reservation ? formatTime(reservation.time_timestamp) : ''
  const currentDateFormatted = reservation ? formatDateHebrew(reservation.date_timestamp) : ''

  // ── Reset state when modal opens ──
  useEffect(() => {
    if (isOpen && reservation) {
      // Default to the current reservation's date
      const resDate = new Date(reservation.date_timestamp)
      setSelectedDate(resDate)
      setSelectedTime(null)
      setShowUnavailable(false)
      fetchBarberWorkDays()
      fetchClosures()
    }
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

  const fetchBarberWorkDays = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('work_days')
      .select('id, user_id, day_of_week, is_working, start_time, end_time')
      .eq('user_id', barberId)

    if (data) {
      setBarberWorkDays(data as WorkDay[])
    }
  }

  const fetchBreakoutsForSelectedDate = async () => {
    const dateBreakouts = await getBreakoutsForDate(barberId, selectedDate.getTime())
    setBreakouts(dateBreakouts)
  }

  const fetchClosures = async () => {
    const supabase = createClient()
    const todayStr = getIsraelDateString(Date.now())

    const [barberRes, shopRes] = await Promise.all([
      supabase
        .from('barber_closures')
        .select('id, barber_id, start_date, end_date, reason, created_at')
        .eq('barber_id', barberId)
        .gte('end_date', todayStr),
      supabase
        .from('barbershop_closures')
        .select('id, start_date, end_date, reason, created_at')
        .gte('end_date', todayStr),
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
      // Exclude the current reservation from "reserved" list so its slot shows as "current"
      setReservedSlots(
        data
          .filter(r => r.id !== reservation.id)
          .map(r => r.time_timestamp)
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

    if (barberDaySettings && barberDaySettings.is_working && barberDaySettings.start_time && barberDaySettings.end_time) {
      return { start: barberDaySettings.start_time, end: barberDaySettings.end_time, isWorking: true, dayName: dayKey }
    } else if (barberDaySettings && !barberDaySettings.is_working) {
      return { start: defaultStart, end: defaultEnd, isWorking: false, dayName: dayKey }
    }

    return { start: defaultStart, end: defaultEnd, isWorking: true, dayName: dayKey }
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

  // ── Generate time slots with availability ──
  const { availableSlots, allSlotsWithStatus } = useMemo(() => {
    if (!reservation) return { availableSlots: [], allSlotsWithStatus: [] }

    const dayKey = getDayKeyInIsrael(selectedDate.getTime())
    const barberDaySettings = barberWorkDays.find(wd => wd.day_of_week === dayKey)

    let workStart: string
    let workEnd: string

    if (barberDaySettings && barberDaySettings.is_working && barberDaySettings.start_time && barberDaySettings.end_time) {
      workStart = barberDaySettings.start_time
      workEnd = barberDaySettings.end_time
    } else if (barberDaySettings && !barberDaySettings.is_working) {
      return { availableSlots: [], allSlotsWithStatus: [] }
    } else {
      workStart = shopSettings?.work_hours_start || '09:00'
      workEnd = shopSettings?.work_hours_end || '19:00'
    }

    if (dateClosureReason) {
      return { availableSlots: [], allSlotsWithStatus: [] }
    }

    const { hour: startHour, minute: startMinute } = parseTimeString(workStart)
    const { hour: endHour, minute: endMinute } = parseTimeString(workEnd)

    const allSlots = generateTimeSlots(
      selectedDate.getTime(),
      startHour,
      startMinute,
      endHour,
      endMinute,
      30
    )

    // Build reserved slot keys (excluding current reservation)
    const reservedSlotKeys = new Set(reservedSlots.map(ts => getSlotKey(ts)))

    // Current reservation's slot key for highlighting
    const currentResSlotKey = getSlotKey(reservation.time_timestamp)
    const isSameDate = isSameDay(selectedDate, new Date(reservation.date_timestamp))

    const now = Date.now()

    const enhancedSlots: EnhancedSlot[] = allSlots.map(slot => {
      const slotKey = getSlotKey(slot.timestamp)

      // Mark current reservation's slot
      if (isSameDate && slotKey === currentResSlotKey) {
        return { ...slot, status: 'current' as SlotStatus, reason: 'התור הנוכחי' }
      }

      // Past slots for today
      if (isSameDay(selectedDate, israelNow) && slot.timestamp < now) {
        return { ...slot, status: 'past' as SlotStatus, reason: 'עבר' }
      }

      // Reserved
      if (reservedSlotKeys.has(slotKey)) {
        return { ...slot, status: 'reserved' as SlotStatus, reason: 'תפוס' }
      }

      // Breakout
      const breakoutCheck = isSlotInBreakout(slot.timestamp, breakouts, workEnd)
      if (breakoutCheck.blocked) {
        return { ...slot, status: 'breakout' as SlotStatus, reason: breakoutCheck.reason || 'הפסקה' }
      }

      return { ...slot, status: 'available' as SlotStatus }
    })

    const available = enhancedSlots.filter(s => s.status === 'available')

    return { availableSlots: available, allSlotsWithStatus: enhancedSlots }
  }, [selectedDate, shopSettings, reservedSlots, israelNow, barberWorkDays, breakouts, dateClosureReason, reservation])

  // ── Submit handler ──
  const handleSubmit = async () => {
    if (!reservation || !selectedTime) {
      showToast.error('נא לבחור שעה חדשה')
      return
    }

    setSaving(true)

    try {
      const dayName = getDayKeyInIsrael(selectedTime)
      const dateTimestamp = getIsraelDayStart(selectedTime)

      const result = await editReservation({
        reservationId: reservation.id,
        barberId,
        callerType,
        adminId,
        newTimeTimestamp: selectedTime,
        newDateTimestamp: dateTimestamp,
        newDayName: dayName,
        newDayNum: format(selectedDate, 'dd/MM'),
        expectedVersion: (reservation as ReservationWithService & { version?: number }).version,
      })

      if (!result.success) {
        if (result.concurrencyConflict) {
          showToast.error('התור עודכן על ידי אחר. מרענן...')
          onSuccess()
          onClose()
          return
        }

        showToast.error(result.message || 'שגיאה בעדכון התור')

        // Refresh slots if the slot was taken
        if (result.error === 'SLOT_ALREADY_TAKEN') {
          await fetchReservedSlots()
          setSelectedTime(null)
        }
        return
      }

      // Send push notification to customer about the reschedule
      if (reservation.customer_id) {
        try {
          fetch('/api/push/notify-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reservationId: reservation.id,
              customerId: reservation.customer_id,
              customerName: reservation.customer_name,
              barberId,
              barberName: barberName || 'הספר',
              serviceName: reservation.services?.name_he || 'שירות',
              appointmentTime: selectedTime,
              isReschedule: true,
            })
          })
            .then(res => res.json())
            .then(data => console.log('[EditReservation] Push notification result:', data))
            .catch(err => console.error('[EditReservation] Push notification error:', err))
        } catch (pushErr) {
          console.error('[EditReservation] Failed to send push notification:', pushErr)
        }
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

  // ── Early return ──
  if (!isOpen || !reservation) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="relative w-full sm:max-w-lg sm:mx-4 bg-background-darker sm:bg-background-dark border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col animate-slide-in-up sm:animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                <Pencil size={18} className="text-accent-gold" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground-light">עריכת תור</h3>
                <p className="text-foreground-muted text-xs mt-0.5">
                  שינוי מועד התור של {reservation.customer_name}
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
            {/* Current Reservation Info */}
            <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-foreground-muted text-xs mb-2">התור הנוכחי</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-accent-gold" />
                  <span className="text-foreground-light text-sm font-medium">{currentDateFormatted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-accent-gold" />
                  <span className="text-foreground-light text-sm font-medium">{currentTimeFormatted}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-foreground-muted text-xs">{reservation.services?.name_he || 'שירות'}</span>
                <span className="text-foreground-muted/50 text-xs">·</span>
                <span className="text-foreground-muted text-xs">{reservation.customer_name}</span>
              </div>
            </div>

            {/* Arrow indicator */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-gold/10 border border-accent-gold/20">
                <ArrowLeftRight size={14} className="text-accent-gold" />
                <span className="text-accent-gold text-xs font-medium">בחר מועד חדש</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Date Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm flex items-center gap-2">
                  <Calendar size={14} className="text-accent-gold" />
                  תאריך חדש
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedDate(israelNow)}
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
                    onClick={() => setSelectedDate(addDays(israelNow, 1))}
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
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-foreground-light text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
                  />
                </div>
              </div>

              {/* Time Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm flex items-center gap-2">
                  <Clock size={14} className="text-accent-gold" />
                  שעה חדשה
                </label>

                {loadingSlots ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={20} className="text-accent-gold animate-spin" />
                  </div>
                ) : !currentDayWorkHours.isWorking ? (
                  <div className="text-center py-4">
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-sm">הספר לא עובד ביום זה</p>
                    </div>
                  </div>
                ) : dateClosureReason ? (
                  <div className="text-center py-4">
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-sm">{dateClosureReason}</p>
                    </div>
                  </div>
                ) : allSlotsWithStatus.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-foreground-muted text-sm">אין משבצות ביום זה</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-sm">אין משבצות פנויות ביום זה</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Available count info */}
                    <p className="text-foreground-muted text-xs">
                      {availableSlots.length} משבצות פנויות
                      {currentDayWorkHours.start && currentDayWorkHours.end && (
                        <span className="text-foreground-muted/50"> · {currentDayWorkHours.start} - {currentDayWorkHours.end}</span>
                      )}
                    </p>

                    {/* Current reservation slot (if on same date) */}
                    {allSlotsWithStatus.some(s => s.status === 'current') && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-foreground-muted text-xs">התור הנוכחי:</span>
                        {allSlotsWithStatus.filter(s => s.status === 'current').map(slot => (
                          <span key={slot.timestamp} className="px-3 py-1.5 rounded-lg text-sm font-medium tabular-nums bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {slot.time}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Available slots */}
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pb-2">
                      {availableSlots.map(slot => {
                        const isSelected = selectedTime === slot.timestamp

                        return (
                          <button
                            key={slot.timestamp}
                            onClick={() => setSelectedTime(slot.timestamp)}
                            title={slot.time}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all tabular-nums',
                              isSelected
                                ? 'bg-accent-gold text-background-dark ring-2 ring-accent-gold/50'
                                : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.1] border border-white/[0.08]'
                            )}
                            aria-label={`בחר שעה ${slot.time}`}
                            tabIndex={0}
                          >
                            {slot.time}
                          </button>
                        )
                      })}
                    </div>

                    {/* Collapsible unavailable slots */}
                    {(() => {
                      const unavailableSlots = allSlotsWithStatus.filter(s => s.status !== 'available' && s.status !== 'current')
                      if (unavailableSlots.length === 0) return null

                      return (
                        <div className="pt-1">
                          <button
                            onClick={() => setShowUnavailable(prev => !prev)}
                            className="flex items-center gap-1.5 text-foreground-muted/60 text-xs hover:text-foreground-muted transition-colors"
                            aria-expanded={showUnavailable}
                            aria-label={showUnavailable ? 'הסתר שעות תפוסות' : 'הצג שעות תפוסות'}
                            tabIndex={0}
                          >
                            <ChevronDown size={12} className={cn('transition-transform', showUnavailable && 'rotate-180')} />
                            {unavailableSlots.length} שעות לא זמינות
                          </button>

                          {showUnavailable && (
                            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                              {unavailableSlots.map(slot => (
                                <span
                                  key={slot.timestamp}
                                  title={`${slot.time} - ${slot.reason}`}
                                  className="px-3 py-1.5 rounded-lg text-sm font-medium tabular-nums bg-white/[0.02] text-foreground-muted/30 border border-white/[0.04] line-through relative"
                                >
                                  {slot.time}
                                  {slot.status === 'breakout' && (
                                    <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-orange-500/60 flex items-center justify-center">
                                      <AlertTriangle size={7} className="text-white" />
                                    </span>
                                  )}
                                  {slot.status === 'reserved' && (
                                    <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-red-500/60 flex items-center justify-center">
                                      <X size={7} className="text-white" />
                                    </span>
                                  )}
                                </span>
                              ))}

                              {/* Legend for unavailable */}
                              <div className="w-full flex flex-wrap gap-3 pt-1">
                                {unavailableSlots.some(s => s.status === 'reserved') && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted/60">
                                    <span className="w-2 h-2 rounded-full bg-red-500/60" />
                                    תפוס
                                  </div>
                                )}
                                {unavailableSlots.some(s => s.status === 'breakout') && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted/60">
                                    <span className="w-2 h-2 rounded-full bg-orange-500/60" />
                                    הפסקה
                                  </div>
                                )}
                                {unavailableSlots.some(s => s.status === 'past') && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted/60">
                                    <span className="w-2 h-2 rounded-full bg-zinc-500/60" />
                                    עבר
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Selected new time summary */}
              {selectedTime && (
                <div className="p-3 rounded-xl bg-accent-gold/10 border border-accent-gold/20">
                  <p className="text-accent-gold text-xs font-medium mb-1">המועד החדש שנבחר:</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-accent-gold" />
                      <span className="text-foreground-light text-sm font-medium">
                        {isSameDay(selectedDate, israelNow)
                          ? 'היום'
                          : isSameDay(selectedDate, addDays(israelNow, 1))
                            ? 'מחר'
                            : format(selectedDate, 'dd/MM/yyyy', { locale: he })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-accent-gold" />
                      <span className="text-foreground-light text-sm font-medium">
                        {formatTime(selectedTime)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions - Sticky Footer */}
          <div className="flex gap-3 p-5 sm:p-6 pt-4 border-t border-white/5 flex-shrink-0 bg-background-darker sm:bg-background-dark">
            <Button
              onPress={handleSubmit}
              isDisabled={saving || !selectedTime}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium',
                saving || !selectedTime
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
