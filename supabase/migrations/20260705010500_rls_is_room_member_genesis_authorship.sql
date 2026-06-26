-- M15 / audit D27,D28: RLS holes.
--
-- D27: is_room_member(room, user) is SECURITY DEFINER, takes an arbitrary
--   p_user_id, has no caller check, and is granted to PUBLIC/anon. For a
--   'patron' room it returns whether p_user_id holds an active pledge meeting
--   the threshold — so anyone could enumerate a creator's paying patrons.
--   Add an anti-enumeration guard (you may only check your own membership
--   unless you own the room; service-role bypasses) and revoke anon/PUBLIC.
-- D28: two shared-canon genesis tables let any signed-in user INSERT rows with
--   an arbitrary authorship column (WITH CHECK only required auth.uid() IS NOT
--   NULL). Bind the author column to auth.uid(). (The other three genesis
--   tables flagged have no authorship column to forge.)
--
-- NOTE: system_status_overview anon access is INTENTIONAL (public /help status
-- panel, per the prior verified hunt) and is left as-is. The split_part(email)
-- display-name fallback (D29) is not a live break (the email-column revoke is
-- in the unapplied migration backlog) and is deferred with that backlog.

CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_room record;
  v_member bool;
  v_patron_pledge int;
BEGIN
  -- Anti-enumeration (D27): a signed-in caller may only check their OWN
  -- membership, unless they own the room. Service-role (auth.uid() IS NULL)
  -- bypasses for internal/RLS checks.
  IF auth.uid() IS NOT NULL
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = p_room_id AND owner_id = auth.uid()) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_room FROM public.chat_rooms WHERE id = p_room_id;
  IF NOT FOUND OR v_room.archived_at IS NOT NULL THEN RETURN false; END IF;
  IF v_room.owner_id = p_user_id THEN RETURN true; END IF;

  IF v_room.kind = 'patron' THEN
    SELECT COALESCE(MAX(monthly_credits), 0) INTO v_patron_pledge
      FROM public.patron_subscriptions
     WHERE creator_id = v_room.owner_id AND patron_id = p_user_id AND cancelled_at IS NULL;
    RETURN v_patron_pledge >= COALESCE(v_room.min_monthly_credits, 0);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_members
     WHERE room_id = p_room_id AND user_id = p_user_id
  ) INTO v_member;
  IF v_room.kind = 'public' AND NOT v_member THEN
    RETURN true;
  END IF;
  RETURN v_member;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO authenticated, service_role;

-- D28: bind authorship to the caller on the two ownable genesis canon tables.
ALTER POLICY "Authenticated users can create arcs" ON public.genesis_story_arcs
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
ALTER POLICY "Authenticated users can propose anchors" ON public.genesis_continuity_anchors
  WITH CHECK (auth.uid() IS NOT NULL AND established_by = auth.uid());
