# MASTER TASKLIST — deduplicated, reuse-first

Single source of truth. Supersedes and merges: `TASKLIST.md` (pipeline/editor/comms), the `QUALITY_BLUEPRINT.md` roadmap (Tiers A/B/C), `PRODUCTS.md` dead/partial items, and `RUNTIME_VERIFICATION.md` runtime findings. Every duplicate across those docs is collapsed into one task here.

**Action tags** (the anti-repetition rule — do the lightest action that works):
- **FIX** — broken, repair it · **REVIVE** — complete code exists, no UI caller; turn it on · **WIRE** — exists but not connected to the flow · **UPGRADE** — works but degraded; improve · **NEW** — genuinely build · **DELETE** — confirmed dead; remove to stop confusion/duplication.

**Priority:** P0 blocks shipping/durability · P1 high user-facing impact · P2 robustness/quality · P3 polish/new.
**Effort:** S <½d · M 1–2d · L 3+d.

---

## 0. What we already HAVE (reuse map — read before building anything)

**Live & solid (build ON these, don't touch the core):** mode-router dispatch · `hollywood-pipeline` / `seedance-pipeline` · `generate-single-clip` (6 engines incl. Runway) · frame-chaining (`continue-production`) · real continuity contract (`_shared/continuity-contract.ts`, `continuity-audit`) · `seamless-stitcher` ffmpeg-on-Replicate (xfade/acrossfade/drawtext/sidechain duck) · quality-post (Topaz 4K + RIFE 60fps) · editor dual-buffer playback + Web Audio mix · branded `sonner` toasts · `CinemaLoader` · `framer-motion` · `celebrate()` confetti+sound · `useGamification` engine · Realtime progress channel.

**Complete but DEAD/unwired — REVIVE/WIRE targets (the cheap wins; do NOT rebuild):** `elevenlabs-sfx` (SFX) · `scene-music-analyzer` + `sync-music-to-scenes` (auto-score) · `executeBreakthroughRender` DAG (film-grade VFX) · `pipeline-failsafes.ts` (circuit breaker/DLQ/retry budget) · `pipeline-watchdog` + `zombie-cleanup` + `replicate-recovery.ts` (stuck-job recovery — unscheduled) · `celebrate()`/`useGamification` (unwired to creation) · `pipeline_state.message` (real progress narration, ignored by UI) · `generate-scene-images` (storyboard, only wired to Seedance).

**Partial/degraded — UPGRADE targets:** editor export (no bake) · transitions (fixed 320ms, uncontrollable) · per-clip audio automation (stranded in dead code) · Crossover (drops VFX params) · Templates (drops shot/character params) · Environments (102/122 presets broken) · custom avatar (ephemeral, not saved) · the "8-phase" progress rail (cosmetic over a real score).

**Confirmed DEAD — DELETE candidates:** `render-video` · `generate-story` · `scene-character-analyzer` · `generate-character-for-scene` · `hoppy-chat` · `landing-demo-chat` · `editor-ai-scene` · `director-card` · `svg-rasterize` · `elevenlabs-music` · `regenerate-audio` · `generate-project-trailer` · `premiere-recap` · `brand-video-download` · the `python/` engine tree · `free-tier-generate` (unless a free tier is planned) · test-only `engines.ts` `pipelineFunction` map · ~180 dead lines in `PlayerCanvas.tsx`.

---

## PHASE 0 — Durability foundation (P0; nothing is repeatable until these land)

- [ ] **T1 — Sign-at-read for final films** · FIX · **P0** · M
  HAVE: stitcher writes a 24h signed `published-renders` URL into `movie_projects.video_url`. DO: store the storage path; sign on demand at playback/share/embed; backfill. Files: `seamless-stitcher`, `final-assembly`, `Production.tsx`, `PublicShare.tsx`, `EmbedPlayer.tsx`, sign helper, migration. *(was TASKLIST A1.1 + BLUEPRINT 5/6 + RUNTIME §3)*
- [ ] **T2 — Hold-aware refunds in `zombie-cleanup`** · FIX · **P0** · S–M
  HAVE: correct hold-aware logic in `_shared/pipeline-failure.ts`; zombie path ignores it → over-credit. DO: reuse `markProjectFailedAndRefund`. **Blocks T3.** Files: `zombie-cleanup`. *(TASKLIST A1.3)*
- [ ] **T3 — Re-enable stuck-job recovery (watchdog/zombie crons)** · REVIVE · **P0** · M
  HAVE: full `pipeline-watchdog` + `zombie-cleanup` + `replicate-recovery.ts`, unscheduled (confirmed live: 3 jobs stuck 6–7h). DO: `pg_cron` schedule (mirror the credit-hold reconciler), set `WATCHDOG_RESUME_ENABLED`. **Depends on T2.** Files: migration, `pipeline-watchdog`. *(TASKLIST A1.2 + RUNTIME §3)*
- [ ] **T4 — Boot env guard + workspace-loader timeout** · FIX · **P0** · S
  HAVE: `createClient` throws on missing env (white screen); `ProtectedRoute` profile/onboarding loaders have no timeout (infinite spin). DO: friendly env-missing screen; add a timeout→retry fallback to the profile-wait loader. Files: `src/integrations/supabase/client.ts`, `ProtectedRoute.tsx`. *(RUNTIME §2 — NEW, not in old TASKLIST)*
- [ ] **T5 — Schema/types reconciliation** · FIX · **P1** · M
  HAVE: confirmed drift (`generation_mode` column gone; ~2,800-line `types.ts` drift; prod migration backlog). DO: reconcile `migration list`, regenerate `types.ts`, grep code for dropped/renamed columns. Files: migrations, `types.ts`, callers. *(RUNTIME §3 — NEW)*
- [ ] **T6 — Max-retry cap on `retry-failed-clip`** · FIX · **P2** · S
  HAVE: tracks `retry_count`, never enforces a cap. DO: cap (e.g. 3) → fail + hold-aware refund. *(TASKLIST A1.5)*

## PHASE 1 — Make the output real (P1; today the editing surface is cosmetic relative to the deliverable)

- [ ] **T7 — EDL bake: editor edits actually ship (WYSIWYG)** · UPGRADE · **P1** · L
  HAVE: `seamless-stitcher` already builds the exact ffmpeg graph (xfade/acrossfade/drawtext/sidechain) an export needs; editor store holds all edit data; `renderQueue.addRenderJob` exists with no caller. DO: serialize an EDL (trims/transitions/grades/volume/fades/titles) from the store → send to stitcher → populate render queue → replace publish artifact with the baked output. **Depends on T1** (URL won't rot). Files: `renderQueue.ts`, `ExportPanel.tsx`, `RenderQueuePanel.tsx`, `store.ts`, `seamless-stitcher` + `_shared/seamless-command.ts`. *(TASKLIST A2.1 + BLUEPRINT A1 — the single biggest gap)*
- [ ] **T8 — User-controlled transitions (and real hard cuts)** · UPGRADE · **P1** · M
  HAVE: real equal-power canvas blend, but fires 320ms on every cut; user duration/kind ignored; a dead B-buffer effect. DO: drive the blend from `project.transitions[]` (kind+duration), default to hard cut; honor in preview AND the T7 bake. Files: `StitchedPlayer.tsx`, `PlayerCanvas.tsx`, `store.ts`. *(TASKLIST A2.2 + BLUEPRINT A1; pairs with T7)*
- [ ] **T9 — Live per-clip audio/visual automation** · FIX · **P2** · M
  HAVE: volume/fades/keyframe logic stranded in dead `PlayerCanvas` Effect A. DO: apply gain/fades in live `StitchedPlayer` (`rampElementGain`); animate opacity/scale via `getClipPropertyAt`; honor in T7 bake. Files: `StitchedPlayer.tsx`, `useAudioMixChain.ts`, `store.ts`. *(TASKLIST A2.3 + BLUEPRINT 1; pairs with T7/T8)*
- [ ] **T10 — Real progress narration + honest stages** · WIRE · **P1** · M
  HAVE: backend emits `pipeline_state.{stage,message}`; UI ignores it and shows a fabricated % ramp + `Math.sin` waveform + a 3-state "8-phase" rail. DO: render real stage + rotating `message`; true determinate bar from clip counts; surface per-clip thumbnails as they land; drop the fake waveform. Pair: backend emits granular stage/message at each transition. Files: `Production.tsx`, `PipelineCreation.tsx`, `CinematicPipelineProgress.tsx`, `phases.ts`; backend `hollywood-pipeline`/`continue-production`/`seamless-stitcher`. *(TASKLIST A1.6+A3.3)*
- [ ] **T11 — Celebrate completion + wire gamification** · WIRE · **P1** · S–M
  HAVE: `celebrate()` (confetti+sound) and full `useGamification` engine, both unused at render-done (success is a bare toast). DO: fire `celebrate()` + XP/streak/achievement on completion; richer success card (preview + share/download/edit). Files: `Production.tsx`, `celebrate.ts`, `useGamification.ts`, `gamification-event`. *(TASKLIST A3.1+A3.2)*
- [ ] **T12 — Collapse duplicate visualizers** · UPGRADE · **P2** · S–M
  HAVE: `PipelineCreation` (full-screen) renders OVER `CinematicPipelineProgress` (inline) during a render. DO: keep one, feed it T10 data, remove the other. *(TASKLIST A3.4; do with T10)*

## PHASE 2 — Quality revivals (P1–P2; wire dead scaffolding into the create flow — these are why the output isn't "awesome" yet)

- [ ] **T13 — Auto-score every film** · WIRE · **P1** · M
  HAVE: `scene-music-analyzer` (mood/tempo) + `sync-music-to-scenes` + `generate-music` + sidechain duck — all real, used only by the watchdog. DO: on finalize, analyze scenes → generate per-act score → sync → duck under narration; "regenerate score" + style presets. Files: `hollywood-pipeline`/`continue-production`, the two analyzer fns. *(BLUEPRINT 4)*
- [ ] **T14 — Sound design / SFX pass** · WIRE · **P1** · M
  HAVE: `elevenlabs-sfx` complete but DEAD; no SFX in any output. DO: per-scene SFX (analyze → generate → place under the mix); editor SFX panel; auto-foley suggestions. Files: `elevenlabs-sfx`, pipeline, editor audio panel. *(BLUEPRINT 3)*
- [ ] **T15 — Storyboard-first on all engines** · WIRE · **P2** · M
  HAVE: `generate-scene-images` (FLUX) real, wired only to Seedance. DO: route default Kling/Veo path through stills→motion for sharper, consistent shots. Files: `hollywood-pipeline`, `generate-scene-images`. *(TASKLIST A1.9 + BLUEPRINT 5)*
- [ ] **T16 — Revive film-grade VFX render** · REVIVE · **P2** · L
  HAVE: `executeBreakthroughRender` (real `generate-video`→stitch DAG, tests-only) + WebGL FX lab (preview) + dead Python VFX (liquid/particles/shatter/etc.). DO: expose the DAG behind a real "render this effect" button using the Lab as live preview; add a compositable VFX overlay stage in the stitcher. Files: `lib/templates/breakthrough/execute.ts`, `BreakthroughLab.tsx`, stitcher overlay. *(BLUEPRINT 2)*
- [ ] **T17 — Fix Crossover + Templates param pass-through** · UPGRADE · **P2** · M
  HAVE: both UIs collect rich VFX/shot/character/environment data; the live `CreationStudio` + Crossover drop it before mode-router (backend already accepts it). DO: forward `crossoverTemplateSlug` + `templateShotSequence/styleAnchor/characters/environmentLock`. Files: `CreationStudio.tsx`, `Crossover.tsx`/`TemplateComposer.tsx`, `Studio.tsx`. *(PRODUCTS partials)*
- [ ] **T18 — Fix Environments preset resolution** · UPGRADE · **P3** · S–M
  HAVE: 122 blueprints; only 20 wired → ~102 fail "not found". DO: resolve against the full `environment-extensions` data; pass `generatorPrompt`/camera/sound/VFX. Files: `useTemplateEnvironment.ts`, `Environments.tsx`. *(PRODUCTS)*

## PHASE 3 — Intelligence & robustness upgrades (P2)

- [ ] **T19 — Smart per-shot engine selection + model fallback** · NEW/REVIVE · **P2** · L
  HAVE: 6 engines + a contradictory test-only routing map; dead `pipeline-failsafes.ts` (circuit breaker/retry budget/DLQ). DO: pick engine/model per shot by content+budget+entitlement; fallback chain on failure (revive failsafes); one honest capability registry (delete the test-only map). Files: `mode-router`, `generate-single-clip`, `_shared/pipeline-failsafes.ts`, `engines.ts`. *(TASKLIST A1.7 + BLUEPRINT 8)*
- [ ] **T20 — Persistent characters & worlds** · UPGRADE · **P2** · L
  HAVE: identity bible (`extract-scene-identity`) + custom-avatar generation, but the avatar is ephemeral (`custom-<uuid>`, never saved to `avatar_templates`). DO: save/own avatars + worlds; reuse across films; carry the bible into every shot. Files: `CreationStudio.tsx`, `avatar_templates`, pipeline prompt assembly. *(BLUEPRINT 9)*
- [ ] **T21 — Surface the real continuity score** · UPGRADE · **P2** · M
  HAVE: real server-side score (`continuity-audit`/`continuity-contract`) hidden behind a cosmetic rail. DO: show the real score + per-shot boundaries; remove fabricated heuristics. Files: `phases.ts`, `Production.tsx`, read `continuity-audit`. *(TASKLIST A3.5 + BLUEPRINT 10)*
- [ ] **T22 — Provision HLS properly** · FIX · **P3** · M
  HAVE: `generate-hls-playlist` writes to a bucket not in migrations → silent fallback. DO: provision `hls-playlists` bucket, wire generation, serve HLS for smooth playback. *(PRODUCTS/derived)*
- [ ] **T23 — Background + notify-when-done** · NEW · **P2** · M
  HAVE: `send-push-notification` + Inbox exist. DO: let users leave a render and get notified (escalate offer at 15s/60s). Files: `Production.tsx`, `send-push-notification`, Inbox. *(TASKLIST A3.6)*

## PHASE 4 — Shared UX consolidation (P2; removes duplication app-wide)

- [ ] **T24 — One EmptyState + collapse duplicate systems** · UPGRADE/DELETE · **P2** · L
  HAVE: ~30 hand-rolled empty states; 2 toast systems (branded sonner + dead Radix); 4+ loaders; 3 error boundaries; unused `gsap`. DO: one `EmptyState`; keep sonner (delete Radix `use-toast`/`toaster`/`toast`); standardize on `CinemaLoader`+skeletons; consolidate boundaries; remove `gsap`. *(TASKLIST A3.7)*
- [ ] **T25 — First-run onboarding + coachmarks + tooltips** · NEW · **P3** · L
  HAVE: `Onboarding.tsx` is a redirect; `smartMessages.ts` exists but its hook is missing. DO: first-project walkthrough + coachmarks (esp. Generate + duration expectation); broaden tooltips; build `useSmartMessages` or retire it. *(TASKLIST A3.8)*

## PHASE 5 — Net-new potential (P3)

- [ ] **T26 — Lip-sync to anything** (talking characters/objects, not just avatars) · NEW · L
- [ ] **T27 — Beat-synced cuts + ambience beds** · NEW · M *(builds on T13/T14)*
- [ ] **T28 — Multi-character dialogue scenes** (multi-voice TTS + lip-sync) · NEW · L *(builds on T20/T26)*
- [ ] **T29 — House-style locking / reference LoRAs** (consistent look across a catalog) · NEW · L
- [ ] **T30 — Live partial previews** (stream keyframes as clips land) · NEW · M *(builds on T10)*
- [ ] **T31 — Voice cloning + emotion controls** · NEW · L
- [ ] **T32 — "Series" mode** (continuity/characters/score across episodes) · NEW · L *(builds on T20/T21)*
- [ ] **T33 — One-click platform cuts** (auto 9:16/1:1/16:9 + captions) → revive distribution · NEW/UPGRADE · M

## PHASE 6 — Cleanup (P3; do AFTER the revivals so we don't delete something we want)

- [ ] **T34 — Delete confirmed-dead code** · DELETE · M
  Remove (verify 0 callers first): `render-video`, `generate-story`, `scene-character-analyzer`, `generate-character-for-scene`, `hoppy-chat`, `landing-demo-chat`, `director-card`, `svg-rasterize`, `elevenlabs-music`, `regenerate-audio`, `generate-project-trailer`, `premiere-recap`, `brand-video-download`, the `python/` tree, the test-only `engines.ts` `pipelineFunction` map, ~180 dead lines in `PlayerCanvas.tsx`. **Do NOT delete** revive targets (T13/T14/T16/T19). *(TASKLIST A1.8 + PRODUCTS dead list)*

---

## Dependency map
- **T2 → T3** (fix over-credit before re-enabling zombie sweep)
- **T1 → T7** (sign-at-read before the baked output URL can be relied on)
- **T7 ↔ T8 ↔ T9** (one EDL drives bake + transitions + automation — build the EDL once)
- **T10 → T12** (collapse visualizers as part of the real-progress rework)
- **T13/T14 → T27** · **T20 → T28/T32** · **T26 → T28** · **T10 → T30**
- **All revivals before T34** (don't delete scaffolding we're about to turn on)

## Recommended execution order
1. **Phase 0** (T1–T5) — durability + the runtime breakages from RUNTIME_VERIFICATION. Without these, quality isn't repeatable.
2. **Phase 1** (T7–T11) — make edits real + the long-wait experience honest and delightful.
3. **Phase 2** (T13–T17) — wire the dead quality scaffolding (SFX, auto-score, VFX, storyboard, param pass-through). This is the "awesome" tier and it's mostly REVIVE/WIRE, not NEW.
4. **Phase 3–4** (T19–T24) — intelligence + consolidation.
5. **Phase 5–6** — net-new + cleanup.

## Open decisions (unchanged from TASKLIST; answer to unblock Phase B)
1. **Premium engines:** unlock the Cinema entitlement (Veo/Sora/Runway are render-ready but billing-gated), or keep gated?
2. **Free tier:** revive `free-tier-generate` or delete it?
3. **Export v1:** confirm server-side bake (reuse stitcher) now, WebCodecs client export later. *(recommend yes)*
4. **Smart-messages:** build `useSmartMessages` or retire `smartMessages.ts`?

---
*Reuse-first principle: of 34 tasks, the highest-impact tier (Phase 2 "awesome") is almost entirely REVIVE/WIRE/UPGRADE of code that already exists — only Phase 5 is mostly NEW. We are turning on and polishing what's built, not rebuilding it.*
