-- Genesis Universe Collaborative Movie System
-- Pre-written script with scenes, preset characters, user casting, and admin stitching

-- Table for the main screenplay/script
CREATE TABLE public.genesis_screenplay (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  total_duration_minutes INTEGER DEFAULT 60,
  total_scenes INTEGER DEFAULT 0,
  total_characters INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'casting', 'filming', 'post_production', 'completed')),
  synopsis TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for scenes in the screenplay
CREATE TABLE public.genesis_scenes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screenplay_id UUID REFERENCES public.genesis_screenplay(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  act_number INTEGER DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  location_id UUID REFERENCES public.genesis_locations(id),
  era_id UUID REFERENCES public.genesis_eras(id),
  time_of_day TEXT DEFAULT 'day',
  weather TEXT DEFAULT 'clear',
  duration_seconds INTEGER DEFAULT 32,
  visual_prompt TEXT,
  camera_directions TEXT,
  mood TEXT,
  is_key_scene BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'casting', 'ready', 'filming', 'submitted', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for preset characters in the universe
CREATE TABLE public.genesis_preset_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screenplay_id UUID REFERENCES public.genesis_screenplay(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_type TEXT DEFAULT 'supporting' CHECK (role_type IN ('protagonist', 'antagonist', 'supporting', 'extra', 'narrator')),
  description TEXT,
  personality TEXT,
  appearance_description TEXT,
  backstory TEXT,
  age_range TEXT,
  gender TEXT,
  wardrobe_notes TEXT,
  voice_notes TEXT,
  total_scenes INTEGER DEFAULT 0,
  is_cast BOOLEAN DEFAULT false,
  cast_by UUID REFERENCES auth.users(id),
  cast_at TIMESTAMP WITH TIME ZONE,
  reference_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for character appearances in scenes
CREATE TABLE public.genesis_scene_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id UUID REFERENCES public.genesis_scenes(id) ON DELETE CASCADE,
  character_id UUID REFERENCES public.genesis_preset_characters(id) ON DELETE CASCADE,
  dialogue TEXT,
  action_description TEXT,
  emotional_state TEXT,
  position_in_scene TEXT,
  entrance_type TEXT,
  exit_type TEXT,
  interaction_with TEXT[], -- Array of other character IDs
  is_speaking BOOLEAN DEFAULT false,
  screen_time_seconds INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(scene_id, character_id)
);

-- Table for user casting (user claims a character)
CREATE TABLE public.genesis_character_castings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID REFERENCES public.genesis_preset_characters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  face_image_url TEXT NOT NULL,
  additional_images TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'replaced')),
  admin_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(character_id, user_id)
);

-- Table for scene clip submissions
CREATE TABLE public.genesis_scene_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id UUID REFERENCES public.genesis_scenes(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES public.movie_projects(id),
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  quality_score NUMERIC(3,2),
  consistency_score NUMERIC(3,2),
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'selected')),
  admin_feedback TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  is_selected_for_final BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for final movie assembly
