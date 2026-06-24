# Horizon Design Rollout — Gap Inventory & Execution Plan

**Reference standard:** `src/refine/pages/hubs/decks/GrowthOverview.tsx`, built on the borderless **Horizon kit** in `src/admin/ui/primitives.tsx`.
**Scope (confirmed):** Admin **+** Business surfaces. Consumer app out of scope for now.
**Timing (confirmed):** execute before going live.

## The standard (compliance checklist)
A page/card/container/graph/list is **compliant** when it uses:
- **Atmosphere:** inherits `Aurora` (admin: mounted once in `AdminLayout`; business: `BusinessBackdrop`). No per-page atmosphere.
- **KPI figures:** `StatOrb` / `FloatStat` — floating, no box, Fraunces numeral + mono uppercase label.
- **Containers/sections:** `FloatSection` — accent-tick gradient heading, **no card surface** (no border, no ring, no bg box).
- **Lists/tables:** `FloatRow` / `FloatTable` — hairline dividers only.
- **Charts:** recharts with linearGradient fill+stroke, `axisLine={false} tickLine={false}`, faint **dashed** grid (`rgba(255,255,255,0.05)`, `vertical={false}`), dark **borderless** tooltip (`#0a0d14`, `border:none`).
- **Actions:** `DeckButton` (pill, borderless).
- **Status:** `StatusPill` (tone bg, no border/ring).

**Non-compliant markers:** shadcn `Card`/`Badge`/`Table`/`Separator`/`Button(outline)`; Tailwind `border`/`ring-1` box surfaces; `bg-card`/`bg-muted`; the older *surface tier* (`AdminCard`/`KpiTile`/`ChartCard`/`DataTable`); business *ringed-glass* boxes (`rounded-2xl ring-1 ring-white/[0.07]`); default recharts axes/tooltip.

---

## KEY INSIGHT — fix shared layers, pages follow

Most gaps trace to a handful of shared components. Retargeting these converts the majority of pages at once:

- **Business kit (2 files → ~22 pages):** `src/components/business/BusinessPage.tsx` (`StatCard`, `SectionHead`, `Badge`, `EmptyState`, skeletons) and `src/components/business/BusinessCharts.tsx` (`ChartCard`, `DataTable`, `TrendStat`, chart styles).
- **Admin surface table (→ ~5 pages):** `src/admin/ui/DataTable.tsx` wraps rows in `AdminCard` (surface) → make borderless.
- **Recurring per-page swaps:** shadcn `<Button variant="outline">` refresh → `DeckButton`; shadcn `<Badge>` status → `StatusPill`.

---

## ADMIN gap inventory (81 pages)

**Fully compliant (~30):** all 5 hub pages, all 5 overview decks, shared `AdminPageShell`/`AdminConsoleV2`/`AdminDialog`; ops: Abuse, ApiKeys, AvatarCatalog, Backups, Changelog, Cohorts, Comments, ContentSafety, Coupons, EmailTemplates, Events, Experiments, GalleryCuration, Gdpr, Insights, Projections, Reconcile, Refunds, Roles, Secrets, Team, TemplatesAdmin, Traffic, Webhooks.

**Surface-tier / hard non-compliant (need real work):**
| Page | Gaps → target |
|---|---|
| `AdminDashboardPage` | `KpiTile`→StatOrb; `ChartCard`/`AdminCard`→FloatSection; remove local `AURORA_CSS` (shell provides Aurora) |
| `AdminUsersPage` (body) | bordered `<table>`→FloatTable; `<Badge>`→StatusPill; `<Button>`→DeckButton |
| `AdminProjectsPage` → `src/components/admin/AdminProjectsBrowser.tsx` | shadcn `Card`+`<table>`+`Badge`+`Button` → FloatSection/FloatTable/StatusPill/DeckButton |
| `AdminUserDetailPage` | `AdminSurface`→FloatSection; hand-rolled `Pill`/`StatCell`→StatusPill/StatOrb; `<table>`→FloatTable; action buttons→DeckButton |
| `AdminProjectDetailPage` | `AdminSurface`→FloatSection; `Pill`→StatusPill; boxed rows→FloatRow/FloatTable |
| `AdminOrgDetailPage` | `AdminSurface`→FloatSection; `Pill`→StatusPill; boxed `Stat`→StatOrb; lists→FloatRow/FloatTable |
| `AdminCostsPage` → `src/components/admin/CostAnalysisDashboard.tsx` | full shadcn `Card`/`Badge`/`Tabs`/`Progress` on light-theme tokens → FloatSection/StatusPill/DeckButton + white-opacity scale |
| `AdminPackagesPage` → `src/components/admin/AdminPricingConfigEditor.tsx` | shadcn `Card`/`Badge`/`Button`/`<table>` → Horizon kit |
| `AdminFinancialsPage` | `StatPill` boxes→StatOrb; bordered `<table>`→FloatSection+FloatTable; `<Badge>`→StatusPill |
| `AdminEmailsPage` | hand-rolled KPI boxes→StatOrb; `StatusBadge`→StatusPill; bordered `<table>`→FloatTable; `<button>`→DeckButton |
| `AdminCreditsPage` | bordered table wrapper+`<table>`→FloatSection+FloatTable; `<Badge>`→StatusPill; `<Button>`→DeckButton |
| `AdminPnlPage` | `AdminCard`→FloatSection; `KpiTile`×4→StatOrb; `Line` rows→FloatRow |
| `AdminStorageBillingPage` | no shell; `KpiTile`×6→StatOrb; `AdminCard`→FloatSection; `DataTable`→FloatTable |
| `AdminNotificationsPage` | bordered stat tiles+feed→StatOrb/FloatSection; `<button>`→DeckButton; inline Fraunces→`font-display` |
| `AdminDbDiagnosticsPage` | no shell; `KpiTile`→StatOrb; `DataTable`→FloatTable |
| `AdminFinancePage`/`AdminProductionPage` | bordered tab-bar container → borderless |

