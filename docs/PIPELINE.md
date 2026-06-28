# Creation Pipeline — authoritative design + cleanup plan

Status: **design of record.** Consolidates the four-domain inventory (creation
modes, engines, continuity/frame configs, stage machine) with the live engine
audit (2026-06-27). This is the single source of truth for the creation
pipeline; reconcile code to it, not the reverse.

> Audit note: every engine + support model below was verified live against the
> Replicate API on 2026-06-27 (all resolve, all healthy). Slugs here are the
> **live** `generate-single-clip` route labels — they win over `model-catalog.ts`
> where the two disagree.

---

## 1. The demand

### Creation modes (`src/types/video-modes.ts`)

| Mode | Script? | Required input | Router handler | Pipeline |
|---|---|---|---|---|
| text-to-video | ✅ multi-shot | prompt | handleCinematicMode | hollywood (seedance if breakout/engine) |
| image-to-video | ✅ | image + prompt | handleCinematicMode | hollywood |
| b-roll | ✅ | prompt | handleCinematicMode | hollywood |
| avatar (direct) | ❌ verbatim TTS | avatar image + script | handleAvatarDirectMode | generate-avatar-direct (Kling) |
| avatar (cinematic) | ✅ | concept + avatar image | handleAvatarCinematicMode | seedance |
| video-to-video | ❌ | source video + style | handleStyleTransferMode | stylize-video |
| motion-transfer | ❌ | source video + target image | handleMotionTransferMode | motion-transfer |

Feature flags (not modes): `isBreakout` (→ seedance), `crossoverTemplateSlug`
(50 VFX templates), training-video wizard (→ avatar).

### Engines — LIVE slugs (audited 2026-06-27)

| Engine | Live slug | Durations | Audio | Img→Vid | End-frame A→B | Runs |
|---|---|---|---|---|---|---|
| Kling V3 *(default)* | `kwaivgi/kling-v3-video` | 5/10/15 | ✅ | ✅ | ✅ | 329k |
| Seedance 2.0 | `bytedance/seedance-2.0` | 5/10/12 | ✅ | ✅ | ✅ (last_frame_image) | 886k |
| Wan 2.5 *(free)* | **`wan-video/wan-2.5-t2v`** | 5/10 | ❌ | ✅ | ❌ | 36k |
| Veo 3 Fast | `google/veo-3-fast` | 4/6/8 | ✅ | ✅ | ❌ | 203k |
| Runway Gen-4 | `runwayml/gen4-turbo` | 5/10 | ❌ | ✅ | ✅ | 108k |
| Sora 2 | `openai/sora-2` | 4/8/12 | ✅ | ✅ | ❌ | 334k |

> ⚠️ Reconciliation: `model-catalog.ts` lists Wan as `wan-ai/...` — **stale.**
> Live + verified = `wan-video/wan-2.5-t2v`. Fix the catalog to match.

Support models (audited): `black-forest-labs/flux-1.1-pro-ultra`,
`black-forest-labs/flux-1.1-pro` (scene/start/portrait images),
`bytedance/latentsync` (universal lip-sync), `minimax/speech-2.6-turbo` (TTS),
`magpai-app/cog-ffmpeg` @ `efd0b79b…` (stitch + finishing).

Engine selection: DB `movie_projects.video_engine` lock → `routing_map[shot].engine`
per-shot override → `_shared/shot-engine-router.ts` auto-score (dialogue→Kling,
character→Runway, motion→Seedance, audio/establishing→Veo/Sora, free→Wan).

### Continuity (`src/lib/video/continuity/*`)
Identity Bible (identityDNA, canonicalStillUrl, faceEmbedding, wardrobeDNA,
antiMorphPrompts) + StyleAnchor. Character Lock {strict|loose}. Boundary
contracts CONTINUOUS / MATCH / LOCATION_CHANGE / INTRO — per-dimension
hard|soft|off across identity/wardrobe/boundary/temporal/color/vlm + carryFrame +
overlapMs. Frame chaining via startImageUrl (prev last frame) / endImageUrl
(bounded interpolation). Cast ≤8 with VoiceProfile per character.

### Formats
Aspect 16:9(def)/9:16/1:1/21:9/4:5/4:3 (engine-mapped). Clips 1–20 (def 6),
duration {5,10,…}. Quality 720p/1080p/4K, fps 24/30/60; `qualityOptions`
{upscale4k +10cr, fps60 +5cr, autoRetake} applied **once at finalize**.

---

## 2. Designed pipeline

