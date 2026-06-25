# Continuity Engine — work review & gap audit

A critical pass over everything built so far: what's solid, what I fixed this round, what's still missing, and where output quality can actually improve. Written to be honest, not reassuring.

---

## 1. What's solid (verified)

- **The decision brain** (`src/lib/video/continuity/`) — boundaries, contract-relative scoring, correction ladder, engine routing, identity bible, phase model. Pure, no IO, **105 tests green**, `tsc` clean.
- **The edge twin** (`_shared/continuity-contract.ts`) + **`continuity-audit` endpoint** — a blocking, contract-relative gate that returns `admit / verdict / priority / correction`. Locked to the client brain by **68 parity assertions** (scoring, ladder, and now boundary inference).
- **The premium UI** (`PipelineCreation.tsx`) — 8-phase rail, continuity-index ring, per-clip continuity chain with typed boundary edges, the real bridge glyph, and (new) a screen-reader live region. Backward-compatible; live at `/pipeline-preview`.

---

## 2. Fixes made this pass

| Fix | Why it mattered |
|---|---|
| **Identity/wardrobe only gate when cast persists** (both client + edge) | A `HARD_CUT`/`TIME_JUMP`/`LOCATION_CHANGE` to a *new* character legitimately scores low identity vs the protagonist's bible. The old rule (LOCATION_CHANGE-only) would have **falsely hard-failed correct shots**. Now generalized + tested. |
| **Ported `inferBoundaryType` to the edge** | The wiring probe found boundary type isn't stored anywhere — it must be inferred at validation time. The edge now has Deno-safe inference, parity-locked to the client. |
| **a11y live region** | The overlay announced nothing. Added one polite `role="status"` summary (phase + %, continuity index, current correction); decorative layers `aria-hidden` to avoid double-reads. |
| **+28 tests** | Shared-cast scenario, boundary-inference parity, and the previously-untested `phases` helpers (`derivePipelineFromCounts`, `phasesUpTo`, `continuityIndexFromClips`). |

---

## 3. The honest gaps (prioritized)

### P0 — the engine is a brain + UI, not yet load-bearing in a real render

