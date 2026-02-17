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
  /**
   * WORLD-CLASS TEMPLATE LIBRARY v2.0
   * 
   * Every template upgraded with:
   * - DYNAMIC CAMERA MOVEMENTS (dolly, tracking, crane, orbit, steadicam)
   * - PROFESSIONAL LIGHTING (Rembrandt, chiaroscuro, three-point, practical)
   * - SHOT SIZE PROGRESSION (emotional arc through framing)
   * - MOTION DIRECTION (continuous movement, never static)
   * - VIRAL HOOKS (attention-grabbing first 0.5 seconds)
   */
  
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
    conceptPrompt: `CLIP 1: CAMERA - Sweeping CRANE DOWN from aerial establishing shot. Wide shot revealing location in GOLDEN HOUR light. Volumetric rays, atmospheric haze, DOLLY PUSH forward into scene.
CLIP 2: CAMERA - TRACKING SHOT following subject with STEADICAM fluidity. MEDIUM WIDE framing, Rembrandt lighting sculpting features. Building atmosphere, subtle motion.
CLIP 3: CAMERA - Slow DOLLY IN to MEDIUM CLOSE-UP. Intimate character moment, eyes catching light. Three-point lighting with dramatic rim separation.
CLIP 4: CAMERA - ORBIT LEFT around subject, revealing new perspective. Tension building, chiaroscuro shadows. CLOSE-UP on expressive details.
CLIP 5: CAMERA - Dynamic TRACKING with building momentum. Cross-cutting between perspectives. Peak emotional intensity, dramatic lighting shift.
CLIP 6: CAMERA - CRANE UP to powerful final frame. Hero lighting from below. Memorable closing image, subject silhouetted against dramatic sky.`,
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
    conceptPrompt: `CLIP 1: CAMERA - WHIP PAN to attention-grabbing hook. Split-second pattern interrupt. CLOSE-UP impact moment, high-key studio lighting. Stop-scroll energy.
CLIP 2: CAMERA - Smooth ORBIT around product/subject with MACRO details. Premium textures catching light. Clean white studio, soft box illumination.
CLIP 3: CAMERA - DOLLY TRACKING following dynamic movement. Lifestyle context, natural lighting blend. Subject interacting with product, authentic energy.
CLIP 4: CAMERA - PUSH-IN to benefit reveal. Split-screen or quick-cut benefits montage. Building desire, uplifting energy, bright key light.
CLIP 5: CAMERA - Hero CRANE SHOT for brand moment. Product/logo prominence with dramatic lighting. Strong CTA framing, confident final pose. Memorable brand signature.`,
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
    conceptPrompt: `CLIP 1: CAMERA - PUSH-IN on relatable problem visual. MEDIUM SHOT, clean lighting, hook question framing. Pattern interrupt that grabs attention.
CLIP 2: CAMERA - DOLLY RIGHT with step-by-step reveal. Clean transitions, visual metaphor introduction. Bright, approachable three-point lighting.
CLIP 3: CAMERA - OVERHEAD SHOT for process demonstration. Clear visual explanation, building complexity. Smooth tracking over details.
CLIP 4: CAMERA - ORBIT showcasing concept from multiple angles. Progressive understanding, "aha moment" building. Dynamic framing.
CLIP 5: CAMERA - CLOSE-UP on practical example. Real-world application, relatable context. Warm, inviting lighting.
CLIP 6: CAMERA - PULL-BACK to summary reveal. Actionable takeaway, confident conclusion. Uplifting final frame with clear next step.`,
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
    conceptPrompt: `CLIP 1: CAMERA - EXTREME CLOSE-UP in shadow, light catching edge. Dramatic chiaroscuro, mystery building. 120fps slow-motion, texture detail.
CLIP 2: CAMERA - Slow ORBIT through volumetric light. Abstract angles, premium craftsmanship revealed. Gradual illumination increase.
CLIP 3: CAMERA - MACRO DOLLY across intricate details. Surface textures, material quality. Studio lighting with accent spots.
CLIP 4: CAMERA - WHIP PAN between feature highlights. Quick cuts, building anticipation. Dynamic energy with precise timing.
CLIP 5: CAMERA - CRANE UP revealing full product. "Hero moment" lighting, 360-degree presentation beginning. Floating reveal aesthetic.
CLIP 6: CAMERA - Smooth 360 ORBIT with product rotating. Full showcase, premium positioning. Clean infinity cove background.
CLIP 7: CAMERA - LIFESTYLE TRACKING shot. Product in context, aspirational usage. Natural lighting blend with studio quality.
CLIP 8: CAMERA - Final HERO FRAME with logo. Dramatic spotlight, brand signature. Memorable closing image, desire maximized.`,
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
    conceptPrompt: `CLIP 1: CAMERA - AERIAL DRONE establishing location. Golden hour atmosphere, CRANE DOWN into scene. Atmospheric, setting tone.
CLIP 2: CAMERA - HANDHELD interview setup. Intimate MEDIUM CLOSE-UP, natural window light. Authentic eye contact, human connection.
CLIP 3: CAMERA - STEADICAM B-roll following action. Verité style, documentary authenticity. Wide to medium progression.
CLIP 4: CAMERA - CLOSE-UP on emotional detail. Hands, eyes, meaningful objects. Shallow depth creating intimacy.
CLIP 5: CAMERA - TRACKING through environment. Location context, passing by life details. Building understanding of world.
CLIP 6: CAMERA - Interview continuation, PUSH-IN for emphasis. Key revelation moment, emotional weight. Three-point with practical fill.
CLIP 7: CAMERA - MONTAGE with varied angles. Multiple perspectives, time passage. Quick cuts building narrative.
CLIP 8: CAMERA - Obstacle/challenge moment. Tension building, darker lighting. Struggle visualized authentically.
CLIP 9: CAMERA - Turning point B-roll. Hope returning, light increasing. DOLLY movement suggesting progress.
CLIP 10: CAMERA - Pivotal interview moment. CLOSE-UP on transformation realization. Emotional breakthrough, tears of growth.
CLIP 11: CAMERA - Resolution B-roll. Achievement visualized, uplifting energy. CRANE UP with subject, triumphant.
CLIP 12: CAMERA - Reflective final frame. Golden hour silhouette, peaceful resolution. Hopeful forward look, memorable close.`,
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
    conceptPrompt: `CLIP 1: CAMERA - EXPLOSIVE WHIP PAN to unexpected moment. 0.3 second pattern interrupt. EXTREME CLOSE-UP on shocking/intriguing element. Maximum scroll-stopping energy.
CLIP 2: CAMERA - HANDHELD rapid movement. Quick cuts, 1-2 seconds each. Building momentum, escalating surprise. Dynamic angles constantly shifting.
CLIP 3: CAMERA - POV shot pulling viewer in. First-person involvement, immersive energy. Unexpected angle or reveal building.
CLIP 4: CAMERA - Peak moment SLOW-MOTION. The payoff, satisfying climax. Impact frame, dramatic timing. The share-worthy moment.
CLIP 5: CAMERA - Snappy FINAL FRAME with engagement hook. Call-to-action energy, "wait for part 2" or replay incentive. Memorable signature close.`,
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
    conceptPrompt: `CLIP 1: CAMERA - PUSH-IN on hook question visual. Pattern interrupt problem statement. Clean studio lighting, focus-drawing composition.
CLIP 2: CAMERA - OVERHEAD demonstration shot. Foundation concept, visual metaphor. Clean tracking across materials.
CLIP 3: CAMERA - DOLLY RIGHT revealing step 1. Clear progression, building blocks. Bright, approachable lighting.
CLIP 4: CAMERA - ORBIT showing concept from new angle. Deeper understanding layer. Dynamic perspective shift.
CLIP 5: CAMERA - CLOSE-UP on key detail. "This is important" emphasis. Spotlight with soft fill.
CLIP 6: CAMERA - SPLIT-SCREEN comparison. Before/after or contrast reveal. Clear visual teaching moment.
CLIP 7: CAMERA - TRACKING through practical example. Real-world application, relatable context. Natural lighting feel.
CLIP 8: CAMERA - PULL-BACK to summary. Actionable takeaways, confident close. Uplifting final frame.`,
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
    conceptPrompt: `CLIP 1: CAMERA - CRANE establishing shot. World introduction, atmospheric tone-setting. Wide frame, cinematic aspect ratio feel.
CLIP 2: CAMERA - TRACKING introducing protagonist. MEDIUM SHOT, character in environment. Subtle Rembrandt lighting, depth established.
CLIP 3: CAMERA - PUSH-IN to emotional reveal. Character's goal or desire shown. Intimate framing, building connection.
CLIP 4: CAMERA - Dynamic STEADICAM following challenge. Obstacle introduced, tension building. Lighting shifts cooler/darker.
CLIP 5: CAMERA - CLOSE-UP reaction to setback. Emotional weight, character tested. Chiaroscuro shadows, internal conflict.
CLIP 6: CAMERA - MONTAGE of struggle. Multiple angles, time compression. Building momentum, visual poetry.
CLIP 7: CAMERA - Low ANGLE hero shot. Decision moment, choice being made. Dramatic underlighting, power position.
CLIP 8: CAMERA - TRACKING climactic action. Peak intensity, stakes highest. Dynamic movement matching energy.
CLIP 9: CAMERA - CLOSE-UP on resolution. Emotional payoff, transformation visible. Warm light returning, hope.
CLIP 10: CAMERA - CRANE UP to final frame. Character transformed, new equilibrium. Golden hour silhouette, memorable close.`,
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
    conceptPrompt: `CLIP 1: CAMERA - SLOW PUSH through noir shadows. Solitary figure, neon-lit silhouette. Venetian blind shadows, cigarette smoke atmosphere.
CLIP 2: CAMERA - DUTCH ANGLE on mysterious arrival. Off-kilter framing, tension immediate. Harsh contrast, deep blacks.
CLIP 3: CAMERA - TRACKING through rain-slicked streets. Reflections doubling reality. Neon reds and blues, urban noir palette.
CLIP 4: CAMERA - CLOSE-UP on cryptic exchange. Eyes in shadow, partial face reveals. Building paranoia, who to trust.
CLIP 5: CAMERA - SURVEILLANCE ANGLE from above. God's-eye suspicion view. Green-tinted, voyeuristic tension.
CLIP 6: CAMERA - WHIP PAN following pursuit. Quick movement, predator/prey dynamic. Disorienting cuts, building fear.
CLIP 7: CAMERA - CONFRONTATION low angle. Power dynamic shift, dramatic underlighting. Face half in shadow, moral ambiguity.
CLIP 8: CAMERA - PULL-BACK to ambiguous ending. Resolution unclear, noir tradition. Lone figure in neon rain, haunting close.`,
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
    conceptPrompt: `CLIP 1: CAMERA - STATIC tension building. Calm before storm, protagonist preparing. Deep focus, anticipation in stillness. Slight push.
CLIP 2: CAMERA - EXPLOSIVE ACTION initiation. Sudden WHIP PAN, movement erupts. Quick cuts 0.5-1 second each. Adrenaline immediate.
CLIP 3: CAMERA - TRACKING following chase/pursuit. STEADICAM speed, kinetic energy. Wide-medium alternation, geography clear.
CLIP 4: CAMERA - IMPACT CLOSE-UPS intercut. Punches, explosions, collision moments. Slow-motion emphasis on key hits.
CLIP 5: CAMERA - ESCALATING obstacle sequence. Bigger stakes, harder challenges. CRANE and DRONE shots for scale. Peak intensity.
CLIP 6: CAMERA - HERO LANDING final pose. SLOW-MOTION climactic moment. LOW ANGLE power shot, victory/resolution. Dust settling, breathing heavy, triumphant.`,
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
    conceptPrompt: `CLIP 1: CAMERA - AERIAL establishing innovation hub. Modern architecture, aspirational energy. CRANE DOWN into workspace.
CLIP 2: CAMERA - TRACKING through dynamic office. Team in motion, collaborative energy. Clean corporate lighting with warmth.
CLIP 3: CAMERA - DOLLY to founder/leader interview. MEDIUM CLOSE-UP, authentic connection. Soft key with practical fill.
CLIP 4: CAMERA - MONTAGE of real work moments. Candid collaboration, problem-solving energy. Multiple angles, documentary feel.
CLIP 5: CAMERA - CLOSE-UP on meaningful details. Hands working, screens showing progress. Humanity in the process.
CLIP 6: CAMERA - STEADICAM following client interaction. Real impact shown, testimonial energy. Natural lighting, authenticity.
CLIP 7: CAMERA - TEAM gathering shot. Unity, shared purpose visible. Group energy, genuine smiles. Warm practical lighting.
CLIP 8: CAMERA - HERO SHOT brand moment. Logo with team or product. Confident forward vision, inspiring close. Premium final frame.`,
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
    conceptPrompt: `CLIP 1: CAMERA - DRONE sweeping reveal. Breathtaking landscape, golden hour magic. Slow CRANE over terrain, wanderlust ignited.
CLIP 2: CAMERA - TRACKING traveler arrival. First steps into new place, wonder on face. STEADICAM following authentic reaction.
CLIP 3: CAMERA - MONTAGE of iconic locations. Quick cuts, 2-3 seconds each. Postcards coming to life, bucket list energy.
CLIP 4: CAMERA - HANDHELD local encounter. Authentic cultural moment, genuine connection. Warm natural lighting, intimate vibe.
CLIP 5: CAMERA - POV exploration shot. Walking through markets/streets/nature. Immersive viewer experience, you-are-there.
CLIP 6: CAMERA - SLOW-MOTION magical moment. Unexpected beauty, travel serendipity. Sunset/wildlife/locals laughing.
CLIP 7: CAMERA - WIDE establishing new scene. Hidden gem discovery, off-beaten-path. Dramatic landscape with tiny human scale.
CLIP 8: CAMERA - SUNSET reflection close. Traveler silhouette, grateful contemplation. Golden hour magic, peaceful conclusion. Wanderlust fulfilled.`,
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
    conceptPrompt: `CLIP 1: CAMERA - STRIKING visual hook. Bold composition, arresting first frame. Beat drop anticipation, tension building.
CLIP 2: CAMERA - SYNC cut to rhythm. Movement matching music, TRACKING with energy. Performance begins, dynamic lighting.
CLIP 3: CAMERA - CLOSE-UP performance intensity. Face, hands, expressive details. Beat-matched cuts, 0.5-1 second timing.
CLIP 4: CAMERA - WIDE choreography shot. Full movement visible, architectural framing. Neon accent lighting, club atmosphere.
CLIP 5: CAMERA - ORBIT around artist. 360 perspective, building visual intensity. Strobe effects, fog machine atmosphere.
CLIP 6: CAMERA - CREATIVE transition moment. Artistic visual effect, genre-appropriate. Slow-mo to real-time, visual surprise.
CLIP 7: CAMERA - MONTAGE escalation. Faster cuts matching song build. Multiple locations/looks, peak energy approaching.
CLIP 8: CAMERA - CLIMAX visual peak. Most striking composition, chorus energy. Maximum lighting drama, iconic frame.
CLIP 9: CAMERA - BREAKDOWN cooldown. Slower cuts, emotional moment. Intimate close-up, vulnerability shown.
CLIP 10: CAMERA - FINAL pose/frame. Memorable closer, signature moment. Artist silhouette or powerful stance. Fade or hard cut to black.`,
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
    conceptPrompt: `CLIP 1: CAMERA - CLOSE-UP steam rising. Warm backlight catching vapor, appetite trigger. 120fps slow-motion, sensory hook.
CLIP 2: CAMERA - OVERHEAD ingredient showcase. Fresh produce, vibrant colors. Slow TRACKING across tableau. Natural window light.
CLIP 3: CAMERA - TRACKING chef hands at work. Knife skills, technique beauty. Close-up cooking action, sizzle sounds implied.
CLIP 4: CAMERA - MACRO texture details. Bubbling, caramelizing, texture close-ups. Satisfying food ASMR visuals.
CLIP 5: CAMERA - ORBIT around finished dish. Final presentation, restaurant quality. SLOW DOLLY with steam, golden hour warmth.
CLIP 6: CAMERA - FIRST BITE moment. CLOSE-UP on reaction, food pulling/breaking. Satisfying climax, desire maximized. Warm glow, comfort conclusion.`,
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
    conceptPrompt: `CLIP 1: CAMERA - DARKNESS to light reveal. Device edge catching first light. SLOW PUSH-IN, dramatic emergence. Futuristic anticipation.
CLIP 2: CAMERA - ORBIT with light trails. Abstract tech aesthetic, circuit-board reflections. Cool blue accent lighting, premium feel.
CLIP 3: CAMERA - CLOSE-UP feature demonstration. Screen animations, button interactions. Clean tracking across interface. Precise, intentional movement.
CLIP 4: CAMERA - SPLIT-SCREEN capability showcase. Multiple features simultaneously. Dynamic motion graphics overlay. Innovation emphasis.
CLIP 5: CAMERA - LIFESTYLE context shot. Device in real use, aspirational user. Natural lighting blend, authentic integration.
CLIP 6: CAMERA - 360 ORBIT hero presentation. Full product glory, floating aesthetic. Brand logo integration, ecosystem hint. Futuristic conclusion, desire locked.`,
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
    conceptPrompt: `CLIP 1: CAMERA - IMPACT FRAME in 0.3 seconds. Unexpected visual/sound, pattern interrupt maximum. EXTREME CLOSE-UP on shocking element. Thumb-stopping energy.
CLIP 2: CAMERA - RAPID-FIRE progression. 1-second cuts, escalating intensity. HANDHELD energy, chaotic but controlled. Building "what happens next."
CLIP 3: CAMERA - REVEAL anticipation. Slow-motion tease, payoff approaching. Tension peaks, viewer committed. PUSH-IN to climax moment.
CLIP 4: CAMERA - SATISFYING payoff. The moment they came for. HERO SHOT of result/reveal. Loop-back hook or "follow for part 2" energy.`,
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
    conceptPrompt: `CLIP 1: CAMERA - SOFT morning light filtering. SLOW DOLLY past curtains, gentle awakening. Warm tones, dreamy atmosphere. Peaceful beginning.
CLIP 2: CAMERA - OVERHEAD coffee ritual. Steam rising, hands cradling mug. SLOW-MOTION pour, ASMR satisfaction. Cozy intimacy.
CLIP 3: CAMERA - TRACKING through golden-lit space. Journaling, self-care details. Soft focus backgrounds, intentional living aesthetic.
CLIP 4: CAMERA - CLOSE-UP meaningful moments. Textures, plants, cozy details. Natural window light, magazine-quality composition.
CLIP 5: CAMERA - STEADICAM gentle movement. Transitional moments, creative work. Peaceful productivity, aspirational routine.
CLIP 6: CAMERA - GOLDEN HOUR finale. Sunset glow, content reflection. Soft PUSH-IN to peaceful expression. Warmth and gratitude, perfect close.`,
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
    conceptPrompt: `CLIP 1: CAMERA - RAW "before" state. Harsh/flat lighting intentionally unflattering. Authentic starting point, relatable reality. MEDIUM SHOT honesty.
CLIP 2: CAMERA - TRANSFORMATION montage. Quick cuts of process, building anticipation. CLOSE-UPS on changes happening. Time-lapse energy.
CLIP 3: CAMERA - SPIN transition setup. Subject turning, camera WHIP PAN or creative wipe. Tension peak before reveal.
CLIP 4: CAMERA - GLAMOROUS "after" reveal. DRAMATIC LIGHTING shift - now Rembrandt/hero lighting. Same subject TRANSFORMED. Jaw-drop moment.
CLIP 5: CAMERA - CONFIDENT finale. Subject owning their glow-up. SLOW-MOTION celebration moment. Empowered energy, inspiring close. Share-worthy transformation.`,
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
    conceptPrompt: `CLIP 1: CAMERA - MACRO perfection shot. Symmetrical composition, perfect texture. SLOW PUSH-IN, meditative pace. Satisfying anticipation.
CLIP 2: CAMERA - OVERHEAD process shot. Cutting/pouring/organizing action. Crisp ASMR moment, 120fps slow-motion. Perfectionist pleasure.
CLIP 3: CAMERA - CLOSE-UP texture detail. Surface perfection, material beauty. Soft lighting, no harsh shadows. Hypnotic viewing.
CLIP 4: CAMERA - SMOOTH motion sequence. Folding/stacking/arranging perfection. Symmetry completion, visual order. Deep satisfaction.
CLIP 5: CAMERA - SLOW-MOTION climax. The most satisfying moment - perfect fit, clean cut, smooth pour. Peak ASMR energy.
CLIP 6: CAMERA - PULL-BACK to completed perfection. Before/after reveal of order achieved. Meditative conclusion, loop-worthy finale.`,
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
    conceptPrompt: `CLIP 1: CAMERA - TEASER of climax moment. Flash-forward hook, tension immediate. CLOSE-UP dramatic reaction. "Wait for this" energy, then rewind.
CLIP 2: CAMERA - SETUP with direct address. MEDIUM SHOT storyteller, intimate framing. Warm lighting, trust-building eye contact. Story begins.
CLIP 3: CAMERA - RECREATION B-roll. Dramatic visualization, moody lighting. Atmospheric scenes matching narration. Cinematic interpretation.
CLIP 4: CAMERA - CLOSE-UP emotional beat. Dramatic pause, building tension. Lighting shift darker/moodier. "Then..." moment.
CLIP 5: CAMERA - CLIMAX visualization. Peak drama, reveal moment. Quick cuts, dramatic lighting. The twist/resolution they came for.
CLIP 6: CAMERA - REFLECTION close. Back to direct address, processing expression. PUSH-IN for final thought. Emotional landing, share-worthy conclusion.`,
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
    conceptPrompt: `CLIP 1: CAMERA - DRAMATIC establishing with speed lines. Bold typography entrance, anime title card energy. Epic wide shot, stylized composition.
CLIP 2: CAMERA - QUICK ZOOM to character introduction. Freeze frame on pose, name card flash. Stylized portrait moment.
CLIP 3: CAMERA - SPEED LINE tracking. Dynamic movement, motion blur trails. Running/action sequence with anime physics.
CLIP 4: CAMERA - IMPACT FRAME freeze. Action peak with radial lines. 1-2 frame hold, emphasis moment. Then explosive continuation.
CLIP 5: CAMERA - 360 SAKUGA orbit. Fluid animation energy, highest quality frames. Character power-up or special moment.
CLIP 6: CAMERA - RAPID MONTAGE. 0.5 second cuts, building to climax. Speed escalation, tension maximum.
CLIP 7: CAMERA - SLOW-MOTION impact. The big hit/moment in 120fps. Debris flying, dramatic lighting. Peak anime energy.
CLIP 8: CAMERA - HERO POSE final frame. Wind in hair/cape, dramatic upshot. Sunset/dramatic sky backdrop. Iconic anime ending.`,
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
    conceptPrompt: `CLIP 1: CAMERA - PHONE-FILMED aesthetic. Slightly imperfect framing, authentic feel. Direct address, genuine energy. "Hey, I need to tell you about..."
CLIP 2: CAMERA - HANDHELD product in use. Real environment, not studio. Natural lighting, unstaged moments. Authentic demonstration.
CLIP 3: CAMERA - CLOSE-UP genuine reaction. Enthusiasm not scripted, real emotion. Eye contact with camera, building trust. Specific benefit mentioned.
CLIP 4: CAMERA - DIRECT recommendation close. Confident endorsement, authentic conviction. "You need to try this" energy. Natural CTA, conversion moment.`,
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
    conceptPrompt: `CLIP 1: CAMERA - RESULT preview hook. Finished outcome shown first. "Here's what you'll make" - PUSH-IN on impressive result.
CLIP 2: CAMERA - OVERHEAD step 1. Clear demonstration, hands visible. Clean tracking, step text overlay zone. Bright, shadowless lighting.
CLIP 3: CAMERA - ANGLE SHIFT step 2. Different perspective for clarity. DOLLY movement showing progress. Key detail CLOSE-UP.
CLIP 4: CAMERA - COMMON MISTAKE callout. "Don't do this" moment. Helpful prevention, trust building. Quick comparison cut.
CLIP 5: CAMERA - FINAL STEPS acceleration. Building to completion, momentum. Quicker cuts, progress satisfying.
CLIP 6: CAMERA - REVEAL completed result. Ta-da moment, pride energy. ORBIT around finished work. Encouraging close, viewer can do this.`,
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
    conceptPrompt: `CLIP 1: CAMERA - HOOK sound bite moment. Most quotable 3-5 seconds first. Bold caption emphasis, attention immediate. PUSH-IN to speaker.
CLIP 2: CAMERA - CONTEXT building. Setup for the insight, speaker engaged. Dynamic waveform or speaker footage. Caption highlighting key words.
CLIP 3: CAMERA - PAYOFF insight delivery. The wisdom they came for. CLOSE-UP on speaker conviction. "Full episode" tease, follow CTA.`,
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
    conceptPrompt: `CLIP 1: CAMERA - DYNAMIC team action montage. Multiple angles, energy and collaboration. TRACKING through workspace, life in motion.
CLIP 2: CAMERA - INDIVIDUAL spotlights. MEDIUM CLOSE-UP each person, name/role card. Consistent framing, personality showing. Warm key light.
CLIP 3: CAMERA - CANDID collaboration moments. Unposed interaction, genuine teamwork. HANDHELD authenticity, documentary feel.
CLIP 4: CAMERA - WORKSPACE reveal. DOLLY through environment, culture visible. Details that show personality. Natural lighting blend.
CLIP 5: CAMERA - FUN MOMENT together. Genuine laughter, team chemistry. Builds humanity and approachability.
CLIP 6: CAMERA - GROUP hero shot. Full team together, unified energy. Professional composition, confident stance. Brand values embodied, memorable close.`,
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
        .maybeSingle();

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
