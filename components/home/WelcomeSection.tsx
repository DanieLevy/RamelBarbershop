'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { createClient } from '@/lib/supabase/client'
import { cn, formatTime, timestampToIsraelDate, nowInIsrael, isSameDayInIsrael } from '@/lib/utils'
import { Calendar, Clock, ChevronLeft, Scissors, LayoutDashboard, LogIn } from 'lucide-react'
import type { Reservation, Service, User as UserType } from '@/types/database'

interface ReservationWithDetails extends Reservation {
  services?: Service
  customers?: { fullname: string; phone: string | null }
  users?: UserType
}

interface WelcomeSectionProps {
  title?: string
  subtitle?: string
}

/**
 * WelcomeSection - Clean, RTL-aligned hero area
 *
 * Dynamic content based on user type:
 * - Guest: shop info card with login CTA
 * - Customer: greeting + upcoming appointment / book CTA
 * - Barber: greeting + next booked appointment / dashboard link
 */
export const WelcomeSection = ({
  title = 'רם אל ברברשופ',
}: WelcomeSectionProps) => {
  const { customer, isLoggedIn: isCustomerLoggedIn } = useAuthStore()
  const { barber, isLoggedIn: isBarberLoggedIn } = useBarberAuthStore()
  const { type: userType, isInitialized } = useCurrentUser()

  const [nextAppointment, setNextAppointment] = useState<ReservationWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Fetch next upcoming appointment - for customer or barber
  useEffect(() => {
    if (!isInitialized) return

    if (userType === 'customer' && isCustomerLoggedIn && customer?.id) {
      fetchCustomerNextAppointment()
    } else if (userType === 'barber' && isBarberLoggedIn && barber?.id) {
      fetchBarberNextAppointment()
    } else {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, userType, isCustomerLoggedIn, customer?.id, isBarberLoggedIn, barber?.id])

  const fetchCustomerNextAppointment = async () => {
    if (!customer?.id && !customer?.phone) {
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const now = Date.now()

      let query = supabase
        .from('reservations')
        .select('id, time_timestamp, customer_id, barber_id, service_id, services(name_he), users(fullname)')
        .eq('status', 'confirmed')
        .gt('time_timestamp', now)
        .order('time_timestamp', { ascending: true })
        .limit(1)

      if (customer.id) {
        query = query.eq('customer_id', customer.id)
      } else if (customer.phone) {
        query = query.eq('customer_phone', customer.phone)
      }

      const { data } = await query

      if (data && data.length > 0) {
        setNextAppointment(data[0] as ReservationWithDetails)
      }
    } catch (err) {
      console.error('Error fetching next appointment:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBarberNextAppointment = async () => {
    if (!barber?.id) {
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const now = Date.now()

      const { data } = await supabase
        .from('reservations')
        .select('id, time_timestamp, customer_id, barber_id, service_id, services(name_he), customers(fullname, phone)')
        .eq('barber_id', barber.id)
        .eq('status', 'confirmed')
        .gt('time_timestamp', now)
        .order('time_timestamp', { ascending: true })
        .limit(1)

      if (data && data.length > 0) {
        setNextAppointment(data[0] as ReservationWithDetails)
      }
    } catch (err) {
      console.error('Error fetching barber next appointment:', err)
    } finally {
      setLoading(false)
    }
  }

  // Smart date formatting
  const getSmartDate = (timestamp: number): string => {
    const date = timestampToIsraelDate(timestamp)
    const today = nowInIsrael()
    const tomorrowMs = today.getTime() + 24 * 60 * 60 * 1000

    if (isSameDayInIsrael(timestamp, today.getTime())) {
      return 'היום'
    } else if (isSameDayInIsrael(timestamp, tomorrowMs)) {
      return 'מחר'
    }
    return date.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const isCustomer = userType === 'customer'
  const isBarber = userType === 'barber'
  const isLoggedIn = isCustomerLoggedIn || isBarberLoggedIn
  const firstName = isCustomer
    ? customer?.fullname?.split(' ')[0]
    : barber?.fullname?.split(' ')[0]

  const isToday = nextAppointment
    ? isSameDayInIsrael(nextAppointment.time_timestamp, nowInIsrael().getTime())
    : false

  return (
    <section className="relative bg-background-dark overflow-hidden main-content-offset">
      {/* Subtle gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 80% 20%, rgba(255, 170, 61, 0.04) 0%, transparent 60%)',
        }}
      />

      {/* Logo */}
      <div className="flex items-center justify-center">
        <Image
          src="/logo_bg_tran.png"
          alt="רם אל ברברשופ"
          width={128}
          height={128}
          priority
        />
      </div>

      <div className="relative z-10 px-5 pt-2 pb-8">
        {/* ── Greeting / Title - RTL aligned ── */}
        <div
          className={cn(
            'transition-all duration-700 ease-out',
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}
        >
          {isInitialized && isLoggedIn && firstName ? (
            <>
              <div className="flex items-center gap-2">
                <p className="text-foreground-muted/70 text-sm">שלום,</p>
                <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                  {firstName} 👋
                </h1>
              </div>
              <p className="text-foreground-muted text-sm mt-1">מספרת רם אל ברברשופ</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-1">
                {title}
              </h1>
              <p className="text-foreground-muted text-sm"></p>
            </>
          )}
        </div>

        {/* ── Appointment / Action Card Area ── */}
        <div
          className={cn(
            'mt-5 transition-all duration-700 ease-out',
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}
          style={{ transitionDelay: '150ms' }}
        >
          {/* ── CUSTOMER: Has upcoming appointment ── */}
          {isInitialized && isCustomer && isLoggedIn && !loading && nextAppointment && (
            <Link
              href="/my-appointments"
              className={cn(
                'block rounded-2xl p-4',
                'bg-[#1a1a1a] border border-white/[0.08]',
                'hover:border-accent-gold/20 transition-all duration-200',
                'active:scale-[0.99]'
              )}
              aria-label="צפה בתורים שלך"
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold tracking-wide text-accent-gold uppercase">
                  התור הקרוב
                </span>
                <ChevronLeft size={16} className="text-foreground-muted/40" />
              </div>

              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-11 h-11 rounded-md flex items-center justify-center shrink-0',
                  isToday ? 'bg-accent-gold/20' : 'bg-white/[0.05]'
                )}>
                  <Calendar size={18} className={isToday ? 'text-accent-gold' : 'text-foreground-muted'} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">
                    <span className={cn(isToday && 'text-accent-gold')}>
                      {getSmartDate(nextAppointment.time_timestamp)}
                    </span>
                    <span className="text-foreground-muted mx-1.5">•</span>
                    <span dir="ltr">{formatTime(nextAppointment.time_timestamp)}</span>
                  </p>
                  <p className="text-foreground-muted text-xs mt-0.5 flex items-center gap-1.5 truncate">
                    <Scissors size={10} />
                    <span className="truncate">{nextAppointment.services?.name_he}</span>
                    {nextAppointment.users?.fullname && (
                      <>
                        <span className="text-foreground-muted/40">•</span>
                        <span className="truncate">{nextAppointment.users.fullname}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* ── CUSTOMER: No upcoming appointment ── */}
          {isInitialized && isCustomer && isLoggedIn && !loading && !nextAppointment && (
            <div className={cn('rounded-2xl p-4', 'bg-[#1a1a1a] border border-white/[0.08]')}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-md bg-white/[0.05] flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-foreground-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">אין תורים קרובים</p>
                  <p className="text-foreground-muted text-xs mt-0.5">קבע תור חדש ובחר ספר</p>
                </div>
                <button
                  onClick={() => {
                    const el = document.getElementById('team')
                    el?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className={cn(
                    'px-4 py-2 rounded-xl shrink-0',
                    'bg-accent-gold text-[#141414]',
                    'text-xs font-semibold',
                    'hover:bg-accent-gold/90 transition-colors duration-200',
                    'active:scale-[0.97]'
                  )}
                  aria-label="קבע תור עכשיו"
                  tabIndex={0}
                >
                  קבע תור
                </button>
              </div>
            </div>
          )}

          {/* ── BARBER: Has upcoming reservation ── */}
          {isInitialized && isBarber && isLoggedIn && !loading && nextAppointment && (
            <div className={cn('rounded-2xl p-4', 'bg-[#1a1a1a] border border-white/[0.08]')}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold tracking-wide text-accent-gold uppercase">
                 התור הקרוב
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  'w-11 h-11 rounded-md flex items-center justify-center shrink-0',
                  isToday ? 'bg-accent-gold/20' : 'bg-white/[0.05]'
                )}>
                  <Calendar size={18} className={isToday ? 'text-accent-gold' : 'text-foreground-muted'} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">
                    <span className={cn(isToday && 'text-accent-gold')}>
                      {getSmartDate(nextAppointment.time_timestamp)}
                    </span>
                    <span className="text-foreground-muted mx-1.5">•</span>
                    <span dir="ltr">{formatTime(nextAppointment.time_timestamp)}</span>
                  </p>
                  <p className="text-foreground-muted text-xs mt-0.5 flex items-center gap-1.5 truncate">
                    <Scissors size={10} />
                    <span className="truncate">{nextAppointment.services?.name_he}</span>
                    {nextAppointment.customers?.fullname && (
                      <>
                        <span className="text-foreground-muted/40">•</span>
                        <span className="truncate">{nextAppointment.customers.fullname}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Quick actions for barber */}
              <div className="flex items-center gap-2">
                <Link
                  href="/barber/dashboard/reservations"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl',
                    'bg-white/[0.05] border border-white/[0.06]',
                    'text-foreground-light text-xs font-medium',
                    'hover:bg-white/[0.08] transition-colors duration-200',
                    'active:scale-[0.97]'
                  )}
                >
                  <Calendar size={14} strokeWidth={1.5} />
                  <span>כל התורים</span>
                </Link>
                <Link
                  href="/barber/dashboard"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl',
                    'bg-accent-gold/15 border border-accent-gold/20',
                    'text-accent-gold text-xs font-medium',
                    'hover:bg-accent-gold/20 transition-colors duration-200',
                    'active:scale-[0.97]'
                  )}
                >
                  <LayoutDashboard size={14} strokeWidth={1.5} />
                  <span>לוח בקרה</span>
                </Link>
              </div>
            </div>
          )}

          {/* ── BARBER: No upcoming reservations ── */}
          {isInitialized && isBarber && isLoggedIn && !loading && !nextAppointment && (
            <div className={cn('rounded-2xl p-4', 'bg-[#1a1a1a] border border-white/[0.08]')}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-md bg-white/[0.05] flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-foreground-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">אין תורים קרובים</p>
                  <p className="text-foreground-muted text-xs mt-0.5">אין לך תורים מתוזמנים כרגע</p>
                </div>
              </div>

              <Link
                href="/barber/dashboard"
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl w-full',
                  'bg-accent-gold/15 border border-accent-gold/20',
                  'text-accent-gold text-xs font-medium',
                  'hover:bg-accent-gold/20 transition-colors duration-200',
                  'active:scale-[0.97]'
                )}
              >
                <LayoutDashboard size={14} strokeWidth={1.5} />
                <span>לוח בקרה</span>
              </Link>
            </div>
          )}

          {/* ── Loading state ── */}
          {isInitialized && isLoggedIn && loading && (
            <div className="rounded-2xl p-4 bg-[#1a1a1a] border border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-md bg-white/[0.05] animate-pulse" />
                <div className="flex-1">
                  <div className="h-3.5 bg-white/[0.05] rounded w-28 animate-pulse" />
                  <div className="h-3 bg-white/[0.05] rounded w-40 mt-1.5 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* ── Not logged in - designed card with login CTA ── */}
          {isInitialized && !isLoggedIn && (
            <div className={cn('rounded-2xl p-4', 'bg-[#1a1a1a] border border-white/[0.08]')}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-md bg-white/[0.05] flex items-center justify-center shrink-0">
                  <Clock size={18} className="text-foreground-muted/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground-light text-sm font-medium">ניהול תורים</p>
                  <p className="text-foreground-muted text-xs mt-0.5">התחבר כדי לראות ולנהל את התורים שלך</p>
                </div>
                <button
                  onClick={() => {
                    // Trigger login modal via scrolling to profile nav or dispatch event
                    const loginBtn = document.querySelector('[aria-label="כניסה"]') as HTMLButtonElement
                    loginBtn?.click()
                  }}
                  className={cn(
                    'px-3.5 py-2 rounded-xl shrink-0',
                    'bg-white/[0.06] border border-white/[0.08]',
                    'text-foreground-light text-xs font-medium',
                    'hover:bg-white/[0.1] transition-colors duration-200',
                    'active:scale-[0.97]',
                    'flex items-center gap-1.5'
                  )}
                  aria-label="התחברות"
                  tabIndex={0}
                >
                  <LogIn size={13} strokeWidth={1.5} />
                  <span>כניסה</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default WelcomeSection
