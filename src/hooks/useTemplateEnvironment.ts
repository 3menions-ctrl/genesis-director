import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  getBreakoutTemplate, 
  isBreakoutTemplate,
  BreakoutTemplateConfig
} from '@/lib/templates/breakout-templates';

// Import breakout template images - NEW 5-TEMPLATE SYSTEM
import postEscapeImg from '@/assets/templates/post-escape.jpg';
import scrollGrabImg from '@/assets/templates/scroll-grab.jpg';
import freezeWalkImg from '@/assets/templates/freeze-walk.jpg';
import realityRipImg from '@/assets/templates/reality-rip.jpg';
import aspectEscapeImg from '@/assets/templates/aspect-escape.jpg';

// Map breakout template IDs to their start images - Premium effects row
const BREAKOUT_START_IMAGES: Record<string, string> = {
  'post-escape': postEscapeImg,
  'scroll-grab': scrollGrabImg,
  'freeze-walk': freezeWalkImg,
  'reality-rip': realityRipImg,
  'aspect-escape': aspectEscapeImg,
};
// Environment DNA structure matching Environments page
interface EnvironmentDNA {
  id: string;
  name: string;
  description: string;
  category: 'interior' | 'exterior';
  lighting: {
    type: string;
    direction: string;
    intensity: string;
    temperature: string;
    timeOfDay: string;
  };
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    shadows: string;
  };
  mood: string;
}

