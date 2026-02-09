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
    clip1Prompt: `CAMERA: Slow DOLLY PUSH-IN toward subject, claustrophobic tension.
      Person TRAPPED INSIDE social post interface, pressing against glass barrier.
      UI as SEPARATE DEPTH LAYER. Hands SLOWLY PRESSING harder, breath fogging glass.
      Dramatic rim light, cyan UI glow. Eyes LOCKING on camera with building intensity.`,
    clip2Prompt: `CAMERA: Dynamic TRACKING with DUTCH ANGLE for chaos.
      Character SMASHES THROUGH with FULL BODY FORCE. Glass shards EXPLODING TOWARD VIEWER in 120fps slow-mo.
      UI buttons SHATTERING into pixel fragments. Volumetric dust explosion.
      EXPLOSIVE backlighting flooding through cracks.`,
    clip3Prompt: `CAMERA: Hero CRANE SHOT rising to eye level - triumphant reveal.
      POWERFUL STEP FORWARD toward camera. Shattered UI debris settling.
      Premium hero lighting - key, fill, dramatic rim. Speaking with commanding conviction.`,
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
    clip1Prompt: `CAMERA: PUSH-IN with HANDHELD energy, viral urgency.
      Person inside phone screen, HAND reaches OUT creating 3D BULGE in glass.
      NEON PINK and CYAN rim glow. Fingers PRESSING harder, glass WARPING.
      Mischievous eye contact, about-to-break-free energy.`,
    clip2Prompt: `CAMERA: WHIP PAN following explosive action.
      Fist SMASHING through in glass burst. Fingers GRIPPING phone bezel.
      Body PULLING FORWARD with parkour energy. Screen TEARING like liquid crystal.
      NEON fragments EXPLODING in dual-tone light trails.`,
    clip3Prompt: `CAMERA: ORBIT RIGHT around subject with dynamic energy.
      Athletic LANDING with slight crouch. Rising with confident SWAGGER.
      Shattered phone behind, neon reflections on debris.
      Speaking with influencer energy, commanding the frame.`,
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
    clip1Prompt: `CAMERA: Slow PUSH-IN toward frozen figure, supernatural tension.
      Video conference grid - ONE person FROZEN in GREYSCALE while others move in COLOR.
      Eyes SLOWLY MOVING to lock on camera. Body GLOWING at edges.
      Particles rising around silhouette. Uncanny knowing gaze.`,
    clip2Prompt: `CAMERA: TRACKING SHOT following emergence, 2D to 3D perspective shift.
      Frozen person STEPS FORWARD out of video box into real 3D space.
      Color FLOODING BACK as they emerge. Portal GLOW at boundary.
      Empty chair visible in their abandoned box.`,
    clip3Prompt: `CAMERA: DOLLY BACK establishing composition, then SETTLE centered.
      Confident STANCE in 3D space, video grid continuing behind.
      Premium corporate lighting. Subtle glow fading.
      Speaking with calm authority, commanding presence.`,
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
    clip1Prompt: `CAMERA: Slow CRANE DOWN into void, godlike anticipation.
      Pure darkness with glowing TEAR in reality fabric.
      SILHOUETTE backlit through rift. Hands GRIPPING tear edges.
      Energy CRACKLING, digital glitch fragments floating.
      BLINDING backlight, near-total darkness contrast.`,
    clip2Prompt: `CAMERA: EXPLOSIVE PUSH-IN through chaos.
      Reality TEARS OPEN. Person SURGES through with godlike power.
      Arms SPREADING wide. Energy EXPLODING outward.
      SUPERNOVA light burst. Reality shards FLYING.
      Body SOLIDIFYING - becoming MORE REAL than surroundings.`,
    clip3Prompt: `CAMERA: HEROIC LOW ANGLE with TILT UP emphasizing power.
      Powerful STANCE as tear SEALS behind. Energy wisps fading.
      Subject MORE VIVID than reality. Floating light particles settling.
      Speaking with world-changing authority.`,
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
    clip1Prompt: `CAMERA: Static then SUBTLE PUSH as tension builds.
      Vertical 9:16 format - person PUSHING against aspect ratio edge.
      Shoulder PRESSING, body STRAINING. Format BULGING from pressure.
      Reality BENDING at boundary. Flat phone-lighting emphasizing limitation.`,
    clip2Prompt: `CAMERA: DRAMATIC WHIP from vertical to horizontal.
      FORMAT SHATTERS. Powerful STEP crossing 9:16 into 16:9.
      Vertical frame BREAKING like glass around them.
      Dimensional light where formats COLLIDE. Quality TRANSFORMATION visible.`,
    clip3Prompt: `CAMERA: CINEMATIC TRACKING establishing widescreen freedom.
      Arms SWEEPING to embrace full frame width.
      Shattered 9:16 fragments FADING behind.
      PREMIUM cinema lighting - Rembrandt key. Full cinematic movement.
      Speaking with liberated confidence.`,
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
