-- Create a table for training videos (learning videos)
CREATE TABLE public.training_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Training Video',
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  voice_id TEXT,
  environment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own training videos" 
ON public.training_videos 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own training videos" 
ON public.training_videos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training videos" 
ON public.training_videos 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training videos" 
ON public.training_videos 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_training_videos_updated_at
BEFORE UPDATE ON public.training_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();