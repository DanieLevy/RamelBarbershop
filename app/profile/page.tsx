'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/AppHeader'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
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
        <div className="px-4 py-4 pb-24">
          <div className="max-w-sm mx-auto">
            {/* Compact Profile Card */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3">
                {/* Small Avatar */}
                <div className="w-14 h-14 shrink-0 rounded-full bg-accent-gold/15 flex items-center justify-center border border-accent-gold/30">
                  <User size={24} strokeWidth={1.5} className="text-accent-gold" />
                </div>
                
                {/* Name & Info */}
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-background-card border border-white/20 rounded-lg text-foreground-light text-sm font-medium outline-none focus:border-accent-gold/50 transition-colors"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={savingName || !newName.trim()}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          savingName || !newName.trim()
                            ? 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        )}
                      >
                        <Check size={14} strokeWidth={2} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={savingName}
                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-lg text-foreground-light font-medium truncate">
                        {customer.fullname}
                      </h1>
                      <button
                        onClick={handleEditName}
                        className="p-1 rounded text-foreground-muted/50 hover:text-accent-gold transition-colors shrink-0"
                        aria-label="ערוך שם"
                      >
                        <Edit2 size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                  <p className="text-foreground-muted text-xs flex items-center gap-1.5 mt-0.5">
                    <Phone size={10} strokeWidth={1.5} />
                    <span dir="ltr">{customer.phone}</span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-foreground-muted text-[10px] mb-1">
                  <Calendar size={10} strokeWidth={1.5} />
                  <span>תאריך הרשמה</span>
                </div>
                <p className="text-foreground-light font-medium text-sm">
                  {customer.created_at ? formatDate(customer.created_at) : '-'}
                </p>
              </div>
              
              <button
                onClick={() => router.push('/my-appointments')}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center hover:bg-white/[0.04] transition-colors group"
                aria-label="צפה בתורים"
              >
                <div className="flex items-center justify-center gap-1.5 text-foreground-muted text-[10px] mb-1">
                  <History size={10} strokeWidth={1.5} />
                  <span>תורים</span>
                </div>
                <p className="text-foreground-light font-medium text-sm group-hover:text-accent-gold transition-colors">
                  {loadingStats ? '...' : appointmentCount}
                </p>
              </button>
            </div>
            
            {/* Notification Settings - Compact */}
            <NotificationSettings className="mb-4" />
            
            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                onClick={() => router.push('/my-appointments')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-accent-gold/10 border border-accent-gold/20 text-accent-gold rounded-xl text-sm font-medium hover:bg-accent-gold/15 transition-all"
              >
                <Calendar size={18} strokeWidth={1.5} />
                <span>התורים שלי</span>
                <ChevronRight size={14} strokeWidth={1.5} className="mr-auto rotate-180" />
              </button>
              
              <button
                onClick={() => setShowLogoutModal(true)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-red-500/5 border border-red-500/10 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/10 transition-all"
              >
                <LogOut size={18} strokeWidth={1.5} />
                <span>התנתק</span>
              </button>
            </div>
            
            {/* Back to Home */}
            <button
              onClick={() => router.push('/')}
              className="w-full mt-4 py-2 text-foreground-muted hover:text-foreground-light text-xs transition-colors flex items-center justify-center gap-1"
            >
              <ChevronRight size={10} strokeWidth={1.5} />
              <span>חזרה לדף הבית</span>
            </button>
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

