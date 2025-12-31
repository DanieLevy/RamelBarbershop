'use client'

import { X, LogOut, BellOff, KeyRound, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoutModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}

export function LogoutModal({ isOpen, onClose, onConfirm, isLoading }: LogoutModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-background-darker border border-white/10 rounded-2xl max-w-sm w-full p-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <LogOut size={20} className="text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-foreground-light">התנתקות</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-10 h-10 flex items-center justify-center text-foreground-muted hover:text-foreground-light transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Warning Content */}
        <p className="text-foreground-muted mb-4">
          האם אתה בטוח שברצונך להתנתק?
        </p>
        
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 text-sm">
            <BellOff size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-foreground-muted">
              <span className="text-amber-400">לא תקבל התראות</span> על תורים קרובים, שינויים או עדכונים
            </p>
          </div>
          
          <div className="flex items-start gap-3 text-sm">
            <Calendar size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
            <p className="text-foreground-muted">
              <span className="text-green-400">עדיין תוכל להזמין תורים</span> כאורח
            </p>
          </div>
          
          <div className="flex items-start gap-3 text-sm">
            <KeyRound size={16} className="text-foreground-muted mt-0.5 flex-shrink-0" />
            <p className="text-foreground-muted">
              להתחברות מחדש יידרש <span className="text-foreground-light">אימות SMS</span> עם קוד חד-פעמי
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl bg-white/10 text-foreground-light font-medium hover:bg-white/15 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            ביטול
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
              'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <LogOut size={18} />
            <span>התנתק</span>
          </button>
        </div>
      </div>
    </div>
  )
}

