'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { updateBarber, setBarberPassword } from '@/lib/auth/barber-auth'
import { createClient } from '@/lib/supabase/client'
import { uploadAvatar } from '@/lib/storage/upload'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { User, Camera, Bell, Plus, Trash, Pencil, Upload, Clock, BellRing, CalendarPlus, XCircle } from 'lucide-react'
import type { BarberMessage } from '@/types/database'
import type { BarberNotificationSettings } from '@/lib/push/types'
import Image from 'next/image'
import { useBugReporter } from '@/hooks/useBugReporter'

export default function ProfilePage() {
  const { barber, setBarber } = useBarberAuthStore()
  const { report } = useBugReporter('ProfilePage')
  
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  // Profile form
  const [fullname, setFullname] = useState('')
  const [phone, setPhone] = useState('')
  const [imgUrl, setImgUrl] = useState('')
  
  // Password form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // Messages
  const [messages, setMessages] = useState<BarberMessage[]>([])
  const [showMessageForm, setShowMessageForm] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [savingMessage, setSavingMessage] = useState(false)
  
  // Notification settings
  const [notifSettings, setNotifSettings] = useState<BarberNotificationSettings | null>(null)
  const [reminderHours, setReminderHours] = useState(3)
  const [notifyOnCancel, setNotifyOnCancel] = useState(true)
  const [notifyOnNewBooking, setNotifyOnNewBooking] = useState(true)
  const [savingNotifSettings, setSavingNotifSettings] = useState(false)
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchNotificationSettings = useCallback(async () => {
    if (!barber?.id) return
    
    const supabase = createClient()
    
    // Try to get existing settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('barber_notification_settings') as any)
      .select('*')
      .eq('barber_id', barber.id)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching notification settings:', error)
      return
    }
    
    if (data) {
      const settings = data as BarberNotificationSettings
      setNotifSettings(settings)
      setReminderHours(settings.reminder_hours_before)
      setNotifyOnCancel(settings.notify_on_customer_cancel)
      setNotifyOnNewBooking(settings.notify_on_new_booking)
    } else {
      // Create default settings for this barber
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newSettings, error: insertError } = await (supabase.from('barber_notification_settings') as any)
        .insert({ barber_id: barber.id })
        .select()
        .single()
      
      if (insertError) {
        console.error('Error creating notification settings:', insertError)
      } else if (newSettings) {
        const settings = newSettings as BarberNotificationSettings
        setNotifSettings(settings)
        setReminderHours(settings.reminder_hours_before)
        setNotifyOnCancel(settings.notify_on_customer_cancel)
        setNotifyOnNewBooking(settings.notify_on_new_booking)
      }
    }
  }, [barber?.id])

  useEffect(() => {
    if (barber) {
      setFullname(barber.fullname)
      setPhone(barber.phone || '')
      setImgUrl(barber.img_url || '')
      fetchMessages()
      fetchNotificationSettings()
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
      toast.success('התמונה הועלתה בהצלחה!')
      
      // Automatically save the profile with new image
      const updateResult = await updateBarber(barber.id, {
        img_url: result.url,
      })
      
      if (updateResult.success) {
        setBarber({ ...barber, img_url: result.url })
      }
    } else {
      toast.error(result.error || 'שגיאה בהעלאת התמונה')
    }
    
    setUploadingImage(false)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSaveProfile = async () => {
    if (!barber?.id) return
    
    if (!fullname.trim()) {
      toast.error('נא להזין שם')
      return
    }
    
    setSavingProfile(true)
    
    const result = await updateBarber(barber.id, {
      fullname,
      phone: phone || undefined,
      img_url: imgUrl || undefined,
    })
    
    if (result.success) {
      toast.success('הפרופיל עודכן בהצלחה!')
      setBarber({ ...barber, fullname, phone, img_url: imgUrl })
    } else {
      toast.error(result.error || 'שגיאה בעדכון')
    }
    
    setSavingProfile(false)
  }

  const handleChangePassword = async () => {
    if (!barber?.id) return
    
    if (!newPassword) {
      toast.error('נא להזין סיסמה חדשה')
      return
    }
    
    if (newPassword.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('הסיסמאות אינן תואמות')
      return
    }
    
    setSavingPassword(true)
    
    const result = await setBarberPassword(barber.id, newPassword)
    
    if (result.success) {
      toast.success('הסיסמה עודכנה בהצלחה!')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      toast.error(result.error || 'שגיאה בעדכון הסיסמה')
    }
    
    setSavingPassword(false)
  }

  const handleSaveMessage = async () => {
    if (!barber?.id) return
    
    if (!messageText.trim()) {
      toast.error('נא להזין הודעה')
      return
    }
    
    setSavingMessage(true)
    const supabase = createClient()
    
    if (editingMessageId) {
      const { data, error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('barber_messages') as any)
        .update({ message: messageText, updated_at: new Date().toISOString() })
        .eq('id', editingMessageId)
        .select()
      
      if (error || !data || data.length === 0) {
        console.error('Error updating message:', error)
        toast.error('שגיאה בעדכון ההודעה')
      } else {
        toast.success('ההודעה עודכנה!')
        resetMessageForm()
        fetchMessages()
      }
    } else {
      const { data, error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('barber_messages') as any)
        .insert({
          barber_id: barber.id,
          message: messageText,
          is_active: true,
        })
        .select()
      
      if (error || !data || data.length === 0) {
        console.error('Error creating message:', error)
        toast.error('שגיאה ביצירת ההודעה')
      } else {
        toast.success('ההודעה נוספה!')
        resetMessageForm()
        fetchMessages()
      }
    }
    
    setSavingMessage(false)
  }

  const handleToggleMessage = async (id: string, isActive: boolean) => {
    const supabase = createClient()
    
    const { data, error } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('barber_messages') as any)
      .update({ is_active: !isActive })
      .eq('id', id)
      .select()
    
    if (error || !data || data.length === 0) {
      console.error('Error toggling message:', error)
      toast.error('שגיאה בעדכון')
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
      toast.error('שגיאה במחיקה')
    } else {
      toast.success('ההודעה נמחקה')
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

  const handleSaveNotifSettings = async () => {
    if (!barber?.id || !notifSettings?.id) return
    
    setSavingNotifSettings(true)
    const supabase = createClient()
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('barber_notification_settings') as any)
      .update({
        reminder_hours_before: reminderHours,
        notify_on_customer_cancel: notifyOnCancel,
        notify_on_new_booking: notifyOnNewBooking,
        updated_at: new Date().toISOString()
      })
      .eq('id', notifSettings.id)
    
    if (error) {
      console.error('Error saving notification settings:', error)
      await report(new Error(error.message), 'Saving barber notification settings')
      toast.error('שגיאה בשמירת הגדרות ההתראות')
    } else {
      toast.success('הגדרות ההתראות נשמרו!')
      setNotifSettings({
        ...notifSettings,
        reminder_hours_before: reminderHours,
        notify_on_customer_cancel: notifyOnCancel,
        notify_on_new_booking: notifyOnNewBooking
      })
    }
    
    setSavingNotifSettings(false)
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

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className={cn(
              'w-full py-3 rounded-xl font-medium transition-all',
              savingProfile
                ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
            )}
          >
            {savingProfile ? 'שומר...' : 'שמור פרופיל'}
          </button>
        </div>
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

          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className={cn(
              'w-full py-3 rounded-xl font-medium transition-all',
              savingPassword
                ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            )}
          >
            {savingPassword ? 'מעדכן...' : 'עדכן סיסמה'}
          </button>
        </div>
      </div>

      {/* Notification Settings Section */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
        <h3 className="text-lg font-medium text-foreground-light mb-4 flex items-center gap-2">
          <BellRing size={20} strokeWidth={1.5} className="text-accent-gold" />
          הגדרות התראות
        </h3>
        
        <p className="text-foreground-muted text-sm mb-6">
          הגדר מתי ואיך לקוחות יקבלו תזכורות על תורים
        </p>

        <div className="space-y-5">
          {/* Reminder Hours */}
          <div className="flex flex-col gap-2">
            <label className="text-foreground-light text-sm flex items-center gap-2">
              <Clock size={14} className="text-foreground-muted" />
              זמן תזכורת לפני התור
            </label>
            <select
              value={reminderHours}
              onChange={(e) => setReminderHours(parseInt(e.target.value))}
              className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
            >
              {[1, 2, 3, 4, 5, 6, 8, 12, 24].map((hours) => (
                <option key={hours} value={hours}>
                  {hours === 1 ? 'שעה אחת' : hours === 24 ? 'יום לפני' : `${hours} שעות`} לפני התור
                </option>
              ))}
            </select>
            <p className="text-foreground-muted/60 text-xs">
              הלקוחות שלך יקבלו תזכורת push כמה זמן שבחרת לפני התור
            </p>
          </div>

          {/* Notify on Cancel Toggle */}
          <div className="flex items-center justify-between p-4 bg-background-dark rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                notifyOnCancel ? 'bg-red-500/20' : 'bg-white/5'
              )}>
                <XCircle size={20} className={notifyOnCancel ? 'text-red-400' : 'text-foreground-muted'} />
              </div>
              <div>
                <p className="text-foreground-light text-sm font-medium">ביטול תור ע&quot;י לקוח</p>
                <p className="text-foreground-muted text-xs">קבל התראה כשלקוח מבטל תור</p>
              </div>
            </div>
            <button
              onClick={() => setNotifyOnCancel(!notifyOnCancel)}
              className={cn(
                'w-12 h-7 rounded-full transition-colors relative',
                notifyOnCancel ? 'bg-accent-gold' : 'bg-white/10'
              )}
            >
              <div className={cn(
                'absolute top-1 w-5 h-5 rounded-full bg-white transition-all',
                notifyOnCancel ? 'right-1' : 'left-1'
              )} />
            </button>
          </div>

          {/* Notify on New Booking Toggle */}
          <div className="flex items-center justify-between p-4 bg-background-dark rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                notifyOnNewBooking ? 'bg-green-500/20' : 'bg-white/5'
              )}>
                <CalendarPlus size={20} className={notifyOnNewBooking ? 'text-green-400' : 'text-foreground-muted'} />
              </div>
              <div>
                <p className="text-foreground-light text-sm font-medium">תור חדש</p>
                <p className="text-foreground-muted text-xs">קבל התראה כשלקוח קובע תור אצלך</p>
              </div>
            </div>
            <button
              onClick={() => setNotifyOnNewBooking(!notifyOnNewBooking)}
              className={cn(
                'w-12 h-7 rounded-full transition-colors relative',
                notifyOnNewBooking ? 'bg-accent-gold' : 'bg-white/10'
              )}
            >
              <div className={cn(
                'absolute top-1 w-5 h-5 rounded-full bg-white transition-all',
                notifyOnNewBooking ? 'right-1' : 'left-1'
              )} />
            </button>
          </div>

          <button
            onClick={handleSaveNotifSettings}
            disabled={savingNotifSettings || !notifSettings}
            className={cn(
              'w-full py-3 rounded-xl font-medium transition-all',
              savingNotifSettings || !notifSettings
                ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
            )}
          >
            {savingNotifSettings ? 'שומר...' : 'שמור הגדרות התראות'}
          </button>
        </div>
      </div>

      {/* Custom Messages Section */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground-light flex items-center gap-2">
            <Bell size={20} strokeWidth={1.5} className="text-accent-gold" />
            הודעות ללקוחות
          </h3>
          <button
            onClick={() => { resetMessageForm(); setShowMessageForm(true) }}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent-gold text-background-dark rounded-lg text-sm font-medium hover:bg-accent-gold/90 transition-colors"
          >
            <Plus size={12} strokeWidth={1.5} />
            הוסף
          </button>
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
              <button
                onClick={handleSaveMessage}
                disabled={savingMessage}
                className="flex-1 py-2 bg-accent-gold text-background-dark rounded-lg text-sm font-medium hover:bg-accent-gold/90 disabled:opacity-50"
              >
                {savingMessage ? 'שומר...' : editingMessageId ? 'עדכן' : 'הוסף'}
              </button>
              <button
                onClick={resetMessageForm}
                className="px-4 py-2 bg-background-card border border-white/10 text-foreground-muted rounded-lg text-sm hover:text-foreground-light"
              >
                ביטול
              </button>
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
                  <button
                    onClick={() => handleToggleMessage(msg.id, msg.is_active)}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors',
                      msg.is_active
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-foreground-muted/10 text-foreground-muted'
                    )}
                  >
                    {msg.is_active ? 'פעיל' : 'מושבת'}
                  </button>
                  <button
                    onClick={() => handleEditMessage(msg)}
                    className="p-1.5 text-foreground-muted hover:text-accent-gold hover:bg-accent-gold/10 rounded transition-colors"
                  >
                    <Pencil size={12} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="p-1.5 text-foreground-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash size={12} strokeWidth={1.5} />
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
