/**
 * Lip Sync Engine Types
 * Synchronizes character mouth movements with voice audio
 */

// Standard viseme set for mouth shapes
export type Viseme = 
  | 'sil'      // Silence - closed mouth
  | 'PP'       // P, B, M sounds
  | 'FF'       // F, V sounds
  | 'TH'       // Th sounds
  | 'DD'       // T, D, N, L sounds
  | 'kk'       // K, G sounds
  | 'CH'       // Ch, J, Sh sounds
  | 'SS'       // S, Z sounds
  | 'nn'       // N, NG sounds
  | 'RR'       // R sound
  | 'aa'       // A sound (open mouth)
  | 'E'        // E sound
  | 'I'        // I sound
  | 'O'        // O sound (rounded)
  | 'U';       // U sound (pursed)

// Timing marker for a viseme
export interface VisemeTiming {
  viseme: Viseme;
  startTime: number;    // In seconds
  endTime: number;      // In seconds
  confidence: number;   // 0-1 confidence score
  phoneme?: string;     // Original phoneme if available
}

// Word-level timing for subtitle sync
export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  visemes: VisemeTiming[];
}

// Character speaking segment
export interface SpeakingSegment {
  characterId: string;
  characterName: string;
  dialogue: string;
  startTime: number;
  endTime: number;
  words: WordTiming[];
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'fearful';
}

// Lip sync analysis for a shot
export interface ShotLipSyncData {
  shotId: string;
  hasDialogue: boolean;
  speakingSegments: SpeakingSegment[];
  totalDuration: number;
  dominantSpeaker?: string;
  lipSyncPromptEnhancement: string;
}

// Mouth shape descriptors for AI prompt generation
export const VISEME_DESCRIPTIONS: Record<Viseme, string> = {
  'sil': 'closed relaxed mouth',
  'PP': 'lips pressed together then released',
  'FF': 'lower lip tucked under upper teeth',
  'TH': 'tongue slightly visible between teeth',
  'DD': 'tongue touching upper palate, mouth slightly open',
  'kk': 'back of tongue raised, mouth slightly open',
  'CH': 'lips rounded and pushed forward',
  'SS': 'teeth together, lips slightly parted',
  'nn': 'mouth slightly open, tongue at roof',
  'RR': 'lips slightly rounded, tongue curved',
  'aa': 'mouth wide open, jaw dropped',
  'E': 'mouth medium open, lips stretched wide',
  'I': 'mouth slightly open, lips stretched in smile',
  'O': 'lips rounded into circle',
  'U': 'lips pursed and pushed forward'
};

// Emotion-based mouth modifiers
export const EMOTION_MODIFIERS: Record<string, string> = {
  'neutral': 'natural relaxed expression',
  'happy': 'slight smile, upturned corners',
  'sad': 'downturned corners, slightly compressed',
  'angry': 'tight lips, tense jaw',
  'surprised': 'mouth slightly open, raised eyebrows',
  'fearful': 'lips pulled back, tense expression'
};

// Request to analyze audio for lip sync
export interface LipSyncAnalysisRequest {
  audioUrl?: string;
  audioBase64?: string;
  dialogue: string;
  characterId: string;
  characterName: string;
  shotId: string;
  emotion?: string;
}

// Result from lip sync analysis
export interface LipSyncAnalysisResult {
  success: boolean;
  data?: ShotLipSyncData;
  error?: string;
}

// Generate lip sync prompt enhancement based on viseme sequence
export function generateLipSyncPrompt(
  segments: SpeakingSegment[],
  shotDuration: number
): string {
  if (segments.length === 0) {
    return '';
  }

  const prompts: string[] = [];
  
  for (const segment of segments) {
    const { characterName, emotion, words } = segment;
    
    // Get dominant visemes for the segment
    const dominantVisemes = getDominantVisemes(words);
    const visemeDescriptions = dominantVisemes
      .map(v => VISEME_DESCRIPTIONS[v])
      .join(', ');
    
    const emotionMod = emotion ? EMOTION_MODIFIERS[emotion] : EMOTION_MODIFIERS['neutral'];
    
    prompts.push(
      `${characterName} speaking with ${emotionMod}, ` +
      `mouth movements showing ${visemeDescriptions}, ` +
      `lips synchronized to dialogue with natural articulation`
    );
  }
  
  return prompts.join('. ') + '. Ensure realistic mouth movements throughout speech.';
}

