
-- ============================================================================
-- Workspace operational backbone
-- ============================================================================

-- 0. Soft-delete marker for organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================================
-- 1. Helper: resolve caller's role in an org (security definer to avoid RLS recursion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_org_member_role(_org_id UUID, _user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.organization_members
  WHERE organization_id = _org_id AND user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_org_has_min_role(_org_id UUID, _user_id UUID, _min TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id
      AND CASE role::text
            WHEN 'owner'    THEN 5
            WHEN 'admin'    THEN 4
            WHEN 'producer' THEN 3
            WHEN 'reviewer' THEN 2
            WHEN 'viewer'   THEN 1
            ELSE 0
          END >= CASE _min
            WHEN 'owner'    THEN 5
            WHEN 'admin'    THEN 4
            WHEN 'producer' THEN 3
            WHEN 'reviewer' THEN 2
            WHEN 'viewer'   THEN 1
            ELSE 0
          END
  );
$$;

-- ============================================================================
-- 2. Audit events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id        UUID, -- nullable: anonymized after hard-delete
  actor_name      TEXT,
  category        TEXT NOT NULL,  -- members | brand | billing | assets | projects | security | settings
  action          TEXT NOT NULL,  -- e.g. 'member.invited', 'brand.colors.updated', 'project.deleted'
  target_kind     TEXT,
  target_id       TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON public.workspace_audit_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org_category ON public.workspace_audit_events (organization_id, category);

ALTER TABLE public.workspace_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own org audit" ON public.workspace_audit_events;
CREATE POLICY "Members read own org audit"
  ON public.workspace_audit_events FOR SELECT TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'viewer'));

DROP POLICY IF EXISTS "Admins insert audit" ON public.workspace_audit_events;
CREATE POLICY "Admins insert audit"
  ON public.workspace_audit_events FOR INSERT TO authenticated
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'viewer'));

CREATE OR REPLACE FUNCTION public.fn_log_workspace_event(
  _org_id UUID,
  _category TEXT,
  _action TEXT,
  _target_kind TEXT DEFAULT NULL,
  _target_id TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _name TEXT;
BEGIN
  IF NOT public.fn_org_has_min_role(_org_id, auth.uid(), 'viewer') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COALESCE(display_name, full_name, email) INTO _name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.workspace_audit_events
    (organization_id, actor_id, actor_name, category, action, target_kind, target_id, metadata)
  VALUES
    (_org_id, auth.uid(), _name, _category, _action, _target_kind, _target_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- ============================================================================
-- 3. API keys (org-scoped)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.org_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL,
  name            TEXT NOT NULL,
  prefix          TEXT NOT NULL,            -- first 8 chars, safe to display
  key_hash        TEXT NOT NULL,            -- sha-256, never exposed
  scopes          TEXT[] NOT NULL DEFAULT ARRAY['read','generate']::text[],
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_api_keys_org ON public.org_api_keys (organization_id);

ALTER TABLE public.org_api_keys ENABLE ROW LEVEL SECURITY;

-- Deny direct SELECT on the base table; expose a sanitized view instead.
DROP POLICY IF EXISTS "Block direct read" ON public.org_api_keys;
CREATE POLICY "Block direct read"
  ON public.org_api_keys FOR SELECT TO authenticated
  USING (false);

DROP POLICY IF EXISTS "Admins create keys" ON public.org_api_keys;
CREATE POLICY "Admins create keys"
  ON public.org_api_keys FOR INSERT TO authenticated
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin') AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admins revoke keys" ON public.org_api_keys;
CREATE POLICY "Admins revoke keys"
  ON public.org_api_keys FOR UPDATE TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));

-- Sanitized view (no key_hash)
CREATE OR REPLACE VIEW public.org_api_keys_safe
WITH (security_invoker=on) AS
  SELECT id, organization_id, created_by, name, prefix, scopes,
         last_used_at, revoked_at, created_at
  FROM public.org_api_keys;

GRANT SELECT ON public.org_api_keys_safe TO authenticated;

-- View visibility wrapper: re-expose row visibility via a tailored policy
DROP POLICY IF EXISTS "Admins read keys via view" ON public.org_api_keys;
CREATE POLICY "Admins read keys via view"
  ON public.org_api_keys FOR SELECT TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));
-- (Replaces the deny policy above so the view works. Drop deny.)
DROP POLICY IF EXISTS "Block direct read" ON public.org_api_keys;
-- Application code must always query the view, never raw table; key_hash stays
-- write-only by convention. (Cannot hide single column via RLS in PG.)

