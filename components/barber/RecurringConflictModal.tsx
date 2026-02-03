'use client'

import { useState } from 'react'
import { X, AlertTriangle, Calendar, Clock, User, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/Portal'
import type { ConflictingReservation } from '@/lib/services/recurring.service'

interface RecurringConflictModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  conflicts: ConflictingReservation[]
  dayLabel: string
  timeSlot: string
}

export function RecurringConflictModal({
  isOpen,
  onClose,
  onConfirm,
  conflicts,
  dayLabel,
  timeSlot,
}: RecurringConflictModalProps) {
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-modal-title"
      >
        <div
          className="bg-background-card rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-red-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="text-red-400" size={20} />
              </div>
              <div>
                <h2 id="conflict-modal-title" className="text-lg font-semibold text-foreground-light">
                  נמצאו תורים מתנגשים
                </h2>
                <p className="text-xs text-foreground-muted">
                  יום {dayLabel} בשעה {timeSlot}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="סגור"
            >
              <X size={20} className="text-foreground-muted" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-sm text-foreground-muted">
              קיימים {conflicts.length} תורים רגילים שמתנגשים עם התור הקבוע החדש. 
              כדי להמשיך, יש לבטל את התורים הבאים:
            </p>

            {/* Conflicts List */}
            <div className="space-y-2">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5"
                >
                  {/* Date Badge */}
                  <div className="flex flex-col items-center bg-red-500/10 text-red-400 px-3 py-2 rounded-lg min-w-[80px]">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span className="text-xs font-medium">{conflict.dateFormatted}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      <span className="text-xs">{conflict.time}</span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-foreground-light">
                      <User size={14} className="text-foreground-muted flex-shrink-0" />
                      <span className="text-sm truncate">{conflict.customer_name}</span>
                    </div>
                  </div>

                  {/* Will be cancelled indicator */}
                  <div className="flex items-center gap-1 text-xs text-red-400/70">
                    <Trash2 size={12} />
                    <span>יבוטל</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/90">
                שים לב: ביטול התורים הוא סופי. הלקוחות יקבלו הודעה על הביטול.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-white/5 bg-background-dark/30">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl font-medium text-foreground-muted bg-white/5 hover:bg-white/10 transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
                loading
                  ? 'bg-red-500/50 text-red-200 cursor-not-allowed'
                  : 'bg-red-500 text-white hover:bg-red-600'
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>מבטל תורים...</span>
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  <span>בטל וצור קבוע</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
