# Video Quality & Duration Research — Genesis Director

**Date:** 2026-07-01 · **Method:** codebase audit + 104-agent deep-research sweep (22 sources fetched, 110 claims extracted, 25 adversarially verified: 22 confirmed / 3 refuted). Leaderboard data is a live snapshot (fetched 2026-07-01) and drifts — re-check before big bets.

---

## 0. Current pipeline baseline (verified in code)

- **Orchestration:** Supabase edge fns → Replicate. Unified `hollywood-pipeline` for all engines; sequential dispatch (kling/veo/sora/runway/wan, native audio per clip) vs parallel (seedance, `last_frame_image` chaining + post-mux audio). Stitch: Replicate FFmpeg cog, normalize 1920×1080/30fps/BT.709, chained `xfade` 0.4s, H.264 CRF 18. Post-cores: Topaz 4K (10 cr), RIFE 60fps (5 cr).
- **Engines wired:** Kling V3 (default), Seedance 2.0 pro, Wan 2.5 (free), Veo 3 Fast / Runway Gen-4 Turbo / Sora 2 (cinema tier). Keyframes: Flux 1.1 Pro Ultra / Flux Kontext. Director LLM: Gemini 2.5 Pro.
- **Known failure modes:** Seedance clip-boundary discontinuity despite last-frame conditioning; Kling face/body drift; identity collapse after ~6 clips; ffmpeg-cog stitch fragility.
- **COGS/clip:** Wan 2.5 10s $0.30 · Kling V3 10s $2.69 · Seedance 2.0 10s $5.39 · Veo 3 Fast 8s $3.85 · Runway 10s $3.00 · Sora 2 12s $7.23.

---

## 1. Model landscape (mid-2026, Artificial Analysis arena)

