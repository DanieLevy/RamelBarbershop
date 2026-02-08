'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/AppHeader'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  User,
  Phone,
  Calendar,
  Edit2,
  Check,
  X,
  LogOut,
  History,
  ChevronRight,
  Shield,
  LayoutDashboard,
} from 'lucide-react'
import { useBugReporter } from '@/hooks/useBugReporter'
import { useHaptics } from '@/hooks/useHaptics'
import { NotificationSettings } from '@/components/profile/NotificationSettings'
import { BarberNotificationSettings } from '@/components/profile/BarberNotificationSettings'
import { LogoutModal } from '@/components/profile/LogoutModal'
import { Button, Avatar } from '@heroui/react'
import Image from 'next/image'

// ============================================================================
// Types
// ============================================================================

export type ProfileUserType = 'customer' | 'barber'

export interface ProfileUser {
  id: string
  fullname: string
  phone: string | null
  created_at?: string | null
  /** Barber-only fields */
  img_url?: string | null
  role?: string
}

export interface UnifiedProfilePageProps {
  userType: ProfileUserType
  user: ProfileUser
  isLoggedIn: boolean
  isLoading: boolean
  isInitialized: boolean
  logout: () => Promise<void> | void
  /** Where to redirect on logout (default: '/') */
  logoutRedirect?: string
  /** Where to redirect if not logged in */
  loginRedirect?: string
  /** Customer-only: allow name editing */
  allowNameEdit?: boolean
  /** Customer-only: update name handler */
  onNameUpdate?: (newName: string) => void
}

// ============================================================================
// Component
// ============================================================================

