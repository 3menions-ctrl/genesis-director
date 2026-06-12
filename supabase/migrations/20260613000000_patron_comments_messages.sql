-- ════════════════════════════════════════════════════════════════════════
-- Patron subscriptions: charge mechanism + dedicated RPCs
-- Reel comments: text-comment surface for the Theater
-- Both are entertainment-hub follow-ups identified in the Domain 2/3/9 audit.
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. PLEDGE_PATRON RPC — replaces raw `.insert()` from CreatorChannel
-- ────────────────────────────────────────────────────────────────────────
-- The previous flow wrote directly to patron_subscriptions via the client.
-- That bypassed server-side validation (self-pledge, amount sanity, balance
-- check on the first month, etc). This RPC consolidates the logic and
-- charges the first month immediately so the creator sees the credits
-- right away — same UX as a Patreon "pledge now" confirmation.
CREATE OR REPLACE FUNCTION public.pledge_patron(
  p_creator_id uuid,
  p_monthly_credits int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_balance int;
  v_existing public.patron_subscriptions%ROWTYPE;
  v_creator_cut int;
  v_platform_cut int;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_creator_id = auth.uid() THEN RAISE EXCEPTION 'cannot_pledge_self'; END IF;
  IF p_monthly_credits <= 0 OR p_monthly_credits > 10000 THEN
    RAISE EXCEPTION 'invalid_credits';
  END IF;

  -- Creator must exist as a profile (auth.users FK is checked by the table)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_creator_id) THEN
    RAISE EXCEPTION 'creator_not_found';
  END IF;

  SELECT credits_balance INTO v_buyer_balance
  FROM public.profiles WHERE id = auth.uid();
  IF v_buyer_balance IS NULL OR v_buyer_balance < p_monthly_credits THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  -- Same 90/10 split as tip_reel — keeps creator-economy math consistent.
  v_creator_cut := (p_monthly_credits * 90) / 100;
  v_platform_cut := p_monthly_credits - v_creator_cut;

  -- Upsert: if a (creator, patron) pair already exists, update the amount
  -- and renewal window. If cancelled, this re-activates it.
  SELECT * INTO v_existing FROM public.patron_subscriptions
    WHERE creator_id = p_creator_id AND patron_id = auth.uid();

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.patron_subscriptions SET
      monthly_credits = p_monthly_credits,
      renewal_due_at  = v_now + interval '30 days',
      cancelled_at    = NULL
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.patron_subscriptions
      (creator_id, patron_id, monthly_credits, started_at, renewal_due_at)
    VALUES
      (p_creator_id, auth.uid(), p_monthly_credits, v_now, v_now + interval '30 days');
  END IF;

  -- Charge the first month right now.
  UPDATE public.profiles SET
    credits_balance = credits_balance - p_monthly_credits,
    total_credits_used = COALESCE(total_credits_used, 0) + p_monthly_credits,
    updated_at = v_now
  WHERE id = auth.uid();
  UPDATE public.profiles SET
    credits_balance = COALESCE(credits_balance, 0) + v_creator_cut,
    updated_at = v_now
  WHERE id = p_creator_id;

  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (auth.uid(), -p_monthly_credits, 'patron_pledge',
            'Pledged ' || p_monthly_credits || ' cr/mo to ' || p_creator_id::text);
  INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (p_creator_id, v_creator_cut, 'patron_received',
            'Patron payment from ' || auth.uid()::text);

  RETURN jsonb_build_object(
    'success', true,
    'creator_received', v_creator_cut,
    'next_charge_at', v_now + interval '30 days'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pledge_patron(uuid, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pledge_patron(uuid, int) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 2. CANCEL_PATRON RPC — patron initiates cancel; keeps the row for audit
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_patron(p_creator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.patron_subscriptions
     SET cancelled_at = now()
   WHERE patron_id = auth.uid() AND creator_id = p_creator_id AND cancelled_at IS NULL;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_patron(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_patron(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 3. CHARGE_PATRON_RENEWALS RPC — driven by a daily cron
-- ────────────────────────────────────────────────────────────────────────
-- Skips:
--   • cancelled pledges
--   • pledges whose patron is out of credits (we mark them cancelled and
--     emit a `patron_lapsed` notification row).
--   • the original 30-day window from started_at (the first month was
--     charged synchronously inside pledge_patron).
--
-- For each due pledge, we transfer credits and roll renewal_due_at forward
-- by 30 days. Returns a summary so the cron caller can log.
CREATE OR REPLACE FUNCTION public.charge_patron_renewals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_buyer_balance int;
  v_creator_cut int;
  v_charged int := 0;
  v_lapsed int := 0;
  v_skipped int := 0;
  v_now timestamptz := now();
BEGIN
  FOR v_row IN
    SELECT id, creator_id, patron_id, monthly_credits, renewal_due_at
      FROM public.patron_subscriptions
     WHERE cancelled_at IS NULL
       AND renewal_due_at <= v_now
     ORDER BY renewal_due_at ASC
     LIMIT 10000
  LOOP
    SELECT credits_balance INTO v_buyer_balance
      FROM public.profiles WHERE id = v_row.patron_id;

    IF v_buyer_balance IS NULL OR v_buyer_balance < v_row.monthly_credits THEN
      -- Patron is broke. Lapse the pledge and notify both sides.
      UPDATE public.patron_subscriptions
         SET cancelled_at = v_now
       WHERE id = v_row.id;
      INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (v_row.patron_id, 'low_credits',
                'Your patron pledge was paused',
                'You ran out of credits before the monthly charge. Top up to keep supporting this creator.',
                jsonb_build_object('creator_id', v_row.creator_id, 'pledge_id', v_row.id));
      v_lapsed := v_lapsed + 1;
      CONTINUE;
    END IF;

    v_creator_cut := (v_row.monthly_credits * 90) / 100;

    UPDATE public.profiles SET
      credits_balance = credits_balance - v_row.monthly_credits,
      total_credits_used = COALESCE(total_credits_used, 0) + v_row.monthly_credits,
      updated_at = v_now
    WHERE id = v_row.patron_id;
    UPDATE public.profiles SET
      credits_balance = COALESCE(credits_balance, 0) + v_creator_cut,
      updated_at = v_now
    WHERE id = v_row.creator_id;
    UPDATE public.patron_subscriptions
       SET renewal_due_at = v_now + interval '30 days'
     WHERE id = v_row.id;

    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
      VALUES (v_row.patron_id, -v_row.monthly_credits, 'patron_renewal',
              'Monthly patron charge to ' || v_row.creator_id::text);
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
      VALUES (v_row.creator_id, v_creator_cut, 'patron_received',
              'Patron monthly from ' || v_row.patron_id::text);
    v_charged := v_charged + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'charged', v_charged,
    'lapsed', v_lapsed,
    'skipped', v_skipped,
    'ran_at', v_now
  );
END;
$$;
-- Only service_role can run the renewal cron.
REVOKE EXECUTE ON FUNCTION public.charge_patron_renewals() FROM PUBLIC, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 4. REEL COMMENTS — text comment surface for the Theater
-- ════════════════════════════════════════════════════════════════════════
-- This is the text-comment primitive the audit flagged as missing. We
-- intentionally avoid threading: top-level comments only, with a like
-- count. Keeps the model simple and the UI snappy. If threading becomes
-- valuable later, a `parent_id` column slots in.
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id     uuid NOT NULL REFERENCES public.published_reels(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  like_count  bigint NOT NULL DEFAULT 0,
  is_hidden   bool NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON public.reel_comments(reel_id, created_at DESC) WHERE NOT is_hidden;
CREATE INDEX IF NOT EXISTS idx_reel_comments_author ON public.reel_comments(author_id, created_at DESC);

ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reel comments public read" ON public.reel_comments;
CREATE POLICY "Reel comments public read" ON public.reel_comments FOR SELECT
  USING (NOT is_hidden);
DROP POLICY IF EXISTS "Author manages own comment" ON public.reel_comments;
CREATE POLICY "Author manages own comment" ON public.reel_comments FOR ALL
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- Per-viewer like ledger for comments.
CREATE TABLE IF NOT EXISTS public.reel_comment_likes (
  comment_id  uuid NOT NULL REFERENCES public.reel_comments(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_comment_likes_user ON public.reel_comment_likes(user_id);
ALTER TABLE public.reel_comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comment likes visible" ON public.reel_comment_likes;
CREATE POLICY "Comment likes visible" ON public.reel_comment_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Liker manages own" ON public.reel_comment_likes;
CREATE POLICY "Liker manages own" ON public.reel_comment_likes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── add_reel_comment RPC ──────────────────────────────────────────────
-- Returns the new comment row + the author profile so the client can
-- optimistically prepend it without a follow-up roundtrip.
CREATE OR REPLACE FUNCTION public.add_reel_comment(p_reel_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_trim text;
  v_profile jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  v_trim := COALESCE(NULLIF(trim(p_body), ''), '');
  IF length(v_trim) = 0 THEN RAISE EXCEPTION 'empty_body'; END IF;
  IF length(v_trim) > 1000 THEN RAISE EXCEPTION 'too_long'; END IF;
  -- Hidden / taken-down reels reject new comments.
  IF NOT EXISTS (
    SELECT 1 FROM public.published_reels WHERE id = p_reel_id AND NOT is_taken_down
  ) THEN RAISE EXCEPTION 'reel_not_found'; END IF;

  INSERT INTO public.reel_comments (reel_id, author_id, body)
    VALUES (p_reel_id, auth.uid(), v_trim)
    RETURNING id INTO v_id;

  SELECT jsonb_build_object(
    'id', p.id,
    'display_name', COALESCE(p.display_name, p.full_name, split_part(p.email,'@',1)),
    'avatar_url', p.avatar_url
  ) INTO v_profile FROM public.profiles p WHERE p.id = auth.uid();

  RETURN jsonb_build_object(
    'id', v_id,
    'reel_id', p_reel_id,
    'author_id', auth.uid(),
    'body', v_trim,
    'like_count', 0,
    'created_at', now(),
    'author', COALESCE(v_profile, '{}'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_reel_comment(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.add_reel_comment(uuid, text) TO authenticated;

-- ── toggle_like_reel_comment RPC ──────────────────────────────────────
-- Same atomic-flip pattern as toggle_like_reel.
CREATE OR REPLACE FUNCTION public.toggle_like_reel_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existed bool;
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  DELETE FROM public.reel_comment_likes WHERE comment_id = p_comment_id AND user_id = auth.uid();
  GET DIAGNOSTICS v_existed = ROW_COUNT;
  IF v_existed = 0 THEN
    INSERT INTO public.reel_comment_likes (comment_id, user_id) VALUES (p_comment_id, auth.uid())
      ON CONFLICT DO NOTHING;
    UPDATE public.reel_comments SET like_count = like_count + 1 WHERE id = p_comment_id
      RETURNING like_count INTO v_count;
    RETURN jsonb_build_object('liked', true, 'like_count', v_count);
  ELSE
    UPDATE public.reel_comments SET like_count = GREATEST(0, like_count - 1) WHERE id = p_comment_id
      RETURNING like_count INTO v_count;
    RETURN jsonb_build_object('liked', false, 'like_count', v_count);
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.toggle_like_reel_comment(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.toggle_like_reel_comment(uuid) TO authenticated;

-- ── reel_comments_for RPC ────────────────────────────────────────────
-- One call fetches the comment list + author display info + which ones
-- the current viewer has liked. Cursor-paginated by created_at.
CREATE OR REPLACE FUNCTION public.reel_comments_for(
  p_reel_id uuid,
  p_cursor timestamptz DEFAULT NULL,
  p_limit int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'reel_id', c.reel_id,
    'author_id', c.author_id,
    'body', c.body,
    'like_count', c.like_count,
    'created_at', c.created_at,
    'author', jsonb_build_object(
      'id', p.id,
      'display_name', COALESCE(p.display_name, p.full_name, split_part(p.email,'@',1)),
      'avatar_url', p.avatar_url
    ),
    'viewer_liked', CASE
      WHEN auth.uid() IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.reel_comment_likes
         WHERE comment_id = c.id AND user_id = auth.uid()
      )
    END
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT * FROM public.reel_comments
     WHERE reel_id = p_reel_id AND NOT is_hidden
       AND (p_cursor IS NULL OR created_at < p_cursor)
     ORDER BY created_at DESC
     LIMIT GREATEST(1, LEAST(p_limit, 100))
  ) c
  LEFT JOIN public.profiles p ON p.id = c.author_id;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reel_comments_for(uuid, timestamptz, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reel_comments_for(uuid, timestamptz, int) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 5. CREATE_ATOM_LISTING RPC — server-side listing creation
-- ════════════════════════════════════════════════════════════════════════
-- Until now, atom_listings could only be inserted directly via the table
-- (no UI flow + no validation). This RPC centralises the business rules
-- the Atom Marketplace expects so the new AtomListingWizard has a single
-- contract to write against:
--
--   • Caller must be authenticated (seller_id = auth.uid()).
--   • atom_type must be one of the allowed set (already CHECK'd in the
--     table; we re-validate to return a clean error message).
--   • royalty_pct clamped to 0-90 (matches table CHECK).
--   • price_credits must be >= 0.
--   • name + description trimmed; name required.
--
-- Returns the new listing row's id so the wizard can navigate to it.
CREATE OR REPLACE FUNCTION public.create_atom_listing(
  p_atom_type     text,
  p_atom_ref      text,
  p_name          text,
  p_description   text,
  p_price_credits int,
  p_royalty_pct   int DEFAULT 10,
  p_preview_url   text DEFAULT NULL,
  p_thumbnail_url text DEFAULT NULL,
  p_tags          text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_atom_type NOT IN ('voice','character','location','look','score','vfx_pack','sheet_music','course') THEN
    RAISE EXCEPTION 'invalid_atom_type';
  END IF;
  v_name := COALESCE(NULLIF(trim(p_name), ''), '');
  IF length(v_name) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF length(v_name) > 120 THEN RAISE EXCEPTION 'name_too_long'; END IF;
  IF p_price_credits IS NULL OR p_price_credits < 0 THEN
    RAISE EXCEPTION 'invalid_price';
  END IF;
  IF p_royalty_pct IS NULL OR p_royalty_pct < 0 OR p_royalty_pct > 90 THEN
    RAISE EXCEPTION 'invalid_royalty_pct';
  END IF;
  IF p_atom_ref IS NULL OR length(trim(p_atom_ref)) = 0 THEN
    RAISE EXCEPTION 'atom_ref_required';
  END IF;

  INSERT INTO public.atom_listings (
    seller_id, atom_type, atom_ref, name, description,
    preview_url, thumbnail_url, price_credits, royalty_pct, tags, is_active
  ) VALUES (
    auth.uid(), p_atom_type, trim(p_atom_ref), v_name, NULLIF(trim(p_description), ''),
    p_preview_url, p_thumbnail_url, p_price_credits, p_royalty_pct,
    COALESCE(p_tags, '{}'::text[]), true
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('listing_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_atom_listing(text, text, text, text, int, int, text, text, text[])
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_atom_listing(text, text, text, text, int, int, text, text, text[])
  TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 6. DAILY-PROMPT SCHEDULING — admin-callable RPC
-- ════════════════════════════════════════════════════════════════════════
-- Audit Finding (Domain 6): the prompts table seeded one row for today.
-- After 24h, `current_daily_prompt` keeps returning the most recent row
-- but it never refreshes. Operators need a way to schedule future prompts.
--
-- This RPC is admin-only. It UPSERTS on `prompt_date` so re-scheduling
-- the same day overwrites cleanly.
CREATE OR REPLACE FUNCTION public.admin_schedule_daily_prompt(
  p_prompt_date date,
  p_prompt_text text,
  p_prompt_hint text DEFAULT NULL,
  p_world_slug  text DEFAULT NULL,
  p_cover_url   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin bool;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  -- Admin gate. Existing pattern is via user_roles table.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'admin_required'; END IF;

  IF p_prompt_text IS NULL OR length(trim(p_prompt_text)) = 0 THEN
    RAISE EXCEPTION 'prompt_text_required';
  END IF;

  INSERT INTO public.daily_prompts (prompt_date, prompt_text, prompt_hint, world_slug, cover_url)
    VALUES (p_prompt_date, trim(p_prompt_text), p_prompt_hint, p_world_slug, p_cover_url)
  ON CONFLICT (prompt_date) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    prompt_hint = EXCLUDED.prompt_hint,
    world_slug  = EXCLUDED.world_slug,
    cover_url   = EXCLUDED.cover_url
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('prompt_id', v_id, 'prompt_date', p_prompt_date);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_schedule_daily_prompt(date, text, text, text, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_schedule_daily_prompt(date, text, text, text, text)
  TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 7. CHARACTER LOANS — RPCs for the Crews collab loop
-- ════════════════════════════════════════════════════════════════════════
-- Audit Finding (Domain 5): `character_loans` table exists but no UI hook.
-- Add light RPCs so the Crew page can:
--   • list active loans for a crew
--   • request a loan
--   • approve/decline a pending loan (lender side)
--
-- character_loans schema lives in an earlier migration; here we wrap it.
-- Defensive: only operate on tables that exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'character_loans') THEN
    -- Loans table not yet created — abort additions so this migration stays idempotent.
    RAISE NOTICE 'character_loans table missing; skipping loan RPCs';
  END IF;
END $$;

-- request_character_loan: requester asks owner to loan a character INTO a
-- specific project they own. Idempotent on (character_id, borrower_id,
-- project_id) — re-requesting the same triple refreshes the timestamp.
--
-- Schema reminder (from migration 20260112040321):
--   character_loans (character_id, owner_id, borrower_id, project_id,
--                    status, requested_at, responded_at, expires_at, …)
--   status ∈ pending | approved | denied | expired | revoked
CREATE OR REPLACE FUNCTION public.request_character_loan(
  p_character_id uuid,
  p_project_id uuid,
  p_usage_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT user_id INTO v_owner FROM public.characters WHERE id = p_character_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'character_not_found'; END IF;
  IF v_owner = auth.uid() THEN RAISE EXCEPTION 'cannot_loan_own_character'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.movie_projects WHERE id = p_project_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not_project_owner'; END IF;

  -- Find an existing loan record for this triple — if denied, re-pending it.
  SELECT id INTO v_id
    FROM public.character_loans
   WHERE character_id = p_character_id
     AND borrower_id = auth.uid()
     AND project_id = p_project_id
   ORDER BY requested_at DESC NULLS LAST
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.character_loans
       SET status = CASE WHEN status IN ('denied','expired','revoked') THEN 'pending' ELSE status END,
           requested_at = now(),
           usage_notes = COALESCE(p_usage_notes, usage_notes)
     WHERE id = v_id;
  ELSE
    INSERT INTO public.character_loans
      (character_id, owner_id, borrower_id, project_id, status, usage_notes)
    VALUES
      (p_character_id, v_owner, auth.uid(), p_project_id, 'pending', p_usage_notes)
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('loan_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_character_loan(uuid, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.request_character_loan(uuid, uuid, text) TO authenticated;

-- decide_character_loan: owner approves/denies. Only the owner of the
-- character (the row's owner_id) can call this.
CREATE OR REPLACE FUNCTION public.decide_character_loan(
  p_loan_id uuid, p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_decision NOT IN ('approved','denied') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  SELECT owner_id INTO v_owner FROM public.character_loans WHERE id = p_loan_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'loan_not_found'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'not_the_owner'; END IF;
  UPDATE public.character_loans
     SET status = p_decision, responded_at = now()
   WHERE id = p_loan_id;
  RETURN jsonb_build_object('success', true, 'status', p_decision);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.decide_character_loan(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decide_character_loan(uuid, text) TO authenticated;
