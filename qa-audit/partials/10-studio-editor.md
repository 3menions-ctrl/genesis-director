# QA Audit — Studio Assets + Editor

Read-only reliability audit of the STUDIO ASSETS (avatars, cast, environments,
templates, music, voice, photo edit, director cards, crossover) and the
video/photo EDITOR. Scope = create/generate flows + every editor tool.
Evidence cited as `file:line`. Edge-function existence verified against
`ls supabase/functions/`; tables/RPCs against `src/integrations/supabase/types.ts`
and `supabase/migrations/`.

**Headline verdicts**
- **Editor MP4 render is effectively DEAD for the user.** No code path enqueues
  a render job and the "Approve & Render" CTA is gated to a "coming soon"
  disabled state (`installJobRunner` is never called). The only true MP4 path
  (`final-assembly`) is reachable only via a Render Queue that is always empty
  (`addRenderJob` has zero callers). The intended export is "Save & publish"
  (client timeline player), not a render.
- **Persistence-vs-render divergence (systemic).** Structural timeline edits
  (trim/reorder/split/delete/title) persist to `editor_state.clips` and play in
  the client/publish path, but the stitcher reads a `editor_state.scenes` key
  the editor never writes — so those edits are dropped from any real MP4.
- **`edit-photo` charges but never refunds on AI failure** — a scope bug throws
  a `ReferenceError` before the refund RPC runs (user loses credits).
- **Environments "Apply scene" no-ops for ~102 of 122 environments** (ID
  namespace mismatch, with a misleading success toast).

---

## INVENTORY

### Avatars
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Load avatar vault | `useAvatarTemplatesQuery.ts:23` | Fetch templates | `from('avatar_templates').select('*').eq('is_active',true)` → GlassGallery | OK |
| Filter/search/sort | `Avatars.tsx:133-174` | Client filter | pure `useMemo` | OK |
| Add/remove to Cast | `Avatars.tsx:200-206` | Roster | `cast-store` → localStorage (cap 8) | OK |
| Cast in Studio | `Avatars.tsx:212-221` | Hand off | adds + `navigate('/studio')` | OK |
| Voice preview (card) | `Avatars.tsx:780-794` | Play sample | `new Audio(sample_audio_url)`; renders only `if hasAudio` (`:891`) | BROKEN (never populated) |
| Voice preview (popup) | `Avatars.tsx:1049-1062` | Play sample | same; `disabled={!hasAudio}` (`:1219`) | BROKEN |
| `useAvatarVoices` | `useAvatarVoices.ts:24` | On-demand TTS preview | calls `generate-voice` | DEAD (no importer) |
| `useChunkedAvatars` | `useChunkedAvatars.ts:51` | Progressive render | slices array | DEAD (no importer) |
| `generate-voice` | edge fn | MiniMax TTS, gate cost 1 | returns `{success,audioUrl,durationMs}` | OK (consumed by Studio/Training) |
| `generate-avatar-image` | edge fn | Custom avatar, gate cost 5 | `{frontImageUrl,...}` | OK |
| `generate-avatar-scene` | edge fn | FLUX scene, gate cost 8 | `{success,sceneImageUrl}` | OK |
| `generate-avatar-direct` | edge fn | Kling video pipeline, gate cost 3 | IDOR+atomic lock → movie_projects/video_clips | OK |
| `seed-avatar-library` / `seed-avatar-batch-v2` | edge fns | Admin seed presets | admin-gated upsert `avatar_templates` | OK |
| `generate-avatar-batch` | — | (in scope) | directory absent, no caller | DEAD/NONEXISTENT |

