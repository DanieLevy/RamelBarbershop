import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background barber pole stripes */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 barber-pole" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 text-center max-w-md mx-auto">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto rounded-full overflow-hidden shadow-gold border-2 border-accent-gold/30">
            <Image
              src="/icon.png"
              alt="Ramel Barbershop"
              width={96}
              height={96}
              className="w-full h-full object-cover"
              priority
            />
          </div>
        </div>

        {/* 404 with scissors */}
        <div className="relative mb-6">
          <h1 className="text-8xl sm:text-9xl font-bold text-foreground-light/10">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-16 h-16 sm:w-20 sm:h-20 text-accent-gold animate-spin-scissors"
            >
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl sm:text-3xl font-medium text-foreground-light mb-3">
          אופס! הדף שחיפשת לא נמצא
        </h2>

        {/* CTA Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-4 bg-accent-gold text-background-dark font-medium rounded-xl hover:bg-accent-gold/90 transition-all hover:scale-105 shadow-gold"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          חזרה לדף הבית
        </Link>
      </div>

      {/* Decorative elements */}
      <div className="absolute bottom-10 left-10 opacity-10">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" className="text-accent-gold">
          <path d="M7.5 5.5h-3v3h3v-3zM7.5 9.5h-3v3h3v-3zM7.5 13.5h-3v3h3v-3zM11.5 5.5h-3v3h3v-3zM11.5 9.5h-3v3h3v-3zM15.5 5.5h-3v3h3v-3z"/>
        </svg>
      </div>
      <div className="absolute top-10 right-10 opacity-10">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" className="text-accent-gold">
          <path d="M7.5 5.5h-3v3h3v-3zM7.5 9.5h-3v3h3v-3zM7.5 13.5h-3v3h3v-3zM11.5 5.5h-3v3h3v-3zM11.5 9.5h-3v3h3v-3zM15.5 5.5h-3v3h3v-3z"/>
        </svg>
      </div>
    </div>
  )
}

