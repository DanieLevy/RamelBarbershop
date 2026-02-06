'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { 
  Users, Search, Ban, Trash2, Shield, ShieldOff,
  Calendar, Phone, User, X, ChevronLeft, ChevronRight, Mail, MessageSquare
} from 'lucide-react'
import type { Customer } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'
import { Button, Avatar } from '@heroui/react'

interface CustomerWithStats extends Customer {
  reservation_count?: number
}

const ITEMS_PER_PAGE = 20

export default function UsersManagementPage() {
  const router = useRouter()
  const { isAdmin, isInitialized } = useBarberAuthStore()
  const { report } = useBugReporter('UsersManagementPage')
  
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Confirmation modals
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    type: 'block' | 'unblock' | 'delete'
    customer: CustomerWithStats | null
  }>({ isOpen: false, type: 'block', customer: null })

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    newThisMonth: 0,
    blocked: 0
  })

  useEffect(() => {
    if (isInitialized && !isAdmin) {
      router.push('/barber/dashboard')
      showToast.error('אין לך הרשאה לצפות בדף זה')
    }
  }, [isAdmin, isInitialized, router])

  useEffect(() => {
    if (isAdmin) {
      fetchCustomers()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const fetchCustomers = async () => {
    setLoading(true)
    
    try {
      const supabase = createClient()
      
      // Fetch all customers
      const { data: customersData, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching customers:', error)
        await report(new Error(error.message), 'Fetching customers list')
        showToast.error('שגיאה בטעינת הלקוחות')
        return
      }

      // Fetch reservation counts for each customer
      const customersWithStats: CustomerWithStats[] = await Promise.all(
        (customersData || []).map(async (customer: Customer) => {
          const { count } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id)
          
          return {
            ...customer,
            reservation_count: count || 0
          }
        })
      )
      
      setCustomers(customersWithStats)
      
      // Calculate stats
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      
      setStats({
        total: customersWithStats.length,
        newThisMonth: customersWithStats.filter(c => c.created_at && new Date(c.created_at) >= monthStart).length,
        blocked: customersWithStats.filter(c => c.is_blocked).length
      })
    } catch (err) {
      console.error('Error fetching customers:', err)
      await report(err, 'Fetching customers (exception)')
      showToast.error('שגיאה בטעינת הלקוחות')
    } finally {
      setLoading(false)
    }
  }

  const handleBlockUnblock = async (customerId: string, block: boolean) => {
    setActionLoading(customerId)
    
    try {
      const supabase = createClient()
      
      const updateData = block 
        ? { is_blocked: true, blocked_at: new Date().toISOString() }
        : { is_blocked: false, blocked_at: null, blocked_reason: null }
      
      const { error } = await supabase.from('customers')
        .update(updateData)
        .eq('id', customerId)
      
      if (error) {
        console.error('Error updating customer:', error)
        await report(new Error(error.message), `${block ? 'Blocking' : 'Unblocking'} customer`)
        showToast.error(block ? 'שגיאה בחסימת המשתמש' : 'שגיאה בהסרת החסימה')
        return
      }
      
      showToast.success(block ? 'המשתמש נחסם בהצלחה' : 'החסימה הוסרה בהצלחה')
      setConfirmModal({ isOpen: false, type: 'block', customer: null })
      await fetchCustomers()
    } catch (err) {
      console.error('Error:', err)
      showToast.error('שגיאה בעדכון המשתמש')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (customerId: string) => {
    setActionLoading(customerId)
    
    try {
      const supabase = createClient()
      
      // 1. First, cancel all active (confirmed) future reservations
      // This is important to mark them as cancelled before deletion
      const { data: activeReservations, error: fetchError } = await supabase
        .from('reservations')
        .select('id, barber_id, time_timestamp')
        .eq('customer_id', customerId)
        .eq('status', 'confirmed')
        .gt('time_timestamp', Date.now())
      
      if (fetchError) {
        console.error('Error fetching active reservations:', fetchError)
      }
      
      if (activeReservations && activeReservations.length > 0) {
        // Cancel all active future reservations
        const { error: cancelError } = await supabase
          .from('reservations')
          .update({ 
            status: 'cancelled',
            cancelled_by: 'system', // System cancellation due to user deletion
            cancellation_reason: 'משתמש נמחק מהמערכת'
          })
          .eq('customer_id', customerId)
          .eq('status', 'confirmed')
        
        if (cancelError) {
          console.error('Error cancelling active reservations:', cancelError)
          await report(new Error(cancelError.message), 'Cancelling reservations before user deletion')
        } else {
          console.log(`Cancelled ${activeReservations.length} active reservations for deleted customer`)
        }
      }
      
      // 2. Deactivate push subscriptions (don't delete - mark inactive for audit trail)
      const { error: pushError } = await supabase
        .from('push_subscriptions')
        .update({ 
          is_active: false,
          customer_id: null, // Orphan the subscription
          last_delivery_status: 'user_deleted'
        })
        .eq('customer_id', customerId)
      
      if (pushError) {
        console.error('Error deactivating push subscriptions:', pushError)
      }
      
      // 3. Delete notification settings
      const { error: notifError } = await supabase
        .from('customer_notification_settings')
        .delete()
        .eq('customer_id', customerId)
      
      if (notifError) {
        console.error('Error deleting notification settings:', notifError)
      }
      
      // 4. Delete ALL reservations for this customer (historical cleanup)
      // The database trigger will also handle this, but we do it explicitly
      // to ensure proper cleanup before the customer deletion
      const { error: resError } = await supabase
        .from('reservations')
        .delete()
        .eq('customer_id', customerId)
      
      if (resError) {
        console.error('Error deleting reservations:', resError)
        // Don't fail here - the trigger will handle cleanup
      }
      
      // 5. Delete notification logs for this customer
      const { error: logError } = await supabase
        .from('notification_logs')
        .delete()
        .eq('recipient_id', customerId)
        .eq('recipient_type', 'customer')
      
      if (logError) {
        console.error('Error deleting notification logs:', logError)
      }
      
      // 6. Finally delete the customer
      // The database trigger will automatically clean up any remaining reservations
      const { error, count } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)
        .select()
      
      if (error) {
        console.error('Error deleting customer:', error)
        await report(new Error(error.message), 'Deleting customer')
        
        // Provide specific error message based on error type
        if (error.message?.includes('active future reservations')) {
          showToast.error('לא ניתן למחוק - יש תורים פעילים. בטל אותם תחילה')
        } else {
          showToast.error('שגיאה במחיקת המשתמש')
        }
        return
      }
      
      // Check if deletion actually occurred
      if (!count || count === 0) {
        console.error('Customer was not deleted - may have been already removed or RLS blocking')
        showToast.error('לא ניתן למחוק את המשתמש')
        return
      }
      
      showToast.success('המשתמש והתורים שלו נמחקו בהצלחה')
      setConfirmModal({ isOpen: false, type: 'delete', customer: null })
      await fetchCustomers()
    } catch (err) {
      console.error('Error:', err)
      await report(err, 'Deleting customer (exception)')
      
      // Check for specific error messages
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('active future reservations')) {
        showToast.error('לא ניתן למחוק - יש תורים פעילים. בטל אותם תחילה')
      } else {
        showToast.error('שגיאה במחיקת המשתמש')
      }
    } finally {
      setActionLoading(null)
    }
  }

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers
    
    const query = searchQuery.toLowerCase()
    return customers.filter(c => 
      c.fullname.toLowerCase().includes(query) ||
      c.phone.includes(query)
    )
  }, [customers, searchQuery])

  // Paginate
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE)
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Format date
  const formatDate = (dateStr: string): string => {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: he })
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-medium text-foreground-light">ניהול לקוחות</h1>
        <p className="text-foreground-muted text-sm mt-0.5">צפייה וניהול משתמשים רשומים</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center">
          <Users size={20} className="text-accent-gold mx-auto mb-1.5" strokeWidth={1.5} />
          <p className="text-lg font-bold text-foreground-light">{stats.total}</p>
          <p className="text-xs text-foreground-muted">סה&quot;כ לקוחות</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center">
          <Calendar size={20} className="text-green-400 mx-auto mb-1.5" strokeWidth={1.5} />
          <p className="text-lg font-bold text-foreground-light">{stats.newThisMonth}</p>
          <p className="text-xs text-foreground-muted">חדשים החודש</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-center">
          <Ban size={20} className="text-red-400 mx-auto mb-1.5" strokeWidth={1.5} />
          <p className="text-lg font-bold text-foreground-light">{stats.blocked}</p>
          <p className="text-xs text-foreground-muted">חסומים</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
        <input
          type="text"
          placeholder="חיפוש לפי שם או טלפון..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setCurrentPage(1)
          }}
          className="w-full pr-10 pl-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-foreground-light placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/50 text-sm"
        />
      </div>

      {/* Customers List */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paginatedCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users size={40} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted text-sm">
              {searchQuery ? 'לא נמצאו תוצאות' : 'אין לקוחות רשומים'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {paginatedCustomers.map((customer) => (
              <div
                key={customer.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  customer.is_blocked && 'bg-red-500/5'
                )}
              >
                {/* Avatar */}
                <Avatar size="md" className="shrink-0 w-10 h-10">
                  <Avatar.Fallback className={cn(
                    customer.is_blocked ? 'bg-red-500/20 text-red-400' : 'bg-accent-gold/20 text-accent-gold'
                  )}>
                    <User size={18} />
                  </Avatar.Fallback>
                </Avatar>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground-light font-medium text-sm truncate">
                      {customer.fullname}
                    </p>
                    {customer.is_blocked && (
                      <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                        חסום
                      </span>
                    )}
                    {/* Auth method indicator */}
                    {customer.auth_method === 'email' ? (
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1">
                        <Mail size={10} />
                        אימייל
                      </span>
                    ) : customer.auth_method === 'both' ? (
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded flex items-center gap-1">
                        <MessageSquare size={10} />
                        SMS+אימייל
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1">
                        <Phone size={10} />
                        SMS
                      </span>
                    )}
                  </div>
                  <p className="text-foreground-muted text-xs flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone size={10} className="inline" />
                      <span dir="ltr">{customer.phone}</span>
                    </span>
                    {customer.email && (
                      <>
                        <span className="text-foreground-muted/50">•</span>
                        <span className="flex items-center gap-1">
                          <Mail size={10} className="inline" />
                          <span dir="ltr">{customer.email}</span>
                        </span>
                      </>
                    )}
                    <span className="text-foreground-muted/50">•</span>
                    <span>{customer.reservation_count} תורים</span>
                    <span className="text-foreground-muted/50">•</span>
                    <span>נרשם {customer.created_at ? formatDate(customer.created_at) : '-'}</span>
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {customer.is_blocked ? (
                    <Button
                      variant="ghost"
                      isIconOnly
                      onPress={() => setConfirmModal({
                        isOpen: true,
                        type: 'unblock',
                        customer
                      })}
                      className="icon-btn min-w-[32px] w-8 h-8 p-2 rounded-lg hover:bg-green-500/10 transition-colors"
                      aria-label="הסר חסימה"
                    >
                      <ShieldOff size={16} className="text-green-400" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      isIconOnly
                      onPress={() => setConfirmModal({
                        isOpen: true,
                        type: 'block',
                        customer
                      })}
                      className="icon-btn min-w-[32px] w-8 h-8 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      aria-label="חסום משתמש"
                    >
                      <Shield size={16} className="text-foreground-muted hover:text-red-400 transition-colors" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    isIconOnly
                    onPress={() => setConfirmModal({
                      isOpen: true,
                      type: 'delete',
                      customer
                    })}
                    className="icon-btn min-w-[32px] w-8 h-8 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    aria-label="מחק משתמש"
                  >
                    <Trash2 size={16} className="text-foreground-muted hover:text-red-400 transition-colors" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-white/[0.06]">
            <Button
              variant="ghost"
              isIconOnly
              onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
              isDisabled={currentPage === 1}
              className="icon-btn min-w-[36px] w-9 h-9 p-2 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="עמוד קודם"
            >
              <ChevronRight size={18} className="text-foreground-muted" />
            </Button>
            <span className="text-foreground-muted text-sm px-3">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              isIconOnly
              onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              isDisabled={currentPage === totalPages}
              className="icon-btn min-w-[36px] w-9 h-9 p-2 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="עמוד הבא"
            >
              <ChevronLeft size={18} className="text-foreground-muted" />
            </Button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmModal({ isOpen: false, type: 'block', customer: null })} />
          
          <div className="relative w-full max-w-sm bg-background-card border border-white/10 rounded-2xl p-6 animate-fade-in-up">
            <Button
              variant="ghost"
              isIconOnly
              onPress={() => setConfirmModal({ isOpen: false, type: 'block', customer: null })}
              className="absolute top-4 left-4 min-w-[28px] w-7 h-7 p-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center"
              aria-label="סגור"
            >
              <X size={18} className="text-foreground-muted" />
            </Button>
            
            <Avatar size="lg" className="mx-auto mb-4 w-12 h-12">
              <Avatar.Fallback className={cn(
                confirmModal.type === 'delete' ? 'bg-red-500/20 text-red-400' : 
                confirmModal.type === 'block' ? 'bg-amber-500/20 text-amber-400' : 
                'bg-green-500/20 text-green-400'
              )}>
                {confirmModal.type === 'delete' ? (
                  <Trash2 size={24} />
                ) : confirmModal.type === 'block' ? (
                  <Shield size={24} />
                ) : (
                  <ShieldOff size={24} />
                )}
              </Avatar.Fallback>
            </Avatar>
            
            <h3 className="text-lg font-medium text-foreground-light text-center mb-2">
              {confirmModal.type === 'delete' && 'מחיקת משתמש'}
              {confirmModal.type === 'block' && 'חסימת משתמש'}
              {confirmModal.type === 'unblock' && 'הסרת חסימה'}
            </h3>
            
            <p className="text-foreground-muted text-sm text-center mb-6">
              {confirmModal.type === 'delete' && (
                <>האם אתה בטוח שברצונך למחוק את <strong>{confirmModal.customer.fullname}</strong>? פעולה זו לא ניתנת לביטול.</>
              )}
              {confirmModal.type === 'block' && (
                <>האם אתה בטוח שברצונך לחסום את <strong>{confirmModal.customer.fullname}</strong>? המשתמש לא יוכל לקבוע תורים חדשים.</>
              )}
              {confirmModal.type === 'unblock' && (
                <>האם אתה בטוח שברצונך להסיר את החסימה מ-<strong>{confirmModal.customer.fullname}</strong>?</>
              )}
            </p>
            
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onPress={() => setConfirmModal({ isOpen: false, type: 'block', customer: null })}
                className="flex-1 py-2.5 px-4 bg-white/[0.05] hover:bg-white/[0.1] rounded-xl font-medium text-foreground-light transition-colors"
              >
                ביטול
              </Button>
              <Button
                onPress={() => {
                  if (confirmModal.type === 'delete') {
                    handleDelete(confirmModal.customer!.id)
                  } else {
                    handleBlockUnblock(confirmModal.customer!.id, confirmModal.type === 'block')
                  }
                }}
                isDisabled={actionLoading === confirmModal.customer.id}
                className={cn(
                  'flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors',
                  confirmModal.type === 'delete' || confirmModal.type === 'block'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white',
                  actionLoading === confirmModal.customer.id && 'opacity-50 cursor-not-allowed'
                )}
              >
                {actionLoading === confirmModal.customer.id ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  confirmModal.type === 'delete' ? 'מחק' : confirmModal.type === 'block' ? 'חסום' : 'הסר חסימה'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

