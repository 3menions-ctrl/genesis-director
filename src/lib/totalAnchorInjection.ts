/**
 * TOTAL ANCHOR INJECTION SYSTEM
 * 
 * THE LAW: Every clip MUST receive ALL possible anchors for maximum consistency.
 * This module injects EVERYTHING into every clip generation.
 */

import type { ShotContinuityManifest } from '@/types/continuity-manifest';
import type { SceneAnchor } from '@/types/scene-anchors';
import type { EnhancedIdentityBible, NonFacialAnchors } from '@/types/enhanced-identity-bible';
import type { IdentityBible } from '@/types/identity-bible';

// ============================================
// TOTAL INJECTION RESULT
// ============================================

export interface TotalAnchorInjection {
  // The mega-prompt with ALL anchors injected
  megaPrompt: string;
  
  // The mega-negative with ALL anti-drift terms
  megaNegative: string;
  
  // Reference images to use
  referenceImages: {
    lastFrame: string | null;        // Previous clip's last frame (MANDATORY for clip 2+)
    clip1FirstFrame: string | null;  // Clip 1's reference (MANDATORY for all)
    identityViews: string[];         // All identity bible views
    sceneReference: string | null;   // Scene anchor reference
  };
  
  // Injection summary for debugging
  injectionSummary: {
    totalAnchorsInjected: number;
    categories: {
      identity: number;
      spatial: number;
      lighting: number;
      props: number;
      emotional: number;
      action: number;
      microDetails: number;
      environment: number;
      sceneDNA: number;
    };
    warnings: string[];
  };
}

// ============================================
// IDENTITY ANCHORS (Character Consistency)
// ============================================

function injectIdentityAnchors(
  identityBible: EnhancedIdentityBible | IdentityBible | null,
  parts: string[],
  count: { value: number }
): void {
  if (!identityBible) return;
  
  parts.push('');
  parts.push('========== CHARACTER IDENTITY LOCK ==========');
  
  // Core description
  if ('characterDescription' in identityBible && identityBible.characterDescription) {
    parts.push(`[IDENTITY CORE: ${identityBible.characterDescription}]`);
    count.value++;
  }
  
  // Consistency anchors
  if ('consistencyAnchors' in identityBible && identityBible.consistencyAnchors?.length) {
    parts.push(`[VISUAL ANCHORS: ${identityBible.consistencyAnchors.join(', ')}]`);
    count.value += identityBible.consistencyAnchors.length;
  }
  
  // Enhanced consistency prompt
  if ('enhancedConsistencyPrompt' in identityBible && identityBible.enhancedConsistencyPrompt) {
    parts.push(`[ENHANCED IDENTITY: ${identityBible.enhancedConsistencyPrompt}]`);
    count.value++;
  }
  
  // Non-facial anchors (CRITICAL for any angle)
  if ('nonFacialAnchors' in identityBible && identityBible.nonFacialAnchors) {
    const nfa = identityBible.nonFacialAnchors as NonFacialAnchors;
    parts.push('');
    parts.push('--- NON-FACIAL ANCHORS (All Angles) ---');
    
    if (nfa.bodyType) {
      parts.push(`[BODY TYPE: ${nfa.bodyType}]`);
      count.value++;
    }
    if (nfa.bodyProportions) {
      parts.push(`[PROPORTIONS: ${nfa.bodyProportions}]`);
      count.value++;
    }
    if (nfa.posture) {
      parts.push(`[POSTURE: ${nfa.posture}]`);
      count.value++;
    }
    if (nfa.gait) {
      parts.push(`[GAIT: ${nfa.gait}]`);
      count.value++;
    }
    if (nfa.height) {
      parts.push(`[HEIGHT: ${nfa.height}]`);
      count.value++;
    }
    
    // Clothing (CRITICAL)
    if (nfa.clothingDescription) {
      parts.push(`[CLOTHING: ${nfa.clothingDescription}]`);
      count.value++;
    }
    if (nfa.clothingColors?.length) {
      parts.push(`[CLOTHING COLORS: ${nfa.clothingColors.join(', ')}]`);
      count.value += nfa.clothingColors.length;
    }
    if (nfa.clothingPatterns?.length) {
      parts.push(`[CLOTHING PATTERNS: ${nfa.clothingPatterns.join(', ')}]`);
      count.value += nfa.clothingPatterns.length;
    }
    if (nfa.clothingTextures?.length) {
      parts.push(`[CLOTHING TEXTURES: ${nfa.clothingTextures.join(', ')}]`);
      count.value += nfa.clothingTextures.length;
    }
    if (nfa.clothingDistinctive) {
      parts.push(`[DISTINCTIVE CLOTHING: ${nfa.clothingDistinctive}]`);
      count.value++;
    }
    
    // Hair from ALL angles
    if (nfa.hairColor) {
      parts.push(`[HAIR COLOR: ${nfa.hairColor}]`);
      count.value++;
    }
    if (nfa.hairLength) {
      parts.push(`[HAIR LENGTH: ${nfa.hairLength}]`);
      count.value++;
    }
    if (nfa.hairStyle) {
      parts.push(`[HAIR STYLE: ${nfa.hairStyle}]`);
      count.value++;
    }
    if (nfa.hairFromBehind) {
      parts.push(`[HAIR FROM BEHIND: ${nfa.hairFromBehind}]`);
      count.value++;
    }
    if (nfa.hairSilhouette) {
      parts.push(`[HAIR SILHOUETTE: ${nfa.hairSilhouette}]`);
      count.value++;
    }
    
    // Accessories
    if (nfa.accessories?.length) {
      parts.push(`[ACCESSORIES: ${nfa.accessories.join(', ')}]`);
      count.value += nfa.accessories.length;
    }
    if (nfa.accessoryPositions) {
      parts.push(`[ACCESSORY POSITIONS: ${nfa.accessoryPositions}]`);
      count.value++;
    }
    
    // Back view markers
    if (nfa.backViewMarkers) {
      parts.push(`[BACK VIEW MARKERS: ${nfa.backViewMarkers}]`);
      count.value++;
    }
    
    // Silhouette
    if (nfa.overallSilhouette) {
      parts.push(`[SILHOUETTE: ${nfa.overallSilhouette}]`);
      count.value++;
    }
  }
  
  parts.push('========== END CHARACTER IDENTITY ==========');
}

