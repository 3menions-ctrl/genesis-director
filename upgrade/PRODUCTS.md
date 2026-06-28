# PRODUCTS CATALOG — everything Genesis Director can create

Evidence-based, branch `upgrade`. Every product traced UI → dispatch → edge-fn pipeline → external model → finished artifact, with **live-vs-dead** honesty (verified by actual reachability, not "exists in code"). Status: **LIVE** (reachable + runs end-to-end) · **PARTIAL** (reachable but degraded/unfinished) · **DEAD** (code exists, no UI caller / unreachable) · **STUB** (placeholder, no real work).

## How creation works (the spine)
- **One entry, one dispatch:** `/studio` → `src/pages/Studio.tsx` → the live `CreationStudio` component → a single call to edge fn **`mode-router`** (`Studio.tsx:453`). `mode-router` routes by `mode` + `videoEngine` to the real pipeline. (The `engines.ts` `pipelineFunction` map is **test-only** and contradicts runtime routing — ignore it.)
- **The runtime route:** everything except `seedance`/breakouts → **`hollywood-pipeline`**; `seedance` + all breakouts → **`seedance-pipeline`**; avatar/v2v/motion have dedicated single-pass fns. (`mode-router/index.ts:1216-1234,539-603`)
- **Finished video lands** as a stitched MP4 in the private **`published-renders`** bucket, URL written to `movie_projects.video_url`, shown on `/production/:id` → Library / Reel / publish.

---

## A. VIDEO PRODUCTS — LIVE (user-reachable, run end-to-end)

| # | Product | What the finished thing is | Entry (UI) | Pipeline (ordered) → model | Status / evidence |
|---|---|---|---|---|---|
| 1 | **Cinematic film (text-to-video)** | Multi-scene narrated + scored MP4 stitched from N AI clips | Studio → Generate → "Cinematic", any engine | `mode-router` → `hollywood-pipeline` (`smart-script-generator` gpt-4o → `extract-scene-identity` gpt-4o → per-clip `generate-single-clip` → `poll-replicate-prediction`/`replicate-webhook` → `continue-production` (frame-chained) → `final-assembly` → `seamless-stitcher` ffmpeg-on-Replicate). Narration `generate-voice` (ElevenLabs/MiniMax), music `generate-music` | **LIVE** — `Studio.tsx:453`, `hollywood-pipeline:3671,6682` |
| 2 | **Image-to-video / "Animate"** | Same as #1 but animated from a reference image anchor | Studio → "Animate" + reference image | Same as #1; `mode-router` validates `imageUrl` (`:610-618`) | **LIVE** |
| — | **Engine choices for #1/#2** | The look/quality of the clips | Engine grid | `generate-single-clip` native branches (`:1680-1739`): **wan**→`wan-video/wan-2.5-t2v` · **kling**→`kwaivgi/kling-v3-video` · **veo**→`google/veo-3-fast` · **sora**→`openai/sora-2` · **runway**→`runwayml/gen4-turbo` · **seedance**→`bytedance/seedance-2.0` (routes to seedance-pipeline) | **LIVE.** Veo/Sora/Runway gated behind `studio_cinema` entitlement |
| 3 | **Avatar talking-head (Kling)** | A cast avatar speaking the script, native lip-sync, optional generated background, multi-clip | Studio → "Avatar" mode + Cast pick | `mode-router` `handleAvatarDirectMode` → `generate-avatar-direct` (optional `generate-avatar-scene` FLUX-Kontext-Pro still) → Kling V3; recovery `resume-avatar-pipeline` | **LIVE** — `mode-router:564-579`, `generate-avatar-direct:783` |
| 4 | **Avatar cinematic (Seedance)** | Avatar carried as Identity Bible across full multi-scene film | Studio → "Avatar" + Seedance engine | `mode-router` `handleAvatarCinematicMode` → `seedance-pipeline` | **LIVE** — `mode-router:539-558` |
| 5 | **Breakout / 4th-wall video** | ~15s 3-clip video of a cast member bursting out of a platform UI (10 effects) | Studio → Templates → Breakouts | force-locked to Seedance (`forceBreakoutEngine`) → `seedance-pipeline` (hardcoded 3-act shots, `generate-scene-images` FLUX-1.1-pro-ultra, `bytedance/seedance-2.0`, `seamless-stitcher`). **Bypasses script approval** | **LIVE** — `CreationStudio.tsx:812-873`, `_shared/breakout-guardrails.ts` |
| 6 | **Training video** | Talking-head presenter teaching a script (27 voices, stock presenters) | `/training-video` & `/business/learning` | `composite-character` (remove-bg + FLUX-1.1-pro → presenter-on-scene still) → `mode-router` `mode:avatar` → Seedance or Kling → `movie_projects.video_url` + `training_videos` row | **LIVE** — `TrainingVideo.tsx:393,479` (webcam capture is a stub) |
| 7 | **Editor-generated clip** | A new AI clip created inside the editor timeline | Editor → CreatePanel ("+ Create"/N) | `editor-generate-clip` → Replicate Seedance-1-Pro / Wan-2.5 / Kling-V3, continuity-chained → `video-clips` bucket + per-user "Editor Library" project | **LIVE** — `CreatePanel.tsx:244`, `editor-generate-clip:19-22` |
| 8 | **Custom avatar portrait** | A reusable presenter still to drive #3/#5 | Studio → Cast → "Build your own" | `generate-avatar-image` → `google/gemini-2.5-flash-image` (Lovable GW) → `avatars` bucket | **LIVE** (but ephemeral — see Caveats) |

