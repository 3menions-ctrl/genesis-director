# Web Distribution / Publishing / Public-API Surface — Deep Audit

Branch `full-audit`. READ-ONLY. Scope = the externally-exposed attack surface
(public API, embeds/widgets, distribution/OAuth, sharing, inbound/outbound
webhooks, landing/demo). Every edge function is deployed with
`verify_jwt = false` (`supabase/config.toml`), so each function is reachable
unauthenticated at the network layer and MUST self-authenticate. Findings below
weight security heavily.

Legend: DONE / PARTIAL / BROKEN / MISSING / UNVERIFIED.

---

## 1. PUBLIC API — `api-v1` + `api-keys-manage`

### Key minting & storage — DONE
`api-keys-manage/index.ts`
- JWT-gated: `getClaims` on the Bearer token; `userId` taken from claims, never
  from the body (`:49-57`).
- Minting: 32 random bytes via `crypto.getRandomValues` → `apx_live_<b64url>`
  (`:18-26`). Stored as **sha256 hash** (`key_hash`), only a 12-char prefix kept
  for display (`:106-113`). 256-bit entropy → unsalted sha256 is acceptable (no
  rainbow-table risk). Good.
- Mint gated on: abuse-guard ip/email blocklist (`:77-78`), active subscription
  `has_active_subscription` → 402 (`:83-92`), and a 10-active-key cap (`:95-105`).
- `revoke`/`usage` scoped by `user_id` (`:128-132`, `:142-148`). No IDOR.

### Authentication on `api-v1` — DONE
`api-v1/index.ts`
- `x-api-key: apx_...` (or `Bearer apx_...`) → sha256 → `find_api_key_owner` RPC
  (`:75-90`). Invalid/revoked → 401. RPC is `SECURITY DEFINER`, service-role only
  (`REVOKE ... FROM PUBLIC, anon, authenticated`, migration
  `20260516141554`). Good.
- Per-key rate limit: DB-backed `rate_limit_hit` (cross-isolate, atomic), 120
  req/min, **fail-closed** because the gateway spends credits (`:107-113`,
  `_shared/rate-limiter.ts:587-610`, migration `20260705000300`).
- Credit deduction is idempotent (`deduct_credits` with idempotency key) and
  refunds on upstream failure; never returns upstream error bodies to the caller
  (`:233-256`, `:307-311`).
- `GET /me` returns the caller's OWN `email`/`credits_balance` (`:170-182`) —
  the key owner's own data, not a cross-tenant leak.

### Scope enforcement — PARTIAL (migration conflict defeats per-key scopes)
Two migrations redefine `find_api_key_owner` and they **conflict**:
- `20260705000400_api_key_scopes.sql:19` redefines it to RETURN `scopes`.
- `20260705010300_editor_role_authz_and_org_api_keys.sql:70` (later timestamp →
  **wins**) redefines it again to UNION `org_api_keys`, but **drops the `scopes`
  column from the return signature**.
Consequently in `api-v1` the primary `ownerRow[0].scopes` is always `undefined`,
so it always falls through to the fallback `select('scopes').from('api_keys')`
(`:95-103`). For **business/org keys** (stored in `org_api_keys`, not
`api_keys`) that fallback select finds nothing → scopes default to
`['read','generate']`. Net effect: per-key scope restriction is **not
enforceable for org keys** — every org key gets full read+generate regardless of
configured scope. Personal keys still resolve scopes via the fallback. Also
acknowledged in-code (M8): org-key spend bills the **key creator's personal
wallet** (`owner = created_by`), not the org pool.

### Versioning / authz-per-endpoint — DONE (basic)
Path-versioned (`/api-v1/...`). Method→scope map (`requiredScopeForRequest`,
`rate-limiter.ts:653`). GET endpoints scope all reads to `user_id` (no IDOR).

### Minor — pre-auth DoS (LOW)
No per-IP/global cap **before** key validation: every request runs a sha256 +
`find_api_key_owner` RPC even for garbage keys. Brute force is infeasible
(256-bit keys) but it is an unauthenticated DB-hit amplifier.

---

## 2. EMBEDS / WIDGETS

### `get-widget-config` — DONE
`get-widget-config/index.ts`
- Public read by opaque `public_key` or `slug`, gated `status = 'published'`
  (`:538-548`). In-memory per-IP limiter (60/min, dodgeable) **backstopped** by a
  DB-backed global cap (`get-widget-config:global`, 50k/day, fail-open)
  (`:519-535`). Acceptable for a read path.
- Domain allowlist now **fails closed** when the Origin/Referer is missing or
  unparseable (`:571-580`) — a previously-noted fail-open bypass is fixed.
- Returns only presentational config + the widget `id`; no secret keys. Note the
  returned `id` is the internal widget UUID — see the log-widget-event finding.

