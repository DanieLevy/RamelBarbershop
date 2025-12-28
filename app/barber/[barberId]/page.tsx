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
  
  // Fetch barber data with work days
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
    .eq('is_active', true)
    .order('price', { ascending: true }) as { data: Service[] | null }
  
  // Fetch barbershop settings
  const { data: shopSettings } = await supabase
    .from('barbershop_settings')
    .select('*')
    .single() as { data: BarbershopSettings | null }
  
  // Fetch barber messages
  const { data: barberMessages } = await supabase
    .from('barber_messages')
    .select('*')
    .eq('barber_id', barberId)
    .eq('is_active', true) as { data: BarberMessage[] | null }
  
  return (
    <>
      <AppHeader barberImgUrl={barber.img_url || undefined} />
      
      <main className="min-h-screen bg-background-dark">
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
