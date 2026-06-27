# Web Audit — AI Generation, Clip/Library Persistence, Templates/Effects, Music/Voice

Branch: `full-audit` · Scope: READ-ONLY end-to-end trace · Date: 2026-06-26

Method: UI (src/pages, src/components) → handler/hook → `supabase.functions.invoke` → edge fn (supabase/functions) → model/provider → persistence (DB table / storage bucket) → back to UI. Each feature rated DONE / PARTIAL / BROKEN / MISSING / UNVERIFIED with file:line evidence. Claims marked "verified" were re-read directly by the lead auditor.

Credit helpers referenced throughout:
- `supabase/functions/_shared/pipeline-credits.ts` — `holdCreditsForPipeline()`→RPC `reserve_credits`, `consumePipelineCredits()`→`consume_credit_hold`, `releasePipelineCredits()`→`release_credit_hold`.
- `supabase/functions/reserve-credits/index.ts` — JWT-gated reserve/consume/release/state API.
- Other gating RPCs in use: `deduct_credits`, `refund_credits`, `get_credit_state`.

---

## 1. AI SCRIPT / STORY GENERATION

| Fn | Model | UI wired | Credit-gated | Persistence | Status |
|---|---|---|---|---|---|
| generate-script | OpenAI gpt-4o-mini (`generate-script/index.ts:373`) | yes (Script.tsx:445) | **NO** (verified) | `movie_projects.generated_script` (Script.tsx:471) | PARTIAL |
| generate-story | OpenAI gpt-4o-mini (`generate-story/index.ts:475`,:528) | **NO (orphaned)** | **NO** | none | BROKEN/MISSING |
| smart-script-generator | OpenAI gpt-4o (`smart-script-generator/index.ts:956`) | internal only (hollywood-pipeline:1260,:1404) | NO at fn (gated by caller hollywood-pipeline) | none (caller persists) | DONE |
| script-assistant | OpenAI gpt-4o-mini (`script-assistant/index.ts:150`) | partial (FailedClipsPanel.tsx:147, only `rephrase_safe`) | **NO** | none (local state) | PARTIAL |
| seedance-script-director | Lovable gw `openai/gpt-5`→`google/gemini-2.5-pro` (`seedance-script-director/index.ts:242`,:289) | internal only (seedance-pipeline:605) | NO at fn (gated by seedance-pipeline:457 `holdCreditsForPipeline`) | none | DONE |
| director-chat | Lovable gw `google/gemini-3-flash-preview` (`director-chat/index.ts:69`) | yes (DirectorChat.tsx:348) | NO (cheap chat) | none (local) | DONE (swallows errors) |
| director-card | none (stats aggregation) (`director-card/index.ts:73-88`) | **NO (orphaned)** | N/A | read-only | MISSING-hookup |

Detail:
- **generate-script — PARTIAL.** UI `src/pages/Editor/views/Script.tsx:445` `regenerate()` → invoke at :453 with `{title,topic,synopsis,mood,genre,setting,clipCount}`; success writes `movie_projects.generated_script` at :471. Edge auth guard at :68-72, OpenAI gpt-4o-mini at :373. **No credit gating** (verified: grep for reserve/deduct/consume/hold in the file returns none; the "AUTH GUARD: prevent unauthorized API credit consumption" comment at :67 only blocks anonymous callers). Bug: seedance-pipeline fallback invokes it with `{concept,...}` (`seedance-pipeline/index.ts:622`) but the fn reads `synopsis||topic` (:337) — `concept` is ignored, so the fallback script disregards the user concept.
- **generate-story — BROKEN/MISSING.** Zero callers in src/ or functions/ (only config.toml:58 registration). Makes two paid gpt-4o-mini calls (:475 scene, :528 title), no persistence. Orphaned + ungated.
- **smart-script-generator — DONE.** Internal sub-step of hollywood-pipeline (gated at the pipeline boundary, creditRefs reserve/consume). Robust JSON recovery (:992) + clip padding (:1011). Ungated as a standalone fn but auth-gated and internal.
- **script-assistant — PARTIAL.** Implements 6 actions; only `rephrase_safe` has a UI caller (FailedClipsPanel.tsx:147). Other 5 branches dead from UI. Ungated.
- **seedance-script-director — DONE.** Service-role-only guard (`requireServiceRole`, :223) — hardened after a prior unauthenticated model-injection drain (comment :218). Gated by caller.
- **director-chat — DONE (with caveat).** Intentionally swallows every error into an HTTP-200 canned reply (missing key :39, non-OK :72, catch :83) → outages invisible. Model id `google/gemini-3-flash-preview` (:69) UNVERIFIED (unusual slug; silent degrade if rejected).
- **director-card — MISSING-hookup.** Not a generator (stats only). No caller. `signatureStyle` is an explicit heuristic stub (:125).

