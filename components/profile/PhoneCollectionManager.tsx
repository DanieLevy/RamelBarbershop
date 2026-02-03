'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { PhoneCollectionModal, shouldShowPhoneModal } from './PhoneCollectionModal'

/**
 * PhoneCollectionManager
 * 
 * This component manages the phone collection modal logic.
 * It shows the modal once when a customer logs in without a phone number.
 * The modal is dismissed for 7 days if the user skips it.
 */
export function PhoneCollectionManager() {
  const { customer, isLoggedIn, isInitialized } = useAuthStore()
  const [showModal, setShowModal] = useState(false)
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    // Wait for auth to initialize
    if (!isInitialized) return
    
    // Only check once per session
    if (hasChecked) return
    
    // Only for logged in customers
    if (!isLoggedIn || !customer) {
      setHasChecked(true)
      return
    }
    
    // Check if we should show the modal
    // Use a small delay to avoid showing immediately on page load
    const timer = setTimeout(() => {
      const shouldShow = shouldShowPhoneModal(customer.id, !!customer.phone)
      setShowModal(shouldShow)
      setHasChecked(true)
    }, 2000) // 2 second delay after login
    
    return () => clearTimeout(timer)
  }, [isInitialized, isLoggedIn, customer, hasChecked])

  // Don't render anything if modal shouldn't be shown
  if (!showModal || !customer) return null

  return (
    <PhoneCollectionModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      customerId={customer.id}
      customerName={customer.fullname}
    />
  )
}
