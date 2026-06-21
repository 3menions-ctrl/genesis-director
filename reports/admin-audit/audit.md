# Admin Account Audit — Small Bridges

_Audit only. No code changed. Target architecture (per decision): admin becomes its own deploy / subdomain. Priorities deferred ("just the audit for now")._

## TL;DR

The admin is **not thin**. It is already a large, mostly-real, server-enforced module at `src/refine/` mounted under `/admin/*`. Backend is strong: **41 `admin_*` SECURITY DEFINER RPCs**, admin edge functions, a write-on-every-action `admin_audit_log`, `feature_flags` + `system_config`, and `is_admin()` enforced at the DB layer. Of the pages sampled, **none are stubs**; ~half have working writes.

The real issues are **reachability and gaps**, plus two **structural** limits (single hardcoded admin; client-only scopes).

---

## 1. App capability surface (what the product does)

14 areas / 100+ features. Condensed:

| Area | Users can… | Key data |
|---|---|---|
| Auth & onboarding | sign in/up, OAuth, reset, onboard | profiles, login_attempts, signup_analytics, onboarding_intents |
| Studio / creation | prompt→video, image studio, scenes, photo editor | movie_projects, video_clips, creation_canvases |
| Editor / production | timeline edit, restitch, re-render, track renders | video_clips, stitch_jobs, render_failures |
| Avatars / environments / templates | browse & cast 534 avatars, 120 worlds, 50 templates | avatar_templates, env data (static), project_templates, org_templates |
| Films / library | browse, filter, manage projects | movie_projects |
| Social / community | watch, react, comment, follow, watch parties, patron, tips | published_reels, video_comments, follows, patron_subscriptions, watch_parties, leaderboard |
| Messaging / notifications | DMs, lanes, prefs | direct_messages, notifications, support_messages |
| Account / profile | profile, security, creator settings, API keys | profiles, user_achievements, org_api_keys |
| Discovery / search | search reels & people | published_reels, profiles |
| Credits / billing | balance, buy packs, subscribe, invoices, refunds, payouts | credit_transactions, credit_packages, subscriptions, discount_coupons, refund_requests, creator_earnings_ledger, creator_payout_accounts |
| Business module | org workspace, ad-studio, distribution, team, brand, api, webhooks | organizations, organization_members, org_templates, approval_requests, workspace_audit_events, webhook_endpoints, workspace_integrations |
| Public / sharing | viral share, embed, widgets, hidden room | project_shares, widget_configs, widget_events |
| Help / support | FAQ, tickets, status | support_messages, support_macros, announcements |
| Enterprise / special | leads, invites, referrals | enterprise_leads, organization_invites, referral_codes |

## 2. Admin coverage (what exists today)

- **Module:** `src/refine/` — `RefineAdminLayout`, sidebar (Pulse · 5 hubs · Audit · Config), command palette (Cmd+K), lazy-loaded under `/admin/*` in `src/App.tsx:919-1003`.
- **Hubs:** People, Production, Money, Growth, System — all real container pages delegating to working tabs.
- **Ops pages (~37):** roles, feature-flags, content-safety, refunds, coupons, experiments, sessions, avatar-catalog, templates-admin, notifications, reconcile (REAL+WRITE); subscriptions, providers, edge-logs, db-health, storage, observability, referrals, secrets (READ-ONLY).
- **Top-level:** Users (REAL+WRITE: credits, roles, bulk, force-logout), Projects, Credits (read), Config (write), Moderation (write), Finance (read), Messages (write).
- **Backend:** 41 `admin_*` RPCs (all `SECURITY DEFINER` + inline `is_admin` guard + `REVOKE…FROM PUBLIC`), edge fns (`admin-user-action`, `admin-analytics`, `admin-delete-auth-user`, `admin-force-logout`, `admin-alert-dispatch`, `admin-stuck-jobs-watchdog`), `admin_audit_log` (written by every action), `feature_flags`, `system_config`.
- **Access model:** `is_admin(_user_id)` SQL fn → checks `user_roles` (enum `app_role`). Entry gate in `AdminLayout` calls the RPC; `OpsRouteGuard` + `scopes.ts` add per-route scope checks (client-side). **DB layer is server-enforced; the scope split is not.**

