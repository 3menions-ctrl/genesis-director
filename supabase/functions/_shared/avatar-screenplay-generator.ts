/**
 * AVATAR SCREENPLAY GENERATOR — KLING-NATIVE EDITION
 * 
 * CORE PHILOSOPHY: Every clip is a 5-10 second animation from a SINGLE START FRAME.
 * The AI model (Kling v2.6) takes one image and produces motion from it.
 * This means:
 *   1. Each clip must describe ONE continuous visual action achievable from a still pose
 *   2. The END STATE of clip N must be a plausible START STATE for clip N+1
 *   3. Scene changes need visual bridges (close-up → new wide shot)
 *   4. Characters can't teleport — movement must be physically continuous
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
  action: string;
  movement: string;
  sceneNote: string;
  emotion: string;
  cameraHint: string;
  transitionNote?: string;
  physicalDetail?: string;
  // NEW: Kling-specific fields
  startPose: string;       // What the character looks like at frame 0
  endPose: string;         // Where they should be at the last frame (becomes next clip's start)
  visualContinuity: string; // Explicit instruction for what carries over to next clip
}

export interface GeneratedScreenplay {
  segments: ScreenplaySegment[];
  title: string;
  tone: string;
  hasMovement: boolean;
  narrativeArc: string;
}

/**
 * Generate a Kling-native screenplay from a user prompt.
 * Every beat is designed around what Kling can actually render:
 * single-image → 5-10 second animation with consistent identity.
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
  
  console.log(`[ScreenplayGen] 🎬 KLING-NATIVE screenplay: "${userPrompt.substring(0, 80)}", ${clipCount} clips @ ${clipDuration}s, dual=${isDualAvatar}`);
  
  const systemPrompt = buildKlingNativeSystemPrompt(clipCount, clipDuration, primaryCharacter, secondaryCharacter, sceneDescription);
  const userMessage = buildKlingNativeUserPrompt(userPrompt, clipCount, isDualAvatar, primaryCharacter, secondaryCharacter, clipDuration);
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: Math.min(clipCount * 600 + 1000, 8000),
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      console.error(`[ScreenplayGen] OpenAI error: ${response.status}`);
      return createFallbackScreenplay(userPrompt, clipCount, primaryCharacter, secondaryCharacter);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("[ScreenplayGen] Empty response from OpenAI");
      return createFallbackScreenplay(userPrompt, clipCount, primaryCharacter, secondaryCharacter);
    }

    const parsed = parseScreenplayResponse(content, clipCount, primaryCharacter, secondaryCharacter);
    console.log(`[ScreenplayGen] ✅ Generated ${parsed.segments.length} segments | Arc: ${parsed.narrativeArc} | Tone: ${parsed.tone}`);
    return parsed;
    
  } catch (error) {
    console.error("[ScreenplayGen] Error:", error);
    return createFallbackScreenplay(userPrompt, clipCount, primaryCharacter, secondaryCharacter);
  }
}

function buildKlingNativeSystemPrompt(
  clipCount: number,
  clipDuration: number,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
  sceneDescription?: string
): string {
  const isDual = !!secondary;
  const wordsPerClip = Math.floor(clipDuration * 2.2);
  
  return `You are a screenwriter who understands AI video generation at a TECHNICAL level. You write scripts specifically for KLING v2.6, an image-to-video model.

═══ HOW KLING WORKS (YOU MUST UNDERSTAND THIS) ═══
Kling takes ONE START IMAGE and produces ${clipDuration} seconds of video from it.
- The start image is a STILL FRAME showing the character in a specific pose and environment
- Kling then ANIMATES that frame — making the character move, talk, gesture
- The LAST FRAME of each clip becomes the START IMAGE for the NEXT clip
- This is called "frame-chaining" — it's how we create continuous videos

THIS MEANS:
1. Each clip's ACTION must be something achievable starting from a still pose
2. The character must end each clip in a pose that makes sense as the START of the next clip
3. You can't have the character suddenly be somewhere else — movement must be physically continuous
4. Camera angles are LOCKED for each clip (Kling doesn't move cameras mid-clip well)
5. The environment/background stays MOSTLY the same within a clip

═══ WHAT MAKES A GREAT KLING CLIP ═══
GOOD ACTIONS (Kling renders these beautifully):
- Speaking with hand gestures (the #1 best action for talking head content)
- Leaning forward/backward while talking
- Turning head left/right to look at something
- Raising eyebrows, smiling, laughing, reacting
- Picking up or holding an object nearby
- Standing up from sitting / sitting down
- Slow walk forward or to the side (small movements)
- Reaching for something within arm's reach

BAD ACTIONS (Kling struggles with these):
- Running, jumping, fast movements (artifacts, blur)
- Multiple characters interacting in the same frame (identity drift)
- Complex hand movements (fingers get distorted)
- Rapid scene changes within one clip
- Character walking INTO frame (they should ALREADY be there)

═══ CONTINUOUS STORYTELLING RULES ═══
The secret to great AI-generated stories is VISUAL FLOW:

RULE 1 — END STATE = START STATE
The character's EXACT position at the end of clip N must make sense as frame 1 of clip N+1.
- If clip 3 ends with the character looking left → clip 4 starts with them looking left
- If clip 2 ends with them sitting → clip 3 starts with them sitting (or the action is "standing up")
- NEVER have a clip end in one pose and the next start in a completely different one

RULE 2 — ONE ACTION PER CLIP
Each ${clipDuration}-second clip should have ONE clear visual action:
- "Leans against the wall and speaks with growing frustration"
- "Turns slowly to camera with a knowing smile"
- "Gestures emphatically with both hands while making a point"
NOT: "Runs across the room, picks up a book, sits down, and starts reading"

RULE 3 — BRIDGE CLIPS FOR SCENE CHANGES
When you need to change location between characters, use a BRIDGE technique:
- End the outgoing clip with a CLOSE-UP (face fills frame — no background visible)
- Start the new location clip with a MEDIUM or WIDE shot establishing the new space
- This works because the close-up face can plausibly be ANYWHERE

RULE 4 — ESCALATING ENGAGEMENT
Even in ${clipCount * clipDuration} seconds, tell a complete story:
- Clip 1: HOOK — Say something unexpected that grabs attention
- Middle clips: ESCALATE — Each clip raises the stakes or adds new information
- Final clip: PAYOFF — Deliver the punchline, twist, or emotional landing

RULE 5 — DIALOGUE IS KING
For talking-head content, the PERFORMANCE sells it:
- Write dialogue that sounds like real people talk (contractions, filler words, interruptions)
- Match dialogue length to clip duration: MAX ${wordsPerClip} words per clip
- Let moments BREATHE — a dramatic pause after a revelation is more powerful than more words
- Reactions (raised eyebrow, slow head turn) can carry a beat with minimal dialogue

${isDual ? `
═══ DUAL CHARACTER STRUCTURE (${clipCount} clips) ═══
CHARACTER A1 (PRIMARY): "${primary.name}"
CHARACTER A2 (SECONDARY): "${secondary!.name}"

⚠️ CRITICAL KLING LIMITATION: Kling can only render ONE CHARACTER per clip reliably.
When two characters need to "interact," they do it ACROSS clips, not within one.

THE EXACT FLOW:
CLIP 1 — A1 SOLO (avatarRole: "primary")
  - A1 is ALREADY in their environment. Speaking to camera or setting up the story.
  - startPose: Standing or sitting in their main location
  - endPose: Must end looking toward camera OR slightly to the side (bridge to A2)

CLIP 2 — A2 APPEARS (avatarRole: "secondary")  
  - A2 is ALREADY POSITIONED in the SAME general space (different angle/position)
  - A2 responds to what A1 just said — creates conversational continuity
  - startPose: Already seated/standing in a complementary position
  - endPose: Engaged, possibly leaning in or gesturing

CLIP 3 — A2 SOLO (avatarRole: "secondary")
  - A2 in a DIFFERENT ENVIRONMENT (use close-up bridge from clip 2)
  - This is A2's showcase — their personality shines
  - startPose: In the new location, already settled
  - endPose: Whatever serves the story

CLIP 4 — A1 RETURNS (avatarRole: "primary")
  - Cut back to A1 (use close-up bridge if different location)
  - A1 continues the narrative thread, references what happened
  - startPose: Back in their environment (same or new)
  - endPose: Building toward conclusion

CLIP 5 — A1 ESCALATES (avatarRole: "primary")
  - A1 delivers the twist, revelation, or build-up
  - This is the dramatic peak before the payoff
  - startPose: Continuation from clip 4's end
  - endPose: Sets up A2's closer

CLIP 6 — A2 CLOSES (avatarRole: "secondary")
  - A2 gets the final word — punchline, callback, emotional button
  - This is the moment that makes people replay
  - startPose: Back in either location
  - endPose: Definitive — the story is complete

${clipCount !== 6 ? `Adapt for ${clipCount} clips. Key beats: A1 opens → A2 enters → A2 solos → A1 returns → A2 closes.` : ''}

DIALOGUE CHEMISTRY:
- They REFERENCE each other across clips: "Can you believe she said that?"
- One is the straight man, one is the wild card (or both are chaotic)
- They have DISTINCT speech patterns — don't make them sound the same
- Build CALLBACKS: Plant something in clip 1, pay it off in clip 6
` : `
═══ SOLO PERFORMER (${clipCount} clips) ═══
CHARACTER: "${primary.name}"

Solo storytelling is about INTIMACY with the camera:
- Speak TO the audience like confiding in a best friend
- Use the environment — pick things up, lean on surfaces, look out windows
- Vary energy: quiet revelations hit harder after animated excitement
- Physical comedy: freeze mid-gesture, slow turn to camera, exaggerated reactions
`}

${sceneDescription ? `SCENE: ${sceneDescription}` : 'SCENE: Let the story determine the perfect environment.'}

═══ OUTPUT FORMAT (strict JSON) ═══
{
  "title": "Catchy title",
  "tone": "comedy|drama|inspirational|wholesome|sarcastic|heartfelt|absurd",
  "narrativeArc": "One sentence story arc",
  "segments": [
    {
      "clipIndex": 0,
      "avatarRole": "primary",
      "dialogue": "Exact spoken words (MAX ${wordsPerClip} words — count carefully!)",
      "action": "ONE clear physical action achievable from a still start pose",
      "movement": "gesture|lean|turn|sit|stand|react|laugh|freeze|point|nod",
      "sceneNote": "Environment description for this clip",
      "emotion": "amused|excited|surprised|nervous|dramatic|confident|thoughtful|deadpan|tender|mischievous",
      "cameraHint": "close-up|medium|wide|low-angle|dolly-in",
      "transitionNote": "How this clip's END visually connects to the NEXT clip's START",
      "physicalDetail": "Micro-actions: fidgeting, glancing, adjusting hair",
      "startPose": "Character's position/pose at frame 0 of this clip",
      "endPose": "Character's position/pose at the last frame (becomes next clip's start)",
      "visualContinuity": "What must stay the same between this clip and the next"
    }
  ]
}

ABSOLUTE RULES:
1. Output EXACTLY ${clipCount} segments
2. Each dialogue MUST be ≤${wordsPerClip} words (2.2 words/second pace)
3. Every clip starts with character ALREADY IN POSITION (never "walks in" or "enters")
4. startPose of clip N+1 must match endPose of clip N
5. ONE action per clip — what can animate from a single still frame in ${clipDuration}s
6. Use contractions: "I'm", "can't", "won't" — never formal speech
7. Scene changes use CLOSE-UP BRIDGE technique
8. Output ONLY valid JSON, no markdown`;
}

function buildKlingNativeUserPrompt(
  userPrompt: string,
  clipCount: number,
  isDual: boolean,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
  clipDuration: number = 10,
): string {
  const wordsPerClip = Math.floor(clipDuration * 2.2);
  
  return `Write a ${clipCount}-clip screenplay for this concept:

"${userPrompt}"

${isDual 
  ? `${primary.name} (A1) and ${secondary!.name} (A2) tell this story TOGETHER.

MANDATORY STRUCTURE:
- CLIP 1: A1 solo — hooks the audience
- CLIP 2: A2 appears — responds to A1, establishes chemistry  
- CLIP 3: A2 solo in DIFFERENT location — their showcase moment
- CLIP 4: Back to A1 — continues the thread
- CLIP 5: A1 builds to climax
- CLIP 6: A2 delivers the payoff

Remember: Each clip renders ONE character. They "interact" across cuts, not within frames.
Every endPose must match the next clip's startPose for the same character.` 
  : `${primary.name} tells this story directly to camera — intimate, engaging, and memorable.
Vary their energy across clips. Use the space around them. Make it feel ALIVE.`
}

KLING-SPECIFIC REQUIREMENTS:
1. Each clip = ONE continuous action from a still start frame (${clipDuration} seconds)
2. endPose of clip N = startPose of clip N+1 (frame-chaining continuity)
3. For scene changes: end on CLOSE-UP, start new scene with MEDIUM/WIDE
4. Max ${wordsPerClip} words per clip dialogue
5. Actions must be things Kling renders well: gestures, head turns, leaning, reactions, subtle movement
6. AVOID: running, jumping, complex hand manipulation, rapid movements

Make it genuinely ENTERTAINING — not generic. Give it a real story arc.

Output ONLY the JSON object. No markdown.`;
}

function parseScreenplayResponse(
  content: string,
  clipCount: number,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
): GeneratedScreenplay {
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  
  const objStart = jsonStr.indexOf('{');
  const objEnd = jsonStr.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1) {
    jsonStr = jsonStr.substring(objStart, objEnd + 1);
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    const segments: ScreenplaySegment[] = (parsed.segments || []).map((s: any, i: number) => {
      // Word-count validation: trim dialogue to fit clip duration
      const maxWords = Math.floor(clipCount > 0 ? (300 / clipCount) : 22);
      let dialogue = s.dialogue || '';
      const words = dialogue.split(/\s+/);
      if (words.length > maxWords + 5) {
        dialogue = words.slice(0, maxWords).join(' ');
        const lastPunctuation = dialogue.search(/[.!?][^.!?]*$/);
        if (lastPunctuation > dialogue.length * 0.6) {
          dialogue = dialogue.substring(0, lastPunctuation + 1);
        }
      }
      
      return {
        clipIndex: i,
        avatarRole: s.avatarRole || (i % 2 === 0 ? 'primary' : (secondary ? 'secondary' : 'primary')),
        dialogue,
        action: s.action || 'speaking with natural energy',
        movement: s.movement || 'gesture',
        sceneNote: s.sceneNote || '',
        emotion: s.emotion || 'confident',
        cameraHint: s.cameraHint || 'medium',
        transitionNote: s.transitionNote || '',
        physicalDetail: s.physicalDetail || '',
        startPose: s.startPose || 'Standing naturally, facing camera',
        endPose: s.endPose || 'Same position, slight shift in weight',
        visualContinuity: s.visualContinuity || 'Same character, same outfit, same environment',
      };
    });
    
    // Pad if needed
    while (segments.length < clipCount) {
      segments.push({
        clipIndex: segments.length,
        avatarRole: 'primary',
        dialogue: '',
        action: 'speaking with engaging energy',
        movement: 'gesture',
        sceneNote: '',
        emotion: 'confident',
        cameraHint: 'medium',
        transitionNote: '',
        physicalDetail: '',
        startPose: 'Standing naturally',
        endPose: 'Standing naturally',
        visualContinuity: 'Same character and environment',
      });
    }
    
    // Enforce dual-avatar pattern
    if (secondary && segments.length >= 2) {
      const dualPattern = getDualAvatarPattern(segments.length);
      for (let i = 0; i < segments.length; i++) {
        segments[i].avatarRole = dualPattern[i] || 'primary';
      }
    }
    
    // VALIDATE CONTINUITY: Check that endPose matches next startPose for same character
    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];
      
      // If same character in consecutive clips, enforce continuity
      if (current.avatarRole === next.avatarRole) {
        if (!next.startPose || next.startPose === 'Standing naturally, facing camera') {
          next.startPose = current.endPose;
        }
        if (!current.visualContinuity) {
          current.visualContinuity = `Character maintains exact pose and position from end of this clip into clip ${i + 2}`;
        }
      }
      
      // If switching characters, ensure bridge transition
      if (current.avatarRole !== next.avatarRole && !current.transitionNote) {
        current.transitionNote = `Close-up on face at end of clip bridges to ${next.avatarRole === 'secondary' ? secondary?.name || 'A2' : primary.name} in next clip`;
      }
    }
    
    return {
      segments: segments.slice(0, clipCount),
      title: parsed.title || 'Untitled',
      tone: parsed.tone || 'wholesome',
      hasMovement: segments.some(s => s.movement !== 'gesture' && s.movement !== 'static'),
      narrativeArc: parsed.narrativeArc || 'A compelling story unfolds.',
    };
  } catch (e) {
    console.error("[ScreenplayGen] JSON parse failed:", e);
    return createFallbackScreenplay(content, clipCount, primary, secondary);
  }
}

/**
 * Returns the mandatory avatarRole pattern for dual-avatar clips.
 * Pattern: A1 solo → A2 enters → A2 solo → A1 returns → A1 continues → A2 finishes
 */