1. **My end-frame plumbing is in DEAD CODE.** I wired `endImageUrl` into the *editor* pipeline (`src/lib/editor/generation/`), but that pipeline (**P1**) is **dormant** — `installJobRunner` has zero callers, so every job fails "No render engine is connected" (there's even a regression test documenting this). The **live** path is the edge **`hollywood-pipeline`**. → End-frame interpolation must be implemented in the **edge engine builder** (`_shared/video-engines.ts` `buildInput` for Kling/Runway), not the client.

2. **The gate isn't called.** `continuity-audit` exists but nothing invokes it. The live pipeline *does* have a per-clip retry loop (`hollywood-pipeline` ~L4098–4226) — but it gates on a **flat `score >= 75`** and **ignores boundary type** and **ignores `regenerationPriority`** (logged only). That is exactly the flat-threshold failure the contract gate fixes. Insertion point is known and clean.

3. **No skeleton-first generation + no identity bible in the live flow.** Phases A–C (build bible → storyboard stills → audit + lock anchors) — the part where drift actually dies cheaply — are unbuilt. Consequence: `endAnchorUrl` is **never populated** (so even a wired end-frame has no target), and "score vs the bible" is conceptual — the orchestrator scores vs a single `referenceImageUrl`.

### P1 — measurement & action gaps

4. **No true seam metric.** The validation orchestrator measures color-histogram, face-embedding, clothing/hair, environment, temporal, visual-debugger — but **not** a real boundary SSIM/pHash between clip N's last frame and clip N+1's first frame. Feeding the gate's `boundary` dimension a color-histogram proxy would be wrong. → add a real seam measurement before the gate can trust that dimension.

5. **`regenerationPriority` is computed but never acted on.** Map it (+ the gate's `correction.step`) onto the existing retry loop: `reseed → strengthen-anchor → swap-engine → shorten-beat → escalate`, bounded by the retry budget already in `_shared/pipeline-failsafes.ts`.

6. **Boundary inference needs script context wired.** The edge inference is ready, but `hollywood-pipeline` must call it per clip from the generated script (location/time slug + cast intersection) and pass `{boundaryType, sharedCastCount}` into the audit.

### P2 — polish, calibration, debt

7. **`colorScience` + overlap-tail are metadata only.** Per-engine LUT normalization (kills cross-engine flicker) and overlap-crossfade (hides the re-anchor seam) aren't built into `seamless-command.ts` yet.
8. **Thresholds (`hard 78 / soft 62`) are guesses.** Calibrate on a bake-off set; start strict, relax. (Open decision #1.)
9. **P1 editor pipeline is architectural debt.** It's dead code with a UI CTA that silently fails. Decide: revive it as the editor's real renderer, or delete it and route the editor through the edge pipeline.

---

## 4. Where output quality actually improves (beyond wiring)

Ranked by leverage:

1. **Skeleton-first (Phases A–C).** Biggest lever, still unbuilt. Deciding continuity on cheap stills and locking anchors is what bounds drift across a 2-minute film. Everything else is incremental next to this.
2. **A real seam metric (SSIM/pHash).** Without it the gate's strongest signal — "does the cut actually match?" — is unmeasured. Cheap to add (two frames, no model).
3. **End-frame interpolation on the live engine.** Turns Kling/Runway from forward-guessers into A→B interpolators. Real once #1 populates anchors and the edge builder sends `end_image`/`lastFrameImage`.
4. **Per-engine LUT before stitch.** Removes the tell-tale color jump when a film is routed across engines.
5. **Multi-judge VLM at studio tier.** A diverse panel catches failure modes a single critic rationalizes past.

---

## 5. Edge cases now explicitly covered

Cut-to-new-cast (no false identity fail) · non-adjacent callbacks (`inheritsFromShotId`) · transition-beat forces a cut · time-jump re-light passes · location-change with/without shared cast · unmeasured (null) dimensions don't sink the composite · INTRO has no predecessor/seam · budget-exhausted ladder escalates instead of looping · same inputs → same decision (watchdog-resumable).

Still **not** modeled: intra-clip drift (a clip that starts on-anchor but drifts by its own end), audio/lip-sync continuity across the cut, and music-cue boundaries — all candidates for a later pass.

---

## 6. Recommended next sequence

1. ✅ **DONE — Gate is blocking** in `hollywood-pipeline`. Per clip it now infers the boundary (`inferBoundaryType`), maps the comprehensive validators + seam SSIM onto the contract via `auditClip`, and replaces the flat `score >= 75` decision: a contract **pass rescues** clips the flat threshold would have needlessly redone; a contract **hard-fail enforces** a retry (with a dimension-targeted continuity directive) the flat threshold would have shipped. Bounded — falls back to `flatPass` on the final attempt, soft-fails keep prior behavior. Result persisted to `video_clips.continuity_score/_verdict/boundary_type` (migration added).
2. ✅ **DONE — Seam SSIM is real.** New `validate-seam-continuity` edge fn + pure `_shared/seam-ssim.ts` (global SSIM + exposure-shift penalty, 9 tests). Measured only on CONTINUOUS cuts (where the contract gates the seam), feeding the gate's `boundary` dimension.
3. **Build the storyboard/skeleton phase** + identity bible, which populates anchors and unlocks end-frame interpolation. *(Now the top priority — the remaining big output lever.)*
4. **Edge end-frame** (`_shared/video-engines.ts`) + **LUT + overlap** in `seamless-command.ts`.
5. **Calibrate thresholds** on a bake-off; **resolve P1** (revive or delete).

> **Caveat on boundary inference:** the live pipeline's per-shot metadata is thin (mostly one shared location), so inference currently leans toward MATCH_CUT/CONTINUOUS heuristically. It degrades safely (unknown framing → MATCH_CUT, not the over-strict CONTINUOUS), but richer per-shot location/time/cast in the script generator would sharpen it.
