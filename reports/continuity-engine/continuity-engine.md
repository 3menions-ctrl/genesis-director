# The Continuity Engine — beating LTX on seamless multi-clip production

**Goal:** per-engine frame-chaining + pause-chaining that produces multiple clips with *seamless* continuity, gated by an auditing process nobody else ships. This document is the barrier research + the out-of-the-box pipeline design, grounded in the code we already have.

---

## 0. What we ship today (the honest baseline)

We already have more machinery than most competitors. The relevant pieces:

| Concern | Where it lives | What it does |
|---|---|---|
| Frame chain | `src/lib/editor/generation/chains.ts` → `frameChainStartImage()` | Feeds the **previous shot's last frame** as the next shot's **start image**. |
| Identity chain | `chains.ts` → `identityRefsForShot()` | Weaves each character's `identityDNA` + `referenceImageUrl` into the prompt as a "CONTINUITY LOCK". |
| Pose chain | `chains.ts` → `poseLockHint()` | Heuristic sentence ("pick up where the previous framing ended"). |
| Tail-frame materialization | `src/lib/video/extractTailFrame.ts` | Renders a clip's last frame to a hosted JPEG so engines can ingest it. |
| Per-engine input shapes | `supabase/functions/_shared/video-engines.ts` | Maps a canonical request → each model's exact input (`start_image`, `image`, `input_reference`). |
| Per-clip validation | `supabase/functions/comprehensive-clip-validator/index.ts` | Multi-frame sampling, face embedding, clothing/hair, environment, histogram checks. |
| Seamless stitch | `supabase/functions/_shared/seamless-command.ts` | Normalizes every clip (1920×1080, 30fps, bt709, 48k) then xfade-chains them. |

**The brutal truth about this baseline — three structural ceilings:**

1. **It's first-frame-only.** Every engine in `video-engines.ts` receives a *start* image and nothing else (`input.start_image`, `input.image`, `input.input_reference`). The engine is then free to drift for the entire clip duration. The next clip re-anchors to that **already-drifted** last frame. That is the literal definition of a copy-of-a-copy. Kling, Runway, and Pika *can* accept an **end/target** frame too — we don't use it.

2. **It's open-loop.** `comprehensive-clip-validator` exists, but the pipeline generates → chains forward → stitches. There is no gate that **refuses a clip and regenerates it** when continuity fails. Validation that doesn't block is just logging.

3. **It anchors to the neighbor, not to the source.** `frameChainStartImage` anchors clip N+1 to clip N's output. Identity is carried as *text* (`identityDNA`), not as a *pinned, pre-validated still* that every clip must match. Drift therefore compounds linearly across the film.

LTX has the same three problems plus a worse UX. We win by fixing all three structurally — not with a better prompt, but with a different **control flow**.

---

## 1. The barriers (what actually breaks seamless continuity)

### B1 — Error accumulation / temporal drift
Each generation is a lossy resampling of its conditioning frame. Chain outputs to inputs and the error integrates: lighting warms, faces soften, wardrobe mutates. By clip 5 it's a different film. **This is the dominant barrier.** Everything else is secondary.

### B2 — Identity drift (the face/wardrobe problem)
Text identity (`identityDNA`) and a single reference image are weak conditioning. IP-Adapter-class face injection holds the *face* but is famously poor on *outfit* and *hair*. Without a hard, scored identity constraint, the protagonist's jacket changes color between cuts.

### B3 — The re-anchor seam
Even with perfect first-frame chaining, clip N+1 *starts* on clip N's last pixel but the engine's first few frames "settle" — a micro-jump in motion vector, exposure, or grain. The cut is technically frame-matched but *feels* spliced.

### B4 — Engine heterogeneity
Different models have different color science, motion physics, default framing, and frame-control surfaces (start-only vs start+end vs keyframes). A film routed across engines for quality will *flicker* at engine boundaries unless normalized.

### B5 — Duration quantization
Engines only emit legal durations (`durations: [5,10,15]` etc., see `nearestDuration`). A 7-second beat becomes a 5 or a 10. Beats that don't tile cleanly force awkward cuts or padded dead air.

### B6 — No ground truth for "seamless"
You can't fix what you can't measure. "Seamless" has to become a **number** with a pass/fail budget, or every quality argument is subjective and unrepeatable.

### B7 — Latency & cost of doing it right
Closed-loop regeneration multiplies render cost. A naive "regenerate until perfect" loop is unshippable economically. The design has to be *cheap where it can be* (validate stills, not video) and *expensive only where it must be*.

---

## 2. The core inversion (the out-of-the-box idea)

> **Stop generating the film forward. Generate the *skeleton* first, validate it cold, then fill motion between pinned, pre-approved anchors.**

This is **Macro-from-Micro / keyframe-first planning**. Today we generate motion and *hope* continuity survives. Instead:

**Phase A — Storyboard the entire film as stills (cheap, fast, image-only).**
For every shot boundary, generate the **anchor keyframe** as a Flux still, seeded from the character identity bible + the previous anchor. Stills are ~100× cheaper and faster than video. Generate the *whole* set up front.

