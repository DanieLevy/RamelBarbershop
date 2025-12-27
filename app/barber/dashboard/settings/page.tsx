'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { BarbershopSettings } from '@/types/database'

export default function SettingsPage() {
  const router = useRouter()
  const { isAdmin } = useBarberAuthStore()
  
  const [settings, setSettings] = useState<BarbershopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/barber/dashboard')
      return
    }
    fetchSettings()
  }, [isAdmin, router])

  const fetchSettings = async () => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('barbershop_settings')
      .select('*')
      .single()
    
    if (error) {
      console.error('Error fetching settings:', error)
      toast.error('שגיאה בטעינת ההגדרות')
      return
    }
    
    const s = data as BarbershopSettings
    setSettings(s)
    setName(s.name)
    setPhone(s.phone || '')
    setAddress(s.address || '')
    setDescription(s.description || '')
    setLoading(false)
  }

  const handleSave = async () => {
    if (!settings?.id) return
    
    setSaving(true)
    const supabase = createClient()
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('barbershop_settings') as any)
      .update({
        name,
        phone: phone || null,
        address: address || null,
        description: description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
    
    if (error) {
      console.error('Error saving settings:', error)
      toast.error('שגיאה בשמירת ההגדרות')
    } else {
      toast.success('ההגדרות נשמרו בהצלחה!')
    }
    
    setSaving(false)
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
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-foreground-light">הגדרות המספרה</h1>
        <p className="text-foreground-muted mt-1">עדכן את פרטי המספרה</p>
      </div>

      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm">שם המספרה</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
            />
          </div>

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
            <label className="text-foreground-light text-sm">כתובת</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm">תיאור</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'w-full py-3 rounded-xl font-medium transition-all',
              saving
                ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
            )}
          >
            {saving ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </div>
    </div>
  )
}

