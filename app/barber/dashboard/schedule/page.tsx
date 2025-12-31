'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { BarbershopSettings } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

const DAYS = [
  { key: 'sunday', label: 'ראשון' },
  { key: 'monday', label: 'שני' },
  { key: 'tuesday', label: 'שלישי' },
  { key: 'wednesday', label: 'רביעי' },
  { key: 'thursday', label: 'חמישי' },
  { key: 'friday', label: 'שישי' },
  { key: 'saturday', label: 'שבת' },
]

export default function GlobalSchedulePage() {
  const router = useRouter()
  const { isAdmin } = useBarberAuthStore()
  const { report } = useBugReporter('GlobalSchedulePage')
  
  const [settings, setSettings] = useState<BarbershopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [openDays, setOpenDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('19:00')

  // Helper to normalize time format for consistent comparison
  // Handles both "HH:MM" and "HH:MM:SS" formats, returns "HH:MM"
  const normalizeTime = (time: string): string => {
    const parts = time.split(':')
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  }

  const fetchSettings = useCallback(async () => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('barbershop_settings')
      .select('*')
      .single()
    
    if (error) {
      console.error('Error fetching settings:', error)
      await report(new Error(error.message), 'Fetching barbershop schedule settings')
      toast.error('שגיאה בטעינת ההגדרות')
      return
    }
    
    const s = data as BarbershopSettings
    setSettings(s)
    setOpenDays(s.open_days || [])
    // Normalize time format when loading from database
    setStartTime(normalizeTime(s.work_hours_start || '09:00'))
    setEndTime(normalizeTime(s.work_hours_end || '19:00'))
    setLoading(false)
  }, [report])

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/barber/dashboard')
      return
    }
    fetchSettings()
  }, [isAdmin, router, fetchSettings])

  const toggleDay = (day: string) => {
    if (openDays.includes(day)) {
      setOpenDays(openDays.filter(d => d !== day))
    } else {
      setOpenDays([...openDays, day])
    }
  }

  const handleSave = async () => {
    if (!settings?.id) return
    
    setSaving(true)
    const supabase = createClient()
    
    const { error } = await supabase.from('barbershop_settings')
      .update({
        open_days: openDays,
        work_hours_start: startTime,
        work_hours_end: endTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
    
    if (error) {
      console.error('Error saving schedule:', error)
      await report(new Error(error.message), 'Saving barbershop schedule settings')
      toast.error('שגיאה בשמירת שעות הפתיחה')
    } else {
      toast.success('שעות הפתיחה נשמרו בהצלחה!')
    }
    
    setSaving(false)
  }

  if (!isAdmin) return null

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
        <h1 className="text-2xl font-medium text-foreground-light">שעות פתיחה</h1>
        <p className="text-foreground-muted mt-1">הגדר את ימי ושעות הפעילות של המספרה</p>
      </div>

      <div className="bg-background-card border border-white/10 rounded-2xl p-4 sm:p-6 space-y-6">
        {/* Open Days - Flexible wrap layout for mobile */}
        <div>
          <label className="text-foreground-light text-sm block mb-3">ימי פתיחה</label>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {DAYS.map((day) => {
              const isActive = openDays.includes(day.key)
              return (
                <button
                  key={day.key}
                  onClick={() => toggleDay(day.key)}
                  className={cn(
                    'min-w-[60px] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center',
                    isActive
                      ? 'bg-accent-gold text-background-dark shadow-sm shadow-accent-gold/30'
                      : 'bg-white/[0.03] border border-white/[0.06] text-foreground-muted hover:bg-white/[0.06]'
                  )}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Work Hours - Side by side on mobile too */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-xs sm:text-sm">שעת פתיחה</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-2.5 sm:p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm sm:text-base"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-xs sm:text-sm">שעת סגירה</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2.5 sm:p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm sm:text-base"
            />
          </div>
        </div>

        {/* Preview - Compact */}
        <div className="p-3 sm:p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-foreground-muted">סיכום:</span>
            {openDays.length > 0 ? (
              <span className="text-accent-gold text-xs sm:text-sm">
                {openDays.map(d => DAYS.find(day => day.key === d)?.label).join(', ')}
              </span>
            ) : (
              <span className="text-red-400 text-xs sm:text-sm">לא נבחרו ימי פתיחה</span>
            )}
            <span className="text-foreground-muted">|</span>
            <span className="text-foreground-light" dir="ltr">{startTime} - {endTime}</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'w-full py-3 rounded-xl font-medium transition-all text-center flex items-center justify-center',
            saving
              ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
              : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
          )}
        >
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  )
}

