
-- Extend notification enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_member_joined';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_welcome';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_role_changed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'org_credits_low';
