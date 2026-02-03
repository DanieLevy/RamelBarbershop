import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { BookingWizardClient } from '@/components/BookingWizard/BookingWizardClient'
import { BarberNotFoundClient } from '@/components/BarberProfile/BarberNotFoundClient'
import { isValidUUID, generateSlugFromEnglishName, getPreferredBarberSlug } from '@/lib/utils'
import { getCachedShopSettings } from '@/lib/data/cached-queries'
import type { User, BarberWithWorkDays, Service, BarbershopClosure, BarberClosure, BarberMessage, BarberBookingSettings, WorkDay } from '@/types/database'

interface BookPageProps {
  params: Promise<{ barberId: string }>
  searchParams: Promise<{ service?: string }>
}

/**
 * Extended barber type with nested relations for booking
 * Note: barber_booking_settings is a single object due to unique constraint on barber_id
 */
interface BarberWithBookingData extends User {
  work_days: WorkDay[]
  services: Service[]
  barber_messages: BarberMessage[]
  barber_booking_settings: BarberBookingSettings | null
}

/**
 * Fetch barber with booking-related data in ONE query
 * Uses React cache() for per-request deduplication
 */
const getBarberWithBookingData = cache(async (slug: string): Promise<BarberWithBookingData | null> => {
  const supabase = await createClient()
  const slugLower = slug.toLowerCase()
  const isUuidLookup = isValidUUID(slug)
  
  // Combined query with nested selects for booking-related data
  const selectQuery = `
    *,
    work_days(*),
    services(*),
    barber_messages(*),
    barber_booking_settings(*)
  `
  
  if (isUuidLookup) {
    const { data } = await supabase
      .from('users')
      .select(selectQuery)
      .eq('is_barber', true)
      .eq('id', slug)
      .single()
    return data as BarberWithBookingData | null
  }
  
  // Slug/username lookup
  const { data: allBarbers } = await supabase
    .from('users')
    .select(selectQuery)
    .eq('is_barber', true)
  
  if (!allBarbers) return null
  
  // First try: Match by English name-based slug
  for (const b of allBarbers) {
    if (b.name_en) {
      const expectedSlug = generateSlugFromEnglishName(b.name_en)
      if (expectedSlug === slugLower) {
        return b as BarberWithBookingData
      }
    }
  }
  
  // Second try: Fall back to username lookup
  return (allBarbers.find(
    b => b.username?.toLowerCase() === slugLower
  ) as BarberWithBookingData) || null
})

/**
 * Booking wizard page - supports UUID, username, and English name slugs
 * 
 * URL patterns supported (in priority order):
 * - /barber/david.cohen/book (English name slug - preferred)
 * - /barber/ndava/book (legacy username - redirects to English name if available)
 * - /barber/abc123-uuid/book (UUID - redirects to preferred slug)
 */
export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { barberId } = await params
  const { service: preSelectedServiceId } = await searchParams
  const slugLower = barberId.toLowerCase()
  
  // Get barber with all booking-related data in ONE query
  const barberWithData = await getBarberWithBookingData(barberId)
  
  // Barber not found at all - return 404
  if (!barberWithData) {
    notFound()
  }
  
  // Determine the preferred slug for this barber
  const preferredSlug = getPreferredBarberSlug(barberWithData.name_en ?? undefined, barberWithData.username || barberId)
  
  // Redirect to preferred slug if not already using it
  if (slugLower !== preferredSlug.toLowerCase()) {
    const redirectUrl = preSelectedServiceId
      ? `/barber/${preferredSlug}/book?service=${encodeURIComponent(preSelectedServiceId)}`
      : `/barber/${preferredSlug}/book`
    redirect(redirectUrl)
  }
  
  // Barber exists but is disabled - show friendly message
  if (!barberWithData.is_active) {
    return (
      <>
        <AppHeader />
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-background-dark outline-none">
          <BarberNotFoundClient 
            barberName={barberWithData.fullname}
            reason="disabled"
          />
        </main>
      </>
    )
  }
  
  // Format today's date in LOCAL timezone (not UTC!) for closure filtering
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  
  // Fetch closures and cached shop settings in parallel
  // Note: closures must be fresh (date-specific), shop settings can be cached
  const supabase = await createClient()
  const [shopSettings, shopClosuresResult, barberClosuresResult] = await Promise.all([
    // Shop settings - cached for 10 minutes
    getCachedShopSettings(),
    // Barbershop closures - must be fresh (date-filtered)
    supabase
      .from('barbershop_closures')
      .select('*')
      .gte('end_date', todayStr),
    // Barber closures - must be fresh (date-filtered)
    supabase
      .from('barber_closures')
      .select('*')
      .eq('barber_id', barberWithData.id)
      .gte('end_date', todayStr)
  ])
  
  const shopClosures = shopClosuresResult.data as BarbershopClosure[] | null
  const barberClosures = barberClosuresResult.data as BarberClosure[] | null
  
  // Extract and filter nested data
  const activeServices = (barberWithData.services || []).filter(s => s.is_active)
  const activeMessages = (barberWithData.barber_messages || []).filter(m => m.is_active)
  // barber_booking_settings is a single object (unique constraint on barber_id)
  const barberBookingSettings = barberWithData.barber_booking_settings || null
  
  // Create BarberWithWorkDays for the client component
  const barber: BarberWithWorkDays = {
    ...barberWithData,
    work_days: barberWithData.work_days || []
  }
  
  return (
    <>
      <AppHeader barberImgUrl={barber.img_url || undefined} isWizardPage />
      
      {/* Main content - safe area handled via CSS variable */}
      <main 
        id="main-content"
        tabIndex={-1}
        className="min-h-screen bg-background-dark pb-24 outline-none"
        style={{
          // Account for header + safe area
          paddingTop: 'calc(var(--header-top-offset, 0px) + 4rem)',
        }}
      >
        <BookingWizardClient
          barberId={barber.id}
          barber={barber}
          services={activeServices}
          shopSettings={shopSettings}
          shopClosures={shopClosures || []}
          barberClosures={barberClosures || []}
          barberMessages={activeMessages}
          barberBookingSettings={barberBookingSettings}
          preSelectedServiceId={preSelectedServiceId}
        />
      </main>
    </>
  )
}

