/**
 * ViewModeSelector Component
 *
 * Tab-style selector for switching between reservation view modes
 * (All, Upcoming Only, Cancelled) with count badges.
 */

'use client'

import { cn } from '@/lib/utils'

type ViewMode = 'all' | 'upcoming_only' | 'cancelled'

interface ViewModeOption {
  key: ViewMode
  label: string
  count: number
  description?: string
}

interface ViewModeSelectorProps {
  viewMode: ViewMode
  viewModes: ViewModeOption[]
  onViewModeChange: (mode: ViewMode) => void
}

export const ViewModeSelector = ({
  viewMode,
  viewModes,
  onViewModeChange,
}: ViewModeSelectorProps) => {
  return (
    <div className="flex gap-1.5 mb-3 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
      {viewModes.map((mode) => (
        <button
          key={mode.key}
          onClick={() => onViewModeChange(mode.key)}
          className={cn(
            'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
            viewMode === mode.key
              ? 'bg-white/[0.1] text-foreground-light shadow-sm'
              : 'text-foreground-muted hover:text-foreground-light'
          )}
        >
          {mode.label}
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-xs min-w-[20px]',
              viewMode === mode.key
                ? 'bg-accent-gold/20 text-accent-gold'
                : 'bg-white/[0.08] text-foreground-muted'
            )}
          >
            {mode.count}
          </span>
        </button>
      ))}
    </div>
  )
}
