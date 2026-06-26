# Small Bridges — Master Execution Plan
> Derived from the 109-item audit (`BACKLOG.md`). Tasks are ordered, each ≈ one PR or one surgical migration, independently executable. Ship method: **SQL** = surgical migration via Management API + record in `schema_migrations` (NOT `db push`); **PR** = code branch → PR → merge → Vercel deploy. Every task: verify before + after, no live balance mutations unsupervised.

Legend: ⏱ effort (S<½d, M~1d, L~multi-day) · ⛓ depends-on.

---

## WAVE 0 — LIVE PROD HOTFIXES (do first; users are hitting failures now)

### M1 — Restore follow + reel-publish (SQL · S)
Covers **D1**. Live prod: `fn_notify_eh_follow` + `fn_notify_reel_published` reference `follows.followee_id` (real col `followed_id`) → every `toggle_follow` insert and reel publish rolls back.
- Fix: `CREATE OR REPLACE` both fns with `followed_id`; keep the safe-notify guard order.
- Verify: rollback-safe insert test on `follows` + `published_reels` succeeds (no `undefined_column`); a real follow round-trips; record migration.

### M2 — Restore tipping + atom-purchase RPCs & dedupe like-notifs (SQL · S)
Covers **D2, D3, #1, D40**. Enum/column/dupe-trigger fixes: `tip_reel` `'tip'`→`'tip_received'`; `ADD VALUE 'atom_sale'` to `notification_type`; `tip_in_thread` insert → correct `credit_transactions(transaction_type, …)`; drop the duplicate `trg_fanout_notify_reel_like`.
- Verify: rollback-safe calls to `tip_reel`/`buy_atom`/`tip_in_thread` complete; one notification per like.

### M3 — Audit & harden all unguarded notification triggers (SQL · M) ⛓M1,M2
Covers **D38** (auto_follow_admin can block ALL signups), plus the admin-notify trigger cluster. Wrap user-path notification/follow triggers in `EXCEPTION WHEN OTHERS THEN NULL` and/or existence-guards so a notify failure can never roll back signup/comment/like/render.
- Verify: simulate a missing admin row / bad enum → signup + the social write still succeed.

---

## WAVE 1 — MONEY: stop credit loss & double-charges

### M4 — Pipeline stitch: atomic claim + single completeness gate (PR · M)
Covers **D6, D9(partial/mid-clip/stitch-failure)**. One atomic `UPDATE…SET status='stitching' WHERE status<>'stitching' RETURNING id`; unify "done" on a DB count (`completed >= expected`); on partial/failed sets call `markProjectFailedAndRefund` (refund delta). Closes the double-stitch race + charged-but-partial.
- Verify: concurrent/duplicate last-clip webhook → exactly one stitch; 4-of-6 set refunds the delta.

### M5 — Pipeline double-charge paths (PR · M) ⛓M4
Covers **D4** (avatar+seedance 2×), **D5** (resume `'generation'`→`'usage'`), **D7/D8** (hollywood raw refund + hold-blind `refund_credits`). Add `skipCreditDeduction` to mode-router→seedance; fix the resume detection string; make `refund_credits` verify a consumed spend exists; route all exits through `markProjectFailedAndRefund`.
- Verify: avatar render charged once; resume of a paid project doesn't re-charge/lock; forced clip-0 failure doesn't mint credits.

### M6 — Pipeline reconciler + cancel + orphan-prediction (PR · M) ⛓M4
Covers **D10, D11**. Reconciler handles in-flight statuses + sweeps `credit_holds` by `project_id`; `cancel-project` releases the hold; persist prediction IDs synchronously before the billable call; import the two missing helpers in hollywood (D11).
- Verify: cancel releases hold immediately; a project stuck `processing` that finished gets consumed not expired.

### M7 — Finance integrity (SQL+PR · S)
Covers **D13** (drop farmable beta 100-credit trigger), **D14** (photo-edit idempotency: pass real `project_id` or add null-project dedupe), **D15** (api-v1 `p_reason`→`p_description`+project_id+check error), **D16** (tip_reel TOCTOU: lock before checks / unique index on `tip:%`).
- Verify: new signup gets 0 credits; double-submit photo edit charges once; concurrent double-tip charges once.

### M8 — Org credit pool funding (SQL+PR · M)
Covers **#2, #4(cron), #6**. Fund `organizations.credits_balance` on subscription activation (polar-webhook → `topup_org_credits`); BusinessStart triggers checkout; schedule `monthly-credit-refill` + `charge_patron_renewals` crons; build auto-recharge balance-watch processor.
- Verify: a business subscription deposits into the pool; org generation succeeds; refill cron runs in staging.