```mermaid
flowchart TD
  ENTRY[Studio / Training / Crossover / Editor] --> MR{{mode-router\nNORMALIZE → canonical request}}
  MR --> CLS{Script-generating?\n(server-derived from mode)}
  CLS -->|NO scriptless| DIRECT[avatar-direct / video-to-video / motion-transfer]
  CLS -->|YES cinematic| PREP[1 PREPRODUCTION\nscript + identity bible]
  PREP --> GATE{{2 APPROVAL GATE — FAIL-CLOSED}}
  GATE -->|approved| QG[3 QUALITY GATE]
  GATE -->|regenerate| PREP
  QG --> ASSET[4 ASSETS\nvoice / music / sfx / storyboard seeds]
  ASSET --> PROD[5 PRODUCTION LOOP\nper-shot · router · continuity]
  DIRECT --> FIN
  PROD --> FIN
  FIN[seamless-stitcher → qualityOptions finalize → completed]
  FIN -. realtime .-> ENTRY
```

### Fig. 3 — fail-closed approval gate *(the spend-leak fix)*
```mermaid
flowchart TD
  A[script produced] --> B{already approved?}
  B -->|yes| PASS[→ qualitygate]
  B -->|no| C{server rule: mode is script-generating?}
  C -->|no scriptless| PASS
  C -->|yes| D{explicit autoApprove == true from trusted caller?}
  D -->|yes| LOG[log reason] --> PASS
  D -->|no/absent/other| HOLD[status=awaiting_approval\npersist script + tasks · STOP]
  HOLD --> U{user on /production}
  U -->|Approve / Edit| RES[resume-pipeline · skipApproval · idempotent] --> PASS
  U -->|Regenerate| REGEN[regenerate_script] --> A
```
**Why iron-clad:** every cinematic run pauses unless the server explicitly says
otherwise. A forgotten flag (the Crossover/Template/Studio leak) now safely
pauses instead of silently spending. Only opt-out is `autoApprove:true` from a
trusted caller.

### Fig. 4 — per-shot engine router (capability-agnostic)
```mermaid
flowchart TD
  A[shot i tags: dialogue, needs-audio, character-heavy, motion, boundary] --> L{DB engine lock?}
  L -->|breakout| SE0[FORCE seedance]
  L -->|locked| USE[locked engine]
  L -->|auto| SCORE[scoreShot · capability matrix]
  SCORE --> CAP{engine supports duration + aspect + end-frame?}
  CAP -->|no| ADJ[snap duration / map aspect / drop end-frame · log degradation]
  CAP -->|yes| OK[dispatch generate-single-clip]
  ADJ --> OK
```

### Fig. 5 — production loop + continuity
```mermaid
flowchart TD
  START[shot i] --> BT{boundaryType → contract}
  BT --> CHAIN{carryFrame && prev.last_frame?}
  CHAIN -->|yes| SF[startImageUrl = prev.last_frame_url]
  CHAIN -->|no| SF0[startImageUrl = storyboard seed or null]
  SF --> EF{endAnchor && engine supports end-frame?}
  SF0 --> EF
  EF -->|yes| BND[bounded interpolation A→B]
  EF -->|no| OPEN[open-ended]
  BND --> GEN[generate-single-clip → poll]
  OPEN --> GEN
  GEN --> AUD{continuity-gate score}
  AUD -->|pass| WRITE[video_clips + last_frame_url] --> NEXT[continue-production i+1]
  AUD -->|soft fail| CORR[targeted correction] --> GEN
  AUD -->|hard fail| RETRY{attempt<3?}
  RETRY -->|yes| GEN
  RETRY -->|no| MARK[mark failed → refund 1 clip] --> NEXT
  NEXT -->|done| STITCH[seamless-stitcher]
```

---

## 3. Cleanup actions (this lane owns)

1. **Fail-closed approval gate** (Fig. 3) — make pausing **server-derived from
   mode**, not a client flag. Closes the Crossover/Template/Studio spend-leaks.
   *Open decision: do scriptless/quick-gen modes also pause, or stay exempt?*
2. **Engine-slug reconciliation** — fix `model-catalog.ts` Wan slug to
   `wan-video/wan-2.5-t2v`; add a FE↔BE parity check so they can't drift.
3. **Delete dead code** — the `python/**` engine is confirmed dead (live path is
   edge fns + Replicate). Remove it and any orphaned references.
4. **Capability-driven dispatch** — fold the per-shot CAP check (Fig. 4) so a 7th
   engine is data, not new branches.
5. **Quality post once, at finalize** — keep 4K/60fps as a single finalize pass,
   charged on actual output (already true in the new Finishing Studio).

