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
      achievements: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          rarity: string
          requirement_type: string
          requirement_value: number
          xp_reward: number
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          name: string
          rarity?: string
          requirement_type: string
          requirement_value?: number
          xp_reward?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          rarity?: string
          requirement_type?: string
          requirement_value?: number
          xp_reward?: number
        }
        Relationships: []
      }
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
      admin_impersonation_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          reason: string
          target_user_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          ended_at?: string | null
          expires_at: string
          id?: string
          reason: string
          target_user_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          reason?: string
          target_user_id?: string
        }
        Relationships: []
      }
      agent_conversations: {
        Row: {
          created_at: string
          id: string
          message_count: number | null
          summary: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_count?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_count?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_preferences: {
        Row: {
          agent_personality: string | null
          created_at: string
          greeting_name: string | null
          id: string
          interaction_count: number | null
          last_interaction_at: string | null
          learned_context: Json | null
          preferred_aspect_ratio: string | null
          preferred_clip_count: number | null
          preferred_mode: string | null
          preferred_style: string | null
          preferred_tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_personality?: string | null
          created_at?: string
          greeting_name?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          learned_context?: Json | null
          preferred_aspect_ratio?: string | null
          preferred_clip_count?: number | null
          preferred_mode?: string | null
          preferred_style?: string | null
          preferred_tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_personality?: string | null
          created_at?: string
          greeting_name?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          learned_context?: Json | null
          preferred_aspect_ratio?: string | null
          preferred_clip_count?: number | null
          preferred_mode?: string | null
          preferred_style?: string | null
          preferred_tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_query_analytics: {
        Row: {
          created_at: string
          credits_spent: number | null
          id: string
          query_category: string | null
          query_text: string
          response_quality: string | null
          session_page: string | null
          tools_used: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number | null
          id?: string
          query_category?: string | null
          query_text: string
          response_quality?: string | null
          session_page?: string | null
          tools_used?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          credits_spent?: number | null
          id?: string
          query_category?: string | null
          query_text?: string
          response_quality?: string | null
          session_page?: string | null
          tools_used?: string[] | null
          user_id?: string
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
            foreignKeyName: "api_cost_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_cost_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_cost_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          credits_charged: number
          endpoint: string
          error_message: string | null
          id: string
          request_id: string | null
          status_code: number
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          credits_charged?: number
          endpoint: string
          error_message?: string | null
          id?: string
          request_id?: string | null
          status_code: number
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          credits_charged?: number
          endpoint?: string
          error_message?: string | null
          id?: string
          request_id?: string | null
          status_code?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          created_at: string
          id: string
          note: string | null
          organization_id: string
          project_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: string
          submitted_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          organization_id: string
          project_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          submitted_by: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          project_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "approval_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_templates: {
        Row: {
          age_range: string | null
          avatar_type: string | null
          back_image_url: string | null
          character_bible: Json | null
          created_at: string
          description: string | null
          ethnicity: string | null
          face_image_url: string
          front_image_url: string | null
          gender: string
          id: string
          is_active: boolean | null
          is_premium: boolean | null
          name: string
          personality: string | null
          sample_audio_url: string | null
          side_image_url: string | null
          sort_order: number | null
          style: string | null
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string
          use_count: number | null
          voice_description: string | null
          voice_id: string
          voice_name: string | null
          voice_provider: string
        }
        Insert: {
          age_range?: string | null
          avatar_type?: string | null
          back_image_url?: string | null
          character_bible?: Json | null
          created_at?: string
          description?: string | null
          ethnicity?: string | null
          face_image_url: string
          front_image_url?: string | null
          gender?: string
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          name: string
          personality?: string | null
          sample_audio_url?: string | null
          side_image_url?: string | null
          sort_order?: number | null
          style?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          use_count?: number | null
          voice_description?: string | null
          voice_id: string
          voice_name?: string | null
          voice_provider?: string
        }
        Update: {
          age_range?: string | null
          avatar_type?: string | null
          back_image_url?: string | null
          character_bible?: Json | null
          created_at?: string
          description?: string | null
          ethnicity?: string | null
          face_image_url?: string
          front_image_url?: string | null
          gender?: string
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          name?: string
          personality?: string | null
          sample_audio_url?: string | null
          side_image_url?: string | null
          sort_order?: number | null
          style?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          use_count?: number | null
          voice_description?: string | null
          voice_id?: string
          voice_name?: string | null
          voice_provider?: string
        }
        Relationships: []
      }
      banned_accounts: {
        Row: {
          banned_by: string | null
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          banned_by?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          banned_by?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_email_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          reason?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      brand_kits: {
        Row: {
          accent_color: string | null
          background_color: string | null
          created_at: string
          created_by: string
          font_body: string | null
          font_heading: string | null
          guidelines_url: string | null
          id: string
          is_default: boolean
          logo_url: string | null
          name: string
          organization_id: string
          primary_color: string | null
          text_color: string | null
          updated_at: string
          voice_style: string | null
          voice_tone: string | null
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string
          created_by: string
          font_body?: string | null
          font_heading?: string | null
          guidelines_url?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name: string
          organization_id: string
          primary_color?: string | null
          text_color?: string | null
          updated_at?: string
          voice_style?: string | null
          voice_tone?: string | null
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string
          created_by?: string
          font_body?: string | null
          font_heading?: string | null
          guidelines_url?: string | null
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name?: string
          organization_id?: string
          primary_color?: string | null
          text_color?: string | null
          updated_at?: string
          voice_style?: string | null
          voice_tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "brand_kits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          {
            foreignKeyName: "character_loans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      character_voice_assignments: {
        Row: {
          character_id: string | null
          character_name: string
          created_at: string | null
          id: string
          project_id: string
          updated_at: string | null
          voice_id: string
          voice_provider: string | null
        }
        Insert: {
          character_id?: string | null
          character_name: string
          created_at?: string | null
          id?: string
          project_id: string
          updated_at?: string | null
          voice_id: string
          voice_provider?: string | null
        }
        Update: {
          character_id?: string | null
          character_name?: string
          created_at?: string | null
          id?: string
          project_id?: string
          updated_at?: string | null
          voice_id?: string
          voice_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_voice_assignments_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_voice_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_voice_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
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
          voice_assigned_at: string | null
          voice_id: string | null
          voice_locked: boolean | null
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
          voice_assigned_at?: string | null
          voice_id?: string | null
          voice_locked?: boolean | null
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
          voice_assigned_at?: string | null
          voice_id?: string | null
          voice_locked?: boolean | null
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
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean | null
          media_thumbnail_url: string | null
          media_url: string | null
          message_type: string
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          media_thumbnail_url?: string | null
          media_url?: string | null
          message_type?: string
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          media_thumbnail_url?: string | null
          media_url?: string | null
          message_type?: string
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      cinema_usage_ledger: {
        Row: {
          clip_id: string | null
          created_at: string
          engine: string
          id: string
          metadata: Json
          overage_credits_charged: number
          period_end: string
          period_start: string
          project_id: string | null
          seconds_used: number
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          clip_id?: string | null
          created_at?: string
          engine: string
          id?: string
          metadata?: Json
          overage_credits_charged?: number
          period_end: string
          period_start: string
          project_id?: string | null
          seconds_used: number
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          clip_id?: string | null
          created_at?: string
          engine?: string
          id?: string
          metadata?: Json
          overage_credits_charged?: number
          period_end?: string
          period_start?: string
          project_id?: string | null
          seconds_used?: number
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "project_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "project_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean | null
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      creation_canvases: {
        Row: {
          created_at: string
          edges: Json
          id: string
          name: string
          nodes: Json
          project_id: string | null
          updated_at: string
          user_id: string
          viewport: Json
        }
        Insert: {
          created_at?: string
          edges?: Json
          id?: string
          name?: string
          nodes?: Json
          project_id?: string | null
          updated_at?: string
          user_id: string
          viewport?: Json
        }
        Update: {
          created_at?: string
          edges?: Json
          id?: string
          name?: string
          nodes?: Json
          project_id?: string | null
          updated_at?: string
          user_id?: string
          viewport?: Json
        }
        Relationships: []
      }
      credit_holds: {
        Row: {
          amount: number
          consumed_at: string | null
          created_at: string
          description: string | null
          expires_at: string
          id: string
          idempotency_key: string | null
          project_id: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["credit_hold_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          consumed_at?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          idempotency_key?: string | null
          project_id?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["credit_hold_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          consumed_at?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          idempotency_key?: string | null
          project_id?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["credit_hold_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_holds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_holds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_holds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_holds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
          idempotency_key: string | null
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
          idempotency_key?: string | null
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
          idempotency_key?: string | null
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
            foreignKeyName: "credit_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenges: {
        Row: {
          challenge_type: string
          created_at: string
          date: string
          description: string
          id: string
          target_count: number
          xp_reward: number
        }
        Insert: {
          challenge_type: string
          created_at?: string
          date?: string
          description: string
          id?: string
          target_count?: number
          xp_reward?: number
        }
        Update: {
          challenge_type?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          target_count?: number
          xp_reward?: number
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      edit_sessions: {
        Row: {
          created_at: string
          id: string
          project_id: string | null
          render_error: string | null
          render_progress: number | null
          render_settings: Json | null
          render_url: string | null
          status: string
          timeline_data: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id?: string | null
          render_error?: string | null
          render_progress?: number | null
          render_settings?: Json | null
          render_url?: string | null
          status?: string
          timeline_data?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string | null
          render_error?: string | null
          render_progress?: number | null
          render_settings?: Json | null
          render_url?: string | null
          status?: string
          timeline_data?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enterprise_leads: {
        Row: {
          brand_color_primary: string | null
          brand_color_secondary: string | null
          brand_font: string | null
          brand_logo_url: string | null
          brand_notes: string | null
          company_name: string
          company_size: string | null
          created_at: string
          data_residency: string | null
          email: string
          expected_videos_per_month: string | null
          id: string
          industry: string | null
          nda_requested: boolean
          needs_dpa: boolean
          needs_sso: boolean
          primary_use_case: string | null
          role: string | null
          security_questionnaire_requested: boolean
          status: string
          target_launch_date: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          brand_font?: string | null
          brand_logo_url?: string | null
          brand_notes?: string | null
          company_name: string
          company_size?: string | null
          created_at?: string
          data_residency?: string | null
          email: string
          expected_videos_per_month?: string | null
          id?: string
          industry?: string | null
          nda_requested?: boolean
          needs_dpa?: boolean
          needs_sso?: boolean
          primary_use_case?: string | null
          role?: string | null
          security_questionnaire_requested?: boolean
          status?: string
          target_launch_date?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          brand_font?: string | null
          brand_logo_url?: string | null
          brand_notes?: string | null
          company_name?: string
          company_size?: string | null
          created_at?: string
          data_residency?: string | null
          email?: string
          expected_videos_per_month?: string | null
          id?: string
          industry?: string | null
          nda_requested?: boolean
          needs_dpa?: boolean
          needs_sso?: boolean
          primary_use_case?: string | null
          role?: string | null
          security_questionnaire_requested?: boolean
          status?: string
          target_launch_date?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      enterprise_provisioning: {
        Row: {
          assigned_admin: string | null
          company_name: string
          contract_end_at: string | null
          contract_start_at: string | null
          contract_value_cents: number | null
          created_at: string
          created_by: string | null
          id: string
          included_credits_monthly: number
          included_seats: number
          notes: string | null
          organization_id: string | null
          primary_contact_email: string
          sales_inquiry_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_admin?: string | null
          company_name: string
          contract_end_at?: string | null
          contract_start_at?: string | null
          contract_value_cents?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          included_credits_monthly?: number
          included_seats?: number
          notes?: string | null
          organization_id?: string | null
          primary_contact_email: string
          sales_inquiry_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_admin?: string | null
          company_name?: string
          contract_end_at?: string | null
          contract_start_at?: string | null
          contract_value_cents?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          included_credits_monthly?: number
          included_seats?: number
          notes?: string | null
          organization_id?: string | null
          primary_contact_email?: string
          sales_inquiry_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_provisioning_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "enterprise_provisioning_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_provisioning_sales_inquiry_id_fkey"
            columns: ["sales_inquiry_id"]
            isOneToOne: false
            referencedRelation: "sales_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      error_reports: {
        Row: {
          app_version: string | null
          category: string
          code: string
          context: Json
          id: string
          occurred_at: string
          page_url: string | null
          retryable: boolean
          session_id: string | null
          severity: string
          stack: string | null
          technical_message: string | null
          user_agent: string | null
          user_id: string | null
          user_message: string | null
        }
        Insert: {
          app_version?: string | null
          category: string
          code: string
          context?: Json
          id?: string
          occurred_at?: string
          page_url?: string | null
          retryable?: boolean
          session_id?: string | null
          severity: string
          stack?: string | null
          technical_message?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_message?: string | null
        }
        Update: {
          app_version?: string | null
          category?: string
          code?: string
          context?: Json
          id?: string
          occurred_at?: string
          page_url?: string | null
          retryable?: boolean
          session_id?: string | null
          severity?: string
          stack?: string | null
          technical_message?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_message?: string | null
        }
        Relationships: []
      }
      feature_requests: {
        Row: {
          created_at: string
          email: string | null
          feature: string
          id: string
          note: string | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          feature: string
          id?: string
          note?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          feature?: string
          id?: string
          note?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "feature_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_showcase: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      genesis_character_appearances: {
        Row: {
          character_id: string | null
          character_name: string
          created_at: string | null
          description: string | null
          emotional_state: string | null
          first_appearance_video: boolean | null
          id: string
          location_in_scene: string | null
          outfit_description: string | null
          role_type: string
          video_id: string | null
        }
        Insert: {
          character_id?: string | null
          character_name: string
          created_at?: string | null
          description?: string | null
          emotional_state?: string | null
          first_appearance_video?: boolean | null
          id?: string
          location_in_scene?: string | null
          outfit_description?: string | null
          role_type?: string
          video_id?: string | null
        }
        Update: {
          character_id?: string | null
          character_name?: string
          created_at?: string | null
          description?: string | null
          emotional_state?: string | null
          first_appearance_video?: boolean | null
          id?: string
          location_in_scene?: string | null
          outfit_description?: string | null
          role_type?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_character_appearances_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_character_appearances_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "genesis_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_character_castings: {
        Row: {
          additional_images: string[] | null
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          character_id: string | null
          consent_given_at: string | null
          created_at: string | null
          face_image_url: string
          id: string
          image_consent_given: boolean | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          additional_images?: string[] | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          character_id?: string | null
          consent_given_at?: string | null
          created_at?: string | null
          face_image_url: string
          id?: string
          image_consent_given?: boolean | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          additional_images?: string[] | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          character_id?: string | null
          consent_given_at?: string | null
          created_at?: string | null
          face_image_url?: string
          id?: string
          image_consent_given?: boolean | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_character_castings_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "genesis_preset_characters"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_character_interactions: {
        Row: {
          changes_relationship: boolean | null
          character_1_id: string | null
          character_1_name: string
          character_2_id: string | null
          character_2_name: string
          created_at: string | null
          description: string | null
          id: string
          interaction_outcome: string | null
          interaction_type: string
          is_first_meeting: boolean | null
          new_relationship_status: string | null
          video_id: string | null
        }
        Insert: {
          changes_relationship?: boolean | null
          character_1_id?: string | null
          character_1_name: string
          character_2_id?: string | null
          character_2_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          interaction_outcome?: string | null
          interaction_type: string
          is_first_meeting?: boolean | null
          new_relationship_status?: string | null
          video_id?: string | null
        }
        Update: {
          changes_relationship?: boolean | null
          character_1_id?: string | null
          character_1_name?: string
          character_2_id?: string | null
          character_2_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          interaction_outcome?: string | null
          interaction_type?: string
          is_first_meeting?: boolean | null
          new_relationship_status?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_character_interactions_character_1_id_fkey"
            columns: ["character_1_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_character_interactions_character_2_id_fkey"
            columns: ["character_2_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_character_interactions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "genesis_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_continuity_anchors: {
        Row: {
          affected_characters: string[] | null
          anchor_type: string
          created_at: string | null
          date_in_universe: string | null
          description: string
          era_id: string | null
          established_by: string | null
          id: string
          is_canon: boolean | null
          is_immutable: boolean | null
          location_id: string | null
          source_video_id: string | null
          title: string
          updated_at: string | null
          votes_against: number | null
          votes_for: number | null
        }
        Insert: {
          affected_characters?: string[] | null
          anchor_type: string
          created_at?: string | null
          date_in_universe?: string | null
          description: string
          era_id?: string | null
          established_by?: string | null
          id?: string
          is_canon?: boolean | null
          is_immutable?: boolean | null
          location_id?: string | null
          source_video_id?: string | null
          title: string
          updated_at?: string | null
          votes_against?: number | null
          votes_for?: number | null
        }
        Update: {
          affected_characters?: string[] | null
          anchor_type?: string
          created_at?: string | null
          date_in_universe?: string | null
          description?: string
          era_id?: string | null
          established_by?: string | null
          id?: string
          is_canon?: boolean | null
          is_immutable?: boolean | null
          location_id?: string | null
          source_video_id?: string | null
          title?: string
          updated_at?: string | null
          votes_against?: number | null
          votes_for?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_continuity_anchors_era_id_fkey"
            columns: ["era_id"]
            isOneToOne: false
            referencedRelation: "genesis_eras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_continuity_anchors_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "genesis_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_continuity_anchors_source_video_id_fkey"
            columns: ["source_video_id"]
            isOneToOne: false
            referencedRelation: "genesis_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_environment_templates: {
        Row: {
          atmosphere: string | null
          color_palette: Json | null
          created_at: string
          era_id: string | null
          id: string
          is_default: boolean | null
          lighting_preset: Json | null
          location_id: string | null
          negative_prompts: string[] | null
          prompt_prefix: string | null
          prompt_suffix: string | null
          reference_images: string[] | null
          template_name: string
          thumbnail_url: string | null
          updated_at: string
          visual_style: Json
        }
        Insert: {
          atmosphere?: string | null
          color_palette?: Json | null
          created_at?: string
          era_id?: string | null
          id?: string
          is_default?: boolean | null
          lighting_preset?: Json | null
          location_id?: string | null
          negative_prompts?: string[] | null
          prompt_prefix?: string | null
          prompt_suffix?: string | null
          reference_images?: string[] | null
          template_name: string
          thumbnail_url?: string | null
          updated_at?: string
          visual_style?: Json
        }
        Update: {
          atmosphere?: string | null
          color_palette?: Json | null
          created_at?: string
          era_id?: string | null
          id?: string
          is_default?: boolean | null
          lighting_preset?: Json | null
          location_id?: string | null
          negative_prompts?: string[] | null
          prompt_prefix?: string | null
          prompt_suffix?: string | null
          reference_images?: string[] | null
          template_name?: string
          thumbnail_url?: string | null
          updated_at?: string
          visual_style?: Json
        }
        Relationships: [
          {
            foreignKeyName: "genesis_environment_templates_era_id_fkey"
            columns: ["era_id"]
            isOneToOne: false
            referencedRelation: "genesis_eras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_environment_templates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "genesis_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_eras: {
        Row: {
          created_at: string
          created_by: string | null
          cultural_notes: string | null
          description: string | null
          dominant_technology: string | null
          end_year: number | null
          era_order: number
          id: string
          image_url: string | null
          is_official: boolean | null
          key_events: string[] | null
          name: string
          start_year: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cultural_notes?: string | null
          description?: string | null
          dominant_technology?: string | null
          end_year?: number | null
          era_order?: number
          id?: string
          image_url?: string | null
          is_official?: boolean | null
          key_events?: string[] | null
          name: string
          start_year?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cultural_notes?: string | null
          description?: string | null
          dominant_technology?: string | null
          end_year?: number | null
          era_order?: number
          id?: string
          image_url?: string | null
          is_official?: boolean | null
          key_events?: string[] | null
          name?: string
          start_year?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      genesis_final_assembly: {
        Row: {
          assembled_by: string | null
          assembly_notes: string | null
          assembly_order: Json | null
          created_at: string | null
          final_video_url: string | null
          id: string
          published_at: string | null
          screenplay_id: string | null
          status: string | null
          title: string
          total_clips: number | null
          total_duration_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          assembled_by?: string | null
          assembly_notes?: string | null
          assembly_order?: Json | null
          created_at?: string | null
          final_video_url?: string | null
          id?: string
          published_at?: string | null
          screenplay_id?: string | null
          status?: string | null
          title: string
          total_clips?: number | null
          total_duration_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          assembled_by?: string | null
          assembly_notes?: string | null
          assembly_order?: Json | null
          created_at?: string | null
          final_video_url?: string | null
          id?: string
          published_at?: string | null
          screenplay_id?: string | null
          status?: string | null
          title?: string
          total_clips?: number | null
          total_duration_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_final_assembly_screenplay_id_fkey"
            columns: ["screenplay_id"]
            isOneToOne: false
            referencedRelation: "genesis_screenplay"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_location_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          location_type: string
          name: string
          parent_location_id: string | null
          reason: string | null
          reference_images: string[] | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          suggested_coordinates: Json | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_type: string
          name: string
          parent_location_id?: string | null
          reason?: string | null
          reference_images?: string[] | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_coordinates?: Json | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location_type?: string
          name?: string
          parent_location_id?: string | null
          reason?: string | null
          reference_images?: string[] | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_coordinates?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "genesis_location_requests_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "genesis_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_locations: {
        Row: {
          approval_status: string | null
          climate: string | null
          coordinates: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          environment_preset: Json | null
          id: string
          image_url: string | null
          is_official: boolean | null
          is_requestable: boolean | null
          location_type: string
          name: string
          notable_features: string[] | null
          parent_location_id: string | null
          population: string | null
          prompt_modifiers: string[] | null
          reference_image_urls: string[] | null
          time_of_day_variants: Json | null
          updated_at: string
          weather_variants: Json | null
        }
        Insert: {
          approval_status?: string | null
          climate?: string | null
          coordinates?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment_preset?: Json | null
          id?: string
          image_url?: string | null
          is_official?: boolean | null
          is_requestable?: boolean | null
          location_type?: string
          name: string
          notable_features?: string[] | null
          parent_location_id?: string | null
          population?: string | null
          prompt_modifiers?: string[] | null
          reference_image_urls?: string[] | null
          time_of_day_variants?: Json | null
          updated_at?: string
          weather_variants?: Json | null
        }
        Update: {
          approval_status?: string | null
          climate?: string | null
          coordinates?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment_preset?: Json | null
          id?: string
          image_url?: string | null
          is_official?: boolean | null
          is_requestable?: boolean | null
          location_type?: string
          name?: string
          notable_features?: string[] | null
          parent_location_id?: string | null
          population?: string | null
          prompt_modifiers?: string[] | null
          reference_image_urls?: string[] | null
          time_of_day_variants?: Json | null
          updated_at?: string
          weather_variants?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "genesis_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_lore: {
        Row: {
          content: string
          created_at: string
          created_by: string
          era_id: string | null
          id: string
          is_canon: boolean | null
          location_id: string | null
          lore_type: string
          title: string
          updated_at: string
          upvotes: number | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          era_id?: string | null
          id?: string
          is_canon?: boolean | null
          location_id?: string | null
          lore_type?: string
          title: string
          updated_at?: string
          upvotes?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          era_id?: string | null
          id?: string
          is_canon?: boolean | null
          location_id?: string | null
          lore_type?: string
          title?: string
          updated_at?: string
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_lore_era_id_fkey"
            columns: ["era_id"]
            isOneToOne: false
            referencedRelation: "genesis_eras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_lore_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "genesis_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_preset_characters: {
        Row: {
          age_range: string | null
          appearance_description: string | null
          backstory: string | null
          cast_at: string | null
          cast_by: string | null
          created_at: string | null
          description: string | null
          gender: string | null
          id: string
          is_cast: boolean | null
          name: string
          personality: string | null
          reference_image_url: string | null
          role_type: string | null
          screenplay_id: string | null
          total_scenes: number | null
          updated_at: string | null
          voice_notes: string | null
          wardrobe_notes: string | null
        }
        Insert: {
          age_range?: string | null
          appearance_description?: string | null
          backstory?: string | null
          cast_at?: string | null
          cast_by?: string | null
          created_at?: string | null
          description?: string | null
          gender?: string | null
          id?: string
          is_cast?: boolean | null
          name: string
          personality?: string | null
          reference_image_url?: string | null
          role_type?: string | null
          screenplay_id?: string | null
          total_scenes?: number | null
          updated_at?: string | null
          voice_notes?: string | null
          wardrobe_notes?: string | null
        }
        Update: {
          age_range?: string | null
          appearance_description?: string | null
          backstory?: string | null
          cast_at?: string | null
          cast_by?: string | null
          created_at?: string | null
          description?: string | null
          gender?: string | null
          id?: string
          is_cast?: boolean | null
          name?: string
          personality?: string | null
          reference_image_url?: string | null
          role_type?: string | null
          screenplay_id?: string | null
          total_scenes?: number | null
          updated_at?: string | null
          voice_notes?: string | null
          wardrobe_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_preset_characters_screenplay_id_fkey"
            columns: ["screenplay_id"]
            isOneToOne: false
            referencedRelation: "genesis_screenplay"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_scene_characters: {
        Row: {
          action_description: string | null
          character_id: string | null
          created_at: string | null
          dialogue: string | null
          emotional_state: string | null
          entrance_type: string | null
          exit_type: string | null
          id: string
          interaction_with: string[] | null
          is_speaking: boolean | null
          position_in_scene: string | null
          scene_id: string | null
          screen_time_seconds: number | null
        }
        Insert: {
          action_description?: string | null
          character_id?: string | null
          created_at?: string | null
          dialogue?: string | null
          emotional_state?: string | null
          entrance_type?: string | null
          exit_type?: string | null
          id?: string
          interaction_with?: string[] | null
          is_speaking?: boolean | null
          position_in_scene?: string | null
          scene_id?: string | null
          screen_time_seconds?: number | null
        }
        Update: {
          action_description?: string | null
          character_id?: string | null
          created_at?: string | null
          dialogue?: string | null
          emotional_state?: string | null
          entrance_type?: string | null
          exit_type?: string | null
          id?: string
          interaction_with?: string[] | null
          is_speaking?: boolean | null
          position_in_scene?: string | null
          scene_id?: string | null
          screen_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_scene_characters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "genesis_preset_characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_scene_characters_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "genesis_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_scene_clips: {
        Row: {
          admin_feedback: string | null
          consistency_score: number | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          is_selected_for_final: boolean | null
          project_id: string | null
          quality_score: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          scene_id: string | null
          status: string | null
          submitted_by: string | null
          thumbnail_url: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          admin_feedback?: string | null
          consistency_score?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_selected_for_final?: boolean | null
          project_id?: string | null
          quality_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scene_id?: string | null
          status?: string | null
          submitted_by?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          admin_feedback?: string | null
          consistency_score?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_selected_for_final?: boolean | null
          project_id?: string | null
          quality_score?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scene_id?: string | null
          status?: string | null
          submitted_by?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_scene_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_scene_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_scene_clips_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "genesis_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_scenes: {
        Row: {
          act_number: number | null
          camera_directions: string | null
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          era_id: string | null
          id: string
          is_key_scene: boolean | null
          location_id: string | null
          mood: string | null
          scene_number: number
          screenplay_id: string | null
          status: string | null
          time_of_day: string | null
          title: string
          updated_at: string | null
          visual_prompt: string | null
          weather: string | null
        }
        Insert: {
          act_number?: number | null
          camera_directions?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          era_id?: string | null
          id?: string
          is_key_scene?: boolean | null
          location_id?: string | null
          mood?: string | null
          scene_number: number
          screenplay_id?: string | null
          status?: string | null
          time_of_day?: string | null
          title: string
          updated_at?: string | null
          visual_prompt?: string | null
          weather?: string | null
        }
        Update: {
          act_number?: number | null
          camera_directions?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          era_id?: string | null
          id?: string
          is_key_scene?: boolean | null
          location_id?: string | null
          mood?: string | null
          scene_number?: number
          screenplay_id?: string | null
          status?: string | null
          time_of_day?: string | null
          title?: string
          updated_at?: string | null
          visual_prompt?: string | null
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_scenes_era_id_fkey"
            columns: ["era_id"]
            isOneToOne: false
            referencedRelation: "genesis_eras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_scenes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "genesis_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_scenes_screenplay_id_fkey"
            columns: ["screenplay_id"]
            isOneToOne: false
            referencedRelation: "genesis_screenplay"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_screenplay: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          status: string | null
          synopsis: string | null
          title: string
          total_characters: number | null
          total_duration_minutes: number | null
          total_scenes: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string | null
          synopsis?: string | null
          title: string
          total_characters?: number | null
          total_duration_minutes?: number | null
          total_scenes?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          status?: string | null
          synopsis?: string | null
          title?: string
          total_characters?: number | null
          total_duration_minutes?: number | null
          total_scenes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      genesis_story_arcs: {
        Row: {
          arc_type: string
          created_at: string | null
          created_by: string | null
          current_chapter: number | null
          description: string | null
          end_date_in_universe: string | null
          era_id: string | null
          id: string
          is_canon: boolean | null
          location_id: string | null
          start_date_in_universe: string | null
          status: string
          synopsis: string | null
          themes: string[] | null
          title: string
          total_chapters: number | null
          updated_at: string | null
        }
        Insert: {
          arc_type?: string
          created_at?: string | null
          created_by?: string | null
          current_chapter?: number | null
          description?: string | null
          end_date_in_universe?: string | null
          era_id?: string | null
          id?: string
          is_canon?: boolean | null
          location_id?: string | null
          start_date_in_universe?: string | null
          status?: string
          synopsis?: string | null
          themes?: string[] | null
          title: string
          total_chapters?: number | null
          updated_at?: string | null
        }
        Update: {
          arc_type?: string
          created_at?: string | null
          created_by?: string | null
          current_chapter?: number | null
          description?: string | null
          end_date_in_universe?: string | null
          era_id?: string | null
          id?: string
          is_canon?: boolean | null
          location_id?: string | null
          start_date_in_universe?: string | null
          status?: string
          synopsis?: string | null
          themes?: string[] | null
          title?: string
          total_chapters?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_story_arcs_era_id_fkey"
            columns: ["era_id"]
            isOneToOne: false
            referencedRelation: "genesis_eras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_story_arcs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "genesis_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_story_connections: {
        Row: {
          approved_by: string | null
          arc_id: string | null
          chapter_number: number | null
          connection_type: string
          created_at: string | null
          id: string
          is_official: boolean | null
          narrative_notes: string | null
          sequence_order: number | null
          video_id: string | null
        }
        Insert: {
          approved_by?: string | null
          arc_id?: string | null
          chapter_number?: number | null
          connection_type?: string
          created_at?: string | null
          id?: string
          is_official?: boolean | null
          narrative_notes?: string | null
          sequence_order?: number | null
          video_id?: string | null
        }
        Update: {
          approved_by?: string | null
          arc_id?: string | null
          chapter_number?: number | null
          connection_type?: string
          created_at?: string | null
          id?: string
          is_official?: boolean | null
          narrative_notes?: string | null
          sequence_order?: number | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_story_connections_arc_id_fkey"
            columns: ["arc_id"]
            isOneToOne: false
            referencedRelation: "genesis_story_arcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_story_connections_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "genesis_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_universe_rules: {
        Row: {
          category: string
          created_at: string
          description: string
          examples: Json | null
          id: string
          is_active: boolean | null
          priority: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          examples?: Json | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          examples?: Json | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      genesis_video_votes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "genesis_video_votes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "genesis_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_videos: {
        Row: {
          canon_at: string | null
          canon_status: string
          characters_featured: string[] | null
          created_at: string
          description: string | null
          downvotes: number | null
          duration_seconds: number | null
          era_id: string | null
          featured_at: string | null
          id: string
          location_id: string | null
          project_id: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          upvotes: number | null
          user_id: string
          video_url: string | null
          vote_score: number | null
        }
        Insert: {
          canon_at?: string | null
          canon_status?: string
          characters_featured?: string[] | null
          created_at?: string
          description?: string | null
          downvotes?: number | null
          duration_seconds?: number | null
          era_id?: string | null
          featured_at?: string | null
          id?: string
          location_id?: string | null
          project_id: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          upvotes?: number | null
          user_id: string
          video_url?: string | null
          vote_score?: number | null
        }
        Update: {
          canon_at?: string | null
          canon_status?: string
          characters_featured?: string[] | null
          created_at?: string
          description?: string | null
          downvotes?: number | null
          duration_seconds?: number | null
          era_id?: string | null
          featured_at?: string | null
          id?: string
          location_id?: string | null
          project_id?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          upvotes?: number | null
          user_id?: string
          video_url?: string | null
          vote_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "genesis_videos_era_id_fkey"
            columns: ["era_id"]
            isOneToOne: false
            referencedRelation: "genesis_eras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_videos_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "genesis_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_videos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "genesis_videos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      movie_projects: {
        Row: {
          aspect_ratio: string | null
          avatar_voice_id: string | null
          continuity_manifest_v2: Json | null
          created_at: string
          engine: string
          generated_script: string | null
          generation_checkpoint: Json | null
          generation_lock: Json | null
          genre: Database["public"]["Enums"]["movie_genre"]
          id: string
          include_narration: boolean
          is_public: boolean | null
          is_template: boolean | null
          last_checkpoint_at: string | null
          last_error: string | null
          likes_count: number | null
          mode: string | null
          moderation_status: string | null
          mood: string | null
          movie_intro_style: string | null
          music_url: string | null
          organization_id: string | null
          parent_project_id: string | null
          pending_video_tasks: Json | null
          pipeline_context_snapshot: Json | null
          pipeline_stage: string | null
          pipeline_state: Json | null
          pro_features_data: Json | null
          quality_options: Json
          quality_tier: string | null
          scene_images: Json | null
          script_content: string | null
          setting: string | null
          source_image_url: string | null
          source_video_url: string | null
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
          video_engine: string | null
          video_url: string | null
          voice_audio_url: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          avatar_voice_id?: string | null
          continuity_manifest_v2?: Json | null
          created_at?: string
          engine?: string
          generated_script?: string | null
          generation_checkpoint?: Json | null
          generation_lock?: Json | null
          genre?: Database["public"]["Enums"]["movie_genre"]
          id?: string
          include_narration?: boolean
          is_public?: boolean | null
          is_template?: boolean | null
          last_checkpoint_at?: string | null
          last_error?: string | null
          likes_count?: number | null
          mode?: string | null
          moderation_status?: string | null
          mood?: string | null
          movie_intro_style?: string | null
          music_url?: string | null
          organization_id?: string | null
          parent_project_id?: string | null
          pending_video_tasks?: Json | null
          pipeline_context_snapshot?: Json | null
          pipeline_stage?: string | null
          pipeline_state?: Json | null
          pro_features_data?: Json | null
          quality_options?: Json
          quality_tier?: string | null
          scene_images?: Json | null
          script_content?: string | null
          setting?: string | null
          source_image_url?: string | null
          source_video_url?: string | null
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
          video_engine?: string | null
          video_url?: string | null
          voice_audio_url?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          avatar_voice_id?: string | null
          continuity_manifest_v2?: Json | null
          created_at?: string
          engine?: string
          generated_script?: string | null
          generation_checkpoint?: Json | null
          generation_lock?: Json | null
          genre?: Database["public"]["Enums"]["movie_genre"]
          id?: string
          include_narration?: boolean
          is_public?: boolean | null
          is_template?: boolean | null
          last_checkpoint_at?: string | null
          last_error?: string | null
          likes_count?: number | null
          mode?: string | null
          moderation_status?: string | null
          mood?: string | null
          movie_intro_style?: string | null
          music_url?: string | null
          organization_id?: string | null
          parent_project_id?: string | null
          pending_video_tasks?: Json | null
          pipeline_context_snapshot?: Json | null
          pipeline_stage?: string | null
          pipeline_state?: Json | null
          pro_features_data?: Json | null
          quality_options?: Json
          quality_tier?: string | null
          scene_images?: Json | null
          script_content?: string | null
          setting?: string | null
          source_image_url?: string | null
          source_video_url?: string | null
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
          video_engine?: string | null
          video_url?: string | null
          voice_audio_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movie_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "movie_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movie_projects_parent_project_id_fkey"
            columns: ["parent_project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movie_projects_parent_project_id_fkey"
            columns: ["parent_project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      onboarding_intents: {
        Row: {
          account_type: string
          billing_email: string | null
          brand_colors: string[] | null
          brand_voice: string | null
          company_name: string | null
          consumed_at: string | null
          consumed_by_user_id: string | null
          contact_email: string | null
          contact_phone: string | null
          content_goals: string[] | null
          created_at: string
          current_tools: string[] | null
          display_name: string | null
          expected_volume: string | null
          experience_level: string | null
          goals: string[] | null
          id: string
          industry: string | null
          integrations_needed: string[] | null
          intent_token: string
          invited_emails: string[] | null
          job_role: string | null
          monthly_volume: string | null
          needs_api: boolean | null
          needs_sla: boolean | null
          needs_sso: boolean | null
          primary_use_case: string | null
          selected_plan_id: string | null
          selected_plan_kind: string | null
          team_size: string | null
          vat_id: string | null
        }
        Insert: {
          account_type: string
          billing_email?: string | null
          brand_colors?: string[] | null
          brand_voice?: string | null
          company_name?: string | null
          consumed_at?: string | null
          consumed_by_user_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          content_goals?: string[] | null
          created_at?: string
          current_tools?: string[] | null
          display_name?: string | null
          expected_volume?: string | null
          experience_level?: string | null
          goals?: string[] | null
          id?: string
          industry?: string | null
          integrations_needed?: string[] | null
          intent_token: string
          invited_emails?: string[] | null
          job_role?: string | null
          monthly_volume?: string | null
          needs_api?: boolean | null
          needs_sla?: boolean | null
          needs_sso?: boolean | null
          primary_use_case?: string | null
          selected_plan_id?: string | null
          selected_plan_kind?: string | null
          team_size?: string | null
          vat_id?: string | null
        }
        Update: {
          account_type?: string
          billing_email?: string | null
          brand_colors?: string[] | null
          brand_voice?: string | null
          company_name?: string | null
          consumed_at?: string | null
          consumed_by_user_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          content_goals?: string[] | null
          created_at?: string
          current_tools?: string[] | null
          display_name?: string | null
          expected_volume?: string | null
          experience_level?: string | null
          goals?: string[] | null
          id?: string
          industry?: string | null
          integrations_needed?: string[] | null
          intent_token?: string
          invited_emails?: string[] | null
          job_role?: string | null
          monthly_volume?: string | null
          needs_api?: boolean | null
          needs_sla?: boolean | null
          needs_sso?: boolean | null
          primary_use_case?: string | null
          selected_plan_id?: string | null
          selected_plan_kind?: string | null
          team_size?: string | null
          vat_id?: string | null
        }
        Relationships: []
      }
      onboarding_override_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          org_id: string
          reason: string | null
          step: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          org_id: string
          reason?: string | null
          step: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          org_id?: string
          reason?: string | null
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_override_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "onboarding_override_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          organization_id: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          organization_id: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "org_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_credit_refills: {
        Row: {
          created_at: string
          credits_added: number
          id: string
          organization_id: string
          refill_period: string
          subscription_id: string | null
        }
        Insert: {
          created_at?: string
          credits_added: number
          id?: string
          organization_id: string
          refill_period: string
          subscription_id?: string | null
        }
        Update: {
          created_at?: string
          credits_added?: number
          id?: string
          organization_id?: string
          refill_period?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_credit_refills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_credit_refills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_credit_refills_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "org_credit_refills_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_domains: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          organization_id: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          id?: string
          organization_id: string
          verification_token?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          id?: string
          organization_id?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_notification_prefs: {
        Row: {
          organization_id: string
          prefs: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          organization_id: string
          prefs?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          organization_id?: string
          prefs?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_notification_prefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_notification_prefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_plan_features: {
        Row: {
          api_access: boolean
          brand_kits_enabled: boolean
          created_at: string
          dedicated_lane: boolean
          included_credits_monthly: number
          max_concurrent_renders: number
          max_seats: number
          plan: string
          shared_assets_enabled: boolean
          sla_response_hours: number | null
          sso_enabled: boolean
        }
        Insert: {
          api_access?: boolean
          brand_kits_enabled?: boolean
          created_at?: string
          dedicated_lane?: boolean
          included_credits_monthly?: number
          max_concurrent_renders: number
          max_seats: number
          plan: string
          shared_assets_enabled?: boolean
          sla_response_hours?: number | null
          sso_enabled?: boolean
        }
        Update: {
          api_access?: boolean
          brand_kits_enabled?: boolean
          created_at?: string
          dedicated_lane?: boolean
          included_credits_monthly?: number
          max_concurrent_renders?: number
          max_seats?: number
          plan?: string
          shared_assets_enabled?: boolean
          sla_response_hours?: number | null
          sso_enabled?: boolean
        }
        Relationships: []
      }
      org_seats: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_seats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_seats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_shared_assets: {
        Row: {
          asset_type: string
          asset_url: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          organization_id: string
          shared_by: string
          source_id: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          asset_type: string
          asset_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          shared_by: string
          source_id?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: string
          asset_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          shared_by?: string
          source_id?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_shared_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_shared_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_spend_events: {
        Row: {
          credits: number
          id: string
          occurred_at: string
          organization_id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          credits: number
          id?: string
          occurred_at?: string
          organization_id: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          credits?: number
          id?: string
          occurred_at?: string
          organization_id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_spend_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_spend_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_templates: {
        Row: {
          category: string | null
          config: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_published: boolean
          name: string
          organization_id: string
          preview_url: string | null
          updated_at: string
          use_count: number
        }
        Insert: {
          category?: string | null
          config?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
          organization_id: string
          preview_url?: string | null
          updated_at?: string
          use_count?: number
        }
        Update: {
          category?: string | null
          config?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
          organization_id?: string
          preview_url?: string | null
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_brand_assets: {
        Row: {
          created_at: string
          id: string
          kind: string
          mime_type: string | null
          name: string
          organization_id: string
          public_url: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          mime_type?: string | null
          name: string
          organization_id: string
          public_url: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string
          organization_id?: string
          public_url?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_brand_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_brand_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          credit_period_start: string
          credits_used_this_month: number
          id: string
          invited_by: string | null
          joined_at: string
          monthly_credit_limit: number | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_period_start?: string
          credits_used_this_month?: number
          id?: string
          invited_by?: string | null
          joined_at?: string
          monthly_credit_limit?: number | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          credit_period_start?: string
          credits_used_this_month?: number
          id?: string
          invited_by?: string | null
          joined_at?: string
          monthly_credit_limit?: number | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          auto_recharge_amount: number | null
          auto_recharge_enabled: boolean
          auto_recharge_threshold: number | null
          billing_address: Json | null
          billing_email: string | null
          brand_accent_color: string | null
          brand_colors: string[] | null
          brand_primary_color: string | null
          brand_voice: string | null
          created_at: string
          created_by: string
          credits_balance: number
          deleted_at: string | null
          id: string
          industry: string | null
          logo_url: string | null
          monthly_volume: string | null
          name: string
          onboarded_at: string | null
          onboarding_completed: boolean
          onboarding_overrides: Json
          plan: string
          primary_use_case: string | null
          require_2fa: boolean
          slack_webhook_url: string | null
          slug: string
          spend_alert_daily: number | null
          spend_alert_weekly: number | null
          team_size: string | null
          total_credits_purchased: number
          total_credits_used: number
          updated_at: string
          vat_id: string | null
          website: string | null
          zapier_webhook_url: string | null
        }
        Insert: {
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean
          auto_recharge_threshold?: number | null
          billing_address?: Json | null
          billing_email?: string | null
          brand_accent_color?: string | null
          brand_colors?: string[] | null
          brand_primary_color?: string | null
          brand_voice?: string | null
          created_at?: string
          created_by: string
          credits_balance?: number
          deleted_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          monthly_volume?: string | null
          name: string
          onboarded_at?: string | null
          onboarding_completed?: boolean
          onboarding_overrides?: Json
          plan?: string
          primary_use_case?: string | null
          require_2fa?: boolean
          slack_webhook_url?: string | null
          slug: string
          spend_alert_daily?: number | null
          spend_alert_weekly?: number | null
          team_size?: string | null
          total_credits_purchased?: number
          total_credits_used?: number
          updated_at?: string
          vat_id?: string | null
          website?: string | null
          zapier_webhook_url?: string | null
        }
        Update: {
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean
          auto_recharge_threshold?: number | null
          billing_address?: Json | null
          billing_email?: string | null
          brand_accent_color?: string | null
          brand_colors?: string[] | null
          brand_primary_color?: string | null
          brand_voice?: string | null
          created_at?: string
          created_by?: string
          credits_balance?: number
          deleted_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          monthly_volume?: string | null
          name?: string
          onboarded_at?: string | null
          onboarding_completed?: boolean
          onboarding_overrides?: Json
          plan?: string
          primary_use_case?: string | null
          require_2fa?: boolean
          slack_webhook_url?: string | null
          slug?: string
          spend_alert_daily?: number | null
          spend_alert_weekly?: number | null
          team_size?: string | null
          total_credits_purchased?: number
          total_credits_used?: number
          updated_at?: string
          vat_id?: string | null
          website?: string | null
          zapier_webhook_url?: string | null
        }
        Relationships: []
      }
      photo_edit_templates: {
        Row: {
          category: string
          created_at: string
          credits_cost: number | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_premium: boolean | null
          name: string
          prompt_instruction: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          credits_cost?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          name: string
          prompt_instruction: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          credits_cost?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_premium?: boolean | null
          name?: string
          prompt_instruction?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      photo_edits: {
        Row: {
          batch_id: string | null
          batch_index: number | null
          created_at: string
          credits_charged: number | null
          custom_instruction: string | null
          edit_type: string
          edited_url: string | null
          error_message: string | null
          id: string
          manual_adjustments: Json | null
          original_url: string
          processing_time_ms: number | null
          status: string
          template_id: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          batch_index?: number | null
          created_at?: string
          credits_charged?: number | null
          custom_instruction?: string | null
          edit_type?: string
          edited_url?: string | null
          error_message?: string | null
          id?: string
          manual_adjustments?: Json | null
          original_url: string
          processing_time_ms?: number | null
          status?: string
          template_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          batch_index?: number | null
          created_at?: string
          credits_charged?: number | null
          custom_instruction?: string | null
          edit_type?: string
          edited_url?: string | null
          error_message?: string | null
          id?: string
          manual_adjustments?: Json | null
          original_url?: string
          processing_time_ms?: number | null
          status?: string
          template_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_edits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "photo_edit_templates"
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
            foreignKeyName: "production_credit_phases_api_cost_log_id_fkey"
            columns: ["api_cost_log_id"]
            isOneToOne: false
            referencedRelation: "api_cost_logs_safe"
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
            foreignKeyName: "production_credit_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_credit_phases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_credit_phases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_tier: string
          account_type: string
          auto_recharge_enabled: boolean | null
          avatar_url: string | null
          company: string | null
          country: string | null
          created_at: string
          credits_balance: number
          deactivated_at: string | null
          deactivation_reason: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          has_seen_welcome_offer: boolean | null
          has_seen_welcome_video: boolean | null
          id: string
          job_title: string | null
          notification_settings: Json | null
          onboarding_completed: boolean | null
          preferences: Json | null
          role: string | null
          security_version: number
          suspended_at: string | null
          suspension_reason: string | null
          total_credits_purchased: number
          total_credits_used: number
          updated_at: string
          use_case: string | null
        }
        Insert: {
          account_tier?: string
          account_type?: string
          auto_recharge_enabled?: boolean | null
          avatar_url?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          credits_balance?: number
          deactivated_at?: string | null
          deactivation_reason?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          has_seen_welcome_offer?: boolean | null
          has_seen_welcome_video?: boolean | null
          id: string
          job_title?: string | null
          notification_settings?: Json | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          role?: string | null
          security_version?: number
          suspended_at?: string | null
          suspension_reason?: string | null
          total_credits_purchased?: number
          total_credits_used?: number
          updated_at?: string
          use_case?: string | null
        }
        Update: {
          account_tier?: string
          account_type?: string
          auto_recharge_enabled?: boolean | null
          avatar_url?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          credits_balance?: number
          deactivated_at?: string | null
          deactivation_reason?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          has_seen_welcome_offer?: boolean | null
          has_seen_welcome_video?: boolean | null
          id?: string
          job_title?: string | null
          notification_settings?: Json | null
          onboarding_completed?: boolean | null
          preferences?: Json | null
          role?: string | null
          security_version?: number
          suspended_at?: string | null
          suspension_reason?: string | null
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
          {
            foreignKeyName: "project_characters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          likes_count: number
          project_id: string
          reply_to_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          project_id: string
          reply_to_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          project_id?: string
          reply_to_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "project_comments"
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
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_redemptions: {
        Row: {
          created_at: string
          id: string
          referral_code_id: string
          referred_credited: boolean
          referred_user_id: string
          referrer_credited: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code_id: string
          referred_credited?: boolean
          referred_user_id: string
          referrer_credited?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          referral_code_id?: string
          referred_credited?: boolean
          referred_user_id?: string
          referrer_credited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "referral_redemptions_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_redemptions_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_redemptions_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_inquiries: {
        Row: {
          company_name: string
          company_size: string | null
          created_at: string
          estimated_seats: number | null
          estimated_videos_per_month: string | null
          full_name: string
          id: string
          message: string | null
          source: string | null
          status: string
          tier_interest: string
          updated_at: string
          use_case: string | null
          user_id: string | null
          work_email: string
        }
        Insert: {
          company_name: string
          company_size?: string | null
          created_at?: string
          estimated_seats?: number | null
          estimated_videos_per_month?: string | null
          full_name: string
          id?: string
          message?: string | null
          source?: string | null
          status?: string
          tier_interest?: string
          updated_at?: string
          use_case?: string | null
          user_id?: string | null
          work_email: string
        }
        Update: {
          company_name?: string
          company_size?: string | null
          created_at?: string
          estimated_seats?: number | null
          estimated_videos_per_month?: string | null
          full_name?: string
          id?: string
          message?: string | null
          source?: string | null
          status?: string
          tier_interest?: string
          updated_at?: string
          use_case?: string | null
          user_id?: string | null
          work_email?: string
        }
        Relationships: []
      }
      scene_chain_queue: {
        Row: {
          created_at: string
          hold_id: string | null
          payload: Json
          project_id: string
          shot_index: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hold_id?: string | null
          payload: Json
          project_id: string
          shot_index: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hold_id?: string | null
          payload?: Json
          project_id?: string
          shot_index?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_chain_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_chain_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
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
      security_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          resolved: boolean | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          resolved?: boolean | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          resolved?: boolean | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      signup_analytics: {
        Row: {
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          id: string
          ip_address: string | null
          ip_hash: string | null
          referrer: string | null
          region: string | null
          timezone: string | null
          user_agent: string | null
          user_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          ip_hash?: string | null
          referrer?: string | null
          region?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          ip_hash?: string | null
          referrer?: string | null
          region?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      sso_domain_mappings: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_verified: boolean
          organization_id: string
          saml_provider_id: string | null
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_verified?: boolean
          organization_id: string
          saml_provider_id?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_verified?: boolean
          organization_id?: string
          saml_provider_id?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_domain_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "sso_domain_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
            isOneToOne: true
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stitch_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stitch_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stitch_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          metadata: Json
          organization_id: string | null
          price_id: string
          product_id: string | null
          seat_price_id: string | null
          seats: number
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          price_id: string
          product_id?: string | null
          seat_price_id?: string | null
          seats?: number
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          price_id?: string
          product_id?: string | null
          seat_price_id?: string | null
          seats?: number
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          admin_notes: string | null
          admin_reply: string | null
          admin_reply_by: string | null
          client_ip: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          replied_at: string | null
          source: string
          status: string
          subject: string
          submitted_count: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          admin_reply?: string | null
          admin_reply_by?: string | null
          client_ip?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          replied_at?: string | null
          source?: string
          status?: string
          subject: string
          submitted_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          admin_reply?: string | null
          admin_reply_by?: string | null
          client_ip?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          replied_at?: string | null
          source?: string
          status?: string
          subject?: string
          submitted_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
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
      training_videos: {
        Row: {
          aspect_ratio: string | null
          clip_count: number | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          environment: string | null
          id: string
          manifest_url: string | null
          project_id: string | null
          stitched_video_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_engine: string | null
          video_url: string
          voice_id: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          clip_count?: number | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          environment?: string | null
          id?: string
          manifest_url?: string | null
          project_id?: string | null
          stitched_video_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
          video_engine?: string | null
          video_url: string
          voice_id?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          clip_count?: number | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          environment?: string | null
          id?: string
          manifest_url?: string | null
          project_id?: string | null
          stitched_video_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_engine?: string | null
          video_url?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_videos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_videos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "universe_continuity_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
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
      universe_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          reply_to_id: string | null
          universe_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          universe_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          universe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "universe_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "universe_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universe_messages_universe_id_fkey"
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
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenge_progress: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_gamification: {
        Row: {
          characters_created: number
          characters_lent: number
          created_at: string
          current_streak: number
          hide_from_leaderboard: boolean
          id: string
          last_activity_date: string | null
          leaderboard_visible: boolean | null
          level: number
          longest_streak: number
          total_likes_received: number
          total_views: number
          tracking_opted_out: boolean
          universes_joined: number
          updated_at: string
          user_id: string
          videos_completed: number
          videos_created: number
          xp_total: number
        }
        Insert: {
          characters_created?: number
          characters_lent?: number
          created_at?: string
          current_streak?: number
          hide_from_leaderboard?: boolean
          id?: string
          last_activity_date?: string | null
          leaderboard_visible?: boolean | null
          level?: number
          longest_streak?: number
          total_likes_received?: number
          total_views?: number
          tracking_opted_out?: boolean
          universes_joined?: number
          updated_at?: string
          user_id: string
          videos_completed?: number
          videos_created?: number
          xp_total?: number
        }
        Update: {
          characters_created?: number
          characters_lent?: number
          created_at?: string
          current_streak?: number
          hide_from_leaderboard?: boolean
          id?: string
          last_activity_date?: string | null
          leaderboard_visible?: boolean | null
          level?: number
          longest_streak?: number
          total_likes_received?: number
          total_views?: number
          tracking_opted_out?: boolean
          universes_joined?: number
          updated_at?: string
          user_id?: string
          videos_completed?: number
          videos_created?: number
          xp_total?: number
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen_at: string
          status: string
          typing_in_conversation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          status?: string
          typing_in_conversation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          status?: string
          typing_in_conversation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_typing_in_conversation_fkey"
            columns: ["typing_in_conversation"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
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
          continuity_manifest: Json | null
          corrective_prompts: string[] | null
          created_at: string
          debug_attempts: number | null
          duration_seconds: number | null
          engine: string | null
          error_message: string | null
          final_fps: number | null
          final_resolution: string | null
          frame_extraction_attempts: number | null
          frame_extraction_status: string | null
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
          continuity_manifest?: Json | null
          corrective_prompts?: string[] | null
          created_at?: string
          debug_attempts?: number | null
          duration_seconds?: number | null
          engine?: string | null
          error_message?: string | null
          final_fps?: number | null
          final_resolution?: string | null
          frame_extraction_attempts?: number | null
          frame_extraction_status?: string | null
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
          continuity_manifest?: Json | null
          corrective_prompts?: string[] | null
          created_at?: string
          debug_attempts?: number | null
          duration_seconds?: number | null
          engine?: string | null
          error_message?: string | null
          final_fps?: number | null
          final_resolution?: string | null
          frame_extraction_attempts?: number | null
          frame_extraction_status?: string | null
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
            foreignKeyName: "video_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_clips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_clips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
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
          {
            foreignKeyName: "video_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      video_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_reactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_reactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_configs: {
        Row: {
          allowed_domains: string[] | null
          background_color: string | null
          created_at: string
          credits_charged: number | null
          cta_color: string | null
          cta_text: string | null
          cta_url: string | null
          font_family: string | null
          headline: string | null
          id: string
          last_view_credit_checkpoint: number | null
          logo_url: string | null
          name: string
          position: string | null
          primary_color: string | null
          public_key: string
          published_at: string | null
          rules: Json
          scenes: Json
          secondary_cta_text: string | null
          secondary_cta_url: string | null
          sensitivity: string | null
          slug: string | null
          source_project_id: string | null
          status: string
          subheadline: string | null
          tone: string | null
          total_cta_clicks: number | null
          total_scene_plays: number | null
          total_views: number | null
          triggers: Json
          updated_at: string
          user_id: string
          widget_height: number | null
          widget_type: string
          widget_width: number | null
          z_index: number | null
        }
        Insert: {
          allowed_domains?: string[] | null
          background_color?: string | null
          created_at?: string
          credits_charged?: number | null
          cta_color?: string | null
          cta_text?: string | null
          cta_url?: string | null
          font_family?: string | null
          headline?: string | null
          id?: string
          last_view_credit_checkpoint?: number | null
          logo_url?: string | null
          name: string
          position?: string | null
          primary_color?: string | null
          public_key?: string
          published_at?: string | null
          rules?: Json
          scenes?: Json
          secondary_cta_text?: string | null
          secondary_cta_url?: string | null
          sensitivity?: string | null
          slug?: string | null
          source_project_id?: string | null
          status?: string
          subheadline?: string | null
          tone?: string | null
          total_cta_clicks?: number | null
          total_scene_plays?: number | null
          total_views?: number | null
          triggers?: Json
          updated_at?: string
          user_id: string
          widget_height?: number | null
          widget_type?: string
          widget_width?: number | null
          z_index?: number | null
        }
        Update: {
          allowed_domains?: string[] | null
          background_color?: string | null
          created_at?: string
          credits_charged?: number | null
          cta_color?: string | null
          cta_text?: string | null
          cta_url?: string | null
          font_family?: string | null
          headline?: string | null
          id?: string
          last_view_credit_checkpoint?: number | null
          logo_url?: string | null
          name?: string
          position?: string | null
          primary_color?: string | null
          public_key?: string
          published_at?: string | null
          rules?: Json
          scenes?: Json
          secondary_cta_text?: string | null
          secondary_cta_url?: string | null
          sensitivity?: string | null
          slug?: string | null
          source_project_id?: string | null
          status?: string
          subheadline?: string | null
          tone?: string | null
          total_cta_clicks?: number | null
          total_scene_plays?: number | null
          total_views?: number | null
          triggers?: Json
          updated_at?: string
          user_id?: string
          widget_height?: number | null
          widget_type?: string
          widget_width?: number | null
          z_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_configs_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_configs_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_events: {
        Row: {
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          metadata: Json | null
          page_url: string | null
          referrer: string | null
          scene_id: string | null
          visitor_session: string | null
          widget_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          page_url?: string | null
          referrer?: string | null
          scene_id?: string | null
          visitor_session?: string | null
          widget_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          page_url?: string | null
          referrer?: string | null
          scene_id?: string | null
          visitor_session?: string | null
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_events_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widget_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          category: string
          created_at: string
          id: string
          metadata: Json | null
          organization_id: string
          target_id: string | null
          target_kind: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          category: string
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id: string
          target_id?: string | null
          target_kind?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          category?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          target_id?: string | null
          target_kind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "workspace_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      world_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "world_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_query_trends: {
        Row: {
          avg_credits: number | null
          day: string | null
          query_category: string | null
          query_count: number | null
        }
        Relationships: []
      }
      api_cost_logs_safe: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          id: string | null
          operation: string | null
          project_id: string | null
          service: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string | null
          operation?: string | null
          project_id?: string | null
          service?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string | null
          operation?: string | null
          project_id?: string | null
          service?: string | null
          status?: string | null
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
            foreignKeyName: "api_cost_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_cost_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_cost_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages_public: {
        Row: {
          credits: number | null
          id: string | null
          is_active: boolean | null
          is_popular: boolean | null
          name: string | null
          price_cents: number | null
        }
        Insert: {
          credits?: number | null
          id?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string | null
          price_cents?: number | null
        }
        Update: {
          credits?: number | null
          id?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string | null
          price_cents?: number | null
        }
        Relationships: []
      }
      credit_transactions_safe: {
        Row: {
          amount: number | null
          clip_duration_seconds: number | null
          created_at: string | null
          description: string | null
          id: string | null
          project_id: string | null
          transaction_type: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          clip_duration_seconds?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          project_id?: string | null
          transaction_type?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          clip_duration_seconds?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          project_id?: string | null
          transaction_type?: string | null
          user_id?: string | null
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
            foreignKeyName: "credit_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard: {
        Row: {
          avatar_url: string | null
          current_streak: number | null
          display_name: string | null
          level: number | null
          rank: number | null
          user_id: string | null
          xp_total: number | null
        }
        Relationships: []
      }
      movie_projects_public: {
        Row: {
          created_at: string | null
          genre: Database["public"]["Enums"]["movie_genre"] | null
          id: string | null
          is_public: boolean | null
          likes_count: number | null
          mood: string | null
          setting: string | null
          thumbnail_url: string | null
          title: string | null
          user_id: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          genre?: Database["public"]["Enums"]["movie_genre"] | null
          id?: string | null
          is_public?: boolean | null
          likes_count?: number | null
          mood?: string | null
          setting?: string | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          genre?: Database["public"]["Enums"]["movie_genre"] | null
          id?: string | null
          is_public?: boolean | null
          likes_count?: number | null
          mood?: string | null
          setting?: string | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      org_api_keys_safe: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string | null
          last_used_at: string | null
          name: string | null
          organization_id: string | null
          prefix: string | null
          revoked_at: string | null
          scopes: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          last_used_at?: string | null
          name?: string | null
          organization_id?: string | null
          prefix?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          last_used_at?: string | null
          name?: string | null
          organization_id?: string | null
          prefix?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "org_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_billing_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_billing_summary: {
        Row: {
          active_seats: number | null
          billed_seats: number | null
          cancel_pending: boolean | null
          environment: string | null
          max_seats: number | null
          monthly_credit_allowance: number | null
          organization_id: string | null
          organization_name: string | null
          plan: string | null
          renews_at: string | null
          subscription_id: string | null
          subscription_status: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      user_gamification_public: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          level: number | null
          user_id: string | null
          xp_total: number | null
        }
        Relationships: []
      }
      video_clips_public: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          id: string | null
          project_id: string | null
          shot_index: number | null
          status: string | null
          video_url: string | null
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
            foreignKeyName: "video_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "movie_projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_organization_invite: { Args: { p_token: string }; Returns: Json }
      acquire_generation_lock: {
        Args: { p_clip_index: number; p_lock_id?: string; p_project_id: string }
        Returns: Json
      }
      add_credits: {
        Args: {
          p_amount: number
          p_description: string
          p_stripe_payment_id: string
          p_user_id: string
        }
        Returns: Json
      }
      add_org_domain: {
        Args: { p_domain: string; p_org: string }
        Returns: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          organization_id: string
          verification_token: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "org_domains"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_user_xp: {
        Args: { p_reason?: string; p_user_id: string; p_xp_amount: number }
        Returns: {
          leveled_up: boolean
          new_level: number
          new_xp: number
        }[]
      }
      admin_activate_enterprise_org: {
        Args: {
          p_org_name: string
          p_owner_email: string
          p_provisioning_id: string
        }
        Returns: Json
      }
      admin_adjust_credits: {
        Args: { p_amount: number; p_reason: string; p_target_user_id: string }
        Returns: Json
      }
      admin_bump_security_versions_except: {
        Args: { p_except: string }
        Returns: Json
      }
      admin_change_account_type: {
        Args: { p_new_type: string; p_reason: string; p_target_user: string }
        Returns: Json
      }
      admin_create_impersonation_token: {
        Args: {
          p_reason: string
          p_target_user: string
          p_ttl_minutes?: number
        }
        Returns: Json
      }
      admin_delete_org: {
        Args: { p_org_id: string; p_reason: string }
        Returns: Json
      }
      admin_force_logout_all: { Args: never; Returns: Json }
      admin_force_logout_user: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      admin_force_tier: {
        Args: { p_new_tier: string; p_reason: string; p_target_user: string }
        Returns: Json
      }
      admin_get_aggregated_stats: { Args: never; Returns: Json }
      admin_get_audit_logs: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          action: string
          admin_id: string
          created_at: string
          details: Json
          id: string
          target_id: string
          target_type: string
        }[]
      }
      admin_get_email_log: {
        Args: { _email_filter?: string; _limit?: number }
        Returns: {
          created_at: string
          error_message: string
          id: string
          message_id: string
          metadata: Json
          recipient_email: string
          status: string
          template_name: string
        }[]
      }
      admin_list_projects: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_sort_by?: string
          p_sort_order?: string
          p_status?: string
        }
        Returns: {
          aspect_ratio: string
          clips_completed: number
          clips_failed: number
          clips_pending: number
          clips_total: number
          created_at: string
          genre: string
          hls_playlist_url: string
          id: string
          is_public: boolean
          last_error: string
          likes_count: number
          mode: string
          pending_video_tasks: Json
          pipeline_stage: string
          quality_tier: string
          status: string
          stitch_attempts: number
          target_duration_minutes: number
          thumbnail_url: string
          title: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
          video_url: string
        }[]
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
      admin_manage_credit_package: {
        Args: {
          p_action: string
          p_credits?: number
          p_is_active?: boolean
          p_is_popular?: boolean
          p_name?: string
          p_package_id?: string
          p_price_cents?: number
          p_stripe_price_id?: string
        }
        Returns: Json
      }
      admin_manage_role: {
        Args: {
          p_action: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_moderate_content: {
        Args: { p_action: string; p_project_id: string; p_reason?: string }
        Returns: Json
      }
      admin_suspend_account: {
        Args: { p_reason: string; p_target_user: string }
        Returns: Json
      }
      admin_transfer_org_owner: {
        Args: { p_new_owner: string; p_org_id: string; p_reason: string }
        Returns: Json
      }
      admin_unsuspend_account: {
        Args: { p_target_user: string }
        Returns: Json
      }
      admin_view_user_profile: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      assign_org_seat: {
        Args: {
          p_org_id: string
          p_role?: Database["public"]["Enums"]["org_role"]
          p_user_id: string
        }
        Returns: Json
      }
      atomic_claim_clip: {
        Args: {
          p_claim_token: string
          p_clip_index: number
          p_project_id: string
        }
        Returns: boolean
      }
      calculate_level: { Args: { xp: number }; Returns: number }
      charge_preproduction_credits:
        | { Args: { p_project_id: string; p_shot_id: string }; Returns: Json }
        | {
            Args: {
              p_credits_amount?: number
              p_project_id: string
              p_shot_id: string
            }
            Returns: Json
          }
      charge_production_credits:
        | { Args: { p_project_id: string; p_shot_id: string }; Returns: Json }
        | {
            Args: {
              p_credits_amount?: number
              p_project_id: string
              p_shot_id: string
            }
            Returns: Json
          }
      check_clip_continuity_ready: {
        Args: { p_clip_index: number; p_project_id: string }
        Returns: Json
      }
      check_login_rate_limit: { Args: { p_email: string }; Returns: boolean }
      check_refund_eligibility: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      check_support_rate_limit: { Args: { p_email: string }; Returns: boolean }
      check_widget_view_credits: {
        Args: { p_widget_id: string }
        Returns: boolean
      }
      cleanup_old_signup_analytics: { Args: never; Returns: Json }
      consume_credit_hold: {
        Args: {
          p_clip_duration?: number
          p_description?: string
          p_hold_id: string
        }
        Returns: Json
      }
      consume_onboarding_intent: {
        Args: { p_intent_token: string }
        Returns: Json
      }
      consume_org_credits: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_org_id: string
          p_reason?: string
        }
        Returns: Json
      }
      create_group_conversation: {
        Args: { p_member_ids: string[]; p_name: string }
        Returns: string
      }
      create_org_for_user: {
        Args: { p_name: string; p_plan?: string; p_user_id: string }
        Returns: string
      }
      deactivate_account: { Args: { p_reason?: string }; Returns: boolean }
      deduct_credits: {
        Args: {
          p_amount: number
          p_clip_duration?: number
          p_description: string
          p_idempotency_key?: string
          p_project_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_credit_anomaly: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_credit_holds: { Args: never; Returns: number }
      find_api_key_owner: {
        Args: { p_key_hash: string }
        Returns: {
          api_key_id: string
          owner_user_id: string
        }[]
      }
      find_org_by_email_domain: {
        Args: { p_email: string }
        Returns: {
          organization_id: string
          saml_provider_id: string
        }[]
      }
      fn_log_workspace_event: {
        Args: {
          _action: string
          _category: string
          _metadata?: Json
          _org_id: string
          _target_id?: string
          _target_kind?: string
        }
        Returns: string
      }
      fn_org_has_min_role: {
        Args: { _min: string; _org_id: string; _user_id: string }
        Returns: boolean
      }
      fn_org_member_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      fn_soft_delete_org: {
        Args: { _confirm_name: string; _org_id: string }
        Returns: undefined
      }
      fn_transfer_ownership: {
        Args: { _new_owner: string; _org_id: string }
        Returns: undefined
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
      get_cinema_entitlement: {
        Args: { _user_id?: string }
        Returns: {
          cancel_at_period_end: boolean
          fair_use_seconds: number
          has_entitlement: boolean
          is_active: boolean
          period_end: string
          period_start: string
          price_id: string
          remaining_seconds: number
          status: string
          subscription_id: string
          tier: string
          used_seconds: number
        }[]
      }
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
      get_or_assign_character_voice: {
        Args: {
          p_character_id?: string
          p_character_name: string
          p_preferred_voice?: string
          p_project_id: string
        }
        Returns: {
          is_new_assignment: boolean
          voice_id: string
          voice_provider: string
        }[]
      }
      get_or_create_dm_conversation: {
        Args: { p_other_user_id: string }
        Returns: string
      }
      get_org_seat_count: { Args: { p_org_id: string }; Returns: number }
      get_pipeline_context: { Args: { p_project_id: string }; Returns: Json }
      get_project_voice_map: {
        Args: { p_project_id: string }
        Returns: {
          character_name: string
          voice_id: string
          voice_provider: string
        }[]
      }
      get_universe_role: {
        Args: { p_universe_id: string; p_user_id: string }
        Returns: Database["public"]["Enums"]["universe_role"]
      }
      get_user_org_role: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_user_tier_limits: { Args: { p_user_id: string }; Returns: Json }
      has_account_type: {
        Args: { p_account_type: string; p_user_id: string }
        Returns: boolean
      }
      has_active_subscription: {
        Args: { p_env?: string; p_user_id: string }
        Returns: boolean
      }
      has_org_permission: {
        Args: {
          p_min_role: Database["public"]["Enums"]["org_role"]
          p_org_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_credits: {
        Args: { amount_param: number; user_id_param: string }
        Returns: undefined
      }
      increment_widget_analytics: {
        Args: { p_event_type: string; p_widget_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_blocked_business_email: { Args: { p_email: string }; Returns: boolean }
      is_conversation_member: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_email_banned: { Args: { p_email: string }; Returns: boolean }
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_universe_member: {
        Args: { p_universe_id: string; p_user_id: string }
        Returns: boolean
      }
      log_api_cost:
        | {
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
            }
            Returns: string
          }
        | {
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
      log_login_attempt: {
        Args: { p_email: string; p_ip?: string; p_success: boolean }
        Returns: undefined
      }
      mark_org_onboarded: { Args: { p_org: string }; Returns: undefined }
      monthly_org_credit_refill: { Args: never; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_admins: {
        Args: {
          _body: string
          _data: Json
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: undefined
      }
      persist_pipeline_context: {
        Args: { p_context: Json; p_project_id: string }
        Returns: boolean
      }
      provision_enterprise_org: {
        Args: { p_owner_user_id: string; p_provisioning_id: string }
        Returns: Json
      }
      reactivate_account: { Args: never; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_referral_code: { Args: { p_code: string }; Returns: Json }
      refund_credits: {
        Args: {
          p_amount: number
          p_description: string
          p_idempotency_key?: string
          p_project_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
      refund_production_credits:
        | {
            Args: { p_project_id: string; p_reason: string; p_shot_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_project_id: string
              p_reason: string
              p_shot_id: string
              p_user_id: string
            }
            Returns: Json
          }
      release_credit_hold: {
        Args: { p_hold_id: string; p_reason?: string }
        Returns: Json
      }
      release_generation_lock: {
        Args: { p_lock_id: string; p_project_id: string }
        Returns: boolean
      }
      reserve_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_idempotency_key?: string
          p_project_id?: string
          p_ttl_seconds?: number
          p_user_id: string
        }
        Returns: Json
      }
      resolve_sso_for_email: { Args: { p_email: string }; Returns: Json }
      revoke_org_seat: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: Json
      }
      set_member_credit_limit: {
        Args: { p_limit: number; p_org: string; p_user: string }
        Returns: undefined
      }
      set_org_auto_recharge: {
        Args: {
          p_amount: number
          p_enabled: boolean
          p_org: string
          p_threshold: number
        }
        Returns: undefined
      }
      set_org_integration_webhook: {
        Args: { p_kind: string; p_org: string; p_url: string }
        Returns: undefined
      }
      set_org_onboarding_override:
        | {
            Args: { p_done: boolean; p_org: string; p_step: string }
            Returns: Json
          }
        | {
            Args: {
              p_done: boolean
              p_org: string
              p_reason?: string
              p_step: string
            }
            Returns: Json
          }
      set_org_plan: {
        Args: { p_org_id: string; p_plan: string }
        Returns: Json
      }
      set_org_security_policy: {
        Args: { p_org: string; p_require_2fa: boolean }
        Returns: undefined
      }
      set_org_spend_alerts: {
        Args: { p_daily: number; p_org: string; p_weekly: number }
        Returns: undefined
      }
      topup_org_credits: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_org_id: string
          p_source?: string
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
      update_user_streak: { Args: { p_user_id: string }; Returns: number }
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
      validate_engine_id: { Args: { _engine: string }; Returns: boolean }
      validate_final_fps: { Args: { _fps: number }; Returns: boolean }
      validate_final_resolution: { Args: { _res: string }; Returns: boolean }
      validate_session_stamp: {
        Args: { p_client_version: number; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      credit_hold_status: "held" | "consumed" | "released" | "expired"
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
      notification_type:
        | "like"
        | "comment"
        | "follow"
        | "achievement"
        | "challenge_complete"
        | "message"
        | "universe_invite"
        | "character_borrow_request"
        | "level_up"
        | "streak_milestone"
        | "video_complete"
        | "mention"
        | "video_started"
        | "video_failed"
        | "low_credits"
        | "org_member_joined"
        | "org_welcome"
        | "org_role_changed"
        | "org_credits_low"
        | "admin_purchase"
        | "admin_support_message"
        | "admin_inquiry"
        | "admin_signup"
      org_role:
        | "owner"
        | "admin"
        | "producer"
        | "editor"
        | "reviewer"
        | "viewer"
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
      credit_hold_status: ["held", "consumed", "released", "expired"],
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
      notification_type: [
        "like",
        "comment",
        "follow",
        "achievement",
        "challenge_complete",
        "message",
        "universe_invite",
        "character_borrow_request",
        "level_up",
        "streak_milestone",
        "video_complete",
        "mention",
        "video_started",
        "video_failed",
        "low_credits",
        "org_member_joined",
        "org_welcome",
        "org_role_changed",
        "org_credits_low",
        "admin_purchase",
        "admin_support_message",
        "admin_inquiry",
        "admin_signup",
      ],
      org_role: ["owner", "admin", "producer", "editor", "reviewer", "viewer"],
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
