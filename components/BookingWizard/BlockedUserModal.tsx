'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle, Home } from 'lucide-react'

interface BlockedUserModalProps {
  isOpen: boolean
}

export function BlockedUserModal({ isOpen }: BlockedUserModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-background-card border border-white/10 rounded-2xl p-6 text-center animate-fade-in-up">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-red-400" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-medium text-foreground-light mb-3">
          לא ניתן לבצע הזמנה
        </h2>

        {/* Message */}
        <p className="text-foreground-muted mb-6">
          לא ניתן לבצע הזמנה כרגע.
          <br />
          אנא פנה לצוות הברברשופ לקבלת מידע נוסף.
        </p>

        {/* Action */}
        <button
          onClick={() => router.push('/')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-accent-gold hover:bg-accent-gold/90 rounded-xl font-medium text-background-dark transition-colors"
        >
          <Home size={18} />
          חזרה לדף הבית
        </button>
      </div>
    </div>
  )
}

