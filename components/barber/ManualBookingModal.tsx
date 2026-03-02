'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Loader2, Search, User, Calendar, Clock, UserPlus, Scissors, AlertTriangle, CheckCircle, UserCheck, ChevronLeft, ChevronRight, FileText, Phone } from 'lucide-react'
import { cn, generateTimeSlots, parseTimeString, nowInIsrael, getIsraelDayStart, getIsraelDayEnd, getDayKeyInIsrael, getSlotKey, getIsraelDateString, getDayNameInHebrew, formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { createReservation } from '@/lib/services/booking.service'
import { getOrCreateCustomer } from '@/lib/services/customer.service'
import { getBreakoutsForDate, isSlotInBreakout } from '@/lib/services/breakout.service'
import { format, addDays, subDays, isSameDay, isBefore, startOfDay } from 'date-fns'
import { showToast } from '@/lib/toast'
import type { Customer, BarbershopSettings, Service, WorkDay, BarberBreakout, BarbershopClosure, BarberClosure } from '@/types/database'
import { Portal } from '@/components/ui/Portal'
import { Button } from '@heroui/react'

interface ManualBookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  barberId: string
  barberName?: string
  barberPhone?: string
  shopSettings: BarbershopSettings | null
  preselectedDate?: Date | null
  preselectedTime?: number | null
}

type BookingMode = 'existing' | 'new' | 'self'

const DATE_RANGE_DAYS = 7