// ============================================
// SPATIAL ANCHORS (Position/Framing)
// ============================================

function injectSpatialAnchors(
  manifest: ShotContinuityManifest | null,
  parts: string[],
  count: { value: number }
): number {
  if (!manifest?.spatial) return 0;
  
  const sp = manifest.spatial;
  let spatialCount = 0;
  
  parts.push('');
  parts.push('========== SPATIAL CONTINUITY ==========');
  
  // Primary character position
  if (sp.primaryCharacter) {
    const pc = sp.primaryCharacter;
    parts.push(`[SCREEN POSITION: ${pc.screenPosition}]`);
    parts.push(`[DEPTH: ${pc.depth}]`);
    parts.push(`[VERTICAL: ${pc.verticalPosition}]`);
    parts.push(`[FACING: ${pc.facingDirection}]`);
    parts.push(`[BODY ANGLE: ${pc.bodyAngle}° from camera]`);
    spatialCount += 5;
  }
  
  // Secondary characters
  if (sp.secondaryCharacters?.length) {
    sp.secondaryCharacters.forEach((sc, i) => {
      parts.push(`[SECONDARY ${i + 1}: ${sc.position.screenPosition}, ${sc.position.depth}, facing ${sc.position.facingDirection}]`);
      spatialCount++;
    });
  }
  
  // Relative positions
  if (sp.relativePositions?.length) {
    sp.relativePositions.forEach(rp => {
      parts.push(`[RELATION: ${rp.characterName} is ${rp.relativePosition} at ${rp.distance} distance]`);
      spatialCount++;
    });
  }
  
  // Camera distance
  parts.push(`[CAMERA: ${sp.cameraDistance}]`);
  spatialCount++;
  
  // Eye line
  if (sp.eyeLineDirection) {
    parts.push(`[EYE LINE: ${sp.eyeLineDirection}]`);
    spatialCount++;
  }
  
  parts.push('========== END SPATIAL ==========');
  count.value += spatialCount;
  return spatialCount;
}

// ============================================
// LIGHTING ANCHORS
// ============================================