function getDualAvatarPattern(clipCount: number): Array<'primary' | 'secondary'> {
  if (clipCount <= 2) return ['primary', 'secondary'];
  if (clipCount === 3) return ['primary', 'secondary', 'secondary'];
  if (clipCount === 4) return ['primary', 'secondary', 'secondary', 'primary'];
  if (clipCount === 5) return ['primary', 'secondary', 'secondary', 'primary', 'secondary'];
  const pattern: Array<'primary' | 'secondary'> = ['primary', 'secondary', 'secondary', 'primary', 'primary', 'secondary'];
  for (let i = 6; i < clipCount; i++) {
    pattern.push(i % 2 === 0 ? 'primary' : 'secondary');
  }
  return pattern;
}

function createFallbackScreenplay(
  script: string,
  clipCount: number,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
): GeneratedScreenplay {
  const sentences = script.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [script];
  const clean = sentences.map(s => s.trim()).filter(s => s.length > 0);
  
  const fallbackMovements = ['gesture', 'lean', 'turn', 'nod', 'gesture', 'react'];
  const fallbackEmotions = ['confident', 'excited', 'amused', 'thoughtful', 'dramatic'];
  const fallbackCameras = ['medium', 'medium', 'close-up', 'medium', 'dolly-in'];
  const fallbackActions = [
    'gesturing expressively while speaking to camera',
    'leaning forward with emphasis, hands active',
    'turning slightly to the side, then back to camera with a knowing look',
    'nodding slowly while making a point, one hand raised',
    'pausing for emphasis, then continuing with growing energy',
    'reacting with surprise, eyebrows raised, slight lean back',
  ];
  
  const segments: ScreenplaySegment[] = [];
  const dualPattern = secondary ? getDualAvatarPattern(clipCount) : null;
  for (let i = 0; i < clipCount; i++) {
    const sentenceIdx = i % Math.max(clean.length, 1);
    
    segments.push({
      clipIndex: i,
      avatarRole: dualPattern ? dualPattern[i] : 'primary',
      dialogue: clean[sentenceIdx] || script,
      action: fallbackActions[i % fallbackActions.length],
      movement: fallbackMovements[i % fallbackMovements.length],
      sceneNote: '',
      emotion: fallbackEmotions[i % fallbackEmotions.length],
      cameraHint: fallbackCameras[i % fallbackCameras.length],
      transitionNote: i < clipCount - 1 ? 'Maintains position for seamless cut to next clip' : '',
      physicalDetail: '',
      startPose: 'Standing naturally, facing camera, hands at sides',
      endPose: 'Same position with slight weight shift',
      visualContinuity: 'Same character, outfit, and environment',
    });
  }
  
  return {
    segments,
    title: 'Untitled',
    tone: 'neutral',
    hasMovement: true,
    narrativeArc: 'A story unfolds.',
  };
}
