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
  connectionType?: string
  connectionEffective?: string
  isPWA?: boolean
}

export interface ChunkDiagnostics {
  failedChunkUrl?: string
  swInstalled: boolean
  swController: boolean
  swControllerUrl?: string
  swWaiting: boolean
  swVersion?: string
  cacheNames: string[]
  cachedChunkCount: number
  previousRecoveryTs?: string
  recoverySource: 'inline-script' | 'error-boundary' | 'global-handler' | 'sw-notification'
  isPWA: boolean
  displayMode?: string
  documentUrl: string
  referrer?: string
}

export interface BugReportData {
  error: {
    name: string
    message: string
    stack?: string
  }
  
  action: string
  page: string
  route?: string
  component?: string
  
  user?: UserContext
  environment?: EnvironmentInfo
  additionalData?: Record<string, unknown>
  
  severity?: BugSeverity
  timestamp?: string
  appVersion?: string
}

export interface BugReportPayload extends BugReportData {
  timestamp: string
  appVersion: string
  reportId: string
}
