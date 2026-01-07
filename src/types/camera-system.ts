// ============================================
// Advanced Cinematic Camera System
// Professional camera angles, movements, and genre-specific presets
// ============================================

// ============ CAMERA SCALES ============
export type CameraScale = 
  | 'extreme-wide'      // Vast landscape, entire location
  | 'wide'              // Full scene with environment
  | 'full'              // Full body shot
  | 'medium-wide'       // Waist up with some environment
  | 'medium'            // Waist up
  | 'medium-close'      // Chest up
  | 'close-up'          // Face/head
  | 'extreme-close-up'  // Eyes, detail, texture
  | 'insert';           // Object detail shot

// ============ CAMERA ANGLES ============
export type CameraAngle =
  // Standard angles
  | 'eye-level'         // Natural, neutral
  | 'low-angle'         // Power, heroism, threat
  | 'high-angle'        // Vulnerability, overview
  | 'overhead'          // Bird's eye, surveillance
  
  // Advanced angles
  | 'dutch-angle'       // Tension, unease, disorientation
  | 'worms-eye'         // Extreme low, towering subjects
  | 'gods-eye'          // Directly above, fate/destiny
  | 'over-shoulder'     // Conversation, connection
  | 'canted-close'      // Tilted close-up for intensity
  | 'pov'               // First-person subjective
  | 'reverse-pov'       // What subject sees, then subject
  | 'profile'           // Side view, contemplative
  | 'three-quarter';    // 45-degree classic portrait

// ============ CAMERA MOVEMENTS ============
export type CameraMovement =
  // Static
  | 'static'            // Locked off, no movement
  | 'tripod-subtle'     // Slight organic movement
  
  // Horizontal
  | 'pan-left'          // Rotate left on axis
  | 'pan-right'         // Rotate right on axis
  | 'whip-pan'          // Fast blur transition
  
  // Vertical
  | 'tilt-up'           // Rotate up on axis
  | 'tilt-down'         // Rotate down on axis
  
  // Dolly/Track
  | 'dolly-in'          // Push in toward subject
  | 'dolly-out'         // Pull back from subject
  | 'dolly-alongside'   // Move parallel to subject
  | 'tracking'          // Follow subject movement
  
  // Crane/Jib
  | 'crane-up'          // Rise vertically while shooting
  | 'crane-down'        // Descend vertically
  | 'crane-reveal'      // Rise to reveal scene
  
  // Complex
  | 'arc'               // Circle around subject
  | 'arc-180'           // Half circle around subject
  | 'push-pull'         // Dolly + zoom opposite (vertigo)
  | 'vertigo-effect'    // Dolly-zoom for disorientation
  | 'spiral'            // Spiral inward/outward
  
  // Handheld
  | 'handheld'          // Organic, documentary feel
  | 'handheld-intense'  // Shaky, chaotic energy
  | 'steadicam-float'   // Smooth floating movement
  | 'steadicam-follow'; // Smooth following shot

// ============ GENRE PRESETS ============
export type MovieGenre = 
  | 'horror'
  | 'action'
  | 'epic'
  | 'romance'
  | 'comedy'
  | 'thriller'
  | 'documentary'
  | 'drama'
  | 'sci-fi'
  | 'fantasy'
  | 'noir'
  | 'adventure'
  | 'musical';

export interface GenreCameraPreset {
  genre: MovieGenre;
  preferredAngles: CameraAngle[];
  preferredMovements: CameraMovement[];
  preferredScales: CameraScale[];
  avoidAngles: CameraAngle[];
  colorTemperature: 'warm' | 'cool' | 'neutral' | 'desaturated';
  lightingStyle: string;
  pacingTendency: 'fast' | 'moderate' | 'slow' | 'dynamic';
}

