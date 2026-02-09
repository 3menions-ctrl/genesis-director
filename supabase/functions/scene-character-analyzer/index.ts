import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SCENE CHARACTER ANALYZER - World-Class Multi-Character Intelligence
 * 
 * This sophisticated AI system analyzes user scene requests and determines:
 * 1. How many characters are needed for the scene
 * 2. What type of characters would best fit the narrative
 * 3. Which existing avatars match the requirements
 * 4. Whether new avatars need to be generated
 * 
 * Outputs a complete casting manifest for the Hollywood pipeline.
 */

interface CharacterRequirement {
  role: 'protagonist' | 'supporting' | 'antagonist' | 'background' | 'narrator';
  importance: 'primary' | 'secondary' | 'tertiary';
  description: string;
  suggestedGender?: 'male' | 'female' | 'neutral';
  suggestedAgeRange?: string;
  suggestedStyle?: string;
  requiredTraits: string[];
  interactionWith?: string[]; // Other character roles this character interacts with
  screenTimePercent: number; // Estimated screen time percentage
  dialogueRole: 'speaking' | 'silent' | 'reacting';
}

interface SceneAnalysis {
  needsMultipleCharacters: boolean;
  totalCharactersNeeded: number;
  sceneType: 'monologue' | 'dialogue' | 'group' | 'crowd' | 'interview' | 'presentation' | 'narrative';
  narrativeStyle: 'conversational' | 'dramatic' | 'educational' | 'promotional' | 'storytelling';
  characters: CharacterRequirement[];
  sceneContext: {
    setting: string;
    mood: string;
    primaryAction: string;
    suggestedCameraStyle: string;
  };
  castingRecommendations: string;
}

interface AvatarMatch {
  avatarId: string;
  avatarName: string;
  matchScore: number;
  matchReasons: string[];
  faceImageUrl: string;
  voiceId: string;
  characterBible: any;
}

interface CastingManifest {
  analysis: SceneAnalysis;
  casting: Array<{
    role: string;
    requirement: CharacterRequirement;
    matchedAvatar?: AvatarMatch;
    needsGeneration: boolean;
    generationSpec?: {
      name: string;
      gender: string;
      ageRange: string;
      style: string;
      personality: string;
      appearance: string;
    };
  }>;
  totalAvatarsNeeded: number;
  existingAvatarsUsed: number;
  avatarsToGenerate: number;
  estimatedGenerationTime: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { 
      sceneDescription, 
      userPrompt,
      primaryAvatarId,
      excludeAvatarIds = [],
      maxCharacters = 5,
      forceMultiCharacter = false,
    } = await req.json();

    if (!sceneDescription && !userPrompt) {
      throw new Error("Either 'sceneDescription' or 'userPrompt' is required");
    }

    const combinedInput = [sceneDescription, userPrompt].filter(Boolean).join("\n\n");
    
    console.log("[SceneAnalyzer] ═══════════════════════════════════════════════════════");
    console.log("[SceneAnalyzer] Analyzing scene for character requirements...");
    console.log(`[SceneAnalyzer] Input: "${combinedInput.substring(0, 200)}..."`);
    console.log("[SceneAnalyzer] ═══════════════════════════════════════════════════════");

    // Step 1: AI-powered scene analysis
    const sceneAnalysis = await analyzeSceneForCharacters(
      combinedInput, 
      maxCharacters,
      forceMultiCharacter,
      LOVABLE_API_KEY
    );
    
    console.log(`[SceneAnalyzer] Scene type: ${sceneAnalysis.sceneType}`);
    console.log(`[SceneAnalyzer] Characters needed: ${sceneAnalysis.totalCharactersNeeded}`);
    console.log(`[SceneAnalyzer] Character roles: ${sceneAnalysis.characters.map(c => c.role).join(', ')}`);

    // Step 2: Search avatar library for matches
    const { data: availableAvatars, error: avatarError } = await supabase
      .from('avatar_templates')
      .select('*')
      .eq('is_active', true)
      .not('id', 'in', `(${excludeAvatarIds.join(',')})`)
      .order('use_count', { ascending: false });

    if (avatarError) {
      console.error("[SceneAnalyzer] Avatar fetch error:", avatarError);
      throw new Error("Failed to fetch avatar library");
    }

    console.log(`[SceneAnalyzer] Available avatars in library: ${availableAvatars?.length || 0}`);

    // Step 3: Match characters to avatars
    const castingManifest = await createCastingManifest(
      sceneAnalysis,
      availableAvatars || [],
      primaryAvatarId,
      LOVABLE_API_KEY
    );

