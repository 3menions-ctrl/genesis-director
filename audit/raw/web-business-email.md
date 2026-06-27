# Web Business/Org Surface + Email System — Deep Audit

Branch: `full-audit` · Repo: `/Users/briancole/Developer/genesis-full-audit` · READ-ONLY pass.
Method: end-to-end traces (client → edge fn / RPC → DB), file:line evidence. `worktrees/` excluded.
Date: 2026-06-26.

Legend: **DONE** = wired + persists, **PARTIAL** = works but with stub/gap, **BROKEN** = present but non-functional in practice, **MISSING** = not implemented, **ORPHANED** = code exists but unreachable, **UNVERIFIED** = could not fully trace.

---

## 1. ORG / BUSINESS ADMIN UI

The 7 audited routes are **redirects**, not standalone pages (`src/App.tsx:630-635, 531`):

| Legacy route | Redirects to (App.tsx) | Renders content via |
|---|---|---|
| `/business/general` | `:630` → `/business/settings?tab=general` | `GeneralSettingsContent` (`BusinessSettings.tsx:55`) |
| `/business/security` | `:631` → `?tab=security` | `SecurityContent` (`BusinessSettings.tsx:56`) |
| `/business/notifications` | `:632` → `?tab=notifications` | `NotificationsContent` (`BusinessSettings.tsx:57`) |
| `/business/danger` | `:633` → `?tab=danger` | `DangerContent` (`BusinessSettings.tsx:58`) |
| `/business/permissions` | `:634` → `/business/team?tab=permissions` | `PermissionsContent` (`BusinessTeamAccess.tsx:54`) |
| `/business/approvals` | `:635` → `?tab=approvals` | `ApprovalsContent` (`BusinessTeamAccess.tsx:55`) |
| `/settings/workspace` | `:531` → `/workspace/general` → (`:543-554`) → `/business/general` → `:630` | BusinessSettings (general), 3-hop |

All `?tab=` keys exist in the hub `TABS` maps (`BusinessSettings.tsx:19-24`, `BusinessTeamAccess.tsx:18-22`); unknown tabs default to `general`/`members`. **No route-level orphan** — every redirect lands on a rendering tab. The COCKPIT map wires `settings → BusinessSettings`, `team → BusinessTeamAccess` (`App.tsx:583,573`).

### Per-surface ratings

| Surface | Rating | Evidence |
|---|---|---|
| General | **DONE** | Reads `organizations.select("website,billing_email")` (`BusinessGeneral.tsx:51-55`); persists `organizations.update({name,slug,website,billing_email})` (`:78-86`) + audit `fn_log_workspace_event` (`:88-91`); admin-gated `hasPermission("admin")` (`:35`). Minor: initial read has no error handling (`:51-62`). |
| Security | **PARTIAL** | 2FA `rpc("set_org_security_policy")` (`:97`), add domain `rpc("add_org_domain")` (`:111`), verify `functions.invoke("verify-org-domain")` (`:121`), remove `org_domains.delete()` (`:131`) — all real, admin-gated. **SAML SSO is a `mailto:cole@smallbridges.co` stub** badged "Available" (`BusinessSecurity.tsx:263,273-277`). **"Recent sign-in activity" is scoped to the viewer's own `user.email`, not the org** (`:79-88`). `load()` swallows read errors (`:60-74`). |
| Permissions | **PARTIAL** | Live per-role counts from `organization_members.select("role")` (`:41-44`), but the capability `MATRIX` is a **hardcoded constant** (`BusinessPermissions.tsx:19-30`), self-badged "Read-only / coming with Enterprise" (`:102-103`). No mutation. |
| Approvals | **DONE** | Reads `approval_requests` + `movie_projects` (`BusinessApprovals.tsx:55-74`); persists `approval_requests.update({status,reviewer_id,reviewer_note,reviewed_at})` (`:89-97`) + best-effort `workspace_audit_events.insert` (`:106-114`, swallowed by design). Reviewer-gated (`:45`). |
| Notifications | **DONE** | Reads `org_notification_prefs.select("prefs")` (`:64-68`); persists `upsert` on conflict `organization_id` (`:88-90`) + audit (`:95-99`). `ROUTES` list hardcoded (`:31-38`); downstream consumption of prefs not verifiable in these files (UNVERIFIED integration). |
| Settings hub | **DONE** | URL-synced tab shell, all 4 tab keys match redirects (`BusinessSettings.tsx:19-40`). |
| Team & Access hub | **DONE** | `BusinessTeamAccess.tsx` shell; `TeamContent` (`BusinessTeam.tsx`) fully wired: invite insert (`:124-126`), role change + `send-transactional-email` (`:143-148`), remove (`:159`), credit cap `rpc("set_member_credit_limit")` (`:168`), revoke invite (`:175`). |

