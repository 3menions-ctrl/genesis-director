-- Admin comment moderation.
--
-- project_comments previously had only a "Users can delete their own comments"
-- policy, so the admin comment-moderation page's delete silently affected 0 rows
-- for anyone else's comment (RLS-filtered, no error). This grants admins a real
-- moderation capability — they can remove any comment (abuse / spam).
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.project_comments;
CREATE POLICY "Admins can delete any comment"
  ON public.project_comments
  FOR DELETE
  USING (public.is_admin(auth.uid()));
