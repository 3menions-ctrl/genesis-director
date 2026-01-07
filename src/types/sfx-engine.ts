// Sound Effects Engine Types
// Automatic SFX generation and placement for video productions

export type SFXCategory = 
  | 'ambient' | 'foley' | 'action' | 'impact' 
  | 'whoosh' | 'ui' | 'nature' | 'urban'
  | 'scifi' | 'horror' | 'comedy' | 'transition';

export type AmbientType = 
  | 'city-traffic' | 'city-night' | 'forest' | 'ocean-waves'
  | 'rain' | 'wind' | 'crowd' | 'office' | 'cafe'
  | 'space-hum' | 'machinery' | 'silence-room-tone';

export type ActionSFX = 
  | 'footsteps' | 'door-open' | 'door-close' | 'glass-break'
  | 'punch' | 'explosion' | 'gunshot' | 'car-engine'
  | 'typing' | 'phone-ring' | 'paper-rustle' | 'cloth-movement';

export interface SFXCue {
  id: string;
  category: SFXCategory;
  type: string; // Specific sound type
  startTime: number; // seconds
  duration: number; // seconds
  volume: number; // 0-1
  pan: number; // -1 (left) to 1 (right)
  fadeIn?: number; // seconds
  fadeOut?: number; // seconds
  loop?: boolean;
  
  // Contextual info
  shotId: string;
  description: string;
  triggerAction?: string; // Action that triggers this sound
}

export interface AmbientBed {
  id: string;
  type: AmbientType;
  startTime: number;
  endTime: number;
  volume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  crossfadeWithPrevious?: boolean;
}

export interface SFXAnalysis {
  shotId: string;
  
  // Detected elements that need sound
  detectedElements: {
    type: string;
    confidence: number;
    timestamp: number;
    suggestedSFX: string[];
  }[];
  
  // Environment detection
  environment: {
    type: AmbientType;
    confidence: number;
    indoor: boolean;
    timeOfDay: 'day' | 'night' | 'unknown';
  };
  
  // Action detection
  actions: {
    type: ActionSFX;
    timestamp: number;
    intensity: number; // 0-1
    duration: number;
  }[];
}

export interface SFXPlan {
  projectId: string;
  totalDuration: number;
  
  // Ambient beds (continuous background)
  ambientBeds: AmbientBed[];
  
  // Point SFX cues
  sfxCues: SFXCue[];
  
  // Per-shot analysis
  shotAnalysis: SFXAnalysis[];
  
  // Mixing instructions
  mixingInstructions: {
    masterVolume: number;
    ambientVolume: number;
    foleyVolume: number;
    actionVolume: number;
    duckingForDialogue: boolean;
    duckingAmount: number;
  };
  
  // FFmpeg audio filter chain
  ffmpegAudioFilters?: string;
}

export interface SFXGenerationRequest {
  projectId: string;
  shots: {
    id: string;
    description: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    durationSeconds: number;
    hasDialogue: boolean;
    environment?: string;
  }[];
  totalDuration: number;
  
  // Options
  includeAmbient: boolean;
  includeFoley: boolean;
  includeActionSFX: boolean;
  style: 'realistic' | 'stylized' | 'minimal';
}

export interface SFXGenerationResult {
  success: boolean;
  plan?: SFXPlan;
  
  // Generated audio file URLs
  ambientTrackUrl?: string;
  sfxTrackUrl?: string;
  combinedSFXUrl?: string;
  
  error?: string;
}

// Environment to ambient mapping
export const ENVIRONMENT_AMBIENT_MAP: Record<string, AmbientType> = {
  city: 'city-traffic',
  urban: 'city-traffic',
  street: 'city-traffic',
  office: 'office',
  corporate: 'office',
  forest: 'forest',
  woods: 'forest',
  jungle: 'forest',
  beach: 'ocean-waves',
  ocean: 'ocean-waves',
  sea: 'ocean-waves',
  cafe: 'cafe',
  restaurant: 'cafe',
  bar: 'cafe',
  space: 'space-hum',
  spaceship: 'space-hum',
  factory: 'machinery',
  industrial: 'machinery',
  night: 'city-night',
  indoor: 'silence-room-tone',
  room: 'silence-room-tone',
  rain: 'rain',
  storm: 'rain',
  windy: 'wind',
  crowd: 'crowd',
  stadium: 'crowd',
  concert: 'crowd',
};

// Action keywords to SFX mapping
export const ACTION_SFX_KEYWORDS: Record<string, ActionSFX[]> = {
  walking: ['footsteps'],
  running: ['footsteps'],
  enters: ['door-open', 'footsteps'],
  exits: ['footsteps', 'door-close'],
  opens: ['door-open'],
  closes: ['door-close'],
  typing: ['typing'],
  writing: ['paper-rustle'],
  fight: ['punch', 'cloth-movement'],
  punch: ['punch'],
  explosion: ['explosion'],
  car: ['car-engine'],
  driving: ['car-engine'],
  phone: ['phone-ring'],
  call: ['phone-ring'],
  glass: ['glass-break'],
  break: ['glass-break'],
  sit: ['cloth-movement'],
  stand: ['cloth-movement'],
};

// Generate SFX prompt for AI-based sound generation
export function buildSFXPrompt(category: SFXCategory, type: string, context: string): string {
  const categoryDescriptions: Record<SFXCategory, string> = {
    ambient: 'Continuous background ambiance',
    foley: 'Realistic everyday sound effect',
    action: 'Dynamic action sound effect',
    impact: 'Impactful collision or hit sound',
    whoosh: 'Movement or transition whoosh',
    ui: 'User interface sound',
    nature: 'Natural environmental sound',
    urban: 'City and urban environment sound',
    scifi: 'Science fiction futuristic sound',
    horror: 'Creepy unsettling sound',
    comedy: 'Comedic cartoon-style sound',
    transition: 'Scene transition sound effect',
  };
  
  return `${categoryDescriptions[category]}: ${type}. Context: ${context}. High quality, professional audio.`;
}

// Calculate SFX volume based on scene intensity and dialogue presence
export function calculateSFXVolume(
  baseVolume: number,
  hasDialogue: boolean,
  sceneIntensity: number,
  category: SFXCategory
): number {
  let volume = baseVolume;
  
  // Duck SFX when dialogue is present
  if (hasDialogue) {
    volume *= 0.4; // Reduce to 40%
  }
  
  // Adjust based on intensity
  if (category === 'action' || category === 'impact') {
    volume *= 0.7 + (sceneIntensity * 0.3);
  }
  
  // Ambient should be subtle
  if (category === 'ambient') {
    volume *= 0.5;
  }
  
  return Math.min(1, Math.max(0, volume));
}