## A′. VIDEO PRODUCTS — PARTIAL / DEAD

| Product | Status | Why | Evidence |
|---|---|---|---|
| **Crossover** (`/crossover`) | **PARTIAL / mis-wired** | Creates a real video, but `crossoverTemplateSlug` is **silently dropped** by the backend and no engine is sent → degrades to a generic Kling text-to-video; displayed VFX/engine/credit cost are cosmetic | `Crossover.tsx:558`, `TemplateComposer.tsx:71`; slug unreferenced in `supabase/functions/` |
| **Video-to-video (stylize)** | **PARTIAL / orphaned** | `stylize-video` fires a real Replicate render, but **no UI emits `mode:video-to-video`** and **nothing polls/webhooks it** → result never reaches `video_url`; project stalls | `stylize-video:61`; no completion wiring |
| **Motion-transfer** | **PARTIAL / orphaned** | Same as above — real submit, no UI, no completion handler | `motion-transfer:113` |
| **Free-tier generate** | **DEAD** | Complete Wan-2.5 5s/480p function with tables/RPCs but **zero callers** anywhere | `free-tier-generate:164` |
| **Breakthrough film render** | **DEAD** | `executeBreakthroughRender` is a real `generate-video`→stitcher DAG but **only unit tests call it**; the Breakthrough Lab UI is a WebGL demo with no render | `lib/templates/breakthrough/execute.ts:94` |
| **`render-video`, `generate-video` (as core)** | **DEAD / non-core** | `render-video` 0 callers; `generate-video` only used by seedance-pipeline + the dead breakthrough path. Real renderer is `generate-single-clip` | grep 0 callers |

---

## B. IMAGE / PHOTO PRODUCTS — LIVE

| Product | Entry | Pipeline → model | Artifact / storage | Status |
|---|---|---|---|---|
| **Photo Editor — template transform** | `/studio` → Photo Editor | `edit-photo` → Lovable `google/gemini-3-pro-image-preview` | PNG, private `photo-edits`, signed URL | **LIVE** `PhotoEditorHub.tsx:99` |
| **Photo Editor — AI chat edit** | same | `edit-photo` (same) | same | **LIVE** `:169` |
| **Photo Editor — remove object (inpaint)** | same | `inpaint-photo` → Replicate `black-forest-labs/flux-fill-pro` | PNG, `photo-edits` | **LIVE** `inpaint-photo:286` |
| **Photo Editor — bulk edit** | same | loops `edit-photo` | same | **LIVE** `PhotoBulkPanel.tsx:92` |
| **Image Studio (text-to-image / remix)** | `/studio` → Image Studio | `studio-image` → Replicate `flux-schnell`, HQ/ref `flux-1.1-pro` | PNG, public `scene-images` + `user_media_assets` | **LIVE** `ImageStudioHub.tsx:225` (UI says "Nano Banana" but calls FLUX — cosmetic mismatch) |
| **Build-your-own avatar portrait** | `/studio` → Cast | `generate-avatar-image` → `google/gemini-2.5-flash-image` | PNG, public `avatars` | **LIVE** (ephemeral) |

Internal-only image helpers (not standalone products): `analyze-reference-image`, `extract-scene-identity`, `composite-character`, `generate-scene-images`. Dead: `svg-rasterize`.

---

## C. AUDIO PRODUCTS — LIVE

