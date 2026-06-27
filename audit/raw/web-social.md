# Web Audit — Social Graph + Creator Monetization

Branch `full-audit`. Read-only end-to-end trace (UI → hook → edge fn/RPC → table → back).
All paths under `/Users/briancole/Developer/genesis-full-audit`. Evidence is `file:line`.
This surface was a known blind spot from the first audit pass.

---

## 0. Route map (src/App.tsx) — what is real vs. a redirect stub

| Route | Resolves to | Status |
|---|---|---|
| `/c/:id` | `ProfileDashboard` in view-other mode (`App.tsx:771-775`) | REAL |
| `/c/:id/patron` | `PatronHubPage` (`App.tsx:776-781`) | REAL |
| `/c/:id/channel` | redirect to `..` (`App.tsx:783`) | retired |
| `/inbox` | `Inbox` (`App.tsx:455-459`); `/messages`,`/notifications` redirect into it (`:460-461`) | REAL |
| `/lobby` | `Lobby` (`App.tsx:810`) | REAL |
| `/crossover` | `Crossover` (`App.tsx:790-795`) | REAL (creation tool, not social) |
| `/search?tab=people` | `SearchHub` People tab | REAL (find-friends absorbed here) |
| `/creators`, `/discover/people`, `/find-friends` | → `/search?tab=people` (`App.tsx:758-760`) | redirect |
| `/crews`, `/crews/:id` | → `/search?tab=people` (`App.tsx:797-798`) | **RETIRED** |
| `/universes`, `/universe/:id`, `/universes/:id` | → `/lobby` (`App.tsx:706-708`) | **RETIRED** |
| `/market`, `/market/*` | → `/lobby` (`App.tsx:785-786`) | **RETIRED** |
| `/live`, `/live/*` | → `/lobby` (`App.tsx:764-765`) | retired |

**Area 4 verdict up front:** Crews, Universes, Market are not features — they are redirect stubs. Crossover is a real VFX prompt-builder (creation tool), not a social/crossover-graph feature. Details in §4.

---

## 1. FOLLOWS / SOCIAL GRAPH — mostly DONE

### Tables
- `public.follows` — `supabase/migrations/20260610230000_entertainment_hub.sql:125-138`. Cols `follower_id`,`followed_id`, PK `(follower_id,followed_id)`, `CHECK(follower_id<>followed_id)`.
- Legacy `public.user_follows` (`follower_id`,`following_id`) — `20260116132617_...sql:133-150` (kept as backstop).
- Unify migration `20260705012000_ws_b_follow_unify.sql` is committed: drops redundant notify triggers, keeps only `trg_notify_eh_follow`, backfills 11 historical `user_follows` rows into `follows` (`:20-30`). Header documents that `follows` was empty pre-fix because every `toggle_follow` insert rolled back on a `followee_id` bug.
- Bug fix `20260705010000_fix_follow_publish_followee_column.sql` recreates `fn_notify_eh_follow`/`fn_notify_reel_published` using the real `followed_id`. Replay order ends correct.

### Chain
- Write: RPC `toggle_follow(p_target)` — canonical at `20260613230000_settings_consumers.sql:43-91`. SECURITY DEFINER, REVOKE PUBLIC/anon + GRANT authenticated. Enforces auth, no self-follow, blocklist (`user_blocks`), and `followPermission='mutual_only'` → writes a `follow_requests` row instead.
- Hook `src/hooks/useSocial.ts:118-159` (`followUser`/`unfollowUser`) → `rpc('toggle_follow')`.
- Profile button `src/pages/Profile.tsx:231-251,598-610`; SearchHub People `src/pages/SearchHub.tsx:114-118,515-543`.
- Counts/lists `useSocial.ts:55-92` (column names correct). find-friends via view `find_friends_directory` (`20260613130000`).
- Follow → notification: single trigger `trg_notify_eh_follow` (`20260625000000_notifications.sql:410-412`, fn corrected by `20260705010000`).

**Ratings:** follow/unfollow **DONE**; profile + People-tab buttons **DONE**; counts **DONE**; follow→notif **DONE**; unification **DONE**.

### RLS gap (social-table, IMPORTANT)
- **`follows` allows direct client insert that bypasses the gated RPC.** Policy `"Users manage own follows" FOR ALL USING/WITH CHECK (follower_id = auth.uid())` (`entertainment_hub.sql:136-138`). A client can `supabase.from('follows').insert(...)` directly, skipping `toggle_follow`'s blocklist check and the `mutual_only` approval flow. Block/privacy guarantees live only in the RPC, not in RLS.