### `generate-widget-config` — DONE
`generate-widget-config/index.ts` — `validateAuth` + **ownership check**
(`widget.user_id !== user.id` → 404, `:187-198`). Costly AI + pipeline calls run
only after ownership passes.

### `log-widget-event` — BROKEN (unauthenticated cost-amplification + forced-pause DoS) — TOP RISK
`log-widget-event/index.ts`
- Fully public POST. The only throttle is an **in-memory, per-isolate** limiter
  keyed on `visitor_session`, a value supplied **by the attacker** in the body
  (`:610-624`, `:675-681`). Rotating `visitor_session` defeats it entirely. There
  is **no IP cap and no DB-backed global cap** (unlike get-widget-config).
- For every accepted `view` event it calls
  `increment_widget_analytics('view')` → `widget_configs.total_views += 1`, then
  `check_widget_view_credits` (`:729-739`).
- `check_widget_view_credits` (migration `20260213222435:223+`) **deducts 5
  credits per 1,000 views from the widget OWNER**, and when the owner runs out it
  flips the widget to `status = 'paused'`.
- Exploit chain: attacker reads any published widget's internal `id` from
  `get-widget-config` (returned in `config.id`) → floods `log-widget-event` with
  rotating sessions → (a) **drains the victim owner's credit balance**, (b)
  **force-pauses a competitor's live widget** (DoS), (c) pollutes analytics.
  Unauthenticated, no cost to attacker. **Fix: DB-backed per-IP + global cap,
  and/or move view-credit metering off attacker-driven event counts.**

---

## 3. DISTRIBUTION / OAUTH

### `oauth-authorize` / `oauth-callback` (Google Drive, Notion) — DONE (CSRF) / PARTIAL (token-at-rest)
`oauth-authorize/index.ts`
- `validateAuth` + **org membership check** before issuing an authorize URL
  (`:88-99`). State = HMAC-SHA256 over a base64 JSON blob carrying
  `{p,o,u,r,n,exp}` with a 10-min expiry and random nonce (`:117-130`,
  `OAUTH_STATE_SECRET`).

`oauth-callback/index.ts`
- Verifies HMAC signature on `state` and rejects expired state (`:107-114`).
  Sound CSRF protection.
- **PARTIAL — tokens stored in plaintext.** Columns are named
  `access_token_encrypted` / `refresh_token_encrypted` but the value written is
  the **raw token** ("stored as-is", code comment `:20-22`; upsert at
  `access_token_encrypted: accessToken`). DB/service-role compromise = full
  Google Drive / Notion account access. Naming implies encryption that does not
  exist.
- LOW open-redirect: `returnUrl` (`state.r`) comes from the user-supplied
  `body.returnUrl` at authorize, is signed, then `bounce()` redirects to it
  (`oauth-callback bounce(returnUrl,...)`). No allowlist. Self-initiated and
  carries only `integration`/`status` params (no token) → low impact.

### `distribution-manage` — DONE
`distribution-manage/index.ts` — `validateAuth` + per-request org membership and
**role rank** gate (producer+ for authorize/disconnect/publish, `:90-?`). All
table access is service-role; the client never touches distribution tables.
`status`/connection reads use a **non-secret column allowlist**
(`CONNECTION_COLS`, `:52`). `publish` runs an **inline SSRF check** on `assetUrl`
(https-only, blocks loopback/RFC1918/link-local/`.internal`/`.local`,
`:~165-178`). Scheduling fails closed; cross-org `projectId` references are
dropped. State minted as `provider.<uuid>`.

### `distribution-oauth-callback` — DONE (CSRF) / PARTIAL (token-at-rest)
`distribution-oauth-callback/index.ts` — browser redirect keyed on the unguessable
`oauth_state` looked up in `channel_connections` (`:?`), with a defense-in-depth
**provider-match** check (`conn.provider !== providerId` → reject). State cleared
after use. Same **plaintext token** issue: `channel_connection_secrets` stores
`access_token`/`refresh_token` raw.

### `webhook-dispatch` (outbound) — DONE (well-built)
`webhook-dispatch/index.ts`
- **SSRF-guarded** outbound delivery via `safeFetch` (`_shared/ssrf-guard.ts`):
  https-only, blocks private/loopback/link-local/CGNAT/metadata ranges on the
  literal host **and** DNS-resolved IPs **and** redirect hops; caps body size.
- Outbound HMAC-SHA256 signature with timestamp (`X-...-Signature: t=,v1=`,
  `:?`), replayable-window mitigated by timestamp.
- **Never returns the upstream response body** to the caller (`deliveryBody:
  null`) — closes blind-SSRF exfiltration via "test fire".
- Authz: direct mode requires an **admin/owner** of the endpoint's org; broadcast
  mode requires the **service role** (`requireServiceRole`). Pauses an endpoint
  after 10 consecutive failures.

---

