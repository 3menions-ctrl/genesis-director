/**
 * Premium Breakout Effect Template Configurations
 * 
 * These templates define 5 high-impact visual effects where avatars
 * break through barriers/formats into reality - maximum sales impact.
 */

export type BreakoutEffectType = 
  | 'post-escape' 
  | 'scroll-grab' 
  | 'freeze-walk' 
  | 'reality-rip' 
  | 'aspect-escape';

export interface BreakoutTemplateConfig {
  id: string;
  effectType: BreakoutEffectType;
  name: string;
  description: string;
  
  // Visual environment prompts for video generation
  clip1Prompt: string; // The Trap
  clip2Prompt: string; // The Break
  clip3Prompt: string; // The Emergence
  
  // Effect-specific visual elements
  visualElements: string[];
  
  // Color palette for the effect
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  
  // Aspect ratio recommendation
  aspectRatio: '9:16' | '16:9' | '1:1';
  
  // Clip structure (always 3 for breakout)
  clipStructure: {
    clipCount: 3;
    clipDescriptions: [string, string, string];
  };
}

export const BREAKOUT_TEMPLATES: Record<string, BreakoutTemplateConfig> = {
  'post-escape': {
    id: 'post-escape',
    effectType: 'post-escape',
    name: 'Post Escape',
    description: 'Avatar trapped in a social post, presses against the glass, then SMASHES through into reality',
    clip1Prompt: `Person physically TRAPPED INSIDE a social media post, pressing against glass from inside.
      UI elements as separate depth layer. Hands pressed flat against barrier, intense eye contact.`,
    clip2Prompt: `EXPLOSIVE BREAKTHROUGH: Glass and UI fragments SHATTER toward viewer in slow motion.
      Character's arms emerging through broken barrier, dramatic volumetric lighting.`,
    clip3Prompt: `Triumphant emergence: Standing confidently with shattered UI debris settling.
      Direct eye contact, hero lighting, speaking to camera.`,
    visualElements: [
      'Social post frame',
      'Like button',
      'Comment section',
      'Glass shards',
      'Digital debris'
    ],
    colorPalette: {
      primary: '#1877F2',
      secondary: '#FFFFFF',
      accent: '#42B72A'
    },
    aspectRatio: '1:1',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Trapped behind social post glass, building tension',
        'Glass shattering, UI fragments exploding toward viewer',
        'Fully emerged, confident, speaking directly to camera'
      ]
    }
  },
  
  'scroll-grab': {
    id: 'scroll-grab',
    effectType: 'scroll-grab',
    name: 'Scroll Grab',
    description: 'Avatar reaches OUT of vertical video and grabs the screen edge to pull themselves through',
    clip1Prompt: `Person inside phone screen video, HAND reaching OUT toward viewer, pressing against screen boundary.
      Neon pink and cyan glow. The hand creating 3D bulge in screen surface.`,
    clip2Prompt: `Arm PUNCHES THROUGH screen, hand GRABBING device edge. Glass shattering with neon colors.
      Character pulling themselves through, athletic movement, screen material stretching.`,
    clip3Prompt: `Pulled fully OUT of phone, landing in dynamic pose. Shattered screen behind.
      Neon reflections, influencer energy, speaking to camera with confidence.`,
    visualElements: [
      'Phone screen edge',
      'Vertical video UI',
      'Neon reflections',
      'Glass fragments',
      'Hand bulge effect'
    ],
    colorPalette: {
      primary: '#00F2EA',
      secondary: '#FF0050',
      accent: '#FFFFFF'
    },
    aspectRatio: '9:16',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Hand reaching out of phone screen, pressing against barrier',
        'Grabbing screen edge, pulling through with athletic motion',
        'Emerged from phone, dynamic landing, speaking to camera'
      ]
    }
  },
  
  'freeze-walk': {
    id: 'freeze-walk',
    effectType: 'freeze-walk',
    name: 'Freeze & Walk',
    description: 'Avatar freezes in a video call while others keep moving, then steps OUT of their box into 3D space',
    clip1Prompt: `Video conference grid, ONE person FROZEN in grey-scale while others move in color.
      The frozen person's eyes lock on camera, body beginning to glow at edges. Supernatural tension.`,
    clip2Prompt: `Frozen person STEPS FORWARD, emerging from video box into 3D space.
      Color returning as they become solid. Empty chair in box behind. Portal effect at boundary.`,
    clip3Prompt: `Standing in 3D space in front of video call grid, others oblivious.
      Confident stance, fading glow, speaking with authority. Corporate magic.`,
    visualElements: [
      'Video call grid',
      'Participant boxes',
      'Mute icons',
      'Video controls',
      '2D/3D boundary glow'
    ],
    colorPalette: {
      primary: '#4A5568',
      secondary: '#FFFFFF',
      accent: '#FFD700'
    },
    aspectRatio: '16:9',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Frozen in video call while others move, eyes locking on camera',
        'Stepping out of video box into 3D space, color returning',
        'Standing before video grid, speaking with authority'
      ]
    }
  },
  
  'reality-rip': {
    id: 'reality-rip',
    effectType: 'reality-rip',
    name: 'Reality Rip',
    description: 'Reality TEARS like fabric, avatar silhouette emerges through the glowing rip with power',
    clip1Prompt: `Dark void with glowing TEAR forming in reality fabric. Through the tear, silhouette visible, backlit.
      Tear edges glowing with energy and digital glitches. Building power.`,
    clip2Prompt: `Reality RIPS WIDE OPEN, person STEPS THROUGH with power. Energy crackling at tear edges.
      Light exploding outward, body solid emerging from pure light. Godlike entrance.`,
    clip3Prompt: `Standing in reality, tear sealing behind, energy wisps fading. Commanding superhero presence.
      Direct intense eye contact, speaking with authority. MORE real than surroundings.`,
    visualElements: [
      'Reality tear',
      'Glowing edges',
      'Digital glitches',
      'Light explosion',
      'Reality fragments'
    ],
    colorPalette: {
      primary: '#FFFFFF',
      secondary: '#000000',
      accent: '#FFD700'
    },
    aspectRatio: '1:1',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Glowing tear forming in reality, silhouette visible through',
        'Reality ripping open, stepping through with power',
        'Emerged, tear sealing, speaking with commanding presence'
      ]
    }
  },
  
  'aspect-escape': {
    id: 'aspect-escape',
    effectType: 'aspect-escape',
    name: 'Aspect Ratio Escape',
    description: 'Avatar STEPS ACROSS the boundary between vertical and horizontal video formats',
    clip1Prompt: `Vertical phone video format, person PUSHING against the format boundary.
      Shoulder pressing against 9:16 edge, dimensional distortion where they push. Reality bending.`,
    clip2Prompt: `STEPPING THROUGH aspect ratio boundary, one foot in vertical, body emerging into horizontal.
      Boundary SHATTERING, vertical and horizontal realities colliding. Dimensional light at intersection.`,
    clip3Prompt: `Standing in widescreen horizontal reality, escaped vertical confinement.
      Shattered format lines fading. Full cinematic composition, confident eye contact, speaking to camera.`,
    visualElements: [
      'Aspect ratio edges',
      'Format distortion',
      'Dimensional boundary',
      'Shattered format lines',
      'Reality collision'
    ],
    colorPalette: {
      primary: '#3B82F6',
      secondary: '#FFFFFF',
      accent: '#8B5CF6'
    },
    aspectRatio: '16:9',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Pushing against vertical format boundary, dimension warping',
        'Stepping through format boundary, realities colliding',
        'Free in widescreen, format shards fading, speaking to camera'
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
 * Check if a template ID is a premium breakout template
 */
export function isBreakoutTemplate(templateId: string): boolean {
  return templateId in BREAKOUT_TEMPLATES;
}

/**
 * Get all breakout templates as an array (for UI rendering)
 */
export function getAllBreakoutTemplates(): BreakoutTemplateConfig[] {
  return Object.values(BREAKOUT_TEMPLATES);
}

/**
 * Get breakout template IDs in display order (for maximum sales impact)
 */
export function getBreakoutTemplateOrder(): BreakoutEffectType[] {
  return [
    'post-escape',
    'scroll-grab', 
    'freeze-walk',
    'reality-rip',
    'aspect-escape'
  ];
}
