/**
 * Database Types - Auto-generated from Supabase schema
 * 
 * INDEX MONITORING (Added: 2026-01-27)
 * =====================================
 * The following indexes have 0 scans as of this date and should be monitored
 * for 30 days before considering removal. Check usage with:
 * 
 * SELECT indexrelname, idx_scan FROM pg_stat_user_indexes 
 * WHERE indexrelname IN (...) ORDER BY idx_scan;
 * 
 * Indexes to monitor (review after 2026-02-27):
 * - idx_reservations_date (reservations)
 * - idx_reservations_barber_id (reservations)
 * - idx_reservations_service_id (reservations)
 * - idx_reservations_reminder_window (reservations)
 * - idx_notification_logs_unread (notification_logs)
 * - idx_notification_logs_recipient (notification_logs)
 * - idx_notification_logs_type (notification_logs)
 * - idx_services_barber_id (services)
 * - idx_users_is_barber (users)
 * 
 * New indexes added (2026-01-27):
 * - idx_users_active_barbers (users) - for barber homepage queries
 * - idx_services_barber_active_cover (services) - covering index for service lookups
 * - idx_reservations_date_barber_status (reservations) - composite for date range queries
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      barber_closures: {
        Row: {
          barber_id: string
          created_at: string | null
          end_date: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          barber_id: string
          created_at?: string | null
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          barber_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_closures_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_gallery: {
        Row: {
          id: string
          barber_id: string
          image_url: string
          display_order: number
          position_x: number | null
          position_y: number | null
          caption: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          barber_id: string
          image_url: string
          display_order?: number
          position_x?: number | null
          position_y?: number | null
          caption?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          barber_id?: string
          image_url?: string
          display_order?: number
          position_x?: number | null
          position_y?: number | null
          caption?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barber_gallery_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_messages: {
        Row: {
          barber_id: string
          created_at: string | null
          id: string
          is_active: boolean
          message: string
          updated_at: string | null
        }
        Insert: {
          barber_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          updated_at?: string | null
        }
        Update: {
          barber_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barber_messages_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_notification_settings: {
        Row: {
          barber_id: string
          broadcast_enabled: boolean
          created_at: string | null
          id: string
          min_cancel_hours: number
          notify_on_customer_cancel: boolean
          notify_on_new_booking: boolean
          reminder_hours_before: number
          updated_at: string | null
        }
        Insert: {
          barber_id: string
          broadcast_enabled?: boolean
          created_at?: string | null
          id?: string
          min_cancel_hours?: number
          notify_on_customer_cancel?: boolean
          notify_on_new_booking?: boolean
          reminder_hours_before?: number
          updated_at?: string | null
        }
        Update: {
          barber_id?: string
          broadcast_enabled?: boolean
          created_at?: string | null
          id?: string
          min_cancel_hours?: number
          notify_on_customer_cancel?: boolean
          notify_on_new_booking?: boolean
          reminder_hours_before?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barber_notification_settings_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_schedules: {
        Row: {
          barber_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          work_days: string[]
          work_hours_end: string
          work_hours_start: string
        }
        Insert: {
          barber_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          work_days?: string[]
          work_hours_end?: string
          work_hours_start?: string
        }
        Update: {
          barber_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          work_days?: string[]
          work_hours_end?: string
          work_hours_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_schedules_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershop_closures: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: []
      }
      barbershop_settings: {
        Row: {
          address: string | null
          address_lat: number | null
          address_lng: number | null
          address_text: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          created_at: string | null
          default_reminder_hours: number | null
          description: string | null
          google_maps_link: string | null
          hero_description: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          max_booking_days_ahead: number
          name: string
          open_days: string[]
          phone: string | null
          show_email: boolean | null
          show_facebook: boolean | null
          show_instagram: boolean | null
          show_phone: boolean | null
          show_tiktok: boolean | null
          show_whatsapp: boolean | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          updated_at: string | null
          waze_link: string | null
          work_hours_end: string
          work_hours_start: string
        }
        Insert: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          address_text?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          default_reminder_hours?: number | null
          description?: string | null
          google_maps_link?: string | null
          hero_description?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          max_booking_days_ahead?: number
          name?: string
          open_days?: string[]
          phone?: string | null
          show_email?: boolean | null
          show_facebook?: boolean | null
          show_instagram?: boolean | null
          show_phone?: boolean | null
          show_tiktok?: boolean | null
          show_whatsapp?: boolean | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          updated_at?: string | null
          waze_link?: string | null
          work_hours_end?: string
          work_hours_start?: string
        }
        Update: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          address_text?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          default_reminder_hours?: number | null
          description?: string | null
          google_maps_link?: string | null
          hero_description?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          max_booking_days_ahead?: number
          name?: string
          open_days?: string[]
          phone?: string | null
          show_email?: boolean | null
          show_facebook?: boolean | null
          show_instagram?: boolean | null
          show_phone?: boolean | null
          show_tiktok?: boolean | null
          show_whatsapp?: boolean | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          updated_at?: string | null
          waze_link?: string | null
          work_hours_end?: string
          work_hours_start?: string
        }
        Relationships: []
      }
      customer_notification_settings: {
        Row: {
          cancellation_alerts_enabled: boolean | null
          created_at: string | null
          customer_id: string
          id: string
          notifications_enabled: boolean | null
          pwa_installed: boolean | null
          reminder_enabled: boolean | null
          sms_reminder_enabled: boolean | null
          push_reminder_enabled: boolean | null
          reminder_method: 'sms' | 'push' | 'both' | 'none' | null
          updated_at: string | null
        }
        Insert: {
          cancellation_alerts_enabled?: boolean | null
          created_at?: string | null
          customer_id: string
          id?: string
          notifications_enabled?: boolean | null
          pwa_installed?: boolean | null
          reminder_enabled?: boolean | null
          sms_reminder_enabled?: boolean | null
          push_reminder_enabled?: boolean | null
          reminder_method?: 'sms' | 'push' | 'both' | 'none' | null
          updated_at?: string | null
        }
        Update: {
          cancellation_alerts_enabled?: boolean | null
          created_at?: string | null
          customer_id?: string
          id?: string
          notifications_enabled?: boolean | null
          pwa_installed?: boolean | null
          reminder_enabled?: boolean | null
          sms_reminder_enabled?: boolean | null
          push_reminder_enabled?: boolean | null
          reminder_method?: 'sms' | 'push' | 'both' | 'none' | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_notification_settings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_batch_logs: {
        Row: {
          id: string
          executed_at: string | null
          duration_ms: number | null
          total_reservations: number | null
          sms_sent: number
          sms_failed: number
          push_sent: number
          push_failed: number
          skipped_already_sent: number
          skipped_disabled: number
          skipped_no_phone: number
          details: Json | null
          trigger_source: string | null
        }
        Insert: {
          id?: string
          executed_at?: string | null
          duration_ms?: number | null
          total_reservations?: number | null
          sms_sent?: number
          sms_failed?: number
          push_sent?: number
          push_failed?: number
          skipped_already_sent?: number
          skipped_disabled?: number
          skipped_no_phone?: number
          details?: Json | null
          trigger_source?: string | null
        }
        Update: {
          id?: string
          executed_at?: string | null
          duration_ms?: number | null
          total_reservations?: number | null
          sms_sent?: number
          sms_failed?: number
          push_sent?: number
          push_failed?: number
          skipped_already_sent?: number
          skipped_disabled?: number
          skipped_no_phone?: number
          details?: Json | null
          trigger_source?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          auth_method: string | null
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string | null
          email: string | null
          firebase_uid: string | null // Legacy - kept for backward compatibility during migration
          provider_uid: string | null // New column - SMS provider UID (e.g., "o19-0501234567")
          fullname: string
          id: string
          is_blocked: boolean | null
          last_login_at: string | null
          phone: string
          supabase_uid: string | null
          updated_at: string | null
        }
        Insert: {
          auth_method?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string | null
          email?: string | null
          firebase_uid?: string | null // Legacy - kept for backward compatibility during migration
          provider_uid?: string | null // New column - SMS provider UID
          fullname: string
          id?: string
          is_blocked?: boolean | null
          last_login_at?: string | null
          phone: string
          supabase_uid?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_method?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string | null
          email?: string | null
          firebase_uid?: string | null // Legacy - kept for backward compatibility during migration
          provider_uid?: string | null // New column - SMS provider UID
          fullname?: string
          id?: string
          is_blocked?: boolean | null
          last_login_at?: string | null
          phone?: string
          supabase_uid?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          id: string
          customer_id: string
          phone: string
          device_token: string
          device_fingerprint: string | null
          user_agent: string | null
          created_at: string | null
          expires_at: string
          last_used_at: string | null
          is_active: boolean | null
        }
        Insert: {
          id?: string
          customer_id: string
          phone: string
          device_token: string
          device_fingerprint?: string | null
          user_agent?: string | null
          created_at?: string | null
          expires_at: string
          last_used_at?: string | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          customer_id?: string
          phone?: string
          device_token?: string
          device_fingerprint?: string | null
          user_agent?: string | null
          created_at?: string | null
          expires_at?: string
          last_used_at?: string | null
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "trusted_devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_logs: {
        Row: {
          body: string
          created_at: string | null
          devices_failed: number
          devices_succeeded: number
          devices_targeted: number
          error_message: string | null
          id: string
          is_read: boolean | null
          notification_type: string
          payload: Json | null
          recipient_id: string
          recipient_type: string
          reservation_id: string | null
          sender_id: string | null
          sent_at: string | null
          status: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          devices_failed?: number
          devices_succeeded?: number
          devices_targeted?: number
          error_message?: string | null
          id?: string
          is_read?: boolean | null
          notification_type: string
          payload?: Json | null
          recipient_id: string
          recipient_type: string
          reservation_id?: string | null
          sender_id?: string | null
          sent_at?: string | null
          status?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          devices_failed?: number
          devices_succeeded?: number
          devices_targeted?: number
          error_message?: string | null
          id?: string
          is_read?: boolean | null
          notification_type?: string
          payload?: Json | null
          recipient_id?: string
          recipient_type?: string
          reservation_id?: string | null
          sender_id?: string | null
          sent_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_he: string
          price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_he: string
          price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_he?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          barber_id: string | null
          consecutive_failures: number | null
          created_at: string | null
          customer_id: string | null
          device_name: string | null
          device_type: string
          endpoint: string
          id: string
          is_active: boolean | null
          last_delivery_status: string | null
          last_used: string | null
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          barber_id?: string | null
          consecutive_failures?: number | null
          created_at?: string | null
          customer_id?: string | null
          device_name?: string | null
          device_type?: string
          endpoint: string
          id?: string
          is_active?: boolean | null
          last_delivery_status?: string | null
          last_used?: string | null
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          barber_id?: string | null
          consecutive_failures?: number | null
          created_at?: string | null
          customer_id?: string | null
          device_name?: string | null
          device_type?: string
          endpoint?: string
          id?: string
          is_active?: boolean | null
          last_delivery_status?: string | null
          last_used?: string | null
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          barber_id: string
          barber_notes: string | null
          cancellation_reason: string | null
          cancelled_by: string | null
          created_at: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          date_timestamp: number
          day_name: string
          day_num: string
          id: string
          service_id: string
          status: string | null
          time_timestamp: number
          version: number
        }
        Insert: {
          barber_id: string
          barber_notes?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          date_timestamp: number
          day_name: string
          day_num: string
          id?: string
          service_id: string
          status?: string | null
          version?: number
          time_timestamp: number
        }
        Update: {
          barber_id?: string
          barber_notes?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          date_timestamp?: number
          day_name?: string
          day_num?: string
          id?: string
          service_id?: string
          status?: string | null
          time_timestamp?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservations_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          barber_id: string | null
          created_at: string | null
          description: string | null
          duration: number
          id: string
          is_active: boolean | null
          name: string
          name_he: string
          price: number
        }
        Insert: {
          barber_id?: string | null
          created_at?: string | null
          description?: string | null
          duration: number
          id?: string
          is_active?: boolean | null
          name: string
          name_he: string
          price: number
        }
        Update: {
          barber_id?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number
          id?: string
          is_active?: boolean | null
          name?: string
          name_he?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          display_order: number | null
          email: string | null
          fullname: string
          id: string
          img_url: string | null
          img_position_x: number | null
          img_position_y: number | null
          instagram_url: string | null
          is_active: boolean
          is_barber: boolean | null
          name_en: string | null
          password_hash: string | null
          phone: string | null
          role: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          email?: string | null
          fullname: string
          id?: string
          img_url?: string | null
          img_position_x?: number | null
          img_position_y?: number | null
          instagram_url?: string | null
          is_active?: boolean
          is_barber?: boolean | null
          name_en?: string | null
          password_hash?: string | null
          phone?: string | null
          role?: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          email?: string | null
          fullname?: string
          id?: string
          img_url?: string | null
          img_position_x?: number | null
          img_position_y?: number | null
          instagram_url?: string | null
          is_active?: boolean
          is_barber?: boolean | null
          name_en?: string | null
          password_hash?: string | null
          phone?: string | null
          role?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      work_days: {
        Row: {
          day_of_week: string
          end_time: string | null
          id: string
          is_working: boolean | null
          start_time: string | null
          user_id: string | null
        }
        Insert: {
          day_of_week: string
          end_time?: string | null
          id?: string
          is_working?: boolean | null
          start_time?: string | null
          user_id?: string | null
        }
        Update: {
          day_of_week?: string
          end_time?: string | null
          id?: string
          is_working?: boolean | null
          start_time?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_reservation_atomic: {
        Args: {
          p_barber_id: string
          p_service_id: string
          p_customer_id: string
          p_customer_name: string
          p_customer_phone: string
          p_date_timestamp: number
          p_time_timestamp: number
          p_day_name: string
          p_day_num: string
          p_barber_notes?: string | null
        }
        Returns: string
      }
      get_available_time_slots:
        | {
            Args: {
              p_barber_id: string
              p_date: string
              p_service_duration: number
            }
            Returns: {
              slot_time: string
            }[]
          }
        | {
            Args: { p_barber_id: string; p_date_timestamp: number }
            Returns: {
              is_available: boolean
              time_timestamp: number
            }[]
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// =============================================================================
// SUPABASE GENERATED HELPER TYPES
// =============================================================================

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// =============================================================================
// CUSTOM CONVENIENCE TYPES
// =============================================================================

export type UserRole = 'admin' | 'barber'

// Row types (for reading)
export type User = Tables<'users'>
export type Customer = Tables<'customers'>
export type BarbershopSettings = Tables<'barbershop_settings'>
export type BarbershopClosure = Tables<'barbershop_closures'>
export type BarberSchedule = Tables<'barber_schedules'>
export type BarberClosure = Tables<'barber_closures'>
export type BarberMessage = Tables<'barber_messages'>
export type BarberGalleryImage = Tables<'barber_gallery'>
export type WorkDay = Tables<'work_days'>
export type Service = Tables<'services'>
export type Reservation = Tables<'reservations'>
export type Product = Tables<'products'>

// Insert types
export type ReservationInsert = TablesInsert<'reservations'>
export type ProductInsert = TablesInsert<'products'>

// Update types
export type ProductUpdate = TablesUpdate<'products'>
export type ReservationUpdate = TablesUpdate<'reservations'>

// Push notification types from Database
export type PushSubscriptionRow = Tables<'push_subscriptions'>
export type PushSubscriptionInsert = TablesInsert<'push_subscriptions'>
export type NotificationLog = Tables<'notification_logs'>
export type NotificationLogInsert = TablesInsert<'notification_logs'>
export type BarberNotificationSettingsRow = Tables<'barber_notification_settings'>
export type CustomerNotificationSettingsRow = Tables<'customer_notification_settings'>

// Trusted device types
export type TrustedDevice = Tables<'trusted_devices'>
export type TrustedDeviceInsert = TablesInsert<'trusted_devices'>
export type TrustedDeviceUpdate = TablesUpdate<'trusted_devices'>

// Reminder batch log types
export type ReminderBatchLog = Tables<'reminder_batch_logs'>
export type ReminderBatchLogInsert = TablesInsert<'reminder_batch_logs'>

// =============================================================================
// EXTENDED TYPES (with relations)
// =============================================================================

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

// =============================================================================
// PUSH NOTIFICATIONS
// =============================================================================

// Device types for push notifications
export type PushDeviceType = 'ios' | 'android' | 'desktop'

// Push subscription database record
export interface PushSubscription {
  id: string
  customer_id: string | null
  barber_id: string | null
  endpoint: string
  p256dh: string
  auth: string
  device_type: PushDeviceType
  device_name: string | null
  user_agent: string | null
  is_active: boolean | null
  consecutive_failures: number | null
  last_delivery_status: 'success' | 'failed' | 'pending' | 'user_deleted' | null
  last_used: string | null
  created_at: string | null
}

// Customer notification settings database record
export interface CustomerNotificationSettings {
  id: string
  customer_id: string
  pwa_installed: boolean
  notifications_enabled: boolean
  reminder_enabled: boolean
  cancellation_alerts_enabled: boolean
  created_at: string
  updated_at: string
}

// Notification payload for sending
export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  url?: string
  tag?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string; icon?: string }>
  data?: Record<string, unknown>
  badgeCount?: number
}

// Push notification device info for display
export interface PushDeviceInfo {
  id: string
  deviceType: PushDeviceType
  deviceName: string | null
  lastUsed: string | null
  createdAt: string | null
}