export const GENRE_CAMERA_PRESETS: Record<MovieGenre, GenreCameraPreset> = {
  horror: {
    genre: 'horror',
    preferredAngles: ['dutch-angle', 'worms-eye', 'canted-close', 'pov', 'overhead'],
    preferredMovements: ['handheld', 'dolly-in', 'crane-reveal', 'whip-pan', 'static'],
    preferredScales: ['extreme-close-up', 'wide', 'medium-close'],
    avoidAngles: ['three-quarter'],
    colorTemperature: 'desaturated',
    lightingStyle: 'high contrast shadows, single source, underlighting',
    pacingTendency: 'dynamic',
  },
  action: {
    genre: 'action',
    preferredAngles: ['low-angle', 'worms-eye', 'over-shoulder', 'pov'],
    preferredMovements: ['handheld-intense', 'tracking', 'whip-pan', 'arc', 'steadicam-follow'],
    preferredScales: ['medium', 'medium-close', 'full', 'wide'],
    avoidAngles: ['gods-eye'],
    colorTemperature: 'warm',
    lightingStyle: 'high key, practical lights, lens flares',
    pacingTendency: 'fast',
  },
  epic: {
    genre: 'epic',
    preferredAngles: ['low-angle', 'worms-eye', 'gods-eye', 'overhead', 'eye-level'],
    preferredMovements: ['crane-up', 'crane-reveal', 'arc', 'dolly-out', 'steadicam-float'],
    preferredScales: ['extreme-wide', 'wide', 'full', 'medium'],
    avoidAngles: ['canted-close', 'three-quarter'],
    colorTemperature: 'warm',
    lightingStyle: 'golden hour, volumetric rays, grand scale lighting',
    pacingTendency: 'slow',
  },
  romance: {
    genre: 'romance',
    preferredAngles: ['eye-level', 'three-quarter', 'over-shoulder', 'profile'],
    preferredMovements: ['steadicam-float', 'dolly-in', 'arc', 'static', 'crane-up'],
    preferredScales: ['medium', 'medium-close', 'close-up', 'medium-wide'],
    avoidAngles: ['dutch-angle', 'worms-eye'],
    colorTemperature: 'warm',
    lightingStyle: 'soft diffused light, rim lighting, bokeh backgrounds',
    pacingTendency: 'slow',
  },
  comedy: {
    genre: 'comedy',
    preferredAngles: ['eye-level', 'high-angle', 'over-shoulder'],
    preferredMovements: ['static', 'whip-pan', 'dolly-in', 'handheld'],
    preferredScales: ['medium', 'medium-wide', 'close-up'],
    avoidAngles: ['worms-eye', 'gods-eye'],
    colorTemperature: 'warm',
    lightingStyle: 'bright, even lighting, high key',
    pacingTendency: 'fast',
  },
  thriller: {
    genre: 'thriller',
    preferredAngles: ['dutch-angle', 'pov', 'over-shoulder', 'low-angle', 'canted-close'],
    preferredMovements: ['dolly-in', 'steadicam-follow', 'handheld', 'push-pull', 'static'],
    preferredScales: ['close-up', 'extreme-close-up', 'medium-close', 'wide'],
    avoidAngles: ['three-quarter'],
    colorTemperature: 'cool',
    lightingStyle: 'high contrast, motivated shadows, urban practicals',
    pacingTendency: 'dynamic',
  },
  documentary: {
    genre: 'documentary',
    preferredAngles: ['eye-level', 'over-shoulder', 'pov', 'high-angle'],
    preferredMovements: ['handheld', 'static', 'pan-left', 'pan-right', 'tracking'],
    preferredScales: ['medium', 'medium-close', 'wide', 'close-up'],
    avoidAngles: ['dutch-angle', 'canted-close'],
    colorTemperature: 'neutral',
    lightingStyle: 'natural available light, documentary realism',
    pacingTendency: 'moderate',
  },
  drama: {
    genre: 'drama',
    preferredAngles: ['eye-level', 'profile', 'over-shoulder', 'low-angle', 'high-angle'],
    preferredMovements: ['static', 'dolly-in', 'steadicam-float', 'crane-up', 'arc'],
    preferredScales: ['medium', 'close-up', 'medium-close', 'full'],
    avoidAngles: ['worms-eye'],
    colorTemperature: 'neutral',
    lightingStyle: 'naturalistic, motivated sources, emotional contrast',
    pacingTendency: 'moderate',
  },
  'sci-fi': {
    genre: 'sci-fi',
    preferredAngles: ['low-angle', 'gods-eye', 'pov', 'overhead', 'dutch-angle'],
    preferredMovements: ['steadicam-float', 'crane-reveal', 'arc', 'vertigo-effect', 'dolly-in'],
    preferredScales: ['extreme-wide', 'wide', 'medium', 'insert'],
    avoidAngles: ['profile'],
    colorTemperature: 'cool',
    lightingStyle: 'neon practicals, lens flares, futuristic ambience',
    pacingTendency: 'moderate',
  },
  fantasy: {
    genre: 'fantasy',
    preferredAngles: ['low-angle', 'worms-eye', 'overhead', 'three-quarter'],
    preferredMovements: ['crane-up', 'crane-reveal', 'arc', 'steadicam-float', 'dolly-out'],
    preferredScales: ['extreme-wide', 'wide', 'full', 'medium'],
    avoidAngles: ['dutch-angle'],
    colorTemperature: 'warm',
    lightingStyle: 'magical golden light, volumetric fog, ethereal glow',
    pacingTendency: 'slow',
  },
  noir: {
    genre: 'noir',
    preferredAngles: ['dutch-angle', 'low-angle', 'high-angle', 'profile', 'over-shoulder'],
    preferredMovements: ['static', 'dolly-in', 'crane-down', 'handheld'],
    preferredScales: ['medium', 'close-up', 'medium-close', 'wide'],
    avoidAngles: ['gods-eye'],
    colorTemperature: 'desaturated',
    lightingStyle: 'venetian blind shadows, high contrast, single hard source',
    pacingTendency: 'slow',
  },
  adventure: {
    genre: 'adventure',
    preferredAngles: ['low-angle', 'pov', 'over-shoulder', 'eye-level', 'overhead'],
    preferredMovements: ['tracking', 'steadicam-follow', 'crane-reveal', 'arc', 'whip-pan'],
    preferredScales: ['wide', 'medium', 'full', 'medium-wide'],
    avoidAngles: ['canted-close'],
    colorTemperature: 'warm',
    lightingStyle: 'natural daylight, adventure warmth, practical locations',
    pacingTendency: 'fast',
  },
  musical: {
    genre: 'musical',
    preferredAngles: ['eye-level', 'low-angle', 'overhead', 'gods-eye', 'three-quarter'],
    preferredMovements: ['crane-up', 'arc', 'arc-180', 'tracking', 'steadicam-float'],
    preferredScales: ['full', 'wide', 'medium', 'extreme-wide'],
    avoidAngles: ['dutch-angle'],
    colorTemperature: 'warm',
    lightingStyle: 'theatrical lighting, colored gels, spotlight drama',
    pacingTendency: 'dynamic',
  },
};

