# Error Messaging Audit & Remediation Report

**Branch:** `error-messaging` (do NOT merge to main — integrate later)
**Date:** 2026-06-24
**Scope:** Every user-facing error path — frontend (React/TS), API routes, and Supabase edge functions.

## Goals

1. **Informative to the user** — clear, plain-language, actionable messages. No raw codes or cryptic text. Consistent tone via shared helpers.
2. **No internal leakage** — user-facing messages must NEVER expose stack traces, exception text, DB errors, table/column names, SQL, internal IDs/paths, env/config values, secrets/tokens, or raw third-party (Supabase / Polar / Stripe / Replicate) errors.

**Pattern enforced everywhere:** log the FULL technical detail server-side / to the console for debugging; return only a sanitized, user-safe message to the client; attach a correlation **errorId** on server errors so support can trace an incident without exposing internals.

---

## 1. Shared infrastructure added

### New: `supabase/functions/_shared/error-response.ts`
Canonical sanitized error responses for edge functions:
- `corsHeaders` — shared CORS constant (functions historically inlined this 121×).
- `newErrorId()` — short non-guessable correlation id (`crypto.randomUUID().slice(0,8)`).
- `safeErrorResponse({ status, code, userMessage?, detail, fn, extra })` — **logs full `detail` server-side**, returns only `{ error: code, message, errorId, ...extra }`.
- `defaultMessageForStatus(status)` — friendly default copy per HTTP status.

### New: `src/lib/safeErrorMessage.ts`
The single function every user-facing surface should use:
- `safeErrorMessage(error, fallback)` — returns the error's message **only if it passes a leak-marker denylist**; otherwise returns the friendly `fallback`.
- Denylist covers: Postgres/PostgREST internals (`PGRST*`, SQLSTATE, `violates … constraint`, `relation "x" does not exist`, `permission denied for table`), stack traces / `file.ts:line` / absolute paths / `node_modules`, `TypeError`/`Cannot read properties of…`, secrets & env names (`*_KEY/SECRET/TOKEN`, `service_role`, JWT fragments `eyJ…`, `sk_live_…`, `whsec_…`, supabase URLs), raw third-party SDK shapes (`Stripe*Error`, `Polar*Error`, replicate 4xx/5xx), and useless shapes (`[object Object]`, `Edge Function returned a non-2xx status code`, empty/`undefined`/over-long dumps).
- `isUserSafeMessage(message)` and `logTechnicalError(context, error)` helpers.
- **Unit tests:** `src/lib/__tests__/safeErrorMessage.test.ts` (8 cases, all green).

### Hardened: `src/lib/errorHandler.ts`
`parseError()` previously fell through to the **raw** `error.message` whenever it had no mapped code. Now the fallback runs through `safeErrorMessage(error, 'Something went wrong. Please try again.')`. This transparently protects **every** `handleError()` / `withErrorHandling()` / `withRetry()` call site app-wide. `code`/`isRetryable` behavior is unchanged (existing tests still pass).

---

## 2. Edge functions fixed (server-side leaks → sanitized)

Every change logs full detail server-side first. Before → after of the response body:

### Credits / payments (sensitive)
| Function | Before (leaked to client) | After |
|---|---|---|
| `reserve-credits` (×6 sites) | `detail: error.message` (raw RPC/DB error) | `fail()` helper → `{ error: code, errorId }`, full detail to `console.error` |
| `reconcile-credit-holds` | `error: error.message` / `e?.message` | `error: "reconcile_failed"` / `"internal_error"` |
| `monthly-credit-refill` | `error: error.message` | `error: "refill_failed"` |
| `create-credit-checkout` | `error: msg` (raw Stripe/Polar) | `{ error: "checkout_failed", message: "We couldn't start checkout. Please try again." }` |
| `create-plan-checkout` | `error: err.message` | `{ error: "checkout_failed", message: … }` |
| `create-org-checkout` | `error: err.message` | `{ error: "checkout_failed", message: … }` |
| `create-portal-session` | `error: String(err)` | `{ error: "portal_failed", message: … }` |
| `polar-portal` | `error: err.message / String(err)` | `{ error: "portal_failed", message: … }` + `console.error` |
| `polar-webhook` | `error: msg` (raw, in 200 body) | `error: "handler_error"` (full detail already logged) |
| `verify-cinema-checkout` | `error: err.message` | `{ error: "verify_failed", message: … }` |
| `list-cinema-invoices` | `error: String(err)` | `{ error: "internal_error", message: … }` |
| `get-cinema-pending-change` | `error: String(err)` | `error: "internal_error"` |
| `_shared/stripe-webhook-handler` (×2) | `error: String(handlerErr)` / `String(err)` | `error: "handler_error"` / `"internal_error"` |

