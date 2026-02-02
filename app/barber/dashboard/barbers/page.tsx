'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { getAllBarbers, createBarber, updateBarber, setBarberPassword } from '@/lib/auth/barber-auth'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Pencil, User, Phone, Crown, GripVertical, Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'
import type { User as UserType } from '@/types/database'
import Image from 'next/image'
import { useBugReporter } from '@/hooks/useBugReporter'

export default function BarbersPage() {
  const router = useRouter()
  const { isAdmin, barber: currentBarber } = useBarberAuthStore()
  const { report } = useBugReporter('BarbersPage')
  
  const [barbers, setBarbers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragRef = useRef<{ startY: number; currentY: number } | null>(null)
  
  // Form state
  const [username, setUsername] = useState('')
  const [fullname, setFullname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  
  // Delete confirmation state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    step: 1 | 2
    barber: UserType | null
    confirmName: string
  }>({ isOpen: false, step: 1, barber: null, confirmName: '' })
  const [deleting, setDeleting] = useState(false)
  
  // Self-pause confirmation state
  const [selfPauseModal, setSelfPauseModal] = useState<{
    isOpen: boolean
    action: 'pause' | 'unpause'
  }>({ isOpen: false, action: 'pause' })
  const [selfPausing, setSelfPausing] = useState(false)

  const fetchBarbers = useCallback(async () => {
    try {
      const data = await getAllBarbers()
      // Sort by display_order
      const sorted = data.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      setBarbers(sorted)
    } catch (error) {
      console.error('Error fetching barbers:', error)
      await report(error, 'Fetching all barbers list')
      toast.error('שגיאה בטעינת הספרים')
    } finally {
      setLoading(false)
    }
  }, [report])

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/barber/dashboard')
      return
    }
    fetchBarbers()
  }, [isAdmin, router, fetchBarbers])

  // Save new order to database
  const saveOrder = useCallback(async (newOrder: UserType[]) => {
    try {
      const supabase = createClient()
      
      // Update each barber's display_order
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const updates = newOrder.map((barber, index) => 
        db
          .from('users')
          .update({ display_order: index })
          .eq('id', barber.id)
      )
      
      await Promise.all(updates)
      toast.success('סדר הספרים עודכן')
    } catch (error) {
      console.error('Error saving order:', error)
      await report(error, 'Saving barbers display order')
      toast.error('שגיאה בשמירת הסדר')
    }
  }, [report])

  // Handle delete barber
  const handleDeleteBarber = useCallback(async () => {
    if (!deleteModal.barber) return
    
    const barberId = deleteModal.barber.id
    setDeleting(true)
    
    try {
      const supabase = createClient()
      
      // Delete in correct order to respect foreign key constraints
      // 1. Cancel/delete reservations
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          status: 'cancelled', 
          cancelled_by: 'barber',
          cancellation_reason: 'הספר הוסר מהמערכת'
        })
        .eq('barber_id', barberId)
      
      if (resError) {
        console.error('Error cancelling reservations:', resError)
      }
      
      // 2. Delete barber_notification_settings
      await supabase.from('barber_notification_settings').delete().eq('barber_id', barberId)
      
      // 2b. Delete barber_booking_settings
      await supabase.from('barber_booking_settings').delete().eq('barber_id', barberId)
      
      // 3. Delete barber_schedules
      await supabase.from('barber_schedules').delete().eq('barber_id', barberId)
      
      // 4. Delete barber_closures
      await supabase.from('barber_closures').delete().eq('barber_id', barberId)
      
      // 5. Delete barber_messages
      await supabase.from('barber_messages').delete().eq('barber_id', barberId)
      
      // 6. Delete work_days
      await supabase.from('work_days').delete().eq('user_id', barberId)
      
      // 7. Delete push_subscriptions
      await supabase.from('push_subscriptions').delete().eq('barber_id', barberId)
      
      // 8. Delete services
      await supabase.from('services').delete().eq('barber_id', barberId)
      
      // 9. Finally delete the user
      const { error: userError } = await supabase.from('users').delete().eq('id', barberId)
      
      if (userError) {
        console.error('Error deleting barber:', userError)
        await report(new Error(userError.message), 'Deleting barber from users table')
        toast.error('שגיאה במחיקת הספר')
        return
      }
      
      toast.success('הספר הוסר בהצלחה')
      setBarbers(prev => prev.filter(b => b.id !== barberId))
      setDeleteModal({ isOpen: false, step: 1, barber: null, confirmName: '' })
    } catch (error) {
      console.error('Error deleting barber:', error)
      await report(error, 'Deleting barber (exception)')
      toast.error('שגיאה במחיקת הספר')
    } finally {
      setDeleting(false)
    }
  }, [deleteModal.barber, report])

  // Handle drag start
  const handleDragStart = useCallback((index: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setDraggedIndex(index)
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragRef.current = { startY: clientY, currentY: clientY }
  }, [])

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (draggedIndex === null || !dragRef.current) return
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragRef.current.currentY = clientY
    
    // Calculate which index we're over
    const cards = document.querySelectorAll('[data-barber-card]')
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      
      if (clientY > rect.top && clientY < rect.bottom) {
        if (clientY < midY && index < draggedIndex!) {
          setDragOverIndex(index)
        } else if (clientY > midY && index > draggedIndex!) {
          setDragOverIndex(index)
        } else {
          setDragOverIndex(null)
        }
      }
    })
  }, [draggedIndex])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      // Reorder the array
      const newBarbers = [...barbers]
      const [removed] = newBarbers.splice(draggedIndex, 1)
      newBarbers.splice(dragOverIndex, 0, removed)
      
      setBarbers(newBarbers)
      saveOrder(newBarbers)
    }
    
    setDraggedIndex(null)
    setDragOverIndex(null)
    dragRef.current = null
  }, [draggedIndex, dragOverIndex, barbers, saveOrder])

  // Add event listeners for drag
  useEffect(() => {
    if (draggedIndex !== null) {
      const handleMove = (e: MouseEvent | TouchEvent) => handleDragMove(e)
      const handleEnd = () => handleDragEnd()
      
      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleMove, { passive: false })
      document.addEventListener('touchend', handleEnd)
      
      return () => {
        document.removeEventListener('mousemove', handleMove)
        document.removeEventListener('mouseup', handleEnd)
        document.removeEventListener('touchmove', handleMove)
        document.removeEventListener('touchend', handleEnd)
      }
    }
  }, [draggedIndex, handleDragMove, handleDragEnd])

  const resetForm = () => {
    setUsername('')
    setFullname('')
    setEmail('')
    setPassword('')
    setPhone('')
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (barber: UserType) => {
    setEditingId(barber.id)
    setUsername(barber.username)
    setFullname(barber.fullname)
    setEmail(barber.email || '')
    setPhone(barber.phone || '')
    setPassword('')
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!fullname.trim() || !email.trim()) {
      toast.error('נא למלא שם ואימייל')
      return
    }
    
    if (!editingId && !password) {
      toast.error('נא להזין סיסמה למשתמש חדש')
      return
    }
    
    setSaving(true)
    
    if (editingId) {
      // Update existing barber
      const result = await updateBarber(editingId, {
        fullname,
        email,
        phone: phone || undefined,
      })
      
      if (result.success) {
        // Update password if provided
        if (password) {
          await setBarberPassword(editingId, password)
        }
        toast.success('הספר עודכן בהצלחה!')
        resetForm()
        fetchBarbers()
      } else {
        toast.error(result.error || 'שגיאה בעדכון')
      }
    } else {
      // Create new barber
      const result = await createBarber({
        username: username || email.split('@')[0],
        fullname,
        email,
        password,
        phone: phone || undefined,
        role: 'barber',
      })
      
      if (result.success) {
        toast.success('הספר נוסף בהצלחה!')
        resetForm()
        fetchBarbers()
      } else {
        toast.error(result.error || 'שגיאה בהוספה')
      }
    }
    
    setSaving(false)
  }

  const handleToggleActive = async (barber: UserType) => {
    // If toggling self (admin), show confirmation modal
    if (barber.id === currentBarber?.id) {
      setSelfPauseModal({
        isOpen: true,
        action: barber.is_active ? 'pause' : 'unpause'
      })
      return
    }
    
    const result = await updateBarber(barber.id, { is_active: !barber.is_active })
    
    if (result.success) {
      toast.success(barber.is_active ? 'הספר הושבת' : 'הספר הופעל')
      fetchBarbers()
    } else {
      toast.error('שגיאה בעדכון')
    }
  }
  
  // Handle self-pause confirmation
  const handleSelfPauseConfirm = async () => {
    if (!currentBarber) return
    
    setSelfPausing(true)
    
    const newActiveState = selfPauseModal.action === 'unpause'
    const result = await updateBarber(currentBarber.id, { is_active: newActiveState })
    
    if (result.success) {
      toast.success(newActiveState ? 'החשבון שלך הופעל מחדש' : 'החשבון שלך הושבת - לקוחות לא יוכלו לקבוע תורים אצלך')
      fetchBarbers()
      setSelfPauseModal({ isOpen: false, action: 'pause' })
    } else {
      toast.error('שגיאה בעדכון')
    }
    
    setSelfPausing(false)
  }

  if (!isAdmin) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground-light">ניהול ספרים</h1>
          <p className="text-foreground-muted mt-1">הוסף ונהל את צוות הספרים. גרור לשינוי סדר</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-lg font-medium hover:bg-accent-gold/90 transition-colors"
        >
          <Plus size={16} strokeWidth={1.5} />
          הוסף ספר
        </button>
      </div>

      {/* Add/Edit Form - Mobile-friendly stacked layout */}
      {showForm && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-4 sm:p-6 mb-6">
          <h3 className="text-lg font-medium text-foreground-light mb-4">
            {editingId ? 'עריכת ספר' : 'הוסף ספר חדש'}
          </h3>
          
          {/* Stacked on mobile, grid on larger screens */}
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm">שם מלא *</label>
                <input
                  type="text"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm">אימייל *</label>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm">טלפון</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05X-XXXXXXX"
                  className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm text-wrap">
                  {editingId ? 'סיסמה חדשה (ריק = ללא שינוי)' : 'סיסמה *'}
                </label>
                <input
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium transition-all text-sm sm:text-base',
                saving
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {saving ? 'שומר...' : editingId ? 'עדכן' : 'הוסף'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 sm:px-6 py-3 rounded-xl bg-background-dark border border-white/10 text-foreground-muted hover:text-foreground-light transition-colors text-sm sm:text-base"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Barbers List - Draggable cards */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-4 sm:p-6">
        {barbers.length === 0 ? (
          <div className="text-center py-8">
            <User size={48} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted">אין ספרים במערכת</p>
          </div>
        ) : (
          <div className="space-y-3">
            {barbers.map((barber, index) => (
              <div
                key={barber.id}
                data-barber-card
                className={cn(
                  'p-3 sm:p-4 rounded-xl border transition-all',
                  barber.is_active
                    ? 'bg-background-dark border-white/5'
                    : 'bg-background-dark/50 border-white/5 opacity-60',
                  // Drag states
                  draggedIndex === index && 'opacity-50 scale-[0.98] shadow-lg shadow-accent-gold/20',
                  dragOverIndex === index && 'border-accent-gold/50 bg-accent-gold/5'
                )}
              >
                {/* Top Row: Drag Handle, Avatar, Name, Badges */}
                <div className="flex items-center gap-3 mb-2">
                  {/* Drag Handle */}
                  <div
                    onMouseDown={(e) => handleDragStart(index, e)}
                    onTouchStart={(e) => handleDragStart(index, e)}
                    className="cursor-grab active:cursor-grabbing touch-none p-1 -mr-1 text-foreground-muted/30 hover:text-foreground-muted transition-colors"
                  >
                    <GripVertical size={18} strokeWidth={1.5} />
                  </div>
                  
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-background-card flex-shrink-0">
                    {barber.img_url ? (
                      <Image
                        src={barber.img_url}
                        alt={barber.fullname}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={20} strokeWidth={1.5} className="text-foreground-muted" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-foreground-light font-medium text-sm sm:text-base truncate">
                        {barber.fullname}
                      </p>
                      {barber.role === 'admin' && (
                        <span title="מנהל">
                          <Crown size={14} strokeWidth={1.5} className="text-accent-gold flex-shrink-0" />
                        </span>
                      )}
                      {!barber.is_active && (
                        <span className="text-[10px] text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded flex-shrink-0">
                          מושבת
                        </span>
                      )}
                    </div>
                    {/* Email - truncated on mobile */}
                    <p className="text-xs text-foreground-muted truncate mt-0.5">
                      {barber.email}
                    </p>
                  </div>
                </div>
                
                {/* Actions Row */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 mr-7">
                  {/* Phone - if exists */}
                  {barber.phone ? (
                    <a
                      href={`tel:${barber.phone}`}
                      className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-accent-gold transition-colors"
                    >
                      <Phone size={12} strokeWidth={1.5} />
                      <span className="hidden sm:inline">{barber.phone}</span>
                      <span className="sm:hidden">התקשר</span>
                    </a>
                  ) : (
                    <span className="text-xs text-foreground-muted/50">ללא טלפון</span>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(barber)}
                      className="icon-btn p-2 text-foreground-muted hover:text-accent-gold hover:bg-accent-gold/10 rounded-lg transition-colors"
                      title="ערוך"
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    {/* Pause/Unpause button - shown for all barbers including self */}
                    <button
                      onClick={() => handleToggleActive(barber)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-medium transition-colors',
                        barber.is_active
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                      )}
                    >
                      {barber.is_active ? 'השבת' : 'הפעל'}
                    </button>
                    {/* Delete button - only for other barbers, not self */}
                    {barber.id !== currentBarber?.id && (
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, step: 1, barber, confirmName: '' })}
                        className="icon-btn p-2 text-foreground-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="מחק ספר"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Drag hint */}
        {barbers.length > 1 && (
          <p className="text-xs text-foreground-muted/50 text-center mt-4">
            גרור את הכרטיסים לשינוי סדר ההצגה בדף הבית
          </p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.barber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-background-darker border border-white/10 rounded-2xl p-6 shadow-2xl animate-slide-in-up">
            {/* Close button */}
            <button
              onClick={() => setDeleteModal({ isOpen: false, step: 1, barber: null, confirmName: '' })}
              className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center"
            >
              <X size={18} className="text-foreground-muted" />
            </button>

            {/* Step 1: Initial Confirmation */}
            {deleteModal.step === 1 && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground-light">
                      מחיקת ספר
                    </h3>
                    <p className="text-foreground-muted text-sm">
                      {deleteModal.barber.fullname}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-foreground-light text-sm">
                    האם אתה בטוח שברצונך למחוק את הספר?
                  </p>
                  <ul className="mt-3 space-y-1.5 text-foreground-muted text-xs">
                    <li>• כל התורים של הספר יבוטלו</li>
                    <li>• כל השירותים של הספר יימחקו</li>
                    <li>• פעולה זו אינה ניתנת לביטול</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteModal(prev => ({ ...prev, step: 2 }))}
                    className="flex-1 py-3 rounded-xl font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-center"
                  >
                    המשך למחיקה
                  </button>
                  <button
                    onClick={() => setDeleteModal({ isOpen: false, step: 1, barber: null, confirmName: '' })}
                    className="flex-1 py-3 rounded-xl font-medium border border-white/20 text-foreground-light hover:bg-white/5 transition-colors text-center"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Type name to confirm */}
            {deleteModal.step === 2 && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground-light">
                      אישור מחיקה סופי
                    </h3>
                    <p className="text-foreground-muted text-sm">
                      הקלד את שם הספר לאישור
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-foreground-muted text-xs">
                    הקלד: <span className="text-accent-gold font-medium">{deleteModal.barber.fullname}</span>
                  </label>
                  <input
                    type="text"
                    value={deleteModal.confirmName}
                    onChange={(e) => setDeleteModal(prev => ({ ...prev, confirmName: e.target.value }))}
                    placeholder={deleteModal.barber.fullname}
                    className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-red-400/50"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteBarber}
                    disabled={deleteModal.confirmName !== deleteModal.barber.fullname || deleting}
                    className={cn(
                      'flex-1 py-3 rounded-xl font-medium transition-colors text-center',
                      deleteModal.confirmName === deleteModal.barber.fullname && !deleting
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                    )}
                  >
                    {deleting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        מוחק...
                      </span>
                    ) : (
                      'מחק לצמיתות'
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteModal(prev => ({ ...prev, step: 1, confirmName: '' }))}
                    disabled={deleting}
                    className="px-6 py-3 rounded-xl font-medium border border-white/20 text-foreground-light hover:bg-white/5 transition-colors text-center"
                  >
                    חזור
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Self-Pause Confirmation Modal */}
      {selfPauseModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-background-darker border border-white/10 rounded-2xl p-6 shadow-2xl animate-slide-in-up">
            {/* Close button */}
            <button
              onClick={() => setSelfPauseModal({ isOpen: false, action: 'pause' })}
              className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center"
            >
              <X size={18} className="text-foreground-muted" />
            </button>

            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                  selfPauseModal.action === 'pause' ? 'bg-amber-500/20' : 'bg-green-500/20'
                )}>
                  <AlertTriangle className={cn(
                    'w-6 h-6',
                    selfPauseModal.action === 'pause' ? 'text-amber-400' : 'text-green-400'
                  )} />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground-light">
                    {selfPauseModal.action === 'pause' ? 'השבתת החשבון שלך' : 'הפעלת החשבון שלך'}
                  </h3>
                  <p className="text-foreground-muted text-sm">
                    {currentBarber?.fullname}
                  </p>
                </div>
              </div>

              <div className={cn(
                'p-4 rounded-xl border',
                selfPauseModal.action === 'pause' 
                  ? 'bg-amber-500/10 border-amber-500/20' 
                  : 'bg-green-500/10 border-green-500/20'
              )}>
                {selfPauseModal.action === 'pause' ? (
                  <>
                    <p className="text-foreground-light text-sm">
                      האם אתה בטוח שברצונך להשבית את החשבון שלך?
                    </p>
                    <ul className="mt-3 space-y-1.5 text-foreground-muted text-xs">
                      <li>• לא תופיע בדף הבית ללקוחות</li>
                      <li>• לקוחות לא יוכלו לקבוע תורים חדשים</li>
                      <li>• התורים הקיימים שלך יישארו פעילים</li>
                      <li>• תוכל להפעיל מחדש בכל עת</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="text-foreground-light text-sm">
                      האם אתה בטוח שברצונך להפעיל מחדש את החשבון שלך?
                    </p>
                    <ul className="mt-3 space-y-1.5 text-foreground-muted text-xs">
                      <li>• תופיע שוב בדף הבית ללקוחות</li>
                      <li>• לקוחות יוכלו לקבוע תורים חדשים</li>
                    </ul>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSelfPauseConfirm}
                  disabled={selfPausing}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium transition-colors text-center',
                    selfPausing
                      ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                      : selfPauseModal.action === 'pause'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                        : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                  )}
                >
                  {selfPausing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      מעדכן...
                    </span>
                  ) : (
                    selfPauseModal.action === 'pause' ? 'השבת את החשבון' : 'הפעל את החשבון'
                  )}
                </button>
                <button
                  onClick={() => setSelfPauseModal({ isOpen: false, action: 'pause' })}
                  disabled={selfPausing}
                  className="px-6 py-3 rounded-xl font-medium border border-white/20 text-foreground-light hover:bg-white/5 transition-colors text-center"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
