/**
 * PRIORITY MARKERS SYSTEM
 * 
 * Adds priority markers to prompts to ensure AI focuses on critical elements first.
 * Uses a 3-tier system: CRITICAL > IMPORTANT > STANDARD
 */

export type PriorityLevel = 'critical' | 'important' | 'standard';

export interface PriorityMarker {
  level: PriorityLevel;
  category: string;
  content: string;
}

export interface PrioritizedPrompt {
  prompt: string;
  markerCount: {
    critical: number;
    important: number;
    standard: number;
  };
}

// Priority marker templates
const PRIORITY_TEMPLATES = {
  critical: '🔴 [CRITICAL - MUST MAINTAIN]',
  important: '🟡 [IMPORTANT - STRONGLY PREFERRED]',
  standard: '🟢 [STANDARD]',
};

// Weight multipliers for prompt ordering
const PRIORITY_WEIGHTS: Record<PriorityLevel, number> = {
  critical: 3,
  important: 2,
  standard: 1,
};

/**
 * Auto-detect priority level based on content keywords
 */
function detectPriorityLevel(content: string): PriorityLevel {
  const lowerContent = content.toLowerCase();
  
  // Critical: Identity, face, character core
  if (
    lowerContent.includes('identity') ||
    lowerContent.includes('face') ||
    lowerContent.includes('character') ||
    lowerContent.includes('person') ||
    lowerContent.includes('same exact') ||
    lowerContent.includes('must match') ||
    lowerContent.includes('locked')
  ) {
    return 'critical';
  }
  
  // Important: Clothing, colors, lighting
  if (
    lowerContent.includes('clothing') ||
    lowerContent.includes('outfit') ||
    lowerContent.includes('color') ||
    lowerContent.includes('lighting') ||
    lowerContent.includes('hair') ||
    lowerContent.includes('temperature')
  ) {
    return 'important';
  }
  
  // Standard: Everything else
  return 'standard';
}

/**
 * Create a priority marker
 */
export function createMarker(
  content: string,
  category: string,
  level?: PriorityLevel
): PriorityMarker {
  return {
    level: level || detectPriorityLevel(content),
    category,
    content,
  };
}

/**
 * Format a marker for injection into prompt
 */
export function formatMarker(marker: PriorityMarker): string {
  const prefix = PRIORITY_TEMPLATES[marker.level];
  return `${prefix} ${marker.category}: ${marker.content}`;
}

/**
 * Sort markers by priority (highest first)
 */
export function sortByPriority(markers: PriorityMarker[]): PriorityMarker[] {
  return [...markers].sort((a, b) => {
    return PRIORITY_WEIGHTS[b.level] - PRIORITY_WEIGHTS[a.level];
  });
}

/**
 * Build prioritized prompt from markers
 */
export function buildPrioritizedPrompt(
  basePrompt: string,
  markers: PriorityMarker[]
): PrioritizedPrompt {
  const sorted = sortByPriority(markers);
  
  const markerCount = {
    critical: markers.filter(m => m.level === 'critical').length,
    important: markers.filter(m => m.level === 'important').length,
    standard: markers.filter(m => m.level === 'standard').length,
  };
  
  // Group by level
  const criticalMarkers = sorted.filter(m => m.level === 'critical');
  const importantMarkers = sorted.filter(m => m.level === 'important');
  const standardMarkers = sorted.filter(m => m.level === 'standard');
  
  const parts: string[] = [];
  
  // Critical section
  if (criticalMarkers.length > 0) {
    parts.push('╔══════════════════════════════════════════════════╗');
    parts.push('║        🔴 CRITICAL REQUIREMENTS (MANDATORY)       ║');
    parts.push('╚══════════════════════════════════════════════════╝');
    criticalMarkers.forEach(m => parts.push(formatMarker(m)));
    parts.push('');
  }
  
  // Important section
  if (importantMarkers.length > 0) {
    parts.push('═══════════ 🟡 IMPORTANT (STRONGLY PREFERRED) ═══════════');
    importantMarkers.forEach(m => parts.push(formatMarker(m)));
    parts.push('');
  }
  
  // Standard section
  if (standardMarkers.length > 0) {
    parts.push('─────────── 🟢 STANDARD GUIDELINES ───────────');
    standardMarkers.forEach(m => parts.push(formatMarker(m)));
    parts.push('');
  }
  
  // Base prompt
  parts.push('═══════════════ SCENE ═══════════════');
  parts.push(basePrompt);
  
  return {
    prompt: parts.join('\n'),
    markerCount,
  };
}

/**
 * Extract priority markers from identity bible
 */
