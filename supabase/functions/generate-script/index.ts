import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CharacterInput {
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'narrator';
  description: string;
  personality: string;
}

interface StoryRequest {
  // Legacy simple mode
  topic?: string;
  style?: string;
  duration?: string;
  
  // Full movie mode
  title?: string;
  genre?: string;
  storyStructure?: string;
  targetDurationMinutes?: number;
  setting?: string;
  timePeriod?: string;
  mood?: string;
  movieIntroStyle?: string;
  characters?: CharacterInput[];
  synopsis?: string;
  
  // Continuation mode
  previousScript?: string;
  continuationType?: 'sequel' | 'prequel' | 'episode';
  
  // USER-PROVIDED CONTENT - must be preserved exactly
  userNarration?: string;      // User's exact narration text
  userDialogue?: string[];     // User's exact dialogue lines
  userScript?: string;         // User's complete script (use as-is)
  preserveUserContent?: boolean; // Flag to ensure user content is kept verbatim
}

interface DetectedContent {
  hasDialogue: boolean;
  hasNarration: boolean;
  dialogueLines: string[];
  narrationText: string;
  estimatedDurationSeconds: number;
  recommendedClipCount: number;
}

/**
 * Detect dialogue and narration from user input
 * Patterns detected:
 * - Quoted text: "Hello world"
 * - Character dialogue: CHARACTER: "Line" or CHARACTER says "Line"
 * - Narration markers: [NARRATION], (voiceover), VO:
 * - Script format: INT./EXT. scenes
 */
