/**
 * API Route: Barber Work Days
 * 
 * Manages barber work day schedules (per-day working hours).
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - PUT: Update existing work day or create if missing
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const WorkDaySchema = z.object({
  id: z.string().uuid().optional(),
  dayOfWeek: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
  isWorking: z.boolean(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
})

const UpdateWorkDaysSchema = z.object({
  barberId: z.string().uuid(),
  days: z.array(WorkDaySchema).min(1),
})

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = UpdateWorkDaysSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, days } = parsed.data
    const supabase = createAdminClient()
    const errors: string[] = []

    for (const day of days) {
      if (day.id) {
        // Update existing
        const { error } = await supabase
          .from('work_days')
          .update({
            is_working: day.isWorking,
            start_time: day.isWorking ? day.startTime : null,
            end_time: day.isWorking ? day.endTime : null,
          })
          .eq('id', day.id)

        if (error) {
          console.error(`[API/barber/work-days] Update error for ${day.dayOfWeek}:`, error)
          errors.push(`${day.dayOfWeek}: ${error.message}`)
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from('work_days')
          .insert({
            user_id: barberId,
            day_of_week: day.dayOfWeek,
            is_working: day.isWorking,
            start_time: day.isWorking ? day.startTime : null,
            end_time: day.isWorking ? day.endTime : null,
          })

        if (error) {
          console.error(`[API/barber/work-days] Insert error for ${day.dayOfWeek}:`, error)
          errors.push(`${day.dayOfWeek}: ${error.message}`)
        }
      }
    }

    if (errors.length > 0) {
      await reportApiError(new Error(errors.join('; ')), request, 'Update work days partial failure')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון ימי העבודה', details: errors },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/work-days] PUT exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Update work days exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
