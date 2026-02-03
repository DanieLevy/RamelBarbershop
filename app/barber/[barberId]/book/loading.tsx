'use client'

import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { AppHeader } from '@/components/AppHeader'

/**
 * Loading state for booking wizard page
 * Shows scissors loader during navigation
 */
export default function BookingLoading() {
  return (
    <>
      <AppHeader isWizardPage />
      <main 
        className="min-h-screen bg-background-dark flex items-center justify-center pb-24"
        style={{
          paddingTop: 'calc(var(--header-top-offset, 0px) + 4rem)',
        }}
      >
        <ScissorsLoader 
          size="lg" 
          text="טוען עמוד ההזמנה..." 
        />
      </main>
    </>
  )
}
