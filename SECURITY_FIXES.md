# Security Remediation — Implementation Report

**Date:** 2026-06-24
**Branch:** `security-review`
**Scope:** Fixes for every finding in `SECURITY_REVIEW.md` (C1, H1–H2, M1–M10, L1–L16) plus one bonus SSRF fix found during verification.

## Test status
- `npx tsc --noEmit` (client): **clean**
- `npx vitest run` (full suite): **3844 passed / 0 failed** (61 skipped)
- New security tests: **58 passing** in `src/test/security/`
- `node scripts/audit-edge-function-auth.mjs`: **0 failures** (was 10 — every `verify_jwt=false` function now has an in-code auth gate or a documented `@public-endpoint` rationale)
- `eslint` on changed files: clean (pre-existing `any` warnings elsewhere untouched)

Note on coverage limits: Supabase Edge functions run on Deno (not in the vitest/tsc toolchain) and migrations are not applied to a live DB here. Edge/SQL fixes were verified by static review + content-pinning tests; the migrations include self-verifying `RAISE EXCEPTION` guards (H1) and should be smoke-tested in staging before production per the runbook below.

---

## Fixes by finding

### C1 (Critical) — Cross-tenant org credit drain
- `supabase/migrations/20260705000100_org_pool_membership_authz.sql` — redefines `reserve_credits` / `consume_credit_hold` / `deduct_credits`; every org-pool path now asserts `fn_org_has_min_role(org, user, 'viewer')` before touching `organizations.credits_balance`. Non-members are rejected.
- `supabase/functions/editor-generate-clip/index.ts` — rejects (403) generation against a project the caller doesn't own / isn't an org member of, before the affordability check.
- `supabase/functions/reserve-credits/index.ts` — same ownership/membership pre-check before `reserve_credits`.

### H1 (High) — Anonymous/cross-tenant profile data exposure
- `supabase/migrations/20260705000200_profiles_sensitive_column_lockdown.sql` — `REVOKE SELECT` on `credits_balance, total_credits_purchased, total_credits_used, role, suspended_at, suspension_reason, deactivated_at, deactivation_reason` from `anon` and `authenticated`. Owners still read their own row via `get_my_profile()`/`profile_self` (SECURITY DEFINER); admin pages via `admin_get_user_detail`/`admin_profiles_by_ids`. `security_version` intentionally left granted (force-logout own-row read). Includes a self-verifying guard that fails the migration if any column stays readable.

### H2 (High) — webhook-dispatch SSRF
- `supabase/functions/webhook-dispatch/index.ts` — all outbound deliveries now go through SSRF-guarded `safeFetch` (HTTPS-only, private-range blocked); the test path no longer echoes the upstream response body (`deliveryBody: null`).

### M1 — delete-clip over-refund
- `supabase/functions/delete-clip/index.ts` — fixed denominator + per-clip idempotency key (`clip-refund:<id>`) + cumulative cap at the original charge; routes through the atomic `refund_credits` RPC.

### M2 — SSRF guard DNS rebinding
- `supabase/functions/_shared/ssrf-guard.ts` — added `assertResolvedHostSafe` (resolves A/AAAA, rejects private resolved IPs); `safeFetch` re-validates resolved IPs before every fetch and on each redirect hop. `assertSafeFetchUrl` kept sync for caller compatibility.

### M3 — DB-backed rate limiting
- `supabase/migrations/20260705000300_rate_limit_counters.sql` — `rate_limit_counters` table + atomic `rate_limit_hit(key, limit, window)` RPC.
- `supabase/functions/_shared/rate-limiter.ts` — `checkRateLimitDb` (fail-closed by default) + pure helpers; in-memory limiters marked best-effort.

### M4 — X-Forwarded-For spoofing
- `landing-preview`, `landing-demo-chat`, `get-widget-config`, `translate-text` — client IP via `extractClientIp` (cf-connecting-ip → leftmost XFF) plus DB-backed **global** daily caps so IP-spoofing can't exceed platform budget.

### M5 — translate-text uncapped
- `supabase/functions/translate-text/index.ts` — global daily + per-IP DB caps (429 on limit).

