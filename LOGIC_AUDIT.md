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

---

# Part 2 — Module sweeps (the 3 that completed on re-run)

## C. Regular-user + editor/studio
**FIXED:**
- **RU-2 — `orchestrator.ts` (High):** every generation timestamp was `new Date(0)` (epoch 1970) — `queuedAt/preparingAt/.../completedAt` + every StatusEvent `at`, ~8 sites. Broke all elapsed-time UI and the status-bus retry guard (which compares `at`). → `new Date()`.
- **RU-3 — `ProfileDashboard.tsx:570` (High):** `navigate("/auth")` with no `useNavigate` import → `ReferenceError` when a logged-out visitor clicks Follow. → added `useNavigate`.
- **RU-5 — `Credits.tsx:160` (Medium):** my own L-4 fix used `||`, so a *legitimate* `available === 0` (spent down / fully held) fell back to the too-high cache. → loading-aware (`credits.loading ? cache : available`).

**DOCUMENTED (not yet fixed):**
- **RU-1 — `lib/editor/document-store.ts` (Critical-if-live):** the store mutates a single `state` object in place and `getDocumentState()` returns the same reference, so `useSyncExternalStore` bails on every update → the **ScriptDocument surface is non-reactive** (stays in `loading`, never repaints). Needs the store to return a fresh reference (like the sibling editor `store.ts`). *Verify whether ScriptDocument is on a live route before prioritizing.*
- **RU-4 (Medium):** duplicate global `keydown` listeners (`EditorShell` + `PlayerCanvas`) — Shift+T theater toggle cancels itself out; `F`/`N` double-fire.
- **RU-6 (Medium):** `useProject.ts` attaches takes by **filtered** playable index instead of true `shot_index` → versions drawer/`switchActiveTake` can show the wrong clip's takes when a pending/failed clip precedes a playable one.
- **RU-7 (Medium):** `store.setProject` doesn't reset undo/redo history → first Cmd-Z after switching projects restores the previous project's timeline (and can persist it).
- Plus: RU-8 `gradeToFfmpeg` reads un-normalized curves (export throws on legacy grades); RU-9 interests gated on `country` + never loaded; RU-10 JKL reverse stale-closure; Lows (follower off-by-one on no-op, redo selection prune, patron goal /0 → NaN%, `probeVideo` NaN-duration).

## D. Business module
**FIXED:**
- **B-1 — `WorkspaceContext.tsx` (High):** the DB `org_role` enum includes `editor` and the Team UI can assign it, but `OrgRole`/`ROLE_RANK` omitted it → a member set to **editor** got `ROLE_RANK['editor'] = undefined` → `hasPermission` always false → **blank rail, zero actions, full lockout**. → added `editor` to the type + rank (between producer and reviewer).

**DOCUMENTED:**
- **B-2 (Medium):** org spend/burn/billing aggregate `credit_transactions` by member `user_id` with **no org scoping** (table has no `organization_id`), so a member who belongs to >1 org has all their tx counted toward each → cross-org contamination of every KPI + the $ statement. *(Same root as AUDIT_REPORT H-6; needs an org-scoped RPC.)*
- **B-3 (Medium):** Approvals gate `hasPermission("reviewer")` lets **producers** approve/reject (producer rank > reviewer), contradicting the Permissions matrix. Rank model can't express the non-monotonic "approve" capability.
- **B-4 (Low/Medium):** the Team roster UI offers demoting/removing the owner + promoting to owner with no client guard — the **server now blocks it** (the H-1 RLS `WITH CHECK` fix), so it fails with an error toast rather than succeeding; tighten the UI for polish.
- **B-5 (Low):** BusinessCredits "Top up"/"burn report" link to legacy `/workspace/*` (works only via the redirect layer).

## E. Admin module (RPC/edge wiring + computations)
**FIXED:**
- **AD-1 — `admin_bulk_suspend`/`admin_bulk_restore` (High):** wrote `suspended_reason` but the column is `suspension_reason` → every bulk Suspend/Restore raised 42703 and did nothing. → migration `20260704000500` corrects the column.
- **AD-3 — `CostAnalysisDashboard.tsx:390` (High):** platform storage cost missing `/100` → **100× overstated** (50 GB shown as $105 not $1.05), inflating total cost and understating Net Profit. → added `/100` to match the per-bucket calc.
- **AD-4 — `AdminCommentsPage.tsx:57` (High):** selected the revoked `email` column → the whole profiles query 42501-failed → every comment author rendered as an 8-char UUID. → dropped `email` from the select.
- **AD-10 — `PeopleOverview.tsx:126` (Medium):** read `subscription_tier/tier/plan` but the column is `account_tier` → every user shown "free". → read `account_tier`.

**DOCUMENTED:**
- **AD-2 (High):** `AdminAvatarSeeder` stale-closure recursion — never advances `startIndex`, Pause is inert, regenerates preset 0 against Replicate every ~1.5s (**runaway cost**). Needs a ref-based loop.
- **AD-5/AD-6 (Medium):** the two finance dashboards disagree on revenue — CostAnalysis subtracts internal refund *grants* from revenue (the other says never subtract); Financials counts non-Stripe `purchase` rows as cash. Reconcile to one rule.
- **AD-7 (Medium):** PipelineMonitor service-health keys (`replicate-kling`, `openai-tts`) don't match logged names (`replicate-kling-v3`, `replicate_minimax`) → primary video service shows "0 calls / healthy" during a real outage.
- **AD-8/AD-9 (Medium, edge fn):** `admin-analytics` mislabels cross-window KPIs (90D card shows 30-day count; Active-30D truncated at small windows) and caps cohort activity at 1000 users while the denominator counts all → understated retention.
- **AD-11/AD-12 (Medium):** Gallery edit bumps the item to the end (`sort_order = max+1` on the edit path); Gallery-curation Up/Down does `±1` without swapping the neighbor → duplicate `sort_order`.
- **AD-13 + Lows:** email log ordered by random `message_id` not time; pricing margin /0 → "-Infinity%"; refunds "this month" ignores year; moderation "Flagged" reads the wrong column (always 0); AdminProjectsBrowser refetches un-debounced per keystroke; `AdminFailedClipsQueue` null-prompt `.toLowerCase()` throws.

> **Net:** comprehensive sweep complete. **15 logic bugs fixed** across the session; the rest documented above with file:line. Highest remaining priorities: RU-1 (script-doc non-reactivity — verify if live), AD-2 (seeder runaway cost), B-2 (cross-org credit scoping), RU-4 (editor keyboard collisions).
