-- AUDIT FIX B-2 / H-6: org credit/spend/billing analytics were aggregated by
-- member user_id (which RLS silently narrows to the VIEWER, and which would
-- cross-contaminate any member who belongs to >1 org). The root cause is that
-- credit_transactions carried no org tag.
--
-- Fix WITHOUT touching the money write-path: tag each transaction with the
-- organization of the PROJECT it was for (movie_projects.organization_id) via a
-- BEFORE INSERT trigger, backfill history, and expose a SECURITY DEFINER read
-- RPC that returns an org's transactions (gated on membership). "Org spend" =
-- transactions for that org's projects, regardless of which wallet paid — which
-- is the correct definition for the business dashboards.
--
-- NOTE (separate, larger finding — NOT addressed here): org generations do not
-- currently consume the org credit POOL at all (reserve_credits/deduct_credits/
-- consume_credit_hold are user-scoped; the only org-pool functions,
-- consume_org_credits/topup_org_credits, have no callers and consume_org_credits
-- writes a non-existent `metadata` column). This change makes the spend
-- *reporting* correct; wiring generations to the org pool is a separate decision.

-- 1) Schema: org tag + index.
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_org
  ON public.credit_transactions (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- 2) Stamp organization_id from the project on every insert (works for ALL
--    paths — deduct_credits, consume_credit_hold, add_credits, etc. — without
--    redefining any of them). Purchases / personal-project rows have no
--    org-linked project, so organization_id stays NULL. An explicitly-provided
--    organization_id is respected.
CREATE OR REPLACE FUNCTION public.set_credit_tx_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT mp.organization_id INTO NEW.organization_id
    FROM public.movie_projects mp
    WHERE mp.id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_credit_tx_org ON public.credit_transactions;
CREATE TRIGGER trg_set_credit_tx_org
  BEFORE INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_credit_tx_org();

-- 3) Backfill existing rows from their project's org.
UPDATE public.credit_transactions ct
SET organization_id = mp.organization_id
FROM public.movie_projects mp
WHERE ct.project_id = mp.id
  AND mp.organization_id IS NOT NULL
  AND ct.organization_id IS NULL;

-- 4) Read RPC: an org's transactions, gated on caller membership. SECURITY
--    DEFINER so it bypasses the per-user RLS on credit_transactions and returns
--    the WHOLE org set (not just the viewer's rows). auth.uid() inside a definer
--    function is still the CALLER's id, so the membership gate is honored.
CREATE OR REPLACE FUNCTION public.org_credit_transactions(
  p_org_id uuid,
  p_since timestamptz DEFAULT (now() - interval '365 days')
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  amount integer,
  transaction_type text,
  description text,
  balance_after integer,
  project_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ct.id, ct.user_id, ct.amount, ct.transaction_type, ct.description,
         ct.balance_after, ct.project_id, ct.created_at
  FROM public.credit_transactions ct
  WHERE ct.organization_id = p_org_id
    AND ct.created_at >= p_since
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = p_org_id AND m.user_id = auth.uid()
    )
  ORDER BY ct.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.org_credit_transactions(uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.org_credit_transactions(uuid, timestamptz) TO authenticated;
