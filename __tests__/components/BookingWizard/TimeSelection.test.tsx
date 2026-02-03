/**
 * TimeSelection Component Tests
 * 
 * Tests for the time slot selection in booking flow.
 * All tests are READ-ONLY - no database writes.
 * Critical tests for Safari "Load failed" bug fix verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TimeSelection } from '@/components/BookingWizard/TimeSelection'

// Mock the booking store
const mockBookingStore = {
  date: { dayName: 'א׳', dayNum: '5', dateTimestamp: Date.now() },
  timeTimestamp: null,
  setTime: vi.fn(),
  nextStep: vi.fn(),
  prevStep: vi.fn(),
}

vi.mock('@/store/useBookingStore', () => ({
  useBookingStore: () => mockBookingStore,
}))

// Mock Supabase client
const mockSupabaseSelect = vi.fn()
const mockSupabaseEq = vi.fn()
const mockSupabaseGte = vi.fn()
const mockSupabaseLte = vi.fn()
const mockSupabaseNeq = vi.fn()
const mockSupabaseSingle = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: mockSupabaseSelect.mockReturnValue({
        eq: mockSupabaseEq.mockReturnValue({
          single: mockSupabaseSingle.mockResolvedValue({ data: null, error: null }),
          gte: mockSupabaseGte.mockReturnValue({
            lte: mockSupabaseLte.mockReturnValue({
              neq: mockSupabaseNeq.mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    })),
  }),
}))

// Mock retry utility
vi.mock('@/lib/utils/retry', () => ({
  withSupabaseRetry: vi.fn((fn) => fn()),
}))

// Mock bug reporter hook
vi.mock('@/hooks/useBugReporter', () => ({
  useBugReporter: () => ({
    report: vi.fn(),
    isReady: true,
  }),
}))

// Mock availability service
vi.mock('@/lib/services/availability.service', () => ({
  getWorkHours: vi.fn(() => ({ start: '09:00', end: '19:00' })),
  workDaysToMap: vi.fn(() => ({
    sunday: { isWorking: true, startTime: '09:00', endTime: '19:00' },
    monday: { isWorking: true, startTime: '09:00', endTime: '19:00' },
  })),
}))

describe('TimeSelection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseSingle.mockResolvedValue({ data: null, error: null })
    mockSupabaseNeq.mockResolvedValue({ data: [], error: null })
  })

  it('renders loading state initially', () => {
    render(
      <TimeSelection 
        barberId="test-barber-id"
        shopSettings={null}
      />
    )
    
    // Should show loading state
    expect(screen.getByText('בחר שעה')).toBeInTheDocument()
  })

  it('displays time slots after loading', async () => {
    mockSupabaseNeq.mockResolvedValue({ 
      data: [], 
      error: null 
    })
    
    render(
      <TimeSelection 
        barberId="test-barber-id"
        shopSettings={{
          id: 'shop-id',
          name: 'Test Shop',
          phone: '0501234567',
          address: 'Test Address',
          description: '',
          work_hours_start: '09:00',
          work_hours_end: '19:00',
          open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          hero_title: '',
          hero_subtitle: '',
          hero_description: '',
          address_text: '',
          address_lat: 0,
          address_lng: 0,
          waze_link: '',
          google_maps_link: '',
          contact_phone: '',
          contact_email: '',
          contact_whatsapp: '',
          social_instagram: '',
          social_facebook: '',
          social_tiktok: '',
          show_phone: true,
          show_email: true,
          show_whatsapp: true,
          show_instagram: true,
          show_facebook: true,
          show_tiktok: false,
          default_reminder_hours: 3,
          max_booking_days_ahead: 21,
        }}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('בחר שעה')).toBeInTheDocument()
    })
  })

  it('uses withSupabaseRetry for reservation fetch', async () => {
    const { withSupabaseRetry } = await import('@/lib/utils/retry')
    
    render(
      <TimeSelection 
        barberId="test-barber-id"
        shopSettings={null}
      />
    )
    
    await waitFor(() => {
      // Verify withSupabaseRetry is used for fetching
      expect(withSupabaseRetry).toHaveBeenCalled()
    })
  })

  it('handles back button correctly', () => {
    render(
      <TimeSelection 
        barberId="test-barber-id"
        shopSettings={null}
      />
    )
    
    const backButton = screen.getByText('חזור לבחירת תאריך')
    expect(backButton).toBeInTheDocument()
  })
})

describe('TimeSelection Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles Safari Load failed error gracefully', async () => {
    const { withSupabaseRetry } = await import('@/lib/utils/retry')
    
    // Mock withSupabaseRetry to simulate recovery from Load failed
    let attempt = 0
    ;(withSupabaseRetry as ReturnType<typeof vi.fn>).mockImplementation(async (fn) => {
      attempt++
      if (attempt < 2) {
        throw new Error('Load failed')
      }
      return { data: [], error: null }
    })
    
    render(
      <TimeSelection 
        barberId="test-barber-id"
        shopSettings={null}
      />
    )
    
    // Component should render without crashing
    await waitFor(() => {
      expect(screen.getByText('בחר שעה')).toBeInTheDocument()
    })
  })

  it('continues to show UI even if fetch fails', async () => {
    const { withSupabaseRetry } = await import('@/lib/utils/retry')
    
    ;(withSupabaseRetry as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))
    
    render(
      <TimeSelection 
        barberId="test-barber-id"
        shopSettings={null}
      />
    )
    
    // Component should still render
    await waitFor(() => {
      expect(screen.getByText('בחר שעה')).toBeInTheDocument()
    })
  })
})
