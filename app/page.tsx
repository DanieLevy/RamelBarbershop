import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/AppHeader'
import { HeroSection } from '@/components/home/HeroSection'
import { TeamSection } from '@/components/home/TeamSection'
import { ProductsCarousel } from '@/components/ProductsCarousel'
import { LocationSection } from '@/components/LocationSection'
import { ContactSection } from '@/components/ContactSection'
import { Footer } from '@/components/Footer'
import { UpcomingAppointmentBanner } from '@/components/UpcomingAppointmentBanner'
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
      .eq('is_barber', true)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
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
      
      {/* Upcoming Appointment Banner - Fixed below header for logged-in customers */}
      <div className="fixed top-[calc(var(--safe-area-inset-top,0px)+70px)] sm:top-[calc(var(--safe-area-inset-top,0px)+76px)] left-0 right-0 z-30">
        <UpcomingAppointmentBanner />
      </div>
      
      <main id="main-content" tabIndex={-1} className="relative outline-none">
        {/* Hero Section - Full viewport with animated reveal */}
        <HeroSection 
          title={settings?.hero_title || 'רמאל ברברשופ'}
          subtitle={settings?.hero_subtitle || 'חווית טיפוח ייחודית לגבר המודרני'}
          description={settings?.hero_description || 'מספרה מקצועית בירושלים עם צוות מנוסה ואווירה נעימה. אנו מציעים שירותי תספורת, עיצוב זקן וטיפוח מקצועי.'}
          ctaText="קבע תור עכשיו"
          ctaHref="#team"
        />

        {/* Team Section - Horizontal scroll on mobile, grid on desktop */}
        <TeamSection barbers={barbers} />

        {/* Products Section - Only shows if there are products */}
        {products && products.length > 0 && (
          <ProductsCarousel products={products} />
        )}

        {/* Location Section - Map-first with floating glass card */}
        <LocationSection settings={settings} />

        {/* Contact Section - Unified communication hub */}
        <ContactSection settings={settings} />
      </main>
      
      {/* Footer - Compact with safe area handling */}
      <Footer settings={settings} />
    </>
  )
}
