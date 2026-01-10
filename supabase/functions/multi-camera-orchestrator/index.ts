import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MULTI-CAMERA ORCHESTRATOR
 * 
 * Automatically varies shot types to create professional cinematic coverage:
 * 1. Establisher → Master → Coverage pattern
 * 2. Wide → Medium → Close-up rhythm
 * 3. A-cam / B-cam simulation for dialogue
 * 4. Reaction shots and cutaways
 * 5. Match-on-action continuity
 */

type CameraScale = 'extreme-wide' | 'wide' | 'medium-wide' | 'medium' | 'medium-close' | 'close-up' | 'extreme-close';
type CameraAngle = 'eye-level' | 'low-angle' | 'high-angle' | 'dutch-angle' | 'overhead' | 'pov' | 'over-shoulder';
type CameraMovement = 'static' | 'pan' | 'tilt' | 'dolly' | 'tracking' | 'crane' | 'handheld' | 'steadicam' | 'push-in' | 'pull-out';

interface Shot {
  id: string;
  description: string;
  sceneType?: 'establishing' | 'action' | 'dialogue' | 'reaction' | 'detail' | 'transition' | 'climax' | 'resolution';
  dialogue?: string;
  durationSeconds?: number;
  mood?: string;
  characters?: string[];
}

interface CameraSetup {
  scale: CameraScale;
  angle: CameraAngle;
  movement: CameraMovement;
  lens?: string;
  motivation?: string;
}

interface OrchestratedShot {
  originalShot: Shot;
  cameraSetup: CameraSetup;
  enhancedPrompt: string;
  coverageType: 'master' | 'single' | 'two-shot' | 'insert' | 'cutaway' | 'reaction' | 'establishing';
  editingNotes: string;
}

interface MultiCameraRequest {
  shots: Shot[];
  style?: 'documentary' | 'cinematic' | 'action' | 'dialogue-heavy' | 'contemplative';
  pacingPreference?: 'fast' | 'moderate' | 'slow';
  aspectRatio?: '16:9' | '2.35:1' | '1.85:1' | '4:3' | '1:1' | '9:16';
  enforceCoverage?: boolean; // Ensure variety in camera setups
}

// Camera scale descriptions for prompt injection
const SCALE_PROMPTS: Record<CameraScale, string> = {
  'extreme-wide': 'Extreme wide shot showing vast environment, subject small in frame',
  'wide': 'Wide shot showing full environment and subjects in context',
  'medium-wide': 'Medium wide shot showing subjects from knees up with environment context',
  'medium': 'Medium shot framing subjects from waist up',
  'medium-close': 'Medium close-up framing subjects from chest up',
  'close-up': 'Close-up shot on face/subject with minimal background',
  'extreme-close': 'Extreme close-up focusing on specific detail (eyes, hands, object)',
};

// Camera angle descriptions
const ANGLE_PROMPTS: Record<CameraAngle, string> = {
  'eye-level': 'Camera at eye level, neutral perspective',
  'low-angle': 'Low angle looking up at subject, conveying power or grandeur',
  'high-angle': 'High angle looking down at subject, suggesting vulnerability',
  'dutch-angle': 'Tilted Dutch angle creating tension or unease',
  'overhead': 'Overhead bird\'s eye view looking directly down',
  'pov': 'Point-of-view shot from character\'s perspective',
  'over-shoulder': 'Over-the-shoulder shot for dialogue or reaction',
};

// Camera movement descriptions
const MOVEMENT_PROMPTS: Record<CameraMovement, string> = {
  'static': 'Camera locked off, completely static',
  'pan': 'Smooth horizontal pan following action',
  'tilt': 'Vertical tilt movement',
  'dolly': 'Camera physically moving forward/backward on track',
  'tracking': 'Camera tracking alongside moving subject',
  'crane': 'Sweeping crane movement with vertical and horizontal motion',
  'handheld': 'Handheld camera with natural subtle movement',
  'steadicam': 'Smooth floating steadicam movement',
  'push-in': 'Slow deliberate push-in toward subject',
  'pull-out': 'Slow pull-out revealing more of scene',
};

