# Integration Sweep Report

**Date:** 2026-06-24
**Sweeper:** Claude (Opus 4.8, 1M context)
**Base branch:** `main` (start HEAD `64b02e29`)
**Result HEAD:** `3b9a45af` — local `main` is 3 commits ahead of `origin/main`:
`3ff150cd` (`.vercelignore`, this sweep) · `bf15e6e3` (`fix(studio): remove entrance
logo animation` — landed concurrently from the user's own session mid-sweep, kept
as-is) · `3b9a45af` (this report).

> **Concurrency note:** While this sweep ran, a separate user session committed
> `bf15e6e3` directly to local `main` (authored by Brian Cole, 21:04). It is real,
> non-financial work (removes the studio entrance logo animation + updates its
> regression test). It was already on `main`, so the push carries it along; the full
> suite was re-run on the final HEAD *including* it and stayed green.

---

## TL;DR

The repo was already heavily consolidated into `main`: **14 of 16** local branches
have **zero** unmerged commits — their work is fully in `main`. Only two branches
carried unmerged commits, and two worktrees held uncommitted files. After
evaluation, exactly **one** item was genuinely new, safe, and non-financial — a
`.vercelignore` file — which was integrated. Everything else was a duplicate,
generated noise, or money-path code that is flagged below for human review rather
than auto-merged.

- **Integrated:** 1 item (`.vercelignore`)
- **Skipped:** 1 superseded branch + 2 generated working artifacts + 1 dead worktree + 14 already-merged branches
- **Needs human review:** 1 branch (`admin-review` — touches money surface + a credit-spend auth path)
- **Tests:** typecheck ✅ · build ✅ · suite ✅ (3781 passed / 61 skipped / 0 failed)

---

## Inventory of work NOT in main

### Branches with unmerged commits
| Branch | Ahead | Behind | Verdict |
|---|---|---|---|
| `admin-review` (= `origin/admin-review`) | 1 | 54 | **NEEDS HUMAN REVIEW** — money surface + credit-spend auth |
| `error-messaging` (= `origin/error-messaging`) | 1 | 2 | **SKIP** — duplicate, superseded by main |

### Worktrees with uncommitted files
| Worktree / branch | Uncommitted | Verdict |
|---|---|---|
| `/Developer/genesis-director` (`fix/regular-user-account-bughunt`) | `?? .vercelignore` | **INTEGRATED** |
| `/Developer/genesis-director-audit` (`remediation/audit-fixes`) | `M public/sitemap.xml`, `M reports/admin-sidebar/wiring-report.json` | **SKIP** — generated artifacts |
| `/Desktop/.../agent-ade80245b293e89ae` | dir missing (locked, 468 behind, last 2026-06-09) | **SKIP** — dead worktree |

### Branches already fully merged into main (ahead: 0 — nothing to do)
`admin-work`, `audit`, `business-work`, `editor-work`, `feat/continuity-engine`,
`finance-hardening`, `fix/audit-remediation`, `fix/regular-user-account-bughunt`,
`landing-polish`, `remediation/audit-fixes`, `review`, `studio-ux-overhaul`,
`wip/admin-styling`, plus the dead `worktree-agent-ade80245b293e89ae`.

> Note: `finance-hardening` is **already fully in main** (ahead 0). No unintegrated
> financial work exists there — nothing to flag from it.

---

## Integrated

### 1. `.vercelignore` → commit `3ff150cd`
- **Source:** untracked in the `fix/regular-user-account-bughunt` worktree; not present in `main`.
- **What it does:** excludes `node_modules`, `dist`/`dist-admin`, Electron artifacts
  (`dist-desktop`, `release`), large reference media (`preserved`), and local working
  files (`reports`, `.git`) from the Vercel deploy upload.
- **Why integrate:** complete, correct, non-financial, zero code impact. It only
  affects what gets uploaded to Vercel — speeds deploys and avoids shipping artifacts.
- **Validation after integration:** typecheck ✅ · build ✅ · full suite ✅ (3781 passed).
- **Conflicts:** none (new file).

---

## Skipped (with reasons)

### `error-messaging` branch — SKIP (superseded duplicate)
- Its single unmerged commit `b64c7416` is *"fix(ci): sync bun.lock ... frozen-lockfile"*.
- `main` already has an **identically-titled** commit `64b02e29` doing the same thing.
- Proof: `git diff main:bun.lock error-messaging:bun.lock` is **empty** — the two
  lockfiles are byte-identical. `bun install --frozen-lockfile` passes on `main` today.
- The branch's only delta is a redundant copy of a fix already in `main`. Nothing to integrate.

### `remediation/audit-fixes` uncommitted files — SKIP (generated artifacts)
- `public/sitemap.xml`: regenerated output. `prebuild`/`predev` run
  `scripts/generate-sitemap.ts`, so this file is rewritten on every build (I observed
  it regenerate during my own build runs). The diff adds `/create`, `/create/legacy`,
  `/director` — which in `main` are **redirect-only** routes (`QueryPreservingRedirect`
  → `/studio`, `App.tsx:647-649`). Listing redirect targets in a sitemap is marginal-to-wrong
  SEO, and the file is auto-generated anyway. No value in committing stale generated output.
- `reports/admin-sidebar/wiring-report.json`: the only diff is the `generatedAt`
  timestamp — a generated report artifact (`reports/` is even excluded by the new
  `.vercelignore`). Junk.

