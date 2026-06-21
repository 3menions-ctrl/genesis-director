/**
 * Crossover registry — fetches from `crossover_browse` RPC and enriches
 * each DB row into a CrossoverBlueprint.
 *
 * Unlike Templates/Environments which are in-memory arrays, crossovers
 * are DB-backed (50 rows in vfx_templates). The registry exposes:
 *   - useAllCrossoverBlueprints()      — React hook, fetches once + caches
 *   - getCrossoverBlueprintFromRow()   — pure mapper (testable)
 *   - findCrossoverBlueprint(list, id) — slug / id lookup helper
 *
 * Enrichment is deterministic — same row in, same blueprint out.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ChromeKind } from "@/components/crossover/ChromePreview";
import type { EngineId } from "@/lib/video/engines";
import { ENGINES } from "@/lib/video/engines";
import type { AspectRatio } from "@/lib/editor/types";
import {
  type CrossoverBlueprint,
  type CrossoverCategory,
  type CrossoverWorld,
  type DiffusionModel,
  type MotionHint,
  type RecipeSlug,
  type SubjectIdMethod,
  MOOD_PRESETS,
} from "./blueprint";

// ─────────────────────────────────────────────────────────────────────────────
// Raw row shape — what `crossover_browse` returns (and what the DB stores)
// ─────────────────────────────────────────────────────────────────────────────
export interface CrossoverRow {
  id: string;
  slug: string;
  name: string;
  category: CrossoverCategory;
  pure_prompt: string;
  negative_prompt?: string | null;
  hook: string | null;
  chrome_kind: ChromeKind;
  aspect_ratio: AspectRatio;
  accepts_subject: boolean;
  accepts_source_video: boolean;
  thumbnail_url: string | null;
  is_featured: boolean;
  is_live?: boolean;
  sort_order?: number | null;

  // Extended (20260616 VFX upgrade) — present on enriched rows
  recipe_slug?: RecipeSlug | string | null;
  motion_hint?: MotionHint | string | null;
  preferred_model?: DiffusionModel | string | null;
  sfx_tags?: string[] | null;
  music_genre?: string | null;
  color_lut?: string | null;
  target_fps?: number | null;
  target_height?: number | null;
  upscale_factor?: number | null;
  interpolate?: boolean | null;
  depth_compositing?: boolean | null;
  subject_id_method?: SubjectIdMethod | string | null;
  particle_density?: number | null;
  use_count?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome → world classifier
// ─────────────────────────────────────────────────────────────────────────────
function classifyWorld(chrome: ChromeKind, category: CrossoverCategory): CrossoverWorld {
  if (chrome === "tiktok" || chrome === "reels" || chrome === "phone") return "phone-vertical";
  if (chrome === "instagram" && category === "vertical_ui") return "phone-vertical";
  if (chrome === "desktop" || chrome === "youtube" || chrome === "netflix" || chrome === "tv" || chrome === "tablet" || chrome === "projector") return "desktop-tv";
  if (chrome === "facebook" || chrome === "instagram") return "social-grid";
  if (chrome === "crt" || chrome === "arcade") return "retro-screen";
  if (chrome === "hologram" || chrome === "radar" || chrome === "oscilloscope" || chrome === "thermal" || chrome === "xray") return "instrument";
  if (chrome === "comic" || chrome === "painting") return "hand-art";
  if (chrome === "mirror") return "metaphysical";
  // Fallback by category
  if (category === "vertical_ui") return "phone-vertical";
  if (category === "desktop_ui")  return "desktop-tv";
  if (category === "social_feed") return "social-grid";
  if (category === "retro_holo")  return "retro-screen";
  return "metaphysical";
}

// ─────────────────────────────────────────────────────────────────────────────
// preferred_model → EngineId mapping
// ─────────────────────────────────────────────────────────────────────────────
function classifyEngine(preferredModel?: string | null): EngineId {
  switch (preferredModel) {
    case "hunyuan-video": return "seedance-2";
    case "cogvideox-5b":  return "kling-v3";
    case "wan-i2v":       return "wan-25";
    case "veo-3":         return "veo-3";
    case "runway-gen4":   return "runway-gen4";
    case "sora-2":        return "sora-2";
    default:              return "kling-v3";
  }
}

function classifyQualityTier(targetHeight?: number | null, targetFps?: number | null): CrossoverBlueprint["qualityTier"] {
  const is60 = (targetFps ?? 0) >= 60;
  const is4k = (targetHeight ?? 0) >= 1800;
  if (is4k && is60) return "4k-cinema-60";
  if (is4k)         return "4k-cinema";
  if (is60)         return "hd-1080-60";
  return "hd-1080";
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost + ETA estimators
// ─────────────────────────────────────────────────────────────────────────────
function estimateDuration(motionHint?: string | null, chromeKind?: ChromeKind): number {
  // Surreal / hand-art tend to need more breathing room
  if (chromeKind === "comic" || chromeKind === "painting") return 8;
  if (motionHint === "spiral_emerge" || motionHint === "morph_solidify") return 8;
  return 5; // default — fits Wan/Seedance/Veo's shortest preset
}

function estimateCredits(engine: EngineId, durationSec: number): number {
  const spec = ENGINES[engine];
  try {
    const supported = spec.durations.includes(durationSec)
      ? durationSec
      : spec.durations.reduce((b, d) => Math.abs(d - durationSec) < Math.abs(b - durationSec) ? d : b, spec.durations[0]);
    return spec.baseCreditsFor(supported);
  } catch {
    return 0;
  }
}

function estimateEta(engine: EngineId, particleDensity?: number | null): number {
  const baseEta = ENGINES[engine].etaSeconds;
  const particleMultiplier = 1 + (particleDensity ?? 0.5) * 0.4;
  return Math.round(baseEta * particleMultiplier);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mood per category — drives the "default" mood per blueprint
// ─────────────────────────────────────────────────────────────────────────────
function defaultMoodForCategory(c: CrossoverCategory): string {
  switch (c) {
    case "vertical_ui": return "viral";
    case "desktop_ui":  return "cinematic";
    case "social_feed": return "viral";
    case "retro_holo":  return "nostalgic";
    case "surreal":     return "dreamy";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tags — derived from chrome + recipe + motion
// ─────────────────────────────────────────────────────────────────────────────
function buildTags(row: CrossoverRow, world: CrossoverWorld): string[] {
  const tags = new Set<string>();
  tags.add(row.category);
  tags.add(world);
  if (row.recipe_slug) tags.add(`recipe:${row.recipe_slug}`);
  if (row.motion_hint) tags.add(`motion:${row.motion_hint}`);
  if (row.accepts_subject) tags.add("subject-ready");
  if (row.accepts_source_video) tags.add("video-ready");
  if (row.music_genre) tags.add(`music:${row.music_genre}`);
  if (row.is_featured) tags.add("featured");
  return Array.from(tags);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC MAPPER — DB row → CrossoverBlueprint
// ─────────────────────────────────────────────────────────────────────────────
export function getCrossoverBlueprintFromRow(row: CrossoverRow): CrossoverBlueprint {
  const world = classifyWorld(row.chrome_kind, row.category);
  const engine = classifyEngine(row.preferred_model);
  const qualityTier = classifyQualityTier(row.target_height, row.target_fps);
  const estimatedDurationSec = estimateDuration(row.motion_hint, row.chrome_kind);
  const estimatedCreditCost = estimateCredits(engine, estimatedDurationSec);
  const estimatedEtaSec = estimateEta(engine, row.particle_density);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    hook: row.hook ?? "",
    purePrompt: row.pure_prompt,
    negativePrompt: row.negative_prompt ?? undefined,
    thumbnailUrl: row.thumbnail_url,

    category: row.category,
    world,
    mood: defaultMoodForCategory(row.category),
    tags: buildTags(row, world),

    isFeatured: row.is_featured,
    isLive: row.is_live ?? true,
    useCount: row.use_count ?? 0,
    sortOrder: row.sort_order ?? undefined,

    chrome: { kind: row.chrome_kind },
    aspectRatio: row.aspect_ratio,

    acceptsSubject: row.accepts_subject,
    acceptsSourceVideo: row.accepts_source_video,
    subjectIdMethod: (row.subject_id_method as SubjectIdMethod) ?? (row.accepts_subject ? "instantid" : "none"),
    subjectTwistMaxChars: 200,

    motionHint: (row.motion_hint as MotionHint) ?? undefined,
    recipeSlug: (row.recipe_slug as RecipeSlug) ?? undefined,
    particleDensity: row.particle_density ?? undefined,
    depthCompositing: row.depth_compositing ?? undefined,
    interpolate: row.interpolate ?? undefined,

    sfxTags: row.sfx_tags ?? undefined,
    musicGenre: row.music_genre ?? undefined,
    colorLut: row.color_lut ?? undefined,

    engine,
    preferredModel: (row.preferred_model as DiffusionModel) ?? undefined,
    qualityTier,
    targetFps: row.target_fps ?? undefined,
    targetHeight: row.target_height ?? undefined,
    upscaleFactor: row.upscale_factor ?? undefined,
    estimatedDurationSec,
    estimatedCreditCost,
    estimatedEtaSec,

    availableMoods: MOOD_PRESETS,
  };
}

export function findCrossoverBlueprint(
  list: CrossoverBlueprint[],
  idOrSlug: string,
): CrossoverBlueprint | undefined {
  return list.find(b => b.id === idOrSlug || b.slug === idOrSlug);
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook — fetches + caches the full enriched list
// ─────────────────────────────────────────────────────────────────────────────
export interface CrossoverFetchState {
  blueprints: CrossoverBlueprint[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches all crossovers via `crossover_browse(null, null)` and enriches.
 * Caches in module-scope so subsequent mounts get an instant render while
 * a background revalidation runs.
 */
