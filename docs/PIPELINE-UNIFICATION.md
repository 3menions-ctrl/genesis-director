# One Pipeline, Many Branches — Unification Design & Execution Plan

> ⚠️ **SUPERSEDED.** The authoritative pipeline design is now **`docs/PIPELINE.md`**
> (canonical `production_request`, the per-shot operation abstraction, the
> fail-closed gate, and the staged migration — partially executed this session:
> seedance now runs through the unified `hollywood-pipeline` via a pluggable
> dispatch strategy). This document is retained as alternative planning context;
> where the two differ, `PIPELINE.md` wins.

**Goal:** collapse the ~7 independent generation orchestrators into **one durable,
staged pipeline** whose *only* per-case differences are **branches** (engine,
mode, surface) — not separate codebases.

**Guiding principle:** this is **composition + collapse, not a rewrite.** The
stages already exist as `_shared/*` modules and leaf functions; we are giving them
one conductor and deleting the duplicate conductors.

---

## 1. Current state (diagnosed)

Independent orchestrators today, each re-implementing the same job:
- `hollywood-pipeline` (6,955 LOC) — Studio path; frame-chained via `continue-production`; identity-aware.
- `seedance-pipeline` (1,040 LOC) — `mode-router` path; self-polls Replicate; scene-images.
- Editor render (`editor-generate-clip` + `editor-ai-scene` → `final-assembly`).
- Ad Studio (`generate-ad-studio` / `generate-ad-variants`).
- Avatar (`resume-avatar-pipeline` / `generate-avatar-direct`).
- One-shots: `stylize-video`, `motion-transfer`, `generate-storyboard`.
- **Dead:** `python/breakout_pipeline` (0 invocations).

Three routers decide which runs: `Production.tsx` (direct → hollywood),
`mode-router` (→ seedance/hollywood/avatar/stylize/motion), `job-queue`/`api-v1`.

**Already shared (the tail is mostly one pipeline):** `generate-single-clip`,
`seamless-stitcher`, `final-assembly`, `poll-replicate-prediction`,
`pipeline-watchdog`, and 50+ `_shared/*` modules (engine routing, credits,
failure, color-grade, audio-mix, effects, continuity, mutex).

**The problem is the *heads*:** script→shotlist→clip-loop→identity→assembly
sequencing is duplicated and divergent. A fix in one doesn't fix the other.

---

## 2. Target architecture

### 2.1 One orchestrator: `pipeline-run`
A single thin coordinator. It owns **sequencing, persistence, resume, credits,
and failure** — and delegates the *work* to stages. It does NOT contain
engine/model logic; that lives behind a strategy.

```
pipeline-run(projectId, bible, mode)
  ├─ STAGE script        (smart-script-generator / avatar-screenplay-generator)
  ├─ STAGE shotlist      (route-shots + shot-engine-router → per-shot EngineStrategy)
  ├─ STAGE generate      ── for each shot ── EngineStrategy.generateShot()  ◀ BRANCH: engine
  │      (hollywood=frame-chain · seedance=poll · veo/sora/kling=single-call)
  ├─ STAGE continuity    (extract-scene-identity + verify-character-identity + seam-ssim)
  ├─ STAGE finishing     (upscale · color-grade[lut-library] · effects-bake · quality-post)
  ├─ STAGE audio         (generate-voice · score[sync-music-to-scenes] · elevenlabs-sfx)
  └─ STAGE assemble      (final-assembly → seamless-stitcher)   ◀ already shared
```

### 2.2 The three branch axes (this is what replaces "separate pipelines")
- **Engine branch** (inside `generate` stage): `EngineStrategy` — hollywood
  (frame-chain), seedance (poll), veo/sora/kling/wan (single-call). Selected per
  shot by the existing `shot-engine-router.ts`.
- **Mode branch** (which stages run): `film | ad | avatar | stylize | motion |
  editor-shot`. A mode is just a **stage subset + parameters**, not a new pipeline.
  (e.g. `stylize` = generate+finishing+assemble, skip script/shotlist.)