### UI flags
- **6 dead default-export pages.** `BusinessGeneral/Security/Permissions/Approvals/Danger/Notifications` each ship an unused `default function` + hero wrapper; only their named `*Content` exports are consumed. Code-level orphan (not user-facing breakage).
- **"Dispatch" invite sends no email.** Button/section labeled "Dispatch invite" (`BusinessTeam.tsx:203,217`) but only inserts a row + copies the accept link to clipboard; code comment admits "no invite email template wired yet" (`:121-123`). Misleading UX.
- **`window.prompt` for credit cap** (`BusinessTeam.tsx:164`) bypasses the project's dialog standard.
- Role-change email is best-effort `.catch(console.warn)` (`:153`).
- `BusinessDanger.tsx` was not separately traced here (no redirect target lands on a Danger-specific tab body distinct from `DangerContent`); rated via the Settings hub. **UNVERIFIED** as a standalone destructive flow — recommend a follow-up trace of `fn_soft_delete_org`/`fn_transfer_ownership` wiring in `DangerContent`.

---

## 2. ORG RBAC — **DONE** (enforced server-side)

Role hierarchy centralized in SECURITY DEFINER helpers with `SET search_path = public`:
- `fn_org_has_min_role(_org,_user,_min)` — current def at `supabase/migrations/20260705010300_editor_role_authz_and_org_api_keys.sql:41-68`. Ranks: `owner 6 > admin 5 > producer 4 > editor 3 > reviewer 2 > viewer 1`.
- `has_org_permission(...)` plpgsql same ranks (`...20260705010300...:15-39`).
- `is_org_member` / `get_user_org_role` (`20260502172041...:68-85`).