### M9 — Creator payouts close the loop (PR · M) ⛓M8
Covers **#3, #5**. Add Withdraw action invoking `stripe-connect-payout` (gated on `payouts_enabled`); add `patron_received` to the earnings-projection trigger so pledges reach the USD ledger.
- Verify: a creator with `payouts_enabled` + balance can withdraw; a pledge lands in `creator_earnings_ledger`.

---

## WAVE 2 — CORE WORKFLOWS

### M10 — Editor render runner (PR · M)
Covers **#7 → unblocks #8, #27, #5(crossover)**. Implement + `installJobRunner()` at editor bootstrap (submit to `editor-generate-clip` + poller); fix regenerate-take payload (`action:"submit"` + poll); wire render-queue enqueue.
- Verify: per-shot Approve&Render generates a clip; regenerate-take resolves; queue panel populates.

### M11 — Pipeline watchdog: fix money bugs, then schedule (PR+SQL · M) ⛓M5
Covers **#9, D12**. First fix watchdog refund/consume bugs (route through `markProjectFailedAndRefund`, real `expectedClipCount`, atomic dispatch); THEN schedule the cron. (Must not schedule before fixing — D12.)
- Verify: a stranded project recovers (refund or complete) correctly in staging before scheduling.

### M12 — Business API keys + editor role authz (SQL+PR · S)
Covers **#10, #11**. Point `api-v1` gateway at `org_api_keys` (or mint org keys into `api_keys`); add the `editor` branch to `has_org_permission` + `fn_org_has_min_role`.
- Verify: a business key authenticates a generation call; an `editor` member passes RLS checks.

### M13 — Missing RPCs / mis-wired fns (SQL+PR · S)
Covers **#12, #13, #14**. Ship `get_daily_prompt_with_submissions` + `increment_template_use_count` migrations; repoint DirectorChat to `editor-ai-scene`.
- Verify: Lobby daily-prompt populates; template use_count increments; editor AI chat responds.

---

## WAVE 3 — SECURITY & DATA INTEGRITY

### M14 — Edge-function IDOR / SSRF (PR · M)
Covers **D23, D24, D25, D26**. Ownership guard in `generate-music` + `edit/inpaint-photo` (editId); `safeFetch`+timeout in `notify-org-event` (no body echo); idempotency + timeouts in `distribution-manage`/providers/OAuth/`fetchWithRetry`.
- Verify: cross-tenant `projectId`/`editId` rejected; provider fetch times out cleanly.

### M15 — RLS holes (SQL · S)
Covers **D27, D28, D29**. Guard `is_room_member` (`auth.uid()` / revoke anon); `WITH CHECK (created_by=auth.uid())` + DELETE on genesis canon tables; coarsen `system_status_overview` for anon; replace `split_part(email)` in 3 public RPCs with a non-PII default (also fixes the latent permission-denied break).
- Verify: role-sim — anon can't enumerate patrons; can't forge created_by; public RPCs don't throw on email.

### M16 — Account-deletion FKs + missing indexes (SQL · S)
Covers **D39, D41**. Re-issue RESTRICT FKs (`conversations.created_by`, `genesis_*`) as `ON DELETE SET NULL` (drop NOT NULL where needed) or delete in `delete-user-account`; add indexes on `direct_messages.sender_id`, `credit_transactions.project_id`, `video_clips(status,created_at)`.
- Verify: full account deletion completes; EXPLAIN shows index use.

### M17 — Moderation + block enforcement (SQL+PR · M)
Covers **#22, #23, #24**. Admin queue/RLS + insert alert for `user_reports`; apply block filter server-side to `lobby_feed`/`search_everything`/like/comment/reaction policies; route all follows through `toggle_follow` (also resolves split-brain **#26**).
- Verify: blocked user can't see/like/follow blocker; report is actionable; follow counts consistent.

### M18 — Comment/inbox unification (SQL+PR · M)
Covers **#27, #28, #29, #30**. Unify reel comments (`reel_comments` vs `project_comments`) on one store; unify inbox lane taxonomy; `ADD VALUE` premiere/watch-party enum values; reconcile brand-kit vs assets buckets.
- Verify: a comment shows in both surfaces; new notifications land in the right lane.

---

## WAVE 4 — EMAIL & CRON

### M19 — Email reliability (SQL+PR · M)
Covers **D18, D19, D20, D21, #36/#37 templates**. Confirm/codify the `process-email-queue` cron; accept `template` alias (or fix 5 call sites); fix admin-alert project URL; re-wire suppression to Resend/Svix; add `org_invite` + `email_change_notice` templates.
- Verify (staging): a queued email actually sends; render-complete/org/low-credit emails arrive; a bounce hits `suppressed_emails`.

