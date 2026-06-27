# Genesis Director — CORE Web-App Flow Audit

Branch: `full-audit`. Stack: React + Vite, Supabase (auth + DB + edge functions). Billing provider = Polar.sh (DB columns legacy `stripe_*`-named but hold polar_ values; Stripe Connect = creator payouts only).

READ-ONLY audit. Every claim below is traced to `file:line`. `.claude/worktrees` (committed dup tree) excluded from all searches. Verdicts: DONE / PARTIAL / BROKEN / MISSING / UNVERIFIED.

> PREMISE CORRECTION (verified): the task brief and project memory state Stripe billing is disabled via a kill-switch `src/lib/stripe-lock.ts`. **That file does not exist on this branch** (`ls src/lib/stripe-lock.ts` → No such file; `grep -r stripe-lock src supabase` → 0 hits). The client default provider is **Stripe**: `src/lib/payments/index.ts:55-56` `ACTIVE = VITE_PAYMENTS_PROVIDER || "stripe"`. This materially affects the billing verdict — see §2 Cross-cutting #1.

---

## 1. AUTH / SESSION

### Call chain
`main.tsx` → `App.tsx:271` `<AuthProvider>` → `src/contexts/AuthContext.tsx` (`onAuthStateChange` listener `:316` registered before `initSession()` `:481`) → profile via SECURITY DEFINER RPC `get_my_profile()` (`AuthContext.tsx:108-112`, `.bind(supabase)`) → `reconcileProfile` anti-downgrade (`authProfile.ts:82-90`) → admin via `is_admin` RPC fail-closed (`AuthContext.tsx:199-226`). Route enforcement: `src/components/auth/ProtectedRoute.tsx` (3-phase `initializing→verifying→ready`, never redirects until `loading===false && isSessionVerified===true` `:92`, redirect to `/auth` at `:127`), composed with `RequireAccountType.tsx` for business routes (`App.tsx:600-627`). Supabase client `src/integrations/supabase/client.ts:11-16` `persistSession/autoRefreshToken/localStorage`.

### Findings
- Session init/persistence, `onAuthStateChange` (intentional-signout guard `signedOutRef:229,322`; identity-change gate `:374`; cross-user RQ cache purge `:342-347`), `security_version` re-check loop (`:485-530`), signIn/signUp/signOut, ForgotPassword/ResetPassword (4 URL shapes, enumeration-safe, token-scrubbing): **DONE**.
- `_shared/auth-guard.ts` (`validateAuth:24-63`, `resolveEffectiveUserId:85-101` privilege-escalation block), `oauth-authorize` (HMAC state, org-membership check `:93-99`), `admin-force-logout`, `auth-email-hook` (Standard-Webhooks sig verify `:164-181`): **DONE**.

### Break points
- **PARTIAL — cold-load onboarding misroute.** `authProfile.ts:55,63` fallback sets `onboarding_completed=false`/`account_type='personal'`. The anti-downgrade guard (`reconcileProfile:88`) only protects when a `prev` profile exists. On genuine first paint with no `prev` and a slow/RLS-denied `get_my_profile`, the fallback commits → `ProtectedRoute.tsx:159-165` bounces an already-onboarded user to `/onboarding`. (`AuthContext.tsx:142-152`)
- **PARTIAL — `/inbox` unguarded.** `App.tsx:455-459` renders `<AppShell><Inbox/></AppShell>` with no `ProtectedRoute`; `Inbox.tsx:197` self-handles unauth with a dead placeholder, not a login redirect. Data RLS-safe; auth-UX hole inconsistent with siblings.
- **PARTIAL (security) — `oauth-callback` stores OAuth tokens in plaintext** into columns named `access_token_encrypted`/`refresh_token_encrypted` (`oauth-callback/index.ts:195-196`; admitted `:21-24`). Misleading column name masks the gap. Also **swallows the persist failure**: a failed `workspace_integrations.upsert` still redirects `status=success` (`:189-210`). Hardcoded fallback `https://smallbridges.co` `:100-101`.
- **UNVERIFIED — `manage-sessions` list/revoke** depend on GoTrue admin endpoints `/auth/v1/admin/users/{id}/sessions` + `/auth/v1/admin/sessions/{sid}` (`manage-sessions/index.ts:60,93,105`) with leftover "not sure how to do this" dev notes `:55-59`. May silently 500 in prod (caller `src/components/security/SessionsCard.tsx`). M-11 revoke-IDOR fix is present (`:89-103`).
- **PARTIAL — `revoke-demo-sessions`**: hardcoded stale-brand email `demo@aifilmstudio.com` `:49`; 15 sequential table deletes ignore every error (`:65-79`), only final `auth.admin.deleteUser` throws → partial-delete leaves inconsistent state while reporting success.
- **MINOR — `AuthCallback.tsx`** passes raw `next` to `navigate` (`:84-93,150-158,184-194,263-265`) without the `startsWith('/')` validation `Auth.tsx:99-102` applies (bounded by react-router; not a true open redirect).

