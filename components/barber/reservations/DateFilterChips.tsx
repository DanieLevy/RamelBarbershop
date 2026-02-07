/**
 * DateFilterChips Component
 *
 * Quick date filter buttons (Today, Tomorrow, Week, All)
 * with a hidden native date picker for custom date selection.
 */

'use client'

import { cn } from '@/lib/utils'
import { Calendar } from 'lucide-react'
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns'
import { he } from 'date-fns/locale'

type QuickDateType = 'today' | 'tomorrow' | 'week' | 'all' | 'custom'

interface DateFilterChipsProps {
  quickDate: QuickDateType
  customDate: Date | null
  israelNow: Date
  onQuickDateChange: (date: QuickDateType) => void
  onCustomDateChange: (date: Date | null) => void
}

const quickDateChips: { key: QuickDateType; label: string }[] = [
  { key: 'today', label: 'היום' },
  { key: 'tomorrow', label: 'מחר' },
  { key: 'week', label: 'השבוע' },
  { key: 'all', label: 'הכל' },
]

export const DateFilterChips = ({
  quickDate,
  customDate,
  israelNow,
  onQuickDateChange,
  onCustomDateChange,
}: DateFilterChipsProps) => {
  const handleChipClick = (key: QuickDateType) => {
    onQuickDateChange(key)
    onCustomDateChange(null)
  }

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : null
    if (date) {
      if (isSameDay(date, israelNow)) {
        onQuickDateChange('today')
        onCustomDateChange(null)
      } else if (isSameDay(date, addDays(israelNow, 1))) {
        onQuickDateChange('tomorrow')
        onCustomDateChange(null)
      } else {
        onCustomDateChange(date)
        onQuickDateChange('custom')
      }
    }
  }

  const getDateInputValue = (): string => {
    if (quickDate === 'today') return format(israelNow, 'yyyy-MM-dd')
    if (quickDate === 'tomorrow') return format(addDays(israelNow, 1), 'yyyy-MM-dd')
    if (quickDate === 'custom' && customDate) return format(customDate, 'yyyy-MM-dd')
    return ''
  }

  const getDisplayText = (): string => {
    if (quickDate === 'today') return format(israelNow, 'd/M', { locale: he })
    if (quickDate === 'tomorrow') return format(addDays(israelNow, 1), 'd/M', { locale: he })
    if (quickDate === 'week') {
      const ws = startOfWeek(israelNow, { weekStartsOn: 0 })
      const we = endOfWeek(israelNow, { weekStartsOn: 0 })
      return `${format(ws, 'd/M')} - ${format(we, 'd/M')}`
    }
    if (quickDate === 'all') return 'הכל'
    if (quickDate === 'custom' && customDate) return format(customDate, 'd/M', { locale: he })
    return ''
  }

  return (
    <div className="mb-3 flex items-center gap-2 flex-wrap">
      {quickDateChips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => handleChipClick(chip.key)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
            quickDate === chip.key
              ? 'bg-accent-gold text-background-dark'
              : 'bg-white/[0.05] text-foreground-muted hover:bg-white/[0.08]'
          )}
        >
          {chip.label}
        </button>
      ))}

      {/* Clickable Date Display with hidden picker */}
      <div className="relative">
        <input
          type="date"
          value={getDateInputValue()}
          onChange={handleDateInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="בחר תאריך"
        />
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all',
            'bg-white/[0.05] text-foreground-light hover:bg-white/[0.08] border border-white/[0.06]'
          )}
        >
          <Calendar size={12} className="text-accent-gold" />
          <span>{getDisplayText()}</span>
        </div>
      </div>
    </div>
  )
}
