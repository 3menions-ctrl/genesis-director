# 11 — Prod Migration Drift & Safe Apply Plan

> Generated from live `supabase migration list` against **prod = `ywcwaumozoejierlfkgj`** (read-only; CLI is linked, DB password cached). Prod is the project referenced by `config.toml` + committed source. The sibling `sdivmvoselmyjqszfujo` is empty.

## 0. The headline finding (reframes the audit)
**Prod is 32 migrations behind the repo**, and the drift is **non-prefix** — prod has `…010000–011100` applied but is missing both an *earlier* batch (`20260613*`, `20260703*`, `20260705000100–000900`) and a *later* batch (`20260705012000–021000`). In plain terms: **the entire June-13 social/creator/monetization layer and the July-5 security/finance hardening suite are NOT on prod.** Many "broken/partial" findings in `02-WEB.md`/`web-social.md` are likely *because their migrations were never deployed*, not because the code is wrong. Re-read the audit with that lens.

## 1. Risk posture (good news)
- **No migration does destructive work at apply time.** Every `DROP`/`DELETE` flagged is inside an RPC *function body* (block/unblock, reject-follow, remove-reaction) — normal runtime logic, not apply-time data loss. Migrations are additive (`CREATE TABLE/FUNCTION/POLICY`) with `IF [NOT] EXISTS` guards.
- **The real hazard is ordering/interleaving**, not destruction: applying a *lower-numbered* pending migration onto a prod that already has *higher-numbered* applied ones can momentarily regress a function (e.g., `000400` re-defines `find_api_key_owner`, which applied-`010300` already redefined). In a single `db push` the next migration corrects it sub-second, but it means **you cannot cherry-pick freely** — column/function deps are tangled.

## 2. Two paths

### Path A — Full catch-up (recommended, but gated on two confirmations)
Apply all 32 in **chronological order** (timestamps encode the intended dependency order; `supabase db push` does exactly this), then my 2. This makes prod == repo — the actual fix.
- **Blocked on:** (a) confirming **none are deliberately gated** — cross-check the finance/org-pool ones against PR #66 / `FINANCE_DEPLOY_PLAN.md` (memory: "finance backlog GATED in PR #66; prod has frozen-balance bug"); (b) doing it on a **branch/staging clone first** (Supabase branching, or `db dump` → restore → push → smoke-test).
- **Do NOT** run `supabase db push` straight at prod without (a) and (b): it will apply the gated finance migrations too.

### Path B — Minimal (just the audit-remediation fixes)
If you only want my two security/money fixes live now:
1. `20260705000400_api_key_scopes` (prereq for my api-key fix — adds `api_keys.scopes`)
2. `20260706000000_audit_remediation_money_rls` (deps already on prod — standalone-safe)
3. `20260706000100_restore_api_key_scopes`
Apply these three **via the dashboard SQL editor** (transactional — wrap in `BEGIN; … ROLLBACK;` to test, then `COMMIT`), then record versions in `supabase_migrations.schema_migrations`. Caveat: `000400`→`000100` transiently regresses `find_api_key_owner` for <1s between statements; run them in one session. This leaves the other 30 still drifted.

## 3. The 32 pending migrations, in apply order (waves)

> Flags: 💰=touches money/credits · 🔐=RLS/authz · 🆕=new table · 🌱=seeds/backfills data. None are destructive at apply time.

### Wave A — June 13 · social / creator / monetization layer (13)
| Version | Migration | Flags | Smoke test after |
|---|---|---|---|
| 20260613100000 | profile_interests | | profile loads |
| 20260613110000 | wan_engine_check | | — |
| 20260613120000 | lobby_feed_security_definer | 🔐 | lobby feed respects blocks |
| 20260613130000 | find_friends_directory | | /find-friends |
| 20260613140000 | profile_username | 🔐 | username set/lookup |
| 20260613150000 | profile_mutual_follows | 🔐 | mutuals show |
| 20260613160000 | block_report | 🔐🆕 | block/unblock, report |
| 20260613170000 | profile_super | 💰🔐🆕 | profile + any credit field |
| 20260613180000 | pledge_patron_ledger | 💰🔐🌱 | **pledge a patron** (creates `pledge_patron`) |
| 20260613190000 | creator_posts | 💰🔐🆕 | creator post + paywall |
| 20260613210000 | patron_revenue_private | 💰🔐 | patron revenue visibility |
| 20260613230000 | settings_consumers | 💰🔐🆕 | follow requests, settings |
| 20260613240000 | unified_inbox (1248L) | 💰🔐🆕🌱 | **DMs, tips-in-thread, reactions** — biggest; test thoroughly |

