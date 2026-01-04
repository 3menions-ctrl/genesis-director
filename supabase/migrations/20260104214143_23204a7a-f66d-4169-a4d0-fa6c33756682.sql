-- Update movie_genre enum with new video type values
ALTER TYPE public.movie_genre RENAME TO movie_genre_old;

CREATE TYPE public.movie_genre AS ENUM (
  'ad',
  'educational', 
  'documentary',
  'cinematic',
  'funny',
  'religious',
  'motivational',
  'storytelling',
  'explainer',
  'vlog'
);

-- Update the column to use the new enum
ALTER TABLE public.movie_projects 
  ALTER COLUMN genre DROP DEFAULT,
  ALTER COLUMN genre TYPE public.movie_genre USING 
    CASE genre::text
      WHEN 'action' THEN 'cinematic'
      WHEN 'drama' THEN 'storytelling'
      WHEN 'comedy' THEN 'funny'
      WHEN 'thriller' THEN 'cinematic'
      WHEN 'scifi' THEN 'cinematic'
      WHEN 'fantasy' THEN 'storytelling'
      WHEN 'romance' THEN 'storytelling'
      WHEN 'horror' THEN 'cinematic'
      WHEN 'documentary' THEN 'documentary'
      WHEN 'adventure' THEN 'cinematic'
      ELSE 'cinematic'
    END::public.movie_genre,
  ALTER COLUMN genre SET DEFAULT 'cinematic';

-- Update script_templates table if it has the genre column
ALTER TABLE public.script_templates
  ALTER COLUMN genre TYPE public.movie_genre USING 
    CASE genre::text
      WHEN 'action' THEN 'cinematic'
      WHEN 'drama' THEN 'storytelling'
      WHEN 'comedy' THEN 'funny'
      WHEN 'thriller' THEN 'cinematic'
      WHEN 'scifi' THEN 'cinematic'
      WHEN 'fantasy' THEN 'storytelling'
      WHEN 'romance' THEN 'storytelling'
      WHEN 'horror' THEN 'cinematic'
      WHEN 'documentary' THEN 'documentary'
      WHEN 'adventure' THEN 'cinematic'
      ELSE 'cinematic'
    END::public.movie_genre;

-- Drop the old enum type
DROP TYPE public.movie_genre_old;