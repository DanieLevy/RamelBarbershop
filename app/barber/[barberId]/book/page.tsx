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
  
  // Fetch barber data
  const { data: barber, error: barberError } = await supabase
    .from('users')
    .select('*, work_days(*)')
    .eq('id', barberId)
    .eq('is_barber', true)
    .single() as { data: BarberWithWorkDays | null; error: unknown }
  
  if (barberError || !barber) {
    notFound()
  }
  
  // Fetch barber-specific services
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('barber_id', barberId)
    .eq('is_active', true) as { data: Service[] | null }
  
  // Fetch barbershop settings
  const { data: shopSettings } = await supabase
    .from('barbershop_settings')
    .select('*')
    .single() as { data: BarbershopSettings | null }
  
  // Fetch barbershop closures
  const { data: shopClosures } = await supabase
    .from('barbershop_closures')
    .select('*')
    .gte('end_date', new Date().toISOString().split('T')[0]) as { data: BarbershopClosure[] | null }
  
  // Fetch barber schedule
  const { data: barberSchedule } = await supabase
    .from('barber_schedules')
    .select('*')
    .eq('barber_id', barberId)
    .single() as { data: BarberSchedule | null }
  
  // Fetch barber closures
  const { data: barberClosures } = await supabase
    .from('barber_closures')
    .select('*')
    .eq('barber_id', barberId)
    .gte('end_date', new Date().toISOString().split('T')[0]) as { data: BarberClosure[] | null }
  
  // Fetch barber messages
  const { data: barberMessages } = await supabase
    .from('barber_messages')
    .select('*')
    .eq('barber_id', barberId)
    .eq('is_active', true) as { data: BarberMessage[] | null }
  
  return (
    <>
      <AppHeader barberImgUrl={barber.img_url || undefined} isWizardPage />
      
      {/* Main content - safe area handled via CSS variable */}
      <main 
        className="min-h-screen bg-background-dark pb-24"
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

