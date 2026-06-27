-- FIX (minor): allow users to DELETE their own notifications.
--
-- Live prod RLS on public.notifications (verified) has PERMISSIVE SELECT
-- ("Users can view own notifications") and UPDATE ("Users can update own
-- notifications") for authenticated users on their own rows, plus a RESTRICTIVE
-- anon-deny — so the bell/inbox display and mark-read already work. (The
-- readiness audit's "notifications 100% dead" was a false positive from migration
-- archaeology: 20260118000219 re-created the SELECT/UPDATE policies under new
-- names that survived the 20260213 drop.)
--
-- The one real gap: there is NO DELETE policy, so the client's dismiss/clear
-- (.delete() in useNotifications) silently fails under RLS. This adds the missing
-- own-rows DELETE policy. Notifications are created server-side via the service
-- role (RLS-exempt), so no INSERT policy is needed.

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
