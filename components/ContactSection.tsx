'use client'

import { Phone, Mail, Clock, ArrowUpRight } from 'lucide-react'
import { SectionContainer, SectionHeader, SectionContent } from './home/SectionContainer'
import { cn, formatOpeningHours, isTimeWithinBusinessHours } from '@/lib/utils'
import { openExternalLink } from '@/lib/utils/external-link'
import type { BarbershopSettings } from '@/types/database'

// Social media icons
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || 'w-6 h-6'}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || 'w-6 h-6'}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
)

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || 'w-6 h-6'}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || 'w-6 h-6'}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
)

// Reusable Contact Card Component for complex layouts
interface ContactCardProps {
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  variant: 'gold' | 'whatsapp'
  className?: string
}

const ContactCard = ({ onClick, icon, title, subtitle, variant, className }: ContactCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group relative w-full overflow-hidden rounded-xl p-3 sm:p-4',
      'flex items-center gap-3',
      'transition-all duration-200 ease-out',
      'hover:scale-[1.01] active:scale-[0.99]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background-dark',
      variant === 'gold' && 'bg-white/[0.04] border border-accent-gold/20 hover:border-accent-gold/40 focus-visible:ring-accent-gold',
      variant === 'whatsapp' && 'bg-white/[0.04] border border-green-500/20 hover:border-green-500/40 focus-visible:ring-green-500',
      className
    )}
  >
    {/* Icon container - compact */}
    <div className={cn(
      'relative z-10 shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
      'transition-all duration-200',
      variant === 'gold' && 'bg-accent-gold/10',
      variant === 'whatsapp' && 'bg-green-500/10'
    )}>
      {icon}
    </div>
    
    {/* Text content - compact */}
    <div className="relative z-10 flex-1 text-right min-w-0">
      <p className="text-foreground-muted text-xs">{title}</p>
      <p className={cn(
        'font-medium text-sm truncate',
        variant === 'gold' && 'text-accent-gold',
        variant === 'whatsapp' && 'text-green-400'
      )} dir="ltr">
        {subtitle}
      </p>
    </div>
    
    {/* Arrow indicator */}
    <ArrowUpRight className={cn(
      'relative z-10 w-4 h-4 opacity-40 group-hover:opacity-70',
      'transition-opacity duration-200',
      variant === 'gold' && 'text-accent-gold',
      variant === 'whatsapp' && 'text-green-400'
    )} />
  </button>
)

// Social Button Component
interface SocialButtonProps {
  onClick: () => void
  icon: React.ReactNode
  label: string
  hoverColor: string
  className?: string
}

const SocialButton = ({ onClick, icon, label, className }: SocialButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group relative w-16 h-16 rounded-xl overflow-hidden',
      'bg-white/[0.03] border border-white/[0.06]',
      'flex flex-col items-center justify-center gap-1',
      'transition-all duration-200 ease-out',
      'hover:border-white/10 hover:bg-white/[0.05] active:scale-[0.98]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background-dark',
      className
    )}
  >
    {/* Icon */}
    <div className="relative z-10 transition-transform duration-200 group-hover:scale-105">
      {icon}
    </div>
    
    {/* Label */}
    <span className="relative z-10 text-[9px] font-medium text-foreground-muted group-hover:text-foreground-light transition-colors duration-200">
      {label}
    </span>
  </button>
)

interface ContactSectionProps {
  settings?: BarbershopSettings | null
}

/**
 * Contact Section - Unified communication hub
 * 
 * Features:
 * - Primary CTA: Call/WhatsApp buttons
 * - Social media grid
 * - Integrated opening hours with status
 * - Clean, unified design
 */
