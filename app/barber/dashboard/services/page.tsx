'use client'

import { useEffect, useState } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FaPlus, FaEdit, FaTrash, FaCut } from 'react-icons/fa'
import type { Service } from '@/types/database'

export default function ServicesPage() {
  const { barber } = useBarberAuthStore()
  
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [nameHe, setNameHe] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(30)
  const [price, setPrice] = useState(0)

  useEffect(() => {
    if (barber?.id) {
      fetchServices()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])

  const fetchServices = async () => {
    if (!barber?.id) return
    
    setLoading(true)
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('barber_id', barber.id)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching services:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
    }
    
    setServices((data as Service[]) || [])
    setLoading(false)
  }

  const resetForm = () => {
    setName('')
    setNameHe('')
    setDescription('')
    setDuration(30)
    setPrice(0)
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (service: Service) => {
    setEditingId(service.id)
    setName(service.name)
    setNameHe(service.name_he)
    setDescription(service.description || '')
    setDuration(service.duration)
    setPrice(service.price)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!nameHe.trim()) {
      toast.error('נא להזין שם שירות')
      return
    }
    
    if (duration <= 0) {
      toast.error('נא להזין משך זמן תקין')
      return
    }
    
    if (price < 0) {
      toast.error('מחיר לא יכול להיות שלילי')
      return
    }
    
    setSaving(true)
    const supabase = createClient()
    
    const serviceData = {
      name: name || nameHe,
      name_he: nameHe,
      description: description || null,
      duration,
      price,
      barber_id: barber?.id,
      is_active: true,
    }
    
    if (editingId) {
      // Update existing service
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('services') as any)
        .update(serviceData)
        .eq('id', editingId)
        .select()
      
      if (error) {
        console.error('Error updating service:', error)
        toast.error(`שגיאה בעדכון השירות: ${error.message || 'שגיאה לא ידועה'}`)
      } else {
        toast.success('השירות עודכן בהצלחה!')
        resetForm()
        fetchServices()
      }
    } else {
      // Create new service
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('services') as any)
        .insert(serviceData)
        .select()
      
      if (error) {
        console.error('Error creating service:', error)
        toast.error(`שגיאה ביצירת השירות: ${error.message || 'שגיאה לא ידועה'}`)
      } else {
        toast.success('השירות נוסף בהצלחה!')
        resetForm()
        fetchServices()
      }
    }
    
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק את השירות?')) return
    
    const supabase = createClient()
    
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting service:', error)
      toast.error('שגיאה במחיקה')
    } else {
      toast.success('השירות נמחק בהצלחה!')
      fetchServices()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground-light">השירותים שלי</h1>
          <p className="text-foreground-muted mt-1">נהל את השירותים שאתה מציע</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-lg font-medium hover:bg-accent-gold/90 transition-colors"
        >
          <FaPlus className="w-4 h-4" />
          הוסף שירות
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-medium text-foreground-light mb-4">
            {editingId ? 'עריכת שירות' : 'הוסף שירות חדש'}
          </h3>
          
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">שם השירות (עברית) *</label>
              <input
                type="text"
                value={nameHe}
                onChange={(e) => setNameHe(e.target.value)}
                placeholder="לדוגמה: תספורת גברים"
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">שם באנגלית (אופציונלי)</label>
              <input
                type="text"
                dir="ltr"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Men's Haircut"
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">תיאור (אופציונלי)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm">משך (דקות) *</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  min={5}
                  step={5}
                  className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-foreground-light text-sm">מחיר (₪) *</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
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

      {/* Services List */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        {services.length === 0 ? (
          <div className="text-center py-8">
            <FaCut className="w-12 h-12 text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted">אין שירותים מוגדרים</p>
            <p className="text-foreground-muted text-sm mt-1">הוסף את השירותים שאתה מציע ללקוחות</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-4 bg-background-dark rounded-xl border border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent-gold/20 flex items-center justify-center">
                    <FaCut className="w-5 h-5 text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-foreground-light font-medium">{service.name_he}</p>
                    <p className="text-foreground-muted text-sm">
                      {service.duration} דקות • ₪{service.price}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(service)}
                    className="p-2 text-foreground-muted hover:text-accent-gold hover:bg-accent-gold/10 rounded-lg transition-colors"
                    title="ערוך"
                  >
                    <FaEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-2 text-foreground-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="מחק"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

