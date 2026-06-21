-- =====================================================
-- SECURITY FIX: Strengthen profiles table RLS policies
-- Issue: Any authenticated user can query other users' profiles
-- Fix: Users can only view their own profile, admins can view all
-- =====================================================

-- First, drop the old weak policy if it still exists
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- Drop any duplicate policies we may have created
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles secure" ON public.profiles;
DROP POLICY IF EXISTS "Users view own or allowed profiles" ON public.profiles;

-- Create proper restrictive policies

-- Users can always view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles (using secure has_role function)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure INSERT policy properly restricts to authenticated user
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- =====================================================
-- SECURITY FIX: Ensure video_clips only exposes necessary data for public projects
-- Create a view that hides sensitive generation metadata
-- =====================================================

-- Create a safe public view for video clips that hides sensitive metadata
CREATE OR REPLACE VIEW public.video_clips_public AS
SELECT 
  vc.id,
  vc.project_id,
  vc.shot_index,
  vc.video_url,
  vc.status,
  vc.duration_seconds,
  vc.created_at
FROM public.video_clips vc
JOIN public.movie_projects mp ON vc.project_id = mp.id
WHERE mp.is_public = true AND vc.status = 'completed' AND vc.video_url IS NOT NULL;

-- Grant access to the view for anon/authenticated
GRANT SELECT ON public.video_clips_public TO anon, authenticated;