## 4. Production-superiority layers already shipped (this session)

These plug into the design above and are **live in prod**:
- **Finishing Studio** — house-grade + 4K + 60fps finalize pass (Fig. 2 FIN).
- **Per-shot model router** — Fig. 4, `routing_map` + `route-shots`.
- **Universal lip-sync** — LatentSync over any engine's output (ASSETS/finalize).
- **Storyboard/previz gate** — FLUX keyframes → `scene_images` seed (ASSETS).
- **Cast & Worlds library** — reusable identity assets (`director_cast`) feeding
  the Identity Bible.

---

## 5. The unified pipeline (target) — one pipeline, everything is data

**Goal:** one pipeline that produces *anything*, on *any* engine, under *any*
continuity/pose-chaining. Today there are 5 mode handlers + 2 pipeline variants;
they are the **same loop** wearing different clothes. Unify by making mode,
engine, and continuity **inputs**, not branches.

### One canonical request (the contract everything speaks)
`mode-router` does ONE job: **normalize** every entry surface into a
`production_request`, then hand it to the single pipeline.

```jsonc
{
  "mode": "text|image|broll|avatar|video2video|motion-transfer",
  "engine": "auto|kling|seedance|wan|veo|runway|sora",   // auto → per-shot router
  "inputs": { "prompt":"", "image_ref":null, "source_video":null, "avatar_ref":null },
  "script": { "generate": true, "shots": [] },           // generate=false → scriptless
  "continuity": { "contract":"continuous|match|location-change|intro",
                  "carryFrame":true, "endAnchor":null, "pose_chain":null,
                  "identity_lock":"strict|loose|off" },
  "format": { "aspect":"16:9","clips":6,"duration":5,"quality":{"upscale4k":false,"fps60":false} },
  "audio": { "narration":true, "music":true, "voiceId":null },
  "gate": { "require_approval": true }                    // FAIL-CLOSED, all modes (your call)
}
```

### One per-shot operation (the only thing that varies)
The single production loop dispatches each shot by an **operation** resolved from
the request — every engine and mode reduces to one of these:

| op | from mode | engine input | continuity |
|---|---|---|---|
| `t2v` | text/b-roll | prompt | start-frame chain |
| `i2v` | image | image_ref + prompt | start-frame chain |
| `avatar` | avatar (direct/cinematic) | avatar_ref + TTS | none / start-chain |
| `stylize` | video-to-video | source_video + style | per-frame |
| `pose-transfer` | motion-transfer | source_video + target | pose_chain |

`generate-single-clip` already speaks engine-agnostic; the loop just selects the
op + feeds the continuity contract (start/end frame, pose ref). **A 7th engine or
a new op is a row in a table, not a new handler.**

### Handler-collapse map
| Today | Folds into the one loop as |
|---|---|
| handleCinematicMode | script=true · op t2v/i2v · router/lock engine |
| handleAvatarCinematicMode | script=true · op avatar · engine seedance · audio overlay |
| handleAvatarDirectMode | script=false · 1 shot · op avatar · Kling native audio |
| handleStyleTransferMode | script=false · op stylize |
| handleMotionTransferMode | script=false · op pose-transfer |
| hollywood vs seedance pipeline | one pipeline; "seedance/breakout" = engine lock |

### Fail-closed gate — ALL modes (decided)
The gate moves to the **normalizer output**: every `production_request` is
created `status=awaiting_approval` and the pipeline does NOT dispatch until an
explicit approve (or a trusted `gate.require_approval=false`). Scriptless modes
get a lightweight "confirm spend" approval; script modes get the existing
shot-review. No client flag can leak a free render.

---

## 6. Staged migration (no big-bang on the fragile core)

1. **Stage 1 — contract + gate (additive).** Land the `production_request`
   normalizer in `mode-router` and the fail-closed gate; keep dispatching to the
   existing 5 handlers unchanged. *Behavior change: everything pauses; nothing
   else moves.* Validate the gate on each mode.
2. **Stage 2 — op abstraction.** Introduce the per-shot `operation` resolver and
   route the 3 cinematic-ish handlers (cinematic, avatar-cinematic, avatar-direct)
   through one loop. Keep stylize/motion-transfer on their handlers.
3. **Stage 3 — fold the scriptless ops** (stylize, pose-transfer) into the loop.
   Delete the 5 handlers + the duplicate pipeline variant.
4. **Stage 4 — cleanup.** Remove `python/**` (dead), reconcile `model-catalog.ts`
   ↔ live slugs with a parity test, single capability table.

Each stage ships behind validation and is independently revertible.
