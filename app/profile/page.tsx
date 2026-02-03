'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
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
  Edit2, 
  Check, 
  X, 
  LogOut,
  History,
  ChevronRight
} from 'lucide-react'
import { useBugReporter } from '@/hooks/useBugReporter'
import { useHaptics } from '@/hooks/useHaptics'
import { NotificationSettings } from '@/components/profile/NotificationSettings'
import { LogoutModal } from '@/components/profile/LogoutModal'

export default function ProfilePage() {
  const router = useRouter()
  const { customer, isLoggedIn, isLoading, isInitialized, logout } = useAuthStore()
  const { report } = useBugReporter('ProfilePage')
  const haptics = useHaptics()
  
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [appointmentCount, setAppointmentCount] = useState(0)
  const [loadingStats, setLoadingStats] = useState(true)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (isInitialized && !isLoggedIn) {
      router.replace('/')
    }
  }, [isInitialized, isLoggedIn, router])

  // Fetch appointment stats
  useEffect(() => {
    if (customer?.id || customer?.phone) {
      fetchStats()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, customer?.phone])

  const fetchStats = async () => {
    if (!customer) return
    
    setLoadingStats(true)
    
    try {
      const supabase = createClient()
      
      let query = supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
      
      if (customer.id) {
        query = query.or(`customer_id.eq.${customer.id},customer_phone.eq.${customer.phone}`)
      } else if (customer.phone) {
        query = query.eq('customer_phone', customer.phone)
      }
      
      const { count } = await query
      setAppointmentCount(count || 0)
    } catch (err) {
      console.error('Error fetching stats:', err)
      await report(err, 'Fetching customer profile stats')
    } finally {
      setLoadingStats(false)
    }
  }

  const handleEditName = () => {
    setNewName(customer?.fullname || '')
    setEditingName(true)
  }

  const handleCancelEdit = () => {
    setEditingName(false)
    setNewName('')
  }

  const handleSaveName = async () => {
    if (!customer || !newName.trim()) return
    
    setSavingName(true)
    
    try {
      // Use API route for updating customer (bypasses RLS)
      const response = await fetch('/api/customers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          fullname: newName.trim(),
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        console.error('Error updating name:', result.error)
        await report(new Error(result.error || 'Update failed'), 'Updating customer name')
        toast.error('שגיאה בעדכון השם')
        return
      }
      
      // Update local state
      useAuthStore.setState({
        customer: { ...customer, fullname: newName.trim() }
      })
      
      haptics.success() // Haptic feedback for settings saved
      toast.success('השם עודכן בהצלחה')
      setEditingName(false)
    } catch (err) {
      console.error('Error updating name:', err)
      await report(err, 'Updating customer name (exception)')
      toast.error('שגיאה בעדכון השם')
    } finally {
      setSavingName(false)
    }
  }

  const handleLogout = async () => {
    setShowLogoutModal(false)
    await logout()
    haptics.light() // Haptic feedback for logout
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

  if (!isLoggedIn || !customer) {
    return null
  }

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
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-accent-gold/20 flex items-center justify-center border-2 border-accent-gold/40">
                  <User size={48} strokeWidth={1} className="text-accent-gold" />
                </div>
              </div>
              
              {/* Name */}
              {editingName ? (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="px-4 py-2 bg-background-card border border-white/20 rounded-xl text-foreground-light text-center text-lg font-medium outline-none focus:border-accent-gold/50 transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName || !newName.trim()}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      savingName || !newName.trim()
                        ? 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    )}
                  >
                    <Check size={18} strokeWidth={2} />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={savingName}
                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center justify-center"
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h1 className="text-2xl sm:text-3xl text-foreground-light font-medium">
                    {customer.fullname}
                  </h1>
                  <button
                    onClick={handleEditName}
                    className="p-2 rounded-lg text-foreground-muted hover:text-accent-gold hover:bg-white/5 transition-colors flex items-center justify-center"
                    aria-label="ערוך שם"
                  >
                    <Edit2 size={16} strokeWidth={1.5} />
                  </button>
                </div>
              )}
              
              <p className="text-foreground-muted text-sm">
                לקוח רשום
              </p>
            </div>
            
            {/* Compact Info Card */}
            <GlassCard padding="lg" className="mb-8">
              <div className="grid grid-cols-3 gap-4 text-center">
                {/* Phone */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-accent-gold/10 flex items-center justify-center mb-2">
                    <Phone size={18} strokeWidth={1.5} className="text-accent-gold" />
                  </div>
                  <p className="text-foreground-muted text-[10px] mb-0.5">מספר טלפון</p>
                  <p className="text-foreground-light font-medium text-sm" dir="ltr">{customer.phone}</p>
                </div>
                
                {/* Registration Date */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-accent-gold/10 flex items-center justify-center mb-2">
                    <Calendar size={18} strokeWidth={1.5} className="text-accent-gold" />
                  </div>
                  <p className="text-foreground-muted text-[10px] mb-0.5">תאריך הרשמה</p>
                  <p className="text-foreground-light font-medium text-sm">
                    {customer.created_at ? formatDate(customer.created_at) : '-'}
                  </p>
                </div>
                
                {/* Appointment Count */}
                <button
                  onClick={() => router.push('/my-appointments')}
                  className="flex flex-col items-center group"
                  aria-label="צפה בתורים"
                >
                  <div className="w-10 h-10 rounded-full bg-accent-gold/10 flex items-center justify-center mb-2 group-hover:bg-accent-gold/20 transition-colors">
                    <History size={18} strokeWidth={1.5} className="text-accent-gold" />
                  </div>
                  <p className="text-foreground-muted text-[10px] mb-0.5">היסטוריית תורים</p>
                  <p className="text-foreground-light font-medium text-sm group-hover:text-accent-gold transition-colors">
                    {loadingStats ? '...' : `${appointmentCount} תורים`}
                  </p>
                </button>
              </div>
            </GlassCard>
            
            {/* Notification Settings */}
            <NotificationSettings className="mt-6" />
            
            {/* Actions */}
            <div className="space-y-3 mt-6">
              {/* View Appointments */}
              <button
                onClick={() => router.push('/my-appointments')}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold rounded-xl font-medium hover:bg-accent-gold/20 transition-all"
              >
                <Calendar size={20} strokeWidth={1.5} />
                <span>צפה בתורים שלי</span>
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

