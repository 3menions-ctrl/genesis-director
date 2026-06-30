# Genesis Director — Creation Pipeline E2E Verification

Deep, evidence-based audit of every creation type through the entire pipeline.
Method: trace the real wiring from code (citing `file:line`), execute the
deterministic parts, and be explicit about what could not be safely run live.

## Documents
- **[00-FLOWCHART.md](00-FLOWCHART.md)** — master + per-type mermaid flowcharts, component connection map (citations)
- **[01-INVENTORY.md](01-INVENTORY.md)** — all creation types, all template types, the combination matrix
- **[02-STAGES.md](02-STAGES.md)** — stage-by-stage verification (WIRED/PARTIAL/BROKEN/DEAD + evidence)
- **[03-E2E.md](03-E2E.md)** — per-combination PASS/PARTIAL/FAIL, with what was executed vs traced
- **[04-GAPS.md](04-GAPS.md)** — prioritized gaps + concrete fixes

## Executive summary

**The biggest finding is architectural: the pipeline isn't shaped the way the brief
assumes.** There is no "Python engine" in the live path — `python/breakout_pipeline/`
is standalone, never invoked, and can't even run here (`ModuleNotFoundError: numpy`).
The real pipeline is a chain of **Supabase edge functions calling cloud APIs**:

```
Studio/Crossover → mode-router → hollywood-pipeline → smart-script-generator
  → [generate-single-clip (Replicate) → poll → persist → extract-frame → continue-production]⟲
  → final-assembly → seamless-stitcher (Replicate ffmpeg) → published-renders → Production UI
```

**What works (verified):**
- ✅ Scripting: generated → persisted → rendered in the Production "script page" (real DB data).
- ✅ Clip generation + filing: 6 engines; Replicate temp URLs are downloaded & re-uploaded to the **public** `video-clips` bucket — durable, not ephemeral.
- ✅ Frame-chaining continuity (live): `last_frame_url` end→start handoff with a 3-tier lookup.
- ✅ Stitching: **real** server FFmpeg (run as a Replicate cog) with `xfade` crossfades + `acrossfade` audio sync + `loudnorm`. The graph builder is **unit-verified** — I ran 383 deterministic render/pipeline tests, all pass.
- ✅ Studio/Library UI play the real stitched MP4 (+ a client-side per-clip fallback).

**What's broken or fake (verified):**
- 🔴 **Editor render path is dead** — `installJobRunner` has zero call sites; every editor render CTA dead-ends. The whole Editor storyboard/continuity engine is design-complete but inert.
- 🔴 **`ProjectType` (5 types) is dead** — referenced only by tests; no UI picker. The live axis is `mode-router`'s 6 `mode` values.
- ⚠️ **Final-film URL expires in 24h** and is never re-signed on reopen → completed projects 404 after a day.
- ⚠️ **The 38-template "unified registry" never drives a render** — it feeds only the gallery; the runtime resolves `?template=` against a *separate* legacy list.
- 🔴 **No edit → re-render propagation** — editing a script/shot never invalidates downstream clips/frames.
- ⚠️ **Continuity *scoring* isn't load-bearing** — flat `score>=75` gate, no real seam metric; `continuity-audit` has zero callers.
- 🔴 Orphans: `generate-story`, `free-tier-generate`; stale `SmartStitcherPlayer`/"MANIFEST-ONLY" references.

**Scope honesty:** the full cloud chain was **not fired live** — it's billable
(OpenAI + Replicate per clip) and there's no staging sandbox wired in this repo.
Per-combination verdicts in `03-E2E.md` are code-traced with deterministic-test +
CLI-run support; `04-GAPS.md` includes a ~8-run live harness to use once staging
creds + budget are available.

## Combination matrix (condensed — see 01-INVENTORY.md)

| Creation type | Best template path | Verdict |
|---|---|---|
| Studio text/image-to-video | raw / legacy template / environment | **PASS** (24h-URL caveat) |
| Studio text-to-video | **unified registry** template | **PARTIAL** — id not resolved at runtime |
| Studio video-to-video / motion-transfer | source video | **PARTIAL** — single clip, no script/stitch |
| Crossover | vfx_templates (×50) | **PASS** |
| Studio / breakout | BREAKOUT_TEMPLATES (×10) | **PASS** (Python recipes never run) |
| Avatar | avatar_templates | **PASS** |
| Ad Studio / Training / Music | own surfaces | **PASS*** (separate output path) |
| **Editor NLE render** | any | **FAIL** — dead runner |
| **Production ProjectType** | any | **FAIL** — dead/test-only |