### Cast / Crossover / Director Cards / Breakthrough Lab
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Build cast (save) | `Cast.tsx:100` | Insert member | `from('director_cast').insert` → `load()` | OK |
| Generate cast portrait | `Cast.tsx:66` | FLUX portrait | `invoke('generate-cast-portrait')` → `{success,imageUrl}` (gate cost 4) | OK |
| Upload portrait | `Cast.tsx:85` | Ref upload | storage `character-references` | OK |
| Delete cast member | `Cast.tsx:123` | Delete | `director_cast.delete()` | NO CONFIRM |
| Toggle pin | `Cast.tsx:129` | Pin | optimistic update | OK |
| `useCast` | `useCast.ts:23` | localStorage roster (Studio/Avatars; NOT director_cast) | cast-store | OK |
| Crossover load | `Crossover.tsx:428` | 50 blueprints | `rpc('crossover_browse')` | OK |
| Crossover quick generate | `Crossover.tsx:558` | Render | `invoke('mode-router',{...crossoverTemplateSlug})` → `/production/:id` | DEGRADED (slug dropped) |
| Crossover customize | `Crossover.tsx:552` → `TemplateComposer.tsx:71` | Compose & gen | `invoke('mode-router')` | DEGRADED (slug dropped) |
| ChromePreview | `ChromePreview.tsx:35` | CSS mock | pure render | OK |
| DirectorCards load/share | `DirectorCards.tsx:69/131` | Year stats / share | direct table reads; `navigator.share` | OK |
| `director-card` edge fn | edge fn | (built) | no caller in `src/` | DEAD/orphaned |
| BreakthroughLab | `BreakthroughLab.tsx` | Procedural FX | 100% client-side | OK (by design) |

### Environments / Templates / Music
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Browse/filter templates | `Templates.tsx:371-406` | filter registry | client | OK |
| Open template drawer | `Templates.tsx:576` → `TemplateDetailDrawer.tsx:152` | preview | pure render | OK |
| Use this template | `TemplateDetailDrawer.tsx:369` | apply | `navigate('/create?template=ID')` + `rpc('increment_template_use_count')` | OK |
| Browse environments | `Environments.tsx:490-526` | filter+favs | client | OK |
| Open env drawer | `EnvironmentDetailDrawer.tsx:96` | preview | pure render | OK |
| **Apply scene to project** | `Environments.tsx:530` → `useTemplateEnvironment.ts:1456` | apply | `navigate('/create?environment=ID')`; resolver only knows 20 of 122 ids | BROKEN (~102 fail) |
| Generate score | `MusicHub.tsx:675` → `:681` | AI music | `invoke('generate-music')` → `{success,musicUrl}` (gate cost 3) | DOUBLE-WRITE + duration lie |
| Free library / My Tracks play | `MusicHub.tsx:201/502` | preview | `<audio src>` set | OK |
| Upload track | `MusicHub.tsx:531` | upload | storage + `rpc('record_user_media')` | OK |
| `scene-music-analyzer` | edge fn | scene→music | called only by `sync-music-to-scenes` (server) | OK (pipeline) |
| `elevenlabs-music` | edge fn | EL music | no caller; ALSO no credit gate | DEAD (latent cost risk) |
| `elevenlabs-sfx` | edge fn | EL SFX (gated) | no caller, no UI | DEAD |

### Photo editor + media-AI edge fns
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Apply template / AI chat edit | `PhotoEditorHub.tsx:99/169` | AI photo edit | insert `photo_edits` → `invoke('edit-photo')` → upload → signed URL | WORKS happy path; refund BROKEN |
| Remove object (inpaint) | `PhotoEditorHub.tsx:231` | FLUX Fill | `exportMask()` → `invoke('inpaint-photo')` → display | OK (idempotency dead) |
| Bulk edit | `PhotoBulkPanel.tsx:50` | edit ×N | `confirmAsync` → loop `invoke('edit-photo')` → results grid | OK (double-charge on retry) |
| Template grid | `PhotoTemplateGrid.tsx:27` | list | `from('photo_edit_templates')` | OK |
| Image Studio generate | `ImageStudioHub.tsx:225` | FLUX t2i/remix | `invoke('studio-image')` → `{images}` → persist | OK |
| Reference analyze | `ReferenceImageUpload.tsx:101` | vision + aspect-expand | `invoke('analyze-reference-image')` | PARTIAL (expand calls missing fn) |
| Stylize video | `mode-router:1061` | style transfer | `fetch /stylize-video` Replicate | SUSPECT (placeholder model version) |
| Motion transfer | `mode-router:1132` | animate still | `fetch /motion-transfer` Replicate | SUSPECT (placeholder model version) |
| Apply lipsync | `DialogueLipSync.tsx:84` | LatentSync | `invoke('apply-lipsync')` → update `video_clips` | OK |
| `svg-rasterize` / `translate-text` | edge fns | overlays / i18n | service-role / public | OK |

