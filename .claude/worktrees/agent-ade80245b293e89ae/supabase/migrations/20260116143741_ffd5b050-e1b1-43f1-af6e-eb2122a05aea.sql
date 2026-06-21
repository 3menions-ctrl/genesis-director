
-- Drop existing genesis_locations data and restructure
DELETE FROM genesis_locations;

-- Add new columns to genesis_locations for hierarchy and presets
ALTER TABLE genesis_locations 
ADD COLUMN IF NOT EXISTS environment_preset JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS prompt_modifiers TEXT[],
ADD COLUMN IF NOT EXISTS reference_image_urls TEXT[],
ADD COLUMN IF NOT EXISTS time_of_day_variants JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS weather_variants JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_requestable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Create table for location requests
CREATE TABLE public.genesis_location_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_location_id UUID REFERENCES genesis_locations(id),
  name TEXT NOT NULL,
  description TEXT,
  location_type TEXT NOT NULL CHECK (location_type IN ('city', 'district', 'landmark', 'venue', 'street')),
  suggested_coordinates JSONB,
  reference_images TEXT[],
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for universe rules
CREATE TABLE public.genesis_universe_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('visual', 'narrative', 'character', 'timeline', 'technical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  examples JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for environment templates (location + era specific)
CREATE TABLE public.genesis_environment_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES genesis_locations(id) ON DELETE CASCADE,
  era_id UUID REFERENCES genesis_eras(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  visual_style JSONB NOT NULL DEFAULT '{}',
  lighting_preset JSONB DEFAULT '{}',
  color_palette JSONB DEFAULT '{}',
  atmosphere TEXT,
  prompt_prefix TEXT,
  prompt_suffix TEXT,
  negative_prompts TEXT[],
  reference_images TEXT[],
  thumbnail_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, era_id, template_name)
);

-- Enable RLS
ALTER TABLE genesis_location_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE genesis_universe_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE genesis_environment_templates ENABLE ROW LEVEL SECURITY;

-- Location requests policies
CREATE POLICY "Users can view their own requests" ON genesis_location_requests
  FOR SELECT USING (auth.uid() = requested_by);

CREATE POLICY "Users can create location requests" ON genesis_location_requests
  FOR INSERT WITH CHECK (auth.uid() = requested_by);

-- Universe rules policies (public read)
CREATE POLICY "Anyone can view active rules" ON genesis_universe_rules
  FOR SELECT USING (is_active = true);

-- Environment templates policies (public read)
CREATE POLICY "Anyone can view environment templates" ON genesis_environment_templates
  FOR SELECT USING (true);

-- Insert major US cities as top-level locations
INSERT INTO genesis_locations (name, description, location_type, climate, population, notable_features, is_official, environment_preset, prompt_modifiers) VALUES
-- New York City
('New York City', 'The city that never sleeps. A global hub of finance, culture, arts, and media.', 'city', 'Humid subtropical', '8.3 million', 
  ARRAY['Iconic skyline', 'Yellow taxis', 'Diverse neighborhoods', 'Broadway theaters'],
  true, 
  '{"style": "urban-cinematic", "architecture": "art-deco-modern-mix", "atmosphere": "bustling-energetic"}',
  ARRAY['cinematic urban lighting', 'New York aesthetic', 'metropolitan atmosphere']),

-- Los Angeles
('Los Angeles', 'The entertainment capital of the world. Sun-soaked beaches, Hollywood glamour, and diverse cultures.', 'city', 'Mediterranean', '3.9 million',
  ARRAY['Hollywood sign', 'Palm trees', 'Beach culture', 'Entertainment industry'],
  true,
  '{"style": "sunny-cinematic", "architecture": "mid-century-modern", "atmosphere": "laid-back-glamorous"}',
  ARRAY['golden hour California lighting', 'Los Angeles aesthetic', 'palm tree silhouettes']),

