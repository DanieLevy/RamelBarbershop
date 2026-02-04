'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { UserX, Search, Trash, ShieldOff, ShieldAlert, User } from 'lucide-react'
import type { Customer } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

interface BlockedCustomerInfo {
  phone: string
  customer?: Customer
}

export default function BlockedCustomersPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('BlockedCustomersPage')
  
  const [blockedPhones, setBlockedPhones] = useState<string[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)

  // Fetch blocked customers list and all customers
  const fetchData = useCallback(async () => {
    if (!barber?.id) return
    
    const supabase = createClient()
    
    // Fetch barber's blocked_customers array
    const { data: barberData, error: barberError } = await supabase
      .from('users')
      .select('blocked_customers')
      .eq('id', barber.id)
      .single()
    
    if (barberError) {
      console.error('Error fetching barber data:', barberError)
      await report(new Error(barberError.message), 'Fetching barber blocked customers')
    }
    
    setBlockedPhones(barberData?.blocked_customers || [])
    
    // Fetch all customers for search
    const { data: customersData, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .order('fullname', { ascending: true })
    
    if (customersError) {
      console.error('Error fetching customers:', customersError)
      await report(new Error(customersError.message), 'Fetching customers for blocking')
    }
    
    setCustomers(customersData || [])
    setLoading(false)
  }, [barber?.id, report])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Block a customer
  const handleBlockCustomer = async (customer: Customer) => {
    if (!barber?.id) return
    
    if (blockedPhones.includes(customer.phone)) {
      toast.error('הלקוח כבר חסום')
      return
    }
    
    setSaving(true)
    const supabase = createClient()
    
    const newBlockedList = [...blockedPhones, customer.phone]
    
    const { error } = await supabase
      .from('users')
      .update({ blocked_customers: newBlockedList })
      .eq('id', barber.id)
    
    if (error) {
      console.error('Error blocking customer:', error)
      await report(new Error(error.message), 'Blocking customer')
      toast.error('שגיאה בחסימת הלקוח')
    } else {
      toast.success(`${customer.fullname} נחסם בהצלחה`)
      setBlockedPhones(newBlockedList)
      setShowAddModal(false)
      setSelectedCustomer(null)
      setSearchQuery('')
    }
    
    setSaving(false)
  }

  // Unblock a customer
  const handleUnblockCustomer = async (phone: string) => {
    if (!barber?.id) return
    
    const customer = customers.find(c => c.phone === phone)
    const customerName = customer?.fullname || phone
    
    if (!confirm(`האם להסיר את החסימה של ${customerName}?`)) return
    
    const supabase = createClient()
    
    const newBlockedList = blockedPhones.filter(p => p !== phone)
    
    const { error } = await supabase
      .from('users')
      .update({ blocked_customers: newBlockedList })
      .eq('id', barber.id)
    
    if (error) {
      console.error('Error unblocking customer:', error)
      await report(new Error(error.message), 'Unblocking customer')
      toast.error('שגיאה בהסרת החסימה')
    } else {
      toast.success('החסימה הוסרה בהצלחה')
      setBlockedPhones(newBlockedList)
    }
  }

  // Get blocked customer info (match phone to customer data)
  const getBlockedCustomerInfo = (phone: string): BlockedCustomerInfo => {
    const customer = customers.find(c => c.phone === phone)
    return { phone, customer }
  }

  // Filter customers for search (exclude already blocked)
  const filteredCustomers = customers.filter(c => {
    if (blockedPhones.includes(c.phone)) return false
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    return c.fullname.toLowerCase().includes(query) || c.phone.includes(query)
  })

  // Mask phone number
  const maskPhone = (phone: string) => {
    if (phone.length <= 4) return phone
    return phone.slice(0, -4) + '****'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground-light flex items-center gap-2">
            <UserX size={24} strokeWidth={1.5} className="text-red-400" />
            לקוחות חסומים
          </h1>
          <p className="text-foreground-muted text-sm mt-1">
            לקוחות חסומים לא יוכלו לקבוע תורים אצלך
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
        >
          <ShieldOff size={16} strokeWidth={2} />
          חסום לקוח
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-background-card border border-white/10 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-400">{blockedPhones.length}</div>
          <div className="text-foreground-muted text-xs mt-1">לקוחות חסומים</div>
        </div>
        <div className="bg-background-card border border-white/10 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-foreground-light">{customers.length}</div>
          <div className="text-foreground-muted text-xs mt-1">סה״כ לקוחות</div>
        </div>
      </div>

      {/* Blocked Customers List */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <ShieldAlert size={20} strokeWidth={1.5} className="text-red-400" />
          רשימת לקוחות חסומים
        </h3>
        
        {blockedPhones.length === 0 ? (
          <div className="text-center py-8">
            <UserX size={40} strokeWidth={1} className="text-foreground-muted mx-auto mb-3 opacity-50" />
            <p className="text-foreground-muted text-sm">אין לקוחות חסומים</p>
            <p className="text-foreground-muted text-xs mt-1">
              לחץ על &quot;חסום לקוח&quot; להוספת לקוח לרשימה
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedPhones.map((phone) => {
              const info = getBlockedCustomerInfo(phone)
              return (
                <div
                  key={phone}
                  className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/20"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <UserX size={20} strokeWidth={1.5} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-foreground-light font-medium">
                        {info.customer?.fullname || 'לקוח לא ידוע'}
                      </p>
                      <p className="text-foreground-muted text-sm">{maskPhone(phone)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblockCustomer(phone)}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-foreground-light text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    <Trash size={14} />
                    הסר חסימה
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Block Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background-card border border-white/10 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-medium text-foreground-light flex items-center gap-2">
                <ShieldOff size={20} strokeWidth={1.5} className="text-red-400" />
                חסום לקוח
              </h3>
              <p className="text-foreground-muted text-sm mt-1">
                חפש לקוח לפי שם או מספר טלפון
              </p>
            </div>
            
            {/* Search */}
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חפש לפי שם או טלפון..."
                  className="w-full pr-10 pl-4 py-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-red-400 text-sm placeholder:text-foreground-muted"
                  autoFocus
                />
              </div>
            </div>
            
            {/* Customer List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8">
                  <User size={32} className="text-foreground-muted mx-auto mb-2 opacity-50" />
                  <p className="text-foreground-muted text-sm">
                    {searchQuery ? 'לא נמצאו לקוחות' : 'כל הלקוחות כבר חסומים'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCustomers.slice(0, 20).map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl text-right transition-colors',
                        selectedCustomer?.id === customer.id
                          ? 'bg-red-500/20 border border-red-500/40'
                          : 'bg-background-dark border border-white/5 hover:border-white/10'
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <User size={18} className="text-foreground-muted" />
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground-light font-medium">{customer.fullname}</p>
                        <p className="text-foreground-muted text-xs">{customer.phone}</p>
                      </div>
                      {selectedCustomer?.id === customer.id && (
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                  {filteredCustomers.length > 20 && (
                    <p className="text-foreground-muted text-xs text-center py-2">
                      מוצגים 20 מתוך {filteredCustomers.length} לקוחות. הקלד לחיפוש ממוקד.
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="p-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setSelectedCustomer(null)
                  setSearchQuery('')
                }}
                className="flex-1 py-3 bg-background-dark border border-white/10 rounded-xl text-foreground-muted text-sm hover:text-foreground-light transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => selectedCustomer && handleBlockCustomer(selectedCustomer)}
                disabled={!selectedCustomer || saving}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'חוסם...' : 'חסום לקוח'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
