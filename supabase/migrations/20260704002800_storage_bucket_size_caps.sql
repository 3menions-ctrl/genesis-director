-- Storage-bomb prevention: cap buckets that had NO file_size_limit. Generous
-- caps, only affect NEW uploads, no MIME restriction (video-clips is mixed
-- video+audio). Applied to prod via Management API; recorded 20260704002800.
UPDATE storage.buckets SET file_size_limit = 524288000 WHERE id = 'video-clips'    AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 52428800  WHERE id = 'brand-assets'    AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 52428800  WHERE id = 'photo-edits'     AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 10485760  WHERE id = 'thumbnails'      AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 52428800  WHERE id = 'workspace-brand' AND file_size_limit IS NULL;
UPDATE storage.buckets SET file_size_limit = 26214400  WHERE id = 'reactions'       AND file_size_limit IS NULL;
