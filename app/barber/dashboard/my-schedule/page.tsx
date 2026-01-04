'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Trash, Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { BarberClosure, BarbershopSettings, WorkDay } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

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
  const [closures, setClosures] = useState<BarberClosure[]>([])
  const [shopSettings, setShopSettings] = useState<BarbershopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [savingClosure, setSavingClosure] = useState(false)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  
  // Closure form
  const [showClosureForm, setShowClosureForm] = useState(false)
  const [closureStartDate, setClosureStartDate] = useState('')
  const [closureEndDate, setClosureEndDate] = useState('')
  const [closureReason, setClosureReason] = useState('')

  // Helper to normalize time format for consistent comparison
  const normalizeTime = useCallback((time: string | null): string => {
    if (!time) return '09:00'
    const parts = time.split(':')
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  }, [])

  const fetchData = useCallback(async () => {
    if (!barber?.id) return
    
    const supabase = createClient()
    
    // Fetch barbershop settings for limits
    const { data: shopData } = await supabase
      .from('barbershop_settings')
      .select('*')
      .single()
    
    if (shopData) {
      setShopSettings(shopData as BarbershopSettings)
    }
    
    // Fetch barber work days with day-specific hours
    const { data: workDaysData, error: workDaysError } = await supabase
      .from('work_days')
      .select('*')
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
    
    // Fetch barber closures
    const { data: closuresData } = await supabase
      .from('barber_closures')
      .select('*')
      .eq('barber_id', barber.id)
      .order('start_date', { ascending: true })
    
    setClosures((closuresData as BarberClosure[]) || [])
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
      toast.error('המספרה סגורה ביום זה')
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
      
      for (const day of workDays) {
        if (!day.isWorking) continue
        
        if (day.startTime < shopStart) {
          const dayLabel = DAYS.find(d => d.key === day.dayOfWeek)?.label || day.dayOfWeek
          toast.error(`ביום ${dayLabel}: שעת ההתחלה לא יכולה להיות לפני ${shopStart}`)
          return
        }
        if (day.endTime > shopEnd) {
          const dayLabel = DAYS.find(d => d.key === day.dayOfWeek)?.label || day.dayOfWeek
          toast.error(`ביום ${dayLabel}: שעת הסיום לא יכולה להיות אחרי ${shopEnd}`)
          return
        }
        if (day.startTime >= day.endTime) {
          const dayLabel = DAYS.find(d => d.key === day.dayOfWeek)?.label || day.dayOfWeek
          toast.error(`ביום ${dayLabel}: שעת ההתחלה חייבת להיות לפני שעת הסיום`)
          return
        }
      }
    }
    
    setSavingSchedule(true)
    const supabase = createClient()
    
    try {
      // Update each day's work hours
      for (const day of workDays) {
        if (day.id) {
          // Update existing record
          const { error } = await supabase
            .from('work_days')
            .update({
              is_working: day.isWorking,
              start_time: day.isWorking ? day.startTime : null,
              end_time: day.isWorking ? day.endTime : null,
            })
            .eq('id', day.id)
          
          if (error) {
            console.error(`Error updating ${day.dayOfWeek}:`, error)
            throw error
          }
        } else {
          // Insert new record (shouldn't happen normally)
          const { error } = await supabase
            .from('work_days')
            .insert({
              user_id: barber.id,
              day_of_week: day.dayOfWeek,
              is_working: day.isWorking,
              start_time: day.isWorking ? day.startTime : null,
              end_time: day.isWorking ? day.endTime : null,
            })
          
          if (error) {
            console.error(`Error inserting ${day.dayOfWeek}:`, error)
            throw error
          }
        }
      }
      
      // Also update the legacy barber_schedules table for backward compatibility
      const workingDays = workDays.filter(d => d.isWorking).map(d => d.dayOfWeek)
      const { error: scheduleError } = await supabase
        .from('barber_schedules')
        .upsert({
          barber_id: barber.id,
          work_days: workingDays,
          // Use the first working day's hours as the "global" hours for legacy compatibility
          work_hours_start: workDays.find(d => d.isWorking)?.startTime || '09:00',
          work_hours_end: workDays.find(d => d.isWorking)?.endTime || '19:00',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'barber_id' })
      
      if (scheduleError) {
        console.error('Error updating barber_schedules:', scheduleError)
        // Don't throw - this is just for backward compatibility
      }
      
      toast.success('לוח הזמנים עודכן בהצלחה!')
      fetchData()
    } catch (err) {
      console.error('Error saving schedule:', err)
      await report(err, 'Saving barber work days')
      toast.error('שגיאה בשמירת לוח הזמנים')
    }
    
    setSavingSchedule(false)
  }

  const handleAddClosure = async () => {
    if (!barber?.id) return
    
    if (!closureStartDate || !closureEndDate) {
      toast.error('נא לבחור תאריכי התחלה וסיום')
      return
    }
    
    if (new Date(closureStartDate) > new Date(closureEndDate)) {
      toast.error('תאריך התחלה לא יכול להיות אחרי תאריך הסיום')
      return
    }
    
    setSavingClosure(true)
    const supabase = createClient()
    
    const { error } = await supabase.from('barber_closures')
      .insert({
        barber_id: barber.id,
        start_date: closureStartDate,
        end_date: closureEndDate,
        reason: closureReason || null,
      })
    
    if (error) {
      console.error('Error adding closure:', error)
      await report(new Error(error.message), 'Adding barber closure')
      toast.error('שגיאה בהוספת יום סגירה')
    } else {
      toast.success('יום הסגירה נוסף בהצלחה!')
      setShowClosureForm(false)
      setClosureStartDate('')
      setClosureEndDate('')
      setClosureReason('')
      fetchData()
    }
    
    setSavingClosure(false)
  }

  const handleDeleteClosure = async (id: string) => {
    if (!confirm('האם למחוק את יום הסגירה?')) return
    
    const supabase = createClient()
    
    const { error } = await supabase
      .from('barber_closures')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting closure:', error)
      await report(new Error(error.message), 'Deleting barber closure')
      toast.error('שגיאה במחיקה')
    } else {
      toast.success('נמחק בהצלחה')
      fetchData()
    }
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  const isUpcoming = (endDate: string): boolean => {
    return new Date(endDate) >= new Date()
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleDay(day.key)
                      }}
                      disabled={!isShopOpen}
                      className={cn(
                        'w-12 h-7 rounded-full transition-colors relative flex-shrink-0',
                        !isShopOpen
                          ? 'bg-foreground-muted/20 cursor-not-allowed'
                          : isWorking
                            ? 'bg-accent-gold'
                            : 'bg-white/10'
                      )}
                      aria-checked={isWorking}
                      role="switch"
                    >
                      <div
                        className={cn(
                          'absolute top-1 w-5 h-5 rounded-full bg-white transition-all',
                          isWorking ? 'right-1' : 'left-1'
                        )}
                      />
                    </button>
                    
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

      {/* Personal Closures */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground-light flex items-center gap-2">
            <Calendar size={20} strokeWidth={1.5} className="text-accent-gold" />
            ימי היעדרות
          </h3>
          <button
            onClick={() => setShowClosureForm(!showClosureForm)}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent-gold text-background-dark rounded-lg text-sm font-medium hover:bg-accent-gold/90 transition-colors"
          >
            <Plus size={12} strokeWidth={1.5} />
            הוסף
          </button>
        </div>

        {/* Add Closure Form */}
        {showClosureForm && (
          <div className="mb-4 p-4 bg-background-dark rounded-xl border border-white/5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm">מתאריך</label>
                <input
                  type="date"
                  value={closureStartDate}
                  onChange={(e) => setClosureStartDate(e.target.value)}
                  className="w-full p-2 rounded-lg bg-background-card border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm">עד תאריך</label>
                <input
                  type="date"
                  value={closureEndDate}
                  onChange={(e) => setClosureEndDate(e.target.value)}
                  className="w-full p-2 rounded-lg bg-background-card border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-foreground-light text-sm">סיבה (מוצג ללקוחות)</label>
              <input
                type="text"
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                placeholder="לדוגמה: חופשה"
                className="w-full p-2 rounded-lg bg-background-card border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddClosure}
                disabled={savingClosure}
                className="flex-1 py-2 bg-accent-gold text-background-dark rounded-lg text-sm font-medium hover:bg-accent-gold/90 disabled:opacity-50"
              >
                {savingClosure ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={() => setShowClosureForm(false)}
                className="px-4 py-2 bg-background-card border border-white/10 text-foreground-muted rounded-lg text-sm hover:text-foreground-light"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* Closures List */}
        {closures.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-foreground-muted text-sm">אין ימי היעדרות מתוכננים</p>
          </div>
        ) : (
          <div className="space-y-2">
            {closures.map((closure) => (
              <div
                key={closure.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl border',
                  isUpcoming(closure.end_date)
                    ? 'bg-background-dark border-white/5'
                    : 'bg-background-dark/50 border-white/5 opacity-60'
                )}
              >
                <div>
                  <p className="text-foreground-light text-sm">
                    {formatDate(closure.start_date)}
                    {closure.start_date !== closure.end_date && (
                      <> - {formatDate(closure.end_date)}</>
                    )}
                  </p>
                  {closure.reason && (
                    <p className="text-foreground-muted text-xs">{closure.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteClosure(closure.id)}
                  className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash size={12} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