### Tally
DONE: AuthContext core, ProtectedRoute, RequireAccountType chain, supabase client, Auth/ForgotPassword/ResetPassword, auth-guard, oauth-authorize, admin-force-logout, auth-email-hook. PARTIAL: cold-load bounce, `/inbox`, oauth-callback, revoke-demo-sessions. UNVERIFIED: manage-sessions GoTrue endpoints.

---

## 2. CREDITS / BILLING  (high-risk)

### Lifecycle (how it actually works)
Ledger is source of truth: `credit_ledger_total()` sums `credit_transactions.amount` **excluding only** `('untracked_increase','audit','security_alert')` (`20260704000700_org_pool_consumption.sql:26-33`). `profiles.credits_balance` is a trigger-synced cache (`20260518175601_*:52-90`).
Reserve → consume/release → reconcile:
- `reserve_credits` (`20260705000100_org_pool_membership_authz.sql:26-106`): locks row `FOR UPDATE`, `available = balance − held`, inserts `credit_holds` row TTL `GREATEST(ttl,60)s`, idempotent on `(user_id, idempotency_key)`.
- `consume_credit_hold` (`:111-192`) / `release_credit_hold` (`20260518175601_*:383-424`) / `expire_credit_holds` (`:31-50`, called at top of every reserve/deduct/charge RPC).
- `reconcile_pipeline_credit_holds` (`20260518165621_*:14-85`): expires TTL holds, then consumes/releases holds linked via `movie_projects.credit_hold_id`.
- Pipeline glue persists `credit_hold_id` (`_shared/pipeline-credits.ts:95-104,123-145`).

### Claim (a) FROZEN-BALANCE — CONFIRMED-FIXED (minor caveat)
No permanent-freeze path: every hold has a finite TTL and `expire_credit_holds()` runs at the head of `reserve_credits`/`deduct_credits`/`charge_*` and inside reconcile (`20260518165621_*:27`). Terminal failures also release via `markProjectFailedAndRefund` step 4 (`_shared/pipeline-failure.ts:208-224`). **Caveat (PARTIAL):** the Studio-v2 `reserve-credits` edge fn reads `movie_projects` only for an authz check and **never sets `credit_hold_id`** (`supabase/functions/reserve-credits/index.ts:84-120`, verified — the `reserve` branch calls `rpc('reserve_credits')` with no project update). Reconcile JOINs on `mp.credit_hold_id` (`20260518165621_*:31-33,47-49,63-65`), so those holds are reconciler-invisible. Not a freeze (TTL self-heals) but a revenue leak: client dying post-success without `consume` → work delivered uncharged.

### Claim (b) ORG-POOL FUNDING — CONFIRMED-FIXED for the Polar path only
`polar-webhook`: `grantCredits` early-returns for any order with `metadata.org_id` (`polar-webhook/index.ts:71-74`) so the owner is never personally credited; `upsertSubscription` funds the pool via `monthly_org_credit_refill()` when `org_id && status in (active,trialing)` (`:196-204`), non-fatal. Refill credits `organizations.credits_balance` via `topup_org_credits` (`20260704001000_org_refill_funds_pool.sql:58-62`) — the exact pool `reserve_credits`/`consume_credit_hold`/`deduct_credits` debit for org projects (`20260705000100_*:53-55,163-167,233-237`), membership-gated (`:50-52,141-144,221-223`).
**Residual:** `monthly_org_credit_refill` JOINs `organizations.plan → org_plan_features` (`20260705021000_*:36-45`); neither `polar-webhook.upsertSubscription` nor `polar-checkout` sets `organizations.plan`. Unset plan / missing features row → refill JOIN empty → **paid org pool never funded**. Funding correctness depends on org provisioning elsewhere setting `plan`.

