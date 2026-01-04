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
      characters: {
        Row: {
          appearance: string | null
          backstory: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          personality: string | null
          universe_id: string | null
          user_id: string | null
          voice_id: string | null
        }
        Insert: {
          appearance?: string | null
          backstory?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          personality?: string | null
          universe_id?: string | null
          user_id?: string | null
          voice_id?: string | null
        }
        Update: {
          appearance?: string | null
          backstory?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          personality?: string | null
          universe_id?: string | null
          user_id?: string | null
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
      movie_projects: {
        Row: {
          created_at: string
          generated_script: string | null
          genre: Database["public"]["Enums"]["movie_genre"]
          id: string
          is_template: boolean | null
          mood: string | null
          movie_intro_style: string | null
          parent_project_id: string | null
          script_content: string | null
          setting: string | null
          status: string
          story_structure: Database["public"]["Enums"]["story_structure"]
          synopsis: string | null
          target_duration_minutes: number
          thumbnail_url: string | null
          time_period: string | null
          title: string
          universe_id: string | null
          updated_at: string
          user_id: string | null
          video_clips: string[] | null
          video_url: string | null
          voice_audio_url: string | null
        }
        Insert: {
          created_at?: string
          generated_script?: string | null
          genre?: Database["public"]["Enums"]["movie_genre"]
          id?: string
          is_template?: boolean | null
          mood?: string | null
          movie_intro_style?: string | null
          parent_project_id?: string | null
          script_content?: string | null
          setting?: string | null
          status?: string
          story_structure?: Database["public"]["Enums"]["story_structure"]
          synopsis?: string | null
          target_duration_minutes?: number
          thumbnail_url?: string | null
          time_period?: string | null
          title: string
          universe_id?: string | null
          updated_at?: string
          user_id?: string | null
          video_clips?: string[] | null
          video_url?: string | null
          voice_audio_url?: string | null
        }
        Update: {
          created_at?: string
          generated_script?: string | null
          genre?: Database["public"]["Enums"]["movie_genre"]
          id?: string
          is_template?: boolean | null
          mood?: string | null
          movie_intro_style?: string | null
          parent_project_id?: string | null
          script_content?: string | null
          setting?: string | null
          status?: string
          story_structure?: Database["public"]["Enums"]["story_structure"]
          synopsis?: string | null
          target_duration_minutes?: number
          thumbnail_url?: string | null
          time_period?: string | null
          title?: string
          universe_id?: string | null
          updated_at?: string
          user_id?: string | null
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
      script_templates: {
        Row: {
          created_at: string
          description: string | null
          genre: Database["public"]["Enums"]["movie_genre"] | null
          id: string
          name: string
          sample_script: string | null
          story_structure: Database["public"]["Enums"]["story_structure"] | null
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: []
      }
      universes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          rules: string | null
          setting: string | null
          time_period: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rules?: string | null
          setting?: string | null
          time_period?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rules?: string | null
          setting?: string | null
          time_period?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      movie_genre:
        | "action"
        | "drama"
        | "comedy"
        | "thriller"
        | "scifi"
        | "fantasy"
        | "romance"
        | "horror"
        | "documentary"
        | "adventure"
      story_structure:
        | "three_act"
        | "hero_journey"
        | "circular"
        | "in_medias_res"
        | "episodic"
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
      movie_genre: [
        "action",
        "drama",
        "comedy",
        "thriller",
        "scifi",
        "fantasy",
        "romance",
        "horror",
        "documentary",
        "adventure",
      ],
      story_structure: [
        "three_act",
        "hero_journey",
        "circular",
        "in_medias_res",
        "episodic",
      ],
    },
  },
} as const
