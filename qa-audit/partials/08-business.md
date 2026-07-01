# 08 — BUSINESS Workspace (`/business/*`) — QA Reliability Audit

Read-only audit. Surface = the BUSINESS workspace only (mutually exclusive from
personal). Method: every interactive control → handler → invoke/`supabase.from`/RPC/
storage → verified against `supabase/migrations/*.sql` + `src/integrations/supabase/types.ts`
+ `supabase/functions/` + `src/App.tsx` routing → user feedback / persistence.

Two HIGH findings (onboarding RLS, reports spend export) were verified directly by
the auditor, not just reported by sub-tracing. Items marked **UNVERIFIED** need a live
backend (provider secrets, prod DB) to exercise end-to-end; given the repo's documented
prod migration drift, several "WORKS in repo" verdicts carry a prod-apply caveat.

---

## SUMMARY

- **Functions traced:** ~110 controls across 24 business pages + 13 edge functions + shell/rail/nav.
- **Verdict spread:** overwhelmingly REAL — most controls reach a real table/RPC/edge fn with feedback.
- **BROKEN by severity:** **HIGH ×3**, **MEDIUM ×6**, **LOW ×8**.
- **Intentional STUBS (working-but-not-live, honestly disclosed): ×9.**
- **Worst issues:**
  1. **Business onboarding is fully blocked** — `onboarding_intents` INSERT is rejected by an RLS `WITH CHECK` that references a non-existent `email` column. No org is ever provisioned. (HIGH, verified)
  2. **Reports spend/burn/usage exports return empty** — all three read `org_spend_events`, which has no valid writer (the only writer inserts disjoint columns). (HIGH, verified)
  3. **Business API keys may fail auth / silently get full scope in prod** — keys write to `org_api_keys` but `api-v1` resolves via `find_api_key_owner`, whose org-UNION + scopes fixes live only in two late migrations (prod-drift risk). (HIGH, UNVERIFIED-live)

- **Nav integrity:** every rail nav slug resolves to a real mounted page; `BusinessComingSoon` is currently **unreachable** from the rail (no nav item falls through to it).

---

## INVENTORY

### Ad Studio + variants (`generate-ad-studio`, `generate-ad-variants`)
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Generate concepts | BusinessAdStudio.tsx:279 → `generate`:148 | AI ad concepts | invoke `generate-ad-studio` :156 → renders `concepts` :171 | WORKS (live UNVERIFIED) |
| Generate variants | BusinessAdStudio.tsx:562 → `generate`:481 | hook×format matrix | invoke `generate-ad-variants` :486 → renders :509 | WORKS (live UNVERIFIED) |
| Export concept/variants MD | BusinessAdStudio.tsx:447/591 | download .md | client Blob | WORKS |
| Send to Create | BusinessAdStudio.tsx:452/629 → `loadIntoCreate`:188 | push script to workbench | `saveDraft` → navigate `/business/create` | WORKS (drops `enableMusic`, LOW) |
| Copy buttons | BusinessAdStudio.tsx:334 | clipboard | `navigator.clipboard` | WORKS |
| `generate-ad-studio` fn | generate-ad-studio/index.ts:85 | concept gen API | auth-guard → tier gate :121 → org-member :127 → safety :144 → preflight credit (cost 3) :286 → OpenAI → charge :358 | WORKS (live UNVERIFIED) |
| `generate-ad-variants` fn | generate-ad-variants/index.ts:83 | variant gen API | auth-guard → org-member :111 → preflight (cost 2) :280 → OpenAI → charge :347 | WORKS (live UNVERIFIED) |

### Team / Seats / Permissions (`sync-org-seats`, `notify-org-event`)
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Invite member | BusinessTeam.tsx:125 `handleInvite` | create invite | insert `organization_invites` → copy link | WORKS (row only; NO email — see B4) |
| Change role | BusinessTeam.tsx:148 `updateRole` | role update | update `organization_members` | WORKS (no notify) |
| Remove member | BusinessTeam.tsx:161 `removeMember` | delete member | `confirmAsync` → delete row | WORKS |
| Set credit limit | BusinessTeam.tsx:167 `setLimit` | per-member cap | `window.prompt` → rpc `set_member_credit_limit` | WORKS |
| Revoke invite | BusinessTeam.tsx:178 `revokeInvite` | delete invite | delete `organization_invites` (no confirm) | WORKS |
| Roster load | BusinessTeam.tsx:96 | members+invites | rpc `org_member_directory` + tables | WORKS (RPC untyped, cast) |
| Permissions matrix | BusinessPermissions.tsx:19,86 | role×capability | static `MATRIX`, no controls | STUB (intentional, "Enterprise") |
| `sync-org-seats` fn | sync-org-seats/index.ts:15 | seats→billing | `STRIPE_BILLING_LOCKED` early-return | DEAD (no caller + locked + Stripe≠Polar — B5) |
| `notify-org-event` fn | notify-org-event/index.ts:9 | Slack/Zapier webhook | `safeFetch(org webhook)` | WORKS — only called from Integrations test, not team events |

