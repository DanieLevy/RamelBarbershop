import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { BookingWizardClient } from '@/components/BookingWizard/BookingWizardClient'
import type { BarberWithWorkDays, Service, BarbershopSettings, BarbershopClosure, BarberSchedule, BarberClosure, BarberMessage } from '@/types/database'

interface BookPageProps {
  params: Promise<{ barberId: string }>
  searchParams: Promise<{ service?: string }>
}

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { barberId } = await params
  const { service: preSelectedServiceId } = await searchParams
  const supabase = await createClient()
  const todayStr = new Date().toISOString().split('T')[0]
  
  // Fetch all data in parallel for optimal performance
  const [
    barberResult,
    servicesResult,
    shopSettingsResult,
    shopClosuresResult,
    barberScheduleResult,
    barberClosuresResult,
    barberMessagesResult
  ] = await Promise.all([
    // Barber data with work days
    supabase
      .from('users')
      .select('*, work_days(*)')
      .eq('id', barberId)
      .eq('is_barber', true)
      .single(),
    // Barber-specific services
    supabase
      .from('services')
      .select('*')
      .eq('barber_id', barberId)
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
      .eq('barber_id', barberId)
      .single(),
    // Barber closures
    supabase
      .from('barber_closures')
      .select('*')
      .eq('barber_id', barberId)
      .gte('end_date', todayStr),
    // Barber messages
    supabase
      .from('barber_messages')
      .select('*')
      .eq('barber_id', barberId)
      .eq('is_active', true)
  ])
  
  const barber = barberResult.data as BarberWithWorkDays | null
  if (barberResult.error || !barber) {
    notFound()
  }
  
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
          barberId={barberId}
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