**Phase B — Audit the skeleton before a single frame of video exists.**
Run identity + continuity scoring across **all anchors at once** (CLIP-I / face-embedding cosine vs the bible, color/exposure coherence, wardrobe match). Regenerate only the failing stills. This is where drift dies: every anchor is pinned to the *original bible*, never to a drifted neighbor, and the correction loop runs on cents-cheap images.

**Phase C — Generate motion *between locked anchors*, not *forward into the unknown*.**
Now each clip is a **bounded interpolation problem**: "get from approved anchor A to approved anchor B." Where the engine supports an end frame (Kling start+end, Runway keyframes, Pika first+last) we hand it both. Where it doesn't (Seedance, Wan, Veo, Sora) we use start-frame + a *target-described* prompt and rely on the audit gate to catch overruns. Drift **cannot accumulate across the film** because every clip is independently pinned to two pre-validated endpoints.

**Phase D — Pause-chain the seams.**
Generate each clip with a short **overlap tail** (e.g. last 0.5s of clip N is the same beat the first 0.5s of clip N+1 re-renders from the same anchor). Stitch on the overlap with a motion-aware crossfade. The re-anchor settle (B3) happens *inside* the dissolve where the eye can't catch it.

**Phase E — The audit gate (closed loop).**
No clip enters the stitch until it passes the Continuity Score budget. Failures auto-correct via a fixed escalation ladder (re-seed → strengthen anchor → swap engine → shorten beat). This is the part nobody ships.

The inversion turns an *integrating* error process (forward chaining) into a *bounded* one (anchor-to-anchor). That single change is the difference between "drifts by clip 5" and "holds for a 2-minute film."

---

## 3. Per-engine frame-control matrix

Each engine gets a continuity *role* matched to its real strength (from `video-engines.ts` + capability research). The router picks per-shot, not per-film.

| Engine | Frame control we exploit | Continuity strength | Assigned role |
|---|---|---|---|
| **Runway Gen-4 Turbo** | start image (+ keyframes API) | Best-in-class character continuity | Character-heavy chains; the protagonist's face across many cuts |
| **Kling V3** | **start_image + end frame** + native lip-sync | True bounded interpolation + dialogue | Dialogue beats and any shot where we have both anchors → hand it A *and* B |
| **Seedance 1 Pro** | start image; auto-cinematographer | Hyperreal motion physics | Action / camera-reframing shots where a clean re-frame *hides* the re-anchor |
| **Veo 3 Fast** | start image + **native audio** | Single coherent 8s beat | Establishing shots, ambient, sound-driven beats |
| **Sora 2** | input_reference + native audio | Long narrative coherence | The longest single-take beats; less cutting = less seam |
| **Wan 2.5 (free)** | start image | Cheap, simple | Free-tier drafts and low-stakes inserts |

**Two concrete engine-level upgrades to `video-engines.ts`:**

1. Add `supportsEndFrame` + an `endImageUrl` field to `CanonicalVideoRequest`, and wire `input.end_image` for Kling (and the keyframes payload for Runway). This is what unlocks Phase C true interpolation. Today the registry silently drops the end anchor because the field doesn't exist.
2. Add a `colorScience` tag per engine so the normalizer in `seamless-command.ts` can apply a per-engine LUT correction *before* xfade, killing the engine-boundary flicker (B4).

---

## 4. The auditing engine — the unmatched part

This is the moat. We turn "seamless" into a scored, blocking, self-correcting gate. Extend the existing `comprehensive-clip-validator` from a *reporter* into a *gate*.

### 4.1 The Continuity Score (CCS)
A weighted 0–100 per clip, every term already partially computable from what we sample today:

| Dimension | Metric | Source |
|---|---|---|
| **Identity** | Face-embedding cosine + CLIP-I vs the **identity bible** (not the neighbor) | extend validator's face embedding |
| **Wardrobe/hair** | Region-masked color + texture match vs bible | extend clothing/hair check |
| **Boundary continuity** | SSIM + perceptual hash: clip N last frame ↔ clip N+1 first frame | new |
| **Temporal stability** | Optical-flow variance + flicker index (VBench-style subject/background consistency, motion smoothness) | new |
| **Exposure/color** | Histogram distance vs master histogram | already exists (`masterHistogram`) |
| **Prompt fidelity** | VLM critique: "is this the same person/place/lighting as the reference? yes/no + why" | new VLM call |

CCS = weighted sum. **Budget: ship ≥ threshold; below → auto-correct.** The VLM critique is the tie-breaker and the human-readable audit trail.

### 4.2 The correction ladder (deterministic, cost-bounded)
When a clip fails CCS, escalate in fixed order, cheapest first — never an open "regenerate until perfect":

