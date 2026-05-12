# Finish the Business Account

## Current state — confirmed gaps

| Page | Status | Gap |
|---|---|---|
| Security | 22 lines of theater | All 3 actions are `disabled` (2FA, Domain capture, SSO) |
| Integrations | Only Webhooks live | Slack, Notion, Drive, Zapier are SOON pills |
| Reports | 35-line shell | Export button is `disabled` |
| Credits | 47-line shell | Auto-recharge button is `disabled` |
| Team | Functional | No per-member monthly credit cap UI |
| Approvals | Functional for reviewers | No "Submit for review" entry point in Create flow |
| (missing) | — | No first-run org wizard, no spend-threshold alerts |

Everything else (Team, Brand, Billing, Assets, Templates, Audit, API, Permissions, General, Danger, Notifications) is already real and wired.

## Build plan (8 phases, prioritized)

### Phase 1 — Security: make it real
- **SAML SSO**: invoke `configure_saml_sso` via the page's "Configure SSO" button (interactive form for IdP metadata + email domains).
- **2FA enforcement**: add `require_2fa` boolean to `organizations`, enforce on login for org members via a session check.
- **Verified domains**: new `org_domains` table (domain, verification_token, verified_at). DNS TXT verification flow.
- Replace the page with a real `Sections` UI showing each posture state + actions.

### Phase 2 — Integrations: wire what we can, gate what we can't
- **Slack**: incoming-webhook URL field per org → fires "production complete" notifications via existing `notify` edge function.
- **Zapier**: surface webhook URL field; trigger same payload as Slack on key events.
- **Drive / Notion**: keep as "Request access" with email capture into `feature_requests` table (real signal, not vapor).

### Phase 3 — Reports: real CSV export
- New edge function `export-workspace-report` that aggregates productions, credit spend, member activity for a date range → returns signed CSV.
- Wire the disabled Export button to a date-range picker dialog → download.

### Phase 4 — Credits: auto-recharge
- New edge function `configure-auto-recharge` storing threshold + top-up amount on `organizations`.
- Cron edge function `auto-recharge-tick` (or check on credit deduction) that triggers a Stripe charge when balance < threshold.

### Phase 5 — Per-member credit caps
- Reuse existing `monthly_credit_limit` column on `organization_members` (or add it).
- Inline editor on Team page rows for admins; enforce in the credit deduction RPC.

### Phase 6 — First-run org wizard
- 4-step modal triggered when `organizations.onboarded_at IS NULL` on first `/workspace` visit:
  1. Workspace name + logo
  2. Brand palette
  3. Invite seats
  4. Confirm plan/billing

### Phase 7 — Submit-for-review CTA
- Add a "Submit for review" button in `Create` and `VideoEditor` toolbars when the user is in an org with `producer` role and approvals are enabled.
- Inserts into existing `org_approvals` table.

### Phase 8 — Spend alerts
- Org-level spend threshold (daily/weekly).
- New edge function checks during credit deduction; emails owner via existing email infra.

## Out of scope (will not build)
- SCIM provisioning (separate enterprise project)
- Custom OIDC beyond SAML
- Native mobile flows (covered by responsive web)

## Approach
- Each phase = its own atomic batch of migration + edge function + UI wiring, tested before moving to the next.
- All new tables ship with RLS scoped to `organization_id` + `has_org_role()`.
- All edge functions reuse `auth-guard.ts` + `corsHeaders`.
- No design changes to the workspace shell — pages stay inside the existing `WorkspacePage` + `Surface` primitives.