- **Surface adapter** (entry): Studio / Crossover / Ad / Editor / API each build a
  `bible` + pick a `mode`, then call the **same** `pipeline-run`. No surface owns
  orchestration.

### 2.3 Two interfaces (the seams that let Lane A & Lane B build in parallel)

```ts
// Stage: idempotent, resumable, persists its own output to the run ledger.
interface Stage<I, O> {
  name: StageName;
  run(input: I, ctx: RunCtx): Promise<O>;   // must be safe to re-run
  shouldRun(bible: Bible, mode: Mode): boolean;
}

// EngineStrategy: the ONLY thing that differs between "hollywood" and "seedance".
interface EngineStrategy {
  id: 'hollywood' | 'seedance' | 'veo' | 'sora' | 'kling' | 'wan';
  generateShot(shot: Shot, ctx: RunCtx): Promise<ClipResult>; // wraps generate-single-clip
  frameChain: boolean;        // hollywood=true → feeds last_frame to next shot
}
```

`bible` = the `production_bible` contract in `docs/COORDINATION.md` (single input).
`ClipResult` = the `video_clips` output contract in `docs/COORDINATION.md`.

### 2.4 Durable state — the run ledger (new, small)
A `pipeline_runs` + `pipeline_stages` table is the backbone (replaces ad-hoc
`movie_projects.status` string-juggling). One row per run; one row per stage with
`{status, input_hash, output_ref, attempts}`. This makes the pipeline:
- **Resumable** — restart from the last completed stage (one `pipeline-watchdog`,
  not the current `resume-pipeline`/`resume-avatar-pipeline`/`continue-production` trio).
- **Idempotent** — re-running a stage with the same `input_hash` is a no-op.
- **Observable** — every run's stage timeline is queryable (admin + debugging).

### 2.5 Canonical status FSM (reconcile today's drift)
`movie_projects.status`: `draft → queued → scripting → generating → finishing →
stitching → completed | failed | paused`. Map today's `pending/processing/rendering`
onto this once; clip FSM: `queued → generating → completed | failed`.

---

## 3. Reuse map (existing module → stage). We compose these.

| Stage | Reuses (already in `_shared/` or functions) | New (small) |
|---|---|---|
| script | `smart-script-generator`, `script-utils`, `avatar-screenplay-generator`, `prompt-builder` | — |
| shotlist | `route-shots`, `shot-engine-router`, `world-class-cinematography` | shotlist adapter |
| generate | `generate-single-clip`, `video-engines`, `engines`, `generation-mutex`, `replicate-recovery` | `EngineStrategy` impls (thin) |
| continuity | `extract-scene-identity`, `continuity-contract`, `seam-ssim`, `anchor-failsafes` | `verify-character-identity` (Lane A) |
| finishing | `color-grade`+`lut-library`, `effects`+`effects-bake`, `quality-post`, `keyframe-bake`, `text-overlay-bake` | `upscale-video` |
| audio | `generate-voice`, `sync-music-to-scenes`, `audio-mix`, `elevenlabs-sfx` | wire sfx |
| assemble | `final-assembly`, `seamless-stitcher`, `seamless-command`, `video-persistence` | — |
| cross-cut | `pipeline-credits`, `pipeline-failure`, `failure-classify`, `pipeline-guard-rails`, `pipeline-notifications`, `auth-guard`, `content-safety` | run-ledger writer |

Net new code is small: the orchestrator shell, the run ledger, 2 interfaces, and
the thin EngineStrategy wrappers. Everything heavy already exists.

---

## 4. Execution plan — strangler-fig, never a big bang

Each phase ships behind `PIPELINE_V2` flag (per-project %, default off). Rollback =
flip the flag. Each phase has a verification gate before rollout widens.