### Editor (mount, render, tools, persistence)
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Editor mount | `Editor/index.tsx:30` | shell | useProject/usePersistence/clipPropsSync/editorStateSync/scriptDocument | OK (see N1) |
| `useAutoPickProjectId` | `Editor/index.tsx:79` | auto-pick recent | defined but never called | DEAD |
| Approve & Render (Script) | `Script.tsx:418` | enqueue shot | gated `if(!isRunnerInstalled()) toast "coming soon"` | DEAD-PATH (gated) |
| Approve & Render (Inspector) | `ShotInspectorCard.tsx:309` | enqueue shot | disabled CTA "coming soon" | DEAD-PATH (gated) |
| Enqueue (TakesDrawer) | `TakesDrawer.tsx:1426` | enqueue shot | inside ShotInspector gated CTA | DEAD-PATH (gated) |
| Orchestrator runner | `orchestrator.ts:298` | run jobs | `installJobRunner` NEVER called | DEAD |
| Render queue retry | `RenderQueuePanel.tsx:54` | MP4 | `invoke('final-assembly')` (exists) | UNREACHABLE (no jobs added) |
| `addRenderJob` | `lib/editor/renderQueue` | queue a render | zero callers | DEAD |
| Export (Save & publish) | `ExportPanel.tsx:43` | flush + publish_reel | flush clip/editorState/doc → `publish` → `is_public=true` | OK (no render) |
| Generate clip | `CreatePanel.tsx:244` | make clip | insert `video_clips` → `editor-generate-clip` → update row | OK |
| Director Chat NL edits | `DirectorChat.tsx:115-345` | transitions/grade/cast/backend | store mutators / `director-chat` fn | OK |
| Music pick/generate/upload | `MusicPicker.tsx:119`, `Timeline.tsx:546/516` | score | ingest → A2 DB row | OK |
| Music replace | `Timeline.tsx:587` | swap bed | store-only `deleteClip` (old DB row kept) | BROKEN-MED |
| Trim clip | `Timeline.tsx:1464` → `store.ts:837` | resize | `editor_state.clips` + localStorage; not `video_clips` | BROKEN (render) |
| Reorder / Split / Delete clip | `store.ts:553/1278/2180` | arrange | `editor_state` only; render uses `video_clips` | BROKEN (render) |
| Insert title | `store.ts:1142` | title card | `editor_state.titles/clips`; stitcher reads `editor_state.scenes` | BROKEN (render) |
| Text overlays | `TextStudioPanel.tsx:44` | captions | `editor_state.textOverlays` → drawtext | OK |
| Color grade / Audio mix | `store.ts:974/1080` | LUT / EQ | `clip.properties` → `video_clips` (useClipPropertiesSync) | OK |
| Cast add/edit/remove | `CastEditor.tsx:60/162/174` | char CRUD | document-store + flushNow | OK (bypasses version stack) |
| Save dialog | `SaveDialog.tsx:134` | checkpoint | flush all → update `movie_projects` | OK |
| Auto-captions | `auto-captions.ts:33` | STT | `editor-transcribe` (exists) | OK (not credit-gated) |
| Editor TTS | `editor-tts.ts:35` | VO clip | `editor-tts` (exists) → A1 row | OK (not credit-gated) |
| `editor-ai-scene` | edge fn | prompt enhance | no client caller | DEAD |

