-- Enable realtime for video_clips table to track pipeline progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_clips;