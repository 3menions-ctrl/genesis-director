-- Create video_likes table
CREATE TABLE public.video_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

-- Users can view all likes (for counting)
CREATE POLICY "Anyone can view likes"
ON public.video_likes
FOR SELECT
USING (true);

-- Users can like videos
CREATE POLICY "Users can like videos"
ON public.video_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unlike their own likes
CREATE POLICY "Users can unlike videos"
ON public.video_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_video_likes_project_id ON public.video_likes(project_id);
CREATE INDEX idx_video_likes_user_id ON public.video_likes(user_id);

-- Add likes_count to movie_projects for faster display
ALTER TABLE public.movie_projects ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Create function to update likes count
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.movie_projects SET likes_count = likes_count + 1 WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.movie_projects SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER on_like_added
AFTER INSERT ON public.video_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_likes_count();

CREATE TRIGGER on_like_removed
AFTER DELETE ON public.video_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_likes_count();