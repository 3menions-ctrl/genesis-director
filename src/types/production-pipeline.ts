// Iron-clad Production Pipeline Types
// Unified state container for shot-by-shot video generation
// Now with Image-First Reference Architecture & Cinematic Auditor Agent
// Tiered Quality: Standard (25 credits) vs Iron-Clad Professional (40 credits)
// NEW: Identity Bible 3-Point System & Recursive Frame-Chaining

export type ProjectType = 'cinematic-trailer' | 'social-ad' | 'narrative-short' | 'documentary' | 'explainer';

// Quality Tier System
export type QualityTier = 'standard' | 'professional';

// ============================================
// IDENTITY BIBLE 3-POINT SYSTEM
// ============================================

// 3-point character reference for visual consistency
export interface IdentityBible {
  // Original reference image uploaded by user
  originalImageUrl: string;
  
  // Generated 3-point character views
  frontViewUrl: string;
  sideViewUrl: string;
  threeQuarterViewUrl: string;
  
  // AI-extracted character description for prompt injection
  characterDescription: string;
  
  // Key visual anchors for consistency
  consistencyAnchors: string[];
  
  // Generation metadata
  generatedAt: number;
  isComplete: boolean;
}

// ============================================
// IMAGE-FIRST REFERENCE ARCHITECTURE TYPES
// ============================================

// Visual features extracted from the mandatory reference image
export interface ReferenceImageAnalysis {
  imageUrl: string;
  analysisComplete: boolean;
  
  // IMAGE ORIENTATION - Critical for Veo API aspect ratio
  imageOrientation: {
    width: number;
    height: number;
    aspectRatio: number; // width/height
    orientation: 'landscape' | 'portrait' | 'square';
    veoAspectRatio: '16:9' | '9:16' | '1:1'; // Mapped for Veo API
  };
  
  // Identity anchoring
  characterIdentity: {
    description: string;
    facialFeatures: string;
    clothing: string;
    bodyType: string;
    distinctiveMarkers: string[];
  };
  
  // Environmental analysis
  environment: {
    setting: string;
    geometry: string; // spatial relationships, depth, perspective
    keyObjects: string[];
    backgroundElements: string[];
  };
  
  // Lighting & color extraction
  lighting: {
    style: string; // e.g., "dramatic chiaroscuro", "soft ambient"
    direction: string; // e.g., "top-left key light"
    quality: string; // e.g., "hard shadows", "diffused"
    timeOfDay: string;
  };
  
  // Color palette
  colorPalette: {
    dominant: string[];
    accent: string[];
    mood: string; // e.g., "warm cinematic", "cold dramatic"
  };
  
  // Raw prompt for consistency injection
  consistencyPrompt: string;
}

// ============================================
// CINEMATIC AUDITOR AGENT TYPES
// ============================================

export type AuditSeverity = 'critical' | 'warning' | 'suggestion';

export interface CinematicSuggestion {
  shotId: string;
  severity: AuditSeverity;
  category: 'technique' | 'physics' | 'continuity' | 'identity';
  originalText: string;
  suggestion: string;
  filmTechnique?: string; // e.g., "Kuleshov effect", "match cut"
  physicsViolation?: string; // e.g., "gravity violation", "anatomical impossibility"
  rewrittenPrompt?: string; // Optimized prompt for Replicate
}

export interface CinematicAuditResult {
  auditComplete: boolean;
  overallScore: number; // 0-100 production readiness score
  totalSuggestions: number;
  criticalIssues: number;
  
  // Categorized suggestions
  suggestions: CinematicSuggestion[];
  
  // Film technique analysis
  techniqueAnalysis: {
    identifiedTechniques: string[];
    recommendedTechniques: string[];
    narrativeFlow: string;
  };
  
  // Physics plausibility check
  physicsCheck: {
    gravityViolations: string[];
    anatomicalIssues: string[];
    fluidDynamicsIssues: string[];
    morphingRisks: string[];
  };
  
  // Identity consistency check
  identityCheck: {
    characterConsistency: boolean;
    environmentConsistency: boolean;
    lightingConsistency: boolean;
    suggestions: string[];
  };
  
  // Approved/optimized shots ready for production
  optimizedShots: OptimizedShot[];
}

export interface OptimizedShot {
  shotId: string;
  originalDescription: string;
  optimizedDescription: string;
  identityAnchors: string[]; // Injected identity markers from reference image
  physicsGuards: string[]; // Negative prompts to prevent physics violations
  approved: boolean;
}