## 4. SHARING — `/p/:slug`, `/w/:slug`, `/embed/:slug`, `/world/:slug`

### `mint-project-share` + `mint_project_share_slug` RPC — DONE (authz) / PARTIAL (unwired) 
`mint-project-share/index.ts` calls the RPC with the **user-scoped** anon client
(`:789-799`). RPC `mint_project_share_slug` (migration `20260610042119:204`) is
`SECURITY DEFINER` and enforces `v_user <> auth.uid() → 'forbidden'` (`:218-220`),
idempotent re-share, random 4-char suffix. Authz correct.
- **PARTIAL: no client caller.** `grep` finds **no** `functions.invoke('mint-
  project-share')` anywhere in `src/` (only `types.ts` mentions). The share-
  creation path appears unwired in the app.

### `PublicShare` (`/p/:slug`) — DONE (no PII leak) / likely BROKEN end-to-end
`src/pages/PublicShare.tsx`
- Reads `project_shares` with anon, gated `is_public = true` (RLS `shares_public_read`,
  migration `20260610042119:198`) (`:72-77`).
- Reads `movie_projects` with anon (`:88-92`) — gated by the **separate** RLS
  policy "Anyone can view public videos" = `is_public = true AND status =
  'completed'` (migration `20260221005754`). Director info comes from the
  **`profiles_public` view** (`display_name, avatar_url` only, `:93-95`) — **no
  email/credits leak** (avoids the known `profiles` cross-tenant leak).
- **Correctness gap:** `mint_project_share_slug` sets `project_shares.is_public =
  true` but does **not** set `movie_projects.is_public = true`. The two flags are
  independent, so a freshly-minted share whose underlying project is private will
  fail the `movie_projects` RLS read → page renders `notFound`. This is
  **fail-safe** (denies rather than leaks) but means the public-share flow is
  likely BROKEN unless the project was independently published.
- `EmbedPlayer` (`/embed/:slug`) follows the identical pattern (`:38-52`) →
  same gate, no leak.

### `/world/:slug` (`WorldDetail`) — UNVERIFIED (RLS-dependent)
`src/pages/WorldDetail.tsx` selects `channel_worlds.* ` with anon (`:70`).
`select('*')` on a public surface depends entirely on `channel_worlds` RLS +
column sensitivity; not fully traced here. Flagging for a column-level review
(prefer an explicit column allowlist over `*`).

---

## 5. WEBHOOKS INBOUND

### `replicate-webhook` — DONE
`replicate-webhook/index.ts` reads the raw body first, then
`verifyReplicateSignature` (Standard-Webhooks format, `auth-guard.ts:182`):
HMAC-SHA256 over `id.timestamp.body`, **±300s replay window**, timing-safe
compare (`:194,:223`). Invalid → 401 (`:42-49`). Idempotent: skips clips already
`completed` (`:?`). Good.

### `polar-webhook` — DONE
`polar-webhook/index.ts` — `verifyPolarWebhook(raw, headers)` (Standard Webhooks)
before any processing (`:?`); invalid → 401. Credit grants idempotent on
`polar_<order.id>` (`add_credits` ref). **Throws → HTTP 500 on fulfilment
failure so Polar retries** (avoids stranding a paid customer). Org vs personal
funding correctly separated.

### `payments-webhook` (Stripe, Lovable-managed) — DONE
Delegates to `_shared/stripe-webhook-handler.ts` with the env-selected signing
secret (`PAYMENTS_{SANDBOX|LIVE}_WEBHOOK_SECRET`). Note: Stripe billing is
otherwise kill-switched per project memory; signature path present.

### `handle-email-suppression` — DONE
HMAC-verified via `@lovable.dev/webhooks-js` `verifyWebhookRequest`; handles
`invalid_signature`/`stale_timestamp` (replay) explicitly (`:48-78`).

### `handle-email-unsubscribe` — DONE
Public by design (RFC 8058 one-click + GET link). Auth = the **32-byte random
unsubscribe token** in the row (the token is the bearer credential). No
enumeration of others' subscriptions without the token.

---

## 6. LANDING / DEMO PUBLIC FUNCTIONS

| Function | Verdict | Gating |
|---|---|---|
| `free-tier-generate` | DONE | `validateAuth` + abuse-guard + content blocklist + `free_tier_status` per-user + platform-$ caps (`:37-90`) |
| `landing-preview` | DONE | per-IP 4/day + **DB global cap 800/day** + content blocklist; cheapest model (`:36-90`) |
| `landing-demo-chat` | DONE | per-IP in-memory (30/hr,6/min) + **DB global cap `PLATFORM_DAILY_CAP=5000`** + 6-msg cap (`:48-86`) |
| `landing-stats` | DONE (minor leak) | aggregate counts; echoes the **most-recent completed project's prompt** publicly (sanitized, 120-char, blocklist). Cross-user prompt text on a public surface — LOW privacy/brand leak (`:60-68`) |
| `revoke-demo-sessions` | DONE | `validateAuth` + **admin role** check (`user_roles`) (`:14-32`) |
| `track-signup` | DONE | `validateAuth`; uses JWT `userId` not client-supplied; dedups (`:14-77`) |
| `newsletter-subscribe` | BROKEN (abuse) | **No rate limit / captcha.** Public POST writes arbitrary email to `newsletter_subscribers` and **sends a Resend welcome email to that arbitrary address** for every new email. Email-bombing of third parties + Resend quota/cost burn. Only an email-format regex + per-email idempotency (`:48-90`) |

