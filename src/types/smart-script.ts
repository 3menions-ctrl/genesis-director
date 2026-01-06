// Smart Scripting System Types
// Duration-aware script generation with intelligent transitions

// Duration modes (6 seconds to 4 minutes)
export type DurationMode = 'micro' | 'short' | 'medium' | 'long' | 'extended';

export interface DurationConfig {
  mode: DurationMode;
  targetSeconds: number;
  minShots: number;
  maxShots: number;
  avgShotDuration: number;
  pacing: 'fast' | 'moderate' | 'slow';
}

// Duration presets
export const DURATION_PRESETS: Record<DurationMode, DurationConfig> = {
  micro: {
    mode: 'micro',
    targetSeconds: 6,
    minShots: 1,
    maxShots: 2,
    avgShotDuration: 4,
    pacing: 'fast',
  },
  short: {
    mode: 'short',
    targetSeconds: 30,
    minShots: 5,
    maxShots: 8,
    avgShotDuration: 4,
    pacing: 'fast',
  },
  medium: {
    mode: 'medium',
    targetSeconds: 60,
    minShots: 10,
    maxShots: 15,
    avgShotDuration: 5,
    pacing: 'moderate',
  },
  long: {
    mode: 'long',
    targetSeconds: 120,
    minShots: 20,
    maxShots: 30,
    avgShotDuration: 5,
    pacing: 'moderate',
  },
  extended: {
    mode: 'extended',
    targetSeconds: 240,
    minShots: 40,
    maxShots: 60,
    avgShotDuration: 5,
    pacing: 'slow',
  },
};

// Transition types for smooth scene connections
export type SmartTransitionType = 
  | 'angle-change'      // Same subject, different camera angle
  | 'motion-carry'      // Movement continues across cut
  | 'match-cut'         // Visual similarity bridges scenes
  | 'scene-jump'        // Clean cut to new location
  | 'whip-pan'          // Fast camera movement to new scene
  | 'reveal'            // Camera reveals new element
  | 'follow-through'    // Action carries viewer to next scene
  | 'parallel-action';  // Cut between simultaneous events

export interface TransitionPlan {
  type: SmartTransitionType;
  description: string;
  fromShotHint: string;  // How to end the outgoing shot
  toShotHint: string;    // How to start the incoming shot
}

// Scene diversity categories
export type SceneType = 
  | 'establishing'      // Wide shot setting location
  | 'action'            // Character/subject movement
  | 'reaction'          // Response to previous action
  | 'detail'            // Close-up on specific element
  | 'transition'        // Movement between locations
  | 'climax'            // High-intensity moment
  | 'resolution';       // Calming/concluding moment

export interface SceneDiversityPlan {
  sceneType: SceneType;
  cameraScale: 'extreme-wide' | 'wide' | 'medium' | 'close-up' | 'extreme-close-up';
  cameraAngle: 'eye-level' | 'low-angle' | 'high-angle' | 'dutch-angle' | 'overhead' | 'pov';
  movementType: 'static' | 'pan' | 'tilt' | 'dolly' | 'tracking' | 'crane' | 'handheld';
}

// Smart shot with transition and diversity metadata
export interface SmartShot {
  id: string;
  index: number;
  title: string;
  description: string;
  durationSeconds: number;
  
  // Scene diversity
  sceneType: SceneType;
  cameraScale: string;
  cameraAngle: string;
  movementType: string;
  
  // Transition to next shot
  transitionOut?: TransitionPlan;
  
  // Visual continuity hints
  visualAnchors: string[];      // Key visual elements to maintain
  motionDirection?: string;      // Direction of movement for continuity
  lightingHint: string;          // Lighting consistency
  
  // Dialogue/narration
  dialogue: string;
  mood: string;
}

// Smart script generation request
export interface SmartScriptRequest {
  // Content
  topic: string;
  synopsis?: string;
  style?: string;
  genre?: string;
  
  // Duration control
  targetDurationSeconds: number;
  durationMode?: DurationMode;
  
  // Transition preferences
  preferredTransitions?: SmartTransitionType[];
  avoidTransitions?: SmartTransitionType[];
  
