'use client'

import { MapPin, Navigation, Car, Clock } from 'lucide-react'
import { SectionContainer, SectionHeader, SectionContent } from './home/SectionContainer'
import { cn } from '@/lib/utils'
import type { BarbershopSettings } from '@/types/database'

// Waze icon
const WazeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M20.54 6.63c-1.62-4.07-6.4-5.85-10.21-4.2-.98.42-1.87 1.01-2.63 1.73C4.5 7.1 3 11.13 4.17 14.73c.35 1.08.91 2.07 1.65 2.93-.23.93-.47 1.93-.71 2.87-.09.36.28.66.59.47 1.03-.6 2.03-1.17 3.05-1.73 1.34.44 2.74.62 4.17.52 5.51-.39 9.55-5.15 9.14-10.46-.11-1.4-.55-2.75-1.27-3.94.1-.25.09-.53-.25-.76zM9 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
  </svg>
)

interface LocationSectionProps {
  settings?: BarbershopSettings | null
}

/**
 * Location Section - Map-first design with floating glass card
 * 
 * Features:
 * - Full-width map as hero
 * - Floating glass card with address and navigation
 * - One-tap navigation buttons with brand colors
 * - Current open/closed status indicator
 * - Parking info
 */
export function LocationSection({ settings }: LocationSectionProps) {
  const addressText = settings?.address_text || 'יעקב טהון 13, ירושלים, ישראל'
  const addressLat = settings?.address_lat || 31.7805713
  const addressLng = settings?.address_lng || 35.1886834
  const wazeLink = settings?.waze_link || `https://waze.com/ul?ll=${addressLat}%2C${addressLng}&navigate=yes&zoom=17`
  const googleMapsLink = settings?.google_maps_link || `https://www.google.com/maps/dir//${addressLat},${addressLng}`

  // Opening hours
  const workStart = settings?.work_hours_start?.slice(0, 5) || '09:00'
  const workEnd = settings?.work_hours_end?.slice(0, 5) || '20:00'
  const openDays = settings?.open_days || ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  
  // Check if currently open
  const now = new Date()
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const currentTime = now.toTimeString().slice(0, 5)
  const isOpen = openDays.includes(currentDay) && currentTime >= workStart && currentTime <= workEnd

  const openWaze = () => window.open(wazeLink, '_blank')
  const openGoogleMaps = () => window.open(googleMapsLink, '_blank')

  // Map embed URL
  const mapEmbedUrl = `https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d13566.520697368585!2d${addressLng}!3d${addressLat}!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1502d74338829eb5%3A0x9a52d98b2c4f2c86!2sRAMEL%20BARBER%20SHOP!5e0!3m2!1siw!2sil!4v1700732215681!5m2!1siw!2sil`

  // Split address
  const addressParts = addressText.split(',').map(s => s.trim())
  const addressLine1 = addressParts[0] || addressText
  const addressLine2 = addressParts.slice(1).join(', ') || ''

  return (
    <SectionContainer variant="dark" animate={true} className="index-location">
      <SectionContent>
        <SectionHeader 
          title="המיקום שלנו" 
          subtitle="מצא אותנו בקלות"
        />
      </SectionContent>

      {/* Map + Floating Card Layout */}
      <div className="relative">
        {/* Full-width Map */}
        <div className="w-full h-[300px] sm:h-[400px] lg:h-[450px] overflow-hidden rounded-2xl mx-4 sm:mx-6 lg:mx-8" style={{ width: 'calc(100% - 2rem)', margin: '0 auto' }}>
          <div className="w-full h-full relative">
            {/* Map iframe */}
            <iframe
              src={mapEmbedUrl}
              width="100%"
              height="100%"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="border-0 w-full h-full rounded-2xl"
              title="מפת מיקום רמאל ברברשופ"
              style={{
                filter: 'grayscale(100%) invert(92%) contrast(90%) brightness(95%)',
              }}
            />
            
            {/* Gradient overlay for depth */}
            <div className="absolute inset-0 pointer-events-none rounded-2xl border border-white/10" />
          </div>
        </div>

        {/* Floating Glass Card - Overlays map on desktop */}
        <div className="relative -mt-20 sm:-mt-24 lg:absolute lg:top-1/2 lg:-translate-y-1/2 lg:right-8 lg:mt-0 px-4 sm:px-6 lg:px-0 z-10">
          <div className={cn(
            'glass-elevated p-5 sm:p-6 max-w-md mx-auto lg:mx-0',
            'border border-white/10 rounded-2xl',
            'shadow-dark-lg'
          )}>
            {/* Address */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                <MapPin size={22} strokeWidth={1.5} className="text-accent-gold" />
              </div>
              <div>
                <h3 className="text-foreground-light font-medium mb-1">כתובת</h3>
                <p className="text-foreground-muted">{addressLine1}</p>
                {addressLine2 && <p className="text-foreground-muted">{addressLine2}</p>}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <Clock size={18} strokeWidth={1.5} className="text-foreground-muted" />
              <div className="flex items-center gap-2">
                <span 
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isOpen 
                      ? 'bg-status-available shadow-[0_0_8px_rgba(34,197,94,0.5)]' 
                      : 'bg-status-offline shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                  )}
                />
                <span className="text-foreground-light text-sm">
                  {isOpen ? 'פתוח עכשיו' : 'סגור עכשיו'}
                </span>
                <span className="text-foreground-muted text-sm">
                  • {workStart} - {workEnd}
                </span>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-col gap-3 mb-4">
              <button
                onClick={openWaze}
                className={cn(
                  'flex items-center justify-center gap-3 w-full py-3.5 px-4',
                  'bg-[#33CCFF]/10 border border-[#33CCFF]/30 text-[#33CCFF]',
                  'rounded-xl font-medium transition-all',
                  'hover:bg-[#33CCFF]/20 hover:scale-[1.02] active:scale-[0.98]'
                )}
              >
                <WazeIcon />
                <span>נווט עם Waze</span>
              </button>
              
              <button
                onClick={openGoogleMaps}
                className={cn(
                  'flex items-center justify-center gap-3 w-full py-3.5 px-4',
                  'bg-accent-gold/10 border border-accent-gold/30 text-accent-gold',
                  'rounded-xl font-medium transition-all',
                  'hover:bg-accent-gold/20 hover:scale-[1.02] active:scale-[0.98]'
                )}
              >
                <Navigation size={20} strokeWidth={1.5} />
                <span>נווט עם Google Maps</span>
              </button>
            </div>

            {/* Parking Info */}
            <div className="flex items-center gap-2 text-foreground-muted text-sm">
              <Car size={16} strokeWidth={1.5} className="text-accent-gold" />
              <span>חניה זמינה ברחוב וחניון סמוך</span>
            </div>
          </div>
        </div>
      </div>
    </SectionContainer>
  )
}

export default LocationSection
