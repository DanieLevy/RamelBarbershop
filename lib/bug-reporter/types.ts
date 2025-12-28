/**
 * Bug Report Types
 */

export type BugSeverity = 'low' | 'medium' | 'high' | 'critical'

export type UserType = 'guest' | 'customer' | 'barber' | 'admin'

export interface UserContext {
  type: UserType
  id?: string
  name?: string
  email?: string
  phone?: string
}

export interface EnvironmentInfo {
  userAgent?: string
  platform?: string
  language?: string
  screenWidth?: number
  screenHeight?: number
  viewportWidth?: number
  viewportHeight?: number
  timezone?: string
  online?: boolean
}

export interface BugReportData {
  // Error details
  error: {
    name: string
    message: string
    stack?: string
  }
  
  // Context
  action: string
  page: string
  route?: string
  component?: string
  
  // User info
  user?: UserContext
  
  // Environment
  environment?: EnvironmentInfo
  
  // Additional data
  additionalData?: Record<string, unknown>
  
  // Metadata
  severity?: BugSeverity
  timestamp?: string
  appVersion?: string
}

export interface BugReportPayload extends BugReportData {
  timestamp: string
  appVersion: string
  reportId: string
}