### M20 — Cron coverage sweep (SQL · S) ⛓M11,M8
Covers **D22**. After their bugs are fixed, schedule the remaining jobs (`zombie-cleanup`, `process-ai-video-replies` backstop, `admin-alert-dispatch` backstop) + add GH-Action/Cloudflare cron backstop doc.
- Verify: cron list matches the intended table; nudge-only jobs have a backstop.

---

## WAVE 5 — FRONTEND RUNTIME

### M21 — Double-submit + false-success + cancel-burn batch (PR · M)
Covers **D32, D33, D34**. In-flight guards/disabled buttons on retry-clip/regenerate-script/take/comment; destructure `{error}` on rpc/signOut (rollback + error toast); wire bridge "Cancel creation" to `cancel-project`; mounted/abort guard on bulk photo-edit.
- Verify: rapid double-click → one mutation; failed RPC shows error; cancel stops the backend.

### M22 — Editor data-loss + dead-state batch (PR · M)
Covers **D30, D31, D36**. Clear project on in-SPA switch + show load error; `setLoading(false)` on reel not-found/private; flush autosave on unmount; delete-only-after-success in clip autosave; picker-before-delete on replace-music.
- Verify: `/editor/A→B` shows B; deleted reel shows error; trim survives quick navigation.

### M23 — Auth/settings races + player/leaks batch (PR · M)
Covers **D35, D37**. 2FA enroll once-per-open; auth-init ceiling > profile timeout (+ business flash guard); settings effects keyed on id (no wipe on refresh); fix immersive-player black, DM auto-scroll, decoder leaks, theater fullscreen-close.
- Verify: no duplicate TOTP factors; settings edits survive token refresh; players resume.

### M24 — Notifications surface (PR · M) ⛓M18
Covers **#31, #32, #33, #34, #35, D40-fe**. Bell icons/deep-links for all generated types; honor `ch_email`; remove dead notifiers; AI-reply sweeper backstop (with M20).
- Verify: a tip/follow-request notification renders + deep-links.

---

## WAVE 6 — MISSING FEATURES (build or delete)

### M25 — Patron-gated content + Atoms marketplace (PR · L)
Covers **#15, #16**. Patron post composer + gated feed viewer (`creator_posts`/`list_creator_posts`); atoms list/buy/sell UI (`create_atom_listing`/`buy_atom`/`atom_listings`).

### M26 — Premieres / Watch-party / Webhooks / Cinema / Widget (PR · L)
Covers **#17, #18, #19, #20, #21**. Per item: build the missing client + state transitions, or delete the dead schema. Premieres need a status-transition mechanism; watch-party needs invites+lifecycle; webhooks/cinema/widget need their authoring/management UIs.

### M27 — Business completion (PR · M)
Covers **#36, #38, #39, #40, #41**. Team-invite email send; Drive/Notion sync workers (or relabel); YouTube/LinkedIn publish workers (or hide); template body editor + apply + use_count; real permissions matrix incl `editor`.

---

## WAVE 7 — MOBILE / PWA / A11Y

### M28 — PWA stale-build reload + safe-area + a11y (PR · M)
Covers **D42, D43, D45**. `virtual:pwa-register` with `onNeedRefresh` reload prompt (fixes the recurring "stale version"); apply existing `.safe-area-*` helpers to fixed rail + top cluster; aria-labels + focus-trap/Escape on icon buttons + hand-rolled modals; fix `w-[100vw]` overflow.

### M29 — i18n decision (PR · S)
Covers **D44**. Either restore a `LanguageSwitcher` wired to `i18n.changeLanguage`, or drop the i18n boot from `main.tsx` to shed dead bundle weight.

---

## WAVE 8 — CLEANUP

### M30 — Dead-code & hygiene sweep (PR · M)
Covers **#54, #55, #56, #57, #58, #59, #60–#65, D17**. Delete legacy settings tree + dead deactivate button; triage ~18 orphaned edge fns + ~9 orphaned components + dead libs (wire or remove, verifying pipeline-dispatch targets first); regenerate `types.ts` (removes `as never` masking); fix the small items (ad-studio music flag, owner-promotion guard, window.prompt → confirm dialog, theater nav, @mention autocomplete); default PaymentsProvider to `polar`.

---

### Execution rules
- Ship each task as its own verified PR/migration; never `db push`; record every SQL change in `schema_migrations`.
- Verify against prod (rollback-safe tests / role-sim) before and after each money/SQL change; never mutate live balances unsupervised.
- Sequence: Wave 0 immediately → Wave 1–4 (money/security/reliability) → Wave 5 → Wave 6–8.
