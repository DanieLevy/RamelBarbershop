'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Plus, Trash, Calendar } from 'lucide-react'
import type { BarbershopClosure } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

export default function ClosuresPage() {
  const router = useRouter()
  const { isAdmin } = useBarberAuthStore()
  const { report } = useBugReporter('ClosuresPage')
  
  const [closures, setClosures] = useState<BarbershopClosure[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const fetchClosures = useCallback(async () => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('barbershop_closures')
      .select('*')
      .order('start_date', { ascending: true })
    
    if (error) {
      console.error('Error fetching closures:', error)
      await report(new Error(error.message), 'Fetching barbershop closures')
    }
    
    setClosures((data as BarbershopClosure[]) || [])
    setLoading(false)
  }, [report])

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/barber/dashboard')
      return
    }
    fetchClosures()
  }, [isAdmin, router, fetchClosures])

  const handleAdd = async () => {
    if (!startDate || !endDate) {
      showToast.error('נא לבחור תאריכי התחלה וסיום')
      return
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      showToast.error('תאריך התחלה לא יכול להיות אחרי תאריך הסיום')
      return
    }
    
    setSaving(true)
    const supabase = createClient()
    
    const { error } = await supabase.from('barbershop_closures')
      .insert({
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
      })
    
    if (error) {
      console.error('Error adding closure:', error)
      await report(new Error(error.message), 'Adding barbershop closure')
      showToast.error('שגיאה בהוספת יום סגירה')
    } else {
      showToast.success('יום הסגירה נוסף בהצלחה!')
      setShowForm(false)
      setStartDate('')
      setEndDate('')
      setReason('')
      fetchClosures()
    }
    
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק את יום הסגירה?')) return
    
    const supabase = createClient()
    
    const { error } = await supabase
      .from('barbershop_closures')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting closure:', error)
      await report(new Error(error.message), 'Deleting barbershop closure')
      showToast.error('שגיאה במחיקה')
    } else {
      showToast.success('נמחק בהצלחה')
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

  const isUpcoming = (endDate: string): boolean => {
    return new Date(endDate) >= new Date()
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
          <h1 className="text-2xl font-medium text-foreground-light">ימי סגירה</h1>
          <p className="text-foreground-muted mt-1">הגדר תאריכים בהם המספרה סגורה</p>
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
          <h3 className="text-lg font-medium text-foreground-light mb-4">הוסף תאריך סגירה</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">מתאריך</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">עד תאריך</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            <label className="text-foreground-light text-sm">סיבה (אופציונלי)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: חופשת חגים"
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

      {/* Closures List */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        {closures.length === 0 ? (
          <div className="text-center py-8">
            <Calendar size={48} strokeWidth={1.5} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted">אין ימי סגירה מוגדרים</p>
          </div>
        ) : (
          <div className="space-y-3">
            {closures.map((closure) => (
              <div
                key={closure.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border',
                  isUpcoming(closure.end_date)
                    ? 'bg-background-dark border-white/5'
                    : 'bg-background-dark/50 border-white/5 opacity-60'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    isUpcoming(closure.end_date)
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-foreground-muted/20 text-foreground-muted'
                  )}>
                    <Calendar size={20} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-foreground-light font-medium">
                      {formatDate(closure.start_date)}
                      {closure.start_date !== closure.end_date && (
                        <> - {formatDate(closure.end_date)}</>
                      )}
                    </p>
                    {closure.reason && (
                      <p className="text-foreground-muted text-sm">{closure.reason}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(closure.id)}
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

