import { NextRequest } from 'next/server'

/**
 * Validate dev token from request headers
 * Returns true if the token is valid
 */
export function validateDevToken(request: NextRequest): boolean {
  const token = request.headers.get('X-Dev-Token')
  
  if (!token) {
    return false
  }
  
  // Token format: dev_{timestamp}_{random}
  // We just check that it starts with 'dev_' and has the right format
  if (!token.startsWith('dev_')) {
    return false
  }
  
  const parts = token.split('_')
  if (parts.length !== 3) {
    return false
  }
  
  return true
}

/**
 * Create a standardized error response for unauthorized requests
 */
export function unauthorizedResponse() {
  return Response.json(
    { error: 'Unauthorized', message: 'Invalid or missing dev token' },
    { status: 401 }
  )
}
