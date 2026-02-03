'use client'

import { useState } from 'react'
import { X, AlertTriangle, Calendar, Clock } from 'lucide-react'
import { cn, formatTime, formatDateHebrew } from '@/lib/utils'
import { Portal } from '@/components/ui/Portal'

interface ReservationInfo {
  id: string
  customer_name: string
  customer_phone: string
  time_timestamp: number
  services?: { name_he: string } | null
}

interface CancelReservationModalProps {
  isOpen: boolean
  reservation: ReservationInfo | null
  onClose: () => void
  onConfirm: (reason?: string) => Promise<void>
  isLoading?: boolean
}

export function CancelReservationModal({
  isOpen,
  reservation,
  onClose,
  onConfirm,
  isLoading = false,
}: CancelReservationModalProps) {
  const [reason, setReason] = useState('')

  if (!isOpen || !reservation) return null

  const handleConfirm = async () => {
    await onConfirm(reason.trim() || undefined)
    setReason('')
  }

  const handleClose = () => {
    setReason('')
    onClose()
  }

  // Normalize timestamp
  const normalizeTs = (ts: number): number => {
    if (ts < 946684800000) return ts * 1000
    return ts
  }

  const timestamp = normalizeTs(reservation.time_timestamp)

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-background-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-red-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle size={20} strokeWidth={1.5} className="text-red-400" />
            </div>
            <h2 className="text-lg font-medium text-foreground-light">ביטול תור</h2>
          </div>
          <button
            onClick={handleClose}
            className="icon-btn p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="סגור"
          >
            <X size={20} strokeWidth={1.5} className="text-foreground-muted" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-5">
          {/* Customer Info */}
          <div className="mb-4 p-4 rounded-xl bg-background-dark border border-white/5">
            <p className="text-foreground-light font-medium text-lg mb-2">
              {reservation.customer_name}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-foreground-muted">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} strokeWidth={1.5} />
                {formatDateHebrew(timestamp)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} strokeWidth={1.5} />
                {formatTime(timestamp)}
              </span>
            </div>
            {reservation.services?.name_he && (
              <p className="text-sm text-accent-gold mt-2">
                {reservation.services.name_he}
              </p>
            )}
          </div>
          
          <p className="text-foreground-muted text-sm mb-4">
            האם אתה בטוח שברצונך לבטל את התור? הלקוח יוכל לראות שהתור בוטל.
          </p>
          
          {/* Reason Input */}
          <div className="mb-4">
            <label className="text-foreground-light text-sm block mb-2">
              סיבת הביטול <span className="text-foreground-muted">(אופציונלי)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: יום חופש, מחלה, שינוי בלוח הזמנים..."
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-red-500/50 resize-none text-sm"
              rows={3}
              maxLength={200}
            />
            <p className="text-foreground-muted text-xs mt-1 text-left">
              {reason.length}/200
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-white/10 bg-background-dark/50">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-foreground-light font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              'flex-1 py-3 px-4 rounded-xl font-medium transition-all',
              isLoading
                ? 'bg-red-500/30 text-red-300 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600'
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                מבטל...
              </span>
            ) : (
              'אישור ביטול'
            )}
          </button>
        </div>
      </div>
      </div>
    </Portal>
  )
}

