// Types for the Genesis Collaborative Movie System

export interface GenesisScreenplay {
  id: string;
  title: string;
  description: string | null;
  total_duration_minutes: number;
  total_scenes: number;
  total_characters: number;
  status: 'draft' | 'casting' | 'filming' | 'post_production' | 'completed';
  synopsis: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenesisScene {
  id: string;
  screenplay_id: string;
  scene_number: number;
  act_number: number;
  title: string;
  description: string | null;
  location_id: string | null;
  era_id: string | null;
  time_of_day: string;
  weather: string;
  duration_seconds: number;
  visual_prompt: string | null;
  camera_directions: string | null;
  mood: string | null;
  is_key_scene: boolean;
  status: 'pending' | 'casting' | 'ready' | 'filming' | 'submitted' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  // Joined data
  location?: { name: string } | null;
  era?: { name: string } | null;
  characters?: GenesisSceneCharacter[];
}

export interface GenesisPresetCharacter {
  id: string;
  screenplay_id: string;
  name: string;
  role_type: 'protagonist' | 'antagonist' | 'supporting' | 'extra' | 'narrator';
  description: string | null;
  personality: string | null;
  appearance_description: string | null;
  backstory: string | null;
  age_range: string | null;
  gender: string | null;
  wardrobe_notes: string | null;
  voice_notes: string | null;
  total_scenes: number;
  is_cast: boolean;
  cast_by: string | null;
  cast_at: string | null;
  reference_image_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  casting?: GenesisCharacterCasting | null;
}

export interface GenesisSceneCharacter {
  id: string;
  scene_id: string;
  character_id: string;
  dialogue: string | null;
  action_description: string | null;
  emotional_state: string | null;
  position_in_scene: string | null;
  entrance_type: string | null;
  exit_type: string | null;
  interaction_with: string[] | null;
  is_speaking: boolean;
  screen_time_seconds: number;
  created_at: string;
  // Joined data
  character?: GenesisPresetCharacter;
}

export interface GenesisCharacterCasting {
  id: string;
  character_id: string | null;
  user_id: string | null;
  face_image_url: string;
  additional_images: string[] | null;
  status: 'pending' | 'approved' | 'rejected' | 'replaced';
  admin_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  image_consent_given: boolean;
  consent_given_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user?: { display_name: string; avatar_url: string } | null;
}

export interface GenesisSceneClip {
  id: string;
  scene_id: string;
  submitted_by: string;
  project_id: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  quality_score: number | null;
  consistency_score: number | null;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'selected';
  admin_feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  is_selected_for_final: boolean;
  created_at: string;
  updated_at: string;
}

export interface GenesisFinalAssembly {
  id: string;
  screenplay_id: string;
  title: string;
  status: 'pending' | 'assembling' | 'review' | 'published';
  total_clips: number;
  total_duration_seconds: number;
  final_video_url: string | null;
  assembly_order: string[] | null;
  assembly_notes: string | null;
  assembled_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollaborativeMovieStats {
  totalCharacters: number;
  castCharacters: number;
  totalScenes: number;
  readyScenes: number;
  submittedClips: number;
  approvedClips: number;
  castingProgress: number;
  filmingProgress: number;
}
