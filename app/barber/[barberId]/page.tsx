import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { BookingWizardClient } from '@/components/BookingWizard/BookingWizardClient'
import type { BarberWithWorkDays, Service } from '@/types/database'

interface BarberPageProps {
  params: Promise<{ barberId: string }>
}

export default async function BarberPage({ params }: BarberPageProps) {
  const { barberId } = await params
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
  
  // Fetch services
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true) as { data: Service[] | null }
  
  return (
    <>
      <AppHeader barberImgUrl={barber.img_url || undefined} />
      
      <main className="pt-24 min-h-screen bg-background-dark">
        <BookingWizardClient
          barberId={barberId}
          barber={barber}
          services={services || []}
        />
      </main>
    </>
  )
}

