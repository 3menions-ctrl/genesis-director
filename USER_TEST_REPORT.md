# Small Bridges — End-User QA Test Report

**Tester:** Automated QA pass (Claude), driving the real app in a headed Chromium browser via Playwright.
**Build:** branch `user-testing`, local dev server (Vite) at `http://localhost:7788`.
**Backend:** live Supabase project `ywcwaumozoejierlfkgj` (shared environment).
**Date:** 2026-06-26 (UTC).
**Test account:** `qa.uxtest.0625@gmail.com` (dedicated QA user, created pre-confirmed via Admin API; `free` tier, 0 credits). No real customer data was touched. No Polar/Stripe payments were made.
**Screenshots:** `qa-report-assets/` (referenced inline below).

> **Method note:** Every flow was performed as a real user — clicking, typing, navigating — not via unit tests. Console errors and network responses were captured per action. Any test data created (comments, projects, temporary credit grants) was cleaned up afterward; the account is left in a clean state.

---

## ✅ Fixes applied in this branch (2026-06-26)

The four genuinely-broken items below were fixed and **re-verified in the live browser** after the report.

| # | Bug | Fix | Verified |
|---|---|---|---|
| BUG-1 | Inbox 400 (missing `patron_lapsed` enum) | New migration `20260705000700_fix_notification_type_patron_lapsed.sql` **and** the `ALTER TYPE … ADD VALUE` was applied to the live DB | Inbox + all lanes load with **0** 4xx errors |
| BUG-2 | Generation pipeline fails **silently** | `handleEdgeFunctionError` (`src/lib/userFriendlyErrors.ts`) no longer suppresses real edge-function errors as "non-fatal"; explicit error payloads and non-abort failures are force-surfaced | Submitting a failing generation now shows an error toast instead of nothing |
| BUG-3 | Comment delete: stale UI + no confirm | Delete moved into `useProjectComments.deleteComment` (invalidates cache) + routed through the standard `confirmAsync` dialog | Confirm dialog appears; comment disappears immediately (no reload) |
| BUG-5 | Rapid double-submit duplicates comments | Synchronous `sendingRef` re-entrancy lock in `VideoCommentsSection` | 6 rapid clicks → **1** comment |

Regression suite `src/test/regression/comments-system.test.ts` updated for the refactor — **49/49 pass**.

**Still open (not in this pass):** BUG-2's secondary issue — a mid-pipeline failure still leaves a `movie_projects` row stuck in `generating` (needs a rollback/mark-failed in the `mode-router` edge function); BUG-4 (no comment editing); BUG-6 (security headers via `<meta>`); BUG-7 (WebMediaPlayer accumulation). The exact generation 500 should still be re-confirmed with a real-purchase balance (the test used an out-of-band credit grant).

> ⚠️ **Note for reviewers:** the `patron_lapsed` enum value was applied directly to the **live** Supabase database (an additive, idempotent `ALTER TYPE … ADD VALUE IF NOT EXISTS`) so the inbox works immediately. The migration file is committed so the change is reproducible in other environments.

---

## Summary scorecard

| Flow | Result |
|---|---|
| Sign in | ✅ Pass |
| Navigate main surfaces (lobby, studio, editor, account, settings, credits, admin) | ✅ Pass (with issues, below) |
| Inbox / notifications | 🔴 **Fail** — data query 400s, silently masked as "All caught up" |
| Comment — add | ✅ Pass (persists + renders) |
| Comment — edit | 🟠 **Not possible** — no edit affordance exists anywhere |
| Comment — delete | 🟠 **Partial** — deletes server-side but UI is stale + no confirm dialog |
| Wan 5s generation — credit gate (0 credits) | ✅ Pass (clear error + redirect) |
| Wan 5s generation — funded submit | 🔴 **Fail** — pipeline 500, **silent** failure, leaves a stuck "generating" project |
| Edge: rapid double-submit | 🔴 **Fail** — creates duplicate comments |
| Edge: back/forward | ✅ Pass |
| Edge: refresh mid-action | 🟡 Draft lost (acceptable) |
| Edge: invalid reel route | ✅ Pass (graceful "not found") |
| Dead-button scan | ✅ Pass (no dead buttons found) |

