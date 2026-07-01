# Genesis Director — QA Reliability Audit · SUMMARY

**Date:** 2026-06-30 · **Method:** read-only full-chain code tracing (UI control → handler → hook/mutation → edge function → DB table/RPC → RLS → response → UI update), every table/RPC/column verified against `supabase/migrations/` and `src/integrations/supabase/types.ts`. Surfaces partitioned across 10 parallel QA passes; per-surface detail in `qa-audit/partials/`.

> **Live-driving note:** this worktree has no `.env.local` / Supabase credentials and the mandate was *never prod*, so Playwright-against-a-running-backend was not safely possible. All findings are **code-contract certain**; anything whose final proof needs a live backend (a real render, prod DB state, provider secrets) is marked **UNVERIFIED** rather than asserted. No source was modified.

---

## Headline counts

- **~500 user-facing functions/controls inventoried** across web, business, admin, and the iOS-shared React surface (108 routes, ~150 edge functions, 419 migrations).
- **~94 defects found:**

| Severity | Count | Meaning |
|---|---|---|
| **P0** — core flow broken | **2** | Every finished film dies after 24h; Retry bricks the clip it touches |
| **P1** — major | **20** | Whole actions/flows fail or charge-and-lose |
| **P2** — moderate | **37** | Feature degraded, silent failure, or unreachable-but-advertised |
| **P3** — minor/trivial | **35** | Cosmetic, dead-code-with-misleading-surface, no-feedback |

- **Plus (not counted as bugs):** ~12 fully-orphaned edge functions (built, zero callers, no UI), and ~10 honestly-disclosed intentional stubs (Stripe-lock billing fns, "coming soon" business tiles). The Stripe billing functions returning 503 are **deliberate** (provider is Polar) — not bugs.

**Bottom line:** the user's instinct is right — the **production pipeline** and **basic interactions** have real, central breaks. The *front half* of the create flow is structurally sound (script → approval → clip-1 dispatch all wire up correctly); the damage is concentrated in the **back half** (stitch finalization, durable URLs, recovery, retry) and in a long tail of **"looks implemented, doesn't persist / no feedback"** controls across settings, library, business, and the editor.

---

## The "liking comments fails" complaint — explained

The reported symptom is real but subtle:
- On **desktop**, comment likes work — they go through emoji `comment_reactions` via a proper toggle RPC.
- On **touch devices (mobile/iOS app)** the like/react buttons **and** the reply/edit/delete row are `opacity-0 group-hover:opacity-100` (`VideoCommentsSection.tsx:64,185`). With no hover on touch, the controls are **invisible and untappable** — so to a mobile user, "liking a comment" (and replying/editing) simply does nothing. See BROKEN P2 "Comment actions are hover-only."
- Separately, the legacy `useSocial.likeComment` mutation *is* genuinely broken (insert-only, no toggle, orphan count) but it's **dead code** — not wired to any button. (P3.)

---

## Top 10 to fix first (ordered)

