# Comprehensive Logic Audit

**Date:** 2026-06-24 · **Branch:** `remediation/audit-fixes`
**Method:** (1) regression review of the 70-file "borderless design" migration (diff-based — was it truly presentation-only?), (2) fresh module-by-module logic sweep. Every Critical/High was independently re-verified against source; the agents' severities were corrected where wrong.

> **Coverage note (honest):** 3 of the 6 audit passes (regular-user+editor logic, business-module logic, admin+RPC-wiring logic) hit the shared model session limit mid-run and returned nothing. The design-regression reviews and the shared-primitives sweep completed. Those 3 module sweeps are **still pending** — see "Not yet covered."

---

## A. Design-pass regressions (introduced by the migration; my responsibility)

The "presentation-only" migration did silently change behavior in a few places.

### FIXED
| ID | File | Was | Fix |
|---|---|---|---|
| R-1 | `AdminUsersPage.tsx` | Select-all checkbox **dropped** in `<table>`→FloatTable (header `label:""`, `toggleAll` became dead) — operators couldn't bulk-select users for grant/suspend/restore/export | Extended `FloatTable` `label` to `ReactNode`; restored the select-all checkbox in the header |
| R-2 | `AdminOrgsPage.tsx` | Whole-row deep-link **lost** in DataTable→FloatTable (only the name cell stayed clickable) | Added `onRowClick` to `FloatTable`; restored row navigation |
| R-3 | `AdminUsersPage.tsx` | Invalid nesting `DeckButton`(`<button>`) > `Link`(`<a>`) on the per-row Manage action (a11y/hydration-fragile) | Replaced with a `Link` styled as the accent pill |
| R-4 | `BusinessAnalytics.tsx` | Dead `DeckButton` import (cross-surface admin→business) left by an incomplete edit | Removed |

### DOCUMENTED (feature/polish loss — not auto-fixed)
- **R-5 — `AdminDbDiagnosticsPage.tsx` — Medium:** column **sorting lost** moving off the TanStack `DataTable` (sortable Rows/Size/Dead/Seq/Idx headers) to static `FloatTable`. Data is correct; interactive sort is gone. *Restore requires sort state + clickable headers (a `FloatTable` enhancement) — deferred.*
- **R-6 — `AdminAnalyticsPage.tsx` — Low:** the secondary KPI strip lost its loading **skeleton** (`KpiTile loading` → `StatOrb` has no `loading` prop), so it shows `"—"` during fetch instead of a shimmer. Drill-down onClick + table mappings are intact.

> Verified clean: every other `DeckButton` swap preserved `onClick`/`disabled`; no `type="submit"` was lost; all `FloatTable` `column.key`s match row keys with valid `_key`s (no dropped columns / key collisions); removed imports were genuinely unreferenced. Business shared kit (`BusinessPage`/`BusinessCharts`), the rail rebuild, the shell offset, and the WelcomeVideoModal removal are behavior-preserving. (Reviewed 67 files, clean: 60.)

---

## B. Pre-existing logic findings (shared primitives — verified)

These predate the design work. None block launch on their own, but they're real.

### Corrected from "Critical"
- **L-1 — `creditSystem.ts:183` `calculateAffordableClips` — Medium (was reported Critical) — FIXED.** It calls `calculateCreditsPerClip(duration, n)` with the **engine arg omitted → defaults to `'wan'`**. The agent claimed a guaranteed tab-freeze infinite loop. **Verified false for the live path:** `creditsForScene('wan-25', 10)` returns a *positive* value (the passing unit test proves it), and the only live caller (`CreditsDisplay.tsx:29`) uses the default duration 10 → no loop. The real issues are (a) a **latent** infinite loop *if* ever called with an off-table duration (fallback returns 0), and (b) "affordable shots" is always priced at the cheapest (wan) rate. **Fixed defensively** with `if (costForNextClip <= 0) break;` (zero-cost guard) — eliminates any infinite-loop risk regardless of duration.