// Full environment presets - MUST match IDs from Environments.tsx exactly
const ENVIRONMENT_PRESETS: EnvironmentDNA[] = [
  // TRENDING - from Environments.tsx
  {
    id: 'golden_hour_magic',
    name: 'Golden Hour Magic',
    description: 'That perfect 30-minute window of warm, dreamy sunlight everyone chases',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'backlit', intensity: 'soft', temperature: 'warm', timeOfDay: 'golden_hour' },
    colorPalette: { primary: '#FFB347', secondary: '#FFCC80', accent: '#FF8C00', shadows: '#8B4513' },
    mood: 'dreamy',
  },
  {
    id: 'neon_nights',
    name: 'Neon Nights',
    description: 'Electric city lights, rain-slicked streets, cyberpunk energy',
    category: 'exterior',
    lighting: { type: 'artificial', direction: 'multi', intensity: 'vibrant', temperature: 'cool', timeOfDay: 'night' },
    colorPalette: { primary: '#FF1493', secondary: '#00FFFF', accent: '#9400D3', shadows: '#0D0D1A' },
    mood: 'electric',
  },
  {
    id: 'cozy_cabin',
    name: 'Cozy Cabin',
    description: 'Warm firelight, wooden textures, hygge vibes for storytelling',
    category: 'interior',
    lighting: { type: 'fire', direction: 'ambient', intensity: 'low', temperature: 'very_warm', timeOfDay: 'evening' },
    colorPalette: { primary: '#8B4513', secondary: '#D2691E', accent: '#FFD700', shadows: '#3D1F0F' },
    mood: 'intimate',
  },
  {
    id: 'desert_dunes',
    name: 'Desert Dunes',
    description: 'Endless golden sand waves under blazing sun, epic Sahara vibes',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'overhead', intensity: 'harsh', temperature: 'warm', timeOfDay: 'sunset' },
    colorPalette: { primary: '#C2B280', secondary: '#DEB887', accent: '#CD853F', shadows: '#8B7355' },
    mood: 'epic',
  },
  {
    id: 'volcanic_drama',
    name: 'Volcanic Drama',
    description: 'Molten lava rivers, apocalyptic skies, raw elemental power',
    category: 'exterior',
    lighting: { type: 'fire', direction: 'below', intensity: 'harsh', temperature: 'very_warm', timeOfDay: 'night' },
    colorPalette: { primary: '#8B0000', secondary: '#FF4500', accent: '#FFD700', shadows: '#1A0000' },
    mood: 'intense',
  },
  {
    id: 'cherry_blossom',
    name: 'Cherry Blossom',
    description: 'Soft pink petals, koi pond, serene Japanese spring garden',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'filtered', intensity: 'soft', temperature: 'warm', timeOfDay: 'afternoon' },
    colorPalette: { primary: '#FFB7C5', secondary: '#FFC0CB', accent: '#8B4513', shadows: '#DB7093' },
    mood: 'romantic',
  },
  {
    id: 'underwater_dreams',
    name: 'Underwater Dreams',
    description: 'Bioluminescent deep sea, coral reefs, aquatic mystery',
    category: 'exterior',
    lighting: { type: 'filtered', direction: 'overhead', intensity: 'dappled', temperature: 'cool', timeOfDay: 'midday' },
    colorPalette: { primary: '#006994', secondary: '#00CED1', accent: '#00FF7F', shadows: '#00008B' },
    mood: 'mysterious',
  },
  {
    id: 'space_station',
    name: 'Space Station',
    description: 'Futuristic orbital hub with Earth views, sci-fi minimalism',
    category: 'interior',
    lighting: { type: 'artificial', direction: 'ambient', intensity: 'soft', temperature: 'cool', timeOfDay: 'space' },
    colorPalette: { primary: '#E8E8E8', secondary: '#B0C4DE', accent: '#4169E1', shadows: '#2F4F4F' },
    mood: 'futuristic',
  },
  {
    id: 'enchanted_forest',
    name: 'Enchanted Forest',
    description: 'Glowing mushrooms, fireflies, mystical fairy tale woodland',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'scattered', intensity: 'dappled', temperature: 'cool', timeOfDay: 'twilight' },
    colorPalette: { primary: '#228B22', secondary: '#32CD32', accent: '#FFD700', shadows: '#013220' },
    mood: 'magical',
  },
  {
    id: 'urban_luxury',
    name: 'Urban Luxury',
    description: 'Penthouse infinity pool, city skyline at twilight, glamour',
    category: 'interior',
    lighting: { type: 'mixed', direction: 'ambient', intensity: 'soft', temperature: 'warm', timeOfDay: 'blue_hour' },
    colorPalette: { primary: '#1A1A1A', secondary: '#333333', accent: '#9370DB', shadows: '#0D0D0D' },
    mood: 'luxurious',
  },
  // MORE ENVIRONMENTS
  {
    id: 'arctic_aurora',
    name: 'Arctic Aurora',
    description: 'Northern lights dancing over frozen tundra, cosmic wonder',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'overhead', intensity: 'ethereal', temperature: 'very_cool', timeOfDay: 'night' },
    colorPalette: { primary: '#00FF00', secondary: '#9400D3', accent: '#E8F4F8', shadows: '#191970' },
    mood: 'ethereal',
  },
  {
    id: 'retro_arcade',
    name: 'Retro Arcade',
    description: '80s synthwave nostalgia, neon machines, checkered floors',
    category: 'interior',
    lighting: { type: 'artificial', direction: 'multi', intensity: 'vibrant', temperature: 'cool', timeOfDay: 'night' },
    colorPalette: { primary: '#FF1493', secondary: '#00CED1', accent: '#FFD700', shadows: '#1A1A2E' },
    mood: 'nostalgic',
  },
  {
    id: 'ancient_ruins',
    name: 'Ancient Ruins',
    description: 'Greek temple at sunset, ivy-covered marble, timeless history',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'low_angle', intensity: 'warm', temperature: 'warm', timeOfDay: 'golden_hour' },
    colorPalette: { primary: '#D4A574', secondary: '#F5DEB3', accent: '#556B2F', shadows: '#8B7355' },
    mood: 'historic',
  },
  {
    id: 'tropical_paradise',
    name: 'Tropical Paradise',
    description: 'Pristine beach at sunset, palm silhouettes, vacation dreams',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'backlit', intensity: 'vibrant', temperature: 'warm', timeOfDay: 'sunset' },
    colorPalette: { primary: '#FF6B6B', secondary: '#40E0D0', accent: '#FF8C00', shadows: '#2E8B57' },
    mood: 'paradise',
  },
  {
    id: 'post_apocalyptic',
    name: 'Post-Apocalyptic',
    description: 'Overgrown abandoned city, nature reclaiming concrete, haunting beauty',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'diffused', intensity: 'moody', temperature: 'desaturated', timeOfDay: 'overcast' },
    colorPalette: { primary: '#556B2F', secondary: '#8B8378', accent: '#CD853F', shadows: '#3D3D3D' },
    mood: 'dramatic',
  },
  {
    id: 'white_studio',
    name: 'White Studio',
    description: 'Clean professional backdrop, perfect for products and talking heads',
    category: 'interior',
    lighting: { type: 'artificial', direction: 'even', intensity: 'bright', temperature: 'neutral', timeOfDay: 'controlled' },
    colorPalette: { primary: '#FFFFFF', secondary: '#F5F5F5', accent: '#333333', shadows: '#E0E0E0' },
    mood: 'professional',
  },
  {
    id: 'steampunk_lab',
    name: 'Steampunk Lab',
    description: 'Victorian brass machinery, copper pipes, industrial invention',
    category: 'interior',
    lighting: { type: 'artificial', direction: 'ambient', intensity: 'warm', temperature: 'very_warm', timeOfDay: 'evening' },
    colorPalette: { primary: '#B8860B', secondary: '#CD7F32', accent: '#FFD700', shadows: '#3D2914' },
    mood: 'inventive',
  },
  {
    id: 'cloud_nine',
    name: 'Cloud Nine',
    description: 'Heavenly cloudscape, golden rays, ethereal ascension',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'backlit', intensity: 'glowing', temperature: 'warm', timeOfDay: 'golden_hour' },
    colorPalette: { primary: '#FFFAF0', secondary: '#FFD700', accent: '#87CEEB', shadows: '#D3D3D3' },
    mood: 'divine',
  },
  {
    id: 'zen_garden',
    name: 'Zen Garden',
    description: 'Raked sand patterns, bamboo, misty morning meditation',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'diffused', intensity: 'soft', temperature: 'neutral', timeOfDay: 'dawn' },
    colorPalette: { primary: '#90EE90', secondary: '#F5F5DC', accent: '#228B22', shadows: '#696969' },
    mood: 'peaceful',
  },
  {
    id: 'mountain_summit',
    name: 'Mountain Summit',
    description: 'Epic peak above clouds at sunrise, achievement and adventure',
    category: 'exterior',
    lighting: { type: 'natural', direction: 'low_angle', intensity: 'dramatic', temperature: 'warm', timeOfDay: 'dawn' },
    colorPalette: { primary: '#4682B4', secondary: '#FFD700', accent: '#FF6347', shadows: '#2F4F4F' },
    mood: 'epic',
  },
];

