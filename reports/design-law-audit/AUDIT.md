# Design-Law Audit — Regular-User App

**Law:** (1) No bordered cards — nothing with a `border`/`ring` or boxy `bg-* + rounded-*` panel that reads as a card. (2) Buttons must be **borderless icon + text** — no fills, no borders, no text-only, (icon-only = gray area). Page backdrops, text-input backgrounds, modal overlays, and hairline dividers are exempt.

Scope: regular-user (consumer) surfaces only. Business/admin excluded. Scanned by 6 parallel agents, 2026-06-27.

---

## TL;DR — fix the root, not 700 leaves

~**700+** flagged items, but the bulk collapses to **~8 shared primitives** and **2 anti-patterns**. Fix these first and most of the app falls in line.

### The 8 highest-leverage fixes (do these first)
1. **`src/components/ui/button.tsx`** — the **default** variant is `bg-foreground text-background` (filled). Every unstyled `<Button>` violates. Also: destructive/secondary/glow/aurora/glass/premium/pill (fills), outline/secondary/glass (borders). → make `ghost` the default; strip fills/borders.
2. **`src/components/ui/card.tsx`** — **all 9 variants** are `bg-* + border + rounded` boxes; `default` is the default. → rebuild as borderless surfaces (shadow/blur only).
3. **`src/components/shell/Surface.tsx` + `.surface-card` (index.css:2276)** — the canonical in-app card carries `border`. → drop the border.
4. **`src/components/ui/PrimaryCTA.tsx`** — shared primary CTA is `border + gradient fill`, icon optional. → borderless icon+text, icon required.
5. **`src/components/ui/alert-dialog.tsx`** — drives every confirm dialog; Action/Cancel are filled/bordered/text-only. → borderless icon+text.
6. **`src/components/ui/dialog.tsx` + `badge.tsx`** — dialog content `border + ring`; badge base `rounded-full border`. → drop border/ring.
7. **`src/components/cinema/ui.tsx`** — `Glass` (`ring-1 ring-white/10`) + `Button` (white fill / ring) drive the whole landing/marketing tree. → drop ring/fill. *(landing surface; arguably its own design system — confirm if in scope.)*
8. **The `ring-1 ring-inset ring-white/[0.0x] + bg-white/[0.0x]` "glass tile" pattern** — used for tiles, panels, and active toggle states everywhere (CreationStudio, the detail drawers, most editor panels). A targeted sweep of this one combo clears the majority of "border-card" + "bordered-button" findings.

### Plus the recurring button anti-pattern
`bg-foreground text-background` / `bg-white text-black` / `bg-accent/90 text-black` solid CTAs — across TrainingVideo, MusicHub, Profile, Settings, the drawers, editor, auth, and the whole photo-editor.

---

## Counts by area (clear violations; rings/cards/buttons)

| Area | Border-cards | Filled btns | Bordered btns | Text-only btns |
|---|---|---|---|---|
| Shared UI + shell (base) | 17 | 18 | 8 | 3 |
| Lobby / Library / social / theater | ~21 | ~33 | ~6 | ~9 |
| Creation (studio/production/drawers/photo) | ~144 (incl. ~96 rings) | ~46 | ~25 | ~26 |
| Editor (timeline/panels/rails) | 52 | 66 | 38 | 19 |
| Account / Settings / Profile / Inbox / patron | ~89 | ~110 filled+bordered | — | ~30 |
| Auth / support / marketing pages | ~40 | ~22 | ~5 | ~3 |

(Gray areas — not counted: ~58 editor icon-only toolbar buttons, ~150 hairlines/structural timeline lines/modal shells/form controls/status badges.)

---

## Worst individual offenders (page/component)
- **`CreationStudio.tsx`** — 23× `ring-1 ring-inset` + 5 opaque `background: ACCENT` CTAs (header comment advertises ring-inset as the "glass" language → one find/replace clears it).
- **`EnvironmentDetailDrawer.tsx` (12 rings)** + **`TemplateDetailDrawer.tsx` (19 rings)** + **`CrossoverDetailDrawer.tsx` (14 rings)**.
- **Editor:** `EditorRightRail.tsx` (~20), `ShotInspectorCard.tsx` (13), `AudioMixPanel.tsx` (11), `Editor/views/Script.tsx` (17).
- **Account:** `ProfileDashboard.tsx` (18 cards / 27 buttons), `SettingsDashboard.tsx` (shared `Card` + `SOFT_BUTTON`), `Profile.tsx` (shared `Card` at :1123 used by every panel).
- **Older pre-Aurora pages (bordered wholesale):** `WorldDetail.tsx`, `PublicShare.tsx`, `DirectorCards.tsx`, `SupportInbox.tsx`, `HowItWorks.tsx`, `Help.tsx`, the password/auth flow pages.
- **`Production.tsx`** — still imports the bordered `<Card>` component (lines 1529, 1818).

## Already clean (reference patterns to copy)
`IconFilterTile.tsx`, `LeftRail.tsx` (RailTile), `SegmentedControl.tsx`, `EditorialCanvas.tsx`, `Studio.tsx`, `StudioHero/StudioTabs`, `ActiveRendersCard.tsx` (just redid as floating digits), and the recently-fixed Lobby/MusicHub/Auth (partial).

---

## Recommended remediation plan
- **Phase 1 — Base components** (button, card, Surface/.surface-card, PrimaryCTA, alert-dialog, dialog, badge). Clears the largest share app-wide in ~7 files. Highest risk (touches everything) → needs a visual pass.
- **Phase 2 — Anti-pattern sweep** — the `ring-1 ring-inset … + bg-white/[0.0x]` glass-tile combo (CreationStudio, the 3 detail drawers, editor panels). Largely mechanical.
- **Phase 3 — Page-by-page** — the older pre-Aurora pages (WorldDetail, PublicShare, DirectorCards, SupportInbox, HowItWorks, Help, auth flow) + remaining filled CTAs (TrainingVideo, MusicHub, Profile, Settings, Inbox, photo-editor).
- **Phase 4 — Guardrail** — an ESLint/regex check (or a `CLAUDE.md` rule) that fails on `bg-foreground text-background` buttons and `border`/`ring-1` on card containers, so it can't regress.

Full per-file, per-line findings are in the agent transcripts; the highest-leverage subset is above.