**Editor-role bug (audit #11) FIXED**: original helpers (`20260503063540...:26-52`, `20260502172041...:87`) omitted `editor` from the CASE → editors fell to `ELSE 0` and were denied everything; `20260705010300` reinserts editor at rank 3.

**Enforcement is two-layer (not client-only):**
1. RLS USING/WITH CHECK call the helpers: `organizations` UPDATE `has_org_permission(id,auth.uid(),'admin')` (`20260502172041...:178-180`), DELETE owner-only (`:182-184`); `org_api_keys` INSERT `fn_org_has_min_role(...,'admin') AND created_by=auth.uid()` (`20260503063540...:140-163`, `key_hash` exposed only via `org_api_keys_safe` security_invoker view); `approval_requests` reviewer-gated (`:258-271`).
2. SECURITY DEFINER RPCs re-check internally: `fn_soft_delete_org`/`fn_transfer_ownership` require `'owner'` (`20260503063540...:304,326`); org-pool reserve/charge require `'viewer'` membership (`20260705000100_org_pool_membership_authz.sql:50,141,221`).

**Privilege-escalation hole (H-1) FIXED**: the `"Admins can update member roles"` policy originally had USING but no WITH CHECK → admin could `SET role='owner'`. Closed at `20260704000200_org_member_role_update_guard.sql:21-36` (both clauses now block touching/creating owner rows unless caller is owner); `protect_last_owner` trigger layers on top.

**Org API keys** authenticate server-side via `find_api_key_owner` UNION over `org_api_keys` (`20260705010300...:70-86`). Residual gap (documented TODO M8, `...:11-13`): org-key spend bills `created_by`'s personal wallet, not the org pool — billing-attribution, not authz.

---

## 3. ORG SEATS & DOMAIN

### Org Checkout — **PARTIAL**
- Client `src/lib/payments/stripe.ts:37` maps `kind==="org"` → `create-org-checkout`. A parallel live path is `polar-checkout` accepting `orgId` (`supabase/functions/polar-checkout/index.ts:88-128`).
- `create-org-checkout/index.ts`: auth-gated (401, `:58-77`); if `organizationId` given, requires admin via `fn_org_has_min_role` (`:84-98`, IDOR fix H-7); builds **Stripe** session, base + per-seat line items (`:134-145`, seats clamped 1-250 `:41`). **Writes nothing — does NOT create org or seats.** Uses the Stripe SDK (`:102`) — but Stripe billing is kill-switched per project memory; **the per-seat model exists only in the disabled provider.** The live Polar org path carries **no seat concept** (`:121-128`).
- **Pool funding**: `polar-webhook/index.ts:61-74` deliberately skips owner grants for org orders ("pool funded by refill path"); `:196-204` calls `monthly_org_credit_refill()` on subscription active/updated, wrapped non-fatal. `monthly_org_credit_refill()` funds the pool via `topup_org_credits(...,'monthly_allowance')` guarded by `NOT EXISTS` + `INSERT ... ON CONFLICT (organization_id,refill_period) DO NOTHING` (`20260705021000_org_refill_on_conflict_guard.sql:48-56`). **Concurrent-refill TOCTOU closed** (matches recent commit `e9062618`).

### Org Seats — **BROKEN** (enforcement is dead code)
- `org_seats` table + `get_org_seat_count`/`assign_org_seat`/`revoke_org_seat` (`20260503043837...:172-273`) and `sync-org-seats` edge fn have **zero callers in `src`** (verified: grep returns only `types.ts`/test strings).
- Live "add member" path = invites → `organization_members` (§4), which **never touches `org_seats` and never checks a seat limit**. So `get_org_seat_count` is effectively always 0; `sync-org-seats/index.ts:43` `countData||1` would always push 1 seat, and nothing invokes it.
- The unreachable `assign_org_seat` (`:212-251`) is itself a **read-then-write TOCTOU**: `v_current := get_org_seat_count(...); IF v_current >= v_max THEN ...; INSERT ...` with no `FOR UPDATE`/advisory lock; `UNIQUE(org,user)` only blocks duplicate same-user rows, not over-count. `v_max` comes from plan tier `org_plan_features.max_seats`, **not** seats purchased — decoupled.
- **`organizations.plan` is client-writable**: `src/pages/BusinessStart.tsx:330` does `organizations.update({plan})`, permitted by the admin UPDATE RLS policy → owner can set `plan='scale'` for free, gaming `max_seats`/feature flags (credit refill still gated on an active subscription row).

### Domain Verification — **PARTIAL** (sound but cosmetic)
- `add_org_domain` RPC admin-gated (`20260512231828...:133-142`); `verify-org-domain/index.ts` does DNS-over-HTTPS TXT lookup at Cloudflare for `smallbridges-verify=<token>` (`:38-42`); token = `gen_random_bytes(16)` hex = 128-bit (`20260512231828...:22`); idempotent (`:35`); admin-gated (`:30-33`). Proof is cryptographically sound.
- **`verified_at` is consumed by nothing** — read only by `BusinessSecurity.tsx:204-213` to render a badge. Email-domain→org routing uses a **separate** `sso_domain_mappings`/`find_org_by_email_domain` (`20260503043837...:457-465`), unwired to this UI. Verification is decorative.
- `org_domains` is only `UNIQUE(organization_id,domain)` — **not globally unique**; two orgs can both add `google.com` (cannot fake `verified_at`, but claiming grants nothing).

### Invites — **DONE** (security-correct; inherits seat bypass)
- Token `encode(gen_random_bytes(32),'hex')` = 256-bit default (`20260502172041...:52`); `BusinessStart.tsx:342` overrides with `inv_<uuidv4>` (~122-bit, still strong, inconsistent).
- `accept_organization_invite(p_token)` SECURITY DEFINER, EXECUTE revoked from anon (`20260515231549...:4`): requires `auth.uid()` (`:232`); **expiry** enforced (`:247-249`, 14-day default `:54`); **single-use** (`:244-246`, sets `accepted_at` `:258-260`); **email-match** (`:250-252`); idempotent member insert `ON CONFLICT (org,user) DO UPDATE SET role` (`:254-256`). Accept is read-then-write w/o `FOR UPDATE` but idempotent → no harmful replay. Accepter role = `v_invite.role` verbatim; **no seat/plan-max check** → this is the mechanism that bypasses §2 seat limits.

---

## 4. ORG RLS — **ISOLATED**

RLS ENABLED on every org-scoped table; every policy scopes by membership via SECURITY DEFINER helpers. No `USING(true)`, no `TO anon/public`, no permissive bypass found.
- `organizations` SELECT `is_org_member(id,auth.uid())` (`20260502172041...:170-172`, RLS `:165`).
- `organization_members` SELECT `is_org_member(organization_id,auth.uid())` (`:187-189`); writes admin-gated (`:191-204`).
- `organization_invites` admin-gated + accept via SECURITY DEFINER w/ email-match (`:207-264`).
- `movie_projects` org policies membership/role-gated (`:333-350`).
- `workspace_audit_events`/`org_notification_prefs`/`org_templates`/`approval_requests` RLS + role-gated (`20260503063540...:72,131,178,215,255`).
- **Org credit "pool" = `organizations.credits_balance`** (`20260502172041...:20`), read via the org SELECT policy; consumption is membership-gated SECURITY DEFINER (`consume_org_credits` / `org_pool_membership_authz`).

**CRITICAL (remediated)**: the `organizations` UPDATE policy has no WITH CHECK / column restriction → an admin/owner could `UPDATE organizations SET credits_balance=...` for free credits. Closed by BEFORE UPDATE trigger `fn_organizations_block_sensitive_self_update` (`20260704001100_finance_authz_hardening.sql:23-50`) reverting `credits_balance`/`total_credits_*` for non-service callers. Net: enforced (verify trigger is live in prod).

Fix branches `fix/biz-admin-rls-migrations` / `fix/biz-admin-authz-code` are **present on full-audit** (H-1 guard `20260704000200`, finance hardening `20260704001100` both committed).

**Verdict: ISOLATED** — every org table has RLS + a membership-gated SELECT; no permissive policy; the one client-writable org-credit path is trigger-guarded.

---

## 5. ACCOUNT-TYPE EXCLUSIVITY — **DONE** (DB-enforced)

- `account_type` is a single TEXT column on `profiles` with `CHECK (account_type IN ('personal','business','enterprise','admin'))` (`20260503042838...:10-11`). One scalar column → "both" is structurally unrepresentable.
- **Immutability (two triggers, defense-in-depth)**: `prevent_profile_privilege_escalation` RAISES `'Forbidden: cannot modify account_type'` (`20260518184624...:25-27`); `fn_profiles_block_sensitive_self_update` reverts `NEW.account_type:=OLD.account_type` (`20260626110000...:45`).
- **Onboarding self-flip (C1) closed**: `consume_onboarding_intent` returns `'account_type_locked'` if `onboarding_completed` and type differs (`20260704002000_onboarding_account_type_hardening.sql:62-71`); business intents require work email (`:73-77`).
- Type changes confined to service-role webhook tier-mapping + `admin_change_account_type` (EXECUTE revoked from anon, `20260515231549...:9`).
- Client `RequireAccountType`/`BusinessWorldIsolation` are UX-only; real enforcement is the DB constraint + triggers.

---

## 6. EMAIL SYSTEM

Architecture: `auth-email-hook` and `send-transactional-email` → pgmq queues (`auth_emails`/`transactional_emails`) → `process-email-queue` dispatcher → Resend. Schema in `20260503013930_email_infra.sql` (pgmq queues + `_dlq`, `email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`).

| Component | Rating | Evidence |
|---|---|---|
| auth-email-hook | **PARTIAL** | Verifies Standard-Webhooks sig vs `SEND_EMAIL_HOOK_SECRET` (`:167`), enqueues to `auth_emails` (`:232`). **Not declaratively registered** — `[auth.hook.send_email]` commented out in `config.toml:157-160`; relies on manual dashboard config. **No suppression check.** |
| send-transactional-email | **DONE** | Requires `service_role` claim (`:83`, closes C-2); suppression checked **fail-closed** (`:176-194`) + `should_send_email_to` RPC (`:229`, fails open `:233`); idempotency_key into payload (`:408`); enqueues, never inline (`:396`). |
| process-email-queue | **PARTIAL → durability BROKEN** | Only reader of `RESEND_API_KEY` (`:82`); VT=30 (`:143`), TTL→DLQ (`:207`), `MAX_RETRIES=5` from real `email_send_log` count (`:220`), already-sent guard (`:226-248`), 429 cooldown (`:296-320`), 403→DLQ (`:325`). **No `cron.schedule` for it anywhere in migrations** (verified — only a comment `email_infra.sql:272-293` + comment in `20260613230000_settings_consumers.sql:11`; pointing at an out-of-repo `setup_email_infra` Management-API tool). Other crons (credit refill, storage quota, org refill, patron renewals) ARE registered. On a clean deploy from repo, **the queue never drains.** |
| preview-transactional-email | **DONE (stale auth)** | Renders registry templates; gated by leftover `LOVABLE_API_KEY` (`:18,32`). |
| handle-email-unsubscribe | **DONE** | Token-based; RFC 8058 one-click (POST + form + `List-Unsubscribe=One-Click`, `:47-52`); atomic `used_at` claim (`:99-105`); upserts suppression. Headers attached in `_shared/resend.ts:68-73`. |
| handle-email-suppression | **BROKEN / ORPHANED** | Built for the OLD stack: imports `@lovable.dev/webhooks-js` (`:2`), verifies `LOVABLE_API_KEY` (`:39,51`), comment says payload comes from "Go API when **Mailgun** reports a bounce" (`:4-5`). Sending is now Resend → Resend bounce/complaint webhooks never validate here → **bounces/complaints no longer feed `suppressed_emails`.** |
| newsletter-subscribe | **PARTIAL** | Upserts `newsletter_subscribers` idempotently (`:61`); sends hardcoded inline welcome via Resend directly (`:79-105`, **bypasses queue**); fire-and-forget, error swallowed (`:106-109`); **no suppression check**. |
| Admin email templates | **PARTIAL / DISCONNECTED** | DB table `email_templates` exists (`20260610011412_admin_console_tables.sql:67`) + full CRUD in `AdminEmailTemplatesPage.tsx`, but the **live sender does not read it** — page itself admits edits "don't change sent mail yet" (`AdminEmailTemplatesPage.tsx:33,112`). Real templates are code-defined React-Email in `_shared/transactional-email-templates/registry.ts`. Editor is a no-op. |

### Key questions
- **A. Durability**: queue is DB-backed/durable (pgmq + `email_send_log` + DLQs), but **no cron drains it in source → effectively BROKEN** (mail enqueues, never sends). Newsletter welcome is separately fire-and-forget.
- **B. Idempotency**: **strong** — per-message UUID as Resend `Idempotency-Key` (24h, `_shared/resend.ts:52`), partial unique index `idx_email_send_log_message_sent_unique ... WHERE status='sent'` (`email_infra.sql:76`), pre-send guard (`process-email-queue:226-248`).
- **C. Suppression**: checked on **only 1 of 3 send paths** — `send-transactional-email` ✅ (`:176-213`); `auth-email-hook` ❌ (and dispatcher doesn't re-check); `newsletter-subscribe` ❌. Auth mail bypasses suppression entirely.
- **D. Retry/Cron**: **MISSING** (verified). No `cron.schedule('process-email-queue',...)`.

---

## Tally

| Item | Rating |
|---|---|
| UI: General | DONE |
| UI: Security | PARTIAL (SAML mailto stub; self-scoped sign-in list) |
| UI: Permissions | PARTIAL (hardcoded read-only matrix) |
| UI: Approvals | DONE |
| UI: Notifications | DONE (downstream send UNVERIFIED) |
| UI: Settings hub | DONE |
| UI: Team & Access hub | DONE ("Dispatch" sends no email) |
| UI: Danger | UNVERIFIED (follow-up) |
| Org RBAC enforcement | DONE (server-side) |
| Org Checkout | PARTIAL (no org/seat persistence; Stripe per-seat path dead) |
| Org Seats | **BROKEN** (enforcement dead code; live path ignores seats; plan client-writable) |
| Domain Verification | PARTIAL (sound but cosmetic; not globally unique) |
| Invites | DONE (inherits seat bypass) |
| Org RLS isolation | DONE / **ISOLATED** |
| Account-type exclusivity | DONE (DB-enforced) |
| Email: auth-email-hook | PARTIAL (no suppression; hook not declaratively registered) |
| Email: send-transactional-email | DONE |
| Email: process-email-queue | PARTIAL → durability BROKEN (no cron) |
| Email: preview | DONE (stale auth) |
| Email: unsubscribe | DONE |
| Email: suppression webhook | **BROKEN / ORPHANED** (Lovable/Mailgun) |
| Email: newsletter | PARTIAL |
| Email: admin templates | PARTIAL (disconnected from sender) |

Counts: **DONE 11 · PARTIAL 8 · BROKEN 3 · UNVERIFIED 1**.

## Top risks
1. **Email durability (CRITICAL).** Queue is durable but **no committed cron drains `process-email-queue`** → on a clean deploy, all transactional + auth mail enqueues and is never delivered. Mitigation lives in an out-of-repo Management-API tool (`setup_email_infra`) — unverifiable from source; could be live in prod but is a deploy-reproducibility footgun.
2. **Bounce/complaint suppression broken.** `handle-email-suppression` still speaks Lovable/Mailgun; with Resend, bounces/complaints no longer populate `suppressed_emails` → deliverability/reputation risk. Auth mail bypasses suppression entirely.
3. **Org seat enforcement is dead code.** Live member-add (invites) ignores `org_seats`/`max_seats`; customers can exceed paid seat counts. `organizations.plan` is client-writable (`BusinessStart.tsx:330`) → free plan/feature upgrades.
4. **Cross-org data isolation: PASS (ISOLATED).** No leaky/permissive RLS policy; the one client-writable org-credit path is trigger-guarded. Strongest residual: confirm `fn_organizations_block_sensitive_self_update` trigger is deployed in prod.
5. **False-promise UIs**: SAML SSO (`mailto` stub badged "Available"), admin email-template editor (no-op), "Dispatch" invite (no email), permissions matrix (hardcoded).