### Wave B — July 3 (3)
| 20260703010000 | profiles_email_table_grant | 💰🔐 | email visibility cross-org |
| 20260703020000 | profile_self_definer | | profile self-read |
| 20260703030000 | video_clips_continuity_score | | clip continuity field |

### Wave C — July 5 early · security / finance hardening "Phase 0" (9)
| 20260705000100 | org_pool_membership_authz | 💰🔐🌱 | **org credit pool spend by members** — finance; confirm not gated |
| 20260705000200 | profiles_sensitive_column_lockdown | 💰🔐 | email/credits not readable cross-user |
| 20260705000300 | rate_limit_counters | 🔐🆕 | (prereq for log-widget-event/newsletter rate limits) |
| 20260705000400 | **api_key_scopes** | 🔐 | **prereq for my api-key fix** |
| 20260705000500 | free_tier_atomic_reserve | 🔐 | free-tier generate |
| 20260705000600 | security_events_and_search_path | 🔐 | — |
| 20260705000700 | fix_notification_type_patron_lapsed | 💰 | patron lapse notification |
| 20260705000800 | fix_crews_rls_recursion | 🔐 | crews list (RLS recursion fix) |
| 20260705000900 | user_roles_profiles_fk | | admin role lookups |

### Wave D — July 5 late · authz + finance (6)
| 20260705012000 | ws_b_follow_unify | | follow/publish (memory: was applied out-of-band — may be idempotent no-op) |
| 20260705020000 | authz_subscription_account_type_immutable | 💰🔐 | account-type can't flip; sub authz |
| 20260705020100 | authz_webhook_workspace_integrations_admin_only | 🔐 | workspace integrations admin-gated |
| 20260705020200 | authz_login_attempts_self_read | 🔐 | login attempts self-read |
| 20260705020400 | notifications_self_delete_policy | 🔐 | delete own notification |
| 20260705020500 | update_profile_links_scheme_validation | 🔐 | profile links validation |
| 20260705021000 | org_refill_on_conflict_guard | 💰🔐 | **org refill** TOCTOU guard — finance; confirm not gated |

### Wave E — audit remediation (mine, 2)
| 20260706000000 | audit_remediation_money_rls | 💰🔐 | tips, pledges, org-plan PATCH, patron self-insert (deps already on prod) |
| 20260706000100 | restore_api_key_scopes | 🔐 | api-v1 per-key scopes (needs Wave C `000400`) |

## 4. Pre-apply checklist (either path)
1. **Snapshot/backup** prod (`supabase db dump` or a dashboard backup) — rollback insurance.
2. **Confirm gating**: explicitly verify the 💰 finance migrations in Waves C/D (`org_pool_membership_authz`, `org_refill_on_conflict_guard`, account-type immutability) are *meant* for prod now — these match the "gated finance backlog" note. If any are gated, you cannot do Path A as-is.
3. **Rehearse on a clone**: Supabase branch, or `db dump`→local→`db push`→run the smoke tests in §3.
4. **Apply in order**, watching for the `find_api_key_owner` interleave (Wave C `000400` ↔ already-applied `010300` ↔ my `000100`).
5. **Smoke-test money flows** post-apply: buy credits (Polar), tip in DM, pledge patron, org-pool spend, API key scoped call.
6. **Deploy edge fns** (`supabase functions deploy …` — `audit/10-FIXLOG.md` lists them) — independent of migrations.

## 5. Bottom line
- The drift, not my 2 migrations, is the real launch blocker — and it's a **deploy-owner decision** (which of the 32, especially the gated finance ones, go to prod) that I should not auto-execute.
- **Fastest safe win:** Path B (3 migrations via dashboard) gets the audit security/money fixes live without touching the gated backlog.
- **Correct long-term:** Path A on a rehearsed clone, after confirming the finance migrations aren't gated.
