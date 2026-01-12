/**
 * SCENE CONTINUITY MANIFEST
 * 
 * Comprehensive per-shot tracking system for maintaining
 * visual, spatial, and emotional continuity across AI-generated clips.
 */

// ============================================
// SPATIAL CONTINUITY
// ============================================

export interface SpatialPosition {
  screenPosition: 'left' | 'center' | 'right' | 'left-third' | 'right-third';
  depth: 'foreground' | 'midground' | 'background';
  verticalPosition: 'top' | 'middle' | 'bottom';
  facingDirection: 'left' | 'right' | 'camera' | 'away';
  bodyAngle: number; // degrees from camera, 0 = facing camera
}

export interface RelativePosition {
  characterId: string;
  characterName: string;
  relativePosition: 'left-of' | 'right-of' | 'behind' | 'in-front' | 'beside';
  distance: 'close' | 'medium' | 'far';
}

export interface SpatialAnchors {
  primaryCharacter: SpatialPosition;
  secondaryCharacters?: { characterId: string; position: SpatialPosition }[];
  relativePositions?: RelativePosition[];
  cameraDistance: 'extreme-close' | 'close-up' | 'medium' | 'full-shot' | 'wide' | 'extreme-wide';
  eyeLineDirection?: string; // "looking left at off-screen character"
}

// ============================================
// LIGHTING CONTINUITY
// ============================================

export interface LightingState {
  primarySource: {
    type: 'natural' | 'artificial' | 'mixed' | 'practical';
    direction: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'rim';
    quality: 'hard' | 'soft' | 'diffused';
    intensity: 'low' | 'medium' | 'high' | 'dramatic';
  };
  colorTemperature: 'warm' | 'neutral' | 'cool' | 'mixed';
  colorTint?: string; // "golden hour amber", "neon pink"
  shadowDirection: string; // "shadows falling left"
  ambientLevel: 'dark' | 'dim' | 'normal' | 'bright' | 'overexposed';
  specialLighting?: string[]; // ["rim light on hair", "underlit from fire"]
}

// ============================================
// PROPS & OBJECTS
// ============================================

export interface PropState {
  propId: string;
  name: string;
  heldBy?: string; // character name or "ground", "table", etc.
  hand?: 'left' | 'right' | 'both';
  state: string; // "drawn", "sheathed", "open", "lit", etc.
  position?: string; // "at hip", "raised", "pointed at enemy"
  condition?: string; // "bloodied", "glowing", "damaged"
}

export interface PropsInventory {
  characterProps: { characterName: string; props: PropState[] }[];
  environmentProps: { name: string; position: string; state: string }[];
  importantAbsences?: string[]; // "sword is NOT visible - lost in previous scene"
}

// ============================================
// EMOTIONAL & EXPRESSION STATE
// ============================================

export interface EmotionalState {
  primaryEmotion: string; // "fear", "determination", "grief"
  intensity: 'subtle' | 'moderate' | 'intense' | 'extreme';
  facialExpression: string; // "furrowed brow, clenched jaw"
  bodyLanguage: string; // "tense shoulders, guarded stance"
  breathingState?: 'calm' | 'heavy' | 'panting' | 'held';
  physicalIndicators?: string[]; // ["tears on cheeks", "red eyes", "sweat on brow"]
}

export interface EmotionalCarryover {
  fromPreviousShot: EmotionalState;
  expectedTransition?: string; // "anger building to rage"
  mustMaintain: string[]; // ["tears still visible", "shaking hands"]
}

// ============================================
// ACTION & MOVEMENT
// ============================================

export interface ActionMomentum {
  movementDirection: 'left' | 'right' | 'toward-camera' | 'away' | 'stationary' | 'up' | 'down';
  movementType: 'walking' | 'running' | 'fighting' | 'falling' | 'jumping' | 'turning' | 'still';
  gestureInProgress?: string; // "mid-swing of sword", "reaching for door"
  poseAtCut: string; // "weight on left foot, right arm extended"
  eyeMovement?: string; // "tracking left to right"
  expectedContinuation?: string; // "should complete the swing in next shot"
}

