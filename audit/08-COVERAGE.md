# 08 — Coverage, Confidence & Known Blind Spots

> An honest accounting of what this audit did and did NOT examine, and how much to trust each finding. Written so you know exactly where the floor is.

## How the audit was produced
- **Pass 1 (the 00–07 reports):** 7 parallel end-to-end traces over targeted subsystems + local build/test/typecheck. Only ONE finding (the billing/`stripe-lock` contradiction) was personally re-verified by the lead; the rest are subagent-reported with file:line citations.
- **Pass 2 (this gap-closing wave):** 5 more agents covering the untouched surfaces (social/monetization, distribution/public-API, business/org+email, full RLS sweep) + an independent verification-and-reconciliation pass that re-reads the top fix-targets and cross-checks the repo's own prior audit docs. Results fold into the raw/ files and update 04/05/07/STATUS.

## Confidence by area (pass 1)

| Area | Depth | Confidence | Caveat |
|---|---|---|---|
| Render/assembly pipeline | end-to-end traced | **High** | reaper cron status is UNVERIFIED (out-of-band) |
| Playback / audio | end-to-end traced | **High** | runtime not exercised |
| AI generation / library | end-to-end traced | **Med-High** | BROKEN claims need the verification pass to confirm |
| Auth / credits / editor | end-to-end traced | **High** (billing re-verified by lead) | |
| Admin | page-by-page | **High** | not runtime-exercised |
| Backend contracts (auth/types/env) | sampled + config | **Med-High** | not all 142 fns read individually |
| iOS | static only | **Low (runtime)** / Med (code) | nothing built or run — no Xcode |

## What was NOT covered in pass 1 (the blind spots pass 2 targets)

1. **Social graph & creator monetization** — `/crews`, `/universes`, `/crossover`, `/market`, `/c/:id` patron/channel, tips/earnings, follows, `/notifications`, `/inbox`, `/messages`, gamification. **Includes money flows (tips → creator earnings ledger) that were never traced.** → `raw/web-social.md`
2. **Distribution / publishing / public API** — `api-v1`, `api-keys-manage`, `/embed/:slug`, `/widget/:publicKey`, distribution OAuth, `webhook-dispatch`, public share pages (`/w/:slug`, `/p/:slug`, `/world/:slug`). **This is the external attack surface.** → `raw/web-distribution.md`
3. **Business/org surface & email** — `/business/*` (permissions, approvals, seats, domain verify, danger), org RBAC enforcement, cross-org RLS isolation, the Resend email queue/templates/suppression. → `raw/web-business-email.md`
4. **Systematic RLS sweep** — pass 1 only verified the profiles leak fix; it did NOT audit RLS across all 166 tables, nor hunt service-role IDOR beyond `continue-production`. → `raw/rls-security.md`
5. **Independent verification of the fix-targets** + reconciliation against the repo's 6 root reports and `reports/incomplete-audit/BACKLOG.md` (119 items). → `raw/verification.md`

## Still out of scope even after pass 2 (be aware)
- **iOS runtime** — needs a real device/Xcode build; no static audit substitutes for it.
- **Every one of 142 edge fns / 387 migrations read line-by-line** — we sample + target by risk, not exhaustively.
- **Performance/load, accessibility, i18n completeness, visual/UX QA** — not audited (only bundle-size notes).
- **Production environment state** — which provider keys are set, which crons exist in the Supabase dashboard, actual prod data. Two top findings (reaper cron, live billing provider) hinge on this and can only be confirmed by you in the dashboard.
- **Concurrency under real load** — race conditions were found by reading; not stress-tested.

## Bottom line on completeness
This is a **strong, evidence-based map of the highest-risk subsystems plus a second wave closing the major surface gaps** — but it is **not a guarantee that every issue is found.** Treat the P0/P1 lists as "the most important known issues," not "all issues." The reconciliation pass (`raw/verification.md`) explicitly hunts for what we missed versus the team's own prior audits; read it before assuming the picture is closed.

## Decisions captured
- **Billing direction (your call): Polar is the live provider.** Fix approach = restore the Stripe billing kill-switch + ensure all checkout CTAs route through `polar-checkout`; leave Stripe Connect payouts untouched. (See `05-GAPS.md` P0-2; implementation pending fix pass.)