---

## 2. CLIP / VIDEO GENERATION

Architecture: real UI entry points are `mode-router` (Crossover.tsx:561, TrainingVideo.tsx:479, TemplateComposer.tsx:82) and `hollywood-pipeline` (Production.tsx:1263). Per-clip render worker = `generate-single-clip` (Replicate). Reconciliation is dual: registered `replicate-webhook` (HMAC-verified) + self-chaining `poll-replicate-prediction`, with `check-video-status` as manual recovery. Clips → `video-clips` bucket + `video_clips` table.

Provider/model map (all Replicate model-route endpoints unless noted):
- Kling V3 `kwaivgi/kling-v3-video` (default + avatar)
- Wan 2.5 `wan-ai/wan-2.5-t2v` (free tier)
- Seedance — **inconsistent**: `bytedance/seedance-2.0` (generate-single-clip:111) vs `bytedance/seedance-1-pro` (editor-generate-clip:19); one slug is wrong
- Veo `google/veo-3-fast`, Sora `openai/sora-2`, Runway `runwayml/gen4-turbo`
- stylize-video / motion-transfer — **hardcoded raw version hashes** (placeholders)
- avatar-image — Lovable gw `google/gemini-2.5-flash-image`

| Fn | Provider/Model | Reconciliation | Persistence | Credits | Status |
|---|---|---|---|---|---|
| generate-single-clip | Kling V3 / Wan / Seedance / Veo / Sora | webhook + poller | `video_clips` + `video-clips` bucket | consumes caller hold (:1145) | DONE |
| generate-video | Kling V3 (:20) | **none** | **none** | **none** | BROKEN/orphaned |
| editor-generate-clip | Seedance-1-pro / Wan / Kling | **client poll only** | `video_clips` (:574) + bucket | deduct+refund (:371) | DONE (poll-fragile) |
| free-tier-generate | Wan 2.5 (doc says LTX) | **none** | `free_tier_attempts` (marks succeeded at submit) | atomic cap RPC | BROKEN + no UI |
| motion-transfer | hardcoded hash (:67,:97) | **none** | **none** (pipeline_state.predictionId) | mode-router deducts upfront, no refund | BROKEN (credit-loss) |
| stylize-video | hardcoded hash (:50) | **none** | **none** | deducts upfront, no refund | BROKEN (credit-loss) |
| generate-avatar-image | Lovable Gemini 2.5-flash-image | sync | `avatars` bucket (pub) | none | DONE |
| generate-avatar-scene | Replicate FLUX cascade | sync 180s poll, no webhook | **ephemeral URL, not rehosted** | none | PARTIAL |
| generate-avatar-direct | Kling V3 + OpenAI | webhook + poller | `video_clips` + pending_video_tasks | none (mode-router deducts) | PARTIAL |
| replicate-webhook | — | — | persists to `video-clips` + `video_clips` + media | — | DONE |
| poll-replicate-prediction | — | — | persists `video_clips` + frame extract | — | DONE |
| check-video-status | Kling/Replicate | recovery | upserts `video_clips` | refunds editor clip on FAILED | DONE |
| replicate-catalog | Replicate proxy | — | read-only | — | PARTIAL (no UI caller) |
| retry-failed-clip | re-dispatch generate-single-clip | — | reconciles → final-assembly | — | DONE |

