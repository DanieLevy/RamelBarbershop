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
    // Time slot is in HH:MM format, just return as-is
    return timeSlot
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-background-card rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-accent-gold">{recurring.length}</div>
          <div className="text-sm text-foreground-muted">תורים קבועים פעילים</div>
        </div>
        <div className="bg-background-card rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-foreground-light">{groupedRecurring.length}</div>
          <div className="text-sm text-foreground-muted">ימים עם תורים קבועים</div>
        </div>
        <div className="bg-background-card rounded-xl p-4 border border-white/5 col-span-2 sm:col-span-1">
          <div className="text-2xl font-bold text-foreground-light">
            {new Set(recurring.map(r => r.customer_id)).size}
          </div>
          <div className="text-sm text-foreground-muted">לקוחות קבועים</div>
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
        <div className="space-y-6">
          {groupedRecurring.map(group => (
            <div key={group.day} className="bg-background-card rounded-2xl border border-white/5 overflow-hidden">
              {/* Day Header */}
              <div className="bg-white/5 px-4 py-3 flex items-center gap-2">
                <Calendar size={18} className="text-accent-gold" />
                <h2 className="font-medium text-foreground-light">
                  יום {group.dayHebrew}
                </h2>
                <span className="text-sm text-foreground-muted">
                  ({group.items.length} תורים)
                </span>
              </div>
              
              {/* Items */}
              <div className="divide-y divide-white/5">
                {group.items.map(item => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1 space-y-2">
                      {/* Time */}
                      <div className="flex items-center gap-2 text-accent-gold font-medium">
                        <Clock size={16} />
                        <span className="text-lg">{formatTimeSlot(item.time_slot)}</span>
                      </div>
                      
                      {/* Customer */}
                      <div className="flex items-center gap-2 text-foreground-light">
                        <User size={16} className="text-foreground-muted" />
                        <span>{(item.customers as { fullname: string })?.fullname || 'לקוח לא ידוע'}</span>
                      </div>
                      
                      {/* Service */}
                      <div className="flex items-center gap-2 text-foreground-muted text-sm">
                        <Scissors size={14} />
                        <span>{(item.services as { name_he: string })?.name_he || 'שירות'}</span>
                      </div>
                      
                      {/* Notes */}
                      {item.notes && (
                        <p className="text-sm text-foreground-muted italic mt-1">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                          deletingId === item.id
                            ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        )}
                      >
                        {deletingId === item.id ? (
                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        <span>מחק</span>
                      </button>
                    </div>
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
