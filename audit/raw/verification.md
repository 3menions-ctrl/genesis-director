# Verification + Reconciliation Pass — Genesis Director Audit

READ-ONLY independent verification of the top fix-target findings, plus reconciliation
against the repo's pre-existing audit docs. Branch: `full-audit`. No source modified.

---

## JOB 1 — Independent verification of the 8 fix-targets

### 1. zombie-cleanup DOUBLE-REFUND — **CONFIRMED**

`supabase/functions/zombie-cleanup/index.ts` issues every refund as TWO positive
`credit_transactions` rows, and the authoritative balance sums that table.

Decisive lines (standard-project refund block; the avatar block 327-340 and clip block
611-627 are identical):

```
493  await supabase.from('credit_transactions').insert({
496    user_id: project.user_id,
497    amount: refundAmount,
498    transaction_type: 'refund',           // ROW #1  (+refundAmount)
...
504  await supabase.rpc('increment_credits', {   // ROW #2 inside the RPC
505    user_id_param: project.user_id,
506    amount_param: refundAmount,
507  });
```

`increment_credits` (latest def, migration `20260516222626_5f26ec8e...sql`) itself writes
a second positive ledger row AND bumps `profiles.credits_balance`:

```
UPDATE profiles SET credits_balance = COALESCE(credits_balance,0) + amount_param ...
INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
VALUES (user_id_param, amount_param, 'system_grant', 'System credit grant via increment_credits');
```

The spendable balance is read by `get_credit_state` (migration `20260518175601...sql`):
`v_balance := public.credit_ledger_total(p_user_id);` and `credit_ledger_total`
(migration `20260704000000_revert_credit_ledger_repoint.sql`) is:

```
SELECT COALESCE(SUM(amount),0) FROM credit_transactions
WHERE user_id = p_user_id
  AND transaction_type NOT IN ('untracked_increase','audit','security_alert');
```

Neither `'refund'` nor `'system_grant'` is excluded, so BOTH rows count → the user's
spendable balance increases by **2 × refundAmount**. (Side effect: `profiles.credits_balance`
only rises 1×, so that column also drifts out of sync, but it is not the spend source.)
The idempotency guard (lines 317-324 / 483-490) only prevents a *repeat* refund of the same
project — it does nothing about the per-call double-count. **True positive; fix here.**

Severity note: latent, because zombie-cleanup is currently unscheduled (see #6) — but it fires
on any manual invocation or if cron is restored, and the same double-write pattern is the
zombie-cleanup-specific bug (other refund paths use `refund_credits` RPC, not this raw pair).

### 2. CLIP LOST ON IMPORT — **CONFIRMED**

`src/lib/editor/upload-ingest.ts`, `ingestUpload()`. The `video_clips` insert is wrapped in
a catch that only warns and never rethrows:

```
349  dbClipId = await insertWithNextShotIndex({ ... });
362  } catch (e) {
364    console.warn("[upload] video_clips insert threw:", e);   // swallowed, no rethrow
365  }
```

`dbClipId` stays `null`; the DB mirror (`if (dbClipId)` @375) and store mirror (`if (dbClipId)`
@400) are both skipped. Execution falls through to the in-memory ScriptDocument write and a
SUCCESS return:

```
430  const shotId = addShot(sceneId, { ... });
452  if (!shotId) throw new Error("Could not add shot to document");
453  return shotId;                                        // returns success
```

The function's own comment (lines 337-340) states the timeline renders from the `video_clips`
table on load/reload — "Without this insert the clip ONLY exists in the ScriptDocument
constitution layer — the timeline never knows." So when the insert fails the clip shows
transiently in-memory, the caller (`Timeline.tsx:2743 await ingestUploadFn(...)`) fires its
success toast, and the clip is **gone on next reload**. **True positive.**

### 3. continue-production IDOR — **CONFIRMED**

`supabase/functions/continue-production/index.ts`. It authenticates and binds `userId` to the
JWT, but never verifies the caller owns `projectId`:

```
112  const auth = await validateAuth(req);
113  if (!auth.authenticated) { return unauthorizedResponse(...); }
...
133  userId = resolveEffectiveUserId(auth, request.userId);   // JWT-bound for end users
```

`projectId` comes straight from the request body and EVERY query keys on it alone — e.g.
`.eq('id', projectId)` at lines 152, 339, 471, 870, and the project mutations at 145-152 /
863-870 — with **no `.eq('user_id', userId)` (or org) ownership check anywhere**. `validateAuth`
only checks "authenticated", so any logged-in user can POST another user's `projectId` and drive
/ mutate that victim's pipeline (status, `pipeline_stage`, `pro_features_data`, trigger
generation). Internal callers use the service-role key, but the end-user path is fully reachable.
**True positive; add an ownership guard.**