CREATE TABLE public.genesis_final_assembly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  screenplay_id UUID REFERENCES public.genesis_screenplay(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assembling', 'review', 'published')),
  total_clips INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  final_video_url TEXT,
  assembly_order JSONB, -- Array of clip IDs in order
  assembly_notes TEXT,
  assembled_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.genesis_screenplay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_preset_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_scene_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_character_castings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_scene_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genesis_final_assembly ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Public read for most tables
CREATE POLICY "Anyone can view screenplays" ON public.genesis_screenplay FOR SELECT USING (true);
CREATE POLICY "Admins can manage screenplays" ON public.genesis_screenplay FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can view scenes" ON public.genesis_scenes FOR SELECT USING (true);
CREATE POLICY "Admins can manage scenes" ON public.genesis_scenes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can view preset characters" ON public.genesis_preset_characters FOR SELECT USING (true);
CREATE POLICY "Admins can manage preset characters" ON public.genesis_preset_characters FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can view scene characters" ON public.genesis_scene_characters FOR SELECT USING (true);
CREATE POLICY "Admins can manage scene characters" ON public.genesis_scene_characters FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can view castings" ON public.genesis_character_castings FOR SELECT USING (true);
CREATE POLICY "Users can submit their own castings" ON public.genesis_character_castings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own castings" ON public.genesis_character_castings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all castings" ON public.genesis_character_castings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can view approved clips" ON public.genesis_scene_clips FOR SELECT USING (true);
CREATE POLICY "Users can submit their own clips" ON public.genesis_scene_clips FOR INSERT WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Users can update their own clips" ON public.genesis_scene_clips FOR UPDATE USING (auth.uid() = submitted_by);
CREATE POLICY "Admins can manage all clips" ON public.genesis_scene_clips FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can view final assemblies" ON public.genesis_final_assembly FOR SELECT USING (true);
CREATE POLICY "Admins can manage assemblies" ON public.genesis_final_assembly FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Insert the Genesis Universe Screenplay (1 hour = 60 minutes = ~112 scenes at 32 sec each)
INSERT INTO public.genesis_screenplay (title, description, total_duration_minutes, total_scenes, total_characters, status, synopsis)
VALUES (
  'Genesis: American Tapestry',
  'A sweeping narrative connecting stories across major US cities, following interconnected characters whose lives intersect in unexpected ways.',
  60,
  112,
  24,
  'casting',
  'From the neon lights of Times Square to the golden hills of San Francisco, twelve strangers discover their fates are intertwined. A photographer in NYC captures a moment that changes everything. A tech entrepreneur in SF faces a moral dilemma. A musician in Chicago plays a song that echoes across the nation. Their stories weave together in this collaborative epic that spans the American landscape.'
);

-- Get the screenplay ID and insert characters
DO $$
DECLARE
  screenplay_uuid UUID;
  nyc_location UUID;
  la_location UUID;
  chicago_location UUID;
  sf_location UUID;
  miami_location UUID;
  seattle_location UUID;
  present_era UUID;
BEGIN
  SELECT id INTO screenplay_uuid FROM genesis_screenplay WHERE title = 'Genesis: American Tapestry' LIMIT 1;
  SELECT id INTO nyc_location FROM genesis_locations WHERE name = 'New York City' LIMIT 1;
  SELECT id INTO la_location FROM genesis_locations WHERE name = 'Los Angeles' LIMIT 1;
  SELECT id INTO chicago_location FROM genesis_locations WHERE name = 'Chicago' LIMIT 1;
  SELECT id INTO sf_location FROM genesis_locations WHERE name = 'San Francisco' LIMIT 1;
  SELECT id INTO miami_location FROM genesis_locations WHERE name = 'Miami' LIMIT 1;
  SELECT id INTO seattle_location FROM genesis_locations WHERE name = 'Seattle' LIMIT 1;
  SELECT id INTO present_era FROM genesis_eras WHERE name = 'Present Day' LIMIT 1;

  -- Insert 24 preset characters
  INSERT INTO genesis_preset_characters (screenplay_id, name, role_type, description, personality, appearance_description, backstory, age_range, gender, wardrobe_notes, total_scenes) VALUES
  -- NYC Characters
  (screenplay_uuid, 'Maya Chen', 'protagonist', 'A street photographer who captures the soul of the city', 'Observant, empathetic, quietly determined', 'Asian-American woman, expressive eyes, often seen with vintage camera', 'Former corporate lawyer who quit to pursue her passion', '28-35', 'female', 'Casual urban chic - leather jacket, comfortable shoes for walking', 15),
  (screenplay_uuid, 'Marcus Williams', 'protagonist', 'Jazz musician and philosopher of the streets', 'Soulful, wise beyond years, haunted by past', 'African-American man, warm smile, carries saxophone case', 'Classically trained musician who found his voice in jazz clubs', '40-50', 'male', 'Classic jazz aesthetic - fedora, tailored pants, clean shirt', 12),
  (screenplay_uuid, 'Elena Rossi', 'supporting', 'Gallery owner with connections everywhere', 'Sophisticated, calculating, secretly romantic', 'Italian-American woman, elegant, always perfectly styled', 'Third generation art dealer with a hidden past', '45-55', 'female', 'High fashion - designer clothes, statement jewelry', 8),
  (screenplay_uuid, 'Tommy Park', 'supporting', 'Street food vendor with dreams of a restaurant', 'Optimistic, hardworking, infectious laugh', 'Korean-American man, friendly face, always cooking', 'Immigrated as a child, building the American dream', '25-32', 'male', 'Practical - apron, comfortable clothes, baseball cap', 6),
  
  -- LA Characters  
  (screenplay_uuid, 'Jordan Blake', 'protagonist', 'Struggling screenwriter on the verge of breakthrough', 'Ambitious, witty, hiding vulnerability', 'Gender-fluid individual, expressive style', 'Came to LA with nothing but a laptop and dreams', '26-33', 'non-binary', 'LA casual meets artistic - vintage finds, statement pieces', 14),
  (screenplay_uuid, 'Victoria Sterling', 'antagonist', 'Studio executive with ruthless ambition', 'Calculating, charismatic, secretly insecure', 'Woman of commanding presence, power suits', 'Climbed from mail room to boardroom', '38-48', 'female', 'Power dressing - designer suits, Louboutins', 10),
  (screenplay_uuid, 'Diego Morales', 'supporting', 'Cinematographer documenting the real LA', 'Artistic, passionate about truth, loyal', 'Latino man, creative style, always observing', 'Documentary filmmaker turned Hollywood DP', '32-40', 'male', 'Artistic practical - comfortable for long shoots', 7),
  (screenplay_uuid, 'Sunset', 'supporting', 'Veteran actress making a comeback', 'Glamorous, wise, hiding pain', 'African-American woman, timeless beauty', 'Former star navigating ageism in Hollywood', '55-65', 'female', 'Classic Hollywood glamour updated for today', 5),
  
  -- Chicago Characters
  (screenplay_uuid, 'Alex Rivera', 'protagonist', 'Architecture student fighting gentrification', 'Passionate, idealistic, sometimes naive', 'Latinx individual, thoughtful expression', 'First generation college student', '22-28', 'non-binary', 'Urban activist style - functional, meaningful', 13),
  (screenplay_uuid, 'Frank Kowalski', 'supporting', 'Old-school detective nearing retirement', 'Gruff exterior, golden heart, seen too much', 'Polish-American man, weathered face, kind eyes', 'Three decades on the force, questioning everything', '58-65', 'male', 'Classic detective - rumpled suit, comfortable shoes', 9),
  (screenplay_uuid, 'Nina Okonkwo', 'supporting', 'Rising political star with secrets', 'Charismatic, driven, complex morality', 'Nigerian-American woman, magnetic presence', 'Community organizer turned alderman candidate', '35-42', 'female', 'Professional but approachable - smart blazers', 6),
  (screenplay_uuid, 'Eddie Chen', 'extra', 'Food truck owner, community pillar', 'Generous, gossipy, knows everyone', 'Chinese-American man, always smiling', 'Second career after corporate burnout', '45-55', 'male', 'Casual - chef coat, jeans', 4),
  
  -- San Francisco Characters
  (screenplay_uuid, 'Priya Sharma', 'protagonist', 'Tech entrepreneur facing ethical dilemma', 'Brilliant, conflicted, seeking redemption', 'Indian-American woman, intense focus', 'AI researcher whose creation threatens privacy', '30-38', 'female', 'Tech casual elevated - quality basics', 14),
  (screenplay_uuid, 'Kevin OBrien', 'supporting', 'Old-timer watching his city change', 'Nostalgic, insightful, unexpectedly progressive', 'Irish-American man, weathered but vital', 'Fourth generation San Franciscan', '70-80', 'male', 'Classic SF - layers for the fog', 7),
  (screenplay_uuid, 'Zoe Washington', 'supporting', 'Activist and community organizer', 'Fierce, compassionate, tireless', 'African-American woman, natural style', 'Fighting displacement in her neighborhood', '28-35', 'female', 'Practical activist - ready to march', 6),
  (screenplay_uuid, 'Hiroshi Tanaka', 'extra', 'Sushi chef preserving tradition', 'Precise, patient, secretly playful', 'Japanese-American man, calm demeanor', 'Third generation craftsman', '50-60', 'male', 'Traditional chef attire', 3),
  
  -- Miami Characters
  (screenplay_uuid, 'Isabella Santos', 'protagonist', 'Marine biologist fighting for the coast', 'Passionate, scientific, deeply spiritual', 'Cuban-American woman, sun-kissed, determined', 'Returned home to save the reefs she loved as a child', '32-40', 'female', 'Practical beach meets professional', 12),
  (screenplay_uuid, 'Rafael Dominguez', 'supporting', 'Nightclub owner with political connections', 'Charming, mysterious, conflicted loyalties', 'Cuban-American man, effortlessly stylish', 'Family ties to both sides of the law', '38-48', 'male', 'Miami vice updated - linen suits, no socks', 8),
  (screenplay_uuid, 'Destiny Williams', 'supporting', 'Social media influencer with depth', 'Bubbly exterior, sharp mind, survivor', 'African-American woman, always camera-ready', 'Using platform to expose injustice', '24-30', 'female', 'Influencer aesthetic - trendy, photogenic', 5),
  (screenplay_uuid, 'Carlos Vega', 'extra', 'Fisherman watching waters change', 'Weather-worn, philosophical, worried', 'Hispanic man, strong hands, kind eyes', 'Generations of fishing knowledge', '55-65', 'male', 'Working fisherman - practical, sun-faded', 3),
  
  -- Seattle Characters
  (screenplay_uuid, 'Rain Blackwood', 'protagonist', 'Indigenous artist reclaiming narratives', 'Thoughtful, creative, spiritually grounded', 'Native American woman, powerful presence', 'Using art to preserve and protect culture', '28-38', 'female', 'Artistic - incorporates traditional elements', 11),
  (screenplay_uuid, 'Sam Nakamura', 'supporting', 'Coffee shop owner, neighborhood heart', 'Welcoming, observant, keeper of stories', 'Japanese-American man, warm presence', 'Third space creator in changing neighborhood', '42-52', 'male', 'Pacific Northwest casual - flannel, quality denim', 6),
  (screenplay_uuid, 'Dr. Margaret Liu', 'supporting', 'Research scientist at crossroads', 'Brilliant, ethical, under pressure', 'Chinese-American woman, focused intensity', 'Groundbreaking research with dangerous applications', '38-48', 'female', 'Professional academic - practical but polished', 5),
  (screenplay_uuid, 'Bear', 'extra', 'Homeless veteran everyone knows', 'Gruff, protective, surprisingly hopeful', 'Native American man, gentle giant', 'Former Marine finding his way back', '45-55', 'male', 'Layered for the streets, military touches', 4);

  -- Insert first 20 scenes (Act 1 - Setup across all cities)
  INSERT INTO genesis_scenes (screenplay_id, scene_number, act_number, title, description, location_id, era_id, time_of_day, duration_seconds, visual_prompt, camera_directions, mood, is_key_scene, status) VALUES
  -- NYC Opening
  (screenplay_uuid, 1, 1, 'Dawn Over Manhattan', 'Opening shot - sun rises over NYC skyline', nyc_location, present_era, 'dawn', 32, 'Cinematic sunrise over Manhattan skyline, golden light hitting skyscrapers, time-lapse feel', 'Wide establishing shot, slow zoom toward Times Square', 'Hopeful, epic', true, 'ready'),
  (screenplay_uuid, 2, 1, 'Maya''s Morning', 'Maya captures her first shot of the day in Times Square', nyc_location, present_era, 'morning', 32, 'Street photographer in Times Square, early morning, capturing candid moments', 'Follow shot, over shoulder to see what she photographs', 'Observant, intimate', true, 'ready'),
  (screenplay_uuid, 3, 1, 'Marcus''s Melody', 'Marcus plays saxophone in Central Park', nyc_location, present_era, 'morning', 32, 'Jazz musician playing saxophone in Central Park, morning light through trees', 'Medium shot, circular dolly around musician', 'Soulful, timeless', false, 'ready'),
  (screenplay_uuid, 4, 1, 'The Gallery', 'Elena opens her gallery, examining new arrivals', nyc_location, present_era, 'morning', 32, 'Elegant gallery owner in SoHo art space, examining artwork', 'Tracking shot through gallery space', 'Sophisticated, contemplative', false, 'ready'),
  
  -- LA Morning
  (screenplay_uuid, 5, 1, 'Hollywood Dreams', 'Jordan types in a coffee shop, screenplay coming alive', la_location, present_era, 'morning', 32, 'Writer in LA coffee shop, laptop open, Hollywood Hills visible through window', 'Close on hands typing, pull back to reveal view', 'Aspirational, focused', true, 'ready'),
  (screenplay_uuid, 6, 1, 'The Studio', 'Victoria Sterling commands a boardroom', la_location, present_era, 'morning', 32, 'Powerful executive in sleek Hollywood studio boardroom, commanding presence', 'Low angle, emphasize power, slow push in', 'Intense, corporate', false, 'ready'),
  (screenplay_uuid, 7, 1, 'Behind the Camera', 'Diego sets up for a documentary shoot in East LA', la_location, present_era, 'morning', 32, 'Cinematographer setting up camera in vibrant East LA neighborhood', 'Handheld, documentary style', 'Authentic, observational', false, 'ready'),
  
  -- Chicago Morning
  (screenplay_uuid, 8, 1, 'Architecture of Change', 'Alex sketches buildings in a changing neighborhood', chicago_location, present_era, 'morning', 32, 'Architecture student sketching in gentrifying Chicago neighborhood', 'Wide shot of neighborhood, push to character sketching', 'Thoughtful, concerned', true, 'ready'),
  (screenplay_uuid, 9, 1, 'Beat of the City', 'Frank starts his day, last weeks before retirement', chicago_location, present_era, 'morning', 32, 'Veteran detective at desk in Chicago precinct, morning routine', 'Noir-influenced lighting, medium shot', 'Weary, determined', false, 'ready'),
  (screenplay_uuid, 10, 1, 'Rising Voice', 'Nina addresses community meeting about housing', chicago_location, present_era, 'morning', 32, 'Political candidate at community center, passionate speech', 'Documentary style, crowd reactions cut in', 'Inspiring, political', false, 'ready'),
  
  -- SF Morning
  (screenplay_uuid, 11, 1, 'The Algorithm', 'Priya works late into morning on AI code', sf_location, present_era, 'dawn', 32, 'Tech entrepreneur in modern SF office, multiple screens with code', 'Close on face lit by screens, pull back for scale', 'Tense, technological', true, 'ready'),
  (screenplay_uuid, 12, 1, 'Fog and Memory', 'Kevin watches fog roll over his changing neighborhood', sf_location, present_era, 'morning', 32, 'Elderly man on San Francisco balcony watching fog roll in', 'Contemplative, slow movement, fog as character', 'Nostalgic, peaceful', false, 'ready'),
  (screenplay_uuid, 13, 1, 'The Fight', 'Zoe organizes protest against evictions', sf_location, present_era, 'morning', 32, 'Activist organizing in Mission District, colorful murals backdrop', 'Energetic handheld, quick cuts', 'Urgent, community-focused', false, 'ready'),
  
  -- Miami Morning
  (screenplay_uuid, 14, 1, 'Ocean''s Warning', 'Isabella dives to document reef damage', miami_location, present_era, 'morning', 32, 'Marine biologist diving in Florida Keys, documenting coral', 'Underwater cinematography, ethereal', 'Beautiful, urgent', true, 'ready'),
  (screenplay_uuid, 15, 1, 'Night Shift Ends', 'Rafael closes club as sun rises', miami_location, present_era, 'dawn', 32, 'Club owner in empty Miami nightclub at dawn, contemplative', 'Neon lights fading as dawn breaks through', 'Liminal, reflective', false, 'ready'),
  (screenplay_uuid, 16, 1, 'Content Creation', 'Destiny films beach sunrise for followers', miami_location, present_era, 'dawn', 32, 'Influencer filming sunrise on Miami Beach, phone in hand', 'Behind the scenes of social media, real vs performed', 'Dual reality, modern', false, 'ready'),
  
  -- Seattle Morning
  (screenplay_uuid, 17, 1, 'Ancestral Voices', 'Rain works on installation in her studio', seattle_location, present_era, 'morning', 32, 'Indigenous artist in Seattle studio, creating large installation', 'Intimate, focus on hands and art', 'Spiritual, creative', true, 'ready'),
  (screenplay_uuid, 18, 1, 'Third Space', 'Sam opens coffee shop, regulars filtering in', seattle_location, present_era, 'morning', 32, 'Coffee shop owner opening Seattle cafe, Pike Place area', 'Warm, community feeling, morning rituals', 'Welcoming, community', false, 'ready'),
  (screenplay_uuid, 19, 1, 'Lab Notes', 'Dr. Liu faces ethical decision about her research', seattle_location, present_era, 'morning', 32, 'Scientist in high-tech Seattle lab, moral weight visible', 'Clean, clinical, isolated feeling', 'Tense, ethical', false, 'ready'),
  (screenplay_uuid, 20, 1, 'Street Wisdom', 'Bear shares coffee with passerby, observes city', seattle_location, present_era, 'morning', 32, 'Homeless veteran on Seattle street, moment of connection', 'Humanizing, eye-level, respect', 'Human, hopeful', false, 'ready');

  -- Insert scene characters for first 10 scenes
  INSERT INTO genesis_scene_characters (scene_id, character_id, dialogue, action_description, emotional_state, position_in_scene, is_speaking, screen_time_seconds)
  SELECT 
    s.id,
    c.id,
    CASE 
      WHEN s.scene_number = 2 THEN 'The city never sleeps... but it dreams.'
      WHEN s.scene_number = 3 THEN NULL
      WHEN s.scene_number = 5 THEN 'This is it. The scene that changes everything.'
      ELSE NULL
    END,
    CASE 
      WHEN s.scene_number = 1 THEN 'Camera pans across awakening city'
      WHEN s.scene_number = 2 THEN 'Maya raises camera, captures homeless man sharing coffee'
      WHEN s.scene_number = 3 THEN 'Marcus closes eyes, saxophone speaks his truth'
      WHEN s.scene_number = 5 THEN 'Jordan types furiously, then pauses, stares at Hollywood sign'
      ELSE 'Character in scene'
    END,
    CASE 
      WHEN s.scene_number IN (1, 2, 5, 8, 11, 14, 17) THEN 'Determined'
      ELSE 'Contemplative'
    END,
    'center',
    s.scene_number IN (2, 5),
    32
  FROM genesis_scenes s
  CROSS JOIN genesis_preset_characters c
  WHERE s.screenplay_id = screenplay_uuid 
    AND s.scene_number <= 20
    AND (
      (s.scene_number IN (1, 2, 3, 4) AND c.name IN ('Maya Chen', 'Marcus Williams', 'Elena Rossi'))
      OR (s.scene_number IN (5, 6, 7) AND c.name IN ('Jordan Blake', 'Victoria Sterling', 'Diego Morales'))
      OR (s.scene_number IN (8, 9, 10) AND c.name IN ('Alex Rivera', 'Frank Kowalski', 'Nina Okonkwo'))
      OR (s.scene_number IN (11, 12, 13) AND c.name IN ('Priya Sharma', 'Kevin OBrien', 'Zoe Washington'))
      OR (s.scene_number IN (14, 15, 16) AND c.name IN ('Isabella Santos', 'Rafael Dominguez', 'Destiny Williams'))
      OR (s.scene_number IN (17, 18, 19, 20) AND c.name IN ('Rain Blackwood', 'Sam Nakamura', 'Dr. Margaret Liu', 'Bear'))
    )
    AND (
      (s.scene_number = 1) -- Establishing shot, no specific character
      OR (s.scene_number = 2 AND c.name = 'Maya Chen')
      OR (s.scene_number = 3 AND c.name = 'Marcus Williams')
      OR (s.scene_number = 4 AND c.name = 'Elena Rossi')
      OR (s.scene_number = 5 AND c.name = 'Jordan Blake')
      OR (s.scene_number = 6 AND c.name = 'Victoria Sterling')
      OR (s.scene_number = 7 AND c.name = 'Diego Morales')
      OR (s.scene_number = 8 AND c.name = 'Alex Rivera')
      OR (s.scene_number = 9 AND c.name = 'Frank Kowalski')
      OR (s.scene_number = 10 AND c.name = 'Nina Okonkwo')
      OR (s.scene_number = 11 AND c.name = 'Priya Sharma')
      OR (s.scene_number = 12 AND c.name = 'Kevin OBrien')
      OR (s.scene_number = 13 AND c.name = 'Zoe Washington')
      OR (s.scene_number = 14 AND c.name = 'Isabella Santos')
      OR (s.scene_number = 15 AND c.name = 'Rafael Dominguez')
      OR (s.scene_number = 16 AND c.name = 'Destiny Williams')
      OR (s.scene_number = 17 AND c.name = 'Rain Blackwood')
      OR (s.scene_number = 18 AND c.name = 'Sam Nakamura')
      OR (s.scene_number = 19 AND c.name = 'Dr. Margaret Liu')
      OR (s.scene_number = 20 AND c.name = 'Bear')
    );
END $$;

-- Create storage bucket for character face uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('genesis-castings', 'genesis-castings', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for casting images
CREATE POLICY "Anyone can view casting images" ON storage.objects FOR SELECT USING (bucket_id = 'genesis-castings');
CREATE POLICY "Authenticated users can upload casting images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'genesis-castings' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own casting images" ON storage.objects FOR UPDATE USING (bucket_id = 'genesis-castings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own casting images" ON storage.objects FOR DELETE USING (bucket_id = 'genesis-castings' AND auth.uid()::text = (storage.foldername(name))[1]);