### Dead worktree `agent-ade80245b293e89ae` — SKIP / report
- Path `/Users/briancole/Desktop/genesis-director/.claude/worktrees/agent-ade80245b293e89ae`
  no longer exists on disk, is **locked**, sits **468 commits behind** main, last touched
  2026-06-09. It is dead. Left untouched because it is `locked` (signals intent) and
  removing a locked worktree requires `--force`. **Recommend:** `git worktree remove --force`
  it (and the now-merged feature worktrees) to clean up. Not done automatically.

### 14 already-merged branches — nothing to do
All have `ahead: 0` vs `main`; their commits are already present. No action.

---

## Needs human review (DO NOT AUTO-MERGE)

### `admin-review` branch — commit `ae4e53b7` — **money path + credit-spend auth**

This is good, complete-looking, cohesive work, but it is **deliberately not merged**
because it falls under the hard money-path constraint and additionally changes a
security-sensitive authorization path. It must be reviewed (and the edge function
deployed) by a human. It is preserved intact on `admin-review` / `origin/admin-review`
— **nothing is dropped**.

Diff: 13 files, +442 / −78. Breakdown:

**A. Money surface (the reason it's flagged — credits/Polar/Stripe):**
- `src/refine/pages/AdminFinancialsPage.tsx`, `AdminPnlPage.tsx`, `AdminRefundsPage.tsx`,
  `AdminCouponsPage.tsx`, `AdminSubscriptionsPage.tsx`, `AdminInvoicesPage.tsx`,
  `AdminReconcilePage.tsx` — relabel the admin money surfaces from "Stripe" to "Polar"
  (consistent with the project fact that Polar.sh is the billing provider and the
  `stripe_*` DB columns hold Polar values), fix the refund-ID prompt, drop a false
  "mirrored to Stripe" coupon claim, and surface a P&L error state instead of a silent
  all-$0 statement.
- These are **mostly display-label/copy changes** (the commit states columns/queries
  are unchanged), but they are squarely on the money surface and per the hard constraint
  must be human-verified before merge — confirm no query/column/amount logic shifted.

**B. Credit-spend authorization change (security + money sensitive):**
- `supabase/functions/retry-failed-clip/index.ts` — adds an **"admin on-behalf"** branch:
  an admin JWT retrying a failed clip is resolved to the **project owner's** user_id so
  generation lock / continuity / **credit spend** bind to the owner, not the admin. It
  intentionally **bypasses** the normal `resolveEffectiveUserId` JWT-mismatch 403 when
  `is_admin` returns true.
- This is a privilege/authorization change on a spend path. It needs human security review
  (admin acting as another user; who can call it; abuse surface) **and** a Supabase edge
  function deploy — which this sweep must not do (no touching live infra).

**C. Non-financial parts bundled in the same atomic commit (would be safe alone, but entangled):**
- `src/components/admin/AdminFailedClipsQueue.tsx` + `AdminProjectDetailPage.tsx` — wire
  the real `retry-failed-clip` edge function per clip (previously a no-op status flip).
- `src/refine/pages/ops/AdminGalleryCurationPage.tsx` — reorder swaps `sort_order` with
  the real neighbour instead of colliding ±1.
- `src/refine/pages/ops/AdminAbusePage.tsx` — "not enforced at runtime" disclaimer.
- `ADMIN_REVIEW.md` — 261-line read-only audit/gap doc (fully safe).

**Why not split out part C and merge it?** Parts B and C are one cohesive feature (the
clip-retry wiring in C only works with the edge-function auth change in B), and the commit
is atomic. Surgically extracting hunks risks shipping a half-wired retry feature or dropping
functionality — which the sweep is forbidden to do. Recommendation: **review and merge
`admin-review` as a whole through the normal PR + Supabase-deploy path.**

---

## Test results

Run in a clean environment on `main` after integrating `.vercelignore`:

| Check | Command | Result |
|---|---|---|
| Typecheck | `bun run typecheck` (`tsc --noEmit`) | ✅ exit 0 |
| Build | `bun run build` (`vite build`) | ✅ exit 0 (PWA generated, 269 precache entries) |
| Test suite | `bun run test` (`vitest run`) | ✅ 114 files / 3780 tests passed, 61 skipped, **0 failed** (re-run on final HEAD incl. `bf15e6e3`; 3781 before that commit trimmed one studio-intro assertion) |
| Frozen install | `bun install --frozen-lockfile` | ✅ no changes (CI lockfile fix confirmed working) |

### ⚠️ Build-environment note (not a main defect)
On first build, `vite build` failed with:
`Source phase import "vite/modulepreload-polyfill" in "index.html" must be external`.
Root cause was a **stale local `node_modules/vite/node_modules/rollup@4.62.2`** —
rollup ≥4.58 rejects vite-plugin-pwa's `modulepreload-polyfill` source-phase import.
`bun.lock` correctly pins top-level `rollup@4.57.0` with **no** nested vite→rollup entry,
so a clean CI install uses the hoisted 4.57.0 and builds fine. Removing the stale nested
dir made the build pass. **This is a local-machine artifact, not a `main` problem — no
dependency change was made.** (If it recurs locally: `rm -rf node_modules/vite/node_modules/rollup`.)

---

## Conflicts resolved
None. The single integration was a new file; no merge conflicts arose.

## Work-loss check
No functionality was dropped. The only unmerged feature work (`admin-review`) remains
intact on its branch and `origin`, flagged above for human review. All other branches
were either already merged, duplicates, or generated artifacts.
