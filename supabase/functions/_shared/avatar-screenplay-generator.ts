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
CHARACTER 1 (PRIMARY — "A1"): "${primary.name}" — ${primary.avatarType === 'animated' ? 'Animated/stylized' : 'Realistic'}
CHARACTER 2 (SECONDARY — "A2"): "${secondary!.name}" — ${secondary!.avatarType === 'animated' ? 'Animated/stylized' : 'Realistic'}

⚠️ MANDATORY 6-CLIP STRUCTURE: "INTRODUCE → MEET → BRANCH → RETURN → CONTINUE → FINISH" ⚠️

THE EXACT FLOW (follow this PRECISELY for ${clipCount} clips):

CLIP 1 — A1 SOLO OPENING (avatarRole: "primary")
  - A1 is ALONE. Establishing their world, personality, and the topic/situation.
  - A1 speaks directly to camera OR sets up the scenario. This is THEIR moment.
  - NO mention of A2 yet. The audience bonds with A1 first.
  - End with something that MOTIVATES the cut: A1 hears something, turns, or says "speaking of which..."

CLIP 2 — A2 ENTERS / THE MEETING (avatarRole: "secondary")
  - A2 appears in A1's space OR the camera reveals A2 was nearby.
  - This is the INTRODUCTION moment. A2 makes an entrance — walks in, interrupts, appears from behind.
  - SHORT DIALOGUE TOGETHER: A1 and A2 have a quick exchange (A2 speaks, referencing A1).
  - The sceneNote MUST describe BOTH characters present. A2 is the focus but A1 is referenced.
  - End with A2 having a REASON to go do something: "Let me go check..." / "I'll handle that" / walks off.

CLIP 3 — A2 SOLO ADVENTURE (avatarRole: "secondary")
  - A2 is NOW ALONE in a DIFFERENT ENVIRONMENT. New room, outside, driving, different location.
  - This is A2's showcase moment. They can walk, drive, explore, react to their new surroundings.
  - They should REFERENCE what happened with A1: "Can you believe they said..." or react to the task.
  - MOVEMENT IS KEY: walking into a new room, driving, stepping outside, different background entirely.

CLIP 4 — BACK TO A1 (avatarRole: "primary")
  - CUT BACK to A1. Can be SAME scene or DIFFERENT scene from clip 1.
  - A1 reacts to A2's departure, continues their thought, or has moved to a new spot.
  - References the meeting: "Now that they're gone..." or continues the narrative thread.

CLIP 5 — A1 CONTINUES (avatarRole: "primary")
  - A1 stays on screen. Deepens the story, builds toward the conclusion.
  - This is the ESCALATION or REVELATION moment. New info, twist, or emotional beat.
  - Sets up the handoff to A2 for the finale: "But honestly..." or a cliffhanger.

CLIP 6 — A2 FINISHES (avatarRole: "secondary")
  - A2 gets the FINAL WORD. The closer, the punchline, the emotional landing.
  - Can be in their solo location OR back with A1 (callback to clip 2).
  - This must be the moment that makes people REPLAY or SHARE.
  - THE BUTTON: End on something memorable — a twist, a callback, a mic-drop line.

${clipCount !== 6 ? `NOTE: Adapt this structure proportionally for ${clipCount} clips. The KEY BEATS are:
- A1 opens solo → A2 enters and they interact → A2 goes solo (new scene) → A1 returns → A2 closes.
- For fewer clips, merge beats. For more clips, extend A1/A2 solo sections.` : ''}

TRANSITION RULES FOR EVERY CHARACTER SWITCH:
- The LAST LINE of a clip must CREATE A REASON for the cut to the next character
- The FIRST LINE of the next clip must ACKNOWLEDGE the transition
- NEVER have a character switch without narrative connective tissue
- transitionNote MUST describe the specific visual/narrative bridge between clips

A2 ENTRANCE STRATEGIES (for Clip 2):
1. THE INTERRUPTION: A2 walks into frame mid-sentence. "Sorry, couldn't help but overhear—"
2. THE REVEAL: Camera pulls back to show A2 was standing there. "You done? Because—"
3. THE ARRIVAL: Door opens, A2 enters. "Okay, I'm here. What's the emergency?"
4. THE REACTION: A2 appears reacting to what A1 just said. "Wait, you're serious about that?"

DIALOGUE MASTERY RULES:
- These two have CHEMISTRY. They play off each other like a comedy duo.
- Use INTERRUPTIONS: "Wait, did you just—" "Yes. And I'd do it again."
- Use REACTIONS: One character's face tells the story while the other talks.
- Use DISAGREEMENT that's ENTERTAINING: They don't just agree on everything.
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
- ${isDual ? `Follow the EXACT clip structure: Clip 1=primary solo, Clip 2=secondary (enters A1's scene), Clip 3=secondary solo (NEW location), Clip 4=primary returns, Clip 5=primary continues, Clip 6=secondary finishes. avatarRole must match: "primary" for A1 clips, "secondary" for A2 clips.` : 'All segments use "primary".'}
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
  ? `${primary.name} (A1) and ${secondary!.name} (A2) are a DUO with amazing chemistry.

⚠️ MANDATORY STRUCTURE — FOLLOW EXACTLY:
- CLIP 1: A1 (${primary.name}) is ALONE. Solo opening. Establishes the world and topic.
- CLIP 2: A2 (${secondary!.name}) ENTERS A1's scene. They interact briefly — short dialogue together. A2 is the focus.
- CLIP 3: A2 goes SOLO in a DIFFERENT LOCATION (new room, outside, driving, etc.). Adventure/exploration moment.
- CLIP 4: Cut BACK to A1. Same or different scene. A1 continues the narrative.
- CLIP 5: A1 stays on. Escalation or revelation. Builds to the close.
- CLIP 6: A2 gets the FINAL WORD. The closer, the punchline, the payoff.
- Every character switch needs a MOTIVATED reason and transitionNote explaining the bridge.` 
  : `${primary.name} delivers this like a master storyteller — think a TED talk speaker with the charisma of a stand-up comedian. They OWN the space, use physicality, and make the audience feel like they're being let in on a secret.`
}

REQUIREMENTS:
1. CLIP 1 is A1 SOLO — no A2 yet
2. CLIP 2 introduces A2 INTO A1's scene — they meet/interact
3. CLIP 3 sends A2 to a DIFFERENT ENVIRONMENT — new background, movement, exploration
4. Each clip should have DISTINCT physical movement (not just standing and talking)
5. Dialogue must sound NATURAL and SPOKEN (max ${wordsPerClip} words per clip)
6. End with a moment that makes people want to SHARE this
7. Make it genuinely ENTERTAINING — not generic corporate content
${isDual ? `8. EVERY transitionNote field MUST describe the specific visual/narrative bridge between clips
9. A2's solo clip (clip 3) MUST have a visually DIFFERENT scene/background from clips 1-2` : ''}

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
    
    // Enforce the correct dual-avatar structure:
    // Clip 1: primary, Clip 2: secondary, Clip 3: secondary, Clip 4: primary, Clip 5: primary, Clip 6: secondary
    if (secondary && segments.length >= 2) {
      const dualPattern = getDualAvatarPattern(segments.length);
      for (let i = 0; i < segments.length; i++) {
        segments[i].avatarRole = dualPattern[i] || 'primary';
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
  // 6+ clips: primary, secondary, secondary, primary, primary, secondary
  const pattern: Array<'primary' | 'secondary'> = ['primary', 'secondary', 'secondary', 'primary', 'primary', 'secondary'];
  // For clips beyond 6, alternate
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