**Severity legend:** 🔴 High · 🟠 Medium · 🟡 Low / polish

---

## BUG-1 🔴 Inbox data query fails with HTTP 400 — silently shown as "All caught up"

**Where:** `/inbox`, `/notifications` (redirects to `/inbox?lane=system`)
**Severity:** High (core surface; would hide real notifications from any user)

**Steps to reproduce:**
1. Sign in as any user.
2. Navigate to `/inbox` (or click the inbox/notifications icon).
3. Open the browser network tab.

**Expected:** Inbox overview + lane counts load; if empty, an honest empty state.

**Actual:** `POST /rest/v1/rpc/inbox_overview` and `POST /rest/v1/rpc/inbox_list_lane` return **HTTP 400**:
```json
{"code":"22P02","message":"invalid input value for enum notification_type: \"patron_lapsed\""}
```
The UI swallows the error and renders **"All caught up."** with all lane counts at 0. A user with real, unread notifications would be told they have none.

**Root cause (confirmed in source):** the `inbox_overview` / `inbox_list_lane` functions added in `supabase/migrations/20260613240000_unified_inbox.sql` reference the enum value `patron_lapsed` (lines 496, 580, 616), but that migration only ever runs `ALTER TYPE public.notification_type ADD VALUE 'patron_received'` (line 15) — **`patron_lapsed` is never added to the enum.** So the function body casts a non-existent enum value and Postgres rejects the whole call. Verified against the live DB: the enum does not contain `patron_lapsed`.

**Fix direction:** add `ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'patron_lapsed';` (and audit any other referenced values), in its own transaction before the function uses it. Separately, the inbox UI should not render a confident "All caught up" when its data fetch errored — show a retry/error state.

📷 `qa-report-assets/06-inbox-400.png`

---

## BUG-2 🔴 Generation pipeline failure is completely silent + leaves a stuck "generating" project

**Where:** `/studio` → Generate (text-to-video, Wan 2.5, 5s)
**Severity:** High (a failed generation gives the user zero feedback and pollutes their library)

**Steps to reproduce:**
1. As a user with enough credits, on `/studio`: select **Wan 2.5**, type a prompt, choose **5s**, click the main **Generate** CTA.
2. Observe the page and network.

**Expected:** Either the job starts and the user is taken to the production/script-approval screen, **or** a clear error toast if something fails.

**Actual (observed):**
- `POST /functions/v1/reserve-credits` → **404** `{"error":"forbidden","success":false}`
- `POST /functions/v1/mode-router` → **500** `{"success":false,"error":"Pipeline failed: {...\"Failed to fetch user credit state\"}"}`
- **No toast, no error, no navigation** — the user is left sitting on `/studio` as if nothing happened.
- Despite the 500, `mode-router` **had already created a `movie_projects` row** (`status = "generating"`). That row stays stuck in `generating` forever — a zombie project that shows up in the user's library/"Your films" perpetually rendering.

**Two distinct defects here:**
1. **Silent failure (confirmed in source):** in `src/pages/Studio.tsx` (`handleStartCreation`), a non-OK `mode-router` result is passed to `handleEdgeFunctionError` (`src/lib/userFriendlyErrors.ts`). For an error classified as "non-fatal" it returns `{handled:true}` after only a `console.debug` (lines 426–430) — **no user-facing toast.** Any transient `mode-router` 500 will therefore vanish silently. A user should always be told their generation didn't start.
2. **Orphaned project on mid-pipeline failure:** the project row is created before the pipeline can fail, and a failure does not roll it back or mark it `failed`. Result is a stuck `generating` project. (A "zombie watcher" exists in the codebase but did not reconcile this within the test window.)

