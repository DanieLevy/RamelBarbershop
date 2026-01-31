'use client'

import { cn } from '@/lib/utils'

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface StatusBadgeProps {
  status: StatusType
  label: string
  size?: 'sm' | 'md'
  dot?: boolean
}

const statusClasses: Record<StatusType, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
  },
  error: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    dot: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-500',
  },
  neutral: {
    bg: 'bg-zinc-800',
    text: 'text-zinc-400',
    dot: 'bg-zinc-500',
  },
}

export function StatusBadge({ status, label, size = 'sm', dot = true }: StatusBadgeProps) {
  const classes = statusClasses[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        classes.bg,
        classes.text,
        size === 'sm' && 'px-2 py-0.5 text-[10px]',
        size === 'md' && 'px-2.5 py-1 text-xs'
      )}
    >
      {dot && (
        <span
          className={cn(
            'rounded-full',
            classes.dot,
            size === 'sm' && 'w-1.5 h-1.5',
            size === 'md' && 'w-2 h-2'
          )}
        />
      )}
      {label}
    </span>
  )
}