    console.log("[SceneAnalyzer] ═══════════════════════════════════════════════════════");
    console.log(`[SceneAnalyzer] CASTING COMPLETE:`);
    console.log(`[SceneAnalyzer]   Total characters: ${castingManifest.totalAvatarsNeeded}`);
    console.log(`[SceneAnalyzer]   Using existing: ${castingManifest.existingAvatarsUsed}`);
    console.log(`[SceneAnalyzer]   Need generation: ${castingManifest.avatarsToGenerate}`);
    console.log("[SceneAnalyzer] ═══════════════════════════════════════════════════════");

    return new Response(
      JSON.stringify({
        success: true,
        manifest: castingManifest,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SceneAnalyzer] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Scene analysis failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Use AI to analyze the scene and determine character requirements
 */
async function analyzeSceneForCharacters(
  sceneInput: string,
  maxCharacters: number,
  forceMultiCharacter: boolean,
  apiKey: string
): Promise<SceneAnalysis> {
  
  const systemPrompt = `You are a WORLD-CLASS FILM CASTING DIRECTOR and SCENE ANALYST.
  
Your job is to analyze a scene description and determine:
1. How many characters are needed to bring this scene to life
2. What roles each character should play
3. What type of person would best fit each role
4. How characters should interact

ANALYSIS RULES:

WHEN TO USE MULTIPLE CHARACTERS:
- Dialogue scenes (conversations, interviews, debates)
- Group activities (meetings, parties, family gatherings)
- Narratives with multiple perspectives
- Scenes describing interactions ("he tells her", "they discuss")
- Any mention of multiple people or pronouns (he/she/they interacting)

WHEN SINGLE CHARACTER IS FINE:
- Solo presentations to camera
- Monologues or vlogs
- Tutorial/how-to content where one person teaches
- Introspective or journaling content

CHARACTER ROLES:
- protagonist: The main character driving the scene
- supporting: Characters who assist or interact with protagonist
- antagonist: Characters creating conflict or opposition
- background: Characters adding atmosphere (limited screen time)
- narrator: Voice-over presence (may not be visible)

IMPORTANCE LEVELS:
- primary: Must be on screen most of the time
- secondary: Significant screen time, important to story
- tertiary: Brief appearances, adds context

OUTPUT FORMAT (JSON):
{
  "needsMultipleCharacters": boolean,
  "totalCharactersNeeded": number (1-${maxCharacters}),
  "sceneType": "monologue|dialogue|group|crowd|interview|presentation|narrative",
  "narrativeStyle": "conversational|dramatic|educational|promotional|storytelling",
  "characters": [
    {
      "role": "protagonist|supporting|antagonist|background|narrator",
      "importance": "primary|secondary|tertiary",
      "description": "Brief description of who this character should be",
      "suggestedGender": "male|female|neutral",
      "suggestedAgeRange": "child|teen|young-adult|adult|middle-aged|senior",
      "suggestedStyle": "corporate|creative|casual|luxury|educational|influencer",
      "requiredTraits": ["confident", "friendly", etc.],
      "interactionWith": ["protagonist", "supporting"],
      "screenTimePercent": number (0-100, all should sum to 100),
      "dialogueRole": "speaking|silent|reacting"
    }
  ],
  "sceneContext": {
    "setting": "Where the scene takes place",
    "mood": "Emotional tone of the scene",
    "primaryAction": "Main activity happening",
    "suggestedCameraStyle": "static|dynamic|intimate|documentary"
  },
  "castingRecommendations": "Brief notes on casting this scene effectively"
}

IMPORTANT:
- Be specific about character traits that will help with avatar matching
- Consider visual diversity for multi-character scenes
- Ensure screen time percentages are realistic for the scene type
- Maximum ${maxCharacters} characters allowed`;

  const userMessage = `Analyze this scene and determine the character requirements:

"${sceneInput}"

${forceMultiCharacter ? 'NOTE: The user has requested multi-character mode. Ensure at least 2 characters if the scene can support it.' : ''}

Provide your analysis as JSON.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Scene analysis API failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse scene analysis response");
  }

  const analysis: SceneAnalysis = JSON.parse(jsonMatch[0]);
  
  // Enforce max characters
  if (analysis.totalCharactersNeeded > maxCharacters) {
    analysis.totalCharactersNeeded = maxCharacters;
    analysis.characters = analysis.characters.slice(0, maxCharacters);
  }
  
  // Ensure at least 1 character
  if (analysis.totalCharactersNeeded < 1) {
    analysis.totalCharactersNeeded = 1;
  }

  return analysis;
}

/**
 * Match character requirements to existing avatars and determine generation needs
 */
async function createCastingManifest(
  analysis: SceneAnalysis,
  availableAvatars: any[],
  primaryAvatarId: string | undefined,
  apiKey: string
): Promise<CastingManifest> {
  
  const casting: CastingManifest['casting'] = [];
  let existingAvatarsUsed = 0;
  let avatarsToGenerate = 0;
  const usedAvatarIds = new Set<string>();

  for (let i = 0; i < analysis.characters.length; i++) {
    const requirement = analysis.characters[i];
    
    // For the first/primary character, use the user's selected avatar if provided
    if (i === 0 && primaryAvatarId) {
      const primaryAvatar = availableAvatars.find(a => a.id === primaryAvatarId);
      if (primaryAvatar) {
        casting.push({
          role: requirement.role,
          requirement,
          matchedAvatar: {
            avatarId: primaryAvatar.id,
            avatarName: primaryAvatar.name,
            matchScore: 100,
            matchReasons: ['User-selected primary avatar'],
            faceImageUrl: primaryAvatar.face_image_url,
            voiceId: primaryAvatar.voice_id,
            characterBible: primaryAvatar.character_bible,
          },
          needsGeneration: false,
        });
        usedAvatarIds.add(primaryAvatar.id);
        existingAvatarsUsed++;
        continue;
      }
    }

    // Search for matching avatar
    const match = await findBestAvatarMatch(
      requirement,
      availableAvatars.filter(a => !usedAvatarIds.has(a.id)),
      apiKey
    );

    if (match && match.matchScore >= 60) {
      // Good match found
      casting.push({
        role: requirement.role,
        requirement,
        matchedAvatar: match,
        needsGeneration: false,
      });
      usedAvatarIds.add(match.avatarId);
      existingAvatarsUsed++;
    } else {
      // Need to generate a new avatar
      const generationSpec = createGenerationSpec(requirement, analysis.sceneContext);
      casting.push({
        role: requirement.role,
        requirement,
        matchedAvatar: match, // May have a low-score match as fallback
        needsGeneration: true,
        generationSpec,
      });
      avatarsToGenerate++;
    }
  }

  return {
    analysis,
    casting,
    totalAvatarsNeeded: analysis.totalCharactersNeeded,
    existingAvatarsUsed,
    avatarsToGenerate,
    estimatedGenerationTime: avatarsToGenerate * 15, // ~15 seconds per avatar generation
  };
}

/**
 * Use AI to find the best matching avatar for a character requirement
 */
async function findBestAvatarMatch(
  requirement: CharacterRequirement,
  availableAvatars: any[],
  apiKey: string
): Promise<AvatarMatch | null> {
  
  if (availableAvatars.length === 0) {
    return null;
  }

  // Build avatar summaries for AI matching
  const avatarSummaries = availableAvatars.slice(0, 50).map((a, i) => ({
    index: i,
    id: a.id,
    name: a.name,
    gender: a.gender,
    ageRange: a.age_range,
    style: a.style,
    personality: a.personality,
    ethnicity: a.ethnicity,
    tags: a.tags,
    avatarType: a.avatar_type,
  }));

  const matchPrompt = `Find the BEST matching avatar for this character role.

CHARACTER REQUIREMENT:
- Role: ${requirement.role}
- Description: ${requirement.description}
- Gender preference: ${requirement.suggestedGender || 'any'}
- Age range: ${requirement.suggestedAgeRange || 'any'}
- Style: ${requirement.suggestedStyle || 'any'}
- Required traits: ${requirement.requiredTraits.join(', ')}
- Dialogue role: ${requirement.dialogueRole}

AVAILABLE AVATARS:
${JSON.stringify(avatarSummaries, null, 2)}

Return JSON with:
{
  "bestMatchIndex": number (index of best match, or -1 if no good match),
  "matchScore": number (0-100, how well this avatar fits),
  "matchReasons": ["reason1", "reason2"],
  "fallbackIndex": number (index of acceptable fallback, or -1)
}

A good match (60+) should align on gender, approximate age, and general vibe.
A great match (80+) should also align on style and personality.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: matchPrompt }],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.warn("[SceneAnalyzer] Avatar matching API failed, using fallback");
      return simpleFallbackMatch(requirement, availableAvatars);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return simpleFallbackMatch(requirement, availableAvatars);
    }

