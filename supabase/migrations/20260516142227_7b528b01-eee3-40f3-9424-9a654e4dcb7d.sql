
-- =====================================================================
-- Phase 2: Function privilege hardening (continued)
--   - Inject "auth.uid() must match p_user_id when a session is present"
--     guard into functions that accept a user-id parameter and previously
--     had no ownership check. Service-role calls (auth.uid() IS NULL)
--     pass through unchanged.
--   - Revoke EXECUTE from API roles on trigger-only and service-role-only
--     functions.
-- =====================================================================

-- ---- 1) Ownership guards ---------------------------------------------

-- log_api_cost (10-arg overload with p_user_id)
CREATE OR REPLACE FUNCTION public.log_api_cost(
  p_user_id uuid, p_project_id uuid, p_shot_id text, p_service text,
  p_operation text, p_credits_charged integer, p_real_cost_cents integer,
  p_duration_seconds integer DEFAULT NULL::integer,
  p_status text DEFAULT 'completed'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  log_id UUID;
  v_caller UUID := auth.uid();
BEGIN
  -- Defense-in-depth: if invoked via API (session present), caller must
  -- match the target user_id. Service-role/edge calls bypass (uid IS NULL).
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden: cannot log cost for another user';
  END IF;

  INSERT INTO api_cost_logs (
    user_id, project_id, shot_id, service, operation,
    credits_charged, real_cost_cents, duration_seconds, status, metadata
  )
  VALUES (
    p_user_id, p_project_id, p_shot_id, p_service, p_operation,
    p_credits_charged, p_real_cost_cents, p_duration_seconds, p_status, p_metadata
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$function$;

-- refund_production_credits (4-arg overload with p_user_id)
CREATE OR REPLACE FUNCTION public.refund_production_credits(
  p_user_id uuid, p_project_id uuid, p_shot_id text, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  total_refund INTEGER := 0;
  phase_record RECORD;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden: cannot refund another user';
  END IF;

  FOR phase_record IN
    SELECT id, credits_amount, phase
    FROM production_credit_phases
    WHERE user_id = p_user_id
      AND shot_id = p_shot_id
      AND status = 'charged'
  LOOP
    total_refund := total_refund + phase_record.credits_amount;
    UPDATE production_credit_phases
    SET status = 'refunded', refund_reason = p_reason
    WHERE id = phase_record.id;
  END LOOP;

  IF total_refund > 0 THEN
    UPDATE profiles
    SET credits_balance = credits_balance + total_refund,
        total_credits_used = total_credits_used - total_refund,
        updated_at = now()
    WHERE id = p_user_id;

    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, project_id)
    VALUES (p_user_id, total_refund, 'refund', 'Refund for shot ' || p_shot_id || ': ' || p_reason, p_project_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'credits_refunded', total_refund);
END;
$function$;

-- add_user_xp
CREATE OR REPLACE FUNCTION public.add_user_xp(
  p_user_id uuid, p_xp_amount integer, p_reason text DEFAULT 'activity'::text
) RETURNS TABLE(new_xp integer, new_level integer, leveled_up boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_old_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden: cannot grant XP to another user';
  END IF;

  INSERT INTO public.user_gamification (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT level INTO v_old_level FROM public.user_gamification WHERE user_id = p_user_id;

  UPDATE public.user_gamification
  SET xp_total = xp_total + p_xp_amount,
      level = calculate_level(xp_total + p_xp_amount),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING xp_total, level INTO v_new_xp, v_new_level;

  IF v_new_level > v_old_level THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, 'level_up', 'Level Up!',
            'Congratulations! You reached level ' || v_new_level,
            jsonb_build_object('new_level', v_new_level, 'old_level', v_old_level));
  END IF;

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$function$;

-- update_user_streak
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_last_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'forbidden: cannot update another user streak';
  END IF;

  SELECT last_activity_date, current_streak, longest_streak
    INTO v_last_date, v_current_streak, v_longest_streak
  FROM public.user_gamification
  WHERE user_id = p_user_id;

  IF v_last_date IS NULL OR v_last_date < CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := 1;
  ELSIF v_last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
  END IF;

  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;

  UPDATE public.user_gamification
  SET current_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_activity_date = CURRENT_DATE,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF v_current_streak = 7 THEN
    PERFORM add_user_xp(p_user_id, 300, 'streak_7');
  ELSIF v_current_streak = 30 THEN
    PERFORM add_user_xp(p_user_id, 1000, 'streak_30');
  ELSIF v_current_streak = 100 THEN
    PERFORM add_user_xp(p_user_id, 5000, 'streak_100');
  END IF;

  RETURN v_current_streak;
END;
$function$;

-- ---- 2) Revoke EXECUTE on trigger-only functions ---------------------
-- (triggers ignore GRANTs, so this is safe.)
REVOKE EXECUTE ON FUNCTION public.check_casting_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_personal_org_for_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_org_credits_low() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_org_member_joined() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_org_role_changed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_last_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_subscription_to_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_video_clips_to_project() FROM PUBLIC, anon, authenticated;

-- ---- 3) Revoke EXECUTE on backend-only functions ---------------------
-- These are only called from edge functions using the service-role key,
-- which bypasses GRANTs. Revoking from API roles closes direct attacks.
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, integer, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_video_clip(uuid, uuid, integer, text, text, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_video_clip(uuid, uuid, integer, text, text, text, text, text, jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_org_seat(uuid, uuid, org_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_org_for_user(uuid, text, text) FROM PUBLIC, anon, authenticated;
