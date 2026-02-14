

# Neuter Landing Page & Unify Loading Architecture

## Overview
Strip the landing page of its heavy, crash-simulating, and bandwidth-hogging elements while ensuring every page and feature loads through the existing world-class CinemaLoader + Gatekeeper pattern.

---

## Phase 1: Remove ScreenCrashOverlay (Three.js elimination)

**Problem**: ~500KB bundle bloat from Three.js/React Three Fiber. Simulates a crash, confusing users. 10-second countdown blocks interaction.

**Action**:
- Delete `src/components/landing/ScreenCrashOverlay.tsx`
- Delete `src/components/landing/glass-shatter/` directory (GlassShatterScene.tsx, GlassShard.tsx, shardGenerator.ts, index.ts)
- Remove the ScreenCrashOverlay import, state, and JSX from `Landing.tsx`
- Remove `screenCrashDismissed` state and `handleDismissScreenCrash` callback

---

## Phase 2: Neuter CinematicTransition (650-line animation monster)

**Problem**: 150 particles, 32 rays, 12 orbs, 5 pulse rings, 13-second sequence. Massive Framer Motion overhead.

**Action**:
- Replace the entire `CinematicTransition.tsx` with a clean 2-second fade-to-black using the existing `CinemaLoader` component
- Transition: fade in CinemaLoader -> navigate after 1.5s -> fade out
- Removes ~600 lines of particle/ray/orb animation code

---

## Phase 3: Fix PromptResultShowcase video preloading

**Problem**: 4 videos with `preload="auto"` = 40-80MB loaded on page mount.

**Action**:
- Change `preload="auto"` to `preload="none"` on the showcase video element
- Videos only load when the typewriter cycle reaches the reveal phase (already happens via `.play()`)

---

## Phase 4: Fix AvatarCTASection video preloading

**Problem**: Avatar CTA video uses `preload="auto"`, loading eagerly.

**Action**:
- Change `preload="auto"` to `preload="none"`

---

## Phase 5: Remove duplicate SocialProofTicker

**Problem**: Two identical `<SocialProofTicker />` instances in Landing.tsx, each running independent intervals.

**Action**:
- Remove the second `<SocialProofTicker />` (between FeaturesShowcase and PricingSection)

---

## Phase 6: Landing page gatekeeper integration

**Problem**: Landing page has no loading gatekeeper -- it just renders everything immediately, causing layout thrash as lazy components pop in.

**Action**:
- Add the landing page to the gatekeeper system via `useGatekeeperLoading` with a lightweight config
- Show `CinemaLoader` briefly while the AbstractBackground image and hero section mount
- Signal ready once the background image loads and auth check completes
- This gives a clean fade-in instead of content popping

---

## Technical Details

### Files to delete:
- `src/components/landing/ScreenCrashOverlay.tsx`
- `src/components/landing/glass-shatter/GlassShatterScene.tsx`
- `src/components/landing/glass-shatter/GlassShard.tsx`
- `src/components/landing/glass-shatter/shardGenerator.ts`
- `src/components/landing/glass-shatter/index.ts`

### Files to modify:
- `src/pages/Landing.tsx` -- Remove ScreenCrashOverlay, remove duplicate ticker, add gatekeeper
- `src/components/landing/CinematicTransition.tsx` -- Replace with minimal CinemaLoader-based transition
- `src/components/landing/PromptResultShowcase.tsx` -- `preload="none"`
- `src/components/landing/AvatarCTASection.tsx` -- `preload="none"`
- `src/hooks/useGatekeeperLoading.ts` -- Add `landing` preset

### Expected impact:
- ~500KB bundle size reduction (Three.js removal)
- ~40-80MB less bandwidth on landing page load
- Consistent loading UX via CinemaLoader across all entry points
- Faster LCP and Time to Interactive