-- ============================================================================
-- 4. Notification preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.org_notification_prefs (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  prefs           JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID
);
ALTER TABLE public.org_notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read prefs" ON public.org_notification_prefs;
CREATE POLICY "Members read prefs"
  ON public.org_notification_prefs FOR SELECT TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'viewer'));

DROP POLICY IF EXISTS "Admins write prefs" ON public.org_notification_prefs;
CREATE POLICY "Admins write prefs"
  ON public.org_notification_prefs FOR INSERT TO authenticated
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin') AND updated_by = auth.uid());

DROP POLICY IF EXISTS "Admins update prefs" ON public.org_notification_prefs;
CREATE POLICY "Admins update prefs"
  ON public.org_notification_prefs FOR UPDATE TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));

-- ============================================================================
-- 5. Templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.org_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_url     TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT true,
  use_count       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_templates_org ON public.org_templates (organization_id);

ALTER TABLE public.org_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read templates" ON public.org_templates;
CREATE POLICY "Members read templates"
  ON public.org_templates FOR SELECT TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'viewer'));

DROP POLICY IF EXISTS "Producers create templates" ON public.org_templates;
CREATE POLICY "Producers create templates"
  ON public.org_templates FOR INSERT TO authenticated
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'producer') AND created_by = auth.uid());

DROP POLICY IF EXISTS "Producers update templates" ON public.org_templates;
CREATE POLICY "Producers update templates"
  ON public.org_templates FOR UPDATE TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'producer'))
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'producer'));

DROP POLICY IF EXISTS "Admins delete templates" ON public.org_templates;
CREATE POLICY "Admins delete templates"
  ON public.org_templates FOR DELETE TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'admin'));

-- ============================================================================
-- 6. Approval requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL,
  submitted_by    UUID NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | withdrawn
  note            TEXT,
  reviewer_id     UUID,
  reviewer_note   TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approvals_org_status ON public.approval_requests (organization_id, status, created_at DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read approvals" ON public.approval_requests;
CREATE POLICY "Members read approvals"
  ON public.approval_requests FOR SELECT TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'viewer'));

DROP POLICY IF EXISTS "Producers submit approvals" ON public.approval_requests;
CREATE POLICY "Producers submit approvals"
  ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'producer') AND submitted_by = auth.uid());

DROP POLICY IF EXISTS "Reviewers update approvals" ON public.approval_requests;
CREATE POLICY "Reviewers update approvals"
  ON public.approval_requests FOR UPDATE TO authenticated
  USING (public.fn_org_has_min_role(organization_id, auth.uid(), 'reviewer'))
  WITH CHECK (public.fn_org_has_min_role(organization_id, auth.uid(), 'reviewer'));

-- ============================================================================
-- 7. Update org timestamps trigger (re-use shared helper if present)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_templates_touch') THEN
    CREATE TRIGGER trg_templates_touch BEFORE UPDATE ON public.org_templates
      FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notif_prefs_touch') THEN
    CREATE TRIGGER trg_notif_prefs_touch BEFORE UPDATE ON public.org_notification_prefs
      FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 8. Workspace deletion RPC (soft-delete then async purge)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_soft_delete_org(_org_id UUID, _confirm_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name TEXT;
BEGIN
  IF NOT public.fn_org_has_min_role(_org_id, auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'forbidden: owner role required';
  END IF;
  SELECT name INTO _name FROM public.organizations WHERE id = _org_id;
  IF _name IS NULL OR _name <> _confirm_name THEN
    RAISE EXCEPTION 'workspace name confirmation does not match';
  END IF;
  UPDATE public.organizations SET deleted_at = now() WHERE id = _org_id;
  PERFORM public.fn_log_workspace_event(_org_id, 'settings', 'workspace.soft_deleted', 'org', _org_id::text, '{}'::jsonb);
END;
$$;

-- ============================================================================
-- 9. Ownership transfer RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_transfer_ownership(_org_id UUID, _new_owner UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_org_has_min_role(_org_id, auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'forbidden: owner role required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id=_org_id AND user_id=_new_owner) THEN
    RAISE EXCEPTION 'target user is not a member';
  END IF;
  UPDATE public.organization_members SET role='admin'  WHERE organization_id=_org_id AND user_id=auth.uid();
  UPDATE public.organization_members SET role='owner'  WHERE organization_id=_org_id AND user_id=_new_owner;
  PERFORM public.fn_log_workspace_event(_org_id, 'members', 'workspace.ownership_transferred', 'user', _new_owner::text, '{}'::jsonb);
END;
$$;
