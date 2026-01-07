// Depth Consistency System Types
// Maintains spatial relationships, object permanence, and perspective consistency

// ============================================
// SPATIAL RELATIONSHIP TRACKING
// ============================================

export interface SpatialPosition {
  x: number; // -1 (left) to 1 (right)
  y: number; // -1 (bottom) to 1 (top)
  z: number; // 0 (foreground) to 1 (background)
}

export interface SpatialObject {
  id: string;
  name: string;
  type: 'character' | 'prop' | 'vehicle' | 'structure' | 'environmental';
  
  // Position in 3D scene space
  position: SpatialPosition;
  
  // Size relative to frame
  relativeSize: 'tiny' | 'small' | 'medium' | 'large' | 'massive';
  screenCoverage: number; // 0-100 percentage of screen
  
  // Orientation
  facingDirection: 'camera' | 'left' | 'right' | 'away' | 'up' | 'down';
  rotation: number; // degrees from camera-facing
  
  // Visual properties
  occludedBy: string[]; // IDs of objects in front
  occluding: string[]; // IDs of objects behind
  
  // Persistence
  isPersistent: boolean; // Should appear across multiple shots
  lastSeenInShot: string;
  expectedInShots: string[];
}

export interface SpatialRelationship {
  object1Id: string;
  object2Id: string;
  relationship: 
    | 'left-of' | 'right-of' 
    | 'above' | 'below' 
    | 'in-front-of' | 'behind'
    | 'next-to' | 'overlapping'
    | 'inside' | 'surrounding'
    | 'attached-to' | 'holding';
  distance: 'touching' | 'close' | 'medium' | 'far';
  isFixed: boolean; // Relationship shouldn't change
}

// ============================================
// PERSPECTIVE SYSTEM
// ============================================

export interface PerspectiveConfig {
  type: 'one-point' | 'two-point' | 'three-point' | 'isometric' | 'aerial';
  
  // Vanishing points (normalized screen coordinates)
  vanishingPoints: {
    primary: { x: number; y: number } | null;
    secondary?: { x: number; y: number };
    tertiary?: { x: number; y: number };
  };
  
  // Camera properties
  cameraHeight: 'ground-level' | 'eye-level' | 'elevated' | 'birds-eye' | 'worms-eye';
  cameraAngle: number; // degrees from horizontal
  focalLength: 'wide' | 'normal' | 'telephoto';
  
  // Depth of field
  focalPlane: 'foreground' | 'midground' | 'background';
  depthOfField: 'shallow' | 'medium' | 'deep';
  
  // Horizon line
  horizonY: number; // 0-1 vertical position
}

export interface PerspectiveGrid {
  shotId: string;
  config: PerspectiveConfig;
  
  // Grid lines for consistency checking
  gridLines: {
    direction: 'horizontal' | 'vertical' | 'depth';
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
  }[];
  
  // Scale reference
  scaleReference: {
    objectName: string;
    knownSize: string; // e.g., "human height", "car length"
    screenHeight: number; // pixels or percentage
    distanceFromCamera: 'near' | 'mid' | 'far';
  } | null;
}

// ============================================
// OBJECT PERMANENCE
// ============================================

export interface PermanentObject {
  id: string;
  name: string;
  category: 'character' | 'prop' | 'vehicle' | 'landmark' | 'effect';
  
  // Visual signature for recognition
  visualSignature: {
    primaryColor: string;
    secondaryColors: string[];
    shape: string;
    texture: string;
    distinguishingFeatures: string[];
  };
  
  // Tracking across shots
  shotAppearances: {
    shotId: string;
    position: SpatialPosition;
    isVisible: boolean;
    isPartiallyVisible: boolean;
    entryDirection?: 'left' | 'right' | 'top' | 'bottom' | 'fade-in';
    exitDirection?: 'left' | 'right' | 'top' | 'bottom' | 'fade-out';
  }[];
  
  // Motion continuity
  lastKnownVelocity: {
    direction: string;
    speed: 'static' | 'slow' | 'medium' | 'fast';
  } | null;
  
  // State tracking
  currentState: string; // e.g., "intact", "damaged", "open", "lit"
  stateHistory: {
    shotId: string;
    state: string;
    trigger?: string;
  }[];
}

export interface ObjectContinuityViolation {
  objectId: string;
  objectName: string;
  violationType: 
    | 'position-jump' // Object teleported
    | 'size-inconsistency' // Object changed size
    | 'state-regression' // Object state went backwards (e.g., broken → intact)
    | 'impossible-entry' // Object appeared from wrong direction
    | 'missing-object' // Object should be visible but isn't
    | 'duplicate-object' // Object appears twice
    | 'wrong-perspective'; // Object doesn't match scene perspective
  severity: 'critical' | 'major' | 'minor';
  fromShot: string;
  toShot: string;
  description: string;
  suggestedFix: string;
}

