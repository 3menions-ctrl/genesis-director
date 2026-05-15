
# Director Canvas — Unified Creation Engine

Replace the current fragmented Create page with a single **Node Canvas** workspace where every primitive (model, avatar, environment, dialogue, audio, output) is a node you can wire together. One project, one surface, zero context-switching.

## 1. The Canvas (`/create`)

A full-bleed dark cinematic canvas (React Flow) with three regions:

```text
┌─────────┬────────────────────────────────────────┬──────────┐
│ LIBRARY │            INFINITE CANVAS             │ INSPECTOR│
│         │                                        │          │
│ Models  │   [Avatar]──┐                          │ Selected │
│ Avatars │             ├─►[Scene]──►[Render]──┐   │ node     │
│ Envs    │   [Env]─────┘                      │   │ params   │
│ Audio   │                                    ▼   │          │
│ Tmplts  │                              [Timeline]│ Live cost│
└─────────┴────────────────────────────────────────┴──────────┘
                ↓ embedded mini-timeline (collapsible) ↓
        ▶  scene 1 ▣▣▣  scene 2 ▣▣▣▣  scene 3 ▣▣  [Open Editor]
```

### Node types
- **Model node** — any Replicate model (search-driven, see §3)
- **Avatar node** — pick from user's avatar library or generate new; can be multi-instanced
- **Environment node** — scene image (FLUX Pro Ultra) or upload
- **Dialogue node** — multi-speaker script with avatar assignments
- **Audio node** — MusicGen / ElevenLabs / upload
- **Scene node** — combines avatars + env + dialogue + model → produces a clip
- **Render node** — terminal node, triggers generation, shows progress

Edges enforce type compatibility (avatar → scene OK, audio → render OK, etc.).

## 2. Dual Dialogue Modes (toggle on Dialogue node)

- **Storyboard mode**: speaker tags inline (`Ava: …` / `Leo: …`), engine auto-splits into clip beats and assigns the correct avatar's start-frame per beat (reuses existing dual-avatar switch protocol).
- **Conversation mode**: chat-bubble UI, drag avatars into roles, type back-and-forth. Compiles to the same beat structure under the hood. Toggle preserves data both ways.

## 3. Full Replicate Catalog

New edge function `replicate-catalog`:
- `GET /search?q=...` → live search Replicate's public model index
- `GET /model/:owner/:name` → fetch openapi schema for input fields
- `GET /featured` → curated list (Kling, Seedance, Veo3, Runway, Sora, FLUX, MusicGen, etc.) for first paint

Frontend `ModelPicker` renders schema-driven input UI (string/number/image/enum) so any model becomes usable without hardcoding. Estimated cost shown per node based on Replicate's `hardware` + run-time hint.

Requires `REPLICATE_API_TOKEN` secret (will request it).

## 4. Embedded Timeline + Editor Handoff

Bottom of canvas: collapsible mini-timeline showing scene clips in render order with audio lanes. Inline trim, reorder, mute. Button **"Open in Editor"** packages the canvas state into a Video Editor session (existing IndexedDB hydration path) and navigates to `/editor`.

## 5. Persistence

New table `creation_canvases`:
- `id`, `user_id`, `project_id`, `name`
- `nodes jsonb`, `edges jsonb` (React Flow graph)
- `viewport jsonb`, `updated_at`
- RLS: owner-only

Auto-saves on debounce. One canvas per active project (matches single-project constraint).

## 6. Files & Scope

**New**
- `src/pages/CreateCanvas.tsx` — replaces current Create
- `src/components/canvas/` — `CanvasShell`, `LibraryRail`, `InspectorRail`, `MiniTimeline`, node components (`ModelNode`, `AvatarNode`, `EnvNode`, `DialogueNode`, `AudioNode`, `SceneNode`, `RenderNode`), `ModelPicker`, `DialogueEditor`
- `src/lib/canvas/` — graph types, validators, compiler (`compileGraphToPipeline.ts`)
- `src/hooks/useCanvas.ts` — persistence + autosave
- `supabase/functions/replicate-catalog/index.ts` — search/schema/featured
- Migration: `creation_canvases` table + RLS

**Edited**
- `src/App.tsx` — route `/create` → `CreateCanvas`
- `src/lib/video/engines.ts` — extend with dynamic Replicate engine factory
- Existing pipeline endpoints accept the compiled graph payload (additive, non-breaking)

**Untouched**
- Auth, onboarding, billing, Editor internals, existing `engines.ts` curated entries (still featured)

## 7. Phasing (this loop)

1. DB migration + secret request (`REPLICATE_API_TOKEN`)
2. `replicate-catalog` edge function
3. Canvas shell + node primitives + library/inspector
4. Dialogue editor (both modes) + scene compiler
5. Mini-timeline + editor handoff
6. Wire to existing pipeline run endpoint

After approval I'll execute these top-to-bottom. The migration and secret prompt come first since they block everything else.
