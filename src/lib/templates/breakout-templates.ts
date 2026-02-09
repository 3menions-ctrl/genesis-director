/**
 * Platform Breakout Template Configurations
 * 
 * These templates define the visual environment and prompts for
 * avatar "breakout" effects where characters burst through social media UIs.
 */

export interface BreakoutTemplateConfig {
  id: string;
  platform: 'facebook' | 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'linkedin';
  name: string;
  description: string;
  
  // Visual environment prompts for FLUX image generation
  environmentPrompt: string;
  
  // Animation prompts for Kling
  breakoutAnimationPrompt: string;
  
  // Platform-specific UI elements to include
  uiElements: string[];
  
  // Color palette for the platform
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  
  // Aspect ratio (vertical for TikTok/Reels, square for posts, etc.)
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  
  // Suggested clip structure
  clipStructure: {
    clipCount: number;
    clipDescriptions: string[];
  };
}

export const BREAKOUT_TEMPLATES: Record<string, BreakoutTemplateConfig> = {
  'breakout-facebook': {
    id: 'breakout-facebook',
    platform: 'facebook',
    name: 'Facebook Post Breakout',
    description: 'Avatar breaks through a Facebook post card into reality',
    environmentPrompt: `Facebook post interface environment: white card with blue header bar, 
      profile picture circle in top left, username and timestamp text, 
      Like/Comment/Share buttons at bottom, the post card is cracking and shattering 
      with glass shards flying outward, dramatic blue lighting from the breaking point,
      dark moody background behind the interface, volumetric light rays`,
    breakoutAnimationPrompt: `Character punches through glass screen, shattering the Facebook interface,
      glass shards explode outward in slow motion, dramatic entrance into reality,
      confident powerful movement, looking directly at camera after breaking through`,
    uiElements: [
      'Facebook blue header bar',
      'Profile picture circle',
      'Like button with thumb icon',
      'Comment button',
      'Share button',
      'Post card white background'
    ],
    colorPalette: {
      primary: '#1877F2', // Facebook blue
      secondary: '#FFFFFF',
      accent: '#42B72A' // Facebook green
    },
    aspectRatio: '1:1',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Avatar trapped inside Facebook post, looking at camera, beginning to push against the screen',
        'Glass cracking, hands breaking through the interface, dramatic shatter effect',
        'Avatar fully emerged, glass shards settling, direct confident eye contact with viewer'
      ]
    }
  },
  
  'breakout-youtube': {
    id: 'breakout-youtube',
    platform: 'youtube',
    name: 'YouTube Player Breakout',
    description: 'Avatar breaks through a YouTube video player into reality',
    environmentPrompt: `YouTube video player interface environment: black player frame with 
      red progress bar at bottom, play/pause button, volume slider, fullscreen icon,
      YouTube logo in bottom right, the video player is cracking and shattering
      with dramatic red and white lighting, glass shards flying outward,
      dark cinematic background, the red progress bar glowing intensely`,
    breakoutAnimationPrompt: `Character pushes through YouTube player screen from inside the video,
      red neon light bursting through cracks, glass exploding outward,
      dramatic slow motion emergence, hands gripping broken screen edges,
      powerful confident stance after breaking free`,
    uiElements: [
      'YouTube red progress bar',
      'Play/pause button',
      'Volume controls',
      'Fullscreen button',
      'YouTube logo',
      'Black video player frame'
    ],
    colorPalette: {
      primary: '#FF0000', // YouTube red
      secondary: '#282828', // YouTube dark
      accent: '#FFFFFF'
    },
    aspectRatio: '16:9',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Avatar inside video player, pressing hands against screen, red glow building',
        'Screen cracking with red light bursting through, avatar pushing forward',
        'Explosive breakout moment, glass shattering, avatar stepping into reality'
      ]
    }
  },
  
  'breakout-tiktok': {
    id: 'breakout-tiktok',
    platform: 'tiktok',
    name: 'TikTok Video Breakout',
    description: 'Avatar breaks through a TikTok video interface into reality',
    environmentPrompt: `TikTok vertical video interface environment: phone screen frame with
      right-side icons (heart, comment bubble, share arrow, spinning music disc),
      username and caption text at bottom left, the phone screen is cracking,
      neon pink and cyan lighting matching TikTok branding, glass shards flying,
      dark background with colorful light leaks, dynamic vertical composition`,
    breakoutAnimationPrompt: `Character breaks through vertical phone screen in dynamic pose,
      pink and cyan neon lights bursting through cracks, energetic movement,
      glass exploding with colorful reflections, trend-worthy dramatic entrance,
      landing in confident pose facing camera`,
    uiElements: [
      'Heart/like icon',
      'Comment bubble',
      'Share arrow',
      'Spinning music disc',
      'Username text',
      'Phone frame with notch'
    ],
    colorPalette: {
      primary: '#00F2EA', // TikTok cyan
      secondary: '#FF0050', // TikTok pink
      accent: '#FFFFFF'
    },
    aspectRatio: '9:16',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Avatar in TikTok video format, beginning to push against screen, neon glow building',
        'Screen shattering with pink and cyan light explosion, dramatic break moment',
        'Avatar bursting through in dynamic pose, landing with confident energy'
      ]
    }
  },
  
  'breakout-instagram': {
    id: 'breakout-instagram',
    platform: 'instagram',
    name: 'Instagram Post Breakout',
    description: 'Avatar breaks through an Instagram post into reality',
    environmentPrompt: `Instagram post interface environment: square post with header showing
      profile picture, username, three-dot menu, bottom row of heart, comment, 
      send, save icons, the post frame is cracking with gradient pink/purple/orange
      light bursting through matching Instagram's brand gradient, glass shards,
      dark moody background, elegant breaking effect`,
    breakoutAnimationPrompt: `Character elegantly breaks through Instagram post frame,
      gradient colored light (pink, purple, orange) bursting through cracks,
      stylish confident emergence, glass reflecting rainbow gradient,
      fashion-forward pose after breaking free, direct eye contact`,
    uiElements: [
      'Profile picture circle',
      'Username header',
      'Three-dot menu',
      'Heart icon',
      'Comment icon',
      'Share/send icon',
      'Save/bookmark icon'
    ],
    colorPalette: {
      primary: '#E1306C', // Instagram pink
      secondary: '#833AB4', // Instagram purple
      accent: '#F77737' // Instagram orange
    },
    aspectRatio: '1:1',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Avatar inside Instagram post, stylishly posed, beginning to press against frame',
        'Frame cracking with gradient light explosion, elegant breaking motion',
        'Avatar stepping through broken frame, glass settling, influencer-ready pose'
      ]
    }
  }
};

