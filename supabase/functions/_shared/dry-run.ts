/**
 * dry-run — validate the ENTIRE render pipeline (mode-router → script →
 * dispatch → completion → stitch → durable URL → credit hold/consume) WITHOUT
 * spending a cent on Replicate.
 *
 * WHY: real renders are billed per Replicate prediction (video generation AND
 * the ffmpeg stitch cog). Every "does the plumbing work?" test used to burn
 * real credits — which is exactly how a QA pass drained the account. A dry run
 * swaps the two COST points (generate-single-clip's video call, and
 * seamless-stitcher's stitch cog) for a bundled placeholder clip, so the whole
 * flow can be exercised for ~$0 (only the cheap LLM script call remains).
 *
 * HOW IT'S TRIGGERED (belt AND suspenders — a dry run must NEVER silently
 * become a real, billed render):
 *   1. Per-request/per-project flag `dryRun: true` threaded from mode-router.
 *   2. Global env `MOCK_REPLICATE === 'true'` (for a dedicated QA environment).
 * Either one activates it.
 *
 * FAIL-SAFE: `assertNotDryRunAtSpend()` is called immediately before any real
 * Replicate POST. If a dry run ever reaches that line (a mis-wire), it THROWS
 * instead of spending — the worst-case failure is a loud error, never a
 * surprise charge.
 */

/** A bundled, public, durable placeholder clip (real mp4 in the public
 *  `final-videos` bucket). Used as the "generated" video for every dry-run
 *  clip and as the dry-run stitch output, so downstream steps (durable-URL
 *  persist, thumbnails, the editor) all get a real, playable URL. */
export const DRY_RUN_PLACEHOLDER_PATH =
  "final-videos/8be6d9c9-776e-46af-9ad8-23ad41f0f99c/preserved/landing-hoppy-immersive-park-web.mp4";

export function dryRunPlaceholderUrl(supabaseUrl?: string): string {
  const base = (supabaseUrl || Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${DRY_RUN_PLACEHOLDER_PATH}`;
}

/** Fake prediction id so status-pollers/webhooks recognise a mock and never
 *  hit the Replicate API for it. */
export function mockPredictionId(clipIndex = 0): string {
  return `mock_dryrun_${clipIndex}_${Math.round(performance.now())}`;
}

export function isMockPredictionId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("mock_dryrun_");
}

/**
 * True when this request/project should run mocked. Accepts any object that may
 * carry a `dryRun` boolean (a request body, a pipelineContext, a project row,
 * or its `pending_video_tasks` / `pipeline_state`). The global env switch wins
 * for a dedicated QA project.
 */
export function isDryRun(...sources: Array<Record<string, unknown> | null | undefined>): boolean {
  if (Deno.env.get("MOCK_REPLICATE") === "true") return true;
  for (const s of sources) {
    if (!s) continue;
    if (s.dryRun === true) return true;
    const pvt = s.pending_video_tasks as Record<string, unknown> | undefined;
    if (pvt?.dryRun === true) return true;
    const ps = s.pipeline_state as Record<string, unknown> | undefined;
    if (ps?.dryRun === true) return true;
    const ctx = s.pipelineContext as Record<string, unknown> | undefined;
    if (ctx?.dryRun === true) return true;
  }
  return false;
}

/**
 * FAIL-SAFE. Call this right before any real, billable Replicate POST. If a
 * dry run reached here, the wiring is broken — throw rather than spend.
 */
export function assertNotDryRunAtSpend(
  isDry: boolean,
  where: string,
): void {
  if (isDry) {
    throw new Error(
      `[dry-run] REFUSING to spend: reached a real Replicate call in ${where} while dryRun is active. ` +
      `This is a wiring bug — the mock short-circuit should have run first. No credits were spent.`,
    );
  }
}
