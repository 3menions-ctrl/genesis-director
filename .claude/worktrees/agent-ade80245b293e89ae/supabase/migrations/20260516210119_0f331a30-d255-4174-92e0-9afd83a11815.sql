-- Add new notification types for admin alerts
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_purchase';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_support_message';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_inquiry';