### Stale code (harmless, replay-superseded)
- Old `followee_id` references remain in `20260625000000_notifications.sql:392-404,457` (overwritten by the 20260705010000 hotfix).

---

## 2. NOTIFICATIONS & MESSAGING — DONE, with one open RLS hole

### notifications table
- `20260116132617_...sql:285-313`. ENUM `notification_type` defined `:285`; later `ADD VALUE` for `tip_received`,`patron_received` (`20260613240000_unified_inbox.sql:14-15`) and `atom_sale` (`20260705010100:18`). Table has `title`,`body`,`data jsonb`,`read` — so tip/pledge notification inserts (which write title/body/data) are column-correct.
- Layer migration `20260625000000_notifications.sql`: `link`,`actor_id`,`read_at` (`:47-50`); `notification_preferences` table+RLS (`:88-124`); `fn_notify_safe` swallow-guard (`:162-204`); fan-out triggers (`:209-538`); realtime publication (`:588-597`). `REPLICA IDENTITY FULL` for realtime DELETE (`20260703000001:33`).

### Bell + realtime — LIVE
- `src/hooks/useNotifications.ts`: list `:93-109`, unread count `:115-128`, realtime channel `notifications-<userId>` INSERT/UPDATE/DELETE `:174-245`, quiet-hours/toast bridge `:200-215`, optimistic mutations `:252-351`.
- `src/components/social/NotificationBell.tsx` full UI + deep-link resolver `:110-171`.
- **DONE (live).**

### Inbox + DMs — REAL (not a stub)
- `/inbox` `src/pages/Inbox.tsx` (2442 lines) over real RPCs in `20260613240000_unified_inbox.sql` (`inbox_overview`,`inbox_list_lane`,`set_thread_state`,`react_to_message`,`tip_in_thread`,`mark_lane_read`,`list_my_rooms`, etc.). Tables `dm_reactions`,`chat_rooms/_members/_messages`,`brand_inquiries`,`ai_video_reply_jobs` with RLS.
- DMs: `direct_messages` table+RLS `20260116132617_...sql:155-179`. Send RPC `send_direct_message` (SECURITY DEFINER, blocklist + `dmPermission` + length, inserts DM + `'message'` notification). Hook `useSocial.ts:279-303`; components `DirectMessagePanel.tsx`,`MessagesInbox.tsx`; realtime DM channel `useSocial.ts:240-274`.
- **DONE.**

### notify-org-event — by design NOT in-app
- `supabase/functions/notify-org-event/index.ts`: auth-gated `:11-20`, requires org admin `:43-46`, POSTs to Slack/Zapier webhook `:48-69`. **Does NOT write the notifications table** — outbound relay only. Not a stub.

### notification_preferences typing — PARTIAL (confirms first-pass flag)
- Untyped in `src/integrations/supabase/types.ts` (0 hits). `useNotifications.ts:140` casts `'notification_preferences' as never`, but `src/pages/account/NotificationSettings.tsx:111,156-157` accesses it **without** the cast → latent `tsc` drift. Functionally correct (`onConflict:'user_id'`).

### RLS gaps (social-table, IMPORTANT)
- **`notifications` INSERT is wide open** — `"System can create notifications" FOR INSERT WITH CHECK (true)` (`20260116132617_...sql:307-308`). Any authenticated user can forge `notifications` rows to arbitrary `user_id` (spam/phishing). The SECURITY-DEFINER triggers don't need this policy; should be service-role only.
- **`direct_messages` direct insert bypasses block/dmPermission** — `"Users can send messages" FOR INSERT WITH CHECK (auth.uid()=sender_id)` (`:169`). A client can insert a DM row directly, skipping `send_direct_message`'s blocklist + permission checks (a blocked user can still reach the recipient) and the notification side-effect.

### Stub / fragility
- **Duplicate live `send_direct_message` overloads** — 2-arg (`settings_consumers.sql:147`) never dropped when 5-arg added (`unified_inbox.sql:286`); divergent validation. Works only because each call site passes an exact param-set; risk of `PGRST203` ambiguity. (UNVERIFIED against live DB.)

---

## 3. CREATOR MONETIZATION — MONEY CORRECTNESS (rigorous)

This is the highest-risk section. The split is 90% creator / 10% platform throughout.

