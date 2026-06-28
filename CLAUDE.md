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

### ⚠️ Open follow-up: prod deploy is currently ungated
The audit's "ungated prod deploy" fix added a typecheck/edge-auth/test gate to
the (now-disabled) Cloudflare workflow, so it does **not** gate live Vercel
deploys. Vercel builds and ships on push to `main` with no gate. To close this:
make the `ci.yml` `guard` job a **required status check on `main`** and enable
"wait for CI" in Vercel, OR move the gate into a Vercel **Ignored Build Step** /
`buildCommand`. (Note: `ci.yml`'s `guard` currently fails on pre-existing
`no-console` lint warnings — the real gates typecheck/tests/`audit:edge-auth`
pass; fix or downgrade the lint rule before making it a required check.)

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
  ⚠️ STALE-CLAIM CORRECTED: `prod == repo (0 pending)` is NO LONGER true. The
  `feat/creative-vfx-gen` branch carries ~24 migrations not on `main` (several
  applied to prod out-of-band via the Mgmt API this session). Before merging,
  reconcile with `supabase migration list`. Two same-timestamp collisions from
  parallel-agent work were resolved by renaming the finishing/routing migrations
  to `20260706008000`/`20260706009000`.
- Money/credits live in `credit_transactions` (the ledger), NOT
  `profiles.credits_balance` (a cache).

## Conventions

- Payments provider is **Polar** (DB columns are legacy `stripe_*`-named but hold
  Polar values). Stripe Connect = creator payouts only.
- Confirm dialogs go through `confirmAsync` (`@/components/ui/global-confirm`) —
  never `window.confirm`.
