import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const BARBER_ID = '660e8400-e29b-41d4-a716-446655440001'

let queuedResponses: Array<{ data: unknown; error: unknown }> = []
let updateCallCount = 0

const nextResponse = () => Promise.resolve(queuedResponses.shift() ?? { data: null, error: null })

const createBuilder = () => {
  const builder: Record<string, unknown> = {}

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.single = vi.fn(() => nextResponse())
  builder.maybeSingle = vi.fn(() => nextResponse())
  builder.insert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => nextResponse()),
    })),
  }))
  builder.update = vi.fn(() => {
    updateCallCount += 1
    return builder
  })
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
import { POST } from '@/app/api/breakouts/route'

const createRequest = (body: object) =>
  new NextRequest('http://localhost:3000/api/breakouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('/api/breakouts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-07T10:00:00Z'))
    queuedResponses = []
    updateCallCount = 0
  })

  it('warns on overlapping confirmed reservations before breakout creation', async () => {
    queuedResponses = [
      { data: { id: BARBER_ID, is_barber: true }, error: null },
      {
        data: [{
          id: 'res-1',
          time_timestamp: israelDateToTimestamp(2026, 3, 9, 9, 0),
          customers: { fullname: 'לקוח קיים' },
          services: { name: 'תספורת' },
        }],
        error: null,
      },
    ]

    const response = await POST(createRequest({
      barberId: BARBER_ID,
      breakoutType: 'single',
      startDate: '2026-03-09',
      startTime: '09:00',
      endTime: '10:00',
    }))
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.success).toBe(false)
    expect(data.error).toBe('CONFLICTS_EXIST')
    expect(data.canProceed).toBe(true)
    expect(data.conflicts).toHaveLength(1)
  })

  it('creates breakout without cancelling reservations when proceeding with legacy cancelConflicts', async () => {
    queuedResponses = [
      { data: { id: BARBER_ID, is_barber: true }, error: null },
      {
        data: [{
          id: 'res-1',
          time_timestamp: israelDateToTimestamp(2026, 3, 9, 9, 0),
          customers: { fullname: 'לקוח קיים' },
          services: { name: 'תספורת' },
        }],
        error: null,
      },
      { data: { id: 'breakout-1' }, error: null },
    ]

    const response = await POST(createRequest({
      barberId: BARBER_ID,
      breakoutType: 'single',
      startDate: '2026-03-09',
      startTime: '09:00',
      endTime: '10:00',
      cancelConflicts: true,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.warningCount).toBe(1)
    expect(data.cancelledCount).toBe(0)
    expect(updateCallCount).toBe(0)
  })

  it('creates breakout without cancelling reservations when allowConflicts is true', async () => {
    queuedResponses = [
      { data: { id: BARBER_ID, is_barber: true }, error: null },
      {
        data: [{
          id: 'res-1',
          time_timestamp: israelDateToTimestamp(2026, 3, 9, 9, 0),
          customers: { fullname: 'לקוח קיים' },
          services: { name: 'תספורת' },
        }],
        error: null,
      },
      { data: { id: 'breakout-2' }, error: null },
    ]

    const response = await POST(createRequest({
      barberId: BARBER_ID,
      breakoutType: 'single',
      startDate: '2026-03-09',
      startTime: '09:00',
      endTime: '10:00',
      allowConflicts: true,
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.warningCount).toBe(1)
    expect(data.cancelledCount).toBe(0)
    expect(updateCallCount).toBe(0)
  })
})
