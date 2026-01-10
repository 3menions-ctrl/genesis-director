import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Duration modes
type DurationMode = 'micro' | 'short' | 'medium' | 'long' | 'extended';
type SmartTransitionType = 'angle-change' | 'motion-carry' | 'match-cut' | 'scene-jump' | 'whip-pan' | 'reveal' | 'follow-through' | 'parallel-action';
type SceneType = 'establishing' | 'action' | 'reaction' | 'detail' | 'transition' | 'climax' | 'resolution' | 'buffer';

interface SmartScriptRequest {
  topic: string;
  synopsis?: string;
  style?: string;
  genre?: string;
  targetDurationSeconds: number;
  durationMode?: DurationMode;
  preferredTransitions?: SmartTransitionType[];
  sceneVariety?: 'low' | 'medium' | 'high';
  pacingStyle?: 'fast' | 'moderate' | 'slow' | 'dynamic';
  mainSubjects?: string[];
  environmentHints?: string[];
  // NEW: Story-first flow - approved continuous narrative
  approvedStory?: string;
}

// Get duration mode from seconds
function getDurationMode(seconds: number): DurationMode {
  if (seconds <= 10) return 'micro';
  if (seconds <= 45) return 'short';
  if (seconds <= 90) return 'medium';
  if (seconds <= 180) return 'long';
  return 'extended';
}

// Calculate optimal shot count based on duration and pacing
function calculateShotConfig(targetSeconds: number, pacing: string): { shotCount: number; avgDuration: number } {
  const avgDuration = pacing === 'fast' ? 4 : pacing === 'slow' ? 6 : 5;
  const shotCount = Math.max(1, Math.min(60, Math.round(targetSeconds / avgDuration)));
  return { shotCount, avgDuration };
}

// Get scene type distribution for the duration mode - now includes buffer shots for stitching
function getSceneDistribution(mode: DurationMode, shotCount: number): SceneType[] {
  // Updated patterns with 'buffer' shots for smooth AI video stitching
  const patterns: Record<DurationMode, SceneType[]> = {
    micro: ['action'],
    short: ['establishing', 'action', 'buffer', 'detail', 'climax'],
    medium: ['establishing', 'action', 'reaction', 'buffer', 'detail', 'action', 'buffer', 'climax', 'resolution'],
    long: ['establishing', 'action', 'reaction', 'buffer', 'detail', 'transition', 'action', 'buffer', 'detail', 'climax', 'buffer', 'resolution'],
    extended: ['establishing', 'action', 'reaction', 'buffer', 'detail', 'action', 'buffer', 'transition', 'establishing', 'action', 'buffer', 'detail', 'reaction', 'climax', 'buffer', 'resolution'],
  };
  
  const pattern = patterns[mode];
  const distribution: SceneType[] = [];
  
  for (let i = 0; i < shotCount; i++) {
    distribution.push(pattern[i % pattern.length]);
  }
  
  return distribution;
}

