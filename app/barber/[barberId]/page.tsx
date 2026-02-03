import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { BarberProfileClient } from '@/components/BarberProfile/BarberProfileClient'
import { BarberNotFoundClient } from '@/components/BarberProfile/BarberNotFoundClient'
import { isValidUUID, generateSlugFromEnglishName, getPreferredBarberSlug } from '@/lib/utils'
import { getCachedShopSettings } from '@/lib/data/cached-queries'
import type { User, Service, BarbershopSettings, BarberMessage, BarberGalleryImage, WorkDay } from '@/types/database'
import type { Metadata } from 'next'

// Force dynamic rendering - barber data, services, and availability must always be fresh
// This ensures users see real-time availability when booking appointments
export const dynamic = 'force-dynamic'

interface BarberPageProps {
  params: Promise<{ barberId: string }>
}

/**
 * Extended barber type with nested related data from single query
 * Extends User to include all base fields plus nested relations
 */
interface BarberWithAllData extends User {
  // Nested relations from single query
  work_days: WorkDay[]
  services: Service[]
  barber_messages: BarberMessage[]
  barber_gallery: BarberGalleryImage[]
}

/**
 * Fetch barber with ALL related data in ONE query
 * Uses React cache() for per-request deduplication (NOT persistent caching)
 * 
 * This is called by both generateMetadata() and the page component,
 * but React ensures only ONE database call per request.
 */
const getBarberWithAllData = cache(async (slug: string): Promise<{
  barber: BarberWithAllData | null
  shopSettings: BarbershopSettings | null
}> => {
  const supabase = await createClient()
  const slugLower = slug.toLowerCase()
  const isUuidLookup = isValidUUID(slug)
  
  let barber: BarberWithAllData | null = null
  
  // Single consolidated query with nested selects
  // Fetches: barber + work_days + services + messages + gallery in ONE request
  const selectQuery = `
    *,
    work_days(*),
    services(*),
    barber_messages(*),
    barber_gallery(*)
  `
  
  if (isUuidLookup) {
    // UUID lookup - direct query
    const { data } = await supabase
      .from('users')
      .select(selectQuery)
      .eq('is_barber', true)
      .eq('id', slug)
      .single()
    barber = data as BarberWithAllData | null
  } else {
    // Slug/username lookup - need to check all barbers
    const { data: allBarbers } = await supabase
      .from('users')
      .select(selectQuery)
      .eq('is_barber', true)
    
    if (allBarbers) {
      // First try: Match by English name-based slug
      for (const b of allBarbers) {
        if (b.name_en) {
          const expectedSlug = generateSlugFromEnglishName(b.name_en)
          if (expectedSlug === slugLower) {
            barber = b as BarberWithAllData
            break
          }
        }
      }
      
      // Second try: Fall back to username lookup
      if (!barber) {
        barber = (allBarbers.find(
          b => b.username?.toLowerCase() === slugLower
        ) as BarberWithAllData) || null
      }
    }
  }
  
  // Fetch shop settings from cache (10 minute revalidation)
  // Shop settings rarely change and don't affect booking availability
  const shopSettings = await getCachedShopSettings()
  
  return {
    barber,
    shopSettings
  }
})

/**
 * Generate dynamic metadata for barber pages
 * This enables proper Open Graph tags for WhatsApp/social media link previews
 * 
 * Uses the same cached getBarberWithAllData() - no duplicate DB calls
 */
export async function generateMetadata({ params }: BarberPageProps): Promise<Metadata> {
  const { barberId } = await params
  const { barber } = await getBarberWithAllData(barberId)
  
  const barberName = barber?.fullname || 'ספר'
  const preferredSlug = barber ? getPreferredBarberSlug(barber.name_en, barber.username || barberId) : barberId
  const canonicalUrl = `https://ramel-barbershop.netlify.app/barber/${preferredSlug}`
  
  return {
    title: `${barberName} | רם אל ברברשופ`,
    description: `קבע תור אצל ${barberName} ברם אל ברברשופ. שירות מקצועי, תספורות איכותיות.`,
    openGraph: {
      title: `${barberName} | רם אל ברברשופ`,
      description: `קבע תור אצל ${barberName} ברם אל ברברשופ`,
      url: canonicalUrl,
      siteName: 'רם אל ברברשופ',
      locale: 'he_IL',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${barberName} | רם אל ברברשופ`,
      description: `קבע תור אצל ${barberName} ברם אל ברברשופ`,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  }
}

/**
 * Barber profile page - supports UUID, username, and English name slugs
 * 
 * URL patterns supported (in priority order):
 * - /barber/david.cohen (English name slug - preferred, cleanest)
 * - /barber/ndava (legacy username - redirects to English name if available)
 * - /barber/abc123-uuid-456 (UUID - redirects to preferred slug)
 * 
 * Edge cases handled:
 * - Barber not found → 404
 * - Barber disabled (is_active: false) → Shows "unavailable" message with return link
 * - Legacy URL access → Redirects to preferred slug (name_en-based if available)
 * 
 * OPTIMIZATION: Uses React cache() to share data with generateMetadata()
 * All barber data (work_days, services, messages, gallery) fetched in ONE query
 */
export default async function BarberPage({ params }: BarberPageProps) {
  const { barberId } = await params
  const slugLower = barberId.toLowerCase()
  
  // Get all barber data from cached function (deduped with generateMetadata)
  const { barber, shopSettings } = await getBarberWithAllData(barberId)
  
  // Barber not found at all - return 404
  if (!barber) {
    notFound()
  }
  
  // Determine the preferred slug for this barber
  const preferredSlug = getPreferredBarberSlug(barber.name_en, barber.username || barberId)
  
  // Redirect to preferred slug if not already using it
  // This handles: UUID → slug, old username → new name_en slug
  if (slugLower !== preferredSlug.toLowerCase()) {
    redirect(`/barber/${preferredSlug}`)
  }
  
  // Barber exists but is disabled - show friendly message
  if (!barber.is_active) {
    return (
      <>
        <AppHeader />
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-background-dark outline-none">
          <BarberNotFoundClient 
            barberName={barber.fullname}
            reason="disabled"
          />
        </main>
      </>
    )
  }
  
  // Filter and sort nested data (Supabase nested selects don't support inline filters)
  const activeServices = (barber.services || [])
    .filter(s => s.is_active)
    .sort((a, b) => Number(a.price) - Number(b.price))
  
  const activeMessages = (barber.barber_messages || [])
    .filter(m => m.is_active)
  
  const sortedGallery = (barber.barber_gallery || [])
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  
  // Convert to BarberWithWorkDays format for client component
  const barberForClient = {
    ...barber,
    work_days: barber.work_days || []
  }
  
  return (
    <>
      <AppHeader barberImgUrl={barber.img_url || undefined} />
      
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-background-dark outline-none">
        <BarberProfileClient 
          barber={barberForClient} 
          services={activeServices} 
          shopSettings={shopSettings}
          barberMessages={activeMessages}
          galleryImages={sortedGallery}
        />
      </main>
    </>
  )
}
