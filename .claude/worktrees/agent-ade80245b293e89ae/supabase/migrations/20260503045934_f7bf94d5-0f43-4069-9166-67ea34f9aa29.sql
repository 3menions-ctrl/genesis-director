-- Fix SECURITY DEFINER view finding by enforcing security_invoker
ALTER VIEW public.profiles_public SET (security_invoker = true);

-- Resolve schema drift: two CHECK constraints on account_type, the older one
-- forbids 'admin'. Drop the legacy constraint; the canonical one remains.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_type_chk;