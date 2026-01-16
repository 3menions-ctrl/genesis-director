export interface GenesisLocation {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  location_type: 'realm' | 'region' | 'city' | 'landmark';
  parent_location_id: string | null;
  coordinates: Record<string, unknown> | null;
  climate: string | null;
  population: string | null;
  notable_features: string[] | null;
  created_by: string | null;
  is_official: boolean;
  created_at: string;
  updated_at: string;
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
