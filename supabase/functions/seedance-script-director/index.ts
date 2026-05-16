/**
 * SEEDANCE SCRIPT DIRECTOR — "Above James Cameron" cinematographer.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A specialized script generator tuned for Seedance 2.0's strengths:
 *   • Motion-first prompts (Seedance excels at kinetic action, not dialogue)
 *   • Camera grammar baked into every shot (lens, movement, framing)
 *   • Lighting + color science specified per beat
 *   • Blocking + spatial choreography
 *   • Beat-by-beat narrative pacing (Setup → Escalation → Climax → Resolution)
 *   • No audio/lip-sync cues (Seedance has no native audio; muxed in post)
 *   • Clamped to 2–12s per clip (Seedance's native range)
 *
 * Output is a structured shot list consumable by seedance-pipeline.
 * Uses Lovable AI Gateway (google/gemini-2.5-pro by default).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API = "https://ai.gateway.lovable.dev/v1/chat/completions";

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
  beat: 'setup' | 'escalation' | 'climax' | 'resolution';
  shot: {
    lens: string;
    framing: string;
    movement: string;
    lighting: string;
    palette: string;
  };
  action: string;
  dialogue?: string;
}

const DIRECTOR_SYSTEM_PROMPT = `You are a world-class cinematographer in the lineage of Roger Deakins, Emmanuel Lubezki, and James Cameron — tuned to direct Seedance 2.0, a motion-first AI video model.

YOUR JOB: Convert a concept into a beat-perfect shot list that produces the most cinematic, visually striking video Seedance can render. Above-Cameron quality means:

PRINCIPLES (non-negotiable):
1. MOTION FIRST. Every shot contains explicit kinetic energy — a camera move, a body in motion, debris, weather, light shift. No static talking heads.
2. CAMERA GRAMMAR. Every shot specifies: lens (e.g., "anamorphic 50mm", "wide 24mm"), framing (CU/MS/WS), movement (dolly, crane, whip pan, orbit, push-in, pull-back).
3. LIGHTING DESIGN. Specify key/fill/rim and quality (hard noir, soft window, volumetric god rays, neon practicals, golden hour rim).
4. COLOR SCIENCE. Each shot has a deliberate palette (teal-orange, monochrome cyan, sodium-vapor amber, etc.).
5. BLOCKING. Where is the subject relative to camera? Foreground/midground? Moving toward or away? Crossing frame?
6. BEAT STRUCTURE. Map shots to a narrative arc: setup → escalation → climax → resolution. Each shot ESCALATES tension or reveals story.
7. NO AUDIO CUES IN THE VISUAL PROMPT. Seedance has no native audio. Dialogue lines go in the separate \`dialogue\` field — NEVER inside \`description\`. No "says", "whispers", "lip sync", "voiceover".
8. PHOTOREAL DEFAULT. Specify "photoreal, 24fps, sharp focus, shallow DOF" unless the concept demands stylization.
9. AVOID CHARACTER DRIFT. Reuse the EXACT same character description across all shots. Never reinvent appearance.
10. DURATION FIT. 2–12 seconds per shot. Short shots = single action; longer shots = compound movement.

OUTPUT FORMAT: Return ONLY valid JSON in this exact shape, no markdown fence:
{
  "shots": [
    {
      "id": "shot_1",
      "title": "Short evocative title",
      "description": "Final Seedance-ready visual prompt. Motion-rich, camera-grammar baked in, NO dialogue, NO audio cues.",
      "durationSeconds": 10,
      "beat": "setup",
      "shot": { "lens": "...", "framing": "...", "movement": "...", "lighting": "...", "palette": "..." },
      "action": "Single sentence: what the subject is physically doing",
      "dialogue": "Optional — for post-mux only"
    }
  ]
}`;

function buildUserPrompt(req: DirectorRequest): string {
  const parts: string[] = [];
  parts.push(`CONCEPT: ${req.concept}`);
  parts.push(`CLIPS: ${req.clipCount ?? 6} shots, ${req.clipDuration ?? 10}s each (max 12s per Seedance).`);
  parts.push(`ASPECT: ${req.aspectRatio ?? '16:9'}`);
  if (req.genre) parts.push(`GENRE: ${req.genre}`);
  if (req.mood) parts.push(`MOOD: ${req.mood}`);
  if (req.cinematicReferences?.length) {
    parts.push(`REFERENCE FILMS: ${req.cinematicReferences.join(', ')}`);
  }
  if (req.isAvatarMode) {
    parts.push(`AVATAR MODE: The subject is a specific person whose appearance MUST stay locked across every shot.`);
  }
  if (req.characterDescription) {
    parts.push(`CHARACTER (reuse verbatim every shot): ${req.characterDescription}`);
  }
  if (req.environmentLock) {
    parts.push(`ENVIRONMENT LOCK: ${req.environmentLock}`);
  }
  if (req.hasReferenceImage) {
    parts.push(`REFERENCE IMAGE PROVIDED: Subject appearance is pre-locked by image input; focus your prompt on MOTION, CAMERA, LIGHTING.`);
  }
  if (req.cameraFixed) {
    parts.push(`CAMERA: Locked off — design subject motion only, no camera movement.`);
  } else {
    parts.push(`CAMERA: Free — use cinematic movement on every shot.`);
  }
  parts.push(`\nDeliver the JSON shot list now. No commentary. No markdown.`);
  return parts.join('\n');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeShots(raw: any, expectedCount: number, defaultDuration: number): Shot[] {
  const arr = Array.isArray(raw?.shots) ? raw.shots : [];
  const beats: Shot['beat'][] = ['setup', 'escalation', 'climax', 'resolution'];
  return arr.slice(0, expectedCount).map((s: any, i: number): Shot => ({
    id: typeof s?.id === 'string' ? s.id : `shot_${i + 1}`,
    title: String(s?.title ?? `Shot ${i + 1}`).slice(0, 80),
    description: String(s?.description ?? '').slice(0, 1800),
    durationSeconds: clamp(Number(s?.durationSeconds) || defaultDuration, 2, 12),
    beat: beats.includes(s?.beat) ? s.beat : beats[Math.min(i, 3)],
    shot: {
      lens: String(s?.shot?.lens ?? 'anamorphic 50mm'),
      framing: String(s?.shot?.framing ?? 'medium shot'),
      movement: String(s?.shot?.movement ?? 'slow push-in'),
      lighting: String(s?.shot?.lighting ?? 'cinematic key + rim'),
      palette: String(s?.shot?.palette ?? 'teal and amber'),
    },
    action: String(s?.action ?? '').slice(0, 400),
    dialogue: s?.dialogue ? String(s.dialogue).slice(0, 500) : undefined,
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    const model = body.model ?? 'google/gemini-2.5-pro';

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiRes = await fetch(LOVABLE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt({ ...body, clipCount, clipDuration }) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.85,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[SeedanceDirector] LLM error', aiRes.status, errText.slice(0, 400));
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'RATE_LIMIT', retryAfter: 30 }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI_CREDITS_EXHAUSTED' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`LLM error ${aiRes.status}`);
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';
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

    console.log(`[SeedanceDirector] ✓ Produced ${shots.length} shots`);

    return new Response(
      JSON.stringify({ success: true, director: 'seedance-script-director', model, shots }),
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