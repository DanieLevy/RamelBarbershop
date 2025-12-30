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
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('barbershop_settings') as any)
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

      <div className="bg-background-card border border-white/10 rounded-2xl p-6 space-y-6">
        {/* Open Days */}
        <div>
          <label className="text-foreground-light text-sm block mb-3">ימי פתיחה</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button
                key={day.key}
                onClick={() => toggleDay(day.key)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  openDays.includes(day.key)
                    ? 'bg-accent-gold text-background-dark'
                    : 'bg-background-dark border border-white/10 text-foreground-muted hover:text-foreground-light'
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Work Hours - Mobile stacked, tablet+ side by side */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-foreground-light text-sm">שעת פתיחה</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-base"
            />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-foreground-light text-sm">שעת סגירה</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-base"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 bg-background-dark rounded-xl border border-white/5">
          <p className="text-foreground-muted text-sm mb-2">תצוגה מקדימה:</p>
          <p className="text-foreground-light">
            {openDays.length > 0 ? (
              <>
                פתוח בימים:{' '}
                <span className="text-accent-gold">
                  {openDays.map(d => DAYS.find(day => day.key === d)?.label).join(', ')}
                </span>
              </>
            ) : (
              <span className="text-red-400">לא נבחרו ימי פתיחה</span>
            )}
          </p>
          <p className="text-foreground-light mt-1">
            שעות: <span className="text-accent-gold" dir="ltr">{startTime} - {endTime}</span>
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'w-full py-3 rounded-xl font-medium transition-all',
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

