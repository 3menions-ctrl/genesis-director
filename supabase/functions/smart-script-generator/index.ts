import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmartScriptRequest {
  topic: string;
  synopsis?: string;
  style?: string;
  genre?: string;
  targetDurationSeconds: number;
  pacingStyle?: 'fast' | 'moderate' | 'slow';
  mainSubjects?: string[];
  environmentHints?: string[];
  // Scene-based flow - approved continuous scene
  approvedScene?: string;
  // Character/environment lock for consistency
  characterLock?: {
    description: string;
    clothing: string;
    distinctiveFeatures: string[];
  };
  environmentLock?: {
    location: string;
    lighting: string;
    keyObjects: string[];
  };
  // USER-PROVIDED CONTENT - must be preserved exactly
  userNarration?: string;      // User's exact narration text
  userDialogue?: string[];     // User's exact dialogue lines
  userScript?: string;         // User's complete script (use as-is)
  preserveUserContent?: boolean; // Flag to ensure user content is kept verbatim
}

interface SceneClip {
  id: string;
  index: number;
  title: string;
  description: string;
  durationSeconds: number;
  // Continuity fields
  actionPhase: 'establish' | 'initiate' | 'develop' | 'escalate' | 'peak' | 'settle';
  previousAction: string;
  currentAction: string;
  nextAction: string;
  // Visual consistency
  characterDescription: string;
  locationDescription: string;
  lightingDescription: string;
  // Camera
  cameraScale: string;
  cameraAngle: string;
  movementType: string;
  motionDirection: string;
  // Transitions
  transitionOut: {
    type: string;
    hint: string;
  } | null;
  // Dialogue/narration
  dialogue: string;
  mood: string;
}

const ACTION_PHASES = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const request: SmartScriptRequest = await req.json();
    
    console.log("[SmartScript] Request:", JSON.stringify(request, null, 2));

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Fixed: 6 clips per scene, ~6 seconds each
    const CLIPS_PER_SCENE = 6;
    const CLIP_DURATION = 6;
    const targetSeconds = Math.max(30, Math.min(45, request.targetDurationSeconds || 36));
    
    // Check if user provided specific narration/dialogue that must be preserved
    const hasUserNarration = request.userNarration && request.userNarration.trim().length > 10;
    const hasUserDialogue = request.userDialogue && request.userDialogue.length > 0;
    const mustPreserveContent = request.preserveUserContent || hasUserNarration || hasUserDialogue;
    
    console.log(`[SmartScript] Generating ${CLIPS_PER_SCENE} clips for continuous scene, preserveContent: ${mustPreserveContent}`);

    // Build the system prompt for CONTINUOUS SCENE breakdown
    const systemPrompt = `You are a SCENE BREAKDOWN SPECIALIST for AI video generation. Your job is to break ONE CONTINUOUS SCENE into exactly 6 clips that flow seamlessly together.

${mustPreserveContent ? `
CRITICAL - USER CONTENT PRESERVATION:
The user has provided specific narration/dialogue that MUST be used EXACTLY as written.
DO NOT paraphrase, summarize, or rewrite the user's text.
Your job is to create VISUAL descriptions that accompany the user's exact words.
Distribute the user's narration/dialogue across the 6 clips appropriately.
Include the user's exact text in the "dialogue" field of each clip.
` : ''}

CRITICAL: CONTINUOUS SCENE BREAKDOWN
Each scene = 6 clips showing PROGRESSIVE ACTION in the SAME location.
The clips are NOT separate shots - they are SEQUENTIAL MOMENTS of ONE continuous action.

OUTPUT FORMAT (STRICT JSON):
{
  "clips": [
    {
      "index": 0,
      "title": "Clip title",
      "description": "Detailed visual description for AI video generation",
      "durationSeconds": 6,
      "actionPhase": "establish|initiate|develop|escalate|peak|settle",
      "previousAction": "What happened in previous clip (empty for clip 0)",
      "currentAction": "What happens in this exact 6-second moment",
      "nextAction": "What will happen in next clip (empty for clip 5)",
      "characterDescription": "EXACT character description - SAME in all clips",
      "locationDescription": "EXACT location description - SAME in all clips",
      "lightingDescription": "EXACT lighting description - SAME in all clips",
      "cameraScale": "wide|medium|close-up",
      "cameraAngle": "eye-level|low-angle|high-angle",
      "movementType": "static|pan|tracking|dolly",
      "motionDirection": "The direction of action/movement",
      "transitionHint": "How this moment connects to the next",
      "dialogue": "Any narration or speech - USE USER'S EXACT WORDS if provided",
      "mood": "Emotional tone of this moment"
    }
  ]
}

ACTION PHASE REQUIREMENTS:
- ESTABLISH (Clip 0): Wide shot. Character in environment. Initial state before action.
- INITIATE (Clip 1): Action begins. First movement or change from initial state.
- DEVELOP (Clip 2): Action continues. Building on the initiated action.
- ESCALATE (Clip 3): Intensity increases. Action gains momentum.
- PEAK (Clip 4): Highest point. Most dramatic moment of the scene.
- SETTLE (Clip 5): Resolution. Action concludes. Sets up next scene.

CONTINUITY REQUIREMENTS (CRITICAL):
1. CHARACTER LOCK: Copy the EXACT same character description to ALL 6 clips
   - Same clothes, hair, face, body in every clip
   - No outfit changes, no appearance drift
   
2. LOCATION LOCK: Copy the EXACT same location description to ALL 6 clips
   - Same room, street, forest - never changes
   - Same background elements visible
   
3. LIGHTING LOCK: Copy the EXACT same lighting to ALL 6 clips
   - Same sun position, same shadows
   - Same color temperature
   
4. ACTION CONTINUITY: Each clip picks up WHERE the previous ended
   - Clip 1's "previousAction" = Clip 0's "currentAction"
   - Clip 2's "previousAction" = Clip 1's "currentAction"
   - Physical positions must connect (if hand is raised at end of clip 2, it's still raised at start of clip 3)

5. CAMERA LOGIC: Camera can move, but no impossible jumps
   - Can go from wide to close-up over 2-3 clips
   - No jumping from behind character to in front between clips

${mustPreserveContent ? `
6. DIALOGUE/NARRATION PRESERVATION:
   - Use the user's EXACT words in the "dialogue" field
   - DO NOT paraphrase or rewrite their text
   - Distribute their narration/dialogue across appropriate clips