export function UnifiedProfilePage({
  userType,
  user,
  isLoggedIn,
  isLoading,
  isInitialized,
  logout,
  logoutRedirect = '/',
  loginRedirect,
  allowNameEdit = false,
  onNameUpdate,
}: UnifiedProfilePageProps) {
  const router = useRouter()
  const { report } = useBugReporter('UnifiedProfilePage')
  const haptics = useHaptics()

  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [appointmentCount, setAppointmentCount] = useState(0)
  const [loadingStats, setLoadingStats] = useState(true)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const isBarber = userType === 'barber'
  const isAdmin = isBarber && user?.role === 'admin'

  // Redirect if not logged in
  useEffect(() => {
    if (isInitialized && !isLoggedIn) {
      router.replace(loginRedirect || (isBarber ? '/barber/login' : '/'))
    }
  }, [isInitialized, isLoggedIn, router, loginRedirect, isBarber])

  // Fetch appointment stats
  useEffect(() => {
    if (user?.id) {
      fetchStats()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const fetchStats = async () => {
    if (!user) return
    setLoadingStats(true)

    try {
      const supabase = createClient()

      if (isBarber) {
        const { count } = await supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('barber_id', user.id)
          .eq('status', 'confirmed')
        setAppointmentCount(count || 0)
      } else {
        let query = supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
        query = query.or(`customer_id.eq.${user.id},customer_phone.eq.${user.phone}`)
        const { count } = await query
        setAppointmentCount(count || 0)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
      await report(err, `Fetching ${userType} profile stats`)
    } finally {
      setLoadingStats(false)
    }
  }

  // ── Name editing (customer only) ──

  const handleEditName = () => {
    setNewName(user?.fullname || '')
    setEditingName(true)
  }

  const handleCancelEdit = () => {
    setEditingName(false)
    setNewName('')
  }

  const handleSaveName = async () => {
    if (!user || !newName.trim()) return
    setSavingName(true)

    try {
      const response = await fetch('/api/customers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: user.id, fullname: newName.trim() }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error('Error updating name:', result.error)
        await report(new Error(result.error || 'Update failed'), 'Updating customer name')
        showToast.error('שגיאה בעדכון השם')
        return
      }

      onNameUpdate?.(newName.trim())
      haptics.success()
      showToast.success('השם עודכן בהצלחה')
      setEditingName(false)
    } catch (err) {
      console.error('Error updating name:', err)
      await report(err, 'Updating customer name (exception)')
      showToast.error('שגיאה בעדכון השם')
    } finally {
      setSavingName(false)
    }
  }

  // ── Logout ──

  const handleLogout = async () => {
    setShowLogoutModal(false)
    await logout()
    haptics.light()
    router.replace(logoutRedirect)
    showToast.success('התנתקת בהצלחה')
  }

  // ── Helpers ──

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return 'לא ידוע'
    }
  }

  const appointmentsPath = isBarber ? '/barber/dashboard/reservations' : '/my-appointments'
  const appointmentsLabel = isBarber ? 'תורים פעילים' : 'תורים'

  // ── Loading state ──

  if (!isInitialized || isLoading) {
    return (
      <>
        <AppHeader />
        <main className="main-content-offset min-h-screen px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <ScissorsLoader size="lg" text="טוען..." />
          </div>
        </main>
      </>
    )
  }

  if (!isLoggedIn || !user) {
    return null
  }

  // ── Render ──

  return (
    <>
      <AppHeader />

      <main id="main-content" tabIndex={-1} className="main-content-offset min-h-screen bg-background-dark outline-none">
        <div className="px-4 py-6 pb-24">
          <div className="max-w-md mx-auto">

            {/* ── Profile Card ── */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-5">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative shrink-0">
                  {isBarber && user.img_url ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-accent-gold/40">
                      <Image
                        src={user.img_url}
                        alt={user.fullname}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <Avatar size="lg" className="w-16 h-16 border border-accent-gold/30">
                      <Avatar.Fallback className="bg-accent-gold/15 text-accent-gold">
                        <User size={28} strokeWidth={1.5} />
                      </Avatar.Fallback>
                    </Avatar>
                  )}
                  {isAdmin && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-accent-gold rounded-full flex items-center justify-center border-2 border-background-dark">
                      <Shield size={10} className="text-background-dark" />
                    </div>
                  )}
                </div>

                {/* Name & Info */}
                <div className="flex-1 min-w-0">
                  {allowNameEdit && editingName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-background-card border border-white/20 rounded-lg text-foreground-light text-sm font-medium outline-none focus:border-accent-gold/50 transition-colors"
                        autoFocus
                        aria-label="שם חדש"
                      />
                      <Button
                        variant="ghost"
                        isIconOnly
                        onPress={handleSaveName}
                        isDisabled={savingName || !newName.trim()}
                        className={cn(
                          'min-w-[28px] w-7 h-7',
                          !savingName && newName.trim() && 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        )}
                        aria-label="שמור שם"
                      >
                        <Check size={14} strokeWidth={2} />
                      </Button>
                      <Button
                        variant="ghost"
                        isIconOnly
                        onPress={handleCancelEdit}
                        isDisabled={savingName}
                        className="min-w-[28px] w-7 h-7 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        aria-label="ביטול עריכה"
                      >
                        <X size={14} strokeWidth={2} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-lg text-foreground-light font-medium truncate">
                        {user.fullname}
                      </h1>
                      {allowNameEdit && (
                        <Button
                          variant="ghost"
                          isIconOnly
                          onPress={handleEditName}
                          className="min-w-[24px] w-6 h-6 text-foreground-muted/50 hover:text-accent-gold"
                          aria-label="ערוך שם"
                        >
                          <Edit2 size={12} strokeWidth={1.5} />
                        </Button>
                      )}
                    </div>
                  )}

                  <p className="text-foreground-muted text-xs flex items-center gap-1.5 mt-0.5">
                    <Phone size={10} strokeWidth={1.5} />
                    <span dir="ltr">{user.phone}</span>
                  </p>

                  {isBarber && (
                    <p className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full inline-block mt-1.5',
                      isAdmin
                        ? 'bg-accent-gold/20 text-accent-gold'
                        : 'bg-white/10 text-foreground-muted'
                    )}>
                      {isAdmin ? 'מנהל' : 'ספר'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {/* Registration Date */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-foreground-muted text-[10px] mb-1">
                  <Calendar size={10} strokeWidth={1.5} />
                  <span>תאריך הרשמה</span>
                </div>
                <p className="text-foreground-light font-medium text-sm">
                  {user.created_at ? formatDate(user.created_at) : '-'}
                </p>
              </div>

              {/* Appointments Count - Full width tappable */}
              <button
                onClick={() => router.push(appointmentsPath)}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center hover:bg-white/[0.04] transition-colors"
                aria-label="צפה בתורים"
                tabIndex={0}
              >
                <div className="flex items-center justify-center gap-1.5 text-foreground-muted text-[10px] mb-1">
                  <History size={10} strokeWidth={1.5} />
                  <span>{appointmentsLabel}</span>
                </div>
                <p className="text-foreground-light font-medium text-sm">
                  {loadingStats ? '...' : `${appointmentCount} תורים`}
                </p>
              </button>
            </div>

            {/* ── Notification Settings ── */}
            {isBarber ? (
              <BarberNotificationSettings className="mb-5" />
            ) : (
              <NotificationSettings className="mb-5" />
            )}

            {/* ── Action Buttons - Side by side ── */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {/* Primary Action */}
              <button
                onClick={() => router.push(isBarber ? '/barber/dashboard' : '/my-appointments')}
                className="flex items-center justify-center gap-2 px-4 py-3.5 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold rounded-xl font-medium hover:bg-accent-gold/20 transition-all text-sm"
                aria-label={isBarber ? 'לוח בקרה' : 'התורים שלי'}
                tabIndex={0}
              >
                {isBarber ? (
                  <LayoutDashboard size={18} strokeWidth={1.5} />
                ) : (
                  <Calendar size={18} strokeWidth={1.5} />
                )}
                <span>{isBarber ? 'לוח בקרה' : 'התורים שלי'}</span>
              </button>

              {/* Logout */}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-all text-sm"
                aria-label="התנתק"
                tabIndex={0}
              >
                <LogOut size={18} strokeWidth={1.5} />
                <span>התנתק</span>
              </button>
            </div>

            {/* ── Back to Home ── */}
            <div className="text-center">
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground-light text-xs transition-colors py-2"
                aria-label="חזרה לדף הבית"
                tabIndex={0}
              >
                <ChevronRight size={10} strokeWidth={1.5} />
                <span>חזרה לדף הבית</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </>
  )
}

export default UnifiedProfilePage