1. **[P0] Final-film URL dies after 24h.** Canonical `movie_projects.video_url` is a 24h Supabase **signed URL into the private `published-renders` bucket**; the "durable URL" guard only recognizes `replicate.delivery`, so the expiring URL is stored as permanent. **Every finished film stops playing/downloading ~24h after render.** → Persist the master to a public bucket (`getPublicUrl`, like clips already do) or re-sign on read. (`seamless-stitcher` `:115`, `_shared/video-persistence.ts:15`, `hollywood-pipeline` `:6485`, `final-assembly:302`)
2. **[P0] "Retry" bricks the clip.** `retry-failed-clip` holds the project generation lock then calls `generate-single-clip`, which re-acquires the same non-reentrant lock → 409; the catch never reverts the clip or releases the lock → clip stuck `generating` forever and permanently un-retryable. → Thread the held lock through (`isRetry` is sent but never read); revert+release on catch. (`retry-failed-clip:130,320`; `generate-single-clip:1503`)
3. **[P1] Stitched film never finalizes in the DB (Production-page path).** `auto-stitch-trigger` sets `status='stitching'` but its success branch never writes `status='completed'`/`video_url` (and project-mode `includeIntro=true` gates the stitcher's own write off) → project stuck "stitching" forever after a fleeting client-side "ready". → Write completion in DB on success. (`auto-stitch-trigger:227,281`; `seamless-stitcher:310,1102`)
4. **[P1] Can't fix a bad script, and a bad draft locks the whole studio.** "Regenerate" 500s every time (`hollywood-pipeline` has no `regenerate_script` action) AND a stuck `awaiting_approval` project makes every new "Create" return 409 `active_project_exists`. Combined, a user who dislikes the first draft is wedged (and credits are already held). → Implement the regenerate action; auto-expire stale drafts + give a one-click cancel-and-restart. (`Production.tsx:1262`; `mode-router:342`; `hollywood-pipeline:6314,6876`)
5. **[P1] Editor & free-tier clips charge then orphan.** `editor-generate-clip` and `free-tier-generate` register **no webhook and no poller** — if the user navigates away the Replicate result is never stored, never inserted, never refunded; the watchdog can't see it. → Register `replicate-webhook` / insert a pending `video_clips` row at submit. (`editor-generate-clip:371,449`)
6. **[P2 — but this is the reported "liking comments" bug] Comment actions are hover-only.** Like/react + reply/edit/delete on comments are `opacity-0 group-hover:opacity-100` → invisible & untappable on touch (mobile/iOS). → Make the action row tap-visible on touch viewports. (`VideoCommentsSection.tsx:64,185`)
7. **[P1] Photo edit charges but never refunds on failure.** `idemKey` is block-scoped to the deduct block; both refund sites throw `ReferenceError` before `refund_credits` runs → user loses credits on every gateway error. → Hoist `idemKey` to function scope. (`edit-photo/index.ts:173,277,306`)
8. **[P1] Delete account fails for everyone.** Both settings surfaces invoke `delete-user-account` with **no body**, but the fn requires `password` or `confirm:'DELETE MY ACCOUNT'` → always 400 (and the UI's "DELETE" string never matches anyway). → Send the required body. (`SecuritySettings.tsx:138`, `SettingsDashboard.tsx:2508`, `delete-user-account:62`)
9. **[P1] Library delete leaks storage + keeps billing + can't delete genesis films.** Library uses a raw `movie_projects.delete()` instead of the `delete-project` edge fn → orphaned storage, uncancelled Replicate predictions (ongoing spend), and a hard FK failure for projects with `genesis_scene_clips` (delete just fails). → Route through `functions.invoke('delete-project')`. (`Library.tsx:223`)
10. **[P1] Environments "Apply scene" silently fails for ~102 of 122 scenes.** The page lists 122 environments but `loadEnvironment` resolves IDs against a hard-coded 20-item preset map with no registry fallback → "Environment not found" after a misleading success toast. → Resolve via `getEnvironmentBlueprint(id)`. (`useTemplateEnvironment.ts:1456`, `Environments.tsx:532`)

**Honorable mentions (fix soon):** Business onboarding is *fully blocked* by an RLS check referencing a non-existent `email` column — no org can ever be provisioned (`BusinessStart.tsx:279`, P1). The recovery layer is largely dormant (`pipeline-watchdog` disabled-by-default & unscheduled in repo, `zombie-cleanup` unscheduled, `resume-avatar-pipeline` blind to the modern async model — P1 cluster). The hollywood quality-gate (`comprehensive-validation-orchestrator`) passes every clip because all 6 sub-validators are missing from the repo (P1). `stylize-video`/`motion-transfer` ship placeholder Replicate model versions and likely 422 (P1).

---

## Where the breaks cluster (by surface)

| Surface | Inventoried | Worst finding | Partial |
|---|---|---|---|
| Production pipeline (render/back-half) | ~50 | **P0 ×2** + ~11 P1 — the heart of the app | `partials/03-pipeline-render.md` |
| Studio assets + Editor | ~70 | 5 P1 (render dead, edit-photo refund, environments, stylize/motion) | `partials/10-studio-editor.md` |
| Production pipeline (create/front-half) | ~45 | P1 regenerate + the awaiting-approval lock-up | `partials/02-pipeline-create.md` |
| Business workspace | ~110 | onboarding fully blocked; reports empty | `partials/08-business.md` |
| Settings / Account | ~40 | delete-account broken for everyone | `partials/05-settings-account.md` |
| Library / Media | ~33 | Library delete leaks/ FK-fails | `partials/07-library-media.md` |
| Social interactions | ~45 | hover-only comment actions (mobile); mostly healthy | `partials/01-social.md` |
| Credits / Payments | ~38 | no in-app way to cancel/manage a sub | `partials/06-credits-payments.md` |
| Admin console | ~35 | watchdog `verify_jwt` mismatch; otherwise solid | `partials/09-admin.md` |
| Auth / Onboarding | ~30 | all LOW; real risk is email-hook config (UNVERIFIED) | `partials/04-auth.md` |

See `BROKEN.md` for the full sorted bug list, `PIPELINE.md` for the production-pipeline deep dive, and `FUNCTION-INVENTORY.md` for every function with its code path.
</content>
