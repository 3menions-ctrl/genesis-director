
-- Create enum for universe roles
CREATE TYPE public.universe_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Create enum for lending permission types
CREATE TYPE public.lending_permission AS ENUM ('none', 'universe_only', 'specific_users', 'public');

-- Extend universes table with sharing features
ALTER TABLE public.universes 
ADD COLUMN is_public boolean DEFAULT false,
ADD COLUMN cover_image_url text,
ADD COLUMN style_guide jsonb DEFAULT '{}',
ADD COLUMN lore_document text,
ADD COLUMN member_count integer DEFAULT 1,
ADD COLUMN video_count integer DEFAULT 0,
ADD COLUMN tags text[] DEFAULT '{}';

-- Universe membership table
CREATE TABLE public.universe_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid REFERENCES public.universes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role universe_role NOT NULL DEFAULT 'member',
  invited_by uuid,
  joined_at timestamp with time zone DEFAULT now(),
  can_add_characters boolean DEFAULT false,
  can_edit_lore boolean DEFAULT false,
  can_invite_members boolean DEFAULT false,
  UNIQUE(universe_id, user_id)
);

-- Character lending permissions
ALTER TABLE public.characters
ADD COLUMN lending_permission lending_permission DEFAULT 'none',
ADD COLUMN lending_credits_required integer DEFAULT 0,
ADD COLUMN times_borrowed integer DEFAULT 0;

-- Character borrow requests/grants
CREATE TABLE public.character_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid NOT NULL,
  borrower_id uuid NOT NULL,
  project_id uuid REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, denied, expired, revoked
  requested_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone,
  expires_at timestamp with time zone,
  usage_notes text,
  credit_given boolean DEFAULT true
);

-- Universe continuity events (timeline/canon)
CREATE TABLE public.universe_continuity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid REFERENCES public.universes(id) ON DELETE CASCADE NOT NULL,
  created_by uuid NOT NULL,
  event_type text NOT NULL, -- 'story_event', 'character_change', 'world_change', 'timeline_marker'
  title text NOT NULL,
  description text,
  timeline_position integer, -- For ordering events
  date_in_universe text, -- In-universe date/era
  affected_characters uuid[] DEFAULT '{}',
  source_project_id uuid REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  is_canon boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Universe invitations
CREATE TABLE public.universe_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid REFERENCES public.universes(id) ON DELETE CASCADE NOT NULL,
  invited_email text NOT NULL,
  invited_by uuid NOT NULL,
  role universe_role DEFAULT 'member',
  status text DEFAULT 'pending', -- pending, accepted, declined, expired
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days')
);

-- Enable RLS
ALTER TABLE public.universe_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_continuity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_invitations ENABLE ROW LEVEL SECURITY;

-- Function to check universe membership
CREATE OR REPLACE FUNCTION public.is_universe_member(p_universe_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.universes WHERE id = p_universe_id AND user_id = p_user_id
    UNION
    SELECT 1 FROM public.universe_members WHERE universe_id = p_universe_id AND user_id = p_user_id
  )
$$;

-- Function to check universe role
CREATE OR REPLACE FUNCTION public.get_universe_role(p_universe_id uuid, p_user_id uuid)
RETURNS universe_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.universes WHERE id = p_universe_id AND user_id = p_user_id) THEN 'owner'::universe_role
    ELSE (SELECT role FROM public.universe_members WHERE universe_id = p_universe_id AND user_id = p_user_id)
  END
$$;

-- RLS for universe_members
CREATE POLICY "Users can view members of universes they belong to"
ON public.universe_members FOR SELECT
USING (public.is_universe_member(universe_id, auth.uid()));

CREATE POLICY "Universe owners and admins can add members"
ON public.universe_members FOR INSERT
WITH CHECK (
  public.get_universe_role(universe_id, auth.uid()) IN ('owner', 'admin')
);

CREATE POLICY "Universe owners and admins can update members"
ON public.universe_members FOR UPDATE
USING (public.get_universe_role(universe_id, auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Universe owners can remove members"
ON public.universe_members FOR DELETE
USING (public.get_universe_role(universe_id, auth.uid()) = 'owner');

-- RLS for character_loans
CREATE POLICY "Character owners can view all loans"
ON public.character_loans FOR SELECT
USING (auth.uid() = owner_id OR auth.uid() = borrower_id);

CREATE POLICY "Users can request to borrow characters"
ON public.character_loans FOR INSERT
WITH CHECK (auth.uid() = borrower_id);

CREATE POLICY "Character owners can update loan status"
ON public.character_loans FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Character owners can delete loans"
ON public.character_loans FOR DELETE
USING (auth.uid() = owner_id);

-- RLS for universe_continuity
CREATE POLICY "Universe members can view continuity"
ON public.universe_continuity FOR SELECT
USING (public.is_universe_member(universe_id, auth.uid()));

CREATE POLICY "Universe members with edit permission can add continuity"
ON public.universe_continuity FOR INSERT
WITH CHECK (
  public.get_universe_role(universe_id, auth.uid()) IN ('owner', 'admin')
  OR EXISTS (
    SELECT 1 FROM public.universe_members 
    WHERE universe_id = universe_continuity.universe_id 
    AND user_id = auth.uid() 
    AND can_edit_lore = true
  )
);

CREATE POLICY "Universe admins can update continuity"
ON public.universe_continuity FOR UPDATE
USING (public.get_universe_role(universe_id, auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Universe owners can delete continuity"
ON public.universe_continuity FOR DELETE
USING (public.get_universe_role(universe_id, auth.uid()) = 'owner');

-- RLS for universe_invitations
CREATE POLICY "Invitees and inviters can view invitations"
ON public.universe_invitations FOR SELECT
USING (auth.uid() = invited_by OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Universe admins can create invitations"
ON public.universe_invitations FOR INSERT
WITH CHECK (public.get_universe_role(universe_id, auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Invitees can update invitation status"
ON public.universe_invitations FOR UPDATE
USING (invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Inviters can delete invitations"
ON public.universe_invitations FOR DELETE
USING (auth.uid() = invited_by);

-- Update universes RLS to allow viewing public universes
DROP POLICY IF EXISTS "Users can view own universes" ON public.universes;
CREATE POLICY "Users can view own or public universes"
ON public.universes FOR SELECT
USING (user_id = auth.uid() OR is_public = true OR public.is_universe_member(id, auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_universe_continuity_updated_at
BEFORE UPDATE ON public.universe_continuity
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_universe_members_user ON public.universe_members(user_id);
CREATE INDEX idx_universe_members_universe ON public.universe_members(universe_id);
CREATE INDEX idx_character_loans_borrower ON public.character_loans(borrower_id);
CREATE INDEX idx_character_loans_character ON public.character_loans(character_id);
CREATE INDEX idx_universe_continuity_universe ON public.universe_continuity(universe_id);
CREATE INDEX idx_universe_continuity_timeline ON public.universe_continuity(universe_id, timeline_position);