// ============================================
// DEPTH MAP ANALYSIS
// ============================================

export interface DepthLayer {
  name: string;
  zRange: { min: number; max: number }; // 0 = camera, 1 = infinity
  objects: string[]; // Object IDs in this layer
  blur: number; // 0 = sharp, 1 = maximum blur
  atmosphericHaze: number; // 0 = none, 1 = heavy
  colorShift: string; // e.g., "blue shift for distance"
}

export interface DepthMap {
  shotId: string;
  layers: DepthLayer[];
  
  // Atmospheric perspective
  atmosphericPerspective: {
    enabled: boolean;
    nearColor: string;
    farColor: string;
    density: number;
  };
  
  // Parallax hints
  parallaxLayers: {
    layerName: string;
    movementSpeed: number; // relative to camera movement
  }[];
}

// ============================================
// SCENE CONSISTENCY STATE
// ============================================

export interface DepthConsistencyState {
  projectId: string;
  
  // All tracked objects
  objects: SpatialObject[];
  permanentObjects: PermanentObject[];
  
  // Relationships
  spatialRelationships: SpatialRelationship[];
  
  // Per-shot depth maps
  depthMaps: Map<string, DepthMap>;
  perspectiveGrids: Map<string, PerspectiveGrid>;
  
  // Violations detected
  violations: ObjectContinuityViolation[];
  
  // Global scene properties
  masterPerspective: PerspectiveConfig;
  masterScale: {
    referenceObject: string;
    realWorldSize: string;
  };
  
  // Consistency scores
  spatialConsistencyScore: number;
  objectPermanenceScore: number;
  perspectiveConsistencyScore: number;
  overallScore: number;
  
  analyzedAt: number;
}

// ============================================
// ANALYSIS REQUEST/RESPONSE
// ============================================

export interface DepthConsistencyRequest {
  projectId: string;
  shots: {
    id: string;
    frameUrl: string;
    description: string;
    previousShotId?: string;
  }[];
  knownObjects?: {
    name: string;
    type: 'character' | 'prop' | 'vehicle' | 'structure';
    isPersistent: boolean;
  }[];
  strictness: 'lenient' | 'normal' | 'strict';
}

export interface DepthConsistencyResult {
  success: boolean;
  state?: DepthConsistencyState;
  violations: ObjectContinuityViolation[];
  
  // Per-shot analysis
  shotAnalysis: {
    shotId: string;
    perspectiveConfig: PerspectiveConfig;
    depthLayers: DepthLayer[];
    objectsDetected: string[];
    issuesFound: number;
  }[];
  
  // Corrective prompts
  correctivePrompts: {
    shotId: string;
    originalPrompt: string;
    correctedPrompt: string;
    fixes: string[];
  }[];
  
