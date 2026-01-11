// Spatial-Action Consistency System Types
// Maintains relative positions and continuous actions between characters in multi-character scenes

/**
 * Problem this solves:
 * - "Lion following gazelle" results in "lion passing gazelle"
 * - Characters swap positions between clips
 * - Chase/pursuit relationships break
 * - Relative distances change randomly
 */

// Screen position constants
export type ScreenZone = 'far-left' | 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'far-right';
export type DepthZone = 'extreme-foreground' | 'foreground' | 'mid-ground' | 'background' | 'far-background';

// Continuous action states (vs. momentary actions)
export type ActionState = 
  | 'pursuing' | 'fleeing' | 'following' | 'leading'
  | 'chasing' | 'escaping' | 'stalking' | 'hiding'
  | 'approaching' | 'retreating' | 'circling' | 'flanking'
  | 'standing' | 'sitting' | 'walking' | 'running'
  | 'fighting' | 'embracing' | 'conversing' | 'observing';

// Relative spatial relationship between two characters
export interface SpatialRelationship {
  character1Id: string;
  character2Id: string;
  
  // Position locks
  relativePosition: 'ahead' | 'behind' | 'left-of' | 'right-of' | 'above' | 'below' | 'beside';
  distanceCategory: 'touching' | 'close' | 'medium' | 'far' | 'distant';
  mustMaintain: boolean; // If true, this relationship must persist across clips
  
  // Motion relationship
  motionRelationship: 'same-direction' | 'opposite-direction' | 'converging' | 'diverging' | 'orbiting' | 'stationary';
  relativeSpeed: 'slower' | 'same' | 'faster';
  
  // Action relationship
  character1Action: ActionState;
  character2Action: ActionState;
  
  // Prompt fragments for enforcement
  enforcementPrompt: string;
  negativePrompt: string;
}

// Character spatial anchor for a specific shot
export interface CharacterSpatialAnchor {
  characterId: string;
  characterName: string;
  
  // Absolute position
  screenZone: ScreenZone;
  depthZone: DepthZone;
  
  // Motion state
  movingDirection: 'left' | 'right' | 'toward-camera' | 'away-from-camera' | 'up' | 'down' | 'stationary';
  movingSpeed: 'stationary' | 'slow' | 'medium' | 'fast' | 'sprint';
  
  // Current continuous action
  actionState: ActionState;
  actionTarget?: string; // ID of character they're acting toward
  
  // Visual consistency
  facingDirection: 'camera' | 'left' | 'right' | 'away' | 'up' | 'down';
  bodyOrientation: number; // degrees from camera-facing (0 = facing camera, 180 = back to camera)
  
  // Lock flags
  positionLocked: boolean; // Maintain this screen position
  depthLocked: boolean; // Maintain this depth
  actionLocked: boolean; // Maintain this action state
}

// Multi-character shot spatial plan
export interface ShotSpatialPlan {
  shotId: string;
  clipIndex: number;
  
  // All characters in this shot
  characters: CharacterSpatialAnchor[];
  
  // All relationships to enforce
  relationships: SpatialRelationship[];
  
  // Derived prompt fragments
  spatialPrompt: string; // Injected before main prompt
  spatialNegatives: string[]; // Added to negative prompts
  
  // Continuity from previous shot
  continuityFromPrevious: {
    maintainedRelationships: string[]; // IDs of relationships that must continue
    positionDriftsAllowed: boolean;
    actionTransitions: { characterId: string; from: ActionState; to: ActionState }[];
  };
}

// Action phase continuity for chase/pursuit scenes
export interface ActionPhaseLock {
  actionType: 'chase' | 'pursuit' | 'escape' | 'fight' | 'dance' | 'conversation';
  
  // Characters involved
  pursuer?: string;
  target?: string;
  participants?: string[];
  
  // State that must be maintained
  pursuerPosition: 'behind' | 'left-behind' | 'right-behind';
  targetPosition: 'ahead' | 'left-ahead' | 'right-ahead';
  distanceState: 'gaining' | 'maintaining' | 'losing';
  
  // What would break this action
  breakingConditions: string[];
  
  // Enforcement prompts
  enforcementPrompt: string;
  breakingNegatives: string[];
}

// Build spatial prompt for multi-character scene
export function buildSpatialEnforcementPrompt(plan: ShotSpatialPlan): string {
  const parts: string[] = ['[SPATIAL LOCKS - MANDATORY]'];
  
  // Character positions
  for (const char of plan.characters) {
    const positionDesc = `${char.characterName}: ${char.screenZone} of frame, ${char.depthZone}`;
    const motionDesc = char.movingSpeed !== 'stationary' 
      ? `, moving ${char.movingDirection} at ${char.movingSpeed} speed`
      : ', stationary';
    const actionDesc = char.actionTarget 
      ? `, ${char.actionState} toward ${char.actionTarget}`
      : `, ${char.actionState}`;
    
    parts.push(`${positionDesc}${motionDesc}${actionDesc}`);
  }
  
  // Relationships
  if (plan.relationships.length > 0) {
    parts.push('[RELATIVE POSITIONS]');
    for (const rel of plan.relationships) {
      parts.push(rel.enforcementPrompt);
    }
  }
  
  return parts.join('. ');
}

