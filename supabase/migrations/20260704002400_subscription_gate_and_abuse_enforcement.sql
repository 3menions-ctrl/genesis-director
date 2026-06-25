-- ─────────────────────────────────────────────────────────────────────────
-- H3: let service-role edge functions consult the canonical entitlement check
-- so subscription-gated features (e.g. API-key creation) can enforce it. The
-- helper already encodes the product's grace semantics (active/trialing, plus
-- past_due / canceled until current_period_end).
--
-- M3: the abuse_rules table (admin UI at /admin/abuse) was never read at
-- request time. Add a SECURITY DEFINER checker that edge functions call to
-- enforce ip_block / email_block rules, and counts hits.
-- ─────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;

-- Returns the blocking rule (if any) for a request's IP / email, and bumps its
-- hit counter. trusted_partner rules short-circuit to "not blocked". Patterns:
--   ip_block:    exact match, or SQL LIKE when the pattern contains '%'
--   email_block: exact email, a bare domain, or '@domain' suffix match
CREATE OR REPLACE FUNCTION public.check_abuse_block(p_ip text, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  _email text := lower(coalesce(p_email, ''));
  _ip    text := coalesce(p_ip, '');
BEGIN
  -- Trusted partners bypass all blocks.
  IF EXISTS (
    SELECT 1 FROM public.abuse_rules
    WHERE active AND kind = 'trusted_partner'
      AND (ttl_expires_at IS NULL OR ttl_expires_at > now())
      AND ( (_ip <> '' AND _ip = pattern)
            OR (_email <> '' AND _email = lower(pattern)) )
  ) THEN
    RETURN jsonb_build_object('blocked', false);
  END IF;

  FOR r IN
    SELECT id, kind, pattern, reason FROM public.abuse_rules
    WHERE active AND kind IN ('ip_block','email_block')
      AND (ttl_expires_at IS NULL OR ttl_expires_at > now())
  LOOP
    IF r.kind = 'ip_block' AND _ip <> '' AND (
         _ip = r.pattern OR (r.pattern LIKE '%\%%' ESCAPE '\' AND _ip LIKE r.pattern)
       ) THEN
      UPDATE public.abuse_rules SET hits = hits + 1 WHERE id = r.id;
      RETURN jsonb_build_object('blocked', true, 'kind', r.kind, 'reason', coalesce(r.reason,'blocked'));
    END IF;

    IF r.kind = 'email_block' AND _email <> '' AND (
         _email = lower(r.pattern)
         OR _email LIKE '%@' || ltrim(lower(r.pattern), '@')
       ) THEN
      UPDATE public.abuse_rules SET hits = hits + 1 WHERE id = r.id;
      RETURN jsonb_build_object('blocked', true, 'kind', r.kind, 'reason', coalesce(r.reason,'blocked'));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('blocked', false);
END;
$$;
REVOKE ALL ON FUNCTION public.check_abuse_block(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_abuse_block(text, text) TO service_role;
