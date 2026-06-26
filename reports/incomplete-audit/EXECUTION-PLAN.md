# Small Bridges — EXECUTION PLAN ("once and for all")
> Created 2026-06-26. The single authoritative roadmap to drive every CONFIRMED-REAL issue to done.
> **Supersedes** `MASTER-TASKLIST.md` (M1–M30). Backed by the fully code-verified `MASTER-BUG-LIST.md`.
>
> **This plan exists so no agent ever re-runs discovery.** Discovery is DONE and verified (454 documented → 44 false-positives excluded, 48 already fixed). The work below is the ~315 confirmed-real + ~40 partial items only. Do NOT re-audit; execute.

---

## OPERATING RULES (apply to every unit of work)
Each fix follows the same 4-step loop. A unit is not "done" until all four pass.

1. **UNDERSTAND** — read the cited `file:line` (drift-corrected list is in MASTER-BUG-LIST) + the full surrounding code path. For PARTIAL items, first re-confirm the trimmed claim (the over-stated part is already flagged — fix only the real part).
2. **VERIFY** — reproduce the failure mechanism in code/DB before touching it. For DB claims, check the LIVE prod schema via the Management API (migration files ≠ applied). Never trust the label; ~40% of raw findings were wrong.
3. **FIX** — minimal, in-idiom change. Worktree off `origin/main`. DB changes are surgical migrations recorded in `schema_migrations` (NEVER `db push`). Edge fns deploy via `supabase functions deploy`.
4. **QA** — per layer (below). No PR merges red.

### QA harness by layer
- **Frontend (TS/React):** `tsc --noEmit` clean + `vite build` passes + targeted unit test for any pure logic (e.g. a `safeHref`-style helper) + manual smoke of the exact flow (note the click-path in the PR).
- **Database (SQL):** rollback-safe `DO`-block test that `RAISE EXCEPTION 'RESULT::%'` on the assertion, run against **staging first**; role-simulation (`SET ROLE authenticated`/`anon`) for any RLS/grant change; verify idempotency (re-run = no-op).
- **Edge functions (Deno):** deploy-bundle (validates imports/types) + auth-gate smoke (401 proves load) + **staging end-to-end** for anything that charges/refunds credits or hits a provider.
- **Money/pipeline (the WS-C cluster):** mandatory **full staging run** — create project → generate → observe charge → force each failure mode → assert the ledger nets to zero. A balance-invariant test (`sum(credit_transactions) == balance`) gates promotion to prod.

### Per-PR checklist (paste into every PR body)
`[ ] understood root cause  [ ] verified vs live code/DB  [ ] tsc/build or deploy green  [ ] QA flow exercised  [ ] no scope creep  [ ] bug IDs closed: ____`

### Definition of "once and for all"
A workstream closes only when: every bug ID in it is ✅ in MASTER-BUG-LIST, its QA flow is documented, and a **regression guard** exists where cheap (unit test, DB constraint/trigger, or a balance-invariant check) so the same class can't silently return.

---

## SEQUENCING — impact-first, 8 phases
Ship verified PRs continuously; don't batch a phase into one mega-PR. Rough order = user-facing breakage → money → core workflow → robustness → business → polish → cleanup.

| Phase | Workstreams | Gate |
|---|---|---|
| **1** | WS-A crashes · WS-B social-graph | ship now (FE + surgical DB) |
| **2** | WS-C pipeline-money · WS-D billing-loose-ends | **staging-gated** |
| **3** | WS-E editor-render · WS-F editor-media | ship now |
| **4** | WS-G AI-robustness · WS-H security | ship now (edge staging-smoke) |
| **5** | WS-I moderation · WS-J business-completion | ship now |
| **6** | WS-K auth · WS-L notifications/email · WS-M routing | ship now |
| **7** | WS-N forms · WS-O a11y · WS-P hooks · WS-Q perf/realtime | batchable, low-risk |
| **8** | WS-R feature triage (delete/build) · WS-S dead-code · WS-T i18n | cleanup + product calls |