export type WorkflowStage = 'scripting' | 'production' | 'review';

export type ShotStatus = 'pending' | 'generating' | 'completed' | 'failed';

export type AudioMixMode = 'full' | 'dialogue-only' | 'music-only' | 'mute';

// Transition types for seamless shot connections
export type TransitionType = 'continuous' | 'match-cut' | 'dissolve' | 'fade';

// Avatar-quality: Configurable clip duration (6-8 seconds)
export const MAX_SHOT_DURATION_SECONDS = 8;
export const MIN_SHOT_DURATION_SECONDS = 4;
export const DEFAULT_SHOT_DURATION_SECONDS = 6; // 6 seconds for cinematic flow

// Maximum clips per project (extended for longer productions)
export const MAX_CLIPS_PER_PROJECT = 24;
export const MIN_CLIPS_PER_PROJECT = 2;

// Professional tier: Max auto-retries before user sees failure
export const MAX_PROFESSIONAL_RETRIES = 4;

// Shot represents a single unit in the script with associated metadata
export interface Shot {
  id: string; // Unique Shot ID (e.g., "shot_001")
  index: number;
  title: string;
  description: string; // Visual description for video generation
  dialogue: string; // Dialogue/narration text for this shot
  durationSeconds: number; // 6 seconds per shot (standard)
  mood: string;
  cameraMovement: string; // Will be rewritten by Cameraman Filter
  transitionOut?: TransitionType; // How this shot flows into the next
  characters: string[];
  // Smart Camera Properties (from Smart Script Generator)
  cameraScale?: 'extreme-wide' | 'wide' | 'medium' | 'close-up' | 'extreme-close-up';
  cameraAngle?: 'eye-level' | 'low-angle' | 'high-angle' | 'dutch-angle' | 'overhead' | 'pov';
  movementType?: 'static' | 'pan' | 'tilt' | 'dolly' | 'tracking' | 'crane' | 'handheld';
  transitionHint?: string; // Hint for how this shot flows into the next
  // Generated assets
  videoUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  // Generation metadata
  status: ShotStatus;
  seed?: number;
  startFrameUrl?: string; // For frame chaining
  endFrameUrl?: string;   // Extracted last frame for next shot
  taskId?: string; // Replicate/MiniMax task ID
  error?: string;
  // Professional tier: Visual Debugger tracking
  retryCount?: number;
  visualDebugResults?: VisualDebugResultSummary[];
  lastCorrectivePrompt?: string;
}

// Visual Debug Result Summary (stored per shot)
export interface VisualDebugResultSummary {
  passed: boolean;
  score: number;
  issues: string[];
  correctivePrompt?: string;
  timestamp: number;
}

// Master scene consistency anchor
export interface MasterAnchor {
  imageUrl: string;
  seed: number;
  environmentPrompt: string;
  colorPalette: string;
  lightingStyle: string;
}

// Voice generation state
export interface VoiceTrack {
  shotId: string;
  audioUrl: string;
  durationMs: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

// Production workflow state
export interface ProductionState {
  // Master consistency controls
  masterAnchor?: MasterAnchor;
  globalSeed: number;
  
  // Shot generation progress
  shots: Shot[];
  currentShotIndex: number;
  completedShots: number;
  failedShots: number;
  
  // Voice tracks
  voiceTracks: VoiceTrack[];
  
  // Frame chaining state
  lastExtractedFrame?: string;
  chainContext: {
    previousFrameUrl?: string;
    sceneSeed: number;
    environmentContext: string;
  };
  
  // Generation flags
  isGeneratingVideo: boolean;
  isGeneratingAudio: boolean;
  generationStartedAt?: number;
  estimatedCompletionTime?: number;
}

// The main pipeline context state
export interface PipelineState {
  // Workflow stage
  currentStage: WorkflowStage;
  
  // Project configuration
  projectId: string;
  projectType: ProjectType;
  projectTitle: string;
  
  // QUALITY TIER: Standard (25 credits) vs Professional (40 credits)
  qualityTier: QualityTier;
  
  // IMAGE-FIRST: Reference image analysis
  referenceImage?: ReferenceImageAnalysis;
  referenceImageRequired: boolean;
  
  // IDENTITY BIBLE: 3-point character reference system
  identityBible?: IdentityBible;
  identityBibleGenerating: boolean;
  
  // TEXT-TO-VIDEO: Allow pure text-based generation without reference image
  textToVideoMode: boolean;
  
  // Script approval state
  rawScript: string;
  structuredShots: Shot[];
  scriptApproved: boolean;
  
