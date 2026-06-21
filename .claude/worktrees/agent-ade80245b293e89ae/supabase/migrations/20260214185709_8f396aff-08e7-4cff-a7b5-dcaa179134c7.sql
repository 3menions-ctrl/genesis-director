
-- Fix video_clips: restrict INSERT/UPDATE/DELETE to authenticated role only (currently on public)
DROP POLICY IF EXISTS "Users can create own clips" ON public.video_clips;
CREATE POLICY "Users can create own clips"
  ON public.video_clips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own clips" ON public.video_clips;
CREATE POLICY "Users can update own clips"
  ON public.video_clips FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own clips" ON public.video_clips;
CREATE POLICY "Users can delete own clips"
  ON public.video_clips FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix video_clips: replace the poorly-scoped "Block anonymous access" SELECT policy 
-- with a proper anon RESTRICTIVE deny
DROP POLICY IF EXISTS "Block anonymous access to video_clips" ON public.video_clips;
CREATE POLICY "Deny anonymous access to video_clips"
  ON public.video_clips AS RESTRICTIVE
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- Fix video_clips: admin SELECT should also be authenticated only
DROP POLICY IF EXISTS "Admins can view all video clips" ON public.video_clips;
CREATE POLICY "Admins can view all video clips"
  ON public.video_clips FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
