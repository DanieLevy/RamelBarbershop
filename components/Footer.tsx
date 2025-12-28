'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Clock } from 'lucide-react'
import { formatOpeningHours } from '@/lib/utils'
import type { BarbershopSettings } from '@/types/database'

// Custom SVG icons for social media (Lucide doesn't have brand icons)
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
)

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

interface FooterProps {
  settings?: BarbershopSettings | null
}

export function Footer({ settings }: FooterProps) {
  const currentYear = new Date().getFullYear()

  // Get values from settings with defaults
  const shopName = settings?.name || 'רמאל ברברשופ'
  const phone = settings?.contact_phone || settings?.phone || '052-384-0981'
  const addressText = settings?.address_text || 'בית הכרם 30, ירושלים'
  const whatsappNumber = settings?.contact_whatsapp || '972523840981'
  const instagramUrl = settings?.social_instagram || 'https://www.instagram.com/ram__el_barber_shop/'
  const facebookUrl = settings?.social_facebook || 'https://www.facebook.com/ramel.leusani'
  
  // Visibility toggles
  const showWhatsapp = settings?.show_whatsapp !== false
  const showInstagram = settings?.show_instagram !== false
  const showFacebook = settings?.show_facebook !== false
  
  // Working hours
  const workStart = settings?.work_hours_start?.slice(0, 5) || '09:00'
  const workEnd = settings?.work_hours_end?.slice(0, 5) || '20:00'
  const openDays = settings?.open_days || ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  
  // Get formatted opening hours for display
  const openingHoursDisplay = formatOpeningHours(openDays, workStart, workEnd, '14:00')
  // For footer, we just show a compact version - main days and friday if open
  const mainHours = openingHoursDisplay.filter(h => !h.isClosed).slice(0, 2)

  // Build social links array based on visibility
  const socialLinks = []
  
  if (showWhatsapp) {
    socialLinks.push({
      name: 'WhatsApp',
      icon: WhatsAppIcon,
      url: `https://wa.me/${whatsappNumber}`,
      color: 'hover:text-green-400',
    })
  }
  
  if (showInstagram && instagramUrl) {
    socialLinks.push({
      name: 'Instagram',
      icon: InstagramIcon,
      url: instagramUrl,
      color: 'hover:text-pink-400',
    })
  }
  
  if (showFacebook && facebookUrl) {
    socialLinks.push({
      name: 'Facebook',
      icon: FacebookIcon,
      url: facebookUrl,
      color: 'hover:text-blue-400',
    })
  }

  // Format phone for tel: link
  const formattedPhone = phone.replace(/[^0-9+]/g, '')
  const telLink = formattedPhone.startsWith('+') ? formattedPhone : '+972' + formattedPhone.replace(/^0/, '')

  return (
    <footer className="bg-[#080b0d] border-t border-white/10">
      {/* Main footer content */}
      <div className="container-mobile py-10 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Logo and description */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border border-accent-gold/30 shadow-gold-sm">
                <Image
                  src="/icon.png"
                  alt={shopName}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
            <p className="text-foreground-muted text-sm leading-relaxed">
              {shopName} - מספרה מקצועית בירושלים.
              <br />
              חוויית טיפוח ייחודית לגבר המודרני.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-foreground-light font-medium mb-4">קישורים מהירים</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-foreground-muted hover:text-accent-gold transition-colors text-sm"
                >
                  דף הבית
                </Link>
              </li>
              <li>
                <Link
                  href="/#index-body"
                  className="text-foreground-muted hover:text-accent-gold transition-colors text-sm"
                >
                  קבע תור
                </Link>
              </li>
              <li>
                <Link
                  href="/my-appointments"
                  className="text-foreground-muted hover:text-accent-gold transition-colors text-sm"
                >
                  התורים שלי
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact info */}
          <div>
            <h4 className="text-foreground-light font-medium mb-4">יצירת קשר</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm">
                <MapPin size={16} strokeWidth={1.5} className="text-accent-gold flex-shrink-0" />
                <span className="text-foreground-muted">{addressText}</span>
              </li>
              <li>
                <a
                  href={`tel:${telLink}`}
                  className="flex items-center gap-3 text-sm text-foreground-muted hover:text-accent-gold transition-colors"
                >
                  <Phone size={16} strokeWidth={1.5} className="text-accent-gold flex-shrink-0" />
                  <span dir="ltr">{phone}</span>
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <Clock size={16} strokeWidth={1.5} className="text-accent-gold flex-shrink-0 mt-0.5" />
                <div className="text-foreground-muted">
                  {mainHours.map((item, index) => (
                    <p key={index}>{item.days}: {item.hours}</p>
                  ))}
                </div>
              </li>
            </ul>
          </div>

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div>
              <h4 className="text-foreground-light font-medium mb-4">עקבו אחרינו</h4>
              <div className="flex items-center gap-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-foreground-muted transition-all hover:scale-110 ${social.color}`}
                    aria-label={social.name}
                  >
                    <social.icon />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="container-mobile py-4 flex items-center justify-between text-xs text-foreground-muted">
          <p>© {currentYear} {shopName}. כל הזכויות שמורות.</p>
          {/* Debug link - remove before production */}
          <Link 
            href="/debug" 
            className="text-foreground-muted/50 hover:text-accent-gold transition-colors"
          >
            Debug
          </Link>
        </div>
      </div>

      {/* Add spacing for mobile bottom nav */}
      <div className="h-16 md:hidden" />
    </footer>
  )
}
