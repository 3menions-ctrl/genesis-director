// Video generation mode types for the platform

export type VideoGenerationMode = 
  | 'text-to-video'      // Cinematic text prompts
  | 'image-to-video'     // Animate a static image
  | 'video-to-video'     // Style transfer on existing video
  | 'avatar'             // Talking head with lip sync
  | 'motion-transfer'    // Apply dance/motion to character
  | 'b-roll';            // Quick background footage

export interface VideoModeConfig {
  id: VideoGenerationMode;
  name: string;
  description: string;
  icon: string;
  requiresVideo?: boolean;
  requiresImage?: boolean;
  requiresText?: boolean;
  requiresAudio?: boolean;
  popular?: boolean;
}

export const VIDEO_MODES: VideoModeConfig[] = [
  {
    id: 'text-to-video',
    name: 'Text to Video',
    description: 'Create cinematic clips from text prompts',
    icon: 'Wand2',
    requiresText: true,
    popular: true,
  },
  {
    id: 'image-to-video',
    name: 'Image to Video',
    description: 'Animate any static image or photo',
    icon: 'Image',
    requiresImage: true,
    requiresText: true,
    popular: true,
  },
  {
    id: 'avatar',
    name: 'AI Avatar',
    description: 'Create talking head videos with lip sync',
    icon: 'User',
    requiresImage: true,
    requiresText: true,
    popular: true,
  },
  {
    id: 'video-to-video',
    name: 'Style Transfer',
    description: 'Transform video into anime, 3D, cyberpunk, etc.',
    icon: 'Palette',
    requiresVideo: true,
    requiresText: false,
    popular: true, // Featured mode - shows by default
  },
  {
    id: 'motion-transfer',
    name: 'Motion Transfer',
    description: 'Apply dance moves to any character',
    icon: 'Dices',
    requiresVideo: true,
    requiresImage: true,
  },
  {
    id: 'b-roll',
    name: 'B-Roll Generator',
    description: 'Quick background footage from prompts',
    icon: 'Film',
    requiresText: true,
  },
];

// Style presets for video-to-video - Cinema-grade advanced presets
export type VideoStylePreset = 
  | 'anime'
  | '3d-animation'
  | 'cyberpunk'
  | 'oil-painting'
  | 'watercolor'
  | 'claymation'
  | 'noir'
  | 'vintage-film'
  | 'comic-book'
  | 'fantasy'
  | 'hyperreal'
  | 'surrealist'
  | 'ukiyo-e'
  | 'art-deco'
  | 'gothic'
  | 'solarpunk'
  | 'baroque'
  | 'synthwave'
  | 'impressionist'
  | 'cel-shaded';

export interface StylePresetConfig {
  id: VideoStylePreset;
  name: string;
  description: string;
  thumbnail?: string;
  // Advanced prompt engineering for each style
  promptTemplate: string;
  negativePrompt: string;
  strength: number; // 0-1 how strongly to apply the style
  guidanceScale: number;
  colorPalette: string[];
}