/**
 * Get the breakout template configuration by ID
 */
export function getBreakoutTemplate(templateId: string): BreakoutTemplateConfig | null {
  return BREAKOUT_TEMPLATES[templateId] || null;
}

/**
 * Check if a template ID is a breakout template
 */
export function isBreakoutTemplate(templateId: string): boolean {
  return templateId.startsWith('breakout-');
}

/**
 * Get all breakout templates as an array
 */
export function getAllBreakoutTemplates(): BreakoutTemplateConfig[] {
  return Object.values(BREAKOUT_TEMPLATES);
}

/**
 * Generate the full environment prompt for FLUX image generation
 * combining the template config with the selected avatar
 */
export function generateBreakoutEnvironmentPrompt(
  templateId: string,
  avatarDescription?: string
): string {
  const template = getBreakoutTemplate(templateId);
  if (!template) return '';
  
  const avatarPart = avatarDescription 
    ? `${avatarDescription} character` 
    : 'Stylish confident person';
  
  return `${avatarPart} trapped inside ${template.platform} interface. 
    ${template.environmentPrompt}
    Cinematic lighting, ultra high resolution, professional advertising quality,
    the character is about to break through the digital barrier into reality.`;
}

/**
 * Generate the animation prompt for Kling video generation
 */
export function generateBreakoutAnimationPrompt(
  templateId: string,
  avatarDescription?: string
): string {
  const template = getBreakoutTemplate(templateId);
  if (!template) return '';
  
  const avatarPart = avatarDescription 
    ? `${avatarDescription}` 
    : 'The character';
  
  return `${avatarPart} ${template.breakoutAnimationPrompt}
    Dramatic cinematic quality, slow motion glass shattering effect,
    professional advertising production value, impactful brand moment.`;
}
