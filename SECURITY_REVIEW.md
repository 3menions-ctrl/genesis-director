# Security Review — Genesis Director (Small Bridges)

**Engagement:** White-box penetration test of the application source (owner-authorized).
**Date:** 2026-06-24
**Branch reviewed:** `security-review`
**Scope:** React/Vite client, Supabase Postgres (357 migrations), 142 Supabase Edge Functions, billing (Polar + Stripe Connect), admin app, infra/config. Source review only — no live systems were touched and no exploits were run.

---

## 1. Executive Summary

The codebase is, on the whole, **well-hardened and shows evidence of repeated prior security work** (AUDIT-FIX markers, a single-admin DB constraint, server-side price catalogs, atomic row-locked credit debits, webhook signature verification, an SSRF allowlist, an open-redirect guard, RLS on every table). The core authentication boundary (`_shared/auth-guard.ts`) is sound: user JWTs are validated via `getUser()`, service-role is matched constant-time, and body-supplied `userId` is never trusted for end-user callers.

That said, the review found **one launch-blocking money vulnerability**, **two High-severity issues** (broad data exposure and SSRF-to-metadata), and a cluster of Medium issues centered on **denial-of-wallet** (ineffective rate limiting on expensive AI endpoints) and **config hardening** (missing HTTP security headers, over-broad redirect allowlist).

### Launch-blocking
- **C1 — Cross-tenant org credit drain + free AI generation.** Any authenticated user can bill video generation to *another organization's* credit wallet by passing that org's `projectId`. The relevant RPCs are the current (latest) definitions and are explicitly marked "MONEY-PATH, UN-DEPLOYED" — so this is a latent Critical that **must be fixed before the org-pool billing feature is deployed**.

### Top priorities after C1
1. **H1** — Lock down `profiles`: credit balances, account role, and moderation/suspension data are readable by *anyone* (including unauthenticated clients holding the public anon key).
2. **H2** — `webhook-dispatch` SSRF returns up to 2 KB of internal HTTP responses (cloud metadata credential theft) to an org admin.
3. **Denial-of-wallet cluster (M3–M7)** — rate limiting is in-memory per-isolate (ineffective on serverless) and several public AI endpoints trust spoofable `X-Forwarded-For` or have no cap at all.
4. **Config (M8–M9)** — add real HTTP security headers to the Vercel deploy; tighten the payment-flow redirect allowlist.

---

## 2. Severity Table

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| C1 | Cross-tenant org credit drain via unvalidated `projectId` | **Critical** (blocking for org feature) | Confirmed |
| H1 | Anonymous + cross-tenant exposure of `profiles` credits/role/moderation PII | **High** | Confirmed |
| H2 | SSRF via `webhook-dispatch` returning internal response body | **High** | Confirmed |
| M1 | `delete-clip` credit over-refund (shrinking denominator, no cap/idempotency) | Medium | Confirmed |
| M2 | SSRF guard does not resolve DNS (rebinding bypass) | Medium | Confirmed |
| M3 | Rate limiter is in-memory per-isolate → ineffective | Medium | Confirmed |
| M4 | `X-Forwarded-For` spoofing bypasses IP caps on public AI endpoints | Medium | Confirmed |
| M5 | `translate-text` unauthenticated with no per-caller cap (AI cost drain) | Medium | Confirmed |
| M6 | `api-v1` public API: no rate limiting, no per-key scopes | Medium | Confirmed |
| M7 | `free-tier-generate` / `landing-preview` cap checks are TOCTOU races | Medium | Confirmed |
| M8 | Clickjacking: `vercel.json` ships no real security headers (meta tags ignored) | Medium | Confirmed |
| M9 | Open-redirect allowlist includes `*.vercel.app` / `*.pages.dev` / `*.lovable.app` | Medium | Confirmed |
| M10 | `job-queue` actions lack ownership checks (cross-tenant) | Medium (mitigated) | Confirmed |
| L1 | CSP allows `unsafe-inline` + `unsafe-eval`, delivered via meta only | Low | Confirmed |
| L2 | `gamification-event` self-awards XP with no validation / rate limit | Low | Confirmed |
| L3 | `security_events` INSERT allows authenticated audit-log spoofing | Low | Confirmed |
| L4 | 4 SECURITY DEFINER email-infra functions without `SET search_path` | Low | Confirmed |
| L5 | PostgREST `.or()` filter injection in Inbox search | Low | Confirmed |
| L6 | `premiere-recap` unauthenticated info disclosure (by UUID) | Low | Confirmed |
| L7 | `director-card` IDOR exposes `tips_received` for any user | Low | Confirmed |
| L8 | `hoppy-chat` has no per-user AI cost/rate cap | Low | Confirmed |
| L9 | Stripe webhook signature compare not constant-time | Low | Confirmed |
| L10 | `get-widget-config` origin allowlist fails open on parse error | Low | Confirmed |
| L11 | `export-user-data` is runtime-broken (GDPR self-export 500s) | Low (availability) | Confirmed |
| L12 | Racy read-then-write to `profiles.credits_balance` (drift) | Low | Confirmed |
| L13 | `api-v1` POST has no idempotency key (retry double-charge) | Low | Confirmed |
| L14 | Blog JSON-LD missing `</script>` escaping (latent stored XSS) | Low (latent) | Confirmed |
| L15 | `scripts/upload-music.mjs` builds a shell string with a filename | Low (operator-only) | Confirmed |
| L16 | `jsdom` devDependency severely outdated | Low (informational) | Confirmed |
| I1 | Wildcard CORS everywhere (safe: bearer-token auth, no cookies) | Informational | Confirmed not-exploitable |
| I2 | Supabase tokens in `localStorage` (Supabase default) | Informational | Confirmed |