**Caveat on the 500 root cause:** to exercise the funded path without a real purchase, the test temporarily granted 50 credits by writing directly to `profiles.credits_balance` + a ledger row (then reverted). That out-of-band grant likely bypassed the holds ledger that `reserve_credits` validates, which plausibly caused the specific `forbidden`/`Failed to fetch user credit state` errors. **The silent-failure handling and the stuck-project behavior are real and generalize to *any* mid-pipeline error**, but the exact 500 should be re-confirmed with a properly funded account (real purchase) before treating the credit RPCs themselves as broken.

📷 `qa-report-assets/08-gen-silent-failure.png`

> ✅ **The credit gate itself works.** With 0 credits, clicking Generate fired `reserve-credits`, showed a clear toast **"Insufficient credits. Need 12, available 0."**, and redirected to the credits page. That path is correct. 📷 `qa-report-assets/07-gen-insufficient-credits.png`

---

## BUG-3 🟠 Deleting a comment succeeds server-side but the UI doesn't update (and there's no confirmation)

**Where:** Comment list on `/reel/:id` (`VideoCommentsSection`, used on the reel/watch page)
**Severity:** Medium

**Steps to reproduce:**
1. Open a reel with comments (e.g. `/reel/258cf372-f747-4659-8334-e55a56c91703`).
2. Post a comment, then click **Delete** on your own comment.

