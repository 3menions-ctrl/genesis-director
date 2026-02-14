import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  resilientFetch,
  callEdgeFunction,
  RESILIENCE_CONFIG,
} from "../_shared/network-resilience.ts";
import { checkMultipleContent } from "../_shared/content-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MODE ROUTER - Intelligent Video Creation Pipeline Dispatcher
 * 
 * Routes creation requests to the optimal pipeline based on mode:
 * - text-to-video / b-roll → Hollywood Pipeline (multi-clip with script)
 * - image-to-video → Hollywood Pipeline with image anchor
 * - avatar → Hollywood Pipeline with Avatar Identity Bible injection
 *           (UNIFIED PIPELINE: Avatars are actors placed into full cinematic scenes)
 * - video-to-video → Direct style transfer pipeline (single pass)
 * - motion-transfer → Direct pose estimation + animation (single pass)
 * 
 * Key Architecture (v2.0 - Avatar as Actor):
 * Avatar mode now uses the full Hollywood Pipeline. The avatar's Character Bible
 * becomes the Identity Bible, ensuring the avatar appears consistently across
 * all generated scenes. Multi-avatar casting is supported by mapping multiple
 * avatars to different characters in the script.
 */

/**
 * Generate a creative, descriptive title from the user's prompt
 */
async function generateVideoTitle(prompt: string, mode: string, stylePreset?: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  // Fallback if no API key - create a short, clean title from the prompt
  if (!OPENAI_API_KEY) {
    return createFallbackTitle(prompt, mode);
  }
  
  try {
    const systemPrompt = `You are a creative video title generator. Generate a SHORT, catchy, memorable title (2-5 words max) for a video based on the user's concept.

Rules:
- Maximum 5 words, ideally 2-4 words
- Be creative but relevant to the content
- No quotes, colons, or special characters
- Capitalize each word (Title Case)
- Make it sound like a movie or video title
- Capture the essence/mood of the content

Examples:
- "A dog running on the beach at sunset" → "Golden Shore Run"
- "Explaining quantum physics" → "Quantum Unveiled"
- "Space shuttle launching into orbit" → "Orbital Ascent"
- "Chef cooking a gourmet meal" → "Culinary Mastery"
- "City timelapse at night" → "Urban Nightscape"`;

    const userPrompt = `Generate a title for this ${mode.replace(/-/g, ' ')} video:
"${prompt.substring(0, 300)}"${stylePreset ? `\nStyle: ${stylePreset}` : ''}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 30,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.warn("[ModeRouter] Title generation API failed, using fallback");
      return createFallbackTitle(prompt, mode);
    }

    const data = await response.json();
    const generatedTitle = data.choices?.[0]?.message?.content?.trim();
    
    if (generatedTitle && generatedTitle.length > 0 && generatedTitle.length <= 60) {
      // Clean up any quotes or unwanted characters
      const cleanTitle = generatedTitle.replace(/["""'']/g, '').replace(/^[:;\-–—]+/, '').trim();
      console.log(`[ModeRouter] Generated title: "${cleanTitle}"`);
      return cleanTitle;
    }
    
    return createFallbackTitle(prompt, mode);
  } catch (error) {
    console.error("[ModeRouter] Title generation error:", error);
    return createFallbackTitle(prompt, mode);
  }
}

/**
 * Create a fallback title from the prompt when AI is unavailable
 */
function createFallbackTitle(prompt: string, mode: string): string {
  // Extract key words from the prompt
  const cleanPrompt = prompt
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim();
  
  // Get first few meaningful words
  const words = cleanPrompt.split(' ').filter(w => 
    w.length > 2 && !['the', 'and', 'for', 'with', 'about', 'that', 'this', 'from', 'into'].includes(w.toLowerCase())
  );
  
  if (words.length >= 2) {
    // Take first 3-4 significant words and title case them
    const titleWords = words.slice(0, 4).map(w => 
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    );
    return titleWords.join(' ');
  }
  
  // Ultimate fallback with mode and timestamp
  const modeLabel = mode.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `${modeLabel} Creation`;
}

interface CharacterBible {
  name?: string;
  description?: string;
  personality?: string;
  front_view?: string;
  side_view?: string;
  back_view?: string;
  silhouette?: string;
  hair_description?: string;
  clothing_description?: string;
  body_type?: string;
  distinguishing_features?: string[];
  reference_images?: {
    front?: string;
    side?: string | null;
    back?: string | null;
  };
  negative_prompts?: string[];
}

// Multi-Avatar Casting: Map avatars to character roles
interface AvatarCastMember {
  avatarTemplateId: string;
  characterName: string;
  characterBible: CharacterBible;
  voiceId: string;
  isPrimary?: boolean; // Main protagonist
}

interface CinematicModeConfig {
  enabled: boolean;
  movementType: 'static' | 'walking' | 'driving' | 'action' | 'random';
  cameraAngle: 'static' | 'tracking' | 'dynamic' | 'random';
}

interface ModeRouterRequest {
  mode: 'text-to-video' | 'image-to-video' | 'avatar' | 'video-to-video' | 'motion-transfer' | 'b-roll';
  userId: string;
  projectId?: string;
  
  // Text content (story concept for avatar, prompt for others)
  prompt: string;
  
  // Media inputs
  imageUrl?: string;
  videoUrl?: string;
  
  // Style configuration
  stylePreset?: string;
  voiceId?: string;
  
  // Avatar-specific: Single avatar (legacy support)
  characterBible?: CharacterBible;
  avatarTemplateId?: string;
  avatarType?: 'realistic' | 'animated'; // Lock avatar visual style
  
  // Avatar-specific: Multi-avatar casting (new)
  avatarCast?: AvatarCastMember[];
  
  // Avatar-specific: Scene/background description (e.g., "a witches house")
  sceneDescription?: string;
  
  // Avatar-specific: Cinematic mode for dynamic movement and camera
  cinematicMode?: CinematicModeConfig;
  
  // Production controls
  aspectRatio: string;
  clipCount: number;
  clipDuration: number;
  enableNarration: boolean;
  enableMusic: boolean;
  
  // Genre/mood for cinematic styling
  genre?: string;
  mood?: string;
  
  // Breakout template parameters - for platform UI shattering effect
  isBreakout?: boolean;
  breakoutStartImageUrl?: string; // Platform interface image (Facebook post, YouTube player, etc.)
  breakoutPlatform?: 'facebook' | 'youtube' | 'tiktok' | 'instagram';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const request: ModeRouterRequest = await req.json();
    const { mode, userId, prompt, imageUrl, videoUrl, stylePreset, voiceId, aspectRatio, clipCount, clipDuration, enableNarration, enableMusic, genre, mood, isBreakout, breakoutStartImageUrl, breakoutPlatform } = request;

    console.log(`[ModeRouter] Routing ${mode} request for user ${userId}`);
    console.log(`[ModeRouter] Config: ${clipCount} clips × ${clipDuration}s, aspect ${aspectRatio}`);
    if (isBreakout) {
      console.log(`[ModeRouter] BREAKOUT MODE: Platform=${breakoutPlatform}, StartImage=${breakoutStartImageUrl ? 'provided' : 'none'}`);
    }

    // =========================================================
    // CONTENT SAFETY CHECK - BLOCK ALL NSFW/EXPLICIT/ILLEGAL CONTENT
    // This is the GATEWAY for all generation modes - nothing passes without safety check
    // =========================================================
    const safetyCheck = checkMultipleContent([
      prompt,
      request.sceneDescription,
      stylePreset,
      genre,
      mood,
    ]);
    
    if (!safetyCheck.isSafe) {
      console.error(`[ModeRouter] ⛔ CONTENT BLOCKED - Category: ${safetyCheck.category}, Terms: ${safetyCheck.matchedTerms.slice(0, 3).join(', ')}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: safetyCheck.message,
          blocked: true,
          category: safetyCheck.category,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`[ModeRouter] ✅ Content safety check passed`);

    // =========================================================
    // SINGLE PROJECT CONSTRAINT: Only one active project per user
    // Prevents resource abuse and confusion
    // =========================================================
    const { data: activeProjects, error: activeCheckError } = await supabase
      .from('movie_projects')
      .select('id, title, status, created_at')
      .eq('user_id', userId)
      .in('status', ['generating', 'processing', 'pending', 'awaiting_approval'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeCheckError) {
      console.error('[ModeRouter] Failed to check active projects:', activeCheckError);
      throw new Error('Failed to verify project availability');
    }

    if (activeProjects && activeProjects.length > 0) {
      const existing = activeProjects[0];
      console.log(`[ModeRouter] BLOCKED: User ${userId} already has active project ${existing.id} (${existing.status})`);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'active_project_exists',
          message: `You already have an active project "${existing.title}" in progress. Please wait for it to complete or cancel it before starting a new one.`,
          existingProjectId: existing.id,
          existingProjectTitle: existing.title,
          existingProjectStatus: existing.status,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ModeRouter] ✓ No active projects, proceeding with creation`);

    // =========================================================
    // CREDIT DEDUCTION - Must happen BEFORE project creation
    // Avatar mode bypasses hollywood-pipeline, so credits must be deducted here
    // Text-to-video/cinematic routes to hollywood-pipeline which handles its own credits
    // =========================================================
    const requiresLocalCreditDeduction = mode === 'avatar' || mode === 'video-to-video' || mode === 'motion-transfer';
    
    if (requiresLocalCreditDeduction) {
      // Calculate total credits needed using the same formula as hollywood-pipeline
      // Base: 10 credits for clips 1-6 at ≤6s, Extended: 15 credits for clips 7+ OR >6s
      const BASE_CREDITS = 10;
      const EXTENDED_CREDITS = 15;
      const BASE_CLIP_THRESHOLD = 6;
      const BASE_DURATION_THRESHOLD = 6;
      
      let totalCredits = 0;
      for (let i = 0; i < clipCount; i++) {
        const isExtended = i >= BASE_CLIP_THRESHOLD || clipDuration > BASE_DURATION_THRESHOLD;
        totalCredits += isExtended ? EXTENDED_CREDITS : BASE_CREDITS;
      }
      
      console.log(`[ModeRouter] Credit check for ${mode}: ${clipCount} clips × ${clipDuration}s = ${totalCredits} credits required`);
      
      // Check if user has enough credits
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', userId)
        .single();
      
      if (profileError || !profile) {
        console.error('[ModeRouter] Failed to fetch user profile:', profileError);
        throw new Error('Failed to verify credit balance');
      }
      
      if (profile.credits_balance < totalCredits) {
        console.log(`[ModeRouter] INSUFFICIENT CREDITS: User has ${profile.credits_balance}, needs ${totalCredits}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Insufficient credits. Required: ${totalCredits}, Available: ${profile.credits_balance}`,
            required: totalCredits,
            available: profile.credits_balance,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // DEDUCT CREDITS UPFRONT
      console.log(`[ModeRouter] Deducting ${totalCredits} credits from user ${userId}`);
      const { error: deductError } = await supabase.rpc('deduct_credits', {
        p_user_id: userId,
        p_amount: totalCredits,
        p_description: `Video generation: ${clipCount} clips × ${clipDuration}s`,
        p_project_id: null, // Will be set after project creation
        p_clip_duration: clipCount * clipDuration,
      });
      
      if (deductError) {
        console.error('[ModeRouter] Credit deduction failed:', deductError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to deduct credits. Please try again.',
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[ModeRouter] ✓ Successfully deducted ${totalCredits} credits`);
    }

    // Create or get project with full mode data
    let projectId = request.projectId;
    if (!projectId) {
      // Generate a proper title from the user's prompt
      const generatedTitle = await generateVideoTitle(prompt, mode, stylePreset);
      
      const { data: project, error: projectError } = await supabase
        .from('movie_projects')
        .insert({
          user_id: userId,
          title: generatedTitle,
          aspect_ratio: aspectRatio,
          status: 'generating',
          mode: mode,
          source_image_url: imageUrl || null,
          source_video_url: videoUrl || null,
          avatar_voice_id: voiceId || null,
          // CRITICAL: Save the user's script to synopsis so it's not lost
          synopsis: prompt || null,
          // For avatar mode, also save scene description in pending_video_tasks
          pending_video_tasks: mode === 'avatar' ? {
            script: prompt,
            sceneDescription: request.sceneDescription || null,
            clipCount: clipCount,
            clipDuration: clipDuration,
          } : {},
          pipeline_state: {
            stage: 'init',
            progress: 0,
            startedAt: new Date().toISOString(),
            message: 'Initializing pipeline...',
          },
        })
        .select('id')
        .single();

      if (projectError || !project) throw new Error(`Failed to create project: ${projectError?.message || 'No project returned'}`);
      projectId = project.id as string;
    } else {
      // Update existing project with mode data
      await supabase
        .from('movie_projects')
        .update({
          mode: mode,
          source_image_url: imageUrl || null,
          source_video_url: videoUrl || null,
          avatar_voice_id: voiceId || null,
          pipeline_state: {
            stage: 'init',
            progress: 0,
            startedAt: new Date().toISOString(),
            message: 'Initializing pipeline...',
          },
        })
        .eq('id', projectId);
    }

    // Route based on mode
    switch (mode) {
      case 'avatar':
        // AVATAR DIRECT PATH - Bypasses Hollywood complexity for avatar videos
        // User's exact script → TTS → Lip-sync video
        // Scene description → Background generation (if provided)
        // Now supports multi-clip generation via clipCount parameter
        return await handleAvatarDirectMode({
          projectId: projectId!,
          userId,
          script: prompt, // User's EXACT script to be spoken verbatim
          sceneDescription: request.sceneDescription,
          avatarImageUrl: imageUrl!,
          voiceId: voiceId || 'bella',
          aspectRatio,
          clipCount, // Pass clip count for multi-clip generation
          clipDuration, // Pass clip duration for each segment
          cinematicMode: request.cinematicMode, // Pass cinematic mode config
          supabase,
        });

      case 'video-to-video':
        // STYLE TRANSFER: Direct path - no script needed
        // Apply style to source video in single pass
        return await handleStyleTransferMode({
          projectId: projectId!,
          userId,
          videoUrl: videoUrl!,
          stylePreset: stylePreset!,
          aspectRatio,
          supabase,
        });

      case 'motion-transfer':
        // MOTION TRANSFER: Direct path - no script needed
        // Extract pose from source, apply to target
        return await handleMotionTransferMode({
          projectId: projectId!,
          userId,
          sourceVideoUrl: videoUrl!,
          targetImageUrl: imageUrl!,
          aspectRatio,
          supabase,
        });

      case 'text-to-video':
      case 'image-to-video':
      case 'b-roll':
      default:
        // CINEMATIC: Full pipeline with script generation
        return await handleCinematicMode({
          projectId: projectId!,
          userId,
          concept: prompt,
          referenceImageUrl: imageUrl,
          aspectRatio,
          clipCount,
          clipDuration,
          enableNarration,
          enableMusic,
          mode,
          genre,
          mood,
          // Breakout template parameters - for platform UI shattering effect
          isBreakout,
          breakoutStartImageUrl,
          breakoutPlatform,
          supabase,
        });
    }

  } catch (error) {
    console.error("[ModeRouter] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * AVATAR DIRECT MODE - Simple, world-class avatar pipeline
 * 
 * Direct path that ensures:
 * 1. User's exact script is spoken VERBATIM (no AI modification)
 * 2. User's scene description is used for background
 * 3. True lip-sync via Wav2Lip
 * 
 * This bypasses Hollywood complexity for simple avatar videos.
 */
async function handleAvatarDirectMode(params: {
  projectId: string;
  userId: string;
  script: string; // User's EXACT text to be spoken
  sceneDescription?: string;
  avatarImageUrl: string;
  voiceId: string;
  aspectRatio: string;
  clipCount: number; // Number of clips to generate
  clipDuration: number; // Duration per clip in seconds
  cinematicMode?: CinematicModeConfig; // Cinematic mode for dynamic movement
  supabase: any;
}) {
  const { projectId, userId, script, sceneDescription, avatarImageUrl, voiceId, aspectRatio, clipCount, clipDuration, cinematicMode, supabase } = params;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log(`[ModeRouter/AvatarDirect] ═══════════════════════════════════════════════════`);
  console.log(`[ModeRouter/AvatarDirect] DIRECT AVATAR PATH - Multi-clip Support`);
  console.log(`[ModeRouter/AvatarDirect] Script (verbatim): "${script.substring(0, 80)}..."`);
  console.log(`[ModeRouter/AvatarDirect] Scene: "${sceneDescription?.substring(0, 50) || 'Using avatar background'}"`);
  console.log(`[ModeRouter/AvatarDirect] Clips: ${clipCount} × ${clipDuration}s`);
  console.log(`[ModeRouter/AvatarDirect] Cinematic: ${cinematicMode?.enabled ? `ON (${cinematicMode.movementType}/${cinematicMode.cameraAngle})` : 'OFF'}`);
  console.log(`[ModeRouter/AvatarDirect] ═══════════════════════════════════════════════════`);

  // Update project status
  await supabase.from('movie_projects').update({
    status: 'generating',
    pipeline_state: {
      stage: 'init',
      progress: 5,
      message: cinematicMode?.enabled 
        ? 'Starting cinematic avatar pipeline...' 
        : 'Starting direct avatar pipeline...',
    },
  }).eq('id', projectId);

  // Call the new direct avatar function WITH RESILIENT FETCH
  // This handles connection resets, rate limits, and network errors gracefully
  const directResponse = await resilientFetch(`${supabaseUrl}/functions/v1/generate-avatar-direct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      script, // EXACT user text, no changes
      avatarImageUrl,
      voiceId,
      sceneDescription,
      projectId,
      userId,
      aspectRatio,
      clipCount, // Number of clips to generate
      clipDuration, // Duration per clip in seconds
      cinematicMode, // Pass cinematic mode to generation
      avatarType: request.avatarType || 'realistic', // Lock avatar style type
    }),
    maxRetries: 3,
    timeoutMs: 90000, // 90 second timeout for the initial call (most work is async)
  });

  if (!directResponse.ok) {
    const error = await directResponse.text();
    throw new Error(`Avatar direct pipeline failed: ${error}`);
  }

  const result = await directResponse.json();

  return new Response(
    JSON.stringify({
      success: true,
      projectId,
      mode: 'avatar',
      status: result.status || 'processing',
      message: result.message || 'Creating your avatar video with your exact script...',
      videoUrl: result.videoUrl,
      audioUrl: result.audioUrl,
      pipeline: 'avatar-direct',
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * AVATAR CINEMATIC MODE v2.0 - Full Hollywood Pipeline with Avatar Identity
 * (LEGACY - kept for multi-clip cinematic avatar videos)
 * 
 * Routes avatar requests through the full cinematic pipeline:
 * 1. Avatar's Character Bible becomes the Identity Bible for all shots
 * 2. Full script generation based on user's concept + scene description
 * 3. Multi-shot video generation with avatar appearing consistently in all scenes
 * 4. Optional narration (avatar's voice) and music
 */
async function handleAvatarCinematicMode(params: {
  projectId: string;
  userId: string;
  concept: string;
  sceneDescription?: string;
  avatarImageUrl?: string;
  voiceId: string;
  aspectRatio: string;
  clipCount: number;
  clipDuration: number;
  enableNarration: boolean;
  enableMusic: boolean;
  characterBible?: CharacterBible;
  avatarTemplateId?: string;
  avatarCast?: AvatarCastMember[];
  supabase: any;
}) {
  const { 
    projectId, userId, concept, sceneDescription, avatarImageUrl, voiceId, 
    aspectRatio, clipCount, clipDuration, enableNarration, enableMusic,
    characterBible, avatarTemplateId, avatarCast, supabase 
  } = params;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log(`[ModeRouter/AvatarCinematic] Starting full cinematic pipeline for avatar`);
  console.log(`[ModeRouter/AvatarCinematic] Concept: "${concept.substring(0, 100)}..."`);
  console.log(`[ModeRouter/AvatarCinematic] Scene: "${sceneDescription?.substring(0, 100) || 'Not specified'}"`);
  console.log(`[ModeRouter/AvatarCinematic] Config: ${clipCount} clips × ${clipDuration}s`);

  // Build the combined concept with scene context
  let fullConcept = concept;
  if (sceneDescription && sceneDescription.trim()) {
    // Merge scene description into the concept
    fullConcept = `Setting: ${sceneDescription.trim()}. Story: ${concept}`;
    console.log(`[ModeRouter/AvatarCinematic] Merged concept: "${fullConcept.substring(0, 150)}..."`);
  }

  // Build Identity Bible from Avatar Character Bible
  // This ensures the avatar appears consistently across all shots
  let identityBible: any = null;
  let referenceImageUrl = avatarImageUrl;
  
  if (characterBible) {
    console.log(`[ModeRouter/AvatarCinematic] Building Identity Bible from avatar: ${characterBible.name || 'unnamed'}`);
    
    // Convert Character Bible to Identity Bible format for Hollywood pipeline
    identityBible = {
      characterIdentity: {
        description: characterBible.description || characterBible.front_view || '',
        facialFeatures: characterBible.front_view || '',
        clothing: characterBible.clothing_description || '',
        bodyType: characterBible.body_type || '',
        distinctiveMarkers: characterBible.distinguishing_features || [],
      },
      consistencyPrompt: [
        characterBible.front_view,
        characterBible.side_view,
        characterBible.back_view,
      ].filter(Boolean).join(' '),
      originalReferenceUrl: characterBible.reference_images?.front || avatarImageUrl,
      consistencyAnchors: characterBible.distinguishing_features || [],
      nonFacialAnchors: {
        bodyType: characterBible.body_type,
        clothingSignature: characterBible.clothing_description,
        hairFromBehind: characterBible.hair_description,
        silhouetteDescription: characterBible.silhouette,
      },
      occlusionNegatives: characterBible.negative_prompts || [],
      // Use avatar's multi-view reference images
      multiViewRefs: characterBible.reference_images,
    };
    
    // Use front view as primary reference if available
    if (characterBible.reference_images?.front) {
      referenceImageUrl = characterBible.reference_images.front;
    }
  }

  // Build avatar cast for multi-character support
  let extractedCharacters: any[] = [];
  let characterVoiceMap: Record<string, string> = {};
  
  if (avatarCast && avatarCast.length > 0) {
    console.log(`[ModeRouter/AvatarCinematic] Multi-avatar cast: ${avatarCast.length} characters`);
    
    extractedCharacters = avatarCast.map((member, index) => ({
      id: `avatar_${index}`,
      name: member.characterName,
      appearance: member.characterBible.front_view || member.characterBible.description || '',
      clothing: member.characterBible.clothing_description,
      distinguishingFeatures: member.characterBible.distinguishing_features?.join(', '),
      referenceImageUrl: member.characterBible.reference_images?.front,
      isPrimary: member.isPrimary || index === 0,
    }));
    
    // Map character names to voice IDs
    avatarCast.forEach(member => {
      characterVoiceMap[member.characterName] = member.voiceId;
    });
    
    // Use primary avatar's reference as main identity
    const primaryAvatar = avatarCast.find(m => m.isPrimary) || avatarCast[0];
    if (primaryAvatar.characterBible.reference_images?.front) {
      referenceImageUrl = primaryAvatar.characterBible.reference_images.front;
    }
    
    // Build identity bible from primary avatar
    if (!identityBible && primaryAvatar.characterBible) {
      const cb = primaryAvatar.characterBible;
      identityBible = {
        characterIdentity: {
          description: cb.description || cb.front_view || '',
          clothing: cb.clothing_description || '',
          bodyType: cb.body_type || '',
        },
        consistencyPrompt: cb.front_view || '',
        originalReferenceUrl: cb.reference_images?.front,
        multiViewRefs: cb.reference_images,
      };
    }
  } else if (characterBible) {
    // Single avatar - add to extracted characters
    extractedCharacters = [{
      id: 'avatar_0',
      name: characterBible.name || 'The Character',
      appearance: characterBible.front_view || characterBible.description || '',
      clothing: characterBible.clothing_description,
      distinguishingFeatures: characterBible.distinguishing_features?.join(', '),
      referenceImageUrl: characterBible.reference_images?.front || avatarImageUrl,
      isPrimary: true,
    }];
    
    characterVoiceMap[characterBible.name || 'The Character'] = voiceId;
  }

  // Store avatar-specific data in pro_features_data
  const proFeaturesData = {
    identityBible,
    avatarTemplateId,
    extractedCharacters,
    characterVoiceMap,
    avatarCast: avatarCast || (characterBible ? [{ 
      avatarTemplateId,
      characterName: characterBible.name || 'The Character',
      characterBible,
      voiceId,
      isPrimary: true,
    }] : []),
    isAvatarMode: true, // Flag for pipeline to handle avatar-specific logic
  };

  // Update project with avatar identity data
  await supabase.from('movie_projects').update({
    status: 'generating',
    pro_features_data: proFeaturesData,
    pipeline_state: JSON.stringify({
      stage: 'avatar_pipeline_init',
      progress: 5,
      message: 'Initializing avatar cinematic pipeline...',
      avatarName: characterBible?.name || 'Avatar',
      clipCount,
    }),
  }).eq('id', projectId);

  // Route to Hollywood Pipeline with avatar identity injection
  // CRITICAL: For avatar mode, the user's "concept" IS the speech/dialogue text
  // It must be passed as userNarration to preserve it verbatim
  console.log(`[ModeRouter/AvatarCinematic] Routing to Hollywood Pipeline...`);
  console.log(`[ModeRouter/AvatarCinematic] User's speech text (${concept.length} chars): "${concept.substring(0, 100)}..."`);
  
  const pipelineResponse = await fetch(`${supabaseUrl}/functions/v1/hollywood-pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      userId,
      projectId,
      // For avatar mode, the concept becomes a brief scene description
      // The actual speech is passed as userNarration
      concept: sceneDescription 
        ? `${sceneDescription}. Avatar speaking to camera.`
        : `Avatar presentation: ${concept.substring(0, 100)}...`,
      referenceImageUrl,
      aspectRatio,
      clipCount,
      clipDuration,
      includeVoice: enableNarration,
      includeMusic: enableMusic,
      voiceId, // Default voice for narration
      qualityTier: 'professional',
      // Avatar-specific injections
      identityBible,
      extractedCharacters,
      environmentPrompt: sceneDescription, // Scene DNA for visual consistency
      isAvatarMode: true, // Flag for avatar-specific handling
      characterVoiceMap, // Map character names to voice IDs
      // CRITICAL FIX: Pass user's script as explicit narration
      // This tells smart-script-generator to use this text VERBATIM for TTS
      userNarration: concept,
      preserveUserContent: true,
    }),
  });

  if (!pipelineResponse.ok) {
    const error = await pipelineResponse.text();
    throw new Error(`Avatar pipeline failed: ${error}`);
  }

  const result = await pipelineResponse.json();

  return new Response(
    JSON.stringify({
      success: true,
      projectId,
      mode: 'avatar',
      status: 'processing',
      message: `Creating ${clipCount}-clip cinematic video with your avatar. The character will appear in full scenes, not just as a talking head.`,
      avatarName: characterBible?.name || 'Avatar',
      ...result,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * STYLE TRANSFER MODE - Direct Video Transformation
 * No script - just apply style to source video
 */
async function handleStyleTransferMode(params: {
  projectId: string;
  userId: string;
  videoUrl: string;
  stylePreset: string;
  aspectRatio: string;
  supabase: any;
}) {
  const { projectId, userId, videoUrl, stylePreset, aspectRatio, supabase } = params;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log(`[ModeRouter/StyleTransfer] Applying ${stylePreset} to video`);

  // Update project status
  await supabase.from('movie_projects').update({
    status: 'generating',
    pipeline_state: JSON.stringify({
      stage: 'style_transfer',
      progress: 10,
      stylePreset,
      message: `Applying ${stylePreset} style transformation...`
    })
  }).eq('id', projectId);

  // Call stylize-video directly with correct parameter name
  const styleResponse = await fetch(`${supabaseUrl}/functions/v1/stylize-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      videoUrl,
      style: stylePreset, // Use 'style' not 'stylePreset' to match stylize-video API
    }),
  });

  if (!styleResponse.ok) {
    const error = await styleResponse.text();
    throw new Error(`Style transfer failed: ${error}`);
  }

  const result = await styleResponse.json();

  // Update project with prediction ID
  await supabase.from('movie_projects').update({
    pipeline_state: JSON.stringify({
      stage: 'style_rendering',
      progress: 50,
      predictionId: result.predictionId,
      message: 'Rendering stylized video...'
    })
  }).eq('id', projectId);

  return new Response(
    JSON.stringify({
      success: true,
      projectId,
      mode: 'video-to-video',
      predictionId: result.predictionId,
      status: 'processing',
      message: `Applying ${stylePreset} style. Video will maintain original content with new visual style.`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * MOTION TRANSFER MODE - Pose Extraction + Animation
 * No script - extract motion from source, apply to target image
 */
async function handleMotionTransferMode(params: {
  projectId: string;
  userId: string;
  sourceVideoUrl: string;
  targetImageUrl: string;
  aspectRatio: string;
  supabase: any;
}) {
  const { projectId, userId, sourceVideoUrl, targetImageUrl, aspectRatio, supabase } = params;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log(`[ModeRouter/MotionTransfer] Transferring motion to target image`);

  // Update project status
  await supabase.from('movie_projects').update({
    status: 'generating',
    pipeline_state: JSON.stringify({
      stage: 'motion_extraction',
      progress: 10,
      message: 'Extracting motion sequence from source video...'
    })
  }).eq('id', projectId);

  // Call motion-transfer directly
  const motionResponse = await fetch(`${supabaseUrl}/functions/v1/motion-transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      sourceVideoUrl,
      targetImageUrl,
      mode: 'image',
    }),
  });

  if (!motionResponse.ok) {
    const error = await motionResponse.text();
    throw new Error(`Motion transfer failed: ${error}`);
  }

  const result = await motionResponse.json();

  // Update project with prediction ID
  await supabase.from('movie_projects').update({
    pipeline_state: JSON.stringify({
      stage: 'motion_rendering',
      progress: 50,
      predictionId: result.predictionId,
      message: 'Rendering motion-transferred video...'
    })
  }).eq('id', projectId);

  return new Response(
    JSON.stringify({
      success: true,
      projectId,
      mode: 'motion-transfer',
      predictionId: result.predictionId,
      status: 'processing',
      message: 'Transferring motion to target. Your character will perform the exact movements from the source.',
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * CINEMATIC MODE - Full Hollywood Pipeline
 * Multi-clip with script generation, consistency, narration, music
 */
async function handleCinematicMode(params: {
  projectId: string;
  userId: string;
  concept: string;
  referenceImageUrl?: string;
  aspectRatio: string;
  clipCount: number;
  clipDuration: number;
  enableNarration: boolean;
  enableMusic: boolean;
  mode: string;
  genre?: string;
  mood?: string;
  // Breakout template parameters
  isBreakout?: boolean;
  breakoutStartImageUrl?: string;
  breakoutPlatform?: 'facebook' | 'youtube' | 'tiktok' | 'instagram';
  supabase: any;
}) {
  const { projectId, userId, concept, referenceImageUrl, aspectRatio, clipCount, clipDuration, enableNarration, enableMusic, mode, genre, mood, isBreakout, breakoutStartImageUrl, breakoutPlatform, supabase } = params;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log(`[ModeRouter/Cinematic] Starting full pipeline: ${clipCount} clips × ${clipDuration}s`);
  if (isBreakout) {
    console.log(`[ModeRouter/Cinematic] BREAKOUT TEMPLATE: ${breakoutPlatform}, using platform UI as first frame`);
  }

  // Route to hollywood-pipeline with all parameters
  const pipelineResponse = await fetch(`${supabaseUrl}/functions/v1/hollywood-pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      userId,
      projectId,
      concept,
      referenceImageUrl,
      aspectRatio,
      clipCount,
      clipDuration,
      includeVoice: enableNarration,
      includeMusic: enableMusic,
      qualityTier: 'professional',
      genre,
      mood,
      // Breakout template parameters - for platform UI shattering effect
      // The first clip will use breakoutStartImageUrl as the starting frame,
      // with the avatar appearing inside the social media interface
      isBreakout,
      breakoutStartImageUrl,
      breakoutPlatform,
    }),
  });

  if (!pipelineResponse.ok) {
    const error = await pipelineResponse.text();
    throw new Error(`Pipeline failed: ${error}`);
  }

  const result = await pipelineResponse.json();

  // Customize message for breakout templates
  const breakoutMsg = isBreakout 
    ? `Creating ${breakoutPlatform} breakout video - avatar will shatter through the interface!` 
    : `Creating ${clipCount}-clip ${mode.replace(/-/g, ' ')} video with ${enableNarration ? 'narration' : 'no narration'}${enableMusic ? ' and music' : ''}.`;

  return new Response(
    JSON.stringify({
      success: true,
      projectId,
      mode,
      status: 'processing',
      message: breakoutMsg,
      isBreakout,
      breakoutPlatform,
      ...result,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
