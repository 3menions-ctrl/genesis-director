/**
 * executeBreakthroughRender — drives a `RenderPlan` against the REAL backend.
 *
 * Walks the plan DAG and invokes the existing Supabase edge functions in
 * dependency order, resolving each step's `@handle` outputs to concrete URLs,
 * then calls `seamless-stitcher` in breakthrough mode to composite the four
 * layers into the final video.
 *
 *   gen-image   → generate-scene-images   → @chrome / @*Start
 *   gen-video   → generate-video          → @innerVideo / @subjectRaw / @aftermath
 *   matte-video → composite-character / video-matte / (chromakey passthrough)
 *   gen-sfx     → generate-sfx            → @sfxBreak
 *   composite   → seamless-stitcher       → @final
 *
 * `invoke` is injected (defaults to supabase.functions.invoke) so the whole
 * orchestration is unit-testable without a live backend.
 */

import type { RenderPlan, RenderStep } from "./renderPlan";
import { compileRenderPlan } from "./renderPlan";
import type { ResolveOptions } from "./compositor";
import type { NormRect, TemplateDefinition } from "./schema";

/** Minimal shape of supabase.functions.invoke we depend on. */
export type InvokeFn = (
  name: string,
  opts: { body: unknown },
) => Promise<{ data: unknown; error: { message: string } | null }>;

export interface ExecuteOptions extends ResolveOptions {
  invoke?: InvokeFn;
  namespaceId?: string;
  onProgress?: (ev: { step: RenderStep; index: number; total: number; url?: string }) => void;
}

/** The wire payload `seamless-stitcher`'s breakthrough mode expects. Kept as a
 *  local structural type so app code never imports the Deno `_shared` module. */
export interface BreakthroughStitchPayload {
  aspectRatio?: string;
  durationSec: number;
  chromeUrl: string;
  innerUrl: string;
  subjectUrl: string;
  aftermathUrl?: string;
  mediaWindow: NormRect;
  mask: {
    shape: string;
    region: NormRect;
    featherPx?: number;
    openStartSec: number;
    openEndSec: number;
  };
  motion: { property: string; at: number; value: number }[];
  subjectActiveFromSec: number;
  subjectActiveToSec: number;
  aftermathFromSec?: number;
  chromakey?: { color: string; similarity?: number; blend?: number };
  sfx?: { url: string; atSec: number };
  namespaceId?: string;
  templateId?: string;
}

const EDGE_PAYLOAD_URL_FIELDS = ["video_url", "videoUrl", "url", "imageUrl", "image_url", "signedUrl"];

/** Pull a usable URL out of an edge function's (loosely-typed) response. */
function extractUrl(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const f of EDGE_PAYLOAD_URL_FIELDS) {
      if (typeof obj[f] === "string") return obj[f] as string;
    }
    // some image fns return { images: [url] }
    if (Array.isArray(obj.images) && typeof obj.images[0] === "string") {
      return obj.images[0] as string;
    }
  }
  return null;
}

async function defaultInvoke(name: string, opts: { body: unknown }) {
  // Lazy import so test/SSR contexts that inject `invoke` never load the client.
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase.functions.invoke(name, opts) as ReturnType<InvokeFn>;
}

export interface RenderResult {
  videoUrl: string;
  plan: RenderPlan;
  /** Resolved @handle → URL map for every step (debugging / re-use). */
  handles: Record<string, string>;
}

export async function executeBreakthroughRender(
  def: TemplateDefinition,
  opts: ExecuteOptions = {},
): Promise<RenderResult> {
  const invoke = opts.invoke ?? defaultInvoke;
  const plan = compileRenderPlan(def, { audioCue: opts.audioCue });
  const handles: Record<string, string> = {};

  const invokeUrl = async (fn: string, body: unknown, step: RenderStep): Promise<string> => {
    const { data, error } = await invoke(fn, { body });
    if (error) throw new Error(`[${step.id}] ${fn} failed: ${error.message}`);
    const url = extractUrl(data);
    if (!url) throw new Error(`[${step.id}] ${fn} returned no URL`);
    return url;
  };

  // Resolve "@handle" references inside a step's input payload to real URLs.
  const resolve = (v: unknown): unknown => {
    if (typeof v === "string" && v.startsWith("@")) return handles[v] ?? v;
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, resolve(val)]));
    }
    return v;
  };

  const composite = plan.steps.find((s) => s.op === "composite")!;
  const total = plan.steps.length;

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    let url: string | undefined;

    switch (step.op) {
      case "gen-image":
      case "gen-video":
      case "gen-sfx":
        url = await invokeUrl(step.edgeFunction, resolve(step.input), step);
        handles[step.produces] = url;
        break;

      case "matte-video": {
        const strategy = (step.input as { strategy?: string }).strategy;
        if (strategy === "chromakey" || strategy === "none") {
          // chromakey is applied inside the final FFmpeg command — alias the
          // raw subject through so the composite consumes it directly.
          const src = (step.input as { source?: string }).source ?? "@subjectRaw";
          handles[step.produces] = handles[src] ?? src;
          url = handles[step.produces];
        } else {
          url = await invokeUrl(step.edgeFunction, resolve(step.input), step);
          handles[step.produces] = url;
        }
        break;
      }

      case "composite": {
        const payload = buildStitchPayload(def, plan, handles, opts.namespaceId);
        url = await invokeUrl("seamless-stitcher", { breakthrough: payload }, step);
        handles[step.produces] = url;
        break;
      }
    }

    opts.onProgress?.({ step, index: i, total, url });
  }

  const videoUrl = handles[composite.produces];
  if (!videoUrl) throw new Error("[breakthrough] composite produced no video URL");
  return { videoUrl, plan, handles };
}

/** Assemble the seamless-stitcher breakthrough payload from resolved handles. */
function buildStitchPayload(
  def: TemplateDefinition,
  plan: RenderPlan,
  handles: Record<string, string>,
  namespaceId?: string,
): BreakthroughStitchPayload {
  const scene = plan.scene;
  const isChroma = plan.strategy.matting === "chromakey";
  const sfxHandle = handles["@sfxBreak"];

  const motion = scene.layers
    .find((l) => l.kind === "breakthrough")
    ?.keyframes?.map((k) => ({ property: k.property, at: k.at, value: k.value })) ?? [];

  const region = scene.mask.region ?? def.container.mediaWindow;

  return {
    aspectRatio: plan.aspectRatio,
    durationSec: plan.durationSec,
    chromeUrl: handles["@chrome"],
    innerUrl: handles["@innerVideo"],
    subjectUrl: handles["@subjectAlpha"],
    aftermathUrl: handles["@aftermath"],
    mediaWindow: def.container.mediaWindow,
    mask: {
      shape: scene.mask.shape,
      region,
      featherPx: scene.mask.featherPx,
      openStartSec: scene.mask.openStartSec,
      openEndSec: scene.mask.openEndSec,
    },
    motion,
    subjectActiveFromSec: plan.breakBeatSec,
    subjectActiveToSec: plan.durationSec,
    aftermathFromSec:
      scene.timeline.beats.find((b) => b.role === "settle" || b.role === "aftermath")?.atSec ??
      plan.breakBeatSec,
    chromakey: isChroma ? { color: plan.strategy.chromaColor } : undefined,
    sfx: sfxHandle ? { url: sfxHandle, atSec: plan.breakBeatSec } : undefined,
    namespaceId,
    templateId: def.id,
  };
}
