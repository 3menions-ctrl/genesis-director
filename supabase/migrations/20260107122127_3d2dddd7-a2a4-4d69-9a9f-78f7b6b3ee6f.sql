-- =====================================================
-- CRITICAL SECURITY FIX: RLS Policy Updates
-- =====================================================

-- 1. FIX characters table - restrict to own characters only
DROP POLICY IF EXISTS "Anyone can view characters" ON public.characters;
CREATE POLICY "Users can view own characters" 
ON public.characters 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. FIX universes table - restrict to own universes only
DROP POLICY IF EXISTS "Anyone can view universes" ON public.universes;
CREATE POLICY "Users can view own universes" 
ON public.universes 
FOR SELECT 
USING (auth.uid() = user_id);

-- 3. FIX script_templates table - restrict to own templates only
DROP POLICY IF EXISTS "Anyone can view script_templates" ON public.script_templates;
CREATE POLICY "Users can view own script_templates" 
ON public.script_templates 
FOR SELECT 
USING (auth.uid() = user_id);

-- 4. FIX project_characters table - restrict to own project characters only
DROP POLICY IF EXISTS "Anyone can view project_characters" ON public.project_characters;
CREATE POLICY "Users can view own project_characters" 
ON public.project_characters 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.movie_projects 
    WHERE movie_projects.id = project_characters.project_id 
    AND movie_projects.user_id = auth.uid()
  )
);

-- =====================================================
-- ADD INSERT POLICIES - Block client-side inserts
-- These tables should only be written via service role
-- =====================================================

-- 5. profiles - INSERT handled by auth trigger, block client inserts
CREATE POLICY "Block client profile inserts" 
ON public.profiles 
FOR INSERT 
WITH CHECK (false);

-- 6. credit_transactions - only service role can insert
CREATE POLICY "Block client credit transaction inserts" 
ON public.credit_transactions 
FOR INSERT 
WITH CHECK (false);

-- 7. api_cost_logs - only service role can insert  
CREATE POLICY "Block client api cost log inserts" 
ON public.api_cost_logs 
FOR INSERT 
WITH CHECK (false);

-- 8. production_credit_phases - only service role can insert
CREATE POLICY "Block client production credit phase inserts" 
ON public.production_credit_phases 
FOR INSERT 
WITH CHECK (false);