    const matchResult = JSON.parse(jsonMatch[0]);
    const selectedIndex = matchResult.bestMatchIndex >= 0 
      ? matchResult.bestMatchIndex 
      : matchResult.fallbackIndex;

    if (selectedIndex < 0 || selectedIndex >= availableAvatars.length) {
      return null;
    }

    const selectedAvatar = availableAvatars[selectedIndex];
    
    return {
      avatarId: selectedAvatar.id,
      avatarName: selectedAvatar.name,
      matchScore: matchResult.matchScore,
      matchReasons: matchResult.matchReasons || [],
      faceImageUrl: selectedAvatar.face_image_url,
      voiceId: selectedAvatar.voice_id,
      characterBible: selectedAvatar.character_bible,
    };

  } catch (error) {
    console.warn("[SceneAnalyzer] Avatar matching error:", error);
    return simpleFallbackMatch(requirement, availableAvatars);
  }
}

/**
 * Simple rule-based fallback for avatar matching when AI fails
 */
function simpleFallbackMatch(
  requirement: CharacterRequirement,
  availableAvatars: any[]
): AvatarMatch | null {
  
  // Score each avatar based on requirements
  const scored = availableAvatars.map(avatar => {
    let score = 50; // Base score
    const reasons: string[] = [];

    // Gender match
    if (requirement.suggestedGender) {
      if (avatar.gender?.toLowerCase() === requirement.suggestedGender.toLowerCase()) {
        score += 20;
        reasons.push('Gender matches');
      } else if (requirement.suggestedGender !== 'neutral') {
        score -= 10;
      }
    }

    // Style match
    if (requirement.suggestedStyle && avatar.style) {
      if (avatar.style.toLowerCase().includes(requirement.suggestedStyle.toLowerCase())) {
        score += 15;
        reasons.push('Style matches');
      }
    }

    // Age range match
    if (requirement.suggestedAgeRange && avatar.age_range) {
      if (avatar.age_range.toLowerCase().includes(requirement.suggestedAgeRange.toLowerCase())) {
        score += 15;
        reasons.push('Age range matches');
      }
    }

    // Tag/trait overlap
    if (avatar.tags && requirement.requiredTraits.length > 0) {
      const tagOverlap = avatar.tags.filter((t: string) => 
        requirement.requiredTraits.some(trait => 
          t.toLowerCase().includes(trait.toLowerCase()) ||
          trait.toLowerCase().includes(t.toLowerCase())
        )
      );
      if (tagOverlap.length > 0) {
        score += tagOverlap.length * 5;
        reasons.push(`Matching traits: ${tagOverlap.join(', ')}`);
      }
    }

    return { avatar, score, reasons };
  });

  // Sort by score and get best
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (!best || best.score < 40) {
    return null;
  }

  return {
    avatarId: best.avatar.id,
    avatarName: best.avatar.name,
    matchScore: Math.min(100, best.score),
    matchReasons: best.reasons,
    faceImageUrl: best.avatar.face_image_url,
    voiceId: best.avatar.voice_id,
    characterBible: best.avatar.character_bible,
  };
}

