'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronLeft, Calendar, TrendingUp, Users, Scissors, DollarSign, XCircle, CheckCircle, BarChart3, Star, ChevronDown, ChevronUp } from 'lucide-react'
import type { Reservation, Service } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
]

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

interface ReservationWithService extends Reservation {
  services?: Service | null
}

interface ServiceStat {
  id: string
  name: string
  count: number
  revenue: number
}

interface CustomerStat {
  id: string
  name: string
  phone: string
  count: number
}

export default function ReportsPage() {
  const { barber } = useBarberAuthStore()
  const { report } = useBugReporter('ReportsPage')
  
  const [reservations, setReservations] = useState<ReservationWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date())
  const [showAllCustomers, setShowAllCustomers] = useState(false)

  // Get month boundaries
  const getMonthBoundaries = useCallback((date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    
    const startDate = new Date(year, month, 1)
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(year, month + 1, 0)
    endDate.setHours(23, 59, 59, 999)
    
    return { startDate, endDate, startMs: startDate.getTime(), endMs: endDate.getTime() }
  }, [])

  const fetchReservations = useCallback(async () => {
    if (!barber?.id) return
    
    setLoading(true)
    const supabase = createClient()
    const { startMs, endMs } = getMonthBoundaries(selectedMonth)
    
    const { data, error } = await supabase
      .from('reservations')
      .select('*, services(*)')
      .eq('barber_id', barber.id)
      .gte('time_timestamp', startMs)
      .lte('time_timestamp', endMs)
      .order('time_timestamp', { ascending: true })
    
    if (error) {
      console.error('Error fetching reservations:', error)
      await report(new Error(error.message), 'Fetching monthly reservations')
    }
    
    setReservations((data as ReservationWithService[]) || [])
    setLoading(false)
  }, [barber?.id, selectedMonth, getMonthBoundaries, report])

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = reservations.length
    const cancelled = reservations.filter(r => r.status === 'cancelled').length
    const successful = total - cancelled
    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0
    
    // Calculate revenue (only from successful reservations)
    const revenue = reservations
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (Number(r.services?.price) || 0), 0)
    
    // Days in month
    const { endDate } = getMonthBoundaries(selectedMonth)
    const daysInMonth = endDate.getDate()
    const avgPerDay = total > 0 ? (successful / daysInMonth).toFixed(1) : '0'
    
    return { total, cancelled, successful, cancellationRate, revenue, avgPerDay, daysInMonth }
  }, [reservations, selectedMonth, getMonthBoundaries])

  // Calculate top services
  const serviceStats = useMemo((): ServiceStat[] => {
    const serviceMap = new Map<string, ServiceStat>()
    
    reservations
      .filter(r => r.status !== 'cancelled' && r.services)
      .forEach(r => {
        const serviceId = r.service_id
        const serviceName = r.services?.name_he || 'שירות לא ידוע'
        const price = Number(r.services?.price) || 0
        
        if (serviceMap.has(serviceId)) {
          const existing = serviceMap.get(serviceId)!
          existing.count++
          existing.revenue += price
        } else {
          serviceMap.set(serviceId, {
            id: serviceId,
            name: serviceName,
            count: 1,
            revenue: price,
          })
        }
      })
    
    return Array.from(serviceMap.values()).sort((a, b) => b.count - a.count)
  }, [reservations])

  // Calculate top customers
  const customerStats = useMemo((): CustomerStat[] => {
    const customerMap = new Map<string, CustomerStat>()
    
    reservations
      .filter(r => r.status !== 'cancelled' && r.customer_id)
      .forEach(r => {
        const customerId = r.customer_id
        const customerName = r.customer_name
        const customerPhone = r.customer_phone
        
        if (customerMap.has(customerId)) {
          customerMap.get(customerId)!.count++
        } else {
          customerMap.set(customerId, {
            id: customerId,
            name: customerName,
            phone: customerPhone,
            count: 1,
          })
        }
      })
    
    return Array.from(customerMap.values()).sort((a, b) => b.count - a.count)
  }, [reservations])

  // Calculate busiest day of week
  const busiestDay = useMemo(() => {
    const dayCounts = new Array(7).fill(0)
    
    reservations
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const date = new Date(r.time_timestamp)
        dayCounts[date.getDay()]++
      })
    
    const maxCount = Math.max(...dayCounts)
    if (maxCount === 0) return null
    
    const maxIndex = dayCounts.indexOf(maxCount)
    return { day: HEBREW_DAYS[maxIndex], count: maxCount }
  }, [reservations])

  // Navigation
  const handlePrevMonth = () => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() - 1)
      return newDate
    })
  }

  const handleNextMonth = () => {
    const today = new Date()
    const nextMonth = new Date(selectedMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    
    // Don't allow going beyond current month
    if (nextMonth.getFullYear() > today.getFullYear() || 
        (nextMonth.getFullYear() === today.getFullYear() && nextMonth.getMonth() > today.getMonth())) {
      return
    }
    
    setSelectedMonth(nextMonth)
  }

  const isCurrentMonth = () => {
    const today = new Date()
    return selectedMonth.getFullYear() === today.getFullYear() && 
           selectedMonth.getMonth() === today.getMonth()
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
    }).format(amount)
  }

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
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground-light flex items-center gap-2">
            <BarChart3 size={24} strokeWidth={1.5} className="text-accent-gold" />
            דוחות
          </h1>
          <p className="text-foreground-muted text-sm mt-1">סיכום פעילות חודשית</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg bg-background-card border border-white/10 text-foreground-light hover:bg-white/5 transition-colors"
            aria-label="חודש קודם"
          >
            <ChevronRight size={20} />
          </button>
          
          <div className="px-4 py-2 bg-background-card border border-white/10 rounded-lg min-w-[140px] text-center">
            <span className="text-foreground-light font-medium">
              {HEBREW_MONTHS[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
            </span>
          </div>
          
          <button
            onClick={handleNextMonth}
            disabled={isCurrentMonth()}
            className={cn(
              'p-2 rounded-lg bg-background-card border border-white/10 transition-colors',
              isCurrentMonth()
                ? 'text-foreground-muted cursor-not-allowed opacity-50'
                : 'text-foreground-light hover:bg-white/5'
            )}
            aria-label="חודש הבא"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-background-card border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-muted text-xs">סה״כ תורים</span>
          </div>
          <div className="text-2xl font-bold text-foreground-light">{stats.total}</div>
        </div>
        
        <div className="bg-background-card border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} strokeWidth={1.5} className="text-green-400" />
            <span className="text-foreground-muted text-xs">בוצעו</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{stats.successful}</div>
        </div>
        
        <div className="bg-background-card border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={16} strokeWidth={1.5} className="text-red-400" />
            <span className="text-foreground-muted text-xs">בוטלו ({stats.cancellationRate}%)</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{stats.cancelled}</div>
        </div>
        
        <div className="bg-background-card border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-muted text-xs">הכנסות משוערות</span>
          </div>
          <div className="text-2xl font-bold text-accent-gold">{formatCurrency(stats.revenue)}</div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-background-card border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} strokeWidth={1.5} className="text-blue-400" />
            <span className="text-foreground-muted text-xs">ממוצע ליום</span>
          </div>
          <div className="text-xl font-bold text-foreground-light">{stats.avgPerDay}</div>
        </div>
        
        <div className="bg-background-card border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} strokeWidth={1.5} className="text-purple-400" />
            <span className="text-foreground-muted text-xs">לקוחות שונים</span>
          </div>
          <div className="text-xl font-bold text-foreground-light">{customerStats.length}</div>
        </div>
        
        {busiestDay && (
          <div className="bg-background-card border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star size={16} strokeWidth={1.5} className="text-yellow-400" />
              <span className="text-foreground-muted text-xs">יום עמוס ביותר</span>
            </div>
            <div className="text-xl font-bold text-foreground-light">
              {busiestDay.day}
              <span className="text-foreground-muted text-sm font-normal mr-2">({busiestDay.count} תורים)</span>
            </div>
          </div>
        )}
      </div>

      {/* Top Services */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <Scissors size={20} strokeWidth={1.5} className="text-accent-gold" />
          שירותים פופולריים
        </h3>
        
        {serviceStats.length === 0 ? (
          <p className="text-foreground-muted text-sm text-center py-4">אין נתונים להצגה</p>
        ) : (
          <div className="space-y-3">
            {serviceStats.map((service, index) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 rounded-xl bg-background-dark border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                    index === 0 ? 'bg-accent-gold/20 text-accent-gold' :
                    index === 1 ? 'bg-gray-500/20 text-gray-400' :
                    index === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-white/5 text-foreground-muted'
                  )}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-foreground-light font-medium">{service.name}</p>
                    <p className="text-foreground-muted text-xs">{formatCurrency(service.revenue)} הכנסות</p>
                  </div>
                </div>
                <div className="text-foreground-light font-bold">{service.count} פעמים</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Customers */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <Users size={20} strokeWidth={1.5} className="text-accent-gold" />
          לקוחות פעילים
        </h3>
        
        {customerStats.length === 0 ? (
          <p className="text-foreground-muted text-sm text-center py-4">אין נתונים להצגה</p>
        ) : (
          <>
            <div className="space-y-3">
              {(showAllCustomers ? customerStats : customerStats.slice(0, 3)).map((customer, index) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-background-dark border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                      index === 0 ? 'bg-accent-gold/20 text-accent-gold' :
                      index === 1 ? 'bg-gray-500/20 text-gray-400' :
                      index === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/5 text-foreground-muted'
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-foreground-light font-medium">{customer.name}</p>
                      <p className="text-foreground-muted text-xs">{maskPhone(customer.phone)}</p>
                    </div>
                  </div>
                  <div className="text-foreground-light font-bold">{customer.count} תורים</div>
                </div>
              ))}
            </div>
            
            {customerStats.length > 3 && (
              <button
                onClick={() => setShowAllCustomers(!showAllCustomers)}
                className="w-full mt-4 py-2 text-accent-gold text-sm hover:text-accent-gold/80 transition-colors flex items-center justify-center gap-1"
              >
                {showAllCustomers ? (
                  <>
                    <ChevronUp size={16} />
                    הצג פחות
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    הצג את כל {customerStats.length} הלקוחות
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