## 3. THE GAP

### A. Built but unreachable (quick wins — UI + backend already exist)
| Missing route | Ready backend | Impact |
|---|---|---|
| `/admin/users/:id` (`AdminUserDetailPage`) | `admin_get_user_detail` | list users but can't open one; per-user actions live here |
| `/admin/projects/:id` (`AdminProjectDetailPage`) | `admin_get_project_detail` | can't drill into a project |
| `/admin/orgs` + `/admin/orgs/:id` (`AdminOrgDetailPage`) | `admin_list_orgs`, `admin_get_org_detail`, transfer/delete/activate-enterprise | **all org/team admin unreachable** |
| Credit package CRUD (`AdminPackagesPage`) | `admin_manage_credit_package` | redirects away; can't edit packages/prices |

> The command palette already deep-links to `/admin/users/:id`, `/admin/projects/:id`, `/admin/orgs/:id` → **404 today.**

### B. Powerful levers with no surfaced UI (live on orphaned detail pages or nowhere)
- Impersonation / "log in as user" (`admin_create_impersonation_token`, `admin-user-action`)
- Suspend / unsuspend / force tier / change account type (`admin_suspend_account`, `admin_force_tier`, `admin_change_account_type`)
- Org owner transfer / delete / enterprise provisioning (`admin_transfer_org_owner`, `admin_delete_org`, `admin_activate_enterprise_org`)
- Daily-prompt scheduler for the Hidden Room (`admin_schedule_daily_prompt`)

### C. App capabilities with thin/no admin control
- **Creator monetization** — `creator_earnings_ledger`, `creator_payout_accounts`, `patron_subscriptions`, tips → no payouts/earnings admin (Money hub is *platform* finance only)
- **Enterprise leads CRM** — `enterprise_leads` captured at `/enterprise/coming-soon`, no admin view
- **Ad Studio & Distribution** (business) — ad generations + social publishing → no oversight
- **Widgets & public shares** — `widget_configs`, `widget_events`, `project_shares` → no admin view / kill-switch
- **Comment/DM moderation** — moderation covers projects/reels, not comments or DMs
- **Environments catalog** — avatars & templates have admin catalogs; environments don't

### D. Structural / account-level
- **Single hardcoded admin** — `user_roles` `CHECK` constraint pins the admin role to one user_id (`d600868d-…`). `AdminTeamPage`/`AdminRolesPage` exist but the constraint blocks multi-admin.
- **Scopes are client-only** — `scopes.ts` hides UI, but RPCs only check `is_admin` (all-or-nothing). No `admin_scopes` table → no enforceable "finance-only operator."

## 4. Separation status & path to a separate deploy/subdomain (chosen target)

**Today:** distinct in-repo module (own layout/router/RBAC, server-enforced gate, lazy-loaded). **Not** a separate bundle/subdomain — ships in the same SPA, shares auth/session + primitives (supabase client, UI lib).

**To reach `admin.<domain>` as its own deploy (outline, not yet planned in detail):**
1. New Vite entry/app (e.g. `apps/admin` or a second `index.admin.html`) that mounts only `src/refine` + a minimal router.
2. Extract shared primitives (`integrations/supabase`, `components/ui`, auth context) into a shared layer both apps import.
3. Admin-only auth flow on the subdomain; gate every route on `is_admin`; never bundle user-surface code.
4. Host config: subdomain → admin build; main domain unchanged. Same Supabase backend (RPCs already server-enforced, so the trust boundary is intact).
5. Remove `/admin/*` from the main SPA once the subdomain is live (or redirect it).

## 5. Recommended sequencing (for when you're ready)
1. **Wire orphaned pages** (A) — fastest, unlocks suspend/impersonate/org admin already built.
2. **Multi-admin + server-side scopes** (D) — required before inviting operators / before a subdomain serves a team.
3. **Fill capability gaps** (C) — creator payouts, enterprise leads, ad-studio/distribution, widgets, comment moderation.
4. **Separate deploy/subdomain** (B-arch) — once the surface is complete and scopes are real.

_Generated by an admin-account audit. File/route refs current as of this audit._
