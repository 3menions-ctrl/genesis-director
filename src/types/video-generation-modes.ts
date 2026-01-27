// Video generation mode types for specialized pipelines

export type VideoGenerationMode = 
  | 'text-to-video' 
  | 'avatar' 
  | 'motion-transfer' 
  | 'video-to-video'
  | 'b-roll';

export interface PipelineState {
  stage: 'init' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

export interface SpecializedModeConfig {
  // Avatar mode
  avatarVoiceId?: string;
  avatarScript?: string;
  avatarReferenceImage?: string;
  
  // Motion transfer mode
  sourceVideoUrl?: string;
  targetPose?: string;
  preserveFace?: boolean;
  
  // Video-to-video (style transfer)
  stylePreset?: string;
  styleStrength?: number;
  referenceStyleUrl?: string;
  
  // Common
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  duration?: number;
  quality?: 'draft' | 'standard' | 'premium';
}

export interface ModeRouterRequest {
  projectId: string;
  userId: string;
  mode: VideoGenerationMode;
  prompt?: string;
  config?: SpecializedModeConfig;
}

export interface ModeRouterResponse {
  success: boolean;
  projectId: string;
  mode: VideoGenerationMode;
  pipelineState: PipelineState;
  videoUrl?: string;
  error?: string;
}

// Mode display config for UI
export const VIDEO_MODE_CONFIG: Record<VideoGenerationMode, {
  name: string;
  description: string;
  icon: string;
  requiresScript: boolean;
  requiresSourceVideo: boolean;
  requiresSourceImage: boolean;
  estimatedTime: string;
}> = {
  'text-to-video': {
    name: 'Cinematic Film',
    description: 'Full multi-clip movie with script generation',
    icon: 'Film',
    requiresScript: true,
    requiresSourceVideo: false,
    requiresSourceImage: false,
    estimatedTime: '5-15 min',
  },
  'avatar': {
    name: 'AI Avatar',
    description: 'Speaking avatar with lip-sync',
    icon: 'User',
    requiresScript: true,
    requiresSourceVideo: false,
    requiresSourceImage: true,
    estimatedTime: '1-3 min',
  },
  'motion-transfer': {
    name: 'Motion Transfer',
    description: 'Apply motion from one video to another',
    icon: 'Move',
    requiresScript: false,
    requiresSourceVideo: true,
    requiresSourceImage: true,
    estimatedTime: '2-5 min',
  },
  'video-to-video': {
    name: 'Style Transfer',
    description: 'Transform video with AI style',
    icon: 'Palette',
    requiresScript: false,
    requiresSourceVideo: true,
    requiresSourceImage: false,
    estimatedTime: '3-8 min',
  },
  'b-roll': {
    name: 'B-Roll Clips',
    description: 'Quick ambient footage clips',
    icon: 'Clapperboard',
    requiresScript: false,
    requiresSourceVideo: false,
    requiresSourceImage: false,
    estimatedTime: '30s-2 min',
  },
};
