-- Create enum for movie genres
CREATE TYPE movie_genre AS ENUM ('action', 'drama', 'comedy', 'thriller', 'scifi', 'fantasy', 'romance', 'horror', 'documentary', 'adventure');

-- Create enum for story structure
CREATE TYPE story_structure AS ENUM ('three_act', 'hero_journey', 'circular', 'in_medias_res', 'episodic');

-- Create universes table for persistent worlds
CREATE TABLE public.universes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  setting TEXT,
  time_period TEXT,
  rules TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create characters table for reusable characters
CREATE TABLE public.characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  universe_id UUID REFERENCES public.universes(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  backstory TEXT,
  personality TEXT,
  appearance TEXT,
  voice_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create movie projects table
CREATE TABLE public.movie_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  universe_id UUID REFERENCES public.universes(id) ON DELETE SET NULL,
  parent_project_id UUID REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  genre movie_genre NOT NULL DEFAULT 'drama',
  story_structure story_structure NOT NULL DEFAULT 'three_act',
  target_duration_minutes INTEGER NOT NULL DEFAULT 5,
  setting TEXT,
  time_period TEXT,
  mood TEXT,
  movie_intro_style TEXT,
  synopsis TEXT,
  script_content TEXT,
  generated_script TEXT,
  voice_audio_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project_characters junction table
CREATE TABLE public.project_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, character_id)
);

-- Create script templates table
CREATE TABLE public.script_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  genre movie_genre,
  story_structure story_structure,
  sample_script TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for universes (public access for now, can add auth later)
CREATE POLICY "Anyone can view universes" ON public.universes FOR SELECT USING (true);
CREATE POLICY "Anyone can create universes" ON public.universes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update universes" ON public.universes FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete universes" ON public.universes FOR DELETE USING (true);

-- Create policies for characters
CREATE POLICY "Anyone can view characters" ON public.characters FOR SELECT USING (true);
CREATE POLICY "Anyone can create characters" ON public.characters FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update characters" ON public.characters FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete characters" ON public.characters FOR DELETE USING (true);

-- Create policies for movie_projects
CREATE POLICY "Anyone can view movie_projects" ON public.movie_projects FOR SELECT USING (true);
CREATE POLICY "Anyone can create movie_projects" ON public.movie_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update movie_projects" ON public.movie_projects FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete movie_projects" ON public.movie_projects FOR DELETE USING (true);

-- Create policies for project_characters
CREATE POLICY "Anyone can view project_characters" ON public.project_characters FOR SELECT USING (true);
CREATE POLICY "Anyone can create project_characters" ON public.project_characters FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete project_characters" ON public.project_characters FOR DELETE USING (true);

-- Create policies for script_templates
CREATE POLICY "Anyone can view script_templates" ON public.script_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can create script_templates" ON public.script_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update script_templates" ON public.script_templates FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete script_templates" ON public.script_templates FOR DELETE USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_universes_updated_at
  BEFORE UPDATE ON public.universes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_movie_projects_updated_at
  BEFORE UPDATE ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes for performance
CREATE INDEX idx_movie_projects_universe ON public.movie_projects(universe_id);
CREATE INDEX idx_movie_projects_parent ON public.movie_projects(parent_project_id);
CREATE INDEX idx_characters_universe ON public.characters(universe_id);
CREATE INDEX idx_project_characters_project ON public.project_characters(project_id);
CREATE INDEX idx_project_characters_character ON public.project_characters(character_id);