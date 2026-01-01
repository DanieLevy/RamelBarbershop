'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useBugReporter } from '@/hooks/useBugReporter'
import { 
  Store, 
  MapPin, 
  MessageSquare, 
  Globe,
  Save,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react'
import type { BarbershopSettings } from '@/types/database'

type SectionKey = 'basic' | 'hero' | 'location' | 'contact' | 'booking'

export default function SettingsPage() {
  const router = useRouter()
  const { isAdmin } = useBarberAuthStore()
  const { report } = useBugReporter('SettingsPage')
  
  const [settings, setSettings] = useState<BarbershopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState<SectionKey[]>(['basic'])
  
  // Basic settings
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  
  // Hero content
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [heroDescription, setHeroDescription] = useState('')
  
  // Location
  const [addressText, setAddressText] = useState('')
  const [addressLat, setAddressLat] = useState('')
  const [addressLng, setAddressLng] = useState('')
  const [wazeLink, setWazeLink] = useState('')
  const [googleMapsLink, setGoogleMapsLink] = useState('')
  
  // Contact & Social
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactWhatsapp, setContactWhatsapp] = useState('')
  const [socialInstagram, setSocialInstagram] = useState('')
  const [socialFacebook, setSocialFacebook] = useState('')
  const [socialTiktok, setSocialTiktok] = useState('')
  
  // Visibility toggles
  const [showPhone, setShowPhone] = useState(true)
  const [showEmail, setShowEmail] = useState(true)
  const [showWhatsapp, setShowWhatsapp] = useState(true)
  const [showInstagram, setShowInstagram] = useState(true)
  const [showFacebook, setShowFacebook] = useState(true)
  const [showTiktok, setShowTiktok] = useState(false)
  
  // Booking settings
  const [maxBookingDaysAhead, setMaxBookingDaysAhead] = useState(21)

  const fetchSettings = useCallback(async () => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('barbershop_settings')
      .select('*')
      .single()
    
    if (error) {
      console.error('Error fetching settings:', error)
      await report(new Error(error.message), 'Fetching barbershop settings')
      toast.error('שגיאה בטעינת ההגדרות')
      return
    }
    
    const s = data as BarbershopSettings
    setSettings(s)
    
    // Basic
    setName(s.name)
    setPhone(s.phone || '')
    setAddress(s.address || '')
    setDescription(s.description || '')
    
    // Hero
    setHeroTitle(s.hero_title || '')
    setHeroSubtitle(s.hero_subtitle || '')
    setHeroDescription(s.hero_description || '')
    
    // Location
    setAddressText(s.address_text || '')
    setAddressLat(s.address_lat?.toString() || '')
    setAddressLng(s.address_lng?.toString() || '')
    setWazeLink(s.waze_link || '')
    setGoogleMapsLink(s.google_maps_link || '')
    
    // Contact
    setContactPhone(s.contact_phone || '')
    setContactEmail(s.contact_email || '')
    setContactWhatsapp(s.contact_whatsapp || '')
    setSocialInstagram(s.social_instagram || '')
    setSocialFacebook(s.social_facebook || '')
    setSocialTiktok(s.social_tiktok || '')
    
    // Visibility
    setShowPhone(s.show_phone !== false)
    setShowEmail(s.show_email !== false)
    setShowWhatsapp(s.show_whatsapp !== false)
    setShowInstagram(s.show_instagram !== false)
    setShowFacebook(s.show_facebook !== false)
    setShowTiktok(s.show_tiktok === true)
    
    // Booking settings
    setMaxBookingDaysAhead(s.max_booking_days_ahead || 21)
    
    setLoading(false)
  }, [report])

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/barber/dashboard')
      return
    }
    fetchSettings()
  }, [isAdmin, router, fetchSettings])

  const toggleSection = (section: SectionKey) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const handleSave = async () => {
    if (!settings?.id) return
    
    setSaving(true)
    const supabase = createClient()
    
    const { error } = await supabase.from('barbershop_settings')
      .update({
        // Basic
        name,
        phone: phone || null,
        address: address || null,
        description: description || null,
        
        // Hero
        hero_title: heroTitle || null,
        hero_subtitle: heroSubtitle || null,
        hero_description: heroDescription || null,
        
        // Location
        address_text: addressText || null,
        address_lat: addressLat ? parseFloat(addressLat) : null,
        address_lng: addressLng ? parseFloat(addressLng) : null,
        waze_link: wazeLink || null,
        google_maps_link: googleMapsLink || null,
        
        // Contact
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        contact_whatsapp: contactWhatsapp || null,
        social_instagram: socialInstagram || null,
        social_facebook: socialFacebook || null,
        social_tiktok: socialTiktok || null,
        
        // Visibility
        show_phone: showPhone,
        show_email: showEmail,
        show_whatsapp: showWhatsapp,
        show_instagram: showInstagram,
        show_facebook: showFacebook,
        show_tiktok: showTiktok,
        
        // Booking settings
        max_booking_days_ahead: maxBookingDaysAhead,
        
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
    
    if (error) {
      console.error('Error saving settings:', error)
      await report(new Error(error.message), 'Saving barbershop settings')
      toast.error('שגיאה בשמירת ההגדרות')
    } else {
      toast.success('ההגדרות נשמרו בהצלחה!')
    }
    
    setSaving(false)
  }

  // Auto-generate navigation links from coordinates
  const generateNavigationLinks = () => {
    if (addressLat && addressLng) {
      const lat = addressLat
      const lng = addressLng
      setWazeLink(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`)
      setGoogleMapsLink(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
      toast.success('קישורי ניווט נוצרו אוטומטית')
    } else {
      toast.error('יש להזין קואורדינטות קודם')
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

  const sections: { key: SectionKey; title: string; icon: typeof Store; description: string }[] = [
    { key: 'basic', title: 'פרטים בסיסיים', icon: Store, description: 'שם המספרה, טלפון, כתובת' },
    { key: 'hero', title: 'תוכן ראשי', icon: MessageSquare, description: 'כותרות ותיאור בדף הבית' },
    { key: 'location', title: 'מיקום', icon: MapPin, description: 'כתובת, מפה וניווט' },
    { key: 'contact', title: 'יצירת קשר', icon: Globe, description: 'רשתות חברתיות ופרטי קשר' },
    { key: 'booking', title: 'הגדרות הזמנות', icon: Store, description: 'מגבלות וכללים להזמנת תורים' },
  ]

  return (
    <div className="max-w-3xl pb-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-foreground-light">הגדרות המספרה</h1>
        <p className="text-foreground-muted mt-1">עדכן את תוכן ופרטי האתר</p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div 
            key={section.key}
            className="bg-background-card border border-white/10 rounded-2xl overflow-hidden"
          >
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent-gold/20 flex items-center justify-center">
                  <section.icon size={20} strokeWidth={1.5} className="text-accent-gold" />
                </div>
                <div className="text-right">
                  <h3 className="text-foreground-light font-medium">{section.title}</h3>
                  <p className="text-foreground-muted text-sm">{section.description}</p>
                </div>
              </div>
              {expandedSections.includes(section.key) ? (
                <ChevronUp size={20} className="text-foreground-muted" />
              ) : (
                <ChevronDown size={20} className="text-foreground-muted" />
              )}
            </button>
            
            {/* Section content */}
            {expandedSections.includes(section.key) && (
              <div className="p-5 pt-0 border-t border-white/5">
                {section.key === 'basic' && (
                  <div className="space-y-4 pt-5">
                    <InputField label="שם המספרה" value={name} onChange={setName} />
                    <InputField label="טלפון" value={phone} onChange={setPhone} dir="ltr" placeholder="05X-XXXXXXX" />
                    <InputField label="כתובת (מקוצר)" value={address} onChange={setAddress} />
                    <TextareaField label="תיאור" value={description} onChange={setDescription} rows={3} />
                  </div>
                )}
                
                {section.key === 'hero' && (
                  <div className="space-y-4 pt-5">
                    <InputField 
                      label="כותרת ראשית" 
                      value={heroTitle} 
                      onChange={setHeroTitle} 
                      placeholder="רמאל ברברשופ"
                    />
                    <InputField 
                      label="תת-כותרת" 
                      value={heroSubtitle} 
                      onChange={setHeroSubtitle}
                      placeholder="חווית טיפוח ייחודית לגבר המודרני"
                    />
                    <TextareaField 
                      label="תיאור מפורט" 
                      value={heroDescription} 
                      onChange={setHeroDescription}
                      rows={4}
                      placeholder="רמאל ברברשופ הוא מקום ייחודי במינו..."
                    />
                  </div>
                )}
                
                {section.key === 'location' && (
                  <div className="space-y-4 pt-5">
                    <InputField 
                      label="כתובת מלאה" 
                      value={addressText} 
                      onChange={setAddressText}
                      placeholder="יעקב טהון 13, ירושלים, ישראל"
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <InputField 
                        label="קו רוחב (Latitude)" 
                        value={addressLat} 
                        onChange={setAddressLat}
                        dir="ltr"
                        placeholder="31.7857"
                      />
                      <InputField 
                        label="קו אורך (Longitude)" 
                        value={addressLng} 
                        onChange={setAddressLng}
                        dir="ltr"
                        placeholder="35.2271"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={generateNavigationLinks}
                      className="text-sm text-accent-gold hover:underline"
                    >
                      יצירת קישורי ניווט אוטומטית מהקואורדינטות →
                    </button>
                    
                    <InputField 
                      label="קישור Waze" 
                      value={wazeLink} 
                      onChange={setWazeLink}
                      dir="ltr"
                      placeholder="https://waze.com/ul?ll=..."
                    />
                    <InputField 
                      label="קישור Google Maps" 
                      value={googleMapsLink} 
                      onChange={setGoogleMapsLink}
                      dir="ltr"
                      placeholder="https://www.google.com/maps/dir/..."
                    />
                  </div>
                )}
                
                {section.key === 'contact' && (
                  <div className="space-y-6 pt-5">
                    {/* Phone */}
                    <ToggleableField
                      label="טלפון"
                      value={contactPhone}
                      onChange={setContactPhone}
                      visible={showPhone}
                      onToggle={setShowPhone}
                      dir="ltr"
                      placeholder="052-384-0981"
                    />
                    
                    {/* Email */}
                    <ToggleableField
                      label="אימייל"
                      value={contactEmail}
                      onChange={setContactEmail}
                      visible={showEmail}
                      onToggle={setShowEmail}
                      dir="ltr"
                      placeholder="info@barbershop.com"
                    />
                    
                    {/* WhatsApp */}
                    <ToggleableField
                      label="WhatsApp (מספר בינלאומי)"
                      value={contactWhatsapp}
                      onChange={setContactWhatsapp}
                      visible={showWhatsapp}
                      onToggle={setShowWhatsapp}
                      dir="ltr"
                      placeholder="972521234567"
                    />
                    
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-foreground-muted text-sm mb-4">רשתות חברתיות</p>
                    </div>
                    
                    {/* Instagram */}
                    <ToggleableField
                      label="Instagram"
                      value={socialInstagram}
                      onChange={setSocialInstagram}
                      visible={showInstagram}
                      onToggle={setShowInstagram}
                      dir="ltr"
                      placeholder="https://instagram.com/..."
                    />
                    
                    {/* Facebook */}
                    <ToggleableField
                      label="Facebook"
                      value={socialFacebook}
                      onChange={setSocialFacebook}
                      visible={showFacebook}
                      onToggle={setShowFacebook}
                      dir="ltr"
                      placeholder="https://facebook.com/..."
                    />
                    
                    {/* TikTok */}
                    <ToggleableField
                      label="TikTok"
                      value={socialTiktok}
                      onChange={setSocialTiktok}
                      visible={showTiktok}
                      onToggle={setShowTiktok}
                      dir="ltr"
                      placeholder="https://tiktok.com/@..."
                    />
                  </div>
                )}
                
                {section.key === 'booking' && (
                  <div className="space-y-4 pt-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-foreground-light text-sm">
                        טווח הזמנה מקסימלי (ימים)
                      </label>
                      <p className="text-foreground-muted text-xs">
                        כמה ימים מראש לקוחות יכולים לקבוע תורים. לדוגמה: 21 ימים = 3 שבועות קדימה
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={maxBookingDaysAhead}
                          onChange={(e) => setMaxBookingDaysAhead(Math.max(1, Math.min(90, parseInt(e.target.value) || 21)))}
                          className="w-24 p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-center"
                        />
                        <span className="text-foreground-muted">ימים</span>
                      </div>
                      <div className="mt-2 p-3 bg-white/5 rounded-xl">
                        <p className="text-foreground-muted text-xs">
                          כרגע: לקוחות יכולים לקבוע תורים עד{' '}
                          <span className="text-accent-gold font-medium">{maxBookingDaysAhead} ימים</span>{' '}
                          מהיום
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save button - fixed at bottom on mobile */}
      <div className="mt-6 sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-lg',
            saving
              ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
              : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
          )}
        >
          <Save size={18} strokeWidth={2} />
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  )
}

// Helper components
function InputField({ 
  label, 
  value, 
  onChange, 
  dir = 'rtl',
  placeholder = ''
}: { 
  label: string
  value: string
  onChange: (val: string) => void
  dir?: 'ltr' | 'rtl'
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-foreground-light text-sm">{label}</label>
      <input
        type="text"
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold placeholder:text-foreground-muted/50",
          dir === 'ltr' && 'text-left'
        )}
      />
    </div>
  )
}

function TextareaField({ 
  label, 
  value, 
  onChange,
  rows = 4,
  placeholder = ''
}: { 
  label: string
  value: string
  onChange: (val: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-foreground-light text-sm">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold resize-none placeholder:text-foreground-muted/50"
      />
    </div>
  )
}

function ToggleableField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  dir = 'rtl',
  placeholder = ''
}: {
  label: string
  value: string
  onChange: (val: string) => void
  visible: boolean
  onToggle: (val: boolean) => void
  dir?: 'ltr' | 'rtl'
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-foreground-light text-sm">{label}</label>
        <button
          type="button"
          onClick={() => onToggle(!visible)}
          className={cn(
            'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors',
            visible 
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          )}
        >
          {visible ? <Eye size={14} /> : <EyeOff size={14} />}
          {visible ? 'מוצג' : 'מוסתר'}
        </button>
      </div>
      <input
        type="text"
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold placeholder:text-foreground-muted/50",
          dir === 'ltr' && 'text-left',
          !visible && 'opacity-50'
        )}
      />
    </div>
  )
}