-- Chicago  
('Chicago', 'The Windy City. Known for bold architecture, deep-dish pizza, and vibrant arts scene.', 'city', 'Humid continental', '2.7 million',
  ARRAY['Magnificent Mile', 'Lake Michigan', 'Art Deco architecture', 'Jazz heritage'],
  true,
  '{"style": "architectural-dramatic", "architecture": "chicago-school", "atmosphere": "sophisticated-gritty"}',
  ARRAY['dramatic midwest lighting', 'Chicago architectural style', 'lake effect atmosphere']),

-- San Francisco
('San Francisco', 'The Golden Gate city. Tech innovation meets Victorian charm amid rolling hills.', 'city', 'Mediterranean', '870,000',
  ARRAY['Golden Gate Bridge', 'Cable cars', 'Victorian houses', 'Tech culture'],
  true,
  '{"style": "foggy-romantic", "architecture": "victorian-modern", "atmosphere": "innovative-bohemian"}',
  ARRAY['San Francisco fog aesthetic', 'bay area lighting', 'hillside perspectives']),

-- Miami
('Miami', 'Magic City. Art Deco paradise with Latin flair, beaches, and vibrant nightlife.', 'city', 'Tropical monsoon', '450,000',
  ARRAY['Art Deco district', 'South Beach', 'Latin culture', 'Neon nights'],
  true,
  '{"style": "neon-tropical", "architecture": "art-deco-tropical", "atmosphere": "vibrant-sultry"}',
  ARRAY['Miami neon aesthetic', 'tropical lighting', 'art deco pastels']),

-- Las Vegas
('Las Vegas', 'Sin City. The entertainment capital with iconic casinos, shows, and desert backdrop.', 'city', 'Hot desert', '650,000',
  ARRAY['The Strip', 'Casinos', 'Shows', 'Desert landscape'],
  true,
  '{"style": "neon-spectacular", "architecture": "themed-modern", "atmosphere": "extravagant-surreal"}',
  ARRAY['Las Vegas neon lights', 'desert night aesthetic', 'casino glamour']);

-- Get the NYC ID for landmarks
DO $$
DECLARE
  nyc_id UUID;
  la_id UUID;
  chicago_id UUID;
