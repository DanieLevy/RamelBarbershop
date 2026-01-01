'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Search, User, Calendar, Clock, UserPlus } from 'lucide-react'
import { cn, generateTimeSlots, parseTimeString, nowInIsrael, getIsraelDayStart, getIsraelDayEnd, getDayKeyInIsrael } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, isSameDay } from 'date-fns'
import { toast } from 'sonner'
import type { Customer, BarbershopSettings, Service } from '@/types/database'

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
  // barberName - available for future use
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
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  
  // Data loading
  const [services, setServices] = useState<Service[]>([])
  const [reservedSlots, setReservedSlots] = useState<number[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const israelNow = nowInIsrael()

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('existing')
      setSelectedDate(preselectedDate || israelNow)
      setSelectedTime(preselectedTime || null)
      setSelectedCustomer(null)
      setSelectedService(null)
      setWalkinName('')
      setSearchQuery('')
      setSearchResults([])
      fetchServices()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preselectedDate, preselectedTime])

  // Fetch available time slots when date changes
  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchReservedSlots()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedDate])

  const fetchServices = async () => {
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

  // Generate available time slots
  const availableSlots = useMemo(() => {
    const workStart = shopSettings?.work_hours_start || '09:00'
    const workEnd = shopSettings?.work_hours_end || '19:00'
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
  }, [selectedDate, shopSettings, reservedSlots, israelNow])

  const handleSubmit = async () => {
    // Validation
    if (!selectedTime) {
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
    
    setSaving(true)
    
    try {
      const supabase = createClient()
      
      // Pre-check: Verify slot is still available (race condition prevention)
      const { data: existingSlot } = await supabase
        .from('reservations')
        .select('id')
        .eq('barber_id', barberId)
        .eq('time_timestamp', selectedTime)
        .eq('status', 'confirmed')
        .maybeSingle()
      
      if (existingSlot) {
        toast.error('השעה כבר נתפסה. אנא בחר שעה אחרת.')
        // Refresh available slots
        await fetchReservedSlots()
        setSelectedTime(null)
        setSaving(false)
        return
      }
      
      let customerId: string
      let customerName: string
      let customerPhone: string
      
      if (mode === 'existing') {
        customerId = selectedCustomer!.id
        customerName = selectedCustomer!.fullname
        customerPhone = selectedCustomer!.phone
      } else {
        // Create a walkin customer record (no role field - customers table doesn't have it)
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            fullname: walkinName.trim(),
            phone: 'walkin-' + Date.now(), // Unique placeholder phone
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
        customerPhone = ''
      }
      
      // Calculate date-related fields - USING ISRAEL TIMEZONE
      const dayName = getDayKeyInIsrael(selectedTime)
      const dateTimestamp = getIsraelDayStart(selectedTime)
      
      const reservationData = {
        barber_id: barberId,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        service_id: selectedService.id,
        time_timestamp: selectedTime,
        date_timestamp: dateTimestamp,
        day_name: dayName,
        day_num: format(selectedDate, 'dd/MM'),
        status: 'confirmed' as const,
      }
      
      const { error } = await supabase
        .from('reservations')
        .insert(reservationData)
      
      if (error) {
        console.error('Error creating reservation:', error)
        // Handle unique constraint violation specifically
        if (error.code === '23505') {
          toast.error('השעה כבר נתפסה. אנא בחר שעה אחרת.')
          await fetchReservedSlots()
          setSelectedTime(null)
        } else {
          toast.error('שגיאה ביצירת התור')
        }
        return
      }
      
      toast.success('התור נוצר בהצלחה')
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
      <div className="relative w-full sm:max-w-lg sm:mx-4 bg-background-darker sm:bg-background-dark border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-in-up sm:animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-foreground-light">הוספת תור ידני</h3>
            <p className="text-foreground-muted text-xs mt-0.5">רישום תור על-ידי הספר</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
            aria-label="סגור"
          >
            <X size={20} className="text-foreground-muted" />
          </button>
        </div>

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
                    className="p-1 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={14} className="text-foreground-muted" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="walkin-name" className="text-foreground-light text-sm">שם הלקוח</label>
              <input
                id="walkin-name"
                type="text"
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                placeholder="הזן שם הלקוח"
                className="w-full p-3 rounded-xl bg-background-card border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold"
              />
            </div>
          )}

          {/* Service Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm">שירות</label>
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
            <label className="text-foreground-light text-sm flex items-center gap-2">
              <Clock size={14} className="text-accent-gold" />
              שעה
            </label>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={20} className="text-accent-gold animate-spin" />
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-foreground-muted text-sm text-center py-4">
                אין משבצות פנויות ביום זה
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
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
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={cn(
              'flex-1 py-3 rounded-xl font-medium transition-all text-center',
              saving
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
