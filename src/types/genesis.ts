export interface GenesisLocation {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  location_type: 'city' | 'district' | 'landmark' | 'venue' | 'street';
  parent_location_id: string | null;
  coordinates: Record<string, unknown> | null;
  climate: string | null;
  population: string | null;
  notable_features: string[] | null;
  created_by: string | null;
  is_official: boolean;
  created_at: string;
  updated_at: string;
  // New fields for environment presets
  environment_preset: Record<string, unknown> | null;
  prompt_modifiers: string[] | null;
  reference_image_urls: string[] | null;
  time_of_day_variants: Record<string, unknown> | null;
  weather_variants: Record<string, unknown> | null;
  is_requestable: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  // Joined data
  parent_location?: GenesisLocation;
  child_locations?: GenesisLocation[];
}

export interface GenesisEra {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  start_year: number | null;
  end_year: number | null;
  era_order: number;
  key_events: string[] | null;
  dominant_technology: string | null;
  cultural_notes: string | null;
  created_by: string | null;
  is_official: boolean;
  created_at: string;
  updated_at: string;
}

export interface GenesisVideo {
  id: string;
  project_id: string;
  user_id: string;
  location_id: string | null;
  era_id: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  canon_status: 'pending' | 'canon' | 'non_canon' | 'featured';
  upvotes: number;
  downvotes: number;
  vote_score: number;
  canon_at: string | null;
  featured_at: string | null;
  tags: string[] | null;
  characters_featured: string[] | null;
  created_at: string;
  updated_at: string;
  // Joined data
  location?: GenesisLocation;
  era?: GenesisEra;
  creator?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface GenesisVideoVote {
  id: string;
  video_id: string;
  user_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface GenesisLore {
  id: string;
  created_by: string;
  title: string;
  content: string;
  lore_type: 'story' | 'history' | 'legend' | 'science' | 'culture';
  location_id: string | null;
  era_id: string | null;
  is_canon: boolean;
  upvotes: number;
  created_at: string;
  updated_at: string;
  // Joined data
  location?: GenesisLocation;
  era?: GenesisEra;
  creator?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface GenesisEnvironmentTemplate {
  id: string;
  location_id: string | null;
  era_id: string | null;
  template_name: string;
  visual_style: Record<string, unknown>;
  lighting_preset: Record<string, unknown> | null;
  color_palette: Record<string, unknown> | null;
  atmosphere: string | null;
  prompt_prefix: string | null;
  prompt_suffix: string | null;
  negative_prompts: string[] | null;
  reference_images: string[] | null;
  thumbnail_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  location?: GenesisLocation;
  era?: GenesisEra;
}

export interface GenesisUniverseRule {
  id: string;
  category: 'visual' | 'narrative' | 'character' | 'timeline' | 'technical';
  title: string;
  description: string;
  priority: number;
  is_active: boolean;
  examples: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GenesisLocationRequest {
  id: string;
  requested_by: string;
  parent_location_id: string | null;
  name: string;
  description: string | null;
  location_type: 'city' | 'district' | 'landmark' | 'venue' | 'street';
  suggested_coordinates: Record<string, unknown> | null;
  reference_images: string[] | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  parent_location?: GenesisLocation;
}

// Story continuity types
export interface GenesisStoryArc {
  id: string;
  title: string;
  description: string | null;
  arc_type: 'main' | 'side' | 'character' | 'event';
  status: 'planned' | 'active' | 'completed' | 'abandoned';
  era_id: string | null;
  location_id: string | null;
  start_date_in_universe: string | null;
  end_date_in_universe: string | null;
  current_chapter: number;
  total_chapters: number | null;
  synopsis: string | null;
  themes: string[] | null;
  created_by: string | null;
  is_canon: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  era?: GenesisEra;
  location?: GenesisLocation;
  connections?: GenesisStoryConnection[];
}

export interface GenesisStoryConnection {
  id: string;
  arc_id: string;
  video_id: string;
  connection_type: 'starts' | 'continues' | 'ends' | 'branches' | 'contributes' | 'references';
  chapter_number: number | null;
  sequence_order: number | null;
  narrative_notes: string | null;
  approved_by: string | null;
  is_official: boolean;
  created_at: string;
  // Joined data
  video?: GenesisVideo;
  arc?: GenesisStoryArc;
}

export interface GenesisCharacterAppearance {
  id: string;
  video_id: string;
  character_name: string;
  character_id: string | null;
  role_type: 'protagonist' | 'antagonist' | 'supporting' | 'featured' | 'cameo' | 'mentioned';
  first_appearance_video: boolean;
  description: string | null;
  outfit_description: string | null;
  emotional_state: string | null;
  location_in_scene: string | null;
  created_at: string;
  // Joined data
  video?: GenesisVideo;
}

export interface GenesisCharacterInteraction {
  id: string;
  video_id: string;
  character_1_name: string;
  character_1_id: string | null;
  character_2_name: string;
  character_2_id: string | null;
  interaction_type: 'dialogue' | 'conflict' | 'collaboration' | 'romance' | 'rivalry' | 'mentorship' | 'chance_encounter' | 'reunion';
  interaction_outcome: 'positive' | 'negative' | 'neutral' | 'unresolved' | 'transformative' | null;
  description: string | null;
  is_first_meeting: boolean;
  changes_relationship: boolean;
  new_relationship_status: string | null;
  created_at: string;
  // Joined data
  video?: GenesisVideo;
}

export interface GenesisContinuityAnchor {
  id: string;
  anchor_type: 'event' | 'death' | 'birth' | 'location_change' | 'world_change' | 'character_trait' | 'object' | 'relationship';
  title: string;
  description: string;
  date_in_universe: string | null;
  era_id: string | null;
  location_id: string | null;
  affected_characters: string[] | null;
  is_immutable: boolean;
  source_video_id: string | null;
  established_by: string | null;
  votes_for: number;
  votes_against: number;
  is_canon: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  era?: GenesisEra;
  location?: GenesisLocation;
  source_video?: GenesisVideo;
}