// Featured templates (built-in since no DB templates exist yet)
interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  mood: string;
  clipCount: number;
  targetDurationMinutes: number;
  colorGrading: string;
  environmentId?: string;
  conceptPrompt: string;
  isBreakout?: boolean; // For platform breakout templates that use special start images
  startImageUrl?: string; // Pre-configured start image for video generation
}

const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  // Quick Start Templates (matched to sidebar)
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Hollywood-quality filmmaking with dramatic lighting and emotional storytelling',
    category: 'cinematic',
    genre: 'cinematic',
    mood: 'epic',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'cinematic',
    environmentId: 'golden_hour_magic',
    conceptPrompt: 'A cinematic masterpiece with Hollywood-quality visuals. Open with a sweeping establishing shot that sets the mood. Build atmosphere through carefully composed frames with dramatic lighting. Capture emotion through intimate character moments. Create tension with purposeful pacing and visual storytelling. End with a powerful, memorable final image.',
  },
  {
    id: 'commercial',
    name: 'Commercial',
    description: 'Professional advertising content with premium visuals and brand impact',
    category: 'commercial',
    genre: 'ad',
    mood: 'uplifting',
    clipCount: 5,
    targetDurationMinutes: 1,
    colorGrading: 'neutral',
    environmentId: 'white_studio',
    conceptPrompt: 'A premium commercial that captures attention and drives action. Open with a hook that stops the scroll. Showcase the product or service with stunning visuals and dynamic motion. Highlight key benefits through clear, engaging storytelling. Build desire with lifestyle imagery. End with a strong call-to-action and brand moment.',
  },
  {
    id: 'explainer',
    name: 'Explainer',
    description: 'Clear, engaging content that makes complex topics simple to understand',
    category: 'educational',
    genre: 'explainer',
    mood: 'uplifting',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'neutral',
    environmentId: 'white_studio',
    conceptPrompt: 'An engaging explainer video that simplifies the complex. Open with a relatable problem or question that hooks viewers. Break down concepts step-by-step using clear visuals and metaphors. Build understanding progressively from basics to key insights. Reinforce learning with practical examples. End with a clear summary and next steps.',
  },
  // Featured Templates
  {
    id: 'featured-1',
    name: 'Cinematic Product Reveal',
    description: 'Stunning product showcase with dramatic lighting and slow-motion reveals',
    category: 'commercial',
    genre: 'ad',
    mood: 'epic',
    clipCount: 8,
    targetDurationMinutes: 2,
    colorGrading: 'cinematic',
    environmentId: 'white_studio',
    conceptPrompt: 'A stunning product reveal with dramatic cinematic flair. Open with abstract close-ups in shadow, light catching edges and textures. Slow-motion reveals showcase premium craftsmanship. Build anticipation with quick cuts of intricate details. Climax with the full product bathed in spotlight, rotating elegantly. End with the brand moment.',
  },
  {
    id: 'featured-2',
    name: 'Documentary Story',
    description: 'Authentic storytelling with intimate interviews and cinematic B-roll',
    category: 'cinematic',
    genre: 'documentary',
    mood: 'emotional',
    clipCount: 12,
    targetDurationMinutes: 5,
    colorGrading: 'documentary',
    environmentId: 'golden_hour_magic',
    conceptPrompt: 'An intimate documentary exploring a compelling human story. Open with atmospheric establishing shots. Weave between candid interview moments and evocative B-roll. Show the journey through struggle and perseverance. Capture authentic emotions and pivotal moments. End with reflection, growth, and hope.',
  },
  {
    id: 'featured-3',
    name: 'Viral Social Content',
    description: 'Hook-driven content engineered for maximum engagement on TikTok & Reels',
    category: 'entertainment',
    genre: 'vlog',
    mood: 'uplifting',
    clipCount: 5,
    targetDurationMinutes: 1,
    colorGrading: 'warm',
    conceptPrompt: 'Explosive social content designed to stop the scroll. Hook viewers instantly with something unexpected. Rapid-fire cuts with dynamic energy and bold visuals. Build momentum with escalating surprises. Deliver a satisfying payoff that demands replay and sharing.',
  },
  {
    id: 'template-edu-1',
    name: 'Educational Breakdown',
    description: 'Visual explainers that make complex topics simple and engaging',
    category: 'educational',
    genre: 'educational',
    mood: 'uplifting',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'neutral',
    environmentId: 'white_studio',
    conceptPrompt: 'An engaging educational explainer that simplifies complexity. Hook with a relatable problem or question. Break down concepts using visual metaphors and demonstrations. Progress from foundational ideas to deeper insights. Reinforce learning with clear examples. End with actionable takeaways.',
  },
  {
    id: 'template-story-1',
    name: 'Short Film',
    description: 'Narrative-driven cinema with emotional arcs and compelling characters',
    category: 'cinematic',
    genre: 'storytelling',
    mood: 'emotional',
    clipCount: 10,
    targetDurationMinutes: 4,
    colorGrading: 'cinematic',
    environmentId: 'golden_hour_magic',
    conceptPrompt: 'A cinematic short film with emotional depth. Establish the world and introduce a compelling protagonist. Present a challenge that tests their character. Build tension through obstacles and meaningful choices. Reach an emotionally charged climax. Resolve with transformation and resonance.',
  },
  {
    id: 'template-noir-1',
    name: 'Neo-Noir Thriller',
    description: 'Moody atmospherics with neon-lit shadows and tension-building sequences',
    category: 'cinematic',
    genre: 'cinematic',
    mood: 'mysterious',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'noir',
    environmentId: 'neon_nights',
    conceptPrompt: 'A neo-noir thriller dripping with atmosphere. Open on a solitary figure in neon-lit shadows. Reveal mystery through cryptic encounters and surveillance angles. Build paranoia with reflections and obscured faces. Maintain tension between predator and prey. End on an ambiguous, morally complex note.',
  },
  {
    id: 'template-action-1',
    name: 'Action Montage',
    description: 'High-octane sequences with dynamic movement and adrenaline-pumping cuts',
    category: 'cinematic',
    genre: 'cinematic',
    mood: 'action',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'cinematic',
    environmentId: 'neon_nights',
    conceptPrompt: 'An adrenaline-fueled action montage with relentless energy. Start with tension before eruption. Explode into motion with rapid cuts and dynamic camera work. Alternate between wide action shots and intense close-ups. Escalate through obstacles and confrontations. Climax with a spectacular finale.',
  },
  {
    id: 'template-corp-1',
    name: 'Brand Story',
    description: 'Premium corporate narratives that humanize your brand identity',
    category: 'corporate',
    genre: 'ad',
    mood: 'uplifting',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'neutral',
    environmentId: 'white_studio',
    conceptPrompt: 'A premium brand story that connects on a human level. Open with aspirational imagery of innovation and excellence. Introduce the brand mission through purposeful visuals. Showcase team collaboration and real impact. Highlight achievements with authentic moments. Close with a confident vision for the future.',
  },
  {
    id: 'template-travel-1',
    name: 'Travel Vlog',
    description: 'Wanderlust-inducing journeys with stunning landscapes and authentic moments',
    category: 'entertainment',
    genre: 'vlog',
    mood: 'uplifting',
    clipCount: 8,
    targetDurationMinutes: 3,
    colorGrading: 'warm',
    environmentId: 'mountain_summit',
    conceptPrompt: 'An immersive travel experience that ignites wanderlust. Open with breathtaking aerial landscapes. Journey through iconic locations and hidden gems. Capture authentic local encounters and cultural moments. Balance sweeping vistas with intimate details. End with a sunset reflection on the adventure.',
  },
  {
    id: 'template-music-1',
    name: 'Music Video',
    description: 'Rhythm-synced visuals with artistic flair and bold creative direction',
    category: 'entertainment',
    genre: 'cinematic',
    mood: 'epic',
    clipCount: 10,
    targetDurationMinutes: 4,
    colorGrading: 'cinematic',
    environmentId: 'neon_nights',
    conceptPrompt: 'A visually stunning music video with bold artistic direction. Open with an arresting visual hook. Sync movements and cuts to the rhythm. Build through escalating visual intensity. Feature striking compositions and lighting contrasts. Climax with the most powerful visual moment. End with a memorable final frame.',
  },
  {
    id: 'template-food-1',
    name: 'Food & Lifestyle',
    description: 'Appetizing food cinematography with warm, inviting aesthetics',
    category: 'commercial',
    genre: 'ad',
    mood: 'uplifting',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'warm',
    environmentId: 'golden_hour_magic',
    conceptPrompt: 'Mouthwatering food cinematography that awakens the senses. Open with steam rising in warm light. Showcase ingredients in their natural beauty. Capture the artistry of preparation with close-ups. Build anticipation with sizzling textures and vibrant colors. Climax with the final plated masterpiece. End with the first satisfying bite.',
  },
  {
    id: 'template-tech-1',
    name: 'Tech Showcase',
    description: 'Sleek product demos with futuristic visuals and clean transitions',
    category: 'commercial',
    genre: 'ad',
    mood: 'epic',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'cool',
    environmentId: 'white_studio',
    conceptPrompt: 'A sleek tech showcase with futuristic aesthetics. Open with the device emerging from darkness. Highlight innovation through abstract light trails and reflections. Demonstrate features with clean, purposeful motion graphics. Show the product in lifestyle contexts. Build to a reveal of the complete ecosystem. End with the brand signature.',
  },
  // Trending Templates
  {
    id: 'viral-hook',
    name: 'Viral Hook Opener',
    description: 'Stop-the-scroll hooks that capture attention instantly',
    category: 'entertainment',
    genre: 'vlog',
    mood: 'action',
    clipCount: 4,
    targetDurationMinutes: 1,
    colorGrading: 'cinematic',
    conceptPrompt: 'An explosive viral hook that stops the scroll in 0.5 seconds. Open with something completely unexpected - a shocking reveal, an impossible moment, or an irresistible question. Build rapid momentum with quick cuts and escalating energy. Create a pattern interrupt that demands attention. Deliver a satisfying payoff that makes viewers want to share.',
  },
  {
    id: 'aesthetic-vlog',
    name: 'Aesthetic Day-in-Life',
    description: 'Dreamy, soft-lit vlogs with cozy aesthetic vibes',
    category: 'entertainment',
    genre: 'vlog',
    mood: 'peaceful',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'warm',
    environmentId: 'golden_hour_magic',
    conceptPrompt: 'A dreamy aesthetic vlog that captures the poetry of everyday moments. Open with soft morning light filtering through curtains. Flow through cozy rituals - coffee brewing, journaling, self-care moments. Use slow, intentional movements and warm color grading. Create ASMR-like atmosphere with ambient sounds. End with golden hour serenity.',
  },
  {
    id: 'transformation',
    name: 'Glow-Up Transformation',
    description: 'Dramatic before/after reveals with cinematic transitions',
    category: 'entertainment',
    genre: 'vlog',
    mood: 'uplifting',
    clipCount: 5,
    targetDurationMinutes: 1,
    colorGrading: 'cinematic',
    conceptPrompt: 'A stunning transformation reveal that builds anticipation. Open with the "before" state in raw, authentic lighting. Build tension with preparation montage and hints of change. Use dramatic transitions - spins, camera whips, or creative reveals. Climax with the jaw-dropping transformation in glamorous lighting. End with confident, empowered energy.',
  },
  {
    id: 'asmr-satisfying',
    name: 'Satisfying ASMR',
    description: 'Oddly satisfying visuals with calming sequences',
    category: 'entertainment',
    genre: 'ad',
    mood: 'peaceful',
    clipCount: 6,
    targetDurationMinutes: 1,
    colorGrading: 'neutral',
    conceptPrompt: 'Hypnotically satisfying content that triggers relaxation and wonder. Focus on perfect textures, smooth movements, and symmetrical compositions. Capture crisp ASMR moments - cutting, pouring, folding, organizing. Use macro close-ups and slow motion for maximum impact. Create a meditative rhythm that viewers watch on repeat.',
  },
  {
    id: 'storytime',
    name: 'Storytime Drama',
    description: 'Captivating personal stories with dramatic reveals',
    category: 'entertainment',
    genre: 'storytelling',
    mood: 'emotional',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'cinematic',
    conceptPrompt: 'A gripping storytime that hooks viewers from the first second. Open with a tantalizing teaser of the climax. Build the narrative with dramatic pauses and emotional beats. Use visual recreations and atmospheric B-roll. Create suspense with strategic reveals and plot twists. End with a powerful conclusion that resonates.',
  },
  {
    id: 'anime-style',
    name: 'Anime-Inspired',
    description: 'Dynamic anime-style cuts with bold energy',
    category: 'cinematic',
    genre: 'cinematic',
    mood: 'epic',
    clipCount: 8,
    targetDurationMinutes: 2,
    colorGrading: 'cinematic',
    environmentId: 'neon_nights',
    conceptPrompt: 'An anime-inspired sequence with explosive visual energy. Open with a dramatic establishing shot and bold typography. Use dynamic camera movements - speed lines, impact frames, and dramatic zooms. Create intense action moments with quick cuts and freeze frames. Build to an epic climax with sakuga-style animation energy. End with a powerful pose or symbolic shot.',
  },
  {
    id: 'ugc-testimonial',
    name: 'UGC Testimonial',
    description: 'Authentic user-generated style testimonials',
    category: 'commercial',
    genre: 'ad',
    mood: 'uplifting',
    clipCount: 4,
    targetDurationMinutes: 1,
    colorGrading: 'neutral',
    conceptPrompt: 'An authentic UGC-style testimonial that feels real and relatable. Open with a casual, phone-filmed aesthetic. Share genuine enthusiasm with natural speech patterns. Show the product in real-life use with unstaged moments. Build credibility with specific benefits and personal experience. End with an authentic recommendation that converts.',
  },
  {
    id: 'how-to-tutorial',
    name: 'Step-by-Step Tutorial',
    description: 'Clear, engaging how-to guides with visual steps',
    category: 'educational',
    genre: 'educational',
    mood: 'uplifting',
    clipCount: 6,
    targetDurationMinutes: 3,
    colorGrading: 'neutral',
    environmentId: 'white_studio',
    conceptPrompt: 'A clear, engaging tutorial that makes learning easy. Open with the end result to show what viewers will achieve. Break down each step with clean visuals and on-screen text. Use close-ups to highlight important details. Add helpful tips and common mistakes to avoid. End with the completed result and encouragement to try.',
  },
  {
    id: 'podcast-clips',
    name: 'Podcast Clips',
    description: 'Engaging podcast highlights with captions',
    category: 'entertainment',
    genre: 'educational',
    mood: 'uplifting',
    clipCount: 3,
    targetDurationMinutes: 1,
    colorGrading: 'neutral',
    conceptPrompt: 'An engaging podcast clip optimized for social sharing. Open with a compelling sound bite that hooks attention. Feature dynamic waveform visuals or speaker footage. Use bold, animated captions that emphasize key moments. Build to the most quotable insight. End with a teaser for the full episode.',
  },
  {
    id: 'team-intro',
    name: 'Team Introduction',
    description: 'Professional team showcases with personality',
    category: 'corporate',
    genre: 'corporate',
    mood: 'uplifting',
    clipCount: 6,
    targetDurationMinutes: 2,
    colorGrading: 'neutral',
    environmentId: 'modern_minimalist',
    conceptPrompt: 'A warm team introduction that humanizes your brand. Open with a dynamic montage of the team in action. Feature individual spotlights with names and roles. Capture authentic moments of collaboration and personality. Show the workspace and company culture. End with the full team together, projecting unity and expertise.',
  },
  // 🔥 PREMIUM BREAKOUT EFFECTS ROW - Maximum Sales Impact Templates
  // These 5 templates are the first row shown to users. Each creates a stunning
  // 3-clip narrative where the avatar breaks the fourth wall in creative ways.
  // Users provide DIALOGUE only - scene structure is auto-generated by hollywood-pipeline.
  {
    id: 'post-escape',
    name: 'Post Escape',
    description: 'Avatar trapped in a social post, presses against the glass, then SMASHES through into reality',
    category: 'trending',
    genre: 'ad',
    mood: 'epic',
    clipCount: 3,
    targetDurationMinutes: 1,
    colorGrading: 'cinematic',
    isBreakout: true,
    startImageUrl: postEscapeImg,
    conceptPrompt: '', // User provides dialogue only
  },
  {
    id: 'scroll-grab',
    name: 'Scroll Grab',
    description: 'Avatar reaches OUT of vertical video and grabs the screen edge to pull themselves through',
    category: 'trending',
    genre: 'ad',
    mood: 'action',
    clipCount: 3,
    targetDurationMinutes: 1,
    colorGrading: 'cinematic',
    isBreakout: true,
    startImageUrl: scrollGrabImg,
    conceptPrompt: '', // User provides dialogue only
  },
  {
    id: 'freeze-walk',
    name: 'Freeze & Walk',
    description: 'Avatar freezes in a video call while others keep moving, then steps OUT of their box into 3D space',
    category: 'trending',
    genre: 'ad',
    mood: 'mysterious',
    clipCount: 3,
    targetDurationMinutes: 1,
    colorGrading: 'cinematic',
    isBreakout: true,
    startImageUrl: freezeWalkImg,
    conceptPrompt: '', // User provides dialogue only
  },
  {
    id: 'reality-rip',
    name: 'Reality Rip',
    description: 'Reality TEARS like fabric, avatar silhouette emerges through the glowing rip with power',
    category: 'trending',
    genre: 'ad',
    mood: 'epic',
    clipCount: 3,
    targetDurationMinutes: 1,
    colorGrading: 'cinematic',
    isBreakout: true,
    startImageUrl: realityRipImg,
    conceptPrompt: '', // User provides dialogue only
  },
  {
    id: 'aspect-escape',
    name: 'Aspect Ratio Escape',
    description: 'Avatar STEPS ACROSS the boundary between vertical and horizontal video formats',
    category: 'trending',
    genre: 'ad',
    mood: 'action',
    clipCount: 3,
    targetDurationMinutes: 1,
    colorGrading: 'cinematic',
    isBreakout: true,
    startImageUrl: aspectEscapeImg,
    conceptPrompt: '', // User provides dialogue only
  },
];

