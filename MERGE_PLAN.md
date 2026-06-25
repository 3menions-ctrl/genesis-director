# MERGE_PLAN.md

**Release manager analysis — branch inventory & integration plan**
Generated: 2026-06-24 · Base: `main` @ `47f362f5` · Analysis only, nothing merged or changed.

---

## TL;DR

- **Only 4 branches contain unmerged work.** Everything else is already in `main` (its tip is an ancestor of `main`) and is safe to delete.
- **3 are active** (all committed today, 2026-06-24): `remediation/audit-fixes`, `feat/continuity-engine`, `landing-polish`.
- **1 is dead:** `ui/footer-belong-copy` — fully superseded by `landing-polish`, 131 commits behind, deleted upstream (`gone`).
- **All previously-shipped money branches are already in `main`:** `polar/subscriptions-credits` (PR #7), `golive/remove-beta-free-credits` (PR #6), `fix/subscription-tier-provisioning` (PR #28). They were pruned on fetch — nothing to do.
- **The one money-path conflict to worry about is `remediation/audit-fixes`** — it collides with `main` on exactly one file: `src/pages/Credits.tsx`. This is the credit fix the brief flags. Resolve by hand, preserving both sides.
- **Recommended order:** continuity → landing → remediation (highest-risk last, merged onto a known-green tree), then delete the dead/merged branches.

---

## 1. Full branch inventory

### Already merged into `main` (tip is an ancestor — 0 unique commits) → **DELETE**

| Branch | Tip | Notes |
|---|---|---|
| `admin-review` | `47f362f5` | == main. Worktree `…/genesis-director-admin-review`. |
| `editor-work` | `47f362f5` | == main. Worktree `…/genesis-director-editor`. |
| `admin-work` | `d800d424` | Admin borderless redesign — in main. |
| `audit` | `e43c0799` | Borderless redesign finish — in main; is the base of `remediation/audit-fixes`. |
| `business-work` | `2c7c333b` (origin `33c74793`) | In main; origin tip also merged. Worktree `…/genesis-director-business`. |
| `fix/audit-remediation` | `0e3d0d92` | "clear-cut correctness bugs" — in main. Worktree `…/genesis-director-review`. |
| `fix/regular-user-account-bughunt` | `62a98984` | 23-fix bughunt — in main. Worktree = primary repo `…/genesis-director`. |
| `review` | `ca9e8f3b` | Old PR-merge branch — in main. |
| `studio-ux-overhaul` | `32225fe1` | Payments→Credits hub move — **already in main** (this is what `Credits.tsx` now looks like). |
| `wip/admin-styling` | `8dd7e4fa` | "WIP regular user handoff" — in main. |
| `worktree-agent-ade80245b293e89ae` | `2664f097` | Agent scratch ("Removed AI slop") — in main. Worktree is **locked** on Desktop. |

### Pruned remote money branches (already merged via PR) → no action

| Branch | Merged via | Where it lives now |
|---|---|---|
| `polar/subscriptions-credits` | PR #7 (`2b7a0a50`) | main |
| `golive/remove-beta-free-credits` | PR #6 (`55ff4991`) | main |
| `fix/subscription-tier-provisioning` | PR #28 (`e03e6017`) | main |

(Plus ~45 other feature/fix/ui branches pruned on fetch — all previously merged, no local refs remain.)

### Unmerged work → **MERGE or DELETE** (detailed below)

| Branch | Unique commits | Merges into main? | Verdict |
|---|---|---|---|
| `feat/continuity-engine` | 1 | ✅ clean | **MERGE** (current branch) |
| `landing-polish` | 1 | ✅ clean | **MERGE** |
| `remediation/audit-fixes` | 41 | ⚠️ 1 conflict (`Credits.tsx`) | **MERGE — extra care (money)** |
| `ui/footer-belong-copy` | 1 | ⚠️ conflict (`Footer.tsx`) | **DELETE — superseded** |

---

## 2. Unmerged branches in detail

### A. `feat/continuity-engine` @ `e2535178` — **active, low risk**
- **Base:** branches directly off `main` (`47f362f5`). 1 commit, +3,671/-100 across 27 files.
- **Touches:** new video-continuity engine (`src/lib/video/continuity/*` + tests), `PipelineCreation.tsx`, `PipelinePreview.tsx`, `Production.tsx`, `model-catalog.ts`, App route, and **Supabase edge functions** (`hollywood-pipeline`, `continuity-audit`, `validate-seam-continuity`, `_shared/continuity-contract.ts`, `_shared/seam-ssim.ts`) + 1 migration (`20260703030000_video_clips_continuity_score.sql`).
- **Money path?** No. Touches generation pipeline/compute, not billing/credits.
- **Conflicts:** Merges **clean** into main. Shares only `src/App.tsx` with remediation, and that **auto-merges** (different regions: continuity adds a `/pipeline-preview` route; remediation removes the WelcomeVideoModal).
- **Verdict:** Merge first. Self-contained, well-tested, no overlap risk.

### B. `landing-polish` @ `27d4f127` — **active, low risk**
- **Base:** off `main`. 1 commit, +324/-204 across 12 files.
- **Touches:** marketing/SEO only — `index.html`, `public/llms.txt|robots.txt|sitemap.xml`, `scripts/generate-sitemap.ts`, `Footer.tsx`, `Contact.tsx`, `HelpDoc.tsx`, `HowItWorks.tsx`, `Landing.tsx`, `Pricing.tsx`.
- **Money path?** No. `Pricing.tsx` is marketing copy only (purchasing already moved to the Credits hub in main); 10 lines, does not overlap remediation.
- **Conflicts:** Merges **clean** into main. **Contains the footer copy from `ui/footer-belong-copy`** (`"You were never meant to build alone."` + `"Build here. Belong here."`) → it supersedes that branch.
- **Verdict:** Merge second. No overlap with continuity or remediation.

### C. `remediation/audit-fixes` @ `d6a56d33` — **active, HIGH RISK (money)**
- **Base:** off `audit` (`e43c0799`), older than the other two — `main` is **18 commits ahead** of that base; branch is **41 commits ahead**. +5,498/-4,765 across **118 files**.
- **This is the credit fix the brief calls out.** It is a full pre-production audit: security + payments + credits + admin/business redesign. Highlights:
  - **Credits/payments correctness:** `C-1` revert June-20 ledger repoint, `H-5` `monthly_org_credit_refill` NULL payment ref, `H-4` double-payout race in `stripe-connect-payout`, `H-7` org-membership in `create-org-checkout`, `M-1` hide business credit packs on personal surface, `M-2` gate client-controlled Stripe env, `M-3` reject Polar subscription with no credit mapping, `M-5` canonical $0.10/credit, `M-13` profit-dashboard rate + div-zero guard, `d6a56d33` org-aware/hold-aware wallet.
  - **Edge functions:** `polar-checkout`, `create-org-checkout`, `create-cinema-checkout`, `create-plan-checkout`, `stripe-connect-payout`, plus security hardening on `svg-rasterize`, `send-transactional-email`, `send-push-notification`, `process-ai-video-replies`, `manage-sessions`.
  - **9 new migrations** dated `20260704*` (org-scoped credit transactions, org pool consumption, org credit state, payout id nullable, refill ref fix, ledger repoint revert, role-update guard, profit rate, bulk-suspend column).
  - **Admin/business redesign:** ~70 `src/refine/**` and `src/pages/business/**` files (borderless "Horizon" rollout).
  - **Docs:** `AUDIT_REPORT.md`, `FIX_REPORT.md`, `LOGIC_AUDIT.md`, `DESIGN_GAPS.md`.
- **⚠️ Carries 2 explicitly UN-DEPLOYED items** — `faa17385` (org generations consume org credit pool) and `0059cbeb` (B-2 org-scoped credit analytics migration). These touch live billing math and must be deploy-gated/verified separately, not assumed live on merge.
- **Conflicts:** Merges into main with **exactly one conflict: `src/pages/Credits.tsx`** (everything else — incl. `Studio.tsx`, `ProfileDashboard.tsx`, `App.tsx` — auto-merges). The conflict is between main's reg-user pass (`e0229d3b` "real data only / remove decorative badge titles", `e1807ad2` borderless sweep) and remediation's credit-correctness edits (`M-1` hide business packs on personal, `L-4/6/7/10` credit/achievement displays, `89d2ccf7` 8 confirmed bugs). **Both sides must survive the resolution** — keep main's real-data/borderless display AND remediation's credit-correctness logic.
- **Verdict:** Merge last, by hand, with the money checklist in §5.

### D. `ui/footer-belong-copy` @ `acb0cf6f` — **DEAD, delete**
- 1 commit, 1 file (`Footer.tsx`, 2 lines). Base is ancient (`5fc06693`, main is **131 ahead**), upstream branch is **`gone`**, last touched 2026-06-22.
- The exact copy it introduces is **already present in `landing-polish`'s `Footer.tsx`**. Merging it would only create a needless `Footer.tsx` conflict.
- **Verdict:** Delete. Do **not** merge.

---

## 3. Money / payment path summary

| Concern | Status |
|---|---|
| `polar/*`, `golive/*`, `fix/subscription-tier-provisioning` | ✅ already in main (PRs #7/#6/#28) — pruned, no action |
| Credit fix (`remediation/audit-fixes`) | ⚠️ unmerged; 1 conflict on `Credits.tsx`; carries 2 UN-DEPLOYED billing items |
| Stripe Connect payouts | touched only by remediation (`stripe-connect-payout` H-4 race fix) — no competing branch |
| Polar checkout / org checkout / plan checkout | touched only by remediation — no competing branch |
| 9 billing migrations (`20260704*`) | only in remediation; must apply after merge in a controlled deploy |
| `Pricing.tsx` (landing-polish) | marketing copy only — **not** a billing path, no overlap with remediation |

**No two unmerged branches both touch a live money path**, so there is no money-vs-money merge conflict. The only money risk is `remediation/audit-fixes` vs `main` on `Credits.tsx`, plus the deploy sequencing of its migrations and the 2 UN-DEPLOYED commits.

---

## 4. Predicted conflicts (complete list)

| When | File | Cause | Severity |
|---|---|---|---|
| `remediation/audit-fixes` → main | `src/pages/Credits.tsx` | main's reg-user/borderless pass vs remediation's credit-correctness fixes | **High (money)** — resolve by hand, keep both |
| `ui/footer-belong-copy` → main | `src/components/cinema/Footer.tsx` | stale base; copy already in landing-polish | N/A — branch is being deleted |
| `landing-polish` + `ui/footer-belong-copy` together | `Footer.tsx` | same lines | Avoided by deleting footer branch |

**No conflict** between continuity ↔ landing ↔ remediation against each other beyond the shared `App.tsx`, which auto-merges. Continuity and landing each merge **clean** into main.

---

## 5. Risk ranking

1. 🔴 **`remediation/audit-fixes`** — 41 commits, 118 files, live billing/credits + Stripe payouts + 9 migrations + 2 UN-DEPLOYED items + the one real conflict. Highest blast radius.
2. 🟡 **`feat/continuity-engine`** — large (+3.6k) and touches edge functions + a migration, but isolated, tested, clean merge. Risk is compute/pipeline regression, not money.
3. 🟢 **`landing-polish`** — marketing/SEO/copy, clean merge, no app-logic.
4. ⚪ **`ui/footer-belong-copy`** — delete; zero value, superseded.

---

## 6. Recommended integration sequence

Merge low-risk first so the high-risk branch lands on a known-green tree and any post-merge breakage is unambiguously attributable.

1. **`feat/continuity-engine` → main** (clean). Run continuity tests (`src/lib/video/continuity/__tests__/*`). Confirm the `20260703030000` migration is applied where appropriate.
2. **`landing-polish` → main** (clean). Sanity-check `Footer.tsx`, regenerate sitemap if needed.
3. **Delete `ui/footer-belong-copy`** (its copy is now live via step 2). `git branch -D ui/footer-belong-copy` (+ remote already `gone`).
4. **`remediation/audit-fixes` → main** — manual merge:
   - Resolve `src/pages/Credits.tsx` keeping **both** main's real-data/borderless UI **and** remediation's credit-correctness logic (M-1 / L-4,6,7,10 / 8-bug batch).
   - **Do not auto-apply the 2 UN-DEPLOYED commits' effects to prod** — apply the `20260704*` migrations in a controlled deploy and verify org credit-pool consumption math in staging first.
   - Run the full test suite incl. `route-component-integrity.test.tsx` and the credit/billing paths.
   - Review the Stripe `stripe-connect-payout` H-4 change and Polar `M-3` mapping in staging before promoting.
5. **Clean up merged worktrees & branches** (see §7).

> Branch-protection note: if `main` requires PRs, open each step as its own PR in this order rather than fast-forwarding locally, so the `Credits.tsx` resolution is reviewable.

---

## 7. Cleanup (after the merges land — analysis only, do not run yet)

**Delete (fully merged or superseded):**
`admin-review`, `editor-work`, `admin-work`, `audit`, `business-work`, `fix/audit-remediation`, `fix/regular-user-account-bughunt`, `review`, `studio-ux-overhaul`, `wip/admin-styling`, `worktree-agent-ade80245b293e89ae`, `ui/footer-belong-copy`.

**Worktrees to remove first** (a branch checked out in a worktree can't be deleted): `…/genesis-director-admin-review`, `…/genesis-director-editor`, `…/genesis-director-business`, `…/genesis-director-review`, and the **locked** `…/Desktop/genesis-director/.claude/worktrees/agent-ade80245b293e89ae` (unlock before removing). Note `…/genesis-director` (primary) holds `fix/regular-user-account-bughunt` and `…/genesis-director-audit` holds `remediation/audit-fixes` — don't remove those until their work is merged.

**Keep:** `main`, and `remediation/audit-fixes` until step 4 completes.
