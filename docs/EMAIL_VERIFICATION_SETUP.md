# Email verification — Supabase dashboard config

The code now passes `emailRedirectTo` on signup and `AuthCallback` handles every URL format Supabase emits. **One Supabase dashboard step is still required** for verification to work end-to-end.

## Required: Site URL + Redirect URL allowlist

Open the Supabase dashboard:

1. **Project** → **Authentication** → **URL Configuration**
2. **Site URL** — set this to your *production* origin:
   ```
   https://smallbridges.co
   ```
   This is the fallback Supabase uses when no `emailRedirectTo` is provided.
3. **Redirect URLs (allowlist)** — add every origin you'll be testing from. The OR pattern matters: each value is allowed verbatim, plus `**` wildcards for path matching. Recommended set:
   ```
   https://smallbridges.co/auth/callback
   https://smallbridges.co/**
   https://*.lovable.app/**
   https://*.vercel.app/**
   http://localhost:7777/**
   http://127.0.0.1:7777/**
   ```
   Without the allowlist entry, Supabase silently rewrites `emailRedirectTo` back to the Site URL — which is the most common "the link 404s" symptom.

## Verify it works

After saving:

1. Sign up with a fresh email at `http://127.0.0.1:7777/auth?mode=signup`.
2. Open the email and inspect the verification link. It should point to one of:
   - `…/auth/callback?token_hash=…&type=signup`
   - `…/auth/callback#access_token=…&type=signup`
3. Click. You should see "Confirming your email…" → success → redirect to `/auth`.
4. Sign in with the same email/password. You land on `/welcome/checkout` (new user) or `/projects` (returning).

## Email templates (optional polish)

In **Authentication** → **Email Templates** the "Confirm signup" template uses `{{ .ConfirmationURL }}` by default. That's correct. If you've customized the template, make sure it still includes `{{ .ConfirmationURL }}` exactly once and doesn't hand-build the URL — manual construction is what breaks the format Supabase expects on the verify endpoint.

## What changed in code

- `AuthContext.signUp()` now passes `emailRedirectTo: ${origin}/auth/callback`.
- `AuthCallback` parses three formats: hash-token, `?token_hash=`, and legacy `?token=`.
- `App.tsx` aliases `/verify`, `/confirm`, `/auth/verify`, `/auth/confirm` to `/auth/callback` so old email templates don't 404.

If verification still 404s after the dashboard update, check the browser address bar after clicking the link — the URL Supabase actually constructed is the source of truth.
