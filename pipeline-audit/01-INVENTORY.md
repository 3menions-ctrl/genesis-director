# 01 — Inventory: Creation Types, Template Types, Combination Matrix

> Discovered from code. Every row cites where it is defined/registered. Items that
> are **defined but unwired** are flagged — they are the audit's most important
> findings because the brief's combination matrix silently assumes they all work.

## 1. Creation types / entry points

The **real** creation discriminator is the `mode` union in the `mode-router` edge
function — **not** the `ProjectType` union the brief implies.

| # | Creation surface | Where defined | Route / trigger | Backend | Status |
|---|------------------|---------------|-----------------|---------|--------|
| 1 | **Studio modes** — `text-to-video`, `image-to-video`, `avatar`, `video-to-video`, `motion-transfer`, `b-roll` | `mode-router/index.ts:170` | `/studio` (`CreationHub.tsx`) → invoke `mode-router` (`Studio.tsx:444`) | mode-router → hollywood-pipeline / specialized fns | ✅ **LIVE** |
| 2 | **Crossover / Breakout VFX** (50 templates) | `src/lib/crossovers/registry.ts`; `vfx_templates` table | `/crossover` (`Crossover.tsx:561`) | mode-router (seedance-forced) → hollywood-pipeline | ✅ **LIVE** |
| 3 | **Avatars** | `src/types/avatar-templates.ts`; `avatar_templates` table | `/avatars` (`Avatars.tsx`) | `generate-avatar-*` / mode-router `avatar` | ✅ **LIVE** |
| 4 | **Ad Studio** (business) | `src/pages/business/BusinessAdStudio.tsx` | `/business/ad-studio` | `generate-ad-studio`, `generate-ad-variants` (LLM, no static templates) | ✅ **LIVE** |
| 5 | **Training Video** | `src/pages/TrainingVideo.tsx` | `/training-video`, `/business/learning` | `generate-voice` → `composite-character` → mode-router | ✅ **LIVE** |
| 6 | **Music Hub** (audio-only) | `src/pages/MusicHub.tsx` | `/music` | `generate-music` | ✅ LIVE (not video) |
| 7 | **Environments** (modifier, not standalone) | `src/lib/environments/blueprint.ts`; `ENVIRONMENT_PRESETS` | `/environments`, applied via `?environment=` | feeds a Studio creation | ✅ LIVE (modifier) |
| 8 | **Editor / VideoEditor** (post-edit NLE) | `src/pages/Editor/`, `VideoEditor.tsx` | `/editor` | `editor-*` fns; render via `installJobRunner` | 🔴 **DORMANT** — runner never installed |
| 9 | **Production `ProjectType`** — cinematic-trailer, social-ad, narrative-short, documentary, explainer | `src/types/production-pipeline.ts:7,393` | *(none)* | *(none)* | 🔴 **DEAD** — only `src/test/*` references it |
| 10 | `free-tier-generate` | edge fn | *(none in `src/`)* | — | 🔴 **ORPHAN** — no UI caller |
| 11 | `generate-story` | edge fn | *(none in `src/`)* | — | 🔴 **ORPHAN** — no UI caller |