### Claim (c) ORG REFILL ON CONFLICT GUARD — CONFIRMED-FIXED
`20260705021000_org_refill_on_conflict_guard.sql:54-56` adds `ON CONFLICT (organization_id, refill_period) DO NOTHING`. Matching unique constraint exists (`20260503044426_*:196-206` `UNIQUE (organization_id, refill_period)`). Closes the cron-vs-webhook TOCTOU: prior bare INSERT (`20260704001000_*:64-65`) would raise unique-violation and abort; loser of the race now no-ops. Guard present and correct.

### Claim (d) ZOMBIE / REFUND LEDGER — STILL-BROKEN (top money bug)
`zombie-cleanup` issues each refund as BOTH an inserted `refund` ledger row AND an `increment_credits` call. Verified: `increment_credits` inserts a `system_grant` txn (`20260516222626_*:30-31`), and `credit_ledger_total` excludes only `untracked_increase/audit/security_alert` (`20260704000700_*:32`). So **both rows count → every zombie refund credits the authoritative ledger twice (2× R)**, real spendable double credits:
- Phase 0 avatar: `zombie-cleanup/index.ts:327-333` (refund) + `:335-338` (increment_credits).
- Phase 1 projects: `:494-501` + `:504-507`.
- Phase 2 clips: `:611-619` + `:622-625` — **no idempotency check at all** (`:611`), so concurrent runs each refund a clip.
Per-project idempotency checks (`:317-324`, `:483-490`) only stop re-runs of the same project, not the single-run doubling.
Additional zombie defects:
- **Not org-aware:** refunds always to `project.user_id` personal ledger with no `organization_id` (`:327-338,494-507`). Org-project spend was debited from `organizations.credits_balance` → mints personal credits, org pool never restored (contrast correct `refund_credits` `20260704001500_*:42-72`).
- **Not hold-aware:** for hold-flow projects credits were only reserved (never debited); zombie estimates a refund (`:293-298`) and mints it while reconcile/`markProjectFailedAndRefund` separately releases the hold → double credit. No `usedHoldFlow` guard (vs `pipeline-failure.ts:85-122` which guards exactly this).
By contrast `reverse_credit_purchase` (chargeback clawback, `20260704001400_*:51-53`, wired `polar-webhook:112-135`) is correct, idempotent, org-skipping.

### Cross-cutting
1. **HIGH — kill-switch absent; Stripe is the DEFAULT provider.** `src/lib/stripe-lock.ts` does not exist; 0 lock refs. `src/lib/payments/index.ts:55-56` defaults to `"stripe"`. `create-org-checkout`/`create-plan-checkout`/`create-credit-checkout` still build live Stripe checkouts with no guard. The **Stripe webhook never funds the org pool**: `handleSubscriptionUpsert` writes `organization_id` but calls no `topup_org_credits`/refill (`_shared/stripe-webhook-handler.ts:113-188`). Any org sub via the default Stripe path → unfunded pool. Claim (b) verified only for Polar.
2. Webhook sig verify OK — Polar HMAC-SHA256 over `id.timestamp.body`, 5-min replay (`_shared/polar.ts:92-128`); Stripe `verifyStripeWebhook` 401 (`stripe-webhook-handler.ts:331-345`).
3. Grant idempotency OK — `add_credits` dedupes on `stripe_payment_id` keyed `polar_<order.id>` (`20260518175601_*:450-457`, `polar-webhook:78`); money-path errors THROW→500→Polar retries (`polar-webhook:89,156-158,180-183`).
4. Latent — org `consume_credit_hold`/`deduct_credits` decrement `organizations.credits_balance` unconditionally after `ON CONFLICT DO NOTHING` (`20260705000100_*:154-167,228-237`); safe today only via single-txn + `held` status guard. Weakening the status guard → double-debit.

