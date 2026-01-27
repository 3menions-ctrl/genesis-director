// Video generation mode types for the platform

export type VideoGenerationMode = 
  | 'text-to-video'      // Cinematic text prompts
  | 'image-to-video'     // Animate a static image
  | 'video-to-video'     // Style transfer on existing video
  | 'avatar'             // Talking head with lip sync
  | 'motion-transfer'    // Apply dance/motion to character
  | 'b-roll';            // Quick background footage

export interface VideoModeConfig {
  id: VideoGenerationMode;
  name: string;
  description: string;
  icon: string;
  requiresVideo?: boolean;
  requiresImage?: boolean;
  requiresText?: boolean;
  requiresAudio?: boolean;
  popular?: boolean;
}

export const VIDEO_MODES: VideoModeConfig[] = [
  {
    id: 'text-to-video',
    name: 'Text to Video',
    description: 'Create cinematic clips from text prompts',
    icon: 'Wand2',
    requiresText: true,
    popular: true,
  },
  {
    id: 'image-to-video',
    name: 'Image to Video',
    description: 'Animate any static image or photo',
    icon: 'Image',
    requiresImage: true,
    requiresText: true,
    popular: true,
  },
  {
    id: 'avatar',
    name: 'AI Avatar',
    description: 'Create talking head videos with lip sync',
    icon: 'User',
    requiresImage: true,
    requiresText: true,
    popular: true,
  },
  {
    id: 'video-to-video',
    name: 'Style Transfer',
    description: 'Transform video into anime, 3D, cyberpunk, etc.',
    icon: 'Palette',
    requiresVideo: true,
  },
  {
    id: 'motion-transfer',
    name: 'Motion Transfer',
    description: 'Apply dance moves to any character',
    icon: 'Dices',
    requiresVideo: true,
    requiresImage: true,
  },
  {
    id: 'b-roll',
    name: 'B-Roll Generator',
    description: 'Quick background footage from prompts',
    icon: 'Film',
    requiresText: true,
  },
];

// Style presets for video-to-video
export type VideoStylePreset = 
  | 'anime'
  | '3d-animation'
  | 'cyberpunk'
  | 'oil-painting'
  | 'watercolor'
  | 'claymation'
  | 'noir'
  | 'vintage-film'
  | 'comic-book'
  | 'fantasy';

export interface StylePresetConfig {
  id: VideoStylePreset;
  name: string;
  description: string;
  thumbnail?: string;
}

export const STYLE_PRESETS: StylePresetConfig[] = [
  { id: 'anime', name: 'Anime', description: 'Studio Ghibli-style animation' },
  { id: '3d-animation', name: '3D Animation', description: 'Pixar-style 3D rendering' },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Neon-lit futuristic aesthetic' },
  { id: 'oil-painting', name: 'Oil Painting', description: 'Classical impressionist style' },
  { id: 'watercolor', name: 'Watercolor', description: 'Soft flowing artistic style' },
  { id: 'claymation', name: 'Claymation', description: 'Stop-motion clay aesthetic' },
  { id: 'noir', name: 'Film Noir', description: 'Black and white dramatic shadows' },
  { id: 'vintage-film', name: 'Vintage Film', description: 'Retro 8mm film grain' },
  { id: 'comic-book', name: 'Comic Book', description: 'Bold outlines and halftones' },
  { id: 'fantasy', name: 'Fantasy Art', description: 'Magical ethereal atmosphere' },
];

// Voice options for avatar generation
export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  style: string;
  preview?: string;
}

export const AVATAR_VOICES: VoiceOption[] = [
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', style: 'Professional narrator' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', style: 'Warm and friendly' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', style: 'Authoritative presenter' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female', style: 'Youthful and energetic' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female', style: 'Soft and calm' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male', style: 'Deep and resonant' },
];
