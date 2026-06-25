# RELEASE_READINESS.md

**Post-integration QA & release-readiness review**
Date: 2026-06-24 · Branch: `main` (fully merged: continuity-engine → landing-polish → remediation/audit-fixes → editor-work, on top of regular-user-bughunt) · HEAD `ab0f88b8`
Method: read-only investigation. Build/typecheck/test run locally. E2E run headless against a local dev server with a **non-live** sandbox env. No live Polar/Stripe calls, no live data touched.

## VERDICT: 🔴 **NO-GO** — code is green, but the money path is not launch-safe yet

The merge integration is **clean** and the app builds/tests green. **NO-GO is driven by money-path data state, not by code defects:** the C-1 credit-ledger fix restores the *mechanism* but requires a human-run production data backfill before balances can be trusted; three High audit findings (H-2/H-8/H-9) were deliberately deferred and remain open; nine billing migrations are present but must be applied in a controlled deploy. There is also a **live external process mutating the working tree during QA** (see New Bug #1) that must be frozen before tagging a release.

---

## 1. Build health

| Check | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit -p tsconfig.json` | ✅ **PASS** (exit 0) — re-confirmed PASS on the later mutated tree too |
| Production build | `vite build` | ✅ **PASS** (exit 0, built in 17.55s, `dist/` emitted) |
| Unit/integration tests | `vitest run` | ✅ **PASS — 3769 passed, 61 skipped, 0 failed** (112 files passed, 2 skipped / 114) |
| Editor e2e | `playwright test e2e/editor-controls.spec.ts` (headless, local server) | ✅ **9/9 PASS** (with the correct sandbox env — see note) |
| Other e2e (`admin-sidebar`, `editor-demo`) | `playwright test` | ⏸️ **NOT RUN** — require a live/preview server + auth state; out of scope for read-only local QA |

**Test counts are authoritative** (run this session, this tree). The suite includes the route-component-integrity, button, continuity-engine, editor-control, and edge-function render specs.

### Editor e2e — the 6 initial "failures" were an env artifact, not a bug (proven)
First headless run showed **6 failed / 3 passed**, all failing with *"demo project never hydrated into the editor."* Investigated and **conclusively root-caused to a test-harness env mismatch, not a product regression**:

- `e2e/editor-controls.spec.ts` seeds a fake session into `localStorage` under the hardcoded key `sb-demo-sandbox-auth-token` (spec line ~29).
- `src/integrations/supabase/client.ts` uses supabase-js's **default** storage key, `sb-<project-ref>-auth-token`, where `<project-ref>` is the subdomain of `VITE_SUPABASE_URL`.
- The local `.env` points at the real project ref `ywcwaumozoejierlfkgj`, so the client looked for `sb-ywcwaumozoejierlfkgj-auth-token`, found no session, and `<ProtectedRoute>` redirected `/editor/demo` → the login/landing page (confirmed by the captured page snapshot showing "Welcome back. / Sign in").
- **Proof:** re-ran with a non-live dummy env whose URL host is `demo-sandbox` (so the storage key matches the spec) → **all 9 tests passed (32.6s)**. Env files were backed up and restored byte-for-byte afterward (sha verified).
- **Action for CI:** the editor e2e must run with `VITE_SUPABASE_URL=https://demo-sandbox.supabase.co` (or any host whose subdomain matches the seeded key). Document this in the spec / CI config so it isn't mistaken for a regression. *(EDITOR_REPORT §5's "dummy sandbox env" is exactly this.)*

---

## 2. Regression check across the 5-branch merge — ✅ nothing lost

| Item | Status | Evidence |
|---|---|---|
| **Credits.tsx: borderless UI + credit-correctness both survive** | ✅ | The single hand-resolved conflict kept **both** sides: main's real-data/borderless display **and** remediation's `M-1` business-pack gate — business packs render only for `account_type === 'business'\|'enterprise'` (`src/pages/Credits.tsx:232`). No half-merge. |
| **Editor's 10 bug fixes intact** | ✅ | All 10 markers present in source: live refs in `EditorShell.tsx` (#1, 9 refs), `onRequestInspector` (#2), `snapshot` in `document-store.ts` (#5), `stillExists` in `store.ts` redo (#6), `editor:open-text-tab` in EditorRightRail+Timeline (#9), `role="slider"` + the explicit "Shift+T intentionally NOT handled here" comment block in `PlayerCanvas.tsx` (#10). |
| **Editor e2e passes** | ✅ | 9/9 (see §1). |
| **Shortcut collision `/` vs `⌘/`** | ✅ | De-conflicted by commit `ab0f88b8`. `CommandCenter.tsx:369` opens on bare `/` only when `!metaKey && !ctrlKey`; `EditorShell.tsx:541` opens Director on `(meta\|ctrl)+/`. No double-fire. |
| **Shortcut collision `⌘⇧V`** | ✅ | The old Versions binding was retired (Versions now reachable via TopStatusBar + `Shift+H`); `Shift+V` = Crossover VFX (`EditorShell.tsx:586`). No live `⌘⇧V` handler remains. |
| **continuity-engine intact** | ✅ | `src/lib/video/continuity/*` present (boundaries, continuity-score, correction-ladder, engine-routing, identity-bible, phases, index) + 4 test files green in suite; `/pipeline-preview` route wired (`App.tsx:346`); `WelcomeVideoModal` cleanly removed (zero dangling refs). |
| **landing-polish intact** | ✅ | Footer copy "Build here. Belong here." present (`Footer.tsx:139`); SEO/sitemap artifacts generated. |

**Conclusion:** the five branches combined cleanly. A dedicated de-confliction commit (`ab0f88b8`) already resolved the highest-risk collision class (keyboard shortcuts). No merge-collision routing/shared-component/state bugs were found (verified across routing, shared components, cross-module state, shortcuts, ports, duplicate symbols).

---

## 3. Audit issues — status on merged `main` (⚠️ premise correction)

The brief assumed "3 Criticals and 9 Highs were resolved." **The accurate picture: the remediation branch fixed 3/3 Criticals and 5/9 Highs and *explicitly flagged* the other Highs as not-auto-fixable (they require live-data mutations).** H-6 was subsequently fixed via the org-scoped RPC. **None of the misses are merge reverts** — they were never in the auto-fix set (per `FIX_REPORT.md` "Not auto-fixed" section). Each fix that *was* applied is still present on `main` (not reverted by the merge).

| ID | Sev | Status on main | Evidence |
|---|---|---|---|
| C-1 | 🔴 | ✅ code present, ⚠️ **needs data backfill** | `20260704000000_revert_credit_ledger_repoint.sql` restores `credit_ledger_total → credit_transactions`; final definition in `20260704000700`. **Pre-June-20 opening balances are stranded until a human-run backfill — launch blocker (see Human Action #1).** |
| C-2 | 🔴 | ✅ resolved | `send-transactional-email/index.ts:82-88` — `service_role` claim check → 403. |
| C-3 | 🔴 | ✅ resolved | `svg-rasterize/index.ts:70` — `requireServiceRole(req)` before any write. |
| H-1 | 🟠 | ✅ resolved | `20260704000200_org_member_role_update_guard.sql` adds `WITH CHECK` blocking admin→owner. |
| H-2 | 🟠 | ❌ **OPEN (deferred)** | Cross-tenant `credits_balance`/sensitive-column read still granted to `authenticated` **and `anon`** (`20260703010000…sql:47-48`, self-documented in header). Needs grant revoke + own-read migration to `get_my_profile()` across ~12 sites + full-app verification. Flagged in `FIX_REPORT.md` #2. |
| H-3 | 🟠 | ✅ resolved | `send-push-notification/index.ts:37` — `requireServiceRole`. |
| H-4 | 🟠 | ✅ resolved | `stripe-connect-payout/index.ts:84-86` atomic row claim + `idempotencyKey` (`:141`) + `20260704000300_payout_id_nullable_for_claim.sql`. |
| H-5 | 🟠 | ✅ resolved | `20260704000100_fix_monthly_org_credit_refill_ref.sql` passes a stable `org_refill_<org>_<YYYY-MM>` ref (was NULL). |
| H-6 | 🟠 | ✅ resolved (later commit) | `20260704000600_org_scoped_credit_transactions.sql` adds org-scoped RPC; `BusinessCredits/Billing/Overview` now call `rpc("org_credit_transactions")`. |
| H-7 | 🟠 | ✅ resolved | `create-org-checkout/index.ts:90-91` membership check `fn_org_has_min_role(...,'admin')` + emits `organization_id` metadata key. |
| H-8 | 🟠 | ❌ **OPEN (deferred)** | Destructive finance seed (`20260620212254_finance_clear_and_seed.sql:24-26`) still `TRUNCATE`s `credit_transactions`/`patron_subscriptions`; archives unreachable. Production data-repair decision required. Flagged `FIX_REPORT.md` #4. |
| H-9 | 🟠 | ❌ **OPEN (deferred)** | 100 fabricated `auth.users` (`20260301000622…sql:65`) still seeded; only a human-supervised `DELETE` migration should remove them. Flagged `FIX_REPORT.md` #5. |

**Score on merged main: 3/3 Criticals resolved in code; 6/9 Highs resolved; 3 Highs (H-2, H-8, H-9) deliberately deferred and still open.** No reverts.

---

## 4. New issues from integration (severity-ranked)

The merge itself introduced **zero** cross-module collision bugs (routing/shared-components/state/shortcuts/ports/duplicate-symbols all verified clean, 3×). The findings below are (1) a live process risk discovered during QA and (2) pre-existing latent issues surfaced while reviewing the merged tree.

### 🟠 HIGH — #1: An external agent is mutating the working tree during QA (process risk)
While this review ran, **four source files were edited by something other than this QA session**, on `main`'s working tree, uncommitted:
- `src/pages/Pricing.tsx` (mtime 19:57:24 — seconds before I finished), `src/pages/Production.tsx` (19:54), `src/components/create/PipelineCreation.tsx` (19:54), `src/components/foundation/LeftRail.tsx` (19:47).
- They form a coherent in-progress feature ("**cancel generation**" wired `PipelineCreation → Production` via `handleCancelPipeline`/`isCancelling`), plus Pricing FAQ copy expansion and an icon-size tweak — **not** part of any of the 5 merged branches.
- Pricing.tsx changed **after every QA subagent had finished and while no dev/build process of mine was writing**, so these are not from this session. Origin is almost certainly the connected **Lovable** platform (this is a Lovable project: `.lovable/`, `lovable-tagger`, `…lovable.app` preview URL) syncing edits into the repo.
- The edits currently typecheck clean (re-ran `tsc` → exit 0) and `handleCancelPipeline`/`isCancelling` are properly defined in `Production.tsx`, so they are **internally consistent but unreviewed and uncommitted**.
- **Impact:** you cannot cut a reproducible release while the tree is changing underneath you, and unreviewed feature code is appearing on `main`'s working tree. **→ Human Action #5 (freeze the tree).**

### 🟡 MEDIUM — #2: `CommandCenter` + `AdminPalette` both bind `⌘K` on `/admin` in dev (pre-existing, dev-only)
On `/admin` under the dev server, `⌘K` toggles both palettes at once (`CommandCenter` window-keydown, always mounted `App.tsx:908`; `AdminPalette` document-keydown, `src/refine/AdminLayout.tsx:258`). **Not merge-caused** (both bindings predate all 5 branches) and **does not affect production** (admin is tree-shaken out) or the standalone admin build. Low urgency; path-guard one of them.

### 🟢 LOW — #3: `credits-updated` event has 3 listeners, 0 dispatchers (pre-existing)
`AuthContext.tsx:183`, `StudioContext.tsx:295`, `useEffectiveCredits.ts:70` listen for a `credits-updated` window event that nothing ever dispatches. Near-nil impact (the spend path calls `effective.refresh()` directly at `Studio.tsx:356`). The remediation branch added the third dead listener. Either wire a dispatch on the spend path or drop the listeners.

### 🟢 LOW — #4: Stale credit-cost display constants (cosmetic, not a charge path)
`creditSystem.ts:66-79` legacy `COST_PER_CLIP` (50/75) and `creditPackages.ts:34-36` `approxClips` "~10 cr/clip" contradict the real engine-registry truth (Kling 10s = 35 cr). These feed only display/estimate UI — **never the ledger charge** (real charges go through `creditsForScene`/server RPCs). Reconcile in a follow-up.

---

## 5. Money paths — coherent, no live calls (do not deploy migrations blind)

- **Pricing/credit/subscription coherence: ✅ YES.** Canonical **$0.10/credit** (`CENTS_PER_CREDIT: 10`, `creditSystem.ts:63`) is consistent everywhere and locked by tests. Per-clip pricing has a single source of truth (`src/lib/video/engines.ts`) that the credit system derives from. The 7 credit packs (`creditPackages.ts`) match the server grant maps in `polar-checkout`/`create-plan-checkout` with a monotonic volume discount; subscription tier→credit grants (Indie 220 / Pro 600 / Studio 2000) match across both providers.
- **No live Polar/Stripe calls at rest: ✅ confirmed.** Only two client-construction sites exist — `_shared/stripe.ts:25` and `_shared/polar.ts:34` — both server-side, both inside `Deno.serve` checkout handlers invoked only on explicit authenticated user action. **Frontend constructs zero payment clients** and only calls `supabase.functions.invoke`. Nothing hits a payment API on import/render/test. The QA run made no live payment calls.
- **Env gating (M-2): ✅ present.** Secrets are env-sourced (never hardcoded); the M-2 origin-gate (honor client `environment="sandbox"` only on localhost) is present on all charge-creating checkouts (`create-credit-checkout:30`, `create-plan-checkout:56`, `create-cinema-checkout:38`). Minor: four read-only management functions still default to the older sandbox-tag pattern — tidy-up, not a charge risk.
- **9 migrations present, applied-state UNVERIFIED here.** All nine `20260704*` migrations exist locally. Two of their backing commits are explicitly marked **UN-DEPLOYED** (`faa17385` org-pool consumption, `0059cbeb` org-scoped analytics), and `20260704000700` self-labels "⚠️ MONEY-PATH, UN-DEPLOYED." **Confirming they are un-applied against the live DB requires DB access I deliberately did not use** → Human Action #2.

---

## 6. GO / NO-GO checklist

### ✅ Green (done / verified)
- [x] Typecheck passes (exit 0)
- [x] Production build passes (exit 0)
- [x] Unit/integration suite: 3769 passed, 0 failed
- [x] Editor e2e 9/9 (with correct sandbox env)
- [x] Merge lost nothing: Credits both-sides, 10 editor fixes, shortcut de-confliction, continuity, landing all intact
- [x] 3/3 audit Criticals present (code); 6/9 Highs resolved; no reverts
- [x] Pricing/credit/subscription logic coherent; no live payment calls at rest; M-2 env gating present

### 🔴 Blockers — must clear before launch (all require a human with prod/DB access)
- [ ] **C-1 production data backfill** — re-insert pre-June-20 opening balances into `credit_transactions`; without it, customer balances read a frozen/wrong snapshot. *Launch blocker.*
- [ ] **Apply the 9 `20260704*` migrations** in a controlled deploy and **verify org credit-pool consumption math in staging** before promoting (esp. `000700` org-pool consumption + `000600/000800` analytics). Confirm current applied-state against the live DB first.
- [ ] **Validate H-4 Stripe payout race fix + M-3 Polar mapping in staging** before money flows.
- [ ] **Freeze the working tree** (New Bug #1) — stop the external/Lovable sync, then commit-or-discard the 4 uncommitted files so the release is built from a known SHA.

### 🟠 Decisions required before or with launch (deferred Highs)
- [ ] **H-2** — revoke cross-tenant `credits_balance`/sensitive-column grant (open to `anon`); migrate own-reads + verify in a running app.
- [ ] **H-8** — decide finance-history retention vs. restore-from-archive (history was truncated).
- [ ] **H-9** — remove the 100 fabricated `auth.users` under human supervision.

### 🟢 Non-blocking follow-ups
- [ ] Pin editor e2e to the `demo-sandbox` env in CI (so it isn't misread as a regression).
- [ ] Path-guard `⌘K` on `/admin` in dev (New Bug #2).
- [ ] Wire or remove the dead `credits-updated` event (New Bug #3).
- [ ] Reconcile stale `COST_PER_CLIP`/`approxClips` display constants (New Bug #4).
- [ ] Run `admin-sidebar`/`editor-demo` e2e against a preview deploy.

---

## 7. ⚠️ Flagged for human action (consolidated — needs a person, not an agent)

1. **C-1 credit-balance backfill** — mutates live balances; reviewed data migration, human + DB access. *Highest priority, launch blocker.*
2. **Apply + stage-verify the 9 billing migrations**; confirm live applied-state. Do not auto-apply the two UN-DEPLOYED org-pool commits to prod without staging verification.
3. **H-2 / H-8 / H-9** — three open Highs, each a production-data or grant/RLS decision.
4. **Stripe payout + Polar mapping staging validation** before enabling money flow.
5. **Stop the live working-tree mutation (Lovable sync) and lock the release SHA** — an external process edited `Pricing.tsx`, `Production.tsx`, `PipelineCreation.tsx`, `LeftRail.tsx` mid-QA; these are uncommitted and unreviewed.

> Note on QA hygiene: env files (`.env`, `.env.local`) were temporarily overlaid with non-live `demo-sandbox` values to prove the e2e env artifact, then **restored byte-for-byte (sha verified)**. The only files this review left changed are this report and `MERGE_PLAN.md` (untracked). The 4 mutated source files in §4#1 were **not** changed by this review.
