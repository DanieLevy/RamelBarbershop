'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Repeat, Plus, Trash2, User, Scissors, Clock, Calendar } from 'lucide-react'
import { useBugReporter } from '@/hooks/useBugReporter'
import { CreateRecurringModal } from '@/components/barber/CreateRecurringModal'
import { getRecurringByBarber, deleteRecurring } from '@/lib/services/recurring.service'
import type { RecurringAppointmentWithDetails, DayOfWeek } from '@/types/database'
import { DAY_OF_WEEK_HEBREW } from '@/types/database'

// Group recurring by day of week
const DAY_ORDER: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

interface GroupedRecurring {
  day: DayOfWeek
  dayHebrew: string
  items: RecurringAppointmentWithDetails[]
}

export default function RecurringPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('RecurringPage')
  
  const [recurring, setRecurring] = useState<RecurringAppointmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const fetchRecurring = useCallback(async () => {
    if (!barber?.id) return
    
    setLoading(true)
    try {
      const data = await getRecurringByBarber(barber.id)
      setRecurring(data)
    } catch (err) {
      console.error('Error fetching recurring:', err)
      await report(err instanceof Error ? err : new Error(String(err)), 'Fetching recurring appointments')
      toast.error('שגיאה בטעינת תורים קבועים')
    } finally {
      setLoading(false)
    }
  }, [barber?.id, report])

  useEffect(() => {
    if (barber?.id) {
      fetchRecurring()
    }
  }, [barber?.id, fetchRecurring])

  const handleDelete = async (id: string) => {
    if (!barber?.id) return
    if (!confirm('האם למחוק את התור הקבוע?')) return
    
    setDeletingId(id)
    try {
      const result = await deleteRecurring(id, barber.id)
      
      if (result.success) {
        toast.success('התור הקבוע נמחק בהצלחה')
        await fetchRecurring()
      } else {
        toast.error(result.error || 'שגיאה במחיקת התור הקבוע')
      }
    } catch (err) {
      console.error('Error deleting recurring:', err)
      await report(err instanceof Error ? err : new Error(String(err)), 'Deleting recurring appointment')
      toast.error('שגיאה במחיקת התור הקבוע')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreateSuccess = () => {
    setCreateModalOpen(false)
    fetchRecurring()
  }

  // Group recurring by day of week
  const groupedRecurring: GroupedRecurring[] = DAY_ORDER
    .map(day => ({
      day,
      dayHebrew: DAY_OF_WEEK_HEBREW[day],
      items: recurring.filter(r => r.day_of_week === day),
    }))
    .filter(group => group.items.length > 0)

  const formatTimeSlot = (timeSlot: string): string => {
    // Strip seconds if present (HH:MM:SS -> HH:MM)
    // PostgreSQL TIME type returns HH:MM:SS format
    return timeSlot.substring(0, 5)
  }

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
            <Repeat size={24} className="text-accent-gold" />
            תורים קבועים מראש
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            נהל תורים קבועים שחוזרים על עצמם כל שבוע
          </p>
        </div>
        
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90 transition-colors"
        >
          <Plus size={18} />
          <span>הוסף תור קבוע</span>
        </button>
      </div>

      {/* Stats - Horizontal Row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[140px] bg-background-card rounded-xl px-4 py-3 border border-white/5">
          <div className="flex items-center gap-2">
            <Repeat size={16} className="text-accent-gold" />
            <span className="text-xl font-bold text-accent-gold">{recurring.length}</span>
          </div>
          <div className="text-xs text-foreground-muted mt-0.5">תורים פעילים</div>
        </div>
        <div className="flex-1 min-w-[140px] bg-background-card rounded-xl px-4 py-3 border border-white/5">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-foreground-light" />
            <span className="text-xl font-bold text-foreground-light">{groupedRecurring.length}</span>
          </div>
          <div className="text-xs text-foreground-muted mt-0.5">
            {groupedRecurring.length > 0 
              ? groupedRecurring.map(g => g.dayHebrew).join(', ')
              : 'אין ימים'}
          </div>
        </div>
        <div className="flex-1 min-w-[140px] bg-background-card rounded-xl px-4 py-3 border border-white/5">
          <div className="flex items-center gap-2">
            <User size={16} className="text-foreground-light" />
            <span className="text-xl font-bold text-foreground-light">
              {new Set(recurring.map(r => r.customer_id)).size}
            </span>
          </div>
          <div className="text-xs text-foreground-muted mt-0.5">לקוחות קבועים</div>
        </div>
      </div>

      {/* Recurring List */}
      {recurring.length === 0 ? (
        <div className="bg-background-card rounded-2xl p-8 text-center border border-white/5">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Repeat size={32} className="text-foreground-muted" />
          </div>
          <h3 className="text-lg font-medium text-foreground-light mb-2">
            אין תורים קבועים
          </h3>
          <p className="text-sm text-foreground-muted mb-4">
            הוסף תורים קבועים כדי לשמור מקום אוטומטית ללקוחות שמגיעים באותו יום ושעה כל שבוע
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90 transition-colors"
          >
            <Plus size={18} />
            <span>הוסף תור קבוע</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedRecurring.map(group => (
            <div key={group.day}>
              {/* Day Header - Compact */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <Calendar size={14} className="text-accent-gold" />
                <span className="text-sm font-medium text-foreground-light">יום {group.dayHebrew}</span>
                <span className="text-xs text-foreground-muted">({group.items.length})</span>
              </div>
              
              {/* Items - Compact Landscape Cards */}
              <div className="space-y-2">
                {group.items.map(item => (
                  <div
                    key={item.id}
                    className="bg-background-card rounded-xl border border-white/5 px-4 py-2.5 flex items-center gap-4"
                  >
                    {/* Time Badge */}
                    <div className="flex items-center gap-1.5 bg-accent-gold/10 text-accent-gold px-2.5 py-1 rounded-lg min-w-[70px] justify-center">
                      <Clock size={12} />
                      <span className="text-sm font-medium">{formatTimeSlot(item.time_slot)}</span>
                    </div>
                    
                    {/* Customer & Service - Inline */}
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-1.5 text-foreground-light truncate">
                        <User size={14} className="text-foreground-muted flex-shrink-0" />
                        <span className="text-sm truncate">{(item.customers as { fullname: string })?.fullname || 'לקוח'}</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 text-foreground-muted">
                        <Scissors size={12} />
                        <span className="text-xs">{(item.services as { name_he: string })?.name_he || 'שירות'}</span>
                      </div>
                      {item.notes && (
                        <span className="hidden md:inline text-xs text-foreground-muted/70 italic truncate">
                          {item.notes}
                        </span>
                      )}
                    </div>
                    
                    {/* Delete Button - Compact */}
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className={cn(
                        'flex items-center justify-center p-2 rounded-lg transition-colors flex-shrink-0',
                        deletingId === item.id
                          ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
                          : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      )}
                      aria-label="מחק תור קבוע"
                    >
                      {deletingId === item.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateRecurringModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        barberId={barber?.id || ''}
      />
    </div>
  )
}