### 3a. The WIRED tip path = `tip_in_thread` — **MONEY BUG: not idempotent, no row lock**
- Caller: `src/pages/Inbox.tsx:812` `supabase.rpc("tip_in_thread", {p_recipient, p_amount, p_content})`. Frontend closes the dialog before await (`:810`) but has no in-flight server guard.
- RPC `20260705010100_fix_tip_atom_rpcs_dedupe_like_notif.sql` (the "#1" fix): debits tipper `-p_amount` `'tip_sent'`, credits creator 90% `'tip_received'`, inserts the DM with `tip_amount`, inserts notification. Column bug from a prior version (kind/meta) is fixed; money now moves.
- **Defects:**
  1. **No idempotency key** — `tip_in_thread` does NOT set `idempotency_key` (NULL). The partial unique index `20260705010800_tip_idempotency_unique_index.sql:9-10` only covers rows where `idempotency_key LIKE 'tip:%'`, so it does **not** protect this path. Double-click / network retry / double-tab = **double charge**.
  2. **No `FOR UPDATE` lock + cached-balance check** — reads `profiles.credits_balance` (cached) for the sufficiency check, not the ledger. Two concurrent tips both pass the check → **overdraft** (spend more than held).
- **Verdict: BROKEN (money-correctness).** Functionally moves money correctly on the happy path, but is double-charge/overdraft-vulnerable.

### 3b. The CORRECT tip RPC `tip_reel` is ORPHANED
- `tip_reel` (same migration) is fully hardened: per-minute idempotency key `tip:<reel>:<uid>:<minute>` with existence pre-check (`:returns idempotent_replay`), `FOR UPDATE` lock on both profiles, ledger-based available-balance check (total − holds), 90/10 split, earnings projection, notification.
- **But no frontend caller** — `grep tip_reel src` → only `types.ts:9916`. The good implementation is unused; the wired one (3a) is the weak one. (Per-minute key would also silently drop a legit 2nd tip in the same minute as `creator_received:0` — minor UX quirk.)

### 3c. Patron pledge `pledge_patron_tier` / `pledge_patron` — WIRED, **MONEY BUG: not idempotent, no row lock**
- Callers: `src/pages/PatronHubPage.tsx:200` and `src/pages/account/ProfileDashboard.tsx:4351` → `rpc('pledge_patron_tier', {p_creator_id, p_tier_id})`.
- `pledge_patron_tier` (`20260613170000_profile_super.sql:310-323`) resolves tier → `pledge_patron(creator, monthly_credits)`.
- `pledge_patron` (`20260613180000_pledge_patron_ledger.sql:7-94`): ledger-based balance check `:31-34`; upserts `patron_subscriptions` `:42-55`; debits payer `'patron_pledge'` `:58-64`; credits creator 90% `'patron_received'` `:68-72`.
- **Defects:** (1) **No idempotency** on the credit_transactions — the comment "Idempotent over (creator,patron)" refers only to the *subscription* upsert; double-clicking pledge inserts the debit/credit **twice** = double charge. (2) **No `FOR UPDATE` lock** between the balance check (`:31`) and the debit insert (`:58`) → concurrent-pledge overdraft race (TOCTOU). Contrast with `tip_reel`, which locks.
- **Verdict: BROKEN (money-correctness)** for the same double-charge/race reason as 3a.

### 3d. Earnings ledger projection — DONE (after fix)
- Trigger `trg_project_credit_event_to_earnings` is attached to `credit_transactions` (`20260612020000_stripe_connect_payouts.sql:145-146`).
- `project_credit_event_to_earnings` (`20260705010700_patron_income_to_earnings_ledger.sql`) projects `tip_received`/`atom_sale`/`patron_received` (amount>0) into `creator_earnings_ledger` with USD conversion via `creator_payout_config.credits_per_usd` (fallback 10). The 20260705010700 migration is the fix that added `patron_received → 'subscription'` so pledge income finally reaches the payout ledger (UI had been promising it).
- `creator_earnings_ledger` RLS: creator-reads-own (`20260612020000:81-86`). **DONE.**

