// Avatar template types for premade avatar selection

export interface AvatarTemplate {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  gender: string;
  age_range: string | null;
  ethnicity: string | null;
  style: string | null;
  face_image_url: string;
  thumbnail_url: string | null;
  voice_id: string;
  voice_provider: string;
  voice_name: string | null;
  voice_description: string | null;
  sample_audio_url: string | null;
  tags: string[] | null;
  use_count: number | null;
  is_active: boolean | null;
  is_premium: boolean | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface AvatarTemplateFilter {
  gender?: string;
  style?: string;
  search?: string;
}

// Style categories for filtering
export const AVATAR_STYLES = [
  { id: 'all', name: 'All Avatars' },
  { id: 'corporate', name: 'Business' },
  { id: 'creative', name: 'Creative' },
  { id: 'educational', name: 'Education' },
  { id: 'casual', name: 'Casual' },
  { id: 'influencer', name: 'Influencer' },
  { id: 'luxury', name: 'Premium' },
] as const;

// Gender options for filtering
export const AVATAR_GENDERS = [
  { id: 'all', name: 'All' },
  { id: 'male', name: 'Male' },
  { id: 'female', name: 'Female' },
] as const;
