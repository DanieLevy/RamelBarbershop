'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatHebrewHours, formatHebrewDays } from '@/lib/utils'
import { Clock, BellRing, CalendarPlus, XCircle, Loader2, ShieldAlert } from 'lucide-react'
import type { BarberNotificationSettings } from '@/lib/push/types'
import { useBugReporter } from '@/hooks/useBugReporter'

export default function PreferencesPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('PreferencesPage')
  
  const [loading, setLoading] = useState(true)
  const [notifSettings, setNotifSettings] = useState<BarberNotificationSettings | null>(null)
  const [reminderHours, setReminderHours] = useState(3)
  const [notifyOnCancel, setNotifyOnCancel] = useState(true)
  const [notifyOnNewBooking, setNotifyOnNewBooking] = useState(true)
  const [minCancelHours, setMinCancelHours] = useState(3)
  const [savingNotifSettings, setSavingNotifSettings] = useState(false)

  const fetchNotificationSettings = useCallback(async () => {
    if (!barber?.id) return
    
    setLoading(true)
    const supabase = createClient()
    
    const { data, error } = await supabase.from('barber_notification_settings')
      .select('*')
      .eq('barber_id', barber.id)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching notification settings:', error)
      setLoading(false)
      return
    }
    
    if (data) {
      const settings = data as BarberNotificationSettings & { min_cancel_hours?: number }
      setNotifSettings(settings)
      setReminderHours(settings.reminder_hours_before)
      setNotifyOnCancel(settings.notify_on_customer_cancel)
      setNotifyOnNewBooking(settings.notify_on_new_booking)
      setMinCancelHours(settings.min_cancel_hours ?? 3)
    } else {
      // Create default settings for this barber
      const { data: newSettings, error: insertError } = await supabase.from('barber_notification_settings')
        .insert({ barber_id: barber.id })
        .select()
        .single()
      
      if (insertError) {
        console.error('Error creating notification settings:', insertError)
      } else if (newSettings) {
        const settings = newSettings as BarberNotificationSettings & { min_cancel_hours?: number }
        setNotifSettings(settings)
        setReminderHours(settings.reminder_hours_before)
        setNotifyOnCancel(settings.notify_on_customer_cancel)
        setNotifyOnNewBooking(settings.notify_on_new_booking)
        setMinCancelHours(settings.min_cancel_hours ?? 3)
      }
    }
    setLoading(false)
  }, [barber?.id])

  useEffect(() => {
    if (barber?.id) {
      fetchNotificationSettings()
    }
  }, [barber?.id, fetchNotificationSettings])

  const handleSaveNotifSettings = async () => {
    if (!barber?.id || !notifSettings) return
    
    setSavingNotifSettings(true)
    
    try {
      const supabase = createClient()
      
      const { error } = await supabase.from('barber_notification_settings')
        .update({
          reminder_hours_before: reminderHours,
          notify_on_customer_cancel: notifyOnCancel,
          notify_on_new_booking: notifyOnNewBooking,
          min_cancel_hours: minCancelHours,
          updated_at: new Date().toISOString()
        })
        .eq('barber_id', barber.id)
      
      if (error) {
        console.error('Error saving notification settings:', error)
        await report(new Error(error.message), 'Saving notification settings')
        toast.error('שגיאה בשמירת הגדרות ההתראות')
        return
      }
      
      toast.success('הגדרות ההתראות נשמרו בהצלחה')
    } catch (err) {
      console.error('Error saving notification settings:', err)
      await report(err, 'Saving notification settings (exception)')
      toast.error('שגיאה בשמירת הגדרות ההתראות')
    } finally {
      setSavingNotifSettings(false)
    }
  }

  if (!barber) return null

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 lg:pt-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-foreground-light mb-2">העדפות</h1>
          <p className="text-foreground-muted mb-8">הגדרות התראות והעדפות אישיות</p>
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-accent-gold" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 lg:pt-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground-light mb-2">העדפות</h1>
        <p className="text-foreground-muted mb-8">הגדרות התראות והעדפות אישיות</p>

        {/* Notification Settings Section */}
        <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
            <BellRing size={20} strokeWidth={1.5} className="text-accent-gold" />
            הגדרות התראות
          </h3>
          
          <p className="text-foreground-muted text-sm mb-6">
            הגדר מתי ואיך לקוחות יקבלו תזכורות על תורים
          </p>

          <div className="space-y-5">
            {/* Reminder Hours */}
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm flex items-center gap-2">
                <Clock size={14} className="text-foreground-muted" />
                זמן תזכורת לפני התור
              </label>
              <select
                value={reminderHours}
                onChange={(e) => setReminderHours(parseInt(e.target.value))}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
              >
                {[1, 2, 3, 4, 5, 6, 8, 12, 24].map((hours) => (
                  <option key={hours} value={hours}>
                    {hours >= 24 ? formatHebrewDays(hours / 24) : formatHebrewHours(hours)} לפני התור
                  </option>
                ))}
              </select>
              <p className="text-foreground-muted/60 text-xs">
                הלקוחות שלך יקבלו תזכורת push כמה זמן שבחרת לפני התור
              </p>
            </div>

            {/* Notify on Cancel Toggle */}
            <div className="flex items-center justify-between p-4 bg-background-dark rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  notifyOnCancel ? 'bg-red-500/20' : 'bg-white/5'
                )}>
                  <XCircle size={20} className={notifyOnCancel ? 'text-red-400' : 'text-foreground-muted'} />
                </div>
                <div>
                  <p className="text-foreground-light text-sm font-medium">ביטול תור ע&quot;י לקוח</p>
                  <p className="text-foreground-muted text-xs">קבל התראה כשלקוח מבטל תור</p>
                </div>
              </div>
              <button
                onClick={() => setNotifyOnCancel(!notifyOnCancel)}
                className={cn(
                  'w-12 h-7 rounded-full transition-colors relative flex-shrink-0',
                  notifyOnCancel ? 'bg-accent-gold' : 'bg-white/10'
                )}
                aria-checked={notifyOnCancel}
                role="switch"
              >
                <div className={cn(
                  'absolute top-1 w-5 h-5 rounded-full bg-white transition-all',
                  notifyOnCancel ? 'right-1' : 'left-1'
                )} />
              </button>
            </div>

            {/* Notify on New Booking Toggle */}
            <div className="flex items-center justify-between p-4 bg-background-dark rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  notifyOnNewBooking ? 'bg-green-500/20' : 'bg-white/5'
                )}>
                  <CalendarPlus size={20} className={notifyOnNewBooking ? 'text-green-400' : 'text-foreground-muted'} />
                </div>
                <div>
                  <p className="text-foreground-light text-sm font-medium">תור חדש</p>
                  <p className="text-foreground-muted text-xs">קבל התראה כשלקוח קובע תור אצלך</p>
                </div>
              </div>
              <button
                onClick={() => setNotifyOnNewBooking(!notifyOnNewBooking)}
                className={cn(
                  'w-12 h-7 rounded-full transition-colors relative flex-shrink-0',
                  notifyOnNewBooking ? 'bg-accent-gold' : 'bg-white/10'
                )}
                aria-checked={notifyOnNewBooking}
                role="switch"
              >
                <div className={cn(
                  'absolute top-1 w-5 h-5 rounded-full bg-white transition-all',
                  notifyOnNewBooking ? 'right-1' : 'left-1'
                )} />
              </button>
            </div>
          </div>
        </div>

        {/* Cancellation Policy Section */}
        <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
            <ShieldAlert size={20} strokeWidth={1.5} className="text-orange-400" />
            מדיניות ביטולים
          </h3>
          
          <p className="text-foreground-muted text-sm mb-6">
            הגדר כמה זמן לפני התור לקוחות לא יוכלו לבטל בעצמם
          </p>

          <div className="space-y-4">
            {/* Minimum Cancel Hours */}
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm flex items-center gap-2">
                <Clock size={14} className="text-foreground-muted" />
                זמן מינימום לביטול
              </label>
              <select
                value={minCancelHours}
                onChange={(e) => setMinCancelHours(parseInt(e.target.value))}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
              >
                <option value={0}>ללא הגבלה - לקוחות יכולים לבטל תמיד</option>
                <option value={1}>{formatHebrewHours(1)} לפני התור</option>
                <option value={2}>{formatHebrewHours(2)} לפני התור</option>
                <option value={3}>{formatHebrewHours(3)} לפני התור</option>
                <option value={4}>{formatHebrewHours(4)} לפני התור</option>
                <option value={6}>{formatHebrewHours(6)} לפני התור</option>
                <option value={12}>{formatHebrewHours(12)} לפני התור</option>
                <option value={24}>{formatHebrewDays(1)} לפני התור</option>
                <option value={48}>{formatHebrewDays(2)} לפני התור</option>
              </select>
              <p className="text-foreground-muted/60 text-xs">
                {minCancelHours === 0 
                  ? 'לקוחות יכולים לבטל תורים בכל זמן'
                  : `לקוחות לא יוכלו לבטל תורים ${minCancelHours >= 24 ? formatHebrewDays(minCancelHours / 24) : formatHebrewHours(minCancelHours)} לפני. במקום, הם יוכלו לבקש ממך לבטל.`
                }
              </p>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <div className="flex gap-2">
                <ShieldAlert size={16} className="text-orange-400 shrink-0 mt-0.5" />
                <div className="text-xs text-orange-300/80">
                  <p className="font-medium text-orange-300 mb-1">איך זה עובד?</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>לקוח שמנסה לבטל בחלון הזמן הזה יראה הודעה שהוא לא יכול</li>
                    <li>הוא יוכל לבקש ממך לבטל, ותקבל התראה</li>
                    <li>אתה תמיד יכול לבטל תורים בכל זמן</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveNotifSettings}
              disabled={savingNotifSettings || !notifSettings}
              className={cn(
                'w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                savingNotifSettings || !notifSettings
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {savingNotifSettings && <Loader2 size={18} className="animate-spin" />}
              {savingNotifSettings ? 'שומר...' : 'שמור הגדרות'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