### 3e. Withdraw / cash-out — **PARTIAL: accrual works, payout UNWIRED**
- Edge fn `supabase/functions/stripe-connect-payout/index.ts` is robust: auth-gated, verifies onboarding, **creates the payout row first then atomically claims unpaid rows via `UPDATE … WHERE payout_id IS NULL`**, deterministic Stripe idempotency key, fail-closed (`:1-60+`, documented H-4 fix). Good.
- **No frontend invokes it.** `grep 'stripe-connect-payout' src` = 0 callers. The Creator module `src/pages/account/SettingsDashboard.tsx:1596-1660` only reads `creator_earnings_ledger` (`:1605`, untyped `as never`) to display Lifetime/Pending, and wires the **onboard** button `stripe-connect-onboard` (`:1621`). There is **no Withdraw button** — only a "Connect Stripe / Manage in Stripe" button (`:1674-1681`). The 20260705010700 migration explicitly notes "the Withdraw button wiring … remains a FE/edge follow-up."
- **Verdict: PARTIAL** — creators can onboard and *see* pending USD but **cannot actually withdraw** through the app.

### 3f. Recurring patron billing — now scheduled
- `charge_patron_renewals()` (`20260613000000_patron_comments_messages.sql`) bills due pledges + advances `renewal_due_at`; was unscheduled until `20260705011000_schedule_org_refill_patron_renewals.sql:12-13` added the daily cron. So renewals now fire (idempotent per period via due-date advance). Money-correctness of the renewal charge itself NOT deep-traced here — flag UNVERIFIED for idempotency under concurrent cron + manual re-pledge.

### 3g. `buy_atom` (atom sale) — ORPHANED
- `buy_atom` exists and is hardened (`20260611200000_money_ledger_integrity.sql:128`), `atom_sale` notif enum added. No frontend caller (`grep buy_atom src` → only `types.ts:9339`). The atom marketplace is unused (matches the retired `/market`).

### 3h. Monetization-integrity RLS gap (IMPORTANT)
- **`patron_subscriptions` `FOR ALL USING/WITH CHECK (patron_id = auth.uid())`** (`20260610230000_entertainment_hub.sql:267-269`). A client can directly INSERT/UPDATE a `patron_subscriptions` row for themselves **without paying** (bypassing `pledge_patron`), granting patron-tier perks (patron-only posts/messages) for free. Paywall bypass.

**Money ratings:** tip (wired `tip_in_thread`) **BROKEN**; tip_reel (orphaned) DONE-but-unused; pledge **BROKEN**; earnings projection **DONE**; withdraw **PARTIAL**; renewals scheduled (UNVERIFIED idempotency); buy_atom ORPHANED.

---

## 4. CREWS / UNIVERSES / CROSSOVER / MARKET

### Crews — MISSING (correctly removed)
- No table/RPC/edge fn/component. Word survives only in unrelated AI prompt filters (`src/types/production-pipeline.ts:431,439,443`) and the live "Crew rooms" project-chat in `Inbox.tsx:2047,2087` (different feature, not the retired graph).

### Universes — MISSING feature / PARTIAL cleanup (orphaned leftovers)
- Routes redirect to `/lobby`; removal asserted by `src/test/regression/genesis-removal-regression.test.ts:56-90`.
- **Orphans still in tree:** `src/types/movie.ts:5` `interface Universe` (+ `universe_id` at `:19,33,85`); orphaned DB column+FK `published_reels.universe_id` (`published_reels_universe_id_fkey`, `src/integrations/supabase/types.ts:6110`) never written/read; migration `20260611010000_branches_search_universes.sql` still present; `gamification-event/index.ts:14` still awards `universe_joined` XP into `universes_joined` counter (`src/hooks/useGamification.ts:21`) — dead reward path.

### Market — route MISSING / PARTIAL doc-debt
- Routes redirect. But user-visible pages still advertise a non-existent marketplace and **reference Stripe** (provider is Polar): `src/pages/HelpDoc.tsx:88-93`, `src/pages/Help.tsx:132,166` ("Creators keep 90% of every tip, atom listing, and template sale. The 10% covers Stripe…"). Stale `market` labels in `src/lib/sectionTheme.ts:43`, `src/components/ui/error-boundary.tsx:28`.

