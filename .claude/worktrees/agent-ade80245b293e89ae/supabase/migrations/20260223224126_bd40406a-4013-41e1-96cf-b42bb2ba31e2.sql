
-- Add opt-out columns to user_gamification table
ALTER TABLE public.user_gamification
ADD COLUMN IF NOT EXISTS tracking_opted_out boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS hide_from_leaderboard boolean NOT NULL DEFAULT false;

-- Update RLS: hide opted-out users from other users' leaderboard queries
-- Drop existing public view policy if any, then create restricted one
CREATE POLICY "Hide opted-out users from leaderboard"
ON public.user_gamification
FOR SELECT
USING (
  -- Users can always see their own data
  auth.uid() = user_id
  -- Others can only see users who haven't hidden from leaderboard
  OR hide_from_leaderboard = false
);