// Build negative prompts for spatial violations
export function buildSpatialNegatives(plan: ShotSpatialPlan): string[] {
  const negatives: string[] = [];
  
  for (const rel of plan.relationships) {
    if (rel.negativePrompt) {
      negatives.push(rel.negativePrompt);
    }
    
    // Add opposites of current relationship
    if (rel.relativePosition === 'behind') {
      negatives.push(`${rel.character1Id} ahead of ${rel.character2Id}`);
      negatives.push(`${rel.character1Id} passing ${rel.character2Id}`);
      negatives.push(`${rel.character1Id} overtaking ${rel.character2Id}`);
    }
    if (rel.relativePosition === 'ahead') {
      negatives.push(`${rel.character1Id} behind ${rel.character2Id}`);
      negatives.push(`${rel.character2Id} passing ${rel.character1Id}`);
    }
  }
  
  // Generic spatial violation negatives
  negatives.push(
    'characters swapping positions',
    'wrong character order',
    'spatial relationship reversal',
    'pursuer becoming pursued',
    'leader becoming follower'
  );
  
  return [...new Set(negatives)];
}

// Parse action from prompt to detect continuous vs. momentary actions
export function parseActionFromPrompt(prompt: string): { action: ActionState; isContinuous: boolean; target?: string } {
  const continuousPatterns: { pattern: RegExp; action: ActionState; extractTarget?: boolean }[] = [
    { pattern: /(\w+)\s+(is\s+)?chasing\s+(?:the\s+)?(\w+)/i, action: 'chasing', extractTarget: true },
    { pattern: /(\w+)\s+(is\s+)?pursuing\s+(?:the\s+)?(\w+)/i, action: 'pursuing', extractTarget: true },
    { pattern: /(\w+)\s+(is\s+)?following\s+(?:the\s+)?(\w+)/i, action: 'following', extractTarget: true },
    { pattern: /(\w+)\s+(is\s+)?fleeing\s+from\s+(?:the\s+)?(\w+)/i, action: 'fleeing', extractTarget: true },
    { pattern: /(\w+)\s+(is\s+)?escaping\s+(?:the\s+)?(\w+)/i, action: 'escaping', extractTarget: true },
    { pattern: /(\w+)\s+(is\s+)?stalking\s+(?:the\s+)?(\w+)/i, action: 'stalking', extractTarget: true },
    { pattern: /(\w+)\s+(is\s+)?leading\s+(?:the\s+)?(\w+)/i, action: 'leading', extractTarget: true },
    { pattern: /chase\s+scene/i, action: 'chasing' },
    { pattern: /pursuit/i, action: 'pursuing' },
  ];
  
  for (const { pattern, action, extractTarget } of continuousPatterns) {
    const match = prompt.match(pattern);
    if (match) {
      return {
        action,
        isContinuous: true,
        target: extractTarget && match[3] ? match[3] : undefined,
      };
    }
  }
  
  return { action: 'standing', isContinuous: false };
}

// Build chase/pursuit specific enforcement
export function buildChaseEnforcement(
  pursuer: string,
  target: string,
  distanceState: 'gaining' | 'maintaining' | 'losing' = 'maintaining'
): ActionPhaseLock {
  const distanceDescriptions = {
    gaining: 'gradually closing the distance',
    maintaining: 'keeping consistent pursuit distance',
    losing: 'target pulling further ahead',
  };
  
  return {
    actionType: 'chase',
    pursuer,
    target,
    pursuerPosition: 'behind',
    targetPosition: 'ahead',
    distanceState,
    breakingConditions: [
      `${pursuer} overtakes ${target}`,
      `${pursuer} is ahead of ${target}`,
      `${target} is behind ${pursuer}`,
      'chase ends',
      'pursuit stops',
    ],
    enforcementPrompt: `[CHASE LOCK] ${pursuer} is BEHIND ${target}, ${distanceDescriptions[distanceState]}. ${target} is AHEAD fleeing. Pursuit continues - DO NOT let ${pursuer} catch or pass ${target}.`,
    breakingNegatives: [
      `${pursuer} catching ${target}`,
      `${pursuer} passing ${target}`,
      `${pursuer} ahead of ${target}`,
      `${target} behind ${pursuer}`,
      `${pursuer} beside ${target}`,
      'chase ending',
      'pursuit over',
      'catching up completely',
    ],
  };
}

// Request interface for spatial consistency
export interface SpatialConsistencyRequest {
  projectId: string;
  shots: {
    shotId: string;
    prompt: string;
    characters: string[];
  }[];
  
  // Known relationships to maintain
  persistentRelationships?: {
    character1: string;
    character2: string;
    relationship: 'pursuer-target' | 'leader-follower' | 'side-by-side' | 'facing-each-other';
  }[];
}

// Result with enhanced prompts
export interface SpatialConsistencyResult {
  success: boolean;
  enhancedShots: {
    shotId: string;
    originalPrompt: string;
    enhancedPrompt: string;
    spatialPlan: ShotSpatialPlan;
    negativePrompts: string[];
  }[];
  actionPhaseLocks: ActionPhaseLock[];
}