| Product | Entry | Pipeline → model | Artifact / storage | Status |
|---|---|---|---|---|
| **Score Studio (music)** | `/music` | `generate-music` → Replicate MusicGen Stereo Large (fallback Melody) | MP3, private `voice-tracks`, 7-day signed URL → "My Tracks" | **LIVE** `MusicHub.tsx:163` |
| **In-editor music** | Editor timeline | `generate-music` (30s cap) → A2 track | — | **LIVE** `Timeline.tsx:522` |
| **Upload track (BYO)** | `/music` | client upload (no edge fn) | public `video-clips` | **LIVE** `MusicHub.tsx:508` |
| **Voice-over (TTS)** | Editor right rail | `editor-tts` → ElevenLabs `eleven_turbo_v2_5` | MP3, public `video-clips`, A1 clip | **LIVE** `editor-tts:56` |
| **Auto-captions (STT)** | Editor TakesDrawer | `editor-transcribe` → ElevenLabs `scribe_v2` → baked text overlay | text | **LIVE** `editor-transcribe:40` |

Internal-only: `generate-voice` (narration for video flows; deliberately hidden from "My Tracks"), `sync-music-to-scenes`, `scene-music-analyzer`. **Dead (no callers): `elevenlabs-music`, `elevenlabs-sfx`, `regenerate-audio`.** ⇒ **No SFX product and no standalone voice/narration product exist**, despite backend scaffolding.

---

## D. TEXT / CREATIVE-AID PRODUCTS

| Product | Entry | Pipeline → model | Output | Status |
|---|---|---|---|---|
| **Ad Concept package** | `/business/ad-studio` | `generate-ad-studio` → OpenAI `gpt-4o-mini` | JSON → on-screen + Markdown download + "Send to Create"; **text only, nothing stored** | **LIVE** `BusinessAdStudio.tsx:148` |
| **Variant Lab (hook × aspect)** | same | `generate-ad-variants` → `gpt-4o-mini` | text variants, Markdown export | **LIVE** `:466` |
| **Director Chat** | Editor | `director-chat` → AI gateway | chat reply + script edits | **LIVE** |
| **Script generation** | Editor → Script view | `generate-script` | script document | **LIVE** (in-editor tool, not standalone) |
| **Clip-repair assistant** | studio FailedClipsPanel | `script-assistant` | prompt fix | **LIVE (narrow)** |

Internal: `smart-script-generator`, `seedance-script-director`. **Dead: `hoppy-chat`, `landing-demo-chat`, `editor-ai-scene` (text-only anyway), `director-card`.** No standalone "script writer" product.

---

## E. BROWSE / PRESET / STATS SURFACES (not real creation, or PARTIAL)

| Surface | What it is | Status |
|---|---|---|
| **Templates** (`/templates`) | 37 shot-sequence blueprints → `/studio` | **PARTIAL** — only the concept text forwards; rich `templateShotSequence/styleAnchor/characters/environmentLock` are dropped by live `CreationStudio` (`Studio.tsx:289`) |
| **Environments** (`/environments`) | 122 prompt-preset blueprints | **PARTIAL** — ~102/122 fail "Environment not found"; only 20 wired (`useTemplateEnvironment.ts:61`) |
| **Channel Worlds** (`/world/:slug`) | seeded editorial taxonomy | **PARTIAL/orphaned** — no inbound nav, not user-creatable |
| **Avatars vault** (`/avatars`) | browse/cast presenters | **LIVE browse only** — no create affordance |
| **Director Cards** (`/me/year`) | Spotify-Wrapped-style annual stats | **LIVE but client-only** (no pipeline/storage); the `director-card` edge fn is **DEAD** |
| **Breakthrough Lab** (`/breakthrough-lab`) | WebGL 4th-wall FX playground | **LIVE marketing demo — generates nothing** |
| **Hidden Room** (`/loft`) | procedural-poem easter egg | **LIVE client-only — nothing persisted** |

---

## F. DERIVED / SECONDARY ARTIFACTS (made from a finished project)

| Artifact | Trigger | Pipeline → model | Status |
|---|---|---|---|
| **Thumbnail / poster** | auto on finalize | `generate-project-thumbnail` → Replicate `lucataco/frame-extractor` → `thumbnails` bucket → `movie_projects.thumbnail_url` | **LIVE** |
| **Frame extraction** | auto (continuity) | `extract-video-frame` → frame-extractor → `temp-frames` | **LIVE (internal)** |
| **HLS playlist** | server-side | `generate-hls-playlist` → `.m3u8` | **PARTIAL/orphaned** — no caller; target `hls-playlists` bucket not in migrations → fallback to raw clip URLs |
| **Auto trailer** | — | `generate-project-trailer` → stitcher "trailer" mode | **DEAD** — only a comment references it; `project_shares.trailer_url` never rendered |
| **Premiere recap** | — | `premiere-recap` → stats JSON | **DEAD** — zero callers |
| **Branded download** | — | `brand-video-download` → prepend intro | **DEAD + STUB** — no caller, and the "mux" is a naive byte-concat, not real ffmpeg |

