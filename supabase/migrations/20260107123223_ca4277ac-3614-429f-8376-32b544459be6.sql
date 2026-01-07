-- =====================================================
-- P2 FIX: Add NOT NULL constraints to user_id columns
-- This ensures data integrity and RLS policies work correctly
-- =====================================================

-- First, clean up any existing NULL user_id rows (shouldn't exist in production)
DELETE FROM characters WHERE user_id IS NULL;
DELETE FROM universes WHERE user_id IS NULL;
DELETE FROM script_templates WHERE user_id IS NULL;
DELETE FROM movie_projects WHERE user_id IS NULL;

-- Add NOT NULL constraint to characters.user_id
ALTER TABLE public.characters 
ALTER COLUMN user_id SET NOT NULL;

-- Add NOT NULL constraint to universes.user_id
ALTER TABLE public.universes 
ALTER COLUMN user_id SET NOT NULL;

-- Add NOT NULL constraint to script_templates.user_id
ALTER TABLE public.script_templates 
ALTER COLUMN user_id SET NOT NULL;

-- Add NOT NULL constraint to movie_projects.user_id
ALTER TABLE public.movie_projects 
ALTER COLUMN user_id SET NOT NULL;