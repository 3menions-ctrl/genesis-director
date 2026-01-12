/**
 * CONTINUITY ORCHESTRATOR TYPES
 * 
 * Types for the unified pipeline enhancement system that implements:
 * 1. Frame Handoff - last frame → next clip start
 * 2. Motion Vector Chaining - ending motion → entry motion
 * 3. Consistency Auto-Retry - regenerate low-score clips
 * 4. Bridge Clip Generation - insert transitions for gaps
 */

// ============= Motion & Color Types =============

export interface MotionVectors {
  subjectVelocity?: { x: number; y: number; magnitude: number };
  cameraMovement?: { type: string; direction: string; speed: number };
  motionBlur?: number;
  dominantDirection?: string;
  // Entry/exit motion for chaining
  entryMotion?: string;
  exitMotion?: string;
  continuityPrompt?: string;
}

export interface ColorProfile {
  dominantColors: string[];
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
}

// ============= Clip Data =============

export interface ClipContinuityData {
  index: number;
  videoUrl: string;
  lastFrameUrl?: string;
  motionVectors?: MotionVectors;
  colorProfile?: ColorProfile;
  consistencyScore?: number;
  prompt: string;
}

// ============= Orchestration Request/Response =============

export type ContinuityMode = 'analyze' | 'enhance-clip' | 'post-process' | 'full';

export interface ContinuityConfig {
  consistencyThreshold: number; // 0-100, default 70
  enableBridgeClips: boolean;   // default true
  enableMotionChaining: boolean; // default true
  enableAutoRetry: boolean;      // default true
  maxBridgeClips: number;        // default 3
  maxAutoRetries: number;        // default 2
}

export interface PreviousClipData {
  videoUrl: string;
  lastFrameUrl?: string;
  motionVectors?: MotionVectors;
  colorProfile?: ColorProfile;
}

export interface ContinuityOrchestrationRequest {
  projectId: string;
  userId: string;
  mode: ContinuityMode;
  
  // For 'enhance-clip' mode
  clipIndex?: number;
  previousClipData?: PreviousClipData;
  currentClipPrompt?: string;
  
  // For 'post-process' mode
  allClips?: ClipContinuityData[];
  
  // Configuration
  config?: Partial<ContinuityConfig>;
}

// ============= Enhanced Prompt =============

export interface PromptInjections {
  frameHandoff?: string;
  motionContinuity?: string;
  colorContinuity?: string;
  spatialLock?: string;
}

export interface EnhancedPrompt {
  originalPrompt: string;
  enhancedPrompt: string;
  injections: PromptInjections;
}

// ============= Transition Analysis =============

export interface TransitionAnalysis {
  fromIndex: number;
  toIndex: number;
  overallScore: number;
  motionScore: number;
  colorScore: number;
  semanticScore: number;
  needsBridge: boolean;
  bridgePrompt?: string;
  bridgeDuration?: number;
}

// ============= Orchestration Result =============

export interface MotionInjection {
  entryMotion: string;
  entryCameraHint: string;
}

export interface ContinuityOrchestrationResult {
  success: boolean;
  mode: ContinuityMode | 'error';
  
  // For 'enhance-clip' mode
  enhancedPrompt?: EnhancedPrompt;
  recommendedStartImage?: string;
  motionInjection?: MotionInjection;
  
  // For 'post-process' mode
  transitionAnalyses?: TransitionAnalysis[];
  bridgeClipsNeeded?: number;
  clipsToRetry?: number[];
  overallContinuityScore?: number;
  
  // For 'full' mode
  continuityPlan?: ContinuityPlan;
  
  processingTimeMs: number;
  error?: string;
}

// ============= Full Continuity Plan =============

export interface BridgeClipSpec {
  prompt: string;
  durationSeconds: number;
  insertAfterIndex: number;
}

export interface TransitionPlan {
  fromIndex: number;
  toIndex: number;
  analysis: TransitionAnalysis;
  bridgeClip?: BridgeClipSpec;
  motionInjection?: {
    toClipEntryMotion: string;
    entryCameraHint: string;
  };
}

export interface EnvironmentLock {
  lighting: string;
  colorPalette: string;
  timeOfDay: string;
  weather: string;
}

export interface SceneGroup {
  sceneId: string;
  clipIndices: number[];
  environment: EnvironmentLock;
}

export interface ContinuityPlan {
  projectId: string;
  originalClipCount: number;
  bridgeClipsNeeded: number;
  totalClipCount: number;
  overallContinuityScore: number;
  transitions: TransitionPlan[];
  environmentLock: EnvironmentLock;
  sceneGroups: SceneGroup[];
}

// ============= Helper Functions =============

export const DEFAULT_CONTINUITY_CONFIG: ContinuityConfig = {
  consistencyThreshold: 70,
  enableBridgeClips: true,
  enableMotionChaining: true,
  enableAutoRetry: true,
  maxBridgeClips: 3,
  maxAutoRetries: 2,
};

export function getScoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-red-400';
}

export function getScoreBgColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500/20';
  if (score >= 70) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

export function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}
