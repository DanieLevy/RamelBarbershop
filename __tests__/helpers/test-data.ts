/**
 * Test Data Module
 * 
 * Provides real database entities for realistic test scenarios.
 * All IDs correspond to actual records in the database.
 */

// ============================================================
// Barbers (from users table)
// ============================================================

export const TEST_BARBERS = {
  admin: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    username: 'ramel',
    fullname: 'רמאל לאוסאני',
    role: 'admin' as const,
    is_active: true,
  },
  regular: {
    id: '17e7b237-9cbd-4eda-ac5c-58367ced16f6',
    username: 'ndava',
    fullname: 'תמיר שבו',
    role: 'barber' as const,
    is_active: true,
  },
} as const

// ============================================================
// Customers (from customers table)
// ============================================================

export const TEST_CUSTOMERS = {
  daniel: {
    id: '899a7701-cf3e-45a7-b185-f22441008b47',
    phone: '0502879998',
    fullname: 'דניאל לוי',
    is_blocked: false,
  },
  gal: {
    id: 'ea36c364-d297-4579-8cc7-4d5c205adcc0',
    phone: '0506883159',
    fullname: 'גל בן יעקב',
    is_blocked: false,
  },
  akiva: {
    id: 'f527e635-13f7-47f9-9b71-f76af3e12150',
    phone: '0556830833',
    fullname: 'עקיבא כהן',
    is_blocked: false,
  },
} as const

// ============================================================
// Services (from services table)
// NOTE: Each service belongs to a specific barber!
// ============================================================

export const TEST_SERVICES = {
  // Services for admin barber (רמאל לאוסאני)
  classic: {
    id: 'd3149338-1a32-4734-ba9d-ccef864aed95',
    name_he: 'תספורת קלאסית + זקן חדש!',
    duration: 30,
    price: 100,
    barber_id: '550e8400-e29b-41d4-a716-446655440001', // admin
  },
  skinFade: {
    id: '304abc3b-3282-4261-968b-ed1863e44936',
    name_he: 'סקין פייד / ריזור',
    duration: 30,
    price: 80,
    barber_id: '550e8400-e29b-41d4-a716-446655440001', // admin
  },
  beard: {
    id: '3fcf921f-edca-4687-927a-dbfbcc373733',
    name_he: 'עיצוב זקן קלאסי',
    duration: 10,
    price: 50,
    barber_id: '550e8400-e29b-41d4-a716-446655440001', // admin
  },
  // Services for regular barber (תמיר שבו)
  haircutBeard: {
    id: 'cbfa8795-5aef-4157-a492-a3edc296e690',
    name_he: 'תספורת גברים + זקן',
    duration: 30,
    price: 120,
    barber_id: '17e7b237-9cbd-4eda-ac5c-58367ced16f6', // regular
  },
} as const

// Helper: Get a valid service for a specific barber
export const getServiceForBarber = (barberId: string) => {
  if (barberId === TEST_BARBERS.admin.id) {
    return TEST_SERVICES.classic // Admin's service
  }
  return TEST_SERVICES.haircutBeard // Regular barber's service
}

// ============================================================
// Test UUID Helpers
// ============================================================

export const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001'
export const INVALID_UUID = 'not-a-valid-uuid'
export const NON_EXISTENT_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

// ============================================================
// Timestamp Helpers
// ============================================================

/**
 * Get a timestamp for tomorrow at a specific hour (in Israel timezone)
 */
export const getTomorrowAtHour = (hour: number): number => {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(hour, 0, 0, 0)
  return tomorrow.getTime()
}

/**
 * Get a timestamp for a specific number of days from now
 */
export const getDaysFromNow = (days: number, hour: number = 10): number => {
  const now = new Date()
  const future = new Date(now)
  future.setDate(future.getDate() + days)
  future.setHours(hour, 0, 0, 0)
  return future.getTime()
}

/**
 * Get the start of a day timestamp
 */
export const getDayStart = (timestamp: number): number => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Get Hebrew day name from timestamp
 */
export const getHebrewDayName = (timestamp: number): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const date = new Date(timestamp)
  return days[date.getDay()]
}

/**
 * Get day number string from timestamp
 */
export const getDayNum = (timestamp: number): string => {
  const date = new Date(timestamp)
  return String(date.getDate())
}

// ============================================================
// Test Reservation Data Factory
// ============================================================

export interface CreateTestReservationData {
  barberId?: string
  serviceId?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  dateTimestamp?: number
  timeTimestamp?: number
  dayName?: string
  dayNum?: string
}

/**
 * Create a complete reservation data object with sensible defaults
 * Uses admin barber with a service that belongs to them
 */
export const createTestReservationData = (overrides: CreateTestReservationData = {}) => {
  const defaultTime = getTomorrowAtHour(10)
  const defaultDate = getDayStart(defaultTime)
  const barberId = overrides.barberId || TEST_BARBERS.admin.id
  // Ensure we use a service that belongs to the selected barber
  const service = getServiceForBarber(barberId)
  
  return {
    barberId: barberId,
    serviceId: service.id,
    customerId: TEST_CUSTOMERS.daniel.id,
    customerName: TEST_CUSTOMERS.daniel.fullname,
    customerPhone: TEST_CUSTOMERS.daniel.phone,
    dateTimestamp: defaultDate,
    timeTimestamp: defaultTime,
    dayName: getHebrewDayName(defaultTime),
    dayNum: getDayNum(defaultTime),
    ...overrides,
  }
}

// ============================================================
// Phone Number Helpers
// ============================================================

export const VALID_PHONES = {
  israeli05x: '0502879998',
  israeli972: '+972502879998',
  israeli972NoPlus: '972502879998',
}

export const INVALID_PHONES = {
  tooShort: '05028',
  tooLong: '050287999812345',
  withLetters: '0502abc998',
  empty: '',
}

// ============================================================
// Test Identifiers for Cleanup
// ============================================================

/**
 * Prefix for test data that should be cleaned up
 * Use this to identify test-created records
 */
export const TEST_DATA_PREFIX = '__TEST__'

/**
 * Generate a unique test identifier
 */
export const generateTestId = (): string => {
  return `${TEST_DATA_PREFIX}${Date.now()}_${Math.random().toString(36).substring(7)}`
}