Severity-ordered break points:
1. **motion-transfer + stylize-video — BROKEN with credit loss (verified).** `motion-transfer/index.ts:97` posts `{version: modelVersion}` where the default is a placeholder hash (:33-67) → likely 422. Returns `{predictionId}` (:118) which mode-router parks in `movie_projects.pipeline_state.predictionId` (mode-router:1056-1064,1128-1137) — **no webhook, no poller, no recovery reads that location**, no `video_clips` row, project stuck `generating`. mode-router deducts full credits upfront (:492-499) with **no refund** → user pays, gets nothing. stylize-video identical (:50).
2. **free-tier-generate — BROKEN + orphaned.** Marks `free_tier_attempts` `'succeeded'` at prediction-creation (:199), no reconciliation, video URL never retrieved. **Zero UI callers.** Runs Wan despite doc claiming LTX-Video.
3. **generate-video — orphaned + unreconciled.** Submits + returns taskId (:1057-1074); no credits/clip-row/webhook/poller/persistence. Reachable only via a `pipelineFunction` registry string nothing dispatches (`src/lib/video/engines.ts:144` etc.).
4. **replicate-catalog — no UI hookup** (functional proxy, zero callers).
5. **generate-avatar-scene — ephemeral output** (180s sync poll, output URL never rehosted to storage; :494-523).
6. **editor-generate-clip — client-poll fragility** (no webhook; browser close mid-render orphans the clip, refund only on explicit failure not abandonment; CreatePanel.tsx:86-122).
7. **Model-id inconsistency** Seedance `2.0` vs `1-pro`; generate-single-clip never sets `video_clips.replicate_prediction_id` (relies on `veo_operation_name` fallback at replicate-webhook:85-93 — works but fragile).

Healthy core: the Kling-V3 cinematic path (mode-router/hollywood-pipeline → generate-single-clip → webhook+poller → `video_clips`+bucket → continue-production, with check-video-status/retry-failed-clip recovery and hold-based credits) is end-to-end complete and solid.

---

## 3. CLIP / LIBRARY IMPORT & PERSISTENCE — CRITICAL

### Verdict: CAN-BE-LOST (silent) on the primary editor import path.
An imported clip can end with a storage object but **no DB row, while the UI reports success.** Bytes orphan in a public bucket; the clip vanishes on reload.

Tables (three distinct surfaces, NOT one):
- `video_clips` — canonical timeline/clip table; read by editor timeline, seamless-stitcher, final-assembly. UNIQUE `(project_id, shot_index)`; RLS INSERT `auth.uid()=user_id` (`supabase/migrations/20260106121012_*.sql:2,:31`).
- `user_media_assets` — "My Library" history (`supabase/migrations/20260518164313_*.sql:5`).
- `movie_projects` — **what `/library` actually lists** (`src/pages/Library.tsx:93` via usePaginatedProjects).

Buckets:
- `video-clips` — **public=true** (`supabase/migrations/20260106114819_*.sql:3`); holds editor-imported + bulk video uploads. Note `supabase/migrations/20260626100000_storage_policy_fixes.sql:5` records this bucket had NO INSERT policy and every upload silently 403'd until patched today — live history of silent upload failure.
- `video-thumbnails` (public read), `user-uploads` (private, used only by generic `useFileUpload`).
- `generate-upload-url` edge fn (the signed-URL path) is **dead from frontend** — referenced only in tests. Real imports use the Supabase JS client `.upload()` directly.

