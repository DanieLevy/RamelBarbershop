import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { BookingWizardClient } from '@/components/BookingWizard/BookingWizardClient'
import { BarberNotFoundClient } from '@/components/BarberProfile/BarberNotFoundClient'
import { isValidUUID, generateSlugFromEnglishName, getPreferredBarberSlug } from '@/lib/utils'
import type { BarberWithWorkDays, Service, BarbershopSettings, BarbershopClosure, BarberSchedule, BarberClosure, BarberMessage } from '@/types/database'

interface BookPageProps {
  params: Promise<{ barberId: string }>
  searchParams: Promise<{ service?: string }>
}

/**
 * Booking wizard page - supports UUID, username, and English name slugs
 * 
 * URL patterns supported (in priority order):
 * - /barber/tamir.shabo/book (English name slug - preferred)
 * - /barber/ndava/book (legacy username - redirects to English name if available)
 * - /barber/abc123-uuid/book (UUID - redirects to preferred slug)
 */
export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { barberId } = await params
  const { service: preSelectedServiceId } = await searchParams
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
  if (currentSlugNormalized !== preferredSlug.toLowerCase()) {
    const redirectUrl = preSelectedServiceId
      ? `/barber/${preferredSlug}/book?service=${encodeURIComponent(preSelectedServiceId)}`
      : `/barber/${preferredSlug}/book`
    redirect(redirectUrl)
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
  
  // Format today's date in LOCAL timezone (not UTC!) for closure filtering
  // toISOString() uses UTC which can cause off-by-one errors
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  
  // Fetch remaining data in parallel now that we have a valid barber
  const [
    servicesResult,
    shopSettingsResult,
    shopClosuresResult,
    barberScheduleResult,
    barberClosuresResult,
    barberMessagesResult
  ] = await Promise.all([
    // Barber-specific services
    supabase
      .from('services')
      .select('*')
      .eq('barber_id', barber.id)
      .eq('is_active', true),
    // Barbershop settings
    supabase
      .from('barbershop_settings')
      .select('*')
      .single(),
    // Barbershop closures
    supabase
      .from('barbershop_closures')
      .select('*')
      .gte('end_date', todayStr),
    // Barber schedule
    supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', barber.id)
      .single(),
    // Barber closures
    supabase
      .from('barber_closures')
      .select('*')
      .eq('barber_id', barber.id)
      .gte('end_date', todayStr),
    // Barber messages
    supabase
      .from('barber_messages')
      .select('*')
      .eq('barber_id', barber.id)
      .eq('is_active', true)
  ])
  
  const services = servicesResult.data as Service[] | null
  const shopSettings = shopSettingsResult.data as BarbershopSettings | null
  const shopClosures = shopClosuresResult.data as BarbershopClosure[] | null
  const barberSchedule = barberScheduleResult.data as BarberSchedule | null
  const barberClosures = barberClosuresResult.data as BarberClosure[] | null
  const barberMessages = barberMessagesResult.data as BarberMessage[] | null
  
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
          services={services || []}
          shopSettings={shopSettings}
          shopClosures={shopClosures || []}
          barberSchedule={barberSchedule}
          barberClosures={barberClosures || []}
          barberMessages={barberMessages || []}
          preSelectedServiceId={preSelectedServiceId}
        />
      </main>
    </>
  )
}

