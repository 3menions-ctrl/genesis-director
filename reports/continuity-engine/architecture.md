# The Continuity Engine — Architecture Specification

**Status:** design / RFC
**Scope:** the full production pipeline for multi-clip generation with seamless continuity and a blocking, self-correcting audit. Engineered to account for every scenario the system can enter, grounded in the code that already exists.

This supersedes the high-level `continuity-engine.md` (which is the *why*). This document is the *how*, at engineering depth: data model, state machine, boundary semantics, the audit, the failure taxonomy, concurrency/idempotency/resumability, and cost governance.

---

## 0. The two pipelines we have today (and the decision to unify them)

There are currently **two** generation systems in the tree, and they don't share a spine:

**P1 — the in-browser editor pipeline** (`src/lib/editor/generation/`):
`orchestrator.ts` runs a clean per-project serial queue with stages `queued → preparing → submitting → rendering → post-processing → completed/failed`, `maxAttempts: 2`, frame-chain via `prev.generated.lastFrameUrl → startImageUrl`. Pure, testable, engine-blind. But it is *open-loop* (no audit gate) and *first-frame-only*.

**P2 — the edge-function production pipeline** (`supabase/functions/*` + `_shared/`):
`continue-production` chains clips by callback, with a `pipeline_stage` enum (`clips_generating → stitching → …`), a **generation mutex** with 10-min stale auto-release, a **7-tier frame fallback**, a **circuit breaker** (3 consecutive fails → open, half-open after 30s), a **retry budget** (`clipCount × retriesPerClip`), a **dead-letter queue** (cap 50), a **watchdog** that resumes false-failures, `reconcileProjectStatus` (completed-clips-but-status-failed → fix to stitching), **proportional refunds** (`ceil(total × missing / expected)`, idempotent on `failure:${projectId}:${stage}`), and a **comprehensive-validation-orchestrator** that already scores 6 dimensions and emits `overallScore` + `regenerationPriority`.

**Decision: P2 is the production engine. P1 becomes a thin client projection of P2's authoritative state.** The Continuity Engine is built *inside* P2's world so every existing failsafe (mutex, watchdog, refund, dead-letter, circuit breaker) is reused, not reinvented. P1's value — the pure, engine-blind input builders (`buildEngineInput`, `buildSubmitPayload`, `chains.ts`) — is promoted to the shared layer so both surfaces compute inputs identically.

> **Principle 0 — One authoritative state, many projections.** The durable row in `movie_projects` + per-clip records is the single source of truth. The browser orchestrator, the status bar, and the approval UI are *read models* derived from it. No surface owns continuity state privately.

---

## 1. Design principles (the invariants every scenario must respect)

1. **Bounded, not integrated, error.** Continuity is won by anchoring each clip to *pre-validated endpoints*, never to a drifted neighbor. Drift cannot accumulate across the film by construction. (§3, §4)
2. **Continuity is per-boundary, not global.** A film is a graph of shots joined by *typed boundaries*. Not every cut should be seamless — some are deliberate. The audit's thresholds are a **function of boundary type**. The engine must never "fix" an intended cut. (§2)
3. **The audit blocks.** Validation that doesn't gate is logging. A clip does not enter the stitch until it clears its boundary's continuity contract, or is escalated. (§5)
4. **Cheap where possible, expensive only where necessary.** Continuity is decided on *stills* (skeleton phase), so the costly video render starts from a fully approved skeleton. The correction ladder spends in increasing-cost order. (§3, §6)
5. **Every state is resumable and idempotent.** Any clip, at any stage, can be killed and recovered from durable state. Retries are keyed so they never double-charge or double-render. (§7)
6. **Deterministic recovery.** No open "regenerate until perfect" loops. Every failure maps to a classified cause and a bounded, ordered recovery action. (§5.3, §6)
7. **The audit is a visible asset.** The continuity report is stored and shown to the creator — the moat, not just an internal metric. (§5.4)

---

## 2. The Boundary Contract — the core modeling insight

