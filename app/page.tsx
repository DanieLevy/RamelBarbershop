import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/AppHeader'
import { BarberCard } from '@/components/BarberCard'
import { ContactSection } from '@/components/ContactSection'
import { LocationSection } from '@/components/LocationSection'
import { ProductsCarousel } from '@/components/ProductsCarousel'
import { Footer } from '@/components/Footer'
import { SectionDivider } from '@/components/ui/SectionDivider'
import Image from 'next/image'
import type { BarberWithWorkDays, BarbershopSettings, Product } from '@/types/database'

export default async function HomePage() {
  const supabase = await createClient()
  
  // Fetch barbers, settings, and products in parallel for better performance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const [barbersResult, settingsResult, productsResult] = await Promise.all([
    supabase
      .from('users')
      .select('*, work_days(*)')
      .eq('is_barber', true),
    supabase
      .from('barbershop_settings')
      .select('*')
      .single(),
    db
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
  ])
  
  const barbers = barbersResult.data as BarberWithWorkDays[] | null
  const settings = settingsResult.data as BarbershopSettings | null
  const products = productsResult.data as Product[] | null

  return (
    <>
      <AppHeader />
      
      <main className="relative">
        {/* Hero Section - index-header class gets safe-area padding in PWA standalone mode via CSS */}
        <section className="index-header relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden">
          {/* Background with gradient overlay */}
          <div className="absolute inset-0 bg-background-dark">
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-[0.03]">
              <div 
                className="w-full h-full"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />
            </div>
            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-background-dark via-transparent to-background-dark" />
            <div className="absolute inset-0 bg-gradient-to-r from-accent-gold/5 via-transparent to-accent-orange/5" />
          </div>
          
          {/* Top fade overlay for PWA notch blending */}
          <div 
            className="absolute top-0 left-0 right-0 h-32 sm:h-40 pointer-events-none z-[1]"
            style={{
              background: 'linear-gradient(to bottom, #080b0d 0%, #080b0d 30%, transparent 100%)',
            }}
          />
          
          {/* Decorative elements */}
          <div className="absolute top-20 left-4 sm:left-10 opacity-10 animate-float">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-accent-gold">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </div>
          <div className="absolute bottom-40 right-4 sm:right-10 opacity-10 animate-float animation-delay-300">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="currentColor" className="text-accent-gold">
              <path d="M7 5C7 3.89543 7.89543 3 9 3H15C16.1046 3 17 3.89543 17 5V7H18C19.1046 7 20 7.89543 20 9V10C20 11.1046 19.1046 12 18 12H17V19C17 20.1046 16.1046 21 15 21H9C7.89543 21 7 20.1046 7 19V12H6C4.89543 12 4 11.1046 4 10V9C4 7.89543 4.89543 7 6 7H7V5Z"/>
            </svg>
          </div>
          
          {/* Hero content */}
          <div className="relative z-10 text-center px-4 pt-16 pb-8 sm:py-16 max-w-4xl mx-auto">
            {/* Logo with glow */}
            <div className="mb-8 animate-fade-in">
              <div className="relative inline-block">
                <div className="absolute inset-0 rounded-full bg-accent-gold/20 blur-2xl scale-150" />
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 mx-auto rounded-full overflow-hidden border-2 border-accent-gold/40 shadow-gold-lg">
                  <Image
                    src="/icon.png"
                    alt="Ramel Barbershop Logo"
                    width={192}
                    height={192}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
              </div>
            </div>
            
            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground-light mb-4 animate-fade-in-up">
              {settings?.hero_title?.split(' ').map((word, i) => 
                i === 1 ? <span key={i} className="text-gradient-gold">{word}</span> : <span key={i}>{word} </span>
              ) || <>רמאל <span className="text-gradient-gold">ברברשופ</span></>}
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg sm:text-xl md:text-2xl text-foreground-muted mb-6 animate-fade-in-up animation-delay-100">
              {settings?.hero_subtitle || 'חווית טיפוח ייחודית לגבר המודרני'}
            </p>
            
            {/* Decorative line */}
            <div className="flex items-center justify-center gap-4 mb-8 animate-fade-in-up animation-delay-200">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-accent-gold/50" />
              <div className="w-2 h-2 rounded-full bg-accent-gold" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-accent-gold/50" />
            </div>
            
            {/* Description */}
            <p className="text-foreground-muted leading-relaxed text-sm sm:text-base max-w-2xl mx-auto mb-6 sm:mb-8 animate-fade-in-up animation-delay-300">
              {settings?.hero_description || 'רמאל ברברשופ הוא מקום ייחודי במינו, עם תפיסה חדשנית ומקורית של עולם הספא והטיפוח הגברי. אנו מציעים לכם חוויה ייחודית של טיפוח וספא לגברים בלבד, באווירה נעימה ומרגיעה, עם צוות מקצועי ומנוסה.'}
            </p>
            
            {/* CTA Button */}
            <a
              href="#team"
              className="inline-flex items-center gap-2 px-8 py-4 bg-accent-gold text-background-dark font-medium rounded-xl hover:bg-accent-gold/90 transition-all hover:scale-105 shadow-gold animate-fade-in-up animation-delay-400"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
              קבע תור עכשיו
            </a>
          </div>
          
          {/* Scroll indicator - fixed positioning */}
          <div className="w-full flex justify-center absolute bottom-4 sm:bottom-6">
            <div className="animate-bounce">
              <div className="flex flex-col items-center gap-2 text-foreground-muted">
                <span className="text-xs">גלול למטה</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-gold">
                  <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section id="team" className="index-body py-10 sm:py-12 lg:py-16 bg-background-dark">
          <div className="container-mobile">
            <SectionDivider title="הצוות שלנו" className="mb-8" />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 justify-items-center">
              {barbers?.map((barber, index) => (
                <div
                  key={barber.id}
                  className="w-full max-w-sm animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <BarberCard barber={barber} />
                </div>
              ))}
            </div>
            
            {(!barbers || barbers.length === 0) && (
              <div className="text-center py-12">
                <p className="text-foreground-muted">אין ספרים זמינים כרגע</p>
              </div>
            )}
          </div>
        </section>

        {/* Products Section - Only shows if there are products */}
        {products && products.length > 0 && (
          <ProductsCarousel products={products} />
        )}

        {/* Location Section */}
        <LocationSection settings={settings} />

        {/* Contact Section */}
        <ContactSection settings={settings} />
      </main>
      
      <Footer settings={settings} />
    </>
  )
}
