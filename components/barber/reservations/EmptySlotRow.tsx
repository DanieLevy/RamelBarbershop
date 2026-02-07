/**
 * EmptySlotRow Component
 *
 * Renders an empty time slot in the timeline view.
 * Provides a "book" action button that becomes visible on hover.
 */

'use client'

import { Plus } from 'lucide-react'
import { Button } from '@heroui/react'

interface EmptySlotRowProps {
  timestamp: number
  time: string
  onBook: (timestamp: number) => void
}

export const EmptySlotRow = ({ timestamp, time, onBook }: EmptySlotRowProps) => {
  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 py-2 transition-all hover:bg-white/[0.02] group">
      {/* Time Display */}
      <div className="flex flex-col items-center shrink-0 w-12">
        <span className="text-lg font-bold tabular-nums text-foreground-muted/50">{time}</span>
      </div>

      {/* Empty indicator */}
      <div className="w-1 h-6 rounded-full shrink-0 bg-white/[0.08]" />

      {/* Empty content */}
      <div className="flex-1 min-w-0">
        <p className="text-foreground-muted/40 text-xs">פנוי</p>
      </div>

      {/* Add button */}
      <Button
        onPress={() => onBook(timestamp)}
        isIconOnly
        variant="ghost"
        className="min-w-[32px] w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] text-foreground-muted/50 hover:bg-accent-gold/20 hover:text-accent-gold transition-colors opacity-0 group-hover:opacity-100"
        aria-label="הוסף תור"
      >
        <Plus size={16} strokeWidth={2} />
      </Button>
    </div>
  )
}
