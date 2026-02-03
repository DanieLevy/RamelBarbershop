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
import { reportBug } from '@/lib/bug-reporter'
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
}

interface DeleteRecurringRequest {
  recurringId: string
  barberId: string
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
      await reportBug(
        new Error(error.message),
        'API: Get Recurring Appointments',
        { additionalData: { barberId, errorCode: error.code } }
      )
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: ERROR_MESSAGES.DATABASE_ERROR },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/Recurring] GET exception:', err)
    await reportBug(
      err instanceof Error ? err : new Error(String(err)),
      'API: Get Recurring Appointments - Exception'
    )
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: Create a new recurring appointment
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body: CreateRecurringRequest = await request.json()
    
    // Validate required fields
    const validationErrors: string[] = []
    
    if (!body.barber_id?.trim() || !UUID_REGEX.test(body.barber_id)) {
      validationErrors.push('barber_id is required and must be a valid UUID')
    }
    if (!body.customer_id?.trim() || !UUID_REGEX.test(body.customer_id)) {
      validationErrors.push('customer_id is required and must be a valid UUID')
    }
    if (!body.service_id?.trim() || !UUID_REGEX.test(body.service_id)) {
      validationErrors.push('service_id is required and must be a valid UUID')
    }
    if (!body.day_of_week || !VALID_DAYS.includes(body.day_of_week)) {
      validationErrors.push('day_of_week is required and must be a valid day')
    }
    if (!body.time_slot || !TIME_SLOT_REGEX.test(body.time_slot)) {
      validationErrors.push('time_slot is required and must be in HH:MM format')
    }
    if (!body.created_by?.trim() || !UUID_REGEX.test(body.created_by)) {
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
      .eq('id', body.barber_id)
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
      .eq('id', body.customer_id)
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
      .eq('id', body.service_id)
      .maybeSingle()
    
    if (serviceError || !service) {
      return NextResponse.json(
        { success: false, error: 'SERVICE_NOT_FOUND', message: ERROR_MESSAGES.SERVICE_NOT_FOUND },
        { status: 400 }
      )
    }
    
    if (service.barber_id && service.barber_id !== body.barber_id) {
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
    if (shopOpenDays.length > 0 && !shopOpenDays.includes(body.day_of_week)) {
      return NextResponse.json(
        { success: false, error: 'BARBER_NOT_WORKING', message: 'המספרה סגורה ביום זה' },
        { status: 400 }
      )
    }
    
    // 5. Verify barber works on this day and time
    const { data: workDay, error: workDayError } = await supabase
      .from('work_days')
      .select('is_working, start_time, end_time')
      .eq('user_id', body.barber_id)
      .eq('day_of_week', body.day_of_week)
      .maybeSingle()
    
    if (workDayError) {
      console.error('[API/Recurring] Work day check error:', workDayError)
    }
    
    if (!workDay || !workDay.is_working) {
      return NextResponse.json(
        { success: false, error: 'BARBER_NOT_WORKING', message: ERROR_MESSAGES.BARBER_NOT_WORKING },
        { status: 400 }
      )
    }
    
    // Check if time slot is within work hours
    if (workDay.start_time && workDay.end_time) {
      const slotTime = body.time_slot
      if (slotTime < workDay.start_time || slotTime >= workDay.end_time) {
        return NextResponse.json(
          { success: false, error: 'BARBER_NOT_WORKING', message: 'השעה מחוץ לשעות העבודה' },
          { status: 400 }
        )
      }
    }
    
    // 5. Check for existing recurring at same slot (conflict)
    const { data: existingRecurring, error: conflictError } = await supabase
      .from('recurring_appointments')
      .select('id')
      .eq('barber_id', body.barber_id)
      .eq('day_of_week', body.day_of_week)
      .eq('time_slot', body.time_slot)
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
    
    // 6. Create the recurring appointment
    const { data: recurring, error: createError } = await supabase
      .from('recurring_appointments')
      .insert({
        barber_id: body.barber_id,
        customer_id: body.customer_id,
        service_id: body.service_id,
        day_of_week: body.day_of_week,
        time_slot: body.time_slot,
        notes: body.notes?.trim() || null,
        is_active: true,
        created_by: body.created_by,
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
      
      await reportBug(
        new Error(createError.message),
        'API: Create Recurring Appointment - Database Error',
        {
          additionalData: {
            errorCode: createError.code,
            barberId: body.barber_id,
            customerId: body.customer_id,
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
    })
    
  } catch (err) {
    console.error('[API/Recurring] POST exception:', err)
    await reportBug(
      err instanceof Error ? err : new Error(String(err)),
      'API: Create Recurring Appointment - Exception'
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
      await reportBug(
        new Error(updateError.message),
        'API: Delete Recurring Appointment - Database Error',
        { additionalData: { recurringId: body.recurringId, barberId: body.barberId } }
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
    await reportBug(
      err instanceof Error ? err : new Error(String(err)),
      'API: Delete Recurring Appointment - Exception'
    )
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