A film is **shots** (nodes) connected by **boundaries** (edges). Each boundary declares a **continuity type**, and that type *is* the spec for what the audit enforces there. This is what stops the engine from sanding down deliberate cuts — and what tells each clip which engine and which anchors to use.

```ts
type BoundaryType =
  | "CONTINUOUS"      // same shot continuing — a true seam to hide
  | "MATCH_CUT"       // new framing, same scene+time — identity+color lock, NO frame match
  | "HARD_CUT"        // new scene, same story — identity lock, fresh anchor, look may shift
  | "TIME_JUMP"       // later in time, same cast — identity lock, look change ALLOWED
  | "LOCATION_CHANGE" // new place — no frame continuity; identity carries if cast persists
  | "INTRO";          // first shot / first appearance — no predecessor anchor

interface Boundary {
  fromShotId: string | null;       // null at INTRO
  toShotId: string;
  type: BoundaryType;
  sharedCast: string[];            // characters present on BOTH sides (drives identity lock)
  carryFrame: boolean;             // does toShot open on fromShot's last frame?
  carryColor: boolean;             // must color/exposure match across the cut?
  overlapMs: number;               // pause-chain overlap tail (0 = clean cut)
}
```

The Continuity Contract is a lookup from `BoundaryType` → the thresholds the audit applies:

| BoundaryType | Frame-match (SSIM/pHash) | Identity (vs bible) | Color match | Seam treatment |
|---|---|---|---|---|
| CONTINUOUS | **hard pass** (≥ τ_high) | hard pass | hard pass | overlap + motion crossfade |
| MATCH_CUT | n/a (different framing) | hard pass | hard pass | clean cut |
| HARD_CUT | n/a | hard pass | soft (advisory) | clean cut |
| TIME_JUMP | n/a | hard pass | **ignored** (look may change) | clean cut, maybe transition |
| LOCATION_CHANGE | n/a | hard pass *iff sharedCast≠∅* | ignored | clean cut |
| INTRO | n/a | establishes bible | n/a | — |

This single table is why the engine is correct across *all* narrative scenarios: a day→night `TIME_JUMP` that changes the color grade is a **pass**, not a drift failure; a `CONTINUOUS` push-in that loses the protagonist's face is a **hard fail** that triggers correction. The audit is no longer "is this different?" — it's "does this match its contract?"

> The script-approval step (existing `ScriptApproval.tsx`) is where boundary types are inferred (from scene headings / time-of-day / location / cast deltas) and shown to the creator for confirmation. The creator can override any boundary (e.g. force a `HARD_CUT` where the model guessed `CONTINUOUS`). Boundaries are part of the approved artifact.

---

## 3. The phased pipeline (skeleton-first)

