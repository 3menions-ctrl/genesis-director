-- Create the Genesis Universe (the one shared universe)
-- We'll use a system universe with a fixed ID

-- Create genesis_locations table for places within the universe
CREATE TABLE public.genesis_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  location_type TEXT NOT NULL DEFAULT 'region', -- region, city, landmark, realm
  parent_location_id UUID REFERENCES public.genesis_locations(id),
  coordinates JSONB, -- for map placement if needed
  climate TEXT,
  population TEXT,
  notable_features TEXT[],
  created_by UUID REFERENCES auth.users(id),
  is_official BOOLEAN DEFAULT false, -- admin-created vs user-suggested
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create genesis_eras table for time periods
CREATE TABLE public.genesis_eras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  start_year INTEGER, -- in-universe year
  end_year INTEGER,
  era_order INTEGER NOT NULL DEFAULT 0, -- for sorting
  key_events TEXT[],
  dominant_technology TEXT,
  cultural_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  is_official BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create genesis_videos table to track videos in the Genesis Universe
CREATE TABLE public.genesis_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  location_id UUID REFERENCES public.genesis_locations(id),
  era_id UUID REFERENCES public.genesis_eras(id),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  duration_seconds INTEGER,
  -- Canon status
  canon_status TEXT NOT NULL DEFAULT 'pending', -- pending, canon, non_canon, featured
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  vote_score INTEGER DEFAULT 0,
  -- When it became canon
  canon_at TIMESTAMP WITH TIME ZONE,
  featured_at TIMESTAMP WITH TIME ZONE,
  -- Metadata
  tags TEXT[],
  characters_featured TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create voting table
CREATE TABLE public.genesis_video_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.genesis_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(video_id, user_id)
);

-- Create genesis lore table for world-building contributions
CREATE TABLE public.genesis_lore (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  lore_type TEXT NOT NULL DEFAULT 'story', -- story, history, legend, science, culture
  location_id UUID REFERENCES public.genesis_locations(id),
  era_id UUID REFERENCES public.genesis_eras(id),
  is_canon BOOLEAN DEFAULT false,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.genesis_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_eras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_video_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_lore ENABLE ROW LEVEL SECURITY;

-- RLS Policies for genesis_locations (public read, admin write)
CREATE POLICY "Anyone can view locations" ON public.genesis_locations FOR SELECT USING (true);
CREATE POLICY "Admins can manage locations" ON public.genesis_locations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can suggest locations" ON public.genesis_locations FOR INSERT WITH CHECK (
  auth.uid() = created_by AND is_official = false
);

-- RLS Policies for genesis_eras (public read, admin write)
CREATE POLICY "Anyone can view eras" ON public.genesis_eras FOR SELECT USING (true);
CREATE POLICY "Admins can manage eras" ON public.genesis_eras FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can suggest eras" ON public.genesis_eras FOR INSERT WITH CHECK (
  auth.uid() = created_by AND is_official = false
);

-- RLS Policies for genesis_videos
CREATE POLICY "Anyone can view videos" ON public.genesis_videos FOR SELECT USING (true);
CREATE POLICY "Users can add their own videos" ON public.genesis_videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own videos" ON public.genesis_videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own videos" ON public.genesis_videos FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for genesis_video_votes
CREATE POLICY "Anyone can view votes" ON public.genesis_video_votes FOR SELECT USING (true);
CREATE POLICY "Users can manage their own votes" ON public.genesis_video_votes FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for genesis_lore
CREATE POLICY "Anyone can view lore" ON public.genesis_lore FOR SELECT USING (true);
CREATE POLICY "Users can add lore" ON public.genesis_lore FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their lore" ON public.genesis_lore FOR UPDATE USING (auth.uid() = created_by);

