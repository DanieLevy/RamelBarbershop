import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/AppHeader'
import { BarberCard } from '@/components/BarberCard'
import { ContactSection } from '@/components/ContactSection'
import { LocationSection } from '@/components/LocationSection'
import type { BarberWithWorkDays } from '@/types/database'

export default async function HomePage() {
  const supabase = await createClient()
  
  // Fetch barbers with their work days
  const { data: barbers } = await supabase
    .from('users')
    .select('*, work_days(*)')
    .eq('is_barber', true) as { data: BarberWithWorkDays[] | null }

  return (
    <>
      <AppHeader />
      
      <main className="relative top-20">
        {/* Hero Section */}
        <section
          className="index-header relative min-h-[calc(100vh-80px)] w-full flex justify-center items-center bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/img/img1.jpg)' }}
        >
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/85 z-0" />
          
          {/* About content */}
          <div className="relative z-10 text-center px-4 md:px-[20vw] py-12">
            <p className="text-foreground-light leading-relaxed text-base md:text-lg">
              רמאל ברברשופ הוא מקום ייחודי במינו, עם תפיסה חדשנית ומקורית של עולם הספא והטיפוח הגברי.
              ברברשופ מציעים לכם חוויה ייחודית של טיפוח וספא לגברים בלבד,
              באווירה נעימה ומרגיעה, עם צוות מקצועי ומנוסה שידאג לכם לחוויה מושלמת ומרגיעה.
              זו לא חוויה של פעם בחיים, לגבר קלאסי כמוך – זו דרך חיים.
              בנוסף תוכלו לרכוש מוצרי פרורסו, ראוזל ודפר דן אצלנו במספרה:
            </p>
            <div className="mt-6">
              <img
                src="https://iili.io/JouEOas.th.jpg"
                alt="Products"
                className="w-12 h-12 rounded-full mx-auto"
              />
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="index-body py-12">
          <div className="content-style px-4 md:px-[10vw] py-8">
            <h1 className="text-white">הצוות שלנו</h1>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-5 px-4 py-5">
            {barbers?.map((barber) => (
              <BarberCard key={barber.id} barber={barber} />
            ))}
          </div>
        </section>

        {/* Location Section */}
        <LocationSection />

        {/* Contact Section */}
        <ContactSection />
      </main>
    </>
  )
}