export interface ActionContinuity {
  rule180Maintained: boolean;
  matchingAction?: string; // "hand reaching for cup must connect"
  velocityConsistency?: 'slow' | 'medium' | 'fast';
  gravityState?: 'grounded' | 'airborne' | 'falling' | 'landing';
}

// ============================================
// MICRO-DETAILS (Dirt, Scars, Wear)
// ============================================

export interface SkinDetails {
  scars: { location: string; description: string }[];
  wounds: { location: string; freshness: 'fresh' | 'healing' | 'old'; description: string }[];
  dirt: { areas: string[]; intensity: 'light' | 'moderate' | 'heavy' }[];
  sweat: boolean;
  blood?: { areas: string[]; freshness: string }[];
  bruises?: { location: string; age: string }[];
}

export interface ClothingWear {
  tears: { location: string; size: 'small' | 'medium' | 'large' }[];
  stains: { location: string; type: string; color?: string }[];
  dustLevel: 'clean' | 'light-dust' | 'dusty' | 'caked';
  wetness?: { areas: string[]; level: 'damp' | 'wet' | 'soaked' }[];
  damage?: { location: string; type: string }[];
}

export interface HairState {
  style: string; // "loose curls", "tight bun"
  condition: 'neat' | 'slightly-messy' | 'disheveled' | 'wild';
  wetness?: 'dry' | 'damp' | 'wet' | 'dripping';
  debris?: string[]; // ["leaves", "dust", "blood"]
  windEffect?: string; // "blowing left"
}

export interface MicroDetails {
  skin: SkinDetails;
  clothing: ClothingWear;
  hair: HairState;
  persistentMarkers: string[]; // ["scar across left eyebrow always visible"]
}

// ============================================
// ENVIRONMENT STATE
// ============================================

export interface EnvironmentState {
  weatherVisible: string; // "rain falling", "snow on ground"
  timeOfDay: string;
  atmospherics: string[]; // ["fog", "dust particles", "smoke"]
  backgroundElements: string[]; // ["burning building in background", "crowd visible"]
  surfaceConditions?: string; // "wet cobblestones reflecting light"
}

// ============================================
// COMPLETE SHOT MANIFEST
// ============================================

export interface ShotContinuityManifest {
  shotIndex: number;
  projectId: string;
  extractedAt: number;
  
  // Core continuity data
  spatial: SpatialAnchors;
  lighting: LightingState;
  props: PropsInventory;
  emotional: EmotionalState;
  action: ActionMomentum;
  microDetails: MicroDetails;
  environment: EnvironmentState;
  
  // Continuity rules
  actionContinuity?: ActionContinuity;
  emotionalCarryover?: EmotionalCarryover;
  
  // Generated prompts
  injectionPrompt: string; // Full consistency prompt
  negativePrompt: string; // What to avoid
  criticalAnchors: string[]; // Most important elements
}

// ============================================
// MANIFEST CHAIN (Full Project)
// ============================================

export interface ProjectContinuityChain {
  projectId: string;
  shots: ShotContinuityManifest[];
  globalCharacterDetails: {
    characterName: string;
    persistentFeatures: string[];
    identityBibleRef?: string; // URL to identity bible images
  }[];
  globalEnvironment?: {
    setting: string;
    weatherProgression?: string; // "starts sunny, clouds roll in by shot 5"
    timeProgression?: string; // "dawn to mid-morning over 8 shots"
  };
}

// ============================================
// EXTRACTION REQUEST/RESPONSE
// ============================================

export interface ExtractContinuityRequest {
  frameUrl: string;
  projectId: string;
  shotIndex: number;
  previousManifest?: ShotContinuityManifest;
  shotDescription?: string;
  characterNames?: string[];
}

export interface ExtractContinuityResponse {
  success: boolean;
  manifest?: ShotContinuityManifest;
  error?: string;
}

