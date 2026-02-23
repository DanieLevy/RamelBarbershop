/**
 * API Route: R2 Image Upload
 *
 * Accepts a multipart FormData with:
 *   - barberId (string, UUID)  — for auth verification
 *   - key      (string)        — R2 object key (e.g. "avatars/barberId/123.jpg")
 *   - file     (File/Blob)     — the image binary
 *
 * Verifies the barber, uploads to Cloudflare R2 via S3-compatible SDK,
 * and returns the public URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { uploadToR2, isValidR2Key } from '@/lib/r2/client'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const barberId = formData.get('barberId') as string | null
    const key = formData.get('key') as string | null
    const file = formData.get('file') as File | null

    if (!barberId || !key || !file) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'barberId, key, and file are required' },
        { status: 400 }
      )
    }

    const auth = await verifyBarber(request, { barberId })
    if (!auth.success) return auth.response

    if (!isValidR2Key(key)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'Invalid object key prefix' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'File too large (max 10 MB)' },
        { status: 413 }
      )
    }

    const contentType = file.type || 'image/jpeg'
    const buffer = Buffer.from(await file.arrayBuffer())

    const url = await uploadToR2(key, buffer, contentType)

    return NextResponse.json({ success: true, data: { url, key } })
  } catch (err) {
    console.error('[API/barber/r2/upload] Exception:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'R2 upload failed'
    )
    return NextResponse.json(
      { success: false, error: 'UPLOAD_ERROR', message: 'שגיאה בהעלאת התמונה' },
      { status: 500 }
    )
  }
}
