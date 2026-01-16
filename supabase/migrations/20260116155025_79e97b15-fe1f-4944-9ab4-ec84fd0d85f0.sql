-- Genesis Story Continuity System
-- Tracks narrative arcs, character interactions, and story connection points

-- Story arcs that span multiple videos
CREATE TABLE public.genesis_story_arcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  arc_type TEXT NOT NULL DEFAULT 'main' CHECK (arc_type IN ('main', 'side', 'character', 'event')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed', 'abandoned')),
  era_id UUID REFERENCES public.genesis_eras(id),
  location_id UUID REFERENCES public.genesis_locations(id),
  start_date_in_universe TEXT,
  end_date_in_universe TEXT,
  current_chapter INTEGER DEFAULT 1,
  total_chapters INTEGER,
  synopsis TEXT,
  themes TEXT[],
  created_by UUID REFERENCES auth.users(id),
  is_canon BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Connection points where videos can link into arcs
CREATE TABLE public.genesis_story_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arc_id UUID REFERENCES public.genesis_story_arcs(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.genesis_videos(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL DEFAULT 'contributes' CHECK (connection_type IN ('starts', 'continues', 'ends', 'branches', 'contributes', 'references')),
  chapter_number INTEGER,
  sequence_order INTEGER,
  narrative_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  is_official BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(arc_id, video_id)
);

-- Character appearances and interactions across videos
CREATE TABLE public.genesis_character_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.genesis_videos(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  character_id UUID REFERENCES public.characters(id),
  role_type TEXT NOT NULL DEFAULT 'featured' CHECK (role_type IN ('protagonist', 'antagonist', 'supporting', 'featured', 'cameo', 'mentioned')),
  first_appearance_video BOOLEAN DEFAULT false,
  description TEXT,
  outfit_description TEXT,
  emotional_state TEXT,
  location_in_scene TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Character interactions within the universe
CREATE TABLE public.genesis_character_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.genesis_videos(id) ON DELETE CASCADE,
  character_1_name TEXT NOT NULL,
  character_1_id UUID REFERENCES public.characters(id),
  character_2_name TEXT NOT NULL,
  character_2_id UUID REFERENCES public.characters(id),
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('dialogue', 'conflict', 'collaboration', 'romance', 'rivalry', 'mentorship', 'chance_encounter', 'reunion')),
  interaction_outcome TEXT CHECK (interaction_outcome IN ('positive', 'negative', 'neutral', 'unresolved', 'transformative')),
  description TEXT,
  is_first_meeting BOOLEAN DEFAULT false,
  changes_relationship BOOLEAN DEFAULT false,
  new_relationship_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Story continuity anchors - fixed points that all videos must respect
CREATE TABLE public.genesis_continuity_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_type TEXT NOT NULL CHECK (anchor_type IN ('event', 'death', 'birth', 'location_change', 'world_change', 'character_trait', 'object', 'relationship')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date_in_universe TEXT,
  era_id UUID REFERENCES public.genesis_eras(id),
  location_id UUID REFERENCES public.genesis_locations(id),
  affected_characters TEXT[],
  is_immutable BOOLEAN DEFAULT true,
  source_video_id UUID REFERENCES public.genesis_videos(id),
  established_by UUID REFERENCES auth.users(id),
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  is_canon BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.genesis_story_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_story_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_character_appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_character_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_continuity_anchors ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Genesis is public, so read is open)
CREATE POLICY "Anyone can view story arcs" ON public.genesis_story_arcs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create arcs" ON public.genesis_story_arcs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creators can update their arcs" ON public.genesis_story_arcs FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Anyone can view story connections" ON public.genesis_story_connections FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create connections" ON public.genesis_story_connections FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view character appearances" ON public.genesis_character_appearances FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add appearances" ON public.genesis_character_appearances FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view character interactions" ON public.genesis_character_interactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add interactions" ON public.genesis_character_interactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view continuity anchors" ON public.genesis_continuity_anchors FOR SELECT USING (true);
CREATE POLICY "Authenticated users can propose anchors" ON public.genesis_continuity_anchors FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_genesis_story_arcs_era ON public.genesis_story_arcs(era_id);
CREATE INDEX idx_genesis_story_arcs_status ON public.genesis_story_arcs(status);
CREATE INDEX idx_genesis_story_connections_arc ON public.genesis_story_connections(arc_id);
CREATE INDEX idx_genesis_story_connections_video ON public.genesis_story_connections(video_id);
CREATE INDEX idx_genesis_character_appearances_video ON public.genesis_character_appearances(video_id);
CREATE INDEX idx_genesis_character_appearances_character ON public.genesis_character_appearances(character_id);
CREATE INDEX idx_genesis_character_interactions_video ON public.genesis_character_interactions(video_id);
CREATE INDEX idx_genesis_continuity_anchors_era ON public.genesis_continuity_anchors(era_id);

-- Add triggers for updated_at
CREATE TRIGGER update_genesis_story_arcs_updated_at
  BEFORE UPDATE ON public.genesis_story_arcs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_genesis_continuity_anchors_updated_at
  BEFORE UPDATE ON public.genesis_continuity_anchors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial story arc for the Genesis Universe
INSERT INTO public.genesis_story_arcs (title, description, arc_type, status, synopsis, themes)
VALUES 
  ('The Streets of Today', 'Modern day stories happening across major US cities', 'main', 'active', 
   'The Genesis Universe begins in the present day, following interconnected stories of people across America''s greatest cities. Every video contributes to this living tapestry of modern urban life.', 
   ARRAY['urban life', 'connections', 'modern america', 'diverse stories']);

-- Insert initial continuity anchors
INSERT INTO public.genesis_continuity_anchors (anchor_type, title, description, date_in_universe, is_immutable, is_canon)
VALUES 
  ('event', 'Present Day Start', 'The Genesis Universe begins in the present day (2024). All initial stories take place in current time.', '2024', true, true),
  ('world_change', 'Major US Cities Hub', 'Stories center around major US metropolitan areas: NYC, LA, Chicago, Miami, San Francisco, and Las Vegas.', '2024', true, true);