### Tally
DONE: reserve_credits + holds RPCs, reconcile (linked holds), monthly-credit-refill, polar-webhook, polar-checkout, reverse_credit_purchase, CreditsContext, sync-org-seats. PARTIAL: reconcile (only `credit_hold_id`-linked), reserve-credits edge (no hold link), create-*-checkout (Stripe, no guard), payments-webhook (sig OK but org subs never fund pool; `charge.refunded` only alerts). BROKEN: **zombie-cleanup** (double-refund + non-org-aware + non-hold-aware).

---

## 3. PROJECTS

Entity is **`movie_projects`** (no `projects` table). RLS enabled `20260103232411_*:85`, never disabled. Per-user policies correct: SELECT/INSERT/UPDATE/DELETE all `auth.uid() = user_id` (`20260104202048_*:8-26`). Public read limited to `is_public=true AND status='completed'` (`20260221005754_*:5-8`). Org policies additive/permissive (`20260502172041_*:333-350`).

App-layer CRUD via `src/contexts/StudioContext.tsx` (anon/user-JWT client, RLS-enforced): list `:159-164`, create `:322-332`, update `:414-417`, delete delegates to `delete-project` edge fn `:360-362`. Second create path `src/lib/editor/createDraftProject.ts:58-68`.

### Break points
- **BROKEN — CRITICAL IDOR in `continue-production`.** `supabase/functions/continue-production/index.ts` authenticates (`validateAuth:112`) and resolves `userId` (`resolveEffectiveUserId:133`) but **every `movie_projects` access is `.eq('id', projectId)` via the service-role client with NO `project.user_id === userId` ownership check** (`:146-152,184-205,290-307,336-338,468-470,537-539,822-870,1139-1195`; grep for ownership comparison → 0 matches). Invoked with a user JWT from the client (`src/hooks/useClipRecovery.ts:139`), so any authenticated user can pass an arbitrary `projectId` to drive another user's pipeline (flip status/stage, trigger `final-assembly`/next-clip render, charge credits).
- **HIGH — cross-tenant org-injection via permissive RLS (F4).** RLS policies are permissive (OR-combined); the per-user INSERT policy (`WITH CHECK auth.uid()=user_id`, `20260104202048_*:13-16`) is satisfied whenever the client sets `user_id=self`, so the org INSERT policy's `has_org_permission(...,'producer')` (`20260502172041_*:337-342`) is **never enforced** on create. `organization_id` is read from `localStorage('smallbridges.currentOrgId')` with no membership check (`StudioContext.tsx:320,329`; `createDraftProject.ts:56,65`) — a user can stamp ANY org UUID onto their own project and leak it into that org's SELECT view. In-code comment "validate the membership server-side via RLS" (`StudioContext.tsx:317-318`) is false.
- **MEDIUM — `delete-project` destructive partial-failure (F6).** Auth + ownership correct (`delete-project/index.ts:39-79`, `isServiceRole || project.user_id===userId`). But storage + Replicate predictions are deleted (`:84-159`) BEFORE the row delete (`:231`); child deletes are a hardcoded ~15-table list (`:168-228`) that can drift from the 30+ FK graph (several FKs no-cascade, e.g. `20260105020508_*:15,40`). All child deletes swallow errors (`:168-225`); storage warn-only (`:153-154`). A missing table with rows → 500 after irreversible storage loss → orphaned project.
- **MEDIUM — `cancel-project` ignores service-role + org roles.** Ownership filtered `.eq('user_id', userId)` (`cancel-project/index.ts:94,289-290`): no `isServiceRole` branch, and org producers/admins get 404 on a teammate's org project. Refund dedup-guarded (`:313-320`) but refund/storage/prediction failures swallowed non-fatal (`:229-231,249-251,356-357`).
- **LOW — `movie_projects.user_id` nullable** (`20260103232411_*:37`): null-owner legacy rows invisible to per-user RLS.

### Tally
DONE: app CRUD (RLS-backed), `movie_projects` table + RLS + per-user enforcement. PARTIAL: delete-project, cancel-project, org-INSERT RLS enforcement, app-layer org resolution. BROKEN: **continue-production (IDOR)**.

---

## 4. EDITOR

