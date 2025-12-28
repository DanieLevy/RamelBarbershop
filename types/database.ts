export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'barber'

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
          email: string | null
          password_hash: string | null
          role: UserRole
          is_barber: boolean
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          username: string
          fullname: string
          img_url?: string | null
          phone?: string | null
          email?: string | null
          password_hash?: string | null
          role?: UserRole
          is_barber?: boolean
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          fullname?: string
          img_url?: string | null
          phone?: string | null
          email?: string | null
          password_hash?: string | null
          role?: UserRole
          is_barber?: boolean
          is_active?: boolean
          display_order?: number
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
      barbershop_settings: {
        Row: {
          id: string
          name: string
          phone: string | null
          address: string | null
          description: string | null
          work_hours_start: string
          work_hours_end: string
          open_days: string[]
          created_at: string
          updated_at: string
          // Dynamic content fields
          hero_title: string | null
          hero_subtitle: string | null
          hero_description: string | null
          // Location fields
          address_text: string | null
          address_lat: number | null
          address_lng: number | null
          waze_link: string | null
          google_maps_link: string | null
          // Contact & Social fields
          contact_phone: string | null
          contact_email: string | null
          contact_whatsapp: string | null
          social_instagram: string | null
          social_facebook: string | null
          social_tiktok: string | null
          // Visibility toggles
          show_phone: boolean
          show_email: boolean
          show_whatsapp: boolean
          show_instagram: boolean
          show_facebook: boolean
          show_tiktok: boolean
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          address?: string | null
          description?: string | null
          work_hours_start?: string
          work_hours_end?: string
          open_days?: string[]
          created_at?: string
          updated_at?: string
          // Dynamic content fields
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
          // Location fields
          address_text?: string | null
          address_lat?: number | null
          address_lng?: number | null
          waze_link?: string | null
          google_maps_link?: string | null
          // Contact & Social fields
          contact_phone?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          social_instagram?: string | null
          social_facebook?: string | null
          social_tiktok?: string | null
          // Visibility toggles
          show_phone?: boolean
          show_email?: boolean
          show_whatsapp?: boolean
          show_instagram?: boolean
          show_facebook?: boolean
          show_tiktok?: boolean
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          address?: string | null
          description?: string | null
          work_hours_start?: string
          work_hours_end?: string
          open_days?: string[]
          created_at?: string
          updated_at?: string
          // Dynamic content fields
          hero_title?: string | null
          hero_subtitle?: string | null
          hero_description?: string | null
          // Location fields
          address_text?: string | null
          address_lat?: number | null
          address_lng?: number | null
          waze_link?: string | null
          google_maps_link?: string | null
          // Contact & Social fields
          contact_phone?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          social_instagram?: string | null
          social_facebook?: string | null
          social_tiktok?: string | null
          // Visibility toggles
          show_phone?: boolean
          show_email?: boolean
          show_whatsapp?: boolean
          show_instagram?: boolean
          show_facebook?: boolean
          show_tiktok?: boolean
        }
      }
      barbershop_closures: {
        Row: {
          id: string
          start_date: string
          end_date: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          start_date: string
          end_date: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          start_date?: string
          end_date?: string
          reason?: string | null
          created_at?: string
        }
      }
      barber_schedules: {
        Row: {
          id: string
          barber_id: string
          work_days: string[]
          work_hours_start: string
          work_hours_end: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          barber_id: string
          work_days?: string[]
          work_hours_start?: string
          work_hours_end?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          barber_id?: string
          work_days?: string[]
          work_hours_start?: string
          work_hours_end?: string
          created_at?: string
          updated_at?: string
        }
      }
      barber_closures: {
        Row: {
          id: string
          barber_id: string
          start_date: string
          end_date: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          barber_id: string
          start_date: string
          end_date: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          barber_id?: string
          start_date?: string
          end_date?: string
          reason?: string | null
          created_at?: string
        }
      }
      barber_messages: {
        Row: {
          id: string
          barber_id: string
          message: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          barber_id: string
          message: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          barber_id?: string
          message?: string
          is_active?: boolean
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
          barber_id: string | null
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
          barber_id?: string | null
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
          barber_id?: string | null
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
          cancelled_by: 'customer' | 'barber' | null
          cancellation_reason: string | null
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
          cancelled_by?: 'customer' | 'barber' | null
          cancellation_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          barber_id?: string
          service_id?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          cancelled_by?: 'customer' | 'barber' | null
          cancellation_reason?: string | null
          date_timestamp?: number
          time_timestamp?: number
          day_name?: string
          day_num?: string
          status?: 'confirmed' | 'cancelled' | 'completed'
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          name_he: string
          description: string | null
          price: number
          image_url: string | null
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          name_he: string
          description?: string | null
          price: number
          image_url?: string | null
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_he?: string
          description?: string | null
          price?: number
          image_url?: string | null
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
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
export type BarbershopSettings = Database['public']['Tables']['barbershop_settings']['Row']
export type BarbershopClosure = Database['public']['Tables']['barbershop_closures']['Row']
export type BarberSchedule = Database['public']['Tables']['barber_schedules']['Row']
export type BarberClosure = Database['public']['Tables']['barber_closures']['Row']
export type BarberMessage = Database['public']['Tables']['barber_messages']['Row']
export type WorkDay = Database['public']['Tables']['work_days']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type Reservation = Database['public']['Tables']['reservations']['Row']
export type ReservationInsert = Database['public']['Tables']['reservations']['Insert']
export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export interface BarberWithWorkDays extends User {
  work_days: WorkDay[]
}

export interface BarberWithSchedule extends User {
  barber_schedules?: BarberSchedule[]
  barber_closures?: BarberClosure[]
  barber_messages?: BarberMessage[]
}

export interface TimeSlot {
  time_timestamp: number
  is_available: boolean
}

// Session storage type for customers
export interface StoredSession {
  customerId: string
  phone: string
  fullname: string
  expiresAt: number
}

// Session storage type for barbers
export interface BarberSession {
  barberId: string
  email: string
  fullname: string
  role: UserRole
  expiresAt: number
}

// Reservation with service details
export interface ReservationWithDetails extends Reservation {
  services?: Service
  users?: User
  customers?: Customer
}
