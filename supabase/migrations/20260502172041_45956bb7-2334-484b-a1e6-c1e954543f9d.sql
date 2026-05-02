
-- ============================================================
-- B2B FOUNDATION: Organizations, Members, Roles, Invites
-- ============================================================

-- 1. Role enum
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'producer', 'reviewer', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  website TEXT,
  industry TEXT,
  plan TEXT NOT NULL DEFAULT 'starter',
  credits_balance INTEGER NOT NULL DEFAULT 0,
  total_credits_purchased INTEGER NOT NULL DEFAULT 0,
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- 3. Organization members
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.org_role NOT NULL DEFAULT 'viewer',
  invited_by UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- 4. Organization invites
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'viewer',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invites_org ON public.organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.organization_invites(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON public.organization_invites(token);

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER, no recursion in RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_org_role(p_org_id UUID, p_user_id UUID)
RETURNS public.org_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = p_user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_permission(p_org_id UUID, p_user_id UUID, p_min_role public.org_role)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role public.org_role;
  v_rank INT;
  v_min_rank INT;
BEGIN
  SELECT role INTO v_role FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id;
  IF v_role IS NULL THEN RETURN false; END IF;

  v_rank := CASE v_role
    WHEN 'owner' THEN 5 WHEN 'admin' THEN 4 WHEN 'producer' THEN 3
    WHEN 'reviewer' THEN 2 WHEN 'viewer' THEN 1 END;
  v_min_rank := CASE p_min_role
    WHEN 'owner' THEN 5 WHEN 'admin' THEN 4 WHEN 'producer' THEN 3
    WHEN 'reviewer' THEN 2 WHEN 'viewer' THEN 1 END;

  RETURN v_rank >= v_min_rank;
END;
$$;

-- Auto-add creator as owner when org is created
CREATE OR REPLACE FUNCTION public.add_org_creator_as_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_org_creator ON public.organizations;
CREATE TRIGGER trg_add_org_creator
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.add_org_creator_as_owner();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent demoting/removing the last owner
CREATE OR REPLACE FUNCTION public.protect_last_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE owner_count INT;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    SELECT COUNT(*) INTO owner_count FROM public.organization_members
    WHERE organization_id = OLD.organization_id AND role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner of an organization';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    SELECT COUNT(*) INTO owner_count FROM public.organization_members
    WHERE organization_id = OLD.organization_id AND role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last owner of an organization';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_last_owner ON public.organization_members;
CREATE TRIGGER trg_protect_last_owner
BEFORE UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Members can view their organizations"
ON public.organizations FOR SELECT TO authenticated
USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins and owners can update organizations"
ON public.organizations FOR UPDATE TO authenticated
USING (public.has_org_permission(id, auth.uid(), 'admin'));

CREATE POLICY "Only owners can delete organizations"
ON public.organizations FOR DELETE TO authenticated
USING (public.has_org_permission(id, auth.uid(), 'owner'));

-- Organization members policies
CREATE POLICY "Members can view org members"
ON public.organization_members FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins can add members"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Admins can update member roles"
ON public.organization_members FOR UPDATE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Admins can remove members or members can remove themselves"
ON public.organization_members FOR DELETE TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'admin')
  OR user_id = auth.uid()
);

-- Organization invites policies
CREATE POLICY "Org admins can view invites"
ON public.organization_invites FOR SELECT TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'admin'));

CREATE POLICY "Org admins can create invites"
ON public.organization_invites FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_permission(organization_id, auth.uid(), 'admin')
  AND invited_by = auth.uid()
);

CREATE POLICY "Org admins can delete invites"
ON public.organization_invites FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'admin'));

-- Accept-invite RPC (the recipient won't be a member yet, so RLS can't grant them access; use SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.accept_organization_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite public.organization_invites%ROWTYPE;
  v_user_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invite FROM public.organization_invites
  WHERE token = p_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite token');
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite already used');
  END IF;
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite expired');
  END IF;
  IF LOWER(v_invite.email) <> LOWER(v_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite is for a different email');
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
  VALUES (v_invite.organization_id, v_user_id, v_invite.role, v_invite.invited_by)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.organization_invites
  SET accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true, 'organization_id', v_invite.organization_id);
END;
$$;

-- ============================================================
-- ATTACH movie_projects TO ORGANIZATIONS
-- ============================================================
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_movie_projects_org ON public.movie_projects(organization_id);

-- Backfill: create a personal org for every existing user that has projects, or any profile
DO $$
DECLARE
  r RECORD;
  v_org_id UUID;
  v_slug TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id AS user_id, p.email, p.display_name
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_members m WHERE m.user_id = p.id
    )
  LOOP
    v_slug := COALESCE(
      regexp_replace(LOWER(COALESCE(r.display_name, split_part(r.email, '@', 1), 'workspace')), '[^a-z0-9]+', '-', 'g'),
      'workspace'
    ) || '-' || substr(r.user_id::text, 1, 8);

    INSERT INTO public.organizations (name, slug, created_by, plan)
    VALUES (
      COALESCE(NULLIF(r.display_name, ''), split_part(r.email, '@', 1), 'My Workspace') || '''s Workspace',
      v_slug,
      r.user_id,
      'starter'
    )
    RETURNING id INTO v_org_id;

    -- Attach this user's existing projects to their new personal org
    UPDATE public.movie_projects SET organization_id = v_org_id WHERE user_id = r.user_id AND organization_id IS NULL;
  END LOOP;
END $$;

-- Auto-create a personal org for new signups
CREATE OR REPLACE FUNCTION public.create_personal_org_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_name TEXT;
  v_slug TEXT;
BEGIN
  v_name := COALESCE(NULLIF(NEW.display_name, ''), split_part(NEW.email, '@', 1), 'My Workspace');
  v_slug := regexp_replace(LOWER(v_name), '[^a-z0-9]+', '-', 'g') || '-' || substr(NEW.id::text, 1, 8);

  INSERT INTO public.organizations (name, slug, created_by, plan)
  VALUES (v_name || '''s Workspace', v_slug, NEW.id, 'starter')
  RETURNING id INTO v_org_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_personal_org ON public.profiles;
CREATE TRIGGER trg_create_personal_org
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.create_personal_org_for_new_user();

-- Add org-aware policy to movie_projects (additive — keeps existing per-user policies functioning)
CREATE POLICY "Org members can view org projects"
ON public.movie_projects FOR SELECT TO authenticated
USING (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org producers+ can create projects in their org"
ON public.movie_projects FOR INSERT TO authenticated
WITH CHECK (
  organization_id IS NOT NULL
  AND public.has_org_permission(organization_id, auth.uid(), 'producer')
);

CREATE POLICY "Org producers+ can update org projects"
ON public.movie_projects FOR UPDATE TO authenticated
USING (organization_id IS NOT NULL AND public.has_org_permission(organization_id, auth.uid(), 'producer'));

CREATE POLICY "Org admins can delete org projects"
ON public.movie_projects FOR DELETE TO authenticated
USING (organization_id IS NOT NULL AND public.has_org_permission(organization_id, auth.uid(), 'admin'));
