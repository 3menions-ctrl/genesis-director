# Create — One Continuous Studio

A single page at `/create` that flows like a conversation with the engine. Nothing opens in a new route. When you want a template, a Template Drawer slides in. When you want an avatar, the Avatar Gallery slides in. When you pick an engine, the Engine Picker slides in. Everything you choose lands in the same Reel below. The Reel is the project — clips, voice, script, music — all editable in place, with one button to push it into the Video Editor.

## The surface

```text
┌────────────────────────────────────────────────────────────────┐
│  Top bar: project name · engine chip · credits · Render All    │
├──────────────────────────┬─────────────────────────────────────┤
│                          │                                     │
│   COMPOSER (left 55%)    │   STAGE (right 45%)                 │
│                          │                                     │
│   • Idea / brief         │   Live preview of selected clip.    │
│   • Script (editable)    │   When empty: pulse poster.         │
│   • Cast chips           │   When generating: progress.        │
│   • Style + music chips  │   When done: HLS player + waveform. │
│   • Engine chip          │                                     │
│                          │   Voice / SFX / Music tabs below.   │
├──────────────────────────┴─────────────────────────────────────┤
│  REEL — horizontal strip of scenes (drag to reorder)           │
│  [01 ▣▣▣]  [02 ▣▣▣▣]  [03 ▣▣]  [+ add scene]   → Open Editor   │
└────────────────────────────────────────────────────────────────┘
```

Drawers slide over the Stage from the right (templates, avatars, engines, environments, voices, music). Picking an item closes the drawer and writes into the Composer or the active scene.

## The flow (one path, no detours)

1. **Brief** — type a logline, or pick a Template (drawer). Template fills brief + style + suggested cast + suggested engine.
2. **AUTO or DIRECTOR** — toggle at the top of the Composer.
   - **AUTO** (default, restored): `smart-script-generator` streams a full scene-by-scene script; cast auto-resolves to existing avatars or generates new via `generate-avatar-direct`; environment auto-picks; engine auto-picks per scene; queue hands off to `hollywood-pipeline`. User can pause at any moment.
   - **DIRECTOR**: same surface, all auto-fills become editable drafts. Nothing renders until the user hits Render.
3. **Edit anything inline** — script is a real editor (per-scene cards). Tap a character chip → Avatar drawer. Tap engine chip → Engine drawer. Tap style chip → Style drawer. Tap a scene's "+ voice" → Voice drawer.
4. **Render per scene or render all** — every scene card has its own ▶︎ Generate; the top bar has Render All. Status pills (Idle / Queued / Generating / Done / Failed) live on each card.
5. **Watch in Stage** — clicking any scene loads the HLS clip into the Stage with full transport (scrub, loop, A/B). Per-scene Regenerate / Stylize / Motion-transfer / Translate live in the Stage tabs.
6. **Hand off** — "Open in Editor" packages the reel and deep-links to `/editor` with IndexedDB pre-hydrated.

## Drawers (every tool reachable in one tap)

| Drawer | Triggered by | Powered by |
|---|---|---|
| Templates | "Pick template" button, brief block | `templates` table + `Templates` assets |
| Avatars | Cast chip / "+ character" | `avatar_templates` + `characters` + `useChunkedAvatars` |
| Generate Avatar | Avatar drawer → "Create new" | `generate-avatar-direct` + `analyze-reference-image` |
| Environments | Style chip → "Environment" | `environments` table |
| Engines | Engine chip on scene or top bar | `lib/video/engines.ts` (Kling V3, Seedance, Veo, Runway, FLUX I2V) — schema-driven controls (duration, resolution, camera fixed, ref image) |
| Voices | Per-character "voice" pill / scene "+ voice" | `useAvatarVoices` + `generate-voice` (ElevenLabs) |
| Music | Top bar "Score" or scene "+ music" | `generate-music` + `sync-music-to-scenes` |
| SFX | Scene "+ sfx" | `elevenlabs-sfx` |
| Reference image | Brief block dropzone or per-scene | `analyze-reference-image` + FLUX Fill outpaint |
| Translate | Scene menu | `translate-text` |
| Stylize | Stage tab on rendered clip | `stylize-video` |
| Motion transfer | Stage tab on rendered clip | `motion-transfer` |

Drawers share one container (`<StudioDrawer/>`) with framer-motion slide; only one is open at a time; ESC or click-outside closes.

## Script generation — restored in full

- AUTO: `smart-script-generator` streams scene cards as they arrive (token-by-token in the Composer).
- Each scene card: Location · Beat · Dialogue (verbatim-preserved) · Character chip · Lens · Move · Duration.
- Inline edit any field — debounced save to draft; never overwrites verbatim dialogue.
- "Regenerate scene" and "Add scene" buttons sit between cards.
- "Surprise me" runs `generate-story` for one-line concepts.