### Brand / Settings / General / Billing / Credits
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Commit brand kit | BusinessBrand.tsx:93 (btn :141/:249) | save palette/voice/logo | update `organizations` | WORKS |
| Logo upload | BusinessBrand.tsx:340 | upload logo | storage `workspace-brand` + upsert `workspace_brand_assets` | WORKS (doesn't apply to org.logo_url until Commit — B11) |
| Settings tabs | BusinessSettings.tsx:32 | deep-link tabs | `setSearchParams` | WORKS |
| Save general | BusinessGeneral.tsx:72 | name/slug/site/email | update `organizations` + rpc `fn_log_workspace_event` | WORKS |
| Pricing inquiry | BusinessBilling.tsx:182 | "send to billing" | insert `support_messages` | WORKS |
| Billing/credits dashboards | BusinessBilling.tsx:98 / BusinessCredits.tsx:130 | spend KPIs | rpc `org_credit_transactions` | WORKS (read; pool accuracy caveat C2) |
| Plan/seat/Polar checkout | — | — | NO control exists | STUB (by design, "plans launch later") |
| Save spend alerts | BusinessCredits.tsx:155 | ceilings | rpc `set_org_spend_alerts` | WORKS (persist only; automation not live — disclosed) |
| Arm auto-recharge | BusinessCredits.tsx:168 | recharge prefs | rpc `set_org_auto_recharge` | WORKS (persist only; automation not live — disclosed) |
| Buy/purchase credits | — | — | NO control exists | STUB (by design) |

### Analytics + Widgets (`generate-widget-config`, `get-widget-config`, `log-widget-event`)
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Analytics load | BusinessAnalytics.tsx:52 | telemetry | rpc `org_member_directory` + `org_credit_transactions` + `movie_projects` | WORKS (real data, not mock) |
| Range 7/30/90d | BusinessAnalytics.tsx:225 | window | recompute (no refetch) | WORKS |
| Export CSV | BusinessAnalytics.tsx:151 | leaderboard | client Blob | WORKS |
| Charts kit | BusinessCharts.tsx | presentational | props-driven (no fabricated data) | WORKS |
| `get-widget-config` | get-widget-config/index.ts:34 | public config read | rate-limit → `widget_configs` (published) → domain allowlist | WORKS |
| `log-widget-event` | log-widget-event/index.ts:24 | telemetry sink | rpc `rate_limit_hit` → insert `widget_events` → rpc `increment_widget_analytics` | WORKS (write-only — no reader UI, B14) |
| `generate-widget-config` | generate-widget-config/index.ts:151 | AI widget builder | exists but NO caller in `src/`; partial persist | ORPHANED/STUB (B6) |

### Integrations / Distribution / Domain (`distribution-manage`, `distribution-oauth-callback`, `verify-org-domain`)
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Save/test/disconnect webhook | BusinessIntegrations.tsx:130/135/138 | Slack/Zapier | rpc `set_org_integration_webhook` + invoke `notify-org-event` | WORKS (UNVERIFIED live) |
| OAuth connect (Drive/Notion) | BusinessIntegrations.tsx:242 → `connect`:163 | OAuth start | fetch oauth-authorize → redirect | WORKS (gated on client-id secrets) |
| OAuth callback | (integrations) oauth-callback/index.ts:88 | exchange+store | HMAC state → upsert `workspace_integrations` | WORKS (carries absolute returnUrl) |
| Disconnect integration | BusinessIntegrations.tsx:247 | revoke | `confirmAsync` → update status=revoked | WORKS |
| Channel connect | BusinessDistribution.tsx:383 → `connect`:143 | channel OAuth | invoke `distribution-manage` authorize → redirect | WORKS (gated on per-provider secrets) |
| Channel disconnect | BusinessDistribution.tsx:379 | drop conn+secrets | invoke disconnect | WORKS |
| Publish (immediate) | BusinessDistribution.tsx:316 → `publish`:191 | post now | insert `distribution_jobs` → `adapter.publish` | PARTIAL (Meta premature-posted B8; YT/LinkedIn stub B3) |
| Schedule | BusinessDistribution.tsx (schedule path) | scheduled post | insert job status=scheduled, `continue` | BROKEN — no worker ever posts (B7) |
| Channel OAuth callback | distribution-oauth-callback/index.ts:43 | exchange+connect | state → exchange → upsert secrets → update connected | WORKS (redirect-env caveat B13) |
| Verify domain | verify-org-domain/index.ts:4 (BusinessSecurity.tsx:121) | TXT ownership | role gate → real DNS-over-HTTPS TXT lookup → set `verified_at` | WORKS (real check; UNVERIFIED live) |

### API keys + public API (`api-keys-manage`, `api-v1`)
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| List keys | BusinessApi.tsx:112 | list org keys | select `org_api_keys` (admin RLS) | WORKS |
| Generate key | BusinessApi.tsx:139 | create key | client CSPRNG → sha256 → insert `org_api_keys` (hash only) | WORKS (key hashed, raw shown once) |
| Revoke key | BusinessApi.tsx:179 | revoke | `confirmAsync` → update revoked_at | WORKS (honored by api-v1) |
| Webhook create/toggle/test/remove | BusinessApi.tsx:424/337/347/321 | webhooks | `webhook_endpoints` table + invoke `webhook-dispatch` | WORKS (delivery UNVERIFIED) |
| api-v1 key auth | api-v1/index.ts:75-103 | authenticate | sha256 → rpc `find_api_key_owner` (UNION api_keys+org_api_keys) | WORKS in repo / UNVERIFIED prod (B3) |
| api-v1 last_used touch | api-v1/index.ts:125 | update last-used | update `api_keys` by id | BROKEN for org keys (B10) |
| api-v1 POST /videos,/photo-edit | api-v1/index.ts:274/308 | generate | deduct_credits → invoke pipeline → refund on err | WORKS (UNVERIFIED live) |
| api-v1 POST /avatars | api-v1/index.ts:202 | avatar | returns 501 | STUB (intentional) |
| `api-keys-manage` fn | api-keys-manage/index.ts | personal keys | server gen+hash, subscription-gated | WORKS (NOT business surface; called by Developers.tsx) |

### Reports / Templates / Audit / Assets / Approvals (`export-workspace-report`)
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Export report ×4 | BusinessReports.tsx:114 → `exportReport`:43 | CSV export | invoke `export-workspace-report` → Blob | WORKS (mechanism); spend reports EMPTY (B2) |
| edge usage/burn/spend | export-workspace-report/index.ts:34-83 | reports | reads `org_spend_events` | BROKEN — table has no valid writer (B2) |
| edge project_ledger | export-workspace-report/index.ts:56 | projects | `movie_projects` | WORKS |
| Create template | BusinessTemplates.tsx:266 → :69 | save template | insert `org_templates` (config `{}`) | WORKS (but inert — no apply, B-note) |
| Delete template | BusinessTemplates.tsx:198 | delete | `confirmAsync` → delete | WORKS |
| Built-in effect tiles | BusinessTemplates.tsx:132 | launch effect | `<Link to=/create?template=>` | WORKS |
| Audit load + export | BusinessAudit.tsx:64 / :184 | trail | `workspace_audit_events` + rpc `org_credit_transactions`; client CSV | WORKS (actor_name blank on approvals, B12) |
| Assets ingest/drag/delete | BusinessAssets.tsx:133/183/170 | media | storage `brand-assets` + `organization_brand_assets`; `confirmAsync` delete | WORKS |
| Approve/Reject | BusinessApprovals.tsx:228/236 → `decide`:86 | sign-off | update `approval_requests` + insert audit (self-review blocked) | WORKS |

### Overview / Projects / Start / Security / Notifications / Danger / Shell / Rail
| Function | Entry (file:line) | Purpose | Code path | Verdict |
|---|---|---|---|---|
| Overview KPIs + quick actions | BusinessOverview.tsx:80/218/306 | metrics + nav | real queries + `<Link>` to real routes | WORKS (real data) |
| Projects load/open/new | BusinessProjects.tsx:89/336/234 | org browser | `movie_projects` org-scoped; nav `/production/:id`,`/business/create` | WORKS (owner-name fallback risk B16) |
| Onboarding `ensureIntent` | BusinessStart.tsx:279 | persist intent | insert `onboarding_intents` | **BROKEN — RLS rejects all inserts (B1)** |
| `provisionWorkspace` | BusinessStart.tsx:292 | create org | rpc `consume_onboarding_intent` → update org → invites | WORKS but UNREACHABLE (gated behind ensureIntent, B1) |
| Security: 2FA / add+verify+remove domain / SSO | BusinessSecurity.tsx:94/106/119/129/273 | security | rpc `set_org_security_policy`/`add_org_domain`/`org_domains`; verify-org-domain; SSO=mailto | WORKS (SSO intentionally manual) |
| Notifications load/save/toggle | BusinessNotifications.tsx:61/85/102 | prefs | upsert `org_notification_prefs` + audit | WORKS (persist; dispatch-honors UNVERIFIED) |
| Danger: transfer/export/delete | BusinessDanger.tsx:36/81/110 | ownership/export/soft-delete | rpc `fn_transfer_ownership` / Blob / rpc `fn_soft_delete_org`; typed-name Dialog confirm | WORKS |
| Rail: switch org/signout/nav | BusinessRail.tsx:95/131/154 | navigation | `switchOrg`, SignOutDialog, `<Link>` | WORKS |
| Shell loading/no-org | BusinessShell.tsx:33 | gating | graceful "No workspace selected" | WORKS |
| BusinessComingSoon | BusinessComingSoon.tsx | stub | unreachable from rail | STUB (intentional, unused) |

---

## BROKEN

### B1 — Business onboarding intent INSERT rejected by RLS (`email` column does not exist) — HIGH (verified)
- **Symptom:** On the "Create workspace" step the user gets toast "Could not save your details. Please try again." and can never proceed; **no org is provisioned and `account_type` is never set to business.** Business signup is fully blocked.
- **Repro:** `/business/start` → complete chapters 1–5 → "Create workspace" → fails.
- **Root cause:** `BusinessStart.tsx:279` does `supabase.from("onboarding_intents").insert(payload)`. The INSERT policy "Anyone can create onboarding intent" (`supabase/migrations/20260515231445_d730d84c…sql:31`) has `WITH CHECK (… coalesce(length(btrim(coalesce(row_to_json(onboarding_intents.*)::jsonb ->> 'email',''))),0) BETWEEN 5 AND 320)`. The table has **no `email` column** — only `contact_email`/`billing_email` (`20260503001955…sql:22`, `20260503032506…sql:10`; confirmed in `types.ts`). `->> 'email'` → NULL → length 0 → `0 BETWEEN 5 AND 320` is false → every insert rejected. The client payload (`BusinessStart.tsx:258-278`) populates `contact_email`, never `email`. Error swallowed into generic toast (`:280-284`).
- **Fix:** DB-only — change the policy check to reference `contact_email` (the column the client writes), or add an `email` column. BusinessStart is the only client writer to this table, so the break is isolated to business onboarding.
- **Caveat:** Given documented prod migration drift, confirm the live policy matches the repo before treating as live-broken; the repo migrations as written guarantee failure.

### B2 — Reports spend / per-member-burn / usage exports return empty — HIGH (verified)
- **Symptom:** "Spend ledger" and "Per-member burn" download header-only CSVs; "Monthly usage summary" always shows `credits_consumed=0` / `estimated_spend_usd=0.00`. UI still toasts green "… exported", so it looks functional.
- **Repro:** `/business/reports` → any window with real activity → export "Spend ledger"/"Per-member burn" → empty; "Monthly usage" → 0 (while `/business/audit` shows real credit movement for the same org).
- **Root cause:** All three queries read `public.org_spend_events` selecting `occurred_at,user_id,credits,reason` (`export-workspace-report/index.ts:34-83`). The **only writer in the entire repo** is the low-credits trigger, which inserts a **disjoint column set** `(organization_id, event_type, credits_amount, metadata)` (`20260610030217_org_credits_low_notification.sql:63`) — it never sets `credits`/`user_id`/`reason`, and only fires on low-credit notices, not on spend. Real spend lives in `credit_transactions` (what `BusinessAudit` correctly reads via rpc `org_credit_transactions`). The Reports surface is pointed at the wrong, perpetually-empty table.
- **Fix:** Repoint the edge fn's `spend_events`/`member_burn`/`usage_summary` queries at `credit_transactions` (filter `organization_id`, `created_at`; negative `amount` = spend), matching the audit page's source. Lower-risk than adding a new `org_spend_events` writer.

### B3 — Business API keys may 401 or silently gain full scope in prod (migration-drift) — HIGH (UNVERIFIED-live)
- **Symptom:** A key minted in `/business/api` could return `401 Invalid or revoked API key` on every api-v1 call, OR silently get full `read+generate` scope regardless of configured scopes.
- **Root cause:** UI writes to `org_api_keys` (`BusinessApi.tsx:147`) but the gateway resolves keys only via rpc `find_api_key_owner` (`api-v1/index.ts:83`). The base RPC (`20260502204207…sql:57`) queries `api_keys` only. The org-UNION fix lives in `20260705010300…sql:77` and the `scopes` return in `20260706000100…sql:20`. **Correct in repo**, but per CLAUDE.md prod has heavy drift; if either late migration isn't applied, lookup misses (401) or `scopes` is absent and api-v1 falls back to `['read','generate']` (`api-v1/index.ts:95-103`) — masking scope-loss as full access. `types.ts:9470` still types the stale 2-column RPC (type drift).
- **Fix:** Verify in prod (`ywcwaumozoejierlfkgj`) that `find_api_key_owner` returns 3 columns and UNIONs `org_api_keys`. Regenerate types.

### B4 — Team invite sends no email and no notification — MEDIUM
- **Symptom:** "Dispatch invite" never emails the invitee; it only inserts a row and copies a link to the admin's clipboard.
- **Root cause:** `BusinessTeam.tsx:handleInvite:132-146` — insert + `navigator.clipboard.writeText` only; no email/notify call. Comment at `:129-131` says no invite-email template is wired. (`updateRole` likewise sends no notification — comment notes the prior `send-transactional-email` invoke 403'd on user JWTs and was removed.)
- **Note:** Deliberate link-only flow; toast is honest ("Invite link copied"). Flagged because the "Dispatch" label implies delivery. **Fix:** server-side enqueue (DB trigger / SECURITY DEFINER RPC) on `organization_invites` insert; or rename label.

### B5 — `sync-org-seats` edge function is dead and provider-mismatched — MEDIUM
- **Symptom:** Seat-count→billing sync never runs.
- **Root cause:** (1) no caller anywhere (`grep` finds only a comment in `create-org-checkout/index.ts:122`); (2) `sync-org-seats/index.ts:17` returns `stripeBillingLockedResponse` immediately (`STRIPE_BILLING_LOCKED`); (3) targets Stripe subscriptions, but the active provider is Polar. Internals (rpcs, `subscriptions`) are valid but unreachable.
- **Fix:** Remove, or rebuild on Polar and wire to seat assign/revoke. UNVERIFIED-live.

### B6 — `generate-widget-config` orphaned + partial persistence — MEDIUM
- **Symptom:** The AI widget-builder flow is dead in-app. No `src/` code calls `generate-widget-config`, and nothing in the repo INSERTs into `widget_configs` (only deletes/updates/reads). No widget-builder UI exists.
- **Root cause:** `generate-widget-config/index.ts:151` exists but unwired; even if invoked it only persists `scenes` and only when `generate_videos` is truthy (`:367,:424-429`) — generated `headline/cta/colors/triggers/rules` are returned (`:432-442`) but never written. `get-widget-config` would serve a row missing all copy.
- **Fix:** Remove as dead code, OR build the widget-builder UI that creates the row and persists the full returned config (not just scenes).

### B7 — Scheduled distributions are written but never posted — MEDIUM
- **Symptom:** "Schedule" creates a `distribution_jobs` row `status='scheduled'` and toasts success, but the post never goes live; job stays scheduled forever.
- **Root cause:** `distribution-manage/index.ts:223-227` inserts the scheduled row and `continue`s without posting. No worker/cron ever reads `distribution_jobs WHERE status='scheduled'` (no other edge fn or `pg_cron` targets it). Write-only dead end.
- **Fix:** Add a scheduled function selecting due jobs (`scheduled_at <= now()`), loading the connection token, calling `adapter.publish`, updating status — mirror the immediate block at `:236-248`.

### B8 — Meta publish reports "posted" after only creating a media container — MEDIUM (UNVERIFIED-live)
- **Symptom:** A Meta publish marks the job `posted` with an `external_post_id`, but nothing is actually published to IG/FB.
- **Root cause:** `_shared/distribution-providers.ts:86-101` — `meta.publish` POSTs to `me/media` (container creation only) and returns `{ok:true,status:"posted"}` from the container id. The required second step `{ig-user-id}/media_publish` is never called; IG publishing must target the IG user id, not `me`. Adapter comment flags it unverified.
- **Fix:** Implement the 2-step IG flow (create container on IG business user id → poll → `media_publish`); only then mark `posted`. Until then return `pending`/`failed`, not `posted`.

### B9 — API keys "inherit the org credit pool" is a false promise — MEDIUM
- **Symptom:** UI states keys "inherit the org credit pool" (`BusinessApi.tsx:212,269`), but spend is billed to the key creator's personal wallet.
- **Root cause:** `find_api_key_owner` returns `created_by` as `owner_user_id` for org keys (`20260705010300:88`); api-v1 deducts against that `userId` (`api-v1/index.ts:90,247-253`). Org-pool routing tracked under "M8" (migration comment `:12-13`).
- **Fix:** Route org-key spend to the org pool, or correct UI copy until M8 ships.

### B10 — `last_used_at` never updates for org keys — LOW
- **Symptom:** Business keys always show "Never used" even after successful API calls.
- **Root cause:** `api-v1/index.ts:125-129` always updates `api_keys` by id; for an org key the id belongs to `org_api_keys`, so the update matches no row (silent fire-and-forget).
- **Fix:** Branch the touch by source table (the RPC knows which matched), or move into a SECURITY DEFINER RPC.

### B11 — Logo upload doesn't apply to `organizations.logo_url` until "Commit kit" — LOW
- **Symptom:** "Logo uploaded" toast implies done, but the brand-applied field `organizations.logo_url` is unchanged until a separate "Commit kit" click; generations keep using the old logo. "Remove logo" likewise only commits on save and never deletes the storage object.
- **Root cause:** `BusinessBrand.tsx:LogoUploader.upload:340-363` writes storage + `workspace_brand_assets` + `onChange(publicUrl)` (parent state only); the `organizations` write is in `save():93`.
- **Fix:** Persist `logo_url` to `organizations` inside `upload`, or soften the toast and mark the page dirty.

### B12 — Approvals audit events show a blank actor — LOW
- **Symptom:** Approve/Reject rows in `/business/audit` have no actor name and never appear in the "Most active" leaderboard.
- **Root cause:** `BusinessApprovals.tsx:decide:110-118` inserts the audit event with `actor_id` only (no `actor_name`), but `BusinessAudit.tsx:102-104,133` renders `actor_name`.
- **Fix:** Pass `actor_name` on insert, or resolve `actor_id`→name in BusinessAudit.

### B13 — distribution OAuth callback redirect depends on an app-URL env that may be unset — LOW (UNVERIFIED)
- **Symptom:** After channel OAuth approval, the browser may land on the Supabase functions host instead of the app.
- **Root cause:** `distribution-oauth-callback/index.ts:30-33` builds the redirect from `PUBLIC_APP_URL || APP_URL || SITE_URL`; if all unset, `appUrl` is relative `/business/distribution?...` and the 302 resolves against the functions domain (404). Tokens still stored; only the bounce is affected. (The integrations `oauth-callback` avoids this by carrying an absolute returnUrl in signed state.)
- **Fix:** Require one of those envs, or carry an absolute return origin in `state`.

### B14 — Widget analytics counters are write-only (no reader UI) — LOW
- **Symptom:** `log-widget-event` increments `total_views/total_cta_clicks/total_scene_plays` and writes `widget_events`, but no UI reads them. `BusinessAnalytics` doesn't query `widget_configs`/`widget_events` at all.
- **Fix:** Add a widget-performance view, or accept as not-yet-built.

### B15 — Send-to-Create silently discards `enableMusic` — LOW
- **Symptom:** Ad Studio writes `enableMusic:true` into the draft (`BusinessAdStudio.tsx:205`) but CreationHub never reads it (restore reads only `enableNarration` at `CreationHub.tsx:346`; submit hardcodes `enableMusic:false` at `:369`). Music is always off.
- **Fix:** Make `enableMusic` stateful in CreationHub and restore it, or drop the dead flag from `loadIntoCreate`.

### B16 — Projects owner-name read bypasses the org directory RPC — LOW (UNVERIFIED)
- **Symptom:** Project cards may show "Member" instead of real owner names.
- **Root cause:** `BusinessProjects.tsx:111-114` reads `profiles` directly, whereas the hardened pattern (post profiles-email-containment) used by `BusinessOverview.tsx:106` / `BusinessDanger.tsx:55` goes through SECURITY DEFINER rpc `org_member_directory`. If profiles RLS blocks cross-user `display_name` reads, names silently fall back.
- **Fix:** Route owner-name resolution through `org_member_directory`.

---

## INTENTIONAL STUBS (working-but-not-live, honestly disclosed — NOT defects)

1. **BusinessPermissions matrix** — static read-only display, "Custom role policies coming with the Enterprise tier" (`BusinessPermissions.tsx:103`). No toggles to break.
2. **Auto-recharge automation** — save works; "Automatic purchasing isn't live yet" disclosed (`BusinessCredits.tsx:405-407`).
3. **Spend-alert delivery** — save works; "Alert delivery isn't live yet" disclosed (`BusinessCredits.tsx:435-437`).
4. **Billing checkout / plan / seat purchase** — no control exists by design ("plans launch later", `BusinessBilling.tsx:236`). Not dangling; absent. If a real Polar checkout is expected pre-launch, it is *missing*, not broken.
5. **Credits purchase** — no buy control; auto-recharge is the only (not-live) top-up.
6. **Distribution YouTube/LinkedIn adapters** — return `pending_credentials` unconditionally (`distribution-providers.ts:176,209`), surfaced truthfully in job status.
7. **api-v1 POST /avatars** — returns 501 before charging (`api-v1/index.ts:202`).
8. **Saved templates** — create/delete work but there is no "apply/use" control and `config` is stored `{}`; "Total uses" StatCard always 0. Saved org templates are inert labels (the functional launch path is the separate built-in effects catalogue). Borderline — not a broken control, but a misleading promise.
9. **SSO configure** — `mailto:` manual provisioning "within one business day" (`BusinessSecurity.tsx:273`), not self-serve. By design.
10. **BusinessComingSoon** — exists but unreachable from the rail; the `?? <BusinessComingSoon>` fallback in App.tsx is dead because every nav slug maps to a real page.

---

## ROUTING / DEAD-CODE NOTES

- Every `businessNav.ts` slug → real mounted page (Overview, Ad Studio, Create, Editor, Projects, Assets, Avatars, Environments, Templates, Learning, Team, Brand, Audit, Billing, Credits, Analytics, Reports, Distribution, Integrations, API, Settings). None fall through to ComingSoon.
- `/business/{security,notifications,danger,general,permissions,approvals}` **redirect** to `/business/settings?tab=…` / `/business/team?tab=…` (`App.tsx:644-649`). The `BusinessSecurity`/`BusinessNotifications`/`BusinessDanger`/`BusinessGeneral`/`BusinessPermissions`/`BusinessApprovals` **default exports are unreachable dead code**; only their named `*Content` exports are consumed inside the Settings/Team hubs. Not a bug, but dead-code cleanup candidates.
- `/business/start` is a public, auth-free route; the rest of `/business` is gated by `RequireAccountType allow=[business,enterprise,admin]` + `EnterpriseGate`.

---

## UNVERIFIED (needs live backend / provider secrets / prod DB)
- All AI generation paths (ad-studio, ad-variants, api-v1 video/photo) — wiring correct, live response unverifiable.
- B3 (find_api_key_owner prod state), B8 (Meta Graph flow), B13 (redirect env), B16 (profiles RLS), webhook-dispatch delivery, notification dispatcher honoring prefs.
- Whether recent (2026-07-03→07-06) RPCs (`org_member_directory`, `org_credit_transactions`, `rate_limit_hit`, `find_api_key_owner` union) are applied in prod — if not, Analytics/Overview render all-zero and API auth fails.
