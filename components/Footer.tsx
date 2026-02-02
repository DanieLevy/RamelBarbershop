'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Phone, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getExternalLinkProps } from '@/lib/utils/external-link'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import type { BarbershopSettings } from '@/types/database'

// App version from build - updated by prebuild script
import { APP_VERSION } from '@/lib/version'

// Hidden dev access - tap copyright 5 times within 3 seconds
const DEV_TAP_COUNT = 5
const DEV_TAP_TIMEOUT_MS = 3000

// Social icons
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

/**
 * Compact Footer with safe area handling
 * 
 * Features:
 * - Compact single-column on mobile
 * - Logo + tagline
 * - Essential links only
 * - Social icons row
 * - Safe area padding for bottom nav
 */
export function Footer({ settings }: FooterProps) {
  const router = useRouter()
  const { isAdmin, isLoggedIn: isBarberLoggedIn } = useBarberAuthStore()
  const currentYear = new Date().getFullYear()
  const shopName = settings?.name || 'רם אל ברברשופ'
  
  // Hidden dev access: tap copyright 5 times within 3 seconds
  const [tapCount, setTapCount] = useState(0)
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const handleCopyrightTap = useCallback(() => {
    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current)
    }
    
    const newCount = tapCount + 1
    
    if (newCount >= DEV_TAP_COUNT) {
      // Success! Navigate to dev login
      setTapCount(0)
      router.push('/dev/login')
      return
    }
    
    setTapCount(newCount)
    
    // Reset after timeout
    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0)
    }, DEV_TAP_TIMEOUT_MS)
  }, [tapCount, router])
  const phone = settings?.contact_phone || settings?.phone || '052-384-0981'
  const addressText = settings?.address_text || 'יעקב טהון 13, ירושלים, ישראל'
  const whatsappNumber = settings?.contact_whatsapp || '972523840981'
  const instagramUrl = settings?.social_instagram || 'https://www.instagram.com/ram__el_barber_shop/'
  const facebookUrl = settings?.social_facebook || 'https://www.facebook.com/ramel.leusani'
  
  const showWhatsapp = settings?.show_whatsapp !== false
  const showInstagram = settings?.show_instagram !== false
  const showFacebook = settings?.show_facebook !== false
  const showDebugLink = isBarberLoggedIn && isAdmin

  // Build social links
  const socialLinks = []
  if (showWhatsapp) {
    socialLinks.push({
      name: 'WhatsApp',
      icon: WhatsAppIcon,
      url: `https://wa.me/${whatsappNumber}`,
      hoverColor: 'hover:text-green-400 hover:border-green-400/50',
    })
  }
  if (showInstagram && instagramUrl) {
    socialLinks.push({
      name: 'Instagram',
      icon: InstagramIcon,
      url: instagramUrl,
      hoverColor: 'hover:text-pink-400 hover:border-pink-400/50',
    })
  }
  if (showFacebook && facebookUrl) {
    socialLinks.push({
      name: 'Facebook',
      icon: FacebookIcon,
      url: facebookUrl,
      hoverColor: 'hover:text-blue-400 hover:border-blue-400/50',
    })
  }

  // Format phone for tel: link
  const formattedPhone = phone.replace(/[^0-9+]/g, '')
  const telLink = formattedPhone.startsWith('+') ? formattedPhone : '+972' + formattedPhone.replace(/^0/, '')

  return (
    <footer className="bg-background-darker border-t border-white/5">
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-8 sm:py-10">
        {/* Main footer content - Compact layout */}
        <div className="flex flex-col items-center text-center sm:flex-row sm:text-right sm:items-start sm:justify-between gap-6">
          {/* Logo + Info */}
          <div className="flex flex-col items-center sm:items-start gap-4">
            <Link href="/" className="inline-block">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-accent-gold/30 shadow-gold-sm">
                <Image
                  src="/icon.png"
                  alt={shopName}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
            <div>
              <p className="text-foreground-light font-medium mb-1">{shopName}</p>
              <p className="text-foreground-muted text-sm">מספרה מקצועית בירושלים</p>
            </div>
          </div>

          {/* Quick Info */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-sm">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <MapPin size={14} className="text-accent-gold" />
              <span className="text-foreground-muted">{addressText}</span>
            </div>
            <a 
              href={`tel:${telLink}`}
              className="flex items-center gap-2 justify-center sm:justify-start text-foreground-muted hover:text-accent-gold transition-colors"
            >
              <Phone size={14} className="text-accent-gold" />
              <span dir="ltr">{phone}</span>
            </a>
          </div>

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  {...getExternalLinkProps(social.url)}
                  className={cn(
                    'w-10 h-10 rounded-full bg-white/5 border border-white/10',
                    'flex items-center justify-center text-foreground-muted',
                    'transition-all hover:scale-110',
                    social.hoverColor
                  )}
                  aria-label={social.name}
                >
                  <social.icon />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-foreground-muted">
          {/* Hidden dev access: tap 5 times quickly to access /dev/login */}
          <div className="order-3 sm:order-1 flex flex-col items-center sm:items-start gap-1">
            <button
              onClick={handleCopyrightTap}
              className="cursor-default select-none"
              aria-label="Copyright"
            >
              © {currentYear} {shopName}. כל הזכויות שמורות.
            </button>
            <span className="text-[10px] text-foreground-muted/50 font-mono">
              v{APP_VERSION}
            </span>
          </div>
          
          {/* Legal Links - nowrap to prevent breaking */}
          <div className="order-1 sm:order-2 flex items-start justify-start whitespace-nowrap h-[22px]">
            <Link href="/faq" className="hover:text-accent-gold transition-colors px-1.5">
              שאלות נפוצות
            </Link>
            <span className="text-white/30 mx-1">|</span>
            <Link href="/terms" className="hover:text-accent-gold transition-colors px-1.5">
              תקנון
            </Link>
            <span className="text-white/30 mx-1">|</span>
            <Link href="/privacy-policy" className="hover:text-accent-gold transition-colors px-1.5">
              פרטיות
            </Link>
            <span className="text-white/30 mx-1">|</span>
            <Link href="/accessibility" className="hover:text-accent-gold transition-colors px-1.5">
              נגישות
            </Link>
          </div>
          
          {/* User Links */}
          <div className="order-2 sm:order-3 flex items-center gap-4">
            <Link href="/my-appointments" className="hover:text-accent-gold transition-colors">
              התורים שלי
            </Link>
            <Link href="/profile" className="hover:text-accent-gold transition-colors">
              הפרופיל שלי
            </Link>
            {showDebugLink && (
              <Link 
                href="/debug" 
                className="hover:text-accent-gold transition-colors flex items-center gap-1"
                title="Debug Console"
              >
                <Settings size={12} />
                <span>Debug</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Safe area padding for mobile bottom nav */}
      <div className="h-20 md:h-0 pb-safe" />
    </footer>
  )
}

export default Footer
