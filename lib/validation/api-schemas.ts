/**
 * Zod Validation Schemas for API Endpoints
 * 
 * Provides runtime validation for all API inputs to ensure
 * data integrity and security at system boundaries.
 */

import { z } from 'zod'

// ============================================================
// Common Schemas
// ============================================================

/**
 * UUID validation schema
 */
export const UUIDSchema = z.string().uuid('Invalid UUID format')

/**
 * Phone number schema (Israeli format)
 */
export const PhoneSchema = z
  .string()
  .regex(/^(\+972|972|0)?[0-9]{9,10}$/, 'Invalid phone number format')
  .transform((val) => val.replace(/\D/g, ''))

/**
 * Timestamp schema (milliseconds since epoch)
 */
export const TimestampSchema = z.number().int().positive()

// ============================================================
// Reservation Schemas
// ============================================================

/**
 * Create reservation request schema
 */
export const CreateReservationSchema = z.object({
  barberId: UUIDSchema,
  serviceId: UUIDSchema,
  customerId: UUIDSchema,
  customerName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  customerPhone: PhoneSchema,
  dateTimestamp: TimestampSchema,
  timeTimestamp: TimestampSchema,
  dayName: z.string().min(1),
  dayNum: z.string().min(1),
})

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>

/**
 * Cancel reservation request schema
 */
export const CancelReservationSchema = z.object({
  reservationId: UUIDSchema,
  cancelledBy: z.enum(['customer', 'barber']),
  reason: z.string().max(500).optional(),
  version: z.number().int().positive().optional(),
})

export type CancelReservationInput = z.infer<typeof CancelReservationSchema>

// ============================================================
// Push Notification Schemas
// ============================================================

/**
 * Notify booking request schema
 */
export const NotifyBookingSchema = z.object({
  reservationId: UUIDSchema,
  customerId: UUIDSchema.optional(),
  barberId: UUIDSchema,
  customerName: z.string().min(1).max(100),
  barberName: z.string().max(100).optional(),
  serviceName: z.string().min(1).max(100),
  appointmentTime: TimestampSchema,
})

export type NotifyBookingInput = z.infer<typeof NotifyBookingSchema>

/**
 * Notify cancellation request schema
 */
export const NotifyCancellationSchema = z.object({
  reservationId: UUIDSchema,
  customerId: UUIDSchema.optional(),
  barberId: UUIDSchema,
  cancelledBy: z.enum(['customer', 'barber']),
  customerName: z.string().min(1).max(100),
  barberName: z.string().max(100).optional(),
  serviceName: z.string().min(1).max(100),
  appointmentTime: TimestampSchema,
  reason: z.string().max(500).optional(),
})

export type NotifyCancellationInput = z.infer<typeof NotifyCancellationSchema>

/**
 * Push subscription schema
 */
export const PushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  userType: z.enum(['customer', 'barber']),
  userId: UUIDSchema,
})

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionSchema>

/**
 * Unsubscribe push schema
 */
export const UnsubscribePushSchema = z.object({
  endpoint: z.string().url(),
})

export type UnsubscribePushInput = z.infer<typeof UnsubscribePushSchema>

/**
 * Broadcast notification schema (barber-only)
 */
export const BroadcastNotificationSchema = z.object({
  barberId: UUIDSchema,
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  targetType: z.enum(['all_customers', 'upcoming_today', 'upcoming_week']).optional(),
})

export type BroadcastNotificationInput = z.infer<typeof BroadcastNotificationSchema>

// ============================================================
// Bug Report Schema
// ============================================================

/**
 * Bug report request schema
 */
export const BugReportSchema = z.object({
  error: z.string().min(1).max(10000),
  context: z.string().max(500).optional(),
  component: z.string().max(100).optional(),
  userAgent: z.string().max(500).optional(),
  url: z.string().max(2000).optional(),
  timestamp: z.string().optional(),
  customerId: UUIDSchema.optional().nullable(),
  customerPhone: PhoneSchema.optional().nullable(),
  barberId: UUIDSchema.optional().nullable(),
  additionalInfo: z.record(z.string(), z.unknown()).optional(),
})

export type BugReportInput = z.infer<typeof BugReportSchema>

// ============================================================
// Customer Schemas
// ============================================================

/**
 * Customer login/create schema
 */
export const CustomerAuthSchema = z.object({
  phone: PhoneSchema,
  fullname: z.string().min(2).max(100),
  firebaseUid: z.string().min(1).optional(),
})

export type CustomerAuthInput = z.infer<typeof CustomerAuthSchema>

// ============================================================
// Barber Schemas
// ============================================================

/**
 * Barber login schema
 */
export const BarberLoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
})

export type BarberLoginInput = z.infer<typeof BarberLoginSchema>

/**
 * Manual booking schema (barber creates booking for customer)
 */
export const ManualBookingSchema = z.object({
  barberId: UUIDSchema,
  serviceId: UUIDSchema,
  customerName: z.string().min(2).max(100),
  customerPhone: PhoneSchema,
  dateTimestamp: TimestampSchema,
  timeTimestamp: TimestampSchema,
  dayName: z.string().min(1),
  dayNum: z.string().min(1),
})

export type ManualBookingInput = z.infer<typeof ManualBookingSchema>

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validate and parse input using a Zod schema
 * Returns parsed data or throws error with message
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: string; details: z.ZodIssue[] } {
  const result = schema.safeParse(input)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  // Format error message
  const errorMessages = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ')
  
  return {
    success: false,
    error: `Validation failed: ${errorMessages}`,
    details: result.error.issues,
  }
}

/**
 * Create a validation middleware for API routes
 * Returns parsed body or sends 400 response
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: Response }> {
  try {
    const body = await request.json()
    const result = validateInput(schema, body)
    
    if (result.success) {
      return { success: true, data: result.data }
    }
    
    console.error('[API Validation] Failed:', result.error)
    
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: result.error,
          details: result.details,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    }
  } catch {
    console.error('[API Validation] JSON parse error')
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    }
  }
}
