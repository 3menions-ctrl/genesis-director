-- ════════════════════════════════════════════════════════════════════════
-- Contain profiles.email — part 3 (repair the profile_self view).
--
-- 20260611190000_security_lockdown created:
--
--   CREATE VIEW public.profile_self WITH (security_invoker = true) AS
--     SELECT * FROM public.profiles WHERE id = (SELECT auth.uid());
--   GRANT SELECT ON public.profile_self TO authenticated;
--
-- A `security_invoker = true` view runs with the CALLER's privileges. While
-- `authenticated` still held a TABLE-level SELECT on profiles, the `SELECT *`
-- (which expands to every column, incl. email) resolved fine. But part 2
-- (20260703010000) dropped that table grant and re-granted column-level SELECT
-- on every column EXCEPT email — so an invoker-rights `SELECT *` through this
-- view now raises `permission denied for column email of relation profiles`.
--
-- profile_self has no callers in the app today (get_my_profile() replaced the
-- owner self-read), so nothing breaks at runtime — but the view is left in a
-- broken state, a latent footgun for the next consumer. Repair it the same way
-- profiles_public was repaired: make it `security_invoker = false` so it runs
-- with the (privileged) view owner's rights and `SELECT *` keeps working. The
-- `WHERE id = auth.uid()` filter still scopes every result to the caller's own
-- row, so there is no cross-tenant exposure even though the view bypasses the
-- column grant.
-- ════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.profile_self;
CREATE VIEW public.profile_self
WITH (security_invoker = false)
AS
SELECT * FROM public.profiles
WHERE id = (SELECT auth.uid());

REVOKE ALL ON public.profile_self FROM PUBLIC, anon;
GRANT SELECT ON public.profile_self TO authenticated;
