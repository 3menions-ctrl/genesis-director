/**
 * AVATAR SCREENPLAY GENERATOR
 * 
 * Transforms simple user prompts into creative, dialogue-rich screenplays
 * with natural movement, humor, and cinematic scene transitions.
 * 
 * Supports 1 or 2 avatars with dynamic back-and-forth dialogue.
 */

export interface AvatarCharacter {
  name: string;
  role: 'primary' | 'secondary';
  avatarType: 'realistic' | 'animated';
  voiceId?: string;
}

export interface ScreenplaySegment {
  clipIndex: number;
  avatarRole: 'primary' | 'secondary';
  dialogue: string;
  action: string;       // What the character physically does
  movement: string;     // walk, gesture, lean, turn, drive, etc.
  sceneNote: string;    // Scene/environment context for this beat
  emotion: string;      // Emotional tone for acting prompt
  cameraHint: string;   // Suggested camera treatment
}

export interface GeneratedScreenplay {
  segments: ScreenplaySegment[];
  title: string;
  tone: string;
  hasMovement: boolean;
}

/**
 * Generate a creative screenplay from a simple user prompt.
 * Uses OpenAI to expand into natural dialogue with movement and humor.
 */
export async function generateAvatarScreenplay(params: {
  userPrompt: string;
  clipCount: number;
  clipDuration: number;
  primaryCharacter: AvatarCharacter;
  secondaryCharacter?: AvatarCharacter | null;
  sceneDescription?: string;
  openaiApiKey: string;
}): Promise<GeneratedScreenplay> {
  const { userPrompt, clipCount, clipDuration, primaryCharacter, secondaryCharacter, sceneDescription, openaiApiKey } = params;
  
  const isDualAvatar = !!secondaryCharacter;
  const totalDuration = clipCount * clipDuration;
  
  console.log(`[ScreenplayGen] Generating screenplay: "${userPrompt.substring(0, 80)}", ${clipCount} clips, dual=${isDualAvatar}`);
  
  const systemPrompt = buildScreenplaySystemPrompt(clipCount, clipDuration, primaryCharacter, secondaryCharacter, sceneDescription);
  const userMessage = buildScreenplayUserPrompt(userPrompt, clipCount, isDualAvatar, primaryCharacter, secondaryCharacter);
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: Math.min(clipCount * 300 + 500, 4000),
        temperature: 0.9, // Higher creativity
      }),
    });

    if (!response.ok) {
      console.error(`[ScreenplayGen] OpenAI error: ${response.status}`);
      // Fallback: return basic split
      return createFallbackScreenplay(userPrompt, clipCount, primaryCharacter, secondaryCharacter);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("[ScreenplayGen] Empty response from OpenAI");
      return createFallbackScreenplay(userPrompt, clipCount, primaryCharacter, secondaryCharacter);
    }

    // Parse the JSON response
    const parsed = parseScreenplayResponse(content, clipCount, primaryCharacter, secondaryCharacter);
    console.log(`[ScreenplayGen] ✅ Generated ${parsed.segments.length} screenplay segments, tone: ${parsed.tone}`);
    return parsed;
    
  } catch (error) {
    console.error("[ScreenplayGen] Error:", error);
    return createFallbackScreenplay(userPrompt, clipCount, primaryCharacter, secondaryCharacter);
  }
}

