-- Enable realtime for movie_projects table so frontend can track pipeline progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.movie_projects;