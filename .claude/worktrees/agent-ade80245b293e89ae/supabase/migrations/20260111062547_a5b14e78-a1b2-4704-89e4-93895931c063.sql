-- Add user_preferences and notification_settings columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{"defaultQualityTier": "standard", "defaultGenre": "cinematic", "theme": "dark", "autoplayVideos": true, "defaultPlaybackSpeed": 1, "defaultVolume": 80, "showTutorialHints": true, "compactMode": false}'::jsonb,
ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{"emailNotifications": true, "videoComplete": true, "videoFailed": true, "lowCredits": true, "lowCreditsThreshold": 10, "weeklyDigest": false, "productUpdates": true, "tips": true, "marketing": false}'::jsonb,
ADD COLUMN IF NOT EXISTS auto_recharge_enabled boolean DEFAULT false;

-- Create avatars storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);