---

## TALLY

DONE: api-keys-manage; api-v1 auth/rate-limit/credit; get-widget-config;
generate-widget-config; oauth-authorize/callback (CSRF); distribution-manage;
distribution-oauth-callback (CSRF); webhook-dispatch (SSRF+HMAC); mint-project-
share RPC authz; PublicShare/EmbedPlayer no-PII; replicate-webhook; polar-
webhook; payments-webhook; handle-email-suppression; handle-email-unsubscribe;
free-tier-generate; landing-preview; landing-demo-chat; revoke-demo-sessions;
track-signup; landing-stats.  (≈22)

PARTIAL: api-v1 per-key scopes (migration conflict → org keys ungated);
OAuth/distribution token-at-rest (plaintext despite `_encrypted` naming); mint-
project-share (unwired, no client caller); PublicShare end-to-end (movie_projects
.is_public never set → likely renders notFound).  (4)

BROKEN: log-widget-event (unauth cost-amplification + forced-pause DoS);
newsletter-subscribe (unauth email-bombing / Resend cost abuse).  (2)

MISSING: dedicated per-IP/global throttle on log-widget-event and newsletter-
subscribe; encryption of stored OAuth tokens.

UNVERIFIED: `/world/:slug` `channel_worlds` `select('*')` column sensitivity vs
RLS.

---

## RANKED EXPOSED-SURFACE SECURITY RISKS

1. **HIGH — `log-widget-event` unauthenticated cost-amplification + widget-pause
   DoS.** In-memory throttle keyed on attacker-controlled `visitor_session`
   (`log-widget-event/index.ts:610-681`), no IP/global cap; each `view` runs
   `check_widget_view_credits` which deducts 5 credits/1000 views from the widget
   owner and pauses the widget when drained (migration `20260213222435:223+`).
   Internal `widget_id` is leaked by `get-widget-config` (`config.id`). Attacker
   drains a victim's credits and force-pauses competitor widgets for free.

2. **MEDIUM — OAuth/social tokens stored in plaintext.** `oauth-callback` and
   `distribution-oauth-callback` write raw `access_token`/`refresh_token` into
   `*_encrypted` columns / `channel_connection_secrets` (oauth-callback comment
   `:20-22`). DB or service-role compromise yields full third-party account
   access (Drive, Notion, social channels). Naming falsely implies encryption.

3. **MEDIUM — `newsletter-subscribe` email-bombing / Resend cost abuse.** Public,
   unthrottled; sends a Resend welcome to any attacker-supplied address
   (`newsletter-subscribe/index.ts:48-90`). No captcha, IP cap, or confirm step.

4. **MEDIUM — Per-key API scopes unenforceable for org keys.** Conflicting
   `find_api_key_owner` definitions (`20260705000400` vs the later, winning
   `20260705010300`) drop the `scopes` column; org keys fall back to default
   `['read','generate']` (`api-v1/index.ts:95-103`). Read-only org keys can still
   call paid generation endpoints. (Org-key spend also bills the creator's
   personal wallet — M8.)

5. **LOW — `oauth-callback` open redirect.** `returnUrl` not allowlisted
   (signed but user-chosen). Self-targeted, no token in the redirect → low impact.

6. **LOW — `landing-stats` cross-user prompt disclosure.** Most-recent completed
   project's prompt rendered publicly (sanitized) (`landing-stats:60-68`).

7. **LOW — `api-v1` pre-auth DB-hit amplification.** No throttle before key
   validation; sha256 + RPC per garbage request. Brute force infeasible.

8. **INFO / correctness — public share flow likely BROKEN.** `mint-project-share`
   has no client caller and minting does not set `movie_projects.is_public`, so
   `/p/:slug` fails the project RLS read. Fail-safe (no leak), but the feature
   does not work end-to-end as wired.

### Positives worth noting
DB-backed atomic rate limiter with fail-closed on spend paths; strong SSRF guard
reused on outbound webhooks and distribution publish; HMAC + 300s replay windows
on inbound webhooks; service-role-only secrets exposure with non-secret column
allowlists; `profiles_public` view used on share pages (no email/credits leak);
domain-allowlist now fails closed.