---

## 3. Detailed Findings

### C1 — Cross-tenant org credit drain + free generation via unvalidated `projectId` — CRITICAL (blocking)

**Location:**
- `supabase/functions/editor-generate-clip/index.ts:265` (reads `projectId` from request body), `:304-360` (uses it for the org-pool affordability check and `deduct_credits` call) — **no ownership/membership check anywhere in the SUBMIT path**.
- `supabase/functions/reserve-credits/index.ts:81-94` (passes client `body.projectId` to `reserve_credits` unchecked).
- `supabase/migrations/20260704000700_org_pool_consumption.sql:74-86` (`reserve_credits`), `:159-188` (`consume_credit_hold`), `:234-250` (`deduct_credits`) — each derives the org from `movie_projects.organization_id` and debits `organizations.credits_balance` **without verifying the caller belongs to that org**.

**Evidence:** In `editor-generate-clip`, the SUBMIT action authenticates the caller (`validateAuth`, line 235) but then takes `projectId` straight from the body and calls:
```ts
await supabase.rpc("deduct_credits", {
  p_user_id: auth.userId,
  p_amount: creditsRequired,
  p_project_id: projectId || null,   // ← attacker-supplied, never ownership-checked
  ...
});
```
The RPC routes the charge by project, not by caller:
```sql
v_org_id := (SELECT organization_id FROM public.movie_projects WHERE id = p_project_id);
IF v_org_id IS NOT NULL THEN
  -- ORG POOL PATH: debits organizations.credits_balance for v_org_id
```
There is no `fn_org_has_min_role(v_org_id, p_user_id, ...)` check. The clip is then created with `user_id: auth.userId` (`editor-generate-clip/index.ts:475`), so the attacker keeps the output.

**Attack scenario:**
1. Attacker is any authenticated (even free-tier) user.
2. Attacker learns a victim org's `movie_projects.id` (a UUID — leakable via share links, collaboration, or org content) that has `organization_id` set.
3. Attacker calls `editor-generate-clip` with `{action:"submit", projectId:"<victim project>", prompt:"...", videoEngine:"seedance"}`.
4. The affordability pre-check reads the *victim org's* `credits_balance`; `deduct_credits` debits the *victim org's* pool. The generated video is owned by the attacker.
5. Repeat to drain the org wallet and obtain unlimited free generation billed to the victim.

**Impact:** Theft of another tenant's purchased credits (direct financial loss) plus free use of expensive AI generation (~$0.45/sec Seedance). Multi-tenant boundary break.

**Severity:** Critical. The org-pool RPCs in `20260704000700` are the **latest** definitions of `reserve_credits`/`consume_credit_hold`/`deduct_credits` (no later migration overrides them), and the migration header explicitly states **"⚠️ MONEY-PATH, UN-DEPLOYED."** Today the org pool may not yet be live; the moment this migration is applied, the vulnerability is exploitable. **This must be fixed before deploying the org-pool billing feature.** (On the personal path the debit always targets `p_user_id = auth.userId`, so personal credits are not stealable — the theft is org-pool-specific.)

