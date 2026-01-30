import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
 * - avatar → Direct ElevenLabs TTS + SadTalker (NO script breakdown - text IS the script)
 * - video-to-video → Direct style transfer pipeline (single pass)
 * - motion-transfer → Direct pose estimation + animation (single pass)
 * 
 * Key insight: Avatar/Motion/Style modes don't need script generation - 
 * the user input IS the final content.
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

interface ModeRouterRequest {
  mode: 'text-to-video' | 'image-to-video' | 'avatar' | 'video-to-video' | 'motion-transfer' | 'b-roll';
  userId: string;
  projectId?: string;
  
  // Text content (script for avatar, prompt for others)
  prompt: string;
  
  // Media inputs
  imageUrl?: string;
  videoUrl?: string;
  
  // Style configuration
  stylePreset?: string;
  voiceId?: string;
  
  // Avatar-specific: Character Bible for production consistency
  characterBible?: CharacterBible;
  avatarTemplateId?: string;
  
  // Production controls
  aspectRatio: string;
  clipCount: number;
  clipDuration: number;
  enableNarration: boolean;
  enableMusic: boolean;
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
    const { mode, userId, prompt, imageUrl, videoUrl, stylePreset, voiceId, aspectRatio, clipCount, clipDuration, enableNarration, enableMusic } = request;

    console.log(`[ModeRouter] Routing ${mode} request for user ${userId}`);
    console.log(`[ModeRouter] Config: ${clipCount} clips × ${clipDuration}s, aspect ${aspectRatio}`);

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
        // AVATAR: Direct path - no script generation needed
        // The prompt IS the script, just needs TTS + lip sync
        // Character Bible provides multi-view consistency for production
        return await handleAvatarMode({
          projectId: projectId!,
          userId,
          script: prompt, // Direct use - this is what the avatar says
          imageUrl: imageUrl!,
          voiceId: voiceId || 'onwK4e9ZLuTAKqWW03F9',
          aspectRatio,
          characterBible: request.characterBible,
          avatarTemplateId: request.avatarTemplateId,
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
 * AVATAR MODE - Direct TTS + Lip Sync
 * No script breakdown - the input text is spoken verbatim
 */
async function handleAvatarMode(params: {
  projectId: string;
  userId: string;
  script: string;
  imageUrl: string;
  voiceId: string;
  aspectRatio: string;
  characterBible?: CharacterBible;
  avatarTemplateId?: string;
  supabase: any;
}) {
  const { projectId, userId, script, imageUrl, voiceId, aspectRatio, characterBible, avatarTemplateId, supabase } = params;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log(`[ModeRouter/Avatar] Starting avatar generation, script length: ${script.length} chars`);
  if (characterBible) {
    console.log(`[ModeRouter/Avatar] Character Bible loaded: ${characterBible.name || 'unnamed'}`);
  }

  // Store character bible in pro_features_data for production consistency
  const proFeaturesData = characterBible ? {
    identityBible: characterBible,
    avatarTemplateId,
    multiViewRefs: characterBible.reference_images,
  } : {};

  // Update project status with character bible
  await supabase.from('movie_projects').update({
    status: 'generating',
    pro_features_data: proFeaturesData,
    pipeline_state: JSON.stringify({
      stage: 'avatar_generation',
      progress: 10,
      message: 'Generating speech audio...'
    })
  }).eq('id', projectId);

  // Update project status
  await supabase.from('movie_projects').update({
    status: 'generating',
    pipeline_state: JSON.stringify({
      stage: 'avatar_generation',
      progress: 10,
      message: 'Generating speech audio...'
    })
  }).eq('id', projectId);

  // Call generate-avatar directly with the full script
  const avatarResponse = await fetch(`${supabaseUrl}/functions/v1/generate-avatar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      text: script,
      voiceId,
      avatarImageUrl: imageUrl,
      aspectRatio,
    }),
  });

  if (!avatarResponse.ok) {
    const error = await avatarResponse.text();
    throw new Error(`Avatar generation failed: ${error}`);
  }

  const result = await avatarResponse.json();

  // Update project with prediction ID and audio URL for polling
  await supabase.from('movie_projects').update({
    voice_audio_url: result.audioUrl, // Store audio URL in dedicated column
    pipeline_state: JSON.stringify({
      stage: 'avatar_rendering',
      progress: 30,
      predictionId: result.predictionId,
      audioUrl: result.audioUrl,
      audioDurationMs: result.audioDurationMs,
      message: 'Generating speaking animation...'
    })
  }).eq('id', projectId);

  return new Response(
    JSON.stringify({
      success: true,
      projectId,
      mode: 'avatar',
      predictionId: result.predictionId,
      status: 'processing',
      message: 'Avatar video is being generated. The script will be spoken exactly as written.',
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
  supabase: any;
}) {
  const { projectId, userId, concept, referenceImageUrl, aspectRatio, clipCount, clipDuration, enableNarration, enableMusic, mode, supabase } = params;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log(`[ModeRouter/Cinematic] Starting full pipeline: ${clipCount} clips × ${clipDuration}s`);

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
    }),
  });

  if (!pipelineResponse.ok) {
    const error = await pipelineResponse.text();
    throw new Error(`Pipeline failed: ${error}`);
  }

  const result = await pipelineResponse.json();

  return new Response(
    JSON.stringify({
      success: true,
      projectId,
      mode,
      status: 'processing',
      message: `Creating ${clipCount}-clip ${mode.replace(/-/g, ' ')} video with ${enableNarration ? 'narration' : 'no narration'}${enableMusic ? ' and music' : ''}.`,
      ...result,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
