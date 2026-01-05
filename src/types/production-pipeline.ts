// Iron-clad Production Pipeline Types
// Unified state container for shot-by-shot video generation
// Now with Image-First Reference Architecture & Cinematic Auditor Agent

export type ProjectType = 'cinematic-trailer' | 'social-ad' | 'narrative-short' | 'documentary' | 'explainer';

// ============================================
// IMAGE-FIRST REFERENCE ARCHITECTURE TYPES
// ============================================

// Visual features extracted from the mandatory reference image
export interface ReferenceImageAnalysis {
  imageUrl: string;
  analysisComplete: boolean;
  
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

// Shot represents a single unit in the script with associated metadata
export interface Shot {
  id: string; // Unique Shot ID (e.g., "shot_001")
  index: number;
  title: string;
  description: string; // Visual description for video generation
  dialogue: string; // Dialogue/narration text for this shot
  durationSeconds: number;
  mood: string;
  cameraMovement: string; // Will be rewritten by Cameraman Filter
  characters: string[];
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
  
  // IMAGE-FIRST: Reference image analysis
  referenceImage?: ReferenceImageAnalysis;
  referenceImageRequired: boolean;
  
  // Script approval state
  rawScript: string;
  structuredShots: Shot[];
  scriptApproved: boolean;
  
  // CINEMATIC AUDITOR: Audit results
  cinematicAudit?: CinematicAuditResult;
  auditApproved: boolean;
  
  // Production state
  production: ProductionState;
  
  // Final output
  finalVideoUrl?: string;
  finalAudioUrl?: string;
  exportReady: boolean;
  
  // Audio review mode
  audioMixMode: AudioMixMode;
}

// Initial empty pipeline state
export const INITIAL_PIPELINE_STATE: PipelineState = {
  currentStage: 'scripting',
  projectId: '',
  projectType: 'cinematic-trailer',
  projectTitle: '',
  referenceImageRequired: true, // IMAGE-FIRST: Required by default
  rawScript: '',
  structuredShots: [],
  scriptApproved: false,
  auditApproved: false, // CINEMATIC AUDITOR: Must be approved
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
