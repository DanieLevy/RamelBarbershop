'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Coffee, Plus, Trash2, Clock, Calendar, AlertCircle, Repeat, X } from 'lucide-react'
import { useBugReporter } from '@/hooks/useBugReporter'
import type { BarberBreakout, BreakoutType, DayOfWeek } from '@/types/database'
import { DAY_OF_WEEK_HEBREW_MAP } from '@/lib/services/breakout.service'
import { Button } from '@heroui/react'

// Day order for grouping recurring breakouts
const DAY_ORDER: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

interface ConflictingReservation {
  id: string
  customerName: string
  time: string
  date: string
  serviceName: string
}

interface CreateBreakoutForm {
  breakoutType: BreakoutType
  startTime: string
  endTime: string
  startDate: string
  endDate: string
  dayOfWeek: DayOfWeek
  reason: string
}

const BREAKOUT_TYPE_LABELS: Record<BreakoutType, string> = {
  single: 'חד פעמי',
  date_range: 'טווח תאריכים',
  recurring: 'קבוע',
}

const BREAKOUT_TYPE_ICONS: Record<BreakoutType, React.ReactNode> = {
  single: <Calendar size={14} />,
  date_range: <Calendar size={14} />,
  recurring: <Repeat size={14} />,
}

export default function BreakoutsPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('BreakoutsPage')
  
  const [breakouts, setBreakouts] = useState<BarberBreakout[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictingReservation[]>([])
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<CreateBreakoutForm | null>(null)
  
  const [form, setForm] = useState<CreateBreakoutForm>({
    breakoutType: 'single',
    startTime: '12:00',
    endTime: '13:00',
    startDate: '',
    endDate: '',
    dayOfWeek: 'sunday',
    reason: '',
  })

  const fetchBreakouts = useCallback(async () => {
    if (!barber?.id) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/breakouts?barberId=${barber.id}`)
      const data = await res.json()
      
      if (data.success) {
        setBreakouts(data.data || [])
      } else {
        showToast.error('שגיאה בטעינת הפסקות')
        await report(new Error(data.message || 'Unknown error'), 'Fetching breakouts')
      }
    } catch (err) {
      console.error('Error fetching breakouts:', err)
      await report(err instanceof Error ? err : new Error(String(err)), 'Fetching breakouts')
      showToast.error('שגיאה בטעינת הפסקות')
    } finally {
      setLoading(false)
    }
  }, [barber?.id, report])

  useEffect(() => {
    if (barber?.id) {
      fetchBreakouts()
    }
  }, [barber?.id, fetchBreakouts])

  const handleSubmit = async (cancelConflicts = false) => {
    if (!barber?.id) return
    
    const formData = pendingFormData || form
    
    // Validation
    if (!formData.startTime) {
      showToast.error('נא לבחור שעת התחלה')
      return
    }
    
    if (formData.breakoutType === 'single' && !formData.startDate) {
      showToast.error('נא לבחור תאריך')
      return
    }
    
    if (formData.breakoutType === 'date_range') {
      if (!formData.startDate || !formData.endDate) {
        showToast.error('נא לבחור תאריכי התחלה וסיום')
        return
      }
      if (formData.endDate < formData.startDate) {
        showToast.error('תאריך סיום חייב להיות אחרי תאריך התחלה')
        return
      }
    }
    
    setSaving(true)
    setShowConflictModal(false)
    
    try {
      const res = await fetch('/api/breakouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: barber.id,
          breakoutType: formData.breakoutType,
          startTime: formData.startTime,
          endTime: formData.endTime || null,
          startDate: formData.breakoutType !== 'recurring' ? formData.startDate : undefined,
          endDate: formData.breakoutType === 'date_range' ? formData.endDate : undefined,
          dayOfWeek: formData.breakoutType === 'recurring' ? formData.dayOfWeek : undefined,
          reason: formData.reason || undefined,
          cancelConflicts,
        }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        showToast.success('ההפסקה נוספה בהצלחה')
        if (data.cancelledCount > 0) {
          showToast.info(`${data.cancelledCount} תורים בוטלו`)
        }
        setShowForm(false)
        setPendingFormData(null)
        setForm({
          breakoutType: 'single',
          startTime: '12:00',
          endTime: '13:00',
          startDate: '',
          endDate: '',
          dayOfWeek: 'sunday',
          reason: '',
        })
        await fetchBreakouts()
      } else if (data.error === 'CONFLICTS_EXIST' && data.conflicts) {
        // Show conflict modal
        setConflicts(data.conflicts)
        setPendingFormData(formData)
        setShowConflictModal(true)
      } else {
        showToast.error(data.message || 'שגיאה ביצירת הפסקה')
      }
    } catch (err) {
      console.error('Error creating breakout:', err)
      await report(err instanceof Error ? err : new Error(String(err)), 'Creating breakout')
      showToast.error('שגיאה ביצירת הפסקה')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!barber?.id) return
    if (!confirm('האם למחוק את ההפסקה?')) return
    
    setDeletingId(id)
    try {
      const res = await fetch('/api/breakouts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breakoutId: id, barberId: barber.id }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        showToast.success('ההפסקה נמחקה בהצלחה')
        await fetchBreakouts()
      } else {
        showToast.error(data.message || 'שגיאה במחיקת ההפסקה')
      }
    } catch (err) {
      console.error('Error deleting breakout:', err)
      await report(err instanceof Error ? err : new Error(String(err)), 'Deleting breakout')
      showToast.error('שגיאה במחיקת ההפסקה')
    } finally {
      setDeletingId(null)
    }
  }

  const formatTimeSlot = (time: string): string => {
    // Strip seconds if present
    return time.substring(0, 5)
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  const getBreakoutDescription = (breakout: BarberBreakout): string => {
    const timeRange = breakout.end_time 
      ? `${formatTimeSlot(breakout.start_time)} - ${formatTimeSlot(breakout.end_time)}`
      : `${formatTimeSlot(breakout.start_time)} עד סוף היום`
    
    switch (breakout.breakout_type) {
      case 'single':
        return `${formatDate(breakout.start_date!)} | ${timeRange}`
      case 'date_range':
        return `${formatDate(breakout.start_date!)} - ${formatDate(breakout.end_date!)} | ${timeRange}`
      case 'recurring':
        return `כל יום ${DAY_OF_WEEK_HEBREW_MAP[breakout.day_of_week as DayOfWeek]} | ${timeRange}`
      default:
        return timeRange
    }
  }

  // Group breakouts by type for stats
  const singleCount = breakouts.filter(b => b.breakout_type === 'single').length
  const dateRangeCount = breakouts.filter(b => b.breakout_type === 'date_range').length
  const recurringCount = breakouts.filter(b => b.breakout_type === 'recurring').length
  
  // Get recurring days
  const recurringDays = breakouts
    .filter(b => b.breakout_type === 'recurring')
    .map(b => DAY_OF_WEEK_HEBREW_MAP[b.day_of_week as DayOfWeek])

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground-light flex items-center gap-2">
            <Coffee size={24} className="text-amber-400" />
            הפסקות
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            נהל זמני הפסקה וחסימת שעות
          </p>
        </div>
        
        <Button
          onPress={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90"
        >
          <Plus size={18} />
          <span>הוסף הפסקה</span>
        </Button>
      </div>

      {/* Stats - Horizontal Row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px] bg-background-card rounded-xl px-4 py-3 border border-white/5">
          <div className="flex items-center gap-2">
            <Coffee size={16} className="text-amber-400" />
            <span className="text-xl font-bold text-amber-400">{breakouts.length}</span>
          </div>
          <div className="text-xs text-foreground-muted mt-0.5">סה״כ הפסקות</div>
        </div>
        <div className="flex-1 min-w-[140px] bg-background-card rounded-xl px-4 py-3 border border-white/5">
          <div className="flex items-center gap-2">
            <Repeat size={16} className="text-foreground-light" />
            <span className="text-xl font-bold text-foreground-light">{recurringCount}</span>
          </div>
          <div className="text-xs text-foreground-muted mt-0.5">
            {recurringDays.length > 0 ? recurringDays.join(', ') : 'הפסקות קבועות'}
          </div>
        </div>
        <div className="flex-1 min-w-[140px] bg-background-card rounded-xl px-4 py-3 border border-white/5">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-foreground-light" />
            <span className="text-xl font-bold text-foreground-light">{singleCount + dateRangeCount}</span>
          </div>
          <div className="text-xs text-foreground-muted mt-0.5">הפסקות זמניות</div>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-medium text-foreground-light mb-4">הוסף הפסקה חדשה</h2>
          
          {/* Breakout Type Selection */}
          <div className="mb-4">
            <label className="text-sm text-foreground-muted mb-2 block">סוג הפסקה</label>
            <div className="flex flex-wrap gap-2">
              {(['single', 'date_range', 'recurring'] as BreakoutType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setForm(f => ({ ...f, breakoutType: type }))}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    form.breakoutType === type
                      ? 'bg-accent-gold text-background-dark'
                      : 'bg-white/5 text-foreground-muted hover:bg-white/10'
                  )}
                >
                  {BREAKOUT_TYPE_ICONS[type]}
                  {BREAKOUT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
          
          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-foreground-muted mb-2 block">שעת התחלה</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-foreground-light focus:outline-none focus:border-accent-gold"
              />
            </div>
            <div>
              <label className="text-sm text-foreground-muted mb-2 block">שעת סיום (אופציונלי)</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-foreground-light focus:outline-none focus:border-accent-gold"
                placeholder="עד סוף היום"
              />
            </div>
          </div>
          
          {/* Date Selection - for single/date_range */}
          {form.breakoutType !== 'recurring' && (
            <div className={cn('grid gap-4 mb-4', form.breakoutType === 'date_range' ? 'grid-cols-2' : 'grid-cols-1')}>
              <div>
                <label className="text-sm text-foreground-muted mb-2 block">
                  {form.breakoutType === 'date_range' ? 'מתאריך' : 'תאריך'}
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-foreground-light focus:outline-none focus:border-accent-gold"
                />
              </div>
              {form.breakoutType === 'date_range' && (
                <div>
                  <label className="text-sm text-foreground-muted mb-2 block">עד תאריך</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-foreground-light focus:outline-none focus:border-accent-gold"
                  />
                </div>
              )}
            </div>
          )}
          
          {/* Day Selection - for recurring */}
          {form.breakoutType === 'recurring' && (
            <div className="mb-4">
              <label className="text-sm text-foreground-muted mb-2 block">יום בשבוע</label>
              <div className="flex flex-wrap gap-2">
                {DAY_ORDER.map(day => (
                  <button
                    key={day}
                    onClick={() => setForm(f => ({ ...f, dayOfWeek: day }))}
                    className={cn(
                      'px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                      form.dayOfWeek === day
                        ? 'bg-accent-gold text-background-dark'
                        : 'bg-white/5 text-foreground-muted hover:bg-white/10'
                    )}
                  >
                    {DAY_OF_WEEK_HEBREW_MAP[day]}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Reason */}
          <div className="mb-4">
            <label className="text-sm text-foreground-muted mb-2 block">סיבה (אופציונלי)</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="לדוגמא: צהריים, חתונה, וכו׳"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-foreground-light focus:outline-none focus:border-accent-gold placeholder:text-foreground-muted/50"
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onPress={() => handleSubmit()}
              isDisabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              <span>הוסף הפסקה</span>
            </Button>
            <Button
              variant="ghost"
              onPress={() => setShowForm(false)}
              isDisabled={saving}
              className="px-4 py-2.5 bg-white/5 text-foreground-muted rounded-xl font-medium hover:bg-white/10"
            >
              ביטול
            </Button>
          </div>
        </div>
      )}

      {/* Breakouts List */}
      {breakouts.length === 0 ? (
        <div className="bg-background-card rounded-2xl p-8 text-center border border-white/5">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Coffee size={32} className="text-foreground-muted" />
          </div>
          <h3 className="text-lg font-medium text-foreground-light mb-2">
            אין הפסקות
          </h3>
          <p className="text-sm text-foreground-muted mb-4">
            הוסף הפסקות כדי לחסום שעות ללקוחות - לצהריים, אירועים, או יציאה מוקדמת
          </p>
          <Button
            onPress={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90"
          >
            <Plus size={18} />
            <span>הוסף הפסקה</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {breakouts.map(breakout => (
            <div
              key={breakout.id}
              className="bg-background-card rounded-xl border border-white/5 px-4 py-3 flex items-center gap-4"
            >
              {/* Type Badge */}
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg min-w-[80px] justify-center',
                breakout.breakout_type === 'recurring'
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'bg-amber-500/10 text-amber-400'
              )}>
                {BREAKOUT_TYPE_ICONS[breakout.breakout_type as BreakoutType]}
                <span className="text-xs font-medium">{BREAKOUT_TYPE_LABELS[breakout.breakout_type as BreakoutType]}</span>
              </div>
              
              {/* Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-foreground-light">
                  <Clock size={14} className="text-foreground-muted flex-shrink-0" />
                  <span className="text-sm truncate">{getBreakoutDescription(breakout)}</span>
                </div>
                {breakout.reason && (
                  <div className="text-xs text-foreground-muted mt-0.5 truncate">
                    {breakout.reason}
                  </div>
                )}
              </div>
              
              {/* Delete Button */}
              <Button
                variant="ghost"
                isIconOnly
                onPress={() => handleDelete(breakout.id)}
                isDisabled={deletingId === breakout.id}
                className={cn(
                  'min-w-[36px] w-9 h-9 rounded-lg flex-shrink-0',
                  deletingId === breakout.id
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                )}
                aria-label="מחק הפסקה"
              >
                {deletingId === breakout.id ? (
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Conflict Modal */}
      {showConflictModal && conflicts.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background-card rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto border border-white/10">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle size={20} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground-light">קיימים תורים בשעות אלו</h3>
                  <p className="text-sm text-foreground-muted">יש לבטל את התורים הבאים כדי להמשיך</p>
                </div>
              </div>
              
              <div className="space-y-2 mb-6">
                {conflicts.map(conflict => (
                  <div
                    key={conflict.id}
                    className="bg-white/5 rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-foreground-light">{conflict.customerName}</div>
                      <div className="text-xs text-foreground-muted">
                        {conflict.date} | {conflict.time} | {conflict.serviceName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3">
                <Button
                  onPress={() => handleSubmit(true)}
                  isDisabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-500/90"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                  <span>בטל תורים והמשך</span>
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => {
                    setShowConflictModal(false)
                    setPendingFormData(null)
                    setConflicts([])
                  }}
                  isDisabled={saving}
                  className="px-4 py-2.5 bg-white/5 text-foreground-muted rounded-xl font-medium hover:bg-white/10 flex items-center gap-2"
                >
                  <X size={18} />
                  ביטול
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
