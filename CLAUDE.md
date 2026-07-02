# Project notes for agents

## 🚀 Deployment — PRODUCTION IS VERCEL (not Cloudflare)

**The live site is served by Vercel.** Verified by response headers:
`smallbridges.co` and `www.smallbridges.co` return `server: Vercel` / `x-vercel-id`.

- **Web app** and **admin** deploy to **Vercel** via Vercel's GitHub integration
  on push to `main` (Vercel project `small-bridges/genesis-director`). Config:
  `vercel.json` (web) and `vercel.admin.json` (admin). This is the ONLY pipeline
  that updates the live domain.
- **Cloudflare Pages is DISABLED.** `.github/workflows/deploy-cloudflare.yml` is
  manual-only (`workflow_dispatch`) as of 2026-06-27. `wrangler.toml` and the
  workflow are kept for reference/fallback but are NOT attached to the domain.
  Do not "fix the deploy" by re-enabling Cloudflare — that was a redundant
  second pipeline that caused double-builds and confusion. If you must move to
  Cloudflare, re-point DNS and disable the Vercel project deliberately.
- Earlier project notes that said "prod = Cloudflare, NOT Vercel" were **stale
  and wrong** — corrected here. Trust the live headers.

### Prod deploy gating — partially closed (2026-07-01)
`vercel.json` `buildCommand` now runs **`npm run typecheck && npm run build`**,
so a type-broken push to `main` fails the Vercel build and never ships. The
`ci.yml` `guard` job is green on `main` (lint was made non-blocking). Still
open if you want a *full* gate: unit tests and `audit:edge-auth` run only in CI,
not in the Vercel build, and `main` has **no branch protection** — making
`guard` ("Guard the build") a required status check would also block direct
pushes to `main`, which the current agent workflow relies on; decide
deliberately before enabling. The Playwright E2E job is a known intermittent
flake (editor-controls panel-sweep 6-min hang) — do NOT make it required.

## Database / Supabase

- Prod project ref: **`ywcwaumozoejierlfkgj`** (`config.toml`). The sibling
  `sdivmvoselmyjqszfujo` is empty — ignore it.
- **Docker is not available in this environment**, so `supabase db dump` /
  `supabase db pull` do NOT work. Use the **Management API** `/database/query`
  endpoint for SELECTs (token in `.env.local` as `SUPABASE_ACCESS_TOKEN`) and
  the CLI `supabase db push` / `migration repair` (direct connection, no Docker)
  for changes. `supabase functions deploy <fn> --use-api` deploys edge functions
  without Docker.
- Migrations apply in timestamp order; prod has had out-of-band/Mgmt-API applies,
  so always check `supabase migration list` and reconcile history before a push.
  ✅ **RECONCILED 2026-07-01:** repo `main` and prod history are 1:1 (0 pending,
  0 stray). Ten out-of-band Mgmt-API applies were recorded via
  `migration repair --status applied`, the stray prod-only `20260706006000`
  (pre-renumber `shot_routing_map` dup) was marked reverted, and the duplicate
  version `20260706011000` was resolved by renaming
  `fix_onboarding_intents_email_rls` → `20260706013000`. Keep it clean: when a
  parallel agent applies SQL via the Mgmt API, it must ALSO add the repo file
  and repair history in the same session. (`feat/creative-vfx-gen` is 76 commits
  behind main / abandoned — its migration backlog is moot unless revived.)
- Money/credits live in `credit_transactions` (the ledger), NOT
  `profiles.credits_balance` (a cache).

## Conventions

- Payments provider is **Polar** (DB columns are legacy `stripe_*`-named but hold
  Polar values). Stripe Connect = creator payouts only.
- Confirm dialogs go through `confirmAsync` (`@/components/ui/global-confirm`) —
  never `window.confirm`.
