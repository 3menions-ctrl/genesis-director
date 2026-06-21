/**
 * Pro Features Types - Type definitions for professional video production features
 */

export interface MotionVectors {
  subjectVelocity?: { x: number; y: number; magnitude: number };
  cameraMovement?: { type: string; direction: string; speed: number };
  motionBlur?: number;
  dominantDirection?: string;
}

export interface TransitionAnalysis {
  fromIndex: number;
  toIndex: number;
  overallScore: number;
  motionScore: number;
  colorScore: number;
  semanticScore: number;
  needsBridge: boolean;
  bridgePrompt?: string;
}

export interface ContinuityAnalysis {
  score?: number;
  transitions?: TransitionAnalysis[];
  clipsToRetry?: number[];
  bridgeClipsNeeded?: number;
}

export interface MasterSceneAnchor {
  sceneType?: string;
  colorPalette?: string[];
  lightingProfile?: string;
  styleReference?: string;
  referenceImageUrl?: string;
}

export interface CharacterIdentity {
  id: string;
  name: string;
  description?: string;
  appearance?: string;
  voiceId?: string;
  referenceUrls?: string[];
}

export interface IdentityBible {
  characters?: CharacterIdentity[];
  styleGuide?: Record<string, string>;
  colorScheme?: Record<string, string>;
}

export interface ProFeaturesState {
  masterSceneAnchor?: MasterSceneAnchor;
  characters?: CharacterIdentity[];
  identityBible?: IdentityBible;
  consistencyScore?: number;
  qualityTier?: string;
  continuityAnalysis?: ContinuityAnalysis;
}

export interface PipelineState {
  stage: string;
  progress: number;
  lastUpdate: string;
  errors?: string[];
  metadata?: Record<string, unknown>;
}

export interface DegradationFlag {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}