// Get the most common visemes in a word sequence
function getDominantVisemes(words: WordTiming[]): Viseme[] {
  const visemeCounts = new Map<Viseme, number>();
  
  for (const word of words) {
    for (const timing of word.visemes) {
      const count = visemeCounts.get(timing.viseme) || 0;
      visemeCounts.set(timing.viseme, count + 1);
    }
  }
  
  // Get top 3-4 visemes
  return Array.from(visemeCounts.entries())
    .filter(([v]) => v !== 'sil') // Exclude silence
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([viseme]) => viseme);
}

// Phoneme to Viseme mapping
export const PHONEME_TO_VISEME: Record<string, Viseme> = {
  // Silence
  'SIL': 'sil', 'sp': 'sil', 'spn': 'sil',
  
  // Bilabials (P, B, M)
  'P': 'PP', 'B': 'PP', 'M': 'PP',
  
  // Labiodentals (F, V)
  'F': 'FF', 'V': 'FF',
  
  // Dentals (TH)
  'TH': 'TH', 'DH': 'TH',
  
  // Alveolars (T, D, N, L)
  'T': 'DD', 'D': 'DD', 'N': 'DD', 'L': 'DD',
  
  // Velars (K, G)
  'K': 'kk', 'G': 'kk', 'NG': 'nn',
  
  // Affricates/Fricatives (CH, J, SH)
  'CH': 'CH', 'JH': 'CH', 'SH': 'CH', 'ZH': 'CH',
  
  // Sibilants (S, Z)
  'S': 'SS', 'Z': 'SS',
  
  // R sound
  'R': 'RR', 'ER': 'RR',
  
  // Vowels
  'AA': 'aa', 'AE': 'aa', 'AH': 'aa', 'AO': 'O',
  'AW': 'O', 'AY': 'aa', 'EH': 'E', 'EY': 'E',
  'IH': 'I', 'IY': 'I', 'OW': 'O', 'OY': 'O',
  'UH': 'U', 'UW': 'U', 'Y': 'I', 'W': 'U',
  'HH': 'aa'
};

// Simple text-to-phoneme estimation (for when audio analysis isn't available)
export function estimateVisemesFromText(text: string): VisemeTiming[] {
  const words = text.toLowerCase().split(/\s+/);
  const visemes: VisemeTiming[] = [];
  let currentTime = 0;
  const avgWordDuration = 0.4; // Average word duration in seconds
  
  for (const word of words) {
    const chars = word.replace(/[^a-z]/g, '').split('');
    const charDuration = avgWordDuration / Math.max(chars.length, 1);
    
    for (const char of chars) {
      const viseme = mapCharToViseme(char);
      visemes.push({
        viseme,
        startTime: currentTime,
        endTime: currentTime + charDuration,
        confidence: 0.7
      });
      currentTime += charDuration;
    }
    
    // Add small pause between words
    visemes.push({
      viseme: 'sil',
      startTime: currentTime,
      endTime: currentTime + 0.1,
      confidence: 1.0
    });
    currentTime += 0.1;
  }
  
  return visemes;
}

// Map individual character to approximate viseme
function mapCharToViseme(char: string): Viseme {
  const mapping: Record<string, Viseme> = {
    'a': 'aa', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
    'b': 'PP', 'p': 'PP', 'm': 'PP',
    'f': 'FF', 'v': 'FF',
    't': 'DD', 'd': 'DD', 'n': 'DD', 'l': 'DD',
    'k': 'kk', 'g': 'kk',
    'c': 'kk', 'q': 'kk',
    's': 'SS', 'z': 'SS', 'x': 'SS',
    'r': 'RR',
    'w': 'U', 'y': 'I',
    'h': 'aa', 'j': 'CH'
  };
  
  return mapping[char] || 'sil';
}
