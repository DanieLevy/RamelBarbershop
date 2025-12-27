'use client'

import { useEffect, useState } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FaPlus, FaTrash, FaCalendarAlt, FaClock } from 'react-icons/fa'
import type { BarberSchedule, BarberClosure, BarbershopSettings } from '@/types/database'

const DAYS = [
  { key: 'sunday', label: 'ראשון' },
  { key: 'monday', label: 'שני' },
  { key: 'tuesday', label: 'שלישי' },
  { key: 'wednesday', label: 'רביעי' },
  { key: 'thursday', label: 'חמישי' },
  { key: 'friday', label: 'שישי' },
  { key: 'saturday', label: 'שבת' },
]

export default function MySchedulePage() {
  const { barber } = useBarberAuthStore()
  
  const [schedule, setSchedule] = useState<BarberSchedule | null>(null)
  const [closures, setClosures] = useState<BarberClosure[]>([])
  const [shopSettings, setShopSettings] = useState<BarbershopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [savingClosure, setSavingClosure] = useState(false)
  
  // Schedule form
  const [workDays, setWorkDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('19:00')
  
  // Closure form
  const [showClosureForm, setShowClosureForm] = useState(false)
  const [closureStartDate, setClosureStartDate] = useState('')
  const [closureEndDate, setClosureEndDate] = useState('')
  const [closureReason, setClosureReason] = useState('')

  useEffect(() => {
    if (barber?.id) {
      fetchData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])

  const fetchData = async () => {
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
    
    // Fetch barber schedule
    const { data: scheduleData } = await supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', barber.id)
      .single()
    
    if (scheduleData) {
      const s = scheduleData as BarberSchedule
      setSchedule(s)
      setWorkDays(s.work_days || [])
      setStartTime(s.work_hours_start || '09:00')
      setEndTime(s.work_hours_end || '19:00')
    } else {
      // Use shop defaults
      if (shopData) {
        const shop = shopData as BarbershopSettings
        setWorkDays(shop.open_days || [])
        setStartTime(shop.work_hours_start || '09:00')
        setEndTime(shop.work_hours_end || '19:00')
      }
    }
    
    // Fetch barber closures
    const { data: closuresData } = await supabase
      .from('barber_closures')
      .select('*')
      .eq('barber_id', barber.id)
      .order('start_date', { ascending: true })
    
    setClosures((closuresData as BarberClosure[]) || [])
    setLoading(false)
  }

  const toggleDay = (day: string) => {
    // Only allow days that are open in the shop
    if (!shopSettings?.open_days.includes(day)) {
      toast.error('המספרה סגורה ביום זה')
      return
    }
    
    if (workDays.includes(day)) {
      setWorkDays(workDays.filter(d => d !== day))
    } else {
      setWorkDays([...workDays, day])
    }
  }

  const handleSaveSchedule = async () => {
    if (!barber?.id) return
    
    // Validate times are within shop hours
    if (shopSettings) {
      if (startTime < shopSettings.work_hours_start) {
        toast.error(`שעת ההתחלה לא יכולה להיות לפני ${shopSettings.work_hours_start}`)
        return
      }
      if (endTime > shopSettings.work_hours_end) {
        toast.error(`שעת הסיום לא יכולה להיות אחרי ${shopSettings.work_hours_end}`)
        return
      }
    }
    
    setSavingSchedule(true)
    const supabase = createClient()
    
    const scheduleData = {
      barber_id: barber.id,
      work_days: workDays,
      work_hours_start: startTime,
      work_hours_end: endTime,
      updated_at: new Date().toISOString(),
    }
    
    if (schedule) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('barber_schedules') as any)
        .update(scheduleData)
        .eq('id', schedule.id)
      
      if (error) {
        console.error('Error updating schedule:', error)
        toast.error('שגיאה בעדכון הלוח')
      } else {
        toast.success('הלוח עודכן בהצלחה!')
        fetchData()
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('barber_schedules') as any).insert(scheduleData)
      
      if (error) {
        console.error('Error creating schedule:', error)
        toast.error('שגיאה ביצירת הלוח')
      } else {
        toast.success('הלוח נשמר בהצלחה!')
        fetchData()
      }
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
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('barber_closures') as any).insert({
      barber_id: barber.id,
      start_date: closureStartDate,
      end_date: closureEndDate,
      reason: closureReason || null,
    })
    
    if (error) {
      console.error('Error adding closure:', error)
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
        <p className="text-foreground-muted mt-1">הגדר את ימי ושעות העבודה שלך</p>
      </div>

      {/* Work Schedule */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <FaClock className="w-5 h-5 text-accent-gold" />
          שעות עבודה
        </h3>
        
        {/* Info about shop hours */}
        {shopSettings && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-sm">
              שעות פתיחה של המספרה: {shopSettings.work_hours_start} - {shopSettings.work_hours_end}
            </p>
          </div>
        )}

        {/* Work Days */}
        <div className="mb-6">
          <label className="text-foreground-light text-sm block mb-3">ימי עבודה</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const isShopOpen = shopSettings?.open_days.includes(day.key)
              return (
                <button
                  key={day.key}
                  onClick={() => toggleDay(day.key)}
                  disabled={!isShopOpen}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    !isShopOpen
                      ? 'bg-background-dark border border-white/5 text-foreground-muted/50 cursor-not-allowed'
                      : workDays.includes(day.key)
                        ? 'bg-accent-gold text-background-dark'
                        : 'bg-background-dark border border-white/10 text-foreground-muted hover:text-foreground-light'
                  )}
                  title={!isShopOpen ? 'המספרה סגורה ביום זה' : ''}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Work Hours */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm">שעת התחלה</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              min={shopSettings?.work_hours_start}
              max={shopSettings?.work_hours_end}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm">שעת סיום</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              min={shopSettings?.work_hours_start}
              max={shopSettings?.work_hours_end}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
            />
          </div>
        </div>

        <button
          onClick={handleSaveSchedule}
          disabled={savingSchedule}
          className={cn(
            'w-full py-3 rounded-xl font-medium transition-all',
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
            <FaCalendarAlt className="w-5 h-5 text-accent-gold" />
            ימי היעדרות
          </h3>
          <button
            onClick={() => setShowClosureForm(!showClosureForm)}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent-gold text-background-dark rounded-lg text-sm font-medium hover:bg-accent-gold/90 transition-colors"
          >
            <FaPlus className="w-3 h-3" />
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
                  <FaTrash className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

