'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Phone, Settings } from 'lucide-react'
import { Button } from '@heroui/react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import type { BarbershopSettings } from '@/types/database'

// App version from build - updated by prebuild script
import { APP_VERSION } from '@/lib/version'

// Hidden dev access - tap copyright 5 times within 3 seconds
const DEV_TAP_COUNT = 5
const DEV_TAP_TIMEOUT_MS = 3000


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
  const showDebugLink = isBarberLoggedIn && isAdmin

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

        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-4 flex flex-col items-center gap-3 text-xs text-foreground-muted">
          {/* Legal + User Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/faq" className="hover:text-accent-gold transition-colors">
              שאלות נפוצות
            </Link>
            <Link href="/terms" className="hover:text-accent-gold transition-colors">
              תקנון
            </Link>
            <Link href="/privacy-policy" className="hover:text-accent-gold transition-colors">
              פרטיות
            </Link>
            <Link href="/accessibility" className="hover:text-accent-gold transition-colors">
              נגישות
            </Link>
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
          
          {/* Copyright + Version */}
          <div className="flex flex-col items-center gap-1">
            <Button
              onPress={handleCopyrightTap}
              variant="ghost"
              className="cursor-default select-none h-auto p-0 min-w-0"
              aria-label="Copyright"
            >
              © {currentYear} {shopName}. כל הזכויות שמורות.
            </Button>
            <span
              className="text-[10px] text-foreground-muted/50 font-mono"
              suppressHydrationWarning
            >
              v{APP_VERSION}
            </span>
          </div>
        </div>
      </div>

      {/* Safe area padding for mobile bottom nav */}
      <div className="h-20 md:h-0 pb-safe" />
    </footer>
  )
}

export default Footer
