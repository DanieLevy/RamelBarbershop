'use client'

import { useState, useCallback } from 'react'
import { showToast } from '@/lib/toast'
import toast from 'react-hot-toast'
import { Toaster as HotToaster } from 'react-hot-toast'
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
  ArrowRight
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

type ToastLibrary = 'sonner' | 'hot-toast'
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

export default function ToastComparisonPage() {
  const [activeLib, setActiveLib] = useState<ToastLibrary>('sonner')
  const [position, setPosition] = useState<'top-center' | 'bottom-center' | 'top-right'>('top-center')
  const [duration, setDuration] = useState(4000)
  const [withDescription, setWithDescription] = useState(true)
  const [withAction, setWithAction] = useState(false)

  // ============================================================
  // Sonner toast triggers
  // ============================================================

  const handleFireSonner = useCallback((type: ToastType) => {
    const msg = HEBREW_MESSAGES[type]
    const opts = {
      description: withDescription ? msg.description : undefined,
      duration,
      action: withAction ? { label: 'בטל', onClick: () => showToast.info('פעולה בוטלה') } : undefined,
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
          <div className="flex items-center gap-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm shadow-lg">
            <Sparkles size={18} className="text-purple-400 flex-shrink-0" />
            <div>
              <p className="font-medium">{msg.message}</p>
              <p className="text-xs text-zinc-400 mt-0.5">זה טוסט מותאם עם JSX</p>
            </div>
          </div>
        )
        break
    }
  }, [withDescription, withAction, duration])

  // ============================================================
  // React Hot Toast triggers
  // ============================================================

  const handleFireHotToast = useCallback((type: ToastType) => {
    const msg = HEBREW_MESSAGES[type]
    const baseStyle = {
      background: '#18181b',
      color: '#fff',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '12px 16px',
      fontSize: '14px',
      direction: 'rtl' as const,
      fontFamily: 'var(--font-ploni), system-ui, sans-serif',
    }

    switch (type) {
      case 'success':
        toast.success(
          withDescription ? `${msg.message}\n${msg.description}` : msg.message,
          { duration, style: { ...baseStyle, borderColor: 'rgba(52,211,153,0.3)' }, position }
        )
        break
      case 'error':
        toast.error(
          withDescription ? `${msg.message}\n${msg.description}` : msg.message,
          { duration, style: { ...baseStyle, borderColor: 'rgba(244,63,94,0.3)' }, position }
        )
        break
      case 'warning':
        toast(
          withDescription ? `${msg.message}\n${msg.description}` : msg.message,
          { duration, icon: '⚠️', style: { ...baseStyle, borderColor: 'rgba(245,158,11,0.3)' }, position }
        )
        break
      case 'info':
        toast(
          withDescription ? `${msg.message}\n${msg.description}` : msg.message,
          { duration, icon: 'ℹ️', style: { ...baseStyle, borderColor: 'rgba(56,189,248,0.3)' }, position }
        )
        break
      case 'loading': {
        const toastId = toast.loading(msg.message, { style: baseStyle, position })
        setTimeout(() => {
          toast.success('נשמר בהצלחה!', { id: toastId, style: baseStyle, position })
        }, 2000)
        break
      }
      case 'promise':
        toast.promise(
          new Promise<string>((resolve) => setTimeout(() => resolve('נתונים'), 2000)),
          { loading: 'טוען נתונים...', success: 'הנתונים נטענו בהצלחה!', error: 'שגיאה בטעינת הנתונים' },
          { style: baseStyle, position }
        )
        break
      case 'custom':
        toast.custom(
          (t) => (
            <div
              className={cn(
                'flex items-center gap-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm shadow-lg max-w-sm',
                t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'animate-out fade-out slide-out-to-top-2'
              )}
              dir="rtl"
            >
              <Sparkles size={18} className="text-purple-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{msg.message}</p>
                <p className="text-xs text-zinc-400 mt-0.5">זה טוסט מותאם עם JSX</p>
              </div>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-zinc-500 hover:text-white transition-colors p-1"
                aria-label="סגור"
              >
                <XCircle size={14} />
              </button>
            </div>
          ),
          { position }
        )
        break
    }
  }, [withDescription, duration, position])

  // ============================================================
  // Fire handler based on active library
  // ============================================================

  const handleFire = useCallback((type: ToastType) => {
    if (activeLib === 'sonner') {
      handleFireSonner(type)
    } else {
      handleFireHotToast(type)
    }
  }, [activeLib, handleFireSonner, handleFireHotToast])

  const handleDismissAll = useCallback(() => {
    showToast.dismiss()
    toast.dismiss()
  }, [])

  const handleFireAll = useCallback(() => {
    const types: ToastType[] = ['success', 'error', 'warning', 'info']
    types.forEach((type, i) => {
      setTimeout(() => handleFire(type), i * 300)
    })
  }, [handleFire])

  // ============================================================
  // Color utilities
  // ============================================================

  const getColorClasses = (color: string, active: boolean) => {
    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
      emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
      rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' },
      amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
      sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-400' },
      zinc: { bg: 'bg-zinc-700/30', border: 'border-zinc-600/30', text: 'text-zinc-400' },
      violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400' },
      pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400' },
    }
    const c = colorMap[color] || colorMap.zinc
    return active ? `${c.bg} ${c.border} ${c.text}` : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800'
  }

  return (
    <div className="space-y-6">
      {/* React Hot Toast Toaster (rendered alongside existing Sonner toaster from layout) */}
      <HotToaster
        position={position}
        toastOptions={{
          duration,
          style: {
            background: '#18181b',
            color: '#fff',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            direction: 'rtl',
          },
        }}
      />

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Toast Comparison</h1>
        <p className="text-zinc-500 text-xs mt-0.5">Compare Sonner vs React Hot Toast on-device</p>
      </div>

      {/* Library Selector */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Active Library</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveLib('sonner')}
            className={cn(
              'flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all',
              activeLib === 'sonner'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800'
            )}
            aria-label="Select Sonner toast library"
            tabIndex={0}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-base font-semibold">Sonner</span>
              <span className="text-[10px] text-zinc-500">Current (in use)</span>
            </div>
          </button>
          <button
            onClick={() => setActiveLib('hot-toast')}
            className={cn(
              'flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all',
              activeLib === 'hot-toast'
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800'
            )}
            aria-label="Select React Hot Toast library"
            tabIndex={0}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-base font-semibold">React Hot Toast</span>
              <span className="text-[10px] text-zinc-500">Alternative</span>
            </div>
          </button>
        </div>
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

          {/* Position (only for Hot Toast) */}
          {activeLib === 'hot-toast' && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">Position</span>
              <div className="flex gap-1.5">
                {(['top-center', 'bottom-center', 'top-right'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPosition(p)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                      position === p
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:text-zinc-300'
                    )}
                    aria-label={`Set position to ${p}`}
                    tabIndex={0}
                  >
                    {p.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toggles */}
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
            <button
              onClick={() => setWithAction(!withAction)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all border',
                withAction
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500'
              )}
              aria-label="Toggle action button"
              tabIndex={0}
            >
              + Action {activeLib === 'hot-toast' && <span className="text-zinc-600">(Sonner only)</span>}
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
                getColorClasses(demo.color, true)
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

      {/* Quick Comparison Info */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Library Comparison</h2>
        <div className="space-y-2">
          <ComparisonRow
            feature="Bundle Size"
            sonner="~5kb gzipped"
            hotToast="~5kb gzipped"
          />
          <ComparisonRow
            feature="RTL Support"
            sonner="Native dir=rtl"
            hotToast="Via style.direction"
          />
          <ComparisonRow
            feature="Close Button"
            sonner="Built-in"
            hotToast="Manual (custom)"
          />
          <ComparisonRow
            feature="Warning Type"
            sonner="Built-in"
            hotToast="Manual (icon only)"
          />
          <ComparisonRow
            feature="Action Buttons"
            sonner="Built-in"
            hotToast="Custom JSX"
          />
          <ComparisonRow
            feature="Promise API"
            sonner="Built-in"
            hotToast="Built-in"
          />
          <ComparisonRow
            feature="Accessibility"
            sonner="ARIA by default"
            hotToast="ARIA by default"
          />
          <ComparisonRow
            feature="Custom JSX"
            sonner="toast.custom()"
            hotToast="toast.custom()"
          />
          <ComparisonRow
            feature="Animations"
            sonner="CSS built-in"
            hotToast="CSS built-in"
          />
          <ComparisonRow
            feature="Multiple Toasters"
            sonner="No (single)"
            hotToast="Yes (toasterId)"
          />
          <ComparisonRow
            feature="Headless Mode"
            sonner="No"
            hotToast="useToaster()"
          />
        </div>
      </div>

      {/* Verdict Area */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700">
        <h2 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
          <ArrowRight size={14} className="text-emerald-400" />
          Test on your mobile device
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Open this page on your phone to compare both toast libraries side by side.
          Test different toast types, durations, and positions to decide which one
          feels better for the barbershop app&apos;s UX.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Comparison Row Sub-component
// ============================================================

const ComparisonRow = ({
  feature,
  sonner,
  hotToast,
}: {
  feature: string
  sonner: string
  hotToast: string
}) => (
  <div className="flex items-center text-xs">
    <span className="w-28 text-zinc-500 flex-shrink-0">{feature}</span>
    <span className="flex-1 text-emerald-400/80 text-center">{sonner}</span>
    <span className="flex-1 text-orange-400/80 text-center">{hotToast}</span>
  </div>
)