### M6 — api-v1 rate limit + scopes
- `supabase/migrations/20260705000400_api_key_scopes.sql` — `scopes text[]` on `api_keys`; `find_api_key_owner` returns scopes.
- `supabase/functions/api-v1/index.ts` — per-key 120/min limit (429) + scope enforcement (read/generate, 403) + idempotency key on `deduct_credits` (L13).

### M7 — free-tier TOCTOU
- `supabase/migrations/20260705000500_free_tier_atomic_reserve.sql` — `free_tier_try_consume` (advisory-locked check-and-reserve).
- `supabase/functions/free-tier-generate/index.ts` — atomic consume before firing.

### M8 — Clickjacking / missing headers
- `vercel.json` — `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS, `CSP: frame-ancestors 'none'`, COOP for all routes.

### M9 — Open-redirect allowlist
- `supabase/functions/_shared/return-url.ts` — `*.vercel.app`/`*.pages.dev`/`*.lovable.app` allowed only in non-production (gated by env); prod = `smallbridges.co` + canonical origin only.

### M10 — job-queue ownership
- `supabase/functions/job-queue/index.ts` — `status`/`cancel` enforce `job.userId === auth.userId`; `dequeue`/`process_batch` require service-role.

### Low severity
- **L1** `index.html` — removed `'unsafe-eval'` from CSP; note that authoritative CSP ships as HTTP headers.
- **L2** `gamification-event` — per-user rate limit on XP awards.
- **L3** `security_events` INSERT policy → `WITH CHECK (service_role OR user_id = auth.uid())` (migration 20260705000600).
- **L4** email-infra SECURITY DEFINER fns → `SET search_path = public, pgmq` (migration 20260705000600).
- **L5** `Inbox.tsx` — sanitize search before PostgREST `.or()`.
- **L6** `premiere-recap` — only returns data for `status='ended'`.
- **L7** `director-card` — `tips_received` only for self.
- **L8** `hoppy-chat` — per-user daily cap.
- **L9** `_shared/stripe.ts` — constant-time signature compare.
- **L10** `get-widget-config` — origin check fails closed.
- **L11** `export-user-data` — instantiate the service client (GDPR export restored).
- **L12** `cancel-project`/`delete-clip` — removed racy `credits_balance` read-then-write (ledger is source of truth).
- **L13** — api-v1 idempotency (see M6).
- **L14** `Blog.tsx` — JSON-LD escapes `<` (`<`).
- **L15** `scripts/upload-music.mjs` — `spawnSync` array form (no shell).

### Bonus (found during verification)
- `supabase/functions/validate-seam-continuity/index.ts` — was an unauthenticated raw-`fetch` of user-supplied URLs (blind SSRF). Now uses SSRF-guarded `safeFetch` with a frame-host allowlist; documented `@public-endpoint`.
- `@public-endpoint` rationale markers added to the genuinely-public/OAuth/webhook functions so `audit:edge-auth` passes at 0 failures.

### Not changed (with rationale)
- **L16** `jsdom` outdated devDependency — left as-is; a major bump of the test DOM could destabilize the 3,900-test suite. Track as routine dependency maintenance.
- **I1** wildcard CORS, **I2** localStorage tokens — confirmed not exploitable (bearer-token auth, no cookies); no change. Re-evaluate I1 if any function moves to cookie auth.

### New tests
`src/test/security/`: `sqlSecurityGuards.test.ts`, `ssrfGuard.test.ts`, `rateLimitContract.test.ts`, `clientHardening.test.ts`, `moneyHardening.test.ts`.

---

## Deployment runbook (staging before prod)
1. Apply migrations `20260705000100`→`20260705000600` in order.
2. Verify org generation by a non-member is rejected; by a member debits the org pool (C1).
3. Confirm `select credits_balance from profiles` as anon/another user returns permission-denied; own profile + admin pages still load (H1).
4. Set `CRON_SHARED_SECRET` consumers unaffected; confirm `rate_limit_hit` is reachable by the service role only.
5. Smoke-test checkout/portal return URLs reject `*.vercel.app` in prod (M9).
6. Confirm response security headers present on the Vercel deploy (M8).
