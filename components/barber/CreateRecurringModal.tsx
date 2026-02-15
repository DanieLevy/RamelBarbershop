'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Search, User, Clock, Scissors, Calendar, Repeat, AlertTriangle } from 'lucide-react'
import { cn, parseTimeString } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { 
  createRecurring, 
  checkRecurringConflict, 
  checkReservationConflicts,
  cancelConflictingReservations,
  type ConflictingReservation,
} from '@/lib/services/recurring.service'
import { RecurringConflictModal } from '@/components/barber/RecurringConflictModal'
import { showToast } from '@/lib/toast'
import type { Customer, Service, WorkDay, DayOfWeek, BarbershopSettings } from '@/types/database'
import { Portal } from '@/components/ui/Portal'
import { useBugReporter } from '@/hooks/useBugReporter'

interface CreateRecurringModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  barberId: string
}

const DAY_OPTIONS: Array<{ value: DayOfWeek; label: string }> = [
  { value: 'sunday', label: 'ראשון' },
  { value: 'monday', label: 'שני' },
  { value: 'tuesday', label: 'שלישי' },
  { value: 'wednesday', label: 'רביעי' },
  { value: 'thursday', label: 'חמישי' },
  { value: 'friday', label: 'שישי' },
  { value: 'saturday', label: 'שבת' },
]