// ============ SCENE TYPE CAMERA MAPPING ============
export type SceneType = 
  | 'establishing'
  | 'action'
  | 'reaction'
  | 'detail'
  | 'transition'
  | 'climax'
  | 'resolution'
  | 'dialogue'
  | 'chase'
  | 'reveal'
  | 'emotional'
  | 'montage';

export interface SceneCameraRecommendation {
  sceneType: SceneType;
  recommendedScales: CameraScale[];
  recommendedAngles: CameraAngle[];
  recommendedMovements: CameraMovement[];
  intensityLevel: 'low' | 'medium' | 'high';
  durationHint: 'short' | 'medium' | 'long';
}

export const SCENE_CAMERA_MAPPING: Record<SceneType, SceneCameraRecommendation> = {
  establishing: {
    sceneType: 'establishing',
    recommendedScales: ['extreme-wide', 'wide'],
    recommendedAngles: ['eye-level', 'overhead', 'high-angle', 'gods-eye'],
    recommendedMovements: ['crane-reveal', 'dolly-out', 'static', 'steadicam-float'],
    intensityLevel: 'low',
    durationHint: 'medium',
  },
  action: {
    sceneType: 'action',
    recommendedScales: ['medium', 'full', 'medium-wide'],
    recommendedAngles: ['low-angle', 'pov', 'over-shoulder', 'worms-eye'],
    recommendedMovements: ['handheld-intense', 'tracking', 'whip-pan', 'steadicam-follow'],
    intensityLevel: 'high',
    durationHint: 'short',
  },
  reaction: {
    sceneType: 'reaction',
    recommendedScales: ['close-up', 'medium-close', 'extreme-close-up'],
    recommendedAngles: ['eye-level', 'three-quarter', 'profile'],
    recommendedMovements: ['static', 'dolly-in', 'tripod-subtle'],
    intensityLevel: 'medium',
    durationHint: 'short',
  },
  detail: {
    sceneType: 'detail',
    recommendedScales: ['extreme-close-up', 'insert', 'close-up'],
    recommendedAngles: ['overhead', 'eye-level', 'dutch-angle'],
    recommendedMovements: ['dolly-in', 'static', 'arc'],
    intensityLevel: 'low',
    durationHint: 'short',
  },
  transition: {
    sceneType: 'transition',
    recommendedScales: ['wide', 'medium-wide', 'full'],
    recommendedAngles: ['high-angle', 'eye-level', 'overhead'],
    recommendedMovements: ['crane-up', 'whip-pan', 'dolly-alongside', 'pan-left', 'pan-right'],
    intensityLevel: 'low',
    durationHint: 'short',
  },
  climax: {
    sceneType: 'climax',
    recommendedScales: ['medium-close', 'close-up', 'medium'],
    recommendedAngles: ['low-angle', 'dutch-angle', 'worms-eye', 'canted-close'],
    recommendedMovements: ['vertigo-effect', 'dolly-in', 'push-pull', 'handheld-intense'],
    intensityLevel: 'high',
    durationHint: 'medium',
  },
  resolution: {
    sceneType: 'resolution',
    recommendedScales: ['medium', 'wide', 'full'],
    recommendedAngles: ['eye-level', 'high-angle', 'three-quarter'],
    recommendedMovements: ['dolly-out', 'crane-up', 'static', 'steadicam-float'],
    intensityLevel: 'low',
    durationHint: 'long',
  },
  dialogue: {
    sceneType: 'dialogue',
    recommendedScales: ['medium', 'medium-close', 'medium-wide'],
    recommendedAngles: ['eye-level', 'over-shoulder', 'three-quarter', 'profile'],
    recommendedMovements: ['static', 'dolly-in', 'tripod-subtle', 'arc'],
    intensityLevel: 'low',
    durationHint: 'medium',
  },
  chase: {
    sceneType: 'chase',
    recommendedScales: ['full', 'medium', 'wide', 'medium-wide'],
    recommendedAngles: ['pov', 'low-angle', 'worms-eye', 'over-shoulder'],
    recommendedMovements: ['tracking', 'steadicam-follow', 'handheld-intense', 'whip-pan'],
    intensityLevel: 'high',
    durationHint: 'short',
  },
  reveal: {
    sceneType: 'reveal',
    recommendedScales: ['medium', 'wide', 'close-up'],
    recommendedAngles: ['low-angle', 'eye-level', 'dutch-angle'],
    recommendedMovements: ['crane-reveal', 'dolly-out', 'arc', 'tilt-up'],
    intensityLevel: 'medium',
    durationHint: 'medium',
  },
  emotional: {
    sceneType: 'emotional',
    recommendedScales: ['close-up', 'extreme-close-up', 'medium-close'],
    recommendedAngles: ['eye-level', 'profile', 'three-quarter'],
    recommendedMovements: ['static', 'dolly-in', 'steadicam-float', 'arc'],
    intensityLevel: 'medium',
    durationHint: 'long',
  },
  montage: {
    sceneType: 'montage',
    recommendedScales: ['medium', 'close-up', 'wide', 'insert'],
    recommendedAngles: ['eye-level', 'high-angle', 'overhead', 'dutch-angle'],
    recommendedMovements: ['whip-pan', 'static', 'dolly-in', 'handheld'],
    intensityLevel: 'medium',
    durationHint: 'short',
  },
};