export function extractIdentityMarkers(identityBible: any): PriorityMarker[] {
  const markers: PriorityMarker[] = [];
  
  if (!identityBible) return markers;
  
  // Character description (CRITICAL)
  if (identityBible.characterDescription) {
    markers.push(createMarker(
      identityBible.characterDescription,
      'CHARACTER IDENTITY',
      'critical'
    ));
  }
  
  // Face features (CRITICAL)
  if (identityBible.characterIdentity?.facialFeatures) {
    markers.push(createMarker(
      identityBible.characterIdentity.facialFeatures,
      'FACIAL FEATURES',
      'critical'
    ));
  }
  
  // Body type (IMPORTANT)
  if (identityBible.characterIdentity?.bodyType) {
    markers.push(createMarker(
      identityBible.characterIdentity.bodyType,
      'BODY TYPE',
      'important'
    ));
  }
  
  // Clothing (IMPORTANT)
  if (identityBible.characterIdentity?.clothing) {
    markers.push(createMarker(
      identityBible.characterIdentity.clothing,
      'CLOTHING',
      'important'
    ));
  }
  
  // Consistency anchors (CRITICAL)
  if (identityBible.consistencyAnchors?.length) {
    markers.push(createMarker(
      identityBible.consistencyAnchors.join(', '),
      'VISUAL ANCHORS',
      'critical'
    ));
  }
  
  // Non-facial anchors (IMPORTANT)
  if (identityBible.nonFacialAnchors) {
    const nfa = identityBible.nonFacialAnchors;
    
    if (nfa.hairColor) {
      markers.push(createMarker(nfa.hairColor, 'HAIR COLOR', 'important'));
    }
    if (nfa.clothingColors?.length) {
      markers.push(createMarker(
        nfa.clothingColors.join(', '),
        'CLOTHING COLORS',
        'important'
      ));
    }
    if (nfa.silhouetteDescription) {
      markers.push(createMarker(
        nfa.silhouetteDescription,
        'SILHOUETTE',
        'important'
      ));
    }
  }
  
  return markers;
}

/**
 * Extract priority markers from scene anchor
 */
export function extractSceneMarkers(sceneAnchor: any): PriorityMarker[] {
  const markers: PriorityMarker[] = [];
  
  if (!sceneAnchor) return markers;
  
  // Lighting (IMPORTANT)
  if (sceneAnchor.lighting?.promptFragment) {
    markers.push(createMarker(
      sceneAnchor.lighting.promptFragment,
      'LIGHTING',
      'important'
    ));
  }
  
  // Color palette (IMPORTANT)
  if (sceneAnchor.colorPalette?.promptFragment) {
    markers.push(createMarker(
      sceneAnchor.colorPalette.promptFragment,
      'COLOR PALETTE',
      'important'
    ));
  }
  
  // Environment (STANDARD)
  if (sceneAnchor.keyObjects?.promptFragment) {
    markers.push(createMarker(
      sceneAnchor.keyObjects.promptFragment,
      'ENVIRONMENT',
      'standard'
    ));
  }
  
  // Master consistency (CRITICAL)
  if (sceneAnchor.masterConsistencyPrompt) {
    markers.push(createMarker(
      sceneAnchor.masterConsistencyPrompt,
      'MASTER VISUAL DNA',
      'critical'
    ));
  }
  
  return markers;
}

/**
 * Extract priority markers from continuity manifest
 */
export function extractContinuityMarkers(manifest: any): PriorityMarker[] {
  const markers: PriorityMarker[] = [];
  
  if (!manifest) return markers;
  
  // Critical anchors (CRITICAL)
  if (manifest.criticalAnchors?.length) {
    manifest.criticalAnchors.forEach((anchor: string) => {
      markers.push(createMarker(anchor, 'CRITICAL ANCHOR', 'critical'));
    });
  }
  
  // Spatial continuity (IMPORTANT)
  if (manifest.spatial?.primaryCharacter) {
    const pos = manifest.spatial.primaryCharacter;
    markers.push(createMarker(
      `${pos.screenPosition}, ${pos.depth}, facing ${pos.facingDirection}`,
      'SPATIAL POSITION',
      'important'
    ));
  }
  
  // Props (IMPORTANT)
  if (manifest.props?.characterProps?.length > 0) {
    const props = manifest.props.characterProps
      .flatMap((cp: any) => cp.props?.map((p: any) => p.name))
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    if (props) {
      markers.push(createMarker(props, 'PROPS', 'important'));
    }
  }
  
  // Action momentum (STANDARD)
  if (manifest.action?.movementType && manifest.action.movementType !== 'still') {
    markers.push(createMarker(
      `${manifest.action.movementType} ${manifest.action.movementDirection}`,
      'ACTION',
      'standard'
    ));
  }
  
  return markers;
}
