import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_CLIP_DURATION = 6;

// =====================================================
// CONSISTENCY ENGINE (Embedded for Edge Function)
// =====================================================

type DetectedPose = 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette' | 'occluded' | 'unknown';

interface PoseAnalysis {
  detectedPose: DetectedPose;
  confidence: number;
  faceVisible: boolean;
  recommendedView: 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette';
}

const POSE_PATTERNS: { pattern: RegExp; pose: DetectedPose; confidence: number }[] = [
  { pattern: /\b(from\s+behind|from\s+the\s+back|rear\s+view|back\s+to\s+(camera|us|viewer))\b/i, pose: 'back', confidence: 95 },
  { pattern: /\b(walking\s+away|running\s+away|retreating|departing|leaving)\b/i, pose: 'back', confidence: 85 },
  { pattern: /\b(facing\s+away|turned\s+away|back\s+turned)\b/i, pose: 'back', confidence: 90 },
  { pattern: /\b(looking\s+into\s+(the\s+)?distance|gazing\s+at\s+the\s+horizon)\b/i, pose: 'back', confidence: 75 },
  { pattern: /\b(over\s+the\s+shoulder)\b/i, pose: 'back', confidence: 80 },
  { pattern: /\b(profile\s+(view|shot)|side\s+(view|profile|angle))\b/i, pose: 'side', confidence: 95 },
  { pattern: /\b(from\s+the\s+side|lateral\s+view)\b/i, pose: 'side', confidence: 90 },
  { pattern: /\b(three[-\s]quarter|3\/4\s+view|angled\s+view)\b/i, pose: 'three-quarter', confidence: 95 },
  { pattern: /\b(silhouette|backlit|shadow\s+figure)\b/i, pose: 'silhouette', confidence: 95 },
  { pattern: /\b(face\s+(hidden|obscured|covered)|wearing\s+(mask|helmet|hood))\b/i, pose: 'occluded', confidence: 90 },
  { pattern: /\b(facing\s+(camera|us|forward|viewer)|front\s+view|head-on)\b/i, pose: 'front', confidence: 95 },
  { pattern: /\b(looking\s+at\s+(camera|us|viewer)|eye\s+contact)\b/i, pose: 'front', confidence: 90 },
];

function detectPoseFromPrompt(prompt: string): PoseAnalysis {
  let bestPose: DetectedPose = 'front';
  let bestConfidence = 50;
  
  for (const { pattern, pose, confidence } of POSE_PATTERNS) {
    if (pattern.test(prompt) && confidence > bestConfidence) {
      bestPose = pose;
      bestConfidence = confidence;
    }
  }
  
  const nonFacialPoses: DetectedPose[] = ['back', 'silhouette', 'occluded'];
  const faceVisible = !nonFacialPoses.includes(bestPose);
  
  const viewMap: Record<DetectedPose, 'front' | 'side' | 'back' | 'three-quarter' | 'silhouette'> = {
    'front': 'front', 'side': 'side', 'back': 'back',
    'three-quarter': 'three-quarter', 'silhouette': 'silhouette',
    'occluded': 'front', 'unknown': 'front',
  };
  
  return { detectedPose: bestPose, confidence: bestConfidence, faceVisible, recommendedView: viewMap[bestPose] };
}

interface MultiViewUrls {
  frontViewUrl?: string;
  sideViewUrl?: string;
  threeQuarterViewUrl?: string;
  backViewUrl?: string;
  silhouetteUrl?: string;
}

function selectViewForPose(pose: PoseAnalysis, views: MultiViewUrls): { url: string | null; type: string } {
  const viewUrlMap: Record<string, string | undefined> = {
    'front': views.frontViewUrl, 'side': views.sideViewUrl, 'back': views.backViewUrl,
    'three-quarter': views.threeQuarterViewUrl, 'silhouette': views.silhouetteUrl,
  };
  
  if (viewUrlMap[pose.recommendedView]) {
    return { url: viewUrlMap[pose.recommendedView]!, type: pose.recommendedView };
  }
  
  // Fallback priority
  const fallbacks = pose.recommendedView === 'back' 
    ? ['silhouette', 'three-quarter', 'side', 'front']
    : ['front', 'three-quarter', 'side'];
  
  for (const fb of fallbacks) {
    if (viewUrlMap[fb]) return { url: viewUrlMap[fb]!, type: fb };
  }
  
  return { url: null, type: 'none' };
}

function buildCharacterSpecificNegatives(nonFacialAnchors?: any): string[] {
  const negatives: string[] = [
    'character morphing', 'identity shift', 'face changing mid-shot',
    'inconsistent appearance', 'different person', 'age progression',
  ];
  
  if (nonFacialAnchors?.clothingColors?.length) {
    const wrongColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink']
      .filter(c => !nonFacialAnchors.clothingColors.some((cc: string) => cc.toLowerCase().includes(c)));
    negatives.push(...wrongColors.slice(0, 3).map(c => `${c} clothing`));
    negatives.push('different outfit', 'clothing change');
  }
  
  if (nonFacialAnchors?.hairColor) {
    const currentColor = nonFacialAnchors.hairColor.toLowerCase();
    const wrongHairColors = ['blonde', 'brunette', 'black', 'red', 'gray', 'white']
      .filter(c => !currentColor.includes(c));
    negatives.push(...wrongHairColors.slice(0, 2).map(c => `${c} hair`));
    negatives.push('different hairstyle');
  }
  
  return negatives;
}

// =====================================================
// SPATIAL-ACTION LOCK ENGINE (Embedded)
// Detects chase/pursuit/follow relationships and enforces positioning
// =====================================================

interface SpatialLockResult {
  detected: boolean;
  actionType: string;
  characters: { name: string; role: string; relativePosition: string }[];
  spatialLockPrompt: string;
  negativePrompts: string[];
}

function analyzeSpatialRelationships(prompt: string): SpatialLockResult {
  const chasePatterns = [
    { regex: /(\w+)\s+(?:is\s+)?chasing\s+(?:a\s+|the\s+)?(\w+)/i, type: 'chase' },
    { regex: /(\w+)\s+(?:is\s+)?pursuing\s+(?:a\s+|the\s+)?(\w+)/i, type: 'pursuit' },
    { regex: /(\w+)\s+(?:is\s+)?following\s+(?:a\s+|the\s+)?(\w+)/i, type: 'follow' },
    { regex: /(\w+)\s+(?:is\s+)?hunting\s+(?:a\s+|the\s+)?(\w+)/i, type: 'hunt' },
    { regex: /(\w+)\s+(?:is\s+)?stalking\s+(?:a\s+|the\s+)?(\w+)/i, type: 'stalk' },
    { regex: /(\w+)\s+(?:is\s+)?fleeing\s+from\s+(?:a\s+|the\s+)?(\w+)/i, type: 'flee' },
    { regex: /(\w+)\s+(?:is\s+)?escaping\s+(?:a\s+|the\s+)?(\w+)/i, type: 'escape' },
    { regex: /(\w+)\s+(?:is\s+)?running\s+from\s+(?:a\s+|the\s+)?(\w+)/i, type: 'flee' },
    { regex: /(\w+)\s+(?:is\s+)?leading\s+(?:a\s+|the\s+)?(\w+)/i, type: 'lead' },
    { regex: /(\w+)\s+(?:is\s+)?after\s+(?:a\s+|the\s+)?(\w+)/i, type: 'chase' },
  ];
  
  for (const { regex, type } of chasePatterns) {
    const match = prompt.match(regex);
    if (match) {
      let pursuer: string, target: string;
      const actor1 = match[1].toLowerCase();
      const actor2 = match[2].toLowerCase();
      
      // Determine roles based on action type
      if (['flee', 'escape'].includes(type)) {
        pursuer = actor2; target = actor1;
      } else if (type === 'lead') {
        pursuer = actor2; target = actor1;
      } else {
        pursuer = actor1; target = actor2;
      }
      
      const pursuerCap = pursuer.charAt(0).toUpperCase() + pursuer.slice(1);
      const targetCap = target.charAt(0).toUpperCase() + target.slice(1);
      const isLeadFollow = type === 'lead' || type === 'follow';
      
      const spatialLockPrompt = isLeadFollow
        ? `[SPATIAL LOCK - MANDATORY POSITIONS]
${targetCap} is AHEAD, leading the movement, positioned in the FRONT HALF of the frame.
${pursuerCap} is BEHIND, following, positioned in the BACK HALF of the frame.
DISTANCE: ${pursuerCap} maintains consistent following distance behind ${targetCap}.
DIRECTION: Both moving in the SAME direction.
CRITICAL: ${pursuerCap} must NEVER be ahead of ${targetCap}.`
        : `[SPATIAL LOCK - MANDATORY CHASE POSITIONS]
${targetCap} is AHEAD, fleeing, positioned in the FRONT/LEADING portion of the frame.
${pursuerCap} is BEHIND, pursuing, positioned in the BACK/TRAILING portion of the frame.
DISTANCE: ${pursuerCap} is pursuing but has NOT caught ${targetCap}. Gap remains.
DIRECTION: Both moving in the SAME direction - ${targetCap} fleeing, ${pursuerCap} chasing.
CRITICAL: ${pursuerCap} must NEVER be ahead of, beside, or passing ${targetCap}.`;
      
      const negativePrompts = isLeadFollow
        ? [
            `${pursuer} ahead of ${target}`, `${pursuer} leading ${target}`,
            `${target} behind ${pursuer}`, `${pursuer} in front`,
            'wrong character order', 'reversed positions',
          ]
        : [
            `${pursuer} ahead of ${target}`, `${pursuer} in front of ${target}`,
            `${pursuer} passing ${target}`, `${pursuer} beside ${target}`,
            `${pursuer} catching ${target}`, `${pursuer} overtaking ${target}`,
            `${target} behind ${pursuer}`, `${pursuer} caught ${target}`,
            'chase over', 'wrong character order', 'reversed chase positions',
          ];
      
      return {
        detected: true,
        actionType: type,
        characters: [
          { name: pursuer, role: isLeadFollow ? 'follower' : 'pursuer', relativePosition: 'behind' },
          { name: target, role: isLeadFollow ? 'leader' : 'target', relativePosition: 'ahead' },
        ],
        spatialLockPrompt,
        negativePrompts,
      };
    }
  }
  
  return {
    detected: false,
    actionType: 'none',
    characters: [],
    spatialLockPrompt: '',
    negativePrompts: [],
  };
}

// =====================================================
// CONTINUITY MANIFEST TYPES (Embedded)
// =====================================================
interface SpatialPosition {
  screenPosition: string;
  depth: string;
  verticalPosition: string;
  facingDirection: string;
  bodyAngle: number;
}

interface LightingState {
  primarySource: {
    type: string;
    direction: string;
    quality: string;
    intensity: string;
  };
  colorTemperature: string;
  colorTint?: string;
  shadowDirection: string;
  ambientLevel: string;
  specialLighting?: string[];
}

interface PropState {
  propId: string;
  name: string;
  heldBy?: string;
  hand?: string;
  state: string;
  position?: string;
  condition?: string;
}

interface PropsInventory {
  characterProps: { characterName: string; props: PropState[] }[];
  environmentProps: { name: string; position: string; state: string }[];
  importantAbsences?: string[];
}

interface EmotionalState {
  primaryEmotion: string;
  intensity: string;
  facialExpression: string;
  bodyLanguage: string;
  breathingState?: string;
  physicalIndicators?: string[];
}

