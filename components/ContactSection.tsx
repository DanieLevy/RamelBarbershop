'use client'

import { FaWhatsapp, FaInstagram, FaFacebook, FaPhone, FaClock } from 'react-icons/fa'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { GlassCard } from '@/components/ui/GlassCard'

export function ContactSection() {
  const contacts = [
    {
      name: 'WhatsApp',
      icon: FaWhatsapp,
      url: 'https://wa.me/972523840981',
      color: 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20',
      description: 'שלח הודעה',
    },
    {
      name: 'Instagram',
      icon: FaInstagram,
      url: 'https://www.instagram.com/ram__el_barber_shop/',
      color: 'bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20',
      description: 'עקוב אחרינו',
    },
    {
      name: 'Facebook',
      icon: FaFacebook,
      url: 'https://www.facebook.com/ramel.leusani',
      color: 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20',
      description: 'הצטרף לקהילה',
    },
  ]

  const openPhone = () => {
    window.open('tel:+972523840981', '_self')
  }

  return (
    <section className="index-contact py-16 sm:py-20 lg:py-24 bg-background-dark">
      <div className="container-mobile">
        <SectionTitle className="mb-12">צור קשר</SectionTitle>
        
        <div className="max-w-4xl mx-auto">
          {/* Main contact grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
            {/* Phone card */}
            <GlassCard
              variant="hover"
              className="flex flex-col items-center text-center cursor-pointer"
              onClick={openPhone}
            >
              <div className="w-14 h-14 rounded-full bg-accent-gold/20 flex items-center justify-center mb-4">
                <FaPhone className="w-6 h-6 text-accent-gold" />
              </div>
              <h3 className="text-foreground-light font-medium mb-1">התקשר עכשיו</h3>
              <p className="text-accent-gold text-lg font-medium" dir="ltr">
                052-384-0981
              </p>
            </GlassCard>
            
            {/* Social cards */}
            {contacts.map((contact) => (
              <button
                key={contact.name}
                onClick={() => window.open(contact.url, '_blank')}
                className={`flex flex-col items-center text-center p-4 sm:p-5 lg:p-6 rounded-2xl border transition-all hover:scale-[1.02] ${contact.color}`}
              >
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <contact.icon className="w-7 h-7" />
                </div>
                <h3 className="font-medium mb-1">{contact.name}</h3>
                <p className="text-sm opacity-75">{contact.description}</p>
              </button>
            ))}
          </div>
          
          {/* Opening hours */}
          <GlassCard className="max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center">
                <FaClock className="w-5 h-5 text-accent-gold" />
              </div>
              <h3 className="text-foreground-light font-medium text-lg">שעות פעילות</h3>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-foreground-muted">ראשון - חמישי</span>
                <span className="text-foreground-light font-medium" dir="ltr">09:00 - 20:00</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-foreground-muted">שישי</span>
                <span className="text-foreground-light font-medium" dir="ltr">09:00 - 14:00</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-foreground-muted">שבת</span>
                <span className="text-red-400 font-medium">סגור</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}
