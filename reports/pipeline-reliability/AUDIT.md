# Core Pipeline Reliability Audit (create → render → watch)

Lane: pipeline reliability. Branch `agent/pipeline-reliability`. All refs verified against current code.

## Call graph (live path)
UI invoke (Crossover/TrainingVideo/TemplateComposer) → **mode-router** → **hollywood-pipeline** (Kling/Veo/Sora/Wan) or **seedance-pipeline** → script gen (smart-script-generator / generate-script) → **generate-single-clip** (Replicate predict + webhook + self-poll) → **replicate-webhook** OR **poll-replicate-prediction** → **continue-production** (loops clips, then final-assembly w/ 3 retries) → **final-assembly** → **seamless-stitcher** (Replicate cog-ffmpeg, 24h signed URL → movie_projects.video_url) → Production.tsx player.
- `generate-video` is a separate pipeline used ONLY by the breakthrough-FX template feature, not the main create flow. `generate-story` is orphaned.

## State machine
4 uncoordinated status namespaces: `movie_projects.status` (free text, NO check constraint), `pending_video_tasks.stage`, `video_clips.status` (has check), client-only `pipelineStateMachine.ts`. Orphan statuses scanned but never written: rendering/assembling/processing/queued/pending. Multiple stuck states with no terminal transition.

## Failure modes (ranked)
1. **Poll + webhook double-process** (Crit) — check-then-act, no atomic claim → both persist + both fire continue-production = duplicate dispatch/spend. poll:87,283 / webhook:153,394.
2. **Final URL expires in 24h** (Crit, certain) — 24h signed URL written to movie_projects.video_url → finished videos 404 after a day. seamless-stitcher:115,1422.
3. **Missing REPLICATE_WEBHOOK_SECRET silently 401s every callback** (Crit). auth-guard:213-217.
4. Poller gives up after ~25min → defers to watchdog (High).
5. **Watchdog crons are NOT scheduled in source** (Crit) — the unschedule migration exists; no schedule migration anywhere. If the out-of-band schedule is ever lost, every stuck state is PERMANENT. migration 20260516045913.
6. Async stitch path: webhook never arrives → stuck in `stitching` (High).
7. Next-clip chaining is best-effort (console.warn only) → stalls until watchdog (High).
8. Replicate submit errors single-shot, not classified; resilience infra exists but unused on generation create-fns (Med).
9-13: in-line Kling poll timeout; frame-extraction continuity break (silent); charged-for-stuck (zombie refund skips >2h old); orphaned holds; opaque env-missing 500s.

## Known-broken verification
- Wan slug: fixed on live path (generate-single-clip), but `_shared/video-engines.ts:151` has a stale different-owner slug (legacy generate-video only) — latent.
- ffmpeg/cog stitch: RESOLVED (real implementation, not a placeholder).
- 24h URL expiry: CONFIRMED present.
- frozen-balance: largely closed for unconsumed holds; residual: consumed charges on projects aging past 2h zombie window + orphaned holds.

## Observability gaps
- api_cost_logs is `'completed'`-biased (only 1 `'failed'` write) → success-rate reads ~100% falsely.
- render_failures covers stitch stage ONLY.
- No `completed_at`/`failed_at` on movie_projects → time-to-render not measurable at project level.
- analytics_events is client-only (no render_started/completed/failed).
- **Net: render success rate + failure causes are NOT measurable in prod today.**

## Top 8 fixes (with risk)
| # | Fix | Where | Risk |
|---|---|---|---|
| 1 | Schedule the watchdog crons (master fix) | migration | DB (footgun — needs signoff) |
| 2 | Atomic completion claim (poll/webhook race) | webhook + poll edge fns | edge-fn (deployable) |
| 3 | Kill 24h final-URL expiry (public bucket / refresh) | seamless-stitcher | edge-fn (deployable) |
| 4 | Catch-all aging → terminal+refund | watchdog + SQL | DB |
| 5 | Terminal observability (completed_at, real failed cost logs, render_failures everywhere) | migration + edge fns | DB + edge |
| 6 | Fail loudly on missing REPLICATE_WEBHOOK_SECRET | auth-guard + health | edge-fn |
| 7 | Durable next-clip chaining (not best-effort) | gen-clip/poll/webhook + watchdog | edge-fn |
| 8 | Extend zombie refund window + hard linkPipelineHold | zombie-cleanup + pipeline-credits | edge-fn |

Most important: #1 + #2. Most user-visible latent bug: #3.
