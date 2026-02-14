
-- ============================================================
-- 1. signup_analytics: Add RESTRICTIVE anon deny
-- ============================================================
CREATE POLICY "Deny anonymous access to signup_analytics"
  ON public.signup_analytics AS RESTRICTIVE
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

-- Tighten admin SELECT to authenticated only
DROP POLICY IF EXISTS "Only admins can view signup analytics" ON public.signup_analytics;
CREATE POLICY "Only admins can view signup analytics"
  ON public.signup_analytics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tighten block policies to authenticated (anon already denied above)
DROP POLICY IF EXISTS "Block client inserts to signup analytics" ON public.signup_analytics;
CREATE POLICY "Block client inserts to signup analytics"
  ON public.signup_analytics FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "No updates to signup analytics" ON public.signup_analytics;
CREATE POLICY "No updates to signup analytics"
  ON public.signup_analytics FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "No deletes from signup analytics" ON public.signup_analytics;
CREATE POLICY "No deletes from signup analytics"
  ON public.signup_analytics FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================
-- 2. support_messages: Add anon deny for SELECT/UPDATE/DELETE
--    (keep anon INSERT for contact form with rate limit)
-- ============================================================
-- Tighten admin policies to authenticated
DROP POLICY IF EXISTS "Admins can view all support messages" ON public.support_messages;
CREATE POLICY "Admins can view all support messages"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update support messages" ON public.support_messages;
CREATE POLICY "Admins can update support messages"
  ON public.support_messages FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete support messages" ON public.support_messages;
CREATE POLICY "Admins can delete support messages"
  ON public.support_messages FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Tighten user view to authenticated
DROP POLICY IF EXISTS "Users can view own support messages" ON public.support_messages;
CREATE POLICY "Users can view own support messages"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'::text));

-- ============================================================
-- 3. user_gamification: Add anon deny, tighten UPDATE to authenticated
-- ============================================================
CREATE POLICY "Deny anonymous access to user_gamification"
  ON public.user_gamification AS RESTRICTIVE
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Users can update their own gamification" ON public.user_gamification;
CREATE POLICY "Users can update their own gamification"
  ON public.user_gamification FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. widget_events: Add anon deny, tighten to authenticated
-- ============================================================
CREATE POLICY "Deny anonymous access to widget_events"
  ON public.widget_events AS RESTRICTIVE
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Admins can view all widget events" ON public.widget_events;
CREATE POLICY "Admins can view all widget events"
  ON public.widget_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own widget events" ON public.widget_events;
CREATE POLICY "Users can view own widget events"
  ON public.widget_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM widget_configs wc
    WHERE wc.id = widget_events.widget_id AND wc.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Block direct event inserts" ON public.widget_events;
CREATE POLICY "Block direct event inserts"
  ON public.widget_events FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block event updates" ON public.widget_events;
CREATE POLICY "Block event updates"
  ON public.widget_events FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block event deletes" ON public.widget_events;
CREATE POLICY "Block event deletes"
  ON public.widget_events FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================
-- 5. production_credit_phases: Add anon deny, tighten to authenticated
-- ============================================================
CREATE POLICY "Deny anonymous access to production_credit_phases"
  ON public.production_credit_phases AS RESTRICTIVE
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Admins can view all credit phases" ON public.production_credit_phases;
CREATE POLICY "Admins can view all credit phases"
  ON public.production_credit_phases FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own credit phases" ON public.production_credit_phases;
CREATE POLICY "Users can view own credit phases"
  ON public.production_credit_phases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Block client production credit phase inserts" ON public.production_credit_phases;
CREATE POLICY "Block client production credit phase inserts"
  ON public.production_credit_phases FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ============================================================
-- 6. stitch_jobs: Add anon deny
-- ============================================================
CREATE POLICY "Deny anonymous access to stitch_jobs"
  ON public.stitch_jobs AS RESTRICTIVE
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);
