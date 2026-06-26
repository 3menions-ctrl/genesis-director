-- M3 / audit D38 (residual): make signup-path SIDE-EFFECT triggers non-fatal.
--
-- D38's headline (auto_follow_admin hardcoded-admin FK aborting signups) is
-- ALREADY fixed in prod (the live fn looks up the admin from user_roles, checks
-- existence, and swallows insert errors). Remaining fragility: two AFTER-trigger
-- side effects on profiles whose failure would still roll back the user's
-- signup / profile update:
--   - notify_admin_on_signup: raw admin notification fan-out (fragile on enum
--     drift / notify path)
--   - sync_leaderboard_visibility: writes user_gamification
-- Wrap each side effect in an exception-safe block so a non-critical failure
-- can never abort the user's own write. The SECURITY guard triggers
-- (prevent_negative_credits, prevent_profile_privilege_escalation,
-- block_banned_signups, fn_profiles_block_sensitive_self_update) and the
-- UPDATE-only audit_credits_balance_change are intentionally left untouched.

CREATE OR REPLACE FUNCTION public.trg_notify_admin_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM public.notify_admins(
      'admin_signup'::public.notification_type,
      'New signup',
      COALESCE(NEW.email, 'A user') || ' just created an account',
      jsonb_build_object(
        'new_user_id', NEW.id,
        'email', NEW.email,
        'full_name', NEW.full_name,
        'href', '/admin/users'
      )
    );
    PERFORM public.dispatch_admin_alert('signup', NEW.id::text, jsonb_build_object(
      'email', NEW.email,
      'fullName', NEW.full_name,
      'userId', NEW.id,
      'signedUpAt', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'source', 'web'
    ));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_notify_admin_signup non-fatal failure: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_leaderboard_visibility()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.user_gamification (user_id, leaderboard_visible)
    VALUES (NEW.id, NOT COALESCE(NEW.hide_from_leaderboard, false))
    ON CONFLICT (user_id) DO UPDATE
      SET leaderboard_visible = NOT COALESCE(NEW.hide_from_leaderboard, false);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_leaderboard_visibility non-fatal failure: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
