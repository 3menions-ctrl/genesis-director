
-- ============================================
-- GENESIS SCENES: Widget Configuration System
-- ============================================

-- Widget configs table - stores all widget/landing page configurations
CREATE TABLE public.widget_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  
  -- Basic info
  name text NOT NULL,
  slug text UNIQUE, -- for hosted pages /w/:slug
  widget_type text NOT NULL DEFAULT 'embed' CHECK (widget_type IN ('embed', 'landing_page', 'both')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'archived')),
  
  -- Branding
  primary_color text DEFAULT '#4f46e5',
  logo_url text,
  background_color text DEFAULT '#000000',
  font_family text DEFAULT 'Inter',
  
  -- Position & Display (for embed mode)
  position text DEFAULT 'bottom-right' CHECK (position IN ('bottom-right', 'bottom-left', 'center', 'top-right', 'top-left')),
  z_index integer DEFAULT 999999,
  widget_width integer DEFAULT 320,
  widget_height integer DEFAULT 400,
  
  -- CTA
  cta_text text DEFAULT 'Get Started',
  cta_url text,
  cta_color text DEFAULT '#16a34a',
  secondary_cta_text text,
  secondary_cta_url text,
  
  -- Headline/copy for landing pages
  headline text,
  subheadline text,
  
  -- Scenes (JSONB array)
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Each scene: { id, name, type, src_mp4, poster_url, loop, priority, subtitle_text, duration_seconds }
  -- Types: idle, engage, cta, exit_save, pricing_hover, hero, testimonial
  
  -- Trigger configuration
  triggers jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- { idle_seconds: 6, scroll_percent: 35, exit_intent: true, pricing_hover_selector: null }
  
  -- Rules (if/then mapping)
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ event: "IDLE", action: "play_scene", scene_id: "xxx" }, ...]
  
  -- Sensitivity
  sensitivity text DEFAULT 'medium' CHECK (sensitivity IN ('low', 'medium', 'high')),
  
  -- Domain allowlist for embed security
  allowed_domains text[] DEFAULT '{}',
  
  -- Tone
  tone text DEFAULT 'friendly' CHECK (tone IN ('friendly', 'bold', 'funny', 'professional', 'urgent')),
  
  -- Public key for embed access
  public_key text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  
  -- Analytics
  total_views integer DEFAULT 0,
  total_cta_clicks integer DEFAULT 0,
  total_scene_plays integer DEFAULT 0,
  
  -- Credit tracking
  credits_charged integer DEFAULT 0,
  last_view_credit_checkpoint integer DEFAULT 0, -- tracks 1K view milestones
  
  -- Project link (optional - reuse scenes from existing projects)
  source_project_id uuid REFERENCES public.movie_projects(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  published_at timestamp with time zone
);

-- Widget events table - tracks all visitor interactions
CREATE TABLE public.widget_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_id uuid NOT NULL REFERENCES public.widget_configs(id) ON DELETE CASCADE,
  
  -- Event info
  event_type text NOT NULL CHECK (event_type IN (
    'view', 'scene_play', 'scene_complete', 'cta_click', 'secondary_cta_click',
    'dismiss', 'minimize', 'reopen', 'exit_intent_fired', 'idle_triggered',
    'scroll_triggered', 'hover_triggered'
  )),
  scene_id text, -- which scene was playing
  
  -- Visitor context (anonymized)
  visitor_session text, -- random session ID, not PII
  page_url text,
  referrer text,
  device_type text CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_widget_configs_user_id ON public.widget_configs(user_id);
CREATE INDEX idx_widget_configs_public_key ON public.widget_configs(public_key);
CREATE INDEX idx_widget_configs_slug ON public.widget_configs(slug);
CREATE INDEX idx_widget_configs_status ON public.widget_configs(status);
CREATE INDEX idx_widget_events_widget_id ON public.widget_events(widget_id);
CREATE INDEX idx_widget_events_created_at ON public.widget_events(created_at);
CREATE INDEX idx_widget_events_type ON public.widget_events(event_type);

-- Enable RLS
ALTER TABLE public.widget_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for widget_configs
-- ============================================

-- Users can view their own widgets
CREATE POLICY "Users can view own widgets"
  ON public.widget_configs FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all widgets
CREATE POLICY "Admins can view all widgets"
  ON public.widget_configs FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- Users can create widgets
CREATE POLICY "Users can create own widgets"
  ON public.widget_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own widgets
CREATE POLICY "Users can update own widgets"
  ON public.widget_configs FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own widgets
CREATE POLICY "Users can delete own widgets"
  ON public.widget_configs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- RLS Policies for widget_events
-- ============================================

-- Block direct client inserts (events come through edge function)
CREATE POLICY "Block direct event inserts"
  ON public.widget_events FOR INSERT
  WITH CHECK (false);

-- Users can view events for their own widgets
CREATE POLICY "Users can view own widget events"
  ON public.widget_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM widget_configs wc 
    WHERE wc.id = widget_events.widget_id 
    AND wc.user_id = auth.uid()
  ));

-- Admins can view all events
CREATE POLICY "Admins can view all widget events"
  ON public.widget_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- Block updates/deletes on events
CREATE POLICY "Block event updates"
  ON public.widget_events FOR UPDATE
  USING (false);

CREATE POLICY "Block event deletes"
  ON public.widget_events FOR DELETE
  USING (false);

-- ============================================
-- Trigger for updated_at
-- ============================================
CREATE TRIGGER update_widget_configs_updated_at
  BEFORE UPDATE ON public.widget_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Function to increment widget analytics
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_widget_analytics(
  p_widget_id uuid,
  p_event_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_event_type = 'view' THEN
    UPDATE widget_configs 
    SET total_views = total_views + 1 
    WHERE id = p_widget_id;
  ELSIF p_event_type = 'cta_click' OR p_event_type = 'secondary_cta_click' THEN
    UPDATE widget_configs 
    SET total_cta_clicks = total_cta_clicks + 1 
    WHERE id = p_widget_id;
  ELSIF p_event_type LIKE 'scene_%' THEN
    UPDATE widget_configs 
    SET total_scene_plays = total_scene_plays + 1 
    WHERE id = p_widget_id;
  END IF;
END;
$$;

-- ============================================
-- Function to check and deduct view credits
-- ============================================
CREATE OR REPLACE FUNCTION public.check_widget_view_credits(
  p_widget_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_widget RECORD;
  v_current_views integer;
  v_last_checkpoint integer;
  v_credits_per_1k integer := 5;
BEGIN
  SELECT user_id, total_views, last_view_credit_checkpoint
  INTO v_widget
  FROM widget_configs
  WHERE id = p_widget_id;

  IF NOT FOUND THEN RETURN false; END IF;

  v_current_views := v_widget.total_views;
  v_last_checkpoint := v_widget.last_view_credit_checkpoint;

  -- Check if we've crossed a new 1K milestone
  IF (v_current_views / 1000) > (v_last_checkpoint / 1000) THEN
    -- Deduct credits
    IF NOT deduct_credits(
      v_widget.user_id, 
      v_credits_per_1k, 
      'Widget views milestone: ' || ((v_current_views / 1000) * 1000) || ' views'
    ) THEN
      -- Out of credits - pause the widget
      UPDATE widget_configs 
      SET status = 'paused', last_view_credit_checkpoint = v_current_views
      WHERE id = p_widget_id;
      RETURN false;
    END IF;

    -- Update checkpoint
    UPDATE widget_configs 
    SET last_view_credit_checkpoint = v_current_views
    WHERE id = p_widget_id;
  END IF;

  RETURN true;
END;
$$;
