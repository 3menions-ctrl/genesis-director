-- Create a dedicated video-clips bucket with no MIME restrictions
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('video-clips', 'video-clips', true, NULL)
ON CONFLICT (id) DO NOTHING;