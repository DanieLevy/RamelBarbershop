'use client'

import { useState, useCallback } from 'react'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Loader2, 
  Zap,
  Clock,
  Trash2,
  Sparkles,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'promise' | 'custom'

interface ToastDemo {
  type: ToastType
  label: string
  labelHe: string
  icon: React.ReactNode
  color: string
}

// ============================================================
// Constants
// ============================================================

const TOAST_DEMOS: ToastDemo[] = [
  { type: 'success', label: 'Success', labelHe: 'הצלחה', icon: <CheckCircle size={16} />, color: 'emerald' },
  { type: 'error', label: 'Error', labelHe: 'שגיאה', icon: <XCircle size={16} />, color: 'rose' },
  { type: 'warning', label: 'Warning', labelHe: 'אזהרה', icon: <AlertTriangle size={16} />, color: 'amber' },
  { type: 'info', label: 'Info', labelHe: 'מידע', icon: <Info size={16} />, color: 'sky' },
  { type: 'loading', label: 'Loading', labelHe: 'טוען', icon: <Loader2 size={16} className="animate-spin" />, color: 'zinc' },
  { type: 'promise', label: 'Promise', labelHe: 'Promise', icon: <Clock size={16} />, color: 'violet' },
  { type: 'custom', label: 'Custom JSX', labelHe: 'מותאם', icon: <Sparkles size={16} />, color: 'pink' },
]

const HEBREW_MESSAGES = {
  success: { message: 'התור נקבע בהצלחה!', description: 'התור נקבע ליום חמישי בשעה 10:00' },
  error: { message: 'שגיאה בביצוע הפעולה', description: 'אנא נסה שנית מאוחר יותר' },
  warning: { message: 'שים לב!', description: 'התור שלך מתקרב בעוד 30 דקות' },
  info: { message: 'מידע חשוב', description: 'שעות הפעילות עודכנו' },
  loading: { message: 'שומר שינויים...', description: '' },
  promise: { message: '', description: '' },
  custom: { message: 'הודעה מותאמת אישית', description: '' },
}

// ============================================================
// Component
// ============================================================

export default function ToastTestPage() {
  const [duration, setDuration] = useState(4000)
  const [withDescription, setWithDescription] = useState(true)

  const handleFire = useCallback((type: ToastType) => {
    const msg = HEBREW_MESSAGES[type]
    const opts = {
      description: withDescription ? msg.description : undefined,
      duration,
    }

    switch (type) {
      case 'success':
        showToast.success(msg.message, opts)
        break
      case 'error':
        showToast.error(msg.message, opts)
        break
      case 'warning':
        showToast.warning(msg.message, opts)
        break
      case 'info':
        showToast.info(msg.message, opts)
        break
      case 'loading': {
        const id = showToast.loading(msg.message)
        setTimeout(() => {
          showToast.dismiss(id)
          showToast.success('נשמר בהצלחה!')
        }, 2000)
        break
      }
      case 'promise':
        showToast.promise(
          new Promise<string>((resolve) => setTimeout(() => resolve('נתונים'), 2000)),
          { loading: 'טוען נתונים...', success: 'הנתונים נטענו בהצלחה!', error: 'שגיאה בטעינת הנתונים' }
        )
        break
      case 'custom':
        showToast.custom(
          <div className="flex items-center gap-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm shadow-lg" dir="rtl">
            <Sparkles size={18} className="text-purple-400 flex-shrink-0" />
            <div>
              <p className="font-medium">{msg.message}</p>
              <p className="text-xs text-zinc-400 mt-0.5">זה טוסט מותאם עם JSX</p>
            </div>
          </div>
        )
        break
    }
  }, [withDescription, duration])

  const handleDismissAll = useCallback(() => {
    showToast.dismiss()
  }, [])

  const handleFireAll = useCallback(() => {
    const types: ToastType[] = ['success', 'error', 'warning', 'info']
    types.forEach((type, i) => {
      setTimeout(() => handleFire(type), i * 300)
    })
  }, [handleFire])

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      rose: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      sky: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
      zinc: 'bg-zinc-700/30 border-zinc-600/30 text-zinc-400',
      violet: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
      pink: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
    }
    return colorMap[color] || colorMap.zinc
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Toast Testing</h1>
        <p className="text-zinc-500 text-xs mt-0.5">React Hot Toast - test on-device notifications</p>
      </div>

      {/* Settings */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Settings</h2>
        <div className="space-y-3">
          {/* Duration */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Duration</span>
            <div className="flex gap-1.5">
              {[2000, 4000, 6000, 8000].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                    duration === d
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:text-zinc-300'
                  )}
                  aria-label={`Set duration to ${d / 1000} seconds`}
                  tabIndex={0}
                >
                  {d / 1000}s
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Description */}
          <div className="flex gap-3">
            <button
              onClick={() => setWithDescription(!withDescription)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all border',
                withDescription
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500'
              )}
              aria-label="Toggle description"
              tabIndex={0}
            >
              + Description
            </button>
          </div>
        </div>
      </div>

      {/* Toast Type Buttons */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-400">Fire Toast</h2>
          <div className="flex gap-2">
            <button
              onClick={handleFireAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-all hover:bg-emerald-500/20"
              aria-label="Fire all toast types"
              tabIndex={0}
            >
              <Zap size={12} />
              Fire All
            </button>
            <button
              onClick={handleDismissAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium transition-all hover:bg-red-500/20"
              aria-label="Dismiss all toasts"
              tabIndex={0}
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TOAST_DEMOS.map((demo) => (
            <button
              key={demo.type}
              onClick={() => handleFire(demo.type)}
              className={cn(
                'flex items-center gap-2 px-3 py-3 rounded-xl border transition-all active:scale-[0.98]',
                getColorClasses(demo.color)
              )}
              aria-label={`Fire ${demo.label} toast`}
              tabIndex={0}
            >
              {demo.icon}
              <div className="text-right flex-1">
                <p className="text-xs font-medium">{demo.label}</p>
                <p className="text-[10px] opacity-60">{demo.labelHe}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