// Determine camera setup based on scene type and context
function selectCameraSetup(
  shot: Shot,
  previousSetup: CameraSetup | null,
  nextShot: Shot | null,
  style: string,
  position: number,
  totalShots: number
): CameraSetup {
  const isFirst = position === 0;
  const isLast = position === totalShots - 1;
  const hasDialogue = !!shot.dialogue && shot.dialogue.length > 0;
  const multipleCharacters = (shot.characters?.length || 0) > 1;
  
  let setup: CameraSetup = {
    scale: 'medium',
    angle: 'eye-level',
    movement: 'static',
    motivation: '',
  };

  // Avoid repeating the same setup
  const previousScale = previousSetup?.scale;
  const previousAngle = previousSetup?.angle;

  // Rule 1: First shot should establish
  if (isFirst || shot.sceneType === 'establishing') {
    setup.scale = 'wide';
    setup.angle = 'eye-level';
    setup.movement = style === 'cinematic' ? 'crane' : 'static';
    setup.motivation = 'Establishing shot to orient viewer';
    return setup;
  }

  // Rule 2: Dialogue scenes alternate scales and use over-shoulder
  if (hasDialogue || shot.sceneType === 'dialogue') {
    if (multipleCharacters) {
      // Two-shot or over-shoulder alternation
      if (previousScale === 'medium') {
        setup.scale = 'close-up';
        setup.angle = 'over-shoulder';
      } else if (previousScale === 'close-up') {
        setup.scale = 'medium';
        setup.angle = 'eye-level';
      } else {
        setup.scale = 'medium-close';
        setup.angle = 'over-shoulder';
      }
      setup.movement = 'static';
      setup.motivation = 'Dialogue coverage with scale variation';
    } else {
      // Single character dialogue
      setup.scale = previousScale === 'close-up' ? 'medium' : 'close-up';
      setup.angle = 'eye-level';
      setup.movement = 'push-in';
      setup.motivation = 'Single speaker emphasis';
    }
    return setup;
  }

  // Rule 3: Action scenes use dynamic movement and varied angles
  if (shot.sceneType === 'action' || style === 'action') {
    const actionScales: CameraScale[] = ['wide', 'medium', 'medium-close', 'close-up'];
    const actionMovements: CameraMovement[] = ['tracking', 'handheld', 'steadicam', 'dolly'];
    
    // Vary from previous
    setup.scale = actionScales.find(s => s !== previousScale) || 'medium';
    setup.angle = position % 2 === 0 ? 'low-angle' : 'eye-level';
    setup.movement = actionMovements[position % actionMovements.length];
    setup.motivation = 'Dynamic action coverage';
    return setup;
  }

  // Rule 4: Reaction shots are close-ups
  if (shot.sceneType === 'reaction') {
    setup.scale = 'close-up';
    setup.angle = 'eye-level';
    setup.movement = 'static';
    setup.motivation = 'Reaction capture';
    return setup;
  }

  // Rule 5: Detail shots are extreme close-ups
  if (shot.sceneType === 'detail') {
    setup.scale = 'extreme-close';
    setup.angle = 'overhead';
    setup.movement = 'static';
    setup.motivation = 'Detail insert';
    return setup;
  }

  // Rule 6: Climax uses impactful angles
  if (shot.sceneType === 'climax') {
    setup.scale = previousScale === 'wide' ? 'close-up' : 'wide';
    setup.angle = 'low-angle';
    setup.movement = 'push-in';
    setup.motivation = 'Dramatic emphasis';
    return setup;
  }

  // Rule 7: Resolution/ending uses wide or medium-wide
  if (isLast || shot.sceneType === 'resolution') {
    setup.scale = 'medium-wide';
    setup.angle = 'eye-level';
    setup.movement = 'pull-out';
    setup.motivation = 'Resolution and closure';
    return setup;
  }

  // Rule 8: Contemplative style uses longer holds and subtle movement
  if (style === 'contemplative') {
    setup.scale = previousScale === 'wide' ? 'medium' : 'wide';
    setup.movement = 'steadicam';
    setup.motivation = 'Contemplative observation';
    return setup;
  }

  // Default: Ensure variety from previous shot
  const allScales: CameraScale[] = ['wide', 'medium-wide', 'medium', 'medium-close', 'close-up'];
  const allAngles: CameraAngle[] = ['eye-level', 'low-angle', 'high-angle'];
  
  // Pick different scale from previous
  setup.scale = allScales.find(s => s !== previousScale) || 'medium';
  setup.angle = allAngles[position % allAngles.length];
  setup.movement = position % 3 === 0 ? 'dolly' : position % 3 === 1 ? 'pan' : 'static';
  setup.motivation = 'Coverage variety';

  return setup;
}

// Build enhanced prompt with camera setup
function buildEnhancedPrompt(shot: Shot, setup: CameraSetup): string {
  const parts: string[] = [];
  
  // Camera setup prefix
  parts.push(`[CAMERA: ${SCALE_PROMPTS[setup.scale]}. ${ANGLE_PROMPTS[setup.angle]}. ${MOVEMENT_PROMPTS[setup.movement]}.]`);
  
  // Lens suggestion based on scale
  if (setup.scale === 'wide' || setup.scale === 'extreme-wide') {
    parts.push('[LENS: Wide angle 24mm or wider]');
  } else if (setup.scale === 'close-up' || setup.scale === 'extreme-close') {
    parts.push('[LENS: Telephoto 85mm+ for compression and bokeh]');
  }
  
  // Original description
  parts.push(shot.description);
  
  return parts.join(' ');
}

