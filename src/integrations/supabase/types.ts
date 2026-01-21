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
      activity_log: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          player_id: string | null
          session_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          player_id?: string | null
          session_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          player_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_krs_models: {
        Row: {
          beta_0: number
          beta_1: number
          beta_2: number
          beta_3: number
          beta_4: number
          calibrated_at: string | null
          expires_at: string | null
          id: string
          player_id: string
          r_squared: number | null
          sample_count: number | null
        }
        Insert: {
          beta_0?: number
          beta_1?: number
          beta_2?: number
          beta_3?: number
          beta_4?: number
          calibrated_at?: string | null
          expires_at?: string | null
          id?: string
          player_id: string
          r_squared?: number | null
          sample_count?: number | null
        }
        Update: {
          beta_0?: number
          beta_1?: number
          beta_2?: number
          beta_3?: number
          beta_4?: number
          calibrated_at?: string | null
          expires_at?: string | null
          id?: string
          player_id?: string
          r_squared?: number | null
          sample_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_krs_models_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_krs_models_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      batted_ball_events: {
        Row: {
          bb_type: string | null
          contact_score: number | null
          created_at: string
          distance: number | null
          event_date: string
          exit_velocity: number | null
          hang_time: number | null
          hit_type: string | null
          id: string
          is_barrel: boolean | null
          is_hard_hit: boolean | null
          is_sweet_spot: boolean | null
          launch_angle: number | null
          player_id: string | null
          result: string | null
          session_id: string | null
          source: string
          spray_angle: number | null
        }
        Insert: {
          bb_type?: string | null
          contact_score?: number | null
          created_at?: string
          distance?: number | null
          event_date: string
          exit_velocity?: number | null
          hang_time?: number | null
          hit_type?: string | null
          id?: string
          is_barrel?: boolean | null
          is_hard_hit?: boolean | null
          is_sweet_spot?: boolean | null
          launch_angle?: number | null
          player_id?: string | null
          result?: string | null
          session_id?: string | null
          source: string
          spray_angle?: number | null
        }
        Update: {
          bb_type?: string | null
          contact_score?: number | null
          created_at?: string
          distance?: number | null
          event_date?: string
          exit_velocity?: number | null
          hang_time?: number | null
          hit_type?: string | null
          id?: string
          is_barrel?: boolean | null
          is_hard_hit?: boolean | null
          is_sweet_spot?: boolean | null
          launch_angle?: number | null
          player_id?: string | null
          result?: string | null
          session_id?: string | null
          source?: string
          spray_angle?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batted_ball_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batted_ball_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batted_ball_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "launch_monitor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_entries: {
        Row: {
          challenge_id: string
          current_value: number | null
          id: string
          is_winner: boolean | null
          player_id: string
          swings_count: number | null
          updated_at: string | null
        }
        Insert: {
          challenge_id: string
          current_value?: number | null
          id?: string
          is_winner?: boolean | null
          player_id: string
          swings_count?: number | null
          updated_at?: string | null
        }
        Update: {
          challenge_id?: string
          current_value?: number | null
          id?: string
          is_winner?: boolean | null
          player_id?: string
          swings_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "weekly_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_logs: {
        Row: {
          created_at: string | null
          feedback_type: string | null
          id: string
          is_feedback: boolean | null
          messages: Json
          page_url: string | null
          player_id: string | null
          session_id: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          feedback_type?: string | null
          id?: string
          is_feedback?: boolean | null
          messages?: Json
          page_url?: string | null
          player_id?: string | null
          session_id?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          feedback_type?: string | null
          id?: string
          is_feedback?: boolean | null
          messages?: Json
          page_url?: string | null
          player_id?: string | null
          session_id?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      drill_completions: {
        Row: {
          assignment_id: string | null
          completed_at: string | null
          difficulty_rating: number | null
          drill_id: string
          duration_seconds: number | null
          id: string
          notes: string | null
          player_id: string
          player_program_id: string | null
          rating: number | null
          reps_completed: number | null
          sets_completed: number | null
        }
        Insert: {
          assignment_id?: string | null
          completed_at?: string | null
          difficulty_rating?: number | null
          drill_id: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          player_id: string
          player_program_id?: string | null
          rating?: number | null
          reps_completed?: number | null
          sets_completed?: number | null
        }
        Update: {
          assignment_id?: string | null
          completed_at?: string | null
          difficulty_rating?: number | null
          drill_id?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          player_id?: string
          player_program_id?: string | null
          rating?: number | null
          reps_completed?: number | null
          sets_completed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drill_completions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "player_drill_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_completions_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_completions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_completions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_completions_player_program_id_fkey"
            columns: ["player_program_id"]
            isOneToOne: false
            referencedRelation: "player_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_prescriptions: {
        Row: {
          created_at: string | null
          drill_id: string
          four_b_weakness: string | null
          id: string
          is_active: boolean | null
          leak_type: string | null
          min_score_threshold: number | null
          motor_profile: string | null
          prescription_reason: string | null
          priority: number | null
        }
        Insert: {
          created_at?: string | null
          drill_id: string
          four_b_weakness?: string | null
          id?: string
          is_active?: boolean | null
          leak_type?: string | null
          min_score_threshold?: number | null
          motor_profile?: string | null
          prescription_reason?: string | null
          priority?: number | null
        }
        Update: {
          created_at?: string | null
          drill_id?: string
          four_b_weakness?: string | null
          id?: string
          is_active?: boolean | null
          leak_type?: string | null
          min_score_threshold?: number | null
          motor_profile?: string | null
          prescription_reason?: string | null
          priority?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drill_prescriptions_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_videos: {
        Row: {
          access_level: string | null
          created_at: string | null
          description: string | null
          drill_name: string | null
          duration_seconds: number | null
          four_b_category: string | null
          gumlet_asset_id: string | null
          gumlet_dash_url: string | null
          gumlet_hls_url: string | null
          gumlet_playback_url: string | null
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
          gumlet_asset_id?: string | null
          gumlet_dash_url?: string | null
          gumlet_hls_url?: string | null
          gumlet_playback_url?: string | null
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
          gumlet_asset_id?: string | null
          gumlet_dash_url?: string | null
          gumlet_hls_url?: string | null
          gumlet_playback_url?: string | null
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
      drills: {
        Row: {
          common_mistakes: string | null
          created_at: string | null
          cues: string[] | null
          description: string | null
          difficulty: string | null
          duration_minutes: number | null
          equipment: string[] | null
          focus_area: string | null
          four_b_category: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          is_premium: boolean | null
          name: string
          progression_tip: string | null
          reps: number | null
          rest_seconds: number | null
          sets: number | null
          skill_levels: string[] | null
          slug: string | null
          sort_order: number | null
          thumbnail_url: string | null
          updated_at: string | null
          video_duration_seconds: number | null
          video_thumbnail_url: string | null
          video_url: string | null
          why_it_works: string | null
        }
        Insert: {
          common_mistakes?: string | null
          created_at?: string | null
          cues?: string[] | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          equipment?: string[] | null
          focus_area?: string | null
          four_b_category?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_premium?: boolean | null
          name: string
          progression_tip?: string | null
          reps?: number | null
          rest_seconds?: number | null
          sets?: number | null
          skill_levels?: string[] | null
          slug?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_thumbnail_url?: string | null
          video_url?: string | null
          why_it_works?: string | null
        }
        Update: {
          common_mistakes?: string | null
          created_at?: string | null
          cues?: string[] | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          equipment?: string[] | null
          focus_area?: string | null
          four_b_category?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_premium?: boolean | null
          name?: string
          progression_tip?: string | null
          reps?: number | null
          rest_seconds?: number | null
          sets?: number | null
          skill_levels?: string[] | null
          slug?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_thumbnail_url?: string | null
          video_url?: string | null
          why_it_works?: string | null
        }
        Relationships: []
      }
      final_research_briefs: {
        Row: {
          created_at: string
          created_by: string | null
          data_status: string
          four_b_overlay: Json | null
          id: string
          missing_fields: string[] | null
          player_name: string
          powerpoint_slide_code: string | null
          private_notes: string | null
          raw_statcast_data: Json | null
          scouting_notes: string | null
          tags: string[] | null
          updated_at: string
          validated_data: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_status?: string
          four_b_overlay?: Json | null
          id?: string
          missing_fields?: string[] | null
          player_name: string
          powerpoint_slide_code?: string | null
          private_notes?: string | null
          raw_statcast_data?: Json | null
          scouting_notes?: string | null
          tags?: string[] | null
          updated_at?: string
          validated_data?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_status?: string
          four_b_overlay?: Json | null
          id?: string
          missing_fields?: string[] | null
          player_name?: string
          powerpoint_slide_code?: string | null
          private_notes?: string | null
          raw_statcast_data?: Json | null
          scouting_notes?: string | null
          tags?: string[] | null
          updated_at?: string
          validated_data?: Json | null
        }
        Relationships: []
      }
      game_weekly_reports: {
        Row: {
          ab: number | null
          bb: number | null
          best_moment: string | null
          biggest_struggle: string | null
          body_fatigue: number | null
          chat_transcript: Json | null
          coach_summary: string | null
          completed_at: string | null
          created_at: string | null
          doubles: number | null
          games: number | null
          hits: number | null
          home_runs: number | null
          id: string
          k: number | null
          next_week_goal: string | null
          pa: number | null
          player_id: string
          source: string | null
          status: string | null
          training_tags: string[] | null
          trend_label: string | null
          triples: number | null
          updated_at: string | null
          week_end: string
          week_start: string
          xbh: number | null
        }
        Insert: {
          ab?: number | null
          bb?: number | null
          best_moment?: string | null
          biggest_struggle?: string | null
          body_fatigue?: number | null
          chat_transcript?: Json | null
          coach_summary?: string | null
          completed_at?: string | null
          created_at?: string | null
          doubles?: number | null
          games?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: string
          k?: number | null
          next_week_goal?: string | null
          pa?: number | null
          player_id: string
          source?: string | null
          status?: string | null
          training_tags?: string[] | null
          trend_label?: string | null
          triples?: number | null
          updated_at?: string | null
          week_end: string
          week_start: string
          xbh?: number | null
        }
        Update: {
          ab?: number | null
          bb?: number | null
          best_moment?: string | null
          biggest_struggle?: string | null
          body_fatigue?: number | null
          chat_transcript?: Json | null
          coach_summary?: string | null
          completed_at?: string | null
          created_at?: string | null
          doubles?: number | null
          games?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: string
          k?: number | null
          next_week_goal?: string | null
          pa?: number | null
          player_id?: string
          source?: string | null
          status?: string | null
          training_tags?: string[] | null
          trend_label?: string | null
          triples?: number | null
          updated_at?: string | null
          week_end?: string
          week_start?: string
          xbh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_weekly_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_weekly_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          player_id: string | null
          session_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          player_id?: string | null
          session_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          player_id?: string | null
          session_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ghl_webhook_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_webhook_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_webhook_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hittrax_sessions: {
        Row: {
          avg_distance: number | null
          avg_exit_velo: number | null
          avg_launch_angle: number | null
          ball_score: number | null
          balls_in_play: number | null
          barrel_hits: number | null
          barrel_pct: number | null
          contact_rate: number | null
          created_at: string | null
          fly_ball_count: number | null
          fouls: number | null
          ground_ball_count: number | null
          hit_types_breakdown: Json | null
          id: string
          max_distance: number | null
          max_exit_velo: number | null
          min_exit_velo: number | null
          misses: number | null
          optimal_la_count: number | null
          player_id: string | null
          points_per_swing: number | null
          quality_hit_pct: number | null
          quality_hits: number | null
          results_breakdown: Json | null
          session_date: string
          source_file_path: string | null
          total_points: number | null
          total_swings: number
          updated_at: string | null
          velo_100_plus: number | null
          velo_90_plus: number | null
          velo_95_plus: number | null
        }
        Insert: {
          avg_distance?: number | null
          avg_exit_velo?: number | null
          avg_launch_angle?: number | null
          ball_score?: number | null
          balls_in_play?: number | null
          barrel_hits?: number | null
          barrel_pct?: number | null
          contact_rate?: number | null
          created_at?: string | null
          fly_ball_count?: number | null
          fouls?: number | null
          ground_ball_count?: number | null
          hit_types_breakdown?: Json | null
          id?: string
          max_distance?: number | null
          max_exit_velo?: number | null
          min_exit_velo?: number | null
          misses?: number | null
          optimal_la_count?: number | null
          player_id?: string | null
          points_per_swing?: number | null
          quality_hit_pct?: number | null
          quality_hits?: number | null
          results_breakdown?: Json | null
          session_date: string
          source_file_path?: string | null
          total_points?: number | null
          total_swings: number
          updated_at?: string | null
          velo_100_plus?: number | null
          velo_90_plus?: number | null
          velo_95_plus?: number | null
        }
        Update: {
          avg_distance?: number | null
          avg_exit_velo?: number | null
          avg_launch_angle?: number | null
          ball_score?: number | null
          balls_in_play?: number | null
          barrel_hits?: number | null
          barrel_pct?: number | null
          contact_rate?: number | null
          created_at?: string | null
          fly_ball_count?: number | null
          fouls?: number | null
          ground_ball_count?: number | null
          hit_types_breakdown?: Json | null
          id?: string
          max_distance?: number | null
          max_exit_velo?: number | null
          min_exit_velo?: number | null
          misses?: number | null
          optimal_la_count?: number | null
          player_id?: string | null
          points_per_swing?: number | null
          quality_hit_pct?: number | null
          quality_hits?: number | null
          results_breakdown?: Json | null
          session_date?: string
          source_file_path?: string | null
          total_points?: number | null
          total_swings?: number
          updated_at?: string | null
          velo_100_plus?: number | null
          velo_90_plus?: number | null
          velo_95_plus?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hittrax_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hittrax_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          delivery_method: string | null
          email: string
          expires_at: string | null
          id: string
          invite_token: string
          invite_type: Database["public"]["Enums"]["invite_type"]
          invited_by: string | null
          last_sent_at: string | null
          opened_at: string | null
          phone: string | null
          player_id: string | null
          player_name: string | null
          status: Database["public"]["Enums"]["invite_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          delivery_method?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invite_token?: string
          invite_type: Database["public"]["Enums"]["invite_type"]
          invited_by?: string | null
          last_sent_at?: string | null
          opened_at?: string | null
          phone?: string | null
          player_id?: string | null
          player_name?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          delivery_method?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invite_token?: string
          invite_type?: Database["public"]["Enums"]["invite_type"]
          invited_by?: string | null
          last_sent_at?: string | null
          opened_at?: string | null
          phone?: string | null
          player_id?: string | null
          player_name?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      kinetic_fingerprint_history: {
        Row: {
          fingerprint_snapshot: Json
          id: string
          player_id: string
          recorded_at: string
          swing_count: number
        }
        Insert: {
          fingerprint_snapshot: Json
          id?: string
          player_id: string
          recorded_at?: string
          swing_count: number
        }
        Update: {
          fingerprint_snapshot?: Json
          id?: string
          player_id?: string
          recorded_at?: string
          swing_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "kinetic_fingerprint_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kinetic_fingerprint_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      kinetic_fingerprints: {
        Row: {
          body_sequence: Json | null
          created_at: string
          id: string
          intent_map: Json
          last_updated: string
          motor_profile: string | null
          pattern_metrics: Json
          player_id: string
          swing_count: number
          timing_signature: Json
        }
        Insert: {
          body_sequence?: Json | null
          created_at?: string
          id?: string
          intent_map: Json
          last_updated?: string
          motor_profile?: string | null
          pattern_metrics: Json
          player_id: string
          swing_count?: number
          timing_signature: Json
        }
        Update: {
          body_sequence?: Json | null
          created_at?: string
          id?: string
          intent_map?: Json
          last_updated?: string
          motor_profile?: string | null
          pattern_metrics?: Json
          player_id?: string
          swing_count?: number
          timing_signature?: Json
        }
        Relationships: [
          {
            foreignKeyName: "kinetic_fingerprints_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kinetic_fingerprints_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      kwon_analyses: {
        Row: {
          analysis_date: string
          created_at: string
          data_quality: string
          four_b_scores: Json
          id: string
          kinetic_potential: Json
          motor_profile: string
          player_id: string
          possible_leaks: Json
          priority_focus: string
          release_prediction: Json
          secondary_focus: string
          sensor_facts: Json
          session_id: string
          swings_analyzed: number
          timing_prediction: Json
          updated_at: string
          upstream_prediction: Json
        }
        Insert: {
          analysis_date?: string
          created_at?: string
          data_quality: string
          four_b_scores: Json
          id?: string
          kinetic_potential: Json
          motor_profile: string
          player_id: string
          possible_leaks?: Json
          priority_focus: string
          release_prediction: Json
          secondary_focus: string
          sensor_facts: Json
          session_id: string
          swings_analyzed: number
          timing_prediction: Json
          updated_at?: string
          upstream_prediction: Json
        }
        Update: {
          analysis_date?: string
          created_at?: string
          data_quality?: string
          four_b_scores?: Json
          id?: string
          kinetic_potential?: Json
          motor_profile?: string
          player_id?: string
          possible_leaks?: Json
          priority_focus?: string
          release_prediction?: Json
          secondary_focus?: string
          sensor_facts?: Json
          session_id?: string
          swings_analyzed?: number
          timing_prediction?: Json
          updated_at?: string
          upstream_prediction?: Json
        }
        Relationships: [
          {
            foreignKeyName: "kwon_analyses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kwon_analyses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kwon_analyses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sensor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_monitor_sessions: {
        Row: {
          avg_distance: number | null
          avg_exit_velo: number | null
          avg_launch_angle: number | null
          ball_score: number | null
          balls_in_play: number | null
          barrel_hits: number | null
          barrel_pct: number | null
          contact_rate: number | null
          created_at: string | null
          fly_ball_count: number | null
          fouls: number | null
          ground_ball_count: number | null
          hit_types_breakdown: Json | null
          id: string
          max_distance: number | null
          max_exit_velo: number | null
          min_exit_velo: number | null
          misses: number | null
          optimal_la_count: number | null
          player_id: string | null
          points_per_swing: number | null
          quality_hit_pct: number | null
          quality_hits: number | null
          raw_swings: Json | null
          results_breakdown: Json | null
          session_date: string
          source: string
          source_file_name: string | null
          total_points: number | null
          total_swings: number
          updated_at: string | null
          velo_100_plus: number | null
          velo_90_plus: number | null
          velo_95_plus: number | null
        }
        Insert: {
          avg_distance?: number | null
          avg_exit_velo?: number | null
          avg_launch_angle?: number | null
          ball_score?: number | null
          balls_in_play?: number | null
          barrel_hits?: number | null
          barrel_pct?: number | null
          contact_rate?: number | null
          created_at?: string | null
          fly_ball_count?: number | null
          fouls?: number | null
          ground_ball_count?: number | null
          hit_types_breakdown?: Json | null
          id?: string
          max_distance?: number | null
          max_exit_velo?: number | null
          min_exit_velo?: number | null
          misses?: number | null
          optimal_la_count?: number | null
          player_id?: string | null
          points_per_swing?: number | null
          quality_hit_pct?: number | null
          quality_hits?: number | null
          raw_swings?: Json | null
          results_breakdown?: Json | null
          session_date: string
          source: string
          source_file_name?: string | null
          total_points?: number | null
          total_swings: number
          updated_at?: string | null
          velo_100_plus?: number | null
          velo_90_plus?: number | null
          velo_95_plus?: number | null
        }
        Update: {
          avg_distance?: number | null
          avg_exit_velo?: number | null
          avg_launch_angle?: number | null
          ball_score?: number | null
          balls_in_play?: number | null
          barrel_hits?: number | null
          barrel_pct?: number | null
          contact_rate?: number | null
          created_at?: string | null
          fly_ball_count?: number | null
          fouls?: number | null
          ground_ball_count?: number | null
          hit_types_breakdown?: Json | null
          id?: string
          max_distance?: number | null
          max_exit_velo?: number | null
          min_exit_velo?: number | null
          misses?: number | null
          optimal_la_count?: number | null
          player_id?: string | null
          points_per_swing?: number | null
          quality_hit_pct?: number | null
          quality_hits?: number | null
          raw_swings?: Json | null
          results_breakdown?: Json | null
          session_date?: string
          source?: string
          source_file_name?: string | null
          total_points?: number | null
          total_swings?: number
          updated_at?: string | null
          velo_100_plus?: number | null
          velo_90_plus?: number | null
          velo_95_plus?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "launch_monitor_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_monitor_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_generated: boolean | null
          body: string
          created_at: string
          direction: string
          id: string
          phone_number: string
          player_id: string | null
          read_at: string | null
          session_id: string | null
          status: string | null
          trigger_type: string | null
          twilio_sid: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          body: string
          created_at?: string
          direction: string
          id?: string
          phone_number: string
          player_id?: string | null
          read_at?: string | null
          session_id?: string | null
          status?: string | null
          trigger_type?: string | null
          twilio_sid?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          body?: string
          created_at?: string
          direction?: string
          id?: string
          phone_number?: string
          player_id?: string | null
          read_at?: string | null
          session_id?: string | null
          status?: string | null
          trigger_type?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_drill_assignments: {
        Row: {
          assigned_at: string | null
          assigned_reason: string | null
          completed_at: string | null
          drill_id: string
          id: string
          leak_type_at_assignment: string | null
          player_id: string
          score_at_assignment: number | null
          session_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_reason?: string | null
          completed_at?: string | null
          drill_id: string
          id?: string
          leak_type_at_assignment?: string | null
          player_id: string
          score_at_assignment?: number | null
          session_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_reason?: string | null
          completed_at?: string | null
          drill_id?: string
          id?: string
          leak_type_at_assignment?: string | null
          player_id?: string
          score_at_assignment?: number | null
          session_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_drill_assignments_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_drill_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_drill_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      player_external_profiles: {
        Row: {
          created_at: string
          external_player_id: string | null
          id: string
          last_scraped_at: string | null
          parsed_json: Json | null
          player_id: string | null
          profile_url: string | null
          raw_json: Json | null
          scrape_status: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_player_id?: string | null
          id?: string
          last_scraped_at?: string | null
          parsed_json?: Json | null
          player_id?: string | null
          profile_url?: string | null
          raw_json?: Json | null
          scrape_status?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_player_id?: string | null
          id?: string
          last_scraped_at?: string | null
          parsed_json?: Json | null
          player_id?: string | null
          profile_url?: string | null
          raw_json?: Json | null
          scrape_status?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_external_profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_external_profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      player_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_private: boolean | null
          note: string
          player_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_private?: boolean | null
          note: string
          player_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_private?: boolean | null
          note?: string
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      player_profiles: {
        Row: {
          age: number | null
          baseball_reference_id: string | null
          bats: string | null
          birth_date: string | null
          coach_notes: string | null
          created_at: string | null
          current_focus: string | null
          current_team: string | null
          email: string | null
          fangraphs_id: string | null
          first_name: string
          first_session_date: string | null
          height: string | null
          hometown: string | null
          id: string
          intake_completed_at: string | null
          intake_responses: Json | null
          is_active: boolean | null
          known_issues: string[] | null
          last_name: string | null
          last_researched_at: string | null
          level: string | null
          lifetime_value: number | null
          milb_id: string | null
          mlb_id: string | null
          organization: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          phone: string | null
          players_id: string | null
          position: string | null
          scouting_grades: Json | null
          scouting_reports: string[] | null
          stats_json: Json | null
          stats_updated_at: string | null
          throws: string | null
          total_sessions: number | null
          training_history: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          age?: number | null
          baseball_reference_id?: string | null
          bats?: string | null
          birth_date?: string | null
          coach_notes?: string | null
          created_at?: string | null
          current_focus?: string | null
          current_team?: string | null
          email?: string | null
          fangraphs_id?: string | null
          first_name: string
          first_session_date?: string | null
          height?: string | null
          hometown?: string | null
          id?: string
          intake_completed_at?: string | null
          intake_responses?: Json | null
          is_active?: boolean | null
          known_issues?: string[] | null
          last_name?: string | null
          last_researched_at?: string | null
          level?: string | null
          lifetime_value?: number | null
          milb_id?: string | null
          mlb_id?: string | null
          organization?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          players_id?: string | null
          position?: string | null
          scouting_grades?: Json | null
          scouting_reports?: string[] | null
          stats_json?: Json | null
          stats_updated_at?: string | null
          throws?: string | null
          total_sessions?: number | null
          training_history?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          age?: number | null
          baseball_reference_id?: string | null
          bats?: string | null
          birth_date?: string | null
          coach_notes?: string | null
          created_at?: string | null
          current_focus?: string | null
          current_team?: string | null
          email?: string | null
          fangraphs_id?: string | null
          first_name?: string
          first_session_date?: string | null
          height?: string | null
          hometown?: string | null
          id?: string
          intake_completed_at?: string | null
          intake_responses?: Json | null
          is_active?: boolean | null
          known_issues?: string[] | null
          last_name?: string | null
          last_researched_at?: string | null
          level?: string | null
          lifetime_value?: number | null
          milb_id?: string | null
          mlb_id?: string | null
          organization?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          players_id?: string | null
          position?: string | null
          scouting_grades?: Json | null
          scouting_reports?: string[] | null
          stats_json?: Json | null
          stats_updated_at?: string | null
          throws?: string | null
          total_sessions?: number | null
          training_history?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_profiles_players_id_fkey"
            columns: ["players_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_profiles_players_id_fkey"
            columns: ["players_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      player_programs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_week: number | null
          id: string
          notes: string | null
          player_id: string
          program_id: string
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_week?: number | null
          id?: string
          notes?: string | null
          player_id: string
          program_id: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_week?: number | null
          id?: string
          notes?: string | null
          player_id?: string
          program_id?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_programs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_programs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      player_sessions: {
        Row: {
          ball_grade: string | null
          ball_score: number | null
          bat_grade: string | null
          bat_score: number | null
          body_grade: string | null
          body_score: number | null
          brain_grade: string | null
          brain_score: number | null
          core_flow: number | null
          created_at: string
          data_quality: string | null
          ground_flow: number | null
          id: string
          leak_caption: string | null
          leak_training: string | null
          leak_type: string | null
          overall_grade: string | null
          overall_score: number | null
          player_id: string
          reboot_session_id: string | null
          session_date: string
          session_source: string | null
          swing_count: number | null
          updated_at: string
          upper_flow: number | null
        }
        Insert: {
          ball_grade?: string | null
          ball_score?: number | null
          bat_grade?: string | null
          bat_score?: number | null
          body_grade?: string | null
          body_score?: number | null
          brain_grade?: string | null
          brain_score?: number | null
          core_flow?: number | null
          created_at?: string
          data_quality?: string | null
          ground_flow?: number | null
          id?: string
          leak_caption?: string | null
          leak_training?: string | null
          leak_type?: string | null
          overall_grade?: string | null
          overall_score?: number | null
          player_id: string
          reboot_session_id?: string | null
          session_date?: string
          session_source?: string | null
          swing_count?: number | null
          updated_at?: string
          upper_flow?: number | null
        }
        Update: {
          ball_grade?: string | null
          ball_score?: number | null
          bat_grade?: string | null
          bat_score?: number | null
          body_grade?: string | null
          body_score?: number | null
          brain_grade?: string | null
          brain_score?: number | null
          core_flow?: number | null
          created_at?: string
          data_quality?: string | null
          ground_flow?: number | null
          id?: string
          leak_caption?: string | null
          leak_training?: string | null
          leak_type?: string | null
          overall_grade?: string | null
          overall_score?: number | null
          player_id?: string
          reboot_session_id?: string | null
          session_date?: string
          session_source?: string | null
          swing_count?: number | null
          updated_at?: string
          upper_flow?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          account_status: string | null
          account_type: string | null
          activated_at: string | null
          age: number | null
          bat_mass_kg: number | null
          bbref_id: string | null
          beta_expires_at: string | null
          beta_notes: string | null
          can_login: boolean | null
          created_at: string | null
          current_bat_speed: number | null
          current_streak: number | null
          email: string | null
          fangraphs_id: string | null
          handedness: string | null
          height_inches: number | null
          id: string
          is_beta_tester: boolean | null
          is_in_season: boolean | null
          is_public: boolean | null
          is_validation_study: boolean | null
          kinetic_fingerprint_json: Json | null
          kinetic_fingerprint_url: string | null
          last_sensor_session_date: string | null
          latest_ball_score: number | null
          latest_bat_score: number | null
          latest_body_score: number | null
          latest_brain_score: number | null
          latest_composite_score: number | null
          latest_hittrax_session_id: string | null
          level: string | null
          longest_streak: number | null
          membership_tier: string | null
          mlb_id: string | null
          motor_profile_sensor: string | null
          name: string
          notes: string | null
          phone: string | null
          player_level: number | null
          position: string | null
          reboot_athlete_id: string | null
          reboot_player_id: string | null
          sensor_baseline_complete: boolean | null
          sensor_baseline_date: string | null
          sensor_baseline_session_id: string | null
          sessions_this_week: number | null
          sms_opt_in: boolean | null
          stripe_customer_id: string | null
          team: string | null
          total_xp: number | null
          updated_at: string | null
          weight_lbs: number | null
        }
        Insert: {
          account_status?: string | null
          account_type?: string | null
          activated_at?: string | null
          age?: number | null
          bat_mass_kg?: number | null
          bbref_id?: string | null
          beta_expires_at?: string | null
          beta_notes?: string | null
          can_login?: boolean | null
          created_at?: string | null
          current_bat_speed?: number | null
          current_streak?: number | null
          email?: string | null
          fangraphs_id?: string | null
          handedness?: string | null
          height_inches?: number | null
          id?: string
          is_beta_tester?: boolean | null
          is_in_season?: boolean | null
          is_public?: boolean | null
          is_validation_study?: boolean | null
          kinetic_fingerprint_json?: Json | null
          kinetic_fingerprint_url?: string | null
          last_sensor_session_date?: string | null
          latest_ball_score?: number | null
          latest_bat_score?: number | null
          latest_body_score?: number | null
          latest_brain_score?: number | null
          latest_composite_score?: number | null
          latest_hittrax_session_id?: string | null
          level?: string | null
          longest_streak?: number | null
          membership_tier?: string | null
          mlb_id?: string | null
          motor_profile_sensor?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          player_level?: number | null
          position?: string | null
          reboot_athlete_id?: string | null
          reboot_player_id?: string | null
          sensor_baseline_complete?: boolean | null
          sensor_baseline_date?: string | null
          sensor_baseline_session_id?: string | null
          sessions_this_week?: number | null
          sms_opt_in?: boolean | null
          stripe_customer_id?: string | null
          team?: string | null
          total_xp?: number | null
          updated_at?: string | null
          weight_lbs?: number | null
        }
        Update: {
          account_status?: string | null
          account_type?: string | null
          activated_at?: string | null
          age?: number | null
          bat_mass_kg?: number | null
          bbref_id?: string | null
          beta_expires_at?: string | null
          beta_notes?: string | null
          can_login?: boolean | null
          created_at?: string | null
          current_bat_speed?: number | null
          current_streak?: number | null
          email?: string | null
          fangraphs_id?: string | null
          handedness?: string | null
          height_inches?: number | null
          id?: string
          is_beta_tester?: boolean | null
          is_in_season?: boolean | null
          is_public?: boolean | null
          is_validation_study?: boolean | null
          kinetic_fingerprint_json?: Json | null
          kinetic_fingerprint_url?: string | null
          last_sensor_session_date?: string | null
          latest_ball_score?: number | null
          latest_bat_score?: number | null
          latest_body_score?: number | null
          latest_brain_score?: number | null
          latest_composite_score?: number | null
          latest_hittrax_session_id?: string | null
          level?: string | null
          longest_streak?: number | null
          membership_tier?: string | null
          mlb_id?: string | null
          motor_profile_sensor?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          player_level?: number | null
          position?: string | null
          reboot_athlete_id?: string | null
          reboot_player_id?: string | null
          sensor_baseline_complete?: boolean | null
          sensor_baseline_date?: string | null
          sensor_baseline_session_id?: string | null
          sessions_this_week?: number | null
          sms_opt_in?: boolean | null
          stripe_customer_id?: string | null
          team?: string | null
          total_xp?: number | null
          updated_at?: string | null
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_latest_hittrax_session_id_fkey"
            columns: ["latest_hittrax_session_id"]
            isOneToOne: false
            referencedRelation: "hittrax_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_tags: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          name: string
          severity_weight: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          name: string
          severity_weight?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          name?: string
          severity_weight?: number | null
        }
        Relationships: []
      }
      program_schedule: {
        Row: {
          created_at: string | null
          day_of_week: number
          drill_id: string
          id: string
          notes: string | null
          order_index: number | null
          program_id: string
          reps_override: number | null
          sets_override: number | null
          week_number: number
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          drill_id: string
          id?: string
          notes?: string | null
          order_index?: number | null
          program_id: string
          reps_override?: number | null
          sets_override?: number | null
          week_number: number
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          drill_id?: string
          id?: string
          notes?: string | null
          order_index?: number | null
          program_id?: string
          reps_override?: number | null
          sets_override?: number | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_schedule_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_schedule_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          duration_weeks: number | null
          four_b_focus: string[] | null
          id: string
          is_active: boolean | null
          is_template: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration_weeks?: number | null
          four_b_focus?: string[] | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration_weeks?: number | null
          four_b_focus?: string[] | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reboot_sessions: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          ik_file_path: string | null
          location: string | null
          me_file_path: string | null
          notes: string | null
          player_id: string | null
          processed_at: string | null
          reboot_session_id: string | null
          session_date: string | null
          session_number: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          ik_file_path?: string | null
          location?: string | null
          me_file_path?: string | null
          notes?: string | null
          player_id?: string | null
          processed_at?: string | null
          reboot_session_id?: string | null
          session_date?: string | null
          session_number?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          ik_file_path?: string | null
          location?: string | null
          me_file_path?: string | null
          notes?: string | null
          player_id?: string | null
          processed_at?: string | null
          reboot_session_id?: string | null
          session_date?: string | null
          session_number?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reboot_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reboot_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reboot_uploads: {
        Row: {
          analysis_confidence: number | null
          analysis_type: string | null
          bat_ke: number | null
          bat_score: number | null
          body_score: number | null
          brain_score: number | null
          camera_angle: string | null
          completed_at: string | null
          composite_score: number | null
          consistency_cv: number | null
          consistency_grade: string | null
          core_flow_score: number | null
          correlated_video_session_id: string | null
          created_at: string | null
          error_message: string | null
          frame_rate: number | null
          grade: string | null
          ground_flow_score: number | null
          id: string
          ik_data: Json | null
          ik_file_uploaded: boolean | null
          leak_detected: string | null
          leak_evidence: string | null
          me_data: Json | null
          me_file_uploaded: boolean | null
          motor_profile: string | null
          motor_profile_evidence: string | null
          original_video_url: string | null
          pelvis_velocity: number | null
          pending_reboot: boolean | null
          player_id: string | null
          priority_drill: string | null
          processing_status: string | null
          reboot_session_id: string | null
          session_date: string
          torso_velocity: number | null
          transfer_efficiency: number | null
          updated_at: string | null
          upload_source: string | null
          uploaded_at: string | null
          upper_flow_score: number | null
          validation_status: string | null
          video_2d_analysis: Json | null
          video_composite_delta: number | null
          video_filename: string | null
          video_quality: string | null
          video_url: string | null
          weakest_link: string | null
          x_factor: number | null
        }
        Insert: {
          analysis_confidence?: number | null
          analysis_type?: string | null
          bat_ke?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          camera_angle?: string | null
          completed_at?: string | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          correlated_video_session_id?: string | null
          created_at?: string | null
          error_message?: string | null
          frame_rate?: number | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          ik_data?: Json | null
          ik_file_uploaded?: boolean | null
          leak_detected?: string | null
          leak_evidence?: string | null
          me_data?: Json | null
          me_file_uploaded?: boolean | null
          motor_profile?: string | null
          motor_profile_evidence?: string | null
          original_video_url?: string | null
          pelvis_velocity?: number | null
          pending_reboot?: boolean | null
          player_id?: string | null
          priority_drill?: string | null
          processing_status?: string | null
          reboot_session_id?: string | null
          session_date: string
          torso_velocity?: number | null
          transfer_efficiency?: number | null
          updated_at?: string | null
          upload_source?: string | null
          uploaded_at?: string | null
          upper_flow_score?: number | null
          validation_status?: string | null
          video_2d_analysis?: Json | null
          video_composite_delta?: number | null
          video_filename?: string | null
          video_quality?: string | null
          video_url?: string | null
          weakest_link?: string | null
          x_factor?: number | null
        }
        Update: {
          analysis_confidence?: number | null
          analysis_type?: string | null
          bat_ke?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          camera_angle?: string | null
          completed_at?: string | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          correlated_video_session_id?: string | null
          created_at?: string | null
          error_message?: string | null
          frame_rate?: number | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          ik_data?: Json | null
          ik_file_uploaded?: boolean | null
          leak_detected?: string | null
          leak_evidence?: string | null
          me_data?: Json | null
          me_file_uploaded?: boolean | null
          motor_profile?: string | null
          motor_profile_evidence?: string | null
          original_video_url?: string | null
          pelvis_velocity?: number | null
          pending_reboot?: boolean | null
          player_id?: string | null
          priority_drill?: string | null
          processing_status?: string | null
          reboot_session_id?: string | null
          session_date?: string
          torso_velocity?: number | null
          transfer_efficiency?: number | null
          updated_at?: string | null
          upload_source?: string | null
          uploaded_at?: string | null
          upper_flow_score?: number | null
          validation_status?: string | null
          video_2d_analysis?: Json | null
          video_composite_delta?: number | null
          video_filename?: string | null
          video_quality?: string | null
          video_url?: string | null
          weakest_link?: string | null
          x_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reboot_uploads_correlated_video_session_id_fkey"
            columns: ["correlated_video_session_id"]
            isOneToOne: false
            referencedRelation: "video_swing_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reboot_uploads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reboot_uploads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_athletes: {
        Row: {
          archetype: string | null
          created_at: string | null
          display_name: string
          handedness: string | null
          id: string
          level: string
          notes: string | null
          reboot_athlete_id: string | null
          updated_at: string | null
          visibility: string
        }
        Insert: {
          archetype?: string | null
          created_at?: string | null
          display_name: string
          handedness?: string | null
          id?: string
          level: string
          notes?: string | null
          reboot_athlete_id?: string | null
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          archetype?: string | null
          created_at?: string | null
          display_name?: string
          handedness?: string | null
          id?: string
          level?: string
          notes?: string | null
          reboot_athlete_id?: string | null
          updated_at?: string | null
          visibility?: string
        }
        Relationships: []
      }
      reference_sessions: {
        Row: {
          ball_score: number | null
          bat_ke: number | null
          bat_score: number | null
          body_score: number | null
          brain_score: number | null
          captured_at: string | null
          composite_score: number | null
          consistency_cv: number | null
          consistency_grade: string | null
          core_flow_score: number | null
          created_at: string | null
          grade: string | null
          ground_flow_score: number | null
          id: string
          metrics_json: Json | null
          pelvis_velocity: number | null
          reboot_session_id: string | null
          reference_athlete_id: string
          session_date: string | null
          source: string
          torso_velocity: number | null
          transfer_efficiency: number | null
          updated_at: string | null
          upper_flow_score: number | null
          weakest_link: string | null
          x_factor: number | null
        }
        Insert: {
          ball_score?: number | null
          bat_ke?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          captured_at?: string | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          created_at?: string | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          metrics_json?: Json | null
          pelvis_velocity?: number | null
          reboot_session_id?: string | null
          reference_athlete_id: string
          session_date?: string | null
          source?: string
          torso_velocity?: number | null
          transfer_efficiency?: number | null
          updated_at?: string | null
          upper_flow_score?: number | null
          weakest_link?: string | null
          x_factor?: number | null
        }
        Update: {
          ball_score?: number | null
          bat_ke?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          captured_at?: string | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          created_at?: string | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          metrics_json?: Json | null
          pelvis_velocity?: number | null
          reboot_session_id?: string | null
          reference_athlete_id?: string
          session_date?: string | null
          source?: string
          torso_velocity?: number | null
          transfer_efficiency?: number | null
          updated_at?: string | null
          upper_flow_score?: number | null
          weakest_link?: string | null
          x_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_sessions_reference_athlete_id_fkey"
            columns: ["reference_athlete_id"]
            isOneToOne: false
            referencedRelation: "reference_athletes"
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
      sensor_sessions: {
        Row: {
          attack_angle_avg: number | null
          attack_direction_avg: number | null
          avg_bat_speed: number | null
          avg_hand_to_bat_ratio: number | null
          bat_speed_avg: number | null
          bat_speed_max: number | null
          created_at: string | null
          dk_session_uuid: string | null
          duration_minutes: number | null
          environment: string | null
          four_b_bat: number | null
          four_b_brain: number | null
          hand_speed_max: number | null
          id: string
          kinetic_fingerprint_json: Json | null
          max_bat_speed: number | null
          player_id: string
          session_date: string
          status: string | null
          synced_at: string | null
          timing_variance: number | null
          timing_variance_pct: number | null
          total_swings: number | null
          updated_at: string | null
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          attack_angle_avg?: number | null
          attack_direction_avg?: number | null
          avg_bat_speed?: number | null
          avg_hand_to_bat_ratio?: number | null
          bat_speed_avg?: number | null
          bat_speed_max?: number | null
          created_at?: string | null
          dk_session_uuid?: string | null
          duration_minutes?: number | null
          environment?: string | null
          four_b_bat?: number | null
          four_b_brain?: number | null
          hand_speed_max?: number | null
          id?: string
          kinetic_fingerprint_json?: Json | null
          max_bat_speed?: number | null
          player_id: string
          session_date?: string
          status?: string | null
          synced_at?: string | null
          timing_variance?: number | null
          timing_variance_pct?: number | null
          total_swings?: number | null
          updated_at?: string | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          attack_angle_avg?: number | null
          attack_direction_avg?: number | null
          avg_bat_speed?: number | null
          avg_hand_to_bat_ratio?: number | null
          bat_speed_avg?: number | null
          bat_speed_max?: number | null
          created_at?: string | null
          dk_session_uuid?: string | null
          duration_minutes?: number | null
          environment?: string | null
          four_b_bat?: number | null
          four_b_brain?: number | null
          hand_speed_max?: number | null
          id?: string
          kinetic_fingerprint_json?: Json | null
          max_bat_speed?: number | null
          player_id?: string
          session_date?: string
          status?: string | null
          synced_at?: string | null
          timing_variance?: number | null
          timing_variance_pct?: number | null
          total_swings?: number | null
          updated_at?: string | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_swings: {
        Row: {
          applied_power: number | null
          attack_angle_deg: number | null
          attack_direction_deg: number | null
          bat_speed_mph: number | null
          created_at: string | null
          dk_swing_id: string | null
          hand_speed_mph: number | null
          hand_to_bat_ratio: number | null
          id: string
          impact_location_x: number | null
          impact_location_y: number | null
          impact_location_z: number | null
          invalid_reason: string | null
          is_valid: boolean | null
          max_acceleration: number | null
          occurred_at: string
          player_id: string
          raw_dk_data: Json | null
          session_id: string
          swing_number: number | null
          swing_plane_tilt_deg: number | null
          trigger_to_impact_ms: number | null
          warnings: string[] | null
        }
        Insert: {
          applied_power?: number | null
          attack_angle_deg?: number | null
          attack_direction_deg?: number | null
          bat_speed_mph?: number | null
          created_at?: string | null
          dk_swing_id?: string | null
          hand_speed_mph?: number | null
          hand_to_bat_ratio?: number | null
          id?: string
          impact_location_x?: number | null
          impact_location_y?: number | null
          impact_location_z?: number | null
          invalid_reason?: string | null
          is_valid?: boolean | null
          max_acceleration?: number | null
          occurred_at?: string
          player_id: string
          raw_dk_data?: Json | null
          session_id: string
          swing_number?: number | null
          swing_plane_tilt_deg?: number | null
          trigger_to_impact_ms?: number | null
          warnings?: string[] | null
        }
        Update: {
          applied_power?: number | null
          attack_angle_deg?: number | null
          attack_direction_deg?: number | null
          bat_speed_mph?: number | null
          created_at?: string | null
          dk_swing_id?: string | null
          hand_speed_mph?: number | null
          hand_to_bat_ratio?: number | null
          id?: string
          impact_location_x?: number | null
          impact_location_y?: number | null
          impact_location_z?: number | null
          invalid_reason?: string | null
          is_valid?: boolean | null
          max_acceleration?: number | null
          occurred_at?: string
          player_id?: string
          raw_dk_data?: Json | null
          session_id?: string
          swing_number?: number | null
          swing_plane_tilt_deg?: number | null
          trigger_to_impact_ms?: number | null
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_swings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_swings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_swings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sensor_sessions"
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
          created_by: string | null
          environment: string
          four_b_ball: number | null
          four_b_bat: number | null
          four_b_body: number | null
          four_b_brain: number | null
          grade: string | null
          has_contact_event: boolean | null
          id: string
          is_in_person: boolean | null
          leak_type: string | null
          paid_at: string | null
          payment_link_id: string | null
          payment_link_url: string | null
          payment_method: string | null
          percentile: number | null
          player_age: number
          player_email: string
          player_id: string | null
          player_level: string
          player_name: string
          player_notes: string | null
          player_phone: string | null
          price_cents: number
          problems_identified: string[] | null
          product_type: string
          report_storage_path: string | null
          report_url: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          swing_count: number | null
          swings_max_allowed: number | null
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
          created_by?: string | null
          environment: string
          four_b_ball?: number | null
          four_b_bat?: number | null
          four_b_body?: number | null
          four_b_brain?: number | null
          grade?: string | null
          has_contact_event?: boolean | null
          id?: string
          is_in_person?: boolean | null
          leak_type?: string | null
          paid_at?: string | null
          payment_link_id?: string | null
          payment_link_url?: string | null
          payment_method?: string | null
          percentile?: number | null
          player_age: number
          player_email: string
          player_id?: string | null
          player_level: string
          player_name: string
          player_notes?: string | null
          player_phone?: string | null
          price_cents: number
          problems_identified?: string[] | null
          product_type: string
          report_storage_path?: string | null
          report_url?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          swing_count?: number | null
          swings_max_allowed?: number | null
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
          created_by?: string | null
          environment?: string
          four_b_ball?: number | null
          four_b_bat?: number | null
          four_b_body?: number | null
          four_b_brain?: number | null
          grade?: string | null
          has_contact_event?: boolean | null
          id?: string
          is_in_person?: boolean | null
          leak_type?: string | null
          paid_at?: string | null
          payment_link_id?: string | null
          payment_link_url?: string | null
          payment_method?: string | null
          percentile?: number | null
          player_age?: number
          player_email?: string
          player_id?: string | null
          player_level?: string
          player_name?: string
          player_notes?: string | null
          player_phone?: string | null
          price_cents?: number
          problems_identified?: string[] | null
          product_type?: string
          report_storage_path?: string | null
          report_url?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          swing_count?: number | null
          swings_max_allowed?: number | null
          swings_required?: number
          updated_at?: string | null
          user_id?: string | null
          weakest_category?: string | null
          worst_swing_index?: number | null
          worst_swing_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      swing_4b_scores: {
        Row: {
          b1_score: number | null
          b2_score: number | null
          b3_score: number | null
          b4_score: number | null
          ball_score: number | null
          bat_ke: number | null
          bat_score: number | null
          body_score: number | null
          brain_score: number | null
          bucket_loss_breakdown: Json | null
          composite_score: number | null
          consistency_cv: number | null
          consistency_grade: string | null
          core_flow_score: number | null
          created_at: string | null
          four_b_ball: number | null
          four_b_bat: number | null
          four_b_hit: number | null
          grade: string | null
          ground_flow_score: number | null
          id: string
          mechanical_loss_mph: number | null
          mechanical_loss_pct: number | null
          pelvis_velocity: number | null
          player_id: string | null
          prescribed_drill_id: string | null
          prescribed_drill_name: string | null
          primary_bucket_issue: string | null
          primary_issue_category: string | null
          primary_issue_description: string | null
          primary_issue_title: string | null
          session_id: string | null
          swing_number: number
          torso_velocity: number | null
          transfer_efficiency: number | null
          updated_at: string | null
          upper_flow_score: number | null
          v_bat_actual_mph: number | null
          v_bat_expected_mph: number | null
          weakest_link: string | null
          x_factor: number | null
        }
        Insert: {
          b1_score?: number | null
          b2_score?: number | null
          b3_score?: number | null
          b4_score?: number | null
          ball_score?: number | null
          bat_ke?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          bucket_loss_breakdown?: Json | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          created_at?: string | null
          four_b_ball?: number | null
          four_b_bat?: number | null
          four_b_hit?: number | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          mechanical_loss_mph?: number | null
          mechanical_loss_pct?: number | null
          pelvis_velocity?: number | null
          player_id?: string | null
          prescribed_drill_id?: string | null
          prescribed_drill_name?: string | null
          primary_bucket_issue?: string | null
          primary_issue_category?: string | null
          primary_issue_description?: string | null
          primary_issue_title?: string | null
          session_id?: string | null
          swing_number?: number
          torso_velocity?: number | null
          transfer_efficiency?: number | null
          updated_at?: string | null
          upper_flow_score?: number | null
          v_bat_actual_mph?: number | null
          v_bat_expected_mph?: number | null
          weakest_link?: string | null
          x_factor?: number | null
        }
        Update: {
          b1_score?: number | null
          b2_score?: number | null
          b3_score?: number | null
          b4_score?: number | null
          ball_score?: number | null
          bat_ke?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          bucket_loss_breakdown?: Json | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          created_at?: string | null
          four_b_ball?: number | null
          four_b_bat?: number | null
          four_b_hit?: number | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          mechanical_loss_mph?: number | null
          mechanical_loss_pct?: number | null
          pelvis_velocity?: number | null
          player_id?: string | null
          prescribed_drill_id?: string | null
          prescribed_drill_name?: string | null
          primary_bucket_issue?: string | null
          primary_issue_category?: string | null
          primary_issue_description?: string | null
          primary_issue_title?: string | null
          session_id?: string | null
          swing_number?: number
          torso_velocity?: number | null
          transfer_efficiency?: number | null
          updated_at?: string | null
          upper_flow_score?: number | null
          v_bat_actual_mph?: number | null
          v_bat_expected_mph?: number | null
          weakest_link?: string | null
          x_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "swing_4b_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swing_4b_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swing_4b_scores_prescribed_drill_id_fkey"
            columns: ["prescribed_drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swing_4b_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reboot_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      swing_analyses: {
        Row: {
          analyzed_by: string | null
          ball_score: number | null
          bat_score: number | null
          body_score: number | null
          brain_score: number | null
          coach_notes: string | null
          created_at: string | null
          free_diagnostic_report: Json | null
          id: string
          motor_profile: string | null
          overall_score: number | null
          player_id: string | null
          primary_problem: string
          private_notes: string | null
          recommended_drill_ids: string[] | null
          report_generated_at: string | null
          results_sent_at: string | null
          secondary_problems: string[] | null
          session_id: string
          thumbnail_url: string | null
          updated_at: string | null
          video_name: string | null
          video_url: string | null
          weakest_category: string | null
        }
        Insert: {
          analyzed_by?: string | null
          ball_score?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          coach_notes?: string | null
          created_at?: string | null
          free_diagnostic_report?: Json | null
          id?: string
          motor_profile?: string | null
          overall_score?: number | null
          player_id?: string | null
          primary_problem: string
          private_notes?: string | null
          recommended_drill_ids?: string[] | null
          report_generated_at?: string | null
          results_sent_at?: string | null
          secondary_problems?: string[] | null
          session_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
          video_name?: string | null
          video_url?: string | null
          weakest_category?: string | null
        }
        Update: {
          analyzed_by?: string | null
          ball_score?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          coach_notes?: string | null
          created_at?: string | null
          free_diagnostic_report?: Json | null
          id?: string
          motor_profile?: string | null
          overall_score?: number | null
          player_id?: string | null
          primary_problem?: string
          private_notes?: string | null
          recommended_drill_ids?: string[] | null
          report_generated_at?: string | null
          results_sent_at?: string | null
          secondary_problems?: string[] | null
          session_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          video_name?: string | null
          video_url?: string | null
          weakest_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swing_analyses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swing_analyses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swing_analyses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      swing_analysis: {
        Row: {
          all_segments_decel: boolean | null
          arms_decel_before_contact: boolean | null
          arms_vel_peak_frame: number | null
          created_at: string
          data_quality_flags: string[] | null
          duration_seconds: number | null
          event_contact_frame: number | null
          frame_rate: number | null
          id: string
          motor_profile: string | null
          motor_profile_confidence: number | null
          movement_id: string
          peak_timing_gap_ms: number | null
          peak_timing_gap_pct: number | null
          pelvis_decel_before_contact: boolean | null
          pelvis_vel_peak_frame: number | null
          player_id: string | null
          reboot_file_path: string | null
          sequence: string | null
          sequence_correct: boolean | null
          session_id: string | null
          slingshotter_score: number | null
          spinner_score: number | null
          titan_score: number | null
          torso_decel_before_contact: boolean | null
          torso_vel_peak_frame: number | null
          transfer_ratio: number | null
          transfer_ratio_rating: string | null
          updated_at: string
          whip_timing_pct: number | null
          whipper_score: number | null
          x_factor_at_contact: number | null
          x_factor_max: number | null
        }
        Insert: {
          all_segments_decel?: boolean | null
          arms_decel_before_contact?: boolean | null
          arms_vel_peak_frame?: number | null
          created_at?: string
          data_quality_flags?: string[] | null
          duration_seconds?: number | null
          event_contact_frame?: number | null
          frame_rate?: number | null
          id?: string
          motor_profile?: string | null
          motor_profile_confidence?: number | null
          movement_id: string
          peak_timing_gap_ms?: number | null
          peak_timing_gap_pct?: number | null
          pelvis_decel_before_contact?: boolean | null
          pelvis_vel_peak_frame?: number | null
          player_id?: string | null
          reboot_file_path?: string | null
          sequence?: string | null
          sequence_correct?: boolean | null
          session_id?: string | null
          slingshotter_score?: number | null
          spinner_score?: number | null
          titan_score?: number | null
          torso_decel_before_contact?: boolean | null
          torso_vel_peak_frame?: number | null
          transfer_ratio?: number | null
          transfer_ratio_rating?: string | null
          updated_at?: string
          whip_timing_pct?: number | null
          whipper_score?: number | null
          x_factor_at_contact?: number | null
          x_factor_max?: number | null
        }
        Update: {
          all_segments_decel?: boolean | null
          arms_decel_before_contact?: boolean | null
          arms_vel_peak_frame?: number | null
          created_at?: string
          data_quality_flags?: string[] | null
          duration_seconds?: number | null
          event_contact_frame?: number | null
          frame_rate?: number | null
          id?: string
          motor_profile?: string | null
          motor_profile_confidence?: number | null
          movement_id?: string
          peak_timing_gap_ms?: number | null
          peak_timing_gap_pct?: number | null
          pelvis_decel_before_contact?: boolean | null
          pelvis_vel_peak_frame?: number | null
          player_id?: string | null
          reboot_file_path?: string | null
          sequence?: string | null
          sequence_correct?: boolean | null
          session_id?: string | null
          slingshotter_score?: number | null
          spinner_score?: number | null
          titan_score?: number | null
          torso_decel_before_contact?: boolean | null
          torso_vel_peak_frame?: number | null
          transfer_ratio?: number | null
          transfer_ratio_rating?: string | null
          updated_at?: string
          whip_timing_pct?: number | null
          whipper_score?: number | null
          x_factor_at_contact?: number | null
          x_factor_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "swing_analysis_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swing_analysis_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      swing_flags: {
        Row: {
          created_at: string
          drill_tags: string[] | null
          flag_type: string
          id: string
          message: string | null
          pillar: string | null
          segment: string | null
          severity: string | null
          swing_id: string
        }
        Insert: {
          created_at?: string
          drill_tags?: string[] | null
          flag_type: string
          id?: string
          message?: string | null
          pillar?: string | null
          segment?: string | null
          severity?: string | null
          swing_id: string
        }
        Update: {
          created_at?: string
          drill_tags?: string[] | null
          flag_type?: string
          id?: string
          message?: string | null
          pillar?: string | null
          segment?: string | null
          severity?: string | null
          swing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swing_flags_swing_id_fkey"
            columns: ["swing_id"]
            isOneToOne: false
            referencedRelation: "swing_analysis"
            referencedColumns: ["id"]
          },
        ]
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
      sync_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          duration_ms: number | null
          errors_count: number | null
          id: string
          players_checked: number | null
          sessions_processed: number | null
          sync_type: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          errors_count?: number | null
          id?: string
          players_checked?: number | null
          sessions_processed?: number | null
          sync_type: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          errors_count?: number | null
          id?: string
          players_checked?: number | null
          sessions_processed?: number | null
          sync_type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_2d_batch_sessions: {
        Row: {
          avg_ball: number | null
          avg_bat: number | null
          avg_body: number | null
          avg_brain: number | null
          avg_composite: number | null
          completed_at: string | null
          completed_count: number | null
          consistency_cv: number | null
          created_at: string | null
          failed_count: number | null
          frame_rate: number | null
          id: string
          leak_frequency: string | null
          location: string | null
          most_common_leak: string | null
          motor_profile: string | null
          notes: string | null
          player_id: string | null
          primary_leak: string | null
          profile_confidence: number | null
          reboot_session_id: string | null
          session_date: string
          session_name: string | null
          session_type: string | null
          status: string | null
          swing_count: number | null
          updated_at: string | null
          upgraded_to_3d: boolean | null
        }
        Insert: {
          avg_ball?: number | null
          avg_bat?: number | null
          avg_body?: number | null
          avg_brain?: number | null
          avg_composite?: number | null
          completed_at?: string | null
          completed_count?: number | null
          consistency_cv?: number | null
          created_at?: string | null
          failed_count?: number | null
          frame_rate?: number | null
          id?: string
          leak_frequency?: string | null
          location?: string | null
          most_common_leak?: string | null
          motor_profile?: string | null
          notes?: string | null
          player_id?: string | null
          primary_leak?: string | null
          profile_confidence?: number | null
          reboot_session_id?: string | null
          session_date?: string
          session_name?: string | null
          session_type?: string | null
          status?: string | null
          swing_count?: number | null
          updated_at?: string | null
          upgraded_to_3d?: boolean | null
        }
        Update: {
          avg_ball?: number | null
          avg_bat?: number | null
          avg_body?: number | null
          avg_brain?: number | null
          avg_composite?: number | null
          completed_at?: string | null
          completed_count?: number | null
          consistency_cv?: number | null
          created_at?: string | null
          failed_count?: number | null
          frame_rate?: number | null
          id?: string
          leak_frequency?: string | null
          location?: string | null
          most_common_leak?: string | null
          motor_profile?: string | null
          notes?: string | null
          player_id?: string | null
          primary_leak?: string | null
          profile_confidence?: number | null
          reboot_session_id?: string | null
          session_date?: string
          session_name?: string | null
          session_type?: string | null
          status?: string | null
          swing_count?: number | null
          updated_at?: string | null
          upgraded_to_3d?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "video_2d_batch_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_2d_batch_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      video_2d_sessions: {
        Row: {
          analysis_confidence: number | null
          analysis_json: Json | null
          ball_score: number | null
          bat_score: number | null
          batch_session_id: string | null
          body_score: number | null
          brain_score: number | null
          camera_angle: string | null
          coach_rick_take: string | null
          completed_at: string | null
          composite_score: number | null
          context: string | null
          created_at: string | null
          error_message: string | null
          frame_rate: number | null
          grade: string | null
          id: string
          is_paid_user: boolean | null
          leak_detected: string | null
          leak_evidence: string | null
          motor_profile: string | null
          motor_profile_evidence: string | null
          motor_profile_indication: string | null
          pending_3d_analysis: boolean | null
          player_id: string | null
          priority_drill: string | null
          processing_status: string | null
          reboot_upload_id: string | null
          session_date: string
          swing_index: number | null
          swing_number: number | null
          updated_at: string | null
          upgraded_to_3d_at: string | null
          upload_source: string | null
          video_filename: string | null
          video_quality: string | null
          video_storage_path: string | null
          video_url: string
        }
        Insert: {
          analysis_confidence?: number | null
          analysis_json?: Json | null
          ball_score?: number | null
          bat_score?: number | null
          batch_session_id?: string | null
          body_score?: number | null
          brain_score?: number | null
          camera_angle?: string | null
          coach_rick_take?: string | null
          completed_at?: string | null
          composite_score?: number | null
          context?: string | null
          created_at?: string | null
          error_message?: string | null
          frame_rate?: number | null
          grade?: string | null
          id?: string
          is_paid_user?: boolean | null
          leak_detected?: string | null
          leak_evidence?: string | null
          motor_profile?: string | null
          motor_profile_evidence?: string | null
          motor_profile_indication?: string | null
          pending_3d_analysis?: boolean | null
          player_id?: string | null
          priority_drill?: string | null
          processing_status?: string | null
          reboot_upload_id?: string | null
          session_date?: string
          swing_index?: number | null
          swing_number?: number | null
          updated_at?: string | null
          upgraded_to_3d_at?: string | null
          upload_source?: string | null
          video_filename?: string | null
          video_quality?: string | null
          video_storage_path?: string | null
          video_url: string
        }
        Update: {
          analysis_confidence?: number | null
          analysis_json?: Json | null
          ball_score?: number | null
          bat_score?: number | null
          batch_session_id?: string | null
          body_score?: number | null
          brain_score?: number | null
          camera_angle?: string | null
          coach_rick_take?: string | null
          completed_at?: string | null
          composite_score?: number | null
          context?: string | null
          created_at?: string | null
          error_message?: string | null
          frame_rate?: number | null
          grade?: string | null
          id?: string
          is_paid_user?: boolean | null
          leak_detected?: string | null
          leak_evidence?: string | null
          motor_profile?: string | null
          motor_profile_evidence?: string | null
          motor_profile_indication?: string | null
          pending_3d_analysis?: boolean | null
          player_id?: string | null
          priority_drill?: string | null
          processing_status?: string | null
          reboot_upload_id?: string | null
          session_date?: string
          swing_index?: number | null
          swing_number?: number | null
          updated_at?: string | null
          upgraded_to_3d_at?: string | null
          upload_source?: string | null
          video_filename?: string | null
          video_quality?: string | null
          video_storage_path?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_2d_sessions_batch_session_id_fkey"
            columns: ["batch_session_id"]
            isOneToOne: false
            referencedRelation: "video_2d_batch_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_2d_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_2d_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_2d_sessions_reboot_upload_id_fkey"
            columns: ["reboot_upload_id"]
            isOneToOne: false
            referencedRelation: "pending_reboot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_2d_sessions_reboot_upload_id_fkey"
            columns: ["reboot_upload_id"]
            isOneToOne: false
            referencedRelation: "reboot_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      video_swing_events: {
        Row: {
          created_at: string
          frame_index: number | null
          id: string
          label: string | null
          phase: string
          swing_session_id: string
          time_ms: number
        }
        Insert: {
          created_at?: string
          frame_index?: number | null
          id?: string
          label?: string | null
          phase: string
          swing_session_id: string
          time_ms: number
        }
        Update: {
          created_at?: string
          frame_index?: number | null
          id?: string
          label?: string | null
          phase?: string
          swing_session_id?: string
          time_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_swing_events_swing_session_id_fkey"
            columns: ["swing_session_id"]
            isOneToOne: false
            referencedRelation: "video_swing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_swing_masks: {
        Row: {
          created_at: string
          event_id: string | null
          frame_time_ms: number
          id: string
          mask_type: string
          mask_url: string
          prompt_box: Json | null
          prompt_points: Json | null
          swing_session_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          frame_time_ms: number
          id?: string
          mask_type: string
          mask_url: string
          prompt_box?: Json | null
          prompt_points?: Json | null
          swing_session_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          frame_time_ms?: number
          id?: string
          mask_type?: string
          mask_url?: string
          prompt_box?: Json | null
          prompt_points?: Json | null
          swing_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_swing_masks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "video_swing_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_swing_masks_swing_session_id_fkey"
            columns: ["swing_session_id"]
            isOneToOne: false
            referencedRelation: "video_swing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_swing_metrics: {
        Row: {
          created_at: string
          id: string
          metric_name: string
          metric_units: string | null
          metric_value: number
          phase: string | null
          source: string | null
          swing_session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_name: string
          metric_units?: string | null
          metric_value: number
          phase?: string | null
          source?: string | null
          swing_session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_name?: string
          metric_units?: string | null
          metric_value?: number
          phase?: string | null
          source?: string | null
          swing_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_swing_metrics_swing_session_id_fkey"
            columns: ["swing_session_id"]
            isOneToOne: false
            referencedRelation: "video_swing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_swing_scores: {
        Row: {
          barrel_quality_score: number | null
          contact_optimization_score: number | null
          created_at: string
          id: string
          notes: string | null
          sequence_errors: Json | null
          sequence_match: boolean | null
          sequence_order: string[] | null
          sequence_score: number | null
          swing_session_id: string
        }
        Insert: {
          barrel_quality_score?: number | null
          contact_optimization_score?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          sequence_errors?: Json | null
          sequence_match?: boolean | null
          sequence_order?: string[] | null
          sequence_score?: number | null
          swing_session_id: string
        }
        Update: {
          barrel_quality_score?: number | null
          contact_optimization_score?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          sequence_errors?: Json | null
          sequence_match?: boolean | null
          sequence_order?: string[] | null
          sequence_score?: number | null
          swing_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_swing_scores_swing_session_id_fkey"
            columns: ["swing_session_id"]
            isOneToOne: false
            referencedRelation: "video_swing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_swing_sessions: {
        Row: {
          accuracy_tier: string | null
          analyzed_count: number | null
          ball_score: number | null
          bat_score: number | null
          body_score: number | null
          brain_score: number | null
          composite_score: number | null
          context: string | null
          correlated_reboot_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          is_active: boolean | null
          leak_frequency: number | null
          momentum_overlays: Json | null
          notes: string | null
          player_id: string
          primary_leak: string | null
          reboot_composite_delta: number | null
          session_date: string
          source: string | null
          status: string | null
          swing_count: number | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: string | null
          video_count: number | null
          video_url: string | null
          weakest_link: string | null
        }
        Insert: {
          accuracy_tier?: string | null
          analyzed_count?: number | null
          ball_score?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          composite_score?: number | null
          context?: string | null
          correlated_reboot_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          leak_frequency?: number | null
          momentum_overlays?: Json | null
          notes?: string | null
          player_id: string
          primary_leak?: string | null
          reboot_composite_delta?: number | null
          session_date?: string
          source?: string | null
          status?: string | null
          swing_count?: number | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string | null
          video_count?: number | null
          video_url?: string | null
          weakest_link?: string | null
        }
        Update: {
          accuracy_tier?: string | null
          analyzed_count?: number | null
          ball_score?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          composite_score?: number | null
          context?: string | null
          correlated_reboot_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          leak_frequency?: number | null
          momentum_overlays?: Json | null
          notes?: string | null
          player_id?: string
          primary_leak?: string | null
          reboot_composite_delta?: number | null
          session_date?: string
          source?: string | null
          status?: string | null
          swing_count?: number | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string | null
          video_count?: number | null
          video_url?: string | null
          weakest_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_swing_sessions_correlated_reboot_id_fkey"
            columns: ["correlated_reboot_id"]
            isOneToOne: false
            referencedRelation: "pending_reboot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_swing_sessions_correlated_reboot_id_fkey"
            columns: ["correlated_reboot_id"]
            isOneToOne: false
            referencedRelation: "reboot_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_swing_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_swing_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      video_swings: {
        Row: {
          created_at: string
          duration_seconds: number | null
          frame_rate: number | null
          id: string
          sequence_analysis: Json | null
          sequence_errors: Json | null
          sequence_score: number | null
          session_id: string
          status: string | null
          swing_index: number
          thumbnail_url: string | null
          updated_at: string
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          frame_rate?: number | null
          id?: string
          sequence_analysis?: Json | null
          sequence_errors?: Json | null
          sequence_score?: number | null
          session_id: string
          status?: string | null
          swing_index?: number
          thumbnail_url?: string | null
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          frame_rate?: number | null
          id?: string
          sequence_analysis?: Json | null
          sequence_errors?: Json | null
          sequence_score?: number | null
          session_id?: string
          status?: string | null
          swing_index?: number
          thumbnail_url?: string | null
          updated_at?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_swings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "video_swing_sessions"
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
      waitlist: {
        Row: {
          converted_at: string | null
          created_at: string | null
          email: string
          id: string
          interests: string[] | null
          invited_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          player_level: string | null
          referral_code: string | null
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          interests?: string[] | null
          invited_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          player_level?: string | null
          referral_code?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          interests?: string[] | null
          invited_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          player_level?: string | null
          referral_code?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      weekly_challenges: {
        Row: {
          challenge_type: string
          created_at: string | null
          description: string | null
          id: string
          min_swings: number | null
          name: string
          status: string | null
          target_metric: string | null
          target_type: string | null
          target_value: number | null
          week_end: string
          week_start: string
          winner_player_id: string | null
          winner_value: number | null
        }
        Insert: {
          challenge_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          min_swings?: number | null
          name: string
          status?: string | null
          target_metric?: string | null
          target_type?: string | null
          target_value?: number | null
          week_end: string
          week_start: string
          winner_player_id?: string | null
          winner_value?: number | null
        }
        Update: {
          challenge_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          min_swings?: number | null
          name?: string
          status?: string | null
          target_metric?: string | null
          target_type?: string | null
          target_value?: number | null
          week_end?: string
          week_start?: string
          winner_player_id?: string | null
          winner_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_challenges_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_challenges_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_log: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          new_total: number
          player_id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          new_total: number
          player_id: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          new_total?: number
          player_id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_log_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_log_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      pending_reboot_queue: {
        Row: {
          analysis_confidence: number | null
          estimated_grade: string | null
          estimated_score: number | null
          id: string | null
          leak_detected: string | null
          motor_profile: string | null
          original_video_url: string | null
          player_age: number | null
          player_id: string | null
          player_level: string | null
          player_name: string | null
          uploaded_at: string | null
          video_2d_analysis: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "reboot_uploads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reboot_uploads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      players_public: {
        Row: {
          created_at: string | null
          handedness: string | null
          height_inches: number | null
          id: string | null
          is_public: boolean | null
          level: string | null
          name: string | null
          player_level: number | null
          position: string | null
          team: string | null
          total_xp: number | null
          weight_lbs: number | null
        }
        Insert: {
          created_at?: string | null
          handedness?: string | null
          height_inches?: number | null
          id?: string | null
          is_public?: boolean | null
          level?: string | null
          name?: string | null
          player_level?: number | null
          position?: string | null
          team?: string | null
          total_xp?: number | null
          weight_lbs?: number | null
        }
        Update: {
          created_at?: string | null
          handedness?: string | null
          height_inches?: number | null
          id?: string | null
          is_public?: boolean | null
          level?: string | null
          name?: string | null
          player_level?: number | null
          position?: string | null
          team?: string | null
          total_xp?: number | null
          weight_lbs?: number | null
        }
        Relationships: []
      }
      practice_summary_30d: {
        Row: {
          avg_contact_score: number | null
          avg_ev: number | null
          avg_la: number | null
          barrel_pct: number | null
          fb_pct: number | null
          gb_pct: number | null
          hard_hit_pct: number | null
          ld_pct: number | null
          player_id: string | null
          sweet_spot_pct: number | null
          total_events: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batted_ball_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batted_ball_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_sessions: {
        Row: {
          accuracy_tier: string | null
          ball_score: number | null
          bat_score: number | null
          body_score: number | null
          brain_score: number | null
          composite_score: number | null
          correlated_reboot_id: string | null
          created_at: string | null
          ended_at: string | null
          id: string | null
          is_active: boolean | null
          player_id: string | null
          primary_leak: string | null
          reboot_composite_delta: number | null
          session_date: string | null
          source_type: string | null
          swing_count: number | null
          updated_at: string | null
          validation_status: string | null
          weakest_link: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_xp: {
        Args: {
          p_amount: number
          p_player_id: string
          p_reason: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: {
          leveled_up: boolean
          new_level: number
          new_xp: number
        }[]
      }
      backfill_players_from_profiles: {
        Args: { limit_count?: number }
        Returns: {
          created_player_id: string
          linked: boolean
          player_name: string
          profile_id: string
        }[]
      }
      calculate_player_level: { Args: { xp: number }; Returns: number }
      calculate_session_aggregates: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      ensure_player_linked: { Args: { p_profile_id: string }; Returns: string }
      find_player_by_phone: { Args: { phone_input: string }; Returns: string }
      find_similar_videos: {
        Args: { max_results?: number; video_id_param: string }
        Returns: {
          description: string
          duration_seconds: number
          four_b_category: string
          id: string
          problems_addressed: string[]
          similarity_score: number
          thumbnail_url: string
          title: string
          video_url: string
        }[]
      }
      get_prescribed_drills: {
        Args: {
          p_leak_type?: string
          p_motor_profile?: string
          p_player_id: string
          p_weakest_b?: string
          p_weakest_score?: number
        }
        Returns: {
          drill_id: string
          drill_name: string
          drill_slug: string
          instructions: string
          prescription_reason: string
          priority: number
          reps: number
          sets: number
          video_url: string
          why_it_works: string
        }[]
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
          has_contact_event: boolean
          id: string
          leak_type: string
          player_name: string
          product_type: string
          status: string
          swing_count: number
          weakest_category: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      search_video_transcripts: {
        Args: {
          category_filter?: string
          max_results?: number
          search_query: string
        }
        Returns: {
          description: string
          duration_seconds: number
          four_b_category: string
          id: string
          matching_excerpt: string
          problems_addressed: string[]
          relevance_score: number
          thumbnail_url: string
          title: string
          transcript: string
          video_url: string
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
      app_role: "admin" | "moderator" | "user"
      invite_status: "pending" | "accepted" | "expired" | "cancelled"
      invite_type: "diagnostic" | "assessment" | "membership" | "beta"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      invite_status: ["pending", "accepted", "expired", "cancelled"],
      invite_type: ["diagnostic", "assessment", "membership", "beta"],
    },
  },
} as const