Import call chains:
- **PATH A — editor timeline drop (THE BREAK, verified):** `src/pages/Editor/views/Timeline.tsx:2743` → `ingestUpload()` in `src/lib/editor/upload-ingest.ts:327`.
  1. `uploadValidated` uploads bytes to `video-clips`+`video-thumbnails` FIRST (:268-277).
  2. DB insert `insertWithNextShotIndex` into `video_clips` (:350) wrapped in `try/catch` that **only `console.warn`s and does not rethrow** (:362-365) → `dbClipId=null` on any failure.
  3. `movie_projects` mirror (:375-395) and store mirror (:400-418) are **gated on `if (dbClipId)`** → skipped.
  4. **ScriptDocument `addShot` ALWAYS runs (:423+)** and returns a shotId → `ingestUpload` returns success.
  5. Caller toasts "Uploaded N clips" (Timeline.tsx:2752).
  `insertWithNextShotIndex` re-throws on any non-23505 error (:719) — RLS reject (userId≠JWT), FK violation, schema drift, or 5-retry shot_index exhaustion (:662 → null) — all swallowed at :362.
- **PATH B — "My Library" rail bulk upload:** `MyLibraryPanel.tsx:88` upload → :97 `record_user_media` RPC; on RPC failure it throws and is counted failed (:108-110) **but the storage object is already written → orphan**. User IS told, so less silent.
- **PATH C — generic `useFileUpload`:** `src/hooks/useFileUpload.ts:131` uploads, returns URL, **no DB insert at all** (:170) — building block, persistence is caller's job.
- **Remote-URL imports** (`MediaLibrary.tsx:151`, `MyLibraryPanel.tsx:206`) call `insertWithNextShotIndex` and **correctly hard-fail** on null (`if(!clipId) throw`). These are safe; the bug is specific to `ingestUpload`.

Generated vs imported: both share `video_clips`, opposite discipline. Generated clips (editor-generate-clip:560-600, replicate-webhook, generate-single-clip) are written server-side/service-role authoritatively with logged errors → safe. Imported-via-editor-drop is client-side best-effort with the insert swallowed on failure → unsafe.

Precise failure window (Path A):
```
upload-ingest.ts:268  storage.upload() → public video-clips bucket   ✅ object created
upload-ingest.ts:350  insertWithNextShotIndex → video_clips          ❌ throws / null
upload-ingest.ts:362  catch { console.warn() }   ← swallowed, no rethrow, no toast
upload-ingest.ts:375  movie_projects mirror   ── SKIPPED (gated dbClipId)
upload-ingest.ts:400  store mirror            ── SKIPPED
upload-ingest.ts:423+ ScriptDocument addShot  ── RUNS → returns shotId  ← FALSE SUCCESS
Timeline.tsx:2752     toast.success("Uploaded N clips")
```
Net state: orphaned object in public `video-clips`; no `video_clips` row, no `movie_projects` mirror, no `user_media_assets` row. Visible this session only via in-memory ScriptDocument; on reload the timeline (reads `video_clips`) shows nothing and the file never appears in `/library` (reads `movie_projects`).

Minimal-fix direction (NOT applied): in `ingestUpload`, throw when `dbClipId` is null (mirror the correct pattern at MediaLibrary.tsx:159 / MyLibraryPanel.tsx:214) and/or delete the just-uploaded storage object on insert failure to avoid orphans.

---

## 4. AI IMAGE / PHOTO GENERATION

Provider map: Lovable gw Gemini (`google/gemini-2.5-flash-image`, `gemini-3-pro-image-preview`), Replicate FLUX (`flux-1.1-pro-ultra`, `flux-1.1-pro`, `flux-fill-pro`, `lucataco/remove-bg`), OpenAI `gpt-4o` (vision analysis only). No DALL-E / gpt-image anywhere.

