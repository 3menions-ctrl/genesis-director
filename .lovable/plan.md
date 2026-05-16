## Mission

Elevate the *existing* application — no redesigns, no workflow changes, no business-logic edits — to enterprise/native-app quality. Work proceeds as sequential **verticals**, each one closing a whole class of defect across every page, with measurable proof before moving on.

## Working Principles (apply to every vertical)

- Touch only frontend/presentation code unless a refactor is required to kill a class of jank.
- Preserve `AppShell`, `PageShell`, `PageHeader`, `Surface`, locked design tokens (Pro-Dark, `#0A84FF`, Fraunces, JetBrains), and the canonical regular-user design.
- No new dependencies unless one removes a class of bugs (e.g. `@tanstack/react-virtual` for long lists). Approval required before adding any.
- Every vertical ends with: (a) before/after notes, (b) the concrete files touched, (c) the specific symptom that can no longer occur.
- I do not stop between verticals; I report progress at each vertical boundary and continue.

## The 7 Verticals (in execution order)

### V1 — Layout Stability & Anti-Jank Foundation
Eliminate the *root causes* of CLS, flicker, and hydration jumps across the app.

- Audit every route for layout-shift triggers: images/video without intrinsic dimensions, fonts without `font-display: swap` + preload, conditional-mount blocks that resize after data lands, late-mounting sidebars/headers.
- Reserve space for async content with skeleton frames that match final dimensions exactly (no "skeleton then bigger card" jumps).
- Replace any `display: none` → `display: block` toggles that cause reflow with opacity/transform-only transitions.
- Lock `AppShell` sidebar + header as a single persistent layout — verify no remount across route changes (React Router `Outlet` discipline).
- Add `content-visibility: auto` + `contain-intrinsic-size` to long off-screen sections.

**Proof:** Lighthouse CLS ≤ 0.02 on Home, Create, Projects, Editor, Settings, Admin.

### V2 — Navigation & Route Transitions
Make every route change feel like a native app.

- Audit for full-tree remounts (route-level providers wrapping `<Outlet/>` incorrectly, key churn on layout components).
- Add a single global route-transition primitive: 120–160ms opacity+1px translateY, GPU-only, respects `prefers-reduced-motion`.
- Preserve scroll position per route; restore on back/forward; reset on forward nav to a new route.
- Prefetch route chunks on link hover/focus (React Router `lazy` + intent prefetch).
- Kill all `window.location.href` navigations inside the app shell — replace with `navigate()` so the shell never blinks.

**Proof:** Route changes measured < 200ms perceived, no shell flash, scroll restored correctly.

### V3 — Interaction Polish (Hover, Press, Focus, Forms)
Every interactive surface gets the same engineered feel.

- Standardize timing tokens in `index.css`: `--ease-out-quart`, `--ease-spring`, `--dur-fast: 120ms`, `--dur-base: 180ms`, `--dur-slow: 260ms`.
- Sweep buttons, links, cards, list rows, tabs, menu items: hover (opacity/bg only, no size jumps), active (scale 0.985 or translateY 1px), focus-visible (2px `#0A84FF` ring offset 2px).
- Inputs/textareas: unified focus ring, caret color, placeholder color, error/success states, disabled treatment.
- Dropdowns / Popovers / Tooltips: standardized 80ms open delay, 0ms close, 6px offset, consistent shadow, single transform-origin per side.
- Toasts: bottom-right stack, 4s default, slide-up + fade, no layout shift on stack.

**Proof:** Manual sweep of every primary surface; no jumpy hovers, no missing focus rings, consistent timing.

### V4 — Loading & Empty States
No spinners as a primary loading state. No empty white frames.

- Replace ad-hoc spinners with shape-matched skeletons (`<Skeleton>` primitive with shimmer using `--accent-blue` at 4% alpha).
- Standardize empty states: icon + headline + subcopy + primary action; identical spacing rhythm everywhere.
- Standardize error states (inline + page-level) with a `<StateBoundary>` that owns loading/empty/error/success per data block.
- Suspense boundaries scoped to data regions, not whole pages, so the shell never blanks.

**Proof:** Every async region in the app reports the same loading shape, never shows a layout collapse.

### V5 — Responsive & Mobile Quality
The app already works on mobile; make it feel *native* on mobile.

- Audit every page at 360/390/414/768/1024/1440/1920. Fix overflow, awkward stacking, touch targets < 44px, sticky-header collisions.
- Convert hover-only affordances to long-press / explicit buttons on touch.
- Sidebar on mobile: bottom-sheet style with momentum + backdrop fade; never blocks scroll.
- Tables: collapse to card-list under `md`, with the same data and actions, no horizontal scroll.
- Honor `safe-area-inset-*` on iOS for header/footer.

**Proof:** Screenshot pass at all 7 widths on the 6 critical routes.

### V6 — Performance & Render Discipline
Make perceived latency disappear.

- Identify and fix top render hot-spots with `browser--start_profiling` on Projects, Create, Editor, Admin.
- Memoize list rows, split context providers (read vs write), move heavy derivations into `useMemo` + selectors.
- Virtualize lists > 50 rows (Projects gallery, Admin tables, Editor media bin).
- Defer non-critical work to `requestIdleCallback` / `startTransition`.
- Image pipeline: AVIF/WebP variants via `vite-imagetools`, `loading="lazy"` + `decoding="async"`, explicit width/height.
- Preload LCP image per route.

**Proof:** Profiler shows no > 50ms long tasks during nav; Lighthouse LCP ≤ 2.0s on Home.

### V7 — Component Cohesion Sweep
Final pass to enforce one visual language across every primitive.

- Single source of truth for: radii (`--r-sm 6 / --r 10 / --r-lg 14 / --r-xl 20`), elevation (4 levels), border colors (3 tones), text colors (5 tones), surface backgrounds (3 tones).
- Audit every component in `src/components/ui/` and feature components for token compliance — rip out any hard-coded hex / Tailwind color classes.
- Density audit: standardize control heights (28/32/36/44), gutter rhythm (8px base), card paddings.
- Icon sweep: lucide-react only, stroke 1.5, size 14/16/18/20 only.
- Final visual diff against the locked design memory.

**Proof:** Zero hard-coded colors in `src/`, zero off-grid spacing values in primary surfaces.

## Out of Scope (explicit)

- Adding/removing features, pages, or routes.
- Changing copy, IA, or workflows.
- Touching edge functions, RLS, DB schema, or business logic.
- Anything that violates the locked design tokens or canonical shell.
- Introducing new UI libraries (no Radix replacements, no new animation libs beyond what's already installed).

## Execution & Reporting Cadence

I will execute V1 → V7 in order, in long uninterrupted passes. After each vertical I post a short status (files touched + proof). I will not pause for approval mid-vertical. If during a vertical I discover a defect that requires a logic change to truly fix, I will flag it as a deferred item rather than silently changing behavior.

## What I need from you before I start

One thing: **confirm "no new dependencies without asking" is the right rule**, or grant blanket approval for the obvious ones (`@tanstack/react-virtual` for list virtualization, `vite-imagetools` for image variants). Everything else proceeds on your existing "do not stop until complete" mandate.