'use client'

import { useRouter } from 'next/navigation'
import { useBookingStore } from '@/store/useBookingStore'
import { formatTime } from '@/lib/utils'
import type { User } from '@/types/database'
import { FaCheckCircle, FaWhatsapp, FaCalendar, FaClock, FaCut, FaUser, FaPhone } from 'react-icons/fa'

interface ConfirmationProps {
  barber: User
}

export function Confirmation({ barber }: ConfirmationProps) {
  const router = useRouter()
  const { service, date, timeTimestamp, customer, reset } = useBookingStore()

  const handleBackToHome = () => {
    reset()
    router.push('/')
  }

  const sendWhatsAppReminder = () => {
    const message = encodeURIComponent(
      `היי ${customer.fullname}! 🎉\n` +
      `התור שלך נקבע בהצלחה:\n\n` +
      `📅 ${date?.dayName} ${date?.dayNum}\n` +
      `⏰ ${timeTimestamp ? formatTime(timeTimestamp) : ''}\n` +
      `💇 ${service?.name_he}\n` +
      `💰 ₪${service?.price}\n\n` +
      `אנחנו ממתינים לך!\n` +
      `רמאל ברברשופ 💈`
    )
    
    window.open(`https://wa.me/972${customer.phone.slice(1)}?text=${message}`, '_blank')
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Success Icon */}
      <div className="relative">
        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
        <FaCheckCircle className="relative w-16 h-16 text-green-500" />
      </div>
      
      <div>
        <h2 className="text-2xl text-foreground-light font-medium">התור נקבע בהצלחה!</h2>
        <p className="text-foreground-muted mt-2">פרטי התור נשמרו במערכת</p>
      </div>
      
      {/* Booking Summary */}
      <div className="w-full p-5 rounded-xl bg-background-card border border-white/10">
        <div className="flex flex-col gap-3 text-right">
          <div className="flex items-center gap-3">
            <FaUser className="w-4 h-4 text-accent-gold" />
            <span className="text-foreground-light">{customer.fullname}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <FaPhone className="w-4 h-4 text-accent-gold" />
            <span className="text-foreground-light" dir="ltr">{customer.phone}</span>
          </div>
          
          <div className="border-t border-white/10 my-2" />
          
          <div className="flex items-center gap-3">
            <FaCut className="w-4 h-4 text-accent-gold" />
            <span className="text-foreground-light">{service?.name_he}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <FaCalendar className="w-4 h-4 text-accent-gold" />
            <span className="text-foreground-light">{date?.dayName} {date?.dayNum}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <FaClock className="w-4 h-4 text-accent-gold" />
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
        <FaWhatsapp className="w-5 h-5" />
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

