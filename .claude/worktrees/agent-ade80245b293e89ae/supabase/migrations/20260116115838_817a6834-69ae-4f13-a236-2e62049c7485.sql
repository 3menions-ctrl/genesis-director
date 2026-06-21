-- Update tier limits for competitive video durations
-- Free: 32 seconds (5 clips × 6 sec)
-- Pro: 1 minute (10 clips × 6 sec)
-- Growth: 2 minutes (20 clips × 6 sec)
-- Agency: 3 minutes (30 clips × 6 sec)

UPDATE tier_limits SET
  max_duration_minutes = 1,
  max_clips_per_video = 5
WHERE tier = 'free';

UPDATE tier_limits SET
  max_duration_minutes = 1,
  max_clips_per_video = 10
WHERE tier = 'pro';

UPDATE tier_limits SET
  max_duration_minutes = 2,
  max_clips_per_video = 20
WHERE tier = 'growth';

UPDATE tier_limits SET
  max_duration_minutes = 3,
  max_clips_per_video = 30
WHERE tier = 'agency';