```
                IDEA → SCRIPT
                     │
   ┌─────────────────┼───────────────────────────────────────────────┐
   │ PHASE A  CAST & BIBLE                                            │
   │   For each character: canonical reference still + face embedding │
   │   + wardrobe/hair DNA + anti-morph anchors.                      │
   │   → IdentityBible (validated by anchor-failsafes.validateIdentityBible)
   └─────────────────┬───────────────────────────────────────────────┘
                     │
   ┌─────────────────┼───────────────────────────────────────────────┐
   │ PHASE B  STORYBOARD (stills only — cheap, parallel)              │
   │   For each shot boundary, generate the ANCHOR keyframe still,    │
   │   seeded from the BIBLE (+ previous anchor only as composition   │
   │   hint, never as identity source).                              │
   └─────────────────┬───────────────────────────────────────────────┘
                     │
   ┌─────────────────┼───────────────────────────────────────────────┐
   │ PHASE C  SKELETON AUDIT (image-domain — drift dies here)        │
   │   Score every anchor vs the BIBLE. Regenerate only failing      │
   │   stills (image cost). LOCK the approved anchor set.            │
   └─────────────────┬───────────────────────────────────────────────┘
                     │
   ┌─────────────────┼─────── SCRIPT APPROVAL (boundaries + cost + anchors) ──┐
                     │                                                          │
   ┌─────────────────┼───────────────────────────────────────────────┐        │
   │ PHASE D  ROUTE & PLAN                                            │        │
   │   Per shot: pick engine by boundary role (§8), assign anchors    │        │
   │   A (start) and B (end, where supported), set overlapMs.         │        │
   │   Credit HOLD placed here (pipeline-credits).                    │        │
   └─────────────────┬───────────────────────────────────────────────┘        │
                     │                                                          │
   ┌─────────────────┼───────────────────────────────────────────────┐        │
   │ PHASE E  MOTION (the only expensive step)                       │        │
   │   Each clip = bounded interpolation A→B (+ overlap tail).        │        │
   │   Serial within a continuity chain (mutex); parallel across      │        │
   │   independent chains (batch-processor, tier concurrency).        │        │
   └─────────────────┬───────────────────────────────────────────────┘        │
                     │                                                          │
   ┌─────────────────┼───────────────────────────────────────────────┐        │
   │ PHASE F  CONTINUITY GATE (per clip, blocking)                    │        │
   │   CCS vs the clip's BOUNDARY CONTRACT. Pass → admit.            │        │
   │   Fail → correction ladder (§5.3). Exhausted → dead-letter +     │        │
   │   escalate to creator. ───────────────────────────────────────► │ ───────┘ (re-anchor may bounce to B/C)
   └─────────────────┬───────────────────────────────────────────────┘
                     │
   ┌─────────────────┼───────────────────────────────────────────────┐
   │ PHASE G  ASSEMBLY                                               │
   │   Per-engine LUT normalize → pause-chain crossfade on overlaps  │
   │   → seamless-command stitch. Credit hold SETTLED.               │
   └─────────────────┬───────────────────────────────────────────────┘
                     │
   ┌─────────────────┼───────────────────────────────────────────────┐
   │ PHASE H  FILM AUDIT + REPORT                                    │
   │   Whole-film temporal pass + the visible continuity report.     │
   └─────────────────┬───────────────────────────────────────────────┘
                    FILM
```

**Why this ordering is the whole game:** Phases B–C decide continuity in the *image domain* (≈100× cheaper, fully parallel, instantly correctable). Phase E — the only place we spend real render budget — starts from a locked, pre-approved skeleton, so it is a *bounded interpolation* problem, not a *forward hallucination* problem. Every later failsafe (mutex, watchdog, refund) already exists in P2 and is wired in unchanged.

---

## 4. Canonical data model

Extends `generation/types.ts` and the `movie_projects` row. New/changed fields in **bold**.

```ts
interface IdentityBible {                         // PHASE A — the spine
  characters: Array<{
    characterId: string;
    name: string;
    canonicalStillUrl: string;                    // the ONE approved reference
    faceEmbedding: number[];                       // for cosine scoring
    wardrobeDNA: string;
    hairDNA: string;
    antiMorphPrompts: string[];                    // from anchor-failsafes
    role: "protagonist" | "antagonist" | "supporting" | "narrator" | "ensemble";
  }>;
  styleAnchor: { palette: string; grade: string; lens: string; masterHistogram: number[] };
  version: number;                                 // bumped on any re-lock; clips record which version they matched
}

interface Anchor {                                 // PHASE B/C — a locked still at a boundary
  shotId: string;
  position: "start" | "end";
  stillUrl: string;
  bibleVersion: number;                            // which bible it was validated against
  skeletonScore: number;                           // identity/color score at lock time
  locked: boolean;
}

interface ClipPlan {                               // PHASE D
  shotId: string;
  engine: ModelEngine;
  startAnchor: Anchor;                             // A — always present (chain) except INTRO
  endAnchor: Anchor | null;                        // B — only when engine.supportsEndFrame
  boundaryIn: Boundary;
  overlapMs: number;
  durationSec: number;                             // engine-quantized (nearestDuration)
}

interface ContinuityScore {                        // PHASE F — reconciles validation-orchestrator output
  identity: number;        // face cosine + CLIP-I vs bible
  wardrobe: number;        // region-masked vs bible
  boundary: number;        // SSIM/pHash A-side last ↔ B-side first (only when contract.carryFrame)
  temporal: number;        // optical-flow variance / flicker (VBench-style)
  color: number;           // histogram distance vs masterHistogram
  vlm: number;             // VLM critique: "same person/place/lighting?" 0..100
  composite: number;       // weighted; maps to orchestrator.overallScore
  verdict: "pass" | "soft-fail" | "hard-fail";    // computed vs BOUNDARY CONTRACT, not a global threshold
  priority: "none" | "low" | "medium" | "high" | "critical"; // = regenerationPriority
  notes: string[];         // human-readable; feeds the report + corrective prompt
}
```

