export type ProjectStatus = 'idle' | 'generating' | 'rendering' | 'completed' | 'stitching' | 'stitching_failed';

export interface Studio {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

// Pending task structure stored in database
export interface PendingVideoTask {
  taskId: string;
  clipIndex: number;
  prompt: string;
  startedAt: number;
  [key: string]: string | number; // Index signature for Json compatibility
}

export interface Project {
  id: string;
  studio_id: string;
  name: string;
  status: ProjectStatus;
  script_content?: string;
  environment_prompt?: string;
  voice_id?: string;
  character_id?: string;
  created_at: string;
  updated_at: string;
  duration_seconds?: number;
  credits_used?: number;
  voice_audio_url?: string;
  video_url?: string;
  video_clips?: string[];
  include_narration?: boolean;
  target_duration_minutes?: number;
  thumbnail_url?: string;
  pending_video_tasks?: PendingVideoTask[];
  is_public?: boolean;
  genre?: string;
}

export interface AssetLayer {
  id: string;
  project_id: string;
  layer_type: 'background_video' | 'character_video' | 'audio_narration' | 'overlay_metadata';
  asset_url?: string;
  status: ProjectStatus;
  metadata?: Record<string, unknown>;
  z_index: number;
  created_at: string;
}

export type VisualStylePreset = 'cinematic' | 'documentary' | 'anime' | 'vintage';

export interface CharacterProfile {
  id: string;
  name: string;
  appearance: string;
  clothing: string;
  distinguishingFeatures: string;
  age?: string;
  gender?: string;
  referenceImageUrl?: string;
}

export interface SceneBreakdown {
  sceneNumber: number;
  title: string;
  durationSeconds: number;
  visualDescription: string;
  scriptText: string;
  characters: string[];
  mood: string;
}

export interface SceneImage {
  sceneNumber: number;
  imageUrl: string;
  prompt: string;
  approved?: boolean;
  regenerating?: boolean;
}

export interface StudioSettings {
  lighting: 'natural' | 'studio' | 'dramatic' | 'soft';
  lightingIntensity: number;
  wildlifeDensity: number;
  bookshelfItems: string[];
  environment: string;
  resolution: '1080p' | '4K';
  visualStyle: VisualStylePreset;
  characters: CharacterProfile[];
  scenes: SceneBreakdown[];
  sceneImages: SceneImage[]; // Reference images for each scene
  turboMode?: boolean; // Faster generation with shorter clips
  useImageToVideo?: boolean; // Use reference images for video generation
  // Cinematic Orchestration Settings
  useFrameChaining?: boolean; // Extract last frame for next clip start
  useMasterImage?: boolean; // Generate anchor image for visual consistency
  usePersistentSeed?: boolean; // Same seed across all clips in scene
  rewriteCameraPrompts?: boolean; // Strip camera refs, use perspective language
}

export const VISUAL_STYLE_PRESETS = [
  { 
    id: 'cinematic' as VisualStylePreset, 
    name: 'Cinematic', 
    description: 'Hollywood blockbuster look',
    prompt: 'cinematic film look, anamorphic lens flares, shallow depth of field, dramatic lighting, 2.39:1 aspect ratio feel, shot on ARRI Alexa, professional color grading, filmic texture' 
  },
  { 
    id: 'documentary' as VisualStylePreset, 
    name: 'Documentary', 
    description: 'Raw, authentic feel',
    prompt: 'documentary style, naturalistic lighting, handheld camera feel, authentic raw footage, 16mm film texture, observational cinematography, realistic color grading, journalistic approach' 
  },
  { 
    id: 'anime' as VisualStylePreset, 
    name: 'Anime', 
    description: 'Japanese animation style',
    prompt: 'anime art style, cel-shaded animation, vibrant saturated colors, dramatic speed lines, expressive lighting, Studio Ghibli inspired, clean line art, stylized backgrounds' 
  },
  { 
    id: 'vintage' as VisualStylePreset, 
    name: 'Vintage', 
    description: 'Classic retro aesthetic',
    prompt: 'vintage film aesthetic, warm color temperature, film grain, light leaks, faded colors, 1970s Super 8 look, nostalgic atmosphere, soft vignetting, analog imperfections' 
  },
] as const;

export interface UserCredits {
  total: number;
  used: number;
  remaining: number;
}

export const VOICE_OPTIONS = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm & Professional' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Deep & Authoritative' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Young & Energetic' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'Friendly & Expressive' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Soft & Soothing' },
] as const;

export const CHARACTER_OPTIONS = [
  { id: 'avatar_001', name: 'Alex', thumbnail: '/placeholder.svg' },
  { id: 'avatar_002', name: 'Jordan', thumbnail: '/placeholder.svg' },
  { id: 'avatar_003', name: 'Morgan', thumbnail: '/placeholder.svg' },
  { id: 'avatar_004', name: 'Taylor', thumbnail: '/placeholder.svg' },
] as const;

export const ENVIRONMENT_PRESETS = [
  { id: 'jungle_studio', name: 'Jungle House Studio', prompt: 'Luxurious indoor studio with floor-to-ceiling windows overlooking a lush jungle, warm sunlight filtering through tropical foliage, modern furniture with natural wood accents' },
  { id: 'modern_office', name: 'Modern Office', prompt: 'Sleek minimalist office space with panoramic city views, ambient LED lighting, glass and steel furniture, professional corporate atmosphere' },
  { id: 'cozy_library', name: 'Cozy Library', prompt: 'Warm intimate library with floor-to-ceiling bookshelves, leather armchairs, soft lamp lighting, crackling fireplace, rich mahogany wood paneling' },
  { id: 'beach_villa', name: 'Beach Villa', prompt: 'Open-air luxury beach villa with white curtains flowing in ocean breeze, turquoise water visible through large windows, tropical plants, sunset lighting' },
  { id: 'space_station', name: 'Space Station', prompt: 'Futuristic space station interior with Earth visible through viewport windows, holographic displays, sleek metallic surfaces, ambient blue lighting' },
] as const;
