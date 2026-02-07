/**
 * useReservationsRealtime Hook
 *
 * Manages the Supabase realtime subscription for reservation updates.
 * Includes automatic reconnection with exponential backoff and heartbeat monitoring.
 */

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/lib/toast'
import type { Reservation, Service } from '@/types/database'

interface ReservationWithService extends Reservation {
  services?: Service
}

interface UseReservationsRealtimeOptions {
  barberId: string | undefined
  onRefresh: () => void
}

interface UseReservationsRealtimeReturn {
  isRealtimeConnected: boolean
}

export const useReservationsRealtime = ({
  barberId,
  onRefresh,
}: UseReservationsRealtimeOptions): UseReservationsRealtimeReturn => {
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true)

  useEffect(() => {
    if (!barberId) return

    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let reconnectAttempts = 0
    const MAX_RECONNECT_ATTEMPTS = 5
    const RECONNECT_DELAY_BASE = 1000 // 1 second
    let reconnectTimeout: NodeJS.Timeout | null = null
    let isUnmounting = false

    const setupChannel = () => {
      if (isUnmounting) return

      // Clean up existing channel if any
      if (channel) {
        supabase.removeChannel(channel)
      }

      // Subscribe to reservation changes for this barber
      channel = supabase
        .channel(`reservations-barber-${barberId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'reservations',
            filter: `barber_id=eq.${barberId}`,
          },
          (payload) => {
            console.log('[Realtime] Reservation change detected:', payload.eventType)

            // Refresh data when any change occurs
            onRefresh()

            // Show toast for new bookings
            if (payload.eventType === 'INSERT') {
              const newRes = payload.new as ReservationWithService
              if (newRes.status === 'confirmed') {
                showToast.info('תור חדש התקבל!')
              }
            }

            // Show toast for cancellations by customer
            if (payload.eventType === 'UPDATE') {
              const updated = payload.new as ReservationWithService
              const old = payload.old as { status?: string }
              if (
                updated.status === 'cancelled' &&
                old.status === 'confirmed' &&
                updated.cancelled_by === 'customer'
              ) {
                showToast.warning('לקוח ביטל תור')
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Connected to reservation updates')
            setIsRealtimeConnected(true)
            reconnectAttempts = 0 // Reset on successful connection
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[Realtime] Connection error, status:', status)
            setIsRealtimeConnected(false)

            // Attempt reconnection with exponential backoff
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !isUnmounting) {
              const delay = RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts)
              console.log(
                `[Realtime] Attempting reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`
              )

              reconnectTimeout = setTimeout(() => {
                reconnectAttempts++
                setupChannel()
              }, delay)
            } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
              console.error('[Realtime] Max reconnection attempts reached')
              showToast.error('התנתק מעדכונים בזמן אמת. רענן את הדף.')
            }
          } else if (status === 'CLOSED') {
            console.log('[Realtime] Channel closed')
            setIsRealtimeConnected(false)
          }
        })
    }

    // Initial setup
    setupChannel()

    // Heartbeat check - verify connection every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (!isUnmounting && channel) {
        const state = (channel as unknown as { state?: string }).state
        if (state !== 'joined' && state !== 'joining') {
          console.log('[Realtime] Heartbeat detected disconnection, reconnecting...')
          setIsRealtimeConnected(false)
          setupChannel()
        }
      }
    }, 30000)

    // Cleanup subscription on unmount
    return () => {
      isUnmounting = true
      console.log('[Realtime] Unsubscribing from reservation updates')
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      clearInterval(heartbeatInterval)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberId])

  return { isRealtimeConnected }
}
