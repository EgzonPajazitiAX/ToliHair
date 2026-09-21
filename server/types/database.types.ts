// Generated from the Phase 5 PostgreSQL schema.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          barber_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          duration_minutes: number
          ends_at: string
          id: string
          price_minor: number
          service_id: string
          service_name: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          version: number
        }
        Insert: {
          barber_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          duration_minutes: number
          ends_at: string
          id?: string
          price_minor: number
          service_id: string
          service_name: string
          source: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          barber_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          duration_minutes?: number
          ends_at?: string
          id?: string
          price_minor?: number
          service_id?: string
          service_name?: string
          source?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_services: {
        Row: {
          barber_id: string
          service_id: string
        }
        Insert: {
          barber_id: string
          service_id: string
        }
        Update: {
          barber_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          bio: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          profile_id: string | null
          revision: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bio?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          profile_id?: string | null
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bio?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          profile_id?: string | null
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barbers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_times: {
        Row: {
          barber_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          reason: string
          revision: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          reason?: string
          revision?: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          reason?: string
          revision?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_times_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          appointment_id: string
          created_at: string
          expires_at: string
          idempotency_key: string
          request_hash: string
          receipt_token: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          expires_at?: string
          idempotency_key: string
          request_hash: string
          receipt_token?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          expires_at?: string
          idempotency_key?: string
          request_hash?: string
          receipt_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_minor: number
          revision: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_minor: number
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_minor?: number
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      shop_settings: {
        Row: {
          address: string | null
          booking_enabled: boolean
          booking_horizon_days: number
          created_at: string
          currency: string | null
          id: boolean
          minimum_notice_minutes: number
          name: string
          phone: string | null
          revision: number
          slot_interval_minutes: number
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_enabled?: boolean
          booking_horizon_days?: number
          created_at?: string
          currency?: string | null
          id?: boolean
          minimum_notice_minutes?: number
          name?: string
          phone?: string | null
          revision?: number
          slot_interval_minutes?: number
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_enabled?: boolean
          booking_horizon_days?: number
          created_at?: string
          currency?: string | null
          id?: boolean
          minimum_notice_minutes?: number
          name?: string
          phone?: string | null
          revision?: number
          slot_interval_minutes?: number
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          barber_id: string
          created_at: string
          end_time: string
          id: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          barber_id: string
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          barber_id?: string
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_guest_appointment: {
        Args: {
          p_barber: string
          p_email?: string
          p_key: string
          p_name: string
          p_phone: string
          p_service: string
          p_start: string
        }
        Returns: Json
      }
      create_guest_booking: {
        Args: {
          p_barber: string
          p_email?: string
          p_key: string
          p_name: string
          p_phone: string
          p_service: string
          p_start: string
        }
        Returns: Json
      }
      create_guest_booking_multi: {
        Args: {
          p_barber: string
          p_email?: string
          p_key: string
          p_name: string
          p_phone: string
          p_services: string[]
          p_start: string
        }
        Returns: Json
      }
      create_staff_appointment: {
        Args: {
          p_barber: string
          p_email?: string
          p_key: string
          p_name: string
          p_phone: string
          p_service: string
          p_start: string
        }
        Returns: {
          barber_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          duration_minutes: number
          ends_at: string
          id: string
          price_minor: number
          service_id: string
          service_name: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      manage_shop: { Args: { p_data: Json; p_resource: string }; Returns: Json }
      get_available_slots: {
        Args: { p_barber?: string; p_date: string; p_service: string }
        Returns: { barber_id: string; barber_name: string; local_time: string; slot_start: string }[]
      }
      get_available_slots_multi: {
        Args: { p_barber?: string; p_date: string; p_services: string[] }
        Returns: { barber_id: string; barber_name: string; local_time: string; slot_start: string }[]
      }
      get_booking_catalog: { Args: Record<PropertyKey, never>; Returns: Json }
      get_guest_booking_receipt: { Args: { p_token: string }; Returns: Json }
      get_staff_appointments: {
        Args: {
          p_barber?: string
          p_from: string
          p_query?: string
          p_status?: Database["public"]["Enums"]["appointment_status"]
          p_to: string
        }
        Returns: Database["public"]["Tables"]["appointments"]["Row"][]
        SetofOptions: { from: "*"; to: "appointments"; isOneToOne: false; isSetofReturn: true }
      }
      get_staff_available_slots: {
        Args: { p_barber?: string; p_date: string; p_exclude_appointment?: string; p_service: string }
        Returns: { barber_id: string; barber_name: string; local_time: string; slot_start: string }[]
      }
      reschedule_appointment: {
        Args: {
          p_barber: string
          p_id: string
          p_start: string
          p_version: number
        }
        Returns: {
          barber_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          duration_minutes: number
          ends_at: string
          id: string
          price_minor: number
          service_id: string
          service_name: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_appointment_status: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["appointment_status"]
          p_version: number
        }
        Returns: {
          barber_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          duration_minutes: number
          ends_at: string
          id: string
          price_minor: number
          service_id: string
          service_name: string
          source: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_online_booking: {
        Args: { p_enabled: boolean; p_revision: number }
        Returns: Json
      }
      update_staff_appointment: {
        Args: {
          p_barber: string
          p_email?: string
          p_id: string
          p_name: string
          p_phone: string
          p_service: string
          p_start: string
          p_version: number
        }
        Returns: Json
      }
    }
    Enums: {
      appointment_status: "confirmed" | "cancelled" | "completed" | "no_show"
      staff_role: "admin" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["confirmed", "cancelled", "completed", "no_show"],
      staff_role: ["admin", "staff"],
    },
  },
} as const