**Remediation:**
- Enforce membership at the single chokepoint: inside `reserve_credits`/`consume_credit_hold`/`deduct_credits`, when `v_org_id IS NOT NULL`, assert `public.fn_org_has_min_role(v_org_id, p_user_id, 'member')` and raise/return failure otherwise.
- Defense in depth: in `editor-generate-clip` and `reserve-credits`, validate that `auth.userId` owns the project (`movie_projects.user_id = auth.userId`) or is a member of its org **before** accepting a client-supplied `projectId`.

---

### H1 — Anonymous + cross-tenant exposure of profile credits, role, and moderation data — HIGH

**Location:**
- `supabase/migrations/20260614000000_profile_richness.sql:20-22` — `CREATE POLICY "Public profile read" ON public.profiles FOR SELECT USING (true);` (no `TO` clause → applies to both `anon` and `authenticated`).
- `supabase/migrations/20260703010000_profiles_email_table_grant.sql:44-49` — `GRANT SELECT (<every column except email>) ON public.profiles TO authenticated` **and** `TO anon`.

**Evidence:** The grant block dynamically grants SELECT on all columns except `email` to both `anon` and `authenticated`, and the permissive `USING (true)` policy lets those roles read **every** row. The `email` column was previously closed (the original cross-tenant email leak is fixed), but the developers explicitly deferred the rest (comment in `20260703010000`: *"credits_balance + other sensitive columns stay granted ... closing cross-tenant credits is a separate, deferred change"*). No later migration changes this.

**Attack scenario:** Anyone holding the public anon key (it ships in the client bundle) — including unauthenticated clients — can query:
```
select id, credits_balance, total_credits_purchased, total_credits_used,
       role, account_tier, suspended_at, suspension_reason,
       deactivated_at, deactivation_reason, notification_settings, preferences
from profiles;
```
for every user.

**Impact:** Mass disclosure of (a) every user's credit balance and lifetime spend (financial/competitive intel), (b) the legacy `role` column — letting an attacker **enumerate admin accounts**, (c) moderation state (who is suspended/deactivated and why), and (d) notification/preference blobs. Affects all users, no auth required.

**Severity:** High (mass PII + financial + admin-account enumeration, anonymously reachable).

**Remediation:**
- `REVOKE SELECT (credits_balance, total_credits_purchased, total_credits_used, role, account_tier, account_type, suspended_at, suspension_reason, deactivated_at, deactivation_reason, security_version, notification_settings, preferences) FROM anon, authenticated;`
- Replace the `USING (true)` base-table policy with an owner-full-row policy, and serve public profile fields through the already-existing `profiles_public` `security_invoker` view (created in `20260630000000_rls_security_hardening.sql:31`) limited to display_name/avatar/bio/cover/tagline.
- Owners read their own balance via the existing `get_my_profile()` SECURITY DEFINER RPC.

---

### H2 — SSRF via `webhook-dispatch` returning internal response body — HIGH

**Location:** `supabase/functions/webhook-dispatch/index.ts:79` (`fetch(endpoint.url, ...)` with no SSRF guard — confirmed: the file does not import `ssrf-guard`), `:94` (`respBody = (await res.text()).slice(0, 2000)`), `:176-181` (test path returns `deliveryBody: result.body` to the caller). `endpoint.url` is org-admin-controlled, set via `src/pages/workspace/WorkspaceApi.tsx:243`.

**Evidence:** The function runs with the service-role key. The `endpointId` "test fire" path (`:142-185`) gates only on the caller being an **admin of the endpoint's org**, then fetches `endpoint.url` and returns up to 2 KB of the response body. There is no scheme/host validation and no private-range block.

**Attack scenario:**
1. Attacker registers / pays for a workspace and becomes its org admin (self-serve).
2. Creates a webhook endpoint with `url = http://169.254.169.254/latest/meta-data/iam/security-credentials/<role>` (or any internal host / `http://localhost`).
3. Triggers the endpoint test; the edge function fetches the internal target server-side and returns up to 2 KB of the response — exfiltrating cloud-metadata IAM credentials or internal service responses.