// Convert environment DNA to a comprehensive prompt string
function environmentToPrompt(env: EnvironmentDNA): string {
  const lightingDesc = [
    env.lighting.type === 'natural' ? 'natural lighting' : `${env.lighting.type} lighting`,
    `${env.lighting.intensity} intensity`,
    `${env.lighting.direction} direction`,
    `${env.lighting.temperature} color temperature`,
    env.lighting.timeOfDay === 'golden_hour' ? 'golden hour' : env.lighting.timeOfDay,
  ].join(', ');

  return `${env.description}. ${lightingDesc}. ${env.mood} mood and atmosphere. ${env.category} setting.`;
}

// Shot sequence item from rich templates
export interface TemplateShotSequence {
  index: number;
  title: string;
  description: string;
  durationSeconds: number;
  sceneType: string;
  cameraScale: string;
  cameraAngle: string;
  movementType: string;
  mood: string;
  dialogue?: string;
}

// Style anchor from rich templates
export interface TemplateStyleAnchor {
  visualStyle: string;
  colorGrading: string;
  lightingStyle: string;
  cameraPhilosophy: string;
  pacingNotes: string;
}

// Character template from rich templates
export interface TemplateCharacter {
  name: string;
  role: string;
  appearance: string;
  personality: string;
  voiceStyle?: string;
}

