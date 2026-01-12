import type { Json } from '@/integrations/supabase/types';

export type UniverseRole = 'owner' | 'admin' | 'member' | 'viewer';
export type LendingPermission = 'none' | 'universe_only' | 'specific_users' | 'public';

export interface Universe {
  id: string;
  name: string;
  description: string | null;
  setting: string | null;
  time_period: string | null;
  rules: string | null;
  user_id: string;
  is_public: boolean;
  cover_image_url: string | null;
  style_guide: Json;
  lore_document: string | null;
  member_count: number;
  video_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface UniverseMember {
  id: string;
  universe_id: string;
  user_id: string;
  role: UniverseRole;
  invited_by: string | null;
  joined_at: string;
  can_add_characters: boolean;
  can_edit_lore: boolean;
  can_invite_members: boolean;
  // Joined data
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CharacterLoan {
  id: string;
  character_id: string;
  owner_id: string;
  borrower_id: string;
  project_id: string | null;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'revoked';
  requested_at: string;
  responded_at: string | null;
  expires_at: string | null;
  usage_notes: string | null;
  credit_given: boolean;
  // Joined data
  character?: {
    name: string;
    appearance: string | null;
  };
  borrower?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface UniverseContinuityEvent {
  id: string;
  universe_id: string;
  created_by: string;
  event_type: 'story_event' | 'character_change' | 'world_change' | 'timeline_marker';
  title: string;
  description: string | null;
  timeline_position: number | null;
  date_in_universe: string | null;
  affected_characters: string[];
  source_project_id: string | null;
  is_canon: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface UniverseInvitation {
  id: string;
  universe_id: string;
  invited_email: string;
  invited_by: string;
  role: UniverseRole;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
  // Joined data
  universe?: {
    name: string;
    cover_image_url: string | null;
  };
}

export interface LendableCharacter {
  id: string;
  name: string;
  appearance: string | null;
  description: string | null;
  lending_permission: LendingPermission;
  lending_credits_required: number;
  times_borrowed: number;
  user_id: string;
  universe_id: string | null;
  owner?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}
