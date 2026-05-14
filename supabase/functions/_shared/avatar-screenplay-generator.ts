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
  // NEW: turn-taking fields
  respondsTo?: string;     // Verbatim or paraphrase of the previous speaker's last beat this clip is reacting to
  handoffCue?: string;     // The final beat of dialogue that invites the next speaker to respond
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

  // Parse speaker-tagged dialogue if the user wrote it as a script (e.g. "Alice: Hi" / "A: ...").
  const parsedTurns = isDualAvatar
    ? parseSpeakerTaggedScript(userPrompt, primaryCharacter.name, secondaryCharacter!.name)
    : null;
  if (parsedTurns) {
    console.log(`[ScreenplayGen] 🎭 Detected ${parsedTurns.length} tagged turns from user script`);
  }

  const systemPrompt = buildKlingNativeSystemPrompt(clipCount, clipDuration, primaryCharacter, secondaryCharacter, sceneDescription);
  const userMessage = buildKlingNativeUserPrompt(userPrompt, clipCount, isDualAvatar, primaryCharacter, secondaryCharacter, clipDuration, parsedTurns);
  
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

    const parsed = parseScreenplayResponse(content, clipCount, primaryCharacter, secondaryCharacter, parsedTurns);
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
═══ DUAL CHARACTER MASTERCLASS (${clipCount} clips) ═══
CHARACTER A1 (PRIMARY): "${primary.name}"
CHARACTER A2 (SECONDARY): "${secondary!.name}"

⚠️ CRITICAL KLING LIMITATION: Kling can only render ONE CHARACTER per clip reliably.
When two characters need to "interact," they do it ACROSS clips, not within one.

═══ THE ART OF THE TWO-HANDER ═══
Great dual-character content lives or dies on THREE things:
1. THE INTRODUCTION — how A2 enters the conversation must feel EARNED, not random
2. THE CHEMISTRY — they must feel like two REAL people with history, not two chatbots
3. THE DELIVERY — pacing, pauses, callbacks, and the final payoff

INTRODUCTION TECHNIQUES (pick the best fit for the story):
• THE INTERRUPTION: A1 is mid-thought when A2 cuts in with something unexpected
  - A1: "So I was thinking about the meaning of—" → Cut to A2: "Oh please, not this again."
• THE REACTION: A1 makes a bold claim, A2's face tells us everything before they speak
  - A1: "I could totally survive in the wild." → Cut to A2: [slow blink, deadpan] "You cried at a bee sting."
• THE REVEAL: A2 has information that changes everything A1 just said
  - A1: "Nobody knows about this." → Cut to A2: "Funny. I heard about it from literally everyone."
• THE CALLBACK ENTRY: A2 enters by referencing something from a previous conversation
  - A1 finishes a point → Cut to A2: "Remember when you said that exact thing last time? How'd that work out?"
• THE CONTRAST CUT: Wildly different energy — A1 is hyped, A2 is deadpan (or vice versa)
  - A1: [Breathless excitement] → Cut to A2: [stares in silence for 2 seconds, then one perfect line]

CHEMISTRY FORMULA — Make them feel REAL:
• ASYMMETRIC ENERGY: One is always slightly more invested than the other. This creates TENSION.
• INCOMPLETE SENTENCES: Real friends interrupt. "Wait, hold on—" "No, let me finish—" "OKAY but—"
• SPECIFIC REFERENCES: "Like that time at the..." makes them feel like they have HISTORY together.
• PHYSICAL TELLS: One fidgets when lying. One leans back when unimpressed. SHOW don't tell.
• STATUS GAMES: One is subtly "winning" the conversation — the other is trying to catch up. This REVERSES by the end.
• DISTINCT VOCAL RHYTHM: A1 speaks in long, flowing sentences. A2 uses short, punchy fragments. (Or reverse it!)

DELIVERY SECRETS:
• THE PAUSE BEFORE THE PUNCHLINE: A2 stares for a beat, THEN delivers. Comedy is timing.
• THE DOUBLE-TAKE: A1 starts to move on, then freezes — "Wait, WHAT did you just say?"
• THE ESCALATION LADDER: Each exchange raises the stakes. Don't plateau.
• THE QUIET CLOSER: After big energy, the last clip can be quiet. A soft line hits harder after chaos.
• PLANT & PAYOFF: Something casual from clip 1 becomes devastating/hilarious by clip 6.
• THE LOOK: Sometimes the best response is NO words — just a look. Use this ONCE for maximum impact.

THE EXACT FLOW:
CLIP 1 — A1 SOLO HOOK (avatarRole: "primary")
  - A1 is ALREADY in their world. They say something that DEMANDS a response.
  - This clip must make the audience think "I NEED to hear what the other person says."
  - Don't waste this on setup. Open with the most interesting thing.
  - startPose: Natural, settled in environment
  - endPose: Either trailing off (for interruption) or looking to the side (for reaction cut)

