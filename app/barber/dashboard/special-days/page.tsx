'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Plus, Trash, CalendarPlus, Calendar, CalendarX } from 'lucide-react'
import type { BarberSpecialDay } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'
import { Button } from '@heroui/react'

export default function SpecialDaysPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('SpecialDaysPage')

  const [specialDays, setSpecialDays] = useState<BarberSpecialDay[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('14:00')
  const [reason, setReason] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const fetchSpecialDays = useCallback(async () => {
    if (!barber?.id) return

    const supabase = createClient()

    const { data, error } = await supabase
      .from('barber_special_days')
      .select('id, barber_id, date, start_time, end_time, reason, created_at')
      .eq('barber_id', barber.id)
      .order('date', { ascending: true })

    if (error) {
      console.error('Error fetching special days:', error)
      await report(new Error(error.message), 'Fetching barber special days')
    }

    setSpecialDays((data as BarberSpecialDay[]) || [])
    setLoading(false)
  }, [barber?.id, report])

  useEffect(() => {
    fetchSpecialDays()
  }, [fetchSpecialDays])

  const handleAdd = async () => {
    if (!barber?.id) return

    if (!date) {
      showToast.error('נא לבחור תאריך')
      return
    }

    if (startTime >= endTime) {
      showToast.error('שעת ההתחלה חייבת להיות לפני שעת הסיום')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/barber/special-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: barber.id,
          date,
          startTime,
          endTime,
          reason: reason || null,
        }),
      })
      const result = await res.json()

      if (!result.success) {
        if (result.error === 'DUPLICATE') {
          showToast.error('כבר קיים יום מיוחד לתאריך זה')
        } else {
          console.error('Error adding special day:', result.message)
          await report(new Error(result.message || 'Special day add failed'), 'Adding barber special day')
          showToast.error('שגיאה בהוספת יום מיוחד')
        }
      } else {
        showToast.success('יום העבודה המיוחד נוסף בהצלחה!')
        setShowForm(false)
        setDate('')
        setStartTime('09:00')
        setEndTime('14:00')
        setReason('')
        fetchSpecialDays()
      }
    } catch (err) {
      console.error('Error adding special day:', err)
      await report(err, 'Adding barber special day')
      showToast.error('שגיאה בהוספת יום מיוחד')
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק את יום העבודה המיוחד?')) return

    try {
      const res = await fetch('/api/barber/special-days', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barberId: barber?.id, id }),
      })
      const result = await res.json()

      if (!result.success) {
        console.error('Error deleting special day:', result.message)
        await report(new Error(result.message || 'Special day delete failed'), 'Deleting barber special day')
        showToast.error('שגיאה במחיקה')
      } else {
        showToast.success('נמחק בהצלחה')
        fetchSpecialDays()
      }
    } catch (err) {
      console.error('Error deleting special day:', err)
      showToast.error('שגיאה במחיקה')
    }
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('he-IL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const isUpcoming = (dateStr: string): boolean => {
    return dateStr >= today
  }

  const upcomingDays = specialDays.filter(d => isUpcoming(d.date))
  const pastDays = specialDays.filter(d => !isUpcoming(d.date))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground-light">ימים מיוחדים</h1>
          <p className="text-foreground-muted text-sm mt-1">
            הוסף ימי עבודה נוספים — לקוחות יוכלו לקבוע תורים בתאריכים אלו גם אם הם מחוץ לשגרת העבודה
          </p>
        </div>
        <Button
          onPress={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-xl text-sm font-medium hover:bg-accent-gold/90"
        >
          <Plus size={16} strokeWidth={2} />
          הוסף יום מיוחד
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-background-card border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground-light">{specialDays.length}</div>
          <div className="text-foreground-muted text-xs">סה״כ ימים מיוחדים</div>
        </div>
        <div className="bg-background-card border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-accent-gold">{upcomingDays.length}</div>
          <div className="text-foreground-muted text-xs">קרובים</div>
        </div>
        <div className="bg-background-card border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground-muted">{pastDays.length}</div>
          <div className="text-foreground-muted text-xs">שעברו</div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
            <CalendarPlus size={20} strokeWidth={1.5} className="text-accent-gold" />
            הוספת יום עבודה מיוחד
          </h3>

          {/* Date */}
          <div className="flex flex-col gap-2 mb-4">
            <label className="text-foreground-light text-sm">תאריך</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={today}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm"
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">שעת התחלה</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">שעת סיום</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="flex flex-col gap-2 mb-4">
            <label className="text-foreground-light text-sm">הערה (אופציונלי)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: ערב פורים, ערב פסח..."
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm placeholder:text-foreground-muted"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onPress={handleAdd}
              isDisabled={saving}
              className="flex-1 py-3 bg-accent-gold text-background-dark rounded-xl text-sm font-medium hover:bg-accent-gold/90"
            >
              {saving ? 'שומר...' : 'שמור'}
            </Button>
            <Button
              variant="ghost"
              onPress={() => {
                setShowForm(false)
                setDate('')
                setStartTime('09:00')
                setEndTime('14:00')
                setReason('')
              }}
              className="px-6 py-3 bg-background-dark border border-white/10 text-foreground-muted rounded-xl text-sm hover:text-foreground-light"
            >
              ביטול
            </Button>
          </div>
        </div>
      )}

      {/* Upcoming Special Days */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <Calendar size={20} strokeWidth={1.5} className="text-accent-gold" />
          ימי עבודה מיוחדים קרובים
        </h3>

        {upcomingDays.length === 0 ? (
          <div className="text-center py-8">
            <CalendarX size={40} strokeWidth={1} className="text-foreground-muted mx-auto mb-3 opacity-50" />
            <p className="text-foreground-muted text-sm">אין ימי עבודה מיוחדים מתוכננים</p>
            <p className="text-foreground-muted text-xs mt-1">
              לחץ על &quot;הוסף יום מיוחד&quot; להוספת יום חדש
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingDays.map((day) => (
              <div
                key={day.id}
                className="flex items-center justify-between p-4 rounded-xl bg-background-dark border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-gold/10 flex items-center justify-center">
                    <CalendarPlus size={20} strokeWidth={1.5} className="text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-foreground-light font-medium">{formatDate(day.date)}</p>
                    <p className="text-foreground-muted text-sm">
                      {day.start_time.slice(0, 5)} — {day.end_time.slice(0, 5)}
                      {day.reason && ` · ${day.reason}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  isIconOnly
                  onPress={() => handleDelete(day.id)}
                  className="min-w-[36px] w-9 h-9 text-red-400 hover:bg-red-500/10 rounded-lg"
                  aria-label="מחק יום מיוחד"
                >
                  <Trash size={16} strokeWidth={1.5} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Special Days */}
      {pastDays.length > 0 && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-6 opacity-70">
          <h3 className="text-lg font-medium text-foreground-muted mb-4 flex items-center gap-2">
            <CalendarX size={20} strokeWidth={1.5} className="text-foreground-muted" />
            ימי עבודה מיוחדים שעברו
          </h3>

          <div className="space-y-2">
            {pastDays.slice(0, 5).map((day) => (
              <div
                key={day.id}
                className="flex items-center justify-between p-3 rounded-xl bg-background-dark/50 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <CalendarPlus size={16} strokeWidth={1.5} className="text-foreground-muted" />
                  </div>
                  <div>
                    <p className="text-foreground-muted text-sm">{formatDate(day.date)}</p>
                    <p className="text-foreground-muted/70 text-xs">
                      {day.start_time.slice(0, 5)} — {day.end_time.slice(0, 5)}
                      {day.reason && ` · ${day.reason}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  isIconOnly
                  onPress={() => handleDelete(day.id)}
                  className={cn('min-w-[32px] w-8 h-8 text-foreground-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg')}
                  aria-label="מחק יום מיוחד"
                >
                  <Trash size={14} strokeWidth={1.5} />
                </Button>
              </div>
            ))}
            {pastDays.length > 5 && (
              <p className="text-foreground-muted text-xs text-center py-2">
                ועוד {pastDays.length - 5} ימים נוספים שעברו
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