**Impact:** Read access to cloud metadata credentials and internal-only HTTP services from the server's network position (semi-blind, body returned). Auth bar is an org-admin role.

**Severity:** High (metadata credential theft), gated behind a self-serve paid role.

**Remediation:** Run `endpoint.url` through `assertSafeFetchUrl`/`safeFetch` (HTTPS-only, block private/loopback/link-local ranges) at **both** endpoint-creation and dispatch time; do not echo response bodies back to the caller for arbitrary URLs (return only status code on test). Combine with the DNS-resolution fix in M2.

---

### M1 — `delete-clip` credit over-refund (shrinking denominator, no cap/idempotency) — MEDIUM

**Location:** `supabase/functions/delete-clip/index.ts:167-219`.

**Evidence:** Refund is computed as `Math.round(Math.abs(usageCharge.amount) / totalClips)`, where `totalClips` is counted **before** the clip is deleted, with **no per-project refund cap and no idempotency check** (unlike `cancel-project/index.ts:314-320`, which guards against duplicate refunds). It then inserts a positive `refund` transaction, which `credit_ledger_total` (`20260704000700:30-35`) counts (only `untracked_increase`/`audit`/`security_alert` are excluded) — so it inflates the authoritative spendable balance.

**Attack scenario:** For a project charged up-front (legacy deduct path, e.g. `generate-single-clip`) with N pending/generating clips, delete them one at a time. The denominator shrinks each time: a 100-credit charge across 5 clips refunds 20+25+33+50+100 = 228 credits for a 100-credit charge → net +128 free credits.

**Impact:** Credit inflation (financial). Conditional on the up-front-charge pipeline being in use (hold/consume pipelines only create the usage row after success, so pending clips refund 0 — hence Medium not High).

**Remediation:** Snapshot the original clip count as a fixed denominator, route refunds through a `refund_credits` RPC with a per-clip idempotency key, and cap cumulative refunds at the original charge.

---

### M2 — SSRF guard does not resolve DNS (rebinding bypass) — MEDIUM

**Location:** `supabase/functions/_shared/ssrf-guard.ts:51-56` (`isPrivateV4` only matches literal dotted-quads), `:94-126` (`assertSafeFetchUrl` string-matches hostname only), `:147-149` (`safeFetch`).

**Evidence:** The guard blocks literal private/loopback/link-local IPs and `localhost`, and re-validates redirect hostnames — but it never calls `Deno.resolveDns`. A hostname whose A record points at `169.254.169.254` or `10.x` passes every check, and the subsequent `fetch()` connects to the resolved private IP. The module header's "DNS-rebinding" claim is not implemented.

**Impact:** Full SSRF for any caller that invokes the guard *without* a tight `allowHosts` list. Currently masked because the four user-facing fetchers (`edit-photo`, `inpaint-photo`, `analyze-reference-image`, `extract-video-frame`) pass tight allowlists of AWS/Supabase/Replicate-controlled hostnames an attacker cannot repoint. The allowlist — not the guard — is the real control today.

**Remediation:** After URL parse, resolve the host and reject if any A/AAAA is private; pin the connection to the validated IP (or re-check post-connect) to close the resolve-then-connect TOCTOU. Keep treating the allowlist as the primary control.

---

### M3 — Rate limiter is in-memory per-isolate (ineffective) — MEDIUM

**Location:** `supabase/functions/_shared/rate-limiter.ts:27` (module-level `Map`), re-implemented inline at `job-queue/index.ts:65`, `get-widget-config/index.ts:15`, `landing-demo-chat/index.ts:47`.

**Evidence:** All limiter/circuit-breaker/concurrency state lives in process memory. Supabase Edge spins up many isolates and cold-starts frequently; state is neither shared nor durable.

**Attack scenario:** Spray requests so they land on fresh/different isolates; each grants the full bucket → effective limit = configured limit × isolate count (effectively unbounded).

**Impact:** Tier rate limits (free 6/min … agency 60/min) and per-user job limits are not real ceilings — enables abuse / denial-of-wallet on every "rate-limited" endpoint.

**Remediation:** Back rate limiting with Postgres (atomic `INSERT ... ON CONFLICT` counter under `FOR UPDATE`, like `free_tier_attempts`) or Upstash/Redis. Treat the in-memory limiter as best-effort only.

