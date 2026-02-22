import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  checkContinuityReady,
  loadPipelineContext,
} from "../_shared/generation-mutex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CONTINUE-PRODUCTION: Callback-based clip chaining
 * 
 * Called by generate-single-clip when a clip completes.
 * Triggers generation of the next clip, or moves to post-production if all clips are done.
 * This prevents edge function timeouts by generating one clip per function invocation.
 * 
 * FAILSAFE: Validates continuity before triggering next clip
 */

// =============================================================================
// SUBJECT DETECTION - Skip character injection for non-character prompts
// =============================================================================

const OBJECT_PATTERNS: RegExp[] = [
  // Vehicles / Transportation
  /\b(space\s*shuttle|rocket|spacecraft|spaceship|satellite|probe)\b/i,
  /\b(airplane|aircraft|jet|helicopter|drone|plane)\b/i,
  /\b(car|truck|bus|motorcycle|vehicle|train|ship|boat|submarine)\b/i,
  // Natural phenomena / Events
  /\b(asteroid|meteor|comet|meteorite)\s*(impact|crash|strike|hit|collid|fall)/i,
  /\b(explosion|blast|eruption|nuclear|atomic)\b/i,
  /\b(volcano|earthquake|tsunami|hurricane|tornado|storm)\b/i,
  // Pure environments/scenes
  /\b(landscape|scenery|vista|panorama|cityscape|skyline)\b/i,
];

const CHARACTER_PATTERNS: RegExp[] = [
  /\b(person|man|woman|boy|girl|child|adult|human|people|character)\b/i,
  /\b(he|she|they|him|her|his|hers|their)\b/i,
  /\b(walking|running|talking|speaking|gesturing|smiling|crying|laughing)\b/i,
  /\b(wearing|dressed|outfit|clothes|clothing)\b/i,
  /\b(face|eyes|hair|hands|body|head)\b/i,
  /\b(protagonist|hero|villain|character|actor)\b/i,
];

function detectCharacterPrompt(prompt: string): boolean {
  // Check if prompt has object/scene patterns (these override character patterns)
  const hasObjectPatterns = OBJECT_PATTERNS.some(p => p.test(prompt));
  
  // Check if prompt has character patterns
  const hasCharacterPatterns = CHARACTER_PATTERNS.some(p => p.test(prompt));
  
  // If object patterns are found AND no character patterns, it's NOT a character prompt
  if (hasObjectPatterns && !hasCharacterPatterns) {
    return false;
  }
  
  // If character patterns are found, it IS a character prompt
  if (hasCharacterPatterns) {
    return true;
  }
  
  // Default: assume character prompt for safety (legacy behavior)
  return true;
}

