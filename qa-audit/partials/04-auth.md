# 04 — Auth & Onboarding (READ-ONLY QA audit)

Surface: sign up / sign in / sign out, email verification (OTP + link), password
reset, magic link, OAuth-provider integrations, callback handling, session
persistence/refresh, protected-route + gated-route enforcement, accept-invite,
onboarding completion.

Stack note: the app uses **email/password + email-OTP only**. Social OAuth
(Apple/Google) is NOT wired up despite Auth.tsx's file-header claim. Auth email is
sent via the **Supabase "Send Email Hook" → Resend** queue (auth-email-hook →
enqueue_email → process-email-queue), not Supabase's built-in SMTP.

---

## INVENTORY

| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| `Auth.handleSubmit` | src/pages/Auth.tsx:158 | Sign in / Sign up form submit | zod validate → `signIn`/`signUp` → banner on error / OTP screen on signup | OK |
| `Auth.submitOtp` | src/pages/Auth.tsx:215 | Verify 6-digit signup code | `supabase.auth.verifyOtp({type:'signup'})` → INTRO_FLAG → relies on redirect effect | OK |
| `Auth.resendCode` | src/pages/Auth.tsx:243 | Resend signup OTP | `supabase.auth.resend({type:'signup'})` | OK |
| `Auth` auto-redirect effect | src/pages/Auth.tsx:128 | Route after auth resolves | waits authLoading/admin → /admin \| /onboarding \| next \| /business \| /library | OK |
| OAuth provider buttons | src/pages/Auth.tsx (none) | Apple/Google social login | **NOT IMPLEMENTED** — header comment lies | BROKEN (doc/UX, LOW) |
| `AuthContext.signIn` | src/contexts/AuthContext.tsx:584 | Password sign-in + lockout | client lockout → `signInWithPassword` → `log_login_attempt` RPC → wait for session sync | OK |
| `AuthContext.signUp` | src/contexts/AuthContext.tsx:679 | Create account | `auth.signUp` with `emailRedirectTo=/auth/callback` | OK |
| `AuthContext.signInWithMagicLink` | src/contexts/AuthContext.tsx:718 | Send magic link | `auth.signInWithOtp` | DEAD (no callers) |
| `AuthContext.signOut` | src/contexts/AuthContext.tsx:733 | Sign out + purge | signedOutRef → purge localStorage/sessionStorage → resetQueryCache → `auth.signOut({global})` | OK |
| `AuthContext.fetchProfile` | src/contexts/AuthContext.tsx:77 | Load own profile | `get_my_profile` RPC (bound) w/ 10s timeout + 1 retry → fallback | OK |
| `AuthContext.reconcileProfile` | src/contexts/authProfile.ts:82 | Prevent fallback downgrade | authoritative wins; fallback never replaces existing profile | OK |
| `AuthContext` init/listener | src/contexts/AuthContext.tsx:236 | Session bootstrap + onAuthStateChange | getSession (5s timeout) + 8s init ceiling; identity-change cache purge; security_version gate | OK |
| session refresh interval | src/contexts/AuthContext.tsx:485 | Proactive refresh + sec-version recheck | every 10min; refresh if <15min to expiry | OK |
| visibility refresh | src/contexts/AuthContext.tsx:537 | Refresh on tab focus | debounced; refresh if <30min to expiry | OK |
| `AuthCallback` handler | src/pages/AuthCallback.tsx:40 | Email confirm / magic-link / recovery / PKCE | hash tokens \| token_hash \| `?code` \| existing session; recovery→/reset-password, else→/projects | OK (see WART) |
| `track-signup` invoke | src/pages/AuthCallback.tsx:136 | Signup analytics | `functions.invoke('track-signup')` (JWT-guarded) | OK |
| `ForgotPassword.handleSubmit` | src/pages/ForgotPassword.tsx:29 | Request reset email | `resetPasswordForEmail(redirectTo=/reset-password)`; enumeration-safe copy | OK |
| `ResetPassword.exchangeAndValidate` | src/pages/ResetPassword.tsx:59 | Establish recovery session | handles hash / token_hash / PKCE / existing; 8s failsafe | OK |
| `ResetPassword.handleSubmit` | src/pages/ResetPassword.tsx:128 | Set new password | `auth.updateUser({password})` → /projects | OK |
| `Onboarding` effect | src/pages/Onboarding.tsx:32 | Consume intent + mark complete + route | `consume_onboarding_intent` → `patchProfile` + DB update → /studio?welcome=1 \| /workspace \| /projects | OK |
| `AcceptInvite.accept` | src/pages/AcceptInvite.tsx:39 | Join org via invite | unauth→/auth?next=/invite/token; `accept_organization_invite` RPC → switchOrg → notify admins | OK |
| `WelcomeCheckout` | src/pages/WelcomeCheckout.tsx:19 | Post-signup welcome | 5s countdown → /create?welcome=1 | OK |
| `BusinessStart.advance` | src/pages/BusinessStart.tsx:360 | Business signup wizard | ensureIntent → `signUp` → verifyOtp → `runProvision` | OK |
| `BusinessStart.provisionWorkspace` | src/pages/BusinessStart.tsx:292 | Set account_type=business + org | `consume_onboarding_intent` → org backfill → invites | OK |
| `ProtectedRoute` | src/components/auth/ProtectedRoute.tsx:26 | Per-route auth+onboarding+admin gate | 3-phase; redirect only when loading=false & verified & no session; onboarding bounce; admin confinement | OK |
| `GatedRoutes` | src/components/auth/GatedRoutes.tsx:22 | App-wide gate-by-default | `isPublicPath` else require session → /auth?next= | OK |
| `isPublicPath` | src/lib/publicRoutes.ts:70 | Public allowlist | exact set + prefix list, trailing-slash normalized | OK |
| `auth-email-hook` | supabase/functions/auth-email-hook/index.ts:150 | Render+enqueue auth emails | Standard-Webhooks verify → React template → `enqueue_email('auth_emails')` | OK (UNVERIFIED live) |
| `track-signup` fn | supabase/functions/track-signup/index.ts:9 | Persist signup analytics | JWT-guard → geo lookup → `signup_analytics` insert (dedup) | OK |
| `manage-sessions` | supabase/functions/manage-sessions/index.ts:25 | List/revoke sessions | JWT-guard; revoke verifies ownership (IDOR fix M-11) | OK |
| `oauth-authorize` / `oauth-callback` | supabase/functions/oauth-authorize/index.ts:1 | **Workspace integrations** (Google Drive/Notion), NOT login | HMAC state; out of login scope | OK (not auth-login) |
| `update-user-email` | supabase/functions/update-user-email/index.ts | Change account email (re-auth) | called from settings, not signup | NOT REVIEWED (out of core scope) |

