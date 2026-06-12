-- Admin command surface — RPCs powering the consolidated admin.
--
-- This migration adds the read + bulk-write functions the new admin shell
-- depends on. All RPCs are SECURITY DEFINER, guarded by is_admin(auth.uid()),
-- have EXECUTE revoked from PUBLIC + anon and granted to authenticated, and
-- write to admin_audit_log for every destructive operation.
--
-- Adds:
--   • admin_search_entities(text, int)         — unified palette search
--                                                  (users · projects · orgs)
--   • admin_get_project_detail(uuid)            — rich detail card for
--                                                  /admin/projects/:id
--   • admin_get_org_detail(uuid)                — rich detail card for
--                                                  /admin/orgs/:id
--   • admin_list_orgs(text, int, int)           — paginated org list for
--                                                  the People hub
--   • admin_dashboard_pulse()                   — single-roundtrip
--                                                  metric bundle for the
--                                                  redesigned dashboard
--   • admin_bulk_grant_credits(uuid[], int, text)
--   • admin_bulk_suspend(uuid[], text)
--   • admin_bulk_restore(uuid[])

-- ── 1. Unified palette search ─────────────────────────────────────────
-- Returns up to p_limit results across users, projects, and organizations,
-- ranked by recency within each entity bucket. The shape is intentionally
-- flat so the client can render a single list.
CREATE OR REPLACE FUNCTION public.admin_search_entities(
  p_query text, p_limit int DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users jsonb;
  v_projects jsonb;
  v_orgs jsonb;
  v_q text;
  v_like text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_q := COALESCE(NULLIF(trim(p_query), ''), '');
  v_like := '%' || v_q || '%';

  IF length(v_q) = 0 THEN
    -- Empty query → recent items across all three buckets.
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'kind','user',
      'id', p.id,
      'label', COALESCE(p.display_name, p.email, p.id::text),
      'sub', p.email,
      'avatar', p.avatar_url,
      'updated_at', p.updated_at
    ) ORDER BY p.updated_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_users
    FROM (SELECT * FROM public.profiles ORDER BY updated_at DESC NULLS LAST LIMIT p_limit) p;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'kind','user',
      'id', p.id,
      'label', COALESCE(p.display_name, p.email, p.id::text),
      'sub', p.email,
      'avatar', p.avatar_url,
      'updated_at', p.updated_at
    ) ORDER BY p.updated_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_users
    FROM (
      SELECT *
      FROM public.profiles
      WHERE email ILIKE v_like
         OR display_name ILIKE v_like
         OR id::text = v_q
      ORDER BY updated_at DESC NULLS LAST
      LIMIT p_limit
    ) p;
  END IF;

  IF length(v_q) = 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'kind','project',
      'id', mp.id,
      'label', COALESCE(NULLIF(mp.title,''), 'Untitled scene'),
      'sub', mp.status,
      'thumbnail', mp.thumbnail_url,
      'updated_at', mp.updated_at
    ) ORDER BY mp.updated_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_projects
    FROM (SELECT * FROM public.movie_projects ORDER BY updated_at DESC NULLS LAST LIMIT p_limit) mp;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'kind','project',
      'id', mp.id,
      'label', COALESCE(NULLIF(mp.title,''), 'Untitled scene'),
      'sub', mp.status,
      'thumbnail', mp.thumbnail_url,
      'updated_at', mp.updated_at
    ) ORDER BY mp.updated_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_projects
    FROM (
      SELECT *
      FROM public.movie_projects
      WHERE title ILIKE v_like
         OR id::text = v_q
      ORDER BY updated_at DESC NULLS LAST
      LIMIT p_limit
    ) mp;
  END IF;

  IF length(v_q) = 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'kind','org',
      'id', o.id,
      'label', o.name,
      'sub', o.plan,
      'avatar', o.logo_url,
      'updated_at', o.updated_at
    ) ORDER BY o.updated_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_orgs
    FROM (SELECT * FROM public.organizations ORDER BY updated_at DESC NULLS LAST LIMIT p_limit) o;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'kind','org',
      'id', o.id,
      'label', o.name,
      'sub', o.plan,
      'avatar', o.logo_url,
      'updated_at', o.updated_at
    ) ORDER BY o.updated_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_orgs
    FROM (
      SELECT *
      FROM public.organizations
      WHERE name ILIKE v_like
         OR slug ILIKE v_like
         OR id::text = v_q
      ORDER BY updated_at DESC NULLS LAST
      LIMIT p_limit
    ) o;
  END IF;

  RETURN jsonb_build_object(
    'users', v_users,
    'projects', v_projects,
    'orgs', v_orgs
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_search_entities(text, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_search_entities(text, int) TO authenticated;

-- ── 2. Project detail bundle ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_project_detail(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project jsonb;
  v_owner jsonb;
  v_clip_stats jsonb;
  v_cost jsonb;
  v_recent_events jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT to_jsonb(mp) - 'generated_script' - 'script_content'
  INTO v_project
  FROM public.movie_projects mp
  WHERE id = p_project_id;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;

  SELECT to_jsonb(p) - 'preferences' - 'notification_settings'
  INTO v_owner
  FROM public.profiles p
  WHERE p.id = (v_project->>'user_id')::uuid;

  SELECT jsonb_build_object(
    'total', count(*),
    'completed', count(*) FILTER (WHERE status = 'completed'),
    'failed', count(*) FILTER (WHERE status = 'failed'),
    'pending', count(*) FILTER (WHERE status NOT IN ('completed','failed'))
  )
  INTO v_clip_stats
  FROM public.video_clips
  WHERE project_id = p_project_id;

  -- Credit spend attributable to this project (best-effort — the ledger
  -- doesn't always carry a project_id; we look for it in `description`).
  SELECT jsonb_build_object(
    'total_credits_spent', COALESCE(sum(-amount) FILTER (WHERE amount < 0), 0),
    'transactions',        COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'amount', amount,
      'type', transaction_type,
      'description', description,
      'created_at', created_at
    ) ORDER BY created_at DESC) FILTER (WHERE created_at > now() - interval '90 days'),
    '[]'::jsonb)
  )
  INTO v_cost
  FROM public.credit_transactions
  WHERE user_id = (v_project->>'user_id')::uuid
    AND (description ILIKE '%' || p_project_id::text || '%'
         OR description ILIKE '%' || COALESCE(v_project->>'title','___nomatch___') || '%');

  -- Recent admin actions touching this project.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'admin_id', admin_id,
    'action', action,
    'details', details,
    'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_recent_events
  FROM (
    SELECT * FROM public.admin_audit_log
    WHERE target_type = 'project' AND target_id = p_project_id::text
    ORDER BY created_at DESC
    LIMIT 50
  ) l;

  RETURN jsonb_build_object(
    'project', v_project,
    'owner', COALESCE(v_owner, '{}'::jsonb),
    'clip_stats', v_clip_stats,
    'cost', v_cost,
    'recent_events', v_recent_events
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_project_detail(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_project_detail(uuid) TO authenticated;

-- ── 3. Organization detail bundle ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_org_detail(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org jsonb;
  v_members jsonb;
  v_invites jsonb;
  v_project_count int;
  v_recent_projects jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT to_jsonb(o)
  INTO v_org
  FROM public.organizations o
  WHERE id = p_org_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', om.user_id,
    'role', om.role,
    'joined_at', om.joined_at,
    'email', p.email,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url
  ) ORDER BY
    CASE om.role
      WHEN 'owner' THEN 0 WHEN 'admin' THEN 1
      WHEN 'producer' THEN 2 WHEN 'reviewer' THEN 3 ELSE 4
    END,
    om.joined_at
  ), '[]'::jsonb)
  INTO v_members
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE om.organization_id = p_org_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'email', i.email,
    'role', i.role,
    'expires_at', i.expires_at,
    'accepted_at', i.accepted_at
  ) ORDER BY i.created_at DESC), '[]'::jsonb)
  INTO v_invites
  FROM public.organization_invites i
  WHERE i.organization_id = p_org_id;

  SELECT count(*)
  INTO v_project_count
  FROM public.movie_projects mp
  WHERE mp.user_id IN (
    SELECT user_id FROM public.organization_members WHERE organization_id = p_org_id
  );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', mp.id,
    'title', mp.title,
    'status', mp.status,
    'thumbnail_url', mp.thumbnail_url,
    'updated_at', mp.updated_at
  ) ORDER BY mp.updated_at DESC), '[]'::jsonb)
  INTO v_recent_projects
  FROM (
    SELECT *
    FROM public.movie_projects
    WHERE user_id IN (
      SELECT user_id FROM public.organization_members WHERE organization_id = p_org_id
    )
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 12
  ) mp;

  RETURN jsonb_build_object(
    'org', v_org,
    'members', v_members,
    'invites', v_invites,
    'project_count', v_project_count,
    'recent_projects', v_recent_projects
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_org_detail(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_org_detail(uuid) TO authenticated;

-- ── 4. Org list for the People hub ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_orgs(
  p_search text DEFAULT NULL, p_limit int DEFAULT 100, p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'logo_url', o.logo_url,
    'plan', o.plan,
    'credits_balance', o.credits_balance,
    'total_credits_used', o.total_credits_used,
    'member_count', (SELECT count(*) FROM public.organization_members om WHERE om.organization_id = o.id),
    'created_at', o.created_at,
    'updated_at', o.updated_at
  ) ORDER BY o.updated_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT *
    FROM public.organizations
    WHERE p_search IS NULL OR p_search = ''
       OR name ILIKE '%' || p_search || '%'
       OR slug ILIKE '%' || p_search || '%'
    ORDER BY updated_at DESC NULLS LAST
    OFFSET p_offset LIMIT p_limit
  ) o;

  RETURN v_rows;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_orgs(text, int, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_orgs(text, int, int) TO authenticated;

-- ── 5. Dashboard pulse bundle ────────────────────────────────────────
-- Single roundtrip returning everything the redesigned action-card
-- dashboard needs. Cheap because every CTE is COUNT/SUM against an
-- indexed column or a small bounded window.
CREATE OR REPLACE FUNCTION public.admin_dashboard_pulse()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH
    t_users AS (
      SELECT
        count(*)                                          AS total_users,
        count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS signups_24h,
        count(*) FILTER (WHERE created_at > now() - interval '7 days')   AS signups_7d
      FROM public.profiles
    ),
    t_proj AS (
      SELECT
        count(*)                                              AS total,
        count(*) FILTER (WHERE status = 'completed')          AS completed,
        count(*) FILTER (WHERE status = 'failed')             AS failed,
        count(*) FILTER (WHERE status NOT IN ('completed','failed','draft')) AS in_flight,
        count(*) FILTER (WHERE created_at > now() - interval '24 hours')     AS created_24h
      FROM public.movie_projects
    ),
    t_credit AS (
      SELECT
        COALESCE(sum(amount) FILTER (WHERE transaction_type = 'grant'), 0)            AS lifetime_grants,
        COALESCE(sum(-amount) FILTER (WHERE amount < 0), 0)                            AS lifetime_spend,
        COALESCE(sum(amount) FILTER (WHERE amount < 0 AND created_at > now() - interval '24 hours'), 0) AS spend_24h_signed
      FROM public.credit_transactions
    ),
    t_sup AS (
      SELECT
        count(*) FILTER (WHERE status = 'open') AS open_tickets
      FROM public.support_messages
    )
  SELECT jsonb_build_object(
    'users', to_jsonb(t_users.*),
    'projects', to_jsonb(t_proj.*),
    'credits', to_jsonb(t_credit.*),
    'support', to_jsonb(t_sup.*),
    'generated_at', now()
  )
  INTO v
  FROM t_users, t_proj, t_credit, t_sup;

  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_pulse() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_dashboard_pulse() TO authenticated;

-- ── 6. Bulk grant credits ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_bulk_grant_credits(
  p_user_ids uuid[], p_amount int, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_count int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be > 0';
  END IF;
  IF p_amount > 10000 THEN
    RAISE EXCEPTION 'p_amount cap is 10000 per grant';
  END IF;
  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_user_ids, 1) > 500 THEN
    RAISE EXCEPTION 'p_user_ids must be 1-500 entries';
  END IF;

  FOREACH v_uid IN ARRAY p_user_ids LOOP
    UPDATE public.profiles
    SET credits_balance = COALESCE(credits_balance, 0) + p_amount,
        total_credits_purchased = COALESCE(total_credits_purchased, 0) + p_amount,
        updated_at = now()
    WHERE id = v_uid;
    INSERT INTO public.credit_transactions (user_id, amount, transaction_type, description)
    VALUES (v_uid, p_amount, 'grant',
      'Admin bulk grant: ' || COALESCE(p_reason, 'unspecified'));
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'bulk_grant_credits', 'user_set', 'bulk',
    jsonb_build_object('count', v_count, 'amount', p_amount, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_grant_credits(uuid[], int, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_bulk_grant_credits(uuid[], int, text) TO authenticated;

-- ── 7. Bulk suspend / restore ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_bulk_suspend(
  p_user_ids uuid[], p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_count int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_user_ids, 1) > 200 THEN
    RAISE EXCEPTION 'p_user_ids must be 1-200 entries';
  END IF;

  -- Protect: never suspend an admin or yourself in bulk. Filter them out.
  FOREACH v_uid IN ARRAY p_user_ids LOOP
    CONTINUE WHEN v_uid = auth.uid();
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_uid AND role::text = 'admin'
    );
    UPDATE public.profiles
    SET suspended_at = now(),
        suspended_reason = COALESCE(p_reason, suspended_reason),
        updated_at = now()
    WHERE id = v_uid;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'bulk_suspend', 'user_set', 'bulk',
    jsonb_build_object('count', v_count, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_suspend(uuid[], text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_bulk_suspend(uuid[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_bulk_restore(p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF array_length(p_user_ids, 1) IS NULL OR array_length(p_user_ids, 1) > 500 THEN
    RAISE EXCEPTION 'p_user_ids must be 1-500 entries';
  END IF;

  WITH upd AS (
    UPDATE public.profiles
    SET suspended_at = NULL,
        suspended_reason = NULL,
        updated_at = now()
    WHERE id = ANY(p_user_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'bulk_restore', 'user_set', 'bulk',
    jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_restore(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_bulk_restore(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.admin_search_entities IS
  'Unified palette search across users, projects, orgs. Empty query returns recent items per bucket.';
COMMENT ON FUNCTION public.admin_get_project_detail IS
  'Rich detail bundle for the admin project profile page. Excludes generated_script/script_content; includes clip stats, cost approximation, recent admin events.';
COMMENT ON FUNCTION public.admin_get_org_detail IS
  'Rich detail bundle for the admin org profile page. Members ordered by role precedence.';
COMMENT ON FUNCTION public.admin_list_orgs IS
  'Paginated org list with member counts for the People hub.';
COMMENT ON FUNCTION public.admin_dashboard_pulse IS
  'Single-roundtrip metric bundle for the redesigned admin dashboard.';
COMMENT ON FUNCTION public.admin_bulk_grant_credits IS
  'Bulk credit grant (≤ 500 users, ≤ 10k each). Writes one audit row per bulk call.';
COMMENT ON FUNCTION public.admin_bulk_suspend IS
  'Bulk suspend. Skips self and other admins by design. ≤ 200 entries.';
COMMENT ON FUNCTION public.admin_bulk_restore IS
  'Bulk restore (clears suspended_at / reason). ≤ 500 entries.';
