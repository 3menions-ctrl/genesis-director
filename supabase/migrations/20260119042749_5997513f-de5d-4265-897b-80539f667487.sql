-- Add unique constraint on project_id for stitch_jobs to allow upsert
ALTER TABLE public.stitch_jobs 
ADD CONSTRAINT stitch_jobs_project_id_unique UNIQUE (project_id);