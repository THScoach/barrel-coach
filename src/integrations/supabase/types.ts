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
            foreignKeyName: "batted_ball_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "launch_monitor_sessions"
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
          completed_at: string | null
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
          completed_at?: string | null
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
          completed_at?: string | null
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
            foreignKeyName: "drill_completions_player_program_id_fkey"
            columns: ["player_program_id"]
            isOneToOne: false
            referencedRelation: "player_programs"
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
          created_at: string | null
          cues: string[] | null
          description: string | null
          difficulty: string | null
          duration_minutes: number | null
          equipment: string[] | null
          four_b_category: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          name: string
          reps: number | null
          sets: number | null
          thumbnail_url: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          cues?: string[] | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          equipment?: string[] | null
          four_b_category?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name: string
          reps?: number | null
          sets?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          cues?: string[] | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          equipment?: string[] | null
          four_b_category?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name?: string
          reps?: number | null
          sets?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      fourb_scores: {
        Row: {
          ball_score: number | null
          bat_ke: number | null
          bat_score: number | null
          body_score: number | null
          brain_score: number | null
          composite_score: number | null
          consistency_cv: number | null
          consistency_grade: string | null
          core_flow_score: number | null
          created_at: string | null
          grade: string | null
          ground_flow_score: number | null
          id: string
          pelvis_velocity: number | null
          player_id: string | null
          prescribed_drill_id: string | null
          prescribed_drill_name: string | null
          primary_issue_category: string | null
          primary_issue_description: string | null
          primary_issue_title: string | null
          reboot_session_id: string | null
          torso_velocity: number | null
          transfer_efficiency: number | null
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
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          created_at?: string | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          pelvis_velocity?: number | null
          player_id?: string | null
          prescribed_drill_id?: string | null
          prescribed_drill_name?: string | null
          primary_issue_category?: string | null
          primary_issue_description?: string | null
          primary_issue_title?: string | null
          reboot_session_id?: string | null
          torso_velocity?: number | null
          transfer_efficiency?: number | null
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
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          created_at?: string | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          pelvis_velocity?: number | null
          player_id?: string | null
          prescribed_drill_id?: string | null
          prescribed_drill_name?: string | null
          primary_issue_category?: string | null
          primary_issue_description?: string | null
          primary_issue_title?: string | null
          reboot_session_id?: string | null
          torso_velocity?: number | null
          transfer_efficiency?: number | null
          upper_flow_score?: number | null
          weakest_link?: string | null
          x_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fourb_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fourb_scores_reboot_session_id_fkey"
            columns: ["reboot_session_id"]
            isOneToOne: false
            referencedRelation: "reboot_sessions"
            referencedColumns: ["id"]
          },
        ]
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
        ]
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
            foreignKeyName: "player_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
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
          bbref_id: string | null
          beta_expires_at: string | null
          beta_notes: string | null
          can_login: boolean | null
          created_at: string | null
          email: string | null
          fangraphs_id: string | null
          handedness: string | null
          height_inches: number | null
          id: string
          is_beta_tester: boolean | null
          is_in_season: boolean | null
          is_public: boolean | null
          is_validation_study: boolean | null
          latest_ball_score: number | null
          latest_bat_score: number | null
          latest_body_score: number | null
          latest_brain_score: number | null
          latest_composite_score: number | null
          latest_hittrax_session_id: string | null
          level: string | null
          mlb_id: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          reboot_athlete_id: string | null
          stripe_customer_id: string | null
          team: string | null
          updated_at: string | null
          weight_lbs: number | null
        }
        Insert: {
          account_status?: string | null
          account_type?: string | null
          activated_at?: string | null
          age?: number | null
          bbref_id?: string | null
          beta_expires_at?: string | null
          beta_notes?: string | null
          can_login?: boolean | null
          created_at?: string | null
          email?: string | null
          fangraphs_id?: string | null
          handedness?: string | null
          height_inches?: number | null
          id?: string
          is_beta_tester?: boolean | null
          is_in_season?: boolean | null
          is_public?: boolean | null
          is_validation_study?: boolean | null
          latest_ball_score?: number | null
          latest_bat_score?: number | null
          latest_body_score?: number | null
          latest_brain_score?: number | null
          latest_composite_score?: number | null
          latest_hittrax_session_id?: string | null
          level?: string | null
          mlb_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          reboot_athlete_id?: string | null
          stripe_customer_id?: string | null
          team?: string | null
          updated_at?: string | null
          weight_lbs?: number | null
        }
        Update: {
          account_status?: string | null
          account_type?: string | null
          activated_at?: string | null
          age?: number | null
          bbref_id?: string | null
          beta_expires_at?: string | null
          beta_notes?: string | null
          can_login?: boolean | null
          created_at?: string | null
          email?: string | null
          fangraphs_id?: string | null
          handedness?: string | null
          height_inches?: number | null
          id?: string
          is_beta_tester?: boolean | null
          is_in_season?: boolean | null
          is_public?: boolean | null
          is_validation_study?: boolean | null
          latest_ball_score?: number | null
          latest_bat_score?: number | null
          latest_body_score?: number | null
          latest_brain_score?: number | null
          latest_composite_score?: number | null
          latest_hittrax_session_id?: string | null
          level?: string | null
          mlb_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          reboot_athlete_id?: string | null
          stripe_customer_id?: string | null
          team?: string | null
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
        ]
      }
      reboot_uploads: {
        Row: {
          bat_ke: number | null
          bat_score: number | null
          body_score: number | null
          brain_score: number | null
          composite_score: number | null
          consistency_cv: number | null
          consistency_grade: string | null
          core_flow_score: number | null
          created_at: string | null
          grade: string | null
          ground_flow_score: number | null
          id: string
          ik_data: Json | null
          ik_file_uploaded: boolean | null
          me_data: Json | null
          me_file_uploaded: boolean | null
          pelvis_velocity: number | null
          player_id: string | null
          session_date: string
          torso_velocity: number | null
          transfer_efficiency: number | null
          updated_at: string | null
          upper_flow_score: number | null
          weakest_link: string | null
          x_factor: number | null
        }
        Insert: {
          bat_ke?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          created_at?: string | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          ik_data?: Json | null
          ik_file_uploaded?: boolean | null
          me_data?: Json | null
          me_file_uploaded?: boolean | null
          pelvis_velocity?: number | null
          player_id?: string | null
          session_date: string
          torso_velocity?: number | null
          transfer_efficiency?: number | null
          updated_at?: string | null
          upper_flow_score?: number | null
          weakest_link?: string | null
          x_factor?: number | null
        }
        Update: {
          bat_ke?: number | null
          bat_score?: number | null
          body_score?: number | null
          brain_score?: number | null
          composite_score?: number | null
          consistency_cv?: number | null
          consistency_grade?: string | null
          core_flow_score?: number | null
          created_at?: string | null
          grade?: string | null
          ground_flow_score?: number | null
          id?: string
          ik_data?: Json | null
          ik_file_uploaded?: boolean | null
          me_data?: Json | null
          me_file_uploaded?: boolean | null
          pelvis_velocity?: number | null
          player_id?: string | null
          session_date?: string
          torso_velocity?: number | null
          transfer_efficiency?: number | null
          updated_at?: string | null
          upper_flow_score?: number | null
          weakest_link?: string | null
          x_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reboot_uploads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
      swing_analyses: {
        Row: {
          analyzed_by: string | null
          ball_score: number | null
          bat_score: number | null
          body_score: number | null
          brain_score: number | null
          coach_notes: string | null
          created_at: string | null
          id: string
          motor_profile: string | null
          overall_score: number | null
          primary_problem: string
          private_notes: string | null
          recommended_drill_ids: string[] | null
          report_generated_at: string | null
          results_sent_at: string | null
          secondary_problems: string[] | null
          session_id: string
          updated_at: string | null
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
          id?: string
          motor_profile?: string | null
          overall_score?: number | null
          primary_problem: string
          private_notes?: string | null
          recommended_drill_ids?: string[] | null
          report_generated_at?: string | null
          results_sent_at?: string | null
          secondary_problems?: string[] | null
          session_id: string
          updated_at?: string | null
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
          id?: string
          motor_profile?: string | null
          overall_score?: number | null
          primary_problem?: string
          private_notes?: string | null
          recommended_drill_ids?: string[] | null
          report_generated_at?: string | null
          results_sent_at?: string | null
          secondary_problems?: string[] | null
          session_id?: string
          updated_at?: string | null
          weakest_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swing_analyses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
          analyzed_count: number | null
          context: string | null
          created_at: string
          id: string
          momentum_overlays: Json | null
          notes: string | null
          player_id: string
          session_date: string
          source: string | null
          status: string | null
          updated_at: string
          video_count: number | null
          video_url: string | null
        }
        Insert: {
          analyzed_count?: number | null
          context?: string | null
          created_at?: string
          id?: string
          momentum_overlays?: Json | null
          notes?: string | null
          player_id: string
          session_date?: string
          source?: string | null
          status?: string | null
          updated_at?: string
          video_count?: number | null
          video_url?: string | null
        }
        Update: {
          analyzed_count?: number | null
          context?: string | null
          created_at?: string
          id?: string
          momentum_overlays?: Json | null
          notes?: string | null
          player_id?: string
          session_date?: string
          source?: string | null
          status?: string | null
          updated_at?: string
          video_count?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_swing_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
    }
    Views: {
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
        ]
      }
    }
    Functions: {
      backfill_players_from_profiles: {
        Args: { limit_count?: number }
        Returns: {
          created_player_id: string
          linked: boolean
          player_name: string
          profile_id: string
        }[]
      }
      calculate_session_aggregates: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      ensure_player_linked: { Args: { p_profile_id: string }; Returns: string }
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