interface ActionMomentum {
  movementDirection: string;
  movementType: string;
  gestureInProgress?: string;
  poseAtCut: string;
  eyeMovement?: string;
  expectedContinuation?: string;
}

interface MicroDetails {
  skin: {
    scars: { location: string; description: string }[];
    wounds: { location: string; freshness: string; description: string }[];
    dirt: { areas: string[]; intensity: string }[];
    sweat: boolean;
    blood?: { areas: string[]; freshness: string }[];
  };
  clothing: {
    tears: { location: string; size: string }[];
    stains: { location: string; type: string; color?: string }[];
    dustLevel: string;
    wetness?: { areas: string[]; level: string }[];
  };
  hair: {
    style: string;
    condition: string;
    wetness?: string;
    debris?: string[];
    windEffect?: string;
  };
  persistentMarkers: string[];
}

interface EnvironmentState {
  weatherVisible: string;
  timeOfDay: string;
  atmospherics: string[];
  backgroundElements: string[];
  surfaceConditions?: string;
}

interface ShotContinuityManifest {
  shotIndex: number;
  projectId: string;
  extractedAt: number;
  spatial: {
    primaryCharacter: SpatialPosition;
    secondaryCharacters?: { characterId: string; position: SpatialPosition }[];
    cameraDistance: string;
    eyeLineDirection?: string;
  };
  lighting: LightingState;
  props: PropsInventory;
  emotional: EmotionalState;
  action: ActionMomentum;
  microDetails: MicroDetails;
  environment: EnvironmentState;
  injectionPrompt: string;
  negativePrompt: string;
  criticalAnchors: string[];
}

// Function to build continuity injection from manifest
function buildContinuityFromManifest(manifest: ShotContinuityManifest): { prompt: string; negative: string } {
  const sections: string[] = [];
  
  // Spatial continuity
  const sp = manifest.spatial;
  if (sp.primaryCharacter) {
    sections.push(
      `[SPATIAL CONTINUITY: Character ${sp.primaryCharacter.screenPosition} of frame, ` +
      `${sp.primaryCharacter.depth}, facing ${sp.primaryCharacter.facingDirection}, ` +
      `${sp.cameraDistance} shot]`
    );
  }
  
  // Lighting continuity
  const lt = manifest.lighting;
  if (lt.primarySource) {
    sections.push(
      `[LIGHTING LOCK: ${lt.primarySource.type} ${lt.primarySource.direction} light, ` +
      `${lt.primarySource.quality} shadows, ${lt.colorTemperature} temperature, ` +
      `${lt.ambientLevel} ambient, shadows ${lt.shadowDirection}]`
    );
  }
  
  // Props continuity
  if (manifest.props?.characterProps?.length > 0) {
    const propList = manifest.props.characterProps
      .flatMap(cp => cp.props.map(p => `${p.name} ${p.state}${p.position ? ' at ' + p.position : ''}`))
      .slice(0, 4)
      .join(', ');
    if (propList) sections.push(`[PROPS LOCK: ${propList}]`);
  }
  
  // Emotional continuity
  const em = manifest.emotional;
  if (em.primaryEmotion) {
    sections.push(
      `[EMOTIONAL CONTINUITY: ${em.intensity} ${em.primaryEmotion}, ` +
      `expression: ${em.facialExpression}, body: ${em.bodyLanguage}]`
    );
    if (em.physicalIndicators?.length) {
      sections.push(`[PHYSICAL STATE: ${em.physicalIndicators.join(', ')}]`);
    }
  }
  
  // Action momentum
  const ac = manifest.action;
  if (ac.movementType && ac.movementType !== 'still') {
    sections.push(
      `[ACTION MOMENTUM: ${ac.movementType} ${ac.movementDirection}, ` +
      `pose: ${ac.poseAtCut}${ac.gestureInProgress ? ', gesture: ' + ac.gestureInProgress : ''}]`
    );
    if (ac.expectedContinuation) {
      sections.push(`[CONTINUES INTO: ${ac.expectedContinuation}]`);
    }
  }
  
  // Micro-details (critical for consistency)
  const md = manifest.microDetails;
  const microList: string[] = [];
  if (md?.skin?.scars?.length > 0) {
    microList.push(...md.skin.scars.slice(0, 2).map(s => `scar on ${s.location}`));
  }
  if (md?.skin?.wounds?.length > 0) {
    microList.push(...md.skin.wounds.slice(0, 2).map(w => `${w.freshness} wound on ${w.location}`));
  }
  if (md?.skin?.dirt?.length > 0) {
    microList.push(`${md.skin.dirt[0].intensity} dirt on ${md.skin.dirt[0].areas.slice(0, 2).join(', ')}`);
  }
  if (md?.clothing?.stains?.length > 0) {
    microList.push(...md.clothing.stains.slice(0, 2).map(s => `${s.type} stain on ${s.location}`));
  }
  if (md?.clothing?.tears?.length > 0) {
    microList.push(...md.clothing.tears.slice(0, 1).map(t => `torn ${t.location}`));
  }
  if (md?.hair?.condition && md.hair.condition !== 'neat') {
    microList.push(`${md.hair.condition} ${md.hair.style} hair`);
  }
  if (md?.hair?.windEffect) {
    microList.push(`hair ${md.hair.windEffect}`);
  }
  if (microList.length > 0) {
    sections.push(`[MICRO-DETAILS LOCK: ${microList.slice(0, 5).join(', ')}]`);
  }
  
  // Persistent markers (MUST maintain)
  if (md?.persistentMarkers?.length > 0) {
    sections.push(`[PERSISTENT MARKERS - MANDATORY: ${md.persistentMarkers.slice(0, 3).join(', ')}]`);
  }
  
  // Environment state
  const env = manifest.environment;
  if (env?.weatherVisible || env?.atmospherics?.length) {
    const envParts: string[] = [];
    if (env.weatherVisible) envParts.push(env.weatherVisible);
    if (env.timeOfDay) envParts.push(env.timeOfDay);
    if (env.atmospherics?.length) envParts.push(...env.atmospherics.slice(0, 2));
    if (env.surfaceConditions) envParts.push(env.surfaceConditions);
    if (envParts.length > 0) {
      sections.push(`[ENVIRONMENT LOCK: ${envParts.join(', ')}]`);
    }
  }
  
  // Critical anchors summary
  if (manifest.criticalAnchors?.length > 0) {
    sections.push(`[CRITICAL ANCHORS - DO NOT CHANGE: ${manifest.criticalAnchors.slice(0, 5).join(', ')}]`);
  }
  
  // Build comprehensive negative prompt
  const negatives: string[] = [
    'character morphing', 'identity change', 'clothing change',
    'lighting direction reversal', 'prop disappearance', 'scar removal',
    'wound healing between shots', 'sudden cleanliness', '180 degree rule violation',
    'position swap', 'emotion jump', 'hair style change',
  ];
  
  // Add position-specific negatives
  if (sp.primaryCharacter?.screenPosition) {
    const pos = sp.primaryCharacter.screenPosition;
    if (pos.includes('left')) negatives.push('character on right side', 'character jumping to right');
    if (pos.includes('right')) negatives.push('character on left side', 'character jumping to left');
  }
  
  // Add lighting-specific negatives
  if (lt.shadowDirection) {
    negatives.push('shadow direction change', 'reversed shadows');
  }
  
  return {
    prompt: sections.join('\n'),
    negative: [...new Set(negatives)].join(', '),
  };
}

interface GenerateSingleClipRequest {
  userId: string;
  projectId: string;
  clipIndex: number;
  prompt: string;
  totalClips: number;
  startImageUrl?: string;
  previousMotionVectors?: {
    endVelocity?: string;
    endDirection?: string;
    cameraMomentum?: string;
  };
  // NEW: Previous shot's continuity manifest for comprehensive consistency
  previousContinuityManifest?: ShotContinuityManifest;
  identityBible?: {
    characterIdentity?: {
      description?: string;
      facialFeatures?: string;
      clothing?: string;
      bodyType?: string;
      distinctiveMarkers?: string[];
    };
    consistencyPrompt?: string;
    consistencyAnchors?: string[];
    storyContext?: {
      fullStory?: string;
      currentBeat?: string;
      emotionalState?: string;
      previousAction?: string;
      nextAction?: string;
    };
    // Enhanced identity bible v2.0 fields
    multiViewUrls?: {
      frontViewUrl?: string;
      sideViewUrl?: string;
      threeQuarterViewUrl?: string;
      backViewUrl?: string;
      silhouetteUrl?: string;
    };
    nonFacialAnchors?: {
      bodyType?: string;
      clothingSignature?: string;
      hairFromBehind?: string;
      silhouetteDescription?: string;
      gait?: string;
      posture?: string;
    };
    occlusionNegatives?: string[];
  };
  colorGrading?: string;
  qualityTier?: 'standard' | 'professional';
  referenceImageUrl?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  // Scene continuity
  sceneContext?: {
    actionPhase: 'establish' | 'initiate' | 'develop' | 'escalate' | 'peak' | 'settle';
    previousAction: string;
    currentAction: string;
    nextAction: string;
    characterDescription: string;
    locationDescription: string;
    lightingDescription: string;
  };
  // Legacy story position
  storyPosition?: 'opening' | 'setup' | 'catalyst' | 'rising' | 'climax' | 'resolution';
  previousClipSummary?: string;
  isRetry?: boolean;
  // Accumulated scene anchors for visual consistency
  accumulatedAnchors?: {
    lighting?: { promptFragment?: string; timeOfDay?: string };
    colorPalette?: { promptFragment?: string; temperature?: string };
    keyObjects?: { promptFragment?: string; environmentType?: string };
    masterConsistencyPrompt?: string;
  }[];
}

interface ClipResult {
  index: number;
  videoUrl: string;
  lastFrameUrl?: string;
  durationSeconds: number;
  status: 'completed' | 'failed';
  error?: string;
  motionVectors?: {
    endVelocity?: string;
    endDirection?: string;
    cameraMomentum?: string;
  };
}

