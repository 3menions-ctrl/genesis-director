import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {

// @public-endpoint
// Stateless pipeline decision step — takes measured scores, returns a
// pass/fail + next corrective step. No DB, no credits, no model calls, no
// user data. Called edge-to-edge during the stitch.
  auditClip,
  type BoundaryType,
  type DimensionScores,
} from "../_shared/continuity-contract.ts";
import { logAndSanitize } from "../_shared/safe-error.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CONTINUITY AUDIT — the blocking continuity gate.
 *
 * Given a clip's MEASURED dimension scores (from the
 * comprehensive-validation-orchestrator: identity / wardrobe / boundary
 * SSIM / temporal / colour / VLM) and the clip's BOUNDARY TYPE, decide
 * whether the clip is admitted to the stitch — RELATIVE TO ITS
 * CONTRACT, not a flat threshold. A TIME_JUMP that re-lights is a pass;
 * a CONTINUOUS that breaks its seam is a hard-fail. On failure it
 * returns the next deterministic, budget-bounded corrective step.
 *
 * This does NOT call any models — the orchestrator measures, this
 * decides. Keeping the decision pure makes it fast, idempotent, and
 * resumable by the watchdog.
 */

interface AuditRequest {
  /** Measured 0..100 scores; omit / null any dimension not measured. */
  scores: Partial<DimensionScores>;
  boundaryType: BoundaryType;
  /** Characters present on BOTH sides of the cut (gates LOCATION_CHANGE). */
  sharedCastCount?: number;
  /** Attempts already spent on this clip (0 on first audit). */
  attempt?: number;
  /** Retry budget for this clip. */
  maxAttempts?: number;
  currentEngine?: string;
  /** Engines the router may swap to. */
  availableEngines?: string[];
  alreadyShortened?: boolean;
  /** For logging / correlation only. */
  projectId?: string;
  clipIndex?: number;
}

const ALL_ENGINES = [
  "seedance-1-pro",
  "kling-2-master",
  "kling-1-6-pro",
  "runway-gen-4",
  "veo-3-pro",
  "sora-2",
  "wan-2-1",
];

function normalizeScores(s: Partial<DimensionScores>): DimensionScores {
  const v = (n: number | null | undefined) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  return {
    identity: v(s.identity),
    wardrobe: v(s.wardrobe),
    boundary: v(s.boundary),
    temporal: v(s.temporal),
    color: v(s.color),
    vlm: v(s.vlm),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as AuditRequest;

    if (!body || typeof body !== "object" || !body.boundaryType) {
      return json({ error: "boundaryType is required" }, 400);
    }

    const result = auditClip({
      scores: normalizeScores(body.scores ?? {}),
      boundaryType: body.boundaryType,
      sharedCastCount: body.sharedCastCount ?? 1,
      attempt: body.attempt ?? 0,
      maxAttempts: body.maxAttempts ?? 3,
      // NO DEFAULT MODEL: an empty currentEngine just disables the (advisory)
      // swap-engine recommendation instead of pretending we run seedance-1-pro.
      currentEngine: body.currentEngine ?? "",
      availableEngines: body.availableEngines?.length ? body.availableEngines : ALL_ENGINES,
      alreadyShortened: body.alreadyShortened ?? false,
    });

    return json({
      success: true,
      projectId: body.projectId,
      clipIndex: body.clipIndex,
      admit: result.admit,
      verdict: result.score.verdict,
      priority: result.score.priority,
      composite: result.score.composite,
      failures: result.score.failures,
      notes: result.score.notes,
      correction: result.correction, // null when admitted
    });
  } catch (err) {
    return json({ error: logAndSanitize("continuity-audit", err, "audit failed") }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
