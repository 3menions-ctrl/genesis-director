---
name: Business Tier Architecture
description: Org-scoped workspace with seats, pooled credits, role hierarchy, and Stripe-managed seat-based subscriptions
type: feature
---
**Tier model:** Personal (existing) | Business (orgs) | Enterprise (future) | Admin.

**Roles** (hierarchy via `has_org_permission`): `owner` > `admin` > `producer` > `reviewer` > `viewer`. Last-owner protection via `protect_last_owner` trigger.

**Tables:** `organizations` (slug, plan, credits_balance, brand_*), `organization_members`, `organization_invites` (14d token), `org_seats`, `org_plan_features` (per-plan caps), `org_credit_refills`, `org_shared_assets`, `organization_brand_assets`. `subscriptions` and `movie_projects` have FK→organizations.

**Plans:** starter (free, 1 seat), business_starter ($99/mo, 5 seats, 1k credits), business_growth ($299/mo, 15 seats, 5k credits, popular), business_scale ($999/mo, 50 seats, 20k credits). Stripe products+prices live as `business_{tier}_{monthly|yearly}`.

**Credit consumption:** Generation pipeline calls `consume_org_credits(org_id, amount)` when project belongs to an org. Atomic decrement with member-gate check; falls back to per-user `deduct_credits` for personal projects. `topup_org_credits` is service-role only (webhook + monthly refill).

**Notification triggers:** `org_member_joined` (notifies inviter + welcomes new member), `org_role_changed`, `org_credits_low` (fires when balance crosses below 10% of monthly allotment). All use `notification_type` enum extended values.

**Routes:** `/workspace` (overview), `/workspace/team`, `/workspace/brand`, `/workspace/assets`, `/workspace/billing`, `/workspace/analytics`, `/invite/:token` (accept). All wrapped in `WorkspaceLayout` which uses `useWorkspace` context; redirects if no org. `WorkspaceSwitcher` in sidebar lets users toggle between personal and orgs.

**Edge functions:** `create-org-checkout` (Stripe checkout for new org), `create-portal-session` (billing portal), `sync-org-seats` (reconciles seat count after Stripe change), `monthly-credit-refill` (cron that resets pools).

**Inviolable rules:**
- Owners can never be deleted while last owner remains
- Org members can read all members; only admins+ can invite/remove
- Project FK→org is `ON DELETE CASCADE` — org deletion purges projects
- Credits debits on org projects MUST use `consume_org_credits`, never `deduct_credits`