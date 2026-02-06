'use client'

import { useEffect, useState, useRef } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { updateBarber, setBarberPassword } from '@/lib/auth/barber-auth'
import { createClient } from '@/lib/supabase/client'
import { uploadAvatar } from '@/lib/storage/upload'
import { showToast } from '@/lib/toast'
import { cn, buildShareableBarberLink, generateSlugFromEnglishName, getPreferredBarberSlug } from '@/lib/utils'
import { User, Camera, Bell, Plus, Trash, Pencil, Upload, Link2, Copy, Check, ExternalLink, Globe, Instagram } from 'lucide-react'
import type { BarberMessage } from '@/types/database'
import Image from 'next/image'
import { useBugReporter } from '@/hooks/useBugReporter'
import { ImagePositionEditor } from '@/components/barber/ImagePositionEditor'
import { Button } from '@heroui/react'

export default function ProfilePage() {
  const { barber, setBarber } = useBarberAuthStore()
  const { report } = useBugReporter('ProfilePage')
  
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  // Profile form
  const [fullname, setFullname] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [imgUrl, setImgUrl] = useState('')
  const [imgPositionX, setImgPositionX] = useState(50)
  const [imgPositionY, setImgPositionY] = useState(30)
  const [username, setUsername] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  
  // Shareable link
  const [linkCopied, setLinkCopied] = useState(false)
  
  // Password form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // Messages
  const [messages, setMessages] = useState<BarberMessage[]>([])
  const [showMessageForm, setShowMessageForm] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [savingMessage, setSavingMessage] = useState(false)
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (barber) {
      setFullname(barber.fullname)
      setNameEn((barber as { name_en?: string }).name_en || '')
      setEmail(barber.email || '')
      setPhone(barber.phone || '')
      setImgUrl(barber.img_url || '')
      setImgPositionX((barber as { img_position_x?: number }).img_position_x ?? 50)
      setImgPositionY((barber as { img_position_y?: number }).img_position_y ?? 30)
      setUsername(barber.username || '')
      setInstagramUrl((barber as { instagram_url?: string }).instagram_url || '')
      fetchMessages()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])

  const fetchMessages = async () => {
    if (!barber?.id) return
    
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('barber_messages')
      .select('*')
      .eq('barber_id', barber.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching messages:', error)
      await report(new Error(error.message), 'Fetching barber messages')
    }
    
    setMessages((data as BarberMessage[]) || [])
    setLoading(false)
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !barber?.id) return
    
    setUploadingImage(true)
    
    const result = await uploadAvatar(file, barber.id)
    
    if (result.success && result.url) {
      setImgUrl(result.url)
      showToast.success('התמונה הועלתה בהצלחה!')
      
      // Automatically save the profile with new image
      const updateResult = await updateBarber(barber.id, {
        img_url: result.url,
      })
      
      if (updateResult.success) {
        setBarber({ ...barber, img_url: result.url })
      }
    } else {
      await report(new Error(result.error || 'Avatar upload failed'), 'Uploading barber avatar')
      showToast.error(result.error || 'שגיאה בהעלאת התמונה')
    }
    
    setUploadingImage(false)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSaveImagePosition = async (x: number, y: number) => {
    if (!barber?.id) return
    
    const result = await updateBarber(barber.id, {
      img_position_x: x,
      img_position_y: y,
    })
    
    if (result.success) {
      setImgPositionX(x)
      setImgPositionY(y)
      setBarber({ ...barber, img_position_x: x, img_position_y: y } as typeof barber)
      showToast.success('מיקום התמונה נשמר!')
    } else {
      await report(new Error(result.error || 'Position save failed'), 'Saving image position')
      showToast.error('שגיאה בשמירת המיקום')
    }
  }

  const handleSaveProfile = async () => {
    if (!barber?.id) return
    
    if (!fullname.trim()) {
      showToast.error('נא להזין שם')
      return
    }
    
    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast.error('נא להזין כתובת אימייל תקינה')
      return
    }
    
    setSavingProfile(true)
    
    // Validate English name format (only English letters and spaces)
    if (nameEn && !/^[a-zA-Z\s]+$/.test(nameEn.trim())) {
      showToast.error('שם באנגלית חייב להכיל רק אותיות באנגלית')
      setSavingProfile(false)
      return
    }
    
    // Check if the new English name slug would conflict with another barber
    if (nameEn && nameEn.trim()) {
      const newSlug = generateSlugFromEnglishName(nameEn)
      const supabase = createClient()
      const { data: allBarbers } = await supabase
        .from('users')
        .select('id, name_en')
        .eq('is_barber', true)
        .neq('id', barber.id)
      
      if (allBarbers) {
        const conflict = allBarbers.find(b => {
          if (b.name_en) {
            return generateSlugFromEnglishName(b.name_en) === newSlug
          }
          return false
        })
        
        if (conflict) {
          showToast.error('השם באנגלית כבר תפוס על ידי ספר אחר, נסה שם אחר')
          setSavingProfile(false)
          return
        }
      }
    }
    
    // Validate Instagram URL format if provided
    const cleanedInstagramUrl = instagramUrl.trim()
    if (cleanedInstagramUrl && !cleanedInstagramUrl.includes('instagram.com')) {
      showToast.error('נא להזין קישור תקין לאינסטגרם')
      setSavingProfile(false)
      return
    }
    
    const result = await updateBarber(barber.id, {
      fullname,
      email: email || undefined,
      phone: phone || undefined,
      img_url: imgUrl || undefined,
      username: username || undefined,
      name_en: nameEn.trim() || undefined,
      instagram_url: cleanedInstagramUrl || null,
    })
    
    if (result.success) {
      showToast.success('הפרופיל עודכן בהצלחה!')
      setBarber({ ...barber, fullname, email, phone, img_url: imgUrl, username, name_en: nameEn.trim() || null, instagram_url: cleanedInstagramUrl || null } as typeof barber)
    } else {
      await report(new Error(result.error || 'Profile update failed'), 'Saving barber profile')
      showToast.error(result.error || 'שגיאה בעדכון')
    }
    
    setSavingProfile(false)
  }

  const handleChangePassword = async () => {
    if (!barber?.id) return
    
    if (!newPassword) {
      showToast.error('נא להזין סיסמה חדשה')
      return
    }
    
    if (newPassword.length < 6) {
      showToast.error('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    
    if (newPassword !== confirmPassword) {
      showToast.error('הסיסמאות אינן תואמות')
      return
    }
    
    setSavingPassword(true)
    
    const result = await setBarberPassword(barber.id, newPassword)
    
    if (result.success) {
      showToast.success('הסיסמה עודכנה בהצלחה!')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      await report(new Error(result.error || 'Password change failed'), 'Changing barber password')
      showToast.error(result.error || 'שגיאה בעדכון הסיסמה')
    }
    
    setSavingPassword(false)
  }

  const handleSaveMessage = async () => {
    if (!barber?.id) return
    
    if (!messageText.trim()) {
      showToast.error('נא להזין הודעה')
      return
    }
    
    setSavingMessage(true)
    const supabase = createClient()
    
    if (editingMessageId) {
      const { data, error } = await supabase
        .from('barber_messages')
        .update({ message: messageText, updated_at: new Date().toISOString() })
        .eq('id', editingMessageId)
        .select()
      
      if (error || !data || data.length === 0) {
        console.error('Error updating message:', error)
        await report(new Error(error?.message || 'Message update failed'), 'Updating barber message')
        showToast.error('שגיאה בעדכון ההודעה')
      } else {
        showToast.success('ההודעה עודכנה!')
        resetMessageForm()
        fetchMessages()
      }
    } else {
      const { data, error } = await supabase
        .from('barber_messages')
        .insert({
          barber_id: barber.id,
          message: messageText,
          is_active: true,
        })
        .select()
      
      if (error || !data || data.length === 0) {
        console.error('Error creating message:', error)
        await report(new Error(error?.message || 'Message creation failed'), 'Creating barber message')
        showToast.error('שגיאה ביצירת ההודעה')
      } else {
        showToast.success('ההודעה נוספה!')
        resetMessageForm()
        fetchMessages()
      }
    }
    
    setSavingMessage(false)
  }

  const handleToggleMessage = async (id: string, isActive: boolean) => {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('barber_messages')
      .update({ is_active: !isActive })
      .eq('id', id)
      .select()
    
    if (error || !data || data.length === 0) {
      console.error('Error toggling message:', error)
      await report(new Error(error?.message || 'Message toggle failed'), 'Toggling barber message visibility')
      showToast.error('שגיאה בעדכון')
    } else {
      fetchMessages()
    }
  }

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('האם למחוק את ההודעה?')) return
    
    const supabase = createClient()
    
    const { error } = await supabase
      .from('barber_messages')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting message:', error)
      await report(new Error(error.message), 'Deleting barber message')
      showToast.error('שגיאה במחיקה')
    } else {
      showToast.success('ההודעה נמחקה')
      fetchMessages()
    }
  }

  const handleEditMessage = (msg: BarberMessage) => {
    setEditingMessageId(msg.id)
    setMessageText(msg.message)
    setShowMessageForm(true)
  }

  const resetMessageForm = () => {
    setShowMessageForm(false)
    setEditingMessageId(null)
    setMessageText('')
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
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-foreground-light">הפרופיל שלי</h1>
        <p className="text-foreground-muted mt-1">עדכן את הפרטים האישיים שלך</p>
      </div>

      {/* Profile Section */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <User size={20} strokeWidth={1.5} className="text-accent-gold" />
          פרטים אישיים
        </h3>

        {/* Avatar Upload */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-background-dark border-2 border-white/10">
              {imgUrl ? (
                <Image
                  src={imgUrl}
                  alt={fullname}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={40} strokeWidth={1.5} className="text-foreground-muted" />
                </div>
              )}
            </div>
            
            {/* Upload overlay button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className={cn(
                'absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity',
                uploadingImage && 'opacity-100'
              )}
            >
              {uploadingImage ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Camera size={20} strokeWidth={1.5} className="text-white mb-1" />
                  <span className="text-white text-xs">שנה</span>
                </>
              )}
            </button>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
          
          <div className="flex-1">
            <p className="text-foreground-light text-sm mb-2">תמונת פרופיל</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex items-center gap-2 px-4 py-2 bg-background-dark border border-white/10 rounded-lg text-foreground-muted hover:text-foreground-light hover:border-white/20 transition-colors text-sm"
            >
              <Upload size={16} strokeWidth={1.5} />
              {uploadingImage ? 'מעלה...' : 'העלה תמונה'}
            </button>
            <p className="text-foreground-muted/60 text-xs mt-2">
              JPEG, PNG, WebP או GIF • עד 5MB
            </p>
          </div>
        </div>

        {/* Image Position Editor - Only show if image exists */}
        {imgUrl && (
          <div className="pt-4 border-t border-white/10">
            <ImagePositionEditor
              imageUrl={imgUrl}
              initialX={imgPositionX}
              initialY={imgPositionY}
              onSave={handleSaveImagePosition}
              barberName={fullname}
            />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm">שם מלא</label>
            <input
              type="text"
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm">אימייל (להתחברות)</label>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
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

          {/* English Name for URL */}
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm flex items-center gap-2">
              <Globe size={14} className="text-accent-gold" />
              שם באנגלית (לקישור)
            </label>
            <input
              type="text"
              dir="ltr"
              value={nameEn}
              onChange={(e) => {
                // Only allow English letters and spaces
                const value = e.target.value.replace(/[^a-zA-Z\s]/g, '')
                setNameEn(value)
              }}
              placeholder="Your Name"
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
            />
            {nameEn && (
              <p className="text-foreground-muted text-xs">
                הקישור שלך יהיה: <span className="text-accent-gold">/barber/{generateSlugFromEnglishName(nameEn)}</span>
              </p>
            )}
            <p className="text-foreground-muted/60 text-xs">
              הזן את שמך באנגלית (למשל: David Cohen) ליצירת קישור נקי ומקצועי
            </p>
          </div>

          {/* Instagram URL */}
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm flex items-center gap-2">
              <Instagram size={14} className="text-pink-500" />
              קישור לאינסטגרם
            </label>
            <input
              type="url"
              dir="ltr"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/your_username"
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
            />
            <p className="text-foreground-muted/60 text-xs">
              הוסף את הקישור לפרופיל האינסטגרם שלך - יוצג כאייקון בכרטיס שלך בדף הבית
            </p>
          </div>

          <Button
            onPress={handleSaveProfile}
            isDisabled={savingProfile}
            className={cn(
              'w-full py-3 rounded-xl font-medium',
              savingProfile
                ? 'bg-foreground-muted/30 text-foreground-muted'
                : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
            )}
          >
            {savingProfile ? 'שומר...' : 'שמור פרופיל'}
          </Button>
        </div>
      </div>

      {/* Shareable Link Section */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <Link2 size={20} strokeWidth={1.5} className="text-accent-gold" />
          קישור לשיתוף
        </h3>
        
        <p className="text-foreground-muted text-sm mb-4">
          שלח את הקישור הזה ללקוחות שלך כדי שיוכלו לקבוע תור ישירות אצלך
        </p>
        
        {(username || nameEn) ? (
          <div className="space-y-4">
            {/* Shareable Link Display */}
            {(() => {
              const preferredSlug = getPreferredBarberSlug(nameEn || null, username)
              const fullUrl = typeof window !== 'undefined' 
                ? buildShareableBarberLink(preferredSlug, window.location.origin)
                : `https://ramel-barbershop.netlify.app/barber/${preferredSlug}`
              
              return (
                <>
                  {/* Full URL Display with Copy */}
                  <div className="p-4 bg-background-dark rounded-xl border border-white/10">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-foreground-muted text-xs">הקישור האישי שלך:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(fullUrl)
                            setLinkCopied(true)
                            showToast.success('הקישור הועתק!')
                            setTimeout(() => setLinkCopied(false), 2000)
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                            linkCopied
                              ? 'bg-green-500 text-white'
                              : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
                          )}
                          aria-label="העתק קישור"
                        >
                          {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                          {linkCopied ? 'הועתק!' : 'העתק'}
                        </button>
                        <a
                          href={`/barber/${preferredSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-foreground-muted hover:text-foreground-light text-xs flex items-center gap-1.5"
                          aria-label="פתח בחלון חדש"
                        >
                          <ExternalLink size={14} />
                          פתח
                        </a>
                      </div>
                    </div>
                    <div 
                      dir="ltr"
                      className="p-3 bg-background-card rounded-lg text-accent-gold text-sm font-mono break-all select-all cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(fullUrl)
                        setLinkCopied(true)
                        showToast.success('הקישור הועתק!')
                        setTimeout(() => setLinkCopied(false), 2000)
                      }}
                    >
                      {fullUrl}
                    </div>
                  </div>
                  
                  {/* English name status */}
                  {nameEn ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <p className="text-emerald-300 text-sm flex items-center gap-2">
                        <Check size={14} />
                        קישור מקצועי עם שמך באנגלית: <span className="font-mono font-medium">{preferredSlug}</span>
                      </p>
                      <p className="text-emerald-300/70 text-xs mt-1">
                        כשישתפו את הקישור בוואטסאפ, התמונה שלך תופיע בתצוגה המקדימה!
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <p className="text-amber-300 text-sm flex items-center gap-2">
                        <Globe size={14} />
                        טיפ: הוסף שם באנגלית לקישור יפה יותר!
                      </p>
                      <p className="text-amber-300/70 text-xs mt-1">
                        במקום <span className="font-mono">{username}</span> יהיה לך קישור כמו <span className="font-mono">david.cohen</span>
                      </p>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-amber-300 text-sm">
              כדי לקבל קישור לשיתוף, הוסף את שמך באנגלית בעמוד הפרופיל ושמור
            </p>
          </div>
        )}
      </div>

      {/* Password Section */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4">שינוי סיסמה</h3>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm">סיסמה חדשה</label>
            <input
              type="password"
              dir="ltr"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm">אימות סיסמה</label>
            <input
              type="password"
              dir="ltr"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
            />
          </div>

          <Button
            onPress={handleChangePassword}
            isDisabled={savingPassword}
            className={cn(
              'w-full py-3 rounded-xl font-medium',
              savingPassword
                ? 'bg-foreground-muted/30 text-foreground-muted'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            )}
          >
            {savingPassword ? 'מעדכן...' : 'עדכן סיסמה'}
          </Button>
        </div>
      </div>

      {/* Custom Messages Section */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground-light flex items-center gap-2">
            <Bell size={20} strokeWidth={1.5} className="text-accent-gold" />
            הודעות ללקוחות
          </h3>
          <Button
            size="sm"
            onPress={() => { resetMessageForm(); setShowMessageForm(true) }}
            className="flex items-center gap-2 px-3 py-1.5 min-w-0 h-auto bg-accent-gold text-background-dark rounded-lg text-sm font-medium hover:bg-accent-gold/90"
          >
            <Plus size={12} strokeWidth={1.5} />
            הוסף
          </Button>
        </div>

        <p className="text-foreground-muted text-sm mb-4">
          הודעות אלו יוצגו ללקוחות בעמוד הזמנת התור שלך
        </p>

        {/* Add/Edit Message Form */}
        {showMessageForm && (
          <div className="mb-4 p-4 bg-background-dark rounded-xl border border-white/5">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={3}
              placeholder="לדוגמה: בין התאריכים 15-20 לחודש אני בחופשה..."
              className="w-full p-3 rounded-lg bg-background-card border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold resize-none text-sm"
            />
            <div className="flex gap-2 mt-3">
              <Button
                onPress={handleSaveMessage}
                isDisabled={savingMessage}
                className="flex-1 py-2 bg-accent-gold text-background-dark rounded-lg text-sm font-medium hover:bg-accent-gold/90"
              >
                {savingMessage ? 'שומר...' : editingMessageId ? 'עדכן' : 'הוסף'}
              </Button>
              <Button
                variant="ghost"
                onPress={resetMessageForm}
                className="px-4 py-2 bg-background-card border border-white/10 text-foreground-muted rounded-lg text-sm hover:text-foreground-light"
              >
                ביטול
              </Button>
            </div>
          </div>
        )}

        {/* Messages List */}
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-foreground-muted text-sm">אין הודעות מוגדרות</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'p-3 rounded-xl border flex items-start justify-between gap-3',
                  msg.is_active
                    ? 'bg-background-dark border-white/5'
                    : 'bg-background-dark/50 border-white/5 opacity-60'
                )}
              >
                <p className="text-foreground-light text-sm flex-1">{msg.message}</p>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => handleToggleMessage(msg.id, msg.is_active)}
                    className={cn(
                      'px-2 py-1 min-w-0 h-auto rounded text-xs font-medium',
                      msg.is_active
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-foreground-muted/10 text-foreground-muted'
                    )}
                  >
                    {msg.is_active ? 'פעיל' : 'מושבת'}
                  </Button>
                  <Button
                    variant="ghost"
                    isIconOnly
                    onPress={() => handleEditMessage(msg)}
                    className="min-w-[28px] w-7 h-7 text-foreground-muted hover:text-accent-gold hover:bg-accent-gold/10 rounded"
                  >
                    <Pencil size={12} strokeWidth={1.5} />
                  </Button>
                  <Button
                    variant="ghost"
                    isIconOnly
                    onPress={() => handleDeleteMessage(msg.id)}
                    className="min-w-[28px] w-7 h-7 text-foreground-muted hover:text-red-400 hover:bg-red-500/10 rounded"
                  >
                    <Trash size={12} strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
