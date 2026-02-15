'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { BarbershopSettings, WorkDay } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'
import { Switch } from '@heroui/react'

const DAYS = [
  { key: 'sunday', label: 'ראשון', shortLabel: 'א׳' },
  { key: 'monday', label: 'שני', shortLabel: 'ב׳' },
  { key: 'tuesday', label: 'שלישי', shortLabel: 'ג׳' },
  { key: 'wednesday', label: 'רביעי', shortLabel: 'ד׳' },
  { key: 'thursday', label: 'חמישי', shortLabel: 'ה׳' },
  { key: 'friday', label: 'שישי', shortLabel: 'ו׳' },
  { key: 'saturday', label: 'שבת', shortLabel: 'ש׳' },
]

interface DaySchedule {
  id: string
  dayOfWeek: string
  isWorking: boolean
  startTime: string
  endTime: string
}

export default function MySchedulePage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('MySchedulePage')
  
  const [workDays, setWorkDays] = useState<DaySchedule[]>([])
  const [shopSettings, setShopSettings] = useState<BarbershopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  // Helper to normalize time format for consistent comparison
  const normalizeTime = useCallback((time: string | null): string => {
    if (!time) return '09:00'
    const parts = time.split(':')
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  }, [])

  // Helper to convert time string to minutes for proper comparison
  // Treats "00:00" as 24:00 (end of day) when used as end time
  const timeToMinutes = useCallback((time: string, isEndTime: boolean = false): number => {
    const [hours, minutes] = time.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes
    // If it's an end time and it's 00:00, treat it as 24:00 (end of day)
    if (isEndTime && totalMinutes === 0) {
      return 24 * 60
    }
    return totalMinutes
  }, [])

  const fetchData = useCallback(async () => {
    if (!barber?.id) return
    
    const supabase = createClient()
    
    // Fetch barbershop settings for limits
    const { data: shopData } = await supabase
      .from('barbershop_settings')
      .select('id, name, phone, address, address_text, address_lat, address_lng, description, work_hours_start, work_hours_end, open_days, hero_title, hero_subtitle, hero_description, waze_link, google_maps_link, contact_phone, contact_email, contact_whatsapp, social_instagram, social_facebook, social_tiktok, show_phone, show_email, show_whatsapp, show_instagram, show_facebook, show_tiktok, max_booking_days_ahead, default_reminder_hours')
      .single()
    
    if (shopData) {
      setShopSettings(shopData as BarbershopSettings)
    }
    
    // Fetch barber work days with day-specific hours
    const { data: workDaysData, error: workDaysError } = await supabase
      .from('work_days')
      .select('id, user_id, day_of_week, is_working, start_time, end_time')
      .eq('user_id', barber.id)
    
    if (workDaysError) {
      console.error('Error fetching work days:', workDaysError)
      await report(new Error(workDaysError.message), 'Fetching barber work days')
    }
    
    if (workDaysData && workDaysData.length > 0) {
      const mapped: DaySchedule[] = (workDaysData as WorkDay[]).map(wd => ({
        id: wd.id,
        dayOfWeek: wd.day_of_week,
        isWorking: wd.is_working || false,
        startTime: normalizeTime(wd.start_time),
        endTime: normalizeTime(wd.end_time),
      }))
      
      // Sort by day order
      const dayOrder = DAYS.map(d => d.key)
      mapped.sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek))
      
      setWorkDays(mapped)
    } else {
      // Initialize with defaults if no work_days exist
      const defaults: DaySchedule[] = DAYS.map(day => ({
        id: '',
        dayOfWeek: day.key,
        isWorking: shopData?.open_days?.includes(day.key) || false,
        startTime: normalizeTime(shopData?.work_hours_start || '09:00'),
        endTime: normalizeTime(shopData?.work_hours_end || '19:00'),
      }))
      setWorkDays(defaults)
    }
    
    setLoading(false)
  }, [barber?.id, normalizeTime, report])

  useEffect(() => {
    if (barber?.id) {
      fetchData()
    }
  }, [barber?.id, fetchData])

  const toggleDay = (dayKey: string) => {
    // Only allow days that are open in the shop
    if (!shopSettings?.open_days.includes(dayKey)) {
      showToast.error('המספרה סגורה ביום זה')
      return
    }
    
    setWorkDays(prev => prev.map(day => 
      day.dayOfWeek === dayKey 
        ? { ...day, isWorking: !day.isWorking }
        : day
    ))
  }

  const updateDayTime = (dayKey: string, field: 'startTime' | 'endTime', value: string) => {
    setWorkDays(prev => prev.map(day => 
      day.dayOfWeek === dayKey 
        ? { ...day, [field]: value }
        : day
    ))
  }

  const handleSaveSchedule = async () => {
    if (!barber?.id) return
    
    // Validate times are within shop hours
    if (shopSettings) {
      const shopStart = normalizeTime(shopSettings.work_hours_start)
      const shopEnd = normalizeTime(shopSettings.work_hours_end)
      const shopStartMinutes = timeToMinutes(shopStart, false)
      const shopEndMinutes = timeToMinutes(shopEnd, true) // treat 00:00 as 24:00
      
      for (const day of workDays) {
        if (!day.isWorking) continue
        
        const dayStartMinutes = timeToMinutes(day.startTime, false)
        const dayEndMinutes = timeToMinutes(day.endTime, true)
        
        if (dayStartMinutes < shopStartMinutes) {
          const dayLabel = DAYS.find(d => d.key === day.dayOfWeek)?.label || day.dayOfWeek
          showToast.error(`ביום ${dayLabel}: שעת ההתחלה לא יכולה להיות לפני ${shopStart}`)
          return
        }
        if (dayEndMinutes > shopEndMinutes) {
          const dayLabel = DAYS.find(d => d.key === day.dayOfWeek)?.label || day.dayOfWeek
          // Display "00:00" as "חצות" (midnight) for better UX
          const displayShopEnd = shopEnd === '00:00' ? 'חצות (00:00)' : shopEnd
          showToast.error(`ביום ${dayLabel}: שעת הסיום לא יכולה להיות אחרי ${displayShopEnd}`)
          return
        }
        if (dayStartMinutes >= dayEndMinutes) {
          const dayLabel = DAYS.find(d => d.key === day.dayOfWeek)?.label || day.dayOfWeek
          showToast.error(`ביום ${dayLabel}: שעת ההתחלה חייבת להיות לפני שעת הסיום`)
          return
        }
      }
    }
    
    setSavingSchedule(true)
    
    try {
      const res = await fetch('/api/barber/work-days', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: barber.id,
          days: workDays.map(day => ({
            id: day.id || undefined,
            dayOfWeek: day.dayOfWeek,
            isWorking: day.isWorking,
            startTime: day.isWorking ? day.startTime : null,
            endTime: day.isWorking ? day.endTime : null,
          })),
        }),
      })
      const result = await res.json()
      
      if (!result.success) {
        console.error('Error saving schedule:', result.message)
        await report(new Error(result.message || 'Schedule save failed'), 'Saving barber work days')
        showToast.error('שגיאה בשמירת לוח הזמנים')
      } else {
        showToast.success('לוח הזמנים עודכן בהצלחה!')
        fetchData()
      }
    } catch (err) {
      console.error('Error saving schedule:', err)
      await report(err, 'Saving barber work days')
      showToast.error('שגיאה בשמירת לוח הזמנים')
    }
    
    setSavingSchedule(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-foreground-light">הלוז שלי</h1>
        <p className="text-foreground-muted mt-1">הגדר את ימי ושעות העבודה שלך - לכל יום בנפרד</p>
      </div>

      {/* Work Schedule */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <Clock size={20} strokeWidth={1.5} className="text-accent-gold" />
          שעות עבודה לפי יום
        </h3>
        
        {/* Info about shop hours */}
        {shopSettings && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-sm">
              שעות פתיחה של המספרה: {normalizeTime(shopSettings.work_hours_start)} - {normalizeTime(shopSettings.work_hours_end)}
            </p>
            <p className="text-blue-400/70 text-xs mt-1">
              ניתן לקבוע שעות שונות לכל יום בשבוע
            </p>
          </div>
        )}

        {/* Day-specific schedule */}
        <div className="space-y-2 mb-6">
          {DAYS.map((day) => {
            const daySchedule = workDays.find(d => d.dayOfWeek === day.key)
            const isShopOpen = shopSettings?.open_days.includes(day.key)
            const isWorking = daySchedule?.isWorking || false
            const isExpanded = expandedDay === day.key
            
            return (
              <div
                key={day.key}
                className={cn(
                  'border rounded-xl overflow-hidden transition-all',
                  !isShopOpen 
                    ? 'bg-background-dark/30 border-white/5 opacity-50' 
                    : isWorking 
                      ? 'bg-background-dark/50 border-accent-gold/30' 
                      : 'bg-background-dark/50 border-white/5'
                )}
              >
                {/* Day header */}
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer"
                  onClick={() => isShopOpen && setExpandedDay(isExpanded ? null : day.key)}
                >
                  <div className="flex items-center gap-3">
                    {/* Toggle working */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch
                        isSelected={isWorking}
                        onChange={() => toggleDay(day.key)}
                        isDisabled={!isShopOpen}
                      >
                        <Switch.Control className={cn(
                          'w-12 h-7',
                          !isShopOpen
                            ? 'bg-foreground-muted/20 cursor-not-allowed'
                            : isWorking
                              ? 'bg-accent-gold'
                              : 'bg-white/10',
                          !isShopOpen && 'opacity-50 cursor-not-allowed'
                        )}>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch>
                    </div>
                    
                    <span className={cn(
                      'font-medium',
                      isWorking ? 'text-foreground-light' : 'text-foreground-muted'
                    )}>
                      {day.label}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isWorking && daySchedule && (
                      <span className="text-sm text-foreground-muted" dir="ltr">
                        {daySchedule.startTime} - {daySchedule.endTime}
                      </span>
                    )}
                    {!isWorking && isShopOpen && (
                      <span className="text-sm text-foreground-muted">לא עובד</span>
                    )}
                    {!isShopOpen && (
                      <span className="text-xs text-foreground-muted">המספרה סגורה</span>
                    )}
                    {isShopOpen && (
                      isExpanded ? <ChevronUp size={16} className="text-foreground-muted" /> : <ChevronDown size={16} className="text-foreground-muted" />
                    )}
                  </div>
                </div>
                
                {/* Expanded time inputs */}
                {isExpanded && isShopOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-white/5">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-foreground-muted text-xs block mb-1">התחלה</label>
                        <input
                          type="time"
                          value={daySchedule?.startTime || '09:00'}
                          onChange={(e) => updateDayTime(day.key, 'startTime', e.target.value)}
                          disabled={!isWorking}
                          min={shopSettings ? normalizeTime(shopSettings.work_hours_start) : undefined}
                          max={shopSettings ? normalizeTime(shopSettings.work_hours_end) : undefined}
                          className={cn(
                            'w-full p-2 rounded-lg bg-background-card border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm',
                            !isWorking && 'opacity-50'
                          )}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-foreground-muted text-xs block mb-1">סיום</label>
                        <input
                          type="time"
                          value={daySchedule?.endTime || '19:00'}
                          onChange={(e) => updateDayTime(day.key, 'endTime', e.target.value)}
                          disabled={!isWorking}
                          min={shopSettings ? normalizeTime(shopSettings.work_hours_start) : undefined}
                          max={shopSettings ? normalizeTime(shopSettings.work_hours_end) : undefined}
                          className={cn(
                            'w-full p-2 rounded-lg bg-background-card border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm',
                            !isWorking && 'opacity-50'
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={handleSaveSchedule}
          disabled={savingSchedule}
          className={cn(
            'w-full py-3 rounded-xl font-medium transition-all text-center flex items-center justify-center',
            savingSchedule
              ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
              : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
          )}
        >
          {savingSchedule ? 'שומר...' : 'שמור לוח זמנים'}
        </button>
      </div>

    </div>
  )
}
