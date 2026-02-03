import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { HeroSection } from '@/components/home/HeroSection'
import { TeamSection } from '@/components/home/TeamSection'
import { ProductsCarousel } from '@/components/ProductsCarousel'
import { LocationSection } from '@/components/LocationSection'
import { ContactSection } from '@/components/ContactSection'
import { Footer } from '@/components/Footer'
import { UpcomingAppointmentBanner } from '@/components/UpcomingAppointmentBanner'
import { buildBarberProfileUrl } from '@/lib/utils'
import { getCachedShopSettings, getCachedProducts } from '@/lib/data/cached-queries'
import type { BarberWithWorkDays } from '@/types/database'

// Force dynamic rendering - barber availability (work_days, is_active) must be fresh
// This ensures the homepage always shows current barber status
// Note: Products and shop settings are cached separately for 10 minutes
export const dynamic = 'force-dynamic'

interface HomePageProps {
  searchParams: Promise<{ barber?: string }>
}

/**
 * Homepage with optional barber deep-linking
 * 
 * URL patterns supported:
 * - / (normal homepage)
 * - /?barber=ramel (redirects directly to barber's profile page)
 * 
 * This allows barbers to share a simple link that takes customers
 * directly to their profile for booking.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const { barber: barberSlug } = await searchParams
  const supabase = await createClient()
  
  // If a barber slug is provided, redirect to their profile page
  if (barberSlug) {
    // Verify the barber exists and is active before redirecting
    const { data: barberCheck } = await supabase
      .from('users')
      .select('username, is_active')
      .eq('is_barber', true)
      .ilike('username', barberSlug)
      .single()
    
    if (barberCheck?.is_active && barberCheck.username) {
      redirect(buildBarberProfileUrl(barberCheck.username))
    }
    // If barber not found or inactive, continue to show homepage
    // (don't redirect to error page from homepage link)
  }
  
  // Fetch data in parallel for better performance
  // - Barbers: ALWAYS fresh (real-time availability)
  // - Settings: Cached for 10 minutes (rarely changes)
  // - Products: Cached for 10 minutes (rarely changes)
  const [barbersResult, settings, products] = await Promise.all([
    // Barbers - always fresh from database
    supabase
      .from('users')
      .select('*, work_days(*)')
      .eq('is_barber', true)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    // Settings - cached for 10 minutes
    getCachedShopSettings(),
    // Products - cached for 10 minutes
    getCachedProducts()
  ])
  
  const barbers = barbersResult.data as BarberWithWorkDays[] | null

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
          title={settings?.hero_title || 'רם אל ברברשופ'}
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