| Fn | Provider/Model | Persists to | Gated | Status |
|---|---|---|---|---|
| studio-image | Lovable Gemini 2.5-flash-image / 3-pro (`studio-image/index.ts:79-81`) | client→`scene-images`(pub)+`user_media_assets` (ImageStudioHub.tsx:148-178) | **NO** | PARTIAL |
| edit-photo | Lovable Gemini 3-pro-image (`edit-photo/index.ts:225`) | `photo-edits`(priv)+`photo_edits`+media | YES deduct+refund+idempotency (:161-179) | DONE |
| inpaint-photo | Replicate flux-fill-pro (`inpaint-photo/index.ts:270-311`) | `photo-edits`(priv)+`photo_edits`+media | YES (:181-210) | DONE |
| generate-avatar-image | Lovable Gemini 2.5-flash-image (`:122`) | `avatars`(pub)+media | **NO** | PARTIAL |
| generate-scene-images | Replicate flux-1.1-pro-ultra→pro (`:176-217`) | `scene-images`(pub)+`movie_projects.scene_images`+media | NO at fn (pipeline hold) | DONE/PARTIAL |
| composite-character | Replicate remove-bg + flux-1.1-pro | **none** | **NO** | **BROKEN** |
| extract-scene-identity | **OpenAI gpt-4o vision** (`:372`,:523) | `movie_projects.pro_features_data.sceneIdentity` | **YES 5cr deduct+refund** (:255-298) | DONE |
| scene-character-analyzer | Lovable Gemini 2.5-flash (analysis) | none | NO | **MISSING (no caller)** |

Detail:
- **studio-image — PARTIAL.** `ImageStudioHub.tsx:233` → fn returns base64/URL only, no server persist; client uploads to public `scene-images` + inserts `user_media_assets` (best-effort, anonymous users get no save). **Ungated** (auth guard only, :53-54).
- **generate-avatar-image — PARTIAL.** `CreationStudio.tsx:504` → generates up to 3 Gemini images, public `avatars` bucket. **Ungated** (:197-201). No avatars/character DB-table row written here.
- **composite-character — BROKEN (verified).** `TrainingVideo.tsx:393` → fn posts `version:"lucataco/remove-bg"` (`composite-character/index.ts:67`) and `version:"black-forest-labs/flux-1.1-pro"` (:129) to `/v1/predictions` (:60,:122) — the predictions endpoint needs a 64-char version hash, not a model slug → 422. Silently degrades to `extraction_only` fallback (:147-194). No persistence, no gating.
- **extract-scene-identity — DONE.** Only OpenAI fn here and **properly gated** (5cr deduct + refund-on-malformed + balance pre-check, :255-298). Counter-example to the OpenAI gap. Analysis-only (no image).
- **scene-character-analyzer — MISSING.** Deployed, zero callers in src/ or functions/. Dead at runtime.
- **generate-scene-images — DONE within pipeline; PARTIAL direct-invoke** (accepts `userId` from body, auth-guard only → direct client call bypasses the parent pipeline hold = ungated).

---

## 5. TEMPLATE / BREAKTHROUGH-EFFECTS SYSTEM

Templates verdict: **DATA-DRIVEN (rich config modules), wired end-to-end. DONE** (one drift risk + one persistence caveat). "breakthrough-fx" as a standalone system: **ABSENT on this branch.** What exists is the **breakout (4th-wall)** system (wired) + an in-editor **crossover effects-registry** (PARTIAL).

Route + data:
- `src/App.tsx:156,:727` mounts `<Templates/>`; `/create` is a query-preserving redirect to `/studio` (App.tsx:647).
- `src/pages/Templates.tsx:367` → `getAllTemplateBlueprints()` → `src/lib/templates/registry.ts:744` `TEMPLATE_BLUEPRINTS` (~50 blueprints from `BREAKOUT_TEMPLATES` + ~40 built-ins, each enriched engine/aspect/clips/VFX/grade/music). Rich code module, not a static stub and not a DB query for the grid.

