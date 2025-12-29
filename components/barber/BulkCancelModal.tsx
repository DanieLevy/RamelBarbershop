'use client'

import { useState } from 'react'
import { X, AlertTriangle, Calendar, Users } from 'lucide-react'
import { cn, formatDateHebrew } from '@/lib/utils'

interface ReservationSummary {
  id: string
  customer_name: string
  time_timestamp: number
}

interface BulkCancelModalProps {
  isOpen: boolean
  reservations: ReservationSummary[]
  selectedDate: Date | null
  onClose: () => void
  onConfirm: (reason?: string) => Promise<void>
  isLoading?: boolean
}

export function BulkCancelModal({
  isOpen,
  reservations,
  selectedDate,
  onClose,
  onConfirm,
  isLoading = false,
}: BulkCancelModalProps) {
  const [reason, setReason] = useState('')

  if (!isOpen || reservations.length === 0) return null

  const handleConfirm = async () => {
    await onConfirm(reason.trim() || undefined)
    setReason('')
  }

  const handleClose = () => {
    setReason('')
    onClose()
  }

  // Get unique customer names
  const uniqueCustomers = [...new Set(reservations.map(r => r.customer_name))]

  return (
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
            <h2 className="text-lg font-medium text-foreground-light">ביטול כל התורים ביום</h2>
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
          {/* Summary Box */}
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <h3 className="text-foreground-light font-medium mb-3">סיכום:</h3>
            
            <div className="space-y-2 text-sm">
              {/* Date */}
              <div className="flex items-center gap-2">
                <Calendar size={16} strokeWidth={1.5} className="text-red-400" />
                <span className="text-foreground-muted">יום:</span>
                <span className="text-foreground-light">
                  {selectedDate ? formatDateHebrew(selectedDate.getTime()) : ''}
                </span>
              </div>
              
              {/* Count */}
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 flex items-center justify-center text-red-400 font-bold text-xs">
                  #
                </span>
                <span className="text-foreground-muted">מספר תורים:</span>
                <span className="text-foreground-light font-medium">{reservations.length}</span>
              </div>
              
              {/* Customers */}
              <div className="flex items-start gap-2">
                <Users size={16} strokeWidth={1.5} className="text-red-400 mt-0.5" />
                <span className="text-foreground-muted">לקוחות שיושפעו:</span>
                <span className="text-foreground-light">{uniqueCustomers.length}</span>
              </div>
            </div>
            
            {/* Customer List */}
            {uniqueCustomers.length <= 5 && (
              <div className="mt-3 pt-3 border-t border-red-500/20">
                <p className="text-foreground-muted text-xs mb-2">רשימת לקוחות:</p>
                <div className="flex flex-wrap gap-1">
                  {uniqueCustomers.map((name, i) => (
                    <span 
                      key={i}
                      className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Warning */}
          <p className="text-amber-400 text-sm mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            ⚠️ פעולה זו תבטל את כל {reservations.length} התורים ביום זה. הלקוחות יוכלו לראות את סיבת הביטול.
          </p>
          
          {/* Reason Input */}
          <div className="mb-4">
            <label className="text-foreground-light text-sm block mb-2">
              סיבת הביטול <span className="text-foreground-muted">(משותפת לכל התורים)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: יום חופש, מחלה, סגירה זמנית..."
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
              `אישור - בטל ${reservations.length} תורים`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