`EngineInput` gains **`endImageUrl: string | null`** and `CanonicalVideoRequest` (in `video-engines.ts`) gains **`endImageUrl`** + the registry gains **`supportsEndFrame`** and **`colorScience`** tags. These three additions are what unlock true interpolation and engine-boundary LUT correction.

---

## 5. The audit engine (the moat)

### 5.1 What gets scored, and against what
Every term scores against the **bible** (the source), never the neighbor (the drift). The `comprehensive-validation-orchestrator` already computes color-histogram, face-embedding, clothing-hair, environment, temporal, and visual-debugger and emits `overallScore` + `regenerationPriority`. The Continuity Engine **reuses that orchestrator verbatim** and adds two terms: **boundary** (SSIM/pHash across the cut, only when `contract.carryFrame`) and **vlm** (the tie-break critique). `ContinuityScore.composite` maps onto the existing `overallScore`; `verdict`/`priority` map onto `regenerationPriority`.

### 5.2 Verdict is contract-relative
`verdict` is computed by checking each term against **the boundary's contract row** (§2), not a global threshold:
- A `CONTINUOUS` clip with `boundary < τ_high` → **hard-fail** (seam broke).
- A `TIME_JUMP` clip with low `color` → **pass** (the look was *supposed* to change).
- A `LOCATION_CHANGE` with `sharedCast == ∅` and low `identity` → **pass** (different people, new place).

This is the single most important correctness property of the audit. It is impossible to express in a flat threshold and is why a contract table exists.

### 5.3 The correction ladder (deterministic, cost-ordered, budget-bounded)
On `hard-fail` (and `soft-fail` above a per-tier tolerance), escalate **cheapest-first**, each step bounded by the existing **RetryBudget** (`clipCount × retriesPerClip`) and **CircuitBreaker** (3 consecutive fails → open → half-open after 30s):

1. **Re-seed** — same engine, same anchors, new noise seed. (cheap; fixes ~half)
2. **Strengthen anchor** — re-extract a cleaner tail frame (`extractTailFrame`), raise reference weight, or **regenerate the anchor still and re-pin** (bounces to Phase B/C for *that one anchor* — image cost, not video).
3. **Swap engine** by failure type — identity-fail → Runway; motion/physics-fail → Seedance; seam-fail → Kling with *both* anchors. (Engine is persisted per `movie_projects.video_engine`, guarding against silent downgrade.)
4. **Shorten the beat** — split the clip into two shorter clips so the engine drifts less per clip (attacks error accumulation directly; re-plans two boundaries).
5. **Escalate** — exhausted budget → **dead-letter queue** entry + surface in the approval UI with the full CCS breakdown. Never silently ship a hard-fail.

Each step records to the snapshot; the **watchdog** can resume a ladder mid-flight after an infra failure.

### 5.4 Adversarial tier (premium)
For studio-tier renders, the `vlm` term runs as an **N-judge panel with distinct lenses** (identity / physics-plausibility / does-it-feel-spliced), majority-vote to pass. A single judge rationalizes its own output; a diverse panel doesn't. Cost-gated to tier.

### 5.5 The report (visible asset)
Every clip's `ContinuityScore` is persisted and rendered in the approval UI: *"Continuity 96 · Identity 99 · Seam 94 · Boundary: CONTINUOUS ✓."* The film-level roll-up is the creator-facing trust surface LTX's black box cannot match.