// Get transition recommendations
function getTransitionPlan(shotCount: number, pacing: string): SmartTransitionType[] {
  const transitions: SmartTransitionType[] = [];
  const transitionOptions: SmartTransitionType[] = [
    'angle-change', 'motion-carry', 'match-cut', 'scene-jump', 
    'whip-pan', 'reveal', 'follow-through', 'parallel-action'
  ];
  
  for (let i = 0; i < shotCount - 1; i++) {
    // Vary transitions based on position in sequence
    if (i === 0) {
      transitions.push('motion-carry'); // Start with flow
    } else if (i === shotCount - 2) {
      transitions.push('reveal'); // Build to climax
    } else if (pacing === 'fast') {
      transitions.push(i % 2 === 0 ? 'whip-pan' : 'motion-carry');
    } else if (pacing === 'slow') {
      transitions.push(i % 3 === 0 ? 'match-cut' : 'angle-change');
    } else {
      transitions.push(transitionOptions[i % transitionOptions.length]);
    }
  }
  
  return transitions;
}

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

    // Validate and constrain duration (6 sec to 4 min = 240 sec)
    const targetSeconds = Math.max(6, Math.min(240, request.targetDurationSeconds || 30));
    const durationMode = request.durationMode || getDurationMode(targetSeconds);
    const pacing = request.pacingStyle || 'moderate';
    
    // Calculate shot configuration
    const { shotCount, avgDuration } = calculateShotConfig(targetSeconds, pacing);
    const sceneDistribution = getSceneDistribution(durationMode, shotCount);
    const transitionPlan = getTransitionPlan(shotCount, pacing);
    
    console.log(`[SmartScript] Duration: ${targetSeconds}s, Mode: ${durationMode}, Shots: ${shotCount}, Pacing: ${pacing}`);

    // Build the AI prompt with smart scripting instructions
    const systemPrompt = `You are a CINEMATIC SCRIPT GENERATOR that creates smooth, professional video scripts optimized for AI video generation and stitching.

OUTPUT FORMAT (STRICT JSON):
{
  "shots": [
    {
      "index": 0,
      "title": "Shot title",
      "description": "Rich visual description with motion, lighting, and physics",
      "durationSeconds": 4-6,
      "sceneType": "establishing|action|reaction|detail|transition|climax|resolution|buffer",
      "cameraScale": "extreme-wide|wide|medium|close-up|extreme-close-up",
      "cameraAngle": "eye-level|low-angle|high-angle|dutch-angle|overhead|pov",
      "movementType": "static|pan|tilt|dolly|tracking|crane|handheld",
      "transitionOut": "angle-change|motion-carry|match-cut|scene-jump|whip-pan|reveal|follow-through",
      "transitionHint": "How this shot flows into the next",
      "visualAnchors": ["key visual element 1", "element 2"],
      "motionDirection": "left-to-right|right-to-left|toward-camera|away|up|down|circular",
      "lightingHint": "lighting description for consistency",
      "dialogue": "Optional narration or dialogue",
      "mood": "emotional tone",
      "isBufferShot": false
    }
  ]
}

**CRITICAL: TRANSITION BUFFER SHOTS (for smooth AI video stitching)**

When transitioning between significantly different scenes or actions, include a BUFFER SHOT. Buffer shots serve as:
1. CAMERA RESET: A neutral moment for the AI to reposition the "virtual camera"
2. VISUAL BREATHING ROOM: Prevents jarring jumps from action to action
3. SCENE ESTABLISHMENT: Allows new environment/lighting to be established

WHEN TO INSERT BUFFER SHOTS:
- Before major location changes (interior → exterior)
- After intense action sequences (fight → calm)
- When changing primary subjects (character A → character B)
- Before/after dialogue scenes (to establish speaker in environment)
- At emotional tone shifts (tense → peaceful)

BUFFER SHOT TYPES:
1. ENVIRONMENTAL PAUSE: Wide establishing shot showing scene context (e.g., "Wide shot of the forest canopy, golden light filtering through leaves, birds gliding past")
2. REACTION BEAT: Close-up of subject absorbing moment (e.g., "Close-up of protagonist's face, eyes scanning the horizon, wind gently moving hair")
3. OBJECT DETAIL: Focus on significant prop or element (e.g., "Macro shot of raindrops on a leaf, camera slowly pulling back")
4. TRANSITIONAL MOVEMENT: Camera movement that bridges locations (e.g., "Drone shot rising above rooftops, revealing the city skyline beyond")

TRANSITION RULES (CRITICAL FOR SMOOTH STITCHING):
1. ANGLE-CHANGE: Same subject, different camera angle. End shot holds on subject, next shot shows from new angle.
2. MOTION-CARRY: Movement CONTINUES across cut. If subject moves left, next shot shows continuation.
3. MATCH-CUT: Visual similarity bridges scenes. End on a shape/color, start next with similar shape/color.
4. SCENE-JUMP: Use with BUFFER SHOT. End with resolution, buffer establishes new context, then action.
5. WHIP-PAN: Fast camera sweep creates blur transition. Both clips should have horizontal motion blur.
6. REVEAL: Camera movement reveals new element. End moving toward obstruction, start revealing what's behind.
7. FOLLOW-THROUGH: Action leads viewer forward. Subject exits frame, enters next frame.

PACING RULES:
- FAST pacing: 4-second shots, buffer shots every 3-4 action shots
- MODERATE pacing: 5-second shots, buffer shots between major scene changes
- SLOW pacing: 6-second shots, more buffer/establishing shots for contemplative mood

VISUAL CONTINUITY (ESSENTIAL FOR AI STITCHING):
- Maintain lighting direction across cuts
- End shots with NEUTRAL POSITIONS when possible (subject centered, minimal motion blur)
- Start shots with CLEAR VISUAL ANCHORS the AI can latch onto
- For difficult transitions, use a buffer shot to reset the visual context
- Describe END STATE of each shot and START STATE of next for smooth handoff

PHYSICS & REALISM:
- Describe natural motion (gravity, momentum, inertia)
- Include environmental physics (wind, water, fabric movement)
- Character body mechanics must be anatomically correct
- For buffer shots: favor static or slow, predictable motion`;

    // Build user prompt - different approach if we have an approved story
    let userPrompt: string;
    
    if (request.approvedStory) {
      // STORY-FIRST FLOW: Break down the approved continuous narrative into shots
      console.log("[SmartScript] Using approved story for shot breakdown");
      userPrompt = `Break down this APPROVED STORY into exactly ${shotCount} cinematic shots for a ${targetSeconds}-second ${request.genre || 'cinematic'} video.

THE APPROVED STORY (maintain this narrative exactly, just break it into visual shots):
"""
${request.approvedStory}
"""

CRITICAL STORY CONTINUITY REQUIREMENTS:
1. PRESERVE the story's narrative continuity - each shot flows naturally from the previous
2. Break the story into ${shotCount} distinct visual moments in EXACT SEQUENCE
3. Each shot must represent a specific part of the story in the order it appears
4. CHARACTER CONSISTENCY: The same character must look identical in all shots
   - Copy the character description EXACTLY into each shot's visualAnchors
   - Include clothing, hair, distinctive features in every shot
5. SETTING CONSISTENCY: Same location = same lighting, same environment details
6. EMOTIONAL PROGRESSION: Capture the building/changing emotions through the story
7. Do NOT add new plot elements - only visualize what's in the story
8. Do NOT skip any part of the story - every story beat needs a shot
9. Include dialogue/narration from the story in the appropriate shots

STORY BEAT TRACKING:
- Shot 1-2: Opening/Setup (establish character and world)
- Shot 3-4: Catalyst/Rising Action (conflict begins)
- Shot ${Math.floor(shotCount * 0.6)}-${Math.floor(shotCount * 0.8)}: Climax (peak tension)
- Final shots: Resolution (conclusion)

SCENE DISTRIBUTION TO FOLLOW:
${sceneDistribution.map((type, i) => `Shot ${i + 1}: ${type}`).join('\n')}

TRANSITION PLAN (use these to connect story moments smoothly):
${transitionPlan.map((t, i) => `Shot ${i + 1} → ${i + 2}: ${t}`).join('\n')}

Break down the story into visual shots with SMOOTH TRANSITIONS and NARRATIVE CONTINUITY. Output ONLY valid JSON.`;
    } else {
      // LEGACY FLOW: Generate from topic/synopsis
      userPrompt = `Generate a ${shotCount}-shot script for a ${targetSeconds}-second ${request.genre || 'cinematic'} video.

TOPIC: ${request.topic}
${request.synopsis ? `SYNOPSIS: ${request.synopsis}` : ''}
${request.style ? `STYLE: ${request.style}` : ''}
${request.mainSubjects?.length ? `MAIN SUBJECTS: ${request.mainSubjects.join(', ')}` : ''}
${request.environmentHints?.length ? `ENVIRONMENTS: ${request.environmentHints.join(', ')}` : ''}

REQUIREMENTS:
- Exactly ${shotCount} shots
- Total duration: ~${targetSeconds} seconds
- Pacing: ${pacing.toUpperCase()}
- Scene variety: ${request.sceneVariety?.toUpperCase() || 'HIGH'}

SCENE DISTRIBUTION TO FOLLOW:
${sceneDistribution.map((type, i) => `Shot ${i + 1}: ${type}`).join('\n')}

TRANSITION PLAN:
${transitionPlan.map((t, i) => `Shot ${i + 1} → ${i + 2}: ${t}`).join('\n')}

Generate the shots with SMOOTH TRANSITIONS and VISUAL CONTINUITY. Output ONLY valid JSON.`;
    }

    console.log("[SmartScript] Calling OpenAI API...");

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
        max_tokens: Math.min(4000, shotCount * 300),
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
    let parsedShots;
    try {
      // Extract JSON from potential markdown code blocks
      let jsonStr = rawContent;
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      parsedShots = parsed.shots || parsed;
    } catch (parseError) {
      console.error("[SmartScript] JSON parse error:", parseError);
      console.error("[SmartScript] Raw content:", rawContent.substring(0, 500));
      
      // Fallback: try to extract shot information manually
      throw new Error("Failed to parse AI response as JSON. Please try again.");
    }

    // Validate and normalize shots
    const normalizedShots = parsedShots.map((shot: any, index: number) => ({
      id: `shot_${String(index + 1).padStart(3, '0')}`,
      index,
      title: shot.title || `Shot ${index + 1}`,
      description: shot.description || '',
      durationSeconds: Math.max(4, Math.min(6, shot.durationSeconds || avgDuration)),
      sceneType: shot.sceneType || sceneDistribution[index] || 'action',
      cameraScale: shot.cameraScale || 'medium',
      cameraAngle: shot.cameraAngle || 'eye-level',
      movementType: shot.movementType || 'static',
      transitionOut: index < parsedShots.length - 1 ? {
        type: shot.transitionOut || transitionPlan[index] || 'motion-carry',
        hint: shot.transitionHint || '',
      } : null,
      visualAnchors: shot.visualAnchors || [],
      motionDirection: shot.motionDirection || null,
      lightingHint: shot.lightingHint || 'natural lighting',
      dialogue: shot.dialogue || '',
      mood: shot.mood || 'neutral',
    }));

    // Calculate actual total duration
    const totalDuration = normalizedShots.reduce((sum: number, shot: any) => sum + shot.durationSeconds, 0);

    // Calculate diversity scores
    const uniqueSceneTypes = new Set(normalizedShots.map((s: any) => s.sceneType)).size;
    const uniqueScales = new Set(normalizedShots.map((s: any) => s.cameraScale)).size;
    const uniqueAngles = new Set(normalizedShots.map((s: any) => s.cameraAngle)).size;
    const uniqueTransitions = new Set(normalizedShots.filter((s: any) => s.transitionOut).map((s: any) => s.transitionOut.type)).size;

    const generationTimeMs = Date.now() - startTime;

    console.log(`[SmartScript] Generated ${normalizedShots.length} shots in ${generationTimeMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        shots: normalizedShots,
        totalDurationSeconds: totalDuration,
        shotCount: normalizedShots.length,
        durationMode,
        transitionPlan: {
          types: [...new Set(normalizedShots.filter((s: any) => s.transitionOut).map((s: any) => s.transitionOut.type))],
          diversity: uniqueTransitions / 8, // 8 possible transition types
        },
        sceneDiversity: {
          uniqueSceneTypes,
          cameraVariety: (uniqueScales + uniqueAngles) / 10, // Normalized score
          pacingScore: pacing === 'dynamic' ? 0.9 : pacing === 'fast' ? 0.7 : pacing === 'moderate' ? 0.5 : 0.3,
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
