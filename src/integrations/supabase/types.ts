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
      drill_videos: {
        Row: {
          access_level: string | null
          created_at: string | null
          description: string | null
          drill_name: string | null
          duration_seconds: number | null
          four_b_category: string | null
          id: string
          motor_profiles: string[] | null
          player_level: string[] | null
          problems_addressed: string[] | null
          published_at: string | null
          status: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          transcript: string | null
          transcript_segments: Json | null
          updated_at: string | null
          video_type: string | null
          video_url: string
        }
        Insert: {
          access_level?: string | null
          created_at?: string | null
          description?: string | null
          drill_name?: string | null
          duration_seconds?: number | null
          four_b_category?: string | null
          id?: string
          motor_profiles?: string[] | null
          player_level?: string[] | null
          problems_addressed?: string[] | null
          published_at?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          transcript?: string | null
          transcript_segments?: Json | null
          updated_at?: string | null
          video_type?: string | null
          video_url: string
        }
        Update: {
          access_level?: string | null
          created_at?: string | null
          description?: string | null
          drill_name?: string | null
          duration_seconds?: number | null
          four_b_category?: string | null
          id?: string
          motor_profiles?: string[] | null
          player_level?: string[] | null
          problems_addressed?: string[] | null
          published_at?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          transcript?: string | null
          transcript_segments?: Json | null
          updated_at?: string | null
          video_type?: string | null
          video_url?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          id: string
          phone_number: string
          read_at: string | null
          session_id: string | null
          status: string | null
          twilio_sid: string | null
        }
        Insert: {
          body: string
          created_at?: string
          direction: string
          id?: string
          phone_number: string
          read_at?: string | null
          session_id?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          id?: string
          phone_number?: string
          read_at?: string | null
          session_id?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          email_status: string | null
          emailed_at: string | null
          emailed_to: string | null
          generated_at: string | null
          id: string
          report_storage_path: string | null
          report_type: string
          report_url: string
          session_id: string
        }
        Insert: {
          email_status?: string | null
          emailed_at?: string | null
          emailed_to?: string | null
          generated_at?: string | null
          id?: string
          report_storage_path?: string | null
          report_type: string
          report_url: string
          session_id: string
        }
        Update: {
          email_status?: string | null
          emailed_at?: string | null
          emailed_to?: string | null
          generated_at?: string | null
          id?: string
          report_storage_path?: string | null
          report_type?: string
          report_url?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          analysis_json: Json | null
          analyzed_at: string | null
          best_swing_index: number | null
          best_swing_score: number | null
          composite_score: number | null
          consistency_cv: number | null
          consistency_mean: number | null
          consistency_std_dev: number | null
          created_at: string | null
          environment: string
          four_b_ball: number | null
          four_b_bat: number | null
          four_b_body: number | null
          four_b_brain: number | null
          grade: string | null
          id: string
          paid_at: string | null
          percentile: number | null
          player_age: number
          player_email: string
          player_level: string
          player_name: string
          player_phone: string | null
          price_cents: number
          problems_identified: string[] | null
          product_type: string
          report_storage_path: string | null
          report_url: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          swings_required: number
          updated_at: string | null
          user_id: string | null
          weakest_category: string | null
          worst_swing_index: number | null
          worst_swing_score: number | null
        }
        Insert: {
          analysis_json?: Json | null
          analyzed_at?: string | null
          best_swing_index?: number | null
          best_swing_score?: number | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_mean?: number | null
          consistency_std_dev?: number | null
          created_at?: string | null
          environment: string
          four_b_ball?: number | null
          four_b_bat?: number | null
          four_b_body?: number | null
          four_b_brain?: number | null
          grade?: string | null
          id?: string
          paid_at?: string | null
          percentile?: number | null
          player_age: number
          player_email: string
          player_level: string
          player_name: string
          player_phone?: string | null
          price_cents: number
          problems_identified?: string[] | null
          product_type: string
          report_storage_path?: string | null
          report_url?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          swings_required?: number
          updated_at?: string | null
          user_id?: string | null
          weakest_category?: string | null
          worst_swing_index?: number | null
          worst_swing_score?: number | null
        }
        Update: {
          analysis_json?: Json | null
          analyzed_at?: string | null
          best_swing_index?: number | null
          best_swing_score?: number | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_mean?: number | null
          consistency_std_dev?: number | null
          created_at?: string | null
          environment?: string
          four_b_ball?: number | null
          four_b_bat?: number | null
          four_b_body?: number | null
          four_b_brain?: number | null
          grade?: string | null
          id?: string
          paid_at?: string | null
          percentile?: number | null
          player_age?: number
          player_email?: string
          player_level?: string
          player_name?: string
          player_phone?: string | null
          price_cents?: number
          problems_identified?: string[] | null
          product_type?: string
          report_storage_path?: string | null
          report_url?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          swings_required?: number
          updated_at?: string | null
          user_id?: string | null
          weakest_category?: string | null
          worst_swing_index?: number | null
          worst_swing_score?: number | null
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string | null
          id: string
          message_sent: string
          phone_number: string
          session_id: string | null
          status: string | null
          trigger_name: string
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_sent: string
          phone_number: string
          session_id?: string | null
          status?: string | null
          trigger_name: string
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message_sent?: string
          phone_number?: string
          session_id?: string | null
          status?: string | null
          trigger_name?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_scheduled: {
        Row: {
          created_at: string | null
          id: string
          scheduled_for: string
          session_id: string | null
          status: string | null
          trigger_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          scheduled_for: string
          session_id?: string | null
          status?: string | null
          trigger_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          scheduled_for?: string
          session_id?: string | null
          status?: string | null
          trigger_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_scheduled_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          created_at: string | null
          delay_minutes: number | null
          id: string
          is_active: boolean | null
          message_body: string
          trigger_name: string
        }
        Insert: {
          created_at?: string | null
          delay_minutes?: number | null
          id?: string
          is_active?: boolean | null
          message_body: string
          trigger_name: string
        }
        Update: {
          created_at?: string | null
          delay_minutes?: number | null
          id?: string
          is_active?: boolean | null
          message_body?: string
          trigger_name?: string
        }
        Relationships: []
      }
      swings: {
        Row: {
          analysis_json: Json | null
          analyzed_at: string | null
          composite_score: number | null
          created_at: string | null
          four_b_ball: number | null
          four_b_bat: number | null
          four_b_body: number | null
          four_b_brain: number | null
          grade: string | null
          id: string
          session_id: string
          status: string
          swing_index: number
          uploaded_at: string | null
          validation_errors: Json | null
          validation_passed: boolean | null
          video_duration_seconds: number | null
          video_filename: string | null
          video_size_bytes: number | null
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          analysis_json?: Json | null
          analyzed_at?: string | null
          composite_score?: number | null
          created_at?: string | null
          four_b_ball?: number | null
          four_b_bat?: number | null
          four_b_body?: number | null
          four_b_brain?: number | null
          grade?: string | null
          id?: string
          session_id: string
          status?: string
          swing_index: number
          uploaded_at?: string | null
          validation_errors?: Json | null
          validation_passed?: boolean | null
          video_duration_seconds?: number | null
          video_filename?: string | null
          video_size_bytes?: number | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          analysis_json?: Json | null
          analyzed_at?: string | null
          composite_score?: number | null
          created_at?: string | null
          four_b_ball?: number | null
          four_b_bat?: number | null
          four_b_body?: number | null
          four_b_brain?: number | null
          grade?: string | null
          id?: string
          session_id?: string
          status?: string
          swing_index?: number
          uploaded_at?: string | null
          validation_errors?: Json | null
          validation_passed?: boolean | null
          video_duration_seconds?: number | null
          video_filename?: string | null
          video_size_bytes?: number | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          session_id: string | null
          user_id: string | null
          video_id: string | null
          watched_seconds: number | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          session_id?: string | null
          user_id?: string | null
          video_id?: string | null
          watched_seconds?: number | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          session_id?: string | null
          user_id?: string | null
          video_id?: string | null
          watched_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "drill_videos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_session_aggregates: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      get_recommended_videos: {
        Args: { p_limit?: number; p_session_id: string }
        Returns: {
          access_level: string
          description: string
          duration_seconds: number
          four_b_category: string
          id: string
          problems_addressed: string[]
          relevance_score: number
          thumbnail_url: string
          title: string
          video_url: string
        }[]
      }
      get_session_public_data: {
        Args: { session_id_param: string }
        Returns: {
          composite_score: number
          four_b_ball: number
          four_b_bat: number
          four_b_body: number
          four_b_brain: number
          grade: string
          id: string
          player_name: string
          product_type: string
          status: string
          weakest_category: string
        }[]
      }
      search_videos: {
        Args: {
          category_filter?: string
          level_filter?: string
          search_query: string
        }
        Returns: {
          access_level: string
          description: string
          drill_name: string
          duration_seconds: number
          four_b_category: string
          headline: string
          id: string
          motor_profiles: string[]
          player_level: string[]
          problems_addressed: string[]
          rank: number
          tags: string[]
          thumbnail_url: string
          title: string
          transcript: string
          video_type: string
          video_url: string
        }[]
      }
      trigger_process_sms: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