| Model | t2v Elo | i2v Elo | Native audio | Notes |
|---|---|---|---|---|
| **Seedance 2.0** (Dreamina 720p variant) | **1,220 (#1)** | **1,195 (#1)** | ✅ (joint A/V) | Our pro engine — the verified quality ceiling, 68–123 Elo clear of everything |
| **HappyHorse-1.1** (Alibaba-ATH, Jun 2026) | 1,152 (#2) | 1,118 (#2) | ✅ + multilingual lip-sync | **Not wired.** $9.90/min — higher-rated AND cheaper than Kling 3.0 Pro ($20.16/min) |
| grok-imagine-video-1.5-preview (xAI) | — | 1,112 (#3) | — | Not wired |
| **Wan 2.7** (Apr 2026, Apache 2.0) | 1,096 (#8) | 1,092 (#4) | — | **Beats Kling on i2v at ~$0.10/s (~⅓ Kling COGS)**; native first+last-frame control; our Wan 2.5 is two versions stale |
| **Kling 3.0 Pro** (= our "Kling V3" — same model, verified slug match) | 1,105 (#4) | 1,072 (#11) | ✅ + lip-sync | ~115–123 Elo behind Seedance; **weakest exactly at i2v — the mode clip-chaining uses** |
| SkyReels V4 (Skywork) | 1,105 | — | ✅ | 1080p/32fps/15s; ties Kling |
| LTX-2.3 (open weights) | ~951–972 | — | — | Cost floor: $0.04–0.06/s. Draft/free-tier play only (claim of native 20s 4K@50fps was **refuted 0-3**) |
| **Sora 2, Runway, Hailuo, Luma, Pika, Hunyuan** | absent | absent | — | **No arena evidence at all.** Sora 2 is our most expensive engine ($7.23/12s) with zero quality evidence |

**True native long duration is still research-grade.** Rolling Forcing (TencentARC, ICLR 2026) streams multi-minute video in real time but at 832×480. Practical levers that exist NOW: Seedance native extension, Veo 3.1 `extend-video` (~30s total cap, +7s/extension, $0.10–0.15/s on fal), Kling Motion Control 30s single shots (video-reference mode only; image mode caps at 10s — a documented duration-vs-identity trade-off). Seedance 2.5 (native 30s, ~Jun 2026) exists but is unranked — re-evaluate when it hits the arena.

**Caveats:** arena entry is the Dreamina 720p with-audio variant, not our exact Replicate 1080p endpoint; under the no-audio filter HappyHorse leads; arena absence ≠ proven inferiority.

## 2. Quality levers (verified, non-folklore)

### 2a. We are underusing Seedance 2.0 — three zero-cost unlocks
Our code assumes Seedance has **no native audio. That assumption is WRONG** (verified 3-0 against Replicate + BytePlus docs): the endpoint we already call generates joint audio+video ("You can turn audio off if you just want silent video") and accepts **up to 9 reference images, 3 video clips, 3 audio files** for locking appearance, action, style, and voice timbre. We strip dialogue from Seedance prompts and post-mux TTS — we could get temporally-aligned native audio for free.

### 2b. Vendor prompt grammar (BytePlus ModelArk guide, updated 2026-06-29)
- Structure multi-beat videos as a **timeline storyboard in ONE prompt**: "Shot 1 / Shot 2 / Shot 3", each following *subject + action + scene + lighting + camera movement + style + quality + constraints*.
- **Never specify explicit per-segment timings** ("0–3 seconds") — vendor flags this as unstable, causes abnormal outputs.
- Identity: supply a **clean close-up headshot + one full-body photo, placed EARLIEST in the prompt**, with explicit binding ("\<Subject 1\> facial features reference image 1").
- **Multi-view/three-view character sheets are explicitly discouraged** — the model reads the angles as different people and produces "twin" artifacts. ⚠️ Directly contradicts our `multiViewIdentityBible` approach for the Seedance path.

### 2c. Post-processing placement
Current post-cores (Topaz/RIFE) run post-stitch — correct for whole-film upscale/interpolation. What's missing is **per-handoff-frame treatment pre-generation** (see §3): color-match + restore every frame that gets fed forward as conditioning, since conditioning-frame degradation compounds; output-side post-processing can't fix that.

## 3. Duration levers

### 3a. Why our chaining drifts (peer-reviewed)
Rolling Forcing (ICLR 2026) + StreamingT2V (CVPR 2025) confirm: conditioning each segment **only on the last frame of the previous one** structurally accumulates error — matching our observed Seedance boundary discontinuity and ~6-clip identity decay. The fix that works in ablation: a **persistent global anchor** (keeping initial frames as an "attention sink" cut drift metric from 4.63 → 0.01). Clip-level translation: **condition EVERY clip on the same global character reference images**, not just on the previous frame. Frame-to-frame handoff alone can never hold identity.

### 3b. Boundary recipe (vendor-documented)
At every join: **trim 6 frames from the end of the previous segment and 1 frame from the start of the next** (BytePlus). Directly implementable in our FFmpeg cog command. Also: crossfading (`xfade`) between mismatched frames *blends* the discontinuity into visible ghosting; with properly matched handoff frames, a hard cut on the matched frame (with the join trim) is cleaner than a 0.4s fade.

### 3c. Native extension vs stitching (vendor guidance)
Use **native extension for continuous single-scene long takes** (dialogue, one-take shots); use **stitching at scene/action turning points**; combine both. Quality degrades over chained extensions — cap extension depth. Availability: Seedance extension may be Dreamina/ModelArk-only (must verify against our Replicate endpoint); Veo 3.1 extend is live on fal (~30s ceiling).

## 4. Cost/quality map (COGS per second, hosted)

| Option | $/s | Quality evidence | Verdict |
|---|---|---|---|
| LTX-2.3 | $0.04–0.06 | Elo ~951–972 | Free tier / draft-preview only |
| Wan 2.7 (fal) | ~$0.10 | i2v #4 (1,092) | **Best quality-per-dollar; mid-tier + chaining workhorse** |
| HappyHorse-1.1 | ~$0.165 | #2 both (1,152/1,118) | **Kling challenger — better and cheaper** |
| Kling 3.0 Pro | ~$0.27 | #4 t2v / #11 i2v | Overpriced for i2v chaining; keep for lip-sync avatar work |
| Veo 3 Fast | ~$0.48 | unranked | Keep for extend + native audio niche |
| Seedance 2.0 | ~$0.54 | #1 both | Premium ceiling — justified |
| Sora 2 | ~$0.60 | absent | **Deprioritize** — most expensive, zero evidence |

## 5. Prioritized recommendations

### Quick wins (prompt/param only — days, low risk)
1. **Enable Seedance native audio + reference conditioning** on the endpoint we already pay for. Audio parity with Kling at zero engine cost. Verify the Replicate packaging exposes the 9-image/3-video/3-audio inputs (open question — test on first credit top-up).
2. **Rewrite the Seedance prompt tuner** to vendor grammar: Shot 1/2/3 storyboard, formula ordering, no second-marks, headshot+full-body references placed first with explicit subject binding, **stop sending multi-view sheets to Seedance**.
3. **6-frame/1-frame join trim** at every boundary in the stitcher command; prefer matched-frame hard cuts over 0.4s xfade where handoff frames exist.

### Medium (engine/post changes — weeks, medium risk)
4. **Wan 2.5 → Wan 2.7** for the budget tier and as the i2v chaining workhorse (beats Kling on i2v at ⅓ cost, native first+last-frame control).
5. **Pilot HappyHorse-1.1** (via fal) as the standard-tier challenger to Kling — higher Elo, cheaper, native audio + lip-sync. Check commercial licensing terms first (open question).
6. **Deprioritize Sora 2** (hide behind a flag or drop) — most expensive, no evidence.
7. **Native extension for long takes:** Seedance extend (if exposed) / Veo 3.1 extend for ≤30s continuous shots; reserve stitching for scene cuts.

### Large (architecture — a quarter)
8. **Keyframe-driven chaining with persistent identity anchors:** consistent keyframe sequence (Flux/nano-banana) → every clip conditioned on first+last keyframes PLUS the same global character reference images every time (attention-sink principle) → color-match + restore each handoff frame. This is the structural fix for the ~6-clip identity collapse.
9. **Re-evaluate Seedance 2.5** (native 30s) and Kling Motion Control 30s when ranked — native 30s would obsolete much of the chaining for sub-30s scenes.

### Refuted along the way (don't build on these)
- LTX-2.3 "native 20s 4K@50fps" — refuted 0-3.
- Runway Gen-4 "consistent characters from a single reference, no fine-tuning" — refuted 1-2; treat Runway's character-consistency marketing skeptically.

### Open questions (answer on next credit top-up)
- Does our Replicate `bytedance/seedance-2.0` endpoint expose extension + full reference conditioning, or is that ModelArk-only?
- Seedance 2.5 availability/price on Replicate or fal?
- HappyHorse-1.1 licensing + performance on our specific i2v chaining workload?
- Self-hosting Wan 2.7 (Apache 2.0) vs hosted COGS at our volume?

**Key sources:** artificialanalysis.ai video arena + t2v/i2v leaderboards (live 2026-07-01) · BytePlus ModelArk Seedance 2.0 guide (2026-06-29) · Replicate bytedance/seedance-2.0 · fal.ai model/pricing pages · Rolling Forcing (ICLR 2026, arXiv:2509.25161) · StreamingT2V (CVPR 2025) · Google Vertex Veo extend docs · Runway Gen-4 announcement.
