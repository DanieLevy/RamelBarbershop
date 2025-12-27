import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/client'
import type { User, BarberSession } from '@/types/database'

const SALT_ROUNDS = 10
const SESSION_KEY = 'ramel_barber_session'
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Login barber with email and password
 */
export async function loginBarber(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const supabase = createClient()
  
  const normalizedEmail = email.toLowerCase().trim()
  
  // Find user by email - use maybeSingle to handle not found gracefully
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, fullname, email, phone, role, is_barber, is_active, img_url, password_hash, created_at, updated_at')
    .eq('email', normalizedEmail)
    .eq('is_barber', true)
    .eq('is_active', true)
    .maybeSingle()
  
  if (error) {
    console.error('Login error:', error)
    return { success: false, error: 'שגיאה בהתחברות. נסה שוב.' }
  }
  
  if (!user) {
    return { success: false, error: 'אימייל או סיסמה שגויים' }
  }
  
  const barber = user as User
  
  if (!barber.password_hash) {
    return { success: false, error: 'חשבון לא מאותחל - פנה למנהל' }
  }
  
  // Verify password
  const isValid = await comparePassword(password, barber.password_hash)
  
  if (!isValid) {
    return { success: false, error: 'אימייל או סיסמה שגויים' }
  }
  
  // Save session
  saveBarberSession(barber)
  
  return { success: true, user: barber }
}

/**
 * Save barber session to localStorage
 */
export function saveBarberSession(user: User): void {
  if (typeof window === 'undefined') return
  
  const session: BarberSession = {
    barberId: user.id,
    email: user.email || '',
    fullname: user.fullname,
    role: user.role,
    expiresAt: Date.now() + SESSION_EXPIRY_MS,
  }
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

/**
 * Get barber session from localStorage
 */
export function getBarberSession(): BarberSession | null {
  if (typeof window === 'undefined') return null
  
  const stored = localStorage.getItem(SESSION_KEY)
  if (!stored) return null
  
  try {
    const session: BarberSession = JSON.parse(stored)
    
    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    
    return session
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

/**
 * Clear barber session
 */
export function clearBarberSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}

/**
 * Validate session against database
 */
export async function validateBarberSession(): Promise<User | null> {
  const session = getBarberSession()
  if (!session) return null
  
  const supabase = createClient()
  
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, fullname, email, phone, role, is_barber, is_active, img_url, created_at, updated_at')
    .eq('id', session.barberId)
    .eq('is_barber', true)
    .eq('is_active', true)
    .maybeSingle()
  
  if (error) {
    console.error('Error validating session:', error)
    clearBarberSession()
    return null
  }
  
  if (!user) {
    clearBarberSession()
    return null
  }
  
  return user as User
}

/**
 * Create or update barber password
 */
export async function setBarberPassword(
  barberId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  const passwordHash = await hashPassword(newPassword)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('users') as any)
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', barberId)
  
  if (error) {
    console.error('Error setting password:', error)
    return { success: false, error: 'שגיאה בעדכון הסיסמה' }
  }
  
  return { success: true }
}

/**
 * Create a new barber user with default work days and schedule
 */
export async function createBarber(data: {
  username: string
  fullname: string
  email: string
  password: string
  phone?: string
  role?: 'admin' | 'barber'
}): Promise<{ success: boolean; user?: User; error?: string }> {
  const supabase = createClient()
  
  const normalizedEmail = data.email.toLowerCase().trim()
  
  // Check if email already exists - handle error gracefully
  const { data: existing, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()
  
  // If error is not "not found", log it but continue
  if (checkError && checkError.code !== 'PGRST116') {
    console.error('Error checking email:', checkError)
  }
  
  if (existing) {
    return { success: false, error: 'אימייל כבר קיים במערכת' }
  }
  
  const passwordHash = await hashPassword(data.password)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newUser, error } = await (supabase.from('users') as any)
    .insert({
      username: data.username,
      fullname: data.fullname,
      email: normalizedEmail,
      password_hash: passwordHash,
      phone: data.phone || null,
      role: data.role || 'barber',
      is_barber: true,
      is_active: true,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating barber:', error)
    const errorMessage = error.message || 'שגיאה ביצירת המשתמש'
    return { success: false, error: errorMessage }
  }
  
  const createdUser = newUser as User
  
  // Fetch barbershop settings to get default work days and hours
  const { data: shopSettingsData } = await supabase
    .from('barbershop_settings')
    .select('open_days, work_hours_start, work_hours_end')
    .limit(1)
    .single()
  
  const shopSettings = shopSettingsData as { open_days?: string[]; work_hours_start?: string; work_hours_end?: string } | null
  const defaultOpenDays = shopSettings?.open_days || ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  const defaultWorkHoursStart = shopSettings?.work_hours_start || '09:00'
  const defaultWorkHoursEnd = shopSettings?.work_hours_end || '19:00'
  
  // Create default work_days entries for the new barber
  const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const workDaysInserts = allDays.map(day => ({
    user_id: createdUser.id,
    day_of_week: day,
    is_working: defaultOpenDays.includes(day),
  }))
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: workDaysError } = await (supabase.from('work_days') as any)
    .insert(workDaysInserts)
  
  if (workDaysError) {
    console.error('Error creating default work_days:', workDaysError)
    // Don't fail the barber creation, just log the error
  }
  
  // Create default barber_schedules entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: scheduleError } = await (supabase.from('barber_schedules') as any)
    .insert({
      barber_id: createdUser.id,
      work_days: defaultOpenDays,
      work_hours_start: defaultWorkHoursStart,
      work_hours_end: defaultWorkHoursEnd,
    })
  
  if (scheduleError) {
    console.error('Error creating default barber_schedule:', scheduleError)
    // Don't fail the barber creation, just log the error
  }
  
  return { success: true, user: createdUser }
}

/**
 * Update barber details
 */
export async function updateBarber(
  barberId: string,
  updates: {
    fullname?: string
    email?: string
    phone?: string
    img_url?: string
    is_active?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('users') as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', barberId)
  
  if (error) {
    console.error('Error updating barber:', error)
    return { success: false, error: 'שגיאה בעדכון המשתמש' }
  }
  
  return { success: true }
}

/**
 * Get all barbers
 */
export async function getAllBarbers(): Promise<User[]> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, fullname, email, phone, role, is_barber, is_active, img_url, created_at, updated_at')
      .eq('is_barber', true)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching barbers:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw error
    }
    
    return (data as User[]) || []
  } catch (error) {
    console.error('Exception in getAllBarbers:', error)
    return []
  }
}

/**
 * Get barber by ID
 */
export async function getBarberById(barberId: string): Promise<User | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', barberId)
    .eq('is_barber', true)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data as User
}

