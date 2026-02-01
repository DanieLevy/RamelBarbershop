import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { BarberProfileClient } from '@/components/BarberProfile/BarberProfileClient'
import { BarberNotFoundClient } from '@/components/BarberProfile/BarberNotFoundClient'
import { isValidUUID, generateSlugFromEnglishName, getPreferredBarberSlug } from '@/lib/utils'
import type { BarberWithWorkDays, Service, BarbershopSettings, BarberMessage, BarberGalleryImage } from '@/types/database'
import type { Metadata } from 'next'

// Force dynamic rendering - barber data, services, and availability must always be fresh
// This ensures users see real-time availability when booking appointments
export const dynamic = 'force-dynamic'

interface BarberPageProps {
  params: Promise<{ barberId: string }>
}

/**
 * Generate dynamic metadata for barber pages
 * This enables proper Open Graph tags for WhatsApp/social media link previews
 */
export async function generateMetadata({ params }: BarberPageProps): Promise<Metadata> {
  const { barberId } = await params
  const supabase = await createClient()
  const slugLower = barberId.toLowerCase()
  
  // Find barber (same logic as page)
  let barber = null
  const isUuidLookup = isValidUUID(barberId)
  
  if (isUuidLookup) {
    const { data } = await supabase
      .from('users')
      .select('id, fullname, img_url, name_en, username')
      .eq('is_barber', true)
      .eq('id', barberId)
      .single()
    barber = data
  } else {
    const { data: allBarbers } = await supabase
      .from('users')
      .select('id, fullname, img_url, name_en, username')
      .eq('is_barber', true)
    
    if (allBarbers) {
      for (const b of allBarbers) {
        if (b.name_en) {
          const expectedSlug = generateSlugFromEnglishName(b.name_en)
          if (expectedSlug === slugLower) {
            barber = b
            break
          }
        }
      }
      if (!barber) {
        barber = allBarbers.find(b => b.username?.toLowerCase() === slugLower)
      }
    }
  }
  
  const barberName = barber?.fullname || 'ספר'
  const preferredSlug = barber ? getPreferredBarberSlug(barber.name_en, barber.username) : barberId
  const canonicalUrl = `https://ramel-barbershop.netlify.app/barber/${preferredSlug}`
  
  return {
    title: `${barberName} | רמאל ברברשופ`,
    description: `קבע תור אצל ${barberName} ברמאל ברברשופ. שירות מקצועי, תספורות איכותיות.`,
    openGraph: {
      title: `${barberName} | רמאל ברברשופ`,
      description: `קבע תור אצל ${barberName} ברמאל ברברשופ`,
      url: canonicalUrl,
      siteName: 'רמאל ברברשופ',
      locale: 'he_IL',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${barberName} | רמאל ברברשופ`,
      description: `קבע תור אצל ${barberName} ברמאל ברברשופ`,
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
 * - /barber/tamir.shabo (English name slug - preferred, cleanest)
 * - /barber/ndava (legacy username - redirects to English name if available)
 * - /barber/abc123-uuid-456 (UUID - redirects to preferred slug)
 * 
 * Edge cases handled:
 * - Barber not found → 404
 * - Barber disabled (is_active: false) → Shows "unavailable" message with return link
 * - Legacy URL access → Redirects to preferred slug (name_en-based if available)
 */
export default async function BarberPage({ params }: BarberPageProps) {
  const { barberId } = await params
  const supabase = await createClient()
  const slugLower = barberId.toLowerCase()
  
  // Determine lookup strategy
  const isUuidLookup = isValidUUID(barberId)
  
  let barber: BarberWithWorkDays | null = null
  
  if (isUuidLookup) {
    // UUID lookup
    const { data } = await supabase
      .from('users')
      .select('*, work_days(*)')
      .eq('is_barber', true)
      .eq('id', barberId)
      .single()
    barber = data as BarberWithWorkDays | null
  } else {
    // First try: Match by English name-based slug
    // Check if any barber's name_en generates this slug
    const { data: allBarbers } = await supabase
      .from('users')
      .select('*, work_days(*)')
      .eq('is_barber', true)
    
    if (allBarbers) {
      // Look for a barber whose name_en generates this slug
      for (const b of allBarbers) {
        if (b.name_en) {
          const expectedSlug = generateSlugFromEnglishName(b.name_en)
          if (expectedSlug === slugLower) {
            barber = b as BarberWithWorkDays
            break
          }
        }
      }
      
      // Second try: Fall back to username lookup
      if (!barber) {
        barber = allBarbers.find(
          b => b.username?.toLowerCase() === slugLower
        ) as BarberWithWorkDays | null
      }
    }
  }
  
  // Barber not found at all - return 404
  if (!barber) {
    notFound()
  }
  
  // Determine the preferred slug for this barber
  const preferredSlug = getPreferredBarberSlug(barber.name_en, barber.username)
  const currentSlugNormalized = slugLower
  
  // Redirect to preferred slug if not already using it
  // This handles: UUID → slug, old username → new name_en slug
  if (currentSlugNormalized !== preferredSlug.toLowerCase()) {
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
  
  // Fetch remaining data in parallel now that we have a valid barber
  const [servicesResult, shopSettingsResult, barberMessagesResult, galleryResult] = await Promise.all([
    // Barber-specific services
    supabase
      .from('services')
      .select('*')
      .eq('barber_id', barber.id)
      .eq('is_active', true)
      .order('price', { ascending: true }),
    // Barbershop settings
    supabase
      .from('barbershop_settings')
      .select('*')
      .single(),
    // Barber messages
    supabase
      .from('barber_messages')
      .select('*')
      .eq('barber_id', barber.id)
      .eq('is_active', true),
    // Barber gallery images
    supabase
      .from('barber_gallery')
      .select('*')
      .eq('barber_id', barber.id)
      .order('display_order', { ascending: true })
  ])
  
  const services = servicesResult.data as Service[] | null
  const shopSettings = shopSettingsResult.data as BarbershopSettings | null
  const barberMessages = barberMessagesResult.data as BarberMessage[] | null
  const galleryImages = galleryResult.data as BarberGalleryImage[] | null
  
  return (
    <>
      <AppHeader barberImgUrl={barber.img_url || undefined} />
      
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-background-dark outline-none">
        <BarberProfileClient 
          barber={barber} 
          services={services || []} 
          shopSettings={shopSettings}
          barberMessages={barberMessages || []}
          galleryImages={galleryImages || []}
        />
      </main>
    </>
  )
}