-- Function to update vote counts
CREATE OR REPLACE FUNCTION public.update_genesis_video_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'up' THEN
      UPDATE public.genesis_videos SET upvotes = upvotes + 1, vote_score = vote_score + 1 WHERE id = NEW.video_id;
    ELSE
      UPDATE public.genesis_videos SET downvotes = downvotes + 1, vote_score = vote_score - 1 WHERE id = NEW.video_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'up' THEN
      UPDATE public.genesis_videos SET upvotes = upvotes - 1, vote_score = vote_score - 1 WHERE id = OLD.video_id;
    ELSE
      UPDATE public.genesis_videos SET downvotes = downvotes - 1, vote_score = vote_score + 1 WHERE id = OLD.video_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle vote change
    IF OLD.vote_type = 'up' AND NEW.vote_type = 'down' THEN
      UPDATE public.genesis_videos SET upvotes = upvotes - 1, downvotes = downvotes + 1, vote_score = vote_score - 2 WHERE id = NEW.video_id;
    ELSIF OLD.vote_type = 'down' AND NEW.vote_type = 'up' THEN
      UPDATE public.genesis_videos SET upvotes = upvotes + 1, downvotes = downvotes - 1, vote_score = vote_score + 2 WHERE id = NEW.video_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_genesis_vote_change
AFTER INSERT OR UPDATE OR DELETE ON public.genesis_video_votes
FOR EACH ROW EXECUTE FUNCTION public.update_genesis_video_votes();

-- Enable realtime for videos and votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.genesis_videos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.genesis_video_votes;

-- Insert initial eras (The Genesis Timeline)
INSERT INTO public.genesis_eras (name, description, era_order, is_official, key_events) VALUES
  ('The Awakening', 'The dawn of consciousness. The first beings emerge from the void.', 1, true, ARRAY['First light', 'Birth of the Ancients', 'The Naming']),
  ('Age of Elements', 'Raw forces shape the world. Fire, water, earth, and air battle for dominance.', 2, true, ARRAY['The Great Storms', 'Formation of the Continents', 'Element Wars']),
  ('Era of Builders', 'The first civilizations rise. Monuments to ambition pierce the sky.', 3, true, ARRAY['First Cities', 'The Great Works', 'Tower of Unity']),
  ('The Fracturing', 'Division and conflict. Nations form, borders are drawn in blood.', 4, true, ARRAY['The Sundering', 'Rise of Kingdoms', 'The Long War']),
  ('Renaissance of Light', 'Art, science, and magic flourish. A golden age of discovery.', 5, true, ARRAY['Invention of Flight', 'The Great Library', 'Unity Accords']),
  ('The Modern Age', 'Technology and tradition merge. The present day of the Genesis Universe.', 6, true, ARRAY['Digital Dawn', 'The Integration', 'New Horizons']);

-- Insert initial locations
INSERT INTO public.genesis_locations (name, description, location_type, is_official, climate, notable_features) VALUES
  ('The Nexus', 'The center of all realms, where dimensions intersect and all stories begin.', 'realm', true, 'Ethereal', ARRAY['Portal Hub', 'Crystal Spires', 'Eternal Twilight']),
  ('Verdant Expanse', 'Endless forests teeming with ancient life and hidden secrets.', 'region', true, 'Temperate', ARRAY['World Tree', 'Whispering Groves', 'Luminescent Clearings']),
  ('Iron Citadel', 'A massive fortress-city built into a mountain, heart of industry and innovation.', 'city', true, 'Continental', ARRAY['The Forge', 'Sky Docks', 'Clockwork Quarter']),
  ('Azure Depths', 'The vast ocean realm, home to mysteries older than the land itself.', 'region', true, 'Aquatic', ARRAY['Coral Kingdoms', 'The Abyss', 'Tidal Gates']),
  ('Ember Wastes', 'Volcanic badlands where fire elementals roam and ancient powers slumber.', 'region', true, 'Volcanic', ARRAY['Magma Rivers', 'Obsidian Plains', 'The Sleeping Giant']),
  ('Crystalline Peaks', 'Mountain range of pure crystal, amplifying magic and light.', 'landmark', true, 'Alpine', ARRAY['Echo Caverns', 'Summit Observatory', 'Prismatic Falls']);