**Partial — mechanical swaps only** (`<Button variant="outline">`→DeckButton and/or `<Badge>`→StatusPill, sometimes bordered `<Input>`/`<table>`): AdminAnalytics, AdminAuditLog, AdminCrashForensics, AdminDbHealth, AdminEdgeLogs, AdminInvoices, AdminObservability, AdminOnboardingAnalytics, AdminOrgs, AdminProviders, AdminQueue, AdminReferrals, AdminSessions, AdminStatus, AdminStorage, AdminSubscriptions, AdminMacros; bespoke modals (AdminAnnouncements, AdminFeatureFlags) → reuse `AdminDialog`.

**Shared:** `src/admin/ui/DataTable.tsx` (AdminCard surface → borderless FloatTable style).

---

## BUSINESS gap inventory (24 pages + kit)

Business runs on its own kit with a **ringed-glass** idiom (`rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.015]`) vs Horizon **borderless**. It already has Aurora-equivalent atmosphere (`BusinessBackdrop`) and ~90%-correct charts.

**Shared kit (fix these first — converts ~22 pages):**
- `BusinessPage.tsx`: `StatCard`→StatOrb/FloatStat; `SectionHead`→FloatSection heading; `Badge`(ring)→StatusPill; `EmptyState`/skeletons→borderless; hero title `font-display italic`→non-italic (decision).
- `BusinessCharts.tsx`: `ChartCard`→FloatSection; `DataTable`(ringed)→FloatTable; `TrendStat`→StatOrb; chart grid solid→**dashed**; tooltip 1px border→**border:none**.

**Per-page residue after kit fix** (ad-hoc `ring-1` boxes / buttons): every page in `src/pages/business/` has some ringed containers + ad-hoc buttons → FloatSection + DeckButton. Worst: `BusinessDanger.tsx` (NON-COMPLIANT — bordered dialogs + ring buttons). Direct shadcn leak: `BusinessTeam.tsx` (`<Select>`). Cleanest: `BusinessSettings.tsx`.

---

## Execution plan (phased, verified build/typecheck/tests after each)

**Phase 0 — Foundation:** promote the Horizon kit to a shared import path so business can consume it cleanly (re-export barrel; do not move the file — 44 admin imports depend on it).

**Phase 1 — Shared kits (highest leverage):**
1. Business: retarget `BusinessPage` + `BusinessCharts` primitives to borderless Horizon (StatCard→FloatStat, SectionHead→FloatSection, ChartCard→FloatSection, DataTable→FloatTable, TrendStat→StatOrb, Badge→StatusPill; chart dashed grid + borderless tooltip). → ~22 business pages convert.
2. Admin: make `src/admin/ui/DataTable.tsx` borderless (drop AdminCard surface). → ops pages using it convert.

**Phase 2 — Admin mechanical sweep:** across the ~17 PARTIAL ops pages, swap shadcn `<Button variant="outline">`→`DeckButton` and `<Badge>`→`StatusPill`; route the 2 bespoke modals through `AdminDialog`.

**Phase 3 — Admin surface-tier rebuilds:** convert the heavy pages/components (Dashboard, User/Project/Org detail, Costs/CostAnalysisDashboard, Packages/PricingConfigEditor, Financials, Emails, Credits, Pnl, StorageBilling, Notifications, DbDiagnostics, ProjectsBrowser) from AdminCard/KpiTile/ChartCard/DataTable → FloatSection/StatOrb/FloatTable.

**Phase 4 — Business per-page residue:** remaining `ring-1` containers → FloatSection, ad-hoc buttons → DeckButton, `BusinessDanger` rebuild, `BusinessTeam` Select.

**Phase 5 — Verify:** typecheck + main build + admin build + tests; visual QA pass (requires running the app — flagged: I can verify structure/compile headlessly but not pixels).

> Honest note: structural/compile correctness is verifiable headlessly; **pixel-level visual QA needs the app running in a browser**, which I can't do here. Phases land in verified batches; visual review by a human is recommended before launch.