---

## BROKEN / FINDINGS

### 1. OAuth advertised in UI copy but not implemented — LOW (UX/doc)
- **Symptom:** Auth.tsx header comment states "Apple / Google OAuth front and
  center" (line 7) and "OAuth start" (line 50), but the rendered form contains
  **zero** OAuth provider buttons and there is no `signInWithOAuth` call anywhere
  in `src/pages/Auth.tsx` or `src/components/auth/`.
- **Repro:** Open `/auth` — only email/password + the OTP flow are present.
- **Root cause:** OAuth was removed (AuthCallback.tsx:19 "OAuth was removed — the
  app uses email-based auth only") but the Auth.tsx docstring was never updated.
- **Risk:** No functional break — but the stale comment will mislead the next
  engineer into thinking social login works/regressed. If product wants OAuth, it
  is entirely absent.
- **Fix:** Update the Auth.tsx docstring to match (email-only), or wire
  `supabase.auth.signInWithOAuth` buttons. Verify Supabase provider config before
  re-adding.

### 2. `signInWithMagicLink` is dead code — LOW
- **Symptom:** `AuthContext.signInWithMagicLink` (AuthContext.tsx:718) is exported
  on the context but has **no callers** in `src/` (grep: only the definition).
  AuthCallback still handles `type=magiclink`, but nothing in the UI ever sends
  one.
- **Root cause:** Magic-link entry UI was removed; the context method + callback
  branch remain.
- **Fix:** Remove the method (and the magiclink callback branch) or restore a
  "email me a link" button. No user impact today.

### 3. AuthCallback sends an already-signed-in user back to `/auth` after email
confirmation — LOW (UX wart, self-healing)
- **Symptom:** For a `token_hash`+`type=signup` link with no `?next`,
  `verifyOtp` succeeds and **establishes a session**, but the handler sets
  "Email confirmed! Please sign in to continue." and routes to `/auth`
  (AuthCallback.tsx:160-162) — telling an already-authenticated user to sign in
  again.
- **Why not higher:** Landing on `/auth` while authenticated triggers Auth.tsx's
  auto-redirect effect (line 128), which immediately forwards them to
  /onboarding or /library. So the user is not stranded — just shown a confusing
  intermediate message.
- **Root cause:** The post-signup branch predates the hook-based session creation;
  it assumes confirmation does not log the user in.
- **Fix:** Route confirmed-signup users to `/onboarding` (or `/projects`) instead
  of `/auth`, mirroring the hash-token branch.

### 4. Timed-out profile fetch routes an EXISTING user as "brand new" — LOW (edge)
- **Symptom:** If `get_my_profile` times out on a genuine first load (no prior
  in-memory profile), `buildFallbackProfile` returns `onboarding_completed=false`
  and `total_credits_used=0`. ProtectedRoute then bounces to `/onboarding`, which
  treats them as `isBrandNew` and sends them to `/studio?welcome=1` instead of
  their real home (and re-writes `onboarding_completed=true`, which is harmless).
- **Why not higher:** Requires a real DB timeout on the very first load with no
  cached profile; reconcileProfile correctly prevents the worse downgrade case on
  subsequent refreshes. The Onboarding write is idempotent so no data corruption.
- **Root cause:** Fallback profile is least-privilege by design
  (authProfile.ts:55); the onboarding/“brand new” heuristic keys on fallback-zero
  fields.
- **Fix:** Gate the destructive `onboarding_completed=true` write / brand-new
  routing on an *authoritative* profile read, or surface a retry rather than
  fabricating defaults on timeout.

### 5. ResetPassword success copy contradicts behavior — TRIVIAL
- **Symptom:** After update, `handleSubmit` toasts "signing you in" and navigates
  to `/projects` (ResetPassword.tsx:145-146), but the success card simultaneously
  says "Redirecting to sign in..." with a "Go to Sign In" → `/auth` button
  (lines 193-198).
- **Fix:** Align copy; user is already authenticated and is sent to /projects.

---

## VERIFIED-SOUND (notable strengths)

- **Errors are surfaced, not swallowed:** every auth call routes failures to a
  banner (`classifyAuthError`) or `toast.error` — sign-in (Auth.tsx:188), sign-up
  (197), OTP verify (225), forgot (45), reset (138), accept-invite (43).
- **Double-submit guarded:** all submit buttons `disabled={loading}` /
  `disabled={submitting}`; OTP `acceptedRef`/`ranRef` once-guards prevent
  duplicate `verifyOtp`/`accept_organization_invite` calls (AcceptInvite.tsx:23,
  AuthCallback.tsx:38).
- **Callback robust to all token shapes:** hash tokens, `token_hash`/`token`,
  PKCE `?code`, and pre-exchanged session are all handled (AuthCallback.tsx,
  ResetPassword.tsx) with a "Continue manually" safety link and an 8s failsafe so
  the page can't go blank.
- **Onboarding cannot loop:** completion is patched in memory FIRST
  (Onboarding.tsx:78) before routing to flag-gated destinations, and
  reconcileProfile stops a fallback from re-flipping the flag.
- **Gate-by-default is enforced once** around `<Routes>` (GatedRoutes); allowlist
  in publicRoutes.ts is tight (landing/marketing/legal/auth + `/invite/`,
  `/auth/` prefixes). `next` is sanitized to same-origin "/" paths in both
  GatedRoutes and Auth.tsx (no open-redirect).
- **Session hardening:** brute-force lockout (10 attempts/15min), security_version
  forced-signout on login + active-tab recheck, identity-change React-Query cache
  purge, intentional-signout resurrection guard, and an 8s init ceiling so a hung
  getSession can't strand the loader.
- **Redirect targets exist:** /create, /projects, /library, /studio, /account,
  /onboarding, /welcome/checkout all resolve; /workspace and /business/* twins
  redirect 1:1 to /business (Onboarding's `/workspace` → `/business` is one extra
  hop, not a dead route).
- **manage-sessions** closed the M-11 IDOR (verifies session ownership before
  revoke); **track-signup** uses the JWT-extracted userId, not client input.

---

## UNVERIFIED (need live backend / Supabase config)

- Supabase project must have the **"Send Email Hook" enabled** and
  `SEND_EMAIL_HOOK_SECRET` set, or NO auth emails (signup OTP, recovery, invite)
  are delivered — the entire email/OTP flow silently fails at the inbox.
  (auth-email-hook is correct in code but its activation is dashboard config.)
- Signup must be configured to **emit OTP codes** (not just confirm links) for the
  6-digit `verifyOtp({type:'signup'})` flow in Auth.tsx/BusinessStart to work.
- Recovery link `redirect_to` must be allow-listed in Supabase Auth → URL
  Configuration (Site URL + redirect allowlist) for `/reset-password` and
  `/auth/callback` to receive tokens.
- `process-email-queue` must be running (cron/worker) to drain the `auth_emails`
  queue → Resend; otherwise emails enqueue but never send.
- RPCs assumed present: `get_my_profile`, `is_admin`, `log_login_attempt`,
  `consume_onboarding_intent`, `accept_organization_invite`, `enqueue_email`.

---

## SUMMARY

- **Functions traced:** ~30 (8 auth pages, AuthContext + helpers, 2 route guards +
  allowlist, 6 edge functions).
- **Broken by severity:** 0 CRITICAL · 0 HIGH · 0 MEDIUM · 4 LOW · 1 TRIVIAL.
- **Worst issues:**
  1. (LOW) OAuth claimed in Auth.tsx copy but not implemented — misleading, no
     social login exists.
  2. (LOW) `signInWithMagicLink` dead code + orphaned magiclink callback branch.
  3. (LOW) AuthCallback bounces a just-confirmed (already-authenticated) signup
     user to `/auth` ("please sign in") — self-heals via Auth redirect but
     confusing.
  4. (LOW) First-load profile-fetch timeout mis-routes an existing user as
     brand-new to `/studio?welcome=1`.
- **Biggest real-world risk is config, not code:** the whole email/OTP/recovery
  surface depends on the Supabase Send-Email-Hook being enabled and the
  email-queue worker running (UNVERIFIED here). The client/edge code paths are
  sound, defensively coded, and free of swallowed errors, loops, open redirects,
  or unguarded double-submits.

Partial written to: `qa-audit/partials/04-auth.md`
