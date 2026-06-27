-- Admin Dashboard Phase 2 — credit economy snapshot. SECURITY DEFINER, is_admin-gated.
create or replace function public.admin_credit_economy()
returns table(issued bigint, purchased bigint, spent bigint, welcome bigint, txns bigint)
language sql stable security definer set search_path to 'public' as $fn$
  select
    coalesce(sum(amount) filter (where amount > 0),0)::bigint,
    coalesce(sum(amount) filter (where transaction_type='purchase'),0)::bigint,
    coalesce(abs(sum(amount) filter (where amount < 0)),0)::bigint,
    coalesce(sum(amount) filter (where transaction_type='welcome_bonus'),0)::bigint,
    count(*)::bigint
  from public.credit_transactions
  where public.is_admin(auth.uid());
$fn$;
grant execute on function public.admin_credit_economy() to authenticated;