let _cache: CrossoverBlueprint[] | null = null;
let _inflight: Promise<CrossoverBlueprint[]> | null = null;

async function fetchAllCrossoverBlueprints(): Promise<CrossoverBlueprint[]> {
  if (_inflight) return _inflight;
  _inflight = (async () => {
    const { data, error } = await supabase.rpc("crossover_browse" as never, {
      p_category: null,
      p_query: null,
    } as never);
    if (error) throw error;
    const rows = (data as unknown as CrossoverRow[]) ?? [];
    const blueprints = rows.map(getCrossoverBlueprintFromRow);
    _cache = blueprints;
    return blueprints;
  })();
  try {
    return await _inflight;
  } finally {
    _inflight = null;
  }
}

export function useAllCrossoverBlueprints(): CrossoverFetchState {
  const [blueprints, setBlueprints] = useState<CrossoverBlueprint[]>(() => _cache ?? []);
  const [loading, setLoading] = useState(_cache === null);
  const [error, setError] = useState<Error | null>(null);

  const run = useMemo(() => async () => {
    setError(null);
    if (_cache === null) setLoading(true);
    try {
      const list = await fetchAllCrossoverBlueprints();
      setBlueprints(list);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load crossovers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchAllCrossoverBlueprints();
        if (!cancelled) {
          setBlueprints(list);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error("Failed to load crossovers"));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { blueprints, loading, error, refetch: run };
}
