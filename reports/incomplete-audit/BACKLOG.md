# Small Bridges — Incomplete / Broken / Missed-Promise Backlog

> Audit date: 2026-06-25 · branch `origin/main` @ `42970cfc` · 6 parallel hunters, all findings grep-verified.
> Scope: **broken workflows, incomplete dev, and promised-but-undelivered features** — NOT the correctness bugs from the earlier hunt (those shipped in PRs #73–#79) and NOT the security fixes (PRs #74–#76).
> Intentional non-issues excluded: Enterprise coming-soon page, unused payment-provider stubs (LemonSqueezy/Paddle), account-type mutual-exclusivity.

Legend — **Type**: 🔴 Broken (throws/dead-ends at runtime) · 🟠 Incomplete (half-built) · 🟣 Missed promise (UI promises it, backend doesn't deliver) · ⚪ Orphaned (built, never wired).

---

## P0 — Money is broken (revenue-blocking, user hits a failure)

- [ ] **1. 🔴 DM tip throws at the DB.** `tip_in_thread` inserts `credit_transactions(kind, meta)` — columns don't exist (it's `transaction_type` NOT NULL + `metadata`). Every "tip" in the Inbox fails. `migrations/20260613240000_unified_inbox.sql:361` ← `src/pages/Inbox.tsx:812`. **Fix:** rewrite inserts to match `tip_reel`'s correct schema.
- [ ] **2. 🔴 Org credit pool is structurally unfunded → business generation fails `insufficient_credits` forever.** Consumption was switched to `organizations.credits_balance` (`migrations/20260704000700`) but **nothing deposits into it**: (a) monthly refill never scheduled (`monthly-credit-refill` has no cron); (b) Polar webhook credits the buyer's *personal* wallet, never `topup_org_credits` (`functions/polar-webhook/index.ts:70`); (c) self-serve onboarding sets a plan but creates no subscription (`src/pages/BusinessStart.tsx:319`). **Fix:** fund the pool on subscription activation + schedule the refill.
- [ ] **3. ⚪ Creators can connect Stripe but can never withdraw.** `stripe-connect-payout` (complete impl) is invoked from nowhere; UI only does onboarding. Earnings accrue, display, and are unwithdrawable despite "Payouts arrive on your Stripe schedule." `functions/stripe-connect-payout/` ← (no caller); UI `SettingsDashboard.tsx:1660`. **Fix:** add a Withdraw action / auto-payout job.
- [ ] **4. 🔴 Patron subscriptions never renew.** `charge_patron_renewals` has no cron/edge/caller — "monthly" pledges bill once, never again. `migrations/20260613000000_patron_comments_messages.sql:130`. **Fix:** schedule it.
- [ ] **5. 🟣 Patron pledge income never becomes withdrawable USD.** Earnings trigger fires only for `tip_received`/`atom_sale`; `pledge_patron` writes `patron_received`, so pledges never hit `creator_earnings_ledger` — contradicting the UI. `migrations/20260612020000_stripe_connect_payouts.sql:122`. **Fix:** add `patron_received` to the trigger (or fix copy).
- [ ] **6. 🟣 Auto-recharge is a dead toggle.** Saves `auto_recharge_enabled`, promises "we'll automatically add 250 credits," but **no processor exists** — balance can hit zero with it "on." `SettingsDashboard.tsx:1886`. **Fix:** balance-watch job that charges Polar.

## P0 — Core creative workflow broken

- [ ] **7. 🟠 Editor "Approve & Render" is entirely non-functional.** `installJobRunner` has zero app callers → `isRunnerInstalled()` always false → every per-shot render CTA shows "Rendering coming soon." Cascades to **#8, render queue (#27), CrossoverComposer VFX**. `src/lib/editor/generation/orchestrator.ts:285`. **Fix:** install a runner that submits to `editor-generate-clip` + poller. *(Highest leverage — unblocks 3 features at once.)*
- [ ] **8. 🔴 Regenerate-take always 400s.** `TakesDrawer` invokes `editor-generate-clip` with no `action` field (fn dispatches on `action` → "Invalid action"), and appends an optimistic take with no poller. `src/pages/Editor/components/TakesDrawer.tsx:207`. **Fix:** send `action:"submit"` + poll `action:"status"`.
- [ ] **9. 🔴 Pipeline recovery net is dead → projects stranded on a lost webhook.** `pipeline-watchdog` cron was unscheduled (`migrations/20260516045913`) and never re-added; `production-audit`/`admin-stuck-jobs-watchdog` are never invoked. Only backstop is client-side `useClipRecovery` (needs the tab open). **Fix:** re-add a pg_cron schedule hitting the watchdog.
- [ ] **10. 🔴 Business API keys can never authenticate.** `BusinessApi` mints keys into `org_api_keys`, but the gateway `api-v1` only checks `api_keys` via `find_api_key_owner`. Every business-key call → 401. `src/pages/business/BusinessApi.tsx:144`. **Fix:** point gateway at `org_api_keys` or mint into `api_keys`.
- [ ] **11. 🔴 The `editor` org role bricks any member assigned it.** `editor` is assignable but `has_org_permission` / `fn_org_has_min_role` have no `editor` branch → return NULL → every RLS/RPC check denies. `src/pages/business/BusinessTeam.tsx:283`. **Fix:** add the branch (or remove `editor` from assignable set).

## P1 — Missing backend (frontend calls something that doesn't exist)

- [ ] **12. 🔴 `get_daily_prompt_with_submissions` RPC missing** → Lobby daily-prompt feature permanently empty (fails silently, `as never`-cast). `src/pages/Lobby.tsx:173`. **Fix:** ship the migration.
- [ ] **13. 🟠 `increment_template_use_count` RPC missing** → errors on every template use, silently falls back (use-count never atomic). `src/pages/Templates.tsx:754`.
- [ ] **14. 🔴 DirectorChat invokes non-existent `director-chat` fn** → AI half of the editor chat 404s into a swallowed error. `src/pages/Editor/components/DirectorChat.tsx:348`. **Fix:** point at the real (also-orphaned) `editor-ai-scene`.

## P1 — Whole features shipped as backend-only scaffolding (missed promises)

- [ ] **15. 🟣 Patron-gated content has no UI.** `creator_posts` + `list_creator_posts` exist but are referenced nowhere in `src/`; `PatronHubPage` only pledges. Patrons pay, nothing to consume; creators can't publish. **Fix:** build composer + gated feed viewer.
- [ ] **16. ⚪ Atoms marketplace has no UI.** `buy_atom`/`create_atom_listing`/`atom_listings` referenced nowhere. No list/buy/sell flow. **Fix:** build marketplace UI.
- [ ] **17. ⚪ Premieres = unreachable backend scaffolding whose loop can't close.** `schedule_premiere`/`rsvp_premiere`/etc. zero `src/` refs; **nothing transitions `scheduled`→`live`→`ended`**; `premiere-recap` hard-gates on `ended` so can never return. `migrations/20260611230000_premieres.sql`. **Fix:** build client + a status-transition mechanism, or delete the schema.
- [ ] **18. 🟠 Watch-party lifecycle half-built.** Realtime playback sync IS real, but status never goes `live`, `p_invitee_ids` hardcoded `[]` (no invite UI), UI claims "Party live." `src/components/theater/WatchParty.tsx`, `src/pages/Reel.tsx:505`.
- [ ] **19. 🟣 Webhooks promised across the Developer surface, no registration UI.** "Register a webhook URL" step exists; only API-key CRUD is wired (`webhook-dispatch` fn exists, unreachable). `src/pages/Developers.tsx:327`. **Fix:** webhook-endpoint CRUD UI.
- [ ] **20. ⚪ Cinema billing-management UI missing.** `create-cinema-checkout` wired, but `verify-cinema-checkout`/`list-cinema-invoices`/`get-cinema-pending-change` have no frontend — users buy but can't manage. **Fix:** billing-management surface.
- [ ] **21. ⚪ AI widget-builder has no authoring UI.** `generate-widget-config` (complete) invoked nowhere; render side is wired. `functions/generate-widget-config/`.

## P1 — Moderation & safety gaps

- [ ] **22. ⚪ `user_reports` is a write-only black hole.** Filed correctly, but no admin SELECT/UPDATE RLS, no notification, and the moderation UI is tree-shaken from prod (`ADMIN_ENABLED=false`). Reports accumulate, nobody can action them. `ProfileDashboard.tsx:5003`. **Fix:** admin queue on the admin subdomain + insert-time alert.
- [ ] **23. 🟣 Block enforcement only covers DMs + follows.** Migration promises "A never sees B in feeds/search," but `lobby_feed`, `search_everything`, and all like/comment/reaction policies ignore blocks. `migrations/20260613160000_block_report.sql`. **Fix:** apply block filter server-side across feed/search/social writes.
- [ ] **24. 🟠 Private-account follow approval is bypassable.** The approval gate lives only in `toggle_follow`; the legacy raw `user_follows` insert path (Search/profile cards) skips it. `src/hooks/useSocial.ts:118`. **Fix:** route all follows through `toggle_follow` (see #26).
- [ ] **25. ⚪ `approve-clip-one` has no caller** → if a clip-approval step exists, clips can never be approved in prod. **Fix:** wire or remove.

## P1 — Data integrity / split-brain (corrupts state users touch today)

- [ ] **26. 🔴 Follow is split across two tables that never sync.** `toggle_follow`→`follows` (canonical) vs raw `user_follows` (Search/public-profile). Button state + follower counts disagree; duplicate rows. `useSocial.ts:118`, `usePublicProfile.ts:144`. **Fix:** standardize on `follows`, migrate rows.
- [ ] **27. 🔴 Two disjoint comment threads per reel.** Theater uses `reel_comments`; `/r/:id` uses `project_comments`. Comments in one never appear in the other. `Lobby.tsx:433` vs `Reel.tsx:782`. **Fix:** unify on one.
- [ ] **28. 🔴 Inbox lane taxonomy fork.** New triggers emit bare types (`comment`/`like`/`follow`/`system`); lanes filter reel types (`reel_comment`/…). Comments never land in the Comments lane; duplicates observed. `migrations/20260625000000_notifications.sql` vs `20260613240000_unified_inbox.sql`. **Fix:** unify taxonomy.
- [ ] **29. 🔴 `premiere_scheduled` & `watch_party_invite` enum values never registered** → fan-out notifications fail silently (wrapped in `EXCEPTION WHEN OTHERS`). **Fix:** `ALTER TYPE notification_type ADD VALUE`.
- [ ] **30. ⚪ Brand kit vs Assets = two disconnected storage systems.** `workspace-brand`/`workspace_brand_assets` vs `brand-assets`/`organization_brand_assets`. A logo in one never appears in the other. `BusinessBrand.tsx:348` vs `BusinessAssets.tsx:128`.

## P2 — Notifications / preferences that don't fire or aren't honored

- [ ] **31. 🟠 Bell shows no icon/deep-link for most generated types** (`tip_received`, `follow_request`, `patron_received`, `reel_comment`, `brand_inquiry`, …); even AI-reply `message` doesn't deep-link to the thread. `useNotifications.ts`, `NotificationBell.tsx`.
- [ ] **32. 🟣 `ch_email` channel preference is a no-op** — column exists, no email path reads it. `NotificationSettings.tsx:87`.
- [ ] **33. ⚪ `reel_reactions` table + its notifier are orphaned** (real likes go through `reel_likes`). Dead trigger. `migrations/.../notifications.sql:294`.
- [ ] **34. ⚪ `fn_notify_tip_received` defined but never attached** to a trigger. `unified_inbox.sql:230`.
- [ ] **35. 🟠 AI-video-reply worker has no cron sweeper** — only pg_net nudges drive it; a lost nudge stalls jobs forever. `functions/process-ai-video-replies/`.

## P2 — Team / business workflow gaps

- [ ] **36. 🟣 Team invites send no email** — both surfaces just insert a row + copy a link; no `org_invite` template/dispatcher exists. `BusinessTeam.tsx:117`, `BusinessStart.tsx:338`.
- [ ] **37. 🔴 Accept-invite "member joined" email has no recipients** — reads `profiles.email` which was revoked from `authenticated` → `[]`. `src/pages/AcceptInvite.tsx:66`. **Fix:** route through `org_member_directory` RPC.
- [ ] **38. 🟣 Google Drive / Notion integrations are inert** — OAuth connects + marks `active`, but no sync worker writes to Drive/Notion; "Synced X ago" is fake. `BusinessIntegrations.tsx:348`. *(Slack/Zapier ARE wired.)*
- [ ] **39. 🟠 YouTube & LinkedIn distribution can't post** — `publish()` are stubs returning `pending_credentials`; jobs park forever. `_shared/distribution-providers.ts:176`. *(Meta/TikTok wired but unverified for prod.)*
- [ ] **40. 🟠 Templates store nothing / can't be launched** — `create()` hardcodes `config:{}`, no apply path, `use_count` never increments. `BusinessTemplates.tsx:64`.
- [ ] **41. 🟣 Permissions matrix is cosmetic** (static constant enforcing nothing) and drops `editor`. `BusinessPermissions.tsx:17`.

## P2 — Editor incompleteness

- [ ] **42. 🟠 Editor never loads real scene metadata** — `genesis_scenes` query hard-capped `.limit(0)` → always a single synthesized anchor scene. `src/hooks/editor/useProject.ts:133`.
- [ ] **43. 🟠 AudioMixer A1/A2 strips are dead + mixer state not persisted** (resets to 1.0 on reload). `AudioMixer.tsx`.
- [ ] **44. 🟣 Final-video player can't play a `.json` manifest URL** — renders an unplayable "Video Complete" card (legacy/manifest projects only). `BrandedVideoPlayer.tsx:273`.
- [ ] **45. 🟣 Multi-clip "Download" fires N separate downloads** (browsers block → only first lands). A real ZIP/merge path exists but isn't used here. `ProductionFinalVideo.tsx:38`.
- [ ] **46. 🟠 Block-level script editing is unreachable** — `doc` beats never emitted, so inline edit affordances are dead. `src/pages/Editor/views/Script.tsx:285`.
- [ ] **47. 🟣 VersionsPanel is session-only** — reads in-memory undo stack, no DB; list vanishes on reload. `VersionsPanel.tsx:42`.
- [ ] **48. 🟠 DM composer can't create reel-anchored / attachment messages** (receive-only; `p_reel_id:null`, `p_attachments:[]`). `Inbox.tsx:785`.

## P2 — Auth / account gaps

- [ ] **49. 🟣 OAuth promised in Auth header but removed** — zero OAuth buttons; the live SecurityModule's "Link google/github/apple" buttons will error (no providers). `Auth.tsx:6`, `SettingsDashboard.tsx:1995`.
- [ ] **50. 🟠 Password change has no current-password re-auth** (security gap). `SettingsDashboard.tsx:2215`.
- [ ] **51. 🟠 "Active sessions" is cosmetic** — single hardcoded "This device" row, no enumeration. `SettingsDashboard.tsx:2043`.
- [ ] **52. 🟠 `defaultQualityTier` preference is write-only** — never read by the pipeline (every other pref is consumed). `SettingsDashboard` preferences.
- [ ] **53. ⚪ `signInWithMagicLink` capability orphaned** — exposed in AuthContext, no UI calls it. `AuthContext.tsx:718`.

## P3 — Orphaned / dead code (cleanup & de-risk)

- [ ] **54. ⚪ Entire legacy settings tree is dead** — `/settings` redirects to `/account`; `src/pages/Settings.tsx` + `src/components/settings/*` (Account/Security/Notification/Preferences/Billing/Referrals) never rendered. *(Some of the earlier "23 account fixes" landed here, unseen.)* **Fix:** delete or document.
- [ ] **55. 🔴 Deactivate-account button is a no-op loop** (in the dead settings tree — `/settings/deactivate`→redirect→back). Live deactivate works; flag so it isn't revived broken. `AccountSettings.tsx:558`.
- [ ] **56. ⚪ ~18 orphaned edge functions** (zero callers): `landing-preview`/`landing-stats`/`landing-demo-chat`/`hoppy-chat`, `free-tier-generate`, `brand-video-download`, `director-card`, `editor-ai-scene`, `premiere-recap`, `elevenlabs-music`/`elevenlabs-sfx`, `mint-project-share`, `generate-project-trailer`, `send-push-notification`, `svg-rasterize`, `continuity-audit`, `comprehensive-clip-validator`, `generate-hls-playlist`/`fix-manifest-audio`. **Triage:** wire or delete. *(Verify `generate-character-for-scene`/`scene-character-analyzer`/`render-video`/`regenerate-audio` aren't dynamic pipeline-dispatch targets before deleting.)*
- [ ] **57. ⚪ ~9 orphaned components**: `PremiumVideoCard`, `GalleryHeroSection`, `PremiumFullscreenPlayer`, `ProjectFilters`, `B2BHero`, `HowItWorksSection`, `PricingSection`, `premium-toast`, `EditorialAtmosphere/Chrome`. Likely a superseded landing variant.
- [ ] **58. ⚪ Orphaned client libs**: `AtomicFrameSwitch.ts` (601 ln, no importers), `renderQueue.ts` (#7), `demoProject.ts` + `/editor/demo` (no route/CTA targets it).
- [ ] **59. 🟠 `types.ts` ~2,800-line drift** hidden behind ~40 `as never` casts — masks genuinely-missing RPCs (#12, #13) as if they were drift. **Fix:** regenerate `types.ts`.

## P3 — Smaller / cosmetic

- [ ] **60. Ad Studio "Send to Create" drops the music flag** — `enableMusic:true` lost to `useState(false)`. `BusinessAdStudio.tsx:198`.
- [ ] **61. Any `admin` can promote peers (or self via 2nd account) to `owner`** — only last-owner demotion is protected. `BusinessTeam.tsx:285`.
- [ ] **62. Member credit-cap uses native `window.prompt`** — violates the confirm-dialog standard. `BusinessTeam.tsx:164`.
- [ ] **63. Production progress motion is partly simulated** (in-flight ramps + 85→95% stitch crawl driven by a setInterval, not real backend progress). Cosmetic. `Production.tsx:1305`.
- [ ] **64. @mention autocomplete missing** in all comment composers (trigger/notif exist; composers are plain textareas).
- [ ] **65. Studio "Theater" nav points to a removed mode** (`/library?mode=theater`). `Studio.tsx:167`.

---

### Highest-leverage sequencing
1. **#7** (install render runner) — unblocks the editor render path, #8, #27-equivalent, CrossoverComposer in one move.
2. **#2** (fund org pool) — unblocks all business generation.
3. **#1 / #4 / #3 / #6** — the money paths that visibly fail.
4. **#9** (watchdog cron) — stops projects stranding.
5. **#26 / #27 / #28** — stop corrupting social state daily.
6. **#22 / #23** — moderation & blocking actually work.

---
---

# DEEP PASS 2 — Runtime bugs, failure modes, security & data-integrity holes
> Added 2026-06-25 · 8 parallel hunters, different lenses (idempotency, RLS, pipeline state-machine, frontend races, mobile/a11y, migration integrity, email/cron, finance). New items numbered **D#**. Several are **live, verified against the prod DB.**

## 🔥 LIVE SHOWSTOPPERS — broken in production RIGHT NOW (verified against prod)

- [ ] **D1. 🔴 Following anyone + publishing a reel both roll back.** `public.follows` column is `followed_id`, but the live trigger fn `fn_notify_eh_follow` (and `fn_notify_reel_published`) reference **`NEW.followee_id`** — a non-existent column — *unguarded* (before the safe-notify wrapper). **VERIFIED:** migration `20260625000000` is in prod `schema_migrations`; both live fns have the bad ref; `trg_notify_eh_follow` is `AFTER INSERT ON follows`; `follows` has no `followee_id` column. Every `toggle_follow` insert and every `published_reels` insert raises `undefined_column` → **rolls back**. `migrations/20260625000000_notifications.sql:392,396,457`. **Fix (trivial hotfix):** `followee_id`→`followed_id` in both functions.
- [ ] **D2. 🔴 Every reel tip rolls back.** `tip_reel` inserts a notification with `type='tip'` — **`'tip'` was never added to the `notification_type` enum** (valid value is `tip_received`). Unguarded insert after the ledger transfer → whole RPC rolls back. `migrations/20260611200000_money_ledger_integrity.sql:109`. **Fix:** use `'tip_received'`.
- [ ] **D3. 🔴 Every atom purchase rolls back.** `buy_atom` inserts a notification with `type='atom_sale'` — **never added to the enum** → unguarded → entire purchase rolls back. `migrations/20260611200000:220`. **Fix:** `ADD VALUE 'atom_sale'` (or use an existing type). *(Marketplace has no UI yet — #16 — so latent until that ships, but the RPC is broken.)*

## P0 — Pipeline credit-loss / double-charge / stuck-state (the heaviest cluster — 21 findings)
The hold-model happy path is correct; these are the escape hatches. Top items:
- [ ] **D4. 🔴 Avatar+Seedance renders are charged TWICE** on every success — mode-router debits, then routes to seedance-pipeline without `skipCreditDeduction`, which reserves+consumes its own hold. `mode-router/index.ts:378,492` → `seedance-pipeline/index.ts:457`.
- [ ] **D5. 🔴 Resume re-charges OR hard-locks paid projects.** resume-pipeline checks `transaction_type='generation'` — a string **nothing writes** (real value is `'usage'`) → always re-enters the charge block → double-charge, or 402 "insufficient credits" on an already-consumed hold (project can never resume). `resume-pipeline/index.ts:261`.
- [ ] **D6. 🔴 Double-stitch race → two paid FFmpeg renders.** No atomic claim before stitch; continue-production / final-assembly / auto-stitch-trigger use three different "done" definitions, none locks. A re-delivered last-clip webhook or webhook-vs-watchdog race submits two billable renders. `continue-production/index.ts:141`, `final-assembly/index.ts:153`, `auto-stitch-trigger/index.ts:212`. **Fix:** atomic `UPDATE…SET status='stitching' WHERE status<>'stitching' RETURNING id`.
- [ ] **D7. 🔴 Hollywood success block raw `refund_credits` GIVES credits away** — under the hold model nothing was debited, so the refund mints free credits whenever clip-0 dispatch fails (routine 429s). `hollywood-pipeline/index.ts:6369`. (Underlying engine: **D8. `refund_credits` is hold-blind** — credits regardless of whether a charge happened. `migrations/20260704001500:45`.)
- [ ] **D9. 🔴 Charged-but-no-video, no refund, project stuck `generating` forever:** mode-router debit never refunded on downstream throw (also trips the single-active-project guard → user locked out); partial clip set (4/6) stitched + charged in full; mid-clip failure stops the chain; stitch failure never refunds/releases hold; clip-0 creation consumes the *entire* project hold. `mode-router/index.ts:492`, `final-assembly/index.ts:121,342`, `continue-production/index.ts:141`, `generate-single-clip/index.ts:1715`.
- [ ] **D10. 🟠 Reconciler blind spots + orphaned predictions:** `reconcile_pipeline_credit_holds` ignores `processing/pending/rendering/stitching` and unlinked holds; cancel-project never releases the hold; prediction IDs persisted *after* the billable Replicate call (crash = orphan); refund rows lack idempotency keys (double-refund on cancel/watchdog overlap). `migrations/20260518165621`, `cancel-project/index.ts:271`, `generate-single-clip/index.ts:1654`.
- [ ] **D11. 🟠 hollywood references two un-imported helpers** (`isTemporaryReplicateUrl`, `persistVideoToStorage`) → throws *after* stitching → false "failed" on a rendered video + orphaned MP4. `hollywood-pipeline/index.ts:5061,6311`.
- [ ] **D12. ⚠️ Watchdog (currently unscheduled #9) ships money bugs the moment it's turned on:** raw `increment_credits` double-credit + frozen balance, "no clips"→failed-no-refund, happy-path never consumes hold, `expectedClipCount` default 6 → re-fire loop. Fix BEFORE scheduling. `pipeline-watchdog/index.ts:1434,3247,1309,2429`.

## P0 — Finance correctness (separate from pipeline)
- [ ] **D13. 🔴 Beta 100-free-credit grant is still live & farmable.** "Remove signup credits" only zeroed `handle_new_user`; the separate `trg_grant_beta_starter_credits` trigger still grants +100/profile. New email = 100 spendable credits, repeat. `migrations/20260610021553:64`. **Fix:** drop the trigger.
- [ ] **D14. 🔴 Photo-edit credit idempotency is inert → double-charge / double-refund.** edit-photo/inpaint-photo/api-v1 pass `idempotency_key` but no `project_id`; the dedupe + unique index require BOTH → guard never applies. Plus api-v1 `/photo-edit` charges 2 then edit-photo charges 2 again (4 total). `edit-photo/index.ts:158`, `api-v1/index.ts:233`.
- [ ] **D15. 🔴 api-v1 refund calls non-existent param `p_reason`** → API users charged for failed generations, never refunded (error swallowed). `api-v1/index.ts:246`. **Fix:** `p_description` + project_id + check error.
- [ ] **D16. 🟠 `tip_reel` TOCTOU** — existence + balance checks run before the `FOR UPDATE` lock and no unique index covers `tip:%` keys → concurrent double-tip double-charges. `migrations/20260611200000:54`.
- [ ] **D17. 🟠 PaymentsProvider default is `"stripe"`** (live is Polar) — if a Cloudflare build loses the env var, all CTAs silently route to the dormant Stripe stack. `src/lib/payments/index.ts:54`. Cinema `invoice.paid` swallows grant errors (Stripe path, dormant).

## P0 — Email system may be entirely non-functional
- [ ] **D18. 🔴 The email-queue dequeuer is not scheduled in the repo.** `auth-email-hook`/`send-transactional-email` only ENQUEUE to pgmq; `process-email-queue` is the only dequeuer and its schedule is a "post-migration step" via an external tool, **not in any migration**. If it isn't running, **every email (password reset, magic link, verify, all transactional) enqueues forever and silently never sends.** ⚠️ Verify in prod immediately. `migrations/20260503013930_email_infra.sql:285`.
- [ ] **D19. 🔴 Transactional emails use wrong field `template` → silent 400, never send:** render-complete ("your video is ready"), org_member_joined, org_role_changed, low_credits, org_credits_low all send `template:` but the fn reads only `templateName`. `send-transactional-email/index.ts:101` + 5 call sites.
- [ ] **D20. 🟠 Admin alert emails POST to a STALE project URL** (`ahlikyhgcqvrdvbtkghh` vs live `ywcwaumozoejierlfkgj`) → admins get NO signup/purchase/support/inquiry alerts (error swallowed). `migrations/20260516210837:12`.
- [ ] **D21. 🟠 Bounce/complaint suppression still wired to Lovable, not Resend** → Resend webhooks fail signature (401), suppression list never grows → keeps emailing dead addresses (reputation damage). `handle-email-suppression/index.ts:2`. Also `email_change_notice` security email has no template + wrong fields (#D19 pattern).
- [ ] **D22. 🟠 Cron coverage gaps (definitive):** only 4 crons exist in repo. NOT scheduled: `process-email-queue`, `pipeline-watchdog`/`admin-stuck-jobs-watchdog`, `monthly-credit-refill`, `charge_patron_renewals`, `zombie-cleanup`, `process-ai-video-replies` (nudge-only), `admin-alert-dispatch` (nudge-only). No GH Actions / Cloudflare cron backstop.

## P1 — Edge-function IDOR / SSRF (new, beyond the already-fixed 5)
- [ ] **D23. 🔴 `generate-music` cross-tenant IDOR** — takes `projectId` from the body with only auth (not ownership) and `UPDATE movie_projects SET music_url` + injects a clip → any user overwrites any project's score/timeline. `generate-music/index.ts:732`.
- [ ] **D24. 🟠 `edit-photo`/`inpaint-photo` `editId` IDOR** — client-supplied editId updated under service role with no `user_id` check → tamper with others' edit rows. `edit-photo/index.ts:143`.
- [ ] **D25. 🟠 `notify-org-event` SSRF + no timeout** — posts to org-stored webhook URLs with plain fetch (no `safeFetch`, no abort) and echoes the upstream body → blind SSRF + hang. `notify-org-event/index.ts:60`.
- [ ] **D26. 🟠 `distribution-manage` publish has no idempotency** → retried request double-posts to Meta/TikTok; all provider/OAuth/OpenAI fetches lack timeouts (hang to platform limit). `distribution-manage/index.ts:150`, `_shared/script-utils.ts:144`.

## P1 — RLS holes (new, beyond already-fixed)
- [ ] **D27. 🟠 `is_room_member` is an anon-callable patron oracle** — `SECURITY DEFINER`, takes `p_user_id`, no `auth.uid()` check, granted to `anon` → enumerate a creator's paying patrons + pledge thresholds. `migrations/20260613240000_unified_inbox.sql:699`.
- [ ] **D28. 🟠 Genesis shared-canon tables let any user forge `created_by`** and permanently pollute global worldbuilding tables (no `WITH CHECK created_by=auth.uid()`, no DELETE policy). `migrations/20260116155025:101`. Plus `system_status_overview` anon operational-metrics leak.
- [ ] **D29. 🟠 Latent runtime break from the email lockdown:** 3 public `SECURITY INVOKER` RPCs (`reel_comments_for`, `universe_detail`, `theater_payload`) still `split_part(p.email)` → will throw `permission denied for column email` for anon/authed (email column was revoked). Replace with a non-PII default.

## P1 — Frontend runtime bugs (31 found — top criticals)
- [ ] **D30. 🔴 In-SPA project switch shows the OLD project; load errors invisible.** `useProject` only clears on falsy projectId → `/editor/A→B` shows A under B's URL; B's load error has no UI. `src/hooks/editor/useProject.ts:99`.
- [ ] **D31. 🔴 Not-found / private reels spin forever** — early returns set `error` but never `setLoading(false)`; the `if(loading)` gate wins → error UI unreachable. `src/pages/Reel.tsx:274`.
- [ ] **D32. 🔴 Double-submit double-charges:** retry-clip (`Production.tsx:1005`), regenerate-script (`:1245`), regenerate-take Cmd+Enter (`TakesDrawer.tsx:193`), comments (`CommentsPanel.tsx:203`) — no in-flight guard / button not disabled.
- [ ] **D33. 🔴 Settings false-success toasts** — `supabase.rpc`/`auth.signOut` return `{error}` (don't throw), so dead try/catch always toasts success: follow-request approve (lost forever), unblock (stays blocked), **"signed out other devices" (security-relevant false confirmation)**. `SettingsDashboard.tsx:1409,1305,2058`.
- [ ] **D34. 🔴 "Cancel creation" abandons the view but never cancels the backend pipeline** → predictions keep running, credits keep burning. `Production.tsx:1470`. Bulk photo-edit keeps charging after unmount (`PhotoBulkPanel.tsx:64`).
- [ ] **D35. 🟠 2FA enroll re-fires on re-render** → duplicate TOTP factors / QR swaps mid-scan. `SettingsDashboard.tsx:2143`.
- [ ] **D36. 🟠 Lost editor edits:** trim/take-swap lost if you leave within the 600ms autosave debounce (no flush-on-unmount); failed clip autosave drops the payload so Export ships stale; "Replace music" deletes the track before the picker opens. `usePersistence.ts:100`, `useClipPropertiesSync.ts:199`, `Timeline.tsx:576`.
- [ ] **D37. 🟠 ~20 more:** auth-init ceiling races profile fetch (routes against null profile / business→personal flash), reference-image card reverts + re-charges analyze, audio uploads render as phantom black V1 clips, immersive player goes black on toggle, DM auto-scroll broken, theater closes on fullscreen-exit, unsaved settings wiped on token refresh, audio/video decoder leaks, etc. *(Full list in the agent output — root causes: unchecked `{error}`, whole-object effect deps, debounce-without-flush, loading-flag-not-reset.)*

## P1 — Data integrity (beyond D1–D3)
- [ ] **D38. 🔴 `auto_follow_admin_on_signup` can block ALL signups** — unguarded `user_follows` insert FK-referencing a hardcoded admin uuid; if that row is ever absent (fresh/staging/restored DB, or admin deleted) → `handle_new_user` aborts → nobody can register. `migrations/20260208153349:14`.
- [ ] **D39. 🔴 `conversations.created_by` RESTRICT FK breaks account deletion** — `delete-user-account` never deletes `conversations`, so the final `auth.deleteUser()` hits the FK → account left **half-deleted** (profile/projects gone, auth row survives). Same for ~8 `genesis_*.created_by` RESTRICT FKs. `migrations/20260214041332:12`.
- [ ] **D40. 🟠 Duplicate triggers → double notifications:** `reel_likes` has both `trg_fanout_notify_reel_like` and `trg_notify_reel_like` active → two "like" notifications per like. `migrations/20260611200000:262` vs `20260613240000:116`.
- [ ] **D41. 🟠 Missing indexes** on hot/unbounded columns: `direct_messages.sender_id`, `credit_transactions.project_id`, `video_clips(status,created_at)` → seq-scans at scale (DMs, account deletion, watchdog sweeps). Counter drift: `user_gamification.videos_created`/`total_likes_received` never written; `reel`/`comment` like_count maintained only in-RPC (FK-cascade bypass).

## P2 — Mobile / PWA / a11y / i18n
- [ ] **D42. 🔴 PWA serves a stale build after deploy — no reload path.** `registerType:"autoUpdate"` but the SW is registered manually (`injectRegister:null`), bypassing the auto-reload runtime; no `onNeedRefresh`/`controllerchange` handler exists. **This is the "stale version" the user already hit.** `src/main.tsx:299`, `vite.config.ts:25`.
- [ ] **D43. 🟠 Fixed top cluster + LeftRail ignore iOS safe-area insets** (notch/home-bar overlap in standalone PWA) — `.pt-safe`/`.safe-area-*` helpers exist in CSS but no component uses them. `FoundationShell.tsx:254`, `LeftRail.tsx:180`.
- [ ] **D44. 🟠 i18n stack boots on every load but is unreachable** — `LanguageSwitcher` was deleted (PR #69), no `changeLanguage` caller remains → locked to English, full i18next bundle shipped as dead weight. `src/main.tsx:7`.
- [ ] **D45. 🟠 a11y:** icon-only buttons with no accessible name (Inbox/Pricing close buttons ~16–32px tap targets, CreationStudio steppers, carousel chevrons), unlabeled search/composer inputs, hand-rolled `fixed inset-0` modals with no focus-trap/Escape/role=dialog, `w-[100vw]` horizontal-overflow on the fullscreen dialog variant. `Inbox.tsx:2364`, `PricingSection.tsx:84`, `Library.tsx:272`, `dialog.tsx:46`.
