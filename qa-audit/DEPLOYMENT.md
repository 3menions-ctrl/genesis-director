# Deployment status — 2026-07-01 (post sign-off)

## LIVE in prod now (`ywcwaumozoejierlfkgj`)

### DB
- **P1-20** onboarding RLS fix — applied via Management API + verified; repo migration `20260706010000`.

### Edge functions (deployed via `supabase functions deploy --use-api`, all ACTIVE, version +1, boot-verified)
| Function | v | Batch fix |
|---|---|---|
| generate-single-clip | 16 | P0-2 lock-reuse (ownedLockId) |
| retry-failed-clip | 10 | P0-2 deadlock + revert/release |
| hollywood-pipeline | 15 | P0-1 persist import, P1-2 regenerate_script |
| final-assembly | 16 | P0-1 durable final URL |
| auto-stitch-trigger | 11 | P1-1 finalize project |
| mode-router | 13 | P1-3 stale-draft auto-expire |
| pipeline-watchdog | 11 | P1-8 idempotent refund |
| check-specialized-status | 4 | P1-6 terminal-fail branch |
| generate-project-trailer | 10 | P1-12 real clips-mode + durable |
| brand-video-download | 3 | P1-13 stitcher concat (no corrupt mux) |
| edit-photo | 14 | P1-15 refund scope fix |
| analyze-reference-image | 10 | P2-27 honest no-op |

(`_shared/url-durability.ts` + `video-persistence.ts` guard broadening ship bundled with the above.)

Boot check: each returns a handler-generated 4xx (auth/validation), not a 5xx module/boot error.

## NOT live yet — needs a merge to `main` (Vercel auto-deploys `main`)
All **client/web** fixes are on the `qa-audit` branch only:
- Batch 3–5 UI: comment controls (touch), Library delete→edge fn, Environments apply,
  `/settings` (email/privacy/deactivate/sessions), billing portal button, music duration,
  reaction toggles, playback onError + render poll, cast-delete confirm, toggle error handling, etc.
- Client recovery-hook fixes (useClipRecovery, useRenderCompleteNotifier).

**To ship these:** merge `qa-audit` → `main` (open a PR). Vercel builds+deploys `main` to
smallbridges.co. This also brings the repo source of truth in line with the edge functions
already deployed above.

## Still deferred (see DEFERRED.md + PROD-RECONCILIATION.md)
- P2-26 photo idempotency (needs a careful `deduct_credits` RPC change — core money RPC).
- Free-tier delivery (table absent in prod; needs the build).
- P1-8 recovery scheduling: `zombie-cleanup`/`pipeline-watchdog` still NOT on cron in prod —
  the watchdog CODE fix is now deployed, so scheduling `zombie-cleanup` (sound, idempotent) is
  a safe next step when you want auto-recovery live.
- P1-5 avatar webhook race, resume-avatar rewrite, crossover slug, timeline-render scenes[].

## Operational
- P0-1 backfill (`scripts/backfill-durable-video-urls.mjs`) still not run — repairs films whose
  URLs were stored before the forward fix. Run against prod after the merge (creds available).