export function ManualBookingModal({
  isOpen,
  onClose,
  onSuccess,
  barberId,
  barberName,
  barberPhone,
  shopSettings,
  preselectedDate,
  preselectedTime
}: ManualBookingModalProps) {
  const [mode, setMode] = useState<BookingMode>('existing')
  const [selectedDate, setSelectedDate] = useState<Date>(preselectedDate || nowInIsrael())
  const [selectedTime, setSelectedTime] = useState<number | null>(preselectedTime || null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [walkinName, setWalkinName] = useState('')
  const [walkinPhone, setWalkinPhone] = useState('')
  const [barberNotes, setBarberNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  const [isOutOfHours, setIsOutOfHours] = useState(false)
  const [customHour, setCustomHour] = useState('')
  const [customMinute, setCustomMinute] = useState('00')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)

  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [reservedSlots, setReservedSlots] = useState<number[]>([])
  const [barberWorkDays, setBarberWorkDays] = useState<WorkDay[]>([])
  const [breakouts, setBreakouts] = useState<BarberBreakout[]>([])
  const [barberClosures, setBarberClosures] = useState<BarberClosure[]>([])
  const [shopClosures, setShopClosures] = useState<BarbershopClosure[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)

  const dateScrollRef = useRef<HTMLDivElement>(null)

  const israelNow = nowInIsrael()
  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(israelNow))

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

  const getSmartOutOfHoursDefault = () => {
    const { hour: endHour, minute: endMinute } = parseTimeString(currentDayWorkHours.end)
    let defaultHour = endHour
    let defaultMinute = endMinute + 30
    if (defaultMinute >= 60) { defaultMinute -= 60; defaultHour += 1 }
    if (defaultHour > 23) { defaultHour = 23; defaultMinute = 0 }
    return {
      hour: defaultHour.toString().padStart(2, '0'),
      minute: defaultMinute < 15 ? '00' : defaultMinute < 30 ? '15' : defaultMinute < 45 ? '30' : '45'
    }
  }

  // --- Date chips for horizontal scroller ---
  const dateChips = useMemo(() => {
    const chips: { date: Date; label: string; sublabel: string; isPast: boolean }[] = []
    const yesterday = subDays(israelNow, 1)
    chips.push({ date: yesterday, label: 'אתמול', sublabel: format(yesterday, 'dd/MM'), isPast: true })
    chips.push({ date: israelNow, label: 'היום', sublabel: format(israelNow, 'dd/MM'), isPast: false })
    for (let i = 1; i <= DATE_RANGE_DAYS; i++) {
      const d = addDays(israelNow, i)
      const dayKey = getDayKeyInIsrael(d.getTime())
      const hebrewDay = getDayNameInHebrew(dayKey)
      chips.push({
        date: d,
        label: i === 1 ? 'מחר' : `יום ${hebrewDay}`,
        sublabel: format(d, 'dd/MM'),
        isPast: false,
      })
    }
    return chips
  }, [israelNow])

  // --- Effects ---
  useEffect(() => {
    if (isOpen) {
      setMode('existing')
      setSelectedDate(preselectedDate || israelNow)
      setSelectedTime(preselectedTime || null)
      setSelectedCustomer(null)
      setSelectedService(null)
      setWalkinName('')
      setWalkinPhone('')
      setBarberNotes('')
      setShowNotes(false)
      setSearchQuery('')
      setSearchResults([])
      setIsOutOfHours(false)
      setCustomHour('')
      setCustomMinute('00')
      fetchServices()
      fetchBarberWorkDays()
      fetchClosures()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preselectedDate, preselectedTime])

  useEffect(() => {
    if (isOutOfHours && barberWorkDays.length > 0) {
      const defaults = getSmartOutOfHoursDefault()
      setCustomHour(defaults.hour)
      setCustomMinute(defaults.minute)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOutOfHours, selectedDate, barberWorkDays])

  useEffect(() => {
    if (isPastDate && isOutOfHours) setIsOutOfHours(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPastDate])

  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchReservedSlots()
      fetchBreakoutsForSelectedDate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedDate])

  // --- Data fetchers ---
  const fetchBarberWorkDays = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('work_days')
      .select('id, user_id, day_of_week, is_working, start_time, end_time')
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
      supabase.from('barber_closures').select('id, barber_id, start_date, end_date, reason, created_at').eq('barber_id', barberId).gte('end_date', todayStr),
      supabase.from('barbershop_closures').select('id, start_date, end_date, reason, created_at').gte('end_date', todayStr),
    ])
    if (barberRes.data) setBarberClosures(barberRes.data as BarberClosure[])
    if (shopRes.data) setShopClosures(shopRes.data as BarbershopClosure[])
  }

  const fetchServices = async () => {
    setLoadingServices(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('services')
      .select('id, name, name_he, description, duration, price, is_active, barber_id')
      .eq('barber_id', barberId)
      .eq('is_active', true)
      .order('price', { ascending: true })
    if (data) {
      setServices(data as Service[])
      if (data.length > 0) setSelectedService(data[0] as Service)
    }
    setLoadingServices(false)
  }

  const fetchReservedSlots = async () => {
    setLoadingSlots(true)
    const supabase = createClient()
    const dayStartMs = getIsraelDayStart(selectedDate)
    const dayEndMs = getIsraelDayEnd(selectedDate)
    let query = supabase.from('reservations').select('time_timestamp').eq('barber_id', barberId).gte('time_timestamp', dayStartMs).lte('time_timestamp', dayEndMs)
    if (isPastDate) { query = query.in('status', ['confirmed', 'completed']) } else { query = query.eq('status', 'confirmed') }
    const { data } = await query
    if (data) setReservedSlots(data.map(r => r.time_timestamp))
    setLoadingSlots(false)
  }

  // Debounced customer search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('customers')
        .select('id, phone, fullname, email, is_blocked, blocked_at, blocked_reason, created_at, updated_at')
        .or(`fullname.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10)
      if (data) setSearchResults(data as Customer[])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // --- Computed values ---
  const customTimeTimestamp = useMemo(() => {
    if (!isOutOfHours) return null
    const hour = parseInt(customHour, 10)
    const minute = parseInt(customMinute, 10)
    if (isNaN(hour) || isNaN(minute)) return null
    const cleanDayStart = getIsraelDayStart(selectedDate)
    return cleanDayStart + hour * 3600000 + minute * 60000
  }, [isOutOfHours, selectedDate, customHour, customMinute])

  const isCustomTimeReserved = useMemo(() => {
    if (!customTimeTimestamp) return false
    const customSlotKey = getSlotKey(customTimeTimestamp)
    return reservedSlots.some(reserved => getSlotKey(reserved) === customSlotKey)
  }, [customTimeTimestamp, reservedSlots])

  const dateClosureReason = useMemo(() => {
    if (isPastDate) return null
    const dateStr = getIsraelDateString(selectedDate.getTime())
    const shopClosure = shopClosures.find(c => dateStr >= c.start_date && dateStr <= c.end_date)
    if (shopClosure) return shopClosure.reason || 'המספרה סגורה בתאריך זה'
    const barberClosure = barberClosures.find(c => dateStr >= c.start_date && dateStr <= c.end_date)
    if (barberClosure) return barberClosure.reason || 'הספר לא זמין בתאריך זה'
    return null
  }, [selectedDate, isPastDate, shopClosures, barberClosures])

  type SlotStatus = 'available' | 'reserved' | 'breakout' | 'past'
  interface EnhancedSlot { timestamp: number; time: string; status: SlotStatus; reason?: string }

  const allSlotsWithStatus = useMemo(() => {
    const dayKey = getDayKeyInIsrael(selectedDate.getTime())
    const barberDaySettings = barberWorkDays.find(wd => wd.day_of_week === dayKey)
    let workStart: string
    let workEnd: string
    if (barberDaySettings && barberDaySettings.is_working && barberDaySettings.start_time && barberDaySettings.end_time) {
      workStart = barberDaySettings.start_time
      workEnd = barberDaySettings.end_time
    } else if (barberDaySettings && !barberDaySettings.is_working && !isPastDate) {
      return []
    } else {
      workStart = shopSettings?.work_hours_start || '09:00'
      workEnd = shopSettings?.work_hours_end || '19:00'
    }
    if (dateClosureReason && !isPastDate) return []

    const { hour: startHour, minute: startMinute } = parseTimeString(workStart)
    const { hour: endHour, minute: endMinute } = parseTimeString(workEnd)
    const allSlots = generateTimeSlots(selectedDate.getTime(), startHour, startMinute, endHour, endMinute, 30)
    const reservedSlotKeys = new Set(reservedSlots.map(ts => getSlotKey(ts)))
    const now = Date.now()

    const enhancedSlots: EnhancedSlot[] = allSlots.map(slot => {
      if (isPastDate) {
        if (reservedSlotKeys.has(getSlotKey(slot.timestamp))) return { ...slot, status: 'reserved' as SlotStatus, reason: 'תפוס' }
        return { ...slot, status: 'available' as SlotStatus }
      }
      if (isSameDay(selectedDate, israelNow) && slot.timestamp < now) return { ...slot, status: 'past' as SlotStatus, reason: 'עבר' }
      if (reservedSlotKeys.has(getSlotKey(slot.timestamp))) return { ...slot, status: 'reserved' as SlotStatus, reason: 'תפוס' }
      const breakoutCheck = isSlotInBreakout(slot.timestamp, breakouts, workEnd)
      if (breakoutCheck.blocked) return { ...slot, status: 'breakout' as SlotStatus, reason: breakoutCheck.reason || 'הפסקה' }
      return { ...slot, status: 'available' as SlotStatus }
    })
    return enhancedSlots
  }, [selectedDate, shopSettings, reservedSlots, israelNow, isPastDate, barberWorkDays, breakouts, dateClosureReason])

  // --- Summary for footer ---
  const finalTime = isOutOfHours ? customTimeTimestamp : selectedTime
  const summaryTime = useMemo(() => {
    if (!finalTime) return null
    const d = new Date(finalTime)
    const hours = d.getUTCHours().toString().padStart(2, '0')
    const mins = d.getUTCMinutes().toString().padStart(2, '0')
    return `${hours}:${mins}`
  }, [finalTime])

  const customerLabel = useMemo(() => {
    if (mode === 'existing') return selectedCustomer?.fullname || null
    if (mode === 'self') return barberName || null
    return walkinName.trim() || null
  }, [mode, selectedCustomer, barberName, walkinName])

  const canSubmit = useMemo(() => {
    if (saving || loadingServices || services.length === 0) return false
    if (!selectedService) return false
    if (!finalTime) return false
    if (mode === 'existing' && !selectedCustomer) return false
    if (mode === 'new' && !walkinName.trim()) return false
    if (mode === 'self' && (!barberName || !barberPhone)) return false
    if (isOutOfHours && isCustomTimeReserved) return false
    return true
  }, [saving, loadingServices, services, selectedService, finalTime, mode, selectedCustomer, walkinName, barberName, barberPhone, isOutOfHours, isCustomTimeReserved])

  // --- Submit handler ---
  const handleSubmit = async () => {
    if (!finalTime) { showToast.error('נא לבחור שעה'); return }
    if (!selectedService) { showToast.error('נא לבחור שירות'); return }
    if (mode === 'existing' && !selectedCustomer) { showToast.error('נא לבחור לקוח'); return }
    if (mode === 'new' && !walkinName.trim()) { showToast.error('נא להזין שם הלקוח'); return }

    if (isOutOfHours && !isPastDate) {
      if (isCustomTimeReserved) { showToast.error('השעה כבר תפוסה'); return }
      if (isSameDay(selectedDate, israelNow) && finalTime < Date.now()) { showToast.error('לא ניתן לקבוע תור בשעה שעברה'); return }
    }

    setSaving(true)

    try {
      let customerId: string
      let customerName: string
      let customerPhone: string

      if (mode === 'existing') {
        customerId = selectedCustomer!.id
        customerName = selectedCustomer!.fullname
        customerPhone = selectedCustomer!.phone
      } else if (mode === 'self' && barberName && barberPhone) {
        const newCustomer = await getOrCreateCustomer(barberPhone, barberName)
        if (!newCustomer) {
          console.error('Error creating self-assign customer record')
          showToast.error('שגיאה ביצירת רשומת לקוח')
          setSaving(false)
          return
        }
        customerId = newCustomer.id
        customerName = barberName
        customerPhone = barberPhone
      } else {
        const phoneToUse = walkinPhone.trim() || 'walkin-' + Date.now()
        const newCustomer = await getOrCreateCustomer(phoneToUse, walkinName.trim())
        if (!newCustomer) {
          console.error('Error creating walkin customer')
          showToast.error('שגיאה ביצירת לקוח')
          setSaving(false)
          return
        }
        customerId = newCustomer.id
        customerName = walkinName.trim()
        customerPhone = newCustomer.phone
      }

      const dayName = getDayKeyInIsrael(finalTime)
      const dateTimestamp = getIsraelDayStart(finalTime)

      let finalNotes = barberNotes.trim()
      if (isOutOfHours) {
        const oohNote = 'תור מחוץ לשעות העבודה הרגילות'
        finalNotes = finalNotes ? `${oohNote} | ${finalNotes}` : oohNote
      }
      if (isPastDate) {
        const pastNote = 'תור ידני - הוזן בדיעבד'
        finalNotes = finalNotes ? `${pastNote} | ${finalNotes}` : pastNote
      }

      if (isPastDate) {
        const response = await fetch('/api/barber/reservations/create-past', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barberId, serviceId: selectedService.id, customerId, customerName, customerPhone,
            dateTimestamp, timeTimestamp: finalTime, dayName, dayNum: format(selectedDate, 'dd/MM'),
            barberNotes: finalNotes || null,
          }),
        })
        const result = await response.json()
        if (!response.ok || !result.success) {
          console.error('Error creating past reservation:', result)
          showToast.error(result.message || 'שגיאה ביצירת התור')
          if (result.error === 'SLOT_ALREADY_TAKEN') { await fetchReservedSlots(); setSelectedTime(null) }
          return
        }
        showToast.success('התור נרשם בהצלחה (הסתיים)')
      } else {
        let reservationId: string | undefined

        if (isOutOfHours) {
          const response = await fetch('/api/barber/reservations/create-manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              barberId, serviceId: selectedService.id, customerId, customerName, customerPhone,
              dateTimestamp, timeTimestamp: finalTime, dayName, dayNum: format(selectedDate, 'dd/MM'),
              barberNotes: finalNotes || null,
            }),
          })
          const result = await response.json()
          if (!response.ok || !result.success) {
            console.error('Error creating out-of-hours reservation:', result)
            showToast.error(result.message || 'שגיאה ביצירת התור')
            if (result.error === 'SLOT_ALREADY_TAKEN' || result.error === 'CUSTOMER_DOUBLE_BOOKING') await fetchReservedSlots()
            return
          }
          reservationId = result.reservationId
        } else {
          const result = await createReservation({
            barberId, serviceId: selectedService.id, customerId, customerName, customerPhone,
            dateTimestamp, timeTimestamp: finalTime, dayName, dayNum: format(selectedDate, 'dd/MM'),
            barberNotes: finalNotes || undefined,
          })
          if (!result.success) {
            console.error('Error creating reservation:', result.error)
            showToast.error(result.message || 'שגיאה ביצירת התור')
            if (result.error === 'SLOT_ALREADY_TAKEN' || result.error === 'CUSTOMER_DOUBLE_BOOKING') { await fetchReservedSlots(); setSelectedTime(null) }
            return
          }
          reservationId = result.reservationId
        }

        if (mode === 'existing' && selectedCustomer?.id && reservationId) {
          try {
            fetch('/api/push/notify-booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reservationId, customerId, customerName, barberId,
                barberName: barberName || 'הספר', serviceName: selectedService.name_he,
                appointmentTime: finalTime, isManualBooking: true,
              })
            }).then(res => res.json()).then(data => console.log('[ManualBooking] Push notification result:', data))
              .catch(err => console.error('[ManualBooking] Push notification error:', err))
          } catch (pushErr) {
            console.error('[ManualBooking] Failed to send push notification:', pushErr)
          }
        }

        showToast.success(isOutOfHours ? 'התור מחוץ לשעות נוצר בהצלחה!' : 'התור נוצר בהצלחה')
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error creating reservation:', err)
      showToast.error('שגיאה ביצירת התור')
    } finally {
      setSaving(false)
    }
  }

  // --- Helpers ---
  const handleDateScroll = (direction: 'right' | 'left') => {
    if (!dateScrollRef.current) return
    const scrollAmount = direction === 'left' ? -200 : 200
    dateScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  if (!isOpen) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
        <div
          className="relative w-full sm:max-w-lg sm:mx-4 bg-background-darker sm:bg-background-dark border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col animate-slide-in-up sm:animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="הוספת תור ידני"
        >
          {/* ───── Header ───── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-accent-gold/15 flex items-center justify-center flex-shrink-0">
                <Calendar size={18} className="text-accent-gold" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground-light truncate">תור ידני חדש</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {isPastDate && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-medium">
                      <CheckCircle size={9} />
                      הסתיים
                    </span>
                  )}
                  {isOutOfHours && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-medium">
                      <AlertTriangle size={9} />
                      מחוץ לשעות
                    </span>
                  )}
                  {!isPastDate && !isOutOfHours && (
                    <p className="text-foreground-muted text-[11px]">רישום תור על-ידי הספר</p>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              isIconOnly
              onPress={onClose}
              isDisabled={saving}
              className="min-w-[36px] w-9 h-9 rounded-xl hover:bg-white/5"
              aria-label="סגור"
            >
              <X size={18} className="text-foreground-muted" />
            </Button>
          </div>

          {/* ───── Scrollable Content ───── */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-5 py-4 space-y-5">

              {/* ══════ Section 1: Customer Mode ══════ */}
              <section>
                <div className="flex items-center rounded-xl bg-white/[0.03] p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setMode('existing')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all',
                      mode === 'existing' ? 'bg-accent-gold text-background-dark shadow-sm' : 'text-foreground-muted hover:text-foreground-light hover:bg-white/[0.04]'
                    )}
                    aria-label="לקוח קיים"
                    tabIndex={0}
                  >
                    <User size={14} />
                    לקוח קיים
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('new')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all',
                      mode === 'new' ? 'bg-accent-gold text-background-dark shadow-sm' : 'text-foreground-muted hover:text-foreground-light hover:bg-white/[0.04]'
                    )}
                    aria-label="לקוח חדש"
                    tabIndex={0}
                  >
                    <UserPlus size={14} />
                    לקוח חדש
                  </button>
                  {barberPhone && (
                    <button
                      type="button"
                      onClick={() => setMode('self')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all',
                        mode === 'self' ? 'bg-accent-gold text-background-dark shadow-sm' : 'text-foreground-muted hover:text-foreground-light hover:bg-white/[0.04]'
                      )}
                      aria-label="הקצאה עצמית"
                      tabIndex={0}
                    >
                      <UserCheck size={14} />
                      על שמי
                    </button>
                  )}
                </div>

                {/* Customer content by mode */}
                <div className="mt-3">
                  {mode === 'existing' && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted/50" />
                        <input
                          id="customer-search"
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="חפש לפי שם או טלפון..."
                          className="w-full py-2.5 px-3 pr-9 rounded-xl bg-background-card border border-white/10 text-sm text-foreground-light placeholder:text-foreground-muted/40 outline-none focus:ring-2 focus:ring-accent-gold/60 transition-shadow"
                          aria-label="חיפוש לקוח"
                        />
                        {searching && <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-gold animate-spin" />}
                      </div>

                      {searchResults.length > 0 && !selectedCustomer && (
                        <div className="bg-background-card border border-white/10 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                          {searchResults.map(customer => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => { setSelectedCustomer(customer); setSearchQuery(''); setSearchResults([]) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-right"
                              tabIndex={0}
                              aria-label={`בחר לקוח ${customer.fullname}`}
                            >
                              <div className="w-7 h-7 rounded-full bg-accent-gold/15 flex items-center justify-center flex-shrink-0">
                                <User size={12} className="text-accent-gold" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-foreground-light text-sm truncate">{customer.fullname}</p>
                                <p className="text-foreground-muted text-[11px]" dir="ltr">{customer.phone}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedCustomer && (
                        <div className="flex items-center gap-2.5 p-2.5 bg-accent-gold/10 border border-accent-gold/20 rounded-xl">
                          <div className="w-8 h-8 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                            <User size={13} className="text-accent-gold" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground-light text-sm font-medium">{selectedCustomer.fullname}</p>
                            <p className="text-foreground-muted text-[11px]" dir="ltr">{selectedCustomer.phone}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(null)}
                            className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                            aria-label="הסר לקוח"
                            tabIndex={0}
                          >
                            <X size={13} className="text-foreground-muted" />
                          </button>
                        </div>
                      )}

                      {!selectedCustomer && searchQuery.length === 0 && (
                        <p className="text-foreground-muted/50 text-[11px] text-center py-1">חפש לקוח לפי שם או מספר טלפון</p>
                      )}
                    </div>
                  )}

                  {mode === 'new' && (
                    <div className="space-y-2.5">
                      <div className="relative">
                        <User size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted/50" />
                        <input
                          id="walkin-name"
                          type="text"
                          value={walkinName}
                          onChange={(e) => setWalkinName(e.target.value)}
                          placeholder="שם הלקוח *"
                          className="w-full py-2.5 px-3 pr-9 rounded-xl bg-background-card border border-white/10 text-sm text-foreground-light placeholder:text-foreground-muted/40 outline-none focus:ring-2 focus:ring-accent-gold/60 transition-shadow"
                          aria-label="שם הלקוח"
                        />
                      </div>
                      <div className="relative">
                        <Phone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted/50" />
                        <input
                          id="walkin-phone"
                          type="tel"
                          value={walkinPhone}
                          onChange={(e) => setWalkinPhone(e.target.value)}
                          placeholder="טלפון (אופציונלי)"
                          dir="ltr"
                          className="w-full py-2.5 px-3 pr-9 rounded-xl bg-background-card border border-white/10 text-sm text-foreground-light placeholder:text-foreground-muted/40 outline-none focus:ring-2 focus:ring-accent-gold/60 transition-shadow"
                          aria-label="טלפון הלקוח"
                        />
                      </div>
                      <p className="text-foreground-muted/50 text-[10px] flex items-center gap-1">
                        <AlertTriangle size={10} />
                        לקוח חדש לא יקבל התראות או תזכורות
                      </p>
                    </div>
                  )}

                  {mode === 'self' && (
                    <div className="flex items-center gap-3 p-3 bg-accent-gold/10 border border-accent-gold/20 rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                        <UserCheck size={16} className="text-accent-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground-light text-sm font-medium">{barberName}</p>
                        <p className="text-foreground-muted text-[11px]" dir="ltr">{barberPhone}</p>
                        <p className="text-accent-gold/60 text-[10px] mt-0.5">התור יירשם על שמך</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* ══════ Section 2: Service ══════ */}
              <section>
                <label className="text-foreground-light text-xs font-medium flex items-center gap-1.5 mb-2">
                  <Scissors size={13} className="text-accent-gold" />
                  שירות
                </label>
                {loadingServices ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 size={16} className="text-accent-gold animate-spin" />
                    <span className="text-foreground-muted text-xs mr-2">טוען...</span>
                  </div>
                ) : services.length === 0 ? (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-xs text-center">לא נמצאו שירותים. יש להוסיף שירותים בהגדרות.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {services.map(service => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setSelectedService(service)}
                        className={cn(
                          'px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5',
                          selectedService?.id === service.id
                            ? 'bg-accent-gold text-background-dark shadow-sm'
                            : 'bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08] border border-white/[0.06]'
                        )}
                        tabIndex={0}
                        aria-label={`${service.name_he} - ${formatPrice(service.price)}`}
                      >
                        {service.name_he}
                        <span className={cn(
                          'text-[10px] opacity-70',
                          selectedService?.id === service.id ? 'text-background-dark/70' : ''
                        )}>
                          {formatPrice(service.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* ══════ Section 3: Date ══════ */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-foreground-light text-xs font-medium flex items-center gap-1.5">
                    <Calendar size={13} className="text-accent-gold" />
                    תאריך
                  </label>
                  <input
                    type="date"
                    aria-label="בחר תאריך מותאם"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value + 'T12:00:00') : israelNow
                      setSelectedDate(date)
                    }}
                    className="w-8 h-7 opacity-0 absolute"
                    id="date-custom-picker"
                  />
                  <label
                    htmlFor="date-custom-picker"
                    className="text-foreground-muted text-[11px] hover:text-foreground-light cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <Calendar size={11} />
                    תאריך אחר
                  </label>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => handleDateScroll('right')}
                    className="absolute left-0 top-0 bottom-0 w-7 z-10 bg-gradient-to-r from-background-darker/90 sm:from-background-dark/90 to-transparent flex items-center justify-center"
                    aria-label="גלול תאריכים שמאלה"
                    tabIndex={-1}
                  >
                    <ChevronLeft size={14} className="text-foreground-muted" />
                  </button>
                  <div ref={dateScrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide px-1 py-0.5" style={{ scrollbarWidth: 'none' }}>
                    {dateChips.map((chip, i) => {
                      const isSelected = isSameDay(selectedDate, chip.date)
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedDate(chip.date)}
                          className={cn(
                            'flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-center transition-all min-w-[60px]',
                            isSelected
                              ? chip.isPast
                                ? 'bg-blue-500 text-white shadow-sm'
                                : 'bg-accent-gold text-background-dark shadow-sm'
                              : 'bg-white/[0.04] text-foreground-muted hover:bg-white/[0.08] border border-white/[0.04]'
                          )}
                          tabIndex={0}
                          aria-label={`${chip.label} ${chip.sublabel}`}
                        >
                          <span className="text-[11px] font-medium leading-tight">{chip.label}</span>
                          <span className={cn('text-[10px] leading-tight mt-0.5', isSelected ? 'opacity-80' : 'opacity-50')}>{chip.sublabel}</span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDateScroll('left')}
                    className="absolute right-0 top-0 bottom-0 w-7 z-10 bg-gradient-to-l from-background-darker/90 sm:from-background-dark/90 to-transparent flex items-center justify-center"
                    aria-label="גלול תאריכים ימינה"
                    tabIndex={-1}
                  >
                    <ChevronRight size={14} className="text-foreground-muted" />
                  </button>
                </div>

                {isPastDate && (
                  <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/15">
                    <CheckCircle size={12} className="text-blue-400 shrink-0" />
                    <p className="text-blue-300 text-[10px]">תור בתאריך עבר &ndash; יירשם כ&quot;הסתיים&quot;</p>
                  </div>
                )}
              </section>

              {/* ══════ Section 4: Time ══════ */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-foreground-light text-xs font-medium flex items-center gap-1.5">
                    <Clock size={13} className="text-accent-gold" />
                    שעה
                    {!isOutOfHours && currentDayWorkHours.isWorking && (
                      <span className="text-foreground-muted/50 font-normal mr-1">
                        ({currentDayWorkHours.start}-{currentDayWorkHours.end})
                      </span>
                    )}
                  </label>

                  {/* Legend */}
                  {!isOutOfHours && allSlotsWithStatus.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[9px] text-foreground-muted/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
                        פנוי
                      </span>
                      {allSlotsWithStatus.some(s => s.status === 'reserved') && (
                        <span className="flex items-center gap-1 text-[9px] text-foreground-muted/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                          תפוס
                        </span>
                      )}
                      {allSlotsWithStatus.some(s => s.status === 'breakout') && (
                        <span className="flex items-center gap-1 text-[9px] text-foreground-muted/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60" />
                          הפסקה
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Time grid */}
                {!isOutOfHours && (
                  <>
                    {loadingSlots ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 size={18} className="text-accent-gold animate-spin" />
                      </div>
                    ) : dateClosureReason ? (
                      <div className="text-center py-3">
                        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/15 mb-2">
                          <p className="text-red-400 text-xs">{dateClosureReason}</p>
                        </div>
                      </div>
                    ) : allSlotsWithStatus.length === 0 ? (
                      <div className="text-center py-3">
                        <p className="text-foreground-muted/60 text-xs">אין משבצות זמינות ביום זה</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1.5 max-h-[200px] overflow-y-auto pb-1">
                        {allSlotsWithStatus.map(slot => {
                          const isUnavailable = slot.status !== 'available'
                          const isSelected = selectedTime === slot.timestamp && !isUnavailable
                          return (
                            <button
                              key={slot.timestamp}
                              type="button"
                              onClick={() => { if (!isUnavailable) setSelectedTime(slot.timestamp) }}
                              disabled={isUnavailable}
                              title={isUnavailable ? `${slot.time} - ${slot.reason}` : slot.time}
                              className={cn(
                                'py-2.5 rounded-xl text-sm font-medium tabular-nums transition-all relative',
                                isSelected
                                  ? 'bg-accent-gold text-background-dark shadow-md ring-2 ring-accent-gold/30'
                                  : slot.status === 'reserved'
                                    ? 'bg-red-500/8 text-red-400/40 border border-red-500/10 cursor-not-allowed line-through'
                                    : slot.status === 'breakout'
                                      ? 'bg-orange-500/8 text-orange-400/40 border border-orange-500/10 cursor-not-allowed line-through'
                                      : slot.status === 'past'
                                        ? 'bg-white/[0.02] text-foreground-muted/20 cursor-not-allowed'
                                        : 'bg-white/[0.05] text-foreground-light border border-white/[0.06] hover:bg-accent-gold/10 hover:border-accent-gold/20 hover:text-accent-gold active:scale-95'
                              )}
                              aria-label={isUnavailable ? `${slot.time} - ${slot.reason}` : `בחר שעה ${slot.time}`}
                              tabIndex={isUnavailable ? -1 : 0}
                            >
                              {slot.time}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Custom time picker (out-of-hours) */}
                {isOutOfHours && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-orange-500/8 border border-orange-500/15">
                      <div className="flex gap-2 items-start">
                        <AlertTriangle size={14} className="text-orange-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-orange-300/80">
                          <span className="font-medium text-orange-300">שעות העבודה: {currentDayWorkHours.start} - {currentDayWorkHours.end}</span>
                          {!currentDayWorkHours.isWorking && (
                            <span className="block text-red-400 mt-0.5">יום זה מוגדר כיום חופש</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div dir="ltr" className="flex items-center gap-3 justify-center py-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-foreground-muted/50 text-[10px]">שעה</span>
                        <select
                          value={customHour}
                          onChange={(e) => setCustomHour(e.target.value)}
                          className="w-[72px] py-2.5 rounded-xl bg-background-card border border-orange-500/20 text-foreground-light text-center text-lg font-semibold tabular-nums outline-none focus:ring-2 focus:ring-orange-500/40 appearance-none"
                          aria-label="בחר שעה"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-foreground-light text-2xl font-bold mt-4">:</span>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-foreground-muted/50 text-[10px]">דקות</span>
                        <select
                          value={customMinute}
                          onChange={(e) => setCustomMinute(e.target.value)}
                          className="w-[72px] py-2.5 rounded-xl bg-background-card border border-orange-500/20 text-foreground-light text-center text-lg font-semibold tabular-nums outline-none focus:ring-2 focus:ring-orange-500/40 appearance-none"
                          aria-label="בחר דקות"
                        >
                          {['00', '15', '30', '45'].map(min => (
                            <option key={min} value={min}>{min}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isCustomTimeReserved && (
                      <p className="text-center text-red-400 text-xs font-medium">השעה {customHour}:{customMinute} כבר תפוסה</p>
                    )}
                  </div>
                )}

                {/* Out-of-hours toggle card */}
                {!isPastDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOutOfHours(!isOutOfHours)
                      if (!isOutOfHours) setSelectedTime(null)
                    }}
                    className={cn(
                      'w-full mt-2.5 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all text-right',
                      isOutOfHours
                        ? 'bg-orange-500/15 border border-orange-500/25 text-orange-400'
                        : 'bg-white/[0.03] border border-white/[0.06] text-foreground-muted hover:bg-white/[0.06]'
                    )}
                    aria-label="תור מחוץ לשעות העבודה"
                    tabIndex={0}
                  >
                    <Clock size={15} className={isOutOfHours ? 'text-orange-400' : 'text-foreground-muted/50'} />
                    <div className="flex-1">
                      <p className="font-medium">{isOutOfHours ? 'שעה מותאמת אישית פעילה' : 'שעה מותאמת אישית'}</p>
                      <p className={cn('text-[10px] mt-0.5', isOutOfHours ? 'text-orange-400/60' : 'text-foreground-muted/40')}>
                        קביעת תור מחוץ לשעות העבודה הרגילות
                      </p>
                    </div>
                    <div className={cn(
                      'w-9 h-5 rounded-full transition-all flex items-center px-0.5',
                      isOutOfHours ? 'bg-orange-500 justify-start' : 'bg-white/10 justify-end'
                    )}>
                      <div className={cn('w-4 h-4 rounded-full transition-all', isOutOfHours ? 'bg-white' : 'bg-white/30')} />
                    </div>
                  </button>
                )}
              </section>

              {/* ══════ Section 5: Notes (collapsible) ══════ */}
              <section>
                <button
                  type="button"
                  onClick={() => setShowNotes(!showNotes)}
                  className="flex items-center gap-1.5 text-foreground-muted text-xs hover:text-foreground-light transition-colors"
                  tabIndex={0}
                  aria-expanded={showNotes}
                  aria-label="הערות לתור"
                >
                  <FileText size={13} />
                  <span>הערות לתור</span>
                  <span className="text-[10px] text-foreground-muted/40">(אופציונלי)</span>
                  {barberNotes.trim() && <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />}
                </button>
                {showNotes && (
                  <textarea
                    id="barber-notes"
                    value={barberNotes}
                    onChange={(e) => setBarberNotes(e.target.value)}
                    placeholder="הערות פנימיות - נראה רק לך"
                    rows={2}
                    className="w-full mt-2 p-2.5 rounded-xl bg-background-card border border-white/10 text-sm text-foreground-light placeholder:text-foreground-muted/40 outline-none focus:ring-2 focus:ring-accent-gold/60 resize-none transition-shadow"
                    aria-label="הערות לתור"
                  />
                )}
              </section>
            </div>
          </div>

          {/* ───── Footer: Summary + Submit ───── */}
          <div className="border-t border-white/5 flex-shrink-0 bg-background-darker sm:bg-background-dark px-5 py-3.5">
            {/* Summary row */}
            {(customerLabel || selectedService || summaryTime) && (
              <div className="flex items-center gap-2 mb-3 text-[11px] text-foreground-muted/70 flex-wrap">
                {customerLabel && (
                  <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded-lg">
                    <User size={10} />
                    {customerLabel}
                  </span>
                )}
                {selectedService && (
                  <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded-lg">
                    <Scissors size={10} />
                    {selectedService.name_he}
                  </span>
                )}
                {summaryTime && (
                  <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded-lg tabular-nums">
                    <Clock size={10} />
                    {summaryTime}
                  </span>
                )}
                {isPastDate && (
                  <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg">
                    <CheckCircle size={10} />
                    הסתיים
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-2.5">
              <Button
                onPress={handleSubmit}
                isDisabled={!canSubmit}
                className={cn(
                  'flex-1 py-3 rounded-xl font-medium text-sm',
                  !canSubmit
                    ? 'bg-foreground-muted/20 text-foreground-muted/40'
                    : isPastDate
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : isOutOfHours
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
                )}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={15} className="animate-spin" />
                    שומר...
                  </span>
                ) : isPastDate ? (
                  'רשום תור (הסתיים)'
                ) : isOutOfHours ? (
                  'צור תור מחוץ לשעות'
                ) : (
                  'צור תור'
                )}
              </Button>
              <Button
                variant="ghost"
                onPress={onClose}
                isDisabled={saving}
                className="px-5 py-3 rounded-xl text-sm font-medium border border-white/10 text-foreground-muted hover:bg-white/5"
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