## Engine selection — actually exposed

Engine chip on the top bar sets the project default; each scene can override. Engine drawer shows all engines from `lib/video/engines.ts` with capability badges (audio? duration? I2V? camera?), live cost preview, and a "Best for this scene" recommendation based on whether the scene has dialogue, motion, or a reference frame. Picking an engine swaps the per-scene controls in the Composer (e.g. Kling V3 reveals dialogue tracks; FLUX I2V reveals start-frame; Seedance reveals camera-fixed).

## Voice + audio loop

Each character chip has a tiny voice pill: tap to preview, hold to open Voice drawer (filter by language / age / style, sample on hover, "Generate custom" via cloning if the user uploaded one). The selected voice writes to `character_voice_assignments` and is consumed by Kling V3 native audio or ElevenLabs `generate-voice` depending on engine. Per-scene SFX and Music chips append into the audio manifest used by `final-assembly`.

## Watch + iterate

Stage is a real player (`<CinematicPlayer/>` reused) with:
- Scrub, loop, A/B compare against the previous render.
- Tabs under it: **Voice · Music · SFX · Stylize · Motion · Captions** — each tab is contextual and only enabled when the clip exists.
- "Send to Editor" sends only this clip to `/editor` (existing IndexedDB hydration).

## Reel + handoff

Bottom strip is the source of truth for scene order. Drag to reorder (writes into draft + DB). "+ add scene" inserts a blank card. "Open in Editor" calls `final-assembly` + `auto-stitch-trigger` and navigates to `/editor` with the project ready to fine-cut.

## Persistence

Reuses the existing `creation_canvases` table from the prior plan but only stores the simple linear shape:

```ts
{
  brief: { title, logline, style, refImage },
  defaults: { engine, aspect, duration, voiceProfile },
  cast: Avatar[],
  scenes: SceneCard[],   // script + per-scene overrides + clip url + status
  audio: { score?, sfx[] }
}
```

Auto-save debounced 600ms. One canvas per active project (matches single-project rule).

## Files

**New**
- `src/pages/CreateCanvas.tsx` — replaced by this single linear studio (rewrite)
- `src/components/studio/StudioShell.tsx` — top bar + composer + stage + reel
- `src/components/studio/Composer/` — `BriefBlock`, `ScriptEditor`, `SceneCard`, `CastRow`, `StyleRow`, `EngineChip`
- `src/components/studio/Stage/` — `StagePlayer`, `StageTabs` (voice/music/sfx/stylize/motion/captions)
- `src/components/studio/Reel/` — `ReelStrip`, `ReelCard`
- `src/components/studio/drawers/` — `StudioDrawer` (shared) + `TemplatesDrawer`, `AvatarsDrawer`, `EnginesDrawer`, `EnvironmentsDrawer`, `VoicesDrawer`, `MusicDrawer`, `SfxDrawer`, `ReferenceDrawer`
- `src/hooks/useStudioDraft.ts` — store + autosave
- `src/hooks/useScenePipeline.ts` — per-scene generate / poll / refund / stylize / motion-transfer

**Edited**
- `src/App.tsx` — `/create` → new `StudioShell`
- Existing `DirectorRail` sidebar kept; phase chip removed (single surface now)

**Removed**
- `DirectorIntake.tsx`, `DirectorCockpit.tsx` (folded into the new shell)
- The half-built node canvas pieces under `src/components/canvas/` — kept only `compileGraphToPipeline.ts` if reusable, otherwise deleted

**Untouched**
- Auth, billing, onboarding, Editor internals, `engines.ts` (read from), all edge functions (called only)

## Design

Pro-Dark `hsl(220 14% 2%)`, single `#0A84FF` accent, Fraunces headings, JetBrains mono for labels and timecodes. Drawers are translucent panels with the same blue rail as the sidebar. No purple. Cinematic touches: subtle film-grain overlay on the Stage, soft motion blur on drawer transitions, monospaced timecode pills on every clip.

## Validation gates

- AUTO Render All: needs brief.title, brief.logline, scenes.length ≥ 1, credit balance ≥ estimate.
- Per-scene Generate: needs scene.script + scene.engine + ≥1 cast OR refImage.
- Open in Editor: needs ≥1 rendered scene.

## Out of scope this pass

- Real-time co-editing
- Brand kit injection (later, ties into `brand_kits`)
- Mobile authoring beyond view + light edits — Stage and Reel collapse to a single column under 768px; Composer becomes a sheet.

Approve and I'll execute top to bottom: shell + drawers first, then composer + script streaming, then stage + reel + render wiring.
