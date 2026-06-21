
-- Drop the overly restrictive anon deny policy on video_clips
-- The "Anyone can view clips from public projects" policy already properly scopes access
DROP POLICY IF EXISTS "Deny anonymous access to video_clips" ON public.video_clips;

-- Re-create a more targeted anon deny for writes only (INSERT/UPDATE/DELETE)
CREATE POLICY "Deny anonymous writes to video_clips"
ON public.video_clips
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- But allow anon SELECT on public project clips
-- The existing "Anyone can view clips from public projects" uses role {public} which includes anon,
-- but the ALL deny overrides it. We need a permissive SELECT for anon specifically.
DROP POLICY IF EXISTS "Deny anonymous writes to video_clips" ON public.video_clips;

-- Use separate policies for each write operation instead of ALL
CREATE POLICY "Deny anon insert on video_clips"
ON public.video_clips FOR INSERT TO anon
WITH CHECK (false);

CREATE POLICY "Deny anon update on video_clips"
ON public.video_clips FOR UPDATE TO anon
USING (false);

CREATE POLICY "Deny anon delete on video_clips"
ON public.video_clips FOR DELETE TO anon
USING (false);