// Get OAuth2 access token from service account
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: exp,
    scope: "https://www.googleapis.com/auth/cloud-platform"
  };

  const base64UrlEncode = (obj: any) => {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Generate a single clip with Veo API
async function generateClip(
  accessToken: string,
  projectId: string,
  prompt: string,
  startImageUrl?: string,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9',
  occlusionNegatives?: string[]
): Promise<{ operationName: string }> {
  const location = "us-central1";
  const model = "veo-3.1-generate-001";
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predictLongRunning`;

  const instance: Record<string, any> = {
    prompt: `${prompt}. High quality, cinematic, realistic physics, natural motion, detailed textures.`,
  };

  if (startImageUrl) {
    try {
      // CRITICAL: Pre-validate URL - reject obvious video URLs before fetching
      const lowerUrl = startImageUrl.toLowerCase();
      if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.mov') || lowerUrl.includes('/video-clips/clip_')) {
        console.error(`[SingleClip] ⚠️ REJECTED: startImageUrl is a VIDEO file, not an image!`);
        console.error(`[SingleClip] URL: ${startImageUrl.substring(0, 100)}...`);
        console.warn(`[SingleClip] Proceeding WITHOUT frame-chaining - Veo requires images, not videos`);
      } else {
        console.log(`[SingleClip] Fetching start image for frame-chaining: ${startImageUrl.substring(0, 100)}...`);
        const imageResponse = await fetch(startImageUrl);
        
        // Check if fetch was successful
        if (!imageResponse.ok) {
          console.error(`[SingleClip] Failed to fetch start image: HTTP ${imageResponse.status} - ${imageResponse.statusText}`);
          console.warn(`[SingleClip] Proceeding WITHOUT frame-chaining due to image fetch failure`);
        } else {
          const contentType = imageResponse.headers.get('content-type') || '';
          console.log(`[SingleClip] Image response content-type: ${contentType}`);
          
          // CRITICAL: Reject video content types - Veo ONLY accepts images
          if (contentType.includes('video/') || contentType.includes('application/octet-stream')) {
            console.error(`[SingleClip] ⚠️ REJECTED: Response is ${contentType}, not an image!`);
            console.warn(`[SingleClip] Proceeding WITHOUT frame-chaining - Veo requires images, not videos`);
          } else if (!contentType.includes('image/')) {
            console.error(`[SingleClip] ⚠️ WARNING: Unexpected content-type: ${contentType}`);
            console.warn(`[SingleClip] Proceeding WITHOUT frame-chaining - content-type is not an image`);
          } else {
            const imageBuffer = await imageResponse.arrayBuffer();
            const uint8Array = new Uint8Array(imageBuffer);
            
            // Validate image size
            if (uint8Array.length < 1000) {
              console.error(`[SingleClip] Image too small (${uint8Array.length} bytes) - likely invalid or error page`);
              console.warn(`[SingleClip] Proceeding WITHOUT frame-chaining due to invalid image`);
            } else if (uint8Array.length > 10000000) {
              // Video files are typically > 1MB, images are usually < 1MB
              console.error(`[SingleClip] ⚠️ File too large (${uint8Array.length} bytes) - likely a video file`);
              console.warn(`[SingleClip] Proceeding WITHOUT frame-chaining - file size indicates video`);
            } else {
              console.log(`[SingleClip] ✓ Valid image size: ${uint8Array.length} bytes`);
              
              let binary = '';
              const chunkSize = 32768;
              for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                binary += String.fromCharCode.apply(null, Array.from(chunk));
              }
              const base64Image = btoa(binary);
              
              // Determine mime type from content-type header
              let mimeType = 'image/jpeg';
              if (contentType.includes('png')) {
                mimeType = 'image/png';
              } else if (contentType.includes('webp')) {
                mimeType = 'image/webp';
              } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                mimeType = 'image/jpeg';
              }
              
              instance.image = {
                bytesBase64Encoded: base64Image,
                mimeType: mimeType
              };
              console.log(`[SingleClip] ✓ Added start image for frame-chaining (${mimeType}, ${base64Image.length} base64 chars)`);
            }
          }
        }
      }
    } catch (imgError) {
      console.error("[SingleClip] Failed to fetch start image:", imgError);
      console.warn(`[SingleClip] Proceeding WITHOUT frame-chaining due to error`);
    }
  }

  // Build negative prompt with occlusion negatives
  const baseNegatives = "blurry, low quality, distorted, artifacts, watermark, text overlay, glitch, jittery motion";
  const identityNegatives = occlusionNegatives && occlusionNegatives.length > 0
    ? `, ${occlusionNegatives.slice(0, 10).join(', ')}`
    : '';
  const fullNegativePrompt = baseNegatives + identityNegatives;
  
  if (occlusionNegatives && occlusionNegatives.length > 0) {
    console.log(`[SingleClip] Added ${Math.min(occlusionNegatives.length, 10)} occlusion negatives to prevent identity drift`);
  }

  const requestBody = {
    instances: [instance],
    parameters: {
      aspectRatio: aspectRatio, // Dynamic based on reference image orientation
      durationSeconds: DEFAULT_CLIP_DURATION,
      sampleCount: 1,
      negativePrompt: fullNegativePrompt,
      resolution: "720p",
      personGeneration: "allow_adult",
    }
  };
  
  console.log(`[SingleClip] Using aspect ratio: ${aspectRatio}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Veo API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const operationName = result.name;
  
  if (!operationName) {
    throw new Error("No operation name in Veo response");
  }

  return { operationName };
}

// Poll for operation completion
async function pollOperation(
  accessToken: string,
  operationName: string,
  maxAttempts = 120,
  pollInterval = 5000
): Promise<{ videoUrl: string }> {
  const match = operationName.match(/projects\/([^\/]+)\/locations\/([^\/]+)\/publishers\/google\/models\/([^\/]+)\/operations\/([^\/]+)/);
  if (!match) {
    throw new Error(`Invalid operation name format: ${operationName}`);
  }
  
  const [, projectId, location, modelId] = match;
  const fetchOperationUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const response = await fetch(fetchOperationUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operationName }),
    });
    
    if (!response.ok) {
      console.log(`[SingleClip] Poll attempt ${attempt + 1}: ${response.status}`);
      continue;
    }
    
    const result = await response.json();
    
    if (result.done) {
      if (result.error) {
        throw new Error(`Veo generation failed: ${result.error.message}`);
      }
      
      if (result.response?.raiMediaFilteredCount > 0) {
        throw new Error("Content filter blocked generation. Prompt needs rephrasing.");
      }
      
      let videoUri = result.response?.generatedSamples?.[0]?.video?.uri ||
                     result.response?.videos?.[0]?.gcsUri ||
                     result.response?.videos?.[0]?.uri;
      
      if (!videoUri) {
        const base64Data = result.response?.videos?.[0]?.bytesBase64Encoded ||
                          result.response?.generatedSamples?.[0]?.video?.bytesBase64Encoded;
        if (base64Data) {
          console.log(`[SingleClip] Video returned as base64 (${base64Data.length} chars)`);
          return { videoUrl: "base64:" + base64Data };
        }
        throw new Error("No video URI in completed response");
      }
      
      const videoUrl = videoUri.startsWith("gs://") 
        ? `https://storage.googleapis.com/${videoUri.slice(5)}`
        : videoUri;
      
      console.log(`[SingleClip] Clip completed: ${videoUrl.substring(0, 80)}...`);
      return { videoUrl };
    }
    
    const progress = result.metadata?.progressPercent || 0;
    console.log(`[SingleClip] Poll attempt ${attempt + 1}: ${progress}% complete`);
  }
  
  throw new Error("Operation timed out after maximum polling attempts");
}