interface ContinueProductionRequest {
  projectId: string;
  userId: string;
  completedClipIndex: number;
  completedClipResult?: {
    videoUrl: string;
    lastFrameUrl?: string;
    motionVectors?: any;
    continuityManifest?: any;
  };
  totalClips: number;
  // Context passed from hollywood-pipeline
  pipelineContext?: {
    videoEngine?: 'kling' | 'veo'; // CRITICAL: must survive all callback hops
    isAvatarMode?: boolean; // EXPLICIT flag — NOT derived from videoEngine
    identityBible?: any;
    faceLock?: any; // FACE LOCK — highest priority identity system, must survive callback chain
    masterSceneAnchor?: any;
    goldenFrameData?: any;
    accumulatedAnchors?: any[];
    referenceImageUrl?: string;
    colorGrading?: string;
    qualityTier?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    sceneImageLookup?: Record<number, string>;
    tierLimits?: any;
    extractedCharacters?: any[];
    clipDuration?: number;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ═══ AUTH GUARD ═══
  const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
  const auth = await validateAuth(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  // Parse body ONCE before try/catch to avoid "Body is unusable" error
  let request: ContinueProductionRequest;
  try {
    request = await req.json();
  } catch (parseError) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid request body' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { projectId, userId, completedClipIndex, completedClipResult, totalClips, pipelineContext } = request;

    console.log(`[ContinueProduction] Clip ${completedClipIndex + 1}/${totalClips} completed for project ${projectId}`);

    // Check if all clips are done
    if (completedClipIndex + 1 >= totalClips) {
      console.log(`[ContinueProduction] All ${totalClips} clips completed! Triggering post-production...`);
      
      // Update project status - use 'stitching' which is a valid pipeline_stage value
      await supabase
        .from('movie_projects')
        .update({
          pipeline_stage: 'stitching',
          status: 'generating',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      // Trigger final assembly with AUTO-RETRY
      // FAIL-PROOF: If final-assembly fails, retry up to 3 times with backoff
      // before falling back to watchdog recovery
      let assemblyResult: any = null;
      let assemblySuccess = false;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          assemblyResult = await callEdgeFunction('final-assembly', {
            projectId,
            userId,
            forceReconcile: attempt > 1, // Force reconcile on retries
          });
          assemblySuccess = true;
          break;
        } catch (assemblyErr) {
          console.warn(`[ContinueProduction] final-assembly attempt ${attempt}/3 failed:`, assemblyErr);
          if (attempt < 3) {
            const waitMs = 3000 * Math.pow(2, attempt - 1);
            console.log(`[ContinueProduction] Retrying final-assembly in ${waitMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
        }
      }
      
      if (!assemblySuccess) {
        // All assembly attempts failed — flag for watchdog manifest fallback
        console.error(`[ContinueProduction] ⚠️ All 3 final-assembly attempts failed — flagging for watchdog manifest fallback`);
        
        const { data: currentProject } = await supabase
          .from('movie_projects')
          .select('pending_video_tasks')
          .eq('id', projectId)
          .maybeSingle();
        
        const currentTasks = (currentProject?.pending_video_tasks || {}) as Record<string, any>;
        
        await supabase
          .from('movie_projects')
          .update({
            status: 'stitching', // Keep as stitching so watchdog Phase 3 picks it up
            pipeline_stage: 'stitching',
            pending_video_tasks: {
              ...currentTasks,
              stage: 'stitching',
              assemblyFailed: true,
              assemblyFailedAt: new Date().toISOString(),
              stitchingStarted: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);
      }

      return new Response(
        JSON.stringify({
          success: assemblySuccess,
          action: 'postproduction',
          message: assemblySuccess 
            ? 'All clips completed, post-production done' 
            : 'All clips completed, assembly queued for watchdog recovery',
          assemblyResult,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // More clips to generate - trigger next clip
    const nextClipIndex = completedClipIndex + 1;
    console.log(`[ContinueProduction] Triggering clip ${nextClipIndex + 1}/${totalClips}...`);

    // CRITICAL: Use the context passed from generate-single-clip (includes updated anchors)
    let context = pipelineContext;
    
    // Merge completed clip result into context for continuity
    if (completedClipResult) {
      context = context || {};
      
      // Add completed clip's anchor to accumulated anchors
      const newAnchor = completedClipResult.continuityManifest || {
        clipIndex: completedClipIndex,
        lastFrameUrl: completedClipResult.lastFrameUrl,
        motionVectors: completedClipResult.motionVectors,
        timestamp: Date.now(),
      };
      
      context.accumulatedAnchors = context.accumulatedAnchors || [];
      
      // Avoid duplicate anchors
      const hasAnchor = context.accumulatedAnchors.some(
        (a: any) => a.clipIndex === completedClipIndex
      );
      if (!hasAnchor) {
        context.accumulatedAnchors = [...context.accumulatedAnchors, newAnchor];
      }
      
      // If this was clip 1 (index 0), set the reference image AND extract style anchor
      if (completedClipIndex === 0 && completedClipResult.lastFrameUrl) {
        context.referenceImageUrl = context.referenceImageUrl || completedClipResult.lastFrameUrl;
        context.goldenFrameData = context.goldenFrameData || {
          goldenFrameUrl: completedClipResult.lastFrameUrl,
          extractedAt: Date.now(),
          clipIndex: 0,
        };
        
        // Extract style anchor from clip 1's last frame for scene DNA
        // NOTE: extract-style-anchor may not be deployed — skip gracefully if unavailable
        if (!context.masterSceneAnchor) {
          console.log(`[ContinueProduction] Attempting style anchor extraction from clip 1's last frame...`);
          try {
            const styleResponse = await fetch(`${supabaseUrl}/functions/v1/extract-style-anchor`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                frameUrl: completedClipResult.lastFrameUrl,
                projectId,
              }),
            });
            
            if (styleResponse.ok) {
              const styleResult = await styleResponse.json();
              if (styleResult.success && styleResult.styleAnchor) {
                context.masterSceneAnchor = {
                  masterConsistencyPrompt: styleResult.styleAnchor.consistencyPrompt,
                  colorPalette: styleResult.styleAnchor.colorPalette,
                  lighting: styleResult.styleAnchor.lighting,
                  visualStyle: styleResult.styleAnchor.visualStyle,
                };
                console.log(`[ContinueProduction] ✓ Style anchor extracted: ${styleResult.styleAnchor.consistencyPrompt?.substring(0, 60)}...`);
                
                // Persist to pro_features_data for future resumes
                // First fetch current data, then merge
                const { data: currentProject } = await supabase
                  .from('movie_projects')
                  .select('pro_features_data')
                  .eq('id', projectId)
                  .maybeSingle();
                
                const updatedProFeatures = {
                  ...(currentProject?.pro_features_data || {}),
                  styleAnchor: styleResult.styleAnchor,
                  masterSceneAnchor: context.masterSceneAnchor,
                };
                
                await supabase
                  .from('movie_projects')
                  .update({
                    pro_features_data: updatedProFeatures,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', projectId);
                  
                console.log(`[ContinueProduction] ✓ Style anchor persisted to pro_features_data`);
              }
            }
          } catch (styleErr) {
            // Non-fatal: extract-style-anchor may not exist or may be temporarily unavailable
            // Quality anchoring degrades gracefully — clips still generate, just with less style consistency
            console.warn(`[ContinueProduction] Style anchor extraction unavailable (non-fatal):`, styleErr instanceof Error ? styleErr.message : styleErr);
          }
        }
      }
      
      console.log(`[ContinueProduction] Merged clip ${completedClipIndex + 1} result: ${context.accumulatedAnchors.length} anchors, ref: ${context.referenceImageUrl ? 'YES' : 'NO'}, masterAnchor: ${context.masterSceneAnchor ? 'YES' : 'NO'}`);
    }
    
    // CRITICAL FIX: ALWAYS load pendingVideoTasks from DB if not present in context.
    // The old condition (!context.referenceImageUrl || !context.identityBible) meant
    // that if poll-replicate-prediction passed a context WITH those fields but WITHOUT
    // pendingVideoTasks, the entire DB fallback was skipped — losing avatar dialogue.
    const needsDbLoad = !context 
      || !context.referenceImageUrl 
      || !context.identityBible
      || !context.pendingVideoTasks;  // NEW: Always load if pendingVideoTasks missing
    
    if (needsDbLoad) {
      console.log(`[ContinueProduction] Loading pipeline context from DB (reason: ${!context ? 'no context' : !context.referenceImageUrl ? 'no refImage' : !context.identityBible ? 'no idBible' : 'no pendingVideoTasks'})...`);
      const { data: projectData } = await supabase
        .from('movie_projects')
        .select('pro_features_data, generated_script, scene_images, pending_video_tasks')
        .eq('id', projectId)
        .maybeSingle();

      if (projectData) {
        context = context || {};
        
        // CRITICAL FIX: Load ALL identity-related data from pro_features_data
        const proFeatures = projectData.pro_features_data || {};
        
        // BUG FIX: Load clipDuration from pending_video_tasks
        const pendingTasks = projectData.pending_video_tasks || {};
        if (!context.clipDuration && pendingTasks.clipDuration) {
          context.clipDuration = pendingTasks.clipDuration;
          console.log(`[ContinueProduction] ✓ Loaded clipDuration from pending_video_tasks: ${context.clipDuration}s`);
        }
        
        // ROOT CAUSE FIX #2/#4: Recover isAvatarMode, voiceId, and pendingVideoTasks from DB
        if (context.isAvatarMode === undefined && (pendingTasks.isAvatarMode || pendingTasks.type === 'avatar_async')) {
          context.isAvatarMode = true;
          console.log(`[ContinueProduction] ✓ Recovered isAvatarMode=true from pending_video_tasks`);
        }
        if (!context.videoEngine && pendingTasks.type === 'avatar_async') {
          context.videoEngine = 'kling';
          console.log(`[ContinueProduction] ✓ Set videoEngine=kling for avatar pipeline`);
        }
        // Persist pending_video_tasks predictions for pose chaining (ROOT CAUSE FIX #6)
        if (pendingTasks.predictions && !context.pendingVideoTasks) {
          context.pendingVideoTasks = pendingTasks;
          console.log(`[ContinueProduction] ✓ Loaded ${pendingTasks.predictions.length} prediction records for pose chaining`);
        }
        
        // Load identity bible with all its fields
        context.identityBible = context.identityBible || proFeatures.identityBible;
        
        // CRITICAL FIX: Load faceLock from pro_features_data or identityBible
        context.faceLock = context.faceLock 
          || proFeatures.faceLock 
          || proFeatures.identityBible?.faceLock;
        if (context.faceLock) {
          console.log(`[ContinueProduction] ✓ Loaded faceLock from DB: ${context.faceLock.fullFaceDescription?.substring(0, 50) || 'present'}...`);
        } else {
          console.warn(`[ContinueProduction] ⚠️ No faceLock found in pro_features_data`);
        }
        
        // CRITICAL: Log what we loaded for debugging
        if (context.identityBible) {
          console.log(`[ContinueProduction] ✓ Loaded identityBible from DB:`);
          console.log(`  - characterDescription: ${context.identityBible.characterDescription?.substring(0, 50) || 'NONE'}...`);
          console.log(`  - consistencyPrompt: ${context.identityBible.consistencyPrompt?.substring(0, 50) || 'NONE'}...`);
          console.log(`  - consistencyAnchors: ${context.identityBible.consistencyAnchors?.length || 0}`);
          console.log(`  - nonFacialAnchors: ${context.identityBible.nonFacialAnchors ? 'YES' : 'NO'}`);
          console.log(`  - originalReferenceUrl: ${context.identityBible.originalReferenceUrl ? 'YES' : 'NO'}`);
        } else {
          console.warn(`[ContinueProduction] ⚠️ No identityBible found in pro_features_data!`);
        }
        
        // Load extracted characters for prompt enhancement
        const extractedChars = proFeatures.extractedCharacters || [];
        context.extractedCharacters = extractedChars;
        if (extractedChars.length > 0) {
          console.log(`[ContinueProduction] ✓ Loaded ${extractedChars.length} extractedCharacters from DB`);
        }
        
        context.masterSceneAnchor = context.masterSceneAnchor || proFeatures.masterSceneAnchor;
        context.goldenFrameData = context.goldenFrameData || proFeatures.goldenFrameData;
        context.accumulatedAnchors = (context.accumulatedAnchors && context.accumulatedAnchors.length > 0)
          ? context.accumulatedAnchors 
          : (proFeatures.accumulatedAnchors || []);
        context.referenceImageUrl = context.referenceImageUrl 
          || proFeatures.referenceAnalysis?.imageUrl  // FIRST: Original uploaded image
          || proFeatures.goldenFrameData?.goldenFrameUrl
          || context.identityBible?.originalReferenceUrl;
        context.colorGrading = context.colorGrading || 'cinematic';
        context.qualityTier = context.qualityTier || 'standard';
        context.sceneImageLookup = context.sceneImageLookup || {};
        context.tierLimits = context.tierLimits || { maxRetries: 1 };

        // Build scene image lookup
        if (projectData.scene_images && Array.isArray(projectData.scene_images)) {
          for (const img of projectData.scene_images) {
            if (img.imageUrl && img.sceneNumber) {
              context.sceneImageLookup![img.sceneNumber - 1] = img.imageUrl;
            }
          }
        }

        console.log(`[ContinueProduction] Context loaded from DB: identityBible: ${context.identityBible ? 'YES' : 'NO'}, ${context.accumulatedAnchors?.length || 0} anchors, ${Object.keys(context.sceneImageLookup || {}).length} scene images, ref: ${context.referenceImageUrl ? 'YES' : 'NO'}, clipDuration: ${context.clipDuration || 'default'}s`);
      }
    }
    
    // CRITICAL VALIDATION: Ensure we have required data for clip 2+
    if (nextClipIndex > 0 && (!context?.referenceImageUrl || !context?.accumulatedAnchors?.length)) {
      console.error(`[ContinueProduction] ⚠️ Missing required continuity data for clip ${nextClipIndex + 1}`);
      console.error(`  referenceImageUrl: ${context?.referenceImageUrl ? 'YES' : 'MISSING'}`);
      console.error(`  accumulatedAnchors: ${context?.accumulatedAnchors?.length || 0}`);
      
      // Try to get from completed clip 1
      const { data: clip1 } = await supabase
        .from('video_clips')
        .select('last_frame_url, motion_vectors')
        .eq('project_id', projectId)
        .eq('shot_index', 0)
        .eq('status', 'completed')
        .maybeSingle();
      
      if (clip1?.last_frame_url) {
        console.log(`[ContinueProduction] ✓ Recovered referenceImageUrl from clip 1 in DB`);
        context = context || {};
        context.referenceImageUrl = clip1.last_frame_url;
        context.goldenFrameData = { goldenFrameUrl: clip1.last_frame_url, clipIndex: 0 };
        context.accumulatedAnchors = context.accumulatedAnchors || [];
        if (context.accumulatedAnchors.length === 0) {
          context.accumulatedAnchors.push({
            clipIndex: 0,
            lastFrameUrl: clip1.last_frame_url,
            motionVectors: clip1.motion_vectors,
          });
        }
      }
    }

    // Get the prompt for the next clip
    const { data: scriptData } = await supabase
      .from('movie_projects')
      .select('generated_script, pro_features_data')
      .eq('id', projectId)
      .maybeSingle();

    let nextClipPrompt = '';
    let shots: any[] = [];
    
    if (scriptData?.generated_script) {
      try {
        const script = typeof scriptData.generated_script === 'string' 
          ? JSON.parse(scriptData.generated_script) 
          : scriptData.generated_script;
        shots = script.shots || [];
        
        if (shots[nextClipIndex]) {
          const shot = shots[nextClipIndex];
          
          // CRITICAL FIX: Include dialogue in the prompt — not just description
          // shot.description contains cinematography directions (camera, lighting, etc.)
          // shot.dialogue contains the actual spoken/narrative text that Kling needs
          // Without dialogue, clips 2+ become pure boilerplate with zero content
          const dialoguePart = shot.dialogue ? `Speaking naturally with authentic delivery: "${shot.dialogue}". ` : '';
          const descriptionPart = shot.description || shot.title || '';
          nextClipPrompt = `${descriptionPart} ${dialoguePart}`.trim();
          
          // CRITICAL FIX: Only inject character data if the prompt is about characters
          // Skip character injection for objects, vehicles, scenes, etc.
          const characters = scriptData.pro_features_data?.extractedCharacters || [];
          const isCharacterPrompt = detectCharacterPrompt(nextClipPrompt);
          
          if (characters.length > 0 && isCharacterPrompt) {
            const characterPrompt = characters
              .map((c: any) => `${c.name}: ${c.appearance}`)
              .join('; ');
            
            nextClipPrompt = `[CHARACTERS: ${characterPrompt}] ${nextClipPrompt}`;
          } else if (characters.length > 0 && !isCharacterPrompt) {
            console.log(`[ContinueProduction] ⚡ Skipping character injection - prompt is about non-character subject`);
          }
        }
      } catch (e) {
        console.warn(`[ContinueProduction] Failed to parse script:`, e);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // COMPREHENSIVE AVATAR PROMPT ENRICHMENT
    // 
    // For avatar mode, the REAL per-clip data lives in pending_video_tasks.predictions[].
    // Each prediction stores: segmentText (dialogue), action, movement, emotion,
    // cameraHint, physicalDetail, sceneNote, transitionNote.
    // 
    // We ALWAYS look up this data — even when generated_script provided a basic prompt —
    // because generated_script only has description+dialogue, missing all the rich
    // acting/staging metadata that makes clips come alive.
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Resolve prediction data from context or DB
    let predForClip: any = null;
    const predictions = context?.pendingVideoTasks?.predictions || [];
    predForClip = predictions.find(
      (p: { clipIndex: number }) => p.clipIndex === nextClipIndex
    );
    
    // DB fallback if context didn't have predictions
    if (!predForClip) {
      try {
        const { data: pvtData } = await supabase
          .from('movie_projects')
          .select('pending_video_tasks')
          .eq('id', projectId)
          .maybeSingle();
        
        const dbPredictions = (pvtData?.pending_video_tasks as any)?.predictions || [];
        predForClip = dbPredictions.find(
          (p: { clipIndex: number }) => p.clipIndex === nextClipIndex
        );
        if (predForClip) {
          console.log(`[ContinueProduction] ✅ Loaded prediction data from DB for clip ${nextClipIndex}`);
        }
      } catch (dbErr) {
        console.warn(`[ContinueProduction] Failed to load predictions from DB:`, dbErr);
      }
    }
    
    // If we have prediction data, build a RICH cinematic prompt
    if (predForClip?.segmentText) {
      const seg = predForClip;
      const dialogue = seg.segmentText?.trim() || '';
      const action = seg.action?.trim() || '';
      const movement = seg.movement?.trim() || '';
      const emotion = seg.emotion?.trim() || '';
      const cameraHint = seg.cameraHint?.trim() || '';
      const physicalDetail = seg.physicalDetail?.trim() || '';
      const sceneNote = seg.sceneNote?.trim() || '';
      const transitionNote = seg.transitionNote?.trim() || '';
      const startPoseNote = seg.startPose?.trim() || '';
      const endPoseNote = seg.endPose?.trim() || '';
      const visualContinuityNote = seg.visualContinuity?.trim() || '';
      const sceneDesc = context?.pendingVideoTasks?.sceneDescription || context?.pendingVideoTasks?.originalSceneDescription || '';
      
      // Build comprehensive acting prompt matching buildWorldClassPrompt quality
      const promptParts: string[] = [];
      
      // Scene context (from original scene description)
      if (sceneDesc) {
        promptParts.push(`Cinematic scene set in ${sceneDesc}, shot on ARRI Alexa with anamorphic lenses.`);
      }
      
      // Same environment lock for clips 2+
      promptParts.push('[SAME ENVIRONMENT: Continue in the exact same location with consistent lighting and props.]');
      
      // Camera direction
      if (cameraHint) {
        const cameraDescriptions: Record<string, string> = {
          'tracking': 'Smooth Steadicam tracking shot gliding alongside the subject',
          'close-up': 'Intimate close-up isolating facial micro-expressions, shallow depth of field',
          'wide': 'Wide shot placing the subject in their full environment',
          'over-shoulder': 'Over-the-shoulder perspective creating intimacy',
          'medium': 'Classic medium shot from waist up, balanced composition',
          'panning': 'Slow deliberate pan revealing the scene around the subject',
          'dolly-in': 'Slow dolly push-in toward the subject, building intensity',
          'low-angle': 'Low-angle shot looking up at the subject, conveying authority',
          'crane': 'Subtle crane movement adding vertical dimension',
        };
        const camDesc = cameraDescriptions[cameraHint] || cameraHint;
        promptParts.push(camDesc + '.');
      }
      
      // Narrative beat based on clip position
      const totalClipsNum = totalClips || 6;
      if (nextClipIndex === totalClipsNum - 1) {
        promptParts.push('CLOSING MOMENT: This is the payoff — land the final beat with impact and conviction.');
      } else {
        promptParts.push('BUILDING MOMENTUM: The story is developing — natural escalation of energy and engagement.');
      }
      
      // Physical action & movement — THE KEY MISSING PIECE
      if (action) {
        promptParts.push(`CHARACTER ACTION: ${action}.`);
      }
      if (movement) {
        promptParts.push(`CHARACTER MOVEMENT: ${movement}.`);
      }
      if (physicalDetail) {
        promptParts.push(`PHYSICAL DETAIL: ${physicalDetail}.`);
      }
      
      // Scene-specific note
      if (sceneNote) {
        promptParts.push(`SCENE NOTE: ${sceneNote}.`);
      }
      
      // Transition note — narrative bridge from previous clip
      if (transitionNote) {
        promptParts.push(`TRANSITION: ${transitionNote}.`);
      }
      
      // Pose chaining — continuity between clips
      if (startPoseNote) {
        promptParts.push(`STARTING POSE: Character begins in this position: ${startPoseNote}.`);
      }
      if (endPoseNote) {
        promptParts.push(`ENDING POSE: Character must end in this position for next clip continuity: ${endPoseNote}.`);
      }
      if (visualContinuityNote) {
        promptParts.push(`VISUAL CONTINUITY: ${visualContinuityNote}.`);
      }
      
      // Dialogue — the backbone
      if (dialogue) {
        promptParts.push(`Speaking naturally with authentic delivery: "${dialogue}".`);
      }
      
      // Emotion/performance style
      if (emotion) {
        promptParts.push(`Performance energy: ${emotion}.`);
      }
      
      // Lifelike motion directive
      promptParts.push('Continuous lifelike motion: breathing visible in chest/shoulders, natural eye movements, involuntary micro-expressions, authentic weight shifts, hair/clothing responding to movement.');
      
      // Quality baseline
      promptParts.push('Ultra-high definition 4K cinematic quality. Natural skin tones. Rich vibrant colors with cinematic color grading. Shallow depth of field with natural bokeh.');
      
      // Use the existing base prompt if it had real content from generated_script
      if (nextClipPrompt && nextClipPrompt.length >= 20) {
        // Merge: use script description as base, but ENRICH with prediction acting data
        const enrichedPrompt = promptParts.join(' ');
        nextClipPrompt = `${nextClipPrompt} ${enrichedPrompt}`;
        console.log(`[ContinueProduction] ✅ ENRICHED script prompt with acting data: action="${action}", movement="${movement}", emotion="${emotion}", transition="${transitionNote}", startPose="${startPoseNote}"`);
      } else {
        // No script data — use fully reconstructed prompt
        nextClipPrompt = promptParts.join(' ');
        console.log(`[ContinueProduction] ✅ BUILT full acting prompt from prediction data: action="${action}", movement="${movement}", dialogue="${dialogue.substring(0, 60)}...", transition="${transitionNote}"`);
      }
    } else if (!nextClipPrompt || nextClipPrompt.length < 20) {
      // No prediction data and no script data — truly empty
      console.warn(`[ContinueProduction] ⚠️ No prediction data or script data for clip ${nextClipIndex}`);
    }
    
    // FINAL FALLBACK: If still no prompt, use generic continuation
    if (!nextClipPrompt || nextClipPrompt.length < 20) {
      console.warn(`[ContinueProduction] ⚠️ Prompt still empty after all sources, using generic fallback...`);
      
      const chars = scriptData?.pro_features_data?.extractedCharacters || context?.extractedCharacters || [];
      if (chars.length > 0) {
        const charDesc = chars.map((c: any) => `${c.name}: ${c.appearance}`).join('; ');
        nextClipPrompt = `[CHARACTERS: ${charDesc}] Scene ${nextClipIndex + 1} - Continue the narrative with consistent character appearance`;
      } else if (context?.identityBible?.characterDescription) {
        nextClipPrompt = `[CHARACTER: ${context.identityBible.characterDescription}] Scene ${nextClipIndex + 1} - Continue with consistent appearance`;
      } else {
        nextClipPrompt = `Scene ${nextClipIndex + 1} - Continue the narrative from the previous scene`;
      }
      console.log(`[ContinueProduction] ✓ Built fallback prompt: ${nextClipPrompt.substring(0, 60)}...`);
    }

    // Build visual continuity from previous clip
    const previousLastFrameUrl = completedClipResult?.lastFrameUrl;
    const previousMotionVectors = completedClipResult?.motionVectors;
    const previousContinuityManifest = completedClipResult?.continuityManifest;

    // CRITICAL FIX: Only inject identity bible for character-focused prompts
    // Skip for object/scene/vehicle prompts to prevent "man in warehouse" issue
    const isCharacterFocused = detectCharacterPrompt(nextClipPrompt);
    
    if ((context?.identityBible?.characterDescription || context?.identityBible?.consistencyPrompt) && isCharacterFocused) {
      const charDesc = context.identityBible.characterDescription || context.identityBible.consistencyPrompt;
      nextClipPrompt = `[CHARACTER IDENTITY - MANDATORY: ${charDesc}]\n${nextClipPrompt}`;
      console.log(`[ContinueProduction] Injected character identity into prompt`);
    } else if (context?.identityBible && !isCharacterFocused) {
      console.log(`[ContinueProduction] ⚡ Skipping identity bible injection - non-character prompt detected`);
    }

    // Add visual continuity to prompt
    if (previousMotionVectors?.continuityPrompt) {
      nextClipPrompt = `[MANDATORY CONTINUATION: ${previousMotionVectors.continuityPrompt}]\n${nextClipPrompt}`;
    }
    if (context?.masterSceneAnchor?.masterConsistencyPrompt) {
      nextClipPrompt = `[SCENE DNA: ${context.masterSceneAnchor.masterConsistencyPrompt}]\n${nextClipPrompt}`;
    }

    // =========================================================================
    // BULLETPROOF FRAME RESOLUTION - NEVER THROW STRICT_CONTINUITY_FAILURE
    // Uses exhaustive 7-tier fallback chain to guarantee a start image
    // =========================================================================
    
    let startImageUrl = previousLastFrameUrl;
    let frameSource = 'callback_result';
    
    // TIER 1: Use frame from callback result (highest priority)
    if (startImageUrl) {
      console.log(`[ContinueProduction] ✓ TIER 1: Using last frame from callback`);
    }
    
    // TIER 2: Query database for previous clip's last_frame_url
    if (!startImageUrl) {
      console.log(`[ContinueProduction] TIER 2: Querying DB for clip ${completedClipIndex} last_frame_url...`);
      const { data: prevClip } = await supabase
        .from('video_clips')
        .select('last_frame_url, video_url')
        .eq('project_id', projectId)
        .eq('shot_index', completedClipIndex)
        .eq('status', 'completed')
        .maybeSingle();
      
      if (prevClip?.last_frame_url) {
        startImageUrl = prevClip.last_frame_url;
        frameSource = 'db_last_frame';
        console.log(`[ContinueProduction] ✓ TIER 2: Found last_frame_url in DB`);
      } else if (prevClip?.video_url && !prevClip?.last_frame_url) {
        // TIER 2B: Trigger emergency frame extraction
        console.log(`[ContinueProduction] TIER 2B: Clip has video but no frame - triggering extraction...`);
        try {
          const extractResult = await callEdgeFunction('extract-last-frame', {
            projectId,
            shotIndex: completedClipIndex,
            videoUrl: prevClip.video_url,
          });
          if (extractResult?.success && (extractResult?.frameUrl || extractResult?.lastFrameUrl)) {
            startImageUrl = extractResult.frameUrl || extractResult.lastFrameUrl;
            frameSource = 'emergency_extraction';
            console.log(`[ContinueProduction] ✓ TIER 2B: Emergency frame extraction succeeded: ${startImageUrl!.substring(0, 60)}...`);
          } else {
            // Extraction may have saved to DB even if response parsing failed - re-query
            console.log(`[ContinueProduction] TIER 2B: Extraction response unclear, re-querying DB...`);
            const { data: recheck } = await supabase
              .from('video_clips')
              .select('last_frame_url')
              .eq('project_id', projectId)
              .eq('shot_index', completedClipIndex)
              .maybeSingle();
            if (recheck?.last_frame_url) {
              startImageUrl = recheck.last_frame_url;
              frameSource = 'db_recheck_after_extraction';
              console.log(`[ContinueProduction] ✓ TIER 2B (recheck): Found frame in DB after extraction: ${startImageUrl!.substring(0, 60)}...`);
            }
          }
        } catch (extractErr) {
          console.warn(`[ContinueProduction] TIER 2B extraction failed:`, extractErr);
        }
      }
    }
    
    // TIER 3: Query database for ANY completed clip's last_frame_url (scan backwards)
    if (!startImageUrl) {
      console.log(`[ContinueProduction] TIER 3: Scanning ALL completed clips for any last_frame_url...`);
      const { data: allClips } = await supabase
        .from('video_clips')
        .select('shot_index, last_frame_url')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .not('last_frame_url', 'is', null)
        .order('shot_index', { ascending: false })
        .limit(1);
      
      if (allClips?.[0]?.last_frame_url) {
        startImageUrl = allClips[0].last_frame_url;
        frameSource = `clip_${allClips[0].shot_index}_fallback`;
        console.log(`[ContinueProduction] ✓ TIER 3: Using frame from clip ${allClips[0].shot_index}`);
      }
    }
    
    // TIER 4: Use golden frame from context
    if (!startImageUrl && context?.goldenFrameData?.goldenFrameUrl) {
      startImageUrl = context.goldenFrameData.goldenFrameUrl;
      frameSource = 'golden_frame';
      console.log(`[ContinueProduction] ✓ TIER 4: Using goldenFrameData`);
    }
    
    // TIER 5: Use scene image for this or previous clip
    if (!startImageUrl) {
      const sceneImage = context?.sceneImageLookup?.[nextClipIndex] 
        || context?.sceneImageLookup?.[completedClipIndex]
        || context?.sceneImageLookup?.[0];
      if (sceneImage) {
        startImageUrl = sceneImage;
        frameSource = 'scene_image';
        console.log(`[ContinueProduction] ✓ TIER 5: Using scene image fallback`);
      }
    }
    
    // TIER 6: Use original reference image from context
    if (!startImageUrl && context?.referenceImageUrl) {
      startImageUrl = context.referenceImageUrl;
      frameSource = 'reference_image';
      console.log(`[ContinueProduction] ✓ TIER 6: Using original reference image`);
    }
    
    // TIER 7: Query pro_features_data for any stored image URL
    if (!startImageUrl) {
      console.log(`[ContinueProduction] TIER 7: Last resort - querying pro_features_data...`);
      const { data: proData } = await supabase
        .from('movie_projects')
        .select('pro_features_data, source_image_url')
        .eq('id', projectId)
        .maybeSingle();
      
      const pfd = proData?.pro_features_data || {};
      const emergencyImage = proData?.source_image_url
        || pfd.referenceAnalysis?.imageUrl
        || pfd.identityBible?.originalReferenceUrl
        || pfd.goldenFrameData?.goldenFrameUrl;
      
      if (emergencyImage) {
        startImageUrl = emergencyImage;
        frameSource = 'emergency_pro_features';
        console.log(`[ContinueProduction] ✓ TIER 7: Emergency recovery from pro_features_data`);
      }
    }
    
    // FINAL CHECK: Log comprehensive status
    if (startImageUrl) {
      console.log(`[ContinueProduction] ════════════════════════════════════════════`);
      console.log(`[ContinueProduction] ✓ FRAME RESOLVED: ${frameSource}`);
      console.log(`[ContinueProduction]   URL: ${startImageUrl.substring(0, 80)}...`);
      console.log(`[ContinueProduction] ════════════════════════════════════════════`);
    } else {
      // This should NEVER happen with 7 fallback tiers, but log extensively if it does
      console.error(`[ContinueProduction] ════════════════════════════════════════════`);
      console.error(`[ContinueProduction] ❌ CRITICAL: All 7 fallback tiers exhausted!`);
      console.error(`[ContinueProduction]   previousLastFrameUrl: ${previousLastFrameUrl ? 'YES' : 'NO'}`);
      console.error(`[ContinueProduction]   context.goldenFrameData: ${context?.goldenFrameData ? 'YES' : 'NO'}`);
      console.error(`[ContinueProduction]   context.referenceImageUrl: ${context?.referenceImageUrl ? 'YES' : 'NO'}`);
      console.error(`[ContinueProduction]   context.sceneImageLookup keys: ${Object.keys(context?.sceneImageLookup || {}).join(',')}`);
      console.error(`[ContinueProduction] ════════════════════════════════════════════`);
      
      // GRACEFUL DEGRADATION: Continue without start image (model will generate from scratch)
      // This is better than failing the entire pipeline
      console.warn(`[ContinueProduction] ⚠️ Proceeding WITHOUT start image (degraded continuity mode)`);
      frameSource = 'none_degraded';
    }

    // Update progress - use 'clips_generating' which is a valid pipeline_stage value
    await supabase
      .from('movie_projects')
      .update({
        pipeline_stage: 'clips_generating',
        status: 'generating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    console.log(`[ContinueProduction] Calling generate-single-clip for clip ${nextClipIndex + 1}...`);
    console.log(`[ContinueProduction] ═══════════════════════════════════════════════════`);
    console.log(`[ContinueProduction] DATA HANDOFF TO CLIP ${nextClipIndex + 1}:`);
    console.log(`[ContinueProduction]   - startImageUrl: ${startImageUrl ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - clipDuration: ${context?.clipDuration || 10}s`);
    console.log(`[ContinueProduction]   - identityBible: ${context?.identityBible ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - identityBible.characterDescription: ${context?.identityBible?.characterDescription ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - identityBible.nonFacialAnchors: ${context?.identityBible?.nonFacialAnchors ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - identityBible.antiMorphingPrompts: ${context?.identityBible?.antiMorphingPrompts?.length || 0}`);
    console.log(`[ContinueProduction]   - identityBible.occlusionNegatives: ${context?.identityBible?.occlusionNegatives?.length || 0}`);
    console.log(`[ContinueProduction]   - faceLock: ${context?.faceLock ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - masterSceneAnchor: ${context?.masterSceneAnchor ? 'YES' : 'NO'}`);

    console.log(`[ContinueProduction]   - previousMotionVectors: ${previousMotionVectors ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - previousContinuityManifest: ${previousContinuityManifest ? 'YES' : 'NO'}`);
    console.log(`[ContinueProduction]   - extractedCharacters: ${context?.extractedCharacters?.length || 0}`);
    console.log(`[ContinueProduction]   - accumulatedAnchors: ${context?.accumulatedAnchors?.length || 0}`);
    console.log(`[ContinueProduction] ═══════════════════════════════════════════════════`);

    // Call generate-single-clip with COMPLETE data handoff
    // CRITICAL: Pass ALL continuity and identity data
    // BUG FIX: Ensure durationSeconds is passed through callback chain!
    const clipDuration = context?.clipDuration || 10; // Kling V3 default: 10s
    const videoEngine = context?.videoEngine || 'kling'; // DEFAULT: Kling V3 (all modes)
    const isAvatarMode = !!context?.isAvatarMode; // EXPLICIT flag from pipeline context
    console.log(`[ContinueProduction] Clip ${nextClipIndex + 1} will use duration: ${clipDuration}s, isAvatarMode: ${isAvatarMode}`);
    
    // ROOT CAUSE FIX #6: Extract pose chaining data from pending_video_tasks predictions
    let startPose = '';
    let endPose = '';
    let visualContinuity = '';
    let nextAvatarRole: 'primary' | 'secondary' = 'primary';
    if (context?.pendingVideoTasks?.predictions) {
      const nextPredData = context.pendingVideoTasks.predictions.find(
        (p: { clipIndex: number }) => p.clipIndex === nextClipIndex
      );
      if (nextPredData) {
        startPose = nextPredData.startPose || '';
        endPose = nextPredData.endPose || '';
        visualContinuity = nextPredData.visualContinuity || '';
        nextAvatarRole = nextPredData.avatarRole || 'primary';
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DUAL AVATAR: Swap start image when switching to secondary character
    // Mirrors the watchdog's dual avatar logic for the callback chain path
    // ═══════════════════════════════════════════════════════════════════════════
    const secondaryAvatarData = context?.pendingVideoTasks?.secondaryAvatar;
    let characterIdentityLock = '';
    
    if (isAvatarMode && nextAvatarRole === 'secondary' && secondaryAvatarData?.imageUrl) {
      console.log(`[ContinueProduction] 🎭 DUAL AVATAR: Clip ${nextClipIndex + 1} uses SECONDARY avatar (${secondaryAvatarData.name})`);
      
      // Determine if this is a character switch (previous clip was primary)
      const prevPredData = context?.pendingVideoTasks?.predictions?.find(
        (p: { clipIndex: number }) => p.clipIndex === completedClipIndex
      );
      const prevWasSecondary = prevPredData?.avatarRole === 'secondary';
      const isCharacterSwitch = !prevWasSecondary;
      
      // Find the most recent completed clip of the secondary character
      let secondaryFrameUrl: string | null = null;
      if (!isCharacterSwitch) {
        // Same character continuing — use last frame from previous clip (already resolved above)
        console.log(`[ContinueProduction] 🔗 SECONDARY CONTINUITY: Same character continuing, using last frame`);
        // startImageUrl already has the previous clip's last frame — correct for continuity
      } else {
        // CHARACTER SWITCH: Need to use secondary avatar's reference image
        // Check if we have a cached composite
        const cachedSecondaryScene = context?.pendingVideoTasks?._secondarySceneCache;
        if (cachedSecondaryScene) {
          secondaryFrameUrl = cachedSecondaryScene;
          console.log(`[ContinueProduction] ✅ Using CACHED secondary composite`);
        } else {
          // Use secondary avatar's original image as start image
          secondaryFrameUrl = secondaryAvatarData.imageUrl;
          console.log(`[ContinueProduction] 🎭 Using secondary avatar reference image: ${secondaryFrameUrl.substring(0, 60)}...`);
          
          // Try scene compositing for the secondary avatar
          if (context?.pendingVideoTasks?.sceneDescription) {
            try {
              const sceneResponse = await fetch(`${supabaseUrl}/functions/v1/generate-avatar-scene`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  avatarImageUrl: secondaryAvatarData.imageUrl,
                  sceneDescription: context.pendingVideoTasks.sceneDescription,
                  aspectRatio: context?.aspectRatio || '16:9',
                  placement: 'center',
                }),
              });
              
              if (sceneResponse.ok) {
                const sceneResult = await sceneResponse.json();
                if (sceneResult.success && sceneResult.sceneImageUrl) {
                  secondaryFrameUrl = sceneResult.sceneImageUrl;
                  console.log(`[ContinueProduction] ✅ Secondary scene compositing succeeded`);
                  
                  // Cache for future secondary clips
                  if (context.pendingVideoTasks) {
                    context.pendingVideoTasks._secondarySceneCache = secondaryFrameUrl;
                  }
                }
              }
            } catch (sceneErr) {
              console.warn(`[ContinueProduction] Secondary scene compositing failed (non-fatal):`, sceneErr);
            }
          }
        }
        
        // Override startImageUrl with secondary avatar's image
        if (secondaryFrameUrl) {
          startImageUrl = secondaryFrameUrl;
          frameSource = 'secondary_avatar';
          console.log(`[ContinueProduction] 🎭 START IMAGE SWAPPED to secondary avatar`);
        }
      }
      
      characterIdentityLock = `[SECONDARY CHARACTER: This clip features ${secondaryAvatarData.name}. The character must look EXACTLY like the person in the start frame reference image. Preserve their exact facial features, hair, skin tone, eye color, body build, and outfit.]`;
    } else if (isAvatarMode && nextAvatarRole === 'primary') {
      // Ensure primary clips after a secondary clip use the PRIMARY avatar's image
      const prevPredData = context?.pendingVideoTasks?.predictions?.find(
        (p: { clipIndex: number }) => p.clipIndex === completedClipIndex
      );
      const prevWasSecondary = prevPredData?.avatarRole === 'secondary';
      
      if (prevWasSecondary) {
        // Switching BACK to primary — need to find primary's last frame or original image
        console.log(`[ContinueProduction] 🎭 DUAL AVATAR: Switching BACK to primary avatar`);
        
        // Find the most recent primary clip's last frame
        let primaryFrameFound = false;
        if (context?.pendingVideoTasks?.predictions) {
          for (let searchIdx = completedClipIndex - 1; searchIdx >= 0; searchIdx--) {
            const candidate = context.pendingVideoTasks.predictions.find(
              (p: { clipIndex: number }) => p.clipIndex === searchIdx
            );
            if (candidate?.avatarRole === 'primary' && candidate?.status === 'completed') {
              // Try to get this clip's last frame from DB
              const { data: primaryClip } = await supabase
                .from('video_clips')
                .select('last_frame_url, video_url')
                .eq('project_id', projectId)
                .eq('shot_index', searchIdx)
                .eq('status', 'completed')
                .maybeSingle();
              
              if (primaryClip?.last_frame_url) {
                startImageUrl = primaryClip.last_frame_url;
                frameSource = 'primary_avatar_last_frame';
                primaryFrameFound = true;
                console.log(`[ContinueProduction] ✅ Using primary avatar's last frame from clip ${searchIdx + 1}`);
                break;
              }
            }
          }
        }
        
        // Fallback: use original avatar image
        if (!primaryFrameFound) {
          const originalImage = context?.pendingVideoTasks?.originalAvatarImageUrl
            || context?.pendingVideoTasks?.sceneImageUrl
            || context?.referenceImageUrl;
          if (originalImage) {
            startImageUrl = originalImage;
            frameSource = 'primary_avatar_original';
            console.log(`[ContinueProduction] ✅ Using primary avatar's original image`);
          }
        }
      }
    }
    
    // Prepend character identity lock to prompt for dual avatar clips
    if (characterIdentityLock) {
      nextClipPrompt = `${characterIdentityLock}\n${nextClipPrompt}`;
    }

    const clipResult = await callEdgeFunction('generate-single-clip', {
      userId,
      projectId,
      videoEngine,
      isAvatarMode, // EXPLICIT flag — generate-single-clip uses this, NOT videoEngine
      // ROOT CAUSE FIX #3: Use shotIndex as primary key (not clipIndex)
      shotIndex: nextClipIndex,
      clipIndex: nextClipIndex, // keep as fallback for backwards compat
      prompt: nextClipPrompt,
      totalClips,
      startImageUrl,
      // BUG FIX: Pass durationSeconds - this was missing and defaulting to 5!
      durationSeconds: clipDuration,
      // CONTINUITY DATA FROM PREVIOUS CLIP
      previousMotionVectors,
      previousContinuityManifest,
      // ROOT CAUSE FIX #6: Pass pose chaining data
      startPose,
      endPose,
      visualContinuity,
      // DUAL AVATAR: Pass avatar role so downstream knows which character this is
      avatarRole: nextAvatarRole,
      secondaryAvatar: secondaryAvatarData || null,
      // MASTER ANCHORS
      masterSceneAnchor: context?.masterSceneAnchor,
      goldenFrameData: context?.goldenFrameData,
      // IDENTITY DATA (CRITICAL FOR CHARACTER CONSISTENCY)
      identityBible: context?.identityBible,
      faceLock: context?.faceLock, // FACE LOCK — prevents facial drift across clips
      extractedCharacters: context?.extractedCharacters,
      // SCENE REFERENCES
      referenceImageUrl: context?.referenceImageUrl,
      sceneImageUrl: context?.sceneImageLookup?.[nextClipIndex] || context?.sceneImageLookup?.[0],
      accumulatedAnchors: context?.accumulatedAnchors || [],
      // QUALITY SETTINGS
      colorGrading: context?.colorGrading || 'cinematic',
      qualityTier: context?.qualityTier || 'standard',
      aspectRatio: context?.aspectRatio || '16:9',
      // CRITICAL FIX: skipPolling prevents 60s Edge Function timeout
      // The watchdog will poll the prediction and trigger continue-production for the next clip
      skipPolling: true,
      // CALLBACK CONTINUATION — triggerNextClip is inert with skipPolling,
      // but we pass it so the watchdog can use it when resuming
      triggerNextClip: true,
      // FULL CONTEXT FOR PERSISTENCE
      pipelineContext: context,
    });

    console.log(`[ContinueProduction] Clip ${nextClipIndex + 1} generation initiated`);

    return new Response(
      JSON.stringify({
        success: true,
        action: 'next_clip_triggered',
        nextClipIndex,
        totalClips,
        clipResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ContinueProduction] Error:", error);
    
    // FAIL-PROOF: Instead of marking project as permanently 'failed',
    // set a watchdog recovery flag so the watchdog can auto-resume.
    // This prevents transient errors (network blips, edge function cold starts,
    // rate limits, mutex conflicts) from permanently killing the pipeline.
    try {
      if (request?.projectId) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error in continue-production';
        const isTransient = /rate|timeout|429|503|504|ECONNRESET|fetch failed|AbortError|GENERATION_LOCKED/i.test(errorMsg);
        
        if (isTransient) {
          // TRANSIENT ERROR: Don't mark failed — set watchdog resume flag
          console.log(`[ContinueProduction] ⚠️ TRANSIENT ERROR detected: "${errorMsg.substring(0, 100)}" — flagging for watchdog recovery`);
          
          // Read current tasks to preserve data
          const { data: currentProject } = await supabase
            .from('movie_projects')
            .select('pending_video_tasks')
            .eq('id', request.projectId)
            .maybeSingle();
          
          const currentTasks = (currentProject?.pending_video_tasks || {}) as Record<string, any>;
          
          await supabase
            .from('movie_projects')
            .update({
              // KEEP status as 'generating' — NOT 'failed'
              status: 'generating',
              pending_video_tasks: {
                ...currentTasks,
                needsWatchdogResume: true,
                lastCompletedClip: request.completedClipIndex ?? -1,
                lastTransientError: errorMsg.substring(0, 200),
                lastErrorAt: new Date().toISOString(),
                transientRetryCount: (currentTasks.transientRetryCount || 0) + 1,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', request.projectId);
        } else {
          // NON-TRANSIENT ERROR: Mark failed but still set watchdog flag for false-failure recovery
          console.log(`[ContinueProduction] ❌ NON-TRANSIENT ERROR: "${errorMsg.substring(0, 100)}" — marking failed with recovery flag`);
          
          const { data: currentProject } = await supabase
            .from('movie_projects')
            .select('pending_video_tasks')
            .eq('id', request.projectId)
            .maybeSingle();
          
          const currentTasks = (currentProject?.pending_video_tasks || {}) as Record<string, any>;
          
          await supabase
            .from('movie_projects')
            .update({
              status: 'failed',
              last_error: errorMsg,
              pending_video_tasks: {
                ...currentTasks,
                needsWatchdogResume: true, // Watchdog will check if clips completed despite this error
                lastCompletedClip: request.completedClipIndex ?? -1,
                lastFatalError: errorMsg.substring(0, 200),
                lastErrorAt: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', request.projectId);
        }
      }
    } catch (e) {
      console.error('[ContinueProduction] Failed to update project status:', e);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to call edge functions with ENHANCED rate limit handling
async function callEdgeFunction(name: string, body: any, retries = 3): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  let lastError: Error | null = null;
  
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) {
        // CRITICAL FIX: Use much longer backoff for rate limit errors
        // Kling API needs 15-30+ seconds to clear parallel task queue
        const isRateLimitError = lastError?.message?.includes('429') || 
                                  lastError?.message?.includes('rate') ||
                                  lastError?.message?.includes('parallel task');
        
        // Rate limit: 15s base, exponential. Other errors: 2s base, exponential
        const baseWaitMs = isRateLimitError ? 15000 : 2000;
        const waitMs = baseWaitMs * Math.pow(1.5, i - 1) + (Math.random() * 2000); // Add jitter
        
        console.log(`[ContinueProduction] Retry ${i}/${retries} for ${name}, waiting ${Math.round(waitMs)}ms (${isRateLimitError ? 'RATE_LIMIT' : 'error'})...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // CRITICAL: Parse rate limit errors specially
        if (response.status === 429 || errorText.includes('1303') || errorText.includes('parallel task')) {
          throw new Error(`RATE_LIMITED: ${name} - ${errorText}`);
        }
        
        throw new Error(`${name} failed: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
      console.warn(`[ContinueProduction] ${name} error (attempt ${i + 1}):`, lastError.message);
      
      // If it's a rate limit error and we have retries left, continue
      const isRateLimitError = lastError.message.includes('429') || 
                                lastError.message.includes('RATE_LIMITED') ||
                                lastError.message.includes('parallel task');
      if (isRateLimitError && i < retries) {
        console.log(`[ContinueProduction] Rate limit detected - will retry with longer backoff`);
        continue;
      }
    }
  }
  
  throw lastError || new Error(`${name} failed after ${retries} retries`);
}