  // CINEMATIC AUDITOR: Audit results
  cinematicAudit?: CinematicAuditResult;
  auditApproved: boolean;
  
  // Production state
  production: ProductionState;
  
  // Quality Insurance tracking (Professional tier)
  qualityInsuranceLedger: QualityInsuranceCost[];
  
  // Final output
  finalVideoUrl?: string;
  finalAudioUrl?: string;
  exportReady: boolean;
  
  // Audio review mode
  audioMixMode: AudioMixMode;
}

// Quality Insurance cost entry for ledger
export interface QualityInsuranceCost {
  shotId: string;
  operation: 'audit' | 'visual_debug' | 'retry_generation';
  creditsCharged: number;
  realCostCents: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Initial empty pipeline state
export const INITIAL_PIPELINE_STATE: PipelineState = {
  currentStage: 'scripting',
  projectId: '',
  projectType: 'cinematic-trailer',
  projectTitle: '',
  qualityTier: 'standard', // Default to standard tier
  referenceImageRequired: true, // IMAGE-FIRST: Required by default
  identityBibleGenerating: false, // IDENTITY BIBLE: Not generating by default
  textToVideoMode: false, // TEXT-TO-VIDEO: Disabled by default
  rawScript: '',
  structuredShots: [],
  scriptApproved: false,
  auditApproved: false, // CINEMATIC AUDITOR: Must be approved
  qualityInsuranceLedger: [], // Professional tier cost tracking
  production: {
    globalSeed: Math.floor(Math.random() * 2147483647),
    shots: [],
    currentShotIndex: 0,
    completedShots: 0,
    failedShots: 0,
    voiceTracks: [],
    chainContext: {
      sceneSeed: 0,
      environmentContext: '',
    },
    isGeneratingVideo: false,
    isGeneratingAudio: false,
  },
  exportReady: false,
  audioMixMode: 'full',
};

// Project type configurations
export const PROJECT_TYPES: { id: ProjectType; name: string; description: string; shotCount: number }[] = [
  { 
    id: 'cinematic-trailer', 
    name: 'Cinematic Trailer', 
    description: 'High-impact movie trailer with dramatic pacing',
    shotCount: 8,
  },
  { 
    id: 'social-ad', 
    name: 'Social Media Ad', 
    description: 'Short-form content optimized for social platforms',
    shotCount: 4,
  },
  { 
    id: 'narrative-short', 
    name: 'Narrative Short', 
    description: 'Story-driven content with character development',
    shotCount: 12,
  },
  { 
    id: 'documentary', 
    name: 'Documentary', 
    description: 'Authentic documentary-style content',
    shotCount: 10,
  },
  { 
    id: 'explainer', 
    name: 'Explainer Video', 
    description: 'Educational content with clear messaging',
    shotCount: 6,
  },
];

// Cameraman Hallucination Filter - prompts to inject
export const CAMERAMAN_NEGATIVE_PROMPTS = [
  'camera',
  'cameraman',
  'camera operator',
  'film crew',
  'camera equipment',
  'tripod',
  'dolly track',
  'boom mic',
  'lighting rig',
  'film set',
  'behind the scenes',
  'production crew',
  'director',
  'clapper board',
  'camera lens visible',
  'crew reflection',
  'equipment shadow',
  'microphone in frame',
  'cables visible',
  'studio lights',
  'green screen edge',
  'film equipment',
  'camera rig',
  'gimbal',
  'steadicam operator',
];

// Camera movement rewrites
export const CAMERA_MOVEMENT_REWRITES: Record<string, string> = {
  'dolly shot': 'smooth forward movement through the scene',
  'tracking shot': 'following movement alongside subjects',
  'crane shot': 'elevated perspective descending or rising',
  'pan': 'horizontal rotation revealing the scene',
  'tilt': 'vertical rotation showing height',
  'zoom': 'focal length shift bringing subjects closer',
  'push in': 'gradual forward approach toward subject',
  'pull back': 'retreating movement revealing wider scene',
  'handheld': 'subtle organic motion with natural feel',
  'steadicam': 'fluid movement through space',
  'aerial': 'overhead perspective looking down',
  'pov': 'first-person perspective through character eyes',
  'dutch angle': 'tilted horizon creating tension',
  'establishing shot': 'wide view setting the scene location',
  'close-up': 'intimate framing focusing on details',
  'medium shot': 'standard framing showing subject in context',
  'wide shot': 'expansive framing showing environment',
};
