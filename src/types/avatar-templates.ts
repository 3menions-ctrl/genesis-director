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

export type AvatarType = 'realistic' | 'animated';

export interface AvatarTemplate {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  gender: string;
  age_range: string | null;
  ethnicity: string | null;
  style: string | null;
  avatar_type: AvatarType;
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
  avatarType?: AvatarType | 'all';
  categoryId?: string; // tag-based category filter
}

// Avatar type categories
export const AVATAR_TYPES = [
  { id: 'all', name: 'All Avatars', description: 'Show all avatar styles' },
  { id: 'realistic', name: 'Realistic', description: 'Photorealistic human avatars' },
  { id: 'animated', name: 'Animated', description: 'Stylized CGI avatars' },
] as const;

// ═══ TAG-BASED CATEGORY SYSTEM ═══
// Each category maps to one or more tags in the avatar_templates.tags column.
// An avatar matches a category if it has ANY of that category's tags.
export interface AvatarCategory {
  id: string;
  name: string;
  icon: string; // emoji
  tags: string[]; // matched against avatar_templates.tags
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  { id: 'all', name: 'All', icon: '✨', tags: [] },
  { id: 'kids', name: 'Kids & Cute', icon: '🧸', tags: ['kids', 'friendly', 'cheerful', 'cute'] },
  { id: 'holiday', name: 'Holiday', icon: '🎄', tags: ['holiday', 'christmas', 'easter', 'halloween', 'valentines', 'thanksgiving', 'diwali', 'hanukkah', 'kwanzaa', 'lunar-new-year', 'eid', 'carnival', 'st-patricks', 'independence-day', 'new-years'] },
  { id: 'animal', name: 'Animals', icon: '🦊', tags: ['animal', 'fox', 'bear', 'bunny', 'cat', 'canine', 'owl', 'penguin', 'dragon'] },
  { id: 'folklore', name: 'Folklore', icon: '🧙', tags: ['folklore', 'mythical', 'fairy-tale', 'legend'] },
  { id: 'biblical', name: 'Biblical', icon: '📖', tags: ['biblical', 'angel', 'prophet', 'ancient'] },
  { id: 'historical', name: 'Historical', icon: '🏛️', tags: ['historical', 'emperor', 'leader', 'ancient', 'medieval', 'renaissance'] },
  { id: 'famous', name: 'Famous Faces', icon: '⭐', tags: ['famous', 'celebrity', 'icon', 'legend'] },
  { id: 'corporate', name: 'Business', icon: '💼', tags: ['corporate', 'professional'] },
  { id: 'creative', name: 'Creative', icon: '🎨', tags: ['creative', 'artistic', 'artist'] },
  { id: 'educational', name: 'Education', icon: '📚', tags: ['educational'] },
  { id: 'influencer', name: 'Influencer', icon: '📱', tags: ['influencer', 'modern'] },
  { id: 'luxury', name: 'Premium', icon: '👑', tags: ['luxury'] },
  { id: 'casual', name: 'Casual', icon: '😎', tags: ['casual'] },
];

// Style categories for filtering (legacy — kept for popover filter)
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
