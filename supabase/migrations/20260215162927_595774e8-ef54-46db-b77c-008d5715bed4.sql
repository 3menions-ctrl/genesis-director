-- Add missing notification types for video lifecycle events
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'video_started';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'video_failed';