---

## 6. Cost & latency governance

- **Continuity is decided on stills.** Phases B–C are image-cost and fully parallel. The expensive Phase E never runs on an unvalidated skeleton, so the dominant failure mode (regenerate-the-video) is rare by construction.
- **RetryBudget** caps total spend: `clipCount × retriesPerClip`, tracked per-clip *and* per-pipeline. The ladder cannot run unbounded.
- **CircuitBreaker** halts a failing engine after 3 consecutive fails (open 60s, half-open probe after 30s) so a degraded provider can't burn the budget.
- **Tier concurrency** (`batch-processor`: free 2 / pro 3 / growth 5 / agency 8) caps parallel clips; independent continuity chains parallelize, dependent ones serialize behind the mutex.
- **Credit hold → settle.** A hold is placed at Phase D (`pipeline-credits`) and settled at Phase G; any terminal failure triggers the **idempotent proportional refund** (`ceil(total × missing / expected)`, keyed `failure:${projectId}:${stage}`).
- **Cost ceiling per film** is therefore: `Σ clips × engine_cost × (1 + expected_retry_rate)` + cheap skeleton cost, with `expected_retry_rate` driven down by the skeleton-first design.

---

## 7. Concurrency, idempotency, resumability

- **Continuity mutex** (`generation-mutex.ts`): clip N+1 blocks until N is `completed` *and* has a `last_frame_url` (`checkContinuityReady`). Stale locks auto-release after 10 min; locks held by an already-completed clip are detected and released.
- **Idempotency keys** everywhere money or renders are involved: refunds keyed on `failure:${projectId}:${stage}`; recovered clips keyed on `clip_${projectId}_${clipIndex}`; prediction recovery checks Replicate by id before re-submitting (catches webhook misses).
- **Durable context** (`persistPipelineContext` / `loadPipelineContext`): bible, anchors, engine, boundary graph, and ladder progress are persisted so any stage is resumable.
- **Watchdog + reconciliation**: `reconcileProjectStatus` fixes false-failures (all clips done but status=failed → stitching; status=generating but nothing generating + some failed → failed). Transient errors flag `needsWatchdogResume` and stay `generating`; the watchdog re-drives them.
- **7-tier frame fallback** guarantees a start image is never null (extracted → previous → golden → scene → reference → source → bible). The Continuity Engine *prefers the extracted frame* (the clip's actual end) over any upload, so the chain continues from what was really rendered.

> **Resumability invariant:** killing the process at *any* phase and re-running from durable state must converge to the same film (modulo engine nondeterminism), never double-charge, and never re-render an already-admitted clip.

---

## 8. Per-engine adapter contract

The registry (`video-engines.ts`) is the single source of engine truth. Each engine declares its continuity surface; the router (Phase D) assigns roles by boundary demand.

| Engine | New flags | Continuity role |
|---|---|---|
| **Kling V3** | `supportsEndFrame: true`, wire `input.end_image` | **Bounded interpolation A→B** + dialogue/lip-sync; first choice when both anchors exist |
| **Runway Gen-4** | keyframes payload | **Character continuity** across many cuts (highest identity strength) |
| **Seedance 1 Pro** | `colorScience: "bytedance"` | **Action / reframing** shots where a clean re-frame hides the re-anchor |
| **Veo 3 Fast** | native audio | **Establishing / ambient**, sound-driven single 8s beats |
| **Sora 2** | native audio, long coherence | **Longest single-take** beats — less cutting = fewer seams |
| **Wan 2.5** | free | Drafts, low-stakes inserts |

Two registry upgrades make the whole design possible:
1. **`endImageUrl` plumbing** — today the registry silently drops any end anchor; adding the field unlocks Phase C true interpolation on Kling/Runway.
2. **`colorScience` tag** — lets Phase G apply a per-engine LUT *before* xfade (`lut-library.ts`), killing engine-boundary flicker (B4) when a film is routed across engines.

---

## 9. The exhaustive scenario matrix

Every state the system can enter, and its engineered response. This is the "account for all scenarios" core.

### Narrative / boundary scenarios
| Scenario | Response |
|---|---|
| First shot (no predecessor) | `INTRO` boundary; no start anchor; bible establishes identity; no frame-match scored |
| Final shot | normal; no successor; no end-overlap |
| Same shot continuing | `CONTINUOUS`; both anchors + overlap + crossfade; frame-match hard-gated |
| New angle, same scene/time | `MATCH_CUT`; identity+color hard, **no** frame-match; clean cut |
| New scene, same story | `HARD_CUT`; identity hard, color advisory; fresh anchor |
| Day → night / time jump | `TIME_JUMP`; identity hard, **color ignored**; deliberate look change passes |
| New location | `LOCATION_CHANGE`; frame continuity off; identity gated *only if* cast persists |
| Character absent from a shot | no identity term for that character; bible carries others |
| Multiple characters in shot | identity scored per character vs bible; role-priority ordering (protagonist first) |
| Character enters mid-film | first appearance is an `INTRO` *for that character*; bible gains them at Phase A or via a sub-skeleton pass |
| Character exits mid-film | dropped from `sharedCast` downstream; no false identity fails |
| Non-adjacent callback ("back to scene 3") | `inheritsFromShotId` override (already in `chains.ts`); anchor pulled from the referenced shot, not the chronological predecessor |
| Intentional jump-cut / stylistic discontinuity | creator sets boundary type at approval; audit honors it; no "correction" |

### Engine / capability scenarios
| Scenario | Response |
|---|---|
| Engine lacks end-frame support (Seedance/Wan/Veo/Sora) | start anchor + *target-described* prompt; rely on the gate to catch overrun; prefer Kling/Runway for high-continuity boundaries |
| Engine duration can't tile the beat (B5) | `nearestDuration` quantize; if gap > tolerance, **shorten-the-beat** split at plan time, or pad with a held final frame |
| Aspect ratio unsupported by chosen engine | `shotSanity` flags `engine-aspect-mismatch`; router picks a compatible engine or warns at approval |
| Mixed engines across a film (color flicker) | `colorScience` LUT normalize before xfade (Phase G) |
| Mid-film engine swap by the ladder | engine persisted per clip (`job.engine`, `movie_projects.video_engine`) so polling/recovery don't confuse models |
| Avatar / lip-sync continuity | Kling lip-sync; secondary-character identity lock injected (existing dual-avatar logic in `continue-production`) |
| Audio continuity across native-audio vs silent engines | audio normalized to 48k in `seamless-command`; native-audio beats placed at scene boundaries where audio resets are natural |

### Failure / infra scenarios (mapped to existing failsafes)
| Scenario | Classified as | Response |
|---|---|---|
| Provider rate-limit (429) | `rate_limit` | wait 15s ×≤3 (`network-resilience`), then retry; circuit breaker counts |
| Transient 5xx / socket / fetch failed | `timeout`/`network` | exponential backoff ×4 with jitter; stay `generating`, flag watchdog |
| Replicate webhook missed | — | `verifyPredictionAndRecover` polls by id before declaring failure |
| Clip stuck > 10 min | stuck | `detectStuckClips` → recovery action; > 15 min absolute → fail + recover |
| Orphaned video (rendered, record lost) | — | `findOrphanedVideo` by path pattern → re-link |
| Mutex held by completed clip | stale | auto-release (`releaseStaleCompletedLock`) |
| Mutex held > 10 min | stale | auto-release + drain next |
| Anchor null / malformed | — | `anchor-failsafes` validate+repair with defaults |
| Start frame unavailable | — | 7-tier fallback guarantees non-null |
| Insufficient credits | `input_invalid` (hard) | no retry; fail fast; no hold placed |
| Invalid prompt / content filter | `validation`/`content_filter` | non-retryable; `stripModerationTriggers` for breakouts; escalate |
| Persistence write fails | `persistence_fail` | `verifyTransaction` read-back; retry; dead-letter on repeat |
| Temp Replicate URL expiry | — | `persistVideoToStorage` copies to durable bucket before URL dies |
| Audit non-determinism (judge disagreement) | — | N-judge majority (§5.4); composite + contract decide, not a single call |
| Bible itself is bad (poor reference) | — | Phase C catches it: anchors fail vs a wrong bible → creator re-picks reference before any video spend |
| Whole pipeline killed mid-run | — | resume from `loadPipelineContext`; `reconcileProjectStatus` repairs status; watchdog re-drives |
| All clips done but status=failed | false-failure | reconcile → `stitching` |
| Partial film failure | — | proportional refund for missing clips; completed clips preserved; creator can resume just the failures |
| Circuit open (provider degraded) | — | halt that engine 60s; route new clips to a sibling engine; resume on half-open probe |
| Retry budget exhausted | — | dead-letter + escalate to creator with the CCS breakdown |

---

## 10. Build plan (sequenced, mapped to files)

| # | Change | File(s) | Why this order |
|---|---|---|---|
| 1 | `endImageUrl` + `supportsEndFrame`; wire Kling `end_image`, Runway keyframes | `_shared/video-engines.ts`, `generation/{types,pipeline}.ts` | unlocks bounded interpolation — biggest single continuity lever |
| 2 | `Boundary` model + boundary inference + approval UI override | `script-document.ts`, `ScriptApproval.tsx` | makes the audit correct across all narrative scenarios |
| 3 | `IdentityBible` as first-class object; anchor to bible not neighbor | `chains.ts`, `types.ts`, `anchor-failsafes.ts` | the spine; kills cross-film drift |
| 4 | Storyboard + skeleton-audit phases (stills, lock) | new `generation/storyboard.ts` + orchestrator hook | where drift dies cheaply |
| 5 | `ContinuityScore` + contract-relative verdict; extend orchestrator with boundary+vlm terms | `comprehensive-validation-orchestrator`, new `continuity-score.ts` | the blocking gate |
| 6 | Correction ladder wired to RetryBudget + CircuitBreaker + dead-letter + watchdog | `continue-production`, `pipeline-failsafes.ts` | deterministic recovery |
| 7 | Overlap-tail generation + crossfade-on-overlap | `extractTailFrame.ts`, `_shared/seamless-command.ts` | hides the re-anchor seam |
| 8 | Per-engine LUT normalize before xfade | `seamless-command.ts`, `lut-library.ts` | kills engine-boundary flicker |
| 9 | Continuity report surfaced | `ScriptApproval.tsx`, `PipelineCreation.tsx` | the visible moat |

Critical path for the continuity win: **1 → 3 → 4 → 5 → 7**. Items 2, 6, 8, 9 harden correctness, recovery, polish, and trust around it.

---

## 11. Open decisions (need a call before build)

1. **Threshold values** (τ_high for CONTINUOUS frame-match, identity pass line). Propose calibrating on a 10-film bake-off set rather than guessing; start strict and relax.
2. **Skeleton cost vs. coverage** — generate an anchor at *every* boundary, or only at CONTINUOUS/MATCH_CUT boundaries (where continuity is gated)? Proposal: anchor everywhere, but only *hard-gate* where the contract demands — anchors are cheap and double as the storyboard preview.
3. **End-frame availability** — Kling/Runway end-frame support is the linchpin; if a provider's end-frame API regresses, the fallback is start-anchor + target-prompt + a stricter gate. Confirm current Replicate surface for both.
4. **Adversarial judge cost** — N-judge panel only at studio tier, or sampled (e.g. 1-in-K) at pro tier?
5. **Bible authoring UX** — auto-derive the bible from the first uploaded reference, or require an explicit per-character reference pass? Auto with a confirm step is the proposed default.

---

### One-line thesis
**We model the film as typed boundaries, prove the skeleton continuous in the cheap image domain, render each clip as a bounded interpolation between pre-approved anchors, and let a contract-relative, self-correcting audit decide what ships — all on top of the mutex/watchdog/refund/circuit-breaker spine we already run.**
