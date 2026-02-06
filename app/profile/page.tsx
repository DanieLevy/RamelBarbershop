'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
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
  ChevronRight
} from 'lucide-react'
import { useBugReporter } from '@/hooks/useBugReporter'
import { useHaptics } from '@/hooks/useHaptics'
import { NotificationSettings } from '@/components/profile/NotificationSettings'
import { LogoutModal } from '@/components/profile/LogoutModal'
import { Button, Avatar } from '@heroui/react'

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
        showToast.error('שגיאה בעדכון השם')
        return
      }
      
      // Update local state
      useAuthStore.setState({
        customer: { ...customer, fullname: newName.trim() }
      })
      
      haptics.success() // Haptic feedback for settings saved
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

  const handleLogout = async () => {
    setShowLogoutModal(false)
    await logout()
    haptics.light() // Haptic feedback for logout
    router.replace('/')
    showToast.success('התנתקת בהצלחה')
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
                <Avatar size="lg" className="shrink-0 w-14 h-14 border border-accent-gold/30">
                  <Avatar.Fallback className="bg-accent-gold/15 text-accent-gold">
                    <User size={24} strokeWidth={1.5} />
                  </Avatar.Fallback>
                </Avatar>
                
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
                      <Button
                        variant="ghost"
                        isIconOnly
                        onPress={handleSaveName}
                        isDisabled={savingName || !newName.trim()}
                        className={cn(
                          'min-w-[28px] w-7 h-7',
                          !savingName && newName.trim() && 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        )}
                      >
                        <Check size={14} strokeWidth={2} />
                      </Button>
                      <Button
                        variant="ghost"
                        isIconOnly
                        onPress={handleCancelEdit}
                        isDisabled={savingName}
                        className="min-w-[28px] w-7 h-7 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        <X size={14} strokeWidth={2} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-lg text-foreground-light font-medium truncate">
                        {customer.fullname}
                      </h1>
                      <Button
                        variant="ghost"
                        isIconOnly
                        onPress={handleEditName}
                        className="min-w-[24px] w-6 h-6 text-foreground-muted/50 hover:text-accent-gold"
                        aria-label="ערוך שם"
                      >
                        <Edit2 size={12} strokeWidth={1.5} />
                      </Button>
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
              
              <Button
                variant="ghost"
                onPress={() => router.push('/my-appointments')}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center h-auto flex-col"
                aria-label="צפה בתורים"
              >
                <div className="flex items-center justify-center gap-1.5 text-foreground-muted text-[10px] mb-1">
                  <History size={10} strokeWidth={1.5} />
                  <span>תורים</span>
                </div>
                <p className="text-foreground-light font-medium text-sm">
                  {loadingStats ? '...' : appointmentCount}
                </p>
              </Button>
            </div>
            
            {/* Notification Settings - Compact */}
            <NotificationSettings className="mb-4" />
            
            {/* Quick Actions */}
            <div className="space-y-2">
              <Button
                variant="secondary"
                onPress={() => router.push('/my-appointments')}
                className="w-full justify-start gap-3 bg-accent-gold/10 border border-accent-gold/20 text-accent-gold hover:bg-accent-gold/15"
              >
                <Calendar size={18} strokeWidth={1.5} />
                <span>התורים שלי</span>
                <ChevronRight size={14} strokeWidth={1.5} className="mr-auto rotate-180" />
              </Button>
              
              <Button
                variant="danger"
                onPress={() => setShowLogoutModal(true)}
                className="w-full justify-start gap-3 bg-red-500/5 border border-red-500/10"
              >
                <LogOut size={18} strokeWidth={1.5} />
                <span>התנתק</span>
              </Button>
            </div>
            
            {/* Back to Home */}
            <Button
              variant="ghost"
              onPress={() => router.push('/')}
              className="w-full mt-4 text-foreground-muted text-xs"
            >
              <ChevronRight size={10} strokeWidth={1.5} />
              <span>חזרה לדף הבית</span>
            </Button>
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

