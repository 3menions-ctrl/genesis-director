-- Fix react_to_message: reacting to a DM failed for ALL users with
--   42883 "operator does not exist: boolean > integer"
-- because v_existed was declared bool, but `GET DIAGNOSTICS v_existed = ROW_COUNT`
-- assigns an integer, and `IF v_existed > 0` then compares bool > integer.
-- Declare it int (its actual value is a row count).
CREATE OR REPLACE FUNCTION public.react_to_message(p_message_id uuid, p_emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_existed int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.direct_messages
     WHERE id = p_message_id AND (sender_id = auth.uid() OR recipient_id = auth.uid())
  ) THEN RAISE EXCEPTION 'not_a_participant'; END IF;
  DELETE FROM public.dm_reactions
   WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji;
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed > 0 THEN
    RETURN jsonb_build_object('reacted', false);
  END IF;
  INSERT INTO public.dm_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji);
  RETURN jsonb_build_object('reacted', true);
END;
$function$;
