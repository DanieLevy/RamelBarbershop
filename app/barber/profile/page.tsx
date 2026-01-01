'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/AppHeader'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { GlassCard } from '@/components/ui/GlassCard'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  User, 
  Phone, 
  Calendar, 
  LogOut,
  History,
  ChevronRight,
  Shield,
  LayoutDashboard
} from 'lucide-react'
import { useBugReporter } from '@/hooks/useBugReporter'
import { BarberNotificationSettings } from '@/components/profile/BarberNotificationSettings'
import { LogoutModal } from '@/components/profile/LogoutModal'
import Image from 'next/image'

export default function BarberProfilePage() {
  const router = useRouter()
  const { barber, isLoggedIn, isLoading, isInitialized, logout } = useBarberAuthStore()
  const { report } = useBugReporter('BarberProfilePage')
  
  const [appointmentCount, setAppointmentCount] = useState(0)
  const [loadingStats, setLoadingStats] = useState(true)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    if (isInitialized && !isLoggedIn) {
      router.replace('/barber/login')
    }
  }, [isInitialized, isLoggedIn, router])

  useEffect(() => {
    if (barber?.id) {
      fetchStats()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])

  const fetchStats = async () => {
    if (!barber) return
    
    setLoadingStats(true)
    
    try {
      const supabase = createClient()
      
      const { count } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('barber_id', barber.id)
        .eq('status', 'confirmed')
      
      setAppointmentCount(count || 0)
    } catch (err) {
      console.error('Error fetching stats:', err)
      await report(err, 'Fetching barber profile stats')
    } finally {
      setLoadingStats(false)
    }
  }

  const handleLogout = () => {
    setShowLogoutModal(false)
    logout()
    router.replace('/')
    toast.success('התנתקת בהצלחה')
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'לא ידוע'
    }
  }

  if (!isInitialized || isLoading) {
    return (
      <>
        <AppHeader />
        <main className="relative top-24 min-h-screen px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <ScissorsLoader size="lg" text="טוען..." />
          </div>
        </main>
      </>
    )
  }

  if (!isLoggedIn || !barber) {
    return null
  }

  const isAdmin = barber.role === 'admin'

  return (
    <>
      <AppHeader />
      
      <main id="main-content" tabIndex={-1} className="relative top-20 sm:top-24 min-h-screen bg-background-dark outline-none">
        <div className="container-mobile py-6 sm:py-8 pb-24">
          <div className="max-w-md mx-auto">
            {/* Profile Header */}
            <div className="text-center mb-8">
              {/* Avatar */}
              <div className="relative inline-block mb-4">
                {barber.img_url ? (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-accent-gold/40">
                    <Image
                      src={barber.img_url}
                      alt={barber.fullname}
                      width={112}
                      height={112}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-accent-gold/20 flex items-center justify-center border-2 border-accent-gold/40">
                    <User size={48} strokeWidth={1} className="text-accent-gold" />
                  </div>
                )}
                {isAdmin && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-accent-gold rounded-full flex items-center justify-center border-2 border-background-dark">
                    <Shield size={14} className="text-background-dark" />
                  </div>
                )}
              </div>
              
              {/* Name */}
              <h1 className="text-2xl sm:text-3xl text-foreground-light font-medium mb-1">
                {barber.fullname}
              </h1>
              
              <p className={cn(
                'text-sm font-medium px-3 py-1 rounded-full inline-block',
                isAdmin 
                  ? 'bg-accent-gold/20 text-accent-gold' 
                  : 'bg-white/10 text-foreground-muted'
              )}>
                {isAdmin ? 'מנהל' : 'ספר'}
              </p>
            </div>
            
            {/* Info Cards */}
            <div className="space-y-3 mb-8">
              {/* Phone */}
              <GlassCard padding="md" className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent-gold/10 flex items-center justify-center flex-shrink-0">
                  <Phone size={18} strokeWidth={1.5} className="text-accent-gold" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-foreground-muted text-xs mb-0.5">מספר טלפון</p>
                  <p className="text-foreground-light font-medium">{barber.phone}</p>
                </div>
              </GlassCard>
              
              {/* Registration Date */}
              <GlassCard padding="md" className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent-gold/10 flex items-center justify-center flex-shrink-0">
                  <Calendar size={18} strokeWidth={1.5} className="text-accent-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-foreground-muted text-xs mb-0.5">תאריך הצטרפות</p>
                  <p className="text-foreground-light font-medium">
                    {barber.created_at ? formatDate(barber.created_at) : 'לא ידוע'}
                  </p>
                </div>
              </GlassCard>
              
              {/* Appointment Count */}
              <GlassCard padding="md" className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent-gold/10 flex items-center justify-center flex-shrink-0">
                  <History size={18} strokeWidth={1.5} className="text-accent-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-foreground-muted text-xs mb-0.5">תורים פעילים</p>
                  <p className="text-foreground-light font-medium">
                    {loadingStats ? '...' : `${appointmentCount} תורים`}
                  </p>
                </div>
                <button
                  onClick={() => router.push('/barber/dashboard/reservations')}
                  className="p-2 rounded-lg text-foreground-muted hover:text-accent-gold hover:bg-white/5 transition-colors"
                  aria-label="צפה בתורים"
                >
                  <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
                </button>
              </GlassCard>
            </div>
            
            {/* Notification Settings */}
            <BarberNotificationSettings className="mt-6" />
            
            {/* Actions */}
            <div className="space-y-3 mt-6">
              {/* Go to Dashboard */}
              <button
                onClick={() => router.push('/barber/dashboard')}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold rounded-xl font-medium hover:bg-accent-gold/20 transition-all"
              >
                <LayoutDashboard size={20} strokeWidth={1.5} />
                <span>לוח בקרה</span>
              </button>
              
              {/* Logout */}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-all"
              >
                <LogOut size={20} strokeWidth={1.5} />
                <span>התנתק</span>
              </button>
            </div>
            
            {/* Back Button */}
            <div className="mt-8 text-center">
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground-light text-sm transition-colors py-2"
              >
                <ChevronRight size={12} strokeWidth={1.5} />
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

