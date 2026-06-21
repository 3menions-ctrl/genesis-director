-- =====================================================
-- IRON-CLAD WORKFLOW: Set max 4 retries for ALL tiers
-- This ensures every tier gets the full retry budget for quality
-- =====================================================

UPDATE tier_limits SET max_retries_per_clip = 4 WHERE tier = 'free';
UPDATE tier_limits SET max_retries_per_clip = 4 WHERE tier = 'pro';
UPDATE tier_limits SET max_retries_per_clip = 4 WHERE tier = 'growth';
UPDATE tier_limits SET max_retries_per_clip = 4 WHERE tier = 'agency';