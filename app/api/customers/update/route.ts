/**
 * POST /api/customers/update
 * 
 * Update customer details.
 * Uses service_role to bypass RLS for secure customer management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportServerError } from '@/lib/bug-reporter/helpers'

const updateSchema = z.object({
  customerId: z.string().uuid('מזהה לקוח לא תקין'),
  fullname: z.string().min(2, 'שם לא תקין').optional(),
  email: z.string().email('אימייל לא תקין').optional(),
  supabaseUid: z.string().optional(),
  authMethod: z.enum(['phone', 'email', 'both']).optional(),
  lastLoginAt: z.boolean().optional(), // If true, update last_login_at
})

export async function POST(request: NextRequest) {
  const requestId = `update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  try {
    const body = await request.json()
    const validation = updateSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    
    const { customerId, fullname, email, supabaseUid, authMethod, lastLoginAt } = validation.data
    
    if (!fullname && !email && !supabaseUid && !authMethod && !lastLoginAt) {
      return NextResponse.json(
        { success: false, error: 'לא נשלחו שדות לעדכון' },
        { status: 400 }
      )
    }
    
    console.log(`[${requestId}] Updating customer ${customerId}`)
    
    const supabase = createAdminClient()
    
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    
    if (fullname) {
      updateData.fullname = fullname.trim()
    }
    
    if (email) {
      const normalizedEmail = email.trim().toLowerCase()
      
      // Check if email is already used by another customer
      const { data: existingWithEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', normalizedEmail)
        .neq('id', customerId)
        .maybeSingle()
      
      if (existingWithEmail) {
        return NextResponse.json(
          { success: false, error: 'כתובת האימייל כבר בשימוש' },
          { status: 409 }
        )
      }
      
      updateData.email = normalizedEmail
    }
    
    if (supabaseUid) {
      updateData.supabase_uid = supabaseUid
    }
    
    if (authMethod) {
      updateData.auth_method = authMethod
    }
    
    if (lastLoginAt) {
      updateData.last_login_at = new Date().toISOString()
    }
    
    const { data: updated, error: updateError } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customerId)
      .select()
      .single()
    
    if (updateError) {
      console.error(`[${requestId}] Error updating customer:`, updateError)
      throw updateError
    }
    
    console.log(`[${requestId}] Customer updated successfully`)
    return NextResponse.json({ success: true, customer: updated })
    
  } catch (error) {
    console.error(`[${requestId}] Error updating customer:`, error)
    
    await reportServerError(error, 'POST /api/customers/update', {
      route: '/api/customers/update',
      severity: 'medium',
      additionalData: { requestId },
    })
    
    return NextResponse.json(
      { success: false, error: 'שגיאה בעדכון פרטי לקוח' },
      { status: 500 }
    )
  }
}