function buildScreenplaySystemPrompt(
  clipCount: number,
  clipDuration: number,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
  sceneDescription?: string
): string {
  const isDual = !!secondary;
  
  return `You are a BRILLIANT screenwriter who creates SHORT-FORM video screenplays that are ENTERTAINING, NATURAL, and CINEMATIC.

Your screenplays are known for:
- WITTY, NATURAL dialogue that sounds like real people talking (not robotic or formal)
- PHYSICAL COMEDY and MOVEMENT - characters walk, gesture, react, move through spaces
- EMOTIONAL RANGE - humor, surprise, warmth, drama, sarcasm
- VISUAL STORYTELLING - show don't tell, use actions and reactions
- SATISFYING STORY ARCS even in ${clipCount * clipDuration} seconds

${isDual ? `
═══ DUAL CHARACTER SCREENPLAY ═══
You are writing for TWO characters who INTERACT with each other:

CHARACTER 1 (PRIMARY): "${primary.name}" - ${primary.avatarType === 'animated' ? 'Animated/cartoon character' : 'Realistic person'}
CHARACTER 2 (SECONDARY): "${secondary!.name}" - ${secondary!.avatarType === 'animated' ? 'Animated/cartoon character' : 'Realistic person'}

DIALOGUE RULES:
- Characters TALK TO EACH OTHER, not to camera (unless it's a vlog/presentation)
- Dialogue should flow naturally - interruptions, reactions, agreements, disagreements
- Each character should have a DISTINCT voice/personality
- Include REACTION beats - one character reacting to what the other said
- Use humor, banter, wit - make it ENTERTAINING
- Characters can disagree, tease each other, build on each other's ideas
` : `
═══ SINGLE CHARACTER SCREENPLAY ═══
CHARACTER: "${primary.name}" - ${primary.avatarType === 'animated' ? 'Animated/cartoon character' : 'Realistic person'}

This character speaks directly to the audience OR narrates a story.
Make them DYNAMIC - not just standing and talking. They should:
- Walk and explore the scene
- Use expressive gestures and body language
- React to their environment
- Show emotional range
`}

${sceneDescription ? `SCENE: ${sceneDescription}` : 'Scene will be determined by the story.'}

═══ MOVEMENT IS MANDATORY ═══
Characters MUST physically move in most clips:
- Walking, strolling, pacing, turning
- Leaning in, stepping back, sitting down, standing up
- Gesturing expressively, pointing, reaching
- Driving, riding, traveling (if story calls for it)
- Reacting physically - surprise, laughter, shock
DO NOT have characters just stand still and talk for every clip.

OUTPUT FORMAT (strict JSON):
{
  "title": "Creative title for this screenplay",
  "tone": "comedy|drama|inspirational|action|wholesome|sarcastic",
  "segments": [
    {
      "clipIndex": 0,
      "avatarRole": "primary",
      "dialogue": "What the character SAYS in this clip (spoken aloud)",
      "action": "Physical action description: walking through park, leaning against wall, turning to face friend",
      "movement": "walk|gesture|lean|turn|sit|stand|drive|react|dance|run",
      "sceneNote": "Brief scene context: outdoor cafe, city street at sunset",
      "emotion": "amused|excited|thoughtful|surprised|confident|nervous|dramatic",
      "cameraHint": "tracking|close-up|wide|over-shoulder|medium|panning"
    }
  ]
}

CRITICAL RULES:
- Output EXACTLY ${clipCount} segments
- Each segment's dialogue should be speakable in ~${clipDuration} seconds (${Math.floor(clipDuration * 2.5)} words max)
- ${isDual ? 'ALTERNATE between primary and secondary avatarRole. First and last clips are primary.' : 'All segments use "primary" avatarRole.'}
- dialogue field contains ONLY spoken words (what the character says aloud)
- action field describes VISIBLE physical movement
- Be CREATIVE and ENTERTAINING - not generic or boring
- Output ONLY valid JSON, nothing else`;
}

function buildScreenplayUserPrompt(
  userPrompt: string,
  clipCount: number,
  isDual: boolean,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
): string {
  return `Write a ${clipCount}-clip screenplay for this concept:

"${userPrompt}"

${isDual 
  ? `The two characters (${primary.name} and ${secondary!.name}) should interact naturally - talking to each other, reacting, moving through the scene together.` 
  : `${primary.name} should be dynamic and engaging - moving, gesturing, exploring the scene while delivering their lines.`
}

Make it creative, entertaining, and visually dynamic. Include physical movement in every clip.
Output ONLY the JSON object.`;
}

function parseScreenplayResponse(
  content: string,
  clipCount: number,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
): GeneratedScreenplay {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  
  // Try to find JSON object
  const objStart = jsonStr.indexOf('{');
  const objEnd = jsonStr.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1) {
    jsonStr = jsonStr.substring(objStart, objEnd + 1);
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    const segments: ScreenplaySegment[] = (parsed.segments || []).map((s: any, i: number) => ({
      clipIndex: i,
      avatarRole: s.avatarRole || (i % 2 === 0 ? 'primary' : (secondary ? 'secondary' : 'primary')),
      dialogue: s.dialogue || '',
      action: s.action || 'speaking naturally',
      movement: s.movement || 'gesture',
      sceneNote: s.sceneNote || '',
      emotion: s.emotion || 'confident',
      cameraHint: s.cameraHint || 'medium',
    }));
    
    // Ensure correct clip count
    while (segments.length < clipCount) {
      segments.push({
        clipIndex: segments.length,
        avatarRole: 'primary',
        dialogue: '',
        action: 'speaking naturally',
        movement: 'gesture',
        sceneNote: '',
        emotion: 'confident',
        cameraHint: 'medium',
      });
    }
    
    // Ensure first and last are primary for dual avatar
    if (secondary && segments.length >= 2) {
      segments[0].avatarRole = 'primary';
      segments[segments.length - 1].avatarRole = 'primary';
    }
    
    return {
      segments: segments.slice(0, clipCount),
      title: parsed.title || 'Untitled',
      tone: parsed.tone || 'wholesome',
      hasMovement: segments.some(s => s.movement !== 'gesture' && s.movement !== 'static'),
    };
  } catch (e) {
    console.error("[ScreenplayGen] JSON parse failed:", e);
    return createFallbackScreenplay(content, clipCount, primary, secondary);
  }
}

function createFallbackScreenplay(
  script: string,
  clipCount: number,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
): GeneratedScreenplay {
  // Simple sentence-based split as fallback
  const sentences = script.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [script];
  const clean = sentences.map(s => s.trim()).filter(s => s.length > 0);
  
  const segments: ScreenplaySegment[] = [];
  for (let i = 0; i < clipCount; i++) {
    const sentenceIdx = i % Math.max(clean.length, 1);
    const isSecondary = secondary && i > 0 && i < clipCount - 1 && i % 2 === 1;
    
    segments.push({
      clipIndex: i,
      avatarRole: isSecondary ? 'secondary' : 'primary',
      dialogue: clean[sentenceIdx] || script,
      action: 'speaking expressively with gestures',
      movement: 'gesture',
      sceneNote: '',
      emotion: 'confident',
      cameraHint: 'medium',
    });
  }
  
  return {
    segments,
    title: 'Untitled',
    tone: 'neutral',
    hasMovement: false,
  };
}
