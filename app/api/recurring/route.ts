/**
 * API Route: Recurring Appointments
 * 
 * Handles CRUD operations for recurring appointments.
 * Uses service_role to bypass RLS for secure management.
 * 
 * Methods:
 * - GET: Fetch recurring appointments for a barber
 * - POST: Create a new recurring appointment
 * - DELETE: Deactivate (soft delete) a recurring appointment
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import {
  addDaysToDateString,
  BLOCKING_RESERVATION_STATUS,
  getDayKeyFromDateString,
  getSlotKey,
  getUpcomingDateStringsForDay,
  getTodayDateString,
  israelDateToTimestamp,
} from '@/lib/utils'
import type { DayOfWeek } from '@/types/database'

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIME_SLOT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/
const VALID_DAYS: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Error messages (Hebrew)
const ERROR_MESSAGES: Record<string, string> = {
  SLOT_CONFLICT: 'כבר קיים תור קבוע בשעה זו.',
  CUSTOMER_BLOCKED: 'הלקוח חסום ולא ניתן להוסיף תור קבוע.',
  CUSTOMER_NOT_FOUND: 'הלקוח לא נמצא במערכת.',
  BARBER_NOT_WORKING: 'אינך עובד ביום או בשעה זו.',
  INVALID_TIME_SLOT: 'שעת התור אינה תקינה.',
  SERVICE_NOT_FOUND: 'השירות לא נמצא.',
  VALIDATION_ERROR: 'חסרים נתונים ליצירת תור קבוע.',
  DATABASE_ERROR: 'שגיאה ביצירת תור קבוע. נסה שוב.',
  NOT_FOUND: 'תור קבוע לא נמצא.',
  UNAUTHORIZED: 'אין הרשאה לבצע פעולה זו.',
}

interface CreateRecurringRequest {
  barber_id: string
  customer_id: string
  service_id: string
  day_of_week: DayOfWeek
  time_slot: string
  notes?: string
  created_by: string
  frequency?: 'weekly' | 'biweekly'
  allowConflicts?: boolean
}

interface CancelConflictsRequest {
  action: 'cancel_conflicts'
  reservationIds: string[]
  barberId: string
}

interface DeleteRecurringRequest {
  recurringId: string
  barberId: string
}

type PostRequestBody = CreateRecurringRequest | CancelConflictsRequest

interface ConflictingReservation {
  id: string
  date: string
  dateFormatted: string
  time: string
  customer_name: string
  customer_id: string
}

// ============================================================
// Helper: Get next occurrence of a day of week in Israel timezone
// ============================================================

function getNextOccurrenceInIsrael(dayOfWeek: DayOfWeek): string {
  return getUpcomingDateStringsForDay(dayOfWeek, 1)[0]
}

function formatDateHebrew(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`)
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const dayName = dayNames[date.getDay()]
  const day = date.getDate()
  const month = date.getMonth() + 1
  return `יום ${dayName}, ${day}/${month}`
}

async function checkReservationConflicts(
  supabase: ReturnType<typeof createAdminClient>,
  barberId: string,
  dayOfWeek: DayOfWeek,
  timeSlot: string,
  maxDaysAhead = 21
): Promise<ConflictingReservation[]> {
  const [hours, minutes] = timeSlot.split(':').map(Number)
  const today = getTodayDateString()
  const conflicts: ConflictingReservation[] = []

  for (let dayOffset = 0; dayOffset <= maxDaysAhead; dayOffset += 1) {
    const dateStr = addDaysToDateString(today, dayOffset)
    if (getDayKeyFromDateString(dateStr) !== dayOfWeek) continue

    const [year, month, day] = dateStr.split('-').map(Number)
    const dayStart = israelDateToTimestamp(year, month, day, 0, 0)
    const dayEnd = israelDateToTimestamp(year, month, day, 23, 59)
    const slotTimestamp = israelDateToTimestamp(year, month, day, hours, minutes)

    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        customer_id,
        time_timestamp,
        customers!reservations_customer_id_fkey (fullname)
      `)
      .eq('barber_id', barberId)
      .eq('status', BLOCKING_RESERVATION_STATUS)
      .gte('time_timestamp', dayStart)
      .lte('time_timestamp', dayEnd)

    if (error || !data) {
      if (error) {
        console.error('[API/Recurring] Conflict check error:', error)
      }
      continue
    }

    const targetSlotKey = getSlotKey(slotTimestamp)

    for (const reservation of data) {
      if (getSlotKey(reservation.time_timestamp) !== targetSlotKey) continue

      conflicts.push({
        id: reservation.id,
        date: dateStr,
        dateFormatted: formatDateHebrew(dateStr),
        time: timeSlot,
        customer_name: (reservation.customers as { fullname?: string } | null)?.fullname || 'לקוח',
        customer_id: reservation.customer_id,
      })
    }
  }

  return conflicts
}

// ============================================================
// Helper: Cancel conflicting reservations
// ============================================================
async function handleCancelConflicts(body: CancelConflictsRequest): Promise<NextResponse> {
  const { reservationIds, barberId } = body
  
  // Validate inputs
  if (!barberId || !UUID_REGEX.test(barberId)) {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR', message: 'barberId is required' },
      { status: 400 }
    )
  }
  
  if (!reservationIds || !Array.isArray(reservationIds) || reservationIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR', message: 'reservationIds is required' },
      { status: 400 }
    )
  }
  
  // Validate all UUIDs
  const invalidIds = reservationIds.filter(id => !UUID_REGEX.test(id))
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR', message: 'Invalid reservation IDs' },
      { status: 400 }
    )
  }
  
  return NextResponse.json({
    success: true,
    cancelledCount: 0,
    barberId,
    reservationIds,
    warning: 'cancel_conflicts is deprecated. Existing reservations were left unchanged.',
  })
}

// ============================================================
// GET: Fetch recurring appointments for a barber
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barberId')
    
    if (!barberId || !UUID_REGEX.test(barberId)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'barberId is required' },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('recurring_appointments')
      .select(`
        *,
        customers (id, fullname, phone),
        services (id, name_he, price, duration),
        users:barber_id (id, fullname)
      `)
      .eq('barber_id', barberId)
      .eq('is_active', true)
      .order('day_of_week')
      .order('time_slot')
    
    if (error) {
      console.error('[API/Recurring] GET error:', error)
      await reportApiError(
        new Error(error.message),
        request,
        'Get recurring appointments failed',
        { severity: 'medium', additionalData: { barberId, errorCode: error.code } }
      )
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: ERROR_MESSAGES.DATABASE_ERROR },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/Recurring] GET exception:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Get recurring appointments exception',
      { severity: 'high' }
    )
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: Create a new recurring appointment or cancel conflicts
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body: PostRequestBody = await request.json()
    
    // Handle cancel_conflicts action
    if ('action' in body && body.action === 'cancel_conflicts') {
      return handleCancelConflicts(body as CancelConflictsRequest)
    }
    
    // Otherwise, handle create recurring
    const createBody = body as CreateRecurringRequest
    
    // Validate required fields
    const validationErrors: string[] = []
    
    if (!createBody.barber_id?.trim() || !UUID_REGEX.test(createBody.barber_id)) {
      validationErrors.push('barber_id is required and must be a valid UUID')
    }
    if (!createBody.customer_id?.trim() || !UUID_REGEX.test(createBody.customer_id)) {
      validationErrors.push('customer_id is required and must be a valid UUID')
    }
    if (!createBody.service_id?.trim() || !UUID_REGEX.test(createBody.service_id)) {
      validationErrors.push('service_id is required and must be a valid UUID')
    }
    if (!createBody.day_of_week || !VALID_DAYS.includes(createBody.day_of_week)) {
      validationErrors.push('day_of_week is required and must be a valid day')
    }
    if (!createBody.time_slot || !TIME_SLOT_REGEX.test(createBody.time_slot)) {
      validationErrors.push('time_slot is required and must be in HH:MM format')
    }
    if (!createBody.created_by?.trim() || !UUID_REGEX.test(createBody.created_by)) {
      validationErrors.push('created_by is required and must be a valid UUID')
    }
    
    if (validationErrors.length > 0) {
      console.error('[API/Recurring] Validation failed:', validationErrors)
      return NextResponse.json(
        { 
          success: false, 
          error: 'VALIDATION_ERROR',
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          details: validationErrors 
        },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    
    // 1. Verify barber exists
    const { data: barber, error: barberError } = await supabase
      .from('users')
      .select('id, is_barber')
      .eq('id', createBody.barber_id)
      .eq('is_barber', true)
      .maybeSingle()
    
    if (barberError || !barber) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'ספר לא נמצא' },
        { status: 400 }
      )
    }
    
    // 2. Verify customer exists and is not blocked
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, is_blocked')
      .eq('id', createBody.customer_id)
      .maybeSingle()
    
    if (customerError || !customer) {
      return NextResponse.json(
        { success: false, error: 'CUSTOMER_NOT_FOUND', message: ERROR_MESSAGES.CUSTOMER_NOT_FOUND },
        { status: 400 }
      )
    }
    
    if (customer.is_blocked) {
      return NextResponse.json(
        { success: false, error: 'CUSTOMER_BLOCKED', message: ERROR_MESSAGES.CUSTOMER_BLOCKED },
        { status: 400 }
      )
    }
    
    // 3. Verify service exists and belongs to barber
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, barber_id, is_active')
      .eq('id', createBody.service_id)
      .maybeSingle()
    
    if (serviceError || !service) {
      return NextResponse.json(
        { success: false, error: 'SERVICE_NOT_FOUND', message: ERROR_MESSAGES.SERVICE_NOT_FOUND },
        { status: 400 }
      )
    }
    
    if (service.barber_id && service.barber_id !== createBody.barber_id) {
      return NextResponse.json(
        { success: false, error: 'SERVICE_NOT_FOUND', message: 'השירות לא שייך לספר זה' },
        { status: 400 }
      )
    }
    
    // 4. Verify barbershop is open on this day
    const { data: shopSettings, error: shopError } = await supabase
      .from('barbershop_settings')
      .select('open_days')
      .limit(1)
      .single()
    
    if (shopError) {
      console.error('[API/Recurring] Shop settings check error:', shopError)
    }
    
    // Check if the shop is open on this day
    const shopOpenDays = shopSettings?.open_days as string[] || []
    if (shopOpenDays.length > 0 && !shopOpenDays.includes(createBody.day_of_week)) {
      return NextResponse.json(
        { success: false, error: 'BARBER_NOT_WORKING', message: 'המספרה סגורה ביום זה' },
        { status: 400 }
      )
    }
    
    // 5. Barber work-day and time-within-hours are NOT enforced for recurring.
    // Barbers intentionally schedule recurring slots outside their normal hours
    // (e.g., 08:30 on a day that officially starts at 09:00).
    
    // 6. Check for existing recurring at same slot (conflict)
    const { data: existingRecurring, error: conflictError } = await supabase
      .from('recurring_appointments')
      .select('id')
      .eq('barber_id', createBody.barber_id)
      .eq('day_of_week', createBody.day_of_week)
      .eq('time_slot', createBody.time_slot)
      .eq('is_active', true)
      .maybeSingle()
    
    if (conflictError) {
      console.error('[API/Recurring] Conflict check error:', conflictError)
    }
    
    if (existingRecurring) {
      return NextResponse.json(
        { success: false, error: 'SLOT_CONFLICT', message: ERROR_MESSAGES.SLOT_CONFLICT },
        { status: 409 }
      )
    }

    // 7. Detect overlapping confirmed reservations (warn-only)
    const conflicts = await checkReservationConflicts(
      supabase,
      createBody.barber_id,
      createBody.day_of_week,
      createBody.time_slot
    )

    if (conflicts.length > 0 && !createBody.allowConflicts) {
      return NextResponse.json(
        {
          success: false,
          error: 'CONFLICTS_EXIST',
          message: 'קיימים תורים רגילים בשעה זו בשבועות הקרובים.',
          conflicts,
          canProceed: true,
        },
        { status: 409 }
      )
    }
    
    // 8. Create the recurring appointment
    const frequency = createBody.frequency || 'weekly'
    const startDate = frequency === 'biweekly'
      ? getNextOccurrenceInIsrael(createBody.day_of_week)
      : null

    const { data: recurring, error: createError } = await supabase
      .from('recurring_appointments')
      .insert({
        barber_id: createBody.barber_id,
        customer_id: createBody.customer_id,
        service_id: createBody.service_id,
        day_of_week: createBody.day_of_week,
        time_slot: createBody.time_slot,
        notes: createBody.notes?.trim() || null,
        is_active: true,
        created_by: createBody.created_by,
        frequency,
        start_date: startDate,
      })
      .select()
      .single()
    
    if (createError) {
      console.error('[API/Recurring] Create error:', createError)
      
      // Handle unique constraint violation (race condition backup)
      if (createError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'SLOT_CONFLICT', message: ERROR_MESSAGES.SLOT_CONFLICT },
          { status: 409 }
        )
      }
      
      await reportApiError(
        new Error(createError.message),
        request,
        'Create recurring appointment failed',
        {
          severity: 'high',
          additionalData: {
            errorCode: createError.code,
            barberId: createBody.barber_id,
            customerId: createBody.customer_id,
          }
        }
      )
      
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: ERROR_MESSAGES.DATABASE_ERROR },
        { status: 500 }
      )
    }
    
    console.log('[API/Recurring] Created recurring appointment:', recurring.id)
    
    return NextResponse.json({
      success: true,
      recurring,
      conflicts,
      warningCount: conflicts.length,
      cancelledCount: 0,
    })
    
  } catch (err) {
    console.error('[API/Recurring] POST exception:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Create recurring appointment exception',
      { severity: 'critical' }
    )
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה. נסה שוב.' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE: Deactivate (soft delete) a recurring appointment
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    const body: DeleteRecurringRequest = await request.json()
    
    if (!body.recurringId || !UUID_REGEX.test(body.recurringId)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'recurringId is required' },
        { status: 400 }
      )
    }
    
    if (!body.barberId || !UUID_REGEX.test(body.barberId)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'barberId is required' },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    
    // Verify the recurring appointment exists and belongs to this barber
    const { data: existing, error: checkError } = await supabase
      .from('recurring_appointments')
      .select('id, barber_id')
      .eq('id', body.recurringId)
      .eq('is_active', true)
      .maybeSingle()
    
    if (checkError) {
      console.error('[API/Recurring] Delete check error:', checkError)
    }
    
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: ERROR_MESSAGES.NOT_FOUND },
        { status: 404 }
      )
    }
    
    if (existing.barber_id !== body.barberId) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 403 }
      )
    }
    
    // Soft delete by setting is_active = false
    const { error: updateError } = await supabase
      .from('recurring_appointments')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
      })
      .eq('id', body.recurringId)
    
    if (updateError) {
      console.error('[API/Recurring] Delete error:', updateError)
      await reportApiError(
        new Error(updateError.message),
        request,
        'Delete recurring appointment failed',
        { severity: 'high', additionalData: { recurringId: body.recurringId, barberId: body.barberId } }
      )
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: ERROR_MESSAGES.DATABASE_ERROR },
        { status: 500 }
      )
    }
    
    console.log('[API/Recurring] Deactivated recurring appointment:', body.recurringId)
    
    return NextResponse.json({ success: true })
    
  } catch (err) {
    console.error('[API/Recurring] DELETE exception:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Delete recurring appointment exception',
      { severity: 'high' }
    )
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