BEGIN
  SELECT id INTO nyc_id FROM genesis_locations WHERE name = 'New York City';
  SELECT id INTO la_id FROM genesis_locations WHERE name = 'Los Angeles';
  SELECT id INTO chicago_id FROM genesis_locations WHERE name = 'Chicago';

  -- NYC Landmarks
  INSERT INTO genesis_locations (name, description, location_type, parent_location_id, notable_features, is_official, environment_preset, prompt_modifiers) VALUES
  ('Times Square', 'The crossroads of the world. Bright lights, Broadway theaters, and endless energy.', 'landmark', nyc_id,
    ARRAY['Digital billboards', 'Theater district', 'New Year''s Eve ball drop', 'Tourist hub'],
    true,
    '{"lighting": "neon-bright", "time_signature": "always-alive", "crowd_density": "high"}',
    ARRAY['Times Square neon glow', 'bright digital billboards', 'bustling crowds']),
  
  ('Madison Square Garden', 'The world''s most famous arena. Historic venue for sports and concerts.', 'venue', nyc_id,
    ARRAY['Circular architecture', 'Sports events', 'Concert venue', 'Penn Station below'],
    true,
    '{"lighting": "arena-dramatic", "architecture": "circular-modern", "atmosphere": "electric-legendary"}',
    ARRAY['arena lighting', 'Madison Square Garden iconic', 'event atmosphere']),
  
  ('Central Park', 'An urban oasis. 843 acres of nature in the heart of Manhattan.', 'landmark', nyc_id,
    ARRAY['Bethesda Fountain', 'The Mall', 'Bow Bridge', 'Belvedere Castle'],
    true,
    '{"lighting": "natural-dappled", "nature": "curated-wild", "atmosphere": "serene-urban-escape"}',
    ARRAY['Central Park natural lighting', 'urban nature aesthetic', 'Manhattan skyline backdrop']),
  
  ('Brooklyn Bridge', 'Gothic towers and steel cables spanning the East River since 1883.', 'landmark', nyc_id,
    ARRAY['Gothic arches', 'Pedestrian walkway', 'Manhattan skyline views', 'Historic cables'],
    true,
    '{"lighting": "golden-hour-ideal", "architecture": "gothic-industrial", "atmosphere": "romantic-historic"}',
    ARRAY['Brooklyn Bridge cables', 'East River reflections', 'iconic New York landmark']),

  ('Empire State Building', 'Art Deco masterpiece towering over Midtown Manhattan.', 'landmark', nyc_id,
    ARRAY['Art Deco spire', 'Observation deck', 'Iconic silhouette', 'Colored lighting'],
    true,
    '{"lighting": "architectural-dramatic", "architecture": "art-deco-peak", "atmosphere": "majestic-timeless"}',
    ARRAY['Empire State Building silhouette', 'Art Deco architecture', 'Manhattan aerial view']);

  -- LA Landmarks
  INSERT INTO genesis_locations (name, description, location_type, parent_location_id, notable_features, is_official, environment_preset, prompt_modifiers) VALUES
  ('Hollywood Boulevard', 'The heart of the entertainment industry. Walk of Fame and historic theaters.', 'landmark', la_id,
    ARRAY['Walk of Fame', 'TCL Chinese Theatre', 'Hollywood sign views', 'Historic theaters'],
    true,
    '{"lighting": "california-golden", "atmosphere": "glamorous-touristy", "era_feel": "old-hollywood-meets-new"}',
    ARRAY['Hollywood glamour', 'Walk of Fame stars', 'palm-lined streets']),
  
  ('Venice Beach', 'Bohemian beach culture. Boardwalk, street performers, and Muscle Beach.', 'landmark', la_id,
    ARRAY['Boardwalk', 'Street performers', 'Muscle Beach', 'Skate park'],
    true,
    '{"lighting": "beach-golden", "atmosphere": "bohemian-eclectic", "vibe": "california-casual"}',
    ARRAY['Venice Beach boardwalk', 'California beach aesthetic', 'sunset over Pacific']),

  ('Griffith Observatory', 'Art Deco observatory with panoramic views of LA and the Hollywood sign.', 'landmark', la_id,
    ARRAY['Art Deco architecture', 'Planetarium', 'Hollywood sign views', 'City panoramas'],
    true,
    '{"lighting": "observatory-dramatic", "architecture": "art-deco-scientific", "atmosphere": "contemplative-cinematic"}',
    ARRAY['Griffith Observatory dome', 'LA skyline panorama', 'Hollywood sign backdrop']);

  -- Chicago Landmarks
  INSERT INTO genesis_locations (name, description, location_type, parent_location_id, notable_features, is_official, environment_preset, prompt_modifiers) VALUES
  ('Millennium Park', 'Modern urban park featuring Cloud Gate (The Bean) and Crown Fountain.', 'landmark', chicago_id,
    ARRAY['Cloud Gate sculpture', 'Crown Fountain', 'Pritzker Pavilion', 'Lurie Garden'],
    true,
    '{"lighting": "reflective-modern", "architecture": "contemporary-sculptural", "atmosphere": "artistic-public"}',
    ARRAY['Cloud Gate reflection', 'Chicago Bean aesthetic', 'modern urban park']),
  
  ('Navy Pier', 'Iconic lakefront destination with Ferris wheel and entertainment.', 'landmark', chicago_id,
    ARRAY['Centennial Wheel', 'Lake Michigan views', 'Entertainment complex', 'Historic pier'],
    true,
    '{"lighting": "carnival-lakeside", "atmosphere": "festive-family", "water": "lake-michigan-blue"}',
    ARRAY['Navy Pier Ferris wheel', 'Lake Michigan backdrop', 'Chicago skyline view']);
END $$;

-- Insert universe rules
INSERT INTO genesis_universe_rules (category, title, description, priority, examples) VALUES
('visual', 'Consistent Lighting by Era', 'Each era has specific lighting characteristics that must be maintained across all videos.', 1, 
  '{"present": "natural modern lighting", "1990s": "warmer film-like tones", "1980s": "neon and high contrast", "1970s": "earthy warm tones"}'),

