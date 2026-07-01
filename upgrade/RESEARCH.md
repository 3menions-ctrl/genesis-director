# RESEARCH — Best-practices brief (Phase A1)

Current (2024–2026) best practices for an AI video-generation + browser-editor app, tuned to **this** stack: React/TS · Supabase edge functions (Deno) · Replicate (webhooks) · Supabase Postgres + Realtime. Each area: **Principles → Patterns to adopt (why it fits this app) → Mistakes to avoid**, with sources.

---

## Area 1 — Media-processing / render pipeline robustness

### Principles
- **Model the pipeline as a durable state machine, not one long request.** Each stage (script → storyboard → per-clip → stitch) executes and persists independently; on failure you replay from the last checkpoint, skipping completed stages. Serverless functions are short-lived and die mid-job, so progress must live in Postgres, never function memory. ([Inngest — Principles of Durable Execution](https://www.inngest.com/blog/principles-of-durable-execution))
  - *Fits us:* the pipeline already stores `movie_projects.pipeline_state` and `video_clips.status`; the gap is making them the authoritative replay source rather than relying on a self-chaining webhook.
- **Replicate webhooks are at-least-once, out-of-order, and droppable.** Handlers must be idempotent, ignore any event after a terminal state, and discard regressions. A single missed terminal webhook silently strands a job. ([Replicate — Receive webhooks](https://replicate.com/docs/topics/webhooks/receive-webhook))
  - *Fits us:* our completion path leans on `replicate-webhook` + a self-chaining poller; today there is no live reconciler backstop (watchdog crons are unscheduled), so a dropped webhook hangs the run forever.
- **Webhooks alone are never enough — layer retries + replay + reconciliation.** "Retries handle minutes, replay handles hours, reconciliation handles everything else." ([Hookdeck — Webhooks at Scale](https://hookdeck.com/blog/webhooks-at-scale))
- **Ack fast, work async.** Return 2xx within seconds; long work in the handler triggers Replicate retries → duplicate processing. ([Replicate webhooks](https://replicate.com/docs/topics/webhooks))
- **External artifacts are ephemeral.** `replicate.delivery` output URLs expire after **1 hour**; anything not copied is gone. ([Replicate — Output files](https://replicate.com/docs/topics/predictions/output-files))
- **Trade ACID for compensations (Saga).** A run spanning credits + external inference can't be one transaction; on failure, compensating actions undo prior effects (e.g. refund credits). ([microservices.io — Saga](https://microservices.io/patterns/data/saga.html); [Azure — Saga](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga))

### Patterns to adopt (why they fit)
1. **Stay in-stack with pgmq + pg_cron + Edge-Function workers.** Supabase Queues (built on `pgmq`) gives Postgres-native guaranteed delivery, visibility timeouts, retry/archival. `pg_cron` periodically `net.http_post`s a worker that drains via `pgmq.read_with_poll`. Map each pipeline stage to a message; enqueue the next stage only after the current result is persisted. *Fits us:* zero new infra — we already run Supabase + pg_cron (the credit-hold reconciler proves it). ([Supabase Queues](https://supabase.com/docs/guides/queues); [Supabase — Processing large jobs with Edge Functions](https://supabase.com/blog/processing-large-jobs-with-edge-functions))
2. **Idempotency keyed on prediction ID.** `INSERT … ON CONFLICT` on `(prediction_id, terminal_status)` so concurrent duplicate webhooks can't double-process. *Fits us:* directly hardens `replicate-webhook` + `poll-replicate-prediction`. ([Digital Applied — Webhook Reliability 2026](https://www.digitalapplied.com/blog/webhook-reliability-idempotency-retries-engineering-reference-2026))
3. **Verify webhook signatures** on every inbound Replicate event before trusting it. *Fits us:* `replicate-webhook` already verifies — keep and extend the discipline to the poller-driven path.
4. **Capped exponential backoff + jitter, then a DLQ.** Full/decorrelated jitter avoids retry storms; after max retries move to a dead-letter queue for inspection/replay. *Fits us:* `_shared/network-resilience.ts` already does backoff+jitter; the DLQ tier (`pipeline-failsafes.ts`) exists but is dead — wire it. ([AWS Builders' Library — Timeouts, retries, backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/); [AWS — SQS DLQ replay](https://aws.amazon.com/blogs/compute/using-amazon-sqs-dead-letter-queues-to-replay-messages/))
5. **Watchdog/reconciler cron.** A `pg_cron` job finds runs in non-terminal states past a deadline, polls Replicate's prediction API for true status, and advances or fails the saga. *Fits us:* `pipeline-watchdog` + `zombie-cleanup` + `_shared/replicate-recovery.ts` already implement this — they are just **not scheduled**. ([Hookdeck — Webhooks at Scale](https://hookdeck.com/blog/webhooks-at-scale))
6. **Compensating credit refunds via the ledger.** Credits live in `credit_transactions`; a compensation = an offsetting entry, idempotent if keyed by `(run_id, stage, "refund")`. *Fits us:* `_shared/pipeline-failure.ts` does this correctly and hold-aware; the bug is `zombie-cleanup` does NOT. ([microservices.io — Saga](https://microservices.io/patterns/data/saga.html))
7. **Persist artifacts immediately** (copy Replicate output into Storage inside the 1-hour window, or set `output_file_prefix` to write directly to the bucket). *Fits us:* `_shared/video-persistence.ts` already copies clips; the gap is at the **final** stitched URL. ([Replicate — Output files](https://replicate.com/docs/topics/predictions/output-files))
8. **Sign-at-read, never store signed URLs.** Generate short-TTL signed URLs on demand at access time; store the storage path. *Fits us:* directly fixes the "final film rots after 24h" bug. ([AWS — Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html))
9. **Progress via persisted state + Realtime.** Persist granular per-stage progress on the run row as source of truth (survives reload); push live via Realtime; the client reflects DB state. *Fits us:* `Production.tsx` already subscribes to Realtime — feed it real stage/message data instead of a simulated ramp. ([Supabase Queues blog](https://supabase.com/blog/supabase-queues))

### Mistakes to avoid
- Heavy work in the webhook handler (>2s → retries → duplicates). ([Replicate webhooks](https://replicate.com/docs/topics/webhooks))
- Assuming exactly-once / in-order webhooks; not de-duping on prediction ID. ([Replicate — Receive webhooks](https://replicate.com/docs/topics/webhooks/receive-webhook))
- Relying only on webhooks with **no reconciler** — one dropped terminal event strands the run and holds credits forever. ([Hookdeck](https://hookdeck.com/blog/webhooks-at-scale))
- Storing/returning `replicate.delivery` URLs or persisting signed URLs (expiry → broken videos). ([Replicate — Output files](https://replicate.com/docs/topics/predictions/output-files))
- Retries without jitter/cap; no DLQ → poison messages loop forever. ([AWS Builders' Library](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/))
- Debiting credits with no compensation path → users pay for failed renders. ([microservices.io](https://microservices.io/patterns/data/saga.html))

---

## Area 2 — Video-editor UX (browser NLE)

### Principles
- **Decouple the audio clock from JS timers.** `setTimeout`/`setInterval` get delayed tens of ms by layout/GC; schedule audio against `AudioContext.currentTime`, use JS timers only for lookahead bookkeeping. ([web.dev — A tale of two clocks](https://web.dev/articles/audio-scheduling))
- **Pick one master clock and slave everything to it.** In Chromium `video.currentTime` is backed by the audio clock, so audio is the natural master; mixing independent clocks accumulates drift over long timelines. ([Andrew Best — audio drift](https://medium.com/@andrew_best/why-your-screen-recording-audio-is-out-of-sync-and-how-to-fix-audio-drift-forever-a6738c729f52))
- **`<video>` seeking is not frame-accurate.** Make playback (smooth, best-effort) and export (frame-exact, deterministic) separate code paths; use WebCodecs where exactness matters. ([web.dev — requestVideoFrameCallback](https://web.dev/articles/requestvideoframecallback-rvfc))
- **Responsiveness = proxies + sprite sheets, not full-res source.** Measure scrubbing by *seek latency* (drag → correct frame). ([CodeKerdos — timeline preview pipeline](https://blog.codekerdos.in/how-timeline-preview-works-the-process-pipeline-behind-video-hover-thumbnails/))
- **WYSIWYG comes from sharing one render graph** — preview and export run the same decode→composite→encode pipeline; only the sink differs (screen vs MP4). ([W3C — Clipchamp/WebCodecs](https://www.w3.org/2021/03/media-production-workshop/talks/soeren-balko-clipchamp-webcodecs.html))

### Patterns to adopt (why they fit)
**Playback & scrubbing**
- **Drive the compositor with `video.requestVideoFrameCallback`** (not rAF). It fires at the video's true frame rate and gives `mediaTime` (exact PTS), `presentedFrames` (drop detection), `expectedDisplayTime`. *Fits us:* our `StitchedPlayer` already paints via `ctx.drawImage` on a 60Hz loop — swapping the driver to rVFC tightens timing and enables drift correction.
- **Use the existing dual `<video>` buffers as A/B preroll** — seek B to the next in-point and await `seeked`/first rVFC before the cut. *Fits us:* the A/B engine is already built; this just gates the cut on a decoded frame.
- **Coalesce scrub seeks** (>3 pending → jump to latest, drop the rest). *Fits us:* our scrub already drift-guards >0.25s; add coalescing.
- **Two-tier timeline thumbnails:** cheap low-res sprite sheets for hover/scrub, high-res frame only on pause/click; draw filmstrips to canvas. *Fits us:* timeline currently has no filmstrip — this is the standard CapCut/Clipchamp approach. ([Better Programming — timeline filmstrips](https://medium.com/better-programming/how-video-editors-implement-timeline-filmstrips-using-ffmpeg-and-javascript-a4683ddaeb3c))

**Audio scheduling & crossfades**
- **Lookahead scheduler:** ~25 ms `setInterval` schedules every event within a ~100 ms window against the audio clock. ([web.dev — audio-scheduling](https://web.dev/articles/audio-scheduling))
- **Equal-power crossfade** between different clips — midpoint at **0.707 (−3 dB)**, not 0.5, to avoid the audible dip. *Fits us:* `StitchedPlayer` already uses a cos/sin equal-power blend — keep it; the fix is making duration/kind user-controllable.
- **Resync, don't free-run.** Each rVFC tick compare `mediaTime` vs `audioCtx.currentTime`; correct video if divergence exceeds a frame. ([Andrew Best](https://medium.com/@andrew_best/why-your-screen-recording-audio-is-out-of-sync-and-how-to-fix-audio-drift-forever-a6738c729f52))

**Render / export**
- **Default to WebCodecs (`VideoEncoder`/`VideoDecoder`) for client-side export** — hardware-accelerated, far faster/more efficient than `ffmpeg.wasm`. JS does cheap demux/mux; WebCodecs does heavy encode/decode. ([VidStudio — WebCodecs vs ffmpeg.wasm](https://vidstudio.app/blog/webcodecs-vs-ffmpeg-wasm); [Remotion — WebCodecs misconceptions](https://www.remotion.dev/docs/webcodecs/misconceptions))
- **Export by replaying the same compositor offscreen:** decode → composite each frame to `OffscreenCanvas` in a Worker → `new VideoFrame(canvas)` → `VideoEncoder` → mux to MP4. The proven WYSIWYG path. ([dev.to — WebCodecs + OffscreenCanvas + Worker](https://dev.to/nareshipme/how-to-render-and-export-video-in-the-browser-with-webcodecs-offscreencanvas-and-a-web-worker-mm3); [WebAV](https://github.com/WebAV-Tech/WebAV))
- **For us specifically — prefer a server-side bake.** Our stitcher already runs `ffmpeg` on a Replicate cog (`_shared/seamless-command.ts`) and produces exactly the filter graph (xfade/acrossfade/drawtext/sidechain) an editor export needs. The shortest correct path to WYSIWYG export is to send the editor's edit decision list (trims/transitions/grades/mixes) to that same backend bake, with a WebCodecs client path as a later enhancement and a Safari/long-render fallback. ([VidStudio](https://vidstudio.app/blog/webcodecs-vs-ffmpeg-wasm))

### Mistakes to avoid
- Scheduling audio from `setTimeout`; assuming `currentTime=t` lands on a frame; compositing from rAF (runs ~60Hz regardless of clip rate). ([web.dev — rVFC](https://web.dev/articles/requestvideoframecallback-rvfc))
- Linear/equal-gain crossfades between different clips (audible −6 dB dip). ([Production Expert — equal power vs equal gain](https://www.production-expert.com/home-page/2019/01/04/crossfades-equal-power-or-equal-gain))
- Building separate preview vs export renderers (breaks WYSIWYG); compositing on the main thread (freezes UI); making `ffmpeg.wasm` the primary export path. ([W3C/Clipchamp](https://www.w3.org/2021/03/media-production-workshop/talks/soeren-balko-clipchamp-webcodecs.html); [Remotion](https://www.remotion.dev/docs/webcodecs/misconceptions))

---

## Area 3 — Delightful communication / feedback UX

### Principles
- **Feedback shrinks perceived time** ~11–15% vs none; a silent, frozen-looking UI reads as failure, and after ~30s of a static "Processing…" most users assume a freeze. ([NN/g — Progress Indicators](https://www.nngroup.com/videos/progress-indicators/); [Psychology of Loading Screens in AI Interfaces](https://medium.com/design-bootcamp/the-psychology-of-loading-screens-in-ai-interfaces-4a01a402721d))
- **Match feedback to duration (RAIL):** <1s show nothing; 1–10s determinate/step indicator; **10s+ give control** (background + notify); respond to input in <100ms. ([web.dev — RAIL](https://web.dev/articles/rail); [Pencil & Paper — Loading Feedback](https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback))
- **Information feedback beats activity feedback** — skeletons (what's coming) feel faster than spinners. ([Onething — Skeleton vs Spinner](https://www.onething.design/post/skeleton-screens-vs-loading-spinners))
- **Labor Illusion: showing the work raises perceived value.** Visible sub-steps/counts/intermediate results make users *more* satisfied with minutes-long AI work — the single biggest lever here. ([HBS — The Labor Illusion (Buell & Norton)](https://www.hbs.edu/faculty/Pages/item.aspx?num=40158))
- **Honesty over false precision** — indeterminate-but-honest beats a bar stuck at 90% or a fabricated ramp. ([cenanulker — Progress Bars](https://www.cenanulker.com/post/why-progress-bars-in-ux-design-secretly-control-your-users-patience-and-how-to-fix-them))

### Patterns to adopt (why they fit)
1. **Stage-based progress (operational transparency).** Name advancing stages — "Interpreting prompt → Generating keyframes → Rendering motion → Stitching" — with "Step 3 of 4". Each transition resets the patience clock. *Fits us:* the backend already emits a stage vocabulary and a `pipeline_state.message` field — render the **real** one instead of the simulated %. ([Particula — Long-Running AI Tasks](https://particula.tech/blog/long-running-ai-tasks-user-interface-patterns); [HBS](https://www.hbs.edu/faculty/Pages/item.aspx?num=40158))
2. **Estimated time as a dynamic range** ("Typically 2–3 min"), never a fake countdown. ([Particula](https://particula.tech/blog/long-running-ai-tasks-user-interface-patterns))
3. **Stream partial / live previews** — per-clip thumbnails as each clip finishes, a progress filmstrip. *Fits us:* `video_clips` already produces `last_frame_url`/`video_url` per clip via Realtime — surface them as they land. ([Particula](https://particula.tech/blog/long-running-ai-tasks-user-interface-patterns))
4. **Skeleton screens for the result surface** (player frame, metadata, buttons), spinners only for short discrete actions. ([Onething](https://www.onething.design/post/skeleton-screens-vs-loading-spinners); [LogRocket — Skeleton loading](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/))
5. **"Continue in background" + notify-when-done.** ~15s offer subtle background, ~60s make prominent; deliver via a jobs drawer + notification center + push. *Fits us:* push (`send-push-notification`) and an Inbox already exist — connect render completion to them. ([Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback))
6. **Rotating/evolving status copy** so it never reads frozen; honest, lightly human. ([NN/g — 3 I's of Microcopy](https://www.nngroup.com/articles/3-is-of-microcopy/))
7. **Optimistic UI for cheap actions** (likes, naming, queueing) via React `useOptimistic`; always message on rollback. Never for payments/deletions. ([React — useOptimistic](https://react.dev/reference/react/useOptimistic))
8. **Toasts for transient confirmations only**; route must-not-miss events (errors, completion of a job the user left) to a banner/notification center, not a fading toast. *Fits us:* the branded `sonner` system is excellent — apply this discipline and retire the dead Radix toaster. ([LogRocket — toast best practices](https://blog.logrocket.com/ux-design/toast-notifications/); [Adobe Spectrum — Toast](https://spectrum.adobe.com/page/toast/))
9. **Guiding empty & error states.** Empty states teach + give a CTA; errors name the problem + offer recovery ("Generation failed — your credits were refunded. Retry?"). ([NN/g — Empty States](https://www.nngroup.com/articles/empty-state-interface-design/); [NN/g — Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/))
10. **Tasteful celebration (FEAT).** Reserve confetti for genuine feats (finished render qualifies; routine saves don't), fire once, keep short, respect `prefers-reduced-motion`. *Fits us:* `src/lib/celebrate.ts` already does exactly this — it's just not fired on render completion. ([UX Lift — Why Confetti Backfires](https://www.uxlift.org/articles/why-confetti-celebrations-backfire-and-how-to-make-them-work/))
11. **Just-in-time onboarding/coachmarks & tooltips** — introduce expensive flows contextually; pair the duration expectation with a first-run coachmark on the generate button.

### Mistakes to avoid
- Fake/indeterminate progress bars (stall at 90%, guessed timers, fabricated ramps) — worse than a plain spinner. ([cenanulker](https://www.cenanulker.com/post/why-progress-bars-in-ux-design-secretly-control-your-users-patience-and-how-to-fix-them))
- A bare spinner for a minutes-long wait. ([boldist — Loading Spinner Is a UX Killer](https://boldist.co/usability/loading-spinner-ux-killer/))
- Silent failures (optimistic reverts with no message; jobs that die without notifying). ([React docs](https://react.dev/reference/react/useOptimistic))
- Notification spam / must-not-miss info in an auto-fading toast. ([LogRocket](https://blog.logrocket.com/ux-design/toast-notifications/))
- Implying measurement you don't have (e.g. a "continuity index" or "8-phase" rail that's actually 3 heuristic states) — erodes trust like a fake progress bar.

---

### Cross-cutting takeaway
The three areas reinforce each other: the **persisted per-stage progress row** (Area 1 — source of truth, survives reload, pushed via Realtime) is exactly the data that powers Area 3's **operational-transparency UI** and **notify-when-done**; and Area 2's **single shared compositor / backend bake** is what lets the editor's live preview double as the partial-preview surface Area 3 wants. **Build the durable state machine and the real progress signal first — most of the "delight" is then a faithful rendering of true state, not invented animation.**
