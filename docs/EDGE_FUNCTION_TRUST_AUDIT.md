# Edge Function Trust Boundary Audit — Vertical 1

**Date:** 2026-05-16
**Scope:** All 108 edge functions under `supabase/functions/`.
**Goal:** Eliminate every privilege-escalation vector where a function trusts a client-supplied user identity, and ensure every paid-API endpoint requires authentication.

## Trust model (canonical)

Every function falls into one of four classes. All shared helpers live in `supabase/functions/_shared/auth-guard.ts`.

| Class | Auth requirement | userId resolution |
|---|---|---|
| **end-user mutation** | `validateAuth()` returns `authenticated=true` | `resolveEffectiveUserId(auth, body.userId)` — JWT id always wins for end-users; mismatch → 403 |
| **service-role internal** | service-role key OR JWT | service-role path may trust `body.userId` (chained pipelines, watchdog) |
| **admin only** | JWT + `user_roles.role = 'admin'` | derived from JWT, target user from body |
| **public** | none, but rate-limited + signature-verified where applicable | n/a |

## Critical vulnerabilities fixed this pass

| Function | Before | After | Severity |
|---|---|---|---|
| `extract-scene-identity` | NO auth + trusted body `userId` → could charge ANY user 5 credits per call | `validateAuth` + `resolveEffectiveUserId` | **CRITICAL** (credit-drain) |
| `generate-avatar-direct` | `validateAuth` present but body `userId` passed downstream unchecked → cross-user generation | `resolveEffectiveUserId` enforces JWT id | **HIGH** (cross-user state mutation) |
| `comprehensive-validation-orchestrator` | Same as above | `resolveEffectiveUserId` | **HIGH** |
| `replicate-audit` | NO caller auth (only `REPLICATE_API_KEY` env required), returns cross-user prediction history | `validateAuth` + admin/service-role gate | **HIGH** (PII / cross-user data leak) |
| `elevenlabs-music` | NO auth, calls paid ElevenLabs API | `validateAuth` required | **MEDIUM** (billing abuse) |
| `elevenlabs-sfx` | NO auth, calls paid ElevenLabs API | `validateAuth` required | **MEDIUM** (billing abuse) |
| `studio-image` | NO auth, calls paid Lovable AI Gateway | `validateAuth` required | **MEDIUM** (billing abuse) |
| `kling-v3-audit-test` | NO auth, fires Replicate predictions | admin-only via `user_roles` check | **MEDIUM** (billing abuse) |
| `hollywood-pipeline` | `userId` mismatch → console warn only, JWT id silently substituted | mismatch → hard **403** | **MEDIUM** (defense-in-depth) |

## Defense-in-depth hardenings

These already used `if (auth.userId) request.userId = auth.userId` (safe for end-user calls because `auth.userId` was always set), but the helper now throws on mismatch so an attacker cannot smuggle a foreign id:

- `retry-failed-clip`
- `resume-pipeline`
- `seedance-pipeline`
- `generate-single-clip`

## Functions verified safe (no change required)

- **JWT-derived userId, body `userId` unused or marked deprecated:** `cancel-project`, `delete-clip`, `delete-project`, `gamification-event`, `generate-widget-config`, `comprehensive-clip-validator`, `cleanup-stale-drafts`, `mode-router` (already had hard 403)
- **Admin-only, `target_user_id` from body is the intended contract:** `admin-delete-auth-user`, `admin-force-logout`, `admin-analytics`, `revoke-demo-sessions`
- **Own JWT validation (getUser/getClaims):** `api-keys-manage`, `reserve-credits`, `notify-org-event`, `verify-org-domain`, `sync-org-seats`, `export-workspace-report`, `create-portal-session`, `get-cinema-pending-change`, `list-cinema-invoices`, `verify-cinema-checkout`, `replicate-catalog`
- **Webhook signature-verified:** `payments-webhook`, `auth-email-hook`, `handle-email-suppression`, `replicate-webhook`
- **Public by design (rate-limited / no sensitive data):** `landing-demo-chat` (IP rate-limit), `log-widget-event` (session rate-limit + event-type allowlist), `get-widget-config`, `handle-email-unsubscribe`, `translate-text` (documented as public)
- **Cron/internal (no public exposure pathway):** `monthly-credit-refill`, `process-email-queue`, `send-transactional-email` (verify_jwt=true), `preview-transactional-email` (LOVABLE_API_KEY-gated), `pipeline-watchdog`, `poll-replicate-prediction`, `zombie-cleanup`, `production-audit`
- **API-key auth (intentional public surface):** `api-v1`

## Outstanding follow-ups (next vertical)

1. `pipeline-watchdog`, `poll-replicate-prediction`, `zombie-cleanup`, `production-audit`, `monthly-credit-refill`, `process-email-queue` — currently rely on being un-discoverable; add explicit `auth.isServiceRole` checks so a leaked URL can't be hit anonymously.
2. `seedance-script-director` — uses Lovable AI Gateway, should require auth like `studio-image` (not done this pass — verify caller list first).
3. Build Deno test harness (`supabase/functions/*/_trust.test.ts`) that asserts each function in this audit returns 401 / 403 for the matrix `{no-auth, foreign-userId, valid-self, valid-service-role}`. Skeleton not committed this pass.
4. Sweep `supabase.functions.invoke()` call sites in `src/` and stop passing `user_id` in payloads — they're now ignored anyway, but removing them prevents future regressions.

## Verification command

```bash
# Re-run the body-userId trust audit:
for f in $(grep -rEl 'req\.json\(\)' supabase/functions/); do
  if grep -Pzo '(?s)req\.json.{0,800}?(user_?[Ii]d|owner_?[Ii]d)' "$f" >/dev/null 2>&1; then
    echo "$f: resolve=$(grep -c resolveEffectiveUserId "$f") validate=$(grep -c validateAuth "$f")"
  fi
done
```

Every line should show either `resolve>=1` (uses the helper) or be in the "verified safe" list above.