---

## BROKEN

### Editor MP4 render is dead for users (Approve & Render + Render Queue) — HIGH (DEAD-PATH)
Symptom: There is no working way to render a finished MP4 from the editor.
Repro: Open `/editor` on a project; "Approve & Render" is disabled/"coming
soon"; open the Render Queue — it always reads "No renders queued."
Root cause: (a) `installJobRunner` (`orchestrator.ts:298`) is never called
anywhere in `src/` (confirmed; the test `orchestratorNoRunner.test.ts:11`
documents this), so `isRunnerInstalled()` is permanently false and all three
enqueue CTAs (`Script.tsx:424`, `ShotInspectorCard.tsx:309`,
`TakesDrawer.tsx:1426` via the gated inspector) short-circuit to a "coming soon"
state. (b) The real MP4 path `final-assembly` is invoked only from
`RenderQueuePanel.tsx:54` retry, but `addRenderJob` has zero callers, so the
queue is never populated and the retry path is unreachable.
Verdict on "is Editor render dead?": **YES — dead but gracefully gated, not a
silent no-op.** This is an improvement over the prior "Approve & Render critical"
flag (it no longer wedges jobs in an eternal spinner). The intended path is
ExportPanel "Save & publish" (plays via the client timeline player, no render).
Fix: ship `installJobRunner` wiring + `addRenderJob` on approve, or relabel the
editor as a publish-only surface and remove the dead render UI.

### Timeline structural edits dropped from a real render — HIGH
Symptom: Trim, reorder, split, single-clip delete, and timeline title cards look
correct in the editor and survive reload, but are absent from the
`final-assembly` MP4 (original full-length clips in `created_at` order, deleted
clips still present, no titles).
Repro: Trim clip 1 to 2s, reorder, delete a clip, then render — output ignores
all edits.
Root cause: edits persist to `movie_projects.editor_state.clips` (a flat array
written by `useEditorStateSync.collect()` `:66-72`), but the stitcher reads
clip positions/titles from `editorState.scenes[].clips[]`
(`seamless-stitcher/index.ts:437, 584`) — a key `collect()` **never writes**
(verified: returned object has `transitions/titles/textOverlays/tracks/clips`,
no `scenes`). And `final-assembly` selects `video_clips` rows
(`final-assembly/index.ts:142`) which never receive trim/order/delete. Color
grade, audio mix, effects, transitions, track mute/solo, and TextStudio overlays
DO round-trip (via `useClipPropertiesSync` → `video_clips.properties`).
Fix: have the stitcher reconstruct V1 from `editor_state.clips` (order +
durationSec + videoUrl), or persist trims/order/deletes back to `video_clips`.
Note: the default "Save & publish" path plays the client timeline, which honors
these — so this only bites the MP4 render (currently itself unreachable, above).

### edit-photo never refunds on AI failure — user charged for nothing — HIGH
Symptom: When the Gemini/Lovable gateway errors or returns no image, the user
keeps the deducted credits; a generic error is shown.
Repro: Apply any template/chat edit while the gateway 429s.
Root cause: `const idemKey` is declared inside the `if (creditsCost > 0)` block
at `edit-photo/index.ts:173` (block opens `:149`); the two refund sites
reference `idemKey` out of scope at `:277` and `:306` (separate
`if (creditsCost > 0)` blocks at `:272`/`:301`). Evaluating the
`refund_credits` args throws `ReferenceError: idemKey is not defined` before the
RPC runs; the `photo_edits` row is already marked `failed` so no retry recovers
it. (`inpaint-photo` correctly hoists `idemKey` to try-scope at its `:193`.)
Fix: hoist `const idemKey` to function/try scope so both deduct and refund see
it.

