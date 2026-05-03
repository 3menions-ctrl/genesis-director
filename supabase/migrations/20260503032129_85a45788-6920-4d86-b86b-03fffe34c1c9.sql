-- Enforce one account per email address (case-insensitive) at the profiles layer.
-- auth.users alone does not guarantee this when OAuth providers (Google/Apple)
-- create distinct user rows for the same email. This unique index makes a second
-- profile row with the same email impossible at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_ci
  ON public.profiles ((LOWER(email)))
  WHERE email IS NOT NULL;