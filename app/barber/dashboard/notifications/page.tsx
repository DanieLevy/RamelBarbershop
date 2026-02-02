'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { cn, timestampToIsraelDate } from '@/lib/utils'
import { Bell, Calendar, X, Clock, ChevronLeft, Check, RefreshCw } from 'lucide-react'
import type { NotificationLogRecord, NotificationType } from '@/lib/push/types'
import { useBugReporter } from '@/hooks/useBugReporter'
import { useHaptics } from '@/hooks/useHaptics'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { toast } from 'sonner'

type FilterType = 'all' | 'unread' | NotificationType

interface FilterOption {
  key: FilterType
  label: string
}

// Notification type display info
const notificationTypeInfo: Record<NotificationType, { icon: typeof Bell; label: string; color: string }> = {
  reminder: { icon: Clock, label: 'תזכורת', color: 'text-blue-400' },
  cancellation: { icon: X, label: 'ביטול', color: 'text-red-400' },
  booking_confirmed: { icon: Calendar, label: 'תור חדש', color: 'text-green-400' },
  cancel_request: { icon: Bell, label: 'בקשת ביטול', color: 'text-orange-400' },
  chat_message: { icon: Bell, label: 'הודעה', color: 'text-purple-400' },
  barber_broadcast: { icon: Bell, label: 'הודעה מהספר', color: 'text-accent-gold' },
  admin_broadcast: { icon: Bell, label: 'הודעה מהמערכת', color: 'text-accent-gold' }
}