function injectLightingAnchors(
  manifest: ShotContinuityManifest | null,
  sceneAnchor: SceneAnchor | null,
  parts: string[],
  count: { value: number }
): number {
  let lightingCount = 0;
  
  parts.push('');
  parts.push('========== LIGHTING LOCK ==========');
  
  // From continuity manifest
  if (manifest?.lighting) {
    const lt = manifest.lighting;
    parts.push(`[LIGHT SOURCE: ${lt.primarySource.type} ${lt.primarySource.direction}]`);
    parts.push(`[LIGHT QUALITY: ${lt.primarySource.quality} ${lt.primarySource.intensity}]`);
    parts.push(`[COLOR TEMP: ${lt.colorTemperature}]`);
    if (lt.colorTint) parts.push(`[COLOR TINT: ${lt.colorTint}]`);
    parts.push(`[SHADOW: ${lt.shadowDirection}]`);
    parts.push(`[AMBIENT: ${lt.ambientLevel}]`);
    if (lt.specialLighting?.length) {
      parts.push(`[SPECIAL: ${lt.specialLighting.join(', ')}]`);
    }
    lightingCount += 6;
  }
  
  // From scene anchor (more detailed)
  if (sceneAnchor?.lighting) {
    const sl = sceneAnchor.lighting;
    parts.push(`[KEY LIGHT: ${sl.keyLightDirection}, ${sl.keyLightIntensity}, ${sl.keyLightColor}]`);
    parts.push(`[FILL RATIO: ${sl.fillRatio}]`);
    parts.push(`[AMBIENT COLOR: ${sl.ambientColor}]`);
    parts.push(`[SHADOW HARDNESS: ${sl.shadowHardness}]`);
    parts.push(`[TIME OF DAY: ${sl.timeOfDay}]`);
    if (sl.promptFragment) {
      parts.push(`[LIGHTING DNA: ${sl.promptFragment}]`);
    }
    lightingCount += 6;
  }
  
  parts.push('========== END LIGHTING ==========');
  count.value += lightingCount;
  return lightingCount;
}

// ============================================
// PROPS ANCHORS
// ============================================

function injectPropsAnchors(
  manifest: ShotContinuityManifest | null,
  parts: string[],
  count: { value: number }
): number {
  if (!manifest?.props) return 0;
  
  let propsCount = 0;
  const props = manifest.props;
  
  parts.push('');
  parts.push('========== PROPS INVENTORY ==========');
  
  // Character props
  if (props.characterProps?.length) {
    props.characterProps.forEach(cp => {
      cp.props.forEach(p => {
        let propStr = `[PROP: ${cp.characterName} - ${p.name}`;
        if (p.heldBy) propStr += `, held ${p.hand || ''}`;
        propStr += `, ${p.state}`;
        if (p.position) propStr += `, ${p.position}`;
        if (p.condition) propStr += `, ${p.condition}`;
        propStr += ']';
        parts.push(propStr);
        propsCount++;
      });
    });
  }
  
  // Environment props
  if (props.environmentProps?.length) {
    props.environmentProps.forEach(ep => {
      parts.push(`[ENV PROP: ${ep.name} at ${ep.position}, ${ep.state}]`);
      propsCount++;
    });
  }
  
  // Important absences
  if (props.importantAbsences?.length) {
    props.importantAbsences.forEach(abs => {
      parts.push(`[ABSENT: ${abs}]`);
      propsCount++;
    });
  }
  
  parts.push('========== END PROPS ==========');
  count.value += propsCount;
  return propsCount;
}

// ============================================
// EMOTIONAL ANCHORS
// ============================================

function injectEmotionalAnchors(
  manifest: ShotContinuityManifest | null,
  parts: string[],
  count: { value: number }
): number {
  if (!manifest?.emotional) return 0;
  
  let emotionalCount = 0;
  const em = manifest.emotional;
  
  parts.push('');
  parts.push('========== EMOTIONAL STATE ==========');
  
  parts.push(`[EMOTION: ${em.intensity} ${em.primaryEmotion}]`);
  parts.push(`[FACE: ${em.facialExpression}]`);
  parts.push(`[BODY LANGUAGE: ${em.bodyLanguage}]`);
  emotionalCount += 3;
  
  if (em.breathingState) {
    parts.push(`[BREATHING: ${em.breathingState}]`);
    emotionalCount++;
  }
  
  if (em.physicalIndicators?.length) {
    parts.push(`[PHYSICAL SIGNS: ${em.physicalIndicators.join(', ')}]`);
    emotionalCount += em.physicalIndicators.length;
  }
  
  // Emotional carryover
  if (manifest.emotionalCarryover) {
    const ec = manifest.emotionalCarryover;
    if (ec.expectedTransition) {
      parts.push(`[TRANSITION: ${ec.expectedTransition}]`);
      emotionalCount++;
    }
    if (ec.mustMaintain?.length) {
      parts.push(`[MUST MAINTAIN: ${ec.mustMaintain.join(', ')}]`);
      emotionalCount += ec.mustMaintain.length;
    }
  }
  
  parts.push('========== END EMOTIONAL ==========');
  count.value += emotionalCount;
  return emotionalCount;
}

