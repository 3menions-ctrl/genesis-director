-- Add composite index for optimized avatar template queries
CREATE INDEX IF NOT EXISTS idx_avatar_templates_active_sort 
ON public.avatar_templates (is_active, sort_order)
WHERE is_active = true;