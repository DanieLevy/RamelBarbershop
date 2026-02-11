/**
 * POST /api/barbers/create
 * 
 * Creates a new barber with all related settings.
 * Uses service_role to bypass RLS for inserting into:
 * - users (main barber record)
 * - work_days (default schedule)
 * - barber_notification_settings (notification preferences)
 * - barber_booking_settings (booking/cancellation policies)
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportApiError } from '@/lib/bug-reporter/helpers'

const SALT_ROUNDS = 10

const createBarberSchema = z.object({
  username: z.string().min(2, 'שם משתמש חייב להכיל לפחות 2 תווים'),
  fullname: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'barber']).default('barber'),
})

// Default open days (Sunday-Friday in Israel)
const defaultOpenDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export async function POST(request: NextRequest) {
  const requestId = `barber-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  try {
    const body = await request.json()
    const validation = createBarberSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    
    const { username, fullname, email, password, phone, role } = validation.data
    const normalizedEmail = email.toLowerCase().trim()
    
    console.log(`[${requestId}] Creating new barber: ${normalizedEmail}`)
    
    const supabase = createAdminClient()
    
    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'כתובת אימייל כבר קיימת במערכת' },
        { status: 409 }
      )
    }
    
    // Check if username already exists
    const { data: existingUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    
    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: 'שם משתמש כבר קיים במערכת' },
        { status: 409 }
      )
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    
    // Create the barber user
    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert({
        username,
        fullname,
        email: normalizedEmail,
        password_hash: passwordHash,
        phone: phone || null,
        role,
        is_barber: true,
        is_active: true,
      })
      .select('id, username, fullname, email, phone, role, is_barber, is_active')
      .single()
    
    if (createError) {
      console.error(`[${requestId}] Error creating barber:`, createError)
      await reportApiError(
        new Error(createError.message),
        request,
        'Create barber failed',
        { severity: 'critical', additionalData: { errorCode: createError.code, email: normalizedEmail, requestId } }
      )
      return NextResponse.json(
        { success: false, error: 'שגיאה ביצירת ספר חדש' },
        { status: 500 }
      )
    }
    
    console.log(`[${requestId}] Created barber user: ${createdUser.id}`)
    
    // Create default work_days entries
    const workDaysInserts = allDays.map(day => ({
      user_id: createdUser.id,
      day_of_week: day,
      is_working: defaultOpenDays.includes(day),
      start_time: defaultOpenDays.includes(day) ? '09:00' : null,
      end_time: defaultOpenDays.includes(day) ? '19:00' : null,
    }))
    
    const { error: workDaysError } = await supabase
      .from('work_days')
      .insert(workDaysInserts)
    
    if (workDaysError) {
      console.error(`[${requestId}] Error creating work_days:`, workDaysError)
      // Don't fail, just log
    }
    
    // Create default barber_notification_settings
    const { error: notificationSettingsError } = await supabase
      .from('barber_notification_settings')
      .insert({
        barber_id: createdUser.id,
        reminder_hours_before: 3,
        notify_on_customer_cancel: true,
        notify_on_new_booking: true,
        broadcast_enabled: true,
      })
    
    if (notificationSettingsError) {
      console.error(`[${requestId}] Error creating notification settings:`, notificationSettingsError)
      // Don't fail, just log
    }
    
    // Create default barber_booking_settings
    const { error: bookingSettingsError } = await supabase
      .from('barber_booking_settings')
      .insert({
        barber_id: createdUser.id,
        max_booking_days_ahead: 15,
        min_hours_before_booking: 1,
        min_cancel_hours: 2,
      })
    
    if (bookingSettingsError) {
      console.error(`[${requestId}] Error creating booking settings:`, bookingSettingsError)
      // Don't fail, just log
    }
    
    console.log(`[${requestId}] Barber created successfully with all settings`)
    
    // Invalidate homepage barbers cache so new barber appears immediately
    revalidateTag('barbers', 'max')
    
    return NextResponse.json({
      success: true,
      user: createdUser,
    })
    
  } catch (error) {
    console.error(`[${requestId}] Unexpected error creating barber:`, error)
    
    await reportApiError(
      error instanceof Error ? error : new Error(String(error)),
      request,
      'Create barber exception',
      { severity: 'critical', additionalData: { requestId } }
    )
    
    return NextResponse.json(
      { success: false, error: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
