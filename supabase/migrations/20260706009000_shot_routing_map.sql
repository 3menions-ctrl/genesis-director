-- ─────────────────────────────────────────────────────────────────────────
-- Per-shot model auto-router
--
-- routing_map assigns the optimal video engine to EACH shot (by shot index)
-- instead of one engine for the whole project. generate-single-clip prefers a
-- shot's routed engine when present, otherwise falls back to the project's
-- locked video_engine (byte-identical to prior behaviour). Shape:
--
--   { "0": { "engine": "runway", "engineLabel": "Runway Gen-4",
--            "score": 86, "reasons": ["best-in-class character consistency"] },
--     "1": { "engine": "seedance", ... }, ... }
--
-- Purely additive + nullable, so existing projects are unaffected.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.movie_projects
  add column if not exists routing_map jsonb;

comment on column public.movie_projects.routing_map is
  'Per-shot engine assignments from the auto-router: { [shotIndex]: { engine, engineLabel, score, reasons } }. Null = use project video_engine for every shot.';
