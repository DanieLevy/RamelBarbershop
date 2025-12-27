'use client'

import { MapPin, Navigation } from 'lucide-react'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { GlassCard } from '@/components/ui/GlassCard'

// Custom Waze icon (Lucide doesn't have brand icons)
const WazeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M20.54 6.63c-1.62-4.07-6.4-5.85-10.21-4.2-.98.42-1.87 1.01-2.63 1.73C4.5 7.1 3 11.13 4.17 14.73c.35 1.08.91 2.07 1.65 2.93-.23.93-.47 1.93-.71 2.87-.09.36.28.66.59.47 1.03-.6 2.03-1.17 3.05-1.73 1.34.44 2.74.62 4.17.52 5.51-.39 9.55-5.15 9.14-10.46-.11-1.4-.55-2.75-1.27-3.94.1-.25.09-.53-.25-.76zM9 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
  </svg>
)

export function LocationSection() {
  const openWaze = () => {
    window.open('https://waze.com/ul?ll=31.7805713%2C35.1886834&navigate=yes&zoom=17', '_blank')
  }

  const openGoogleMaps = () => {
    window.open('https://www.google.com/maps/dir//RAMEL+BARBER+SHOP,+%D7%91%D7%99%D7%AA+%D7%94%D7%9B%D7%A8%D7%9D+30,+%D7%99%D7%A8%D7%95%D7%A9%D7%9C%D7%99%D7%9D/@31.7805713,35.1886834,17z/', '_blank')
  }

  return (
    <section className="index-location py-16 sm:py-20 lg:py-24 bg-background-darker">
      <div className="container-mobile">
        <SectionTitle className="mb-12">המיקום שלנו</SectionTitle>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Address Card */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <GlassCard className="h-full flex flex-col justify-center">
              {/* Address */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} strokeWidth={1.5} className="text-accent-gold" />
                </div>
                <div>
                  <h3 className="text-foreground-light font-medium mb-1">כתובת</h3>
                  <p className="text-foreground-muted">בית הכרם 30</p>
                  <p className="text-foreground-muted">כיכר דניה, ירושלים</p>
                </div>
              </div>
              
              {/* Navigation buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={openWaze}
                  className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-[#33CCFF]/10 border border-[#33CCFF]/30 text-[#33CCFF] rounded-xl font-medium transition-all hover:bg-[#33CCFF]/20 hover:scale-[1.02]"
                >
                  <WazeIcon />
                  <span>נווט עם Waze</span>
                </button>
                
                <button
                  onClick={openGoogleMaps}
                  className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold rounded-xl font-medium transition-all hover:bg-accent-gold/20 hover:scale-[1.02]"
                >
                  <Navigation size={20} strokeWidth={1.5} />
                  <span>נווט עם Google Maps</span>
                </button>
              </div>
              
              {/* Parking info */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-foreground-muted text-sm">
                  🅿️ חניה זמינה ברחוב וחניון סמוך
                </p>
              </div>
            </GlassCard>
          </div>
          
          {/* Map */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <GlassCard padding="none" className="overflow-hidden h-[300px] sm:h-[350px] lg:h-full min-h-[300px]">
              <div className="w-full h-full map-dark">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d13566.520697368585!2d35.1886834!3d31.7805713!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1502d74338829eb5%3A0x9a52d98b2c4f2c86!2sRAMEL%20BARBER%20SHOP!5e0!3m2!1siw!2sil!4v1700732215681!5m2!1siw!2sil"
                  width="100%"
                  height="100%"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="border-0 w-full h-full"
                  title="מפת מיקום רמאל ברברשופ"
                />
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  )
}
