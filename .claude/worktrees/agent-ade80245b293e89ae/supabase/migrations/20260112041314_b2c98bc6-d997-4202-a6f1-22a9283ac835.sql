
-- Create universe activity feed table
CREATE TABLE public.universe_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid REFERENCES public.universes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  activity_type text NOT NULL, -- 'video_created', 'video_completed', 'timeline_event', 'character_added', 'character_borrowed', 'member_joined', 'lore_updated'
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  reference_id uuid, -- ID of the related entity (video, character, event, etc.)
  reference_type text, -- 'video', 'character', 'continuity_event', 'member'
  thumbnail_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.universe_activity ENABLE ROW LEVEL SECURITY;

-- Users can view activity from universes they belong to
CREATE POLICY "Users can view activity from their universes"
ON public.universe_activity FOR SELECT
USING (public.is_universe_member(universe_id, auth.uid()));

-- Users can create activity in universes they belong to
CREATE POLICY "Universe members can create activity"
ON public.universe_activity FOR INSERT
WITH CHECK (public.is_universe_member(universe_id, auth.uid()) AND auth.uid() = user_id);

-- Only activity creator or universe owner can delete
CREATE POLICY "Activity creators can delete their activity"
ON public.universe_activity FOR DELETE
USING (
  auth.uid() = user_id 
  OR EXISTS (SELECT 1 FROM public.universes WHERE id = universe_id AND user_id = auth.uid())
);

-- Enable realtime for activity feed
ALTER TABLE public.universe_activity REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.universe_activity;

-- Index for faster queries
CREATE INDEX idx_universe_activity_universe ON public.universe_activity(universe_id);
CREATE INDEX idx_universe_activity_created ON public.universe_activity(created_at DESC);
CREATE INDEX idx_universe_activity_user ON public.universe_activity(user_id);

-- Trigger to auto-create activity when timeline events are added
CREATE OR REPLACE FUNCTION public.create_timeline_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.universe_activity (
    universe_id,
    user_id,
    activity_type,
    title,
    description,
    reference_id,
    reference_type,
    metadata
  ) VALUES (
    NEW.universe_id,
    NEW.created_by,
    'timeline_event',
    'Added timeline event: ' || NEW.title,
    NEW.description,
    NEW.id,
    'continuity_event',
    jsonb_build_object('event_type', NEW.event_type, 'is_canon', NEW.is_canon)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_timeline_event_created
AFTER INSERT ON public.universe_continuity
FOR EACH ROW
EXECUTE FUNCTION public.create_timeline_activity();

-- Trigger to auto-create activity when members join
CREATE OR REPLACE FUNCTION public.create_member_joined_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_name text;
BEGIN
  SELECT display_name INTO member_name FROM public.profiles WHERE id = NEW.user_id;
  
  INSERT INTO public.universe_activity (
    universe_id,
    user_id,
    activity_type,
    title,
    description,
    reference_id,
    reference_type,
    metadata
  ) VALUES (
    NEW.universe_id,
    NEW.user_id,
    'member_joined',
    COALESCE(member_name, 'A new creator') || ' joined the universe',
    NULL,
    NEW.id,
    'member',
    jsonb_build_object('role', NEW.role)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_member_joined
AFTER INSERT ON public.universe_members
FOR EACH ROW
EXECUTE FUNCTION public.create_member_joined_activity();
