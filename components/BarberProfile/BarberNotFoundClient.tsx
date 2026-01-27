'use client'

import Link from 'next/link'
import { UserX, Home, ArrowRight } from 'lucide-react'

interface BarberNotFoundClientProps {
  /** The barber's name to display */
  barberName?: string
  /** Reason for unavailability: 'disabled' | 'deleted' | 'not_found' */
  reason?: 'disabled' | 'deleted' | 'not_found'
}

/**
 * Friendly error page shown when a barber is unavailable
 * 
 * Cases:
 * - Barber was disabled by admin (is_active: false)
 * - Barber was deleted
 * - Barber not found (invalid slug/UUID)
 */
export function BarberNotFoundClient({ 
  barberName,
  reason = 'not_found' 
}: BarberNotFoundClientProps) {
  
  const getMessage = () => {
    switch (reason) {
      case 'disabled':
        return {
          title: 'הספר לא זמין כרגע',
          subtitle: barberName 
            ? `${barberName} לא מקבל תורים כרגע`
            : 'הספר לא מקבל תורים כרגע',
          description: 'ניתן לבחור ספר אחר מהצוות שלנו או לחזור מאוחר יותר.',
        }
      case 'deleted':
        return {
          title: 'הספר לא נמצא',
          subtitle: 'הספר שחיפשת כבר לא עובד אצלנו',
          description: 'ייתכן שהספר עזב או שהקישור שגוי. נסה לבחור ספר אחר.',
        }
      default:
        return {
          title: 'הספר לא נמצא',
          subtitle: 'לא מצאנו את הספר שחיפשת',
          description: 'ייתכן שהקישור שגוי או שהספר לא קיים. נסה לבחור ספר מהרשימה.',
        }
    }
  }
  
  const message = getMessage()
  
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-foreground-muted/10 flex items-center justify-center mb-6">
          <UserX 
            size={40} 
            strokeWidth={1.5} 
            className="text-foreground-muted" 
          />
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground-light mb-2">
          {message.title}
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg text-foreground-muted mb-4">
          {message.subtitle}
        </p>
        
        {/* Description */}
        <p className="text-sm text-foreground-muted/70 mb-8">
          {message.description}
        </p>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/#team"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent-gold text-background-dark font-medium hover:bg-accent-gold/90 active:scale-[0.98] transition-all"
            aria-label="בחר ספר אחר"
          >
            <span>בחר ספר אחר</span>
            <ArrowRight size={18} strokeWidth={2} className="rotate-180" />
          </Link>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-foreground-light hover:bg-white/5 active:scale-[0.98] transition-all"
            aria-label="חזור לדף הבית"
          >
            <Home size={18} strokeWidth={1.5} />
            <span>חזור לדף הבית</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