// Determine coverage type
function determineCoverageType(shot: Shot, setup: CameraSetup): OrchestratedShot['coverageType'] {
  if (shot.sceneType === 'establishing' || setup.scale === 'extreme-wide') {
    return 'establishing';
  }
  if (shot.sceneType === 'reaction') {
    return 'reaction';
  }
  if (shot.sceneType === 'detail' || setup.scale === 'extreme-close') {
    return 'insert';
  }
  if ((shot.characters?.length || 0) > 1 && setup.scale === 'medium') {
    return 'two-shot';
  }
  if ((shot.characters?.length || 0) === 1 || setup.scale === 'close-up') {
    return 'single';
  }
  if (setup.scale === 'wide' || setup.scale === 'medium-wide') {
    return 'master';
  }
  return 'cutaway';
}

// Generate editing notes
function generateEditingNotes(shot: Shot, setup: CameraSetup, position: number, totalShots: number): string {
  const notes: string[] = [];
  
  if (position === 0) {
    notes.push('OPENING: Hold for establishing beat before cutting.');
  }
  
  if (setup.movement === 'push-in' || setup.movement === 'dolly') {
    notes.push('Cut on movement completion, not mid-movement.');
  }
  
  if (shot.dialogue) {
    notes.push('Allow dialogue to complete before cutting unless intercutting reactions.');
  }
  
  if (setup.scale === 'close-up' && shot.sceneType !== 'dialogue') {
    notes.push('Brief hold for impact, avoid lingering on close-ups.');
  }
  
  if (position === totalShots - 1) {
    notes.push('FINAL: Hold shot for resolution, potential fade to black.');
  }
  
  return notes.join(' ');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: MultiCameraRequest = await req.json();
    const {
      shots,
      style = 'cinematic',
      pacingPreference = 'moderate',
      aspectRatio = '16:9',
      enforceCoverage = true,
    } = request;

    if (!shots || shots.length === 0) {
      throw new Error("No shots provided");
    }

    console.log(`[MultiCamera] Orchestrating ${shots.length} shots in ${style} style`);

    const orchestratedShots: OrchestratedShot[] = [];
    let previousSetup: CameraSetup | null = null;

    // Track coverage variety
    const scaleUsage: Record<string, number> = {};
    const angleUsage: Record<string, number> = {};

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const nextShot = i < shots.length - 1 ? shots[i + 1] : null;

      // Select camera setup
      let setup = selectCameraSetup(shot, previousSetup, nextShot, style, i, shots.length);

      // Enforce coverage variety if enabled
      if (enforceCoverage && i > 2) {
        const maxRepeat = Math.ceil(shots.length / 4);
        
        if ((scaleUsage[setup.scale] || 0) >= maxRepeat) {
          // Force different scale
          const scales: CameraScale[] = ['wide', 'medium', 'close-up', 'medium-wide', 'medium-close'];
          setup.scale = scales.find(s => (scaleUsage[s] || 0) < maxRepeat) || setup.scale;
        }
      }

      // Track usage
      scaleUsage[setup.scale] = (scaleUsage[setup.scale] || 0) + 1;
      angleUsage[setup.angle] = (angleUsage[setup.angle] || 0) + 1;

      // Build enhanced prompt
      const enhancedPrompt = buildEnhancedPrompt(shot, setup);
      const coverageType = determineCoverageType(shot, setup);
      const editingNotes = generateEditingNotes(shot, setup, i, shots.length);

      orchestratedShots.push({
        originalShot: shot,
        cameraSetup: setup,
        enhancedPrompt,
        coverageType,
        editingNotes,
      });

      previousSetup = setup;
    }

    // Generate coverage summary
    const coverageSummary = {
      totalShots: shots.length,
      scaleDistribution: scaleUsage,
      angleDistribution: angleUsage,
      coverageTypes: orchestratedShots.reduce((acc, s) => {
        acc[s.coverageType] = (acc[s.coverageType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      varietyScore: Math.round((Object.keys(scaleUsage).length / 5) * 100), // Out of 5 main scales
    };

    console.log(`[MultiCamera] Orchestration complete. Variety score: ${coverageSummary.varietyScore}%`);

    return new Response(
      JSON.stringify({
        success: true,
        orchestratedShots,
        coverageSummary,
        style,
        aspectRatio,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[MultiCamera] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
