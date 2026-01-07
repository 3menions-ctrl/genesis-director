// Intelligent Stitcher Types
// Hollywood-grade video assembly with gap detection and AI filler generation

import { SceneAnchor, SceneAnchorComparison } from './scene-anchors';

export type TransitionType = 'cut' | 'dissolve' | 'fade' | 'ai-bridge';

export interface ClipMetadata {
  id: string;
  shotId: string;
  videoUrl: string;
  durationMs: number;
  firstFrameUrl: string;
  lastFrameUrl: string;
  sceneAnchor?: SceneAnchor;
}

export interface TransitionAnalysis {
  fromClipId: string;
  toClipId: string;
  comparison: SceneAnchorComparison;
  recommendedTransition: TransitionType;
  transitionDurationMs: number;
  bridgeClipNeeded: boolean;
  bridgeClipPrompt?: string;
  bridgeClipGenerated?: boolean;
  bridgeClipUrl?: string;
}

export interface StitchPlan {
  projectId: string;
  clips: ClipMetadata[];
  transitions: TransitionAnalysis[];
  
  // Overall analysis
  totalDurationMs: number;
  bridgeClipsNeeded: number;
  estimatedFinalDurationMs: number;
  
  // Quality metrics
  overallConsistency: number;
  problemTransitions: number;
  
  // Execution state
  status: 'analyzing' | 'generating-bridges' | 'stitching' | 'complete' | 'failed';
  currentStep: string;
  progress: number; // 0-100
  
  createdAt: number;
  updatedAt: number;
}

export interface StitchRequest {
  projectId: string;
  clips: {
    shotId: string;
    videoUrl: string;
    firstFrameUrl?: string;
    lastFrameUrl?: string;
  }[];
  voiceAudioUrl?: string;
  musicAudioUrl?: string;
  
  // Options
  autoGenerateBridges: boolean;
  strictnessLevel: 'lenient' | 'normal' | 'strict';
  maxBridgeClips: number;
  targetFormat: '1080p' | '4k';
  
  // Quality tier
  qualityTier: 'standard' | 'professional';
}

export interface StitchResult {
  success: boolean;
  projectId: string;
  
  // Analysis results
  plan?: StitchPlan;
  
  // Final output
  finalVideoUrl?: string;
  finalDurationMs?: number;
  
  // Bridge clips generated
  bridgeClipsGenerated: number;
  
  // Execution details
  totalProcessingTimeMs: number;
  steps: {
    step: string;
    status: 'pending' | 'running' | 'complete' | 'failed';
    durationMs?: number;
    error?: string;
  }[];
  
  error?: string;
}

// Bridge Clip Generation Request
export interface BridgeClipRequest {
  projectId: string;
  fromClipLastFrame: string;
  toClipFirstFrame: string;
  bridgePrompt: string;
  durationSeconds: number;
  sceneContext: {
    lighting: string;
    colorPalette: string;
    environment: string;
  };
}

export interface BridgeClipResult {
  success: boolean;
  videoUrl?: string;
  durationMs?: number;
  error?: string;
}

// FFmpeg Stitch Command
export interface FFmpegStitchCommand {
  clips: {
    url: string;
    startMs?: number;
    endMs?: number;
    transition?: {
      type: 'dissolve' | 'fade';
      durationMs: number;
    };
  }[];
  audioTracks?: {
    type: 'voice' | 'music' | 'sfx';
    url: string;
    volumeDb: number;
    startMs?: number;
  }[];
  output: {
    format: 'mp4';
    codec: 'h264' | 'h265';
    resolution: '1920x1080' | '3840x2160';
    bitrate: string;
    fps: 24 | 30 | 60;
  };
}