  processingTimeMs: number;
  error?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function checkSpatialConsistency(
  prevShot: { objects: SpatialObject[]; relationships: SpatialRelationship[] },
  currShot: { objects: SpatialObject[]; relationships: SpatialRelationship[] }
): ObjectContinuityViolation[] {
  const violations: ObjectContinuityViolation[] = [];
  
  // Check for position jumps
  for (const currObj of currShot.objects) {
    const prevObj = prevShot.objects.find(o => o.id === currObj.id || o.name === currObj.name);
    
    if (prevObj && prevObj.isPersistent) {
      // Check for teleportation
      const distance = Math.sqrt(
        Math.pow(currObj.position.x - prevObj.position.x, 2) +
        Math.pow(currObj.position.y - prevObj.position.y, 2)
      );
      
      if (distance > 0.5) { // More than half screen movement
        violations.push({
          objectId: currObj.id,
          objectName: currObj.name,
          violationType: 'position-jump',
          severity: 'major',
          fromShot: prevObj.lastSeenInShot,
          toShot: currObj.lastSeenInShot,
          description: `${currObj.name} jumped from ${formatPosition(prevObj.position)} to ${formatPosition(currObj.position)}`,
          suggestedFix: `Add motion blur or transition showing ${currObj.name} moving between positions`,
        });
      }
      
      // Check for size inconsistency
      if (prevObj.relativeSize !== currObj.relativeSize && prevObj.position.z === currObj.position.z) {
        violations.push({
          objectId: currObj.id,
          objectName: currObj.name,
          violationType: 'size-inconsistency',
          severity: 'minor',
          fromShot: prevObj.lastSeenInShot,
          toShot: currObj.lastSeenInShot,
          description: `${currObj.name} changed size without distance change`,
          suggestedFix: `Maintain consistent ${prevObj.relativeSize} size for ${currObj.name}`,
        });
      }
    }
  }
  
  // Check for missing persistent objects
  for (const prevObj of prevShot.objects) {
    if (prevObj.isPersistent) {
      const stillPresent = currShot.objects.some(o => o.id === prevObj.id || o.name === prevObj.name);
      if (!stillPresent && prevObj.expectedInShots?.includes(currShot.objects[0]?.lastSeenInShot)) {
        violations.push({
          objectId: prevObj.id,
          objectName: prevObj.name,
          violationType: 'missing-object',
          severity: 'major',
          fromShot: prevObj.lastSeenInShot,
          toShot: currShot.objects[0]?.lastSeenInShot || 'unknown',
          description: `${prevObj.name} should be visible but is missing`,
          suggestedFix: `Include ${prevObj.name} in the scene at ${formatPosition(prevObj.position)}`,
        });
      }
    }
  }
  
  // Check relationship violations
  for (const prevRel of prevShot.relationships) {
    if (prevRel.isFixed) {
      const currRel = currShot.relationships.find(
        r => r.object1Id === prevRel.object1Id && r.object2Id === prevRel.object2Id
      );
      
      if (currRel && currRel.relationship !== prevRel.relationship) {
        violations.push({
          objectId: prevRel.object1Id,
          objectName: prevRel.object1Id, // Would need lookup
          violationType: 'position-jump',
          severity: 'minor',
          fromShot: 'previous',
          toShot: 'current',
          description: `Spatial relationship changed: was ${prevRel.relationship}, now ${currRel.relationship}`,
          suggestedFix: `Maintain ${prevRel.relationship} relationship between objects`,
        });
      }
    }
  }
  
  return violations;
}

function formatPosition(pos: SpatialPosition): string {
  const x = pos.x < -0.3 ? 'left' : pos.x > 0.3 ? 'right' : 'center';
  const y = pos.y < -0.3 ? 'bottom' : pos.y > 0.3 ? 'top' : 'middle';
  const z = pos.z < 0.3 ? 'foreground' : pos.z > 0.7 ? 'background' : 'midground';
  return `${x}-${y} ${z}`;
}

export function buildDepthConsistencyPrompt(
  depthMap: DepthMap,
  perspective: PerspectiveConfig,
  objects: SpatialObject[]
): string {
  const parts: string[] = [];
  
  // Perspective
  parts.push(`${perspective.type} perspective, camera at ${perspective.cameraHeight}`);
  if (perspective.horizonY < 0.4) {
    parts.push('low horizon line (looking up)');
  } else if (perspective.horizonY > 0.6) {
    parts.push('high horizon line (looking down)');
  }
  
  // Depth layers
  parts.push(`${depthMap.layers.length} distinct depth layers`);
  for (const layer of depthMap.layers) {
    if (layer.objects.length > 0) {
      parts.push(`${layer.name}: ${layer.objects.join(', ')}`);
    }
  }
  
  // Object positions
  for (const obj of objects.filter(o => o.isPersistent)) {
    const pos = formatPosition(obj.position);
    parts.push(`${obj.name} in ${pos}, ${obj.relativeSize} size, facing ${obj.facingDirection}`);
  }
  
  // Atmospheric perspective
  if (depthMap.atmosphericPerspective.enabled) {
    parts.push(`atmospheric perspective with ${depthMap.atmosphericPerspective.density > 0.5 ? 'heavy' : 'subtle'} haze`);
  }
  
  return parts.join('. ') + '.';
}

export function buildDepthNegativePrompt(violations: ObjectContinuityViolation[]): string {
  const negatives = new Set<string>();
  
  negatives.add('inconsistent object sizes');
  negatives.add('teleporting objects');
  negatives.add('broken spatial relationships');
  negatives.add('wrong perspective');
  negatives.add('missing established objects');
  negatives.add('floating objects');
  negatives.add('objects clipping through each other');
  negatives.add('impossible physics');
  
  for (const v of violations) {
    if (v.violationType === 'position-jump') {
      negatives.add(`${v.objectName} in wrong position`);
    }
    if (v.violationType === 'size-inconsistency') {
      negatives.add(`${v.objectName} wrong size`);
    }
  }
  
  return Array.from(negatives).join(', ');
}
