-- AUTHZ FIX (forward patch): let users read their OWN login attempts.
--
-- Bug: every SELECT policy on public.login_attempts (20260220004650) requires
-- global admin via public.has_role(auth.uid(),'admin'). BusinessSecurity.tsx
-- gates its sign-in-history panel on ORG admin (hasPermission('admin')), so an
-- org admin who is not the single global admin passes the UI check but RLS
-- silently returns zero rows.
--
-- 20260220004650 is already applied to prod, so this forward migration adds a
-- permissive SELECT policy (RLS ORs policies) allowing any authenticated user to
-- read their own records. Emails are stored LOWER()'d by log_login_attempt(), so
-- we match LOWER(auth.jwt() ->> 'email'). We use auth.jwt() (not a subquery on
-- auth.users) because the authenticated role has no SELECT on auth.users.
-- Verified: login_attempts.email is text; the admin policies remain in force.

-- Idempotent: drop first so a re-apply against prod (where this may already
-- exist out-of-band) doesn't abort (42710).
DROP POLICY IF EXISTS "Users view own login attempts" ON public.login_attempts;
CREATE POLICY "Users view own login attempts"
  ON public.login_attempts FOR SELECT
  TO authenticated
  USING (email = LOWER(auth.jwt() ->> 'email'));
