'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { BarberWithWorkDays } from '@/types/database'

interface BarberCardProps {
  barber: BarberWithWorkDays
}

export function BarberCard({ barber }: BarberCardProps) {
  const router = useRouter()

  return (
    <div className="relative group">
      {/* Decorative circle */}
      <div className="absolute w-12 h-12 bg-yellow-200 rounded-full -z-10 left-28 top-12 transition-all duration-1000 group-hover:translate-x-[-50px] group-hover:translate-y-[50px] group-hover:w-24 group-hover:h-24" />
      
      <div className="relative w-56 h-64 flex flex-col items-center justify-between p-5 rounded-xl backdrop-blur-lg bg-background-card border border-white/10 cursor-pointer transition-transform hover:scale-105">
        {/* Name */}
        <p className="text-white text-center font-medium">{barber.fullname}</p>
        
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full overflow-hidden border border-white/10 shadow-md">
          <Image
            src={barber.img_url || '/icon.png'}
            alt={barber.fullname}
            width={100}
            height={100}
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Book button */}
        <button
          onClick={() => router.push(`/barber/${barber.id}`)}
          className="bg-transparent text-white border border-white px-4 py-1.5 rounded text-sm cursor-pointer transition-all hover:bg-white hover:text-black hover:scale-105"
        >
          קבע תור
        </button>
      </div>
    </div>
  )
}

