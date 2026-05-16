
# Deep Engineering Remediation — Phase 2

Builds on Phase 1 (cache isolation, audit log tamper-proofing, CI auth gate, userId removal). Landing page and its components remain untouched.

## Scope (4 verticals, in order)

### 1. Close the 12 CI Auth Gate Failures — Real Verification, Not Stubs
For each failing function, implement the correct trust boundary:

- **Webhooks** (Stripe, Replicate, ElevenLabs, Kling callbacks): HMAC-SHA256 signature verification using stored webhook secrets, constant-time comparison, 5-min timestamp tolerance, raw-body preservation. Reject on missing/invalid signature with 401 + structured log.
- **Cron / scheduled functions**: require `x-cron-secret` header matched against `CRON_SHARED_SECRET` env var (added via secrets tool), OR validate service-role JWT via `auth.getClaims` and assert `role === 'service_role'`.
- **Public widget endpoints**: scoped origin allowlist + per-IP rate limit table (lightweight, RLS-protected) + input validation via Zod.

Shared helper: `supabase/functions/_shared/auth-guard.ts` extended with `verifyWebhookSignature(secretEnvVar)`, `requireCronSecret()`, `requireServiceRole()`. CI gate updated to recognize these helpers as valid trust boundaries.

Deliverable: `npm run audit:edge-auth` → 64/64 pass.

### 2. Dead Code Excision (H2/M9)
Remove with codemod-level rigor, not just file deletion:

- Delete `supabase/functions/agent-chat/`, `generate-video/`, `generate-single-clip/`, and any other functions confirmed unreferenced by grep across `src/` and other edge functions.
- Rewire `mode-router` to drop removed branches; update `hollywood-pipeline` callsites that referenced the old single-clip path (verify against the Kling-Hollywood lock + Seedance lock memories).
- Call `supabase--delete_edge_functions` so deployed functions are also removed.
- Update `mode-router` tests and add a guard test that asserts the router rejects unknown engines.

### 3. Typed Error Architecture (H4)
Replace the 993 silent `catch` blocks pattern with a real taxonomy:

- New module `src/lib/errors/AppError.ts`: discriminated union — `AuthError`, `ValidationError`, `NetworkError`, `PipelineError`, `BillingError`, `UnknownError`. Each carries `code`, `userMessage`, `cause`, `context`, `retryable: boolean`, `severity`.
- `src/lib/errors/reporter.ts`: single sink. Routes to console (dev), to `error_reports` table (prod, RLS: user can insert own, only admins read), and to a toast for user-facing severities.
- `src/lib/errors/withErrorBoundary.tsx`: route-level boundary using the typed reporter.
- Codemod pass: convert top 30 highest-traffic catch blocks (auth, pipeline dispatch, credit operations, Stripe flows, video generation, project CRUD) from `catch (e) { console.error }` → `catch (e) { reportError(toAppError(e, { context })) }`. Document remainder for future passes — no fake "fixed all 993" claim.
- Edge-function counterpart: `supabase/functions/_shared/errors.ts` with the same taxonomy, structured JSON error responses, and request-id propagation.

### 4. Pipeline Realtime — Replace Polling (H7)
Polling against `pipeline_state` / `projects` tables is what causes the render-stability and credit-idempotency headaches. Move to Supabase Realtime:

- Enable `REPLICA IDENTITY FULL` and `supabase_realtime` publication on: `projects`, `pipeline_state`, `pipeline_clips`, `pending_video_tasks`.
- New hook `src/hooks/useProjectChannel.ts`: subscribes to `postgres_changes` filtered by `project_id`, with reconnect-on-visibility, exponential backoff, and a deterministic "last event wins" reducer.
- Refactor `useScenePipeline`, `Production.tsx`, and `SpecializedModeProgress` to consume the channel instead of `setInterval` polls. Keep a 30s safety re-fetch as a belt-and-suspenders, not the primary mechanism.
- Tear down channels on unmount AND on user identity change (ties into Phase 1 cache reset).
- Verify by inspecting network panel: poll requests for active project drop to near-zero; UI still updates within ~500ms of edge function writes.

## Technical Notes

### Migrations required
- `error_reports` table + RLS (user inserts own; service_role + admin read).
- `webhook_secrets` lookup table OR rely on existing env-var pattern (will decide after reading current webhook handlers).
- `rate_limits` table for public widgets (rolling window, indexed on `(endpoint, ip_hash, window_start)`).
- Publication membership for the 4 pipeline tables.

### Files touched (non-exhaustive)
```text
NEW:    supabase/functions/_shared/{auth-guard.ts extended, errors.ts, webhook-verify.ts}
NEW:    src/lib/errors/{AppError.ts, reporter.ts, withErrorBoundary.tsx}
NEW:    src/hooks/useProjectChannel.ts
EDIT:   ~12 edge functions (webhook/cron/widget gating)
EDIT:   useScenePipeline.ts, Production.tsx, SpecializedModeProgress.tsx
EDIT:   scripts/audit-edge-function-auth.mjs (recognize new guards)
DELETE: agent-chat/, generate-video/, generate-single-clip/ (+ deploy delete)
```

### Out of scope (explicit)
- Landing page and any component it imports — untouched.
- Hollywood pipeline mega-file refactor (separate engagement; too risky to bundle).
- Visual redesign.
- Storage bucket privatization (Bundle 1 work tracked separately).

### Verification gates before claiming done
- `npm run audit:edge-auth` → 64/64.
- Deno tests pass on touched edge functions.
- Manual: trigger a generation, watch Realtime update Production page without polling requests in network tab.
- Manual: hit a webhook endpoint with bad signature → 401; with valid signature → 200.
- Manual: sign out → React Query cache empty, no project data accessible by next user.

## Sequencing
1 → 2 → 3 → 4. Each vertical fully verified before moving on. No partial claims.
