/**
 * API Route: Barber Breakouts
 * 
 * Handles CRUD operations for barber breaks (lunch, early departure, etc.)
 * Uses service_role to bypass RLS for secure management.
 * 
 * Methods:
 * - GET: Fetch breakouts for a barber (all or by date)
 * - POST: Create a new breakout (with optional conflict resolution)
 * - DELETE: Deactivate (soft delete) a breakout
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import {
  BLOCKING_RESERVATION_STATUS,
  doesBreakoutApplyToDate,
  enumerateDateStringsInRange,
  getIsraelDateString,
  getDayKeyInIsrael,
  getUpcomingDateStringsForDay,
  israelDateToTimestamp,
  timestampToIsraelDate,
  getTodayDateString,
  parseTimeToMinutes,
} from '@/lib/utils'
import type { BreakoutType, DayOfWeek } from '@/types/database'

// ============================================================
// Validation
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const VALID_DAYS: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const VALID_TYPES: BreakoutType[] = ['single', 'date_range', 'recurring']

// ============================================================
// Error Messages (Hebrew)
// ============================================================

const ERROR_MESSAGES: Record<string, string> = {
  CONFLICTS_EXIST: 'קיימים תורים בזמנים אלו. ניתן להמשיך והם יישארו מאושרים.',
  INVALID_TIME_RANGE: 'טווח השעות אינו תקין.',
  INVALID_DATE_RANGE: 'טווח התאריכים אינו תקין.',
  INVALID_DAY_OF_WEEK: 'יום השבוע אינו תקין.',
  VALIDATION_ERROR: 'חסרים נתונים ליצירת הפסקה.',
  DATABASE_ERROR: 'שגיאה ביצירת הפסקה. נסה שוב.',
  NOT_FOUND: 'הפסקה לא נמצאה.',
  UNAUTHORIZED: 'אין הרשאה לבצע פעולה זו.',
}

// ============================================================
// Types
// ============================================================

interface CreateBreakoutRequest {
  barberId: string
  breakoutType: BreakoutType
  startTime: string
  endTime: string | null
  startDate?: string
  endDate?: string
  dayOfWeek?: DayOfWeek
  reason?: string
  cancelConflicts?: boolean
  allowConflicts?: boolean
}

interface ConflictingReservation {
  id: string
  customerName: string
  time: string
  date: string
  serviceName: string
  timeTimestamp: number
}

interface DeleteBreakoutRequest {
  breakoutId: string
  barberId: string
}

// ============================================================
// Helper: Parse time to minutes
// ============================================================

// ============================================================
// Helper: Check for conflicting reservations
// ============================================================

async function checkConflicts(
  supabase: ReturnType<typeof createAdminClient>,
  barberId: string,
  breakoutType: BreakoutType,
  startTime: string,
  endTime: string | null,
  startDate?: string,
  endDate?: string,
  dayOfWeek?: DayOfWeek
): Promise<ConflictingReservation[]> {
  const conflicts: ConflictingReservation[] = []
  const today = getTodayDateString()
  
  // Build date range to check
  let datesToCheck: string[] = []
  
  switch (breakoutType) {
    case 'single':
      if (startDate && startDate >= today) {
        datesToCheck = [startDate]
      }
      break
    
    case 'date_range':
      if (startDate && endDate) {
        datesToCheck = enumerateDateStringsInRange(startDate, endDate, 30)
          .filter((dateStr) => dateStr >= today)
      }
      break
    
    case 'recurring':
      if (dayOfWeek) {
        datesToCheck = getUpcomingDateStringsForDay(dayOfWeek, 4).filter((dateStr) => dateStr >= today)
      }
      break
  }
  
  if (datesToCheck.length === 0) return []
  
  // Parse time range
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = endTime ? parseTimeToMinutes(endTime) : 24 * 60
  
  // Check each date for conflicts
  for (const dateStr of datesToCheck) {
    const [year, month, day] = dateStr.split('-').map(Number)
    const dayStart = israelDateToTimestamp(year, month, day, 0, 0)
    const dayEnd = israelDateToTimestamp(year, month, day, 23, 59)
    
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        time_timestamp,
        customers!inner (fullname),
        services!inner (name)
      `)
      .eq('barber_id', barberId)
      .eq('status', BLOCKING_RESERVATION_STATUS)
      .gte('time_timestamp', dayStart)
      .lte('time_timestamp', dayEnd)
    
    if (error) {
      console.error('[API/Breakouts] Conflict check error:', error)
      continue
    }
    
    if (!reservations) continue
    
    for (const res of reservations) {
      const resIsraelDate = timestampToIsraelDate(res.time_timestamp)
      const resMinutes = resIsraelDate.getHours() * 60 + resIsraelDate.getMinutes()
      
      if (resMinutes >= startMinutes && resMinutes < endMinutes) {
        const customer = res.customers as { fullname: string }
        const service = res.services as { name: string }
        
        conflicts.push({
          id: res.id,
          customerName: customer.fullname,
          time: `${String(resIsraelDate.getHours()).padStart(2, '0')}:${String(resIsraelDate.getMinutes()).padStart(2, '0')}`,
          date: dateStr,
          serviceName: service.name,
          timeTimestamp: res.time_timestamp,
        })
      }
    }
  }
  
  return conflicts
}

// ============================================================
// GET: Fetch breakouts for a barber
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barberId')
    const dateTimestamp = searchParams.get('dateTimestamp')
    
    if (!barberId || !UUID_REGEX.test(barberId)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'barberId is required' },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    
    // Fetch all active breakouts for the barber
    const { data, error } = await supabase
      .from('barber_breakouts')
      .select('id, barber_id, breakout_type, start_time, end_time, start_date, end_date, day_of_week, reason, is_active, created_at, deactivated_at')
      .eq('barber_id', barberId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[API/Breakouts] GET error:', error)
      await reportApiError(
        new Error(error.message),
        request,
        'Get Breakouts failed',
        { severity: 'medium', additionalData: { barberId, errorCode: error.code } }
      )
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: ERROR_MESSAGES.DATABASE_ERROR },
        { status: 500 }
      )
    }
    
    // If dateTimestamp provided, filter to applicable breakouts
    if (dateTimestamp) {
      const ts = parseInt(dateTimestamp, 10)
      if (isNaN(ts)) {
        return NextResponse.json(
          { success: false, error: 'VALIDATION_ERROR', message: 'Invalid dateTimestamp' },
          { status: 400 }
        )
      }
      
      const dateString = getIsraelDateString(ts)
      const dayOfWeek = getDayKeyInIsrael(ts) as DayOfWeek
      
      const filtered = (data || []).filter(breakout => {
        return doesBreakoutApplyToDate(breakout, dateString, dayOfWeek)
      })
      
      return NextResponse.json({ success: true, data: filtered })
    }
    
    return NextResponse.json({ success: true, data: data || [] })
    
  } catch (err) {
    console.error('[API/Breakouts] GET exception:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Get Breakouts exception',
      { severity: 'high' }
    )
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: Create a new breakout
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body: CreateBreakoutRequest = await request.json()
    
    // Validate required fields
    const validationErrors: string[] = []
    
    if (!body.barberId?.trim() || !UUID_REGEX.test(body.barberId)) {
      validationErrors.push('barberId is required and must be a valid UUID')
    }
    
    if (!body.breakoutType || !VALID_TYPES.includes(body.breakoutType)) {
      validationErrors.push('breakoutType is required and must be single, date_range, or recurring')
    }
    
    if (!body.startTime || !TIME_REGEX.test(body.startTime)) {
      validationErrors.push('startTime is required and must be in HH:MM format')
    }
    
    if (body.endTime && !TIME_REGEX.test(body.endTime)) {
      validationErrors.push('endTime must be in HH:MM format')
    }
    
    // Type-specific validation
    if (body.breakoutType === 'single' && (!body.startDate || !DATE_REGEX.test(body.startDate))) {
      validationErrors.push('startDate is required for single breakout')
    }
    
    if (body.breakoutType === 'date_range') {
      if (!body.startDate || !DATE_REGEX.test(body.startDate)) {
        validationErrors.push('startDate is required for date_range breakout')
      }
      if (!body.endDate || !DATE_REGEX.test(body.endDate)) {
        validationErrors.push('endDate is required for date_range breakout')
      }
      if (body.startDate && body.endDate && body.endDate < body.startDate) {
        validationErrors.push('endDate must be after or equal to startDate')
      }
    }
    
    if (body.breakoutType === 'recurring' && (!body.dayOfWeek || !VALID_DAYS.includes(body.dayOfWeek))) {
      validationErrors.push('dayOfWeek is required for recurring breakout')
    }
    
    // Validate time range
    if (body.startTime && body.endTime) {
      const startMinutes = parseTimeToMinutes(body.startTime)
      const endMinutes = parseTimeToMinutes(body.endTime)
      if (endMinutes <= startMinutes) {
        validationErrors.push('endTime must be after startTime')
      }
    }
    
    if (validationErrors.length > 0) {
      console.error('[API/Breakouts] Validation failed:', validationErrors)
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          details: validationErrors,
        },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    
    // Verify barber exists
    const { data: barber, error: barberError } = await supabase
      .from('users')
      .select('id, is_barber')
      .eq('id', body.barberId)
      .eq('is_barber', true)
      .maybeSingle()
    
    if (barberError || !barber) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'ספר לא נמצא' },
        { status: 400 }
      )
    }
    
    // Check for conflicting reservations
    const conflicts = await checkConflicts(
      supabase,
      body.barberId,
      body.breakoutType,
      body.startTime,
      body.endTime,
      body.startDate,
      body.endDate,
      body.dayOfWeek
    )
    
    const allowConflicts = body.allowConflicts || body.cancelConflicts

    if (conflicts.length > 0 && !allowConflicts) {
      return NextResponse.json(
        {
          success: false,
          error: 'CONFLICTS_EXIST',
          message: ERROR_MESSAGES.CONFLICTS_EXIST,
          conflicts,
          canProceed: true,
        },
        { status: 409 }
      )
    }
    
    // Build insert data
    const insertData = {
      barber_id: body.barberId,
      breakout_type: body.breakoutType,
      start_time: body.startTime,
      end_time: body.endTime || null,
      start_date: body.breakoutType === 'recurring' ? null : body.startDate,
      end_date: body.breakoutType === 'date_range' ? body.endDate : null,
      day_of_week: body.breakoutType === 'recurring' ? body.dayOfWeek : null,
      reason: body.reason?.trim() || null,
      is_active: true,
    }
    
    // Insert breakout
    const { data: breakout, error: createError } = await supabase
      .from('barber_breakouts')
      .insert(insertData)
      .select()
      .single()
    
    if (createError) {
      console.error('[API/Breakouts] Create error:', createError)
      await reportApiError(
        new Error(createError.message),
        request,
        'Create breakout failed',
        { severity: 'high', additionalData: { barberId: body.barberId, errorCode: createError.code } }
      )
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: ERROR_MESSAGES.DATABASE_ERROR },
        { status: 500 }
      )
    }
    
    console.log('[API/Breakouts] Created breakout:', breakout.id)
    
    return NextResponse.json({
      success: true,
      breakout,
      conflicts,
      warningCount: conflicts.length,
      cancelledCount: 0,
    })
    
  } catch (err) {
    console.error('[API/Breakouts] POST exception:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Create breakout exception',
      { severity: 'critical' }
    )
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה. נסה שוב.' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE: Deactivate (soft delete) a breakout
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const body: DeleteBreakoutRequest = await request.json()
    
    if (!body.breakoutId || !UUID_REGEX.test(body.breakoutId)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'breakoutId is required' },
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
    
    // Verify breakout exists and belongs to this barber
    const { data: existing, error: checkError } = await supabase
      .from('barber_breakouts')
      .select('id, barber_id')
      .eq('id', body.breakoutId)
      .eq('is_active', true)
      .maybeSingle()
    
    if (checkError) {
      console.error('[API/Breakouts] Delete check error:', checkError)
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
    
    // Soft delete
    const { error: updateError } = await supabase
      .from('barber_breakouts')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
      })
      .eq('id', body.breakoutId)
    
    if (updateError) {
      console.error('[API/Breakouts] Delete error:', updateError)
      await reportApiError(
        new Error(updateError.message),
        request,
        'Delete breakout failed',
        { severity: 'high', additionalData: { breakoutId: body.breakoutId, barberId: body.barberId } }
      )
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: ERROR_MESSAGES.DATABASE_ERROR },
        { status: 500 }
      )
    }
    
    console.log('[API/Breakouts] Deactivated breakout:', body.breakoutId)
    
    return NextResponse.json({ success: true })
    
  } catch (err) {
    console.error('[API/Breakouts] DELETE exception:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Delete breakout exception',
      { severity: 'high' }
    )
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
