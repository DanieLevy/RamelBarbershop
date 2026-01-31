'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: React.ReactNode
  color?: 'emerald' | 'blue' | 'amber' | 'red' | 'zinc'
  loading?: boolean
}

const colorClasses = {
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-500',
    text: 'text-emerald-400',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-500',
    text: 'text-blue-400',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'text-amber-500',
    text: 'text-amber-400',
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: 'text-red-500',
    text: 'text-red-400',
  },
  zinc: {
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
    icon: 'text-zinc-400',
    text: 'text-zinc-300',
  },
}

export function StatsCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  color = 'zinc',
  loading = false,
}: StatsCardProps) {
  const colors = colorClasses[color]

  if (loading) {
    return (
      <div className={cn('p-4 rounded-xl border', colors.bg, colors.border)}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-20 bg-zinc-700 rounded" />
          <div className="h-8 w-16 bg-zinc-700 rounded" />
          <div className="h-3 w-24 bg-zinc-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('p-4 rounded-xl border', colors.bg, colors.border)}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-zinc-400 text-xs font-medium">{title}</span>
        {icon && (
          <div className={cn('p-1.5 rounded-lg', colors.bg)}>
            <span className={colors.icon}>{icon}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {trend && trendValue && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend === 'up' && 'text-emerald-400',
              trend === 'down' && 'text-red-400',
              trend === 'neutral' && 'text-zinc-500'
            )}
          >
            {trend === 'up' && <TrendingUp size={12} />}
            {trend === 'down' && <TrendingDown size={12} />}
            {trend === 'neutral' && <Minus size={12} />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      {subtitle && <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>}
    </div>
  )
}
