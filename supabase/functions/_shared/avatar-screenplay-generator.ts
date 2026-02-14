/**
 * AVATAR SCREENPLAY GENERATOR — WORLD-CLASS EDITION
 * 
 * Transforms simple user prompts into award-winning, dialogue-rich screenplays
 * with cinematic movement, comedic timing, emotional depth, and professional
 * scene transitions worthy of Pixar/A24/Netflix short-form content.
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
  transitionNote?: string; // How this clip flows into the next
  physicalDetail?: string; // Micro-action details (fidgeting, glancing, etc.)
}

export interface GeneratedScreenplay {
  segments: ScreenplaySegment[];
  title: string;
  tone: string;
  hasMovement: boolean;
  narrativeArc: string;
}

/**
 * Generate a world-class screenplay from a simple user prompt.
 * Uses OpenAI to expand into natural dialogue with movement, humor, and cinematic flair.
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
  
  console.log(`[ScreenplayGen] 🎬 WORLD-CLASS screenplay: "${userPrompt.substring(0, 80)}", ${clipCount} clips, dual=${isDualAvatar}`);
  
  const systemPrompt = buildScreenplaySystemPrompt(clipCount, clipDuration, primaryCharacter, secondaryCharacter, sceneDescription);
  const userMessage = buildScreenplayUserPrompt(userPrompt, clipCount, isDualAvatar, primaryCharacter, secondaryCharacter, clipDuration);
  
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
        max_tokens: Math.min(clipCount * 500 + 800, 6000),
        temperature: 0.95,
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

function buildScreenplaySystemPrompt(
  clipCount: number,
  clipDuration: number,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
  sceneDescription?: string
): string {
  const isDual = !!secondary;
  const wordsPerClip = Math.floor(clipDuration * 2.2);
  
  return `You are an EMMY-WINNING screenwriter who creates viral short-form content that gets millions of views. Your writing has been compared to the best of Ryan Reynolds' social media, Pixar's emotional precision, and Taika Waititi's comedic timing.

═══ YOUR SIGNATURE STYLE ═══
1. THE HOOK: Every screenplay opens with a line that makes people STOP SCROLLING.
2. SUBVERSION: You set up expectations, then twist them. The audience never sees it coming.
3. SPECIFICITY: You never write generic dialogue. Instead of "that's nice", you write "that's the kind of nice that makes you suspicious."
4. PHYSICAL COMEDY: Characters don't just talk — they knock things over, trip, do double-takes, slowly turn to camera.
5. CALLBACK HUMOR: Plant something early, pay it off later. Even in ${clipCount} clips.
6. EMOTIONAL TRUTH: Underneath the humor, there's always something real and relatable.
7. THE BUTTON: Every screenplay ends on a moment that makes people replay or share.

═══ NARRATIVE ARC (even in ${clipCount * clipDuration} seconds) ═══
- CLIP 1: THE HOOK — Grab attention. Bold statement, question, or unexpected situation.
${clipCount >= 3 ? `- CLIPS 2-${clipCount - 1}: THE ESCALATION — Each beat raises stakes, adds complications, reveals new info.` : '- MIDDLE: BUILD — Complicate or deepen the hook.'}
- FINAL CLIP: THE PAYOFF — Twist, punchline, emotional landing, or satisfying resolution.

${isDual ? `
═══ DUAL CHARACTER CHEMISTRY ═══
CHARACTER 1 (PRIMARY): "${primary.name}" — ${primary.avatarType === 'animated' ? 'Animated/stylized' : 'Realistic'}
CHARACTER 2 (SECONDARY): "${secondary!.name}" — ${secondary!.avatarType === 'animated' ? 'Animated/stylized' : 'Realistic'}

⚠️ STRATEGIC CHARACTER INTRODUCTION PROTOCOL (CRITICAL — DO NOT IGNORE) ⚠️
The second character MUST be introduced with CINEMATIC INTENTION. NEVER have them just "appear."

INTRODUCTION STRATEGIES (pick the best fit for the story):
1. THE PLANT → REVEAL: Clip 1 hints at someone else ("You know who'd love this?", a sound off-screen, noticing something). Clip 2 REVEALS the second character was there the whole time or arrives with purpose.
2. THE REACTION SHOT: Primary says/does something bold. CUT TO: Secondary already watching, arms crossed, with a look that says everything. Their first line is a REACTION to what Primary just did.
3. THE INTERRUPTION: Primary is mid-sentence or mid-action when Secondary walks in, calls out, or physically enters the frame. "Excuse me—" "Oh no, not you."
4. THE HANDOFF: Primary directly addresses or introduces the secondary. "Let me show you something" (turns to reveal Secondary). Or "You want to know what THEY think?"
5. THE CONTRAST CUT: Primary's clip ends with a strong statement. HARD CUT to Secondary in a completely different energy/pose, contradicting or building on it. The JUXTAPOSITION tells the story.
6. THE SHARED SPACE: Both are already in the same environment from clip 1, but the camera only shows Primary. Clip 2 WIDENS or PANS to reveal Secondary was in the same scene.

TRANSITION RULES FOR EVERY CHARACTER SWITCH:
- The LAST LINE of a primary clip must CREATE A REASON for the cut to secondary (question, reference, setup, cliffhanger)
- The FIRST LINE of a secondary clip must ACKNOWLEDGE the transition (react to what was said, answer the question, subvert the setup)
- NEVER have a character switch without narrative connective tissue
- transitionNote MUST describe the specific visual/narrative bridge between clips

DIALOGUE MASTERY RULES:
- These two have CHEMISTRY. They play off each other like a comedy duo.
- Use INTERRUPTIONS: "Wait, did you just—" "Yes. And I'd do it again."
- Use REACTIONS: One character's face tells the story while the other talks.
- Use DISAGREEMENT that's ENTERTAINING: They don't just agree on everything.
- OVERLAPPING energy: One is the setup, the other is the punchline (alternate who's which).
- PHYSICAL INTERPLAY: They can nudge each other, point at each other, turn away dramatically.
- Give each a DISTINCT VOICE: One might be deadpan, the other expressive. One formal, one casual.
- They REFERENCE what the other said/did: "You literally just—" "We don't talk about that."
` : `
═══ SOLO PERFORMER ═══
CHARACTER: "${primary.name}" — ${primary.avatarType === 'animated' ? 'Animated/stylized' : 'Realistic'}

SOLO MASTERY RULES:
- This character speaks TO THE AUDIENCE like they're confiding in a friend.
- BREAK THE FOURTH WALL: React to their own words. "Did I really just say that? Yes. Yes I did."
- PHYSICAL STORYTELLING: Don't just stand there. Walk, turn, gesture, react to the environment.
- VOICE MODULATION cues: Whisper for secrets, speed up for excitement, pause for emphasis.
- SHOW vulnerability: The best solo content has a real human moment.
`}

${sceneDescription ? `SCENE SETTING: ${sceneDescription}` : 'SCENE: Let the story determine the perfect environment.'}

═══ MOVEMENT DIRECTION (CRITICAL) ═══
Characters are ALIVE. They inhabit physical space. Every clip needs VISIBLE MOTION:
- WALK: Strolling, pacing, power-walking, meandering, turning corners
- GESTURE: Pointing, waving, counting on fingers, throwing hands up, facepalm
- LEAN: Against a wall, over a table, toward camera, back in surprise
- TURN: Dramatic spin, slow turn to camera, whipping around, double-take
- SIT/STAND: Sitting down in disbelief, standing up in excitement, flopping into chair
- DRIVE: Behind the wheel, passenger reactions, looking out windows
- REACT: Spit-take, jaw drop, slow clap, covering face, freezing in place
- DANCE: Victory dance, nervous shuffle, rhythmic movement, celebratory
- RUN: Running toward something, running away, jogging alongside someone

PACING: Vary the energy. Not every clip should be high-energy. Quiet moments make loud moments land harder.

═══ OUTPUT FORMAT (strict JSON) ═══
{
  "title": "Catchy, shareable title",
  "tone": "comedy|drama|inspirational|action|wholesome|sarcastic|heartfelt|absurd",
  "narrativeArc": "One sentence describing the story arc",
  "segments": [
    {
      "clipIndex": 0,
      "avatarRole": "primary",
      "dialogue": "Exactly what is SPOKEN ALOUD (conversational, not written language)",
      "action": "Detailed physical action: walking into frame, leaning on railing looking out at city",
      "movement": "walk|gesture|lean|turn|sit|stand|drive|react|dance|run|point|laugh|freeze",
      "sceneNote": "Rooftop at golden hour, city skyline behind, wind in hair",
      "emotion": "amused|excited|thoughtful|surprised|confident|nervous|dramatic|deadpan|tender|mischievous",
      "cameraHint": "tracking|close-up|wide|over-shoulder|medium|panning|dolly-in|low-angle|crane",
      "transitionNote": "Cuts to reveal the other character was standing there the whole time",
      "physicalDetail": "Tapping fingers on railing, slight squint against the sun"
    }
  ]
}

CRITICAL RULES:
- Output EXACTLY ${clipCount} segments
- Each dialogue MUST be speakable in ~${clipDuration} seconds (${wordsPerClip} words MAX — count carefully)
- ${isDual ? `ALTERNATE between primary and secondary roles. First and last clips are ALWAYS primary.` : 'All segments use "primary".'}
- dialogue = SPOKEN WORDS ONLY. Write how people ACTUALLY TALK, not how they write.
- Use contractions: "I'm", "can't", "wouldn't". NEVER "I am", "cannot" unless for emphasis.
- Include natural speech patterns: "Look,", "Okay so,", "Here's the thing—", "I mean,"
- action = VISIBLE physical behavior (what would a director tell the actor to DO)
- physicalDetail = micro-actions that make it feel REAL (fidgeting, adjusting glasses, glancing away)
- Output ONLY valid JSON, no markdown, no explanation`;
}

function buildScreenplayUserPrompt(
  userPrompt: string,
  clipCount: number,
  isDual: boolean,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
  clipDuration: number = 10,
): string {
  const wordsPerClip = Math.floor(clipDuration * 2.2);
  
  return `Write a ${clipCount}-clip viral screenplay for this concept:

"${userPrompt}"

${isDual 
  ? `${primary.name} and ${secondary!.name} interact like a legendary comedy duo — think Key & Peele, Abbott & Costello, or Ryan Reynolds & Hugh Jackman. They REACT to each other, riff off each other, and create magic together. Give them distinct personalities that complement each other.

⚠️ CRITICAL: The second character (${secondary!.name}) must be INTRODUCED STRATEGICALLY — NOT just randomly appearing. Use one of these:
- Have ${primary.name} reference, call out to, or set up ${secondary!.name} before the cut
- Use a reveal: ${secondary!.name} was watching/listening the whole time
- Have ${secondary!.name} interrupt or respond to something ${primary.name} said
- Use a contrast cut where ${secondary!.name}'s energy directly responds to ${primary.name}'s last moment
Every character switch MUST have a transitionNote explaining the visual/narrative bridge.` 
  : `${primary.name} delivers this like a master storyteller — think a TED talk speaker with the charisma of a stand-up comedian. They OWN the space, use physicality, and make the audience feel like they're being let in on a secret.`
}

REQUIREMENTS:
1. HOOK the audience in clip 1 — they should want to keep watching
2. Each clip should have DISTINCT physical movement (not just standing and talking)
3. Dialogue must sound NATURAL and SPOKEN (max ${wordsPerClip} words per clip)
4. End with a moment that makes people want to SHARE this
5. Include at least one unexpected moment or twist
6. Make it genuinely ENTERTAINING — not generic corporate content
${isDual ? `7. EVERY transitionNote field MUST be filled with a specific description of how the scene bridges to the next character` : ''}

Output ONLY the JSON object. No markdown wrapping.`;
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
      const maxWords = Math.floor(clipCount > 0 ? (300 / clipCount) : 22); // ~2.2 words/sec
      let dialogue = s.dialogue || '';
      const words = dialogue.split(/\s+/);
      if (words.length > maxWords + 5) {
        // Trim to max words, preserving sentence boundary
        dialogue = words.slice(0, maxWords).join(' ');
        // Try to end at a natural boundary
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
      };
    });
    
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
      });
    }
    
    if (secondary && segments.length >= 2) {
      segments[0].avatarRole = 'primary';
      segments[segments.length - 1].avatarRole = 'primary';
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

function createFallbackScreenplay(
  script: string,
  clipCount: number,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
): GeneratedScreenplay {
  const sentences = script.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [script];
  const clean = sentences.map(s => s.trim()).filter(s => s.length > 0);
  
  // Even fallback gets variety
  const fallbackMovements = ['walk', 'gesture', 'lean', 'turn', 'gesture', 'react'];
  const fallbackEmotions = ['confident', 'excited', 'amused', 'thoughtful', 'dramatic'];
  const fallbackCameras = ['medium', 'tracking', 'close-up', 'wide', 'dolly-in'];
  const fallbackActions = [
    'walking into frame with energy',
    'gesturing expressively while explaining',
    'leaning forward with intensity',
    'turning to face the audience directly',
    'pausing for dramatic effect, then continuing',
    'reacting with surprise before speaking',
  ];
  
  const segments: ScreenplaySegment[] = [];
  for (let i = 0; i < clipCount; i++) {
    const sentenceIdx = i % Math.max(clean.length, 1);
    const isSecondary = secondary && i > 0 && i < clipCount - 1 && i % 2 === 1;
    
    segments.push({
      clipIndex: i,
      avatarRole: isSecondary ? 'secondary' : 'primary',
      dialogue: clean[sentenceIdx] || script,
      action: fallbackActions[i % fallbackActions.length],
      movement: fallbackMovements[i % fallbackMovements.length],
      sceneNote: '',
      emotion: fallbackEmotions[i % fallbackEmotions.length],
      cameraHint: fallbackCameras[i % fallbackCameras.length],
      transitionNote: '',
      physicalDetail: '',
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
