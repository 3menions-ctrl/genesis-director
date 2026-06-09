
-- Fix conversations UPDATE policy (self-referential bug)
DROP POLICY IF EXISTS "Owners can update conversations" ON public.conversations;
CREATE POLICY "Owners can update conversations"
ON public.conversations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversations.id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['owner','admin'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversations.id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['owner','admin'])
  )
);

-- Remove loose, non-path-scoped storage INSERT policies. Path-scoped owner
-- policies already exist for each of these buckets.
DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload scene images v2" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload casting images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload hoppy images" ON storage.objects;