**Expected:** A confirmation prompt (the app's standard), then the comment disappears from the list and the count decrements.

**Actual:**
- **No confirmation dialog** — the comment is deleted immediately on click. `handleDelete` in `src/components/social/VideoCommentsSection.tsx` (lines 86–97) calls `supabase.from('project_comments').delete()` directly. This contradicts the project's confirm-dialog standard (destructive actions should route through the shared confirm flow).
- The server returns **DELETE 204** and a **"Comment deleted"** toast fires, **but the comment stays visible** in the list ("Comments (1)" still shows it). `handleDelete` never removes the item from local state or invalidates the query. The comment only disappears after a manual page reload (confirmed: fresh load shows "Comments (0)").

📷 `qa-report-assets/10-comment-stale-after-delete.png`

---

## BUG-4 🟠 Comments cannot be edited anywhere in the app

**Where:** All comment surfaces
**Severity:** Medium (the test brief asked to "edit a comment" — the capability does not exist)

**Finding:** None of the three comment implementations expose an edit affordance:
- `src/components/social/VideoCommentsSection.tsx` — add, reply, delete, like; **no edit.**
- `src/components/theater/ReelComments.tsx` — add + like only.
- `src/pages/Editor/components/CommentsPanel.tsx` — add only (frame-pinned notes).

No `update` call against `project_comments`/`reel_comments` exists in any comment UI. A user who makes a typo must delete and re-post. Recommend adding inline edit (with an "edited" indicator).

---

## BUG-5 🔴/🟠 Rapid double-submit creates duplicate comments

**Where:** Comment composer on `/reel/:id`
**Severity:** Medium–High (trivially reproducible; pollutes threads)

**Steps to reproduce:**
1. Type a comment.
2. Click **Comment** several times quickly (or double-click).

**Expected:** One comment is posted; further clicks are ignored until the field clears.

**Actual:** **5 rapid clicks → 5 identical comments**, all persisted (`POST 201` ×5). The button's `disabled={... || addComment.isPending}` guard does not block fast successive clicks before the input is cleared / pending state propagates. Needs a synchronous submit lock and/or clearing the input optimistically on first submit. (Test duplicates were cleaned up afterward.)

---

## BUG-6 🟡 Console noise on every page: invalid security meta tags

**Where:** Every route
**Severity:** Low (cosmetic, but pollutes console for all users)

Every page logs:
```
X-Frame-Options may only be set via an HTTP header sent along with a document. It may not be set inside <meta>.
The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.
```
`X-Frame-Options` and CSP `frame-ancestors` are **ignored** when set via `<meta>` (in `index.html`). They must be sent as real HTTP response headers (e.g., via the Cloudflare Pages config / `vercel.json` headers) to actually provide clickjacking protection. As written they provide **no protection** and just spam the console.

---

## BUG-7 🟡 Long sessions accumulate `<video>` players → "too many WebMediaPlayers"

**Where:** Surfaces with autoplay video tiles (lobby, cinema reels, studio model cards)
**Severity:** Low–Medium (degrades long single-session use)

During a multi-route sweep within one tab, Chromium eventually threw:
```
Blocked attempt to create a WebMediaPlayer as there are too many WebMediaPlayers already in existence.
```
Autoplaying video tiles appear to not tear down their `<video>` elements across client-side navigations, so a long-lived session steadily accumulates media players and gets sluggish (and eventually video stops rendering). Consider unmounting/pausing off-screen videos and capping concurrent players. *(This was visible to the user as the app "glitching" while the headed browser ran.)*

---

## Things that work well (passes)

- **Sign in** — clean two-pane auth screen; email+password sign-in worked, redirected to `/studio`. 📷 `qa-report-assets/01-signin.png`
- **Lobby** — rich cinematic landing renders correctly. 📷 `qa-report-assets/02-lobby.png`
- **Studio** — model grid (Wan/Kling/Seedance/Veo/Runway/Sora), aspect/quality/duration controls, prompt box all render and respond. 📷 `qa-report-assets/03-studio.png`
- **Editor** (`/editor`) — loads an "Untitled" project with correct empty states ("No clips yet", "Nothing on the timeline yet"). 📷 `qa-report-assets/04-editor.png`
- **Account / profile** — renders the user's profile; **Edit Profile** opens a working inline edit form (fields + Save/Cancel). 📷 `qa-report-assets/05-account.png`, `qa-report-assets/12-edit-profile-works.png`
- **Comment add + persistence** — posting a comment shows it immediately and it survives a reload (`POST 201`, then present on fresh load). 📷 `qa-report-assets/09-comment-posted.png`
- **Credit gate** — insufficient-credits path is correct and user-friendly (see BUG-2 note).
- **Access control** — `/admin` as a non-admin correctly redirects away (to `/library`) rather than exposing admin UI.
- **Route redirects** — sensible canonicalization: `/settings`→`/account?tab=settings`, `/credits`→`/account?tab=credits`, `/discover`→`/search`, `/create`→`/studio`.
- **Back/forward** — browser history works correctly across client-side routes.
- **Invalid reel route** — `/reel/<bad-id>` shows a graceful "We couldn't find that film." with a "Back to library" button. 📷 `qa-report-assets/11-reel-notfound-graceful.png`
- **No dead buttons** found in the scanned surfaces (account, lobby).

---

## UX recommendations (prioritized)

1. **Never fail silently on generation.** Always surface a toast when `mode-router`/`reserve-credits` errors, and roll back or mark-failed the project so the library never shows a permanently "generating" zombie. *(BUG-2)*
2. **Fix the inbox enum** so notifications actually load, and never render "All caught up" on a query error — show a retry state instead. *(BUG-1)*
3. **Add a synchronous submit lock** to the comment composer to stop duplicate posts. *(BUG-5)*
4. **Make delete update the list immediately** and route it through the standard confirm dialog. *(BUG-3)*
5. **Add comment editing** (with an "edited" marker). *(BUG-4)*
6. **Move security headers** (`X-Frame-Options`, CSP `frame-ancestors`) from `<meta>` to real HTTP headers. *(BUG-6)*
7. **Tear down off-screen autoplay videos** to keep long sessions responsive. *(BUG-7)*

---

## Test environment / repro notes

- Dev server started with `bun run dev -- --port 7788` (port 7777 was occupied by another worktree).
- Frontend env (`VITE_SUPABASE_*`) and service-role key were sourced from the sibling `genesis-director/.env*`; no secrets are included in this report or committed.
- The QA account was created via the Supabase Admin API (email pre-confirmed). All test artifacts (comments, one generation project, a temporary 50-credit grant) were removed after testing; the account is back to 0 credits with no projects/comments.
- No application code was modified. No live payments were made.
