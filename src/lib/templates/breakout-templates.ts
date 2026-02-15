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

/**
 * VIRAL-GRADE BREAKOUT TEMPLATES v2.0
 * 
 * Upgraded for world-class output:
 * - Dynamic camera movements (never static)
 * - Explosive VFX language
 * - Strong motion direction
 * - Identity lock enforcement
 * - Cinematic lighting specifications
 */
export const BREAKOUT_TEMPLATES: Record<string, BreakoutTemplateConfig> = {
  'post-escape': {
    id: 'post-escape',
    effectType: 'post-escape',
    name: 'Post Escape',
    description: 'Avatar SMASHES through social media interface into reality with explosive glass-shattering action',
    clip1Prompt: `Slow DOLLY PUSH-IN, claustrophobic tension. Person TRAPPED inside social media post interface, pressing against glass barrier. UI layer as separate depth plane. Hands pressing harder, breath fogging glass. Dramatic rim light, cyan UI glow.`,
    clip2Prompt: `Dynamic TRACKING with DUTCH ANGLE. Character SMASHES THROUGH screen with full body force. Glass shards EXPLODING toward viewer. UI buttons shattering into pixel fragments. Volumetric dust explosion. Explosive backlighting.`,
    clip3Prompt: `Hero CRANE SHOT rising to eye level. Powerful step forward, shattered UI debris settling. Premium hero lighting - 45° key, subtle fill, dramatic rim. Speaking with commanding conviction.`,
    visualElements: [
      'Shattering like buttons',
      'Exploding comment icons',
      'Glass shards with pixel debris',
      'Volumetric light rays',
      'Dynamic camera movement'
    ],
    colorPalette: {
      primary: '#0066FF',
      secondary: '#FFFFFF',
      accent: '#00D4FF'
    },
    aspectRatio: '1:1',
    clipStructure: {
      clipCount: 3,
      clipDescriptions: [
        'Claustrophobic trap - dolly push-in, building tension',
        'Explosive breakthrough - tracking shot, glass shattering toward viewer',
        'Triumphant emergence - crane shot, hero lighting, commanding presence'
      ]
    }
  },
  
  'scroll-grab': {
    id: 'scroll-grab',
    effectType: 'scroll-grab',
    name: 'Scroll Grab',
    description: 'Avatar PUNCHES through vertical video screen and GRABS the edge to pull themselves into reality',
    clip1Prompt: `PUSH-IN with handheld energy. Person inside phone screen, hand reaching OUT creating 3D BULGE in glass. Neon pink/cyan dual-tone rim glow. Fingers pressing harder, glass warping. Mischievous eye contact.`,
    clip2Prompt: `WHIP PAN following action. Fist SMASHING through glass burst, fingers gripping phone bezel. Body pulling forward with parkour energy. Screen tearing like liquid crystal. Neon pink/cyan fragments exploding.`,
    clip3Prompt: `ORBIT RIGHT around subject settling centered. Athletic landing with slight crouch, rising with confident swagger. Shattered phone behind, neon reflections on debris. Speaking with influencer energy.`,
    visualElements: [
      'Phone bezel grab',
      'Neon pink/cyan explosion',
      'Liquid crystal tear',
      'Athletic movement',
      'Orbit camera motion'
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
        'Hand pressing through screen - push-in, glass warping',
        'Explosive grab and pull - whip pan, neon shattering',
        'Dynamic landing - orbit shot, influencer energy'
      ]
    }
  },
  
  'freeze-walk': {
    id: 'freeze-walk',
    effectType: 'freeze-walk',
    name: 'Freeze & Walk',
    description: 'Avatar FREEZES in video call while others move, then STEPS OUT of their box into 3D reality',
    clip1Prompt: `Slow PUSH-IN toward frozen figure. Video conference grid - ONE person FROZEN in GREYSCALE while others move in color. Eyes slowly moving to lock on camera. Body glowing at edges with white-gold light. Particles rising.`,
    clip2Prompt: `TRACKING SHOT, perspective shifting 2D to 3D. Frozen person STEPS FORWARD out of video box into real 3D space. Color flooding back. Portal glow at boundary. Empty chair in abandoned box. Webcam to studio lighting transformation.`,
    clip3Prompt: `DOLLY BACK establishing composition, settling centered. Confident stance in 3D space, video grid continuing behind. Premium corporate lighting - clean key, professional fill, subtle rim. Speaking with calm authority.`,
    visualElements: [
      'Video call grid',
      'Greyscale to color transformation',
      'Portal glow boundary',
      'Empty chair reveal',
      'Dimensional stepping'
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
        'Supernatural freeze - push-in, greyscale with color contrast',
        '2D to 3D emergence - tracking shot, portal glow',
        'Corporate transcendence - dolly back, authority stance'
      ]
    }
  },
  
  'reality-rip': {
    id: 'reality-rip',
    effectType: 'reality-rip',
    name: 'Reality Rip',
    description: 'Avatar TEARS through the fabric of reality with godlike power and explosive light',
    clip1Prompt: `Slow CRANE DOWN into void. Pure darkness with glowing TEAR in reality fabric. Silhouette backlit through rift, hands gripping tear edges. Energy crackling, digital glitch fragments floating. Blinding backlight, near-total darkness contrast.`,
    clip2Prompt: `EXPLOSIVE PUSH-IN through chaos. Reality TEARS OPEN. Person surges through with godlike power. Arms spreading wide. Energy exploding outward. Supernova light burst. Reality shards flying. Body solidifying, becoming more real than surroundings.`,
    clip3Prompt: `HEROIC LOW ANGLE with tilt up. Powerful stance as tear seals behind. Energy wisps fading. Subject more vivid than reality. Floating light particles settling. Dramatic hero lighting - low key, powerful rim. Speaking with world-changing authority.`,
    visualElements: [
      'Reality tear with energy',
      'Supernova light burst',
      'Digital glitch fragments',
      'Godlike emergence',
      'Low angle hero shot'
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
        'Tear forming - crane down, silhouette backlit',
        'Godlike emergence - push-in, supernova explosion',
        'Powerful arrival - low angle, commanding presence'
      ]
    }
  },
  
  'aspect-escape': {
    id: 'aspect-escape',
    effectType: 'aspect-escape',
    name: 'Aspect Ratio Escape',
    description: 'Avatar SHATTERS the boundary between vertical and horizontal video formats',
    clip1Prompt: `Static then subtle PUSH. Vertical 9:16 format - person pushing against aspect ratio edge. Shoulder pressing, body straining. Format bulging from pressure. Reality bending at boundary. Flat phone lighting.`,
    clip2Prompt: `DRAMATIC WHIP from vertical to horizontal. Person BREAKS through aspect ratio boundary. Powerful step from 9:16 into 16:9. Vertical frame shattering like glass. Dimensional light where formats collide. Flat to cinematic lighting transformation.`,
    clip3Prompt: `CINEMATIC TRACKING establishing widescreen composition. Arms sweeping to embrace full frame width. Shattered 9:16 fragments fading behind. Premium cinema lighting - Rembrandt key, sophisticated fill, dramatic rim. Speaking with liberated confidence.`,
    visualElements: [
      'Aspect ratio barrier',
      'Format shattering',
      'Dimensional collision',
      'Quality transformation',
      'Widescreen liberation'
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
        'Format strain - push against 9:16 boundaries',
        'Dimensional breakthrough - whip pan, format collision',
        'Cinematic freedom - tracking shot, widescreen celebration'
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