---

## G. DELIVERY / OUTPUT SURFACES (how a finished product reaches the user)

| Surface | Delivers | Status |
|---|---|---|
| **Production screen** `/production/:id` | player + Download (blob fetch) + Open + Edit-in-Studio | **LIVE** |
| **Library** `/library` | own films; Edit / Share-link / Delete; plays stitched film from `video_clips` | **LIVE** |
| **Reel** `/r/:id` | playback + download + share + Publish-to-Lobby | **LIVE** (login-gated) |
| **Publish → `published_reels`** | the **real distribution path** → Lobby / Search / Profile / Director Cards | **LIVE end-to-end** (`useReelPublisher`) |
| **Public share** `/p/:slug` | hero + credits + making-of | **DEAD** — `mint-project-share` has **zero callers**; no UI mints a slug |
| **Embed** `/embed/:slug` | chromeless player | **DEAD** — same no-slug issue + now login-gated |
| **Widgets** `/widget/:key`, `/w/:slug` | embeddable scene/landing | **DEAD** — `generate-widget-config` has zero callers |
| **External distribution** `/business/distribution` | post to Meta/TikTok/YouTube/LinkedIn | **PARTIAL/dormant** — Meta/TikTok wired-but-untested, YouTube/LinkedIn are stubs, no secrets, no scheduler → **cannot post today** |

---

## H. STORAGE & FORMAT TRUTH

- **Final film:** MP4 (H.264/AAC, 1080p), aspect 16:9 / 9:16 / 1:1, in private **`published-renders`**. ⚠️ **The stored `movie_projects.video_url` is a 24h signed URL (signed-at-write, not at-read) → it 403s ~24h after render** (`seamless-stitcher:115,1422`). Library/Reel depend on this URL.
- **Clips:** public `video-clips` (the real source-of-truth replayed by Library).
- Other buckets: `thumbnails`, `temp-frames`, `scene-images`, `avatars`, `photo-edits` (private), `voice-tracks` (private), `brand-assets` (intro). `final-videos` and `hls-playlists` appear legacy/unprovisioned.
- **No HLS in practice** — `hlsPlaylistUrl` is effectively always null.

---

## Corrections to the earlier Phase-A DIAGNOSIS (verified here)
1. **Runway Gen-4 IS routable end-to-end on this branch** — `engineToBackend('runway-gen4')='runway'` → mode-router forwards → `hollywood-pipeline` ALLOWS runway → `generate-single-clip` has a real `runwayml/gen4-turbo` branch (`generate-single-clip:1699`). My DIAGNOSIS "P1-A1.4 Runway unroutable" was **wrong** (it's gated by the `studio_cinema` entitlement, whose Stripe checkout is locked — that's a billing gate, not a routing gap).
2. **Stitch model is valid** (separately confirmed against Replicate) — not the pipeline blocker.
3. The engine grid does **not** gate by entitlement at click-time; the cinema gate is a separate cumulative-seconds check.

## Caveats worth flagging
- **Custom avatar isn't really "owned"** — it's an ephemeral per-project selection (`custom-<uuid>`), never written to `avatar_templates`; no reusable avatar library.
- **Breakouts & Seedance bypass script approval**; cinematic engines honor it.
- **Marketing-vs-reality mismatches:** Image Studio says "Nano Banana" but runs FLUX; Crossover shows VFX recipes/credit costs that never reach the backend.

---

## TL;DR — the real product surface
**Genuinely live, end-to-end products:** cinematic films (6 engines: wan/kling/seedance/veo/runway/sora), image-to-video, avatar talking-heads (2 paths), breakouts (10 effects), training videos, in-editor clip generation, custom avatar portraits; photo editing (4 modes) + Image Studio; music (Score Studio + upload) + voice-over + captions; Ad Studio text concepts; and the publish→Lobby distribution path.

**Reachable but degraded (PARTIAL):** Crossover, Templates (rich fields dropped), Environments (102/122 broken), external distribution.

**Built but unreachable/dead:** video-to-video, motion-transfer, free-tier, breakthrough film render, public share/embed/widgets, auto-trailer, premiere recap, branded download, SFX, standalone voice, director-card, hoppy/landing chat, render-video.
