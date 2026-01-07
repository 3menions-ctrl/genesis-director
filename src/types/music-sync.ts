// Music Synchronization Engine Types
// Automatically syncs background music with scene transitions and emotional beats

export type MusicMood = 
  | 'epic' | 'tension' | 'emotional' | 'action' 
  | 'mysterious' | 'uplifting' | 'dark' | 'romantic' 
  | 'adventure' | 'scifi' | 'peaceful' | 'dramatic';

export type BeatType = 
  | 'downbeat' | 'upbeat' | 'transition' 
  | 'climax' | 'resolution' | 'build' | 'drop';

export interface EmotionalBeat {
  timestamp: number; // in seconds
  type: BeatType;
  intensity: number; // 0-1
  mood: MusicMood;
  description: string;
}

export interface SceneTransition {
  fromShotId: string;
  toShotId: string;
  transitionTime: number; // in seconds
  transitionType: 'cut' | 'fade' | 'dissolve' | 'wipe';
  emotionalShift: {
    fromMood: MusicMood;
    toMood: MusicMood;
    intensity: number;
  };
}

export interface MusicCue {
  id: string;
  startTime: number; // in seconds
  endTime: number;
  mood: MusicMood;
  intensity: number; // 0-1
  tempo: 'slow' | 'moderate' | 'fast';
  instrumentation: string[];
  dynamicMarking: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
  transitionIn: 'fade' | 'cut' | 'swell';
  transitionOut: 'fade' | 'cut' | 'diminuendo';
}

export interface MusicSyncPlan {
  projectId: string;
  totalDuration: number;
  
  // Scene analysis
  scenes: {
    shotId: string;
    startTime: number;
    endTime: number;
    mood: MusicMood;
    dialoguePresent: boolean;
    actionIntensity: number;
  }[];
  
  // Detected beats
  emotionalBeats: EmotionalBeat[];
  
  // Scene transitions
  transitions: SceneTransition[];
  
  // Music cues to generate
  musicCues: MusicCue[];
  
  // Generated music prompt
  unifiedMusicPrompt: string;
  
  // Timing markers for audio mixing
  timingMarkers: {
    timestamp: number;
    type: 'duck' | 'swell' | 'accent' | 'pause';
    duration: number;
    intensity: number;
  }[];
  
  // Mixing instructions
  mixingInstructions: {
    baseVolume: number; // 0-1
    duckingForDialogue: boolean;
    duckingAmount: number; // 0-1, how much to reduce during dialogue
    fadeInDuration: number;
    fadeOutDuration: number;
  };
}

export interface MusicSyncRequest {
  projectId: string;
  shots: {
    id: string;
    description: string;
    dialogue?: string;
    durationSeconds: number;
    mood?: string;
  }[];
  totalDuration: number;
  overallMood?: MusicMood;
  genre?: string;
  tempoPreference?: 'slow' | 'moderate' | 'fast' | 'dynamic';
  includeDialogueDucking?: boolean;
}

export interface MusicSyncResult {
  success: boolean;
  plan?: MusicSyncPlan;
  musicPrompt?: string;
  error?: string;
}

// Music generation prompt templates
export const MOOD_MUSIC_TEMPLATES: Record<MusicMood, string> = {
  epic: 'Epic orchestral score with powerful brass fanfares, soaring strings, and thundering timpani. Hans Zimmer style.',
  tension: 'Suspenseful underscore with low pulsing synths, staccato strings, and building anxiety. Psychological thriller.',
  emotional: 'Heartfelt piano melody with gentle strings, soft dynamics. Oscar-worthy emotional drama.',
  action: 'High-octane action score with driving percussion, aggressive brass, and relentless energy.',
  mysterious: 'Ethereal pads, subtle textures, and enigmatic motifs. Mystery and intrigue.',
  uplifting: 'Inspirational orchestral crescendo with hopeful piano and triumphant brass.',
  dark: 'Ominous low drones, dissonant harmonies, and foreboding atmosphere. Horror adjacent.',
  romantic: 'Lush romantic strings, tender piano phrases, and sweeping melodic lines.',
  adventure: 'Bold adventure theme with heroic brass, energetic strings, and exciting rhythms.',
  scifi: 'Futuristic electronic soundscape with synthesizers, digital textures, and otherworldly tones.',
  peaceful: 'Serene ambient score with gentle piano, soft pads, and tranquil atmosphere.',
  dramatic: 'Intense dramatic score with dynamic contrasts, powerful crescendos, and emotional depth.',
};

// Tempo mappings in BPM ranges
export const TEMPO_RANGES: Record<string, { min: number; max: number }> = {
  slow: { min: 60, max: 80 },
  moderate: { min: 90, max: 120 },
  fast: { min: 130, max: 160 },
};

// Instrumentation suggestions by mood
export const MOOD_INSTRUMENTS: Record<MusicMood, string[]> = {
  epic: ['orchestra', 'brass', 'timpani', 'choir', 'strings'],
  tension: ['strings', 'synth', 'percussion', 'piano'],
  emotional: ['piano', 'strings', 'cello', 'violin'],
  action: ['orchestra', 'percussion', 'brass', 'synth'],
  mysterious: ['pads', 'harp', 'woodwinds', 'celesta'],
  uplifting: ['orchestra', 'piano', 'brass', 'percussion'],
  dark: ['low strings', 'bass', 'synth drones', 'percussion'],
  romantic: ['strings', 'piano', 'harp', 'flute'],
  adventure: ['orchestra', 'brass', 'percussion', 'strings'],
  scifi: ['synthesizer', 'electronic', 'pads', 'bass'],
  peaceful: ['piano', 'ambient pads', 'guitar', 'flute'],
  dramatic: ['orchestra', 'piano', 'strings', 'brass'],
};
