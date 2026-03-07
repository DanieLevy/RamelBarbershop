'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Plus, Trash, CalendarPlus, Calendar } from 'lucide-react'
import type { ShopSpecialDay } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

export default function ShopSpecialDaysPage() {
  const router = useRouter()
  const { barber, isAdmin } = useBarberAuthStore()
  const { report } = useBugReporter('ShopSpecialDaysPage')

  const [specialDays, setSpecialDays] = useState<ShopSpecialDay[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('14:00')
  const [reason, setReason] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const fetchSpecialDays = useCallback(async () => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('shop_special_days')
      .select('id, date, start_time, end_time, reason, created_at')
      .order('date', { ascending: true })

    if (error) {
      console.error('Error fetching shop special days:', error)
      await report(new Error(error.message), 'Fetching shop special days')
    }

    setSpecialDays((data as ShopSpecialDay[]) || [])
    setLoading(false)
  }, [report])

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/barber/dashboard')
      return
    }
    fetchSpecialDays()
  }, [isAdmin, router, fetchSpecialDays])

  const handleAdd = async () => {
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
      const res = await fetch('/api/barber/shop-special-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: barber?.id,
          date,
          startTime,
          endTime,
          reason: reason || null,
        }),
      })
      const result = await res.json()

      if (!result.success) {
        if (result.error === 'DUPLICATE') {
          showToast.error('כבר קיים יום פתיחה מיוחד לתאריך זה')
        } else {
          console.error('Error adding shop special day:', result.message)
          await report(new Error(result.message || 'Shop special day add failed'), 'Adding shop special day')
          showToast.error('שגיאה בהוספת יום פתיחה מיוחד')
        }
      } else {
        showToast.success('יום הפתיחה המיוחד נוסף בהצלחה!')
        setShowForm(false)
        setDate('')
        setStartTime('09:00')
        setEndTime('14:00')
        setReason('')
        fetchSpecialDays()
      }
    } catch (err) {
      console.error('Error adding shop special day:', err)
      await report(err, 'Adding shop special day')
      showToast.error('שגיאה בהוספת יום פתיחה מיוחד')
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק את יום הפתיחה המיוחד?')) return

    try {
      const res = await fetch('/api/barber/shop-special-days', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barberId: barber?.id, id }),
      })
      const result = await res.json()

      if (!result.success) {
        console.error('Error deleting shop special day:', result.message)
        await report(new Error(result.message || 'Shop special day delete failed'), 'Deleting shop special day')
        showToast.error('שגיאה במחיקה')
      } else {
        showToast.success('נמחק בהצלחה')
        fetchSpecialDays()
      }
    } catch (err) {
      console.error('Error deleting shop special day:', err)
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground-light">ימי פתיחה מיוחדים</h1>
          <p className="text-foreground-muted mt-1">הגדר תאריכים בהם המספרה פתוחה, גם אם הם מחוץ לימי הפתיחה הרגילים</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-lg font-medium hover:bg-accent-gold/90 transition-colors"
        >
          <Plus size={16} strokeWidth={1.5} />
          הוסף
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
            <CalendarPlus size={20} strokeWidth={1.5} className="text-accent-gold" />
            הוסף יום פתיחה מיוחד
          </h3>

          <div className="flex flex-col gap-2 mb-4">
            <label className="text-foreground-light text-sm">תאריך</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={today}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">שעת פתיחה</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">שעת סגירה</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            <label className="text-foreground-light text-sm">הערה (אופציונלי)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: ערב פורים, ערב פסח..."
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={saving}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center',
                saving
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {saving ? 'שומר...' : 'שמור'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-6 py-3 rounded-xl bg-background-dark border border-white/10 text-foreground-muted hover:text-foreground-light transition-colors flex items-center justify-center"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Special Days List */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        {specialDays.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={48} strokeWidth={1.5} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted">אין ימי פתיחה מיוחדים מוגדרים</p>
          </div>
        ) : (
          <div className="space-y-3">
            {specialDays.map((day) => (
              <div
                key={day.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border',
                  isUpcoming(day.date)
                    ? 'bg-background-dark border-white/5'
                    : 'bg-background-dark/50 border-white/5 opacity-60'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    isUpcoming(day.date)
                      ? 'bg-accent-gold/10 text-accent-gold'
                      : 'bg-foreground-muted/20 text-foreground-muted'
                  )}>
                    <CalendarPlus size={20} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-foreground-light font-medium">{formatDate(day.date)}</p>
                    <p className="text-foreground-muted text-sm">
                      {day.start_time.slice(0, 5)} — {day.end_time.slice(0, 5)}
                      {day.reason && ` · ${day.reason}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(day.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center"
                  title="מחק"
                >
                  <Trash size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
