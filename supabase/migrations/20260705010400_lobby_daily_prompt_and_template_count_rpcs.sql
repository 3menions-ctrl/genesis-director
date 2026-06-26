-- M13 / audit #12,#13: ship the two RPCs the client calls but that don't exist.
--
-- #12: Lobby.tsx calls get_daily_prompt_with_submissions() (the daily-prompt
--   panel). The RPC was never created, so the call silently failed and the
--   panel stayed empty. Return the latest prompt + its top voted submissions
--   in the exact shape the client expects ({prompt, top_submissions}).
-- #13: Templates.tsx calls increment_template_use_count(p_template_id) on use.
--   Missing -> errored every time and fell back to a non-atomic client update.

CREATE OR REPLACE FUNCTION public.get_daily_prompt_with_submissions()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH dp AS (
    SELECT * FROM public.daily_prompts
    WHERE prompt_date <= current_date
    ORDER BY prompt_date DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'prompt', jsonb_build_object(
      'id', dp.id,
      'prompt_text', dp.prompt_text,
      'prompt_hint', dp.prompt_hint,
      'world_slug', dp.world_slug,
      'prompt_date', dp.prompt_date
    ),
    'top_submissions', COALESCE((
      SELECT jsonb_agg(s) FROM (
        SELECT jsonb_build_object(
          'reel_id', ps.reel_id,
          'title', COALESCE(pr.title, 'Untitled'),
          'thumbnail_url', pr.thumbnail_url,
          'votes', COALESCE(ps.vote_count, 0)
        ) AS s
        FROM public.prompt_submissions ps
        LEFT JOIN public.published_reels pr ON pr.id = ps.reel_id
        WHERE ps.prompt_id = dp.id
          AND (pr.id IS NULL OR pr.is_taken_down = false)
        ORDER BY COALESCE(ps.vote_count, 0) DESC, ps.created_at DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  )
  FROM dp;
$function$;

CREATE OR REPLACE FUNCTION public.increment_template_use_count(p_template_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.project_templates
     SET use_count = COALESCE(use_count, 0) + 1
   WHERE id = p_template_id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_prompt_with_submissions() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_template_use_count(uuid) TO authenticated;
