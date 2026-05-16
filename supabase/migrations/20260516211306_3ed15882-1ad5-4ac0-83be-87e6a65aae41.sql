
-- ===================================================================
-- COMPREHENSIVE OPERATOR NOTIFICATION SYSTEM
-- ===================================================================

-- 1. New notification types
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_payment_failed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_refund';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_dispute';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_high_value_purchase';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_stuck_job';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_first_video';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_account_deleted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_abuse_signal';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_error_spike';
