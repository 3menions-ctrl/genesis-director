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
      movie_projects: {
        Row: {
          aspect_ratio: string | null
          avatar_voice_id: string | null
          created_at: string
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
          mood: string | null
          movie_intro_style: string | null
          music_url: string | null
          parent_project_id: string | null
          pending_video_tasks: Json | null
          pipeline_context_snapshot: Json | null
          pipeline_stage: string | null
          pipeline_state: Json | null
          pro_features_data: Json | null
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
          video_url: string | null
          voice_audio_url: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          avatar_voice_id?: string | null
          created_at?: string
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
          mood?: string | null
          movie_intro_style?: string | null
          music_url?: string | null
          parent_project_id?: string | null
          pending_video_tasks?: Json | null
          pipeline_context_snapshot?: Json | null
          pipeline_stage?: string | null
          pipeline_state?: Json | null
          pro_features_data?: Json | null
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
          video_url?: string | null
          voice_audio_url?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          avatar_voice_id?: string | null
          created_at?: string
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
          mood?: string | null
          movie_intro_style?: string | null
          music_url?: string | null
          parent_project_id?: string | null
          pending_video_tasks?: Json | null
          pipeline_context_snapshot?: Json | null
          pipeline_stage?: string | null
          pipeline_state?: Json | null
          pro_features_data?: Json | null
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
          has_seen_welcome_video: boolean | null
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
          country?: string | null
          created_at?: string
          credits_balance?: number
          deactivated_at?: string | null
          deactivation_reason?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          has_seen_welcome_video?: boolean | null
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
          country?: string | null
          created_at?: string
          credits_balance?: number
          deactivated_at?: string | null
          deactivation_reason?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          has_seen_welcome_video?: boolean | null
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
      signup_analytics: {
        Row: {
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          id: string
          ip_address: string | null
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
      support_messages: {
        Row: {
          admin_notes: string | null
          client_ip: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          source: string
          status: string
          subject: string
          submitted_count: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          client_ip?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          source?: string
          status?: string
          subject: string
          submitted_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          client_ip?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          source?: string
          status?: string
          subject?: string
          submitted_count?: number | null
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
      training_videos: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          environment: string | null
          id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          environment?: string | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
          video_url: string
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          environment?: string | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string
          voice_id?: string | null
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
          id: string
          last_activity_date: string | null
          leaderboard_visible: boolean | null
          level: number
          longest_streak: number
          total_likes_received: number
          total_views: number
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
          id?: string
          last_activity_date?: string | null
          leaderboard_visible?: boolean | null
          level?: number
          longest_streak?: number
          total_likes_received?: number
          total_views?: number
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
          id?: string
          last_activity_date?: string | null
          leaderboard_visible?: boolean | null
          level?: number
          longest_streak?: number
          total_likes_received?: number
          total_views?: number
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
          error_message: string | null
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
          error_message?: string | null
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
          error_message?: string | null
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
          created_at: string | null
          credits: number | null
          id: string | null
          is_active: boolean | null
          is_popular: boolean | null
          name: string | null
          price_cents: number | null
        }
        Insert: {
          created_at?: string | null
          credits?: number | null
          id?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string | null
          price_cents?: number | null
        }
        Update: {
          created_at?: string | null
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
          followers_count: number | null
          level: number | null
          rank: number | null
          total_likes_received: number | null
          user_id: string | null
          videos_created: number | null
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
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
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
        Returns: boolean
      }
      add_user_xp: {
        Args: { p_reason?: string; p_user_id: string; p_xp_amount: number }
        Returns: {
          leveled_up: boolean
          new_level: number
          new_xp: number
        }[]
      }
      admin_adjust_credits: {
        Args: { p_amount: number; p_reason: string; p_target_user_id: string }
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
      admin_view_user_profile: {
        Args: { p_target_user_id: string }
        Returns: Json
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
        | {
            Args: { p_project_id: string; p_shot_id: string; p_user_id: string }
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
        | {
            Args: { p_project_id: string; p_shot_id: string; p_user_id: string }
            Returns: Json
          }
      check_clip_continuity_ready: {
        Args: { p_clip_index: number; p_project_id: string }
        Returns: Json
      }
      check_support_rate_limit: { Args: { p_email: string }; Returns: boolean }
      check_widget_view_credits: {
        Args: { p_widget_id: string }
        Returns: boolean
      }
      cleanup_old_signup_analytics: { Args: never; Returns: undefined }
      create_group_conversation: {
        Args: { p_member_ids: string[]; p_name: string }
        Returns: string
      }
      deactivate_account: { Args: { p_reason?: string }; Returns: boolean }
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
      get_user_tier_limits: { Args: { p_user_id: string }; Returns: Json }
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
      is_conversation_member: {
        Args: { p_conversation_id: string; p_user_id: string }
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
      persist_pipeline_context: {
        Args: { p_context: Json; p_project_id: string }
        Returns: boolean
      }
      reactivate_account: { Args: never; Returns: boolean }
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
      release_generation_lock: {
        Args: { p_lock_id: string; p_project_id: string }
        Returns: boolean
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
