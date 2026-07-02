# Pipeline Unification — Status Map (DONE vs REMAINS)

> ⚠️ **PARTIALLY STALE (2026-07-01, same day):** compiled against `main`=`da17ca68`;
> main has since moved ~70 commits. Now DONE on main: **item 1** (normalizer wired to
> DRIVE mode-router — PR #214), **item 2** (golden-plan harness + `resolvePlan()` —
> PR #215), **item 7** (api-v1 `/videos` routed through hollywood-pipeline; last
> seedance-pipeline caller retired — PR #217). Items 3–6 (avatar-direct fold,
> stylize/motion fold, editor slugs, Ad Studio fold) + seedance-pipeline deletion
> remain as written.

Read-only research report. Every claim is cited to `file:line` and a git ref.
Compiled against these refs (verified `2026-07-01`):

- `main` = `da17ca68` (Merge PR #172) — **integration base**
- `feat/creative-vfx-gen` (cvg) = `1405856c` — 1 unique commit, **76 behind main**
- `agent/pipeline-reliability` = `31ae59f5` — **fully merged into main** (ancestor)
- current working branch `qa-audit` contains the same unification commits as `main`

`.claude/worktrees/agent-ade80245b293e89ae/**` is a duplicate tree on cvg — ignored throughout.

---

## 0. TL;DR

There are **two** design docs and they describe **two different target end-states**:

- **`docs/PIPELINE.md` = "design of record"** (authoritative). Pragmatic staged plan:
  `mode-router` normalizes to a canonical `production_request`, one orchestrator
  (`hollywood-pipeline`) with a **pluggable dispatch strategy**, a **fail-closed
  gate**, Stages 1–4. No new run-ledger; keeps `movie_projects.status`.
- **`docs/PIPELINE-UNIFICATION.md` = SUPERSEDED** (its own header says so). Grander
  plan: a brand-new thin `pipeline-run` orchestrator, `Stage`/`EngineStrategy`/`Mode`
  interfaces in `_shared/pipeline/`, a `pipeline_runs`/`pipeline_stages` run-ledger,
  a `PIPELINE_V2` feature flag, Phases 0–6.

**What was actually built follows `PIPELINE.md`, not the superseded grander plan.**
The heaviest single divergence (seedance vs hollywood) **is collapsed and live**.
The `pipeline-run`/ledger/interfaces/`PIPELINE_V2` architecture is **entirely absent
from code** (docs-only).

---

## 1. Target architecture (extracted from the docs)

### 1a. Design of record — `docs/PIPELINE.md`
- **One orchestrator = `hollywood-pipeline`** (not a new `pipeline-run`). Its Phase A
  (script, identity bible, scene images, continuity anchors) is engine-agnostic; Phase B
  (clip dispatch) is the only per-engine fork, isolated behind a **dispatch strategy**
  (`PIPELINE.md` §5; `hollywood-pipeline/dispatch/strategy.ts:1-18`).
- **One canonical `production_request`** that `mode-router` normalizes every surface into
  (`PIPELINE.md` §5 "One canonical request").
- **One per-shot operation** (`t2v|i2v|avatar|stylize|pose-transfer`) — engine + mode are
  data, not branches (`PIPELINE.md` §5 "One per-shot operation").
- **Fail-closed approval gate on ALL modes** — every cinematic run parks at
  `awaiting_approval` unless a trusted `autoApprove:true` (`PIPELINE.md` §2 Fig.3, §5).
- **Staged migration** (`PIPELINE.md` §6): Stage 1 contract+gate (additive) → Stage 2 op
  abstraction (route 3 cinematic-ish handlers through one loop) → Stage 3 fold scriptless
  ops + delete handlers/duplicate pipeline → Stage 4 cleanup (slug parity, single
  capability table, retire `seedance-pipeline` after `api-v1` moves over).
- **§7 self-declared open items** (the doc is honest about what's unfinished):
  `production-request.ts` is *test-only scaffolding, not imported by runtime mode-router
  (Stage 1 normalization unfinished — dispatch unification is live, normalization is not)*;
  Cast & Worlds doesn't seed generation; `requireApproval` is a dead flag; `seedance-pipeline`
  dormant (reachable only via api-v1); `free-tier-generate` orphaned.

### 1b. Superseded grander plan — `docs/PIPELINE-UNIFICATION.md` (context only)
- New thin **`pipeline-run`** coordinator; stages `script→shotlist→generate→continuity→
  finishing→audio→assemble` (§2.1).
- **`Stage<I,O>` + `EngineStrategy` + `Mode`** interfaces in `_shared/pipeline/` (§2.3).
- **`pipeline_runs` + `pipeline_stages` run-ledger** migration (§2.4); canonical status FSM
  reconcile migration (§2.5).
- **`PIPELINE_V2` per-project % feature flag**, shadow runs, golden-render gate, Phases 0–6
  (§4). Phase 2 = "migrate seedance first as an `EngineStrategy` inside `pipeline-run`."

> Note the divergence: the grander plan wanted seedance folded into a NEW `pipeline-run`
> behind a flag/ledger. What shipped instead folds seedance into the EXISTING
> `hollywood-pipeline` via `dispatch/strategy.ts` — same *goal* (kill the duplicate
> orchestrator), different *mechanism* (no ledger, no flag).

---

## 2. What is ACTUALLY IMPLEMENTED (verified in code, on `main`)

### ✅ DONE — Seedance folded into hollywood (dispatch strategy) — LIVE
- `hollywood-pipeline/dispatch/strategy.ts` exists (main + cvg identical).
  `selectDispatchStrategy(engine)` returns `parallel` for seedance, `sequential` otherwise
  (`strategy.ts:35-40`); `dispatchParallel()` is a full port of legacy
  `seedance-pipeline:733-999` onto the shared spine (`strategy.ts` header + body).
- Wired into the orchestrator: `hollywood-pipeline/index.ts:14-18` imports
  `selectDispatchStrategy`/`dispatchParallel`; `index.ts:3410` selects the strategy and
  `index.ts:3499` calls `dispatchParallel(...)`. **This is real, not scaffolding.**
- `mode-router` routes cinematic + seedance/breakout + seedance-avatar to
  `hollywood-pipeline`, **not** the legacy `seedance-pipeline`
  (`mode-router/index.ts:575-580, 996-999, 1267-1273`).
- Commits: `f7675d85` (unify orchestrators — dispatch strategy) and `29c432d8` (seedance
  parity, all 5 regressions) — **present on `main`** (verified via `--contains`).

### ✅ DONE — Fail-closed approval gate
- `hollywood-pipeline/index.ts:6313-6329`: `requireManualApproval = autoApprove !== true`
  → parks `status:'awaiting_approval'`. Gate keys on `autoApprove` (the `requireApproval`
  flag is dead, per `PIPELINE.md` §7).

### ✅ DONE — Engine-slug parity contract
- `_shared/production-request.ts` `ENGINE_ROUTE_LABEL` carries the audited-live slugs
  incl. the corrected `wan-video/wan-2.5-t2v` (`production-request.ts` ~L30). Commit
  `bb01e54f` (`feat/pipeline-engine-slug-parity`). NOTE: editor path is NOT reconciled — see §3.

### ⚠️ PARTIAL / SCAFFOLDING-ONLY — the `production_request` normalizer
- The file `supabase/functions/_shared/production-request.ts` **exists** (main == cvg, 0 diff)
  and is complete: `ProductionRequest` interface, `normalizeMode`, `resolveEngine`,
  `resolveDispatchStrategy`, `resolveAudioStrategy`, `resolveOperation`,
  `resolveShotOperation`, and the `HANDLER_COLLAPSE` assertion table.
- **BUT it is NOT wired into runtime routing.** Grep for any caller of the resolvers across
  all `supabase/functions/**` returns **nothing** except:
  - `hollywood-pipeline/dispatch/strategy.ts:22` imports **only `type BackendEngine`**;
  - a stray comment mention. 
  `mode-router/index.ts` does **not** import or call it (grep empty); it still uses its
  legacy `mode` switch + the 5 `handle*Mode` functions
  (`mode-router/index.ts:575,603,623,635,661`).
- So it is **weaker than "observe-only"** — it is effectively **unused scaffolding**
  (one type import). This matches `PIPELINE.md` §7's own admission. The Stage-1
  *normalization* half is **NOT started in runtime**.
- The Stage-1/2/4 commits cited in the brief (`40539345`, `7de4fa1b`, `bb01e54f`) live on
  `feat/pipeline-stage1-normalizer` / origin cvg; the resulting *file* reached `main`, but
  the *wiring* did not.

### ❌ NOT PRESENT — the entire grander architecture (docs-only)
Grep across `main` and `cvg` (excluding docs + worktrees):
- **No `pipeline-run` function** — `functions/pipeline-run` does not exist on either ref.
- **No `_shared/pipeline/` Stage/EngineStrategy/Mode interfaces** — the only `_shared/pipeline-*`
  files are pre-existing helpers (`pipeline-credits.ts`, `pipeline-failure.ts`,
  `pipeline-guard-rails.ts`, `pipeline-notifications.ts`, `pipeline-failsafes.ts`). No
  `interface EngineStrategy` / `interface Stage<` anywhere but the doc.
- **No `pipeline_runs`/`pipeline_stages` migration** — grep of `supabase/migrations/*` = none.
- **No `PIPELINE_V2` flag** — only appears in `docs/PIPELINE-UNIFICATION.md`.
- **No status-FSM reconcile migration**, no golden-render regression set.

### Per-product-type routing today (verified)
| Product type | Entry | Router | Executes on | Unified? |
|---|---|---|---|---|
| film (text/image/broll) | Studio | `mode-router` → `handleCinematicMode` (`:661`) | **hollywood-pipeline** (sequential) | ✅ unified |
| avatar cinematic / seedance breakout | Studio | `mode-router` → `handleAvatarCinematicMode`/cinematic (`:580,1267`) | **hollywood-pipeline** (parallel/seedance) | ✅ unified |
| avatar direct (verbatim TTS) | Studio | `mode-router` → `handleAvatarDirectMode` (`:719,765`) | `generate-avatar-direct` → Kling V3 **direct Replicate** (`generate-avatar-direct/index.ts:782-808`) | ❌ separate |
| stylize (video2video) | Studio | `mode-router` → `handleStyleTransferMode` (`:1068,1095`) | `stylize-video` | ❌ separate |
| motion-transfer | Studio | `mode-router` → `handleMotionTransferMode` (`:1141,1166`) | `motion-transfer` | ❌ separate |
| ad | Ad Studio | `generate-ad-studio` / `generate-ad-variants` | self-contained (no `hollywood`/`generate-single-clip` ref found — mechanism UNVERIFIED in detail) | ❌ separate |
| editor-shot | Editor | `editor-generate-clip` → `final-assembly` | **direct Replicate**, incl. **stale `bytedance/seedance-1-pro`** slug (`editor-generate-clip/index.ts:19-23`) | ❌ separate + stale slugs |
| avatar resume | — | `resume-avatar-pipeline` | separate | ❌ separate |
| seedance-pipeline (legacy) | — | **only `api-v1/index.ts:286`** still invokes it | dormant | still exists, not deleted |

- `seedance-pipeline` is dormant but **not deleted**; `api-v1/index.ts:281-286` is its last
  live caller (mode-router no longer routes to it). Other references
  (`generate-single-clip`, `poll-replicate-prediction`, `seamless-stitcher`,
  `breakout-guardrails`) are string/contract mentions, not orchestration dispatch.
- Multiple front doors still exist: `mode-router`, `Production.tsx`-direct, `api-v1`,
  `job-queue` (Phase-5 collapse not started).

---

## 3. Phase-by-phase status

### Against `docs/PIPELINE.md` (design of record — Stages 1–4)
| Stage | Deliverable | Status | Proof |
|---|---|---|---|
| **1** | fail-closed gate | ✅ DONE | `hollywood-pipeline/index.ts:6313-6329` |
| **1** | `production_request` normalizer wired into `mode-router` | ❌ NOT STARTED (runtime) | file exists but `mode-router` never imports it; resolvers have 0 callers |
| **2** | op-abstraction + route cinematic/avatar-cinematic/avatar-direct through one loop | ⚠️ PARTIAL | cinematic + avatar-cinematic on hollywood; **avatar-direct still a separate leaf** (`generate-avatar-direct`); op resolver exists but unused |
| **2 (dispatch)** | seedance dispatch folded in | ✅ DONE | `dispatch/strategy.ts` + `index.ts:3410,3499` |
| **3** | fold scriptless ops (stylize, pose-transfer); delete 5 handlers + duplicate pipeline | ❌ NOT STARTED | stylize/motion still call `stylize-video`/`motion-transfer`; 5 handlers intact |
| **4** | slug parity + retire `seedance-pipeline` after api-v1 moves over | ⚠️ PARTIAL | dispatch-path parity done (`ENGINE_ROUTE_LABEL`); **editor still stale `seedance-1-pro`**; `seedance-pipeline` still live via `api-v1` |

### Against `docs/PIPELINE-UNIFICATION.md` (SUPERSEDED — Phases 0–6)
| Phase | Deliverable | Status | Proof |
|---|---|---|---|
| **0** | `pipeline_runs`/`pipeline_stages` migration; Stage/EngineStrategy/Mode interfaces; FSM migration; golden-render set | ❌ NOT STARTED | none exist in code |
| **1** | `pipeline-run` shell | ❌ NOT STARTED | no such function |
| **2** | seedance canary as `EngineStrategy` in `pipeline-run` behind `PIPELINE_V2` | ⚠️ DONE DIFFERENTLY | goal met via `hollywood-pipeline` dispatch strategy instead; no `pipeline-run`, no flag, no ledger, no shadow/golden gate |
| **3** | hollywood migrated into `pipeline-run` stages; delete hollywood + resume trio | ❌ NOT STARTED | hollywood is 7,181 LOC (`index.ts`) and is *the* orchestrator |
| **4** | ad/editor/avatar/stylize/motion become modes on `pipeline-run` | ❌ NOT STARTED | all still standalone |
| **5** | one `dispatch(bible,mode)` front door; delete `python/breakout_pipeline` | ❌ NOT STARTED | 4 front doors remain; python kept |
| **6** | one watchdog on ledger FSM, admin run-timeline, dead-fn removal | ❌ NOT STARTED | — |

**Approx. completion.** Toward the design of record (`PIPELINE.md`): ~**35–40%** — the
gate + the single hardest orchestrator collapse (seedance→hollywood) + the slug contract
are done; normalizer wiring, op-abstraction for scriptless/avatar-direct, secondary-surface
folding, and `seedance-pipeline` retirement remain. Toward the superseded grander plan:
~**15%** (only the seedance-collapse *goal*, via a different mechanism).

---

## 4. What REMAINS (ordered by dependency)

Target = the **design of record** (`PIPELINE.md`). "Composition not rewrite" — reuse the
resolvers already written in `_shared/production-request.ts` and the existing `_shared/*`
modules; do **not** build the `pipeline-run`/ledger unless deliberately choosing the
superseded plan (see item 8).

1. **Wire the normalizer into `mode-router` (observe-only → driving).** Import
   `_shared/production-request.ts`; build a `ProductionRequest` from the incoming payload;
   first log divergence vs the legacy switch (observe), then let it drive handler
   selection. Files: `mode-router/index.ts` (the `mode` switch at `:575-661`). Reuse:
   `normalizeMode`, `resolveEngine`, `resolveOperation`, `resolveDispatchStrategy`,
   `resolveAudioStrategy` (all already written). Risk: **medium** — routing regressions;
   mitigate with item 2.

2. **Add the parity test** asserting the normalizer reproduces legacy routing per
   `HANDLER_COLLAPSE`. Files: `mode-router/index_test.ts` (exists, currently doesn't import
   the normalizer). Gates the item-1 cutover. Risk: **low**.

3. **Fold `avatar-direct` into the op abstraction (finish Stage 2).** `resolveOperation`
   already maps scriptless avatar → `effectFn:'generate-avatar-direct'`; route it via the
   unified dispatch path (single-shot `op:avatar`). Files: `mode-router` `handleAvatarDirectMode`
   (`:719-765`), `generate-avatar-direct`. Risk: **medium** — verbatim-TTS preservation +
   credits already deducted in router (`creditsAlreadyDeducted`).

4. **Fold scriptless effects (stylize, motion-transfer) into the unified path (Stage 3).**
   `resolveOperation` already names `stylize-video` / `motion-transfer` as `effectFn` on the
   `single-pass-effect` lane; have the orchestrator dispatch them instead of the router
   calling them directly. Then delete the 5 `handle*Mode` functions. Files: `mode-router`
   (`:1068-1201`), `stylize-video`, `motion-transfer`, `hollywood-pipeline`. Risk: **medium**.

5. **Reconcile editor slugs + route editor through the shared spine (Stage 4 / Phase 4).**
   `editor-generate-clip/index.ts:19-23` calls Replicate directly with **stale
   `bytedance/seedance-1-pro`**; move it onto `generate-single-clip` (which already uses the
   audited-live slugs) so the editor stops diverging. Files: `editor-generate-clip/index.ts`.
   Risk: **medium-high** — editor render regressions.

6. **Fold Ad Studio + avatar-resume surfaces onto the unified path as modes (Phase 4).**
   Files: `generate-ad-studio`, `generate-ad-variants`, `resume-avatar-pipeline`. Risk:
   **medium-high** (ad-variants is fan-out; mechanism UNVERIFIED in detail — audit first).

7. **Retire `seedance-pipeline` (Stage 4 finish).** Move `api-v1/index.ts:281-286` off
   `seedance-pipeline` onto `hollywood-pipeline`, soak, then delete `seedance-pipeline` +
   `seedance-script-director` if orphaned. Risk: **medium** — `api-v1` is an external
   contract surface.

8. **(OPTIONAL — only if choosing the superseded grander end-state) Durable run-ledger.**
   Create `pipeline_runs`/`pipeline_stages` migration + `_shared/pipeline/` Stage/EngineStrategy
   interfaces + `PIPELINE_V2` flag + ledger-based `pipeline-watchdog` resume. **Requires a DB
   migration that does not exist** and a prod-state check (no such table in prod — see §5).
   Large; `PIPELINE.md` deliberately does NOT require it. Risk: **high**.

### Half-built / needs promotion
- `_shared/production-request.ts` — full, correct, **unused** (one type import). Promote to
  the runtime normalizer (items 1–4). It is the single biggest "built but not integrated" asset.
- `resolveOperation`'s `effectFn` mapping and `HANDLER_COLLAPSE` table are pre-written to make
  items 3/4 mostly wiring, not new logic.

---

## 5. Branch guidance + DB / prod-state flags

- **Build on `main`.** It contains ALL merged unification work (dispatch strategy, gate,
  slug parity). `feat/creative-vfx-gen` is **76 commits behind main** with only **one unique
  commit** (`1405856c`) — a WIP backup of `apply-breakout-vfx` edge fn + `python/breakout_pipeline`
  predictor + a `world_chat_delete` migration + `final-assembly` tweaks. That commit is **VFX/
  breakout + world-chat feature work, NOT pipeline-unification** — cherry-pick it separately if
  wanted; it is not needed for unification. `agent/pipeline-reliability` (`31ae59f5`, the 24h
  final-URL + atomic clip-completion fixes) is **already fully merged into main** — nothing to pull.
- **No DB migration exists** for the run-ledger; `pipeline_runs`/`pipeline_stages` are **not in
  `supabase/migrations/`** on any ref. If item 8 is pursued, a new migration is required and prod
  must be checked (per CLAUDE.md: prod is behind repo on migrations; use `supabase migration list`
  + Management API to verify no such table exists before creating). The design-of-record path
  (items 1–7) needs **no new migration** — it reuses `movie_projects.status`.
- **No prod deploy of un-wired code risk:** the normalizer file is inert (unused), so wiring it
  (item 1) is the first behavior-changing edge-fn deploy — validate on each mode before widening.
