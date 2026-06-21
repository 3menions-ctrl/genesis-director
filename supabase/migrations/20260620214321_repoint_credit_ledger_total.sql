-- Unify the balance guard with the new ledger: credit_ledger_total now reads
-- the embedded double-entry ledger (single source of truth) instead of the
-- (cleared) legacy credit_transactions table.
CREATE OR REPLACE FUNCTION public.credit_ledger_total(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ledger_user_credit_balance(p_user_id)::integer;
$$;
