'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Calendar, Clock } from 'lucide-react'
import { formatTime, formatDateHebrew, normalizeTimestampFormat } from '@/lib/utils'
import { Button, Modal } from '@heroui/react'

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

  // Reset reason when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReason('')
    }
  }, [isOpen])

  const handleConfirm = async () => {
    await onConfirm(reason.trim() || undefined)
    setReason('')
  }

  // Normalize timestamp format (seconds to ms if needed)
  const timestamp = reservation ? normalizeTimestampFormat(reservation.time_timestamp) : 0

  if (!reservation) return null

  return (
    <Modal>
      <Modal.Backdrop
        variant="blur"
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
        isDismissable={!isLoading}
        isKeyboardDismissDisabled={isLoading}
        className="z-50"
      >
        <Modal.Container placement="center" size="md">
          <Modal.Dialog className="bg-background-card border border-white/10 rounded-2xl overflow-hidden">
            <Modal.CloseTrigger className="text-foreground-muted hover:text-foreground-light" />
            
            <Modal.Header className="flex items-center gap-3 bg-red-500/10 border-b border-white/10">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle size={20} strokeWidth={1.5} className="text-red-400" />
              </div>
              <Modal.Heading className="text-lg font-medium text-foreground-light">ביטול תור</Modal.Heading>
            </Modal.Header>
            
            <Modal.Body className="p-5">
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
              <div>
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
            </Modal.Body>
            
            <Modal.Footer className="flex gap-3 bg-background-dark/50 border-t border-white/10">
              <Button
                variant="secondary"
                slot="close"
                isDisabled={isLoading}
                className="flex-1"
              >
                ביטול
              </Button>
              <Button
                variant="danger"
                onPress={handleConfirm}
                isDisabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    מבטל...
                  </span>
                ) : (
                  'אישור ביטול'
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