---

# PHASE 1 — user-facing breakage

## WS-A · Real crashes & bad-state (FE) — ship now
**Bugs:** S206, S213, S214, S221, S222, S64, S55, S62. *(S202–212, S219 are FALSE — skip.)*
**Understand:** the only genuine crash is **S206** — `Inbox` reads `?lane=` from the URL and feeds it to `LANES.find(...)!` unguarded → a bad query param throws. The rest are NaN/`-Infinity` renders (S213/S214), a name-mangle (S221), error-body-saved-as-`.mp4` (S222), and stuck optimistic states (S64 success-without-url, S55 stale auto-stitch dep, S62 Esc-guard misses panels).
**Fix:** guard `.find()` with a fallback lane; clamp divisors (`x>0 ? … : 0`); fix the double-`slice`; add `response.ok` check before `blob()`; complete S64's terminal branch; add the missing dep/flags.
**QA:** tsc+build; unit-test the lane fallback + the margin clamp; smoke Inbox with `?lane=garbage`, a 0-credit pricing package, a name like "john", an expired download URL.
**Risk:** low. **~2 PRs.** Regression guard: unit tests on the pure helpers.

## WS-B · Social-graph unification (DB + FE) — ship now
**Bugs:** #24, #26, #27, #28, #29, S249. (Supersedes M17/M18.)
**Understand:** follow is split across `follows` (canonical) and raw `user_follows` (Search/profile) → counts disagree, approval bypassed, **double-notify** (S249: client insert + server trigger). Comments are split `reel_comments` vs `project_comments`. Inbox lanes filter `reel_comment`-style types but triggers emit bare `comment`/`like`. Premiere/watch-party enum values were never `ADD VALUE`'d.
**Fix:** (1) route ALL follow writes through `toggle_follow`; migrate `user_follows` rows into `follows`; drop the client-side notify (keep the trigger). (2) Pick one comment table, view-migrate the other, repoint both readers. (3) Unify the notification taxonomy (one enum vocabulary; map lanes to it). (4) `ALTER TYPE notification_type ADD VALUE` for the two missing values.
**Verify-first:** check LIVE which tables/triggers exist (prior agents misread migration files). Confirm row counts before migrating.
**QA:** staging migration + rollback-safe assertions (follow A→B reflects in counts + button state + exactly one notification); role-sim the approval gate; re-run idempotency. Then prod.
**Risk:** medium (data migration). **~3 PRs.** Regression guard: a DB trigger/constraint ensuring single follow source + a unique index on the notify path.

---

# PHASE 2 — money & pipeline (STAGING-GATED)

## WS-C · Pipeline money integrity — staging first, then promote
**Bugs:** D4, D7, D8, D9 (real sub-cases only), D10, D11, D12, D14, D17, #9. (Supersedes M6/M11.)
**Understand (the spine):** the hold model's happy path is correct; these are the escape hatches. **D4** avatar+seedance debits twice (no `skipCreditDeduction` on the inner call). **D7/D8** `refund_credits` is hold-blind → a refund on a never-debited hold *mints* credits. **D9** charged-but-no-video leaves projects stuck `generating` + locks the user (the clip-0-consumes-whole-hold sub-claim is FALSE — skip it). **D10** reconciler ignores `processing/pending/rendering/stitching` + cancel never releases the hold + refunds lack idempotency keys. **D11** hollywood calls `isTemporaryReplicateUrl`/`persistVideoToStorage` un-imported → throws after a successful render. **D12** watchdog ships double-credit/frozen-balance/re-fire bugs — **fix BEFORE scheduling its cron (#9).** **D14** photo idempotency inert (needs `project_id`) → up to 4× charge. **D17** PaymentsProvider defaults to dormant Stripe if env unset.
**Fix order (within WS):** D8 (make refund hold-aware — the root enabler) → D7 → D4 → D14 → D11 (import the helpers) → D9/D10 (refund+release on every terminal failure, idempotency keys, reconciler covers all in-flight statuses, cancel releases hold) → D12 (watchdog money correctness) → **then** #9 (schedule the watchdog cron) → D17 (default to Polar).
**QA (mandatory, staging):** full generate→charge→refund matrix on the **staging Supabase project** — for each failure injection (clip-0 429, mid-chain fail, stitch fail, cancel, lost webhook, double webhook), assert: user charged exactly once, refunded exactly once on failure, no project stuck `generating`, **`sum(credit_transactions) == balance`** invariant holds, no orphan predictions. Promote to prod only after the invariant passes across all injections. Watchdog scheduled LAST, after its money bugs are green on staging.
**Risk:** HIGH (money). **~5–6 PRs**, each staging-validated. Regression guard: a scheduled balance-invariant check + idempotency unique indexes on all refund paths.
**Prereq:** staging project ref + service-role key (confirm available before starting).

