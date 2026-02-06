'use client'

import { useState } from 'react'
import { X, Phone, MessageSquare, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import { useAuthStore } from '@/store/useAuthStore'
import { Portal } from '@/components/ui/Portal'

interface PhoneCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string
  customerName: string
}

const STORAGE_KEY = 'phone_modal_dismissed'

// Validate Israeli phone number
const validatePhone = (phoneStr: string): string | null => {
  const phoneClean = phoneStr.replace(/\D/g, '')
  if (!phoneClean || phoneClean.length !== 10 || !phoneClean.startsWith('05')) {
    return 'נא להזין מספר טלפון ישראלי תקין (05XXXXXXXX)'
  }
  return null
}

export function PhoneCollectionModal({
  isOpen,
  onClose,
  customerId,
  customerName,
}: PhoneCollectionModalProps) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const { refreshCustomer } = useAuthStore()

  const handleSubmit = async () => {
    const phoneClean = phone.replace(/\D/g, '')
    const phoneError = validatePhone(phoneClean)
    
    if (phoneError) {
      setError(phoneError)
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      const response = await fetch('/api/customers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          phone: phoneClean,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update phone')
      }
      
      // Refresh customer data in auth store
      await refreshCustomer()
      
      setSuccess(true)
      showToast.success('מספר הטלפון נשמר בהצלחה!')
      
      // Close after showing success
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Error saving phone:', err)
      setError('שגיאה בשמירת מספר הטלפון')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    // Mark as dismissed in localStorage
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
    onClose()
  }

  if (!isOpen) return null

  // Success state
  if (success) {
    return (
      <Portal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-background-darker border border-white/10 rounded-2xl max-w-sm w-full p-6 animate-fade-in text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-foreground-light mb-2">
              מספר הטלפון נשמר!
            </h3>
            <p className="text-foreground-muted text-sm">
              כעת תוכל לקבל תזכורות SMS לפני כל תור
            </p>
          </div>
        </div>
      </Portal>
    )
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-background-darker border border-white/10 rounded-2xl max-w-sm w-full p-6 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center">
                <Phone size={20} className="text-accent-gold" />
              </div>
              <h3 className="text-lg font-medium text-foreground-light">הוספת מספר טלפון</h3>
            </div>
            <button
              onClick={handleSkip}
              disabled={saving}
              className="w-10 h-10 flex items-center justify-center text-foreground-muted hover:text-foreground-light transition-colors"
              aria-label="סגור"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Welcome */}
          <p className="text-foreground-muted text-sm mb-4">
            שלום {customerName}! 
            <br />
            כדי לקבל תזכורות SMS לפני כל תור, נא להוסיף מספר טלפון.
          </p>
          
          {/* Benefits */}
          <div className="bg-accent-gold/5 border border-accent-gold/10 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <MessageSquare size={18} className="text-accent-gold mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-accent-gold font-medium mb-1">למה כדאי?</p>
                <ul className="text-foreground-muted space-y-1">
                  <li>• תזכורת SMS יום לפני התור</li>
                  <li>• עדכונים על שינויים או ביטולים</li>
                  <li>• אף פעם לא תשכח תור!</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Phone Input */}
          <div className="mb-4">
            <label htmlFor="phone-input" className="text-foreground-light text-sm block mb-2">
              מספר טלפון
            </label>
            <input
              id="phone-input"
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setError(null)
              }}
              placeholder="05XXXXXXXX"
              disabled={saving}
              className={cn(
                'w-full p-3 rounded-xl bg-background-card border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-left',
                error ? 'border-red-400' : 'border-white/10',
                saving && 'opacity-60'
              )}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {error && (
              <p className="text-red-400 text-xs mt-1">{error}</p>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving || !phone.trim()}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                saving || !phone.trim()
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  שומר...
                </>
              ) : (
                'שמור'
              )}
            </button>
            <button
              onClick={handleSkip}
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-white/10 text-foreground-light font-medium hover:bg-white/15 transition-colors flex items-center justify-center disabled:opacity-50"
            >
              לא עכשיו
            </button>
          </div>
          
          {/* Privacy Note */}
          <p className="text-foreground-muted/60 text-xs text-center mt-4">
            המספר ישמש לתזכורות בלבד ולא יועבר לצד שלישי
          </p>
        </div>
      </div>
    </Portal>
  )
}

// Helper function to check if modal should be shown
export function shouldShowPhoneModal(customerId: string, hasPhone: boolean): boolean {
  if (hasPhone) return false
  
  const dismissed = localStorage.getItem(STORAGE_KEY)
  if (!dismissed) return true
  
  // Re-show after 7 days if still no phone
  const dismissedTime = parseInt(dismissed, 10)
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return Date.now() - dismissedTime > sevenDays
}
