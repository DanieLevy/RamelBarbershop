import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { BarberProfileClient } from '@/components/BarberProfile/BarberProfileClient'
import type { BarberWithWorkDays, Service, BarbershopSettings, BarberMessage } from '@/types/database'

interface BarberPageProps {
  params: Promise<{ barberId: string }>
}

export default async function BarberPage({ params }: BarberPageProps) {
  const { barberId } = await params
  const supabase = await createClient()
  
  // Fetch all data in parallel for optimal performance
  const [barberResult, servicesResult, shopSettingsResult, barberMessagesResult] = await Promise.all([
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
      .eq('barber_id', barberId)
      .eq('is_active', true)
  ])
  
  const barber = barberResult.data as BarberWithWorkDays | null
  // Block access if barber not found or is paused/inactive
  if (barberResult.error || !barber || !barber.is_active) {
    notFound()
  }
  
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