Selection → project chain:
1. `Templates.tsx:750` `navigate('/create?template=<id>')` + best-effort `increment_template_use_count` (UUID ids only, :752).
2. `/create` → `/studio?template=<id>`.
3. `src/hooks/useTemplateEnvironment.ts:1301` reads `?template`; `loadTemplate` resolves against `BUILT_IN_TEMPLATES` (a **second** hardcoded list, :261-1208) first, then the `project_templates` DB table (:1351, migration `20260110193526_*.sql:4`). Miss → `toast.error('Template not found')` (:1358).
4. Settings → `CreationHub.tsx:232,322-330` prefill → `creationConfig` (:601-621) → `onStartCreation(creationConfig)` (:660) into the generation pipeline (DB write downstream). Templates DO apply to a project — no break.

Risks:
- **Dual source-of-truth drift (latent):** gallery catalog (`registry.ts` TEMPLATE_BLUEPRINTS) and consumer catalog (`useTemplateEnvironment.ts` BUILT_IN_TEMPLATES) are two separate hardcoded lists. They currently overlap, so selection works; any id added to the registry but not mirrored into BUILT_IN_TEMPLATES (and `project_templates` has **no seed INSERTs** in migrations) → "Template not found".

Breakthrough/effects:
- No standalone breakthrough-fx system on full-audit. "breakthrough" appears only as prose/labels in the breakout system (effects-registry.ts:153, breakout-templates.ts:87,211, generate-widget-config:47 `"4th_wall_breakthrough"`, hollywood-pipeline:1103).
- **Breakout (4th-wall) effects — WIRED:** breakout-templates.ts → registry.ts → CreationHub.tsx:296,623-646 → seedance-pipeline/hollywood-pipeline/mode-router, guarded by `_shared/breakout-guardrails.ts`.
- **In-editor crossover effects-registry — PARTIAL:** `src/lib/editor/effects-registry.ts` declares 20 recipes; only 6 have bespoke renderers (FrameBreak, GlassShatter, LightBeam, NeonZap, ParticleBurst, SmokeBurst; `hasCustomRenderer:true`); the other 14 fall back to a generic placeholder bloom (:117-139). Consumed by EffectsPanel.tsx / EditorRightRail.tsx.

Tables: `project_templates` (`20260110193526_*.sql:4`), `crossover_templates` (`20260615000000_*.sql`). No seed INSERTs — live gallery is code-fed.

---

## 6. MUSIC / VOICE GENERATION

Gating note: **none of the 5 audio fns reserve/deduct credits** (no pipeline-credits import, no reserve in any). Two have post-hoc `log_api_cost` accounting only. All enforce `validateAuth`.

| Fn | Provider/Model | UI caller | Persisted | Status |
|---|---|---|---|---|
| generate-music | Replicate MusicGen Stereo Large (`:360`) | MusicHub.tsx:561, Timeline.tsx:535 | Editor: `voice-tracks`(priv)+`movie_projects.music_url`+A2 `video_clips` (:766,:779) | DONE (Editor) / **persistence BROKEN (MusicHub)** |
| elevenlabs-music | ElevenLabs /v1/music (`:38`) | **none** | no | **MISSING (orphaned)** |
| elevenlabs-sfx | ElevenLabs /v1/sound-generation (`:38`) | **none** | no | **MISSING (orphaned)** |
| generate-voice | Replicate MiniMax speech-2.6-turbo (`:155`) | CreationStudio.tsx:650, TrainingVideo.tsx:262,294 | media-library + provider URL | DONE |
| editor-tts | ElevenLabs eleven_turbo_v2_5 (`:44,:56`) | editor-tts.ts:34 → EditorRightRail.tsx:46 | `video-clips` bucket + A1 clip (:95-124) | DONE |

