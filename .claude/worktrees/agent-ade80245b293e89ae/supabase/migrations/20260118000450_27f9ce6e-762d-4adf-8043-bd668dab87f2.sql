-- Fix support messages policy to use rate limiting instead of blanket true
DROP POLICY IF EXISTS "Anyone can submit support messages" ON public.support_messages;

-- Replace with rate-limited policy (using trigger approach since RLS can't call functions easily)
CREATE POLICY "Anyone can submit support messages with rate limit"
ON public.support_messages FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Limit to 5 messages per email per hour
  (SELECT COUNT(*) FROM support_messages sm 
   WHERE sm.email = email 
   AND sm.created_at > now() - interval '1 hour') < 5
);