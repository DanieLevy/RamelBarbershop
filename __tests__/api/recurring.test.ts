import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const BARBER_ID = '550e8400-e29b-41d4-a716-446655440001'
const CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440002'
const SERVICE_ID = '550e8400-e29b-41d4-a716-446655440003'
const EXISTING_CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440004'

let queuedResponses: Array<{ data: unknown; error: unknown }> = []

const nextResponse = () => Promise.resolve(queuedResponses.shift() ?? { data: null, error: null })

const createBuilder = () => {
  const builder: Record<string, unknown> = {}

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => nextResponse())
  builder.single = vi.fn(() => nextResponse())
  builder.insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => nextResponse()),
    })),
  }))
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    nextResponse().then(resolve, reject)

  return builder
}

const fromMock = vi.fn(() => createBuilder())

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}))

vi.mock('@/lib/bug-reporter/helpers', () => ({
  reportApiError: vi.fn(),
}))

import { israelDateToTimestamp } from '@/lib/utils'
import { POST } from '@/app/api/recurring/route'

const createRequest = (body: object) =>
  new NextRequest('http://localhost:3000/api/recurring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('/api/recurring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-07T10:00:00Z'))
    queuedResponses = []
  })

  it('warns on overlapping confirmed reservations before create', async () => {
    queuedResponses = [
      { data: { id: BARBER_ID, is_barber: true }, error: null },
      { data: { id: CUSTOMER_ID, is_blocked: false }, error: null },
      { data: { id: SERVICE_ID, barber_id: BARBER_ID, is_active: true }, error: null },
      { data: { open_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'] }, error: null },
      { data: null, error: null },
      {
        data: [{
          id: 'res-1',
          customer_id: EXISTING_CUSTOMER_ID,
          time_timestamp: israelDateToTimestamp(2026, 3, 9, 9, 0),
          customers: { fullname: 'לקוח קיים' },
        }],
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
    ]

    const response = await POST(createRequest({
      barber_id: BARBER_ID,
      customer_id: CUSTOMER_ID,
      service_id: SERVICE_ID,
      day_of_week: 'monday',
      time_slot: '09:00',
      created_by: BARBER_ID,
      frequency: 'weekly',
    }))
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.success).toBe(false)
    expect(data.error).toBe('CONFLICTS_EXIST')
    expect(data.canProceed).toBe(true)
    expect(data.conflicts).toHaveLength(1)
  })

  it('creates recurring with warnings and leaves existing reservations unchanged when conflicts are allowed', async () => {
    queuedResponses = [
      { data: { id: BARBER_ID, is_barber: true }, error: null },
      { data: { id: CUSTOMER_ID, is_blocked: false }, error: null },
      { data: { id: SERVICE_ID, barber_id: BARBER_ID, is_active: true }, error: null },
      { data: { open_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'] }, error: null },
      { data: null, error: null },
      {
        data: [{
          id: 'res-1',
          customer_id: EXISTING_CUSTOMER_ID,
          time_timestamp: israelDateToTimestamp(2026, 3, 9, 9, 0),
          customers: { fullname: 'לקוח קיים' },
        }],
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
      { data: { id: 'rec-1' }, error: null },
    ]

    const response = await POST(createRequest({
      barber_id: BARBER_ID,
      customer_id: CUSTOMER_ID,
      service_id: SERVICE_ID,
      day_of_week: 'monday',
      time_slot: '09:00',
      created_by: BARBER_ID,
      frequency: 'weekly',
      allowConflicts: true,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.warningCount).toBe(1)
    expect(data.cancelledCount).toBe(0)
    expect(data.conflicts).toHaveLength(1)
  })
})
