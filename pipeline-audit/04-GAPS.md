# 04 — Gaps & Fixes (Phase 3)

Prioritized by **blast radius** — how many creation types / how much of the pipeline
each break blocks. P0 = launch-blocking for a core flow; P1 = degrades all outputs;
P2 = correctness/quality; P3 = cleanup / drift.

## Priority-ordered gap list

| ID | Sev | Gap | Blast radius | Fix |
|----|-----|-----|-------------|-----|
| G1 | P0 | **Editor render path is dead** — `installJobRunner` has 0 call sites; every editor render CTA dead-ends | All Editor-initiated creation (combo #17). The Editor is a marketed surface | Either install a runner that bridges to the live edge pipeline (enqueue → `mode-router`/`hollywood-pipeline`) or hide all editor render CTAs behind a feature flag until built |
| G2 | P0 | **Final-film URL expires in 24h** and is never re-signed on reopen | Every completed project (#1–13). After a day the final video 404s | Re-sign `published-renders` on load (see fix below), OR store a long-TTL/public URL, OR re-sign in the realtime fetch path |
| G3 | P1 | **Unified template registry never drives a render** — gallery uses `TEMPLATE_BLUEPRINTS` (38), runtime resolves `?template=` against the separate legacy `BUILT_IN_TEMPLATES` | Every "Use this template" click for a registry-only id silently no-ops (#3). The 38 marketed templates are display-only | Finish the registry's documented "Phase 2": make `useTemplateEnvironment.loadTemplate` resolve from `TEMPLATE_BLUEPRINTS` (fallback to legacy), de-dupe the two lists |
| G4 | P1 | **No edit → re-render propagation** — script/shot edits never invalidate clips/frames | Any edit after generation (#1–13) → stale output, no targeted regen | Add a `needs_regen` flag per shot on edit; targeted "re-render shot N → re-extract end frame → re-chain N+1" path |
| G5 | P2 | **Continuity scoring engine not load-bearing** — `continuity-audit` 0 callers; flat `score>=75` gate; no SSIM/pHash seam metric | Visible-seam risk on all multi-clip outputs (#1–13) | Wire `continuity-audit` into the retry loop; compute a real seam metric between clip N last-frame and N+1 first-frame |
| G6 | P2 | **External-service correctness unverifiable offline** — depends on live Replicate model versions + keys (incl. ffmpeg cog `efd0b79b…`) | Clip gen + stitch for all video combos | Add a health/smoke check that pings each model version + key on deploy; alert on drift |
| G7 | P2 | **`generated_script` dual-format conflict** — JSON (live) vs raw text (editor); `Production.tsx:594` does `JSON.parse` | Cross-surface projects (edit in Editor, open in Production) → silent "no shots" | Pick one format (JSON), or have Production detect+parse both; never silently swallow the parse error |
| G8 | P2 | **Hydration orders clips by `created_at`, not `shot_index`** | Editor storyboard/shot strip can mis-sequence on out-of-order completion → wrong frame-chain neighbor | Order by `shot_index` in `hydrate-document.ts:222-227` |
| G9 | P3 | **Dead/orphan code** — `generate-story`, `free-tier-generate` (no callers); `ProjectType`/`PROJECT_TYPES` (test-only); `SmartStitcherPlayer` referenced but nonexistent; stale "MANIFEST-ONLY" comment in `auto-stitch-trigger` | Confuses the model of "what's a creation type"; misleads future work | Delete orphans or mark `@deprecated`; fix the stale comments |
| G10 | P3 | **Inventory drift** — file headers claim 40/50 templates (real: 38); `vfx` category declared but 0 blueprints; two breakout sources of truth (50 DB vs 10 in-memory) | Documentation/marketing mismatch; category filter shows empty "VFX" | Reconcile counts; either populate `vfx` category or remove it; converge breakout sources |
| G11 | P3 | **Python `breakout_pipeline` is dead code** with an aspirational DB schema (`recipe_slug`, `preferred_model`) implying integration that was never built | Misleads anyone reading the repo into thinking there's a local VFX engine in the loop | Decide: build the integration (a real worker that consumes the columns) **or** delete the engine + clarify the columns are cloud-only hints |

## Concrete fix for G2 (highest-confidence, smallest change)

The final film is stored in the private `published-renders` bucket with a 24h signed
URL written to `movie_projects.video_url`. On reopen, `Production.tsx:455-458` plays
it directly. Fix: re-sign on load instead of trusting the persisted URL.

```ts
// when loading a completed project, if video_url points at published-renders,
// re-sign it rather than replaying the stale 24h URL.
const key = extractPublishedRenderKey(project.video_url); // parse path from URL
if (key) {
  const { data } = await supabase.storage
    .from('published-renders')
    .createSignedUrl(key, 60 * 60 * 24);
  finalVideoUrl = data?.signedUrl ?? project.video_url;
}
```
`seamless-stitcher` already has `maybeCachedSignedUrl` and `brand-video-download`
re-signs with the same TTL — this just calls the same path on view. Alternatively,
make `published-renders` public if the final films aren't access-controlled.

## How to run a real e2e (for when staging + budget are available)

The cloud chain was **not** fired in this audit (billable, no staging sandbox wired).
Minimal real harness once staging creds + budget are signed off:

```ts
// against STAGING supabase only
const { data } = await supabase.functions.invoke('mode-router', {
  body: { mode: 'text-to-video', prompt: 'a test clip', videoEngine: 'kling',
          clipCount: 2, aspectRatio: '16:9' },
});
// then poll movie_projects by data.projectId until status='completed',
// assert video_url resolves (200) and video_clips count === clipCount.
```
Run it once per `mode` (#1,5,7,9,10), once for Crossover (#11, a vfx slug), once for a
breakout id (#12), once for avatar (#8). That's ~8 live runs covering every distinct
backend branch — far cheaper than the full 20-row matrix and exercises every code
path. Budget: ~2 clips × 8 runs × per-clip credit cost.

## Suggested sequencing

1. **G2** (re-sign final URL) — tiny, unblocks every existing completed project.
2. **G1** (editor render) — decide build-vs-hide; it's a visible dead surface.
3. **G3** (registry → runtime) — makes the 38 marketed templates real.
4. **G7/G8** — cheap correctness fixes for cross-surface + ordering.
5. **G4/G5** — the deeper continuity/edit work.
6. **G9/G10/G11** — cleanup pass; reduces future confusion.
