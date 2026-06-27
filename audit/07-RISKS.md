# 07 — Risk Flags (video subsystems): real vs handled, with evidence

> Each risk rated **REAL** (live, unhandled/under-handled), **PARTIAL** (some mitigation, edge cases open), or **HANDLED** (mitigated by design). Evidence from `02-WEB.md` Sections A & B and direct verification.

## R1 — Orphaned Replicate/FFmpeg processes on failure paths — **REAL / HIGH** 💸
All pixel work (clip gen + final stitch) runs as **Replicate predictions** (FFmpeg is Replicate-hosted, not Deno/Python — `02-WEB §A`). Replicate `/cancel` is invoked **only on explicit user delete/cancel** (3 call sites). Every *automatic* failure or timeout path leaves the billable prediction running:
- `seamless-stitcher:1235-1259` (stitch failure) — no cancel.
- `pipeline-watchdog` zombie branch `:988-990` — no cancel.
- A **prior credit-exhaustion incident is documented in code** at `pipeline-watchdog:342`.
**Impact:** real money leak + credit-hold churn on every failed render. **This is the #1 video risk.**

## R2 — Stuck-render reaper is double-disabled — **REAL / HIGH**
The primary watchdog that should reap stuck renders is **both** kill-switched off by default (`pipeline-watchdog:347`) **and** explicitly unscheduled (migration `20260516045913`). `zombie-cleanup` and `admin-stuck-jobs-watchdog` have **no in-repo cron** either. → Stuck/zombie renders are not automatically recovered; they accumulate.
**UNVERIFIED:** whether any of the 3 reapers are scheduled out-of-band via the Supabase dashboard (not visible in repo). **Highest-value single thing to confirm.** If they are not cron'd anywhere, R1+R2 compound into unbounded cost + permanently-stuck projects.

## R3 — Ghost "completed" projects (no video) — **REAL / MEDIUM**
`auto-stitch-trigger:233-263` and `:294-323` mark a project **complete on both failure paths** without a stitched video URL. Users see a "done" project that has no playable output. Compounds with R5 (player then tries to play a missing/JSON manifest).

## R4 — Render ↔ playback timing divergence (preview ≠ export) — **REAL / HIGH likelihood**
Four non-shared media paths (`02-WEB §B`, `04-CROSS §4.5`):
- Editor preview (`StitchedPlayer`) crossfades **every** boundary at a fixed **320ms**.
- Server bake (`seamless-stitcher`) uses **0.4s authored per-boundary** xfade + `acrossfade` + `loudnorm` + autoduck.
- `render-video` (editor export) uses **naive hard-cut concat** — a *third* audio/timing model, inconsistent with the stitcher.
**Impact:** what the user approves in preview is not what renders. No "WYSIWYG render" guarantee holds today.

## R5 — A/V sync drift — **HANDLED (low) in playback; PARTIAL in assembly**
- **Playback:** audio rides the *same decoder* as picture in every player (no independent audio element) → **no multi-element drift by design** (`02-WEB §B`, item 4). Good.
- **Assembly:** A/V is correct **only** in the `seamless-stitcher` path (real `xfade`+`acrossfade`+`loudnorm`). The editor `render-video` naive-concat path + the separate `fix-manifest-audio`/`muteClipAudio` manifest model = **two coexisting, inconsistent audio models** (`02-WEB §A`). Drift/wrong-mix risk is in assembly, not playback.

## R6 — Crossfade boundary edge cases — **PARTIAL / REAL (unhandled mix bug)**
- The editor's canvas render loop writes `setElementGain(showing, 1)` **every frame** (`StitchedPlayer:757`), **clobbering per-clip volume/mute**; three writers contend over `master.gain`. Per-clip audio mix is effectively ignored during preview. **Unhandled, zero behavioral tests.**
- `TimelinePlayer` has a real **seek→advance parity bug** at `:120`.
- First/last-clip and zero-length boundaries: equal-power crossfade exists but is applied unconditionally (no guard for degenerate boundaries).

## R7 — Clip persistence on import — **REAL / MEDIUM-HIGH (silent data loss)**
On editor file drag/drop (`src/lib/editor/upload-ingest.ts`): storage upload runs first (`:268`), then the `video_clips` insert (`:350`) is wrapped in a catch that **only `console.warn`s and never rethrows** (`:362`). The in-memory mirror runs unconditionally (`:423+`), the function returns success, and a **"Uploaded N clips" toast** fires. On any insert failure (RLS `userId≠JWT`, FK, shot_index-retry exhaustion) → **orphaned object in the public `video-clips` bucket, no DB row, gone on reload, never in `/library`.** Remote-URL imports hard-fail correctly; the bug is specific to file-drop `ingestUpload`. (`02-WEB §C`.)

## R8 — Paid specialty modes that silently eat credits — **REAL / HIGH (money)** 💸
`motion-transfer` and `stylize-video` **charge credits upfront, POST to Replicate with placeholder version hashes, and park the prediction id where no webhook/poller ever reads it** → user pays, gets nothing, no refund (`02-WEB §C`). `composite-character` feeds model slugs (not version hashes) into `/v1/predictions` → 422. These modes are wired into the UI but broken end-to-end on the money path.

## R9 — Double-refund in zombie cleanup — **REAL / HIGH (money)** 💸
`zombie-cleanup` **double-refunds** every stalled project/clip: it inserts a `refund` ledger row **and** calls `increment_credits` (which inserts a `system_grant` row); both count in `credit_ledger_total` → **2× spendable credits** (`02-WEB §D`). Also non-org-aware (refunds org spend to personal ledger) and non-hold-aware; phase-2 clips have no idempotency guard. (Note this reaper is itself unscheduled per R2, which paradoxically limits blast radius today — but if R2 is "fixed" by scheduling it, R9 fires.)

## R10 — HLS player error recovery is thin — **PARTIAL / MEDIUM**
`BrandedVideoPlayer` has adaptive HLS + native-Safari fallback + quality picker, but **no hls.js media-error recovery ladder** — only a naive `.m3u8 → .mp4` guess (`:301-319`). Manifests lacking `hlsPlaylistUrl` fall back to **playing a `.json` file as media** (BROKEN, `ExamplesGallery:285-299`). No client signed-URL generation; `generate-hls-playlist` has zero client call sites.

---

## Risk roll-up (ranked by ship impact)

| # | Risk | Rating | Domain |
|---|---|---|---|
| R1 | Orphaned Replicate predictions on failure paths | REAL / HIGH | cost |
| R2 | Stuck-render reaper double-disabled (confirm cron!) | REAL / HIGH | reliability |
| R8 | motion-transfer/stylize charge-but-produce-nothing | REAL / HIGH | money |
| R9 | zombie-cleanup double-refund (2× credits) | REAL / HIGH | money |
| R4 | Preview ≠ export (4 media paths) | REAL / HIGH-likelihood | correctness |
| R7 | Clip lost on import (silent) | REAL / MED-HIGH | data loss |
| R3 | Ghost "completed" projects | REAL / MEDIUM | correctness |
| R6 | Crossfade clobbers per-clip mix | PARTIAL/REAL | audio quality |
| R10 | HLS error recovery thin; JSON-as-media | PARTIAL / MEDIUM | playback |
| R5 | A/V sync (playback handled; assembly inconsistent) | HANDLED / PARTIAL | sync |

**The video subsystem's defining weakness is failure-path handling**, not happy-path: clip gen → stitch → play works; but timeouts, failures, and imports leak money, lose data, and strand jobs because the reapers are off and cancellation is missing.
