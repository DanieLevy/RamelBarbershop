'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FaWhatsapp, FaInstagram, FaFacebook, FaPhone, FaMapMarkerAlt, FaClock } from 'react-icons/fa'

export function Footer() {
  const currentYear = new Date().getFullYear()

  const socialLinks = [
    {
      name: 'WhatsApp',
      icon: FaWhatsapp,
      url: 'https://wa.me/972523840981',
      color: 'hover:text-green-400',
    },
    {
      name: 'Instagram',
      icon: FaInstagram,
      url: 'https://www.instagram.com/ram__el_barber_shop/',
      color: 'hover:text-pink-400',
    },
    {
      name: 'Facebook',
      icon: FaFacebook,
      url: 'https://www.facebook.com/ramel.leusani',
      color: 'hover:text-blue-400',
    },
  ]

  return (
    <footer className="bg-background-darker border-t border-white/10">
      {/* Main footer content */}
      <div className="container-mobile py-10 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Logo and description */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border border-accent-gold/30 shadow-gold-sm">
                <Image
                  src="/icon.png"
                  alt="Ramel Barbershop"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>
            <p className="text-foreground-muted text-sm leading-relaxed">
              רמאל ברברשופ - מספרה מקצועית בירושלים.
              <br />
              חוויית טיפוח ייחודית לגבר המודרני.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-foreground-light font-medium mb-4">קישורים מהירים</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-foreground-muted hover:text-accent-gold transition-colors text-sm"
                >
                  דף הבית
                </Link>
              </li>
              <li>
                <Link
                  href="/#index-body"
                  className="text-foreground-muted hover:text-accent-gold transition-colors text-sm"
                >
                  קבע תור
                </Link>
              </li>
              <li>
                <Link
                  href="/my-appointments"
                  className="text-foreground-muted hover:text-accent-gold transition-colors text-sm"
                >
                  התורים שלי
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact info */}
          <div>
            <h4 className="text-foreground-light font-medium mb-4">יצירת קשר</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm">
                <FaMapMarkerAlt className="w-4 h-4 text-accent-gold flex-shrink-0" />
                <span className="text-foreground-muted">בית הכרם 30, ירושלים</span>
              </li>
              <li>
                <a
                  href="tel:+972523840981"
                  className="flex items-center gap-3 text-sm text-foreground-muted hover:text-accent-gold transition-colors"
                >
                  <FaPhone className="w-4 h-4 text-accent-gold flex-shrink-0" />
                  <span dir="ltr">052-384-0981</span>
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm">
                <FaClock className="w-4 h-4 text-accent-gold flex-shrink-0 mt-0.5" />
                <div className="text-foreground-muted">
                  <p>א'-ה': 09:00 - 20:00</p>
                  <p>ו': 09:00 - 14:00</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Social links */}
          <div>
            <h4 className="text-foreground-light font-medium mb-4">עקבו אחרינו</h4>
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-foreground-muted transition-all hover:scale-110 ${social.color}`}
                  aria-label={social.name}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="container-mobile py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-foreground-muted">
          <p>© {currentYear} רמאל ברברשופ. כל הזכויות שמורות.</p>
          <p className="flex items-center gap-1">
            נבנה עם <span className="text-red-400">❤</span> בירושלים
          </p>
        </div>
      </div>

      {/* Add spacing for mobile bottom nav */}
      <div className="h-16 md:hidden" />
    </footer>
  )
}