### High (pre-existing, documented — needs careful follow-up)
- **L-2 — `useCreditBilling.ts:255` `canAffordShots` ignores held credits.** Reads `profiles.credits_balance` (display cache) not `available = balance − held`. Over-promises affordability when pipelines hold credits. *(Same as AUDIT_REPORT L-5; UI gate only — server enforces the real charge.)*
- **L-3 — `CreditsContext.tsx:80-96` `refresh()` has no in-flight/ordering guard.** Three realtime handlers (profiles/credit_holds/credit_transactions) each fire `refresh()`; a single spend mutates all three → overlapping RPCs with no sequence token/AbortController → an older snapshot can overwrite a newer one (transiently wrong available-credits across sidebar/studio/billing).
- **L-4 — `usePaginatedProjects.ts:172` AbortController is decorative.** The signal is never passed to the Supabase query, so there's no latest-wins guard; rapid filter/search/sort changes can leave a previous filter's results showing (slower call wins).

### Medium (pre-existing)
- **L-5 — `AuthContext.tsx` provider value + methods unmemoized** → app-wide re-render storm on any of 8 state slices + the 10-min interval + visibility handler (the other contexts already `useMemo`; this root one doesn't).
- **L-6 — `useSocial.ts:266` DM realtime channel depends on the whole `user` object** (not `user.id`) → tears down/recreates on every `TOKEN_REFRESHED`/tab-focus while a thread is open (subscription churn; brief missed inserts).
- **L-7 — `useNotifications.ts:251` mark-read has no optimistic update / no invalidation** — relies entirely on the realtime UPDATE; if that isn't delivered, the unread badge never refreshes (no self-healing). (delete/clear correctly invalidate `onSettled`.)
- **L-8 — `lib/navigation/unifiedHooks.ts:324` `isLocked` is a non-reactive snapshot** (no subscription) used by `SafeLink` for click-gating + disabled styling → lock state can be stale (links clickable when locked, or greyed after completion).
- **L-9 — `useOptimistic.ts:47` concurrent `execute` corrupts rollback** — single `previousValueRef` overwritten per call; two in-flight ops roll back to the wrong baseline. No unmount guard.
- **L-10 — `NavigationCoordinator.ts:360` 50ms completion debounce can strand the lock** — two fast distinct navigations completing <50ms apart drop the second; loading overlay can hang up to the 4s safety net.
- **L-11 — `CreditsContext.tsx` setState after unmount** in `readState`/`refresh`/`reconcile` (no mounted guard; reachable from the visibility listener).

### Low (pre-existing — see agent notes)
`StudioContext` unmemoized value + `credits-updated` listener dep churn + last-project delete leaves stale `activeProjectId`; `optimisticUpdate.ts` null-clear never persists; `queryKeys.ts:93` `production.avatars/cinemaEntitlement` miss the `production` prefix (escape `_all` invalidation); `debounce.ts` throttle has no cancel/flush; `createAsyncGuard` advances id before the running-check (spurious `onStale`); `useZombieWatcher.refresh` no in-flight guard; `useTierLimits` race-timeout never cleared; unhandled rejections in `UserPreferencesContext.load`/`AuthContext` intervals.

---

## Severity summary

| Sev | Count | Status |
|---|---|---|
| Critical | 0 | (the one reported Critical was over-stated → Medium, fixed) |
| High | 3 | L-2, L-3, L-4 — documented (pre-existing) |
| Medium | ~8 | R-1..R-3 + L-1 fixed; R-5 + L-5..L-11 documented |
| Low | ~15 | R-4 + L-1 fixed; rest documented |

## Prioritized follow-up
1. **L-3 / L-4** — add a sequence/generation guard (or pass the AbortController signal) to `CreditsContext.refresh` and `usePaginatedProjects` (out-of-order races on money/list surfaces).
2. **L-2** — point `canAffordShots` at the held-aware `available` (consistency with `CreditsContext`).
3. **L-5** — memoize `AuthContext` value + callbacks (root re-render storm).
4. **R-5** — restore sortable headers in `FloatTable` (or a sort-enabled variant) for the diagnostics grid.
5. **L-6 / L-7 / L-8** — subscription-dep and reactivity fixes.

## Not yet covered (session limit — finish after reset)
- **Regular-user + editor module logic** (account/editor/studio/production correctness, async, state).
- **Business module logic** (org/seat/credit math, invite/approval state machines, switchOrg refetch races).
- **Admin module logic + RPC/edge call-site wiring** (arg/shape mismatches, aggregation/finance math, `as never` casts hiding drift).
These three sweeps were launched but the agents hit the shared session limit (resets 6:30pm). They should be re-run to make this audit complete.