### Environments "Apply scene to project" no-ops for ~102 of 122 — HIGH
Symptom: Clicking Apply flashes `Applied scene "X"` then lands on `/create`
showing `Environment not found`; nothing is applied for most scenes.
Repro: Apply any *extended* environment (e.g. "Misty Pine Valley"). Only the 20
base presets work.
Root cause: page renders `getAllEnvironmentBlueprints()` (20 base + 102 extended)
but `useTemplateEnvironment.loadEnvironment` (`:1456-1461`) resolves IDs only
against a hard-coded 20-item `ENVIRONMENT_PRESETS` (`:61-244`) with no registry
fallback (unlike `loadTemplate`). Aggravated by a premature
`toast.success("Applied scene…")` fired before navigation
(`Environments.tsx:532`).
Fix: resolve `loadEnvironment` via `getEnvironmentBlueprint(id)` registry
fallback; drop the premature success toast.

### stylize-video & motion-transfer use placeholder Replicate model versions — HIGH (verify live)
Symptom: video-to-video and motion-transfer likely 422 at submit; mode-router
throws and the project stalls (no over-charge — credits charged only after a
successful submit).
Root cause: `stylize-video/index.ts:69` hardcodes a fabricated-looking
`version:"c02b3c…"`; `motion-transfer/index.ts:36` uses a guessed
`DEFAULT_MODEL_VERSION` ("d6a4c1…", MagicAnimate family, commonly removed) and a
shotgun input mixing two schemas. Polling/persistence are correct, so the
results would save/display IF the versions were valid.
Fix: pin verified, currently-published model versions + exact input schema;
confirm against a live test before launch.

### Music page records every generated score TWICE — MED
Symptom: each "Generate score" creates two identical My Tracks rows.
Root cause: double write — edge fn records via `recordUserMedia`
(`generate-music/index.ts:816-831`) AND the client re-records via
`rpc('record_user_media')` (`MusicHub.tsx:698-707`).
Fix: drop the client-side record block and rely on the edge fn.

### Music duration selector lies for 60s/90s — MED
Symptom: choosing 60/90s yields a ~30s track but stores it as 60/90s.
Root cause: UI offers `[15,30,60,90]` (`MusicHub.tsx:671`) and records the
selected value (`:704`), but `generate-music/index.ts:364` hard-clamps to 30s.
Fix: limit UI to `[15,30]` or implement chunked generation, and record the
actual returned duration.

### "Replace music" leaves old A2 row in DB — MED
Symptom: replacing the score can amix two beds on render.
Root cause: `onReplaceMusic` calls store-only `deleteClip`
(`Timeline.tsx:587-590`); the prior A2 `video_clips` row is never deleted and
the stitcher includes all `sys:A*` rows.
Fix: delete the old A2 row on replace (mirror `onClearAll`).

### crossoverTemplateSlug silently dropped by mode-router — MED
Symptom: crossover renders run as generic text-to-video; template is never
linked (no useCount/"remixes" increment, no crossover routing/analytics).
Root cause: `mode-router/index.ts:284` omits `crossoverTemplateSlug` from the
destructure (0 hits in the fn); sent from `Crossover.tsx:567` and
`TemplateComposer.tsx:79`. Video still generates (recipe is in the prompt) — a
tracking/routing gap, not a no-op.
Fix: consume the slug in mode-router (persist + bump useCount) or drop the param.

### Avatar voice preview is non-functional vault-wide — MED
Symptom: page advertises "Audition the voice" but the play button never appears
on cards (`Avatars.tsx:891`) and is permanently disabled in the popup (`:1219`).
Root cause: `avatar_templates.sample_audio_url` is never populated by any
seeder/generator (grep = none); the page reads the column directly with no
on-demand fallback. The hook that would fix it (`useAvatarVoices`) is dead code
(no importer) and, if wired as-is, sends the anon key to a `validateAuth` fn → 401.
Fix: backfill `sample_audio_url` during seeding, or wire `useAvatarVoices` with
the user session token.

