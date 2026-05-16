## Scope

Foundation-level polish across the entire authenticated app + targeted refinement on the 5 highest-traffic surfaces. Marketing landing (`/`) and locked surfaces (AppShell sidebar specs, Magazine Gallery, Legendary Player, Pricing Cards, Studio Pro editor, Cinematic Studio create page) are **skipped** — polish flows around them.

Hard constraints honored: no redesign, no workflow change, no business-logic change, no new experimental concepts. Existing tokens, fonts, colors, layouts preserved exactly.

---

## Phase 1 — Foundation tokens & primitives (global lift)

Edits live almost entirely in `src/index.css`, `tailwind.config.ts`, and 4-6 ui primitives. These cascade everywhere with zero per-page changes.

**Motion system**
- Standardize 3 easing curves (`--ease-out-quart`, `--ease-out-expo`, `--ease-in-out-quart`) and 4 duration tokens (instant 100ms / fast 160ms / base 220ms / slow 320ms).
- Replace ad-hoc `transition-all duration-300` patterns inside primitive components with the new tokens (no functional change, just consistency).
- Respect `prefers-reduced-motion` globally.

**Interaction states (primitive level only)**
- Button: tighten press-down scale (0.98), unify focus-visible ring (2px `--ring` w/ 2px offset), ensure 44px min touch target on mobile.
- Input/Textarea/Select: consistent focus ring, no layout shift on focus, smoother placeholder transitions.
- Dropdown/Popover/Tooltip/Dialog: unified open/close timing, consistent backdrop blur, kill the 200→300ms animation drift between Radix defaults.

**Stability fixes (CLS hotspots)**
- Add `min-h-dvh` to PageShell to stop route-swap collapse.
- Reserve scrollbar gutter on `<html>` to prevent layout shift when dialogs open.
- Skeleton loaders: ensure same height as final content; add a single shimmer keyframe and apply uniformly.
- Image components: enforce intrinsic `aspect-ratio` on cards to remove pop-in.

**Scroll & overflow polish**
- Apply `premium-scroll` (already defined) to main scroll containers in PageShell.
- Add `overscroll-behavior: contain` to modal bodies and side panels.

**Toast & feedback**
- Confirm Sonner toast position is consistent (`bottom-right`, single Toaster), unify default duration to 4s, success/error icon sizing.

---

## Phase 2 — Top-5 surface refinement (per-page, light touch only)

Each surface gets: spacing audit, hover/focus consistency, empty/loading state stability, header alignment to `PageHeader` primitive. **No structural changes.**

1. **`/projects`** (Projects.tsx) — verify uses `PageShell`+`PageHeader`, debounce-driven render stability already exists; polish card hover states and grid rhythm, ensure skeleton matches final grid.
2. **`/create`** (Create.tsx / CreateCanvas.tsx) — **Cinematic Studio locked**, only touch surrounding chrome (header, breadcrumbs, transitions in/out).
3. **Video Editor shell** (Studio.tsx / DirectorStudio.tsx) — **Studio Pro aesthetic locked**, polish only the non-canvas chrome: panel headers, resize handles, tab transitions.
4. **`/settings`** (Settings.tsx) — tab switching stability, form section spacing rhythm, save-state feedback.
5. **`/pricing`** (Pricing.tsx) — **Circular glassmorphic cards locked**, polish only surrounding section spacing, headline alignment, FAQ accordion timing.

---

## Phase 3 — Verification

- `tsc --noEmit` clean
- Visual spot-check each touched page at 1440 / 1024 / 390 viewports
- Console log scan for new warnings
- Confirm no locked-surface tokens were modified (grep for sidebar widths, magazine grid classes, player borderless flag)

---

## Out of scope (explicit)

- Marketing landing (`/`) and all its components
- Locked surfaces listed above
- Any auth/onboarding flow changes
- Any new pages, features, or removed capabilities
- Edge functions / backend
- Per-page redesigns

---

## Risk

Low-medium. Token changes cascade widely — if a primitive's animation timing change makes one surface feel off, I revert that single token. No business logic touched.

## Deliverable

A measurably tighter app: consistent motion, no CLS on route swaps, unified focus rings, stable skeletons, and the 5 top surfaces feeling intentional instead of assembled. Estimated 1 long session.