// ============================================
// ACTION ANCHORS (Movement Momentum)
// ============================================

function injectActionAnchors(
  manifest: ShotContinuityManifest | null,
  parts: string[],
  count: { value: number }
): number {
  if (!manifest?.action) return 0;
  
  let actionCount = 0;
  const ac = manifest.action;
  
  parts.push('');
  parts.push('========== ACTION MOMENTUM ==========');
  
  parts.push(`[MOVEMENT: ${ac.movementType} ${ac.movementDirection}]`);
  parts.push(`[POSE AT CUT: ${ac.poseAtCut}]`);
  actionCount += 2;
  
  if (ac.gestureInProgress) {
    parts.push(`[GESTURE: ${ac.gestureInProgress}]`);
    actionCount++;
  }
  
  if (ac.eyeMovement) {
    parts.push(`[EYES: ${ac.eyeMovement}]`);
    actionCount++;
  }
  
  if (ac.expectedContinuation) {
    parts.push(`[CONTINUE: ${ac.expectedContinuation}]`);
    actionCount++;
  }
  
  // Action continuity rules
  if (manifest.actionContinuity) {
    const cont = manifest.actionContinuity;
    parts.push(`[180 RULE: ${cont.rule180Maintained ? 'MAINTAINED' : 'CROSSED'}]`);
    if (cont.matchingAction) parts.push(`[MATCH: ${cont.matchingAction}]`);
    if (cont.velocityConsistency) parts.push(`[VELOCITY: ${cont.velocityConsistency}]`);
    if (cont.gravityState) parts.push(`[GRAVITY: ${cont.gravityState}]`);
    actionCount += 4;
  }
  
  parts.push('========== END ACTION ==========');
  count.value += actionCount;
  return actionCount;
}

// ============================================
// MICRO-DETAILS ANCHORS (Scars, Dirt, Wear)
// ============================================

function injectMicroDetailsAnchors(
  manifest: ShotContinuityManifest | null,
  parts: string[],
  count: { value: number }
): number {
  if (!manifest?.microDetails) return 0;
  
  let microCount = 0;
  const md = manifest.microDetails;
  
  parts.push('');
  parts.push('========== MICRO DETAILS ==========');
  
  // Skin details
  if (md.skin) {
    if (md.skin.scars?.length) {
      md.skin.scars.forEach(s => {
        parts.push(`[SCAR: ${s.description} on ${s.location}]`);
        microCount++;
      });
    }
    if (md.skin.wounds?.length) {
      md.skin.wounds.forEach(w => {
        parts.push(`[WOUND: ${w.freshness} ${w.description} on ${w.location}]`);
        microCount++;
      });
    }
    if (md.skin.dirt?.length) {
      md.skin.dirt.forEach(d => {
        parts.push(`[DIRT: ${d.intensity} on ${d.areas.join(', ')}]`);
        microCount++;
      });
    }
    if (md.skin.sweat) {
      parts.push(`[SWEAT: visible]`);
      microCount++;
    }
    if (md.skin.blood?.length) {
      md.skin.blood.forEach(b => {
        parts.push(`[BLOOD: ${b.freshness} on ${b.areas.join(', ')}]`);
        microCount++;
      });
    }
    if (md.skin.bruises?.length) {
      md.skin.bruises.forEach(b => {
        parts.push(`[BRUISE: ${b.age} on ${b.location}]`);
        microCount++;
      });
    }
  }
  
  // Clothing wear
  if (md.clothing) {
    if (md.clothing.tears?.length) {
      md.clothing.tears.forEach(t => {
        parts.push(`[TEAR: ${t.size} on ${t.location}]`);
        microCount++;
      });
    }
    if (md.clothing.stains?.length) {
      md.clothing.stains.forEach(s => {
        parts.push(`[STAIN: ${s.type} ${s.color || ''} on ${s.location}]`);
        microCount++;
      });
    }
    parts.push(`[DUST LEVEL: ${md.clothing.dustLevel}]`);
    microCount++;
    
    if (md.clothing.wetness?.length) {
      md.clothing.wetness.forEach(w => {
        parts.push(`[WET: ${w.level} on ${w.areas.join(', ')}]`);
        microCount++;
      });
    }
    if (md.clothing.damage?.length) {
      md.clothing.damage.forEach(d => {
        parts.push(`[DAMAGE: ${d.type} on ${d.location}]`);
        microCount++;
      });
    }
  }
  
  // Hair state
  if (md.hair) {
    parts.push(`[HAIR: ${md.hair.style}, ${md.hair.condition}]`);
    microCount++;
    if (md.hair.wetness && md.hair.wetness !== 'dry') {
      parts.push(`[HAIR WETNESS: ${md.hair.wetness}]`);
      microCount++;
    }
    if (md.hair.debris?.length) {
      parts.push(`[HAIR DEBRIS: ${md.hair.debris.join(', ')}]`);
      microCount++;
    }
    if (md.hair.windEffect) {
      parts.push(`[HAIR WIND: ${md.hair.windEffect}]`);
      microCount++;
    }
  }
  
  // Persistent markers
  if (md.persistentMarkers?.length) {
    parts.push(`[PERSISTENT: ${md.persistentMarkers.join(', ')}]`);
    microCount += md.persistentMarkers.length;
  }
  
  parts.push('========== END MICRO DETAILS ==========');
  count.value += microCount;
  return microCount;
}