---

### M4 — `X-Forwarded-For` spoofing bypasses IP caps on public AI endpoints — MEDIUM

**Location:** `landing-preview/index.ts:38-42` + `:99-114` (DB cap keyed on `x-forwarded-for`), `landing-demo-chat/index.ts:92-96`, `get-widget-config/index.ts:51`.

**Evidence:** `clientIP` is taken from the client-controlled `X-Forwarded-For` header and used as the sole per-caller key for the cap.

**Attack scenario:** Send each request with a fresh spoofed `X-Forwarded-For` → per-IP caps (`landing-preview` 4/day; `landing-demo-chat` 30/hr) never trigger. `landing-preview` is unauthenticated and calls Replicate (real $). A single attacker can consume the entire platform free-preview budget (the only backstop is a global ~800 invocations/day cap, `landing-preview/index.ts:27`) and deny the feature to all legitimate visitors.

**Impact:** Denial-of-wallet + feature DoS on unauthenticated AI surfaces.

**Remediation:** Do not trust `X-Forwarded-For` for security; use the platform's verified client IP (e.g., `cf-connecting-ip` only if behind your Cloudflare). Pair per-IP limits with a global token bucket and a per-prompt dedupe; consider a signed nonce / lightweight proof-of-work for the unauthenticated preview.

---

### M5 — `translate-text` unauthenticated with no per-caller cap — MEDIUM

**Location:** `supabase/functions/translate-text/index.ts` (`verify_jwt=false` per `config.toml`; comment at `:37-41` acknowledges the missing per-IP limiting).

**Evidence:** Per-request caps exist (200 items / 20k chars) but there is no per-caller / per-IP / global cap. An attacker loops max-size requests against the shared `LOVABLE_API_KEY`.

**Impact:** Denial-of-wallet on the AI gateway; potential rate-limit exhaustion degrading translation for all users.

**Remediation:** Add a DB-backed global daily cap (like `landing-preview`) plus a per-IP throttle; cache by `(text, target_lang)` hash.

---

### M6 — `api-v1` public API: no rate limiting, no per-key scopes — MEDIUM

**Location:** `supabase/functions/api-v1/index.ts:58-269` (no throttle anywhere); `api_keys` table migration `...204207...sql:2-11` (no scope/permission column).

**Evidence:** GET `/projects`, `/clips`, `/me` cost 0 credits and are unthrottled; POST endpoints are bounded only by credit balance. Every API key is full-access for its user — no least-privilege scopes. (API key minting/storage itself is sound: 32-byte CSPRNG, stored as SHA-256, 10-key cap, revocation honored.)

**Impact:** A leaked key cannot be limited in blast radius; reads are free and uncapped (scrape/DoS).

**Remediation:** Add a DB-backed per-key (and per-IP) rate limit at the handler top; add a `scopes` column to `api_keys` and enforce per-endpoint; cap GET pagination/frequency.

---

### M7 — `free-tier-generate` / `landing-preview` cap checks are TOCTOU races — MEDIUM

**Location:** `free-tier-generate/index.ts:70-101` (reads `free_tier_status` count, then inserts the attempt at `:122-131`), `landing-preview/index.ts:82-114` (counts, then inserts after generating at `:193-198`). `free_tier_status` (`20260610050316_free_tier_caps.sql:77-86`) is an unlocked `count(*)`.

**Attack scenario:** Fire N concurrent requests; all read the same `used_today` before any row commits → all pass the cap. The in-code comment claiming the attempt is recorded *before* firing is incorrect (the status read precedes the insert).

**Impact:** Per-user daily free-render cap and the platform $ budget overshoot by the concurrency factor.

**Remediation:** Make check-and-reserve atomic in one SECURITY DEFINER function: insert the attempt and re-count under a row/advisory lock (or a unique partial index / `FOR UPDATE` per-user-per-day counter), returning allowed/denied transactionally.

---

### M8 — Clickjacking: `vercel.json` ships no real security headers — MEDIUM

**Location:** `vercel.json` (no `headers` block), `index.html:46` (`<meta http-equiv="X-Frame-Options">`), `index.html:49` (CSP meta with `frame-ancestors 'none'`).

