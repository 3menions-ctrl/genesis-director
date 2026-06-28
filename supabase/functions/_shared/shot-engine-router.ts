/**
 * shot-engine-router — pure per-shot engine scorer.
 *
 * Scores each shot against every video engine using the capability matrix
 * (engines.ts) plus qualitative routing knowledge, and returns the best engine
 * per shot with human-readable reasons. No side effects, no framework imports —
 * runs identically in the browser and in Deno edge functions.
 *
 * ⚠️ MIRROR: supabase/functions/_shared/shot-engine-router.ts must stay in sync.
 */

export type EngineToken = 'wan' | 'kling' | 'seedance' | 'veo' | 'runway' | 'sora';

export interface EngineCap {
  token: EngineToken;
  label: string;
  tier: 'standard' | 'pro' | 'cinema';
  audio: boolean;          // native audio capable
  lipSync: boolean;        // native dialogue lip-sync (kling)
  durations: number[];
  maxDuration: number;
  continuityChain: boolean;
  character: number;       // 0..10 identity-consistency strength
  motion: number;          // 0..10 motion dynamics / realism
  realism: number;         // 0..10 photoreal / complex-scene coherence
  eta: number;             // seconds (lower = faster)
  costRank: number;        // 1 cheapest .. 6 priciest
}

// Derived from _shared/engines.ts capability flags + tuned routing knowledge.
export const ENGINE_CAPS: Record<EngineToken, EngineCap> = {
  wan:      { token: 'wan',      label: 'Wan 2.5',      tier: 'standard', audio: false, lipSync: false, durations: [5, 10],     maxDuration: 10, continuityChain: true,  character: 4,  motion: 5, realism: 5,  eta: 110, costRank: 1 },
  kling:    { token: 'kling',    label: 'Kling V3',     tier: 'standard', audio: true,  lipSync: true,  durations: [5, 10, 15], maxDuration: 15, continuityChain: true,  character: 6,  motion: 6, realism: 6,  eta: 90,  costRank: 3 },
  seedance: { token: 'seedance', label: 'Seedance 2.0', tier: 'pro',      audio: true,  lipSync: false, durations: [5, 10, 12], maxDuration: 12, continuityChain: true,  character: 6,  motion: 9, realism: 7,  eta: 100, costRank: 4 },
  veo:      { token: 'veo',      label: 'Veo 3',        tier: 'cinema',   audio: true,  lipSync: false, durations: [4, 6, 8],   maxDuration: 8,  continuityChain: true,  character: 7,  motion: 8, realism: 8,  eta: 120, costRank: 4 },
  runway:   { token: 'runway',   label: 'Runway Gen-4', tier: 'cinema',   audio: false, lipSync: false, durations: [5, 10],     maxDuration: 10, continuityChain: false, character: 10, motion: 7, realism: 8,  eta: 150, costRank: 4 },
  sora:     { token: 'sora',     label: 'Sora 2',       tier: 'cinema',   audio: true,  lipSync: false, durations: [4, 8, 12],  maxDuration: 12, continuityChain: true,  character: 8,  motion: 8, realism: 10, eta: 360, costRank: 6 },
};

const CINEMA: EngineToken[] = ['veo', 'runway', 'sora'];

export interface ShotForRouting {
  index: number;
  durationSeconds?: number;
  dialogue?: string | null;
  sceneType?: string | null;
  cameraScale?: string | null;
  movementType?: string | null;
  motionDirection?: string | null;
  mood?: string | null;
  hasCharacters?: boolean;
  visualAnchors?: string[] | null;
}

export interface EngineScore { token: EngineToken; label: string; score: number; reasons: string[]; }
export interface ShotRouting {
  index: number;
  engine: EngineToken;
  engineLabel: string;
  score: number;
  reasons: string[];
  ranked: EngineScore[];
}

export interface RouteOptions {
  /** When false, cinema-tier engines (veo/runway/sora) are excluded (entitlement). */
  allowCinema?: boolean;
}

function hasHeavyMotion(s: ShotForRouting): boolean {
  const m = `${s.movementType ?? ''} ${s.motionDirection ?? ''}`.toLowerCase();
  return /track|dolly|crane|handheld|whip|pan|tilt|orbit|follow|chase|run/.test(m);
}
function isCharacterShot(s: ShotForRouting): boolean {
  if (s.hasCharacters) return true;
  const scale = (s.cameraScale ?? '').toLowerCase();
  return /close|two-shot|over-shoulder|medium/.test(scale) && !!(s.dialogue && s.dialogue.trim());
}
function isDialogue(s: ShotForRouting): boolean {
  return !!(s.dialogue && s.dialogue.trim().length > 1);
}

export function scoreShot(shot: ShotForRouting, opts: RouteOptions = {}): ShotRouting {
  const allowCinema = opts.allowCinema !== false;
  const pool = (Object.keys(ENGINE_CAPS) as EngineToken[]).filter(
    (t) => allowCinema || !CINEMA.includes(t),
  );
  const dur = shot.durationSeconds ?? 5;
  const dialogue = isDialogue(shot);
  const heavyMotion = hasHeavyMotion(shot);
  const charShot = isCharacterShot(shot);
  const cinematic = /photoreal|realistic|cinematic|drama|epic|tense|noir/.test((shot.mood ?? '').toLowerCase());

  const ranked: EngineScore[] = pool.map((token) => {
    const cap = ENGINE_CAPS[token];
    let score = 50; // baseline
    const reasons: string[] = [];

    // Kling is the reliable default — a small nudge.
    if (token === 'kling') score += 4;

    // Dialogue → audio + lip-sync.
    if (dialogue) {
      if (cap.lipSync) { score += 18; reasons.push('native lip-sync for dialogue'); }
      else if (cap.audio) { score += 8; reasons.push('native audio for dialogue'); }
      else { score -= 18; reasons.push('no audio for a dialogue shot'); }
    }

    // Character consistency.
    if (charShot) {
      score += (cap.character - 6) * 4;
      if (cap.character >= 9) reasons.push('best-in-class character consistency');
    }

    // Motion dynamics.
    if (heavyMotion) {
      score += (cap.motion - 6) * 4;
      if (cap.motion >= 9) reasons.push('superior motion dynamics');
    }

    // Photoreal / cinematic mood.
    if (cinematic) {
      score += (cap.realism - 6) * 3;
      if (cap.realism >= 9) reasons.push('photoreal scene coherence');
    }

    // Duration fit — penalize engines that can't reach the shot length.
    if (dur > cap.maxDuration) {
      score -= (dur - cap.maxDuration) * 6;
      reasons.push(`caps at ${cap.maxDuration}s (shot is ${dur}s)`);
    } else if (cap.durations.includes(dur)) {
      score += 3;
    }

    // Continuity chaining helps multi-shot consistency.
    if (!cap.continuityChain) score -= 4;

    // Tie-breakers — faster + cheaper slightly preferred.
    score += (6 - cap.costRank) * 0.6;
    score += (360 - cap.eta) / 120;

    return { token, label: cap.label, score: Math.round(score), reasons };
  });

  ranked.sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  return {
    index: shot.index,
    engine: winner.token,
    engineLabel: winner.label,
    score: winner.score,
    reasons: winner.reasons.length ? winner.reasons : ['balanced fit for this shot'],
    ranked,
  };
}

export function routeShots(shots: ShotForRouting[], opts: RouteOptions = {}): ShotRouting[] {
  return shots.map((s) => scoreShot(s, opts));
}
