import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { BarberProfileClient } from '@/components/BarberProfile/BarberProfileClient'
import { BarberNotFoundClient } from '@/components/BarberProfile/BarberNotFoundClient'
import { isValidUUID, buildBarberProfileUrl } from '@/lib/utils'
import type { BarberWithWorkDays, Service, BarbershopSettings, BarberMessage } from '@/types/database'

// Force dynamic rendering - barber data, services, and availability must always be fresh
// This ensures users see real-time availability when booking appointments
export const dynamic = 'force-dynamic'

interface BarberPageProps {
  params: Promise<{ barberId: string }>
}

/**
 * Barber profile page - supports both UUID and username (slug) lookups
 * 
 * URL patterns supported:
 * - /barber/ramel (username/slug - preferred, user-friendly)
 * - /barber/abc123-uuid-456 (legacy UUID - redirects to slug)
 * 
 * Edge cases handled:
 * - Barber not found → 404
 * - Barber disabled (is_active: false) → Shows "unavailable" message with return link
 * - UUID access → Redirects to slug URL for better SEO and UX
 */
export default async function BarberPage({ params }: BarberPageProps) {
  const { barberId } = await params
  const supabase = await createClient()
  
  // Determine if this is a UUID or slug lookup
  const isUuidLookup = isValidUUID(barberId)
  
  // Fetch barber by UUID or username (slug)
  let barberQuery = supabase
    .from('users')
    .select('*, work_days(*)')
    .eq('is_barber', true)
  
  if (isUuidLookup) {
    barberQuery = barberQuery.eq('id', barberId)
  } else {
    // Lookup by username (case-insensitive)
    barberQuery = barberQuery.ilike('username', barberId)
  }
  
  const barberResult = await barberQuery.single()
  const barber = barberResult.data as BarberWithWorkDays | null
  
  // Barber not found at all - return 404
  if (barberResult.error || !barber) {
    notFound()
  }
  
  // If accessed via UUID, redirect to slug-based URL for better UX/SEO
  if (isUuidLookup && barber.username) {
    redirect(buildBarberProfileUrl(barber.username))
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
  const [servicesResult, shopSettingsResult, barberMessagesResult] = await Promise.all([
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
      .eq('is_active', true)
  ])
  
  const services = servicesResult.data as Service[] | null
  const shopSettings = shopSettingsResult.data as BarbershopSettings | null
  const barberMessages = barberMessagesResult.data as BarberMessage[] | null
  
  return (
    <>
      <AppHeader barberImgUrl={barber.img_url || undefined} />
      
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-background-dark outline-none">
        <BarberProfileClient 
          barber={barber} 
          services={services || []} 
          shopSettings={shopSettings}
          barberMessages={barberMessages || []}
        />
      </main>
    </>
  )
}