CLIP 2 — A2 ENTERS (avatarRole: "secondary")
  - THIS IS THE MOST IMPORTANT CLIP. The introduction defines the relationship.
  - A2 doesn't just "respond" — they REFRAME everything A1 said.
  - Their very first line should tell us: Are they the friend? The rival? The chaos agent?
  - Use ONE of the introduction techniques above. Make it SPECIFIC to the story.
  - startPose: Already positioned, energy contrasting with A1
  - endPose: Engaged, leaning in or gesturing — they own the space now

CLIP 3 — A2 SOLO SHOWCASE (avatarRole: "secondary")
  - A2 in a DIFFERENT ENVIRONMENT (use close-up bridge from clip 2)
  - This is A2's moment to SHINE. They reveal something personal, funny, or surprising.
  - The audience should be thinking "I like this character" by the end of this clip.
  - startPose: In the new location, comfortable, expressive
  - endPose: Whatever serves the story — can be mid-gesture for comedic timing

CLIP 4 — A1 RETURNS WITH NEW ENERGY (avatarRole: "primary")
  - A1 comes back CHANGED — they react to what A2 said/revealed.
  - Don't just continue — EVOLVE. A1 has a new angle, a confession, a counter-argument.
  - The status dynamic may shift here: A1 was winning, now A2 has the upper hand (or vice versa).
  - startPose: Back in their environment
  - endPose: Building toward the climax

CLIP 5 — A1 BUILDS TO PEAK (avatarRole: "primary")
  - THE ESCALATION CLIP. Everything reaches its highest point.
  - A1 delivers the twist, the revelation, the emotional peak.
  - End on a cliffhanger moment — the audience NEEDS to see A2's reaction.
  - startPose: Continuation from clip 4
  - endPose: Frozen in a dramatic moment — sets up the final cut

CLIP 6 — A2 CLOSES (avatarRole: "secondary")
  - A2 gets the LAST WORD. This is the moment that makes people share the video.
  - Options: devastating punchline, tender callback, perfect one-liner, knowing silence.
  - The best closers REFERENCE clip 1 — circular storytelling is deeply satisfying.
  - startPose: Back in either location
  - endPose: Definitive — a look, a smile, a freeze. The story is COMPLETE.

${clipCount !== 6 ? `Adapt for ${clipCount} clips. Key beats: A1 hooks → A2 reframes → A2 shines → A1 evolves → climax → payoff.` : ''}
` : `
═══ SOLO PERFORMER (${clipCount} clips) ═══
CHARACTER: "${primary.name}"

Solo storytelling is about INTIMACY with the camera:
- Speak TO the audience like confiding in a best friend
- Use the environment — pick things up, lean on surfaces, look out windows
- Vary energy: quiet revelations hit harder after animated excitement
- Physical comedy: freeze mid-gesture, slow turn to camera, exaggerated reactions
- THE CONFESSION: Start confident, then let vulnerability crack through
- THE BUILD: Start quiet, end explosive — or start explosive, end with a whisper
- THE CALLBACK: Reference your own earlier point with new meaning
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
8. Output ONLY valid JSON, no markdown

═══ CRITICAL: USER TEXT PRESERVATION ═══
The user's prompt contains the EXACT MESSAGE they want their avatar to deliver.
You MUST preserve their words as the core dialogue — do NOT replace, rewrite, or paraphrase them.
You CAN:
  ✅ Split their text across clips naturally (at sentence or phrase boundaries)
  ✅ Add brief fun intros, reactions, transitions, or connective tissue AROUND their words
  ✅ Add personality flair: a cheeky opener, a dramatic pause cue, a playful sign-off
  ✅ Adjust phrasing slightly for spoken rhythm (e.g., "do not" → "don't") 
  ✅ Add stage directions, emotions, and actions that enhance delivery
You CANNOT:
  ❌ Remove or skip any of the user's sentences or key points
  ❌ Replace their message with a completely different script
  ❌ Summarize or condense their text into something shorter
  ❌ Change the meaning, tone, or intent of what they wrote
Think of yourself as a DIRECTOR enhancing a performer's script, not a WRITER replacing it.`;
}