**Evidence:** Browsers ignore `X-Frame-Options` and CSP `frame-ancestors` when delivered via `<meta http-equiv>` — both are only honored as real HTTP response headers. The Vercel deploy sets no headers, so on Vercel the only framing defense is the ignored meta tags. (The Cloudflare path `wrangler.toml` and the admin build `vercel.admin.json` both set the header correctly.)

**Attack scenario:** Attacker iframes the production Vercel app, overlays it, and tricks an authenticated user into clicking sensitive actions (UI redress / clickjacking).

**Remediation:** Add a `headers` block to `vercel.json` mirroring `wrangler.toml`: at minimum `X-Frame-Options: DENY` (or `Content-Security-Policy: frame-ancestors 'none'`), plus `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS, and COOP/CORP.

---

### M9 — Open-redirect allowlist includes shared multi-tenant hosting wildcards — MEDIUM

**Location:** `supabase/functions/_shared/return-url.ts:52-58` — allowlist includes `*.lovable.app`, `*.pages.dev`, `*.vercel.app`. Consumed by `create-credit-checkout/index.ts:28`, `polar-checkout/index.ts:51`, `create-portal-session/index.ts:46` with a user-controlled `returnUrl`.

**Attack scenario:** Attacker deploys `https://evil.pages.dev` (or `*.vercel.app`/`*.lovable.app` — all open, self-serve) and crafts a checkout/portal link with `returnUrl=https://evil.pages.dev/phish`. After a legit Polar/Stripe checkout, the provider redirects the user to the attacker's page — credible because the flow originated in the real app.

**Impact:** Open redirect off a payment flow (https-only, bounded to those three TLD families). Useful for phishing / session-context handoff.

**Remediation:** Remove the wildcard hosting domains from the production allowlist; pin to `smallbridges.co`/`*.smallbridges.co` plus the canonical `PUBLIC_SITE_URL`. Gate preview wildcards behind a non-production env flag.

---

### M10 — `job-queue` actions lack ownership checks — MEDIUM (mitigated)

**Location:** `supabase/functions/job-queue/index.ts` — `dequeue` (`:411-431`), `status` (`:433-478`), `cancel` (`:480-515`), `process_batch` (`:533-548`).

**Evidence:** `userId` is correctly forced to the JWT (`:345-351`), but these actions key off `jobType`/`jobId` with no `job.userId === auth.userId` check: `status` returns any job's payload/result, `cancel` cancels any job, `dequeue` returns another user's payload, and `process_batch` invokes downstream generators with the service-role key on arbitrary queued payloads.

**Mitigation:** The queue is in-memory per isolate (`:54-65`) and job IDs are random UUIDs, so cross-tenant reach requires hitting the same warm isolate — substantially limiting real-world exploitability today. It becomes a genuine cross-tenant authz break the moment the queue moves to a shared store.

**Remediation:** Verify `job.userId === auth.userId` on `dequeue`/`status`/`cancel`; restrict `process_batch`/`dequeue` to service-role/cron callers.

---

### Low-severity findings

