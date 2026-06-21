-- Allow public (including unauthenticated users) to read active credit packages
-- This is needed so users can see pricing tiers before signing in

-- Drop the restrictive policy that blocks all reads
DROP POLICY IF EXISTS "No direct public access to credit_packages" ON credit_packages;

-- Create a new policy that allows anyone to read active packages
CREATE POLICY "Anyone can view active credit packages"
ON credit_packages
FOR SELECT
USING (is_active = true);