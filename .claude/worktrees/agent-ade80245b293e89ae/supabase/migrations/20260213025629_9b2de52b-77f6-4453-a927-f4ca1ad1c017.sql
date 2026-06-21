-- 1. Create a function to sanitize error messages before storing them
CREATE OR REPLACE FUNCTION public.sanitize_stitch_error()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Sanitize last_error to remove stack traces, file paths, and internal details
  IF NEW.last_error IS NOT NULL THEN
    -- Remove file paths (Unix and Windows)
    NEW.last_error := regexp_replace(NEW.last_error, '(/[a-zA-Z0-9_\-./]+\.(ts|js|tsx|jsx|go|rs))(:\d+:\d+)?', '[internal]', 'g');
    NEW.last_error := regexp_replace(NEW.last_error, '([A-Z]:\\[a-zA-Z0-9_\-\\]+\.\w+)', '[internal]', 'g');
    -- Remove stack trace lines (at Function.xxx, at Object.xxx, etc.)
    NEW.last_error := regexp_replace(NEW.last_error, '\s+at\s+\S+\s+\([^)]+\)', '', 'g');
    NEW.last_error := regexp_replace(NEW.last_error, '\s+at\s+[^\n]+', '', 'g');
    -- Remove IP addresses
    NEW.last_error := regexp_replace(NEW.last_error, '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?', '[redacted]', 'g');
    -- Remove UUIDs that might be internal identifiers (but keep project/user IDs format)  
    -- Remove environment variable references
    NEW.last_error := regexp_replace(NEW.last_error, '(SUPABASE_|OPENAI_|STRIPE_|API_|SECRET_)\w+', '[env]', 'g');
    -- Truncate to prevent excessively long error messages
    NEW.last_error := left(NEW.last_error, 500);
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger on INSERT and UPDATE
CREATE TRIGGER sanitize_stitch_job_errors
BEFORE INSERT OR UPDATE OF last_error ON public.stitch_jobs
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_stitch_error();

-- 2. Fix stitch_jobs admin policy to use has_role() instead of direct table query (prevents recursion risk)
DROP POLICY IF EXISTS "Admins can view all stitch jobs" ON public.stitch_jobs;
CREATE POLICY "Admins can view all stitch jobs"
ON public.stitch_jobs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also scope other policies to authenticated (not public)
DROP POLICY IF EXISTS "Users can create stitch jobs for their projects" ON public.stitch_jobs;
CREATE POLICY "Users can create stitch jobs for their projects"
ON public.stitch_jobs
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own stitch jobs" ON public.stitch_jobs;
CREATE POLICY "Users can update their own stitch jobs"
ON public.stitch_jobs
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own stitch jobs" ON public.stitch_jobs;
CREATE POLICY "Users can view their own stitch jobs"
ON public.stitch_jobs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);