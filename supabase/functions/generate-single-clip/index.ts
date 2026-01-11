import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_CLIP_DURATION = 4;

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
  // Scene continuity (NEW)
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
    // SCENE-BASED CONTINUOUS FLOW: Inject scene context for clip continuity
    // =====================================================
    let enhancedPrompt = request.prompt;
    const continuityParts: string[] = [];
    
    // NEW: Scene context for continuous flow (takes priority)
    if (request.sceneContext) {
      const sc = request.sceneContext;
      
      // LOCKED: Character, Location, Lighting - same for all clips
      continuityParts.push(`[SCENE LOCK - THESE ARE CONSTANT FOR ALL CLIPS]`);
      if (sc.characterDescription) {
        continuityParts.push(`CHARACTER: ${sc.characterDescription}`);
      }
      if (sc.locationDescription) {
        continuityParts.push(`LOCATION: ${sc.locationDescription}`);
      }
      if (sc.lightingDescription) {
        continuityParts.push(`LIGHTING: ${sc.lightingDescription}`);
      }
      continuityParts.push(`[END SCENE LOCK]`);
      
      // Action phase context
      const phaseHints: Record<string, string> = {
        'establish': 'ESTABLISH phase: Wide shot, character in environment, initial calm state',
        'initiate': 'INITIATE phase: Action begins, first movement or change from initial state',
        'develop': 'DEVELOP phase: Action continues, building on initiated movement',
        'escalate': 'ESCALATE phase: Intensity increases, action gains momentum',
        'peak': 'PEAK phase: Highest point, most dramatic moment',
        'settle': 'SETTLE phase: Action concludes, resolution, prepares for next scene',
      };
      continuityParts.push(`\n[ACTION PHASE: ${phaseHints[sc.actionPhase] || sc.actionPhase}]`);
      
      // Continuity chain
      if (sc.previousAction) {
        continuityParts.push(`CONTINUES FROM: ${sc.previousAction}`);
      }
      continuityParts.push(`THIS MOMENT: ${sc.currentAction}`);
      if (sc.nextAction) {
        continuityParts.push(`LEADS INTO: ${sc.nextAction}`);
      }
      
      console.log(`[SingleClip] Scene continuity injected: ${sc.actionPhase} phase`);
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
    // ACCUMULATED SCENE ANCHORS: Visual DNA from previous clips
    // =====================================================
    if (request.accumulatedAnchors && request.accumulatedAnchors.length > 0) {
      const anchorParts: string[] = [];
      
      // Use the most recent anchor's consistency prompt (freshest visual DNA)
      const latestAnchor = request.accumulatedAnchors[request.accumulatedAnchors.length - 1];
      if (latestAnchor.lighting?.promptFragment) {
        anchorParts.push(`LIGHTING: ${latestAnchor.lighting.promptFragment}`);
      }
      if (latestAnchor.colorPalette?.promptFragment) {
        anchorParts.push(`COLORS: ${latestAnchor.colorPalette.promptFragment}`);
      }
      if (latestAnchor.keyObjects?.promptFragment) {
        anchorParts.push(`ENVIRONMENT: ${latestAnchor.keyObjects.promptFragment}`);
      }
      
      if (anchorParts.length > 0) {
        continuityParts.push(`[VISUAL DNA FROM PREVIOUS CLIPS]`);
        continuityParts.push(...anchorParts);
        continuityParts.push(`[END VISUAL DNA]`);
        console.log(`[SingleClip] Injected ${anchorParts.length} scene anchor elements from ${request.accumulatedAnchors.length} previous clips`);
      }
    }
    
    // INJECT: Put continuity at START of prompt
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
    
    const { operationName } = await generateClip(
      accessToken,
      gcpProjectId,
      velocityAwarePrompt,
      request.startImageUrl,
      aspectRatio,
      request.identityBible?.occlusionNegatives
    );
    
    console.log(`[SingleClip] Operation started: ${operationName}`);
    
    // Save operation name
    await supabase.rpc('upsert_video_clip', {
      p_project_id: request.projectId,
      p_user_id: request.userId,
      p_shot_index: request.clipIndex,
      p_prompt: velocityAwarePrompt,
      p_status: 'generating',
      p_veo_operation_name: operationName,
    });

    // Poll for completion
    const { videoUrl: rawVideoUrl } = await pollOperation(accessToken, operationName);
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
    
    // Mark clip as completed
    await supabase.rpc('upsert_video_clip', {
      p_project_id: request.projectId,
      p_user_id: request.userId,
      p_shot_index: request.clipIndex,
      p_prompt: velocityAwarePrompt,
      p_status: 'completed',
      p_video_url: storedUrl,
      p_last_frame_url: lastFrameUrl,
      p_motion_vectors: JSON.stringify(motionVectors),
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
        }),
      });
      console.log(`[SingleClip] API cost logged: ${creditsCharged} credits, ${realCostCents}¢ real cost`);
    } catch (costError) {
      console.warn(`[SingleClip] Failed to log API cost:`, costError);
    }

    const clipResult: ClipResult = {
      index: request.clipIndex,
      videoUrl: storedUrl,
      lastFrameUrl,
      durationSeconds: DEFAULT_CLIP_DURATION,
      status: 'completed',
      motionVectors,
    };

    console.log(`[SingleClip] Clip ${request.clipIndex + 1} completed successfully`);

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
