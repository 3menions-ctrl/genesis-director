// Scene Anchors System Types
// Extract and maintain environment DNA across scenes for Hollywood-level consistency

export interface LightingFingerprint {
  // Primary light characteristics
  keyLightDirection: string; // e.g., "top-left 45°", "backlit"
  keyLightIntensity: 'soft' | 'medium' | 'harsh';
  keyLightColor: string; // hex or descriptive
  
  // Fill and ambient
  fillRatio: number; // 0-1 (0 = high contrast, 1 = flat)
  ambientColor: string;
  
  // Shadow properties
  shadowHardness: 'soft' | 'medium' | 'hard';
  shadowDirection: string;
  
  // Time of day inference
  timeOfDay: 'golden-hour' | 'midday' | 'blue-hour' | 'night' | 'overcast' | 'indoor';
  
  // Consistency prompt fragment
  promptFragment: string;
}

export interface ColorPalette {
  // Dominant colors (top 5)
  dominant: {
    hex: string;
    percentage: number;
    name: string; // descriptive name
  }[];
  
  // Accent colors
  accents: string[];
  
  // Color temperature
  temperature: 'warm' | 'neutral' | 'cool';
  saturation: 'muted' | 'natural' | 'vibrant';
  
  // Color grade style
  gradeStyle: string; // e.g., "teal-orange blockbuster", "desaturated noir"
  
  // Consistency prompt fragment
  promptFragment: string;
}

export interface DepthCues {
  // Depth of field
  dofStyle: 'deep' | 'shallow' | 'rack-focus';
  focalPlane: 'foreground' | 'midground' | 'background';
  bokehQuality: string;
  
  // Atmospheric depth
  atmosphericPerspective: boolean;
  fogHaze: 'none' | 'light' | 'medium' | 'heavy';
  
  // Layering
  foregroundElements: string[];
  midgroundElements: string[];
  backgroundElements: string[];
  
  // Spatial relationships
  perspectiveType: 'one-point' | 'two-point' | 'three-point' | 'isometric';
  vanishingPointLocation: string;
  
  // Consistency prompt fragment
  promptFragment: string;
}

export interface KeyObjects {
  // Persistent objects across scenes
  objects: {
    id: string;
    name: string;
    description: string;
    position: 'left' | 'center' | 'right';
    depth: 'foreground' | 'midground' | 'background';
    importance: 'hero' | 'supporting' | 'environmental';
  }[];
  
  // Environment type
  environmentType: 'interior' | 'exterior' | 'mixed';
  settingDescription: string;
  
  // Architectural/environmental style
  architecturalStyle: string;
  
  // Consistency prompt fragment
  promptFragment: string;
}

export interface MotionSignature {
  // Camera motion DNA
  cameraMotionStyle: 'static' | 'subtle' | 'dynamic' | 'chaotic';
  preferredMovements: string[];
  
  // Subject motion
  subjectMotionIntensity: 'still' | 'subtle' | 'active' | 'intense';
  
  // Pacing
  pacingTempo: 'slow' | 'medium' | 'fast';
  cutRhythm: string;
  
  // Consistency prompt fragment
  promptFragment: string;
}

// Complete Scene Anchor extracted from a clip/frame
export interface SceneAnchor {
  id: string;
  shotId: string;
  frameUrl: string; // Source frame URL
  extractedAt: number;
  
  // Core DNA components
  lighting: LightingFingerprint;
  colorPalette: ColorPalette;
  depthCues: DepthCues;
  keyObjects: KeyObjects;
  motionSignature: MotionSignature;
  
  // Combined consistency prompt
  masterConsistencyPrompt: string;
  
  // Similarity scoring for gap detection
  visualHash?: string; // For fast comparison
  embeddingVector?: number[]; // For semantic similarity
}

// Scene Anchor comparison result
export interface SceneAnchorComparison {
  anchor1Id: string;
  anchor2Id: string;
  
  // Individual component scores (0-100)
  lightingMatch: number;
  colorMatch: number;
  depthMatch: number;
  objectMatch: number;
  motionMatch: number;
  
  // Overall compatibility
  overallScore: number;
  isCompatible: boolean; // > 70 = compatible
  
  // Gap analysis
  gaps: {
    component: 'lighting' | 'color' | 'depth' | 'objects' | 'motion';
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
    bridgePrompt: string; // Suggested prompt to bridge the gap
  }[];
  
  // Recommended transition
  recommendedTransition: 'cut' | 'dissolve' | 'fade' | 'ai-bridge';
  bridgeClipNeeded: boolean;
  bridgeClipPrompt?: string;
}

// Scene Anchor extraction request
export interface ExtractSceneAnchorRequest {
  frameUrl: string;
  shotId: string;
  projectId: string;
  extractMotion?: boolean; // Requires video URL for motion analysis
  videoUrl?: string;
}

// Scene Anchor extraction result
export interface ExtractSceneAnchorResult {
  success: boolean;
  anchor?: SceneAnchor;
  error?: string;
  processingTimeMs: number;
}

// Compare scene anchors request
export interface CompareSceneAnchorsRequest {
  anchor1: SceneAnchor;
  anchor2: SceneAnchor;
  strictness: 'lenient' | 'normal' | 'strict';
}

// Compare scene anchors result
export interface CompareSceneAnchorsResult {
  success: boolean;
  comparison?: SceneAnchorComparison;
  error?: string;
}

// Scene Anchors for entire project
export interface ProjectSceneAnchors {
  projectId: string;
  anchors: SceneAnchor[];
  comparisons: SceneAnchorComparison[];
  
  // Project-level consistency metrics
  overallConsistency: number;
  problemTransitions: number;
  bridgeClipsNeeded: number;
  
  // Master environment DNA (averaged/merged)
  masterEnvironmentDNA: {
    dominantLighting: LightingFingerprint;
    dominantPalette: ColorPalette;
    dominantDepth: DepthCues;
    persistentObjects: KeyObjects;
    overallMotionStyle: MotionSignature;
  };
  
  updatedAt: number;
}