Routes: `/editor`,`/editor/:id` (`App.tsx:826-843` → `src/pages/VideoEditor.tsx:9` re-exports `@/pages/Editor`), `/business/editor/:id` (`App.tsx:591-596,624` → `src/pages/workspace/WorkspaceEditor.tsx:7,12`). All converge on `src/pages/Editor/index.tsx` → `EditorShell.tsx` (single NLE impl). Four persistence layers (`index.tsx:46-62`), each writing a different column so they don't clobber at row level: clip props → `video_clips` (`useClipPropertiesSync.ts:114-253`, 500ms), timeline → `movie_projects.editor_state` (`useEditorStateSync.ts:105-165`, 600ms), script → `movie_projects.script_document` (`document-store.ts:152-206`, 600ms), localStorage cache (`usePersistence.ts`).

### Approve & Render — BROKEN (CRITICAL, confirmed)
Two CTAs — Inspector `ShotInspectorCard.tsx:464,476` → `TakesDrawer.tsx:1419-1433` → `enqueueShot` (`orchestrator.ts:102`); Script `Script.tsx:1592` → `approveAndRenderShot:418-442` → `enqueueShot`. Chain dead-ends: `installedRunner` is `null` and **`installJobRunner()` is never called anywhere in the repo** (verified grep → only definition + reader). So `drainQueue` immediately fails every job "No render engine is connected" (`orchestrator.ts:260-264`). Both surfaces therefore gate the CTA to a disabled stub — `ShotInspectorCard.tsx:304-326` renders disabled "Rendering coming soon" (self-documenting comment `:304`: "installJobRunner is never called"); `Script.tsx:424-427` toasts "coming soon" and returns before enqueue. The headline feature is a non-functional stub. `TakesDrawer.tsx:1419` has no `isRunnerInstalled` guard — survives only because the upstream render gate disables the button; remove that gate and the inspector path silently fails every shot.
Working generation is the separate `editor-generate-clip` path (regenerate `TakesDrawer.tsx:189-235`, CreatePanel `CreatePanel.tsx:100,247`) — real, awaited, error-toasted. Final render only via `RenderQueuePanel.tsx:51-54` retry → `final-assembly`; `ExportPanel` publishes only, no render (`ExportPanel.tsx:43-65`). `render-video` edge fn is **orphaned** (0 invokers).

### Data-loss — CONFIRMED, narrow
`EditorShell.tsx:187-220` `beforeunload`/`visibilitychange` safety net flushes only `document-store.flushNow` (script) `:190` and `flushPendingClipWrites` (clip props) `:191` — it **never calls `flushEditorState`** (verified grep in EditorShell → 0 hits). So a hard tab-close/browser-kill within 600ms of a structural timeline edit (split/trim/reorder/transition/title/track) with no explicit Save **loses that edit**, while `editor_state.clips` is the declared durable source-of-truth on reload (`useEditorStateSync.ts:44-49`; `useProject.ts:327-334`). SPA route-nav (unmount `:162`) and explicit Save/Export (`SaveDialog.tsx:149-151`, `ExportPanel.tsx:52`) are safe. Secondary: `flushEditorState` does a blind `.update({editor_state})` with no `authoredAt` conflict guard (`useEditorStateSync.ts:90-103`) → concurrent-editor last-writer-wins clobber (presence active `EditorShell.tsx:136`).
Most per-clip/per-keystroke loss vectors already hardened (baseline-hash on hydrate, snapshot-without-clear flush, synthetic-clip skip). Remaining exposure is the `editor_state` column specifically.

Edge fns `editor-generate-clip`/`editor-ai-scene`/`editor-tts`/`editor-transcribe`/`final-assembly`/`approve-clip-one` all `validateAuth`-guarded, errors mapped not swallowed. `render-video` MISSING/orphaned.

### Tally
DONE: route map, editor-generate-clip/regenerate/Create, edge-fn auth. PARTIAL: save/autosave (one data-loss window + concurrency clobber), final-assembly (retry-only entry). BROKEN: Approve & Render. MISSING: render-video (orphaned).

---

## 5. ACCOUNT-TYPE MUTUAL EXCLUSIVITY — DONE (DB-backed)

