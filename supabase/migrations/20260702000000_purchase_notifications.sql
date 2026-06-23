-- User-facing money notifications. The notification_type enum had admin_* and
-- low_credits, but no "your credits were added" / "your plan renewed" types, so
-- a successful purchase produced no notification in the bell. Add them.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'credits_purchased';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'subscription_renewed';
