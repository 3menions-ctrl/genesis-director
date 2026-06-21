-- Loosen reaction SELECT policies so the project OWNER and the
-- reaction AUTHOR can also see reactions, not just anonymous viewers
-- of public projects. The original policy required is_public=true,
-- which meant the owner of a private project couldn't see their own
-- reactions in the UI — looked like the reaction buttons were broken.

DROP POLICY IF EXISTS "Anyone can view reactions on public videos" ON public.video_reactions;
CREATE POLICY "View reactions on visible videos"
  ON public.video_reactions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.movie_projects mp
      WHERE mp.id = video_reactions.project_id
        AND (mp.is_public = true OR mp.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Anyone can view comment reactions on public videos" ON public.comment_reactions;
CREATE POLICY "View comment reactions on visible videos"
  ON public.comment_reactions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_comments pc
      JOIN public.movie_projects mp ON mp.id = pc.project_id
      WHERE pc.id = comment_reactions.comment_id
        AND (mp.is_public = true OR mp.user_id = auth.uid())
    )
  );