Break points:
1. **MusicHub saves expiring Replicate URLs (BROKEN persistence).** `MusicHub.tsx:561` invokes generate-music with **no `projectId`** → the `if(musicUrl && supabase && projectId)` persist block (generate-music:749) is skipped → fn returns the raw transient Replicate output URL, and MusicHub.tsx:578 saves that ephemeral URL to "My Tracks" via `record_user_media`. Replicate URLs expire → MusicHub tracks rot. The Timeline path is fully wired (`projectId: project.id` → signed URL → A2 → flush).
2. **elevenlabs-music + elevenlabs-sfx fully dead** — zero callers, no persistence. SFX generation unreachable from any UI.
3. **No real credit gating on any audio fn** — `log_api_cost` accounting only.
4. **generate-voice** returns provider-hosted URL (no re-upload to a Supabase bucket) — durability depends on the consuming pipeline ingesting it.

---

## TALLY

DONE (15): smart-script-generator, seedance-script-director, director-chat, generate-single-clip, replicate-webhook, poll-replicate-prediction, check-video-status, retry-failed-clip, generate-avatar-image (video), edit-photo, inpaint-photo, extract-scene-identity, generate-voice, editor-tts, Templates system. (generate-scene-images DONE within pipeline.)

PARTIAL (8): generate-script, script-assistant, editor-generate-clip, generate-avatar-scene, generate-avatar-direct, replicate-catalog, studio-image, generate-avatar-image (image). Crossover effects-registry PARTIAL.

BROKEN (7): generate-story, generate-video, free-tier-generate, motion-transfer, stylize-video, composite-character, generate-music (MusicHub persistence path). + the **clip-import-on-drop persistence (Path A)** is BROKEN/silent.

MISSING / orphaned (no caller) (5): director-card, scene-character-analyzer, elevenlabs-music, elevenlabs-sfx, (generate-story also orphaned, counted under BROKEN).

### Credit-gating gap — UNGATED OpenAI generation fns
Direct `api.openai.com` generation fns with NO credit reservation (auth-only):
1. `generate-script/index.ts:373` (gpt-4o-mini) — ungated, user-facing (VERIFIED)
2. `generate-story/index.ts:475` (gpt-4o-mini) — ungated + orphaned
3. `smart-script-generator/index.ts:956` (gpt-4o) — ungated at fn level (covered only because sole caller hollywood-pipeline gates)
4. `script-assistant/index.ts:150` (gpt-4o-mini) — ungated, user-facing
5. `generate-ad-studio/index.ts:234` (gpt-4o-mini) — ungated
6. `generate-ad-variants/index.ts:242` (gpt-4o-mini) — ungated
7. `regenerate-audio/index.ts:204` (gpt-4o-mini) — ungated

The project-memory "6 ungated OpenAI fns" = items 1,2,4,5,6,7 (the user-callable set), with #3 protected only at the pipeline boundary. Properly-gated counter-example: `extract-scene-identity` (OpenAI gpt-4o, 5cr deduct+refund). Note: seedance-script-director and director-chat route through the Lovable gateway, not OpenAI (seedance gated at pipeline; director-chat unmetered).

Adjacent ungated PAID (Lovable-gateway) image fns — same leak class, non-OpenAI: `studio-image` and `generate-avatar-image` (any signed-in user generates Gemini images free).

### Clip-persistence-on-import VERDICT
**CAN-BE-LOST (silent).** On the primary editor drag/drop import (`ingestUpload`, `src/lib/editor/upload-ingest.ts:327`), the storage write happens first (:268), the `video_clips` insert (:350) is wrapped in a catch that only `console.warn`s and never rethrows (:362, VERIFIED), the movie_projects/store mirrors are gated on `dbClipId` and skipped on failure, but the ScriptDocument mirror (:423+) runs unconditionally and the function returns success → the UI toasts "Uploaded N clips" (Timeline.tsx:2752). Result on any insert failure (RLS userId≠JWT, FK violation, shot_index-retry exhaustion, schema drift): an orphaned object in the public `video-clips` bucket with no DB row, gone on reload, never in `/library`. Remote-URL imports (MediaLibrary.tsx:159, MyLibraryPanel.tsx:214) correctly hard-fail and are safe; the bug is specific to file-drop `ingestUpload`.
