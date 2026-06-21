-- =====================================================
-- FIX TABLE-LEVEL RLS POLICIES
-- =====================================================

-- CHARACTERS TABLE
DROP POLICY IF EXISTS "Anyone can delete characters" ON characters;
DROP POLICY IF EXISTS "Anyone can create characters" ON characters;
DROP POLICY IF EXISTS "Anyone can update characters" ON characters;

CREATE POLICY "Users can create own characters" ON characters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own characters" ON characters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own characters" ON characters
  FOR DELETE USING (auth.uid() = user_id);

-- PROJECT_CHARACTERS TABLE
DROP POLICY IF EXISTS "Anyone can delete project_characters" ON project_characters;
DROP POLICY IF EXISTS "Anyone can create project_characters" ON project_characters;

CREATE POLICY "Users can create project_characters for own projects" ON project_characters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM movie_projects 
      WHERE id = project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete project_characters for own projects" ON project_characters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM movie_projects 
      WHERE id = project_id AND user_id = auth.uid()
    )
  );

-- SCRIPT_TEMPLATES TABLE
DROP POLICY IF EXISTS "Anyone can delete script_templates" ON script_templates;
DROP POLICY IF EXISTS "Anyone can create script_templates" ON script_templates;
DROP POLICY IF EXISTS "Anyone can update script_templates" ON script_templates;

CREATE POLICY "Users can create own script_templates" ON script_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own script_templates" ON script_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own script_templates" ON script_templates
  FOR DELETE USING (auth.uid() = user_id);

-- UNIVERSES TABLE
DROP POLICY IF EXISTS "Anyone can create universes" ON universes;
DROP POLICY IF EXISTS "Anyone can delete universes" ON universes;
DROP POLICY IF EXISTS "Anyone can update universes" ON universes;

CREATE POLICY "Users can create own universes" ON universes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own universes" ON universes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own universes" ON universes
  FOR DELETE USING (auth.uid() = user_id);