` : ''}

TRANSITION HINTS:
Describe how each clip's END connects to the next clip's START:
- "Character's hand reaches toward door handle" → "Hand grips the handle"
- "Face turns toward the sound" → "Eyes widen seeing what made the sound"
- "Steps forward into the light" → "Fully illuminated, takes in the view"`;

    // Build user prompt
    let userPrompt: string;
    
    if (request.approvedScene) {
      // Scene has been written - break it into clips
      userPrompt = `Break this APPROVED SCENE into exactly 6 continuous clips:

SCENE:
"""
${request.approvedScene}
"""

${request.characterLock ? `
CHARACTER (use EXACTLY in all 6 clips):
${request.characterLock.description}
Wearing: ${request.characterLock.clothing}
Distinctive: ${request.characterLock.distinctiveFeatures.join(', ')}
` : ''}

${request.environmentLock ? `
LOCATION (use EXACTLY in all 6 clips):
${request.environmentLock.location}
Lighting: ${request.environmentLock.lighting}
Key objects: ${request.environmentLock.keyObjects.join(', ')}
` : ''}

${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT MODIFY):
"""
${request.userNarration}
"""
Distribute this across the clips in the "dialogue" field. Use EXACT words.
` : ''}
${hasUserDialogue && request.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT MODIFY):
${request.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
Include in appropriate clips' "dialogue" field. Use EXACT words.
` : ''}

REQUIREMENTS:
- Extract the 6 sequential moments from this scene
- Each clip = 6 seconds of the continuous action
- Maintain EXACT character/location/lighting consistency
- Connect each clip's end to the next clip's start
${mustPreserveContent ? '- PRESERVE USER\'S EXACT NARRATION/DIALOGUE in the "dialogue" field' : '- Keep dialogue/narration in the appropriate clips'}

Output ONLY valid JSON with exactly 6 clips.`;
    } else {
      // Generate from topic - create a continuous scene
      userPrompt = `Create a continuous scene broken into 6 clips for:

TOPIC: ${request.topic}
${request.synopsis ? `SYNOPSIS: ${request.synopsis}` : ''}
${request.style ? `STYLE: ${request.style}` : ''}
${request.genre ? `GENRE: ${request.genre}` : ''}
${request.mainSubjects?.length ? `MAIN SUBJECTS: ${request.mainSubjects.join(', ')}` : ''}
${request.environmentHints?.length ? `ENVIRONMENT: ${request.environmentHints.join(', ')}` : ''}

${request.characterLock ? `
CHARACTER (use EXACTLY in all 6 clips):
${request.characterLock.description}
Wearing: ${request.characterLock.clothing}
Distinctive: ${request.characterLock.distinctiveFeatures.join(', ')}
` : ''}

${request.environmentLock ? `
LOCATION (use EXACTLY in all 6 clips):
${request.environmentLock.location}
Lighting: ${request.environmentLock.lighting}
Key objects: ${request.environmentLock.keyObjects.join(', ')}
` : ''}

${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT MODIFY OR PARAPHRASE):
"""
${request.userNarration}
"""
Distribute this narration across the clips in the "dialogue" field. Use the EXACT words provided.
` : ''}
${hasUserDialogue && request.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT MODIFY OR PARAPHRASE):
${request.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
Include these dialogue lines in appropriate clips' "dialogue" field. Use EXACT words.
` : ''}

Create ONE continuous scene with 6 progressive clips. Each clip = 6 seconds.
All clips in SAME location with SAME character appearance.
Show progressive action: establish → initiate → develop → escalate → peak → settle.
${mustPreserveContent ? 'CRITICAL: Use the user\'s EXACT narration/dialogue text - do not paraphrase.' : ''}

Output ONLY valid JSON with exactly 6 clips.`;
    }

    console.log("[SmartScript] Calling OpenAI API for scene breakdown...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 3000,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[SmartScript] OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid OpenAI API key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    
    console.log("[SmartScript] Raw AI response length:", rawContent.length);

    // Parse the JSON response
    let parsedClips;
    try {
      let jsonStr = rawContent;
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      parsedClips = parsed.clips || parsed;
    } catch (parseError) {
      console.error("[SmartScript] JSON parse error:", parseError);
      console.error("[SmartScript] Raw content:", rawContent.substring(0, 500));
      throw new Error("Failed to parse AI response as JSON. Please try again.");
    }

    // Validate we have exactly 6 clips
    if (!Array.isArray(parsedClips) || parsedClips.length !== 6) {
      console.warn(`[SmartScript] Expected 6 clips, got ${parsedClips?.length}. Padding/trimming...`);
      while (parsedClips.length < 6) {
        parsedClips.push({
          title: `Clip ${parsedClips.length + 1}`,
          description: 'Scene continuation',
          actionPhase: ACTION_PHASES[parsedClips.length],
        });
      }
      parsedClips = parsedClips.slice(0, 6);
    }

    // Extract the character/location/lighting from first clip to enforce consistency
    const lockFields = {
      characterDescription: parsedClips[0].characterDescription || request.characterLock?.description || '',
      locationDescription: parsedClips[0].locationDescription || request.environmentLock?.location || '',
      lightingDescription: parsedClips[0].lightingDescription || request.environmentLock?.lighting || '',
    };

    // Normalize and ENFORCE CONSISTENCY across all clips
    const normalizedClips: SceneClip[] = parsedClips.map((clip: any, index: number) => ({
      id: `clip_${String(index + 1).padStart(2, '0')}`,
      index,
      title: clip.title || `Clip ${index + 1}`,
      description: clip.description || '',
      durationSeconds: CLIP_DURATION,
      actionPhase: ACTION_PHASES[index],
      previousAction: index > 0 ? (parsedClips[index - 1]?.currentAction || '') : '',
      currentAction: clip.currentAction || clip.description?.substring(0, 100) || '',
      nextAction: index < 5 ? (parsedClips[index + 1]?.currentAction || '') : '',
      // ENFORCE CONSISTENCY - same values for all clips
      characterDescription: lockFields.characterDescription,
      locationDescription: lockFields.locationDescription,
      lightingDescription: lockFields.lightingDescription,
      // Camera
      cameraScale: clip.cameraScale || 'medium',
      cameraAngle: clip.cameraAngle || 'eye-level',
      movementType: clip.movementType || 'static',
      motionDirection: clip.motionDirection || '',
      // Transition
      transitionOut: index < 5 ? {
        type: 'continuous',
        hint: clip.transitionHint || `Continues into ${ACTION_PHASES[index + 1]} phase`,
      } : null,
      // Content
      dialogue: clip.dialogue || '',
      mood: clip.mood || 'focused',
    }));

    // Calculate continuity score
    const continuityScore = calculateContinuityScore(normalizedClips);

    const totalDuration = normalizedClips.reduce((sum, clip) => sum + clip.durationSeconds, 0);
    const generationTimeMs = Date.now() - startTime;

    console.log(`[SmartScript] Generated ${normalizedClips.length} clips in ${generationTimeMs}ms. Continuity score: ${continuityScore}`);

    return new Response(
      JSON.stringify({
        success: true,
        shots: normalizedClips, // Keep 'shots' for backwards compatibility
        clips: normalizedClips,
        totalDurationSeconds: totalDuration,
        clipCount: normalizedClips.length,
        sceneMode: 'continuous',
        continuityScore,
        consistency: {
          character: lockFields.characterDescription,
          location: lockFields.locationDescription,
          lighting: lockFields.lightingDescription,
        },
        model: "gpt-4o-mini",
        generationTimeMs,
        usage: data.usage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SmartScript] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateContinuityScore(clips: SceneClip[]): number {
  let score = 100;
  
  // Check character consistency
  const characters = new Set(clips.map(c => c.characterDescription));
  if (characters.size > 1) score -= 20;
  
  // Check location consistency
  const locations = new Set(clips.map(c => c.locationDescription));
  if (locations.size > 1) score -= 20;
  
  // Check lighting consistency
  const lightings = new Set(clips.map(c => c.lightingDescription));
  if (lightings.size > 1) score -= 15;
  
  // Check action flow
  for (let i = 1; i < clips.length; i++) {
    if (!clips[i].previousAction) score -= 5;
    // Check if previous action matches current of previous clip
    if (clips[i].previousAction !== clips[i-1].currentAction) score -= 3;
  }
  
  // Check all phases present
  const phases = clips.map(c => c.actionPhase);
  const expectedPhases = ['establish', 'initiate', 'develop', 'escalate', 'peak', 'settle'];
  const missingPhases = expectedPhases.filter(p => !phases.includes(p as any));
  score -= missingPhases.length * 3;
  
  return Math.max(0, Math.min(100, score));
}