## WS-D · Billing loose ends — ship now (low-risk)
**Bugs:** #3 (withdraw action/auto-payout), #6 (auto-recharge processor), #2-remainder (BusinessStart self-serve checkout). (Closes M8/M9.)
**Understand:** `stripe-connect-payout` is complete but has no caller; `auto_recharge_enabled` persists with no processor; BusinessStart sets a plan but creates no Polar subscription.
**Fix:** wire a Withdraw action (+ optional payout cron); a balance-watch auto-recharge processor (charges Polar at threshold); BusinessStart → real Polar checkout that funds the org pool (the funding side already landed in #107).
**QA:** staging checkout + payout dry-run; auto-recharge threshold sim. **~2–3 PRs.**

---

# PHASE 3 — core creative workflow

## WS-E · Editor render path — ship now
**Bugs:** #7, #8, #42, #46, #47, S60, S64(if not in WS-A), S65, S66, S67, S68. (Closes M10.)
**Understand:** **#7 is the keystone** — `installJobRunner` has zero callers, so `isRunnerInstalled()` is always false → every render CTA says "coming soon" and #8 (regenerate-take), the render queue, and CrossoverComposer all cascade off it. #42 caps scene load at `.limit(0)`. #46 block-edit affordances dead (doc beats never emitted). #47 versions are session-only.
**Fix:** implement + install the orchestrator runner (submit to `editor-generate-clip` + poll); send `action:"submit"`/`"status"` from TakesDrawer (#8); remove the `.limit(0)`; emit doc beats for inline edit; persist versions to DB; fix the editor keybind/label papercuts.
**QA:** tsc+build; staging end-to-end render of one shot (submit→poll→clip appears); regenerate-take round-trip; verify scene metadata loads >1 scene. **~3–4 PRs.** Regression guard: a smoke test asserting `isRunnerInstalled()` true at boot.

## WS-F · Editor media / playback — ship now
**Bugs:** #43, #44, #45/S297, S280, S281, S284, S293, S294, S295, S296, S298, S299, S301. (Storage/player leaks.)
**Understand:** A1/A2 mixer strips dead + state not persisted (#43); `.json` manifest set as `video.src` (#44); multi-clip download fires N `<a download>` (S297 — overstated but cross-browser-real); ingest hangs with no seek timeout (S280); object-URL/upload leaks (S281/S284); timeline player buffers never released + wrong-buffer black frame after seek (S294/S295).
**Fix:** persist mixer + apply A1/A2; detect `.json` manifest → use the manifest player path (#44); ZIP/merge the multi-download; add seek timeout + revoke-on-error + teardown `src` on unmount; fix the parity/activeKey invariant (S295).
**QA:** tsc+build; smoke ingest a fresh MP4 (no hang), multi-clip download, seek across clips (no black frame), mixer persists across reload. **~3 PRs.**

---

# PHASE 4 — provider robustness & security

## WS-G · AI / edge robustness — ship now (staging-smoke)
**Bugs:** S119, S120, S128–S140, S142, S143, S144, S147, S148, S149, S150, S151, S152, S153. **Runtime-check first:** S121, S122, S123, S124, S145.
**Understand:** **S119/S120** pass a bare `owner/name` slug as Replicate `version:` → always 422 (composite-character bg-removal/compositing always fail). Many edge fns `JSON.parse(choices[0]…)` with no guard → paid-but-500 with no rule-based fallback (S128/S129). No timeouts/retries on Replicate/ElevenLabs/OpenAI → a transient 429 marks a running clip FAILED (S136) or spins to timeout (S139/S140). **S150** concurrent clip-status writes clobber the predictions array. Prompt-injection via interpolated user text (S148/S149).
**Fix:** resolve model slugs → version hashes (or use `owner/name:hash`); wrap every provider `choices[0]`/parse in try/catch with the existing rule-based fallback; add `AbortController` timeout + bounded retry/backoff on all provider fetches; atomic/locked update for the predictions array (S150); validate+cap interpolated prompt inputs.
**Runtime checks (do first, 30 min):** `curl` Replicate for `scribe_v2`/the slugs; confirm `gemini-3-flash-preview` on the Lovable gateway. Fix or fallback per result.
**QA:** deploy-bundle each; staging smoke of composite-character (S119/S120), a forced-malformed provider response (fallback fires, no 500), a simulated 429 (clip not marked FAILED). **~3–4 PRs.**

## WS-H · Security hardening — ship now
**Bugs:** S230, S231, S232, S233, S234 (extend `safeHref`), S235, S236 (CSV injection), S237, S238 (client-trust), D25 (SSRF), D26 (idempotency/timeouts).
**Understand:** `safeHref` (shipped in #112) covers 8 sites; 5 more raw `href` sites remain (S230–234). CSV exporters quote but don't neutralize leading `=,+,-,@` (S235/S236). `notify-org-event` does a plain `fetch` to org-supplied URLs (D25 SSRF — `safeFetch` exists, unused). `distribution-manage` has no cross-request idempotency (D26).
**Fix:** route the 5 remaining hrefs through `safeHref`; a shared CSV-cell sanitizer (prefix `'` on formula-leading cells) applied to all exporters; swap `notify-org-event`'s fetch for `safeFetch` + timeout; add an idempotency key to distribution publish. S238 (client SECURITY_VERSION gate) → note that real enforcement must be server-side (low priority).
**QA:** tsc+build + unit-test the CSV sanitizer (`=cmd`→`'=cmd`) and the new href sites; deploy + smoke `notify-org-event` rejects an internal URL. **~2 PRs.** Regression guard: lint rule or test that raw `href={var}` / un-sanitized CSV doesn't reappear.

---

# PHASE 5 — business & moderation

## WS-I · Moderation & safety — ship now
**Bugs:** #22, #23-remainder (search + write-path block enforcement), #25. (Closes M17.)
**Understand:** `user_reports` is write-only (no admin SELECT/UPDATE RLS, no insert-time alert, admin UI tree-shaken). Block enforcement landed for the feed (#105) but not `search_everything` or like/comment/reaction write paths. `approve-clip-one` has no caller.
**Fix:** admin SELECT/UPDATE RLS on `user_reports` + insert-time alert (route via the admin subdomain); apply the block filter to search + all social write RPCs; wire or delete `approve-clip-one`.
**QA:** role-sim (reporter can't read others' reports; admin can); staging — blocked user absent from search + can't like/comment. **~2 PRs.**

## WS-J · Business / org completion — ship now
**Bugs:** #30, #36, #37, #38, #39, #40, #41, S14, S17–S34 (the real ones), #61, #62. (Closes M27.)
**Understand:** brand-kit and assets write different buckets (#30); invites send no email + accept-invite reads revoked `profiles.email` → no recipients (#36/#37); Drive/Notion/YouTube/LinkedIn are stubs (#38/#39); templates store `{}` (#40); permissions matrix is cosmetic + drops `editor` (#41); plus the S17–S34 business-page papercuts (verified real minus S16/S20).
**Fix:** unify brand storage (one bucket, migrate); build `org_invite` email template + dispatcher + route accept-invite through `org_member_directory` RPC; implement the integration sync workers (or mark "coming soon" honestly); real template save/apply + use-count; enforce the permissions matrix + add `editor`; fix the papercuts (add `editor` to dropdown, brand-asset export source, busy-flag, sort-pill, perpetual-skeleton `if(!orgId)` order, uncapped generate, etc.); guard owner-promotion (#61); replace `window.prompt` (#62).
**QA:** tsc+build; staging invite→email→accept flow; role-sim permissions; smoke each fixed business page. **~4–5 PRs.**

---

# PHASE 6 — auth, notifications, routing

## WS-K · Auth / account — ship now
**Bugs:** #49, #50, #51, #52, #53, D35, D37 (the 2 real races), S1, S93, S96.
**Fix:** remove or wire the OAuth-link buttons honestly (#49 — providers are email-only); add current-password re-auth (#50/S93); enumerate sessions or drop the cosmetic row (#51); read `defaultQualityTier` in the pipeline or remove (#52); wire or remove magic-link (#53); ref-guard 2FA enroll (D35); fix the auth-init ceiling race + theater-fullscreen-close (D37); fix delete-account `{error}` false-success (S1 — critical trust bug); guard sign-out-all double-fire (S96).
**QA:** tsc+build; smoke 2FA enroll (no dup factor), delete-account on a forced server error (no false "deleted"), password change re-auth. **~2–3 PRs.**

## WS-L · Notifications & email delivery — ship now
**Bugs:** #32, #33, #34, #35, D21, D22-remainder. (Closes M19/M20.)
**Fix:** make `ch_email` actually gate email sends (#32); remove the orphan `reel_reactions` notifier + attach or drop `fn_notify_tip_received` (#33/#34); add a cron sweeper for AI-video-replies (#35); fix Resend suppression signature + the `email_change_notice` template (D21); schedule the genuinely-missing crons — `process-email-queue` backstop, `zombie-cleanup` (D22; note refill+patron already scheduled).
**QA:** staging — toggle `ch_email` off → no email; trigger suppression webhook → list grows; cron registered in `cron.job`. **~2 PRs.**

## WS-M · Routing / navigation — ship now
**Bugs:** S37, S59, S264, S265, S266, S268, S269, S275, S276, S279, #65, #29-route. *(S272–274, S277 are PARTIAL hop-only — low priority; S278 FALSE.)*
**Fix:** correct `/u/:id`→`/c/:id` (S37/S266); add `{replace}` on AuthCallback success (S264); validate `next` (S265); add `/workspace/editor/:id` variant (S268 hard 404); preserve `?next` through onboarding (S269); fix the admin allow-list redirect stubs (S275); collapse the 3-hop business `/settings` redirect (S276); graceful `/admin` handling in public build (S279); fix Studio "Theater" dead nav (#65).
**QA:** tsc+build; smoke each route (deep-link, Back button, new-tab). **~2 PRs.**

---

# PHASE 7 — FE quality sweeps (batchable, low-risk, high-volume)

## WS-N · Forms / validation
**Bugs:** S69–S116 (the ~39 confirmed; skip S102/S105 FALSE; trim S81/S97/S100/S106/S108 partials).
**Fix:** add `maxLength`+`.trim()` where unbounded; wrap submits in `<form>` for native validation; disable buttons in-flight (double-submit/dup-row); the CSV sanitizer from WS-H; reset stuck spinners; VoicePalette text fallback (S69). **QA:** tsc+build + smoke the highest-traffic forms. **~3 PRs.** Group by file cluster.

## WS-O · Accessibility
**Bugs:** S154–S191 confirmed (skip S162–166/S187 FALSE), D43, D45-real.
**Fix:** **shared wins first** — one `Slider`/range-with-label fix covers S173–175 (30+ instances); one icon-button `aria-label` sweep (S154–161, S167–172); `role="slider"`+keyboard on the custom seek/volume divs (S176/S177); focus-trap on the hand-rolled `fixed inset-0` modals (S184–186) — or migrate them to Radix; safe-area insets (D43). **QA:** tsc+build + axe spot-check + keyboard-only smoke of the editor. **~3 PRs.**

## WS-P · Hooks hygiene
**Bugs:** S240, S241, S244, S246, S248, S249(done in WS-B), S250, S252, S254, S255, S256, S259, S260, S261, S262, S263 (skip S247/S251/S258 FALSE; trim S242/243/245/253).
**Fix:** fix `isLoading && !isFetching` (S240); stabilize inline-array deps (S241/S244); add `onMutate`/optimistic guards (S248); serialize pref writes (S254); inspect `Promise.all` results for `.error` (S255); clear the uncleared timers + add mount guards (S256); evict the right toast listener (S261); N+1 → batched query (S263). **QA:** tsc+build + smoke the affected hooks. **~2 PRs.**

## WS-Q · Performance & realtime
**Bugs:** S302, S303 (memoize contexts), S304, S306–S317 (query limits/virtualization), S322, S323, S324, S325, S327, S329, S330, S331, S332, S333, S334, S336. **Downgrade:** S321/S326/S304-sub are **perf-only (RLS scopes realtime — no data leak)** — add `filter:` for fan-out cost, not security.
**Fix:** `useMemo` the AuthContext/NavigationLoading values (S302/S303 — careful dep audit to avoid stale values); add `.limit()` to unbounded `select('*')`; debounce/coalesce the full-reload realtime herds (S322–324); add `filter:` to table-wide subs; handle UPDATE/DELETE in comment sub (S329); fix equal-timestamp clobber (S332); gate background polls on visibility (S333/S334); user-key the static channel topics (S325/S336). **QA:** tsc+build + React-profiler before/after on the worst offenders. **~3 PRs.**

---

# PHASE 8 — features (delete/build) & hygiene

## WS-R · Feature scaffolding triage — *delete unused, build launch-critical*
**Decision (per product call):** delete the dead backend for features that don't block launch; build only the launch-critical creator-monetization ones.
| Feature | Call | Action |
|---|---|---|
| **#15 Patron-gated content** | **BUILD** (creator monetization = launch-critical) | composer + gated feed viewer (`creator_posts`/`list_creator_posts` exist) |
| **#16 Atoms marketplace** | **BUILD** (monetization) — *confirm with you* | list/buy/sell UI (`buy_atom`/`atom_listings` exist) |
| **#17 Premieres** | **DELETE** | drop `schedule_premiere`/`rsvp_premiere`/`premiere-recap` + schema (loop can't close, zero refs) |
| **#18 Watch-party** | **DELETE** (or keep realtime-sync core, drop lifecycle) | remove invite/status scaffolding |
| **#19 Webhooks UI** | **DELETE** personal-page prose; business CRUD already works (#19 was PARTIAL) | trim copy only |
| **#20 Cinema billing mgmt** | **DELETE** | remove `verify/list/get` cinema fns if Cinema isn't launching |
| **#21 Widget authoring** | **DELETE** | drop `generate-widget-config` (render side stays) |
**QA:** after each delete, `tsc`+build+import-graph clean (no dangling refs); for the builds, full create→consume smoke on staging. **~2 delete PRs + 1–2 build PRs.**

## WS-S · Dead-code & hygiene
**Bugs:** #54, #55-flag, #56 (~18 orphan edge fns), #58 (`AtomicFrameSwitch` only — `renderQueue`/`demoProject` are USED, per verification), #59 (regenerate `types.ts`), #63 (simulated progress — leave or honest-label), S4, S63, S104 (`window.confirm`→confirmAsync). (Closes M30.)
**Fix:** delete the dead legacy settings tree (#54) after confirming no residual refs; per-fn dynamic-dispatch check then delete the truly-orphan edge fns (#56); delete `AtomicFrameSwitch` only; regenerate `types.ts` (removes ~40 `as never` casts, unmasks real gaps); replace the 3 `window.confirm` sites. **QA:** tsc+build+import-graph after each delete. **~2–3 PRs.**

## WS-T · i18n decision
**Bug:** D44 (PARTIAL — i18n is NOT dead; the AI DOM translator works; only the manual switcher is missing). **Action:** restore a `LanguageSwitcher` (small) OR document the auto-translate behavior and drop the dead switcher import. Product call. **~1 PR.**

---

## TRACKING
- Master status: `MASTER-BUG-LIST.md` — flip each ID to ✅ as its WS lands; cite the PR.
- This file is the plan; `MASTER-TASKLIST.md` (M1–M30) is superseded — the completed M-work is already reflected as ✅ in MASTER-BUG-LIST.
- **Estimated total: ~50–60 PRs** across 20 workstreams. Phases 1–6 are the substance; 7–8 are high-volume-low-risk and cleanup.
- Every PR carries the per-PR checklist and closes named bug IDs. When all phases are ✅, run one final full-app QA pass (the regression guards make this fast) and the audit is closed.

## APPENDIX — WS-B unification design (verified live 2026-06-26, ready for staging)
**Live state (prod, measured — NOT from migration files):**
- `follows` (follower_id, **followed_id**, created_at) — **0 rows**, **3 redundant notify triggers** (`fanout_notify_follow`, `fn_notify_eh_follow`, `fn_notify_follow` — each INSERTs a follow notification → triple-notify if used).
- `user_follows` (id, follower_id, **following_id**, created_at) — **11 rows** (the live data), 1 trigger (`fn_notify_user_follow`).
- `toggle_follow(p_target)` = the **canonical writer**: auth + self + **block check** + **private-account approval gate** (`mutual_only` → `follow_requests`) → INSERT `follows`. This is the correct path and satisfies #24.
- FE on `user_follows` (raw): `useSocial` (5 sites), `usePublicProfile` (6), `SearchHub` (1). FE on `follows`/`toggle_follow`: `Profile`, `ProfileDashboard` (toggle + read), `DirectorCards` (read).
- ✅ S249 (client double-notify in usePublicProfile) already removed (#123).

**Migration (run on STAGING, validate invariants, then promote):**
1. `INSERT INTO follows(follower_id, followed_id, created_at) SELECT follower_id, following_id, created_at FROM user_follows ON CONFLICT DO NOTHING;` (11 rows).
2. **Dedupe `follows` triggers → exactly 1 notification.** Verify whether `fanout_notify_follow` also does feed-fanout (if so keep it + drop the 2 notify-only); else keep `fn_notify_follow`, drop `trg_fanout_notify_follow` + `trg_notify_eh_follow`.
3. Repoint `useSocial` + `usePublicProfile` + `SearchHub`: **write via `toggle_follow` RPC** (inherits block+approval gate), **read from `follows`** (rename `following_id`→`followed_id` in queries/counts).
4. Verify `follows` RLS permits the FE follower/following reads.
5. Drop `user_follows` (or alias as a VIEW over `follows`) after the FE deploy is confirmed.
**QA invariant:** follow A→B once → exactly 1 `follows` row + exactly 1 notification + button-state + follower/following counts agree on Profile, ProfileDashboard, Search, public profile; private-account follow → a `follow_request` (no `follows` row); re-tap is idempotent.

**#27 comments:** `reel_comments`(2) vs `project_comments`(2) — pick `reel_comments` canonical (Theater/Lobby), view-migrate `project_comments`, repoint `/r/:id` reader. Same staging QA.
**#28 inbox taxonomy:** unify on the bare types (`comment`/`like`/`follow`) the triggers emit; remap Inbox lanes (which currently filter `reel_comment`-style).
**#29:** SUBSUMED by WS-R — deleting premieres/watch-party removes the need for the missing `premiere_scheduled`/`watch_party_invite` enum values (don't add dead values).

## IMMEDIATE NEXT STEP
Phase 1 / WS-A (real crashes) — safe, fast, high-visibility. Then WS-B (social-graph) needs a staging migration. WS-C (money) needs the staging project ref + service key confirmed first.