// ============ MOVEMENT COMBO PRESETS ============
export interface MovementCombo {
  name: string;
  description: string;
  movements: CameraMovement[];
  effect: string;
  bestFor: SceneType[];
}

export const MOVEMENT_COMBOS: MovementCombo[] = [
  {
    name: 'Vertigo Effect',
    description: 'Dolly in while zooming out (or vice versa)',
    movements: ['push-pull', 'vertigo-effect'],
    effect: 'Disorientation, revelation, psychological shift',
    bestFor: ['climax', 'reveal', 'emotional'],
  },
  {
    name: 'Hero Reveal',
    description: 'Crane up from low to reveal full figure',
    movements: ['crane-up', 'tilt-up'],
    effect: 'Empowerment, introduction, grandeur',
    bestFor: ['establishing', 'reveal', 'action'],
  },
  {
    name: 'Intimate Circle',
    description: 'Arc around subject while slowly pushing in',
    movements: ['arc', 'dolly-in'],
    effect: 'Intimacy, focus, emotional connection',
    bestFor: ['emotional', 'dialogue', 'reaction'],
  },
  {
    name: 'Chaos Shot',
    description: 'Handheld with whip pans between subjects',
    movements: ['handheld-intense', 'whip-pan'],
    effect: 'Panic, confusion, high energy',
    bestFor: ['action', 'chase', 'climax'],
  },
  {
    name: 'Floating Dream',
    description: 'Steadicam with slow crane movements',
    movements: ['steadicam-float', 'crane-up', 'crane-down'],
    effect: 'Dreamlike, ethereal, serene',
    bestFor: ['emotional', 'montage', 'resolution'],
  },
  {
    name: 'Stalker POV',
    description: 'Slow dolly through obstacles toward subject',
    movements: ['dolly-in', 'steadicam-follow'],
    effect: 'Tension, threat, suspense',
    bestFor: ['climax', 'reveal'],
  },
  {
    name: 'World Reveal',
    description: 'Start tight, crane out to extreme wide',
    movements: ['crane-up', 'dolly-out'],
    effect: 'Scale, wonder, context',
    bestFor: ['establishing', 'reveal', 'resolution'],
  },
  {
    name: 'Action Spiral',
    description: 'Spiral around action while tracking',
    movements: ['spiral', 'tracking'],
    effect: 'Dynamic energy, spectacle',
    bestFor: ['action', 'climax', 'chase'],
  },
];