**Key correction to the brief:** the brief lists `ProjectType` as the creation-type
axis. In code those 5 types are **dead** — `grep -rln ProjectType src` returns only
the definition file + tests; no page sets `projectType` from a picker. The live axis
is the 6 `mode` values (#1) plus the distinct surfaces #2–#7.

## 2. Template types

| Registry | Where | Count | Categories | Consumed by | Status |
|----------|-------|-------|-----------|-------------|--------|
| **Unified `TEMPLATE_BLUEPRINTS`** | `src/lib/templates/registry.ts:744` (+ `blueprint.ts`, `breakout-templates.ts`) | **38** (10 breakout + 28 built-in) | `trending`(5), `cinematic`(4), `commercial`(4), `educational`(9), `entertainment`(4), `corporate`(2), `vfx`(**0**) | Templates gallery (`Templates.tsx:367`) + StudioShowcase (`:107`) | ⚠️ **display-only** |
| **Legacy `BUILT_IN_TEMPLATES`** | `src/hooks/useTemplateEnvironment.ts:261` (~54 entries) | ~54 | ad-hoc | **the actual runtime `?template=` consumer** (`useTemplateEnvironment.ts:1309`) | ✅ LIVE (drift risk) |
| **`vfx_templates`** (DB) | `supabase/migrations/20260615000000_crossover_templates.sql` | **50** (10×5) | `vertical_ui`, `desktop_ui`, `social_feed`, `retro_holo`, `surreal` | Crossover (`crossover_browse` RPC) | ✅ LIVE |
| **`BREAKOUT_TEMPLATES`** (in-memory) | `src/lib/templates/breakout-templates.ts:61` | 10 | trap→break→emerge | Studio `isBreakout` path | ✅ LIVE |
| **`avatar_templates`** (DB) | `avatar_templates` table; `src/types/avatar-templates.ts` | — | `AVATAR_CATEGORIES` | Avatars page | ✅ LIVE |
| **`ENVIRONMENT_PRESETS`** | `useTemplateEnvironment.ts:273` | 20 | scene presets | `?environment=` modifier | ✅ LIVE |

The 10 breakout ids: `post-escape, scroll-grab, freeze-walk, reality-rip,
aspect-escape, mirror-shatter, canvas-emerge, billboard-leap, page-burst,
hologram-materialize` (`breakout-templates.ts:397`).

### Template findings (evidence-backed)
- **Two parallel template sources.** The gallery (`Templates.tsx`) reads the new
  `TEMPLATE_BLUEPRINTS`; the runtime project spin-up reads the **separate legacy
  `BUILT_IN_TEMPLATES`** (`useTemplateEnvironment.ts:1309`). Most ids overlap so it
  "mostly works," but any registry-only id silently fails to apply. The
  registry's own header calls the `/create?template=` migration "Phase 2" — **not
  done** (`registry.ts:14`).
- **`vfx` category is declared but empty** (`blueprint.ts:255`, label "VFX &
  Breakouts") — 0 blueprints use it; the 10 breakouts are filed under `trending`.
- **Stale counts:** file headers claim 40/50 templates; the real total is **38**.
- **Two breakout sources of truth:** 50 DB `vfx_templates` (Crossover) vs. 10
  in-memory `BREAKOUT_TEMPLATES` (Studio) — different data, different categories.

## 3. Combination matrix — creation type × template type

✅ = supported & wired · ⚠️ = wired but with a defect · 🔴 = not supported / dead ·
— = N/A by design.

| Creation type ↓ \ Template → | Unified `TEMPLATE_BLUEPRINTS` | Legacy `BUILT_IN_TEMPLATES` | `vfx_templates` (Crossover) | `BREAKOUT_TEMPLATES` | `avatar_templates` | Environments | No template (raw prompt) |
|---|---|---|---|---|---|---|---|
| **Studio · text-to-video** | ⚠️ gallery only¹ | ✅ | — | ✅ (seedance-forced) | — | ✅ | ✅ |
| **Studio · image-to-video** | ⚠️ gallery only¹ | ✅ | — | ✅ | — | ✅ | ✅ |
| **Studio · b-roll** | ⚠️ gallery only¹ | ✅ | — | ⚠️² | — | ✅ | ✅ |
| **Studio · avatar** | — | ⚠³ | — | — | ✅ | ✅ | ✅ |
| **Studio · video-to-video** | — | — | — | — | — | — | ✅ (source video) |
| **Studio · motion-transfer** | — | — | — | — | — | — | ✅ (source video) |
| **Crossover** | — | — | ✅ | (overlaps) | — | — | ✅ |
| **Avatars page** | — | — | — | — | ✅ | ⚠³ | ✅ |
| **Ad Studio** | — | — | — | — | — | — | ✅ (LLM variants) |
| **Training Video** | — | — | — | — | ⚠³ | — | ✅ |
| **Editor (NLE render)** | 🔴 dead runner | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Production `ProjectType`** | 🔴 dead | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |

**Footnotes**
1. ¹ The unified registry feeds only the gallery + showcase. Selecting a template
   navigates to `/create?template=ID`, which the runtime resolves against the
   **legacy** `BUILT_IN_TEMPLATES`, not the registry. Overlapping ids work;
   registry-only ids silently no-op (see `04-GAPS.md` G3).
2. ² Breakout effects assume a 3-clip trap→break→emerge structure; b-roll's short
   shot counts may truncate the structure — wired but semantically degraded.
3. ³ Cross-registry application (e.g. environments onto avatars) is partially wired;
   not all surfaces honor every modifier. Low blast radius.

### What the matrix means in practice
- The **only fully-clean** template→creation paths are: **Crossover ← vfx_templates**
  and **Studio ← legacy BUILT_IN_TEMPLATES / raw prompt / environments**.
- Every cell that touches the **unified registry** is display-only — a real
  product gap, since that registry (38 rich blueprints) is what the Templates page
  markets, but it never drives a render.
- The **entire Editor and Production-ProjectType rows are dead** — any matrix that
  assumes those creation types "work" is wrong at the source.
