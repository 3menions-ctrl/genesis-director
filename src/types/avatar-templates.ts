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

  // ── People & Lifestyle ──
  { id: 'kids', name: 'Kids & Cute', icon: '🧸', tags: ['kids', 'friendly', 'cheerful', 'cute', 'joyful', 'gentle'] },
  { id: 'casual', name: 'Casual', icon: '😎', tags: ['casual', 'relaxed', 'relatable', 'lifestyle', 'social', 'funny'] },
  { id: 'corporate', name: 'Business', icon: '💼', tags: ['corporate', 'professional', 'executive', 'consulting', 'finance', 'investment', 'real-estate', 'sales', 'leadership', 'formal'] },
  { id: 'influencer', name: 'Influencer', icon: '📱', tags: ['influencer', 'modern', 'streamer', 'gamer', 'esports', 'media', 'entertainment', 'hosting'] },
  { id: 'creative', name: 'Creative', icon: '🎨', tags: ['creative', 'artistic', 'artist', 'writer', 'art', 'storytelling', 'colorful'] },
  { id: 'educational', name: 'Education', icon: '📚', tags: ['educational', 'education', 'academic', 'scholarly', 'tutorial', 'mentor', 'guide', 'coaching', 'training'] },
  { id: 'luxury', name: 'Premium', icon: '👑', tags: ['luxury', 'premium', 'glamorous', 'elegant', 'sophisticated', 'wealthy', 'fashionable', 'fashion', 'beauty', 'style'] },

  // ── Health & Wellness ──
  { id: 'health', name: 'Health', icon: '🏥', tags: ['health', 'medical', 'dental', 'wellness', 'mindfulness', 'fitness', 'athletic', 'athlete'] },

  // ── Food & Culinary ──
  { id: 'food', name: 'Food & Chef', icon: '🍳', tags: ['food', 'culinary', 'chef'] },

  // ── Tech & Science ──
  { id: 'tech', name: 'Tech & Science', icon: '🤖', tags: ['tech', 'AI', 'robot', 'futuristic', 'scientist', 'genius', 'analytical', 'agile', 'space', 'astronaut'] },

  // ── Animals & Creatures ──
  { id: 'animal', name: 'Animals', icon: '🦊', tags: ['animal', 'fox', 'bear', 'bunny', 'cat', 'canine', 'owl', 'penguin', 'dragon', 'wolf', 'lion', 'tiger', 'eagle', 'falcon', 'horse', 'elephant', 'gorilla', 'dolphin', 'turtle', 'snake', 'parrot', 'raccoon', 'cheetah', 'leopard', 'feline', 'dog', 'reindeer'] },

  // ── Fantasy & Myth ──
  { id: 'fantasy', name: 'Fantasy', icon: '🧙', tags: ['fantasy', 'magic', 'wizard', 'fairy', 'elf', 'dragon', 'superhero', 'hero', 'demon', 'ghost', 'ninja', 'pirate', 'mystery', 'detective'] },

  // ── History & Royalty ──
  { id: 'historical', name: 'Historical', icon: '🏛️', tags: ['historical', 'emperor', 'empress', 'leader', 'ancient', 'medieval', 'renaissance', 'roman', 'egyptian', 'victorian', 'viking', 'norse', 'samurai', 'warrior', 'warrior-queen', 'conqueror', 'king', 'queen', 'royalty', 'princess', 'matriarch', 'philosopher', 'heian', 'incan', 'pilgrim'] },

  // ── Biblical & Spiritual ──
  { id: 'biblical', name: 'Biblical', icon: '📖', tags: ['biblical', 'angel', 'prophet', 'heaven', 'protector', 'wise', 'wisdom', 'elder'] },

  // ── Holiday & Seasonal ──
  { id: 'holiday', name: 'Holiday', icon: '🎄', tags: ['holiday', 'christmas', 'easter', 'halloween', 'valentine', 'thanksgiving', 'diwali', 'hanukkah', 'kwanzaa', 'lunarnewyear', 'carnival', 'stpatricks', 'independence', 'holi', 'hanami', 'dayofdead', 'santa', 'gingerbread', 'snowman', 'pumpkin', 'ghost', 'cupid', 'leprechaun', 'fireworks', 'turkey', 'frost', 'winter', 'elf', 'reindeer'] },

  // ── World Cultures ──
  { id: 'cultures', name: 'World Cultures', icon: '🌍', tags: ['african', 'african american', 'african-american', 'asian', 'east asian', 'south asian', 'south-asian', 'indian', 'japanese', 'korean', 'chinese', 'vietnamese', 'hispanic', 'latina', 'latin-american', 'brazilian', 'colombian', 'mexican', 'peruvian', 'british', 'french caucasian', 'german', 'italian', 'spanish', 'swedish', 'scandinavian', 'european', 'middle eastern', 'middle-eastern', 'jewish', 'nigerian', 'ghanaian', 'senegalese', 'malian', 'mongolian', 'bengal'] },

  // ── Adventure & Action ──
  { id: 'adventure', name: 'Adventure', icon: '⚔️', tags: ['adventure', 'explorer', 'captain', 'bold', 'strong', 'powerful', 'energetic', 'speed', 'fast', 'stealth', 'predator', 'ocean', 'forest', 'arctic', 'majestic', 'independent'] },

  // ── Motivation ──
  { id: 'motivation', name: 'Motivation', icon: '🔥', tags: ['motivation', 'motivational', 'inspirational', 'passionate', 'edgy', 'expert', 'natural', 'helpful', 'patient', 'clever', 'assistant'] },
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