### Crossover — REAL but PARTIAL (differentiators dropped)
- Browse: `Crossover.tsx:426` → `registry.ts:258` `rpc('crossover_browse')` → `vfx_templates` (50 seeded rows, `20260615000000_crossover_templates.sql:17,72-277`). RLS public-read live rows + admin-manage `:58-66`. **DONE / RLS OK.**
- Action: `Crossover.tsx:556-581` / `TemplateComposer.tsx:75-82` → `functions.invoke('mode-router', {…, crossoverTemplateSlug})`.
- **BROKEN wiring:** `supabase/functions/mode-router/index.ts:279-280` destructures the body and **omits `crossoverTemplateSlug`** (0 "crossover" hits in mode-router). Generation runs on the composed prompt only → no template attribution, no VFX recipe/model, no `use_count` increment.
- **BROKEN read path:** `20260616000000_crossover_vfx_upgrade.sql:19-22` populated `recipe_slug/preferred_model/target_height/...` but `crossover_browse` was never redefined to return them → `registry.ts` enrichment always gets `undefined` and defaults everything to `kling-v3`/hd-1080. Engine keys also mismatch (DB CHECK vs `registry.ts:91-99`). `vfx_templates.use_count` never incremented (always 0). Favorites are localStorage-only (`Crossover.tsx:133-163`, by design).
- **Verdict: PARTIAL** — renders + triggers a generic generation; every VFX differentiator the migrations built is dropped.

### Clan / Guild — fully absent (0 hits).

---

## 5. GAMIFICATION — BROKEN (backend complete, frontend dead)

- Edge fn `supabase/functions/gamification-event/index.ts`: JWT-guarded `:32-37`, rate-limited 100/hr `:53-57`, maps event→XP `:9-19`, calls `add_user_xp` `:70` and `update_user_streak` on `daily_login` `:82`. **Trusts client `event_type`** (self-noted weakness `:49-52`).
- Tables/RPCs real + RLS present: `add_user_xp`/`update_user_streak` (`20260516142227…:92,132`, SECURITY DEFINER, `auth.uid()<>p_user_id` guard, streak milestones, level-up notif); `user_gamification`; `achievements`/`user_achievements` (`20260116132617…:36-90`); `leaderboard` view.
- **Orphaned from frontend:** `grep functions.invoke('gamification…')` in src = 0; `useGamification.ts:171-200` `addXp`/`updateStreak` never called; `UserStatsBar.tsx` consumes the hook but is never rendered (`grep '<UserStatsBar'` = 0, only re-exported `src/components/social/index.ts:7`); **no code anywhere awards achievements** (`grep award_achievement|insert…user_achievements` = 0) → `user_achievements` never populated.
- Security note (low, cosmetic): `add_user_xp`/`update_user_streak` still EXECUTE-granted to `authenticated`; guard only blocks granting XP to *another* user, so a client could self-grant unlimited XP via direct RPC. Only matters if leaderboard is surfaced.
- **Verdict: BROKEN (dead subsystem)** — RLS-sound, never written through a live path, never displayed.

---

## 6. LOBBY / FEED PUBLISHING — PARTIAL (publish DONE, block-enforcement BROKEN on main feed)

### Publish — DONE, well-secured
- `src/pages/Editor/components/ExportPanel.tsx:56` / `src/components/publish/PublishWizard.tsx` → `src/hooks/useReelPublisher.ts:29` `rpc('publish_reel')`.
- `publish_reel` (`20260610230000_entertainment_hub.sql:321`) inserts `published_reels` `:361`. No INSERT RLS policy — only the SECURITY-DEFINER RPC can write (`20260611190000_security_lockdown.sql:221-244`); EXECUTE revoked anon / granted authenticated. Publish notification trigger `20260625000000_notifications.sql:493-495`. **DONE.**

### Feed load + block enforcement — BROKEN (IMPORTANT, social-RLS bypass)
- The block-enforcement fix lives only in the `lobby_feed` SECURITY-DEFINER RPC, which excludes reels in a `user_blocks` relationship (`20260705010900_lobby_feed_block_enforcement.sql:27-31`).
- **But `src/pages/Lobby.tsx:127-131` does NOT call `lobby_feed`** — it queries `published_reels` directly with only `.eq("is_taken_down", false)`, hitting the public SELECT policy `"Public reels readable" … USING (NOT is_taken_down)` (`entertainment_hub.sql:86-87`) which has **no `user_blocks` filter**.
- **Result:** a blocked creator's reels still appear in the main Lobby feed — exactly the leak the migration claims to close. Only `src/pages/WorldDetail.tsx:71` uses `lobby_feed` and gets enforcement. The direct query also re-implements the decoration client-side (`Lobby.tsx:139-156`), drifting from the RPC.
- Swallowed errors in Lobby: presence `catch{}` `:107`, daily-prompt `catch{}` `:175`, challenges `catch{}` `:187`, feed `console.warn`-only `:160-163`.

