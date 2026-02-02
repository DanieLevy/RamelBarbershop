'use client'

import { useRouter } from 'next/navigation'
import { useBookingStore } from '@/store/useBookingStore'
import { formatTime, formatDateHebrew } from '@/lib/utils'
import type { User } from '@/types/database'
import { CheckCircle, Calendar, Clock, Scissors, User as UserIcon, Phone } from 'lucide-react'
import { Confetti } from '@/components/ui/Confetti'

// Custom WhatsApp icon
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

interface ConfirmationProps {
  barber: User
}

export function Confirmation({ barber: _barber }: ConfirmationProps) {
  const router = useRouter()
  const { service, date, timeTimestamp, customer, reset } = useBookingStore()

  const handleBackToHome = () => {
    reset()
    router.push('/')
  }

  const sendWhatsAppReminder = () => {
    // Format full date with month and year
    const fullDate = date?.dateTimestamp ? formatDateHebrew(date.dateTimestamp) : `${date?.dayName} ${date?.dayNum}`
    
    const message = encodeURIComponent(
      `היי ${customer.fullname}! 🎉\n` +
      `התור שלך נקבע בהצלחה:\n\n` +
      `📅 תאריך: ${fullDate}\n` +
      `⏰ שעה: ${timeTimestamp ? formatTime(timeTimestamp) : ''}\n` +
      `💇 שירות: ${service?.name_he}\n` +
      `💰 מחיר: ₪${service?.price}\n\n` +
      `אנחנו ממתינים לך!\n` +
      `רם אל ברברשופ 💈`
    )
    
    window.open(`https://wa.me/972${customer.phone.slice(1)}?text=${message}`, '_blank')
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Confetti celebration */}
      <Confetti />
      
      {/* Success Icon */}
      <div className="relative">
        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
        <CheckCircle size={64} strokeWidth={1.5} className="relative text-green-500" />
      </div>
      
      <div>
        <h2 className="text-2xl text-foreground-light font-medium">התור נקבע בהצלחה!</h2>
        <p className="text-foreground-muted mt-2">פרטי התור נשמרו במערכת</p>
      </div>
      
      {/* Booking Summary */}
      <div className="w-full p-5 rounded-xl bg-background-card border border-white/10">
        <div className="flex flex-col gap-3 text-right">
          <div className="flex items-center gap-3">
            <UserIcon size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-light">{customer.fullname}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Phone size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-light" dir="ltr">{customer.phone}</span>
          </div>
          
          <div className="border-t border-white/10 my-2" />
          
          <div className="flex items-center gap-3">
            <Scissors size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-light">{service?.name_he}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Calendar size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-light">{date?.dayName} {date?.dayNum}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Clock size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-light">{timeTimestamp ? formatTime(timeTimestamp) : ''}</span>
          </div>
          
          <div className="border-t border-white/10 my-2" />
          
          <div className="flex justify-between items-center">
            <span className="text-foreground-muted">מחיר</span>
            <span className="text-accent-gold font-medium text-lg">₪{service?.price}</span>
          </div>
        </div>
      </div>
      
      {/* WhatsApp Reminder */}
      <button
        onClick={sendWhatsAppReminder}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-all"
      >
        <WhatsAppIcon />
        שלח לעצמי תזכורת בוואטסאפ
      </button>
      
      {/* Back to Home */}
      <button
        onClick={handleBackToHome}
        className="text-foreground-muted hover:text-foreground-light transition-colors text-sm"
      >
        חזור לדף הבית
      </button>
    </div>
  )
}
