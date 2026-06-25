-- ─────────────────────────────────────────────────────────────────────────
-- H4: the `user-uploads` bucket was created with no file_size_limit, so a
-- single object could be arbitrarily large (quota-exhaustion vector). Set a
-- per-object ceiling that matches the client default (useFileUpload maxSizeMB
-- = 100) and an allow-list covering the image/video/audio it actually holds.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
   SET file_size_limit = 104857600,            -- 100 MB
       allowed_mime_types = ARRAY['image/*','video/*','audio/*']
 WHERE id = 'user-uploads';
