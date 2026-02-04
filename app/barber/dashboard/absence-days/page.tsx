'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Trash, Calendar, CalendarOff, CalendarX } from 'lucide-react'
import type { BarberClosure } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

export default function AbsenceDaysPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('AbsenceDaysPage')
  
  const [closures, setClosures] = useState<BarberClosure[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [isSingleDate, setIsSingleDate] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const fetchClosures = useCallback(async () => {
    if (!barber?.id) return
    
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('barber_closures')
      .select('*')
      .eq('barber_id', barber.id)
      .order('start_date', { ascending: true })
    
    if (error) {
      console.error('Error fetching closures:', error)
      await report(new Error(error.message), 'Fetching barber closures')
    }
    
    setClosures((data as BarberClosure[]) || [])
    setLoading(false)
  }, [barber?.id, report])

  useEffect(() => {
    fetchClosures()
  }, [fetchClosures])

  const handleAddClosure = async () => {
    if (!barber?.id) return
    
    if (!startDate) {
      toast.error('נא לבחור תאריך')
      return
    }
    
    // For single date, use the same start and end date
    const effectiveEndDate = isSingleDate ? startDate : endDate
    
    if (!isSingleDate && !endDate) {
      toast.error('נא לבחור תאריך סיום')
      return
    }
    
    if (!isSingleDate && new Date(startDate) > new Date(effectiveEndDate)) {
      toast.error('תאריך התחלה לא יכול להיות אחרי תאריך הסיום')
      return
    }
    
    setSaving(true)
    const supabase = createClient()
    
    const { error } = await supabase.from('barber_closures').insert({
      barber_id: barber.id,
      start_date: startDate,
      end_date: effectiveEndDate,
      reason: reason || null,
    })
    
    if (error) {
      console.error('Error adding closure:', error)
      await report(new Error(error.message), 'Adding barber closure')
      toast.error('שגיאה בהוספת יום היעדרות')
    } else {
      toast.success('יום ההיעדרות נוסף בהצלחה!')
      setShowForm(false)
      setStartDate('')
      setEndDate('')
      setReason('')
      setIsSingleDate(true)
      fetchClosures()
    }
    
    setSaving(false)
  }

  const handleDeleteClosure = async (id: string) => {
    if (!confirm('האם למחוק את יום ההיעדרות?')) return
    
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
      fetchClosures()
    }
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const isUpcoming = (endDateStr: string): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(endDateStr) >= today
  }

  const isSameDayRange = (startDateStr: string, endDateStr: string): boolean => {
    return startDateStr === endDateStr
  }

  // Separate upcoming and past closures
  const upcomingClosures = closures.filter(c => isUpcoming(c.end_date))
  const pastClosures = closures.filter(c => !isUpcoming(c.end_date))

  // Statistics
  const totalClosures = closures.length
  const upcomingCount = upcomingClosures.length
  const pastCount = pastClosures.length

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
          <h1 className="text-2xl font-bold text-foreground-light">ימי היעדרות</h1>
          <p className="text-foreground-muted text-sm mt-1">
            נהל את ימי ההיעדרות שלך - הלקוחות לא יוכלו לקבוע תורים בימים אלו
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-xl text-sm font-medium hover:bg-accent-gold/90 transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          הוסף יום היעדרות
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-background-card border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground-light">{totalClosures}</div>
          <div className="text-foreground-muted text-xs">סה״כ ימי היעדרות</div>
        </div>
        <div className="bg-background-card border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-accent-gold">{upcomingCount}</div>
          <div className="text-foreground-muted text-xs">קרובים</div>
        </div>
        <div className="bg-background-card border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground-muted">{pastCount}</div>
          <div className="text-foreground-muted text-xs">שעברו</div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
            <CalendarOff size={20} strokeWidth={1.5} className="text-accent-gold" />
            הוספת יום היעדרות
          </h3>
          
          {/* Date Type Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setIsSingleDate(true)}
              className={cn(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                isSingleDate
                  ? 'bg-accent-gold text-background-dark'
                  : 'bg-background-dark border border-white/10 text-foreground-muted hover:text-foreground-light'
              )}
            >
              יום בודד
            </button>
            <button
              type="button"
              onClick={() => setIsSingleDate(false)}
              className={cn(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                !isSingleDate
                  ? 'bg-accent-gold text-background-dark'
                  : 'bg-background-dark border border-white/10 text-foreground-muted hover:text-foreground-light'
              )}
            >
              טווח תאריכים
            </button>
          </div>

          {/* Date Inputs */}
          <div className={cn('grid gap-4 mb-4', isSingleDate ? 'grid-cols-1' : 'grid-cols-2')}>
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">
                {isSingleDate ? 'תאריך' : 'מתאריך'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm"
              />
            </div>
            {!isSingleDate && (
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm">עד תאריך</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || new Date().toISOString().split('T')[0]}
                  className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm"
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="flex flex-col gap-2 mb-4">
            <label className="text-foreground-light text-sm">סיבה (אופציונלי - מוצג ללקוחות)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: חופשה, אירוע משפחתי..."
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-sm placeholder:text-foreground-muted"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleAddClosure}
              disabled={saving}
              className="flex-1 py-3 bg-accent-gold text-background-dark rounded-xl text-sm font-medium hover:bg-accent-gold/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'שומר...' : 'שמור'}
            </button>
            <button
              onClick={() => {
                setShowForm(false)
                setStartDate('')
                setEndDate('')
                setReason('')
                setIsSingleDate(true)
              }}
              className="px-6 py-3 bg-background-dark border border-white/10 text-foreground-muted rounded-xl text-sm hover:text-foreground-light transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Closures */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <Calendar size={20} strokeWidth={1.5} className="text-accent-gold" />
          ימי היעדרות קרובים
        </h3>
        
        {upcomingClosures.length === 0 ? (
          <div className="text-center py-8">
            <CalendarX size={40} strokeWidth={1} className="text-foreground-muted mx-auto mb-3 opacity-50" />
            <p className="text-foreground-muted text-sm">אין ימי היעדרות מתוכננים</p>
            <p className="text-foreground-muted text-xs mt-1">
              לחץ על &quot;הוסף יום היעדרות&quot; להוספת יום חדש
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingClosures.map((closure) => (
              <div
                key={closure.id}
                className="flex items-center justify-between p-4 rounded-xl bg-background-dark border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-gold/10 flex items-center justify-center">
                    <CalendarOff size={20} strokeWidth={1.5} className="text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-foreground-light font-medium">
                      {isSameDayRange(closure.start_date, closure.end_date) ? (
                        formatDate(closure.start_date)
                      ) : (
                        <>
                          {formatDate(closure.start_date)} — {formatDate(closure.end_date)}
                        </>
                      )}
                    </p>
                    {closure.reason && (
                      <p className="text-foreground-muted text-sm">{closure.reason}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteClosure(closure.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  aria-label="מחק יום היעדרות"
                >
                  <Trash size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Closures */}
      {pastClosures.length > 0 && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-6 opacity-70">
          <h3 className="text-lg font-medium text-foreground-muted mb-4 flex items-center gap-2">
            <CalendarX size={20} strokeWidth={1.5} className="text-foreground-muted" />
            ימי היעדרות שעברו
          </h3>
          
          <div className="space-y-2">
            {pastClosures.slice(0, 5).map((closure) => (
              <div
                key={closure.id}
                className="flex items-center justify-between p-3 rounded-xl bg-background-dark/50 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <CalendarOff size={16} strokeWidth={1.5} className="text-foreground-muted" />
                  </div>
                  <div>
                    <p className="text-foreground-muted text-sm">
                      {isSameDayRange(closure.start_date, closure.end_date) ? (
                        formatDate(closure.start_date)
                      ) : (
                        <>
                          {formatDate(closure.start_date)} — {formatDate(closure.end_date)}
                        </>
                      )}
                    </p>
                    {closure.reason && (
                      <p className="text-foreground-muted/70 text-xs">{closure.reason}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteClosure(closure.id)}
                  className="p-1.5 text-foreground-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  aria-label="מחק יום היעדרות"
                >
                  <Trash size={14} strokeWidth={1.5} />
                </button>
              </div>
            ))}
            {pastClosures.length > 5 && (
              <p className="text-foreground-muted text-xs text-center py-2">
                ועוד {pastClosures.length - 5} ימי היעדרות נוספים שעברו
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