export function CreateRecurringModal({
  isOpen,
  onClose,
  onSuccess,
  barberId,
}: CreateRecurringModalProps) {
  const { report } = useBugReporter('CreateRecurringModal')
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  
  // Data loading
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [barberWorkDays, setBarberWorkDays] = useState<WorkDay[]>([])
  const [shopSettings, setShopSettings] = useState<BarbershopSettings | null>(null)
  const [existingRecurring, setExistingRecurring] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  
  // Conflict modal state
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [conflictingReservations, setConflictingReservations] = useState<ConflictingReservation[]>([])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCustomer(null)
      setSelectedService(null)
      setSelectedDay(null)
      setSelectedTimeSlot(null)
      setNotes('')
      setSearchQuery('')
      setSearchResults([])
      fetchServices()
      fetchBarberWorkDays()
      fetchShopSettings()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Fetch existing recurring slots when day changes
  useEffect(() => {
    if (isOpen && selectedDay) {
      fetchExistingRecurring()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedDay])

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

  const fetchShopSettings = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('barbershop_settings')
      .select('id, name, phone, address, address_text, address_lat, address_lng, description, work_hours_start, work_hours_end, open_days, hero_title, hero_subtitle, hero_description, waze_link, google_maps_link, contact_phone, contact_email, contact_whatsapp, social_instagram, social_facebook, social_tiktok, show_phone, show_email, show_whatsapp, show_instagram, show_facebook, show_tiktok, max_booking_days_ahead, default_reminder_hours')
      .limit(1)
      .single()
    
    if (data) {
      setShopSettings(data as BarbershopSettings)
    }
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
      if (data.length > 0) {
        setSelectedService(data[0] as Service)
      }
    }
    setLoadingServices(false)
  }

  const fetchExistingRecurring = async () => {
    if (!selectedDay) return
    
    const supabase = createClient()
    const { data } = await supabase
      .from('recurring_appointments')
      .select('time_slot')
      .eq('barber_id', barberId)
      .eq('day_of_week', selectedDay)
      .eq('is_active', true)
    
    if (data) {
      const slots = new Set(data.map(r => r.time_slot))
      setExistingRecurring(slots)
    } else {
      setExistingRecurring(new Set())
    }
  }

  // Search customers
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    
    setSearching(true)
    const supabase = createClient()
    
    try {
      const { data } = await supabase
        .from('customers')
        .select('id, fullname, phone, email, is_blocked')
        .or(`fullname.ilike.%${query}%,phone.ilike.%${query}%`)
        .eq('is_blocked', false)
        .order('fullname')
        .limit(10)
      
      setSearchResults((data as Customer[]) || [])
    } catch (err) {
      console.error('Search error:', err)
      await report(err instanceof Error ? err : new Error(String(err)), 'Searching customers')
    } finally {
      setSearching(false)
    }
  }

  // Get work hours for selected day
  const selectedDayWorkHours = useMemo(() => {
    if (!selectedDay) return null
    
    const daySettings = barberWorkDays.find(wd => wd.day_of_week === selectedDay)
    
    if (!daySettings || !daySettings.is_working) {
      return null
    }
    
    return {
      start: daySettings.start_time || '09:00',
      end: daySettings.end_time || '19:00',
    }
  }, [selectedDay, barberWorkDays])

  // Generate available time slots for selected day
  // IMPORTANT: Uses 30-minute intervals to match the booking system
  const availableTimeSlots = useMemo(() => {
    if (!selectedDayWorkHours) return []
    
    const startTime = parseTimeString(selectedDayWorkHours.start)
    const endTime = parseTimeString(selectedDayWorkHours.end)
    
    const slots: string[] = []
    
    // Generate slots in 30-minute increments (matching booking system)
    let currentHour = startTime.hour
    let currentMinute = startTime.minute
    
    while (currentHour < endTime.hour || (currentHour === endTime.hour && currentMinute < endTime.minute)) {
      const timeSlot = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
      slots.push(timeSlot)
      
      currentMinute += 30 // Fixed 30-minute intervals
      if (currentMinute >= 60) {
        currentMinute = 0
        currentHour++
      }
    }
    
    return slots
  }, [selectedDayWorkHours])

  // Get available days (days where BOTH barbershop is open AND barber works)
  const availableDays = useMemo(() => {
    // Get shop open days (defaults to all days if not set)
    const shopOpenDays = shopSettings?.open_days || []
    
    return DAY_OPTIONS.filter(day => {
      // Check if barbershop is open on this day
      const shopIsOpen = shopOpenDays.length === 0 || shopOpenDays.includes(day.value)
      
      // Check if barber works on this day
      const workDay = barberWorkDays.find(wd => wd.day_of_week === day.value)
      const barberWorks = workDay?.is_working === true
      
      // Day is only available if both shop is open AND barber works
      return shopIsOpen && barberWorks
    })
  }, [barberWorkDays, shopSettings])

  // Handle save - checks for conflicts first
  const handleSave = async () => {
    if (!selectedCustomer || !selectedService || !selectedDay || !selectedTimeSlot) {
      showToast.error('נא למלא את כל השדות')
      return
    }
    
    // Check for recurring conflict (another recurring at same slot)
    const hasRecurringConflict = await checkRecurringConflict(barberId, selectedDay, selectedTimeSlot)
    if (hasRecurringConflict) {
      showToast.error('כבר קיים תור קבוע בשעה זו')
      return
    }
    
    // Check for existing reservation conflicts
    setSaving(true)
    try {
      const conflicts = await checkReservationConflicts(barberId, selectedDay, selectedTimeSlot)
      
      if (conflicts.length > 0) {
        // Show conflict modal
        setConflictingReservations(conflicts)
        setConflictModalOpen(true)
        setSaving(false)
        return
      }
      
      // No conflicts - proceed with creation
      await createRecurringAppointment()
    } catch (err) {
      console.error('Save error:', err)
      await report(err instanceof Error ? err : new Error(String(err)), 'Checking conflicts for recurring appointment')
      showToast.error('שגיאה בבדיקת התנגשויות')
      setSaving(false)
    }
  }

  // Handle conflict confirmation - cancel conflicts and create recurring
  const handleConfirmConflicts = async () => {
    if (!selectedCustomer || !selectedService || !selectedDay || !selectedTimeSlot) {
      return
    }

    try {
      // Cancel conflicting reservations
      const reservationIds = conflictingReservations.map(c => c.id)
      const cancelResult = await cancelConflictingReservations(reservationIds, barberId)
      
      if (!cancelResult.success) {
        showToast.error(cancelResult.error || 'שגיאה בביטול התורים המתנגשים')
        return
      }

      // Verify no more conflicts
      const remainingConflicts = await checkReservationConflicts(barberId, selectedDay, selectedTimeSlot)
      if (remainingConflicts.length > 0) {
        showToast.error('נותרו תורים מתנגשים. נסה שוב.')
        setConflictingReservations(remainingConflicts)
        return
      }

      // Close conflict modal and create recurring
      setConflictModalOpen(false)
      setConflictingReservations([])
      
      await createRecurringAppointment()
    } catch (err) {
      console.error('Conflict handling error:', err)
      await report(err instanceof Error ? err : new Error(String(err)), 'Handling conflicts for recurring appointment')
      showToast.error('שגיאה בטיפול בהתנגשויות')
    }
  }

  // Actually create the recurring appointment
  const createRecurringAppointment = async () => {
    if (!selectedCustomer || !selectedService || !selectedDay || !selectedTimeSlot) {
      return
    }

    setSaving(true)
    
    try {
      const result = await createRecurring({
        barber_id: barberId,
        customer_id: selectedCustomer.id,
        service_id: selectedService.id,
        day_of_week: selectedDay,
        time_slot: selectedTimeSlot,
        notes: notes.trim() || undefined,
        created_by: barberId,
      })
      
      if (result.success) {
        showToast.success('התור הקבוע נוצר בהצלחה!')
        onSuccess()
      } else {
        showToast.error(result.message || 'שגיאה ביצירת התור הקבוע')
      }
    } catch (err) {
      console.error('Save error:', err)
      await report(err instanceof Error ? err : new Error(String(err)), 'Creating recurring appointment')
      showToast.error('שגיאה ביצירת התור הקבוע')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setSearchQuery('')
    setSearchResults([])
  }

  const formatPhone = (phone: string): string => {
    if (!phone) return ''
    if (phone.startsWith('walkin-')) return ''
    return phone
  }

  if (!isOpen) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-background-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-medium text-foreground-light flex items-center gap-2">
              <Repeat size={20} className="text-accent-gold" />
              הוסף תור קבוע
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="סגור"
            >
              <X size={20} className="text-foreground-muted" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Customer Selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground-light">
                <User size={16} className="text-foreground-muted" />
                לקוח
              </label>
              
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                  <div>
                    <div className="font-medium text-foreground-light">{selectedCustomer.fullname}</div>
                    {formatPhone(selectedCustomer.phone) && (
                      <div className="text-sm text-foreground-muted">{formatPhone(selectedCustomer.phone)}</div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X size={16} className="text-foreground-muted" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="חפש לקוח לפי שם או טלפון..."
                      className="w-full pr-10 pl-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-foreground-light placeholder:text-foreground-muted focus:outline-none focus:border-accent-gold/50"
                    />
                    {searching && (
                      <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-accent-gold" />
                    )}
                  </div>
                  
                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="bg-background-darker rounded-xl border border-white/10 overflow-hidden max-h-48 overflow-y-auto">
                      {searchResults.map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => handleSelectCustomer(customer)}
                          className="w-full px-4 py-3 text-right hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                        >
                          <div className="font-medium text-foreground-light">{customer.fullname}</div>

                          {formatPhone(customer.phone) && (
                            <div className="text-sm text-foreground-muted mr-2">{formatPhone(customer.phone)}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                    <p className="text-sm text-foreground-muted text-center py-2">
                      לא נמצאו לקוחות
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {/* Service Selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground-light">
                <Scissors size={16} className="text-foreground-muted" />
                שירות
              </label>
              
              {loadingServices ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-accent-gold" />
                </div>
              ) : services.length === 0 ? (
                <p className="text-sm text-foreground-muted">אין שירותים זמינים</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {services.map(service => (
                    <button
                      key={service.id}
                      onClick={() => setSelectedService(service)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm transition-colors border',
                        selectedService?.id === service.id
                          ? 'bg-accent-gold text-background-dark border-accent-gold'
                          : 'bg-white/5 text-foreground-light border-white/10 hover:bg-white/10'
                      )}
                    >
                      {service.name_he}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Day Selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground-light">
                <Calendar size={16} className="text-foreground-muted" />
                יום בשבוע
              </label>
              
              {availableDays.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/10 rounded-xl p-3">
                  <AlertTriangle size={16} />
                  <span>לא הוגדרו ימי עבודה</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableDays.map(day => (
                    <button
                      key={day.value}
                      onClick={() => {
                        setSelectedDay(day.value)
                        setSelectedTimeSlot(null) // Reset time when day changes
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm transition-colors border',
                        selectedDay === day.value
                          ? 'bg-accent-gold text-background-dark border-accent-gold'
                          : 'bg-white/5 text-foreground-light border-white/10 hover:bg-white/10'
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Time Selection */}
            {selectedDay && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground-light">
                  <Clock size={16} className="text-foreground-muted" />
                  שעה
                </label>
                
                {!selectedDayWorkHours ? (
                  <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/10 rounded-xl p-3">
                    <AlertTriangle size={16} />
                    <span>אינך עובד ביום זה</span>
                  </div>
                ) : availableTimeSlots.length === 0 ? (
                  <p className="text-sm text-foreground-muted">אין שעות זמינות</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {availableTimeSlots.map(slot => {
                      const isOccupied = existingRecurring.has(slot)
                      return (
                        <button
                          key={slot}
                          onClick={() => !isOccupied && setSelectedTimeSlot(slot)}
                          disabled={isOccupied}
                          className={cn(
                            'px-2 py-2 rounded-lg text-sm transition-colors border text-center',
                            isOccupied
                              ? 'bg-red-500/10 text-red-400/50 border-red-500/20 cursor-not-allowed line-through'
                              : selectedTimeSlot === slot
                                ? 'bg-accent-gold text-background-dark border-accent-gold'
                                : 'bg-white/5 text-foreground-light border-white/10 hover:bg-white/10'
                          )}
                        >
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            
            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground-light">
                הערות (אופציונלי)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="הערות נוספות..."
                rows={2}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-foreground-light placeholder:text-foreground-muted focus:outline-none focus:border-accent-gold/50 resize-none"
              />
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-white/10 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 justify-center py-2.5 px-4 rounded-xl border border-white/10 text-foreground-light hover:bg-white/5 transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedCustomer || !selectedService || !selectedDay || !selectedTimeSlot}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
                saving || !selectedCustomer || !selectedService || !selectedDay || !selectedTimeSlot
                  ? 'bg-accent-gold/50 text-background-dark/50 cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>שומר...</span>
                </>
              ) : (
                <span>שמור</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Conflict Modal */}
      <RecurringConflictModal
        isOpen={conflictModalOpen}
        onClose={() => {
          setConflictModalOpen(false)
          setConflictingReservations([])
        }}
        onConfirm={handleConfirmConflicts}
        conflicts={conflictingReservations}
        dayLabel={selectedDay ? DAY_OPTIONS.find(d => d.value === selectedDay)?.label || '' : ''}
        timeSlot={selectedTimeSlot || ''}
      />
    </Portal>
  )
}