### Idempotency non-functional for edit-photo & inpaint-photo (double-charge) — MED
Symptom: retries / double-clicks charge each time.
Root cause: `deduct_credits` only honors the idempotency short-circuit when both
`p_idempotency_key` AND `p_project_id` are set
(`20260705000100_…sql:209-213`); both photo fns omit `p_project_id`
(`edit-photo:176`, `inpaint-photo:196`). The only unique index on
`idempotency_key` is partial `WHERE … LIKE 'tip:%'`
(`20260705010800_…sql:9-10`). All the `idemKey`/`sha256` logic is dead.
Fix: add a partial unique index for `edit-photo:%`/`inpaint-photo:%` keys, or
honor `idempotency_key` independent of `project_id`.

### analyze-reference-image aspect-expand is a silent no-op (missing fn) — MED
Symptom: reference images are never outpainted to target ratio; always
`wasExpanded:false`.
Root cause: `analyze-reference-image/index.ts:239` fetches
`/functions/v1/expand-image-aspect-ratio`, which **does not exist**; the 404 is
swallowed (`:252-271`) and falls back to the original.
Fix: implement `expand-image-aspect-ratio` or remove the dead call + UI claim.

### Cast member delete has no confirmation — LOW
`Cast.tsx:123` `remove()` hard-deletes `director_cast` with no guard (not
`window.confirm`, but no `confirmAsync` either — violates the destructive-action
standard). Fix: gate behind `confirmAsync`.

### Avatar audio keeps playing after unmount — LOW
`Avatars.tsx` `GlassFrame` (`:775-794`) and `DetailPopup` (`:1065-1076`) never
pause `audioRef` on unmount/close. Fix: add cleanup effect.

### editor-transcribe / editor-tts not credit-gated — LOW
Auto-captions (ElevenLabs Scribe) and editor TTS are auth-only, no
`preflightAiGate`/`chargeAiGate` (`editor-transcribe/index.ts:14`,
`editor-tts/index.ts:14`) — paid provider calls with no metering. Fix: add gate.

### elevenlabs-music uncredited (if ever wired) — LOW
`elevenlabs-music` has no credit gate (vs `elevenlabs-sfx` which does); both are
orphaned. Fix: delete, or gate before wiring.

### Stale-localStorage can shadow DB edits same-device — LOW
`usePersistence` re-applies localStorage `clipOrder`/`clipDurations` AFTER
`useProject` restores `editor_state.clips` (`usePersistence.ts:84-92`), so a
stale snapshot can override newer DB state on the same device. Fix: drop the now-
redundant localStorage clip layer (editor_state is source of truth) or
timestamp-gate it.

---

## DEAD / ORPHANED (cleanup, non-breaking)
- `generate-avatar-batch` edge fn — referenced in scope, directory absent, no caller.
- `useAvatarVoices`, `useChunkedAvatars` — built, no importer.
- `director-card`, `editor-ai-scene`, `elevenlabs-music`, `elevenlabs-sfx` edge fns — no caller.
- `useAutoPickProjectId` (`Editor/index.tsx:79`) — defined, never invoked.
- `addRenderJob` / orchestrator runner — render queue + generation orchestrator wired but never fed.
- Crossover `stats` memo + `FloatingStat` (`Crossover.tsx:526/778`) — defined, never rendered.

## NOTES / NON-ISSUES
- N1: `Editor/index.tsx:36` comment header claims auto-load on `/editor` but code
  sets `effectiveId = urlId` (no auto-load) — comment is stale, behavior is the
  intentional one.
- No `window.confirm` anywhere in scope; destructive editor/photo actions use
  `confirmAsync`.
- All edge functions named in scope EXIST except `generate-avatar-batch` and the
  `expand-image-aspect-ratio` target (above); all existing fns return the shape
  their callers expect.
- ImageStudio in-session gallery shows raw Replicate URLs (expire ~1–24h);
  persisted "Your images" use stable `scene-images` URLs (recovered on refresh).
</content>
</invoke>