('visual', 'Location Accuracy', 'Landmarks must be visually accurate to their real-world appearance for the specified time period.', 2,
  '{"example": "Times Square in 2024 has different billboards than Times Square in 2000"}'),

('narrative', 'Shared Timeline', 'All events occur on a single continuous timeline. No alternate realities or parallel universes.', 1,
  '{"rule": "Events must be chronologically consistent with other canon videos"}'),

('timeline', 'Time Period Authenticity', 'Technology, fashion, and culture must match the specified time period.', 1,
  '{"example": "No smartphones visible in 1990s scenes"}'),

('character', 'Character Continuity', 'Characters appearing in multiple videos must maintain consistent appearance and traits.', 2,
  '{"rule": "Use character reference images for consistency"}'),

('technical', 'Video Quality Standards', 'All submissions must meet minimum quality standards for visual consistency.', 3,
  '{"resolution": "1080p minimum", "style": "cinematic quality"}');

-- Create default environment templates for present-day NYC locations
DO $$
DECLARE
  present_era_id UUID;
  times_square_id UUID;
  msg_id UUID;
  central_park_id UUID;
BEGIN
  SELECT id INTO present_era_id FROM genesis_eras WHERE name = 'Present Day';
  SELECT id INTO times_square_id FROM genesis_locations WHERE name = 'Times Square';
  SELECT id INTO msg_id FROM genesis_locations WHERE name = 'Madison Square Garden';
  SELECT id INTO central_park_id FROM genesis_locations WHERE name = 'Central Park';

  INSERT INTO genesis_environment_templates (location_id, era_id, template_name, visual_style, lighting_preset, color_palette, atmosphere, prompt_prefix, prompt_suffix, is_default) VALUES
  (times_square_id, present_era_id, 'Times Square Day', 
    '{"style": "urban-vibrant", "density": "crowded", "signage": "modern-digital"}',
    '{"type": "daylight", "intensity": "bright", "shadows": "harsh-urban"}',
    '{"primary": ["#FF0000", "#00FF00", "#0000FF"], "accent": ["#FFD700", "#FF69B4"]}',
    'Bustling daytime energy with tourists and digital billboards',
    'Times Square, New York City, present day, bright daylight, crowded streets, massive digital billboards, yellow taxis,',
    'cinematic quality, urban photography style, vibrant colors',
    true),
  
  (times_square_id, present_era_id, 'Times Square Night',
    '{"style": "neon-spectacular", "density": "crowded", "signage": "glowing-bright"}',
    '{"type": "neon", "intensity": "high", "shadows": "colorful-cast"}',
    '{"primary": ["#FF1493", "#00FFFF", "#FFFF00"], "accent": ["#FF4500", "#9400D3"]}',
    'Electric nighttime atmosphere with neon glow reflecting on wet streets',
    'Times Square, New York City, night scene, neon lights, glowing billboards, wet pavement reflections,',
    'cinematic night photography, neon noir aesthetic, vibrant nightlife',
    false),

  (msg_id, present_era_id, 'MSG Event Night',
    '{"style": "arena-electric", "event_type": "concert-sports", "crowd": "energetic"}',
    '{"type": "arena-spots", "intensity": "dramatic", "effects": "stage-lighting"}',
    '{"primary": ["#1E90FF", "#FF6347"], "accent": ["#FFD700", "#FFFFFF"]}',
    'Electric arena atmosphere during major event',
    'Madison Square Garden interior, event night, arena lighting, excited crowd, stage lights,',
    'dramatic arena photography, event atmosphere, iconic venue',
    true),

  (central_park_id, present_era_id, 'Central Park Spring',
    '{"style": "natural-serene", "season": "spring", "foliage": "blooming"}',
    '{"type": "natural-dappled", "intensity": "soft", "shadows": "leaf-patterns"}',
    '{"primary": ["#228B22", "#87CEEB"], "accent": ["#FFB6C1", "#FFFFFF"]}',
    'Peaceful spring day with cherry blossoms and gentle sunlight',
    'Central Park, New York City, spring season, cherry blossoms, dappled sunlight through trees, green grass,',
    'natural lighting, peaceful atmosphere, urban nature photography',
    true);
END $$;