// ============================================
// PROMPT BUILDING UTILITIES
// ============================================

export function buildContinuityInjection(
  manifest: ShotContinuityManifest,
  nextShotDescription?: string
): { prompt: string; negative: string } {
  const sections: string[] = [];
  
  // Spatial continuity
  const sp = manifest.spatial;
  sections.push(
    `[SPATIAL: Character ${sp.primaryCharacter.screenPosition} of frame, ` +
    `${sp.primaryCharacter.depth}, facing ${sp.primaryCharacter.facingDirection}, ` +
    `${sp.cameraDistance} shot]`
  );
  
  // Lighting continuity
  const lt = manifest.lighting;
  sections.push(
    `[LIGHTING: ${lt.primarySource.type} ${lt.primarySource.direction} light, ` +
    `${lt.primarySource.quality} shadows, ${lt.colorTemperature} temperature, ` +
    `${lt.ambientLevel} ambient]`
  );
  
  // Props
  if (manifest.props.characterProps.length > 0) {
    const propList = manifest.props.characterProps
      .flatMap(cp => cp.props.map(p => `${p.name} ${p.state}`))
      .slice(0, 3)
      .join(', ');
    sections.push(`[PROPS: ${propList}]`);
  }
  
  // Emotional state
  const em = manifest.emotional;
  sections.push(
    `[EMOTION: ${em.intensity} ${em.primaryEmotion}, ${em.facialExpression}]`
  );
  
  // Action momentum
  const ac = manifest.action;
  if (ac.movementType !== 'still') {
    sections.push(
      `[ACTION: ${ac.movementType} ${ac.movementDirection}, ${ac.poseAtCut}]`
    );
  }
  
  // Micro-details (critical for consistency)
  const md = manifest.microDetails;
  const microList: string[] = [];
  if (md.skin.scars.length > 0) {
    microList.push(...md.skin.scars.map(s => `scar ${s.location}`));
  }
  if (md.skin.wounds.length > 0) {
    microList.push(...md.skin.wounds.map(w => `${w.freshness} wound ${w.location}`));
  }
  if (md.skin.dirt.length > 0) {
    microList.push(`${md.skin.dirt[0].intensity} dirt on ${md.skin.dirt[0].areas.join(', ')}`);
  }
  if (md.clothing.stains.length > 0) {
    microList.push(...md.clothing.stains.slice(0, 2).map(s => `${s.type} stain on ${s.location}`));
  }
  if (microList.length > 0) {
    sections.push(`[DETAILS: ${microList.slice(0, 4).join(', ')}]`);
  }
  
  // Build negative prompt
  const negatives: string[] = [
    'character morphing',
    'identity change', 
    'clothing change',
    'lighting direction reversal',
    'prop disappearance',
    'scar removal',
    'wound healing between shots',
    'sudden cleanliness',
    '180 degree rule violation',
  ];
  
  // Add position-specific negatives
  if (sp.primaryCharacter.screenPosition === 'left') {
    negatives.push('character on right side');
  } else if (sp.primaryCharacter.screenPosition === 'right') {
    negatives.push('character on left side');
  }
  
  return {
    prompt: sections.join(' '),
    negative: negatives.join(', '),
  };
}

export function buildTransitionPrompt(
  previousManifest: ShotContinuityManifest,
  currentManifest: Partial<ShotContinuityManifest>
): string {
  const transitions: string[] = [];
  
  // Check for emotional transition
  if (currentManifest.emotional && 
      currentManifest.emotional.primaryEmotion !== previousManifest.emotional.primaryEmotion) {
    transitions.push(
      `Emotional transition from ${previousManifest.emotional.primaryEmotion} ` +
      `to ${currentManifest.emotional.primaryEmotion}`
    );
  }
  
  // Check for action continuation
  if (previousManifest.action.expectedContinuation) {
    transitions.push(previousManifest.action.expectedContinuation);
  }
  
  return transitions.join('. ');
}