export function ContactSection({ settings }: ContactSectionProps) {
  const phone = settings?.contact_phone || '052-384-0981'
  const email = settings?.contact_email || 'info@ramel-barbershop.co.il'
  const whatsappNumber = settings?.contact_whatsapp || '972523840981'
  const instagramUrl = settings?.social_instagram || 'https://www.instagram.com/ram__el_barber_shop/'
  const facebookUrl = settings?.social_facebook || 'https://www.facebook.com/ramel.leusani'
  const tiktokUrl = settings?.social_tiktok || ''
  
  // Visibility
  const showPhone = settings?.show_phone !== false
  const showEmail = settings?.show_email !== false
  const showWhatsapp = settings?.show_whatsapp !== false
  const showInstagram = settings?.show_instagram !== false
  const showFacebook = settings?.show_facebook !== false
  const showTiktok = settings?.show_tiktok === true && !!tiktokUrl

  // Opening hours
  const workStart = settings?.work_hours_start?.slice(0, 5) || '09:00'
  const workEnd = settings?.work_hours_end?.slice(0, 5) || '20:00'
  const openDays = settings?.open_days || ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  
  // Check if currently open (using Israel timezone)
  const israelTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })
  const israelDate = new Date(israelTime)
  const currentDay = israelDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Jerusalem' }).toLowerCase()
  const currentTime = israelDate.toTimeString().slice(0, 5)
  const isOpen = openDays.includes(currentDay) && isTimeWithinBusinessHours(currentTime, workStart, workEnd)

  const openingHoursDisplay = formatOpeningHours(openDays, workStart, workEnd, '14:00')

  const openPhone = () => {
    const formattedPhone = phone.replace(/[^0-9+]/g, '')
    window.open(`tel:${formattedPhone.startsWith('+') ? formattedPhone : '+972' + formattedPhone.replace(/^0/, '')}`, '_self')
  }

  const openWhatsApp = () => {
    openExternalLink(`https://wa.me/${whatsappNumber}`)
  }

  const openEmail = () => {
    window.open(`mailto:${email}`, '_self')
  }

  
  return (
    <SectionContainer variant="accent" animate={true} className="index-contact">
      <SectionContent maxWidth="4xl">
        <SectionHeader 
          title="צור קשר" 
          subtitle="נשמח לשמוע ממך"
        />

        {/* Primary CTAs - Call and WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {showPhone && (
            <ContactCard
              onClick={openPhone}
              icon={<Phone size={18} strokeWidth={1.5} className="text-accent-gold" />}
              title="התקשר עכשיו"
              subtitle={phone}
              variant="gold"
            />
          )}

          {showWhatsapp && (
            <ContactCard
              onClick={openWhatsApp}
              icon={<WhatsAppIcon className="w-[18px] h-[18px] text-green-400" />}
              title="שלח הודעה"
              subtitle="WhatsApp"
              variant="whatsapp"
            />
          )}
        </div>

        {/* Secondary - Email and Social - Compact horizontal */}
        <div className={cn(
          'flex justify-center gap-2 mb-6',
        )}>
          {showEmail && email && (
            <SocialButton
              onClick={openEmail}
              icon={<Mail size={20} strokeWidth={1.5} className="text-foreground-muted group-hover:text-accent-gold transition-colors duration-200" />}
              label="אימייל"
              hoverColor=""
            />
          )}

          {showInstagram && instagramUrl && (
            <SocialButton
              onClick={() => openExternalLink(instagramUrl)}
              icon={<InstagramIcon className="w-5 h-5 text-foreground-muted group-hover:text-pink-400 transition-colors duration-200" />}
              label="Instagram"
              hoverColor=""
            />
          )}

          {showFacebook && facebookUrl && (
            <SocialButton
              onClick={() => openExternalLink(facebookUrl)}
              icon={<FacebookIcon className="w-5 h-5 text-foreground-muted group-hover:text-blue-400 transition-colors duration-200" />}
              label="Facebook"
              hoverColor=""
            />
          )}

          {showTiktok && tiktokUrl && (
            <SocialButton
              onClick={() => openExternalLink(tiktokUrl)}
              icon={<TikTokIcon className="w-5 h-5 text-foreground-muted group-hover:text-white transition-colors duration-200" />}
              label="TikTok"
              hoverColor=""
            />
          )}
        </div>

        {/* Opening Hours */}
        <div className="glass-card p-5 sm:p-6 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock size={20} strokeWidth={1.5} className="text-accent-gold" />
              <h3 className="text-foreground-light font-medium">שעות פעילות</h3>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10">
              <span 
                className={cn(
                  'w-2 h-2 rounded-full',
                  isOpen 
                    ? 'bg-status-available shadow-[0_0_8px_rgba(34,197,94,0.5)]' 
                    : 'bg-status-offline shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                )}
              />
              <span className="text-xs text-foreground-light">
                {isOpen ? 'פתוח' : 'סגור'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {openingHoursDisplay.map((item, index) => (
              <div 
                key={index}
                className={cn(
                  'flex justify-between items-center py-2 text-sm',
                  index < openingHoursDisplay.length - 1 && 'border-b border-white/5'
                )}
              >
                <span className="text-foreground-muted">{item.days}</span>
                {item.isClosed ? (
                  <span className="text-red-400 font-medium">{item.hours}</span>
                ) : (
                  <span className="text-foreground-light font-medium" dir="ltr">
                    {item.hours}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </SectionContent>
    </SectionContainer>
  )
}

export default ContactSection
