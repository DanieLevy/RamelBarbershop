'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Search, User, Calendar, Clock, UserPlus, Scissors, AlertTriangle } from 'lucide-react'
import { cn, generateTimeSlots, parseTimeString, nowInIsrael, getIsraelDayStart, getIsraelDayEnd, getDayKeyInIsrael } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { createReservation } from '@/lib/services/booking.service'
import { format, addDays, isSameDay } from 'date-fns'
import { toast } from 'sonner'
import type { Customer, BarbershopSettings, Service, WorkDay } from '@/types/database'

interface ManualBookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  barberId: string
  barberName?: string
  shopSettings: BarbershopSettings | null
  preselectedDate?: Date | null
  preselectedTime?: number | null
}

type BookingMode = 'existing' | 'walkin'

export function ManualBookingModal({
  isOpen,
  onClose,
  onSuccess,
  barberId,
  barberName,
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
  
  // Out-of-hours booking state
  const [isOutOfHours, setIsOutOfHours] = useState(false)
  const [customHour, setCustomHour] = useState('')
  const [customMinute, setCustomMinute] = useState('00')
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  
  // Data loading
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [reservedSlots, setReservedSlots] = useState<number[]>([])
  const [barberWorkDays, setBarberWorkDays] = useState<WorkDay[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const israelNow = nowInIsrael()

  // Get the barber's work hours for the currently selected date
  const currentDayWorkHours = useMemo(() => {
    const dayKey = getDayKeyInIsrael(selectedDate.getTime())
    const barberDaySettings = barberWorkDays.find(wd => wd.day_of_week === dayKey)
    
    // Default work hours from shop settings
    const defaultStart = shopSettings?.work_hours_start || '09:00'
    const defaultEnd = shopSettings?.work_hours_end || '19:00'
    
    if (barberDaySettings && barberDaySettings.is_working && barberDaySettings.start_time && barberDaySettings.end_time) {
      return {
        start: barberDaySettings.start_time,
        end: barberDaySettings.end_time,
        isWorking: true,
        dayName: dayKey
      }
    } else if (barberDaySettings && !barberDaySettings.is_working) {
      return {
        start: defaultStart,
        end: defaultEnd,
        isWorking: false,
        dayName: dayKey
      }
    }
    
    return {
      start: defaultStart,
      end: defaultEnd,
      isWorking: true,
      dayName: dayKey
    }
  }, [selectedDate, barberWorkDays, shopSettings])
  
  // Calculate smart default time for out-of-hours (30 min after work ends)
  const getSmartOutOfHoursDefault = () => {
    const { hour: endHour, minute: endMinute } = parseTimeString(currentDayWorkHours.end)
    
    // Default to 30 minutes after work ends
    let defaultHour = endHour
    let defaultMinute = endMinute + 30
    
    if (defaultMinute >= 60) {
      defaultMinute = defaultMinute - 60
      defaultHour = defaultHour + 1
    }
    
    // Cap at 23:00 max
    if (defaultHour > 23) {
      defaultHour = 23
      defaultMinute = 0
    }
    
    return {
      hour: defaultHour.toString().padStart(2, '0'),
      minute: defaultMinute < 15 ? '00' : defaultMinute < 30 ? '15' : defaultMinute < 45 ? '30' : '45'
    }
  }

  // Reset state when modal opens
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
      setSearchQuery('')
      setSearchResults([])
      setIsOutOfHours(false)
      // Will be set dynamically when out-of-hours is enabled
      setCustomHour('')
      setCustomMinute('00')
      fetchServices()
      fetchBarberWorkDays()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preselectedDate, preselectedTime])
  
  // Set smart defaults when out-of-hours is enabled or date changes
  useEffect(() => {
    if (isOutOfHours && barberWorkDays.length > 0) {
      const defaults = getSmartOutOfHoursDefault()
      setCustomHour(defaults.hour)
      setCustomMinute(defaults.minute)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOutOfHours, selectedDate, barberWorkDays])

  // Fetch available time slots when date changes
  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchReservedSlots()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedDate])

  const fetchBarberWorkDays = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('work_days')
      .select('*')
      .eq('user_id', barberId)
    
    if (data) {
      setBarberWorkDays(data as WorkDay[])
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
    
    if (data) {
      setServices(data as Service[])
      if (data.length > 0) {
        setSelectedService(data[0] as Service)
      }
    }
    setLoadingServices(false)
  }

  const fetchReservedSlots = async () => {
    setLoadingSlots(true)
    const supabase = createClient()
    
    // Use Israel timezone for day boundaries
    const dayStartMs = getIsraelDayStart(selectedDate)
    const dayEndMs = getIsraelDayEnd(selectedDate)
    
    const { data } = await supabase
      .from('reservations')
      .select('time_timestamp')
      .eq('barber_id', barberId)
      .eq('status', 'confirmed')
      .gte('time_timestamp', dayStartMs)
      .lte('time_timestamp', dayEndMs)
    
    if (data) {
      setReservedSlots(data.map(r => r.time_timestamp))
    }
    setLoadingSlots(false)
  }

  // Debounced search for customers
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    
    const timer = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      
      const { data } = await supabase
        .from('customers')
        .select('*')
        .or(`fullname.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10)
      
      if (data) {
        setSearchResults(data as Customer[])
      }
      setSearching(false)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Compute custom time timestamp for out-of-hours booking
  const customTimeTimestamp = useMemo(() => {
    if (!isOutOfHours) return null
    
    const hour = parseInt(customHour, 10)
    const minute = parseInt(customMinute, 10)
    
    if (isNaN(hour) || isNaN(minute)) return null
    
    // Create timestamp for the selected date with custom time
    const date = new Date(selectedDate)
    date.setHours(hour, minute, 0, 0)
    
    return date.getTime()
  }, [isOutOfHours, selectedDate, customHour, customMinute])
  
  // Check if custom time slot is already reserved
  const isCustomTimeReserved = useMemo(() => {
    if (!customTimeTimestamp) return false
    return reservedSlots.some(reserved => Math.abs(reserved - customTimeTimestamp) < 60000)
  }, [customTimeTimestamp, reservedSlots])

  // Generate available time slots using barber's day-specific hours
  const availableSlots = useMemo(() => {
    // Get the day of week for the selected date
    const dayKey = getDayKeyInIsrael(selectedDate.getTime())
    
    // Find the barber's work day settings for this specific day
    const barberDaySettings = barberWorkDays.find(wd => wd.day_of_week === dayKey)
    
    // Determine work hours: priority is barber day-specific > shop settings
    let workStart: string
    let workEnd: string
    
    if (barberDaySettings && barberDaySettings.is_working && barberDaySettings.start_time && barberDaySettings.end_time) {
      // Use barber's day-specific hours
      workStart = barberDaySettings.start_time
      workEnd = barberDaySettings.end_time
    } else if (barberDaySettings && !barberDaySettings.is_working) {
      // Barber doesn't work on this day - return empty slots
      return []
    } else {
      // Fall back to shop settings
      workStart = shopSettings?.work_hours_start || '09:00'
      workEnd = shopSettings?.work_hours_end || '19:00'
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
    
    // Filter out reserved and past slots
    const now = Date.now()
    return allSlots.filter(slot => {
      // Skip past slots for today
      if (isSameDay(selectedDate, israelNow) && slot.timestamp < now) {
        return false
      }
      // Skip reserved slots
      return !reservedSlots.some(reserved => 
        Math.abs(reserved - slot.timestamp) < 60000
      )
    })
  }, [selectedDate, shopSettings, reservedSlots, israelNow, barberWorkDays])

  const handleSubmit = async () => {
    // Determine the final time to use
    const finalTime = isOutOfHours ? customTimeTimestamp : selectedTime
    
    // Validation
    if (!finalTime) {
      toast.error('נא לבחור שעה')
      return
    }
    if (!selectedService) {
      toast.error('נא לבחור שירות')
      return
    }
    if (mode === 'existing' && !selectedCustomer) {
      toast.error('נא לבחור לקוח')
      return
    }
    if (mode === 'walkin' && !walkinName.trim()) {
      toast.error('נא להזין שם הלקוח')
      return
    }
    
    // Out-of-hours specific validations
    if (isOutOfHours) {
      if (isCustomTimeReserved) {
        toast.error('השעה כבר תפוסה')
        return
      }
      // Validate time is not in the past for today
      if (isSameDay(selectedDate, israelNow) && finalTime < Date.now()) {
        toast.error('לא ניתן לקבוע תור בשעה שעברה')
        return
      }
    }
    
    setSaving(true)
    
    try {
      const supabase = createClient()
      
      // Note: Slot availability is verified atomically by the createReservation function
      // No pre-check needed - the atomic database function handles race conditions
      
      let customerId: string
      let customerName: string
      let customerPhone: string
      
      if (mode === 'existing') {
        customerId = selectedCustomer!.id
        customerName = selectedCustomer!.fullname
        customerPhone = selectedCustomer!.phone
      } else {
        // Create a walkin customer record
        // Use provided phone if available, otherwise generate a placeholder
        const phoneToUse = walkinPhone.trim() || 'walkin-' + Date.now()
        
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            fullname: walkinName.trim(),
            phone: phoneToUse,
          })
          .select()
          .single()
        
        if (customerError || !newCustomer) {
          console.error('Error creating walkin customer:', customerError)
          toast.error('שגיאה ביצירת לקוח')
          setSaving(false)
          return
        }
        
        customerId = newCustomer.id
        customerName = walkinName.trim()
        customerPhone = walkinPhone.trim()
      }
      
      // Calculate date-related fields - USING ISRAEL TIMEZONE
      const dayName = getDayKeyInIsrael(finalTime)
      const dateTimestamp = getIsraelDayStart(finalTime)
      
      // Add note for out-of-hours bookings
      let finalNotes = barberNotes.trim()
      if (isOutOfHours) {
        const oohNote = 'תור מחוץ לשעות העבודה הרגילות'
        finalNotes = finalNotes ? `${oohNote} | ${finalNotes}` : oohNote
      }
      
      // Use atomic function for race-condition-safe booking
      // barber_notes is now included in the atomic operation
      const result = await createReservation({
        barberId,
        serviceId: selectedService.id,
        customerId,
        customerName,
        customerPhone,
        dateTimestamp,
        timeTimestamp: finalTime,
        dayName,
        dayNum: format(selectedDate, 'dd/MM'),
        barberNotes: finalNotes || undefined,
      })
      
      if (!result.success) {
        console.error('Error creating reservation:', result.error)
        toast.error(result.message || 'שגיאה ביצירת התור')
        
        // Refresh available slots if slot was taken
        if (result.error === 'SLOT_ALREADY_TAKEN' || result.error === 'CUSTOMER_DOUBLE_BOOKING') {
          await fetchReservedSlots()
          setSelectedTime(null)
        }
        return
      }
      
      // Send push notification to the customer (for existing customers only)
      if (mode === 'existing' && selectedCustomer?.id) {
        try {
          console.log('[ManualBooking] Sending push notification to customer:', customerId)
          fetch('/api/push/notify-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reservationId: result.reservationId,
              customerId: customerId,
              barberId: barberId,
              barberName: barberName || 'הספר',
              serviceName: selectedService.name_he,
              appointmentTime: finalTime,
              isManualBooking: true,
            })
          })
            .then(res => res.json())
            .then(data => console.log('[ManualBooking] Push notification result:', data))
            .catch(err => console.error('[ManualBooking] Push notification error:', err))
        } catch (pushErr) {
          console.error('[ManualBooking] Failed to send push notification:', pushErr)
          // Don't fail the booking if push fails
        }
      }
      
      toast.success(isOutOfHours 
        ? 'התור מחוץ לשעות נוצר בהצלחה!' 
        : 'התור נוצר בהצלחה'
      )
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error creating reservation:', err)
      toast.error('שגיאה ביצירת התור')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full sm:max-w-lg sm:mx-4 bg-background-darker sm:bg-background-dark border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col animate-slide-in-up sm:animate-fade-in">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-white/5 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-foreground-light">הוספת תור ידני</h3>
                {isOutOfHours && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] font-medium animate-pulse">
                    <AlertTriangle size={10} />
                    מחוץ לשעות
                  </span>
                )}
              </div>
              <p className="text-foreground-muted text-xs mt-0.5">
                {isOutOfHours 
                  ? `שעות העבודה: ${currentDayWorkHours.start} - ${currentDayWorkHours.end}` 
                  : 'רישום תור על-ידי הספר'
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center"
            aria-label="סגור"
          >
            <X size={20} className="text-foreground-muted" />
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 pt-4">

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4 p-1 bg-white/[0.03] rounded-xl">
          <button
            onClick={() => setMode('existing')}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
              mode === 'existing'
                ? 'bg-accent-gold text-background-dark'
                : 'text-foreground-muted hover:text-foreground-light'
            )}
          >
            <User size={16} />
            לקוח קיים
          </button>
          <button
            onClick={() => setMode('walkin')}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
              mode === 'walkin'
                ? 'bg-accent-gold text-background-dark'
                : 'text-foreground-muted hover:text-foreground-light'
            )}
          >
            <UserPlus size={16} />
            לקוח חדש
          </button>
        </div>
        
        {/* Mode Info */}
        <div className={cn(
          'mb-4 p-3 rounded-xl text-xs',
          mode === 'existing' 
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
        )}>
          {mode === 'existing' ? (
            <p>לקוח קיים יקבל התראות ותזכורות לתור.</p>
          ) : (
            <p>לקוח חדש ללא רישום במערכת - לא יקבל התראות או תזכורות. מתאים ללקוחות שהגיעו ישירות למספרה.</p>
          )}
        </div>

        <div className="space-y-4">
          {/* Customer Selection / Walk-in Name */}
          {mode === 'existing' ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="customer-search" className="text-foreground-light text-sm">חיפוש לקוח</label>
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                <input
                  id="customer-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חפש לפי שם או טלפון..."
                  className="w-full p-3 pr-10 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold"
                />
                {searching && (
                  <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-gold animate-spin" />
                )}
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-2 bg-background-card border border-white/10 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {searchResults.map(customer => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setSearchQuery('')
                        setSearchResults([])
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-right"
                    >
                      <div className="w-8 h-8 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-accent-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground-light text-sm truncate">{customer.fullname}</p>
                        <p className="text-foreground-muted text-xs" dir="ltr">{customer.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Selected Customer */}
              {selectedCustomer && (
                <div className="flex items-center gap-3 p-3 bg-accent-gold/10 border border-accent-gold/20 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-accent-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground-light text-sm">{selectedCustomer.fullname}</p>
                    <p className="text-foreground-muted text-xs" dir="ltr">{selectedCustomer.phone}</p>
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="p-1 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <X size={14} className="text-foreground-muted" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Walk-in Name */}
              <div className="flex flex-col gap-2">
                <label htmlFor="walkin-name" className="text-foreground-light text-sm">שם הלקוח *</label>
                <input
                  id="walkin-name"
                  type="text"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="הזן שם הלקוח"
                  className="w-full p-3 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold"
                />
              </div>
              
              {/* Walk-in Phone (optional) */}
              <div className="flex flex-col gap-2">
                <label htmlFor="walkin-phone" className="text-foreground-light text-sm">טלפון (אופציונלי)</label>
                <input
                  id="walkin-phone"
                  type="tel"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  placeholder="לדוגמה: 050-1234567"
                  dir="ltr"
                  className="w-full p-3 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold"
                />
              </div>
              
              {/* Barber Notes (optional) */}
              <div className="flex flex-col gap-2">
                <label htmlFor="barber-notes" className="text-foreground-light text-sm">הערות (אופציונלי)</label>
                <textarea
                  id="barber-notes"
                  value={barberNotes}
                  onChange={(e) => setBarberNotes(e.target.value)}
                  placeholder="הערות לתור - נראה רק לספר"
                  rows={2}
                  className="w-full p-3 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold resize-none"
                />
              </div>
            </div>
          )}

          {/* Service Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm flex items-center gap-2">
              <Scissors size={14} className="text-accent-gold" />
              שירות
            </label>
            {loadingServices ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 size={18} className="text-accent-gold animate-spin" />
                <span className="text-foreground-muted text-sm mr-2">טוען שירותים...</span>
              </div>
            ) : services.length === 0 ? (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm text-center">
                  לא נמצאו שירותים עבור ספר זה. יש להוסיף שירותים בהגדרות.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {services.map(service => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm transition-all',
                      selectedService?.id === service.id
                        ? 'bg-accent-gold text-background-dark'
                        : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.1] border border-white/[0.08]'
                    )}
                  >
                    {service.name_he}
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
                }}
                min={format(israelNow, 'yyyy-MM-dd')}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-foreground-light text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
              />
            </div>
          </div>

          {/* Time Selection */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-foreground-light text-sm flex items-center gap-2">
                <Clock size={14} className="text-accent-gold" />
                שעה
              </label>
              
              {/* Out-of-Hours Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsOutOfHours(!isOutOfHours)
                  if (!isOutOfHours) {
                    setSelectedTime(null) // Clear regular time when switching to OOH
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                  isOutOfHours
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.1] border border-white/[0.08]'
                )}
              >
                <AlertTriangle size={12} />
                מחוץ לשעות
              </button>
            </div>
            
            {/* Out-of-Hours Custom Time Input */}
            {isOutOfHours ? (
              <div className="space-y-3">
                {/* Warning Banner */}
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <div className="flex gap-2">
                    <AlertTriangle size={16} className="text-orange-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-orange-300">
                      <p className="font-medium mb-1">תור מחוץ לשעות העבודה</p>
                      <p className="text-orange-300/80 mb-1.5">
                        שעות העבודה שלך ביום זה: <span className="font-semibold text-orange-300">{currentDayWorkHours.start} - {currentDayWorkHours.end}</span>
                        {!currentDayWorkHours.isWorking && (
                          <span className="block text-red-400 mt-1">שים לב: יום זה מוגדר כיום חופש!</span>
                        )}
                      </p>
                      <p className="text-orange-300/60">
                        רק אתה, כספר, יכול ליצור תורים מחוץ לשעות העבודה.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Custom Time Picker */}
                <div className="flex items-center gap-3 justify-center">
                  <div className="flex flex-col items-center">
                    <label className="text-foreground-muted text-xs mb-1">שעה</label>
                    <select
                      value={customHour}
                      onChange={(e) => setCustomHour(e.target.value)}
                      className="w-20 p-2.5 rounded-xl bg-background-card border border-white/10 text-foreground-light text-center text-lg font-medium outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-foreground-light text-2xl font-bold mt-5">:</span>
                  <div className="flex flex-col items-center">
                    <label className="text-foreground-muted text-xs mb-1">דקות</label>
                    <select
                      value={customMinute}
                      onChange={(e) => setCustomMinute(e.target.value)}
                      className="w-20 p-2.5 rounded-xl bg-background-card border border-white/10 text-foreground-light text-center text-lg font-medium outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      {['00', '15', '30', '45'].map(min => (
                        <option key={min} value={min}>{min}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Time Preview */}
                <div className="text-center">
                  <p className="text-foreground-muted text-xs">
                    התור ייקבע ל:
                  </p>
                  <p className={cn(
                    'text-lg font-bold tabular-nums mt-1',
                    isCustomTimeReserved ? 'text-red-400' : 'text-orange-400'
                  )}>
                    {customHour}:{customMinute}
                    {isCustomTimeReserved && (
                      <span className="text-xs text-red-400 mr-2">(תפוס!)</span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              /* Regular Time Slots */
              <>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={20} className="text-accent-gold animate-spin" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-foreground-muted text-sm mb-2">
                      אין משבצות פנויות ביום זה
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsOutOfHours(true)}
                      className="text-orange-400 text-xs underline hover:text-orange-300"
                    >
                      קבע תור מחוץ לשעות העבודה
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pb-2">
                    {availableSlots.map(slot => (
                      <button
                        key={slot.timestamp}
                        onClick={() => setSelectedTime(slot.timestamp)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-all tabular-nums',
                          selectedTime === slot.timestamp
                            ? 'bg-accent-gold text-background-dark'
                            : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.1] border border-white/[0.08]'
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        </div>

        {/* Actions - Sticky Footer */}
        <div className="flex gap-3 p-5 sm:p-6 pt-4 border-t border-white/5 flex-shrink-0 bg-background-darker sm:bg-background-dark">
          <button
            onClick={handleSubmit}
            disabled={saving || loadingServices || services.length === 0}
            className={cn(
              'flex-1 py-3 rounded-xl font-medium transition-all text-center',
              saving || loadingServices || services.length === 0
                ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
            )}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                שומר...
              </span>
            ) : (
              'צור תור'
            )}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-3 rounded-xl font-medium border border-white/20 text-foreground-light hover:bg-white/5 transition-colors text-center"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
