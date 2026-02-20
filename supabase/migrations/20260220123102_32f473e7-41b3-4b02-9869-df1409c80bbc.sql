
-- ─────────────────────────────────────────────────────────────────
-- FIX 1: profiles_public — strip email, restrict to non-sensitive fields only
-- Drop and recreate as SECURITY DEFINER view so it never leaks email
-- ─────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.profiles_public CASCADE;

CREATE VIEW public.profiles_public
WITH (security_invoker = false)
AS
  SELECT
    id,
    display_name,
    avatar_url,
    created_at
  FROM public.profiles;

-- Revoke direct access from anon and public roles
REVOKE ALL ON public.profiles_public FROM anon, public;
GRANT SELECT ON public.profiles_public TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- FIX 2: credit_transactions_safe — restrict to the authenticated user's own rows
-- ─────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.credit_transactions_safe CASCADE;

-- Recreate as a security-invoker view so RLS on the base table is respected
CREATE VIEW public.credit_transactions_safe
WITH (security_invoker = true)
AS
  SELECT
    id,
    user_id,
    amount,
    transaction_type,
    description,
    project_id,
    clip_duration_seconds,
    created_at
  FROM public.credit_transactions;

-- Revoke anon access; authenticated users are still gated by the base-table RLS
REVOKE ALL ON public.credit_transactions_safe FROM anon, public;
GRANT SELECT ON public.credit_transactions_safe TO authenticated;
