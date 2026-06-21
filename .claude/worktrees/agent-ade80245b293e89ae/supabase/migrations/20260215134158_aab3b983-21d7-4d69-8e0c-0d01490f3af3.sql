
-- Photo edit templates (predefined editing presets)
CREATE TABLE public.photo_edit_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'enhancement',
  prompt_instruction TEXT NOT NULL,
  icon TEXT DEFAULT '✨',
  is_premium BOOLEAN DEFAULT false,
  credits_cost INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photo edits (user edit jobs)
CREATE TABLE public.photo_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_url TEXT NOT NULL,
  edited_url TEXT,
  thumbnail_url TEXT,
  template_id UUID REFERENCES public.photo_edit_templates(id),
  custom_instruction TEXT,
  edit_type TEXT NOT NULL DEFAULT 'ai_transform',
  manual_adjustments JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  credits_charged INTEGER DEFAULT 0,
  batch_id UUID,
  batch_index INTEGER,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.photo_edit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_edits ENABLE ROW LEVEL SECURITY;

-- Templates are public read
CREATE POLICY "Anyone can view active templates"
  ON public.photo_edit_templates FOR SELECT
  USING (is_active = true);

-- Only admins can manage templates
CREATE POLICY "Admins can manage templates"
  ON public.photo_edit_templates FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Photo edits: users can only see their own
CREATE POLICY "Users can view own edits"
  ON public.photo_edits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own edits"
  ON public.photo_edits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own edits"
  ON public.photo_edits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own edits"
  ON public.photo_edits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_photo_edits_user_id ON public.photo_edits(user_id);
CREATE INDEX idx_photo_edits_batch_id ON public.photo_edits(batch_id);
CREATE INDEX idx_photo_edits_status ON public.photo_edits(status);

-- Timestamps trigger
CREATE TRIGGER update_photo_edits_updated_at
  BEFORE UPDATE ON public.photo_edits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_photo_edit_templates_updated_at
  BEFORE UPDATE ON public.photo_edit_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for user photos
INSERT INTO storage.buckets (id, name, public) VALUES ('photo-edits', 'photo-edits', true);

-- Storage policies
CREATE POLICY "Users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photo-edits' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'photo-edits' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photo-edits');

CREATE POLICY "Users can delete own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'photo-edits' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Seed initial templates
INSERT INTO public.photo_edit_templates (name, description, category, prompt_instruction, icon, is_premium, credits_cost, sort_order) VALUES
  ('Professional Headshot', 'Studio-quality portrait with perfect lighting', 'portrait', 'Transform this photo into a professional studio headshot with soft key lighting, clean background, and flattering skin tones. Make it look like it was taken by a professional photographer in a studio.', '👤', false, 0, 1),
  ('Product Shot', 'Clean e-commerce product photography', 'commercial', 'Transform this into a clean, professional product photography shot with white/neutral background, perfect lighting, subtle shadows, and commercial-grade presentation.', '📦', false, 0, 2),
  ('Real Estate', 'Enhance property photos for listings', 'commercial', 'Enhance this real estate photo: brighten the space, improve lighting, make colors more vivid, fix any lens distortion, and make the space look inviting and spacious.', '🏠', false, 0, 3),
  ('Food Photography', 'Make dishes look irresistible', 'commercial', 'Transform this into professional food photography: enhance colors to make the food look fresh and appetizing, improve lighting for that editorial food magazine look, add subtle steam or freshness effects.', '🍽️', false, 0, 4),
  ('Cinematic Color Grade', 'Hollywood-style color treatment', 'style', 'Apply a cinematic Hollywood color grade: teal and orange color palette, dramatic contrast, film-like grain, and professional color science that looks like a scene from a blockbuster movie.', '🎬', true, 2, 5),
  ('Vintage Film', 'Classic analog film aesthetic', 'style', 'Transform this into a vintage analog film look: warm tones, slight fade, film grain texture, vignette, and the nostalgic feel of a 35mm photograph from the 1970s.', '📷', true, 2, 6),
  ('Background Remove', 'Clean background removal', 'utility', 'Remove the background from this image completely, leaving only the main subject with a clean transparent or pure white background. Ensure clean edges around the subject.', '✂️', false, 0, 7),
  ('AI Enhance', 'Upscale and improve quality', 'enhancement', 'Dramatically enhance this photo: improve sharpness, increase detail, fix any noise or artifacts, improve dynamic range, enhance colors naturally, and make it look like it was taken with a high-end camera.', '✨', false, 0, 8),
  ('Social Media Ready', 'Optimized for Instagram/LinkedIn', 'social', 'Optimize this photo for social media: enhance colors for screen viewing, improve contrast, add subtle warmth, ensure the subject pops, and create an attention-grabbing look suitable for Instagram or LinkedIn.', '📱', false, 0, 9),
  ('Dark & Moody', 'Dramatic low-key lighting', 'style', 'Apply a dark and moody aesthetic: deep shadows, dramatic lighting, desaturated colors except for key tones, high contrast, and an atmospheric cinematic feel.', '🌙', true, 2, 10);