// Environment lock from rich templates
export interface TemplateEnvironmentLock {
  lighting: string;
  colorPalette: string;
  timeOfDay: string;
  weather: string;
  location: string;
  prompt: string;
}

export interface AppliedSettings {
  concept: string;
  mood: string;
  genre: string;
  clipCount: number;
  colorGrading: string;
  environmentPrompt: string;
  templateName?: string;
  environmentName?: string;
  // Rich template data
  shotSequence?: TemplateShotSequence[];
  styleAnchor?: TemplateStyleAnchor;
  characterTemplates?: TemplateCharacter[];
  environmentLock?: TemplateEnvironmentLock;
  pacingStyle?: string;
  // Breakout template specific
  isBreakout?: boolean;
  startImageUrl?: string; // Template start image for first clip
  breakoutPlatform?: 'post-escape' | 'scroll-grab' | 'freeze-walk' | 'reality-rip' | 'aspect-escape';
}

export function useTemplateEnvironment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [appliedSettings, setAppliedSettings] = useState<AppliedSettings | null>(null);
  
  const templateId = searchParams.get('template');
  const environmentId = searchParams.get('environment');

  // Load template from DB or built-in templates
  const loadTemplate = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      // First check built-in templates
      const builtIn = BUILT_IN_TEMPLATES.find(t => t.id === id);
      if (builtIn) {
        let envPrompt = '';
        let envName = '';
        
        if (builtIn.environmentId) {
          const env = ENVIRONMENT_PRESETS.find(e => e.id === builtIn.environmentId);
          if (env) {
            envPrompt = environmentToPrompt(env);
            envName = env.name;
          }
        }
        
        // Determine breakout effect type from template ID
        let breakoutPlatform: 'post-escape' | 'scroll-grab' | 'freeze-walk' | 'reality-rip' | 'aspect-escape' | undefined;
        if (builtIn.isBreakout) {
          // New premium breakout effects
          if (builtIn.id === 'post-escape') breakoutPlatform = 'post-escape';
          else if (builtIn.id === 'scroll-grab') breakoutPlatform = 'scroll-grab';
          else if (builtIn.id === 'freeze-walk') breakoutPlatform = 'freeze-walk';
          else if (builtIn.id === 'reality-rip') breakoutPlatform = 'reality-rip';
          else if (builtIn.id === 'aspect-escape') breakoutPlatform = 'aspect-escape';
        }
        
        const settings: AppliedSettings = {
          concept: builtIn.conceptPrompt,
          mood: builtIn.mood,
          genre: builtIn.genre,
          clipCount: builtIn.clipCount,
          colorGrading: builtIn.colorGrading,
          environmentPrompt: envPrompt,
          templateName: builtIn.name,
          environmentName: envName || undefined,
          // Breakout-specific settings
          isBreakout: builtIn.isBreakout,
          startImageUrl: builtIn.startImageUrl,
          breakoutPlatform,
        };
        
        setAppliedSettings(settings);
        const breakoutNote = builtIn.isBreakout ? ' (Breakout mode enabled)' : '';
        toast.success(`Template "${builtIn.name}" loaded${breakoutNote}`);
        return settings;
      }

      // Try database templates
      const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        toast.error('Template not found');
        return null;
      }

      // Parse rich template data with proper type casting through unknown
      const shotSequence = Array.isArray(data.shot_sequence) 
        ? (data.shot_sequence as unknown as TemplateShotSequence[])
        : undefined;
      
      const styleAnchor = data.style_anchor && typeof data.style_anchor === 'object' && !Array.isArray(data.style_anchor)
        ? (data.style_anchor as unknown as TemplateStyleAnchor)
        : undefined;
      
      const characterTemplates = Array.isArray(data.character_templates)
        ? (data.character_templates as unknown as TemplateCharacter[])
        : undefined;
      
      let envPrompt = '';
      let environmentLock: TemplateEnvironmentLock | undefined;
      if (data.environment_lock && typeof data.environment_lock === 'object') {
        const envLock = data.environment_lock as any;
        envPrompt = envLock.prompt || '';
        environmentLock = envLock as TemplateEnvironmentLock;
      }

      // Build concept from shot sequence if available
      let conceptPrompt = data.description || '';
      if (shotSequence && shotSequence.length > 0) {
        conceptPrompt = shotSequence.map(shot => 
          `[${shot.title}] ${shot.description}`
        ).join('\n\n');
      }

      const settings: AppliedSettings = {
        concept: conceptPrompt,
        mood: data.mood || 'epic',
        genre: data.genre || 'cinematic',
        clipCount: data.clip_count || shotSequence?.length || 6,
        colorGrading: data.color_grading || styleAnchor?.colorGrading || 'cinematic',
        environmentPrompt: envPrompt,
        templateName: data.name,
        // Rich template data
        shotSequence,
        styleAnchor,
        characterTemplates,
        environmentLock,
        pacingStyle: data.pacing_style || undefined,
      };

      setAppliedSettings(settings);
      toast.success(`Template "${data.name}" loaded with ${shotSequence?.length || data.clip_count || 6} shots`);
      return settings;
    } catch (err) {
      console.error('Error loading template:', err);
      toast.error('Failed to load template');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load environment by ID
  const loadEnvironment = useCallback((id: string) => {
    const env = ENVIRONMENT_PRESETS.find(e => e.id === id);
    if (!env) {
      toast.error('Environment not found');
      return null;
    }

    const envPrompt = environmentToPrompt(env);
    
    const settings: AppliedSettings = {
      concept: '',
      mood: env.mood,
      genre: 'cinematic',
      clipCount: 6,
      colorGrading: env.mood === 'dramatic' ? 'noir' : env.mood === 'professional' ? 'neutral' : 'cinematic',
      environmentPrompt: envPrompt,
      environmentName: env.name,
    };

    setAppliedSettings(settings);
    toast.success(`Environment "${env.name}" applied`);
    return settings;
  }, []);

  // Clear query params after loading
  const clearParams = useCallback(() => {
    if (templateId || environmentId) {
      setSearchParams({}, { replace: true });
    }
  }, [templateId, environmentId, setSearchParams]);

  // Auto-load on mount if params present
  useEffect(() => {
    const loadFromParams = async () => {
      if (templateId) {
        await loadTemplate(templateId);
        clearParams();
      } else if (environmentId) {
        loadEnvironment(environmentId);
        clearParams();
      }
    };
    loadFromParams();
  }, [templateId, environmentId, loadTemplate, loadEnvironment, clearParams]);

  return {
    isLoading,
    appliedSettings,
    templateId,
    environmentId,
    loadTemplate,
    loadEnvironment,
    clearAppliedSettings: () => setAppliedSettings(null),
    getEnvironmentPresets: () => ENVIRONMENT_PRESETS,
    getBuiltInTemplates: () => BUILT_IN_TEMPLATES,
  };
}