// ============ SMART CAMERA SELECTION ============
export interface CameraRecommendation {
  scale: CameraScale;
  angle: CameraAngle;
  movement: CameraMovement;
  comboSuggestion?: MovementCombo;
  perspectiveDescription: string;
  lightingHint: string;
}

/**
 * Get smart camera recommendations based on scene type and genre
 */
export function getSmartCameraRecommendation(
  sceneType: SceneType,
  genre: MovieGenre,
  shotIndex: number,
  previousShot?: { scale: CameraScale; angle: CameraAngle; movement: CameraMovement }
): CameraRecommendation {
  const genrePreset = GENRE_CAMERA_PRESETS[genre];
  const sceneMapping = SCENE_CAMERA_MAPPING[sceneType];
  
  // Filter scene recommendations by genre preferences
  const availableScales = sceneMapping.recommendedScales.filter(
    s => genrePreset.preferredScales.includes(s)
  );
  const availableAngles = sceneMapping.recommendedAngles.filter(
    a => !genrePreset.avoidAngles.includes(a) && genrePreset.preferredAngles.includes(a)
  );
  const availableMovements = sceneMapping.recommendedMovements.filter(
    m => genrePreset.preferredMovements.includes(m)
  );
  
  // Use available or fall back to scene defaults
  const scales = availableScales.length > 0 ? availableScales : sceneMapping.recommendedScales;
  const angles = availableAngles.length > 0 ? availableAngles : sceneMapping.recommendedAngles;
  const movements = availableMovements.length > 0 ? availableMovements : sceneMapping.recommendedMovements;
  
  // Avoid repeating same scale/angle consecutively
  let selectedScale = scales[shotIndex % scales.length];
  let selectedAngle = angles[shotIndex % angles.length];
  let selectedMovement = movements[shotIndex % movements.length];
  
  if (previousShot) {
    if (selectedScale === previousShot.scale && scales.length > 1) {
      selectedScale = scales[(shotIndex + 1) % scales.length];
    }
    if (selectedAngle === previousShot.angle && angles.length > 1) {
      selectedAngle = angles[(shotIndex + 1) % angles.length];
    }
  }
  
  // Find matching movement combo
  const matchingCombos = MOVEMENT_COMBOS.filter(combo => 
    combo.bestFor.includes(sceneType) && 
    combo.movements.includes(selectedMovement)
  );
  
  // Build perspective description
  const perspectiveDescription = buildPerspectiveDescription(selectedScale, selectedAngle, selectedMovement);
  
  return {
    scale: selectedScale,
    angle: selectedAngle,
    movement: selectedMovement,
    comboSuggestion: matchingCombos[0],
    perspectiveDescription,
    lightingHint: genrePreset.lightingStyle,
  };
}

/**
 * Build natural language perspective description for prompts
 */
