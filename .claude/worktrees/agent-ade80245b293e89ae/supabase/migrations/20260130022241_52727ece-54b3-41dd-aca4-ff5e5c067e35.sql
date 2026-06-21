-- Add unique constraint on name for avatar_templates
ALTER TABLE public.avatar_templates 
ADD CONSTRAINT avatar_templates_name_unique UNIQUE (name);