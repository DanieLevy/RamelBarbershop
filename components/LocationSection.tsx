'use client'

import { useState, useEffect } from 'react'

export function LocationSection() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const openWaze = () => {
    window.open('https://waze.com/ul?ll=31.7805713%2C35.1886834&navigate=yes&zoom=17', '_blank')
  }

  return (
    <section className="index-location py-12">
      <div className="content-style px-4 md:px-[10vw] py-8">
        <h1 className="text-white">המיקום</h1>
      </div>
      
      <div className="flex flex-col items-center gap-5 px-4">
        <div className="flex flex-col items-center gap-3">
          <p className="text-foreground-light">בית הכרם 30, כיכר דניה, ירושלים</p>
          <button
            onClick={openWaze}
            className="bg-transparent text-white border border-white px-4 py-1.5 rounded text-sm cursor-pointer transition-all hover:bg-white hover:text-black hover:scale-105"
          >
            לניווט בWaze
          </button>
        </div>
        
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d13566.520697368585!2d35.1886834!3d31.7805713!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1502d74338829eb5%3A0x9a52d98b2c4f2c86!2sRAMEL%20BARBER%20SHOP!5e0!3m2!1siw!2sil!4v1700732215681!5m2!1siw!2sil"
          width={isMobile ? '100%' : '600'}
          height={isMobile ? '300' : '450'}
          allowFullScreen
          loading="lazy"
          className="border-none rounded-3xl p-4"
        />
      </div>
    </section>
  )
}

