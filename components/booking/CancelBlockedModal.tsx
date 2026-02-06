'use client'

import { useState } from 'react'
import { X, AlertTriangle, Send, Loader2, Clock } from 'lucide-react'
import { formatHebrewMinutes, formatHebrewHours, formatHebrewDays } from '@/lib/utils'
import { Button } from '@heroui/react'
import { showToast } from '@/lib/toast'
import { useBugReporter } from '@/hooks/useBugReporter'

interface CancelBlockedModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  barberId: string
  barberName: string
  customerId: string
  customerName: string
  serviceName: string
  appointmentTime: number
  hoursUntil: number
  minCancelHours: number
}

export function CancelBlockedModal({
  isOpen,
  onClose,
  reservationId,
  barberId,
  barberName,
  customerId,
  customerName,
  serviceName,
  appointmentTime,
  hoursUntil,
  minCancelHours
}: CancelBlockedModalProps) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const { report } = useBugReporter('CancelBlockedModal')

  const handleAskBarber = async () => {
    setSending(true)
    
    try {
      const response = await fetch('/api/push/request-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          barberId,
          customerId,
          customerName,
          barberName,
          serviceName,
          appointmentTime
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSent(true)
        showToast.success('הבקשה נשלחה לספר')
      } else {
        console.error('Request cancel failed:', result)
        await report(new Error(result.error || 'Request cancel failed'), 'Sending cancel request to barber')
        showToast.error(result.error || 'שגיאה בשליחת הבקשה')
      }
    } catch (err) {
      console.error('Error sending cancel request:', err)
      await report(err, 'Sending cancel request (exception)')
      showToast.error('שגיאה בשליחת הבקשה')
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    setSent(false)
    onClose()
  }

  if (!isOpen) return null

  // Format hours for display with proper Hebrew grammar
  const formatHours = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60)
      return formatHebrewMinutes(minutes)
    }
    if (hours >= 24) {
      const days = Math.round(hours / 24)
      return formatHebrewDays(days)
    }
    return formatHebrewHours(Math.round(hours))
  }

  // Format appointment time
  const formatAppointmentTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const day = date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
    const time = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    return `${day} בשעה ${time}`
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full sm:max-w-md sm:mx-4 bg-background-darker sm:bg-background-dark border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-in-up sm:animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <AlertTriangle size={20} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground-light">לא ניתן לבטל</h3>
              <p className="text-foreground-muted text-xs">התור קרוב מדי</p>
            </div>
          </div>
          <Button
            variant="ghost"
            isIconOnly
            onPress={handleClose}
            aria-label="סגור"
          >
            <X size={20} className="text-foreground-muted" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sent ? (
            // Success State
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Send size={28} className="text-green-400" />
              </div>
              <h4 className="text-foreground-light font-medium text-lg mb-2">
                הבקשה נשלחה!
              </h4>
              <p className="text-foreground-muted text-sm">
                {barberName} קיבל/ה התראה על בקשתך לביטול התור. 
                אם יאשר/תאשר, התור יבוטל.
              </p>
            </div>
          ) : (
            // Initial State
            <>
              {/* Explanation */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                <div className="flex gap-3">
                  <Clock size={20} className="text-orange-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-300/90">
                    <p className="font-medium text-orange-300 mb-1">
                      התור ב{formatHours(hoursUntil)} הקרובות
                    </p>
                    <p>
                      הספר הגדיר שלא ניתן לבטל תורים פחות מ{formatHours(minCancelHours)} לפני התור.
                    </p>
                  </div>
                </div>
              </div>

              {/* Appointment Details */}
              <div className="bg-background-card border border-white/10 rounded-xl p-4">
                <p className="text-foreground-muted text-xs mb-2">פרטי התור:</p>
                <p className="text-foreground-light font-medium">{serviceName}</p>
                <p className="text-foreground-muted text-sm">{formatAppointmentTime(appointmentTime)}</p>
                <p className="text-foreground-muted text-sm">אצל {barberName}</p>
              </div>

              {/* What you can do */}
              <div className="bg-background-card border border-white/10 rounded-xl p-4">
                <p className="text-foreground-light text-sm font-medium mb-2">מה אפשר לעשות?</p>
                <ul className="space-y-2 text-foreground-muted text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-accent-gold">•</span>
                    לשלוח בקשה לספר לבטל את התור
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-gold">•</span>
                    להגיע לתור כרגיל
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent-gold">•</span>
                    ליצור קשר ישירות עם הספר
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 p-5 border-t border-white/5 flex-shrink-0">
          {sent ? (
            <Button
              variant="primary"
              onPress={handleClose}
              className="flex-1"
            >
              סגור
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                onPress={handleAskBarber}
                isDisabled={sending}
                className="flex-1 bg-orange-500 hover:bg-orange-500/90"
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    שולח...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    בקש מהספר לבטל
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                onPress={handleClose}
                isDisabled={sending}
              >
                סגור
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