function buildKlingNativeUserPrompt(
  userPrompt: string,
  clipCount: number,
  isDual: boolean,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
  clipDuration: number = 10,
  parsedTurns?: ParsedTurn[] | null,
): string {
  const wordsPerClip = Math.floor(clipDuration * 2.2);
  const turnPattern = isDual ? getDualAvatarPattern(clipCount) : null;
  const patternLine = turnPattern
    ? turnPattern.map((r, i) => `  Clip ${i + 1}: ${r === 'primary' ? primary.name : secondary!.name}`).join('\n')
    : '';

  const taggedBlock = parsedTurns && parsedTurns.length > 0
    ? `\n═══ SPEAKER-TAGGED DIALOGUE (HONOR THESE SPEAKERS) ═══\n` +
      parsedTurns.map((t, i) =>
        `  Turn ${i + 1} — ${t.role === 'primary' ? primary.name : secondary!.name}: "${t.text}"`
      ).join('\n') +
      `\n\nMap each tagged turn to a clip in order. The avatarRole on that clip MUST match the tagged speaker. ` +
      `Distribute remaining clips (if any) as natural reactions/follow-ups by the other speaker.\n`
    : '';
  
  return `Write a ${clipCount}-clip screenplay using the user's EXACT text as the core dialogue.

═══ USER'S SCRIPT (MUST BE PRESERVED AS DIALOGUE) ═══
"${userPrompt}"
═══ END USER SCRIPT ═══
${taggedBlock}
${turnPattern ? `\n═══ MANDATORY SPEAKER ORDER (true alternation) ═══\n${patternLine}\n` : ''}

IMPORTANT: The text above is what the avatar MUST say. Split it naturally across ${clipCount} clips.
You may add brief fun intros, reactions, or transitions to make it entertaining, but the user's
original words must appear as dialogue — in order, complete, and unaltered in meaning.

${isDual 
  ? `${primary.name} (A1) and ${secondary!.name} (A2) tell this story TOGETHER as a TWO-HANDER.

TURN-TAKING DISCIPLINE (CRITICAL):
- Speakers ALTERNATE every clip — never two clips in a row by the same character unless the
  MANDATORY SPEAKER ORDER above explicitly says so.
- Every clip's dialogue MUST end on a HAND-OFF: a question, a provocation, an unfinished thought,
  a reaction-bait line, or a name-drop. Fill the "handoffCue" field with that final beat.
- Every clip from clip 2 onward MUST react to the previous speaker's last beat. Fill the
  "respondsTo" field with the specific phrase or idea this clip is responding to.
- A2's first line REDEFINES what A1 just said (interrupt, react, reveal, or contrast).
- Distinct speech patterns: one verbose, one punchy (or one earnest, one sarcastic).
- Plant something small in clip 1, pay it off in the final clip.
- The closer is the moment people SHARE the video.

MANDATORY STRUCTURE (true alternation):
- Follow the MANDATORY SPEAKER ORDER above EXACTLY (default is strict ABABAB).
- Clip 1 (A1): HOOK — say something that demands a response.
- Clip 2 (A2): REFRAME — first line changes the meaning of clip 1.
- Clip 3 (A1): COUNTER — A1 reacts to A2's reframe with a new angle.
- Clip 4 (A2): ESCALATE — A2 raises the stakes or flips the status.
- Clip 5 (A1): PEAK — A1's biggest beat, lands a revelation or twist.
- Clip 6 (A2): PAYOFF — callback to clip 1, devastating one-liner, or quiet closer.

CHEMISTRY CHECKLIST:
□ Do they reference each other across clips? ("Can you believe she said...")
□ Are their speech patterns DISTINCT? (Long sentences vs. fragments)
□ Is there a status shift? (One starts "winning," then it flips)
□ Is there a plant/payoff? (Casual detail in clip 1 → devastating in clip 6)
□ Does the introduction feel EARNED? (Not "Hi, I'm here" but a genuine reaction)
□ Does every clip ≥2 fill respondsTo with the previous speaker's actual line/idea?
□ Does every clip end on a hand-off cue that invites the OTHER speaker to respond?

Each clip renders ONE character. They interact across cuts, not within frames.
Every endPose must match the next clip's startPose for the same character.` 
  : `${primary.name} tells this story directly to camera — intimate, engaging, and memorable.
Split the user's exact text across clips as natural dialogue. You can add a fun hook at the start
or a playful sign-off, but the user's words are the BACKBONE of every clip's dialogue.
Vary energy across clips. Use the space around them. Make it feel ALIVE.`
}

KLING-SPECIFIC REQUIREMENTS:
1. Each clip = ONE continuous action from a still start frame (${clipDuration} seconds)
2. endPose of clip N = startPose of clip N+1 (frame-chaining continuity)
3. For scene changes: end on CLOSE-UP, start new scene with MEDIUM/WIDE
4. Max ${wordsPerClip} words per clip dialogue
5. Actions must be things Kling renders well: gestures, head turns, leaning, reactions, subtle movement
6. AVOID: running, jumping, complex hand manipulation, rapid movements

