// Multi-Character Identity Bible Types
// Support for 2-5 characters with separate 3-point reference systems

export interface CharacterView {
  viewType: 'front' | 'side' | 'three-quarter';
  imageUrl: string;
  generatedAt: number;
}

export interface CharacterIdentity {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'background';
  
  // Source reference (from user upload or script extraction)
  sourceImageUrl?: string;
  extractedFromScript: boolean;
  
  // 3-Point Reference System
  views: {
    front?: CharacterView;
    side?: CharacterView;
    threeQuarter?: CharacterView;
  };
  viewsComplete: boolean;
  
  // Detailed appearance anchors
  appearance: {
    // Physical features
    ageRange: string;
    gender: string;
    ethnicity?: string;
    bodyType: string;
    height: string;
    
    // Face
    faceShape: string;
    eyeColor: string;
    eyeShape: string;
    noseType: string;
    lipShape: string;
    skinTone: string;
    
    // Hair
    hairColor: string;
    hairLength: string;
    hairStyle: string;
    hairTexture: string;
    facialHair?: string;
    
    // Distinctive markers
    distinctiveFeatures: string[];
    scars?: string[];
    tattoos?: string[];
    birthmarks?: string[];
  };
  
  // Clothing and accessories
  wardrobe: {
    primaryOutfit: string;
    colors: string[];
    accessories: string[];
    style: string;
  };
  
  // AI prompt fragments for consistency
  consistencyPrompt: string;
  negativePrompt: string;
  
  // Relationship to other characters
  relationships: {
    characterId: string;
    relationship: string;
  }[];
  
  // Generation metadata
  confidence: number; // 0-100 extraction confidence
  generatedAt: number;
  lastUpdated: number;
}

// Per-shot character presence mapping
export interface ShotCharacterPresence {
  shotId: string;
  characters: {
    characterId: string;
    characterName: string;
    
    // Presence details
    isVisible: boolean;
    screenPosition: 'left' | 'center' | 'right' | 'background';
    screenSize: 'full-body' | 'medium' | 'close-up' | 'extreme-close-up';
    facingDirection: 'camera' | 'left' | 'right' | 'away';
    
    // Interaction
    isSpeaking: boolean;
    interactingWith?: string[]; // Other character IDs
    action: string;
    emotion: string;
    
    // Costume changes
    wardrobeOverride?: string;
  }[];
}

// Complete Multi-Character Identity Bible
export interface MultiCharacterBible {
  projectId: string;
  
  // All characters (2-5)
  characters: CharacterIdentity[];
  maxCharacters: 5;
  
  // Per-shot character mapping
  shotPresence: ShotCharacterPresence[];
  
  // Character relationship graph
  relationshipGraph: {
    characterId1: string;
    characterId2: string;
    relationship: string;
    interactionStyle: string;
  }[];
  
  // Global consistency anchors
  globalStyle: {
    artStyle: string;
    lightingConsistency: string;
    colorPalette: string[];
  };
  
  // Generation status
  status: 'extracting' | 'generating-views' | 'complete' | 'failed';
  progress: number;
  error?: string;
  
  createdAt: number;
  updatedAt: number;
}

// Request to generate multi-character bible
export interface GenerateMultiCharacterBibleRequest {
  projectId: string;
  
  // Option 1: Extract from script
  script?: string;
  
  // Option 2: Provide reference images per character
  characterReferences?: {
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'background';
    imageUrl: string;
  }[];
  
  // Option 3: Provide descriptions
  characterDescriptions?: {
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'background';
    description: string;
  }[];
  
  // Global style preferences
  artStyle?: string;
  generate3PointViews: boolean;
}

// Result from generation
export interface GenerateMultiCharacterBibleResult {
  success: boolean;
  bible?: MultiCharacterBible;
  error?: string;
  processingTimeMs: number;
}

// Helper to build per-shot character prompt
export function buildCharacterPromptForShot(
  bible: MultiCharacterBible,
  shotId: string
): string {
  const presence = bible.shotPresence.find(p => p.shotId === shotId);
  if (!presence || presence.characters.length === 0) {
    return '';
  }
  
  const prompts = presence.characters
    .filter(c => c.isVisible)
    .map(charPresence => {
      const character = bible.characters.find(c => c.id === charPresence.characterId);
      if (!character) return '';
      
      const position = `${charPresence.characterName} (${charPresence.screenPosition}, ${charPresence.screenSize})`;
      const action = `${charPresence.action}, ${charPresence.emotion} expression`;
      const consistency = character.consistencyPrompt;
      
      return `${position}: ${action}. ${consistency}`;
    })
    .filter(Boolean);
  
  return prompts.join('. ');
}

// Helper to get character negative prompts
export function buildCharacterNegativePrompt(
  bible: MultiCharacterBible,
  shotId: string
): string {
  const presence = bible.shotPresence.find(p => p.shotId === shotId);
  if (!presence) return '';
  
  const negatives = presence.characters
    .filter(c => c.isVisible)
    .map(charPresence => {
      const character = bible.characters.find(c => c.id === charPresence.characterId);
      return character?.negativePrompt || '';
    })
    .filter(Boolean);
  
  // Add cross-character consistency negatives
  negatives.push(
    'inconsistent character appearance',
    'character morphing',
    'wrong number of characters',
    'character duplication',
    'mismatched clothing',
    'wrong hair color',
    'wrong eye color'
  );
  
  return [...new Set(negatives)].join(', ');
}