Single mutually-exclusive column `profiles.account_type text NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal','business','enterprise','admin'))` (`20260503042838_*:4-11`). "Both at once" structurally impossible. Switch locked in DB two ways:
1. RPC `consume_onboarding_intent` (SECURITY DEFINER, sole write path) C1 guard: returns `account_type_locked` when `onboarding_completed AND intent.account_type DISTINCT FROM current` (`20260704002000_onboarding_account_type_hardening.sql:62-71`). Set via `BusinessStart.tsx:259,296` / `Onboarding.tsx:55,103`.
2. Two BEFORE-UPDATE triggers block direct client PATCH: `prevent_profile_privilege_escalation` raises "cannot modify account_type" (`20260518184624_*:25-27`); `fn_profiles_block_sensitive_self_update` reverts `NEW.account_type:=OLD.account_type` for non-service-role (`20260626110000_profiles_tier_escalation_guard.sql:45,52-55`).

Surface routing is an additional **client-only** UX layer (documented as such): `RequireAccountType.tsx:42-46` (personal blocked from `/business/*`, `App.tsx:600-627`), `RedirectBusinessToModule.tsx:56-64` (business→`/business/*` twins), `BusinessWorldIsolation.tsx:30-55` (business blocked from `/lobby,/me,/profile,/account,/settings,/inbox`). Credits separated by wallet not leaked (`useEffectiveCredits.ts:35-36,82-106` — org pool vs personal).

Gaps (low): (1) lock pivots on `onboarding_completed` not on account_type itself — narrow pre-onboarding window before `Onboarding.tsx:73-83` sets the flag; (2) routing is client-only — relies on org-table RLS server-side; (3) `admin` straddles both worlds by design.

Verdict: DONE — DB-backed and enforced, not client-only.

---

## OVERALL TALLY

| Flow | Verdict |
|---|---|
| Auth/session (core) | DONE (4 PARTIAL: cold-load bounce, /inbox, oauth-callback plaintext, revoke-demo; 1 UNVERIFIED: manage-sessions) |
| Credits/billing | PARTIAL overall — frozen-balance FIXED, org-pool FIXED (Polar), ON CONFLICT FIXED; **zombie double-refund BROKEN**; Stripe-default/no-kill-switch HIGH |
| Projects | PARTIAL — RLS per-user DONE; **continue-production IDOR BROKEN**; org-INSERT RLS gap HIGH |
| Editor | **Approve & Render BROKEN**; save/autosave PARTIAL (editor_state data-loss); render-video MISSING |
| Account-type exclusivity | DONE (DB-backed) |

## TOP CORRECTNESS RISKS

Money:
1. **zombie-cleanup double-refunds** every stalled project/clip — `refund` row + `increment_credits` `system_grant` row both count in `credit_ledger_total` (`zombie-cleanup/index.ts:327-338,494-507,611-625` + `20260516222626_*:30-31` + `20260704000700_*:32`). Real spendable 2× credits; Phase-2 clips also lack idempotency.
2. **Org subscriptions via the default Stripe path leave the org pool unfunded** (`stripe-webhook-handler.ts:113-188` no topup/refill; default provider `payments/index.ts:55-56`; no kill-switch present).
3. **zombie refunds org spend to personal ledger** and never restores the org pool (`zombie-cleanup/index.ts:283-338`); also mints refunds on hold-flow projects that were only reserved (double-credit on top of hold release).
4. **Org refill depends on `organizations.plan` being set** + `org_plan_features` row, which no checkout/webhook sets (`20260705021000_*:36-45`) → paid org never funded.

Editor:
5. **Approve & Render is a non-functional stub** — `installJobRunner` never called (`orchestrator.ts:285-300`); queue dead-ends, CTAs gated to disabled "coming soon".
6. **editor_state data-loss window** — `beforeunload` net omits `flushEditorState` (`EditorShell.tsx:187-220`); hard-close within 600ms of a structural timeline edit loses it; plus no concurrency conflict guard (`useEditorStateSync.ts:90-103`).

Cross-cutting security:
7. **continue-production IDOR** — no ownership check, user-JWT reachable (`continue-production/index.ts:112` auth but no `user_id` gate anywhere).
8. **Cross-tenant org-injection** via permissive RLS OR-bypass (`20260104202048_*:13-16` vs `20260502172041_*:337-342`; client stamps arbitrary org UUID).