  // Diversity settings
  sceneVariety: 'low' | 'medium' | 'high';
  pacingStyle: 'fast' | 'moderate' | 'slow' | 'dynamic';
  
  // Character/subject consistency
  mainSubjects?: string[];
  environmentHints?: string[];
}

// Smart script generation response
export interface SmartScriptResponse {
  success: boolean;
  
  // Generated script
  shots: SmartShot[];
  totalDurationSeconds: number;
  shotCount: number;
  
  // Metadata
  durationMode: DurationMode;
  transitionPlan: {
    types: SmartTransitionType[];
    diversity: number; // 0-1 score
  };
  sceneDiversity: {
    uniqueSceneTypes: number;
    cameraVariety: number; // 0-1 score
    pacingScore: number;   // 0-1 score
  };
  
  // Debug
  model: string;
  generationTimeMs?: number;
}

// Transition library with hints
export const TRANSITION_LIBRARY: Record<SmartTransitionType, TransitionPlan> = {
  'angle-change': {
    type: 'angle-change',
    description: 'Cut to different angle of same subject',
    fromShotHint: 'Hold on subject with clear visual anchor',
    toShotHint: 'Same subject from new angle, matching lighting',
  },
  'motion-carry': {
    type: 'motion-carry',
    description: 'Movement continues across the cut',
    fromShotHint: 'End with motion in a specific direction',
    toShotHint: 'Begin with motion continuing in same direction',
  },
  'match-cut': {
    type: 'match-cut',
    description: 'Visual similarity bridges different scenes',
    fromShotHint: 'End on distinctive shape, color, or composition',
    toShotHint: 'Begin with similar shape, color, or composition in new scene',
  },
  'scene-jump': {
    type: 'scene-jump',
    description: 'Clean cut to new location',
    fromShotHint: 'End with clear resolution or pause',
    toShotHint: 'Begin with establishing context for new location',
  },
  'whip-pan': {
    type: 'whip-pan',
    description: 'Fast camera movement creates blur transition',
    fromShotHint: 'End with fast horizontal camera sweep',
    toShotHint: 'Begin emerging from fast horizontal movement',
  },
  'reveal': {
    type: 'reveal',
    description: 'Camera movement reveals new element',
    fromShotHint: 'Camera moves to frame edge or obstruction',
    toShotHint: 'Camera reveals what was hidden or offscreen',
  },
  'follow-through': {
    type: 'follow-through',
    description: 'Action leads viewer to next scene',
    fromShotHint: 'Subject moves toward or exits frame edge',
    toShotHint: 'Subject enters or continues from previous direction',
  },
  'parallel-action': {
    type: 'parallel-action',
    description: 'Cut between simultaneous events',
    fromShotHint: 'Establish clear action or state',
    toShotHint: 'Show related action happening simultaneously',
  },
};

// Scene type distribution recommendations by duration mode
export const SCENE_DISTRIBUTION: Record<DurationMode, SceneType[]> = {
  micro: ['action'],
  short: ['establishing', 'action', 'detail', 'action', 'climax'],
  medium: ['establishing', 'action', 'reaction', 'detail', 'action', 'climax', 'action', 'resolution'],
  long: [
    'establishing', 'action', 'reaction', 'detail', 
    'transition', 'action', 'climax', 'reaction',
    'detail', 'action', 'resolution'
  ],
  extended: [
    'establishing', 'action', 'reaction', 'detail', 'action',
    'transition', 'establishing', 'action', 'detail', 'reaction',
    'climax', 'reaction', 'action', 'detail',
    'transition', 'action', 'climax', 'resolution'
  ],
};

// Helper to get duration mode from seconds
export function getDurationMode(seconds: number): DurationMode {
  if (seconds <= 10) return 'micro';
  if (seconds <= 45) return 'short';
  if (seconds <= 90) return 'medium';
  if (seconds <= 180) return 'long';
  return 'extended';
}

// Helper to calculate optimal shot count
export function calculateOptimalShotCount(targetSeconds: number, pacing: 'fast' | 'moderate' | 'slow'): number {
  const avgDuration = pacing === 'fast' ? 4 : pacing === 'slow' ? 6 : 5;
  return Math.max(1, Math.round(targetSeconds / avgDuration));
}