1. **Re-seed** same engine, same anchors, new noise seed. (cheap, fixes ~half of failures)
2. **Strengthen the anchor** — raise reference weight / re-extract a cleaner tail frame / regenerate the *anchor still* and re-pin.
3. **Swap engine** to the one whose role fits the failure (identity fail → Runway; motion fail → Seedance; seam fail → Kling with both anchors).
4. **Shorten the beat** — split into two shorter clips so the engine drifts less per clip (attacks B1 directly).
5. **Escalate to human** — surface in the script-approval UI with the CCS breakdown. Never silently ship a fail.

Each clip carries a hard retry cap (`maxRetries`, already in config) so cost is bounded by construction (B7).

### 4.3 Adversarial / multi-judge auditing (the "unmatched" tier)
For premium renders, don't trust one judge. Run **N independent VLM critics with different lenses** (identity / physics-plausibility / does-it-feel-spliced) and require a majority to pass. A single model rationalizes its own output; a diverse panel doesn't. This is the same adversarial-verify pattern that makes review pipelines trustworthy — applied to frames.

### 4.4 Audit as a *visible asset*
Every clip's CCS breakdown is stored and shown in the approval UI: "Continuity 96 · Identity 99 · Seam 94." LTX gives you a black box. We give the creator a **continuity report** they can trust and point at. That's a marketing surface, not just an internal metric.

---

## 5. The pipeline, end to end

```
IDEA
  │
  ▼  ① Script + identity bible  (cast → canonical reference still + face embedding + wardrobe DNA)
  │
  ▼  ② STORYBOARD: generate every shot's anchor keyframe as a Flux still,
  │     each seeded from the bible + previous anchor                         ← cheap, fast, parallel
  │
  ▼  ③ SKELETON AUDIT: score all anchors vs the BIBLE (identity/color/wardrobe).
  │     Regenerate only failing stills. Lock the set.                        ← drift dies here
  │
  ▼  ④ SCRIPT APPROVAL  (existing ScriptApproval.tsx — now shows locked anchors + cost)
  │
  ▼  ⑤ ROUTE: per shot, pick engine by continuity role (§3) + assign anchors A,B
  │
  ▼  ⑥ MOTION: generate each clip as bounded interpolation A→B, with overlap tail
  │     (Kling/Runway get both anchors; others get start + target-described prompt)
  │
  ▼  ⑦ CONTINUITY GATE: CCS per clip. Fail → correction ladder (§4.2). Pass → admit.
  │
  ▼  ⑧ PAUSE-CHAIN STITCH: crossfade on overlap tails (seamless-command.ts + per-engine LUT)
  │
  ▼  ⑨ FILM AUDIT: whole-film VBench-style pass + the visible continuity report
  │
  ▼  FILM
```

Key property: **steps ② and ③ are where continuity is won, and they run on images, not video** — so the expensive, drift-prone part (⑥) starts from a fully pre-validated skeleton. That's how you get LTX-beating continuity without an LTX-sized render bill.

---

## 6. What to build, mapped to the codebase

| # | Change | File(s) | Effort |
|---|---|---|---|
| 1 | Add `endImageUrl` + `supportsEndFrame`; wire Kling `end_image` and Runway keyframes | `_shared/video-engines.ts` | S |
| 2 | Identity **bible** as first-class object; anchor every clip to bible, not neighbor | `generation/chains.ts`, `generation/types.ts` | M |
| 3 | **Storyboard pass**: generate + lock all anchor stills before motion | new `generation/storyboard.ts` + orchestrator hook | M |
| 4 | **CCS** scorer (identity/seam/temporal/color/VLM) | extend `comprehensive-clip-validator` | L |
| 5 | **Continuity gate + correction ladder** in the run loop | `generation/orchestrator.ts`, `pipeline.ts` | L |
| 6 | **Overlap-tail** generation + crossfade-on-overlap | `extractTailFrame.ts`, `_shared/seamless-command.ts` | M |
| 7 | Per-engine **LUT normalization** before xfade | `_shared/seamless-command.ts`, `lut-library.ts` | S |
| 8 | **Continuity report** surfaced in approval UI | `ScriptApproval.tsx`, `PipelineCreation.tsx` | S |

Recommended sequencing: **1 → 3 → 6 → 4 → 5** delivers the biggest continuity gains earliest (end-frame control, then skeleton-first, then seam hiding, then the gate). 2, 7, 8 are force-multipliers layered on top.

---

## 7. Why this beats LTX

- **Structural, not prompt-based.** We bound drift by construction (anchor-to-anchor) instead of fighting it with better text. That holds for 2-minute films, not just 10-second demos.
- **Closed loop.** We *refuse and regenerate* on a scored budget. LTX ships what the model gave it.
- **Cheap where it counts.** Continuity is won on stills (Phase A/B), so the gate doesn't blow the render budget.
- **Invisible multi-model routing as a continuity tool** — not just "more models," but the *right* model per shot's continuity demand.
- **Auditing as a visible, trustable asset.** A continuity report the creator can read is a feature LTX doesn't have and can't easily add without our skeleton-first architecture.

The one-line thesis: **we don't generate a film and hope it's continuous — we prove the skeleton is continuous first, then fill motion between pre-approved anchors, and gate every clip against a continuity budget.**
