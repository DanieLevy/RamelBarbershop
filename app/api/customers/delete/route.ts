/**
 * DELETE /api/customers/delete
 *
 * Deletes a customer account:
 * 1. Cancels all future confirmed reservations
 * 2. Deactivates push subscriptions
 * 3. Deletes the customer row
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPushCaller } from '@/lib/auth/push-api-auth'
import { reportApiError } from '@/lib/bug-reporter/helpers'

const deleteSchema = z.object({
  customerId: z.string().uuid('מזהה לקוח לא תקין'),
})

export async function DELETE(request: NextRequest) {
  const requestId = `delete-customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  try {
    const body = await request.json()
    const validation = deleteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }

    const { customerId } = validation.data

    // Verify caller is the customer themselves
    const auth = await verifyPushCaller(request, body)
    if (!auth.success) return auth.response

    if (!auth.success || auth.userType !== 'customer' || auth.userId !== customerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    console.log(`[${requestId}] Deleting customer ${customerId}`)

    const supabase = createAdminClient()
    const now = Date.now()

    // Cancel all future confirmed reservations
    const { error: cancelError } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_by: 'customer',
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customerId)
      .eq('status', 'confirmed')
      .gt('time_timestamp', now)

    if (cancelError) {
      console.error(`[${requestId}] Error cancelling reservations:`, cancelError)
      throw cancelError
    }

    // Deactivate push subscriptions
    const { error: pushError } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('customer_id', customerId)

    if (pushError) {
      console.error(`[${requestId}] Error deactivating push subscriptions:`, pushError)
      // Non-fatal — proceed with deletion
    }

    // Delete the customer row
    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)

    if (deleteError) {
      console.error(`[${requestId}] Error deleting customer:`, deleteError)
      throw deleteError
    }

    console.log(`[${requestId}] Customer deleted successfully`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`[${requestId}] Error deleting customer:`, error)

    await reportApiError(error, request, 'Delete customer failed', {
      severity: 'high',
      additionalData: { requestId },
    })

    return NextResponse.json(
      { success: false, error: 'שגיאה במחיקת החשבון' },
      { status: 500 }
    )
  }
}