// ============================================
// ENVIRONMENT ANCHORS
// ============================================

function injectEnvironmentAnchors(
  manifest: ShotContinuityManifest | null,
  sceneAnchor: SceneAnchor | null,
  parts: string[],
  count: { value: number }
): number {
  let envCount = 0;
  
  parts.push('');
  parts.push('========== ENVIRONMENT LOCK ==========');
  
  // From continuity manifest
  if (manifest?.environment) {
    const env = manifest.environment;
    if (env.weatherVisible) {
      parts.push(`[WEATHER: ${env.weatherVisible}]`);
      envCount++;
    }
    parts.push(`[TIME: ${env.timeOfDay}]`);
    envCount++;
    
    if (env.atmospherics?.length) {
      parts.push(`[ATMOSPHERE: ${env.atmospherics.join(', ')}]`);
      envCount += env.atmospherics.length;
    }
    if (env.backgroundElements?.length) {
      parts.push(`[BACKGROUND: ${env.backgroundElements.join(', ')}]`);
      envCount += env.backgroundElements.length;
    }
    if (env.surfaceConditions) {
      parts.push(`[SURFACE: ${env.surfaceConditions}]`);
      envCount++;
    }
  }
  
  // From scene anchor
  if (sceneAnchor?.keyObjects) {
    const ko = sceneAnchor.keyObjects;
    parts.push(`[SETTING: ${ko.settingDescription}]`);
    parts.push(`[TYPE: ${ko.environmentType}]`);
    envCount += 2;
    
    if (ko.architecturalStyle) {
      parts.push(`[ARCHITECTURE: ${ko.architecturalStyle}]`);
      envCount++;
    }
    
    // Key objects
    if (ko.objects?.length) {
      ko.objects.forEach(obj => {
        parts.push(`[OBJECT: ${obj.name} - ${obj.description}, ${obj.position} ${obj.depth}]`);
        envCount++;
      });
    }
    
    if (ko.promptFragment) {
      parts.push(`[ENV DNA: ${ko.promptFragment}]`);
      envCount++;
    }
  }
  
  parts.push('========== END ENVIRONMENT ==========');
  count.value += envCount;
  return envCount;
}

// ============================================
// SCENE DNA ANCHORS (Color/Depth)
// ============================================

