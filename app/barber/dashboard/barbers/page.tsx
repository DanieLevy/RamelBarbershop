'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { getAllBarbers, createBarber, updateBarber, setBarberPassword } from '@/lib/auth/barber-auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Pencil, User, Mail, Phone, Crown } from 'lucide-react'
import type { User as UserType } from '@/types/database'
import Image from 'next/image'

export default function BarbersPage() {
  const router = useRouter()
  const { isAdmin, barber: currentBarber } = useBarberAuthStore()
  
  const [barbers, setBarbers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [username, setUsername] = useState('')
  const [fullname, setFullname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/barber/dashboard')
      return
    }
    fetchBarbers()
  }, [isAdmin, router])

  const fetchBarbers = async () => {
    try {
      const data = await getAllBarbers()
      setBarbers(data)
    } catch (error) {
      console.error('Error fetching barbers:', error)
      toast.error('שגיאה בטעינת הספרים')
    } finally {
      setLoading(false)
    }
  }

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
    if (barber.id === currentBarber?.id) {
      toast.error('לא ניתן להשבית את עצמך')
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground-light">ניהול ספרים</h1>
          <p className="text-foreground-muted mt-1">הוסף ונהל את צוות הספרים</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-lg font-medium hover:bg-accent-gold/90 transition-colors"
        >
          <Plus size={16} strokeWidth={1.5} />
          הוסף ספר
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-medium text-foreground-light mb-4">
            {editingId ? 'עריכת ספר' : 'הוסף ספר חדש'}
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
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

          <div className="grid grid-cols-2 gap-4 mb-4">
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
              <label className="text-foreground-light text-sm">
                {editingId ? 'סיסמה חדשה (השאר ריק אם לא לשנות)' : 'סיסמה *'}
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

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium transition-all',
                saving
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {saving ? 'שומר...' : editingId ? 'עדכן' : 'הוסף'}
            </button>
            <button
              onClick={resetForm}
              className="px-6 py-3 rounded-xl bg-background-dark border border-white/10 text-foreground-muted hover:text-foreground-light transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Barbers List */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        {barbers.length === 0 ? (
          <div className="text-center py-8">
            <User size={48} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted">אין ספרים במערכת</p>
          </div>
        ) : (
          <div className="space-y-3">
            {barbers.map((barber) => (
              <div
                key={barber.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border',
                  barber.is_active
                    ? 'bg-background-dark border-white/5'
                    : 'bg-background-dark/50 border-white/5 opacity-60'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-background-card">
                    {barber.img_url ? (
                      <Image
                        src={barber.img_url}
                        alt={barber.fullname}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User size={24} strokeWidth={1.5} className="text-foreground-muted" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-foreground-light font-medium">{barber.fullname}</p>
                      {barber.role === 'admin' && (
                        <span title="מנהל">
                          <Crown size={16} strokeWidth={1.5} className="text-accent-gold" />
                        </span>
                      )}
                      {!barber.is_active && (
                        <span className="text-xs text-red-400 bg-red-500/20 px-2 py-0.5 rounded">
                          מושבת
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-foreground-muted text-sm">
                      <span className="flex items-center gap-1">
                        <Mail size={12} strokeWidth={1.5} />
                        {barber.email}
                      </span>
                      {barber.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} strokeWidth={1.5} />
                          {barber.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(barber)}
                    className="p-2 text-foreground-muted hover:text-accent-gold hover:bg-accent-gold/10 rounded-lg transition-colors"
                    title="ערוך"
                  >
                    <Pencil size={16} strokeWidth={1.5} />
                  </button>
                  {barber.id !== currentBarber?.id && (
                    <button
                      onClick={() => handleToggleActive(barber)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        barber.is_active
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                      )}
                    >
                      {barber.is_active ? 'השבת' : 'הפעל'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
