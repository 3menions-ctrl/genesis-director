// Avatar template types for premade avatar selection

export interface CharacterBible {
  front_view?: string;
  side_view?: string;
  back_view?: string;
  silhouette?: string;
  hair_description?: string;
  clothing_description?: string;
  body_type?: string;
  distinguishing_features?: string[];
  negative_prompts?: string[];
}

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
  // Multi-angle support
  front_image_url: string | null;
  side_image_url: string | null;
  back_image_url: string | null;
  // Character bible for production consistency
  character_bible: CharacterBible | null;
  // Voice configuration
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
