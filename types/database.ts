export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          fullname: string
          img_url: string | null
          phone: string | null
          is_barber: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          username: string
          fullname: string
          img_url?: string | null
          phone?: string | null
          is_barber?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          fullname?: string
          img_url?: string | null
          phone?: string | null
          is_barber?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          phone: string
          fullname: string
          firebase_uid: string | null
          last_login_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone: string
          fullname: string
          firebase_uid?: string | null
          last_login_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string
          fullname?: string
          firebase_uid?: string | null
          last_login_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      work_days: {
        Row: {
          id: string
          user_id: string
          day_of_week: string
          is_working: boolean
          start_time: string | null
          end_time: string | null
        }
        Insert: {
          id?: string
          user_id: string
          day_of_week: string
          is_working?: boolean
          start_time?: string | null
          end_time?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          day_of_week?: string
          is_working?: boolean
          start_time?: string | null
          end_time?: string | null
        }
      }
      services: {
        Row: {
          id: string
          name: string
          name_he: string
          description: string | null
          duration: number
          price: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          name_he: string
          description?: string | null
          duration: number
          price: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_he?: string
          description?: string | null
          duration?: number
          price?: number
          is_active?: boolean
          created_at?: string
        }
      }
      reservations: {
        Row: {
          id: string
          barber_id: string
          service_id: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          date_timestamp: number
          time_timestamp: number
          day_name: string
          day_num: string
          status: 'confirmed' | 'cancelled' | 'completed'
          created_at: string
        }
        Insert: {
          id?: string
          barber_id: string
          service_id: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          date_timestamp: number
          time_timestamp: number
          day_name: string
          day_num: string
          status?: 'confirmed' | 'cancelled' | 'completed'
          created_at?: string
        }
        Update: {
          id?: string
          barber_id?: string
          service_id?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          date_timestamp?: number
          time_timestamp?: number
          day_name?: string
          day_num?: string
          status?: 'confirmed' | 'cancelled' | 'completed'
          created_at?: string
        }
      }
    }
    Functions: {
      get_available_time_slots: {
        Args: {
          p_barber_id: string
          p_date_timestamp: number
        }
        Returns: {
          time_timestamp: number
          is_available: boolean
        }[]
      }
    }
  }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type WorkDay = Database['public']['Tables']['work_days']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type Reservation = Database['public']['Tables']['reservations']['Row']
export type ReservationInsert = Database['public']['Tables']['reservations']['Insert']

export interface BarberWithWorkDays extends User {
  work_days: WorkDay[]
}

export interface TimeSlot {
  time_timestamp: number
  is_available: boolean
}

// Session storage type
export interface StoredSession {
  customerId: string
  phone: string
  fullname: string
  expiresAt: number // Unix timestamp in milliseconds
}

// Reservation with service details
export interface ReservationWithDetails extends Reservation {
  services?: Service
  users?: User
}
