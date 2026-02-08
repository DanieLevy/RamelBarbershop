import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { WelcomeSection } from '@/components/home/WelcomeSection'
import { TeamSection } from '@/components/home/TeamSection'
import { ProductsCarousel } from '@/components/ProductsCarousel'
import { LocationSection } from '@/components/LocationSection'
import { ContactSection } from '@/components/ContactSection'
import { Footer } from '@/components/Footer'
import { buildBarberProfileUrl } from '@/lib/utils'
import { getCachedShopSettings, getCachedProducts, getCachedBarbers } from '@/lib/data/cached-queries'
import { createAdminClient } from '@/lib/supabase/admin'

// ISR: Revalidate every hour - barber cache has its own tag-based invalidation
// Settings/Products: 10min cache, Barbers: 1 day cache (tag-invalidated on changes)
export const revalidate = 3600

interface HomePageProps {
  searchParams: Promise<{ barber?: string }>
}

/**
 * Homepage with optional barber deep-linking
 *
 * URL patterns supported:
 * - / (normal homepage)
 * - /?barber=ramel (redirects directly to barber's profile page)
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const { barber: barberSlug } = await searchParams

  // If a barber slug is provided, redirect to their profile page
  if (barberSlug) {
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
  }

  // Fetch all data in parallel using cached queries
  const [barbers, settings, products] = await Promise.all([
    getCachedBarbers(),
    getCachedShopSettings(),
    getCachedProducts(),
  ])

  return (
    <>
      <AppHeader />

      <main id="main-content" tabIndex={-1} className="relative outline-none">
        {/* Welcome Section - Compact logo + greeting + inline upcoming appointment */}
        <WelcomeSection
          title={settings?.hero_title || 'רם אל ברברשופ'}
          subtitle={settings?.hero_subtitle || 'חווית טיפוח ייחודית לגבר המודרני'}
        />

        {/* Team Section - Compact cards, vertical on mobile */}
        <TeamSection barbers={barbers} />

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