function injectSceneDNAAnchors(
  sceneAnchor: SceneAnchor | null,
  parts: string[],
  count: { value: number }
): number {
  if (!sceneAnchor) return 0;
  
  let dnaCount = 0;
  
  parts.push('');
  parts.push('========== SCENE DNA ==========');
  
  // Color palette
  if (sceneAnchor.colorPalette) {
    const cp = sceneAnchor.colorPalette;
    if (cp.dominant?.length) {
      const colors = cp.dominant.map(d => d.name).join(', ');
      parts.push(`[DOMINANT COLORS: ${colors}]`);
      dnaCount++;
    }
    if (cp.accents?.length) {
      parts.push(`[ACCENT COLORS: ${cp.accents.join(', ')}]`);
      dnaCount++;
    }
    parts.push(`[TEMPERATURE: ${cp.temperature}]`);
    parts.push(`[SATURATION: ${cp.saturation}]`);
    dnaCount += 2;
    
    if (cp.gradeStyle) {
      parts.push(`[GRADE: ${cp.gradeStyle}]`);
      dnaCount++;
    }
    if (cp.promptFragment) {
      parts.push(`[COLOR DNA: ${cp.promptFragment}]`);
      dnaCount++;
    }
  }
  
  // Depth cues
  if (sceneAnchor.depthCues) {
    const dc = sceneAnchor.depthCues;
    parts.push(`[DOF: ${dc.dofStyle}, focal ${dc.focalPlane}]`);
    dnaCount++;
    
    if (dc.atmosphericPerspective) {
      parts.push(`[ATMOSPHERIC: yes]`);
      dnaCount++;
    }
    if (dc.fogHaze !== 'none') {
      parts.push(`[FOG/HAZE: ${dc.fogHaze}]`);
      dnaCount++;
    }
    
    if (dc.foregroundElements?.length) {
      parts.push(`[FOREGROUND: ${dc.foregroundElements.join(', ')}]`);
      dnaCount++;
    }
    if (dc.midgroundElements?.length) {
      parts.push(`[MIDGROUND: ${dc.midgroundElements.join(', ')}]`);
      dnaCount++;
    }
    if (dc.backgroundElements?.length) {
      parts.push(`[BACKGROUND: ${dc.backgroundElements.join(', ')}]`);
      dnaCount++;
    }
    
    parts.push(`[PERSPECTIVE: ${dc.perspectiveType}]`);
    dnaCount++;
    
    if (dc.promptFragment) {
      parts.push(`[DEPTH DNA: ${dc.promptFragment}]`);
      dnaCount++;
    }
  }
  
  // Motion signature
  if (sceneAnchor.motionSignature) {
    const ms = sceneAnchor.motionSignature;
    parts.push(`[CAMERA MOTION: ${ms.cameraMotionStyle}]`);
    if (ms.preferredMovements?.length) {
      parts.push(`[MOVEMENTS: ${ms.preferredMovements.join(', ')}]`);
    }
    parts.push(`[PACING: ${ms.pacingTempo}]`);
    dnaCount += 3;
    
    if (ms.promptFragment) {
      parts.push(`[MOTION DNA: ${ms.promptFragment}]`);
      dnaCount++;
    }
  }
  
  // Master consistency prompt
  if (sceneAnchor.masterConsistencyPrompt) {
    parts.push(`[MASTER DNA: ${sceneAnchor.masterConsistencyPrompt}]`);
    dnaCount++;
  }
  
  parts.push('========== END SCENE DNA ==========');
  count.value += dnaCount;
  return dnaCount;
}

// ============================================
// MEGA NEGATIVE PROMPT BUILDER
// ============================================

function buildMegaNegative(
  identityBible: EnhancedIdentityBible | IdentityBible | null
): string {
  const negatives: string[] = [];
  
  // Core anti-morphing (ALWAYS)
  negatives.push(
    'character morphing',
    'identity shift',
    'face changing',
    'face swap',
    'body transformation',
    'different person',
    'character replacement',
    'shapeshifting',
    'appearance mutation'
  );
  
  // Clothing consistency
  negatives.push(
    'clothing change',
    'outfit change',
    'costume change',
    'wardrobe change',
    'different clothes',
    'wrong outfit',
    'clothing transformation'
  );
  
  // Hair consistency
  negatives.push(
    'hair color change',
    'different hairstyle',
    'hair transformation',
    'wig',
    'bald when should have hair',
    'hair length change'
  );
  
  // Body consistency
  negatives.push(
    'body proportions changing',
    'height change',
    'weight change',
    'different body type',
    'age progression',
    'age regression',
    'gender swap'
  );
  
  // Spatial consistency (180 rule)
  negatives.push(
    '180 degree rule violation',
    'character position swap',
    'wrong screen position',
    'wrong depth plane'
  );
  
  // Lighting consistency
  negatives.push(
    'lighting direction reversal',
    'shadow direction change',
    'different time of day',
    'color temperature shift'
  );
  
  // Props consistency
  negatives.push(
    'prop disappearance',
    'prop change',
    'different weapon',
    'accessory missing',
    'wrong accessories'
  );
  
  // Micro-detail consistency
  negatives.push(
    'scar removal',
    'wound healing between shots',
    'sudden cleanliness',
    'dirt disappearing',
    'blood disappearing',
    'bruise healing instantly'
  );
  
  // Environmental consistency
  negatives.push(
    'environment change',
    'background shift',
    'weather change',
    'different location'
  );
  
  // Occlusion-specific (from identity bible)
  if (identityBible && 'occlusionNegatives' in identityBible && identityBible.occlusionNegatives?.length) {
    negatives.push(...identityBible.occlusionNegatives);
  }
  
  // Anti-morphing prompts (from identity bible)
  if (identityBible && 'antiMorphingPrompts' in identityBible && identityBible.antiMorphingPrompts?.length) {
    negatives.push(...identityBible.antiMorphingPrompts);
  }
  
  // Quality negatives
  negatives.push(
    'blurry',
    'low quality',
    'distorted',
    'watermark',
    'text',
    'logo',
    'deformed',
    'disfigured',
    'bad anatomy'
  );
  
  // Deduplicate and join
  return [...new Set(negatives)].join(', ');
}

