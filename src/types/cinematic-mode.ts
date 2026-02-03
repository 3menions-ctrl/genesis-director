/**
 * Cinematic Mode Types - Dynamic movement and camera angles for avatar videos
 */

export type MovementType = 'static' | 'walking' | 'driving' | 'action' | 'random';
export type CameraAngle = 'static' | 'tracking' | 'dynamic' | 'random';

export interface CinematicModeConfig {
  enabled: boolean;
  movementType: MovementType;
  cameraAngle: CameraAngle;
}

export const DEFAULT_CINEMATIC_CONFIG: CinematicModeConfig = {
  enabled: false,
  movementType: 'random',
  cameraAngle: 'random',
};

// Movement presets with descriptive prompts
export const MOVEMENT_PRESETS: Record<MovementType, {
  label: string;
  description: string;
  prompts: string[];
}> = {
  static: {
    label: 'Static',
    description: 'Standing or seated, minimal movement',
    prompts: [
      'standing confidently',
      'seated comfortably',
      'leaning casually',
    ],
  },
  walking: {
    label: 'Walking',
    description: 'Moving through streets, corridors, nature',
    prompts: [
      'walking purposefully through the scene',
      'strolling casually while speaking',
      'walking and gesturing naturally',
      'moving through the environment with confidence',
      'walking at a relaxed pace',
    ],
  },
  driving: {
    label: 'In Vehicle',
    description: 'Inside a car, train, or moving vehicle',
    prompts: [
      'seated in a moving car, city lights passing outside',
      'in the passenger seat of a vehicle, scenery moving past',
      'driving while speaking, hands occasionally on the wheel',
      'in a car at night, streetlights streaking past',
      'riding in a train, landscape blurring outside the window',
    ],
  },
  action: {
    label: 'Action',
    description: 'Running, climbing, dynamic activities',
    prompts: [
      'jogging through the scene with energy',
      'climbing stairs with purpose',
      'moving quickly through a crowd',
      'running with determination',
      'navigating through an active environment',
    ],
  },
  random: {
    label: 'Dynamic',
    description: 'AI selects best movement per scene',
    prompts: [], // Will randomly select from other categories
  },
};

// Camera angle presets
export const CAMERA_PRESETS: Record<CameraAngle, {
  label: string;
  description: string;
  prompts: string[];
}> = {
  static: {
    label: 'Locked',
    description: 'Fixed camera position, steady shot',
    prompts: [
      'static camera, professional framing',
      'fixed camera angle, stable shot',
      'locked camera position',
    ],
  },
  tracking: {
    label: 'Tracking',
    description: 'Camera follows the subject smoothly',
    prompts: [
      'smooth tracking shot following the subject',
      'camera gliding alongside the movement',
      'dolly shot maintaining perfect framing',
      'steadicam following the action',
    ],
  },
  dynamic: {
    label: 'Cinematic',
    description: 'Multiple angles, professional cinematography',
    prompts: [
      'cinematic camera work with subtle movements',
      'professional cinematography with slight push-in',
      'film-quality camera movement with gentle pans',
      'documentary-style camera with natural motion',
      'dramatic low-angle shot with upward tilt',
      'over-the-shoulder perspective pulling back slowly',
    ],
  },
  random: {
    label: 'Auto',
    description: 'AI selects best angles dynamically',
    prompts: [], // Will randomly select from other categories
  },
};

/**
 * Build a cinematic prompt enhancement based on config
 */
export function buildCinematicPrompt(config: CinematicModeConfig, clipIndex: number = 0): string {
  if (!config.enabled) {
    return '';
  }

  // Get movement prompt
  let movementPrompt = '';
  if (config.movementType === 'random') {
    const movementTypes: MovementType[] = ['walking', 'driving', 'action', 'static'];
    const selectedType = movementTypes[clipIndex % movementTypes.length];
    const prompts = MOVEMENT_PRESETS[selectedType].prompts;
    movementPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  } else {
    const prompts = MOVEMENT_PRESETS[config.movementType].prompts;
    movementPrompt = prompts[Math.floor(Math.random() * prompts.length)] || '';
  }

  // Get camera prompt
  let cameraPrompt = '';
  if (config.cameraAngle === 'random') {
    const cameraTypes: CameraAngle[] = ['static', 'tracking', 'dynamic'];
    const selectedType = cameraTypes[Math.floor(Math.random() * cameraTypes.length)];
    const prompts = CAMERA_PRESETS[selectedType].prompts;
    cameraPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  } else {
    const prompts = CAMERA_PRESETS[config.cameraAngle].prompts;
    cameraPrompt = prompts[Math.floor(Math.random() * prompts.length)] || '';
  }

  const parts: string[] = [];
  if (movementPrompt) parts.push(movementPrompt);
  if (cameraPrompt) parts.push(cameraPrompt);

  return parts.join(', ');
}
