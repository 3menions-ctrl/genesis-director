-- ════════════════════════════════════════════════════════════════════════
-- Daily Sketch — 60-second prompt + community submissions + marquee.
--
-- Schema for the "today's prompt" ritual described in the spectacular
-- roadmap. Every day a single canonical prompt; users submit reels in
-- response; the top-voted few get marquee feature on the Lobby.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.daily_sketch_prompts (
  date          date PRIMARY KEY,
  prompt        text NOT NULL,
  hint          text,
  -- A creator can curate ahead of time; if NULL, the cron-driven
  -- `pick_daily_sketch_prompt` picks one from a queue.
  authored_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_sketch_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date NOT NULL REFERENCES public.daily_sketch_prompts(date) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reel_id       uuid REFERENCES public.published_reels(id) ON DELETE CASCADE,
  -- We allow a creator to submit a reel-in-progress (not yet published)
  -- by passing the project_id; once they publish, the trigger fills
  -- in reel_id.
  project_id    uuid REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  caption       text,
  vote_count    int  NOT NULL DEFAULT 0,
  is_featured   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sketch_submissions_date
  ON public.daily_sketch_submissions (date, vote_count DESC);

CREATE TABLE IF NOT EXISTS public.daily_sketch_votes (
  submission_id uuid NOT NULL REFERENCES public.daily_sketch_submissions(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voted_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, user_id)
);

ALTER TABLE public.daily_sketch_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sketch_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sketch_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read prompts (it's the public ritual).
CREATE POLICY "Daily sketch prompts public read"
  ON public.daily_sketch_prompts FOR SELECT TO anon, authenticated USING (true);

-- Submissions are public-read; INSERT only by self.
CREATE POLICY "Daily sketch submissions public read"
  ON public.daily_sketch_submissions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Daily sketch submission self-insert"
  ON public.daily_sketch_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Daily sketch submission self-update"
  ON public.daily_sketch_submissions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Daily sketch submission self-delete"
  ON public.daily_sketch_submissions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Votes: self-manage, vote_count gets auto-synced via trigger.
CREATE POLICY "Daily sketch vote self-manage"
  ON public.daily_sketch_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.daily_sketch_vote_count_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.daily_sketch_submissions SET vote_count = vote_count + 1
      WHERE id = NEW.submission_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.daily_sketch_submissions SET vote_count = GREATEST(vote_count - 1, 0)
      WHERE id = OLD.submission_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_daily_sketch_vote_count_sync ON public.daily_sketch_votes;
CREATE TRIGGER trg_daily_sketch_vote_count_sync
  AFTER INSERT OR DELETE ON public.daily_sketch_votes
  FOR EACH ROW EXECUTE FUNCTION public.daily_sketch_vote_count_sync();

-- ── Today's prompt + top 10 submissions ─────────────────────────────
CREATE OR REPLACE FUNCTION public.daily_sketch_marquee()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'date',   today.date,
    'prompt', today.prompt,
    'hint',   today.hint,
    'top',    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'submission_id', s.id,
        'reel_id',       s.reel_id,
        'caption',       s.caption,
        'votes',         s.vote_count,
        'creator_id',    s.user_id,
        'is_featured',   s.is_featured
      ) ORDER BY s.vote_count DESC, s.created_at ASC)
      FROM public.daily_sketch_submissions s
      WHERE s.date = today.date
      LIMIT 10
    ), '[]'::jsonb)
  )
  FROM (
    SELECT * FROM public.daily_sketch_prompts
    WHERE date = (CURRENT_DATE AT TIME ZONE 'UTC')::date
    LIMIT 1
  ) AS today;
$$;

GRANT EXECUTE ON FUNCTION public.daily_sketch_marquee() TO anon, authenticated;

-- ── Submit + toggle vote RPCs ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_daily_sketch(
  p_reel_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_caption text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  -- Ensure today's prompt exists.
  PERFORM 1 FROM public.daily_sketch_prompts WHERE date = v_today;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_daily_prompt'; END IF;
  -- Upsert the submission.
  INSERT INTO public.daily_sketch_submissions (date, user_id, reel_id, project_id, caption)
  VALUES (v_today, auth.uid(), p_reel_id, p_project_id, p_caption)
  ON CONFLICT (date, user_id) DO UPDATE
    SET reel_id = COALESCE(EXCLUDED.reel_id, public.daily_sketch_submissions.reel_id),
        project_id = COALESCE(EXCLUDED.project_id, public.daily_sketch_submissions.project_id),
        caption = COALESCE(EXCLUDED.caption, public.daily_sketch_submissions.caption)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_daily_sketch(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_daily_sketch_vote(p_submission_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.daily_sketch_votes
    WHERE submission_id = p_submission_id AND user_id = auth.uid()
  ) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.daily_sketch_votes
      WHERE submission_id = p_submission_id AND user_id = auth.uid();
    RETURN FALSE;
  ELSE
    INSERT INTO public.daily_sketch_votes (submission_id, user_id)
    VALUES (p_submission_id, auth.uid())
    ON CONFLICT DO NOTHING;
    RETURN TRUE;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.toggle_daily_sketch_vote(uuid) TO authenticated;