// ============================================
// MAIN EXPORT: TOTAL INJECTION BUILDER
// ============================================

export function buildTotalAnchorInjection(
  basePrompt: string,
  options: {
    clipIndex: number;
    totalClips: number;
    
    // MANDATORY for clip 2+
    lastFrameUrl: string | null;
    
    // MANDATORY for all clips
    clip1ReferenceUrl: string | null;
    
    // Identity
    identityBible: EnhancedIdentityBible | IdentityBible | null;
    
    // Continuity from previous clip
    previousManifest: ShotContinuityManifest | null;
    
    // Scene DNA
    sceneAnchor: SceneAnchor | null;
    
    // Script line for this clip
    scriptLine: string | null;
  }
): TotalAnchorInjection {
  const {
    clipIndex,
    totalClips,
    lastFrameUrl,
    clip1ReferenceUrl,
    identityBible,
    previousManifest,
    sceneAnchor,
    scriptLine,
  } = options;
  
  const parts: string[] = [];
  const warnings: string[] = [];
  const count = { value: 0 };
  const categories = {
    identity: 0,
    spatial: 0,
    lighting: 0,
    props: 0,
    emotional: 0,
    action: 0,
    microDetails: 0,
    environment: 0,
    sceneDNA: 0,
  };
  
  // ============================================
  // HEADER
  // ============================================
  parts.push('╔══════════════════════════════════════════════════════════════╗');
  parts.push(`║  CLIP ${clipIndex + 1}/${totalClips} - TOTAL ANCHOR INJECTION ACTIVE  ║`);
  parts.push('╚══════════════════════════════════════════════════════════════╝');
  
  // ============================================
  // SCRIPT LINE (Story context)
  // ============================================
  if (scriptLine) {
    parts.push('');
    parts.push('========== SCRIPT ==========');
    parts.push(`[SCRIPT: ${scriptLine}]`);
    parts.push('========== END SCRIPT ==========');
    count.value++;
  }
  
  // ============================================
  // INJECT ALL ANCHOR CATEGORIES
  // ============================================
  
  // 1. Identity anchors
  const identityBefore = count.value;
  injectIdentityAnchors(identityBible, parts, count);
  categories.identity = count.value - identityBefore;
  
  // 2. Spatial anchors
  categories.spatial = injectSpatialAnchors(previousManifest, parts, count);
  
  // 3. Lighting anchors
  categories.lighting = injectLightingAnchors(previousManifest, sceneAnchor, parts, count);
  
  // 4. Props anchors
  categories.props = injectPropsAnchors(previousManifest, parts, count);
  
  // 5. Emotional anchors
  categories.emotional = injectEmotionalAnchors(previousManifest, parts, count);
  
  // 6. Action anchors
  categories.action = injectActionAnchors(previousManifest, parts, count);
  
  // 7. Micro-details anchors
  categories.microDetails = injectMicroDetailsAnchors(previousManifest, parts, count);
  
  // 8. Environment anchors
  categories.environment = injectEnvironmentAnchors(previousManifest, sceneAnchor, parts, count);
  
  // 9. Scene DNA anchors
  categories.sceneDNA = injectSceneDNAAnchors(sceneAnchor, parts, count);
  
  // ============================================
  // CRITICAL ANCHORS FROM MANIFEST
  // ============================================
  if (previousManifest?.criticalAnchors?.length) {
    parts.push('');
    parts.push('========== CRITICAL ANCHORS (MUST MAINTAIN) ==========');
    previousManifest.criticalAnchors.forEach(anchor => {
      parts.push(`[CRITICAL: ${anchor}]`);
      count.value++;
    });
    parts.push('========== END CRITICAL ==========');
  }
  
  // ============================================
  // BASE PROMPT
  // ============================================
  parts.push('');
  parts.push('========== SCENE ACTION ==========');
  parts.push(basePrompt);
  parts.push('========== END SCENE ==========');
  
  // ============================================
  // WARNINGS
  // ============================================
  if (clipIndex > 0 && !lastFrameUrl) {
    warnings.push('CRITICAL: No last frame URL for clip 2+ - continuity will suffer');
  }
  if (!clip1ReferenceUrl) {
    warnings.push('WARNING: No clip 1 reference - initial consistency anchor missing');
  }
  if (!identityBible) {
    warnings.push('WARNING: No identity bible - character consistency at risk');
  }
  if (!previousManifest && clipIndex > 0) {
    warnings.push('WARNING: No previous manifest - spatial/lighting/props continuity missing');
  }
  if (!sceneAnchor) {
    warnings.push('INFO: No scene anchor - scene DNA not available');
  }
  
  // ============================================
  // COLLECT REFERENCE IMAGES
  // ============================================
  const identityViews: string[] = [];
  if (identityBible) {
    // Enhanced bible with 5 views
    if ('views' in identityBible) {
      const views = (identityBible as EnhancedIdentityBible).views;
      if (views.front?.imageUrl) identityViews.push(views.front.imageUrl);
      if (views.side?.imageUrl) identityViews.push(views.side.imageUrl);
      if (views.threeQuarter?.imageUrl) identityViews.push(views.threeQuarter.imageUrl);
      if (views.back?.imageUrl) identityViews.push(views.back.imageUrl);
      if (views.silhouette?.imageUrl) identityViews.push(views.silhouette.imageUrl);
    }
    // Basic bible with 3 views
    if ('frontViewUrl' in identityBible) {
      const basic = identityBible as IdentityBible;
      if (basic.frontViewUrl) identityViews.push(basic.frontViewUrl);
      if (basic.sideViewUrl) identityViews.push(basic.sideViewUrl);
      if (basic.threeQuarterViewUrl) identityViews.push(basic.threeQuarterViewUrl);
    }
  }
  
  // ============================================
  // BUILD RESULT
  // ============================================
  return {
    megaPrompt: parts.join('\n'),
    megaNegative: buildMegaNegative(identityBible),
    referenceImages: {
      lastFrame: lastFrameUrl,
      clip1FirstFrame: clip1ReferenceUrl,
      identityViews,
      sceneReference: sceneAnchor?.frameUrl || null,
    },
    injectionSummary: {
      totalAnchorsInjected: count.value,
      categories,
      warnings,
    },
  };
}