### 4. motion-transfer / stylize-video CHARGE-BUT-NOTHING — **NEEDS-NUANCE**

The user-facing harm (pay, fail, no refund) is real, but the claim's mechanics are partly
imprecise.

- "they deduct credits" — the two fns (`motion-transfer/index.ts`, `stylize-video/index.ts`)
  do **NOT** deduct; they only `validateAuth` → POST to Replicate → return `predictionId`. The
  charge happens in the **caller** `mode-router/index.ts`: `requiresLocalCreditDeduction` includes
  `'motion-transfer'` and `'video-to-video'` (line 379) and `deduct_credits` runs at line 492,
  BEFORE the render call. So credits are genuinely taken.
- "placeholder/invalid version hashes" — hardcoded: `motion-transfer` `DEFAULT_MODEL_VERSION =
  "d6a4c1bc...d2c"` (line 34), `stylize-video` `version: "c02b3c1d...442d"` (line 50). These are
  unlabeled hex strings; the motion-transfer one is a "sensible default" comment, the stylize one
  has no provenance. Very likely non-resolving, but not 100% verifiable without the Replicate API
  — hence nuance.
- "store the prediction id where no webhook/poller reads it" — **partly FALSE.** The predictionId
  IS persisted to `movie_projects.pipeline_state.predictionId` (mode-router lines 1057-1064 /
  1129-1137), and a poller DOES exist: `check-specialized-status/index.ts` ("Polls Replicate
  prediction status for specialized modes (avatar, motion-transfer, video-to-video)"). BUT: (a) no
  Replicate webhook is registered (the POST bodies omit `webhook`), so there is no automatic
  completion; (b) the poller is client-invoked (`predictionId` from request body, line 54) — if the
  client stops polling nothing recovers it; (c) the auto-recovery watchdogs do not cover these
  modes (zombie-cleanup Phase 0 recovery is avatar-only and Phase 1 refund is computed from
  `video_clips` rows, which these modes never create → refund 0; and the watchdogs are unscheduled,
  #6).
- "no refund on failure" — **CONFIRMED.** `check-specialized-status` `handleSingleClip` `failed`/
  `canceled` branch (lines 461-473) only sets `status='failed'` + a pipeline_state error — **no
  refund, no credit_transactions write**. So an invalid version → instant failure → credits lost
  permanently.

Net: NEEDS-NUANCE — fix the missing refund-on-failure (and verify/replace the model versions),
but the "no poller at all" framing is inaccurate.

### 5. ORPHANED REPLICATE PREDICTIONS — **CONFIRMED**

Replicate `/cancel` is invoked in exactly three places, all user-initiated:

```
delete-project/index.ts:90   .../predictions/${predictionId}/cancel
cancel-project/index.ts:215  .../predictions/${predictionId}/cancel
delete-clip/index.ts:142     .../predictions/${clip.veo_operation_name}/cancel
```

There is **zero** `/cancel` in `pipeline-watchdog/index.ts`, `seamless-stitcher/index.ts`, or
`zombie-cleanup/index.ts` (grep across `supabase/functions` returns only the three above). The
auto-failure/timeout paths mark rows `failed` but leave the Replicate prediction running →
billing + compute leak on every timeout. **True positive.**

### 6. WATCHDOG double-disabled — **CONFIRMED**

- Kill-switch: `pipeline-watchdog/index.ts:347` `const watchdogEnabled =
  Deno.env.get("WATCHDOG_RESUME_ENABLED") === "true";` and the early-return at 349-354
  ("DISABLED via kill switch ... reason: WATCHDOG_RESUME_ENABLED is not set to 'true'").
- Unscheduled: migration `20260516045913_2cf255ef-0837-492e-8e99-29723ea6c0d3.sql`:
  `SELECT cron.unschedule('pipeline-watchdog-every-minute'); SELECT cron.unschedule('pipeline-watchdog-every-5min');`
- The other two: a full grep of `cron.schedule(` across `supabase/migrations` finds ONLY
  credit-hold-reconcile, storage-quota, monthly-org-credit-refill, and charge-patron-renewals —
  **no schedule for `zombie-cleanup`, `pipeline-watchdog`, or `admin-stuck-jobs-watchdog`** anywhere
  in the repo. So all three recovery loops are effectively off. **True positive.** (This both
  mitigates #1's blast radius and amplifies #4/#5: nothing auto-recovers or cancels stuck jobs.)

### 7. editor Approve&Render dead — **CONFIRMED**

`installJobRunner` is DEFINED at `src/lib/editor/generation/orchestrator.ts:298` but has **zero
call sites**. Every other hit is a comment or test:

```
src/test/editor/orchestratorNoRunner.test.ts:11  (comment: "installJobRunner has no ...")
src/lib/editor/generation/orchestrator.ts:287     (doc comment)
src/lib/editor/generation/orchestrator.ts:298     (the definition)
src/pages/Editor/components/ShotInspectorCard.tsx:304  (comment: "installJobRunner is never called")
```

No `installJobRunner(` invocation exists, so the render runner is never wired and the
Approve&Render CTA is gated to a disabled stub. **True positive.**

### 8. ungated OpenAI fns — **CONFIRMED (all 6)** (delegated deep-read; verdicts below)

| Fn | model call | reserve before? | verdict |
|----|-----------|-----------------|---------|
| generate-script/index.ts | L373 `gpt-4o-mini` (fetch @364) | none (auth-only @68) | CONFIRMED |
| generate-story/index.ts | L475 `gpt-4o-mini` (+2nd call @521 title) | none (auth @184) | CONFIRMED (2 ungated calls) |
| script-assistant/index.ts | L150 `gpt-4o-mini` (@141) | none (auth @17) | CONFIRMED |
| generate-ad-studio/index.ts | L234 `gpt-4o-mini` (@225) | none (auth @93) | CONFIRMED |
| generate-ad-variants/index.ts | L242 `gpt-4o-mini` (@236, up to 12 variants/14k tok) | none (auth @91) | CONFIRMED |
| regenerate-audio/index.ts | L204 `gpt-4o-mini` (@89→createFlowingNarration) + chains generate-voice @99 | none (auth @29, ownership @59) | CONFIRMED |

Every function gates only on auth (some add content-safety/ownership/validation) before hitting
`gpt-4o-mini`; none performs any credit reserve/deduct/balance-check/`credit_transactions` write.
`generate-story` (2 calls) and `regenerate-audio` (OpenAI + downstream generate-voice) are
doubly exposed.

---

## VERIFICATION VERDICT TABLE

| # | Finding | Verdict | Decisive ref |
|---|---------|---------|--------------|
| 1 | zombie-cleanup double-refund | **CONFIRMED** | zombie-cleanup `493-507` (two +rows) + `increment_credits` system_grant insert + `get_credit_state` → `credit_ledger_total` sums both |
| 2 | clip lost on import | **CONFIRMED** | upload-ingest `362-365` swallow, `453` returns shotId; comment `337-340` (timeline reads video_clips) |
| 3 | continue-production IDOR | **CONFIRMED** | `113` auth-only, `133` JWT userId, queries `.eq('id',projectId)` @152/339/471/870 — no user_id check |
| 4 | motion-transfer/stylize charge-but-nothing | **NEEDS-NUANCE** | charge in mode-router `379/492`; poller exists (check-specialized-status); NO refund on fail `461-473`; no webhook |
| 5 | orphaned Replicate predictions | **CONFIRMED** | `/cancel` only in delete-project:90, cancel-project:215, delete-clip:142; none in watchdog/stitcher/zombie |
| 6 | watchdog double-disabled | **CONFIRMED** | watchdog `347` kill-switch; migration `20260516045913` unschedules both; no cron.schedule for any of the 3 |
| 7 | editor Approve&Render dead | **CONFIRMED** | orchestrator `298` defines installJobRunner; zero call sites (only comments/test) |
| 8 | 6 ungated OpenAI fns | **CONFIRMED** | per-file table above; auth-only before each model call |

Score: 7 CONFIRMED, 1 NEEDS-NUANCE, 0 FALSE-POSITIVE.

---

## JOB 2 — Reconciliation vs prior audit docs

Prior docs read: `AUDIT_REPORT.md`, `SECURITY_REVIEW.md`, `FINANCE_AUDIT_REPORT.md`,
`LOGIC_AUDIT.md`, `ADMIN_REVIEW.md`, `SWEEP_REPORT.md`, `reports/incomplete-audit/BACKLOG.md`,
`MASTER-BUG-LIST.md`, `BUG-SWEEP.md`. New audit = `audit/00..07` + `STATUS.md`.

> Caveat carried from the prior docs: BUG-SWEEP/BACKLOG self-report ~40% false-positive rate on
> agent-flagged "criticals"; `MASTER-BUG-LIST.md` is the authoritative status map (~48 fixed across
> PRs #84–#126, ~360 open). Re-verify any item below against current source before acting (as was
> done here for the stripe-lock/billing-provider claim).

### (a) MISSED — prior-doc findings our new audit (00-07) does NOT cover and should add

Admin (new audit rated several of these pages "DONE" but they are no-ops — highest-value gap):
- **ADMIN_REVIEW #1 (HIGH)** Refunds page issues no real money — `AdminRefundsPage.tsx:78-96` only
  updates `refund_requests`, operator hand-stamps `stripe_refund_id`; no Polar/`reverse_credit_purchase`. (verified)
- **ADMIN_REVIEW #2 (HIGH)** Coupons never reach the provider — `AdminCouponsPage.tsx:104` inserts a
  `discount_coupons` row only; `stripe_coupon_id` null → codes fail at checkout. (verified)
- **ADMIN_REVIEW #4 / #13, LOGIC AD-7 (MED)** Status page + PipelineMonitor fake all-green
  (hardcoded `operational`; health keyed to provider names that don't match `api_cost_logs.service`).
- **AUDIT M-5/M-13 (MED)** Admin finance dashboards disagree on revenue (11.6¢ vs canonical 10¢
  credit→USD constant, `AdminPricingConfigEditor.tsx:143`).
- **LOGIC AD-2 (MED, cost)** AdminAvatarSeeder stale-closure → runaway Replicate spend.

Security / backend not surfaced by new audit:
- **AUDIT H-8 (HIGH)** destructive seed wiped prod financial history (`20260620212254_finance_clear_and_seed.sql`).
- **AUDIT H-9 (HIGH)** 100 fabricated login-capable users seeded into prod auth.users/profiles (`20260301000622...`), never deleted.
- **SECURITY M2 (MED)** SSRF guard doesn't resolve DNS (rebinding bypass, `_shared/ssrf-guard.ts`) — the body-exfil half is fixed, DNS half open.
- **SECURITY M6 (MED)** `api-v1` public API: no rate limiting, no per-key scopes (every key full-access).
- **SECURITY M8 (MED)** `vercel.json` ships no real HTTP security headers (meta-tag XFO/CSP ignored).
- **SECURITY M9 (MED)** open-redirect allowlist includes `*.vercel.app`/`*.pages.dev`/`*.lovable.app` in payment return URLs (`_shared/return-url.ts:52-58`).
- **BACKLOG D25 (MED)** `notify-org-event` SSRF + no timeout; **D26 (MED)** `distribution-manage` no idempotency → double-posts to Meta/TikTok.

Moderation / social / data-integrity (whole area new audit skipped):
- **BACKLOG #22** `user_reports` write-only black hole (no admin RLS/UI/notify).
- **BACKLOG #23** block enforcement only covers DMs+follows (search + social writes ignore blocks).
- **BACKLOG #27/#28/#29** comment/inbox split-brain + dead enum values (`reel_comments` vs `project_comments`, `premiere_scheduled`/`watch_party_invite` enums unregistered → silent notify failure).
- **BUG-SWEEP S341** notification settings have no effect — UI writes `profiles.notification_settings`, delivery reads `notification_preferences`.

Money / missed-promise:
- **BACKLOG #3** creators can connect Stripe but have no withdraw path (payout flow uncovered).
- **LOGIC B-3 (MED)** approvals authz uses `hasPermission("reviewer")` → higher producers can't approve, contradicting matrix.

Other:
- **BACKLOG D42** PWA serves stale build after deploy, no reload path (`main.tsx:299`).
- **ADMIN_REVIEW capability gaps** creator-payout oversight, enterprise-leads CRM, support "Reply" emailing, GDPR export/erasure (status-only) all missing.

### (b) ALREADY-FIXED on this branch (verified by opening source)

- **AUDIT C-2** `send-transactional-email` unauth → FIXED: rejects non-`service_role` (`:83`, "AUDIT FIX C-2").
- **AUDIT C-3** `svg-rasterize` unauth storage write → FIXED: `requireServiceRole(req)` `:70`.
- **AUDIT H-3** `send-push-notification` unauth → FIXED: `requireServiceRole(req)` `:37`.
- **AUDIT H-1** org admin self-promote to owner → FIXED: migration `20260704000200_org_member_role_update_guard.sql`.
- **FINANCE C-NEW-3** org `credits_balance` self-grant via PATCH → FIXED: trigger `fn_organizations_block_sensitive_self_update` (`20260704001100...:23-53`).
- **AUDIT H-4** Stripe-Connect double-payout race → FIXED: `idempotencyKey: sbpayout_${row.id}` (`stripe-connect-payout/index.ts:128-141`).
- **SECURITY H2** `webhook-dispatch` SSRF body exfil → FIXED (`:194`); DNS-rebinding half still open (see M2).
- **SECURITY M1** `delete-clip` credit over-refund → FIXED: capped + idempotent `clip-refund:${clipId}` (`:188-222`).
- **BACKLOG D6** double-stitch race → FIXED: atomic conditional-UPDATE stitch claim in `final-assembly` (`:144-189`).
- **AUDIT C-1 / FINANCE C-NEW-1** frozen credit ledger → FIXED: `credit_ledger_total` repoint reverted to `credit_transactions` (`20260704000000_revert_credit_ledger_repoint.sql`) — confirmed first-hand during #1 above.
- **FINANCE C-NEW-2 / BACKLOG #2** org pool unfunded → FIXED for the Polar path (`monthly_org_credit_refill → topup_org_credits`); Stripe path still unfunded.
- Org-refill ON CONFLICT TOCTOU → FIXED (`20260705021000_org_refill_on_conflict_guard.sql`, HEAD e9062618).
- **FINANCE H-NEW-3** refunds/chargebacks never reversed → FIXED (`reverse_credit_purchase` wired into `polar-webhook`).
- **FINANCE H-NEW-4** 100k grant cap → raised to 1M (`20260704001300`).
- **`stripe-lock.ts` confirmed ABSENT** on this branch (0 refs) — validates the new audit's correction that PR #110's kill-switch is not present here.
- MASTER-BUG-LIST cluster shipped: editor org-role lockout (B-1, #89), `admin_bulk_suspend` column (AD-1), storage cost ×100 (AD-3), notif trigger column/enum rollbacks (D1-D3), follow split-brain unify (#125 / cbc50627), client XSS safeHref + CSV injection (S223-236), account-deletion FK (D39).

### (c) NET-NEW — our audit's findings the prior docs do NOT have

- Entire **iOS surface** (prior docs predate `ios-app`): APNs push broken (token table only staged
  in `reports/ios-pending/`, sole sender is Web-Push/VAPID); Live depends on unapplied
  `20260627_live_rooms` migration + P2P mesh no-SFU; feed `comment_count` always 0; Keychain/deep-link/spend-gating notes.
- **continue-production IDOR** (#3 above) — prior docs flagged `editor-generate-clip` (SEC C1) and
  `generate-music` (D23) IDORs but not this one.
- **Cross-tenant org-injection via permissive-RLS OR-bypass** on `movie_projects` INSERT (client stamps arbitrary `organization_id`).
- **`reserve-credits` never sets `movie_projects.credit_hold_id`** → Studio-v2 holds invisible to reconciler.
- **`oauth-callback` stores OAuth tokens plaintext** into `*_encrypted` columns and swallows persist failure while redirecting success.
- **Orphaned Replicate predictions** on auto-failure (#5) — net-new framing; **`auto-stitch-trigger`
  marks `completed` with no stitched video** (ghost-completed).
- **Preview ≠ export**: 3 client playback engines vs server bake; `StitchedPlayer:757` crossfade
  clobbers per-clip volume/mute; `TimelinePlayer:120` seek→advance parity bug; HLS no error-recovery ladder.
- **motion-transfer/stylize charge-but-deliver-nothing** (#4) — prior S119/S120 covered only `composite-character`.
- **MusicHub persists expiring Replicate URLs** (no projectId → save skipped).
- **Python `breakout_pipeline` proven orphaned** (zero refs outside `python/`).
- **Clip silently lost on editor file-drop import** (#2) — prior #36/D36 covered autosave loss, not import-orphan.
- Health/infra: Electron admin black-screens without baked `VITE_SUPABASE_URL`; 15 stale regression
  tests fail (dead-file existence asserts) blocking green `npm test`; `types.ts` quantified
  (166 tables / 10,256 lines / 249 `as never`; `notification_preferences` + `free_tier_attempts` missing).
- Net-new POSITIVE: admin server-authz verified NOT bypassable (`is_admin()` SECURITY DEFINER + RLS +
  per-RPC guards + edge re-checks all hold).

---

## Top prior-doc items we MISSED (one-line, highest value first)

1. ADMIN Refunds page returns no real money — operator believes refunds processed (HIGH).
2. ADMIN Coupons never created at provider — promo codes fail at checkout (HIGH).
3. AUDIT H-9 — 100 fabricated login-capable users seeded into prod auth, never removed (HIGH).
4. AUDIT H-8 — destructive finance seed wiped prod financial history, still read by analytics (HIGH).
5. SECURITY M6 — `api-v1` public API has no rate limiting and no per-key scopes (MED, abuse).
6. SECURITY M2 — SSRF guard skips DNS resolution → rebinding bypass (MED).
7. BUG-SWEEP S341 — notification settings UI writes a column delivery never reads (MED, silent).
8. BACKLOG #22/#23 — moderation black hole: `user_reports` unactionable + blocks unenforced in search/social (MED).
9. BACKLOG #3 — creators can connect Stripe but have no withdraw/payout path (missed promise).
10. Admin Status/PipelineMonitor fake all-green — real outages never surface (MED).