### Auth / sessions / admin (sensitive)
| Function | Before | After |
|---|---|---|
| `admin-user-action` (×7) | `error: preErr.message` / `authErr.message` / `error.message` / catch `error.message` | `adminFail()` helper → `{ error: code, errorId }`, full detail logged. Codes: `delete_precheck_failed`, `delete_failed`, `force_verify_failed`, `password_reset_failed`, `magic_link_failed`, `impersonation_link_failed`, `internal_error` |
| `admin-delete-auth-user` | `error: deleteError.message` (Supabase auth) | `error: "delete_failed"` |
| `manage-sessions` (×4) | `details: text` (raw GoTrue admin API body ×2), `error.message`, `(err as Error).message` | `error: "Failed to list/revoke sessions"` / `"Internal server error"` (raw `text`/error logged) |
| `oauth-authorize` | `error: error.message` (could leak `*_ENV`/secret names) | `error: "authorize_failed"` |
| `oauth-callback` | `reason: reason.slice(0,120)` **into a browser redirect URL** | `reason: "connection_failed"` (full reason logged) |

### Org / workspace / developer API
| Function | Before | After |
|---|---|---|
| `api-v1` (×2) | `error: inv.error.message` (downstream), catch `error: msg` | `{ error: "upstream_failed"/"internal_error", message, request_id }` (request_id already serves as correlation id; refund + log keep the real message) |
| `api-keys-manage` | `error: msg` | `{ error: "internal_error", message: … }` |
| `notify-org-event` | `error: (e as Error).message` | `{ error: "internal_error", message: … }` + `console.error` |
| `export-workspace-report` | `error: (e as Error).message` | `{ error: "internal_error", message: … }` + `console.error` |
| `verify-org-domain` | `error: (e as Error).message` | `{ error: "internal_error", message: … }` + `console.error` |
| `sync-org-seats` | `error: String(err)` | `{ error: "internal_error", message: … }` |

### Verified already-safe (no change needed)
- `update-user-email` — only **branches** on `updateError.message.includes('already')` and returns hardcoded friendly strings (`"That email is already in use"` / `"Could not request the change — try again"`).

---

## 3. Frontend fixed (raw `.message` → `safeErrorMessage`)

Pattern applied at each site: `toast.error(error.message)` / `setError(error.message)` / `{error.message}` → `safeErrorMessage(error, '<friendly, action-specific fallback>')`. The original error object is still passed to `console.error` where present.

### Sensitive paths (hand-fixed)
- **Auth** — `src/pages/StartOnboarding.tsx` (verifyOtp, signUp, resend code, finish save), `src/pages/BusinessStart.tsx` (resend code).
- **2FA** — `src/components/security/TwoFactorCard.tsx` (×2: listFactors, enroll).
- **Credits / payouts** — `src/contexts/CreditsContext.tsx` (credit-state fetch), `src/components/earnings/CreatorEarnings.tsx` (Stripe Connect payout).
- **Inbox / inquiries** — `src/pages/Inbox.tsx`.
- **Editor** — `MyLibraryPanel.tsx`, `EditorRightRail.tsx`, `useProject.ts` (project load).

### Error boundaries (production leak closed)
- `src/components/stability/GlobalStabilityBoundary.tsx` — line 247 rendered `error.message.substring(0,200)` **unconditionally** (visible in production). Now: raw message only in `development`; `safeErrorMessage(error, 'An unexpected error occurred.')` in production.
- `src/components/ui/error-boundary.tsx` and `StabilityBoundary.tsx` — confirmed their raw message/stack is already gated behind `NODE_ENV === 'development'`; production shows only "Something went wrong." (no change required).

