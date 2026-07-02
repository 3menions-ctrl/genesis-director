-- ─────────────────────────────────────────────────────────────────────────
-- Profile self-service completeness + track_event repair.
--
-- Context: authenticated has NO usable direct UPDATE on public.profiles
-- (verified empirically in prod: literal `UPDATE profiles SET bio='x'
-- WHERE id=auth.uid()` → "permission denied for table profiles"), so every
-- self-service write MUST flow through update_my_profile. The RPC's
-- whitelist was missing several flags the app writes, which silently
-- stranded three flows:
--
--   1. Onboarding.tsx marks onboarding_completed=true with a direct
--      UPDATE → denied → 19 of the last 32 signups (7 days) are stuck
--      onboarding_completed=false in prod. Besides re-running onboarding,
--      that leaves the account_type immutability window OPEN forever
--      (prevent_profile_privilege_escalation only locks account_type once
--      onboarding_completed=true).
--   2. WelcomeOfferModal marks has_seen_welcome_offer → denied → the
--      welcome offer re-shows forever.
--   3. Settings "Deactivate account" sets deactivated_at directly →
--      denied → deactivation is broken. And even when it worked, the
--      promised "sign back in to reactivate" was impossible: nothing
--      ever CLEARS deactivated_at, so DeactivatedAccountGate signs the
--      user out again on every subsequent login (a one-way trap).
--
-- Whitelist additions (all self-owned, non-privilege columns):
--   • job_title              — the Settings "Role" field's real home. The UI
--                              previously wrote profiles.role, which the RPC
--                              rightly refuses (role is the authz column).
--   • has_seen_welcome_offer / has_seen_welcome_video — UX flags.
--   • onboarding_completed   — ONE-WAY: only false→true is honored. Allowing
--                              true→false would re-open the account_type
--                              escalation window.
--   • deactivate (verb)      — true sets deactivated_at=now() (idempotent),
--                              false clears it (self-service reactivation on
--                              sign-in, honoring the promised UX).
--
-- track_event repair: the function read profiles.tracking_opted_out, a
-- column that does not exist in prod (the canonical opt-out lives on
-- user_gamification per 20260706003000) → EVERY track_event call raised
-- 42703. No client currently calls it (the app uses analytics_ingest),
-- but it is GRANTed to authenticated and documented — fix it to read the
-- canonical column.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_my_profile(p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'invalid_patch';
  END IF;

  UPDATE public.profiles SET
    display_name = CASE WHEN p_patch ? 'display_name' THEN p_patch->>'display_name' ELSE display_name END,
    full_name    = CASE WHEN p_patch ? 'full_name'    THEN p_patch->>'full_name'    ELSE full_name    END,
    username     = CASE WHEN p_patch ? 'username'     THEN p_patch->>'username'     ELSE username     END,
    tagline      = CASE WHEN p_patch ? 'tagline'      THEN p_patch->>'tagline'      ELSE tagline      END,
    bio          = CASE WHEN p_patch ? 'bio'          THEN p_patch->>'bio'          ELSE bio          END,
    location     = CASE WHEN p_patch ? 'location'     THEN p_patch->>'location'     ELSE location     END,
    country      = CASE WHEN p_patch ? 'country'      THEN p_patch->>'country'      ELSE country      END,
    company      = CASE WHEN p_patch ? 'company'      THEN p_patch->>'company'      ELSE company      END,
    job_title    = CASE WHEN p_patch ? 'job_title'    THEN p_patch->>'job_title'    ELSE job_title    END,
    avatar_url   = CASE WHEN p_patch ? 'avatar_url'   THEN p_patch->>'avatar_url'   ELSE avatar_url   END,
    cover_url    = CASE WHEN p_patch ? 'cover_url'    THEN p_patch->>'cover_url'    ELSE cover_url    END,
    featured_reel_id = CASE WHEN p_patch ? 'featured_reel_id'
                            THEN NULLIF(p_patch->>'featured_reel_id','')::uuid ELSE featured_reel_id END,
    external_links        = CASE WHEN p_patch ? 'external_links'        THEN p_patch->'external_links'        ELSE external_links        END,
    preferences           = CASE WHEN p_patch ? 'preferences'           THEN p_patch->'preferences'           ELSE preferences           END,
    notification_settings = CASE WHEN p_patch ? 'notification_settings' THEN p_patch->'notification_settings' ELSE notification_settings END,
    auto_recharge_enabled = CASE WHEN p_patch ? 'auto_recharge_enabled' THEN (p_patch->>'auto_recharge_enabled')::boolean ELSE auto_recharge_enabled END,
    hide_from_leaderboard = CASE WHEN p_patch ? 'hide_from_leaderboard' THEN (p_patch->>'hide_from_leaderboard')::boolean ELSE hide_from_leaderboard END,
    is_discoverable       = CASE WHEN p_patch ? 'is_discoverable'       THEN (p_patch->>'is_discoverable')::boolean       ELSE is_discoverable       END,
    has_seen_welcome_offer = CASE WHEN p_patch ? 'has_seen_welcome_offer' THEN (p_patch->>'has_seen_welcome_offer')::boolean ELSE has_seen_welcome_offer END,
    has_seen_welcome_video = CASE WHEN p_patch ? 'has_seen_welcome_video' THEN (p_patch->>'has_seen_welcome_video')::boolean ELSE has_seen_welcome_video END,
    -- ONE-WAY: only the false→true transition is honored; true→false would
    -- re-open the pre-onboarding account_type window (escalation surface).
    onboarding_completed = CASE WHEN p_patch ? 'onboarding_completed'
                                 AND COALESCE((p_patch->>'onboarding_completed')::boolean, false)
                                THEN true ELSE onboarding_completed END,
    -- Self-service deactivate/reactivate. Idempotent: re-deactivating keeps
    -- the original timestamp.
    deactivated_at = CASE WHEN p_patch ? 'deactivate'
                          THEN CASE WHEN COALESCE((p_patch->>'deactivate')::boolean, false)
                                    THEN COALESCE(deactivated_at, now())
                                    ELSE NULL END
                          ELSE deactivated_at END,
    interests = CASE WHEN p_patch ? 'interests'
                     THEN (SELECT COALESCE(array_agg(x), ARRAY[]::text[])
                             FROM jsonb_array_elements_text(COALESCE(p_patch->'interests', '[]'::jsonb)) x)
                     ELSE interests END,
    updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Self-service tracking opt-out. The canonical column is
-- user_gamification.tracking_opted_out (20260706003000). The Settings UI
-- previously patched profiles.tracking_opted_out — a column that does not
-- exist — so the toggle read as always-off and writes were dropped. A
-- direct client UPDATE is column-granted but silently no-ops for users
-- with no gamification row yet; this RPC upserts.
CREATE OR REPLACE FUNCTION public.set_tracking_opt_out(p_opted_out boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  INSERT INTO public.user_gamification (user_id, tracking_opted_out)
  VALUES (auth.uid(), COALESCE(p_opted_out, false))
  ON CONFLICT (user_id)
  DO UPDATE SET tracking_opted_out = COALESCE(p_opted_out, false);
  RETURN jsonb_build_object('success', true, 'tracking_opted_out', COALESCE(p_opted_out, false));
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_tracking_opt_out(boolean) TO authenticated;

-- The matching read for the Settings toggle (profiles has no such column).
CREATE OR REPLACE FUNCTION public.get_tracking_opt_out()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT g.tracking_opted_out FROM public.user_gamification g
                    WHERE g.user_id = auth.uid()), false);
$$;
GRANT EXECUTE ON FUNCTION public.get_tracking_opt_out() TO authenticated;

-- track_event: read the canonical opt-out (user_gamification), not the
-- non-existent profiles column. Missing gamification row = not opted out.
CREATE OR REPLACE FUNCTION public.track_event(p_name text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_opted_out bool;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT COALESCE(g.tracking_opted_out, false) INTO v_opted_out
    FROM public.user_gamification g WHERE g.user_id = auth.uid();
  IF COALESCE(v_opted_out, false) THEN RETURN; END IF;
  INSERT INTO public.analytics_events (user_id, name, payload)
    VALUES (auth.uid(), p_name, COALESCE(p_payload, '{}'::jsonb));
END;
$$;