/**
 * Create a generation specification for a new avatar
 */
function createGenerationSpec(
  requirement: CharacterRequirement,
  sceneContext: SceneAnalysis['sceneContext']
): CastingManifest['casting'][0]['generationSpec'] {
  
  // Generate a contextual name based on role
  const roleNames: Record<string, string[]> = {
    protagonist: ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey'],
    supporting: ['Riley', 'Quinn', 'Avery', 'Sage', 'Drew'],
    antagonist: ['Blake', 'Reese', 'Cameron', 'Hayden', 'Parker'],
    background: ['Jamie', 'Sam', 'Pat', 'Chris', 'Lee'],
    narrator: ['The Narrator', 'Voice', 'Guide', 'Host', 'Storyteller'],
  };

  const names = roleNames[requirement.role] || roleNames.supporting;
  const randomName = names[Math.floor(Math.random() * names.length)];

  return {
    name: randomName,
    gender: requirement.suggestedGender || 'neutral',
    ageRange: requirement.suggestedAgeRange || 'adult',
    style: requirement.suggestedStyle || 'casual',
    personality: requirement.requiredTraits.join(', ') || 'friendly and approachable',
    appearance: `${requirement.description}. Setting: ${sceneContext.setting}. Mood: ${sceneContext.mood}.`,
  };
}