- **L1 — CSP allows `unsafe-inline` + `unsafe-eval`** (`index.html:49`), delivered via meta only. Largely neuters CSP as an XSS mitigation and, combined with localStorage tokens (I2), turns any XSS into full token theft. Move CSP to an HTTP header and drop `unsafe-eval`/`unsafe-inline` (use nonces/hashes).
- **L2 — `gamification-event` self-award** (`supabase/functions/gamification-event/index.ts`): authenticated callers can POST any `event_type` (e.g. `video_completed` = 100 XP) with no verification the event occurred and no rate limit → inflate own XP/leaderboard. Validate against real state; rate-limit per event type. (No credit/money/role impact.)
- **L3 — `security_events` INSERT spoofing** (`20260220042452...:11-18`): policy `WITH CHECK (auth.uid() IS NOT NULL OR auth.role()='service_role')` lets any authenticated user insert arbitrary audit rows (no `user_id = auth.uid()` constraint). Audit-log integrity only (SELECT is admin-only). Tighten to `WITH CHECK (auth.role()='service_role' OR user_id = auth.uid())`.
- **L4 — Four SECURITY DEFINER functions without `SET search_path`** (`20260503013930_email_infra.sql`: `enqueue_email:131`, `read_email_batch:143`, `delete_email:155`, `move_to_dlq:166`) — the only 4 of ~304 definer functions missing it. Materially mitigated: all internal calls are schema-qualified and EXECUTE is revoked from anon/authenticated/PUBLIC. Add `SET search_path = public, pgmq`.
- **L5 — PostgREST `.or()` filter injection** (`src/pages/Inbox.tsx:577`): raw user search string interpolated into `.or("display_name.ilike.%${q}%,...")`. Runs under the user's own JWT against the (already broadly-readable) `profiles_public` view, so RLS backstops it — info-disclosure amplification at most, not raw SQL. Escape PostgREST reserved chars or use chained `.ilike()` filters.
- **L6 — `premiere-recap` unauthenticated** (`supabase/functions/premiere-recap/index.ts:24-50`): no `validateAuth`; service-role reads `premieres`/`premiere_reactions` for any `premiereId`, returning `hostId`, `tipCredits`, `peakViewers`, etc. for private or not-yet-public premieres. Require a publicly-shareable state (e.g. `status='ended'` + public flag) or auth.
- **L7 — `director-card` IDOR** (`supabase/functions/director-card/index.ts:53-88`): any authenticated user can request `?userId=<uuid>` and receive that user's stats including `tips_received` (revenue-adjacent). Omit `tips_received` unless `userId === auth.userId`.
- **L8 — `hoppy-chat` no per-user cost cap** (`supabase/functions/hoppy-chat/index.ts:29-74`): authenticated callers get unlimited streaming completions at no credit cost / no throttle → denial-of-wallet by a cheap throwaway account. Add a per-user daily cap and/or charge credits.
- **L9 — Stripe webhook signature compare not constant-time** (`_shared/stripe.ts:73` uses `.includes(expected)`). The Polar path correctly uses `timingSafeEqual`. Theoretical timing oracle; use constant-time compare for parity.
- **L10 — `get-widget-config` fails open** (`:98-100`): when origin parsing throws while an allowlist is set, it returns "allow." Fail closed.
- **L11 — `export-user-data` is runtime-broken** (`supabase/functions/export-user-data/index.ts:42-48`): the `supabase` client is never instantiated, so every call throws → HTTP 500. Auth is correct and it fails before reading data, so it is **not** a security vuln — but the GDPR self-export is 100% non-functional (compliance/availability). Instantiate a user-scoped client.
- **L12 — Racy `profiles.credits_balance` writes** (`cancel-project/index.ts:347-358`, `delete-clip/index.ts:196-207`): read-then-write, not atomic. `credits_balance` is non-authoritative (the ledger is the source of truth), so this causes display drift, not direct theft. Stop writing it from these handlers; derive from the ledger.
- **L13 — `api-v1` POST no idempotency** (`:183-211`): deducts before invoking with no idempotency key → a client retry double-charges and double-generates. Billing-correctness, not free abuse. Pass a request-id idempotency key into `deduct_credits`.
- **L14 — Blog JSON-LD missing `</script>` escaping** (`src/pages/Blog.tsx:190`): `dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}}` from article fields. Currently safe (blog content is build-time static markdown), but becomes stored XSS the instant blog content is DB/CMS-sourced. Escape `<`/`>`/`&` before injecting.
- **L15 — `scripts/upload-music.mjs:61`** builds a shell string with a filename (`execSync(\`ffprobe ... "${file}"\`)`). Operator-only tool, local input — not a web surface. Use `spawnSync` array form. (All other media exec paths use safe array form / no `shell=True`.)
- **L16 — `jsdom: ^20.0.3`** is several majors behind (current ~25); devDependency, test-only. Update during routine dependency maintenance. No clearly known-vuln runtime package observed (npm audit not run — offline).

### Informational (confirmed not exploitable)

- **I1 — Wildcard CORS (`Access-Control-Allow-Origin: *`) on all edge functions, including admin/money.** Acceptable here: auth is `Authorization: Bearer` only (no cookies/ambient credentials), browsers don't attach the token cross-origin, and `*` can't be combined with credentialed requests. No origin is reflected. **Re-evaluate immediately if any function ever moves to cookie auth.**
- **I2 — Supabase auth tokens in `localStorage`** (`src/integrations/supabase/client.ts`) — Supabase default; only the public anon key is exposed to the client (correct). Token theft requires an XSS; pair this with the CSP hardening (L1).

---

## 4. Confirmed-Strong Controls (do not regress)