function detectUserContent(text: string): DetectedContent {
  const dialogueLines: string[] = [];
  let narrationText = '';
  
  // Detect quoted dialogue
  const quotedRegex = /"([^"]+)"/g;
  let match;
  while ((match = quotedRegex.exec(text)) !== null) {
    dialogueLines.push(match[1]);
  }
  
  // Detect character dialogue patterns: NAME: "text" or NAME says "text"
  const characterDialogueRegex = /([A-Z][A-Z\s]+):\s*["']?([^"'\n]+)["']?/g;
  while ((match = characterDialogueRegex.exec(text)) !== null) {
    if (!dialogueLines.includes(match[2].trim())) {
      dialogueLines.push(match[2].trim());
    }
  }
  
  // Detect "says" pattern
  const saysRegex = /([A-Z][a-z]+)\s+says?\s*[,:]\s*["']([^"']+)["']/gi;
  while ((match = saysRegex.exec(text)) !== null) {
    if (!dialogueLines.includes(match[2].trim())) {
      dialogueLines.push(match[2].trim());
    }
  }
  
  // Detect narration patterns
  const narrationPatterns = [
    /\[NARRATION\]:?\s*([^\[\]]+)/gi,
    /\(voiceover\):?\s*([^\(\)]+)/gi,
    /\(V\.?O\.?\):?\s*([^\(\)]+)/gi,
    /VO:?\s*["']?([^"'\n]+)["']?/gi,
    /NARRATOR:?\s*["']?([^"'\n]+)["']?/gi,
  ];
  
  for (const pattern of narrationPatterns) {
    while ((match = pattern.exec(text)) !== null) {
      narrationText += (narrationText ? ' ' : '') + match[1].trim();
    }
  }
  
  // If no explicit narration found but text has prose-like structure, treat as narration
  if (!narrationText && dialogueLines.length === 0) {
    // Check if it looks like a script/narration (sentences, not just keywords)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length >= 2) {
      narrationText = text;
    }
  }
  
  // Calculate duration based on content
  const allText = [...dialogueLines, narrationText].join(' ');
  const wordCount = allText.split(/\s+/).filter(w => w.length > 0).length;
  
  // Average speaking rate: 150 words per minute = 2.5 words per second
  // Each clip is 6 seconds = 15 words per clip comfortable pace
  const WORDS_PER_SECOND = 2.5;
  const CLIP_DURATION = 6;
  const WORDS_PER_CLIP = WORDS_PER_SECOND * CLIP_DURATION; // 15 words per clip
  
  const estimatedDurationSeconds = Math.ceil(wordCount / WORDS_PER_SECOND);
  let recommendedClipCount = Math.max(6, Math.ceil(wordCount / WORDS_PER_CLIP));
  
  // Cap at reasonable maximum
  recommendedClipCount = Math.min(recommendedClipCount, 20);
  
  // Minimum 6 clips for proper story structure
  if (recommendedClipCount < 6) recommendedClipCount = 6;
  
  console.log(`[ContentDetection] Words: ${wordCount}, Duration: ${estimatedDurationSeconds}s, Clips: ${recommendedClipCount}`);
  console.log(`[ContentDetection] Dialogue lines: ${dialogueLines.length}, Has narration: ${!!narrationText}`);
  
  return {
    hasDialogue: dialogueLines.length > 0,
    hasNarration: narrationText.length > 0,
    dialogueLines,
    narrationText,
    estimatedDurationSeconds,
    recommendedClipCount,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: StoryRequest = await req.json();
    
    console.log("Generating script for:", JSON.stringify(requestData, null, 2));

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;
    
    // Check if user provided their own complete script - use it directly
    if (requestData.userScript && requestData.userScript.trim().length > 50) {
      console.log("[generate-script] Using user-provided script directly");
      
      // Return the user's script with minimal processing
      return new Response(
        JSON.stringify({ 
          success: true,
          script: requestData.userScript.trim(),
          title: requestData.title || 'User Script',
          genre: requestData.genre,
          characters: requestData.characters?.map(c => c.name),
          wordCount: requestData.userScript.split(/\s+/).length,
          estimatedDuration: Math.ceil(requestData.userScript.split(/\s+/).length / 150),
          source: 'user_provided',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if this is a full movie request with characters OR if fullMovieMode flag is set
    const hasCharacters = requestData.characters && requestData.characters.length > 0;
    const isFullMovieMode = requestData.title && (hasCharacters || requestData.synopsis);
    
    // AUTO-DETECT dialogue and narration from user's synopsis/topic
    const inputText = [
      requestData.synopsis || '',
      requestData.topic || '',
      requestData.userNarration || '',
      ...(requestData.userDialogue || []),
    ].join(' ');
    
    const detectedContent = detectUserContent(inputText);
    
    // Use detected content if no explicit user content provided
    let hasUserNarration = requestData.userNarration && requestData.userNarration.trim().length > 10;
    let hasUserDialogue = requestData.userDialogue && requestData.userDialogue.length > 0;
    
    // If we detected content in the synopsis, use it
    if (!hasUserNarration && detectedContent.hasNarration) {
      hasUserNarration = true;
      requestData.userNarration = detectedContent.narrationText;
      console.log("[generate-script] Auto-detected narration from input");
    }
    
    if (!hasUserDialogue && detectedContent.hasDialogue) {
      hasUserDialogue = true;
      requestData.userDialogue = detectedContent.dialogueLines;
      console.log("[generate-script] Auto-detected dialogue from input:", detectedContent.dialogueLines.length, "lines");
    }
    
    const mustPreserveContent = requestData.preserveUserContent || hasUserNarration || hasUserDialogue;
    
    // Calculate recommended clip count based on content
    const recommendedClips = detectedContent.recommendedClipCount;
    console.log(`[generate-script] Recommended clips based on content: ${recommendedClips}`);
    
    if (isFullMovieMode) {
      // Full movie script generation - dynamic shot count based on content
      systemPrompt = `You write cinematic scripts for AI video generation and stitching. Generate EXACTLY ${recommendedClips} shots, each 6 seconds.

${mustPreserveContent ? `
CRITICAL - USER CONTENT PRESERVATION:
The user has provided specific narration/dialogue that MUST be used EXACTLY as written.
DO NOT paraphrase, summarize, or rewrite the user's text.
Your job is to create VISUAL descriptions that accompany the user's exact words.
` : ''}

FORMAT (use exactly this):
[SHOT 1] Visual description with motion and physics.
${hasUserNarration ? '[NARRATION] (User\'s exact narration for this shot)' : ''}
${hasUserDialogue ? '[DIALOGUE] (User\'s exact dialogue for this shot)' : ''}
[SHOT 2] Visual description continuing the motion seamlessly.
...continue for all shots...

CRITICAL: BUFFER SHOTS FOR SMOOTH STITCHING
When transitioning between significantly different scenes, include BUFFER SHOTS:
- ENVIRONMENTAL PAUSE: Wide establishing shot before new location
- REACTION BEAT: Close-up of subject processing the moment
- OBJECT DETAIL: Focus on prop/element to bridge scenes
- TRANSITIONAL MOVEMENT: Camera movement that bridges locations

INSERT BUFFER SHOTS:
- Before major location changes (interior → exterior)
- After intense action sequences (fight → calm moment)
- When changing primary subjects
- At emotional tone shifts

CINEMATIC TRANSITION RULES (CRITICAL):
1. PHYSICS CONTINUITY: If shot ends with motion (falling, running, reaching), next shot MUST continue that momentum OR use buffer shot
2. SPATIAL FLOW: Camera perspective flows naturally - if ending on a close-up, use a buffer to reset OR continue movement
3. MATCH-ACTION: Character's gesture/movement at end of one shot continues at start of next
4. LIGHTING BRIDGE: Maintain consistent light direction across cuts, or use buffer to establish new lighting
5. GAZE DIRECTION: If character looks left at end, next shot shows what they see OR buffer establishes new POV

MOTION REQUIREMENTS:
- Every shot includes visible movement (character action, physics motion, or camera drift)
- End each shot with momentum that carries into the next OR with a neutral "safe" position
- For difficult transitions, use a BUFFER SHOT with establishing/detail content
- Describe body mechanics: weight shifts, reach, tension, release

RULES:
- Generate EXACTLY ${recommendedClips} shots to fit the content
- Each shot is EXACTLY 6 seconds
- Rich visual descriptions with motion and physics
- Every transition must be seamless - use buffer shots for major scene changes
- NO static scenes - always movement (even buffer shots have subtle motion)
${mustPreserveContent ? '- PRESERVE USER\'S EXACT NARRATION/DIALOGUE - do not modify their words' : ''}`;

      // Build character descriptions if provided
      const characterDescriptions = hasCharacters 
        ? requestData.characters!.map(char => 
            `${char.name}: ${char.description.split('.')[0]}`
          ).join(', ')
        : '';

      userPrompt = `Write EXACTLY ${recommendedClips} shots for: "${requestData.title}"
Genre: ${requestData.genre || 'Drama'}
${requestData.synopsis ? `Concept: ${requestData.synopsis.substring(0, 200)}` : ''}
${characterDescriptions ? `Characters: ${characterDescriptions}` : ''}
${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT CHANGE):
"""
${requestData.userNarration}
"""
Distribute this narration across the ${recommendedClips} shots. Use the EXACT words provided.
` : ''}
${hasUserDialogue && requestData.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT CHANGE):
${requestData.userDialogue.map((d, i) => `Line ${i + 1}: "${d}"`).join('\n')}
Include these dialogue lines in the appropriate shots. Use the EXACT words provided.
` : ''}

CRITICAL: 
- Generate EXACTLY ${recommendedClips} shots (based on content length)
- Total duration: ${recommendedClips * 6} seconds
- Each shot must transition SMOOTHLY into the next
- Use BUFFER SHOTS (establishing, detail, reaction beats) between major scene changes
- This will be stitched by AI, so ensure visual continuity
${mustPreserveContent ? '- The user\'s narration/dialogue MUST appear exactly as written - only add visual descriptions' : ''}
Write ${recommendedClips} shots. Rich visual descriptions. Go:`;

    } else {
      // Legacy simple mode - for topic-based requests
      systemPrompt = `You are a visual storyteller. Write scripts that are VISUALLY RICH with cinematic precision.
Include specific visual details: colors, lighting, textures, movements.
After each key point, add a [VISUAL: description] tag.
${mustPreserveContent ? `
CRITICAL: The user has provided specific narration/dialogue. You MUST use their EXACT words.
DO NOT paraphrase or rewrite. Only add visual descriptions to accompany their text.
` : ''}`;

      // Use synopsis OR topic for the content
      const content = requestData.synopsis || requestData.topic || 'a visually engaging scene';

      userPrompt = `Write a VISUALLY DESCRIPTIVE ${requestData.duration || '60 second'} video script about: ${content}
Style: ${requestData.style || 'Professional and engaging'}
Title: ${requestData.title || 'Untitled'}
${hasUserNarration ? `
USER'S NARRATION (USE EXACTLY - DO NOT MODIFY):
"""
${requestData.userNarration}
"""
` : ''}
${hasUserDialogue && requestData.userDialogue ? `
USER'S DIALOGUE (USE EXACTLY - DO NOT MODIFY):
${requestData.userDialogue.map((d, i) => `"${d}"`).join('\n')}
` : ''}

Requirements:
- Follow the user's concept EXACTLY
${mustPreserveContent ? '- USE THE USER\'S EXACT NARRATION/DIALOGUE - do not paraphrase or rewrite their words' : ''}
- Start with an attention-grabbing hook AND opening visual
- Include [VISUAL: ...] tags describing imagery
- Use descriptive language for environments and characters
- Keep the script focused on what the user asked for

Write the script now:`;
    }

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
        max_tokens: Math.max(800, recommendedClips * 120), // Scale tokens with clip count
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid OpenAI API key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const script = data.choices?.[0]?.message?.content;
    
    // Count actual shots in generated script
    const shotMatches = script?.match(/\[SHOT \d+\]/g) || [];
    const actualShotCount = shotMatches.length || recommendedClips;
    
    console.log(`Script generated successfully, length: ${script?.length}, shots: ${actualShotCount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        script,
        title: requestData.title,
        genre: requestData.genre,
        characters: requestData.characters?.map(c => c.name),
        wordCount: script?.split(/\s+/).length || 0,
        estimatedDuration: actualShotCount * 6, // 6 seconds per shot
        recommendedClipCount: recommendedClips,
        actualClipCount: actualShotCount,
        detectedContent: {
          hasDialogue: detectedContent.hasDialogue,
          hasNarration: detectedContent.hasNarration,
          dialogueLineCount: detectedContent.dialogueLines.length,
          contentPreserved: mustPreserveContent,
        },
        model: "gpt-4o-mini",
        usage: data.usage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-script function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
