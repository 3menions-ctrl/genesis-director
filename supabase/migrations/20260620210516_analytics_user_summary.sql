-- Per-user analytics bundle for the admin User-360 / profile pop-up.
CREATE OR REPLACE FUNCTION public.analytics_user_summary(_uid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT jsonb_build_object('id', p.id, 'display_name', p.display_name, 'account_type', p.account_type,
                  'created_at', p.created_at, 'onboarding_completed', p.onboarding_completed) FROM public.profiles p WHERE p.id = _uid),
    'engagement', (SELECT jsonb_build_object(
        'events', count(*), 'pageviews', count(*) FILTER (WHERE name = '$pageview'),
        'sessions', count(DISTINCT session_id), 'searches', count(*) FILTER (WHERE name = 'search'),
        'first_seen', min(occurred_at), 'last_seen', max(occurred_at)
      ) FROM public.analytics_events WHERE user_id = _uid),
    'time_seconds', (SELECT coalesce(round(sum(extract(epoch FROM (mx - mn)))), 0)
        FROM (SELECT session_id, min(occurred_at) mn, max(occurred_at) mx FROM public.analytics_events WHERE user_id = _uid GROUP BY session_id) s),
    'top_pages', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT path, count(*) views FROM public.analytics_events WHERE user_id = _uid AND name = '$pageview' GROUP BY path ORDER BY count(*) DESC LIMIT 8) t),
    'searches', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT payload->>'query' q, count(*) n FROM public.analytics_events WHERE user_id = _uid AND name = 'search' AND payload->>'query' IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
    'product', jsonb_build_object(
        'projects', (SELECT count(*) FROM public.movie_projects WHERE user_id = _uid),
        'completed', (SELECT count(*) FROM public.movie_projects WHERE user_id = _uid AND status = 'completed'),
        'published', (SELECT count(*) FROM public.published_reels WHERE creator_id = _uid)),
    'money', (SELECT jsonb_build_object(
        'credits_purchased', coalesce(sum(amount) FILTER (WHERE transaction_type = 'purchase'), 0),
        'credits_spent', coalesce(abs(sum(amount) FILTER (WHERE amount < 0)), 0),
        'balance', (SELECT balance_after FROM public.credit_transactions WHERE user_id = _uid ORDER BY created_at DESC LIMIT 1),
        'paid', EXISTS (SELECT 1 FROM public.credit_transactions WHERE user_id = _uid AND (transaction_type = 'purchase' OR stripe_payment_id IS NOT NULL))
      ) FROM public.credit_transactions WHERE user_id = _uid),
    'spend_history', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT transaction_type, amount, balance_after, created_at FROM public.credit_transactions WHERE user_id = _uid ORDER BY created_at DESC LIMIT 25) t)
  ) INTO result;
  RETURN result;
END$$;
REVOKE ALL ON FUNCTION public.analytics_user_summary(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.analytics_user_summary(uuid) TO authenticated;