// ============================================
// VALIDATION: THE LAW
// ============================================

export interface TheLawValidation {
  passed: boolean;
  violations: string[];
  clipIndex: number;
}

export function validateTheLaw(
  clipIndex: number,
  lastFrameUrl: string | null,
  clip1ReferenceUrl: string | null,
  identityBible: EnhancedIdentityBible | IdentityBible | null,
  previousManifest: ShotContinuityManifest | null,
  scriptLine: string | null
): TheLawValidation {
  const violations: string[] = [];
  
  // THE LAW for clip 2+:
  if (clipIndex > 0) {
    // 1. MUST have last frame from previous clip
    if (!lastFrameUrl) {
      violations.push('NO_LAST_FRAME: Clip 2+ MUST use last frame from previous clip');
    }
    
    // 2. MUST have anchor points from previous clip
    if (!previousManifest) {
      violations.push('NO_ANCHORS: Clip 2+ MUST have anchor points from previous clip');
    }
  }
  
  // THE LAW for ALL clips:
  // 3. MUST have reference image from clip 1
  if (!clip1ReferenceUrl && clipIndex > 0) {
    violations.push('NO_CLIP1_REF: All clips MUST reference clip 1');
  }
  
  // 4. MUST have identity bible (or at least character description)
  if (!identityBible) {
    violations.push('NO_IDENTITY: All clips MUST have identity bible');
  }
  
  // 5. MUST follow the script
  if (!scriptLine) {
    violations.push('NO_SCRIPT: All clips MUST follow the script');
  }
  
  return {
    passed: violations.length === 0,
    violations,
    clipIndex,
  };
}
