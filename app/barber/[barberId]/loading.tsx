'use client'

import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { AppHeader } from '@/components/AppHeader'

/**
 * Loading state for barber profile page
 * Shows scissors loader during navigation
 */
export default function BarberProfileLoading() {
  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-background-dark flex items-center justify-center">
        <ScissorsLoader 
          size="lg" 
          text="טוען..." 
        />
      </main>
    </>
  )
}
