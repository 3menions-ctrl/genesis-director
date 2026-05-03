---
name: Canonical Regular-User Design (LOCKED STANDARD)
description: The exact design system used by the Personal/Regular account. ALL new account types (Business, Enterprise, Admin) MUST inherit this — no deviation.
type: design
---

# Canonical Standard — Regular User (Personal Account)

This is the **single source of visual truth** for the entire app. Business, Enterprise, and Admin tiers reuse this shell unmodified — only the *content* and *feature gates* differ, never the visual language.

## 1. Foundation tokens (src/index.css :root)

- **Background**: `hsl(220, 14%, 2%)` — Pro-Dark base
- **Foreground**: `hsl(240, 5%, 90%)`
- **Card**: `hsl(220, 12%, 6%)` / **Popover**: `hsl(220, 12%, 8%)`
- **Primary** (CTAs): pure white `hsl(0, 0%, 100%)` on near-black text
- **Accent** (highlights): cool blue `hsl(211, 100%, 60%)` — also used as `--sidebar-primary`
- **Border**: `hsl(220, 10%, 14%)`
- **Radius**: `0.75rem` base; `2xl` for nav items, `full` for pill CTAs
- **Surface elevation**: 4 tiers (`--surface-0` through `--surface-3`)
- **Glass tokens**: `bg-white/[0.03]` default → `/[0.06]` hover → `/[0.10]` active; border `/[0.08]` → `/[0.14]`
- **Shadows**: deep neutral black, defined `--shadow-xs` through `--shadow-2xl` plus `--shadow-glow` (blue)
- **NO purple/violet anywhere.** Single accent hue family: blue (`hue: 215` in nav, `211` in tokens).

## 2. Fonts (actual, in-use — supersedes prior memory)

- **Body & display**: `Fraunces` (serif, opsz 9-144) — loaded from Google Fonts in `index.html`
- **Mono**: `JetBrains Mono`
- **Also loaded** (used in select editorial headings only): `Sora`, `Instrument Sans`
- Default Tailwind `font-sans` → Fraunces (set in `tailwind.config.ts`)

## 3. App shell (src/components/shell/AppShell.tsx)

The single authenticated layout. Wraps every signed-in route via `AdaptiveShell`.

### Sidebar rail
- **Width**: 236px expanded / 72px collapsed (icon-only)
- **Persistence**: `localStorage` key `apex.sidebar.collapsed`
- **Position**: desktop = sticky `lg:sticky lg:top-0 lg:h-screen`, in-flow flex sibling; mobile = slide-in drawer with backdrop
- **Background**: `linear-gradient(180deg, hsla(220,18%,4%,0.92), hsla(220,16%,3%,0.96))` + `backdrop-blur(40px) saturate(160%)`
- **Border**: `border-r border-white/[0.06]`
- **Top edge highlight**: 1px gradient `transparent → white/8% → transparent`
- **Accent halo**: radial primary glow at top center, blurred 24px, opacity 50%

### Brand block
- 60px height, logo in 36px rounded-2xl tile with gradient `white/[0.07] → white/[0.015]` + inset highlight
- Brand text: `Apex-Studio` in 15px `font-display` semibold, kerning `-0.03em`
- Subtitle: `Creative Suite` in 9px uppercase, tracking `0.22em`, opacity 30%

### Workspace switcher
- Renders below brand (component: `WorkspaceSwitcher`)

### "New Project" CTA
- Full-width pill (`rounded-full h-10`)
- Gradient `from-white/[0.10] to-white/[0.04]` → hover `/[0.14]/[0.06]`
- Blue glow shadow `0 10px 32px -12px hsl(215 100% 55% / 0.45)` → hover doubles
- `Sparkles` icon tinted `hsl(215, 100%, 72%)` with drop-shadow glow
- Hover scale `1.015`, active `0.985`

### Section labels
- 9.5px uppercase, tracking `0.28em`, opacity 25%, color white

### Nav items (THIS IS THE CRITICAL PATTERN — ALL TIERS MUST USE IT)
- Height: 40px, `rounded-2xl`, padding `px-3`, gap-3
- Font: 13px, `font-light`, tracking `-0.005em`
- Default state: `text-white/55` → hover `text-white`
- **Active state**: gradient wash `linear-gradient(90deg, hue/16% → hue/5% → transparent)`, inset top highlight `white/7%`, blue drop-shadow `0 12px 28px -16px hue/50%`
- **Active rail accent**: 2px wide vertical bar, `-left-3`, height 28px, gradient `hue 100%/72% → hue 95%/55%`, glow `0 0 16px hue/85% + 0 0 32px hue/40%`
- **Active right indicator**: 6px dot, `hue 100%/72%`, double box-shadow glow
- Icons: 18px, stroke 1.5; default tint `hue/50%`, active full saturation + drop-shadow glow
- Hover micro-interaction: icon `scale 1.1` + `translateX 1px`, label `translateX 2px`
- Single hue family across all nav: **`215` (cinematic blue)** — NEVER multi-color rainbow

### Collapsed-mode behavior
- Items become icon-only with `Tooltip` on right (sideOffset 8)
- Tooltip styling: `bg-card/95 border-white/10 text-[12px] font-medium`

## 4. Background

- `<CinemaBackdrop />` rendered at shell root — same backdrop as the global loading screen. App body is `bg-transparent` to let it show through.

## 5. Topbar
- 60px aligned with sidebar brand height
- Right cluster: `NotificationBell`, credits pill (with zero-state hover to open `BuyCreditsModal`), user dropdown
- All controls glass: `bg-white/[0.03]` + `border-white/[0.08]`

## 6. Component primitives (canonical wrappers)

- `src/components/shell/PageShell.tsx` — page container with consistent max-width + padding
- `src/components/shell/PageHeader.tsx` — page title + subtitle slot + action slot
- `src/components/shell/Surface.tsx` — glass card primitive
- `src/components/shell/SegmentedControl.tsx` — tab/segment switcher
- All NEW pages MUST compose these — never roll a custom container.

## 7. Animation grammar

- Durations: 200ms (micro), 300ms (default), 500ms (large/wash), 700ms (idle pulses)
- Easing: `ease-out` default; `cubic-bezier(0.22, 1, 0.36, 1)` for premium reveals
- Hover scale ceiling: `1.015` (CTA) / `1.05` (icon) — never larger
- Keyframes registered in `tailwind.config.ts`: `fade-in`, `scale-in`, `pulse-soft`, `pulse-glow`, `shimmer`, `loader-*`

## 8. Inviolable rules for new account types

1. **Same shell** — Business and Enterprise reuse `AppShell` unmodified. Tier differences appear inside the page content area only (extra nav items added to `PRIMARY_NAV` with the same hue 215, same styling).
2. **Same hue** — never introduce gold/purple/green tints to indicate tier. Tier is communicated by *labels and badges*, not by recoloring the chrome.
3. **Same fonts** — Fraunces body, JetBrains mono. No tier-specific typography.
4. **Same tokens** — never hard-code colors. Always `hsl(var(--…))` or the glass/surface/sidebar token families.
5. **Same primitives** — `PageShell`, `PageHeader`, `Surface`, `SegmentedControl`. New pages that bypass these will be rejected.
6. **Same animation grammar** — durations, easings, scale ceilings as listed above.
7. **No purple/violet, ever.** This is a constraint, not a guideline.
