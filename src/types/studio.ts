export type ProjectStatus = 'idle' | 'generating' | 'rendering' | 'completed';

export interface Studio {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
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

export interface StudioSettings {
  lighting: 'natural' | 'studio' | 'dramatic' | 'soft';
  lightingIntensity: number;
  wildlifeDensity: number;
  bookshelfItems: string[];
  environment: string;
  resolution: '1080p' | '4K';
}

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