// Download video to Supabase storage
async function downloadToStorage(
  supabase: any,
  videoUrl: string,
  projectId: string,
  clipIndex: number
): Promise<string> {
  const fileName = `clip_${projectId}_${clipIndex}_${Date.now()}.mp4`;
  let bytes: Uint8Array;
  
  if (videoUrl.startsWith("base64:")) {
    const base64Data = videoUrl.slice(7);
    console.log(`[SingleClip] Converting base64 video to storage (${base64Data.length} chars)`);
    bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  } else if (videoUrl.startsWith("data:")) {
    const matches = videoUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!matches) throw new Error("Invalid data URL format");
    bytes = Uint8Array.from(atob(matches[1]), c => c.charCodeAt(0));
  } else {
    console.log(`[SingleClip] Downloading video from: ${videoUrl.substring(0, 80)}...`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }
    const videoBuffer = await response.arrayBuffer();
    bytes = new Uint8Array(videoBuffer);
  }
  
  console.log(`[SingleClip] Uploading ${bytes.length} bytes to storage`);
  
  const { error } = await supabase.storage
    .from('video-clips')
    .upload(fileName, bytes, {
      contentType: 'video/mp4',
      upsert: true
    });
  
  if (error) {
    throw new Error(`Failed to upload clip to storage: ${error.message}`);
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/video-clips/${fileName}`;
  console.log(`[SingleClip] Clip stored: ${publicUrl}`);
  return publicUrl;
}

// Extract motion vectors from prompt
function extractMotionVectors(prompt: string): ClipResult['motionVectors'] {
  type MovementVectors = { velocity: string; direction: string; camera?: string };
  const movements: Record<string, MovementVectors> = {
    walk: { velocity: 'moderate walking pace', direction: 'forward' },
    run: { velocity: 'rapid sprint', direction: 'forward' },
    pan: { velocity: 'slow', direction: 'lateral', camera: 'panning' },
    dolly: { velocity: 'smooth glide', direction: 'forward', camera: 'dolly' },
    static: { velocity: 'stationary', direction: 'none', camera: 'locked' },
    fly: { velocity: 'soaring', direction: 'upward' },
    chase: { velocity: 'rapid pursuit', direction: 'forward' },
  };
  
  const promptLower = prompt.toLowerCase();
  
  for (const [key, vectors] of Object.entries(movements)) {
    if (promptLower.includes(key)) {
      return {
        endVelocity: vectors.velocity,
        endDirection: vectors.direction,
        cameraMomentum: vectors.camera || 'following',
      };
    }
  }
  
  return {
    endVelocity: 'steady',
    endDirection: 'continuous',
    cameraMomentum: 'smooth transition',
  };
}

// =====================================================
// CONTENT SAFETY PRE-CHECK + AI GUARDRAILS
// Scans prompts for words that may trigger Google's content policy
// Uses AI to rephrase when needed
// =====================================================
interface ContentSafetyResult {
  isSafe: boolean;
  flaggedTerms: string[];
  sanitizedPrompt: string;
  warnings: string[];
  requiresAIRephrase: boolean;
}

// Words/patterns that commonly trigger Google's Responsible AI filters
// COMPREHENSIVE list based on actual Vertex AI rejections
const FLAGGED_PATTERNS: { pattern: RegExp; replacement: string; category: string }[] = [
  // Age-related terms (high sensitivity)
  { pattern: /\bchildren\b/gi, replacement: 'people', category: 'age' },
  { pattern: /\bchild\b/gi, replacement: 'person', category: 'age' },
  { pattern: /\bkids\b/gi, replacement: 'people', category: 'age' },
  { pattern: /\bkid\b/gi, replacement: 'person', category: 'age' },
  { pattern: /\bminors?\b/gi, replacement: 'people', category: 'age' },
  { pattern: /\bteenagers?\b/gi, replacement: 'young adults', category: 'age' },
  { pattern: /\bteens?\b/gi, replacement: 'young adults', category: 'age' },
  { pattern: /\badolescents?\b/gi, replacement: 'young adults', category: 'age' },
  { pattern: /\btoddlers?\b/gi, replacement: 'people', category: 'age' },
  { pattern: /\binfants?\b/gi, replacement: 'people', category: 'age' },
  { pattern: /\bbabies\b/gi, replacement: 'people', category: 'age' },
  { pattern: /\bbaby\b/gi, replacement: 'person', category: 'age' },
  { pattern: /\byoungsters?\b/gi, replacement: 'people', category: 'age' },
  { pattern: /\bjuveniles?\b/gi, replacement: 'people', category: 'age' },
  { pattern: /\bunderaged?\b/gi, replacement: '', category: 'age' },
  { pattern: /\bschoolchildren\b/gi, replacement: 'students', category: 'age' },
  { pattern: /\bschoolkids?\b/gi, replacement: 'students', category: 'age' },
  { pattern: /\bschool\s*girl\b/gi, replacement: 'student', category: 'age' },
  { pattern: /\bschool\s*boy\b/gi, replacement: 'student', category: 'age' },
  { pattern: /\blittle\s+(boy|girl|one)\b/gi, replacement: 'person', category: 'age' },
  { pattern: /\byoung\s+(boy|girl)\b/gi, replacement: 'young person', category: 'age' },
  
  // Family terms that may imply children
  { pattern: /\bfamily\b/gi, replacement: 'group of adults', category: 'family' },
  { pattern: /\bfamilies\b/gi, replacement: 'groups of people', category: 'family' },
  { pattern: /\bparents?\s+(and|with)\s+(children|kids)\b/gi, replacement: 'adults', category: 'family' },
  
  // Violence/weapon terms (expanded)
  { pattern: /\bblood\b/gi, replacement: 'red liquid', category: 'violence' },
  { pattern: /\bbloody\b/gi, replacement: 'dramatic', category: 'violence' },
  { pattern: /\bgore\b/gi, replacement: 'dramatic effect', category: 'violence' },
  { pattern: /\bkill(ing|ed|s)?\b/gi, replacement: 'defeat', category: 'violence' },
  { pattern: /\bmurder(ing|ed|s)?\b/gi, replacement: 'confront', category: 'violence' },
  { pattern: /\bweapons?\b/gi, replacement: 'equipment', category: 'violence' },
  { pattern: /\bguns?\b/gi, replacement: 'tools', category: 'violence' },
  { pattern: /\bfirearms?\b/gi, replacement: 'equipment', category: 'violence' },
  { pattern: /\bknives?\b/gi, replacement: 'tools', category: 'violence' },
  { pattern: /\bexplosives?\b/gi, replacement: 'effects', category: 'violence' },
  { pattern: /\bexplod(e|ing|ed)\b/gi, replacement: 'burst', category: 'violence' },
  { pattern: /\bdead\b/gi, replacement: 'fallen', category: 'violence' },
  { pattern: /\bdeath\b/gi, replacement: 'end', category: 'violence' },
  { pattern: /\bdying\b/gi, replacement: 'fading', category: 'violence' },
  { pattern: /\bdie\b/gi, replacement: 'fall', category: 'violence' },
  { pattern: /\bdies\b/gi, replacement: 'falls', category: 'violence' },
  { pattern: /\bstab(bed|bing|s)?\b/gi, replacement: 'strike', category: 'violence' },
  { pattern: /\bshoot(ing|s)?\b/gi, replacement: 'aim', category: 'violence' },
  { pattern: /\bshot\b/gi, replacement: 'hit', category: 'violence' },
  { pattern: /\bwounds?\b/gi, replacement: 'marks', category: 'violence' },
  { pattern: /\bwounded\b/gi, replacement: 'marked', category: 'violence' },
  { pattern: /\binjur(y|ies|ed)\b/gi, replacement: 'affected', category: 'violence' },
  { pattern: /\bhurt\b/gi, replacement: 'affected', category: 'violence' },
  { pattern: /\bpain\b/gi, replacement: 'sensation', category: 'violence' },
  { pattern: /\bsuffer(ing|s|ed)?\b/gi, replacement: 'experience', category: 'violence' },
  { pattern: /\btorture\b/gi, replacement: 'struggle', category: 'violence' },
  { pattern: /\battack(ing|ed|s)?\b/gi, replacement: 'approach', category: 'violence' },
  { pattern: /\bfight(ing|s)?\b/gi, replacement: 'engage', category: 'violence' },
  { pattern: /\bfought\b/gi, replacement: 'engaged', category: 'violence' },
  { pattern: /\bbattle\b/gi, replacement: 'encounter', category: 'violence' },
  { pattern: /\bwar\b/gi, replacement: 'conflict', category: 'violence' },
  { pattern: /\bwarfare\b/gi, replacement: 'conflict', category: 'violence' },
  { pattern: /\bcombat\b/gi, replacement: 'action', category: 'violence' },
  { pattern: /\bviolent\b/gi, replacement: 'intense', category: 'violence' },
  { pattern: /\bviolence\b/gi, replacement: 'tension', category: 'violence' },
  { pattern: /\bbrutal\b/gi, replacement: 'powerful', category: 'violence' },
  { pattern: /\bsavage\b/gi, replacement: 'wild', category: 'violence' },
  { pattern: /\bvicious\b/gi, replacement: 'fierce', category: 'violence' },
  { pattern: /\bdestroy(ed|ing|s)?\b/gi, replacement: 'overcome', category: 'violence' },
  { pattern: /\bdestruction\b/gi, replacement: 'change', category: 'violence' },
  { pattern: /\bcorpse\b/gi, replacement: 'figure', category: 'violence' },
  { pattern: /\bbodies\b/gi, replacement: 'figures', category: 'violence' },
  { pattern: /\bbody\b/gi, replacement: 'figure', category: 'violence' },
  { pattern: /\bscream(ing|s|ed)?\b/gi, replacement: 'call', category: 'violence' },
  { pattern: /\bcrash(ing|ed|es)?\b/gi, replacement: 'collide', category: 'violence' },
  { pattern: /\bsmash(ing|ed|es)?\b/gi, replacement: 'break', category: 'violence' },
  { pattern: /\bcollapse\b/gi, replacement: 'fall', category: 'violence' },
  { pattern: /\bblast(ing|ed|s)?\b/gi, replacement: 'burst', category: 'violence' },
  
  // Specific weapon types
  { pattern: /\brifle\b/gi, replacement: 'equipment', category: 'weapons' },
  { pattern: /\bpistol\b/gi, replacement: 'tool', category: 'weapons' },
  { pattern: /\bshotgun\b/gi, replacement: 'equipment', category: 'weapons' },
  { pattern: /\bmachine\s*gun\b/gi, replacement: 'equipment', category: 'weapons' },
  { pattern: /\bassault\s*rifle\b/gi, replacement: 'equipment', category: 'weapons' },
  { pattern: /\bsniper\b/gi, replacement: 'observer', category: 'weapons' },
  { pattern: /\bsword\b/gi, replacement: 'blade', category: 'weapons' },
  { pattern: /\bdagger\b/gi, replacement: 'tool', category: 'weapons' },
  { pattern: /\baxe\b/gi, replacement: 'tool', category: 'weapons' },
  { pattern: /\bbow\s+and\s+arrow\b/gi, replacement: 'equipment', category: 'weapons' },
  { pattern: /\barrow\b/gi, replacement: 'projectile', category: 'weapons' },
  { pattern: /\bbomb\b/gi, replacement: 'device', category: 'weapons' },
  { pattern: /\bgrenade\b/gi, replacement: 'object', category: 'weapons' },
  { pattern: /\bmissile\b/gi, replacement: 'object', category: 'weapons' },
  { pattern: /\brocket\b/gi, replacement: 'object', category: 'weapons' },
  { pattern: /\bbullet\b/gi, replacement: 'projectile', category: 'weapons' },
  { pattern: /\bammunition\b/gi, replacement: 'supplies', category: 'weapons' },
  { pattern: /\bammo\b/gi, replacement: 'supplies', category: 'weapons' },
  
  // Sexual/suggestive terms (expanded)
  { pattern: /\bsex(y|ual|ually)?\b/gi, replacement: 'attractive', category: 'sexual' },
  { pattern: /\bnude\b/gi, replacement: 'natural', category: 'sexual' },
  { pattern: /\bnaked\b/gi, replacement: 'unclothed', category: 'sexual' },
  { pattern: /\bexplicit\b/gi, replacement: 'detailed', category: 'sexual' },
  { pattern: /\berotic\b/gi, replacement: 'romantic', category: 'sexual' },
  { pattern: /\bseductive\b/gi, replacement: 'charming', category: 'sexual' },
  { pattern: /\bsensual\b/gi, replacement: 'emotional', category: 'sexual' },
  { pattern: /\bintimate\b/gi, replacement: 'close', category: 'sexual' },
  { pattern: /\bundressed\b/gi, replacement: 'casual', category: 'sexual' },
  { pattern: /\bprovocative\b/gi, replacement: 'striking', category: 'sexual' },
  { pattern: /\bsuggestive\b/gi, replacement: 'expressive', category: 'sexual' },
  { pattern: /\blust(ful|y)?\b/gi, replacement: 'passionate', category: 'sexual' },
  { pattern: /\bsexuali[zs](ed|ing)?\b/gi, replacement: 'styled', category: 'sexual' },
  { pattern: /\bstripper\b/gi, replacement: 'dancer', category: 'sexual' },
  { pattern: /\bstrip(ping|ped)?\b/gi, replacement: 'reveal', category: 'sexual' },
  { pattern: /\blingerie\b/gi, replacement: 'elegant attire', category: 'sexual' },
  { pattern: /\bunderwear\b/gi, replacement: 'casual wear', category: 'sexual' },
  { pattern: /\bbikini\b/gi, replacement: 'swimwear', category: 'sexual' },
  { pattern: /\bcleavage\b/gi, replacement: 'neckline', category: 'sexual' },
  { pattern: /\bbreast\b/gi, replacement: 'chest', category: 'sexual' },
  { pattern: /\bbutt\b/gi, replacement: 'silhouette', category: 'sexual' },
  { pattern: /\bbuttocks\b/gi, replacement: 'silhouette', category: 'sexual' },
  { pattern: /\bthigh\b/gi, replacement: 'leg', category: 'sexual' },
  
  // Drug/substance terms
  { pattern: /\bdrugs?\b/gi, replacement: 'substances', category: 'drugs' },
  { pattern: /\bcocaine\b/gi, replacement: 'powder', category: 'drugs' },
  { pattern: /\bheroin\b/gi, replacement: 'substance', category: 'drugs' },
  { pattern: /\bmarijuana\b/gi, replacement: 'plant', category: 'drugs' },
  { pattern: /\bweed\b/gi, replacement: 'plant', category: 'drugs' },
  { pattern: /\bsmok(e|ing)\s+weed\b/gi, replacement: 'relaxing', category: 'drugs' },
  { pattern: /\bcrack\b/gi, replacement: 'substance', category: 'drugs' },
  { pattern: /\bmeth\b/gi, replacement: 'substance', category: 'drugs' },
  { pattern: /\bopioid\b/gi, replacement: 'substance', category: 'drugs' },
  { pattern: /\boverdose\b/gi, replacement: 'incident', category: 'drugs' },
  { pattern: /\baddiction\b/gi, replacement: 'habit', category: 'drugs' },
  { pattern: /\baddicted\b/gi, replacement: 'attached', category: 'drugs' },
  { pattern: /\bhigh\s+on\b/gi, replacement: 'affected by', category: 'drugs' },
  { pattern: /\bstoned\b/gi, replacement: 'dazed', category: 'drugs' },
  { pattern: /\bdrunk\b/gi, replacement: 'dazed', category: 'drugs' },
  { pattern: /\bintoxicated\b/gi, replacement: 'affected', category: 'drugs' },
  
  // Hate/discrimination/extremism terms
  { pattern: /\bterrorist?\b/gi, replacement: 'antagonist', category: 'hate' },
  { pattern: /\bterrorism\b/gi, replacement: 'conflict', category: 'hate' },
  { pattern: /\bracist\b/gi, replacement: 'biased', category: 'hate' },
  { pattern: /\bhate\s+crime\b/gi, replacement: 'incident', category: 'hate' },
  { pattern: /\bextremist\b/gi, replacement: 'radical', category: 'hate' },
  { pattern: /\bsupremacist\b/gi, replacement: 'radical', category: 'hate' },
  { pattern: /\bnazi\b/gi, replacement: 'soldier', category: 'hate' },
  { pattern: /\bswastika\b/gi, replacement: 'symbol', category: 'hate' },
  { pattern: /\bjihad\b/gi, replacement: 'mission', category: 'hate' },
  { pattern: /\bklan\b/gi, replacement: 'group', category: 'hate' },
  { pattern: /\bisis\b/gi, replacement: 'group', category: 'hate' },
  { pattern: /\bal[- ]?qaeda\b/gi, replacement: 'group', category: 'hate' },
  
  // Self-harm/mental health sensitive terms
  { pattern: /\bsuicide\b/gi, replacement: 'crisis', category: 'selfharm' },
  { pattern: /\bself[- ]?harm\b/gi, replacement: 'distress', category: 'selfharm' },
  { pattern: /\bcutting\b/gi, replacement: 'marking', category: 'selfharm' },
  { pattern: /\bhanging\b/gi, replacement: 'suspended', category: 'selfharm' },
  { pattern: /\bjumping\s+(off|from)\s+\w+\b/gi, replacement: 'at a high place', category: 'selfharm' },
  
  // Dangerous activities
  { pattern: /\breckless\b/gi, replacement: 'bold', category: 'danger' },
  { pattern: /\bdangerous\b/gi, replacement: 'challenging', category: 'danger' },
  { pattern: /\bhazardous\b/gi, replacement: 'difficult', category: 'danger' },
  { pattern: /\blethal\b/gi, replacement: 'potent', category: 'danger' },
  { pattern: /\bdeadly\b/gi, replacement: 'powerful', category: 'danger' },
  { pattern: /\bfatal\b/gi, replacement: 'serious', category: 'danger' },
  
  // Crime-related terms
  { pattern: /\bsteal(ing|s)?\b/gi, replacement: 'take', category: 'crime' },
  { pattern: /\bstole\b/gi, replacement: 'took', category: 'crime' },
  { pattern: /\brob(bing|bed|s)?\b/gi, replacement: 'take from', category: 'crime' },
  { pattern: /\brobbery\b/gi, replacement: 'incident', category: 'crime' },
  { pattern: /\btheft\b/gi, replacement: 'incident', category: 'crime' },
  { pattern: /\bthief\b/gi, replacement: 'person', category: 'crime' },
  { pattern: /\bcriminal\b/gi, replacement: 'person', category: 'crime' },
  { pattern: /\bcrime\b/gi, replacement: 'incident', category: 'crime' },
  { pattern: /\billegal\b/gi, replacement: 'unofficial', category: 'crime' },
  { pattern: /\bkidnap(ping|ped|s)?\b/gi, replacement: 'take', category: 'crime' },
  { pattern: /\babduct(ed|ing|ion)?\b/gi, replacement: 'take', category: 'crime' },
  { pattern: /\bhostage\b/gi, replacement: 'person', category: 'crime' },
  { pattern: /\bprison(er)?\b/gi, replacement: 'person', category: 'crime' },
  { pattern: /\bjail\b/gi, replacement: 'building', category: 'crime' },
  { pattern: /\barrest(ed|ing)?\b/gi, replacement: 'stop', category: 'crime' },
  { pattern: /\bhandcuffs?\b/gi, replacement: 'restraints', category: 'crime' },
  
  // Horror/scary terms that may trigger filters
  { pattern: /\bhorror\b/gi, replacement: 'suspense', category: 'horror' },
  { pattern: /\bterrif(y|ying|ied)\b/gi, replacement: 'intense', category: 'horror' },
  { pattern: /\bterror\b/gi, replacement: 'tension', category: 'horror' },
  { pattern: /\bfrightening\b/gi, replacement: 'surprising', category: 'horror' },
  { pattern: /\bscar(y|ier|iest)\b/gi, replacement: 'dramatic', category: 'horror' },
  { pattern: /\bcreepy\b/gi, replacement: 'mysterious', category: 'horror' },
  { pattern: /\bdemon\b/gi, replacement: 'dark figure', category: 'horror' },
  { pattern: /\bdevil\b/gi, replacement: 'dark figure', category: 'horror' },
  { pattern: /\bsatan\b/gi, replacement: 'dark figure', category: 'horror' },
  { pattern: /\bpossess(ed|ion)?\b/gi, replacement: 'affected', category: 'horror' },
  { pattern: /\bzombie\b/gi, replacement: 'figure', category: 'horror' },
  { pattern: /\bmonster\b/gi, replacement: 'creature', category: 'horror' },
  { pattern: /\bghost\b/gi, replacement: 'spirit', category: 'horror' },
  { pattern: /\bhaunt(ed|ing)?\b/gi, replacement: 'mysterious', category: 'horror' },
  { pattern: /\bnightmare\b/gi, replacement: 'dream', category: 'horror' },
];

// Terms that indicate prompt needs AI rephrasing even after sanitization
const HIGH_RISK_INDICATORS = [
  /\b(sniper|assassin|hitman|executioner)\b/i,
  /\b(massacre|slaughter|genocide)\b/i,
  /\b(torture|torment|abuse)\b/i,
  /\b(rape|assault|molest)\b/i,
  /\b(slave|slavery|enslave)\b/i,
  /\b(lynch|hanging|execution)\b/i,
  /\b(isis|taliban|al[- ]?qaeda|hamas)\b/i,
  /\b(nazi|fascist|white\s*supremac)\b/i,
  /\b(concentration\s*camp|holocaust)\b/i,
  /\b(school\s*shooting|mass\s*shooting)\b/i,
  /\b(bomb\s*threat|bomb\s*making)\b/i,
  /\b(self[- ]?harm|cut\s*myself|suicide)\b/i,
];

function checkContentSafety(prompt: string): ContentSafetyResult {
  const flaggedTerms: string[] = [];
  const warnings: string[] = [];
  let sanitizedPrompt = prompt;
  let requiresAIRephrase = false;
  
  // Check for high-risk indicators that require AI rephrasing
  for (const indicator of HIGH_RISK_INDICATORS) {
    if (indicator.test(prompt)) {
      requiresAIRephrase = true;
      console.log(`[ContentSafety] HIGH RISK indicator detected: ${prompt.match(indicator)?.[0]}`);
      break;
    }
  }
  
  for (const { pattern, replacement, category } of FLAGGED_PATTERNS) {
    const matches = prompt.match(pattern);
    if (matches) {
      for (const match of matches) {
        if (!flaggedTerms.includes(match.toLowerCase())) {
          flaggedTerms.push(match.toLowerCase());
          warnings.push(`"${match}" (${category}) → replaced with "${replacement || '[removed]'}"`);
        }
      }
      sanitizedPrompt = sanitizedPrompt.replace(pattern, replacement);
    }
  }
  
  // If too many terms were flagged, suggest AI rephrasing
  if (flaggedTerms.length >= 5) {
    requiresAIRephrase = true;
    console.log(`[ContentSafety] Many flagged terms (${flaggedTerms.length}) - recommending AI rephrase`);
  }
  
  // Clean up extra spaces from removals
  sanitizedPrompt = sanitizedPrompt.replace(/\s{2,}/g, ' ').trim();
  
  return {
    isSafe: flaggedTerms.length === 0,
    flaggedTerms,
    sanitizedPrompt,
    warnings,
    requiresAIRephrase,
  };
}

// =====================================================
// AI-POWERED PROMPT REPHRASING
// Uses Lovable AI to intelligently rephrase prompts
// =====================================================
async function aiRephrasePrompt(originalPrompt: string, sanitizedPrompt: string, flaggedTerms: string[]): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.warn("[ContentSafety] LOVABLE_API_KEY not configured - using basic sanitization only");
    return sanitizedPrompt;
  }
  
  try {
    console.log(`[ContentSafety] AI rephrasing prompt with ${flaggedTerms.length} flagged terms...`);
    
    const systemPrompt = `You are a video prompt specialist. Your task is to rephrase video generation prompts to avoid content policy violations while preserving the cinematic intent.

RULES:
1. PRESERVE the core visual story and action
2. REMOVE or REPLACE violence, weapons, adult content, dangerous activities
3. KEEP character descriptions, settings, camera movements, lighting
4. Make the prompt suitable for Google's Vertex AI video generation
5. Use cinematic, professional language
6. Maintain the dramatic tension through visuals, not violence
7. Output ONLY the rephrased prompt, no explanations`;

    const userPrompt = `Rephrase this video prompt to be content-safe while preserving cinematic intent:

ORIGINAL PROMPT:
${originalPrompt}

FLAGGED TERMS: ${flaggedTerms.join(', ')}

OUTPUT ONLY THE REPHRASED PROMPT:`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ContentSafety] AI rephrase failed: ${response.status} - ${errorText}`);
      return sanitizedPrompt;
    }
    
    const data = await response.json();
    const rephrasedPrompt = data.choices?.[0]?.message?.content?.trim();
    
    if (rephrasedPrompt && rephrasedPrompt.length > 20) {
      console.log(`[ContentSafety] ✓ AI rephrased successfully: "${rephrasedPrompt.substring(0, 100)}..."`);
      return rephrasedPrompt;
    }
    
    return sanitizedPrompt;
  } catch (error) {
    console.error("[ContentSafety] AI rephrase error:", error);
    return sanitizedPrompt;
  }
}