DIALOGUE RULE: The user's script above is the CORE dialogue. Distribute it across clips naturally.
You may add brief personality — a fun opener, a reaction beat, a cheeky aside — but NEVER remove
or replace the user's original words. Every sentence from their script must appear in the final dialogue.

Make it genuinely ENTERTAINING — add energy, personality, and flair AROUND their words.
Write stage directions that bring their text to LIFE with great performance and timing.

Output ONLY the JSON object. No markdown.`;
}

function parseScreenplayResponse(
  content: string,
  clipCount: number,
  primary: AvatarCharacter,
  secondary?: AvatarCharacter | null,
  parsedTurns?: ParsedTurn[] | null,
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
        respondsTo: s.respondsTo || '',
        handoffCue: s.handoffCue || '',
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
    
    // Enforce dual-avatar pattern. Speaker-tagged turns from the user override the default
    // alternation so explicit "Alice:" / "Bob:" lines map to the right avatar.
    if (secondary && segments.length >= 2) {
      const dualPattern = getDualAvatarPattern(segments.length);
      for (let i = 0; i < segments.length; i++) {
        const tagged = parsedTurns && parsedTurns[i] ? parsedTurns[i].role : null;
        segments[i].avatarRole = tagged || dualPattern[i] || 'primary';
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
 * Default is STRICT ALTERNATION (ABABAB...) so the two avatars genuinely take turns.
 * Special-cases short clip counts so A2 still gets a meaningful entrance.
 */
function getDualAvatarPattern(clipCount: number): Array<'primary' | 'secondary'> {
  const pattern: Array<'primary' | 'secondary'> = [];
  for (let i = 0; i < clipCount; i++) {
    pattern.push(i % 2 === 0 ? 'primary' : 'secondary');
  }
  return pattern;
}

// ─────────────────────────────────────────────────────────────────────────────
// Speaker-tag parser
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedTurn {
  role: 'primary' | 'secondary';
  text: string;
}

/**
 * Parse a user prompt for explicit speaker tags like:
 *   "Alice: Hi there"
 *   "Bob: Hey"
 *   "A: ..."  /  "B: ..."
 *   "Speaker 1: ..."  /  "Speaker 2: ..."
 * Returns null if no tagged turns are detected so the caller can fall back to free-form.
 */
export function parseSpeakerTaggedScript(
  text: string,
  primaryName: string,
  secondaryName: string,
): ParsedTurn[] | null {
  if (!text) return null;
  const lines = text.split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
  // Also split single-line scripts that use inline tags ("Alice: hi  Bob: hey")
  const candidate: string[] = [];
  for (const line of lines) {
    const inline = line.split(/(?=\b(?:[A-Z][a-zA-Z'’\- ]{0,30}|A|B|Speaker\s?[12])\s*:\s)/g)
      .map(s => s.trim()).filter(Boolean);
    if (inline.length > 1) candidate.push(...inline);
    else candidate.push(line);
  }

  const tagRe = /^([A-Za-z][A-Za-z'’\- ]{0,30}|A|B|Speaker\s?[12])\s*[:\-]\s*(.+)$/;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const pName = norm(primaryName);
  const sName = norm(secondaryName);

  const turns: ParsedTurn[] = [];
  let tagged = 0;
  for (const raw of candidate) {
    const m = raw.match(tagRe);
    if (!m) {
      // Untagged line — append to last turn so we don't lose user words.
      if (turns.length) turns[turns.length - 1].text += ' ' + raw;
      continue;
    }
    tagged++;
    const tagRaw = norm(m[1]);
    const body = m[2].trim();
    let role: 'primary' | 'secondary';
    if (tagRaw === pName || tagRaw === 'a' || tagRaw === 'speaker 1' || tagRaw === 'speaker1') {
      role = 'primary';
    } else if (tagRaw === sName || tagRaw === 'b' || tagRaw === 'speaker 2' || tagRaw === 'speaker2') {
      role = 'secondary';
    } else if (pName.startsWith(tagRaw) || tagRaw.startsWith(pName)) {
      role = 'primary';
    } else if (sName.startsWith(tagRaw) || tagRaw.startsWith(sName)) {
      role = 'secondary';
    } else {
      // Unknown speaker tag → strict alternation from previous turn.
      role = turns.length === 0 ? 'primary' : (turns[turns.length - 1].role === 'primary' ? 'secondary' : 'primary');
    }
    turns.push({ role, text: body });
  }

  // Require at least 2 tagged turns AND at least one of each speaker before we trust it.
  if (tagged < 2) return null;
  const hasP = turns.some(t => t.role === 'primary');
  const hasS = turns.some(t => t.role === 'secondary');
  if (!hasP || !hasS) return null;
  return turns;
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