export const STYLE_PRESETS: StylePresetConfig[] = [
  { 
    id: 'anime', 
    name: 'Anime Cinema', 
    description: 'Studio Ghibli meets Makoto Shinkai',
    promptTemplate: 'masterpiece anime cinematography, Studio Ghibli art direction, Makoto Shinkai lighting, cel-shaded characters with soft gradients, hand-painted background art, volumetric god rays, dynamic camera movement, sakura petals floating, ethereal atmosphere, 4K anime production quality, Hayao Miyazaki storytelling, dramatic sky gradients, detailed environmental storytelling',
    negativePrompt: 'western animation, 3D CGI, photorealistic, low quality, blurry, distorted faces, bad anatomy',
    strength: 0.75,
    guidanceScale: 8.5,
    colorPalette: ['#FF6B9D', '#7C3AED', '#3B82F6', '#10B981', '#FBBF24']
  },
  { 
    id: '3d-animation', 
    name: 'Pixar Cinematic', 
    description: 'Dreamworks meets Disney Pixar',
    promptTemplate: 'Pixar-quality 3D animation, Disney animation principles, subsurface skin scattering, ray-traced global illumination, physically-based rendering, expressive character animation, Dreamworks comedic timing, detailed texture work, cinematic depth of field, octane render quality, soft rim lighting, emotional storytelling, premium CGI production',
    negativePrompt: '2D, flat, hand-drawn, anime, low poly, uncanny valley, plastic looking, lifeless eyes',
    strength: 0.8,
    guidanceScale: 9.0,
    colorPalette: ['#FF9F43', '#EE5A24', '#7C3AED', '#00D2D3', '#FF6B9D']
  },
  { 
    id: 'cyberpunk', 
    name: 'Neon Noir', 
    description: 'Blade Runner meets Ghost in the Shell',
    promptTemplate: 'cyberpunk neon noir aesthetic, Blade Runner 2049 cinematography, rain-soaked streets reflecting neon, holographic advertisements, high-contrast chiaroscuro lighting, anamorphic lens flares, volumetric fog, dystopian megacity, chrome and glass architecture, Ghost in the Shell atmosphere, teal and orange color grade, cinematic widescreen, gritty futuristic realism',
    negativePrompt: 'daytime, natural lighting, rural, clean, utopian, vintage, pastoral, bright cheerful colors',
    strength: 0.85,
    guidanceScale: 8.0,
    colorPalette: ['#00F5FF', '#FF00FF', '#FF3366', '#00FF88', '#FFE600']
  },
  { 
    id: 'oil-painting', 
    name: 'Renaissance Master', 
    description: 'Rembrandt meets Caravaggio',
    promptTemplate: 'masterwork oil painting, Rembrandt lighting technique, Caravaggio chiaroscuro, visible impasto brushstrokes, rich venetian color palette, classical composition, baroque drama, museum-quality fine art, canvas texture visible, golden hour warmth, old master technique, sfumato blending, Renaissance perspective',
    negativePrompt: 'digital art, photography, modern, minimalist, flat colors, anime, cartoon, vector art',
    strength: 0.7,
    guidanceScale: 7.5,
    colorPalette: ['#8B4513', '#DAA520', '#2F1810', '#CD853F', '#F5DEB3']
  },
  { 
    id: 'watercolor', 
    name: 'Aquarelle Dreams', 
    description: 'Turner meets contemporary illustration',
    promptTemplate: 'ethereal watercolor painting, J.M.W. Turner atmospheric effects, wet-on-wet bleeding edges, soft color gradients, visible paper texture, spontaneous brushwork, transparent color layers, luminous washes, contemporary watercolor illustration, delicate linework, organic flowing forms, dreamy soft focus, botanical illustration quality',
    negativePrompt: 'digital sharp edges, heavy saturation, dark moody, photography, 3D, geometric, harsh lighting',
    strength: 0.65,
    guidanceScale: 7.0,
    colorPalette: ['#87CEEB', '#98FB98', '#FFB6C1', '#E6E6FA', '#FFEFD5']
  },
  { 
    id: 'claymation', 
    name: 'Stop Motion', 
    description: 'Laika Studios meets Aardman',
    promptTemplate: 'Laika Studios stop-motion quality, Aardman Animations charm, handcrafted clay textures, visible fingerprint impressions, miniature set design, practical lighting on clay, subtle motion blur between frames, Wallace and Gromit warmth, Coraline aesthetic, tactile material quality, frame-by-frame animation feel, whimsical character design',
    negativePrompt: 'smooth CGI, photorealistic, digital, 2D animation, weightless motion, perfect surfaces',
    strength: 0.75,
    guidanceScale: 8.0,
    colorPalette: ['#E8B87D', '#D4886B', '#A0522D', '#F4A460', '#8FBC8F']
  },
  { 
    id: 'noir', 
    name: 'Classic Noir', 
    description: 'Hitchcock meets Orson Welles',
    promptTemplate: 'classic film noir cinematography, high-contrast black and white, dramatic venetian blind shadows, Orson Welles deep focus, German Expressionist angles, cigarette smoke atmosphere, 1940s Hollywood glamour, chiaroscuro lighting, rain on windows, fedora silhouettes, hardboiled detective aesthetic, deep blacks and bright highlights, silver screen quality',
    negativePrompt: 'color, modern, digital, bright, cheerful, outdoor daylight, saturated, contemporary',
    strength: 0.9,
    guidanceScale: 8.5,
    colorPalette: ['#000000', '#1A1A1A', '#4A4A4A', '#8A8A8A', '#FFFFFF']
  },
  { 
    id: 'vintage-film', 
    name: '70s Cinema', 
    description: 'Kodachrome meets Super 8',
    promptTemplate: 'authentic 1970s film stock, Kodachrome color science, visible film grain and dust, light leaks and lens flares, warm nostalgic color cast, Super 8 texture, anamorphic lens characteristics, halation around highlights, faded color palette, vintage camera imperfections, golden hour warmth, New Hollywood aesthetic, analog photography feel',
    negativePrompt: 'digital, clean, modern, sharp, HDR, oversaturated, contemporary styling',
    strength: 0.7,
    guidanceScale: 7.0,
    colorPalette: ['#D4A574', '#C19A6B', '#8B7355', '#F0E68C', '#DEB887']
  },
  { 
    id: 'comic-book', 
    name: 'Graphic Novel', 
    description: 'Frank Miller meets Alex Ross',
    promptTemplate: 'Frank Miller Sin City graphic novel style, Alex Ross hyperrealistic comic art, bold Ben-Day dots, dynamic panel composition, dramatic ink shadows, four-color printing aesthetic, motion lines and speed effects, expressive exaggeration, comic book halftone patterns, splash page drama, sequential art storytelling, heavy black outlines',
    negativePrompt: 'photographic, soft, pastel, watercolor, anime, 3D CGI, subtle, muted colors',
    strength: 0.8,
    guidanceScale: 8.5,
    colorPalette: ['#FF0000', '#FFFF00', '#0000FF', '#000000', '#FFFFFF']
  },
  { 
    id: 'fantasy', 
    name: 'Epic Fantasy', 
    description: 'Frazetta meets contemporary concept art',
    promptTemplate: 'epic fantasy concept art, Frank Frazetta dynamism, magical ethereal lighting, volumetric god rays through mist, otherworldly color palette, detailed environmental storytelling, heroic proportions, mystical atmosphere, dragon-scale textures, enchanted forest depth, WETA Workshop quality, Lord of the Rings grandeur, mythological wonder',
    negativePrompt: 'modern, sci-fi, urban, photorealistic, mundane, minimalist, cartoon, chibi',
    strength: 0.75,
    guidanceScale: 8.0,
    colorPalette: ['#4B0082', '#8B008B', '#00CED1', '#FFD700', '#228B22']
  },
  { 
    id: 'hyperreal', 
    name: 'Hyperrealism', 
    description: 'Beyond photography precision',
    promptTemplate: 'hyperrealistic rendering, 8K ultra-detailed, photorealistic perfection beyond photography, microscopic skin pore detail, individual hair strand rendering, ray-traced reflections, physically accurate materials, studio photography lighting, medium format camera quality, extreme depth of field, cinematic color science',
    negativePrompt: 'stylized, cartoon, anime, painting, illustration, low resolution, blurry, artifacts',
    strength: 0.6,
    guidanceScale: 9.0,
    colorPalette: ['#2C3E50', '#3498DB', '#E74C3C', '#F39C12', '#1ABC9C']
  },
  { 
    id: 'surrealist', 
    name: 'Dalí Dreams', 
    description: 'Dalí meets Magritte surrealism',
    promptTemplate: 'Salvador Dalí surrealist painting, René Magritte impossible compositions, melting reality, dreamscape landscapes, impossible architecture, hyperreal textures in surreal contexts, symbolic imagery, subconscious visualization, metaphysical lighting, floating objects, distorted perspectives, fine art museum quality',
    negativePrompt: 'realistic, mundane, conventional, photography, normal proportions, logical',
    strength: 0.75,
    guidanceScale: 8.0,
    colorPalette: ['#DEB887', '#87CEEB', '#FFE4B5', '#4682B4', '#F4A460']
  },
  { 
    id: 'ukiyo-e', 
    name: 'Ukiyo-e', 
    description: 'Hokusai woodblock mastery',
    promptTemplate: 'traditional Japanese ukiyo-e woodblock print, Katsushika Hokusai waves, Hiroshige landscape composition, bold outline work, flat color planes, traditional Japanese color palette, wave patterns, Mount Fuji atmosphere, Edo period aesthetic, handmade paper texture, limited color registration, cultural authenticity',
    negativePrompt: 'western art, photorealistic, 3D, modern, digital effects, gradients, shadows',
    strength: 0.8,
    guidanceScale: 8.0,
    colorPalette: ['#1E3A5F', '#BC002D', '#F5F5DC', '#8B4513', '#2F4F4F']
  },
  { 
    id: 'art-deco', 
    name: 'Art Deco', 
    description: 'Gatsby era geometric glamour',
    promptTemplate: 'Art Deco geometric elegance, 1920s golden age glamour, Tamara de Lempicka portraiture, bold geometric patterns, metallic gold and silver accents, symmetrical compositions, streamlined forms, Chrysler Building aesthetic, jazz age luxury, sunburst motifs, zigzag patterns, Erté fashion illustration',
    negativePrompt: 'organic, rustic, natural, minimalist, modern, grunge, distressed',
    strength: 0.75,
    guidanceScale: 7.5,
    colorPalette: ['#FFD700', '#000000', '#C0C0C0', '#800020', '#008080']
  },
  { 
    id: 'gothic', 
    name: 'Dark Gothic', 
    description: 'Tim Burton meets Victorian horror',
    promptTemplate: 'Tim Burton gothic aesthetic, Victorian dark romanticism, elaborate gothic architecture, dramatic candlelight, fog-shrouded graveyards, ornate ironwork, dark fairy tale atmosphere, expressionist shadows, haunted mansion interiors, Edgar Allan Poe mood, ravens and dark florals, theatrical drama',
    negativePrompt: 'bright, cheerful, modern, minimalist, sunny, pastel, cartoon comedy',
    strength: 0.8,
    guidanceScale: 8.5,
    colorPalette: ['#1A0A0A', '#4A0A2A', '#2D1B2E', '#8B0000', '#C0C0C0']
  },
  { 
    id: 'solarpunk', 
    name: 'Solarpunk', 
    description: 'Utopian eco-futurism',
    promptTemplate: 'solarpunk utopian aesthetic, sustainable futurism, organic architecture with living plants, bioluminescent technology, vertical gardens on buildings, renewable energy integration, Art Nouveau nature fusion, optimistic future vision, community-focused design, natural materials and high technology harmony, golden hour lighting',
    negativePrompt: 'dystopian, dark, industrial, pollution, decay, cyberpunk grime, pessimistic',
    strength: 0.75,
    guidanceScale: 7.5,
    colorPalette: ['#228B22', '#FFD700', '#87CEEB', '#F4A460', '#98FB98']
  },
  { 
    id: 'baroque', 
    name: 'Baroque Drama', 
    description: 'Caravaggio meets Rubens',
    promptTemplate: 'Baroque master painting, Caravaggio dramatic tenebrism, Rubens dynamic compositions, rich velvet textures, dramatic diagonal compositions, theatrical lighting, opulent fabric rendering, cherubs and clouds, religious ecstasy, museum masterpiece quality, gold leaf accents, chiaroscuro mastery',
    negativePrompt: 'modern, minimalist, flat, digital, bright even lighting, simple composition',
    strength: 0.75,
    guidanceScale: 8.0,
    colorPalette: ['#8B0000', '#FFD700', '#1A0A0A', '#DEB887', '#4A0A2A']
  },
  { 
    id: 'synthwave', 
    name: 'Synthwave', 
    description: 'Retro-futuristic 80s dreams',
    promptTemplate: 'synthwave retro-futurism, 1980s neon aesthetic, chrome and grid landscapes, sunset gradient skies, outrun visual style, VHS scan lines, palm tree silhouettes, DeLorean aesthetic, laser grid horizons, hot pink and electric blue, retro computer graphics, analog synthesizer visualization',
    negativePrompt: 'realistic, natural, organic, muted colors, modern minimal, daytime',
    strength: 0.85,
    guidanceScale: 8.0,
    colorPalette: ['#FF1493', '#00CED1', '#FF6B00', '#9400D3', '#FFD700']
  },
  { 
    id: 'impressionist', 
    name: 'Impressionist', 
    description: 'Monet meets Van Gogh',
    promptTemplate: 'French Impressionist painting, Claude Monet light studies, Van Gogh expressive brushwork, visible oil paint texture, en plein air atmosphere, dappled sunlight through leaves, water lily reflections, loose gestural strokes, Renoir color warmth, fleeting moment captured, museum-quality fine art',
    negativePrompt: 'photorealistic, digital, sharp lines, dark moody, modern, geometric',
    strength: 0.7,
    guidanceScale: 7.0,
    colorPalette: ['#87CEEB', '#98FB98', '#DDA0DD', '#F0E68C', '#FFA07A']
  },
  { 
    id: 'cel-shaded', 
    name: 'Cel-Shaded', 
    description: 'Borderlands meets Spider-Verse',
    promptTemplate: 'stylized cel-shaded rendering, Spider-Verse animation quality, Borderlands thick outlines, flat color planes with sharp shadows, comic book line art, halftone dot patterns, dynamic pose exaggeration, graphic novel panel feel, bold color blocking, motion blur streaks, action lines, paper texture overlay',
    negativePrompt: 'photorealistic, soft gradients, 3D CGI smooth, realistic lighting, subtle shading',
    strength: 0.8,
    guidanceScale: 8.5,
    colorPalette: ['#FF4500', '#00BFFF', '#FFD700', '#32CD32', '#FF69B4']
  },
];

// Voice options for avatar generation
export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  style: string;
  preview?: string;
}

export const AVATAR_VOICES: VoiceOption[] = [
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', style: 'Professional narrator', preview: 'https://api.elevenlabs.io/v1/text-to-speech/onwK4e9ZLuTAKqWW03F9/stream?text=Hello' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', style: 'Warm and friendly', preview: 'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL/stream?text=Hello' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', style: 'Authoritative presenter', preview: 'https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/stream?text=Hello' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female', style: 'Youthful and energetic', preview: 'https://api.elevenlabs.io/v1/text-to-speech/XrExE9yKIg1WjnnlVkGX/stream?text=Hello' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female', style: 'Soft and calm', preview: 'https://api.elevenlabs.io/v1/text-to-speech/pFZP5JQG7iQjIQuC4Bku/stream?text=Hello' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male', style: 'Deep and resonant', preview: 'https://api.elevenlabs.io/v1/text-to-speech/nPczCjzI2devNBz1zQrb/stream?text=Hello' },
];
