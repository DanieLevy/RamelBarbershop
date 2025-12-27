'use client'

import { FaWhatsapp, FaInstagram, FaFacebook } from 'react-icons/fa'

export function ContactSection() {
  const contacts = [
    {
      name: 'Whatsapp',
      icon: FaWhatsapp,
      url: 'https://wa.me/972523840981',
    },
    {
      name: 'Instagram',
      icon: FaInstagram,
      url: 'https://www.instagram.com/ram__el_barber_shop/',
    },
    {
      name: 'Facebook',
      icon: FaFacebook,
      url: 'https://www.facebook.com/ramel.leusani',
    },
  ]

  return (
    <section className="index-contact py-12 pb-20">
      <div className="content-style px-4 md:px-[10vw] py-8">
        <h1 className="text-white">צור קשר</h1>
      </div>
      
      <div className="flex justify-center items-center gap-10 md:gap-16">
        {contacts.map((contact) => (
          <button
            key={contact.name}
            onClick={() => window.open(contact.url, '_blank')}
            className="flex flex-col items-center gap-2 transition-transform hover:scale-110 cursor-pointer"
          >
            <contact.icon className="w-6 h-6 md:w-8 md:h-8 text-white" />
            <span className="text-white text-sm md:text-base font-cereal">
              {contact.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

