/**
 * POST /api/customers/get-or-create
 * 
 * Get or create a customer using SMS/Phone authentication.
 * Uses service_role to bypass RLS for secure customer management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportApiError } from '@/lib/bug-reporter/helpers'

const getOrCreateSchema = z.object({
  phone: z.string().min(9, 'מספר טלפון לא תקין').max(15),
  fullname: z.string().min(2, 'שם לא תקין'),
  providerUid: z.string().optional(),
  email: z.string().email('כתובת אימייל לא תקינה').optional(),
  supabaseUid: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const requestId = `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  try {
    const body = await request.json()
    const validation = getOrCreateSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    
    const { phone, fullname, providerUid, email, supabaseUid } = validation.data
    const normalizedPhone = phone.replace(/\D/g, '')
    const normalizedEmail = email?.trim().toLowerCase() || null
    
    console.log(`[${requestId}] Get or create customer for phone: ${normalizedPhone.slice(0, 3)}****`)
    
    const supabase = createAdminClient()
    
    // First check if customer exists by phone
    const { data: existing, error: findError } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle()
    
    if (findError) {
      console.error(`[${requestId}] Error finding customer:`, findError)
      throw findError
    }
    
    if (existing) {
      // Customer exists - update their record
      const hasEmail = existing.supabase_uid !== null && existing.supabase_uid !== undefined || normalizedEmail
      const newAuthMethod = hasEmail ? 'both' : 'phone'
      
      const updateData: Record<string, unknown> = {
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      // Handle provider UID update
      if (providerUid) {
        const existingUid = existing.provider_uid
        const shouldUpdateUid = 
          !existingUid ||
          (providerUid.startsWith('o19-') && !existingUid.startsWith('o19-')) ||
          existingUid === providerUid
        
        if (shouldUpdateUid) {
          updateData.provider_uid = providerUid
        }
      }
      
      // Handle email and supabase UID update
      if (normalizedEmail && !existing.email) {
        updateData.email = normalizedEmail
      }
      if (supabaseUid && !existing.supabase_uid) {
        updateData.supabase_uid = supabaseUid
      }
      
      // Update auth_method if needed
      if (newAuthMethod === 'both' || !existing.auth_method || existing.auth_method === 'email') {
        updateData.auth_method = newAuthMethod
      }
      
      const { data: updated, error: updateError } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single()
      
      if (updateError) {
        console.error(`[${requestId}] Error updating customer:`, updateError)
        return NextResponse.json({ success: true, customer: existing })
      }
      
      console.log(`[${requestId}] Updated existing customer ${existing.id}`)
      return NextResponse.json({ success: true, customer: updated })
    }
    
    // Create new customer with email auth support
    const authMethod = normalizedEmail ? 'email' : 'phone'
    
    const { data: created, error: createError } = await supabase
      .from('customers')
      .insert({
        phone: normalizedPhone,
        fullname: fullname.trim(),
        provider_uid: providerUid || null,
        email: normalizedEmail,
        supabase_uid: supabaseUid || null,
        auth_method: authMethod,
        last_login_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (createError) {
      console.error(`[${requestId}] Error creating customer:`, createError)
      throw createError
    }
    
    console.log(`[${requestId}] Created new customer ${created.id}`)
    return NextResponse.json({ success: true, customer: created })
    
  } catch (error) {
    console.error(`[${requestId}] Error in get-or-create customer:`, error)
    
    await reportApiError(error, request, 'Get or create customer failed', {
      severity: 'high',
      additionalData: { requestId },
    })
    
    return NextResponse.json(
      { success: false, error: 'שגיאה בטיפול בלקוח' },
      { status: 500 }
    )
  }
}