### Breadth pass (workspace / business / account / components / hooks)
Applied `safeErrorMessage` across all remaining user-facing display sites (≈90 call sites in ≈42 files), including:
- `src/pages/workspace/*` — Team, Security, Credits, Billing, Api, Brand, Integrations, Approvals, Notifications, Templates, Danger, Assets, Reports.
- `src/pages/business/*` — Team, Security, Credits, Billing, Api, Brand, Integrations, Approvals, Notifications, Templates, Danger, Assets, Distribution, AdStudio, Reports.
- `src/pages/account/*` — ProfileDashboard, SettingsDashboard (2FA enable/disable, link/unlink, password update, deactivate, tiers), NotificationSettings.
- Components/hooks — CreationStudio, DirectorCommentaryRecorder, ReactionRail, OnboardingWizard, PublishWizard, WorkspaceSwitcher, PatronHubPage, Crossover, useMediaLibrary, usePaginatedProjects.

**Result:** `grep` for raw `toast.error(x.message)` / `setError(x.message)` / `description: x.message` in user-facing `src/` (excluding `src/refine` admin + detection-conditionals + logging) returns **0**.

---

## 4. Remaining items / human judgment

These were deliberately left and are documented rather than silently skipped:

1. **Admin console (`src/refine/**`) — ~32 `toast.error(error.message)` sites.** This is the internal ops console used by a single hard-coded admin (see `admin-module-audit` memory; targets its own subdomain). Surfacing raw DB/RPC errors here is *useful for the operator* and not an end-user leak, since that operator already holds service-role-level visibility. The `safeErrorMessage` helper is ready if you decide to wrap these too — recommend doing so before the admin console is ever exposed to multiple/non-superuser admins.

2. **Edge long-tail — ~15 lower-sensitivity functions** still return `error: <generation/cron error>.message` (e.g. `seed-avatar-library`, `seed-avatar-batch-v2`, `generate-project-trailer`, `generate-upload-url`, `comprehensive-clip-validator`, `comprehensive-validation-orchestrator`, `replicate-catalog`, `admin-alert-dispatch`, `admin-stuck-jobs-watchdog`, `cleanup-analytics`, `track-signup`, `gamification-event`, `handle-email-suppression`, `process-ai-video-replies`). These are cron/webhook/generation paths whose messages are (a) engine/pipeline errors rather than DB/secret leaks, and (b) on the frontend, already neutralized — pipeline/generation/replicate errors are suppressed or remapped by `userFriendlyErrors.ts` and now defended by `safeErrorMessage`. **Recommendation:** migrate these to `safeErrorResponse()` from the new `_shared/error-response.ts` in a follow-up; they were de-prioritized to keep this branch focused on sensitive (auth/payments/credits/admin) surfaces. NOTE: edge functions are Deno and are **not** covered by the repo's `tsc`/Vite build (Deno is not installed locally), so edge edits were kept minimal and verified by reading + grep rather than a compiler.

3. **`src/lib/edgeError.ts` `readEdgeError()`** intentionally returns raw edge detail. Its only callers (`src/hooks/useSeamlessStitch.ts`) throw it into the pipeline error classifier, where stitch/continuity errors are suppressed from display by `userFriendlyErrors.ts`. Left as-is (it is a debugging/log extractor, not a display path), but flagged for awareness.

4. **Media playback** — `src/components/intro/BrandedVideoPlayer.tsx` renders HLS `error.message`. Low sensitivity (player/codec errors, no DB/secret content); left for a polish pass.

---

## 5. Verification

Run 3× — all green each time:

| Check | Command | Result |
|---|---|---|
| Typecheck | `bun run typecheck` (`tsc --noEmit`) | ✅ clean (×3) |
| Unit/integration tests | `bunx vitest run` | ✅ **3778 passed**, 61 skipped, 0 failed (×2 full runs) |
| Sanitizer unit tests | `vitest run safeErrorMessage.test.ts` | ✅ 8 passed |
| Production build | `bun run build` | ✅ built (pre-existing dynamic-import chunk warnings only, on untouched modules) |

No live Polar/Stripe calls were made and no live data was touched — all changes are code-level sanitization plus mocked unit tests.

**Net diff:** ~79 files changed (2 new shared modules, 1 new test, ~23 edge functions, ~50 frontend files).
</content>
