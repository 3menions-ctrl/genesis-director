-- M8/#2 + #4: schedule the two correct-but-unscheduled money crons.
-- monthly_org_credit_refill() funds each active org subscription's credit pool
-- monthly (idempotent per period); charge_patron_renewals() bills due patron
-- pledges + advances their renewal date. Both were never scheduled, so org
-- pools never refilled and patron pledges never renewed. They no-op pre-launch
-- (no active org subscriptions / patron pledges yet).
-- NOTE: the remaining M8 pieces (fund the pool at subscription activation in
-- polar-webhook, trigger checkout from BusinessStart, auto-recharge processor)
-- touch the live payment handler + FE and are tracked separately.
SELECT cron.schedule('monthly-org-credit-refill', '0 7 1 * *',
  $$SELECT public.monthly_org_credit_refill();$$);
SELECT cron.schedule('charge-patron-renewals', '0 8 * * *',
  $$SELECT public.charge_patron_renewals();$$);