export default function BarberNotificationsPage() {
  const router = useRouter()
  const { barber, isLoggedIn } = useBarberAuthStore()
  const { report } = useBugReporter('BarberNotificationsPage')
  const haptics = useHaptics()
  
  const [notifications, setNotifications] = useState<NotificationLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [markingAllRead, setMarkingAllRead] = useState(false)

  const fetchNotifications = useCallback(async (reset = false) => {
    if (!barber?.id) return
    
    if (reset) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    
    try {
      const params = new URLSearchParams({
        barberId: barber.id,
        limit: '20',
        offset: reset ? '0' : String(notifications.length)
      })
      
      // Apply filter
      if (activeFilter === 'unread') {
        params.set('unreadOnly', 'true')
      } else if (activeFilter !== 'all') {
        params.set('type', activeFilter)
      }
      
      const response = await fetch(`/api/push/notifications?${params}`)
      const data = await response.json()

      if (data.success) {
        if (reset) {
          setNotifications(data.notifications || [])
        } else {
          setNotifications(prev => [...prev, ...(data.notifications || [])])
        }
        setHasMore(data.pagination?.hasMore || false)
        setTotalUnread(data.totalUnread || 0)
      } else {
        console.error('Error fetching notifications:', data.error)
        await report(new Error(data.error || 'Unknown error'), 'Fetching barber notifications')
        toast.error('שגיאה בטעינת ההתראות')
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
      await report(err, 'Fetching barber notifications (exception)')
      toast.error('שגיאה בטעינת ההתראות')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [barber?.id, activeFilter, notifications.length, report])

  useEffect(() => {
    if (barber?.id) {
      fetchNotifications(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id, activeFilter])

  const handleMarkAllRead = async () => {
    if (!barber?.id || markingAllRead) return
    
    setMarkingAllRead(true)
    haptics.light()
    
    try {
      const response = await fetch('/api/push/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: barber.id,
          markAll: true
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update local state
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setTotalUnread(0)
        toast.success('כל ההתראות סומנו כנקראו')
      } else {
        toast.error('שגיאה בסימון ההתראות')
      }
    } catch (err) {
      console.error('Error marking all as read:', err)
      toast.error('שגיאה בסימון ההתראות')
    } finally {
      setMarkingAllRead(false)
    }
  }

  const handleNotificationClick = async (notification: NotificationLogRecord) => {
    haptics.light()
    
    // Mark as read if unread
    if (!notification.is_read && barber?.id) {
      try {
        fetch('/api/push/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barberId: barber.id,
            notificationId: notification.id
          })
        }).catch(err => console.error('Error marking notification as read:', err))
        
        // Optimistic update
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        )
        setTotalUnread(prev => Math.max(0, prev - 1))
      } catch {
        // Ignore errors - this is fire and forget
      }
    }
    
    // Navigate to related reservation if applicable
    if (notification.reservation_id) {
      router.push(`/barber/dashboard/reservations?highlight=${notification.reservation_id}`)
    }
  }

  const getTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'עכשיו'
    if (diffMins < 60) return `לפני ${diffMins} דקות`
    if (diffHours < 24) return `לפני ${diffHours} שעות`
    if (diffDays < 7) return `לפני ${diffDays} ימים`
    
    const israelDate = timestampToIsraelDate(date.getTime())
    return format(israelDate, 'd בMMMM', { locale: he })
  }

  const filters: FilterOption[] = [
    { key: 'all', label: 'הכל' },
    { key: 'unread', label: 'לא נקראו' },
    { key: 'booking_confirmed', label: 'תורים חדשים' },
    { key: 'cancellation', label: 'ביטולים' }
  ]

  // Redirect if not logged in
  if (!isLoggedIn || !barber) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Bell size={40} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
          <p className="text-foreground-muted">יש להתחבר כדי לראות את ההתראות</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl text-foreground-light font-medium flex items-center gap-2">
            <Bell size={24} strokeWidth={1.5} className="text-accent-gold" />
            התראות
          </h1>
          <p className="text-foreground-muted text-sm mt-0.5">
            {totalUnread > 0 ? `${totalUnread} התראות שלא נקראו` : 'אין התראות חדשות'}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                markingAllRead
                  ? 'opacity-50 cursor-not-allowed bg-white/5'
                  : 'bg-white/5 hover:bg-white/10 text-foreground-light'
              )}
            >
              <Check size={14} strokeWidth={2} />
              <span className="hidden sm:inline">סמן הכל כנקרא</span>
            </button>
          )}
          
          <button
            onClick={() => fetchNotifications(true)}
            disabled={refreshing}
            className={cn(
              'p-2 rounded-xl transition-all',
              refreshing ? 'opacity-50' : 'hover:bg-white/10'
            )}
            aria-label="רענן"
          >
            <RefreshCw size={18} className={cn('text-foreground-muted', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex gap-1.5 mb-4 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              activeFilter === filter.key
                ? 'bg-white/[0.1] text-foreground-light shadow-sm'
                : 'text-foreground-muted hover:text-foreground-light'
            )}
          >
            {filter.label}
            {filter.key === 'unread' && totalUnread > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-accent-gold/20 text-accent-gold">
                {totalUnread}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Content */}
      {notifications.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl py-12 text-center">
          <Bell size={40} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
          <p className="text-foreground-muted">
            {activeFilter === 'unread' ? 'אין התראות שלא נקראו' : 'אין התראות להצגה'}
          </p>
          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="mt-3 text-accent-gold hover:underline text-sm font-medium"
            >
              הצג את כל ההתראות
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {notifications.map((notification) => {
              const typeInfo = notificationTypeInfo[notification.notification_type] || notificationTypeInfo.admin_broadcast
              const Icon = typeInfo.icon
              
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'flex items-start gap-3 px-4 py-4 transition-all cursor-pointer hover:bg-white/[0.03]',
                    !notification.is_read && 'bg-accent-gold/5'
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    !notification.is_read ? 'bg-accent-gold/20' : 'bg-white/5'
                  )}>
                    <Icon size={18} strokeWidth={1.5} className={typeInfo.color} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={cn(
                        'text-sm truncate',
                        notification.is_read ? 'text-foreground-muted' : 'text-foreground-light font-medium'
                      )}>
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-accent-gold shrink-0 mt-1.5" />
                      )}
                    </div>
                    
                    <p className="text-foreground-muted text-xs line-clamp-2 mb-1.5">
                      {notification.body}
                    </p>
                    
                    <div className="flex items-center gap-2 text-foreground-muted/60 text-xs">
                      <span className={cn('px-1.5 py-0.5 rounded', typeInfo.color, 'bg-white/5')}>
                        {typeInfo.label}
                      </span>
                      <span>{getTimeAgo(notification.created_at)}</span>
                    </div>
                  </div>
                  
                  {/* Arrow indicator for clickable notifications */}
                  {notification.reservation_id && (
                    <ChevronLeft size={16} className="text-foreground-muted/40 shrink-0 mt-3" />
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Load More */}
          {hasMore && (
            <div className="p-4 border-t border-white/[0.04]">
              <button
                onClick={() => fetchNotifications(false)}
                disabled={refreshing}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-medium transition-all',
                  refreshing
                    ? 'opacity-50 cursor-not-allowed bg-white/5'
                    : 'bg-white/5 hover:bg-white/10 text-foreground-light'
                )}
              >
                {refreshing ? 'טוען...' : 'טען עוד'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
