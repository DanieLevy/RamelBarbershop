'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Calendar, Clock, BellRing, XCircle, CalendarPlus, Loader2, Save } from 'lucide-react'
import type { BarberNotificationSettings } from '@/lib/push/types'
import type { BarberBookingSettings } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

export default function PreferencesPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('PreferencesPage')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Notification settings
  const [notifSettings, setNotifSettings] = useState<BarberNotificationSettings | null>(null)
  const [reminderHours, setReminderHours] = useState(3)
  const [notifyOnCancel, setNotifyOnCancel] = useState(true)
  const [notifyOnNewBooking, setNotifyOnNewBooking] = useState(true)
  
  // Booking settings
  const [bookingSettings, setBookingSettings] = useState<BarberBookingSettings | null>(null)
  const [maxBookingDaysAhead, setMaxBookingDaysAhead] = useState(15)
  const [minHoursBeforeBooking, setMinHoursBeforeBooking] = useState(1)
  const [minCancelHours, setMinCancelHours] = useState(2)

  const fetchSettings = useCallback(async () => {
    if (!barber?.id) return
    
    setLoading(true)
    const supabase = createClient()
    
    // Fetch both settings in parallel
    const [notifResult, bookingResult] = await Promise.all([
      supabase.from('barber_notification_settings')
        .select('*')
        .eq('barber_id', barber.id)
        .single(),
      supabase.from('barber_booking_settings')
        .select('*')
        .eq('barber_id', barber.id)
        .single()
    ])
    
    // Handle notification settings
    if (notifResult.data) {
      const settings = notifResult.data as BarberNotificationSettings
      setNotifSettings(settings)
      setReminderHours(settings.reminder_hours_before)
      setNotifyOnCancel(settings.notify_on_customer_cancel)
      setNotifyOnNewBooking(settings.notify_on_new_booking)
    } else if (!notifResult.error || notifResult.error.code === 'PGRST116') {
      // Create default notification settings
      const { data: newSettings } = await supabase.from('barber_notification_settings')
        .insert({ 
          barber_id: barber.id,
          reminder_hours_before: 3,
          notify_on_customer_cancel: true,
          notify_on_new_booking: true,
          broadcast_enabled: true
        })
        .select()
        .single()
      
      if (newSettings) {
        setNotifSettings(newSettings as BarberNotificationSettings)
      }
    }
    
    // Handle booking settings
    if (bookingResult.data) {
      const settings = bookingResult.data as BarberBookingSettings
      setBookingSettings(settings)
      setMaxBookingDaysAhead(settings.max_booking_days_ahead)
      setMinHoursBeforeBooking(settings.min_hours_before_booking)
      setMinCancelHours(settings.min_cancel_hours)
    } else if (!bookingResult.error || bookingResult.error.code === 'PGRST116') {
      // Create default booking settings
      const { data: newSettings } = await supabase.from('barber_booking_settings')
        .insert({ 
          barber_id: barber.id,
          max_booking_days_ahead: 15,
          min_hours_before_booking: 1,
          min_cancel_hours: 2
        })
        .select()
        .single()
      
      if (newSettings) {
        setBookingSettings(newSettings as BarberBookingSettings)
      }
    }
    
    setLoading(false)
  }, [barber?.id])

  useEffect(() => {
    if (barber?.id) {
      fetchSettings()
    }
  }, [barber?.id, fetchSettings])

  const handleSave = async () => {
    if (!barber?.id) return
    
    setSaving(true)
    
    try {
      const supabase = createClient()
      const now = new Date().toISOString()
      
      // Save both settings in parallel
      const [notifError, bookingError] = await Promise.all([
        // Update notification settings
        supabase.from('barber_notification_settings')
          .update({
            reminder_hours_before: reminderHours,
            notify_on_customer_cancel: notifyOnCancel,
            notify_on_new_booking: notifyOnNewBooking,
            updated_at: now
          })
          .eq('barber_id', barber.id)
          .then(r => r.error),
        // Update booking settings
        supabase.from('barber_booking_settings')
          .update({
            max_booking_days_ahead: maxBookingDaysAhead,
            min_hours_before_booking: minHoursBeforeBooking,
            min_cancel_hours: minCancelHours,
            updated_at: now
          })
          .eq('barber_id', barber.id)
          .then(r => r.error)
      ])
      
      if (notifError || bookingError) {
        console.error('Error saving settings:', notifError || bookingError)
        await report(new Error((notifError || bookingError)?.message || 'Unknown error'), 'Saving preferences')
        toast.error('שגיאה בשמירת ההגדרות')
        return
      }
      
      toast.success('ההגדרות נשמרו בהצלחה')
    } catch (err) {
      console.error('Error saving settings:', err)
      await report(err, 'Saving preferences (exception)')
      toast.error('שגיאה בשמירת ההגדרות')
    } finally {
      setSaving(false)
    }
  }

  if (!barber) return null

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto">
          <h1 className="text-xl font-bold text-foreground-light mb-6">העדפות</h1>
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-accent-gold" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-bold text-foreground-light mb-6">העדפות</h1>

        {/* Compact Settings Card */}
        <div className="bg-background-card border border-white/10 rounded-2xl overflow-hidden">
          
          {/* Section 1: Booking Settings */}
          <div className="p-5 border-b border-white/10">
            <h2 className="text-sm font-medium text-accent-gold mb-4 flex items-center gap-2">
              <Calendar size={16} strokeWidth={1.5} />
              הגדרות תורים
            </h2>
            
            <div className="space-y-4">
              {/* Max Booking Days Ahead */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-foreground-light text-sm flex-1">
                  מספר ימים שניתן לקבוע תור מראש
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={maxBookingDaysAhead}
                    onChange={(e) => setMaxBookingDaysAhead(parseInt(e.target.value))}
                    className="w-20 px-3 py-2 rounded-lg bg-background-dark border border-white/10 text-foreground-light text-sm outline-none focus:ring-1 focus:ring-accent-gold"
                  >
                    {[7, 10, 14, 15, 21, 30, 45, 60].map((days) => (
                      <option key={days} value={days}>{days}</option>
                    ))}
                  </select>
                  <span className="text-foreground-muted text-sm">ימים</span>
                </div>
              </div>

              {/* Min Hours Before Booking */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-foreground-light text-sm flex-1">
                  ניתן להירשם לתור עד
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={minHoursBeforeBooking}
                    onChange={(e) => setMinHoursBeforeBooking(parseInt(e.target.value))}
                    className="w-20 px-3 py-2 rounded-lg bg-background-dark border border-white/10 text-foreground-light text-sm outline-none focus:ring-1 focus:ring-accent-gold"
                  >
                    {[0, 1, 2, 3, 4, 6, 12, 24].map((hours) => (
                      <option key={hours} value={hours}>{hours}</option>
                    ))}
                  </select>
                  <span className="text-foreground-muted text-sm">שעות לפני</span>
                </div>
              </div>

              {/* Min Cancel Hours */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-foreground-light text-sm flex-1">
                  ניתן לבטל תור עד
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={minCancelHours}
                    onChange={(e) => setMinCancelHours(parseInt(e.target.value))}
                    className="w-20 px-3 py-2 rounded-lg bg-background-dark border border-white/10 text-foreground-light text-sm outline-none focus:ring-1 focus:ring-accent-gold"
                  >
                    {[0, 1, 2, 3, 4, 6, 12, 24, 48].map((hours) => (
                      <option key={hours} value={hours}>{hours}</option>
                    ))}
                  </select>
                  <span className="text-foreground-muted text-sm">שעות לפני</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Notification Settings */}
          <div className="p-5">
            <h2 className="text-sm font-medium text-accent-gold mb-4 flex items-center gap-2">
              <BellRing size={16} strokeWidth={1.5} />
              הגדרות התראות
            </h2>
            
            <div className="space-y-4">
              {/* Reminder Hours */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-foreground-light text-sm flex-1 flex items-center gap-2">
                  <Clock size={14} className="text-foreground-muted" />
                  שליחת הודעת תזכורת
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={reminderHours}
                    onChange={(e) => setReminderHours(parseInt(e.target.value))}
                    className="w-20 px-3 py-2 rounded-lg bg-background-dark border border-white/10 text-foreground-light text-sm outline-none focus:ring-1 focus:ring-accent-gold"
                  >
                    {[1, 2, 3, 4, 6, 8, 12, 24].map((hours) => (
                      <option key={hours} value={hours}>{hours}</option>
                    ))}
                  </select>
                  <span className="text-foreground-muted text-sm">שעות לפני</span>
                </div>
              </div>

              {/* Notify on New Booking - Compact Toggle */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-foreground-light text-sm flex-1 flex items-center gap-2">
                  <CalendarPlus size={14} className="text-green-400" />
                  קבלת התראה על תור חדש
                </label>
                <button
                  onClick={() => setNotifyOnNewBooking(!notifyOnNewBooking)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative flex-shrink-0',
                    notifyOnNewBooking ? 'bg-accent-gold' : 'bg-white/10'
                  )}
                  aria-checked={notifyOnNewBooking}
                  role="switch"
                >
                  <div className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all',
                    notifyOnNewBooking ? 'right-0.5' : 'left-0.5'
                  )} />
                </button>
              </div>

              {/* Notify on Cancel - Compact Toggle */}
              <div className="flex items-center justify-between gap-4">
                <label className="text-foreground-light text-sm flex-1 flex items-center gap-2">
                  <XCircle size={14} className="text-red-400" />
                  קבלת התראה על ביטול לקוח
                </label>
                <button
                  onClick={() => setNotifyOnCancel(!notifyOnCancel)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative flex-shrink-0',
                    notifyOnCancel ? 'bg-accent-gold' : 'bg-white/10'
                  )}
                  aria-checked={notifyOnCancel}
                  role="switch"
                >
                  <div className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all',
                    notifyOnCancel ? 'right-0.5' : 'left-0.5'
                  )} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || (!notifSettings && !bookingSettings)}
          className={cn(
            'w-full mt-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
            saving || (!notifSettings && !bookingSettings)
              ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
              : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90 active:scale-[0.98]'
          )}
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} strokeWidth={1.5} />
          )}
          {saving ? 'שומר...' : 'שמור הגדרות'}
        </button>
      </div>
    </div>
  )
}
