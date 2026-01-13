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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      api_cost_logs: {
        Row: {
          created_at: string
          credits_charged: number
          duration_seconds: number | null
          id: string
          metadata: Json | null
          operation: string
          project_id: string | null
          real_cost_cents: number
          service: string
          shot_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credits_charged?: number
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          operation: string
          project_id?: string | null
          real_cost_cents?: number
          service: string
          shot_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credits_charged?: number
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          operation?: string
          project_id?: string | null
          real_cost_cents?: number
          service?: string
          shot_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_cost_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_cost_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      character_loans: {
        Row: {
          borrower_id: string
          character_id: string
          credit_given: boolean | null
          expires_at: string | null
          id: string
          owner_id: string
          project_id: string | null
          requested_at: string | null
          responded_at: string | null
          status: string
          usage_notes: string | null
        }
        Insert: {
          borrower_id: string
          character_id: string
          credit_given?: boolean | null
          expires_at?: string | null
          id?: string
          owner_id: string
          project_id?: string | null
          requested_at?: string | null
          responded_at?: string | null
          status?: string
          usage_notes?: string | null
        }
        Update: {
          borrower_id?: string
          character_id?: string
          credit_given?: boolean | null
          expires_at?: string | null
          id?: string
          owner_id?: string
          project_id?: string | null
          requested_at?: string | null
          responded_at?: string | null
          status?: string
          usage_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_loans_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_loans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          appearance: string | null
          backstory: string | null
          created_at: string
          description: string | null
          id: string
          lending_credits_required: number | null
          lending_permission:
            | Database["public"]["Enums"]["lending_permission"]
            | null
          name: string
          personality: string | null
          times_borrowed: number | null
          universe_id: string | null
          user_id: string
          voice_id: string | null
        }
        Insert: {
          appearance?: string | null
          backstory?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lending_credits_required?: number | null
          lending_permission?:
            | Database["public"]["Enums"]["lending_permission"]
            | null
          name: string
          personality?: string | null
          times_borrowed?: number | null
          universe_id?: string | null
          user_id: string
          voice_id?: string | null
        }
        Update: {
          appearance?: string | null
          backstory?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lending_credits_required?: number | null
          lending_permission?:
            | Database["public"]["Enums"]["lending_permission"]
            | null
          name?: string
          personality?: string | null
          times_borrowed?: number | null
          universe_id?: string | null
          user_id?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "universes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          created_at: string
          credits: number
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          price_cents: number
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          credits: number
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name: string
          price_cents: number
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          clip_duration_seconds: number | null
          created_at: string
          description: string | null
          id: string
          project_id: string | null
          stripe_payment_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          clip_duration_seconds?: number | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          stripe_payment_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          clip_duration_seconds?: number | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          stripe_payment_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movie_projects: {
        Row: {
          created_at: string
          generated_script: string | null
          generation_checkpoint: Json | null
          genre: Database["public"]["Enums"]["movie_genre"]
          id: string
          include_narration: boolean
          is_public: boolean | null
          is_template: boolean | null
          last_checkpoint_at: string | null
          last_error: string | null
          likes_count: number | null
          mood: string | null
          movie_intro_style: string | null
          music_url: string | null
          parent_project_id: string | null
          pending_video_tasks: Json | null
          pipeline_stage: string | null
          pro_features_data: Json | null
          quality_tier: string | null
          scene_images: Json | null
          script_content: string | null
          setting: string | null
          status: string
          stitch_attempts: number | null
          story_structure: Database["public"]["Enums"]["story_structure"]
          synopsis: string | null
          target_duration_minutes: number
          thumbnail_url: string | null
          time_period: string | null
          title: string
          universe_id: string | null
          updated_at: string
          user_id: string
          video_clips: string[] | null
          video_url: string | null
          voice_audio_url: string | null
        }
        Insert: {
          created_at?: string
          generated_script?: string | null
          generation_checkpoint?: Json | null
          genre?: Database["public"]["Enums"]["movie_genre"]
          id?: string
          include_narration?: boolean
          is_public?: boolean | null
          is_template?: boolean | null
          last_checkpoint_at?: string | null
          last_error?: string | null
          likes_count?: number | null
          mood?: string | null
          movie_intro_style?: string | null
          music_url?: string | null
          parent_project_id?: string | null
          pending_video_tasks?: Json | null
          pipeline_stage?: string | null
          pro_features_data?: Json | null
          quality_tier?: string | null
          scene_images?: Json | null
          script_content?: string | null
          setting?: string | null
          status?: string
          stitch_attempts?: number | null
          story_structure?: Database["public"]["Enums"]["story_structure"]
          synopsis?: string | null
          target_duration_minutes?: number
          thumbnail_url?: string | null
          time_period?: string | null
          title: string
          universe_id?: string | null
          updated_at?: string
          user_id: string
          video_clips?: string[] | null
          video_url?: string | null
          voice_audio_url?: string | null
        }
        Update: {
          created_at?: string
          generated_script?: string | null
          generation_checkpoint?: Json | null
          genre?: Database["public"]["Enums"]["movie_genre"]
          id?: string
          include_narration?: boolean
          is_public?: boolean | null
          is_template?: boolean | null
          last_checkpoint_at?: string | null
          last_error?: string | null
          likes_count?: number | null
          mood?: string | null
          movie_intro_style?: string | null
          music_url?: string | null
          parent_project_id?: string | null
          pending_video_tasks?: Json | null
          pipeline_stage?: string | null
          pro_features_data?: Json | null
          quality_tier?: string | null
          scene_images?: Json | null
          script_content?: string | null
          setting?: string | null
          status?: string
          stitch_attempts?: number | null
          story_structure?: Database["public"]["Enums"]["story_structure"]
          synopsis?: string | null
          target_duration_minutes?: number
          thumbnail_url?: string | null
          time_period?: string | null
          title?: string
          universe_id?: string | null
          updated_at?: string
          user_id?: string
          video_clips?: string[] | null
          video_url?: string | null
          voice_audio_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movie_projects_parent_project_id_fkey"
            columns: ["parent_project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movie_projects_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "universes"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          clip_duration_seconds: number
          credits_cost: number
          description: string | null
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          clip_duration_seconds: number
          credits_cost: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          clip_duration_seconds?: number
          credits_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      production_credit_phases: {
        Row: {
          api_cost_log_id: string | null
          created_at: string
          credits_amount: number
          id: string
          phase: string
          project_id: string | null
          refund_reason: string | null
          shot_id: string
          status: string
          user_id: string
        }
        Insert: {
          api_cost_log_id?: string | null
          created_at?: string
          credits_amount: number
          id?: string
          phase: string
          project_id?: string | null
          refund_reason?: string | null
          shot_id: string
          status?: string
          user_id: string
        }
        Update: {
          api_cost_log_id?: string | null
          created_at?: string
          credits_amount?: number
          id?: string
          phase?: string
          project_id?: string | null
          refund_reason?: string | null
          shot_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_credit_phases_api_cost_log_id_fkey"
            columns: ["api_cost_log_id"]
            isOneToOne: false
            referencedRelation: "api_cost_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_credit_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_credit_phases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_tier: string
          auto_recharge_enabled: boolean | null
          avatar_url: string | null
          company: string | null
          created_at: string
          credits_balance: number
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          notification_settings: Json | null
          onboarding_completed: boolean | null
          preferences: Json | null
          role: string | null
          total_credits_purchased: number
          total_credits_used: number
          updated_at: string
          use_case: string | null
        }
        Insert: {
          account_tier?: string
          auto_recharge_enabled?: boolean | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          credits_balance?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          notification_settings?: Json | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          role?: string | null
          total_credits_purchased?: number
          total_credits_used?: number
          updated_at?: string
          use_case?: string | null
        }
        Update: {
          account_tier?: string
          auto_recharge_enabled?: boolean | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          credits_balance?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          notification_settings?: Json | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          role?: string | null
          total_credits_purchased?: number
          total_credits_used?: number
          updated_at?: string
          use_case?: string | null
        }
        Relationships: []
      }
      project_characters: {
        Row: {
          character_id: string
          created_at: string
          id: string
          project_id: string
          role: string | null
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          project_id: string
          role?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_characters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_characters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          aspect_ratio: string | null
          category: string | null
          character_templates: Json | null
          clip_count: number | null
          color_grading: string | null
          created_at: string
          description: string | null
          environment_lock: Json | null
          genre: string | null
          id: string
          include_sfx: boolean | null
          is_public: boolean | null
          mood: string | null
          music_mood: string | null
          name: string
          pacing_style: string | null
          quality_tier: string | null
          shot_sequence: Json | null
          style_anchor: Json | null
          target_duration_minutes: number | null
          thumbnail_url: string | null
          updated_at: string
          use_count: number | null
          user_id: string
          voice_id: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          category?: string | null
          character_templates?: Json | null
          clip_count?: number | null
          color_grading?: string | null
          created_at?: string
          description?: string | null
          environment_lock?: Json | null
          genre?: string | null
          id?: string
          include_sfx?: boolean | null
          is_public?: boolean | null
          mood?: string | null
          music_mood?: string | null
          name: string
          pacing_style?: string | null
          quality_tier?: string | null
          shot_sequence?: Json | null
          style_anchor?: Json | null
          target_duration_minutes?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          use_count?: number | null
          user_id: string
          voice_id?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          category?: string | null
          character_templates?: Json | null
          clip_count?: number | null
          color_grading?: string | null
          created_at?: string
          description?: string | null
          environment_lock?: Json | null
          genre?: string | null
          id?: string
          include_sfx?: boolean | null
          is_public?: boolean | null
          mood?: string | null
          music_mood?: string | null
          name?: string
          pacing_style?: string | null
          quality_tier?: string | null
          shot_sequence?: Json | null
          style_anchor?: Json | null
          target_duration_minutes?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          use_count?: number | null
          user_id?: string
          voice_id?: string | null
        }
        Relationships: []
      }
      script_templates: {
        Row: {
          created_at: string
          description: string | null
          genre: Database["public"]["Enums"]["movie_genre"] | null
          id: string
          name: string
          sample_script: string | null
          story_structure: Database["public"]["Enums"]["story_structure"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          genre?: Database["public"]["Enums"]["movie_genre"] | null
          id?: string
          name: string
          sample_script?: string | null
          story_structure?:
            | Database["public"]["Enums"]["story_structure"]
            | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          genre?: Database["public"]["Enums"]["movie_genre"] | null
          id?: string
          name?: string
          sample_script?: string | null
          story_structure?:
            | Database["public"]["Enums"]["story_structure"]
            | null
          user_id?: string
        }
        Relationships: []
      }
      stitch_jobs: {
        Row: {
          attempt_number: number
          chunk_urls: string[] | null
          completed_at: string | null
          completed_chunks: number
          created_at: string
          current_step: string | null
          file_size_bytes: number | null
          final_duration_seconds: number | null
          final_video_url: string | null
          id: string
          last_error: string | null
          max_attempts: number
          mode: string
          progress: number
          project_id: string
          retry_after: string | null
          started_at: string | null
          status: string
          total_chunks: number
          total_clips: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_number?: number
          chunk_urls?: string[] | null
          completed_at?: string | null
          completed_chunks?: number
          created_at?: string
          current_step?: string | null
          file_size_bytes?: number | null
          final_duration_seconds?: number | null
          final_video_url?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          mode?: string
          progress?: number
          project_id: string
          retry_after?: string | null
          started_at?: string | null
          status?: string
          total_chunks?: number
          total_clips?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          chunk_urls?: string[] | null
          completed_at?: string | null
          completed_chunks?: number
          created_at?: string
          current_step?: string | null
          file_size_bytes?: number | null
          final_duration_seconds?: number | null
          final_video_url?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          mode?: string
          progress?: number
          project_id?: string
          retry_after?: string | null
          started_at?: string | null
          status?: string
          total_chunks?: number
          total_clips?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stitch_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stitch_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          source: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          source?: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          source?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tier_limits: {
        Row: {
          chunked_stitching: boolean
          created_at: string
          id: string
          max_clips_per_video: number
          max_concurrent_projects: number
          max_duration_minutes: number
          max_retries_per_clip: number
          priority_queue: boolean
          tier: string
          updated_at: string
        }
        Insert: {
          chunked_stitching?: boolean
          created_at?: string
          id?: string
          max_clips_per_video?: number
          max_concurrent_projects?: number
          max_duration_minutes?: number
          max_retries_per_clip?: number
          priority_queue?: boolean
          tier: string
          updated_at?: string
        }
        Update: {
          chunked_stitching?: boolean
          created_at?: string
          id?: string
          max_clips_per_video?: number
          max_concurrent_projects?: number
          max_duration_minutes?: number
          max_retries_per_clip?: number
          priority_queue?: boolean
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      universe_activity: {
        Row: {
          activity_type: string
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          thumbnail_url: string | null
          title: string
          universe_id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          thumbnail_url?: string | null
          title: string
          universe_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          thumbnail_url?: string | null
          title?: string
          universe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "universe_activity_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "universes"
            referencedColumns: ["id"]
          },
        ]
      }
      universe_continuity: {
        Row: {
          affected_characters: string[] | null
          created_at: string | null
          created_by: string
          date_in_universe: string | null
          description: string | null
          event_type: string
          id: string
          is_canon: boolean | null
          metadata: Json | null
          source_project_id: string | null
          timeline_position: number | null
          title: string
          universe_id: string
          updated_at: string | null
        }
        Insert: {
          affected_characters?: string[] | null
          created_at?: string | null
          created_by: string
          date_in_universe?: string | null
          description?: string | null
          event_type: string
          id?: string
          is_canon?: boolean | null
          metadata?: Json | null
          source_project_id?: string | null
          timeline_position?: number | null
          title: string
          universe_id: string
          updated_at?: string | null
        }
        Update: {
          affected_characters?: string[] | null
          created_at?: string | null
          created_by?: string
          date_in_universe?: string | null
          description?: string | null
          event_type?: string
          id?: string
          is_canon?: boolean | null
          metadata?: Json | null
          source_project_id?: string | null
          timeline_position?: number | null
          title?: string
          universe_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "universe_continuity_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universe_continuity_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "universes"
            referencedColumns: ["id"]
          },
        ]
      }
      universe_invitations: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          invited_by: string
          invited_email: string
          role: Database["public"]["Enums"]["universe_role"] | null
          status: string | null
          universe_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invited_by: string
          invited_email: string
          role?: Database["public"]["Enums"]["universe_role"] | null
          status?: string | null
          universe_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string
          invited_email?: string
          role?: Database["public"]["Enums"]["universe_role"] | null
          status?: string | null
          universe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "universe_invitations_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "universes"
            referencedColumns: ["id"]
          },
        ]
      }
      universe_members: {
        Row: {
          can_add_characters: boolean | null
          can_edit_lore: boolean | null
          can_invite_members: boolean | null
          id: string
          invited_by: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["universe_role"]
          universe_id: string
          user_id: string
        }
        Insert: {
          can_add_characters?: boolean | null
          can_edit_lore?: boolean | null
          can_invite_members?: boolean | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["universe_role"]
          universe_id: string
          user_id: string
        }
        Update: {
          can_add_characters?: boolean | null
          can_edit_lore?: boolean | null
          can_invite_members?: boolean | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["universe_role"]
          universe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "universe_members_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "universes"
            referencedColumns: ["id"]
          },
        ]
      }
      universes: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          lore_document: string | null
          member_count: number | null
          name: string
          rules: string | null
          setting: string | null
          style_guide: Json | null
          tags: string[] | null
          time_period: string | null
          updated_at: string
          user_id: string
          video_count: number | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          lore_document?: string | null
          member_count?: number | null
          name: string
          rules?: string | null
          setting?: string | null
          style_guide?: Json | null
          tags?: string[] | null
          time_period?: string | null
          updated_at?: string
          user_id: string
          video_count?: number | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          lore_document?: string | null
          member_count?: number | null
          name?: string
          rules?: string | null
          setting?: string | null
          style_guide?: Json | null
          tags?: string[] | null
          time_period?: string | null
          updated_at?: string
          user_id?: string
          video_count?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_clips: {
        Row: {
          color_profile: Json | null
          completed_at: string | null
          corrective_prompts: string[] | null
          created_at: string
          debug_attempts: number | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          last_error_category: string | null
          last_frame_url: string | null
          max_retries: number | null
          motion_vectors: Json | null
          project_id: string
          prompt: string
          quality_score: number | null
          retry_count: number | null
          shot_index: number
          status: string
          updated_at: string
          user_id: string
          veo_operation_name: string | null
          video_url: string | null
        }
        Insert: {
          color_profile?: Json | null
          completed_at?: string | null
          corrective_prompts?: string[] | null
          created_at?: string
          debug_attempts?: number | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          last_error_category?: string | null
          last_frame_url?: string | null
          max_retries?: number | null
          motion_vectors?: Json | null
          project_id: string
          prompt: string
          quality_score?: number | null
          retry_count?: number | null
          shot_index: number
          status?: string
          updated_at?: string
          user_id: string
          veo_operation_name?: string | null
          video_url?: string | null
        }
        Update: {
          color_profile?: Json | null
          completed_at?: string | null
          corrective_prompts?: string[] | null
          created_at?: string
          debug_attempts?: number | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          last_error_category?: string | null
          last_frame_url?: string | null
          max_retries?: number | null
          motion_vectors?: Json | null
          project_id?: string
          prompt?: string
          quality_score?: number | null
          retry_count?: number | null
          shot_index?: number
          status?: string
          updated_at?: string
          user_id?: string
          veo_operation_name?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_clips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: {
          p_amount: number
          p_description: string
          p_stripe_payment_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      admin_adjust_credits: {
        Args: { p_amount: number; p_reason: string; p_target_user_id: string }
        Returns: Json
      }
      admin_list_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          account_tier: string
          created_at: string
          credits_balance: number
          display_name: string
          email: string
          full_name: string
          id: string
          project_count: number
          roles: Database["public"]["Enums"]["app_role"][]
          total_credits_purchased: number
          total_credits_used: number
        }[]
      }
      admin_manage_role: {
        Args: {
          p_action: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: Json
      }
      charge_preproduction_credits: {
        Args: { p_project_id: string; p_shot_id: string; p_user_id: string }
        Returns: Json
      }
      charge_production_credits: {
        Args: { p_project_id: string; p_shot_id: string; p_user_id: string }
        Returns: Json
      }
      deduct_credits: {
        Args: {
          p_amount: number
          p_clip_duration?: number
          p_description: string
          p_project_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
      get_admin_profit_dashboard: {
        Args: never
        Returns: {
          date: string
          estimated_revenue_cents: number
          profit_margin_percent: number
          service: string
          total_credits_charged: number
          total_operations: number
          total_real_cost_cents: number
        }[]
      }
      get_admin_stats: { Args: never; Returns: Json }
      get_generation_checkpoint: {
        Args: { p_project_id: string }
        Returns: {
          completed_count: number
          failed_count: number
          last_completed_index: number
          last_frame_url: string
          pending_count: number
        }[]
      }
      get_universe_role: {
        Args: { p_universe_id: string; p_user_id: string }
        Returns: Database["public"]["Enums"]["universe_role"]
      }
      get_user_tier_limits: { Args: { p_user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_universe_member: {
        Args: { p_universe_id: string; p_user_id: string }
        Returns: boolean
      }
      log_api_cost: {
        Args: {
          p_credits_charged: number
          p_duration_seconds?: number
          p_metadata?: Json
          p_operation: string
          p_project_id: string
          p_real_cost_cents: number
          p_service: string
          p_shot_id: string
          p_status?: string
          p_user_id: string
        }
        Returns: string
      }
      refund_production_credits: {
        Args: {
          p_project_id: string
          p_reason: string
          p_shot_id: string
          p_user_id: string
        }
        Returns: Json
      }
      update_generation_checkpoint: {
        Args: {
          p_failed_shots?: Json
          p_last_completed_shot: number
          p_project_id: string
          p_total_shots: number
        }
        Returns: boolean
      }
      upsert_video_clip:
        | {
            Args: {
              p_error_message?: string
              p_last_frame_url?: string
              p_motion_vectors?: Json
              p_project_id: string
              p_prompt: string
              p_shot_index: number
              p_status?: string
              p_user_id: string
              p_veo_operation_name?: string
              p_video_url?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_duration_seconds?: number
              p_error_message?: string
              p_last_frame_url?: string
              p_motion_vectors?: Json
              p_project_id: string
              p_prompt: string
              p_shot_index: number
              p_status?: string
              p_user_id: string
              p_veo_operation_name?: string
              p_video_url?: string
            }
            Returns: string
          }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      lending_permission: "none" | "universe_only" | "specific_users" | "public"
      movie_genre:
        | "ad"
        | "educational"
        | "documentary"
        | "cinematic"
        | "funny"
        | "religious"
        | "motivational"
        | "storytelling"
        | "explainer"
        | "vlog"
      story_structure:
        | "three_act"
        | "hero_journey"
        | "circular"
        | "in_medias_res"
        | "episodic"
      universe_role: "owner" | "admin" | "member" | "viewer"
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
      lending_permission: ["none", "universe_only", "specific_users", "public"],
      movie_genre: [
        "ad",
        "educational",
        "documentary",
        "cinematic",
        "funny",
        "religious",
        "motivational",
        "storytelling",
        "explainer",
        "vlog",
      ],
      story_structure: [
        "three_act",
        "hero_journey",
        "circular",
        "in_medias_res",
        "episodic",
      ],
      universe_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
