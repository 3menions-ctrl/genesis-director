-- Fix RLS policies that query auth.users directly (which causes permission denied errors)
-- Replace subqueries to auth.users with auth.jwt() email extraction

-- Drop and recreate the problematic policies on universe_invitations

-- First, drop the existing policies
DROP POLICY IF EXISTS "Invitees and inviters can view invitations" ON public.universe_invitations;
DROP POLICY IF EXISTS "Invitees can update invitation status" ON public.universe_invitations;

-- Recreate with auth.jwt() instead of auth.users subquery
-- Use auth.jwt() to get the email from the JWT token directly
CREATE POLICY "Invitees and inviters can view invitations"
ON public.universe_invitations FOR SELECT
USING (
  auth.uid() = invited_by 
  OR invited_email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Invitees can update invitation status"
ON public.universe_invitations FOR UPDATE
USING (
  invited_email = (auth.jwt() ->> 'email')
);