The following were probed and held up — worth protecting in future changes:

- **Auth boundary** (`_shared/auth-guard.ts`): user JWTs validated via `getUser()`; service-role matched constant-time; `resolveEffectiveUserId()` ignores body `userId` for end-user callers. Sensitive deletes (`delete-user-account`, `delete-project`, `delete-clip`, `cancel-project`) enforce JWT identity + ownership; `delete-user-account` and `update-user-email` require re-auth.
- **Admin authorization**: gated through `is_admin`/`has_role` RPCs (revoked from anon/public) **and** a DB-level single-admin constraint pinning the `admin` role to one UUID. Admin functions check `user_roles` server-side — not client checks. Admin bundle is tree-shaken out of public builds.
- **Money path (personal + webhooks)**: webhook signatures verified (Polar constant-time HMAC, Stripe HMAC with 300s tolerance, both fail-closed on missing secret); prices/credit amounts resolved from server-side catalogs (never client body); idempotency via unique `stripe_payment_id` / hold keys / `(user_id, idempotency_key)`; atomic `FOR UPDATE` debits; `add_credits` caps 1..1,000,000 and rejects ≤0; `stripe-connect-payout` computes amount from the caller's own atomically-claimed earnings and pays only the caller's own connected account (no IDOR/amount tampering).
- **RLS**: every table has RLS enabled; financial/archive tables default-deny; self-escalation of `role`/`credits_balance`/`account_tier`/`org credits` blocked by BEFORE-UPDATE triggers; `api_keys`/`org_api_keys`/`channel_connection_secrets`/`credit_transactions`/`user_roles` correctly scoped. (H1 is the one deliberately-deferred exception.)
- **Secrets**: no hardcoded secrets in committed source; `.gitignore` excludes `.env*`; only public `VITE_*` vars reach the client bundle.
- **Injection**: no exploitable XSS (DOMPurify + React escaping on untrusted text); no raw SQL string-building; email templates are JSX-escaped (no SSTI); OAuth/email redirects use HMAC-signed state + `URL`/`URLSearchParams` encoding (no CRLF/open-redirect there).

---

## 5. Prioritized Remediation Roadmap

**Phase 0 — Before launch / before deploying the org-pool feature (blocking)**
1. **C1** — Add org-membership enforcement inside `reserve_credits`/`consume_credit_hold`/`deduct_credits` (and ownership checks in `editor-generate-clip`/`reserve-credits`). **Do not deploy `20260704000700` without this.**

**Phase 1 — High (this week)**
2. **H1** — Revoke sensitive `profiles` columns from anon/authenticated; serve public fields via the `profiles_public` view; owner reads via `get_my_profile()`.
3. **H2** — SSRF-guard `webhook-dispatch` URLs (creation + dispatch) and stop returning response bodies for arbitrary URLs.

**Phase 2 — Denial-of-wallet & config (next sprint)**
4. **M3** — Replace in-memory rate limiting with a DB/Redis-backed limiter (unblocks the effectiveness of M4–M7 mitigations).
5. **M4/M5/M6/M7** — Stop trusting `X-Forwarded-For`; add per-caller + global caps to `translate-text`, `api-v1`, and the landing AI endpoints; make free-tier cap checks atomic.
6. **M8** — Add real HTTP security headers to `vercel.json`.
7. **M9** — Tighten the payment-flow redirect allowlist.
8. **M2** — Add DNS resolution + IP pinning to the SSRF guard.
9. **M1** — Fix the `delete-clip` refund math (fixed denominator, cap, idempotency).
10. **M10** — Add ownership checks to `job-queue` actions.

**Phase 3 — Hardening (backlog)**
11. L1 (CSP off-meta, drop unsafe-eval), L4 (search_path), L3 (security_events), and the remaining Low items.
12. L11 — fix the broken GDPR export (compliance).
13. Add per-key scopes to `api_keys` (M6 follow-on) and idempotency to `api-v1` POST (L13).

---

*Methodology: attack surface mapped from `supabase/config.toml` (`verify_jwt` boundaries), `_shared/` trust primitives, migration final-state analysis (last-write-wins, verified no later migration reverses each finding), and client redirect/render sinks. Every Critical/High/Medium finding was verified against the cited source lines; speculative items are marked Low/latent or Informational. No live systems were accessed and no exploit was executed.*