### Phase 0 — Foundations (no behavior change) · Lane B + A
1. Land `pipeline_runs`/`pipeline_stages` migration + run-ledger writer.
2. Define `Stage` + `EngineStrategy` + `Mode` interfaces in `_shared/pipeline/`.
3. Document & migrate the status FSM (one reconcile migration).
4. Build a **golden-render regression set** (N fixed bibles → expected artifacts)
   used as the gate for every later phase.

### Phase 1 — The orchestrator shell `pipeline-run` · Lane B
Thin coordinator that runs stages via the interface, persists to the ledger,
reuses `pipeline-credits`/`pipeline-failure`. No surface points at it yet.

### Phase 2 — Canary: migrate **seedance** first (smallest) · Lane B drives, Lane A provides `SeedanceStrategy`
Re-implement seedance as `EngineStrategy(id:'seedance', frameChain:false)` inside
`pipeline-run`. **Shadow-run** against live seedance for the golden set; diff
output. Flip `mode-router` seedance branch to `pipeline-run` at 5%→50%→100%.
**Delete `seedance-pipeline`** when 100% + 1 week clean.

### Phase 3 — Migrate **hollywood** (the 6,955-LOC monolith) · Lane B + Lane A
Extract its stages into the Stage interface incrementally (script → shotlist →
generate(`HollywoodStrategy`, frameChain:true) → continuity → assemble), each
landed + shadow-verified behind the flag. Cut `Production.tsx` and `mode-router`
hollywood branch to `pipeline-run`. **Delete `hollywood-pipeline`** + the
`resume-pipeline`/`resume-avatar-pipeline`/`continue-production` trio (replaced by
ledger-based resume in `pipeline-watchdog`).

### Phase 4 — Fold secondary heads into **modes** · Lane B (surface adapters) + owners
Ad Studio, Editor render, Avatar, stylize, motion-transfer become
`mode` + surface-adapter (build bible, pick stage subset) calling `pipeline-run`.
Delete the standalone orchestrators; keep their leaf model calls.

### Phase 5 — One front door · Lane B
Collapse `mode-router` + `Production.tsx`-direct + `job-queue` + `api-v1` into a
single `dispatch(bible, mode)` → `pipeline-run`. Delete `python/breakout_pipeline`.

### Phase 6 — Harden · Lane B + A
One watchdog over the ledger FSM; one credit model; one failure taxonomy; admin
run-timeline view; remove dead `render-video`/`generate-video`/`generate-storyboard`
if confirmed orphaned.

---

## 5. Safety rails (keep prod working the whole time)
- **Feature flag + canary %** on every cutover; instant rollback.
- **Shadow runs** (new pipeline runs alongside old, output diffed, not served) before any user traffic.
- **Golden-render gate** must pass before widening rollout.
- **Idempotent stages + run ledger** → a mid-flight deploy can't strand a project.
- **Delete only after** 100% + a clean soak window. Old code stays until then.
- Credit safety preserved end-to-end via existing `pipeline-credits` hold/consume/release.

## 6. Lane split (per `docs/COORDINATION.md`)
- **Lane B (orchestration/finishing/audio):** `pipeline-run`, run ledger, Stage
  interface, dispatcher, FSM, watchdog, finishing/audio stages, deletions of the
  orchestrator monoliths.
- **Lane A (VFX/generation):** `EngineStrategy` implementations, `generate-single-clip`
  internals, `continuity`/identity stage, scene/character generation. Seam =
  `EngineStrategy` + `ClipResult` contract.

## 7. Success metrics
- Orchestrator LOC: ~8k across 7 heads → ~1.5k in one + thin strategies.
- One place to fix a pipeline bug (no per-engine divergence).
- Resume success rate ↑ (ledger-based); stranded-project rate → ~0.
- Every surface/engine/mode demonstrably runs the same stages.

## 8. First concrete step
Phase 0 + the seedance canary (Phase 2) is the smallest end-to-end proof. It
validates the interfaces on the 1,040-LOC pipeline before touching the 6,955-LOC
one. Recommend starting there.