export function buildPerspectiveDescription(
  scale: CameraScale,
  angle: CameraAngle,
  movement: CameraMovement
): string {
  const scaleDescriptions: Record<CameraScale, string> = {
    'extreme-wide': 'vast panoramic view capturing the entire environment',
    'wide': 'expansive perspective showing full scene context',
    'full': 'complete figure framing from head to toe',
    'medium-wide': 'upper body with surrounding environment',
    'medium': 'waist-up balanced framing at conversational distance',
    'medium-close': 'chest-up intimate framing',
    'close-up': 'face-filling frame capturing subtle emotions',
    'extreme-close-up': 'macro detail revealing texture and micro-expressions',
    'insert': 'object-focused detail shot',
  };
  
  const angleDescriptions: Record<CameraAngle, string> = {
    'eye-level': 'natural standing height viewpoint',
    'low-angle': 'looking upward, adding power and authority',
    'high-angle': 'looking down, creating vulnerability',
    'overhead': 'bird\'s eye view directly from above',
    'dutch-angle': 'tilted frame creating tension and unease',
    'worms-eye': 'extreme ground-level perspective, towering subjects',
    'gods-eye': 'directly overhead, fate and destiny perspective',
    'over-shoulder': 'intimate observer viewpoint, connection',
    'canted-close': 'tilted close-up for psychological intensity',
    'pov': 'first-person subjective experience',
    'reverse-pov': 'what the subject sees, then the subject',
    'profile': 'side view silhouette, contemplative',
    'three-quarter': '45-degree classic portrait angle',
  };
  
  const movementDescriptions: Record<CameraMovement, string> = {
    'static': 'locked-off steady composition',
    'tripod-subtle': 'subtle organic micro-movements',
    'pan-left': 'smooth horizontal sweep leftward',
    'pan-right': 'smooth horizontal sweep rightward',
    'whip-pan': 'fast blur transition sweeping to new scene',
    'tilt-up': 'vertical sweep rising upward',
    'tilt-down': 'vertical sweep descending',
    'dolly-in': 'smooth push toward subject',
    'dolly-out': 'smooth pull back revealing context',
    'dolly-alongside': 'parallel movement alongside subject',
    'tracking': 'fluid following movement with subject',
    'crane-up': 'rising vertical perspective shift',
    'crane-down': 'descending vertical perspective shift',
    'crane-reveal': 'rising movement revealing the scene',
    'arc': 'circling movement around subject',
    'arc-180': 'half-circle rotation around subject',
    'push-pull': 'dolly-zoom creating disorientation',
    'vertigo-effect': 'famous Hitchcock dolly-zoom',
    'spiral': 'spiraling inward or outward motion',
    'handheld': 'organic documentary-style movement',
    'handheld-intense': 'urgent shaky energy',
    'steadicam-float': 'ethereal floating glide',
    'steadicam-follow': 'smooth following behind subject',
  };
  
  return `${scaleDescriptions[scale]}, ${angleDescriptions[angle]}, ${movementDescriptions[movement]}`;
}

/**
 * Get transition-aware camera for next shot
 */
export function getTransitionCamera(
  transitionType: string,
  currentCamera: { scale: CameraScale; angle: CameraAngle },
  sceneType: SceneType
): { scale: CameraScale; angle: CameraAngle } {
  // Angle change transitions should change the angle
  if (transitionType === 'angle-change') {
    const angleProgression: Record<CameraAngle, CameraAngle> = {
      'eye-level': 'low-angle',
      'low-angle': 'high-angle',
      'high-angle': 'eye-level',
      'dutch-angle': 'eye-level',
      'overhead': 'eye-level',
      'worms-eye': 'eye-level',
      'gods-eye': 'high-angle',
      'over-shoulder': 'profile',
      'canted-close': 'eye-level',
      'pov': 'over-shoulder',
      'reverse-pov': 'pov',
      'profile': 'three-quarter',
      'three-quarter': 'eye-level',
    };
    return {
      scale: currentCamera.scale,
      angle: angleProgression[currentCamera.angle] || 'eye-level',
    };
  }
  
  // Scene jump should reset to establishing
  if (transitionType === 'scene-jump') {
    return { scale: 'wide', angle: 'eye-level' };
  }
  
  // Scale change transitions
  const scaleProgression: Record<CameraScale, CameraScale> = {
    'extreme-wide': 'wide',
    'wide': 'medium',
    'full': 'medium',
    'medium-wide': 'medium-close',
    'medium': 'close-up',
    'medium-close': 'close-up',
    'close-up': 'medium',
    'extreme-close-up': 'close-up',
    'insert': 'medium',
  };
  
  return {
    scale: scaleProgression[currentCamera.scale] || 'medium',
    angle: currentCamera.angle,
  };
}