### mint-project-share — DONE but ORPHANED edge fn
- `supabase/functions/mint-project-share/index.ts` — owner-scoped, idempotent, mints `/p/{slug}` for the **public-share** viewer (`src/pages/PublicShare.tsx`), NOT the lobby feed. **No frontend caller** invokes `mint-project-share`/`mint_project_share_slug` (`grep` in src = 0). Orphaned.

**Verdict: PARTIAL.** Publish DONE; block enforcement BROKEN on the main feed; mint-project-share orphaned.

---

## TALLY

| Area | Rating |
|---|---|
| Follow / unfollow / counts / find-friends | **DONE** |
| Follow → notification | **DONE** |
| Notifications bell + realtime | **DONE** |
| Inbox + Direct Messages | **DONE** |
| notify-org-event (Slack/Zapier relay) | DONE (not in-app, by design) |
| notification_preferences typing | **PARTIAL** (untyped, tsc drift) |
| Tip (wired `tip_in_thread`) | **BROKEN** (no idempotency / no lock → double-charge, overdraft) |
| `tip_reel` (hardened) | DONE but ORPHANED (unused) |
| Patron pledge (`pledge_patron`) | **BROKEN** (no idempotency / no lock → double-charge, overdraft) |
| Earnings ledger projection | **DONE** |
| Withdraw / cash-out (stripe-connect-payout) | **PARTIAL** (accrues, no UI to withdraw) |
| Patron renewals cron | DONE/scheduled (idempotency UNVERIFIED) |
| buy_atom / atom marketplace | ORPHANED (unused) |
| Crews | MISSING (retired) |
| Universes | MISSING (PARTIAL cleanup: orphan column + dead types) |
| Market | MISSING route (PARTIAL: stale Stripe/marketplace promises shown) |
| Crossover | **PARTIAL** (browse works; template/VFX metadata dropped at mode-router + browse RPC) |
| Gamification (XP/streaks/achievements) | **BROKEN** (backend complete, frontend dead) |
| Lobby publish | **DONE** |
| Lobby feed block enforcement | **BROKEN** (direct query bypasses `lobby_feed` RPC) |
| mint-project-share | DONE but ORPHANED |

Rough counts — DONE: 9 · PARTIAL: 4 · BROKEN: 4 · MISSING/retired: 3 (+ several orphaned-but-present).

---

## TOP RISKS

### Money (highest priority)
1. **Wired tip (`tip_in_thread`) has NO idempotency and NO row lock** (`20260705010100`, called `Inbox.tsx:812`). Double-click/retry/two-tabs = **real double charge**; concurrent tips can **overdraft** (cached-balance check, no `FOR UPDATE`). The hardened, idempotent `tip_reel` is the one that is *not* wired — the safety was built on the wrong RPC.
2. **Patron pledge (`pledge_patron`) has the same flaw** (`20260613180000:7-94`, called `PatronHubPage.tsx:200`, `ProfileDashboard.tsx:4351`): non-idempotent credit_transactions + no lock between balance check and debit → double-charge + overdraft race. Recurring billing now cron-scheduled, magnifying exposure.
3. **Creators cannot withdraw.** Earnings accrue to `creator_earnings_ledger` and the robust `stripe-connect-payout` edge fn exists, but **no UI invokes it** (`SettingsDashboard.tsx:1596-1681` only onboards). The 90/10 payout promise (also wrongly attributed to "Stripe" in Help copy) is undeliverable through the app today.

### RLS / paywall integrity
4. **`notifications` INSERT `WITH CHECK (true)`** (`20260116132617:307-308`) — any authed user can forge notifications to anyone (phishing/spam).
5. **`patron_subscriptions FOR ALL` self-managed** (`entertainment_hub.sql:267-269`) — a user can self-insert a subscription row **without paying** → free patron-tier perks (paywall bypass).
6. **`follows` and `direct_messages` direct-insert bypass their gated RPCs** (`entertainment_hub.sql:136-138`; `20260116132617:169`) — defeats blocklist + permission enforcement, which live only in the RPCs.
7. **Lobby main feed ignores block enforcement** (`Lobby.tsx:127-131` bypasses `lobby_feed`) — blocked creators' reels still shown to the user who blocked them.

### UNVERIFIED
- Live-DB presence of the duplicate `send_direct_message` 2-arg overload (PostgREST disambiguation).
- `charge_patron_renewals` idempotency under concurrent cron + manual re-pledge.
- `find_friends_directory` exact column projection vs `20260620010000_search_no_email` (email-leak check).
