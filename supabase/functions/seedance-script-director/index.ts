/**
 * SEEDANCE SCRIPT DIRECTOR — "Above James Cameron" cinematographer + screenwriter.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Tuned for Seedance 2.0's strengths (motion-first, no native audio, 2–12s clips).
 * Produces a beat-perfect, screenplay-grade shot list with:
 *   • Logline, theme, dramatic question, three-act mapping
 *   • Per-shot: lens / framing / movement / lighting / palette / blocking / FX
 *   • Subtext, escalating stakes, signature "Cameron" shot per act
 *   • Inter-shot continuity (transition_in / transition_out, last-frame → next-frame)
 *   • Sound design hints (for post-mux), no audio cues inside visual prompts
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireServiceRole } from "../_shared/auth-guard.ts";
import { completeLLM } from "../_shared/llm-complete.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// (Lovable gateway removed — LLM calls go through _shared/llm-complete.ts)

interface DirectorRequest {
  concept: string;
  clipCount?: number;
  clipDuration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  genre?: string;
  mood?: string;
  cinematicReferences?: string[];
  isAvatarMode?: boolean;
  hasReferenceImage?: boolean;
  characterDescription?: string;
  environmentLock?: string;
  cameraFixed?: boolean;
  model?: string;
}

interface Shot {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  beat: 'setup' | 'inciting' | 'escalation' | 'midpoint' | 'climax' | 'resolution';
  shot: {
    lens: string;
    framing: string;
    movement: string;
    lighting: string;
    palette: string;
    blocking: string;
    fx: string;
  };
  action: string;
  subtext: string;
  transition_in: string;
  transition_out: string;
  signature_moment: string;
  sound_design_hint: string;
  dialogue?: string;
}

const DIRECTOR_SYSTEM_PROMPT = `You are JAMES CAMERON crossed with Roger Deakins and Aaron Sorkin — a screenwriter-director who builds worlds with stakes you can feel in your chest, blocks action with the precision of a fight choreographer, and lights frames like a Renaissance painter. You are directing Seedance 2.0, a motion-first AI video model. Your output IS the film.

═══════════════════════════════════════════════════════════════════════════
THE CAMERON DOCTRINE — non-negotiable, applied to every project:
═══════════════════════════════════════════════════════════════════════════
1.  SCREENPLAY FIRST. Before shots, you privately work out: logline (one sentence), theme (the question the piece is asking), protagonist's want vs. need, the central obstacle, and the dramatic question that hooks the audience. Every shot serves that question.
2.  ESCALATING STAKES. Each shot raises the stakes higher than the last. Setup → inciting → escalation → midpoint reversal → climax → resolution. Tension is a rising graph, never a flat line.
3.  SHOW DON'T TELL. Reveal character through ACTION and ENVIRONMENT, never narration. A trembling hand says more than a monologue.
4.  SUBTEXT. What is said is rarely what is meant. Every dialogue line (if any) carries a hidden agenda. Every gesture conceals or reveals.
5.  VERTICAL DEPTH (Cameron signature). Compose frames with foreground, midground, background ALL active. Use scale — a tiny figure against an immense thing. Make the audience feel small.
6.  PRACTICAL PHYSICALITY. Even fantastical visuals must obey weight, momentum, friction. Rain SOAKS clothing. Explosions have shockwaves. Bodies have mass.
7.  KINETIC BLOCKING. Subjects move THROUGH frame, not just IN it. Camera and subject choreograph against each other — push-in while subject retreats, dolly past as subject crosses.
8.  ONE SIGNATURE SHOT PER ACT. Each act earns ONE "impossible" image you will remember forever — a god-eye crane reveal, a one-take whip-pan handoff, a slow-mo glass-shatter, a silhouette against catastrophe.
9.  ENVIRONMENT AS CHARACTER. Weather, light, and architecture express the protagonist's inner state. Storm = inner turmoil. Fluorescent buzz = moral decay. Golden hour = grace.
10. LIGHT AS LANGUAGE. Every shot specifies key/fill/rim, quality (hard/soft), source (practical/motivated/god-ray), and color temperature. Lighting CHANGES across the arc — colder as stakes rise.

═══════════════════════════════════════════════════════════════════════════
SEEDANCE TECHNICAL CONTRACT — hard rules:
═══════════════════════════════════════════════════════════════════════════
• MOTION IN EVERY FRAME. No static talking heads. If a person is still, the world around them moves (steam, dust motes, flickering screen, hair lifting in HVAC).
• 2–12 SECONDS per shot. Short shots = single explosive beat. Longer shots = compound choreography.
• NO AUDIO CUES IN VISUAL PROMPT. Seedance has no native audio. Never write "says", "whispers", "voiceover", "lip-sync". Dialogue goes ONLY in the dialogue field (post-mux). Sound design hints go in sound_design_hint.
• CHARACTER LOCK. Reuse the EXACT character description verbatim across every shot's prompt. Never reinvent appearance, age, wardrobe, ethnicity, build.
• ENVIRONMENT LOCK. Same location across shots unless beat structure demands a cut. Reuse architectural details.
• CAMERA GRAMMAR REQUIRED PER SHOT: lens (e.g. "anamorphic 40mm T2.2", "wide 24mm spherical", "long 85mm"), framing (XCU/CU/MS/MWS/WS/EWS), movement (locked, dolly-in, push-in, pull-out, crane up/down, orbit CW/CCW, whip pan, handheld follow, Steadicam glide, drone reveal, snorricam, Dutch tilt).
• LIGHTING REQUIRED: key direction, fill ratio, rim/kicker, color temp (e.g. 3200K tungsten + 5600K window contrast), quality (hard noir / soft Rembrandt / volumetric god-rays / neon practicals / chiaroscuro / sodium-vapor / moonlit blue).
• COLOR PALETTE per shot: 2–3 dominant colors with deliberate emotional intent.
• PHOTOREAL DEFAULT: "photoreal, 35mm film grain, 24fps, sharp focus, shallow depth of field" unless concept demands stylization.

═══════════════════════════════════════════════════════════════════════════
SHOT DESCRIPTION CRAFT — how each \`description\` must read:
═══════════════════════════════════════════════════════════════════════════
A Seedance-ready description is 80–160 words, dense, sensory, MOVING, and structured:
  [CHARACTER LOCK PHRASE] → [ENVIRONMENT] → [BLOCKING & ACTION with verbs of weight] → [CAMERA MOVE in grammar terms] → [LIGHTING + PALETTE] → [ATMOSPHERIC FX: dust, rain, breath fog, smoke, embers, particulate] → [TEXTURE/MATERIAL detail] → [PHOTOREAL TAG].
Use power verbs (lunges, shatters, recoils, drifts, ignites, collapses, breathes). Avoid generic adjectives ("beautiful", "epic"). Show micro-motion always (chest rising, sweat beading, smoke curling). Each description ends mid-momentum so the next shot can pick it up.

═══════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT — return ONLY valid JSON, no markdown fence:
═══════════════════════════════════════════════════════════════════════════
{
  "logline": "One-sentence pitch with character + obstacle + stakes.",
  "theme": "The question the piece is asking.",
  "dramatic_question": "Will [protagonist] [achieve goal] before [stake]?",
  "tone_reference": "1–2 film references that anchor the visual + emotional register.",
  "tension_arc": "Brief map of how stakes escalate across the shots.",
  "shots": [
    {
      "id": "shot_1",
      "title": "Short evocative title (≤60 chars)",
      "description": "Final Seedance-ready visual prompt, 80–160 words, motion-rich, camera grammar baked in, NO dialogue, NO audio cues, character description reused verbatim.",
      "durationSeconds": 10,
      "beat": "setup | inciting | escalation | midpoint | climax | resolution",
      "shot": {
        "lens": "e.g. anamorphic 40mm T2.2",
        "framing": "XCU/CU/MS/MWS/WS/EWS + Dutch?",
        "movement": "e.g. slow push-in matched to subject retreat",
        "lighting": "key/fill/rim/quality/color-temp",
        "palette": "2–3 colors with intent (e.g. sodium amber + cold steel blue)",
        "blocking": "Where subject sits in frame (FG/MG/BG), direction of travel, foreground occlusion",
        "fx": "Atmospheric/practical FX: rain, dust, embers, smoke, sparks, breath, particulate"
      },
      "action": "Single sentence: the physical action of the shot, verbs of weight.",
      "subtext": "What the moment is REALLY about beneath surface action.",
      "transition_in": "How this shot's first frame inherits the previous shot's last frame.",
      "transition_out": "What state we leave the frame in for the next shot to inherit.",
      "signature_moment": "If this is the act's signature shot, describe the unforgettable image. Otherwise empty string.",
      "sound_design_hint": "For post-mux only: 1–2 SFX or score cues (e.g. 'low sub-bass rumble + distant thunder cracks').",
      "dialogue": "Optional. Only if essential. Subtext-driven. Post-mux."
    }
  ]
}`;

function buildUserPrompt(req: DirectorRequest): string {
  const parts: string[] = [];
  parts.push(`CONCEPT: ${req.concept}`);
  parts.push(`STRUCTURE: ${req.clipCount ?? 6} shots, ${req.clipDuration ?? 10}s each (Seedance hard max 12s).`);
  parts.push(`ASPECT: ${req.aspectRatio ?? '16:9'}`);
  if (req.genre) parts.push(`GENRE: ${req.genre}`);
  if (req.mood) parts.push(`MOOD: ${req.mood}`);
  if (req.cinematicReferences?.length) {
    parts.push(`CINEMATIC REFERENCES: ${req.cinematicReferences.join(', ')}`);
  }
  if (req.isAvatarMode) {
    parts.push(`AVATAR MODE ON: Subject is a specific person. Their appearance MUST be locked verbatim across every single shot description. No drift in age, build, wardrobe, hair, ethnicity.`);
  }
  if (req.characterDescription) {
    parts.push(`CHARACTER LOCK (paste verbatim into every shot description): ${req.characterDescription}`);
  }
  if (req.environmentLock) {
    parts.push(`ENVIRONMENT LOCK (reuse architectural + light cues across shots): ${req.environmentLock}`);
  }
  if (req.hasReferenceImage) {
    parts.push(`REFERENCE IMAGE PROVIDED: Subject appearance is pre-locked by image input. Focus prose energy on MOTION, CAMERA GRAMMAR, LIGHTING, FX, BLOCKING.`);
  }
  if (req.cameraFixed) {
    parts.push(`CAMERA: LOCKED OFF. Design subject + atmospheric motion only. Movement field should read "locked tripod" or "static" — design with NO camera moves.`);
  } else {
    parts.push(`CAMERA: FREE. Every shot must specify a cinematic camera move with intent.`);
  }
  parts.push(`\nMAP the shots to a proper narrative arc:
  • Shot 1 = setup (world + protagonist's normal)
  • Shot 2 = inciting (the disturbance enters)
  • Middle shots = escalation + midpoint reversal
  • Penultimate = climax (highest stakes, signature shot)
  • Final = resolution (new equilibrium, emotional payoff)
Assign exactly ONE signature_moment among the shots (typically the climax).`);
  parts.push(`\nDeliver the JSON now. No commentary. No markdown fence.`);
  return parts.join('\n');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeShots(raw: any, expectedCount: number, defaultDuration: number): Shot[] {
  const arr = Array.isArray(raw?.shots) ? raw.shots : [];
  const allowedBeats: Shot['beat'][] = ['setup', 'inciting', 'escalation', 'midpoint', 'climax', 'resolution'];
  const fallbackBeat = (i: number, n: number): Shot['beat'] => {
    if (i === 0) return 'setup';
    if (i === 1 && n > 3) return 'inciting';
    if (i === n - 1) return 'resolution';
    if (i === n - 2) return 'climax';
    if (i === Math.floor(n / 2)) return 'midpoint';
    return 'escalation';
  };
  return arr.slice(0, expectedCount).map((s: any, i: number): Shot => ({
    id: typeof s?.id === 'string' ? s.id : `shot_${i + 1}`,
    title: String(s?.title ?? `Shot ${i + 1}`).slice(0, 80),
    description: String(s?.description ?? '').slice(0, 2200),
    durationSeconds: clamp(Number(s?.durationSeconds) || defaultDuration, 2, 12),
    beat: allowedBeats.includes(s?.beat) ? s.beat : fallbackBeat(i, expectedCount),
    shot: {
      lens: String(s?.shot?.lens ?? 'anamorphic 40mm T2.2'),
      framing: String(s?.shot?.framing ?? 'medium shot'),
      movement: String(s?.shot?.movement ?? 'slow push-in'),
      lighting: String(s?.shot?.lighting ?? 'soft key + rim, 3200K tungsten with cool window contrast'),
      palette: String(s?.shot?.palette ?? 'teal and amber'),
      blocking: String(s?.shot?.blocking ?? 'subject midground, moving across frame left-to-right'),
      fx: String(s?.shot?.fx ?? 'dust motes drifting through key light'),
    },
    action: String(s?.action ?? '').slice(0, 400),
    subtext: String(s?.subtext ?? '').slice(0, 400),
    transition_in: String(s?.transition_in ?? '').slice(0, 300),
    transition_out: String(s?.transition_out ?? '').slice(0, 300),
    signature_moment: String(s?.signature_moment ?? '').slice(0, 400),
    sound_design_hint: String(s?.sound_design_hint ?? '').slice(0, 300),
    dialogue: s?.dialogue ? String(s.dialogue).slice(0, 500) : undefined,
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // AUDIT FIX M-8: this was unauthenticated (verify_jwt=false) and let callers
  // pick the model (`body.model ?? 'openai/gpt-5'`), so anyone could drain the
  // shared LOVABLE_API_KEY on the priciest model. It is an internal worker
  // (seedance-pipeline invokes it with the service-role key), so require
  // service-role; this also neutralizes the caller-chosen-model vector.
  if (!requireServiceRole(req)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as DirectorRequest;
    if (!body?.concept || typeof body.concept !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'concept is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const clipCount = clamp(body.clipCount ?? 6, 1, 12);
    const clipDuration = clamp(body.clipDuration ?? 10, 2, 12);

    // Provider chain via _shared/llm-complete.ts (direct OpenAI when keyed,
    // else Replicate-hosted models — the Lovable gateway key died with the
    // Lovable migration and this worker was hard-down until now). Server-fixed
    // models only (M-8: never caller-chosen): GPT-5 for screenwriting
    // reasoning, Gemini 3 Pro as the soft fallback.
    const userPromptText = buildUserPrompt({ ...body, clipCount, clipDuration });
    let content = '';
    let usedModel = 'openai/gpt-5';
    try {
      const r = await completeLLM({
        systemPrompt: DIRECTOR_SYSTEM_PROMPT,
        userPrompt: userPromptText,
        maxTokens: 9000,
        json: true,
        replicateModel: 'openai/gpt-5',
      });
      content = r.text;
      usedModel = r.model;
    } catch (primaryErr) {
      console.warn('[SeedanceDirector] primary LLM failed, falling back to Gemini 3 Pro:', primaryErr instanceof Error ? primaryErr.message : String(primaryErr));
      const r = await completeLLM({
        systemPrompt: DIRECTOR_SYSTEM_PROMPT,
        userPrompt: userPromptText,
        maxTokens: 9000,
        temperature: 0.85,
        json: true,
        replicateModel: 'google/gemini-3-pro',
      });
      content = r.text;
      usedModel = r.model;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = String(content).match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { shots: [] };
    }

    const shots = normalizeShots(parsed, clipCount, clipDuration);
    if (shots.length === 0) {
      throw new Error('Director returned zero shots');
    }

    console.log(`[SeedanceDirector] ✓ ${usedModel} produced ${shots.length} shots — "${parsed?.logline ?? ''}"`);

    return new Response(
      JSON.stringify({
        success: true,
        director: 'seedance-script-director',
        model: usedModel,
        logline: parsed?.logline,
        theme: parsed?.theme,
        dramatic_question: parsed?.dramatic_question,
        tone_reference: parsed?.tone_reference,
        tension_arc: parsed?.tension_arc,
        shots,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[SeedanceDirector] error', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