// =====================================================
// RETRY WITH REPHRASE
// Called when Veo rejects a prompt - attempts AI rephrase and retry
// =====================================================
async function retryWithRephrasedPrompt(
  originalPrompt: string,
  accessToken: string,
  gcpProjectId: string,
  startImageUrl?: string,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9',
  negatives?: string[]
): Promise<{ operationName: string; rephrasedPrompt: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("Cannot retry - LOVABLE_API_KEY not configured for AI rephrasing");
  }
  
  console.log(`[ContentSafety] Generating alternative safe prompt via AI...`);
  
  // Generate a completely new safe prompt that captures the essence
  const systemPrompt = `You are a video prompt expert. Create a COMPLETELY NEW video prompt that captures the same visual story but is 100% safe for Google's AI video generator.

STRICT RULES:
1. NO violence, weapons, fighting, attacks, or physical confrontation
2. NO blood, injuries, death, or physical harm  
3. NO sexual content, nudity, or suggestive poses
4. NO drugs, alcohol, or substance use
5. NO criminal activities or illegal actions
6. NO children in any context
7. NO horror elements, demons, or disturbing imagery
8. Use ONLY safe, professional cinematic descriptions
9. Focus on: landscapes, architecture, nature, travel, fashion, sports, dance, art
10. Describe camera movements, lighting, and mood instead of actions

OUTPUT ONLY THE NEW PROMPT, nothing else.`;

  const userPrompt = `The following prompt was rejected by Google's content filter. Create a SAFE alternative that captures similar visual energy and story mood:

REJECTED PROMPT:
${originalPrompt}

Create a completely new, safe video prompt that captures a similar cinematic feel:`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI rephrase failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    const rephrasedPrompt = data.choices?.[0]?.message?.content?.trim();
    
    if (!rephrasedPrompt || rephrasedPrompt.length < 20) {
      throw new Error("AI returned empty or invalid rephrased prompt");
    }
    
    console.log(`[ContentSafety] ✓ AI generated safe alternative: "${rephrasedPrompt.substring(0, 100)}..."`);
    
    // Now try to generate with the rephrased prompt
    const location = "us-central1";
    const model = "veo-3.1-generate-001";
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/${location}/publishers/google/models/${model}:predictLongRunning`;
    
    const instance: Record<string, any> = {
      prompt: `${rephrasedPrompt}. High quality, cinematic, realistic physics, natural motion, detailed textures.`,
    };
    
    // Note: We don't add startImageUrl here since the prompt has changed significantly
    // The visual continuity would be broken anyway
    
    const requestBody = {
      instances: [instance],
      parameters: {
        aspectRatio: aspectRatio,
        durationSeconds: 6,
        sampleCount: 1,
        negativePrompt: "blurry, low quality, distorted, artifacts, watermark, text overlay",
        resolution: "720p",
        personGeneration: "allow_adult",
      }
    };
    
    const veoResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!veoResponse.ok) {
      const errorText = await veoResponse.text();
      throw new Error(`Veo API error on retry: ${veoResponse.status} - ${errorText}`);
    }
    
    const result = await veoResponse.json();
    const operationName = result.name;
    
    if (!operationName) {
      throw new Error("No operation name in Veo response on retry");
    }
    
    return { operationName, rephrasedPrompt };
  } catch (error) {
    console.error("[ContentSafety] Retry with rephrase failed:", error);
    throw error;
  }
}

// Build velocity-aware prompt
function injectVelocityContinuity(
  prompt: string,
  previousMotionVectors?: ClipResult['motionVectors']
): string {
  if (!previousMotionVectors) return prompt;
  
  const continuityPrefix = `[MOTION CONTINUITY: Subject maintains ${previousMotionVectors.endVelocity} moving ${previousMotionVectors.endDirection}, camera ${previousMotionVectors.cameraMomentum}]`;
  return `${continuityPrefix} ${prompt}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: GenerateSingleClipRequest = await req.json();
    
    console.log(`[SingleClip] Generating clip ${request.clipIndex + 1}/${request.totalClips} for project ${request.projectId}`);
    
    if (!request.userId || !request.projectId) {
      throw new Error("userId and projectId are required");
    }
    
    if (request.clipIndex === undefined || !request.prompt) {
      throw new Error("clipIndex and prompt are required");
    }

    // Get service account
    const serviceAccountJson = Deno.env.get("GOOGLE_VERTEX_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT is not configured");
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error("Invalid GOOGLE_VERTEX_SERVICE_ACCOUNT JSON format");
    }

    const gcpProjectId = serviceAccount.project_id;
    if (!gcpProjectId) {
      throw new Error("project_id not found in service account");
    }

    // =====================================================
    // CONTENT SAFETY PRE-CHECK: Sanitize prompt before sending to Veo
    // =====================================================
    const safetyCheck = checkContentSafety(request.prompt);
    
    if (!safetyCheck.isSafe) {
      console.log(`[SingleClip] ⚠️ CONTENT SAFETY: Found ${safetyCheck.flaggedTerms.length} potentially flagged terms`);
      for (const warning of safetyCheck.warnings) {
        console.log(`[SingleClip]   → ${warning}`);
      }
      console.log(`[SingleClip] Original: "${request.prompt.substring(0, 100)}..."`);
      console.log(`[SingleClip] Sanitized: "${safetyCheck.sanitizedPrompt.substring(0, 100)}..."`);
      
      // Update the clip record with the sanitized prompt
      await supabase
        .from('video_clips')
        .update({ 
          prompt: safetyCheck.sanitizedPrompt,
          corrective_prompts: [request.prompt] // Store original as reference
        })
        .eq('project_id', request.projectId)
        .eq('shot_index', request.clipIndex);
    }
    
    const safePrompt = safetyCheck.sanitizedPrompt;

    // =====================================================
    // SPATIAL-ACTION LOCK: Detect and enforce multi-character positioning
    // Solves "lion passing gazelle" problem
    // =====================================================
    let spatialLockPrompt = '';
    let spatialNegatives: string[] = [];
    
    try {
      const spatialResult = await analyzeSpatialRelationships(safePrompt);
      if (spatialResult.detected) {
        spatialLockPrompt = spatialResult.spatialLockPrompt;
        spatialNegatives = spatialResult.negativePrompts;
        console.log(`[SingleClip] 🔒 SPATIAL LOCK: ${spatialResult.actionType} detected`);
        console.log(`[SingleClip]   Characters: ${spatialResult.characters.map((c: any) => `${c.name} (${c.role}: ${c.relativePosition})`).join(', ')}`);
        console.log(`[SingleClip]   Negatives: ${spatialNegatives.slice(0, 3).join(', ')}...`);
      }
    } catch (spatialErr) {
      console.warn(`[SingleClip] Spatial analysis skipped:`, spatialErr);
    }

    // =====================================================
    // SCENE-BASED CONTINUOUS FLOW: Inject scene context for clip continuity
    // =====================================================
    let enhancedPrompt = safePrompt;
    const continuityParts: string[] = [];
    let manifestNegatives: string[] = [];
    
    // =====================================================
    // CONTINUITY MANIFEST INJECTION (HIGHEST PRIORITY)
    // Uses AI-extracted spatial, lighting, props, emotional, and action data
    // =====================================================
    if (request.previousContinuityManifest) {
      const manifest = request.previousContinuityManifest;
      console.log(`[SingleClip] 🎬 CONTINUITY MANIFEST detected from shot ${manifest.shotIndex}`);
      
      try {
        const continuityInjection = buildContinuityFromManifest(manifest);
        
        if (continuityInjection.prompt) {
          continuityParts.push(`[CONTINUITY MANIFEST FROM SHOT ${manifest.shotIndex} - MANDATORY MATCH]`);
          continuityParts.push(continuityInjection.prompt);
          continuityParts.push(`[END CONTINUITY MANIFEST]`);
          console.log(`[SingleClip] ✓ Injected comprehensive continuity manifest with ${manifest.criticalAnchors?.length || 0} critical anchors`);
        }
        
        if (continuityInjection.negative) {
          manifestNegatives = continuityInjection.negative.split(', ').filter(n => n.trim());
          console.log(`[SingleClip] ✓ Added ${manifestNegatives.length} manifest-based negative prompts`);
        }
        
        // Log key continuity elements
        if (manifest.spatial?.primaryCharacter) {
          console.log(`[SingleClip]   Spatial: ${manifest.spatial.primaryCharacter.screenPosition}, ${manifest.spatial.primaryCharacter.depth}`);
        }
        if (manifest.lighting?.colorTemperature) {
          console.log(`[SingleClip]   Lighting: ${manifest.lighting.colorTemperature}, shadows ${manifest.lighting.shadowDirection || 'unspecified'}`);
        }
        if (manifest.emotional?.primaryEmotion) {
          console.log(`[SingleClip]   Emotion: ${manifest.emotional.intensity} ${manifest.emotional.primaryEmotion}`);
        }
        if (manifest.action?.movementType) {
          console.log(`[SingleClip]   Action: ${manifest.action.movementType} ${manifest.action.movementDirection}`);
        }
      } catch (manifestErr) {
        console.warn(`[SingleClip] Failed to process continuity manifest:`, manifestErr);
      }
    }
    
    // INJECT SPATIAL LOCK (for multi-character chase/follow scenes)
    if (spatialLockPrompt) {
      continuityParts.push(spatialLockPrompt);
    }
    
    // NEW: Scene context for continuous flow (takes priority)
    // ENHANCED: Stronger SCENE LOCK enforcement with visual anchors
    if (request.sceneContext) {
      const sc = request.sceneContext;
      
      // =====================================================
      // SCENE LOCK v2.0 - MANDATORY VISUAL CONSTANTS
      // These elements MUST remain identical across ALL clips
      // =====================================================
      continuityParts.push(`[SCENE LOCK v2.0 - MANDATORY VISUAL CONSTANTS - DO NOT DEVIATE]`);
      
      // CHARACTER LOCK - Full description with identity anchors
      if (sc.characterDescription) {
        continuityParts.push(`👤 CHARACTER (LOCKED): ${sc.characterDescription}`);
        // Inject character identity from bible if available
        if (request.identityBible?.consistencyPrompt) {
          continuityParts.push(`   IDENTITY ANCHORS: ${request.identityBible.consistencyPrompt.substring(0, 150)}`);
        }
      }
      
      // LOCATION LOCK - Environment must be consistent
      if (sc.locationDescription) {
        continuityParts.push(`📍 LOCATION (LOCKED): ${sc.locationDescription}`);
        continuityParts.push(`   MAINTAIN: Same architectural style, same prop positions, same background elements`);
      }
      
      // LIGHTING LOCK - Critical for visual consistency
      if (sc.lightingDescription) {
        continuityParts.push(`💡 LIGHTING (LOCKED): ${sc.lightingDescription}`);
        continuityParts.push(`   MAINTAIN: Same shadow direction, same color temperature, same contrast level`);
      }
      
      continuityParts.push(`[END SCENE LOCK - ANY DEVIATION BREAKS CONTINUITY]`);
      
      // Action phase context with stronger guidance
      const phaseHints: Record<string, string> = {
        'establish': 'ESTABLISH phase: Wide establishing shot, introduce character in environment, initial calm state',
        'initiate': 'INITIATE phase: Action begins, first significant movement or change from initial state',
        'develop': 'DEVELOP phase: Action continues naturally, building momentum from initiated movement',
        'escalate': 'ESCALATE phase: Intensity increases, action gains speed and urgency',
        'peak': 'PEAK phase: Highest dramatic tension, most intense visual moment',
        'settle': 'SETTLE phase: Action concludes, tension releases, visual resolution',
      };
      continuityParts.push(`\n[ACTION PHASE: ${phaseHints[sc.actionPhase] || sc.actionPhase}]`);
      
      // Continuity chain with explicit visual continuity
      if (sc.previousAction) {
        continuityParts.push(`CONTINUES FROM: ${sc.previousAction}`);
        continuityParts.push(`   (Character pose/position must naturally follow previous clip's ending)`);
      }
      continuityParts.push(`THIS MOMENT: ${sc.currentAction}`);
      if (sc.nextAction) {
        continuityParts.push(`LEADS INTO: ${sc.nextAction}`);
        continuityParts.push(`   (End position must set up for next action)`);
      }
      
      console.log(`[SingleClip] Enhanced Scene Lock v2.0 injected: ${sc.actionPhase} phase`);
    }
    // Fallback: Use identity bible for character consistency
    else if (request.identityBible?.characterIdentity) {
      const ci = request.identityBible.characterIdentity;
      
      if (ci.description) {
        continuityParts.push(`PERSON: ${ci.description}`);
      }
      if (ci.facialFeatures) {
        continuityParts.push(`FACE: ${ci.facialFeatures}`);
      }
      if (ci.bodyType) {
        continuityParts.push(`BUILD: ${ci.bodyType}`);
      }
      if (ci.clothing) {
        continuityParts.push(`WEARING: ${ci.clothing}`);
      }
      if (ci.distinctiveMarkers?.length) {
        continuityParts.push(`DETAILS: ${ci.distinctiveMarkers.join(', ')}`);
      }
    }
    
    // Consistency anchors from identity bible
    if (request.identityBible?.consistencyAnchors?.length) {
      continuityParts.push(`ANCHORS: ${request.identityBible.consistencyAnchors.join(', ')}`);
    }
    
    if (request.identityBible?.consistencyPrompt) {
      continuityParts.push(`CONSISTENCY: ${request.identityBible.consistencyPrompt}`);
    }
    
    // =====================================================
    // NON-FACIAL ANCHORS: Critical for occlusion handling (v2.0)
    // =====================================================
    if (request.identityBible?.nonFacialAnchors) {
      const nfa = request.identityBible.nonFacialAnchors;
      const nfaParts: string[] = [];
      
      if (nfa.bodyType) nfaParts.push(`BODY: ${nfa.bodyType}`);
      if (nfa.clothingSignature) nfaParts.push(`CLOTHING SIGNATURE: ${nfa.clothingSignature}`);
      if (nfa.hairFromBehind) nfaParts.push(`HAIR (from behind): ${nfa.hairFromBehind}`);
      if (nfa.silhouetteDescription) nfaParts.push(`SILHOUETTE: ${nfa.silhouetteDescription}`);
      if (nfa.posture) nfaParts.push(`POSTURE: ${nfa.posture}`);
      if (nfa.gait) nfaParts.push(`GAIT: ${nfa.gait}`);
      
      if (nfaParts.length > 0) {
        continuityParts.push(`[NON-FACIAL IDENTITY - MUST MAINTAIN WHEN FACE NOT VISIBLE]`);
        continuityParts.push(...nfaParts);
        continuityParts.push(`[END NON-FACIAL IDENTITY]`);
        console.log(`[SingleClip] Injected ${nfaParts.length} non-facial anchors for occlusion handling`);
      }
    }
    
    // =====================================================
    // MASTER VISUAL DNA: Color, lighting, environment from Clip 1
    // This is the SOURCE OF TRUTH for visual consistency
    // CRITICAL: This section ensures color richness doesn't degrade across clips
    // ENHANCEMENT: Merge character colors from identity bible into scene palette
    // =====================================================
    const masterDNAParts: string[] = [];
    
    // Build merged color palette from identity bible + scene anchor
    let mergedColorPalette: string[] = [];
    
    // Extract character colors from identity bible (clothing, hair, etc.)
    // Use clothingSignature which contains color information
    if ((request.identityBible?.nonFacialAnchors as any)?.clothingSignature) {
      const clothingSignature = (request.identityBible?.nonFacialAnchors as any).clothingSignature;
      const colorMatches = clothingSignature.match(/\b(red|blue|green|black|white|brown|gray|gold|silver|purple|orange|yellow|pink|teal|navy|maroon|beige|cream)\b/gi);
      if (colorMatches) {
        mergedColorPalette.push(...colorMatches.map((c: string) => `character clothing: ${c.toLowerCase()}`));
      }
    }
    if (request.identityBible?.characterIdentity?.clothing) {
      // Extract colors from clothing description
      const clothingDesc = request.identityBible.characterIdentity.clothing;
      const colorMatches = clothingDesc.match(/\b(red|blue|green|black|white|brown|gray|gold|silver|purple|orange|yellow|pink|teal|navy|maroon|beige|cream)\b/gi);
      if (colorMatches) {
        mergedColorPalette.push(...colorMatches.map((c: string) => `character: ${c.toLowerCase()}`));
      }
    }
    // Extract hair color from hairFromBehind description
    if ((request.identityBible?.nonFacialAnchors as any)?.hairFromBehind) {
      const hairDesc = (request.identityBible?.nonFacialAnchors as any).hairFromBehind;
      const hairColorMatches = hairDesc.match(/\b(black|brown|blonde|red|gray|white|auburn|ginger)\b/gi);
      if (hairColorMatches) {
        mergedColorPalette.push(`character hair: ${hairColorMatches[0].toLowerCase()}`);
      }
    }
    
    if (request.accumulatedAnchors && request.accumulatedAnchors.length > 0) {
      // ALWAYS use the FIRST anchor (from Clip 1) as the master reference for color/lighting
      // This prevents gradual degradation - every clip matches Clip 1, not the previous clip
      const masterAnchor = request.accumulatedAnchors[0];
      const latestAnchor = request.accumulatedAnchors[request.accumulatedAnchors.length - 1];
      
      masterDNAParts.push(`[MASTER VISUAL DNA - MANDATORY FOR ALL CLIPS - MUST MATCH CLIP 1]`);
      
      // COLOR PROFILE FROM CLIP 1 + CHARACTER COLORS (MERGED PALETTE)
      if (masterAnchor.colorPalette?.promptFragment) {
        masterDNAParts.push(`🎨 SCENE COLOR PROFILE (LOCKED): ${masterAnchor.colorPalette.promptFragment}`);
      }
      if (masterAnchor.colorPalette?.temperature) {
        masterDNAParts.push(`COLOR TEMPERATURE: ${masterAnchor.colorPalette.temperature} (maintain exact warmth/coolness)`);
      }
      
      // MERGED CHARACTER COLORS INTO SCENE PALETTE
      if (mergedColorPalette.length > 0) {
        const uniqueColors = [...new Set(mergedColorPalette)].slice(0, 5);
        masterDNAParts.push(`👤 CHARACTER COLORS (LOCKED): ${uniqueColors.join(', ')}`);
        console.log(`[SingleClip] Merged ${uniqueColors.length} character colors into scene palette`);
      }
      
      // LIGHTING FROM CLIP 1 (never changes)
      if (masterAnchor.lighting?.promptFragment) {
        masterDNAParts.push(`💡 LIGHTING (LOCKED): ${masterAnchor.lighting.promptFragment}`);
      }
      if (masterAnchor.lighting?.timeOfDay) {
        masterDNAParts.push(`TIME OF DAY: ${masterAnchor.lighting.timeOfDay} (maintain consistent sun/shadow direction)`);
      }
      
      // ENVIRONMENT FROM CLIP 1 (base setting, can evolve slightly)
      if (masterAnchor.keyObjects?.environmentType) {
        masterDNAParts.push(`🌍 ENVIRONMENT BASE: ${masterAnchor.keyObjects.environmentType}`);
      }
      
      // MASTER CONSISTENCY PROMPT (comprehensive summary)
      if (masterAnchor.masterConsistencyPrompt) {
        masterDNAParts.push(`VISUAL CONSISTENCY: ${masterAnchor.masterConsistencyPrompt}`);
      }
      
      masterDNAParts.push(`[END MASTER VISUAL DNA]`);
      
      // Also add CURRENT scene evolution (what's happening NOW) from latest anchor
      // This allows natural progression while maintaining visual base
      if (request.accumulatedAnchors.length > 1 && latestAnchor !== masterAnchor) {
        if (latestAnchor.keyObjects?.promptFragment && 
            latestAnchor.keyObjects.promptFragment !== masterAnchor.keyObjects?.promptFragment) {
          masterDNAParts.push(`[SCENE EVOLUTION: ${latestAnchor.keyObjects.promptFragment}]`);
        }
      }
      
      console.log(`[SingleClip] 🎬 MASTER VISUAL DNA injected from Clip 1 (${request.accumulatedAnchors.length} anchors available)`);
      console.log(`[SingleClip]   Color locked: ${masterAnchor.colorPalette?.temperature || 'not specified'}`);
      console.log(`[SingleClip]   Lighting locked: ${masterAnchor.lighting?.timeOfDay || 'not specified'}`);
    }
    
    // =====================================================
    // PROMPT CONSTRUCTION ORDER (from highest to lowest priority):
    // 1. MASTER VISUAL DNA (color/lighting lock from Clip 1) - HIGHEST PRIORITY
    // 2. Scene continuity (character, location, lighting locks)
    // 3. Base prompt (what happens in this clip)
    // =====================================================
    
    // STEP 1: Master Visual DNA at the very top (for clips 2+)
    if (masterDNAParts.length > 0) {
      const masterDNABlock = `${masterDNAParts.join('\n')}\n\n`;
      enhancedPrompt = masterDNABlock + enhancedPrompt;
      console.log(`[SingleClip] Master Visual DNA block added (${masterDNAParts.length} elements)`);
    }
    
    // STEP 2: Scene continuity (character, location, etc.)
    if (continuityParts.length > 0) {
      const continuityBlock = `${continuityParts.join('\n')}\n\n`;
      enhancedPrompt = continuityBlock + enhancedPrompt;
      console.log(`[SingleClip] Injected ${continuityParts.length} total continuity elements`);
    } else {
      console.log(`[SingleClip] No scene context or identity bible - continuity may vary`);
    }
    
    // Legacy story position support
    if (request.storyPosition || request.previousClipSummary) {
      const storyParts: string[] = [];
      
      if (request.storyPosition) {
        const positionHints: Record<string, string> = {
          'opening': 'OPENING - establish character and world',
          'setup': 'SETUP - show situation and stakes',
          'catalyst': 'CATALYST - something changes',
          'rising': 'RISING ACTION - tension builds',
          'climax': 'CLIMAX - highest tension',
          'resolution': 'RESOLUTION - conclusion',
        };
        storyParts.push(positionHints[request.storyPosition] || '');
      }
      
      if (request.previousClipSummary && !request.sceneContext?.previousAction) {
        storyParts.push(`CONTINUES FROM: ${request.previousClipSummary}`);
      }
      
      if (storyParts.length > 0 && !request.sceneContext) {
        enhancedPrompt = `[STORY: ${storyParts.join(' | ')}]\n\n${enhancedPrompt}`;
      }
    }
    
    // Inject velocity continuity from previous clip
    const velocityAwarePrompt = injectVelocityContinuity(enhancedPrompt, request.previousMotionVectors);
    
    console.log(`[SingleClip] Enhanced prompt: ${velocityAwarePrompt.substring(0, 200)}...`);

    // Mark clip as generating
    await supabase.rpc('upsert_video_clip', {
      p_project_id: request.projectId,
      p_user_id: request.userId,
      p_shot_index: request.clipIndex,
      p_prompt: velocityAwarePrompt,
      p_status: 'generating',
    });

    // Get OAuth access token
    const accessToken = await getAccessToken(serviceAccount);
    console.log("[SingleClip] OAuth access token obtained");

    // Generate clip with Veo - use aspect ratio from request or default to 16:9
    const aspectRatio = request.aspectRatio || '16:9';
    console.log(`[SingleClip] Using aspect ratio from request: ${aspectRatio}`);
    
    // Merge all negative prompts: occlusion negatives + spatial negatives + manifest negatives
    const allNegatives = [
      ...(request.identityBible?.occlusionNegatives || []),
      ...spatialNegatives,
      ...manifestNegatives,
    ];
    
    if (allNegatives.length > 0) {
      console.log(`[SingleClip] Negative prompts: ${allNegatives.length} total (${spatialNegatives.length} spatial, ${manifestNegatives.length} manifest)`);
    }
    
    let operationName: string = '';
    let finalPrompt = velocityAwarePrompt;
    let rawVideoUrl: string = '';
    const MAX_CONTENT_RETRIES = 2;
    
    // =====================================================
    // VIDEO GENERATION WITH AUTO-RETRY ON CONTENT FILTER
    // =====================================================
    for (let contentRetry = 0; contentRetry <= MAX_CONTENT_RETRIES; contentRetry++) {
      try {
        if (contentRetry === 0) {
          // First attempt with original (sanitized) prompt
          const result = await generateClip(
            accessToken,
            gcpProjectId,
            finalPrompt,
            request.startImageUrl,
            aspectRatio,
            allNegatives.length > 0 ? allNegatives : undefined
          );
          operationName = result.operationName;
        } else {
          // Retry with AI-rephrased prompt
          console.log(`[SingleClip] Content retry ${contentRetry}/${MAX_CONTENT_RETRIES} - using AI rephrase...`);
          const retryResult = await retryWithRephrasedPrompt(
            request.prompt, // Use original prompt for best context
            accessToken,
            gcpProjectId,
            undefined, // Skip startImageUrl since prompt changed significantly
            aspectRatio,
            undefined
          );
          operationName = retryResult.operationName;
          finalPrompt = retryResult.rephrasedPrompt;
          
          // Update clip with rephrased prompt
          await supabase
            .from('video_clips')
            .update({ 
              prompt: finalPrompt,
              corrective_prompts: [...(safetyCheck.warnings.length > 0 ? [request.prompt] : []), velocityAwarePrompt]
            })
            .eq('project_id', request.projectId)
            .eq('shot_index', request.clipIndex);
        }
        
        console.log(`[SingleClip] Operation started: ${operationName}`);
        
        // Save operation name
        await supabase.rpc('upsert_video_clip', {
          p_project_id: request.projectId,
          p_user_id: request.userId,
          p_shot_index: request.clipIndex,
          p_prompt: finalPrompt,
          p_status: 'generating',
          p_veo_operation_name: operationName,
        });

        // Poll for completion
        const pollResult = await pollOperation(accessToken, operationName);
        rawVideoUrl = pollResult.videoUrl;
        
        // Success! Break out of retry loop
        console.log(`[SingleClip] ✓ Video generated successfully${contentRetry > 0 ? ` on retry ${contentRetry}` : ''}`);
        break;
        
      } catch (genError) {
        const errorMsg = genError instanceof Error ? genError.message : String(genError);
        
        // Check if it's a content filter error
        const isContentFilterError = 
          errorMsg.includes('usage guidelines') ||
          errorMsg.includes('content filter') ||
          errorMsg.includes('violate') ||
          errorMsg.includes('policy') ||
          errorMsg.includes('raiMediaFilteredCount');
        
        if (isContentFilterError && contentRetry < MAX_CONTENT_RETRIES) {
          console.warn(`[SingleClip] ⚠️ Content filter rejected - attempting AI rephrase (retry ${contentRetry + 1}/${MAX_CONTENT_RETRIES})...`);
          continue;
        }
        
        // Not a content filter error or max retries reached
        throw genError;
      }
    }
    
    // Verify video URL was obtained
    if (!rawVideoUrl) {
      throw new Error("Video generation failed - no video URL obtained after all retries");
    }
    
    console.log(`[SingleClip] Clip completed: ${rawVideoUrl.substring(0, 80)}...`);
    
    // Download to storage
    const storedUrl = await downloadToStorage(supabase, rawVideoUrl, request.projectId, request.clipIndex);
    console.log(`[SingleClip] Clip stored: ${storedUrl}`);
    
    // =====================================================
    // CRITICAL: Frame Extraction with MANDATORY Validation
    // This is essential for clip-to-clip continuity
    // =====================================================
    let lastFrameUrl: string | undefined;
    const stitcherUrl = Deno.env.get("CLOUD_RUN_STITCHER_URL");
    
    const MAX_FRAME_RETRIES = 3;
    let frameExtractionSuccess = false;
    
    if (stitcherUrl) {
      for (let frameAttempt = 0; frameAttempt < MAX_FRAME_RETRIES; frameAttempt++) {
        try {
          console.log(`[SingleClip] Frame extraction attempt ${frameAttempt + 1}/${MAX_FRAME_RETRIES}...`);
          
          const response = await fetch(`${stitcherUrl}/extract-frame`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clipUrl: storedUrl,
              clipIndex: request.clipIndex,
              projectId: request.projectId,
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.lastFrameUrl && result.lastFrameUrl.startsWith('http')) {
              lastFrameUrl = result.lastFrameUrl;
              frameExtractionSuccess = true;
              console.log(`[SingleClip] ✓ Frame extracted successfully for chaining: ${lastFrameUrl?.substring(0, 60)}...`);
              break;
            } else {
              console.warn(`[SingleClip] Frame extraction returned invalid URL, retrying...`);
            }
          } else {
            const errorText = await response.text();
            console.warn(`[SingleClip] Frame extraction HTTP ${response.status}: ${errorText}`);
          }
        } catch (frameError) {
          console.warn(`[SingleClip] Frame extraction attempt ${frameAttempt + 1} failed:`, frameError);
        }
        
        // Wait before retry
        if (frameAttempt < MAX_FRAME_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // CRITICAL: If Cloud Run failed, try edge function fallback
      if (!frameExtractionSuccess) {
        console.log(`[SingleClip] Cloud Run frame extraction failed, trying edge function fallback...`);
        
        try {
          // Call the extract-video-frame edge function as fallback
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          
          const fallbackResponse = await fetch(`${supabaseUrl}/functions/v1/extract-video-frame`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoUrl: storedUrl,
              projectId: request.projectId,
              shotId: `clip_${request.clipIndex}`,
              position: 'last',
            }),
          });
          
          if (fallbackResponse.ok) {
            const fallbackResult = await fallbackResponse.json();
            if (fallbackResult.success && fallbackResult.frameUrl) {
              lastFrameUrl = fallbackResult.frameUrl;
              frameExtractionSuccess = true;
              console.log(`[SingleClip] ✓ Frame extracted via edge function fallback: ${lastFrameUrl?.substring(0, 60)}...`);
            }
          }
        } catch (fallbackError) {
          console.warn(`[SingleClip] Edge function fallback also failed:`, fallbackError);
        }
      }
      
      // CRITICAL: Log frame extraction failure loudly
      if (!frameExtractionSuccess) {
        console.error(`[SingleClip] ⚠️ CRITICAL: Frame extraction FAILED after all attempts!`);
        console.error(`[SingleClip] Next clip will NOT have frame continuity - expect visual jump`);
        
        // Store failure in metadata for debugging
        await supabase
          .from('video_clips')
          .update({ 
            error_message: `Frame extraction failed - continuity broken` 
          })
          .eq('project_id', request.projectId)
          .eq('shot_index', request.clipIndex);
      }
    } else {
      // No Cloud Run URL configured - use edge function directly
      console.log(`[SingleClip] CLOUD_RUN_STITCHER_URL not configured, using edge function for frame extraction...`);
      
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        const directResponse = await fetch(`${supabaseUrl}/functions/v1/extract-video-frame`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoUrl: storedUrl,
            projectId: request.projectId,
            shotId: `clip_${request.clipIndex}`,
            position: 'last',
          }),
        });
        
        if (directResponse.ok) {
          const directResult = await directResponse.json();
          if (directResult.success && directResult.frameUrl) {
            lastFrameUrl = directResult.frameUrl;
            frameExtractionSuccess = true;
            console.log(`[SingleClip] ✓ Frame extracted via edge function: ${lastFrameUrl?.substring(0, 60)}...`);
          }
        }
      } catch (directError) {
        console.error(`[SingleClip] Edge function frame extraction failed:`, directError);
      }
      
      if (!frameExtractionSuccess) {
        console.error(`[SingleClip] ⚠️ CRITICAL: No frame extraction available - continuity will be broken`);
      }
    }
    
    // Extract motion vectors for next clip
    const motionVectors = extractMotionVectors(request.prompt);
    console.log(`[SingleClip] Motion vectors:`, motionVectors);
    
    // =====================================================
    // CONTINUITY MANIFEST EXTRACTION
    // Extract comprehensive continuity data from last frame for next clip
    // =====================================================
    let extractedManifest: ShotContinuityManifest | undefined;
    
    if (lastFrameUrl && frameExtractionSuccess) {
      try {
        console.log(`[SingleClip] Extracting continuity manifest from last frame...`);
        
        const manifestResponse = await fetch(`${supabaseUrl}/functions/v1/extract-continuity-manifest`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            frameUrl: lastFrameUrl,
            projectId: request.projectId,
            shotIndex: request.clipIndex,
            shotDescription: request.prompt.substring(0, 500),
            previousManifest: request.previousContinuityManifest,
          }),
        });
        
        if (manifestResponse.ok) {
          const manifestResult = await manifestResponse.json();
          if (manifestResult.success && manifestResult.manifest) {
            extractedManifest = manifestResult.manifest;
            console.log(`[SingleClip] ✓ Continuity manifest extracted with ${extractedManifest?.criticalAnchors?.length || 0} critical anchors`);
            
            // Log key extracted elements
            if (extractedManifest?.spatial?.primaryCharacter) {
              console.log(`[SingleClip]   Spatial: ${extractedManifest.spatial.primaryCharacter.screenPosition}`);
            }
            if (extractedManifest?.lighting?.colorTemperature) {
              console.log(`[SingleClip]   Lighting: ${extractedManifest.lighting.colorTemperature}`);
            }
            if (extractedManifest?.emotional?.primaryEmotion) {
              console.log(`[SingleClip]   Emotion: ${extractedManifest.emotional.primaryEmotion}`);
            }
          } else {
            console.warn(`[SingleClip] Continuity manifest extraction returned no data`);
          }
        } else {
          console.warn(`[SingleClip] Continuity manifest extraction failed: HTTP ${manifestResponse.status}`);
        }
      } catch (manifestError) {
        console.warn(`[SingleClip] Continuity manifest extraction error:`, manifestError);
      }
    } else {
      console.log(`[SingleClip] Skipping continuity manifest extraction - no frame available`);
    }
    
    // IMPORTANT: Use 6-second duration as the standard for all clips
    const clipDurationSeconds = 6;
    
    // Mark clip as completed with correct duration
    await supabase.rpc('upsert_video_clip', {
      p_project_id: request.projectId,
      p_user_id: request.userId,
      p_shot_index: request.clipIndex,
      p_prompt: velocityAwarePrompt,
      p_status: 'completed',
      p_video_url: storedUrl,
      p_last_frame_url: lastFrameUrl,
      p_motion_vectors: JSON.stringify(motionVectors),
      p_duration_seconds: clipDurationSeconds,
    });

    // Log API cost for this video generation
    try {
      const creditsCharged = request.qualityTier === 'professional' ? 20 : 20; // Production credits per shot
      const realCostCents = 8; // Veo API estimated cost (~$0.08 per 4s clip)
      
      await supabase.rpc('log_api_cost', {
        p_user_id: request.userId,
        p_project_id: request.projectId,
        p_shot_id: `clip_${request.clipIndex}`,
        p_service: 'google_veo',
        p_operation: 'video_generation',
        p_credits_charged: creditsCharged,
        p_real_cost_cents: realCostCents,
        p_duration_seconds: DEFAULT_CLIP_DURATION,
        p_status: 'completed',
        p_metadata: JSON.stringify({
          model: 'veo-3.1-generate-001',
          aspectRatio: request.aspectRatio || '16:9',
          qualityTier: request.qualityTier || 'standard',
          hasStartImage: !!request.startImageUrl,
          hasContinuityManifest: !!extractedManifest,
        }),
      });
      console.log(`[SingleClip] API cost logged: ${creditsCharged} credits, ${realCostCents}¢ real cost`);
    } catch (costError) {
      console.warn(`[SingleClip] Failed to log API cost:`, costError);
    }

    // Extended clip result with continuity manifest
    interface ExtendedClipResult extends ClipResult {
      continuityManifest?: ShotContinuityManifest;
    }
    
    const clipResult: ExtendedClipResult = {
      index: request.clipIndex,
      videoUrl: storedUrl,
      lastFrameUrl,
      durationSeconds: DEFAULT_CLIP_DURATION,
      status: 'completed',
      motionVectors,
      continuityManifest: extractedManifest,
    };

    console.log(`[SingleClip] Clip ${request.clipIndex + 1} completed successfully${extractedManifest ? ' with continuity manifest' : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        clipResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SingleClip] Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
