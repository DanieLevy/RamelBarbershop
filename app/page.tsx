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
import { getCachedShopSettings, getCachedProducts, getCachedBarbers } from '@/lib/data/cached-queries'
import { createAdminClient } from '@/lib/supabase/admin'

// ISR: Revalidate every 30 seconds for near-real-time barber availability
// All data queries use unstable_cache with their own TTLs:
// - Barbers: 30s cache (short for near-real-time availability)
// - Settings: 10min cache (rarely changes)
// - Products: 10min cache (rarely changes)
// This replaces force-dynamic for significantly faster page loads
export const revalidate = 30

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
  
  // If a barber slug is provided, redirect to their profile page
  if (barberSlug) {
    // Use admin client for slug lookup (no cookies needed for redirect check)
    const supabase = createAdminClient()
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
  
  // Fetch all data in parallel using cached queries
  // - Barbers: 30s cache (near-real-time availability)
  // - Settings: 10min cache (rarely changes)
  // - Products: 10min cache (rarely changes)
  const [barbers, settings, products] = await Promise.all([
    getCachedBarbers(),
    getCachedShopSettings(),
    getCachedProducts()
  ])

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
