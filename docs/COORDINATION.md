# Creative-Pipeline Coordination Ledger

> 🗄️ **HISTORICAL — no longer in effect.** The project has transitioned to
> **single-owner** orchestration. The two-lane split and the "never edit the
> other lane's files" rule below are kept for context only; pipeline work now
> flows through ONE unified orchestrator (`hollywood-pipeline` + dispatch
> strategy) and file ownership is no longer bifurcated. The interface contracts
> (production_bible, video_clips columns) are still useful reference. For the
> current design see **`docs/PIPELINE.md`** (the authoritative doc).

Two agents are improving the creative output of the app in parallel. This file
is the shared source of truth: **read it before touching anything; update the
Status board when you start/finish a lane.** The goal is zero collisions on
`main` (we already paid for not having this once).

> Rule of thumb: **never edit a file owned by the other lane.** Where our work
> meets, we use the **interface contracts** below and build the producer/consumer
> independently.

---

## Lanes

### 🎬 Lane A — VFX / Generation (the "Houdini" — visual layer)
Owns the look: shot generation quality, special effects, character identity
consistency, compositing.

### 🎼 Lane B — Audio / Finishing / Orchestration (the "Cameron" — direction + post)
Owns intent + polish: the Director Brain that writes the production bible, the
post-production finishing chain, and all audio (SFX, score, voice, lip-sync, mix).

---

## Ownership map (file/function level)

### Lane A owns — DO NOT EDIT from Lane B
- `supabase/functions/generate-single-clip`
- `supabase/functions/generate-scene-images`
- `supabase/functions/generate-character-for-scene`
- `supabase/functions/generate-avatar-scene`
- `supabase/functions/composite-character`
- `supabase/functions/extract-scene-identity`
- `supabase/functions/scene-character-analyzer`
- `supabase/functions/route-shots` (visual shot routing)
- `supabase/functions/comp_engine/*` (procedural compositor)
- NEW (Lane A to build): `verify-character-identity`, `generate-identity-bible` (visual identity side)
- Frontend: `src/pages/BreakthroughLab.tsx`, `src/pages/Crossover.tsx`, breakthrough-effects templates, studio visual/effect components
- The `breakthrough-fx` effort (visual effects engine)

### Lane B owns — DO NOT EDIT from Lane A
- `supabase/functions/hollywood-pipeline` (the orchestrator)
- `supabase/functions/seamless-stitcher`, `final-assembly`, `pipeline-watchdog`
- `supabase/functions/smart-script-generator`, `seedance-script-director`, `director-chat` (the Director Brain / bible producer)
- ALL audio: `elevenlabs-sfx`, `elevenlabs-music`, `generate-music`, `generate-voice`, `editor-tts`, `apply-lipsync`, `regenerate-audio`, `sync-music-to-scenes`, `scene-music-analyzer`, `fix-manifest-audio`
- Finishing: `upscale-video`, `apply-color-grading` (NEW, Lane B to build), `continuity-audit`, `validate-seam-continuity`
- `_shared/audio-mix-filters.ts`

### Shared — change ONLY by mutual agreement (note it in Status board first)
- The **production-bible** schema (contract #1)
- The **video_clips** output columns (contract #2)
- `hollywood-pipeline`'s call-sites that invoke Lane A functions (Lane B calls,
  Lane A implements the function bodies)

---

## Interface contract #1 — `production_bible` (v1)

Lane B **produces** this from the prompt; Lane A **consumes** the `characters`
+ `scenes[].shots[]` fields to render; Lane B's audio/finishing consume
`sound_plan` + `finishing`. Additive changes only without a version bump.

```jsonc
{
  "version": 1,
  "meta": { "title": "", "logline": "", "genre": "", "aspect": "16:9",
            "target_duration_s": 0, "look": "" },           // look = reference style/era
  "characters": [
    { "id": "c1", "name": "", "identity_ref": "url|null",     // Lane A: lock identity to this
      "descriptors": "", "wardrobe": "" }
  ],
  "scenes": [
    { "id": "s1", "beat": "", "mood": "", "environment_ref": "url|null",
      "shots": [
        { "id": "s1-001", "type": "wide|medium|cu|ots|insert",
          "camera_move": "static|push|pull|pan|track|crane",
          "character_ids": ["c1"], "action": "",
          "vfx_tags": [],                                     // Lane A applies (e.g. "rain","muzzle-flash")
          "look_intent": "", "duration_s": 0,
          "model_hint": "kling|veo|sora|wan|seedance|auto" }
      ]
    }
  ],
  "sound_plan": {                                             // Lane B consumes
    "scenes": [ { "id": "s1", "sfx": [{ "at_s": 0, "cue": "" }],
                  "score": { "mood": "", "tempo": 0, "enter_s": 0, "duck_under_vo": true } } ]
  },
  "finishing": { "identity_lock": true, "upscale": true, "color_grade": "ref|lut|none", "palette": "" }
}
```

## Interface contract #2 — clip output (`video_clips`)

Lane A **writes** these when a shot renders; Lane B's finishing/stitcher
**reads** them. Coordinate before adding/removing columns.

| field | written by | meaning |
|---|---|---|
| `project_id, scene_id, shot_id, shot_index` | A | identity of the shot |
| `status, video_url, last_frame_url` | A | result + frame-chain handoff |
| `identity_ref_used` | A | which character ref was locked (for verify) |
| `vfx_applied[]` | A | effects baked in |
| `width, height, fps` | A | source res → finishing decides upscale |

---

## Git protocol
- Branch names: Lane A → `feat/creative-vfx-*`, Lane B → `feat/creative-audio-*`.
- **`git fetch origin main` + rebase/merge before every work session** (main moves fast).
- Small, frequent PRs. Don't batch a 40-file mega-merge.
- Never edit a file in the other lane's ownership list. If you must, post it in
  the Status board and hand it off.
- `hollywood-pipeline` is Lane B's; if Lane A needs a new function called, ask
  Lane B (in Status board) to add the call-site, then implement the body.

---

## Status board (update every session)

| When | Lane | Working on | Branch | State |
|---|---|---|---|---|
| 2026-06-27 | A | Set up coordination + claiming VFX/generation lane | `feat/creative-vfx-gen` | bootstrapping |
| 2026-06-27 | B | (other agent — please fill in) | — | — |
