---
name: Edge function auth CI gate
description: scripts/audit-edge-function-auth.mjs enforces that every verify_jwt=false function has an in-code auth gate — required reading before adding a new edge function
type: constraint
---

## Rule

Run `npm run audit:edge-auth` (or `node scripts/audit-edge-function-auth.mjs`) before shipping any edge function change. The script fails CI if a function with `verify_jwt = false` (explicit in `supabase/config.toml`, or implicit by absence of a config block) does not contain one of:

- `validateAuth(` / `resolveEffectiveUserId(` (preferred — shared `auth-guard.ts` helpers)
- `.auth.getClaims(` / `.auth.getUser(`
- `verifyWebhookSignature(` or Stripe `constructEvent(`
- `LOVABLE_API_KEY` (server-to-server gateway gate)

An endpoint that is genuinely public must be marked with `// @public-endpoint` followed on the next line by a rationale comment. The script enforces both lines.

## Known gaps as of audit baseline

12 functions fail the gate today and need real fixes (NOT bypass via the public marker without genuine public intent):

- `payments-webhook`, `replicate-webhook` — wire signature verification through `verifyWebhookSignature(` or expose Stripe's `constructEvent(` at top level so the regex sees it.
- `pipeline-watchdog`, `zombie-cleanup`, `poll-replicate-prediction`, `monthly-credit-refill`, `production-audit`, `send-transactional-email` — internal cron / chain callers; add an explicit service-role check via `validateAuth` + `auth.isServiceRole`.
- `api-v1` — API-key auth; wrap the existing key check in a helper named `validateAuth` or mark `@public-endpoint` with the rationale "API-key auth handled at line N".
- `handle-email-unsubscribe`, `get-widget-config`, `log-widget-event` — public by design; add the `@public-endpoint` marker + rationale.

Do NOT extend the recogniser regex to silence failures. Either add a real gate or document the public intent.
