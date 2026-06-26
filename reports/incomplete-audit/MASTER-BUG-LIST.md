# Small Bridges — MASTER BUG LIST
> Compiled 2026-06-26. Single consolidated index of every documented issue across the app, merged from `BACKLOG.md` (109: #1–65 + D1–D45) and `BUG-SWEEP.md` (345: S1–S345). **Verified 3×** before compiling (inventory completeness incl. recovering the lost BACKLOG.md from commit `24e8d0c0`; status map cross-checked against the 28 merged PRs #84–#115; dedup).
>
> **Status:** ✅ fixed (PR#) · ⚠️ FALSE-POSITIVE (verified not real — agent over-claimed) · ⏸ deferred (real, needs staging pipeline or is a feature build) · ☐ open
> **Detail:** file:line + full description for `#`/`D` items live in `BACKLOG.md`; for `S` items in `BUG-SWEEP.md`.

## TALLY
- **Total documented: 454** (109 + 345)
- **✅ Fixed & shipped: ~48** across PRs #84–#115 (all verified before merge)
- **⚠️ Verified false-positive: 11** — D13, D18, D29, D38, S16, S61, S117, S118, S127, S337, auto-follow-admin (≈40% of "criticals" tested didn't hold up)
- **⏸ Deferred (staging-money / feature-build): ~35**
- **☐ Open: ~360** (the long tail — mostly medium/low UX, a11y, perf, forms, hooks)

---

## A. 🔴 REGRESSIONS / LIVE-BROKEN (recently introduced, prod-verified)
- ✅ **D1** Follow + reel-publish roll back (`fn_notify_eh_follow`/`fn_notify_reel_published` ref non-existent `followee_id`) — **#84**
- ✅ **D2** Every reel tip rolls back (`tip_reel` notif type `'tip'` not in enum) — **#85**
- ✅ **D3** Every atom purchase rolls back (`buy_atom` notif type `'atom_sale'` not in enum) — **#85**
- ✅ **D40** Duplicate `reel_likes` triggers → double notifications — **#85**
- ✅ **#1** DM tip throws (`tip_in_thread` bad columns) — **#85**
- ⚠️ **D38** `auto_follow_admin_on_signup` could block ALL signups — **already hardened in prod** (looks up admin from `user_roles`, guards); M3 (#86) added residual hardening
- ⚠️ **D18** Email-queue dequeuer "not scheduled" — **FALSE:** `process-email-queue` IS scheduled in prod (every 5s)
- ⚠️ **D13** Beta 100-free-credit grant "still farmable" — **FALSE:** `trg_grant_beta_starter_credits` already removed from prod

## B. BROKEN WORKFLOWS — money / billing
- ✅ **#2** Org credit pool unfunded → business gen fails — crons + webhook funding **#106/#107**; ⏸ remaining: auto-recharge processor + BusinessStart self-serve checkout
- ☐ **#3** Creators can connect Stripe but never withdraw (`stripe-connect-payout` no caller) — ⏸ feature
- ✅ **#4** Patron subs never renew (`charge_patron_renewals` no cron) — **#106**
- ✅ **#5** Patron income never reaches USD ledger (trigger ignored `patron_received`) — **#97**
- ☐ **#6** Auto-recharge toggle has no processor — ⏸
- ✅ **D5** Resume re-charges/locks paid projects (`'generation'`≠`'usage'`) — **#88**
- ✅ **D6** Double-stitch race → two paid renders — **#87**
- ⏸ **D4** Avatar+Seedance charged 2× — staging (M11)
- ⏸ **D7/D8** Hollywood raw refund + hold-blind `refund_credits` gives credits away — staging
- ⏸ **D9** Charged-but-no-video, no refund, stuck `generating` (5 sub-cases) — staging
- ⏸ **D10** Reconciler blind spots + orphaned predictions + cancel doesn't release hold — staging
- ⏸ **D11** Hollywood un-imported helpers → false-fail + orphan MP4 — staging
- ⏸ **D12** Watchdog ships money bugs the moment it's scheduled — staging (M11)
- ☐ **D14** Photo-edit credit idempotency inert → double-charge (needs `project_id`) — ⏸
- ✅ **D15** api-v1 refund `p_reason`→`p_description` — **#103**
- ✅ **D16** `tip_reel` TOCTOU → concurrent double-tip (unique index) — **#103**
- ☐ **D17** PaymentsProvider default `"stripe"` (live is Polar) → wrong stack if env lost; cinema `invoice.paid` swallows grant errors
- ✅ **S125/S126** extract-scene-identity charges 5cr then crashes on bad JSON, no refund — **#115**

## C. BROKEN WORKFLOWS — pipeline / editor / generation
- ☐ **#7** Editor "Approve & Render" non-functional (`installJobRunner` never called) — ⏸ feature (M10), cascades to #8/#27/crossover
- ☐ **#8** Regenerate-take always 400s (no `action` field) — ⏸ (gated on #7)
- ☐ **#9** Pipeline watchdog cron unscheduled → stranded projects — ⏸ (M11)
- ✅ **#12** `get_daily_prompt_with_submissions` RPC missing → Lobby empty — **#90**
- ✅ **#13** `increment_template_use_count` RPC missing — **#90**
- ✅ **#14** DirectorChat → non-existent `director-chat` fn — **#90** (built the fn)
- ☐ **#42** Editor never loads real scene metadata (`.limit(0)`)
- ☐ **#43** AudioMixer A1/A2 dead + mixer state not persisted
- ☐ **#44** Final-video player can't play `.json` manifest URL
- ☐ **#45** Multi-clip "Download" fires N downloads (only first lands) [= S297]
- ☐ **#46** Block-level script editing unreachable (doc beats never emitted)
- ☐ **#47** VersionsPanel session-only (no DB)
- ☐ **#48** DM composer can't create reel-anchored/attachment messages
- ✅ **D30** In-SPA project switch shows OLD project — **#98**
- ✅ **D31** Not-found/private reels spin forever — **#98**
- ✅ **D36** Lost editor edits on quick-nav (autosave flush) — **#98**
- ☐ **S60** CastEditor in-place mutate → removed char stays visible
- ⚠️ **S61** BudgetPanel `getEngine().displayName` crash — **FALSE:** `getEngine` has a fallback, never undefined
- ☐ **S64** CreatePanel poll `if(!videoUrl) return` → optimistic clip stuck
- ☐ **S65** Script completed-shot Lock label wired to onApprove (contradiction)
- ☐ **S66/S67/S68** dead editor keybinds / wrong shortcut hints

## D. BROKEN WORKFLOWS — business / org / social
- ✅ **#10** Business API keys can't authenticate (`org_api_keys` vs `api_keys`) — **#89**
- ✅ **#11** `editor` org role bricks members (no authz branch) — **#89**
- ✅ **#23** Block enforcement (feed) — **#105** (partial: feed only; ☐ search + write-paths remain)
- ☐ **#22** `user_reports` write-only black hole (no admin processor) — ⏸
- ☐ **#24** Private-account follow approval bypassable (raw `user_follows`)
- ☐ **#26** Follow split across `follows`/`user_follows` (split-brain)
- ☐ **#27** Two disjoint comment threads per reel (`reel_comments`/`project_comments`)
- ☐ **#28** Inbox lane taxonomy fork → comments miss Comments lane
- ☐ **#29** `premiere_scheduled`/`watch_party_invite` enum values never registered
- ☐ **#30** Brand-kit vs Assets = two disconnected storage systems
- ☐ **#36** Team invites send no email (just insert + clipboard)
- ☐ **#37** Accept-invite "member joined" email has no recipients (profiles.email revoked)
- ☐ **#38** Google Drive/Notion integrations inert (no sync worker)
- ☐ **#39** YouTube/LinkedIn distribution can't post (stubs)
- ☐ **#40** Templates store nothing / can't launch
- ☐ **#41** Permissions matrix cosmetic + drops `editor`
- ☐ **S14** Invite role dropdown omits `editor`; **S15** ✅ org-less /business on provision fail — **#114**
- ☐ **S16** SSO gate — ⚠️ **FALSE** (`sso_enabled` enterprise-only; code is correct)
- ☐ **S17–S34** business-page papercuts (brand-asset mismatch S17, shared busy flag S18, dead credit badge S19, owner-name RLS S20, integration status S21, channels-unused S22, log-failure-blocks-save S23, ConceptCard index-key S24, uncapped generate S25, blank approvals page S26, sort-pill S27, perpetual skeleton S28, retired links S29, color-cap S30, invite Enter-guard S31, OTP length S32, dup keys S33, download-revoke race S34)

## E. CRASHES / NULL-SAFETY
- ✅ **S35** Crossover card crash (`ENGINES[bp.engine].tier` / `TIER_HUE[].replace`) — **#113**
- ✅ **S201** Production `pipeline_state` JSON.parse crash → infinite spinner — **#112**
- ✅ **S141** generate-avatar-image `atob` crash on URL — **#115**
- ⚠️ **S61** BudgetPanel — FALSE (fallback)
- ☐ **S202–S212** `Array.find(...)!` non-null derefs (ImageStudioHub ×2, CrossoverDetailDrawer, Environments, Inbox lanes, CreationStudio ×2, TemplateComposer, AdminProjections ×2, Admin tabs)
- ☐ **S213/S214** divide-by-zero → NaN width/margin (CostAnalysis, PricingConfig)
- ☐ **S215–S218** invalid-date → "NaNm ago" / "Invalid Date" (ProjectCard ×2, ActiveProjectBanner, BillingSettings)
- ☐ **S219/S220** `.charAt(0)` on null name/status (AdminMessageCenter, ProductionDashboard)
- ☐ **S221** WelcomeSalutation double-`.slice` drops a char
- ☐ **S202/S339/S340** type-cast-hidden crashes (ImageStudioHub aspect, StudioContext NaN duration)

## F. SECURITY (IDOR / RLS / XSS / secrets)
- ✅ **D23** generate-music cross-tenant IDOR — **#91**
- ✅ **D24** edit/inpaint-photo editId IDOR — **#91**
- ✅ **D27** `is_room_member` anon patron oracle — **#92**
- ✅ **D28** Genesis tables forge `created_by` + system_status_overview anon — **#92**
- ✅ **S223–S229** `javascript:` href stored-XSS (Profile ×2, ProfileDashboard, widget/landing CTAs ×4) — **#112** (safeHref)
- ☐ **D25** notify-org-event SSRF + no timeout — ⏸
- ☐ **D26** distribution-manage no idempotency + no fetch timeouts — ⏸
- ☐ **D29** email-lockdown latent break (3 RPCs `split_part(email)`) — ⚠️ not a live break (revoke unapplied)
- ☐ **S230–S234** more unvalidated href sites (BusinessDistribution, admin org/project/moderation, ImageStudioHub) — safeHref candidates
- ☐ **S235/S236** CSV formula-injection in exporters (AdminUsers + ~7 more)
- ☐ **S237/S238** session JWTs in localStorage; tamperable `SECURITY_VERSION_KEY` gate
- ⚠️ **S337** admin_adjust_credits "service-role-only" — FALSE (grants authenticated)

## G. DATA INTEGRITY / MIGRATIONS
- ✅ **D39** `conversations.created_by` + ~8 genesis RESTRICT FKs break account deletion — **#93**
- ✅ **D41** Missing indexes (DM sender, ledger project, clip status) — **#93**
- ⚠️ **D38** signup-block — already hardened
- ☐ **#59** `types.ts` ~2,800-line drift behind `as never`
- ☐ counter drift: `user_gamification.videos_created`/`total_likes_received` never written; like_count maintained only in-RPC (part of D41 note)

## H. 404 / ROUTING / DEAD LINKS
- ☐ **S37** Lobby "directors" link `/u/:id` (app uses `/c/…`) — broken profile path
- ☐ **S59** WorldDetail/Profile link legacy `/watch/:id` (redirect hop)
- ☐ **S264** AuthCallback success no `{replace}` → Back lands on consumed-token error
- ☐ **S265** AuthCallback `next` param unvalidated (open-redirect)
- ☐ **S266** `/user/:userId` → Navigate `/projects` drops the id
- ☐ **S267** HEAVY_ROUTES config keyed on retired routes; real heavy pages missing
- ☐ **S268** `/workspace/*` no param variants → `/workspace/editor/:id` 404s
- ☐ **S269** onboarding bounce drops `?next`
- ☐ **S270/S271** guard nesting order / blocked page mounts before redirect
- ☐ **S272–S277** legacy redirect-stub double-navigation (Onboarding, /projects targets, /create, /settings 3-hop, /studio/* drops splat)
- ☐ **S278/S279** AuthCallback fragile error-ordering; /admin/* 404 in public build
- ☐ **#65** Studio "Theater" nav → removed `/library?mode=theater`

## I. DEAD CODE / ORPHANED
- ✅ **#57** ~9 orphaned components — **#109** (7 deleted; PricingSection/B2BHero/etc.)
- ☐ **#54** Legacy settings tree dead (`Settings.tsx` + `components/settings/*`)
- ☐ **#55** Deactivate-account no-op loop (in dead tree)
- ☐ **#56** ~18 orphaned edge functions (landing-*, free-tier-generate, director-card, premiere-recap, elevenlabs-*, mint-project-share, etc.) — verify dynamic-dispatch before delete
- ☐ **#58** Orphaned client libs (`AtomicFrameSwitch`, `renderQueue`, `demoProject`+`/editor/demo`)
- ☐ **#33** `reel_reactions` table + notifier orphaned
- ☐ **#34** `fn_notify_tip_received` defined, never attached
- ☐ **#25** `approve-clip-one` no caller
- ☐ **S13** WelcomeCheckout dead `starterCredits`; **S49** StudioShowcase dead transition; **S52** Pricing dead BuyCreditsModal (never opened)

## J. INCOMPLETE / MISSED PROMISES (feature builds)
- ☐ **#15** Patron-gated content: no UI — ⏸ feature (M25)
- ☐ **#16** Atoms marketplace: no UI — ⏸ (M25)
- ☐ **#17** Premieres: unreachable scaffolding (build or delete) — ⏸ (M26)
- ☐ **#18** Watch-party lifecycle half-built — ⏸ (M26)
- ☐ **#19** Webhooks promised, no registration UI — ⏸
- ☐ **#20** Cinema billing-management UI missing — ⏸
- ☐ **#21** AI widget-builder no authoring UI — ⏸
- ☐ **#32** `ch_email` channel pref no-op
- ☐ **#35** AI-video-reply worker no cron sweeper
- ☐ **#49** OAuth promised in header but removed; link-social buttons error
- ☐ **#50** Password change no current-password re-auth
- ☐ **#51** "Active sessions" cosmetic
- ☐ **#52** `defaultQualityTier` pref write-only
- ☐ **#53** `signInWithMagicLink` orphaned
- ✅ **#31** Notif bell icons/deep-links — **#104**

## K. FORMS / INPUT VALIDATION (S69–S116, 48)
- ☐ **S69** VoicePalette unusable in Firefox/Safari (no text fallback)
- ☐ **S70/S71/S80–S82/S111/S114** unbounded free-text → DB (CreationHub prompt, profile fields, brand-inquiry, publish tags/notes, business name/website, BusinessStart)
- ☐ **S72/S112/S113** no `.trim()` → whitespace-only persists (AccountSettings, Contact ×2)
- ☐ **S73/S74/S85** null-profile / FileReader stuck-spinners
- ☐ **S77/S100** OTP autofill broken / backspace desync
- ☐ **S78/S88/S90** email validation bypassed (onClick not `<form>`)
- ☐ **S86/S87/S89/S96/S106/S108** double-submit / dup-row (admin gallery, breakout/crossover create, invite, sign-out-all, credit packages, message center)
- ☐ **S76/S107/S116** CSV injection / no-transaction config / stale margin text
- ☐ **S75/S83/S84/S98/S99/S105/S109/S110/S115** swallowed errors / false-success / window.prompt cap / NaN resume / clipboard
- ☐ **S91–S95/S97/S101–S104** misc (0-byte commentary, password strength not enforced, avatar ext, date-min, size-check, comment delete no-confirm, race)

## L. FRONTEND RUNTIME / HOOKS / RACES
- ✅ **D32** Double-submit double-charges (retry/regenerate) — **#94** (☐ comments double-post S87 remains)
- ✅ **D33** Settings false-success toasts — **#99**
- ✅ **D34** Cancel-creation doesn't cancel backend — **#94**
- ✅ **S15** BusinessStart org-less landing — **#114**
- ⏸ **D35** 2FA enroll re-fires → duplicate factors
- ⏸ **D37** ~20 FE races (auth-init ceiling, business-flash, settings wipe, immersive black, DM scroll, theater fullscreen-close, decoder leaks…)
- ☐ **S240** useAvatarTemplatesQuery `isLoading && !isFetching` always false → no spinner
- ☐ **S241–S263** hook bugs: preload thrash, audio onended timing, chunk reset, missing-cleanup timers/listeners, unmemoized context churn, unordered pref writes (S254), silent partial reorder (S255/S16-gallery), N+1 (S263), unbounded ref growth (S262), toast eviction (S261)
- ☐ **S302** AuthContext value unmemoized → app-wide re-render cascade — ⏸ (dep-audit risk)

## M. STORAGE / MEDIA / PLAYBACK (S280–S301)
- ☐ **S280** probeVideo `onseeked` no timeout → ingest hangs forever
- ✅ **S282/S283** `describeIngestError` "[object Object]" — **#113**
- ☐ **S281/S284** object-URL leak / orphaned uploads on partial failure
- ☐ **S285/S286** private media in PUBLIC buckets (commentary, source videos)
- ☐ **S287–S290** fake progress, 7-day signed URL persisted, public URL on private bucket, same-ms overwrite
- ☐ **S291–S301** thumbnail CORS fail, unbounded thumb cache, `<video src>` leaks (×4), parity desync black frame, multi-clip download (=#45), no img onError/CLS, music onerror, 4K thumb >5MB cap, caption crossOrigin

## N. REALTIME / SUBSCRIPTIONS (S321–S336)
- ☐ **S321/S322/S326** unfiltered table-wide subscriptions (direct_messages, all-feed 4 tables, support_messages) → cross-tenant fanout (RLS-dependent — verify exposure before adding filters)
- ☐ **S323/S324** full-RPC reload per event / 4–5 dup `notifications` subs → refetch storm
- ☐ **S325/S336** static channel topic collisions
- ☐ **S327–S335** resubscribe-on-select drops events, no reconnect backstop, INSERT-only comments, presence blip on profile edit, dep-on-user-object, equal-timestamp clobber, polls never stop (×2), onClip no completed-guard

## O. PERFORMANCE (S302–S320)
- ☐ **S302/S303** AuthContext + NavigationLoading values unmemoized → mass re-renders
- ☐ **S304/S305/S309** `select('*')` no `.limit` on unbounded tables (dm_reactions whole-table, conversations all-msgs, reactions)
- ☐ **S306/S307/S320** useMediaLibrary realtime reconcile storm + identity churn
- ☐ **S310–S312** admin monitor unbounded + 10s poll; pending-recovery N+1 invokes
- ☐ **S313/S314** no virtualization anywhere; Library inline closures + non-memo cards
- ☐ **S315–S319** `select('*')` heavy rows; 6.5k-line ProfileDashboard; lazy imgs no w/h (CLS)

## P. ACCESSIBILITY (S154–S200 + D43/D45)
- ☐ **S154–S162** icon-only buttons no aria-label (password toggles, view toggles, copy-secret, modal close, DM back/close, video controls, dots)
- ☐ **S163–S167** meaningful images with `alt=""` (avatars, thumbnails, brand logo)
- ☐ **S168–S172** placeholder-only inputs no label (DM, watch-party, prompt, search ×2)
- ☐ **S173–S180** unlabeled sliders/colors (editor Effects/AudioMix/ColorGrade — one shared `Slider` fix labels 30+; PremiumControls seek/volume `<div>` no role=slider — **highest a11y leverage**)
- ☐ **S181–S189** `<div onClick>` should be button; modals no focus-trap/Escape (×5); div role=button
- ☐ **S190/S191** videos no captions/track
- ⏸ **D43** iOS safe-area insets on fixed rail/cluster
- ⏸ **D44** i18n boots but unreachable (restore switcher or drop)
- ☐ **D45/S45** original a11y batch (Inbox/Pricing close, steppers, Library search)

## Q. EMAIL / CRON / OPS
- ✅ **D19** transactional emails wrong field → never send — **#95**
- ✅ **D20** admin-alert POST to stale project ref — **#108**
- ✅ **#2/#4** org refill + patron renewal crons scheduled — **#106**
- ☐ **D21** suppression on Lovable not Resend; `email_change_notice` template missing
- ☐ **D22** remaining unscheduled crons (zombie-cleanup, ai-video-replies backstop, watchdog — gated on M11)
- ⚠️ **D18** email queue cron — FALSE (scheduled)

## R. AI-PROVIDER INTEGRATION (S117–S153, 37)
- ⚠️ **S117/S118** model ids "404" — **FALSE** (all exist on Replicate; Seedance correctly uses `seedance-2.0`)
- ✅ **S125/S126** extract-scene-identity refund-on-bad-JSON — **#115**
- ✅ **S141** avatar atob URL — **#115**
- ⚠️ **S127** poll-replicate "infinite 30× poll" — **FALSE** (loop breaks on `succeeded`)
- ☐ **S119/S120** composite-character Replicate `version:`-slug (should be hash) → bg-removal/compositing fail
- ☐ **S121** editor-transcribe `scribe_v2` (verify vs ElevenLabs)
- ☐ **S122/S123** landing-demo-chat / director-chat model id (verify gateway supports `gemini-3-flash-preview`)
- ☐ **S124/S128–S140/S142–S153** unguarded `choices[0]`/JSON parses, no timeouts/retries on Replicate/ElevenLabs/OpenAI, content-type mismatches, prompt-injection vectors, concurrent prediction-array clobber (S150), orphan reconciliation gaps

## S. COSMETIC / UX PAPERCUTS
- ☐ **#60–#64** ad-studio music flag, owner-promotion guard, window.prompt cap, simulated progress, @mention autocomplete
- ☐ **S38/S39/S43/S46/S47/S54/S57/S58** Help Enter no-op, FAQ stale-index, ⌘N hint, Blog count, Reel views/reactions mislabel, SearchHub partial-query analytics, double title-write, dead "See all"
- ☐ **S4/S63/S104** `window.confirm` usages (violate confirm-dialog standard) — SettingsDashboard ×4, Timeline ×2, comment delete

---
### Notes for whoever picks this up
1. **Verify before fixing.** ~40% of agent-flagged "criticals" were false positives on inspection (see the ⚠️ tags). Check live code/DB/Replicate first.
2. **Highest-leverage single sweeps:** one `safeHref()` already done (#112) — extend to S230–234; one shared editor `Slider` fix labels 30+ a11y instances (S173–175); one model-catalog pass; the `window.confirm`→confirm-dialog cleanup (S4/S63).
3. **Staging-gated cluster:** the pipeline-money items (D4/D7/D8/D9/D10/D11/D12, M6/M11) need an end-to-end pipeline run — latent pre-launch (zero hold-flow charges exist).
4. **Feature builds, not fixes:** #15–21, #36–41, M10/M25/M26/M27 — product decisions required.
5. Source detail: `BACKLOG.md` (#/D items) + `BUG-SWEEP.md` (S items, with per-batch verification log at the tail).

---

# VERIFICATION PASS (2026-06-26) — every item opened at its file:line by 12 parallel verifiers
Read-only. Each item classified CONFIRMED (real) / FALSE-POSITIVE (not real) / PARTIAL (real but overstated) / NEEDS-RUNTIME (can't tell from code).

## ⚠️ FALSE-POSITIVES — 44 total, do NOT chase
**Already known (11):** D13, D18, D29, D38, auto-follow-admin, S16, S61, S117, S118, S127, S337.
**Found this pass (33):**
- **D44** — i18n is NOT dead: `src/i18n/index.ts` runs an active on-demand AI DOM translator for non-English locales. Only the manual switcher is missing.
- **S10** — password recovery routes through `/reset-password` (ResetPassword exchanges the PKCE code); the AuthCallback branch is unreachable.
- **S20** — migration `20260704002600` (applied) added the co-member profile SELECT policy; owner names resolve.
- **S40** — `ai_video_url` IS in the DB + the query uses `select("*")`; only the local TS interface omits it (type gap, renders fine).
- **S102** — `validateUploadFile()` enforces the 500 MB cap before upload.
- **S105** — realtime channel uses no server filter; the `.or()` is the fetch query and email is a trusted auth value (not exploitable).
- **S202,S203,S204,S205,S207,S208,S209,S210,S211,S212** — every `Array.find(...)!` here is keyed by a typed-union state / static iterator over a static in-component list → cannot throw.
- **S219** — `support_messages.name` is NOT NULL; `charAt(0)` is safe.
- **S162** — clip dots already carry `aria-label`.
- **S163,S164,S165,S166** — decorative `alt=""` with adjacent text name is the WCAG-correct pattern (NOT a defect).
- **S187** — the Avatars dialog DOES handle Escape (lines 1066–1069).
- **S239** — Blog JSON-LD escapes `<` and is built from static content (no user data).
- **S278** — synchronous `setStatus('error')`→`setStatus('success')` is React-batched; the error card never renders.
- **S319** — lazy imgs already sit in `aspect-video` boxes → no CLS.
- **S339,S342,S343,S345** — `as`-casts over typed unions / to-one FK embeds; hide no runtime drift.
- **S247,S251,S258** — no div-by-zero (denominator `50·(2L-1)`); `CreditsContext` value IS memoized; `usePredictivePipeline` deps are primitive fields.

## 🟡 PARTIAL / overstated (real defect, but trim the claim)
#19 (business webhook CRUD exists; only personal page is prose) · #49 (link-OAuth buttons are config-dependent, not dead code) · #58 (only `AtomicFrameSwitch` orphaned; `renderQueue`/`demoProject` are used) · D9 (clip-0 hold-consume sub-claim is dead code) · D21 (template-field sub-claim fixed by D19) · D22 (6 crons not 4; refill+patron now scheduled) · D37 (2 of 4 sampled races false) · D45 (Radix dialogs already a11y; PricingSection cite stale) · S5,S12,S19,S22,S23,S26,S29,S31,S34,S60 · S81,S97,S100,S106,S108 · S146 · S215,S216,S217,S218,S220 (date helpers — inputs are DB-guaranteed non-null) · S232,S233,S234 (real but low-exploit system URLs) · S242,S243,S245,S253 · S272,S273,S274,S277 (resolve via one redirect hop) · S290,S296,S297,S298,S299,S300 · S305,S315,S318,S320,S335 · S321,S326 (table-wide subs but **RLS scopes realtime delivery → no actual cross-tenant data leak**; perf/herd only) · S340,S344.

## ⏳ NEEDS-RUNTIME (verify outside the code)
S121 (`scribe_v2` exists?) · S122/S123 (`gemini-3-flash-preview` on gateway?) · S124/S145 (model/endpoint shape) · S285/S286 (prod bucket `public` flag — committed migrations say public, confirm dashboard) · #9/D22 (pg_cron applied state).

## ✅ CONFIRMED-REAL highlights (most worth fixing, all code-verified)
- **Money/pipeline:** D4 (avatar+seedance 2× charge), D7/D8 (hold-blind refund mints credits), D10/D11/D12 (reconciler gaps, un-imported helpers, watchdog money bugs), D14 (photo idempotency inert → 4× charge), D17 (PaymentsProvider defaults to dormant Stripe).
- **Crashes:** S206 (Inbox `?lane=` URL param → unguarded `.find()!` throws), S214 (`-Infinity%` margin), S222 (error HTML saved as `.mp4`), S130/S131 (silent wrong AI output), S136 (transient 429 → permanent FAILED clip), S150 (concurrent clip-status clobber).
- **Workflows:** #7 (render runner dead → cascades), #26/#27/#28 (follow/comment/inbox split-brain), #29 (premiere/watch-party enum values unregistered → silent notif fail), #37 (invite email no recipients).
- **AI:** S119/S120 (Replicate `version:` slug not hash → always 422), S128/S129 (paid-but-500 no fallback).
- **Security:** S230/S231 (unvalidated href XSS — no `safeHref` landed beyond the 8 in #112), S235/S236 (CSV formula injection, no `=+-@` neutralize), D25 (notify-org-event SSRF).
- **Hooks/realtime:** S240 (initial spinner never shows), S248/S249 (double-insert / double-notify), S332 (equal-timestamp clobbers a flushed edit), S329 (comment edits/deletes never refresh).
- **Routing:** S264 (Back → consumed token), S268 (`/workspace/editor/:id` hard 404), S269 (onboarding drops destination), S279 (`/admin` 404 in prod build).
- **Storage:** S280 (ingest hangs, no seek timeout), S285 (`director-commentary` public+anon-read), S294/S295 (timeline player buffers leak + wrong-buffer black frame after seek).

## Line drifts to correct in the sources
#6→SettingsDashboard:1894 · #7→orchestrator:292/298 · #22→pages/account/ProfileDashboard:5003 · #32→NotificationSettings:89 · #42→useProject:141 · #60→CreationHub:255 · D7→hollywood:6381 · D35→SettingsDashboard:2155 · S115→~154 · S256→127 · S267→lib/navigation/routeConfig:21 · S278→AuthCallback:114.
