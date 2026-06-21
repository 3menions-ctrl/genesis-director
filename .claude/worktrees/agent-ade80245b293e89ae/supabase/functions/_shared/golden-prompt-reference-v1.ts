/**
 * ════════════════════════════════════════════════════════════════════════
 * GOLDEN PROMPT REFERENCE — v1.0 (FROZEN 2026-02-22)
 * ════════════════════════════════════════════════════════════════════════
 * 
 * THIS FILE IS A READ-ONLY BACKUP of the exact prompting functions that
 * produce world-class results with Kling V3. DO NOT MODIFY THIS FILE.
 * 
 * If the live code in generate-avatar-direct/index.ts or
 * continue-production/index.ts ever regresses, restore from this file.
 * 
 * Source: generate-avatar-direct/index.ts (lines 979-1136)
 *         continue-production/index.ts (lines 499-653)
 * ════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// CLIP 1 PROMPTING (from generate-avatar-direct)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Converts screenplay movement/action keywords into rich, natural
 * motion instructions that Kling V3 can interpret cinematically.
 */
export function goldenBuildMovementInstruction(
  movement?: string,
  action?: string,
  clipIndex: number = 0,
  physicalDetail?: string
): string {
  if (!movement && !action) return '';

  const movementMap: Record<string, string> = {
    'walk': 'walking naturally through the scene with confident strides, arms swinging gently',
    'gesture': 'using expressive hand gestures and animated body language, hands painting the air',
    'lean': 'leaning in with genuine interest, weight shifting forward, eyes locked on target',
    'turn': 'turning with fluid body rotation, a natural pivot that reveals new intent',
    'sit': 'sitting with lived-in comfort, hands active while talking, slight shifts in posture',
    'stand': 'standing tall with grounded confidence, subtle weight transfers between feet',
    'drive': 'seated behind the wheel, one hand casually on the steering wheel, glancing between road and camera',
    'react': 'reacting with whole-body surprise — eyebrows shooting up, torso pulling back, hands rising',
    'dance': 'moving with infectious rhythmic energy, shoulders bouncing, natural unscripted joy',
    'run': 'moving with urgent purposeful energy, body leaning into the momentum',
    'point': 'pointing with conviction, arm extending fully, whole body following the gesture',
    'laugh': 'breaking into genuine laughter, head tilting back, shoulders shaking, eyes crinkling',
    'freeze': 'freezing mid-motion in comedic disbelief, eyes wide, body completely still',
  };

  const motionPhrase = movementMap[movement || ''] || '';
  const actionPhrase = action ? `${action}` : '';
  const microAction = physicalDetail ? ` ${physicalDetail}.` : '';

  if (actionPhrase && motionPhrase) {
    return `The subject is ${actionPhrase}, ${motionPhrase}.${microAction}`;
  }
  return actionPhrase
    ? `The subject is ${actionPhrase}.${microAction}`
    : (motionPhrase ? `The subject is ${motionPhrase}.${microAction}` : '');
}

/**
 * Maps emotional tone keywords to full-body performance descriptions
 * that produce nuanced, lifelike acting in Kling V3.
 */
export function goldenGetPerformanceStyle(tone: string): string {
  switch (tone) {
    case 'excited': return "Eyes BLAZING with enthusiasm, animated hand gestures cutting through the air, energetic head movements, megawatt smile that lights up the frame. Voice pitch rises naturally.";
    case 'dramatic': return "Intense locked-in gaze, deliberate measured gestures that demand attention, controlled breathing between phrases, commanding physical presence that owns the frame.";
    case 'warm': case 'tender': return "Genuine warm smile reaching the eyes (Duchenne smile), soft expressive gaze, open welcoming posture, gentle head tilts showing authentic care and connection.";
    case 'amused': case 'playful': return "Mischievous knowing grin, playful eyebrow raises, animated expressions shifting rapidly between amusement and mock-seriousness, infectious lighthearted energy.";
    case 'surprised': return "Eyes widening in genuine surprise, eyebrows shooting up, slight body pullback, mouth forming an 'O' before breaking into speech, hands rising instinctively.";
    case 'nervous': return "Subtle fidgeting — adjusting collar, touching face, weight shifting between feet — with darting eye movements and an uncertain half-smile that breaks into nervous laughter.";
    case 'confident': return "Rock-solid eye contact with the lens, open commanding posture, precisely timed gestures that punctuate key words, the assured energy of someone who KNOWS they're right.";
    case 'deadpan': return "Completely flat expression, minimal movement, devastating understatement delivered with surgical precision. The comedy comes from the stillness.";
    case 'mischievous': return "Sly half-smile, one eyebrow slightly raised, leaning toward camera conspiratorially, the energy of someone about to reveal a delicious secret.";
    default: return "Natural confident delivery with genuine facial expressions, professional yet personable energy, authentic micro-expressions between phrases that show real thinking.";
  }
}

/**
 * The camera hint → rich description map used for screenplay-driven
 * camera direction. This is the EXACT map that produces great results.
 */
export const GOLDEN_CAMERA_MAP: Record<string, string> = {
  'tracking': 'Smooth Steadicam tracking shot gliding alongside the subject, maintaining perfect focus',
  'close-up': 'Intimate close-up isolating facial micro-expressions, shallow depth of field blurring background into bokeh',
  'wide': 'Wide establishing shot placing the subject in their full environment, giving scale and context',
  'over-shoulder': 'Over-the-shoulder perspective creating voyeuristic intimacy, foreground shoulder soft-focused',
  'medium': 'Classic medium shot from waist up, balanced composition with room to breathe',
  'panning': 'Slow deliberate pan revealing the scene around the subject, building anticipation',
  'dolly-in': 'Slow dolly push-in toward the subject, building intensity and focus on their words',
  'low-angle': 'Low-angle shot looking up at the subject, conveying authority and presence',
  'crane': 'Subtle crane movement adding vertical dimension, elevating the visual storytelling',
};

/**
 * The EXACT quality baseline string. Never modify.
 */
export const GOLDEN_QUALITY_BASELINE =
  "Ultra-high definition 4K cinematic quality. Natural skin tones with subsurface scattering. Rich vibrant colors with cinematic color grading. Shallow depth of field with natural bokeh. Volumetric warm lighting with soft fill. Film-quality motion blur on movement.";

/**
 * The EXACT lifelike motion directive. Never modify.
 */
export const GOLDEN_LIFELIKE_DIRECTIVE =
  "Continuous lifelike motion: breathing visible in chest/shoulders, natural eye movements tracking between focal points, involuntary micro-expressions (slight brow raises, lip movements between words), authentic weight shifts, hair/clothing responding to movement with physics-accurate motion.";

/**
 * The EXACT negative prompt for Kling V3. Never modify.
 */
export const GOLDEN_NEGATIVE_PROMPT =
  "blurry, distorted, glitchy, unnatural movements, closed mouth, frozen face, robotic, stiff, static, face morphing, identity change, different person, age change";

// ═══════════════════════════════════════════════════════════════════════
// CLIPS 2+ PROMPTING (from continue-production)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Builds a comprehensive cinematic prompt for clips 2+ using
 * prediction data from pending_video_tasks. This is the EXACT
 * algorithm that produces seamless multi-clip avatar videos.
 */
export function goldenBuildContinuationPrompt(
  seg: {
    segmentText?: string;
    action?: string;
    movement?: string;
    emotion?: string;
    cameraHint?: string;
    physicalDetail?: string;
    sceneNote?: string;
    transitionNote?: string;
    startPose?: string;
    endPose?: string;
    visualContinuity?: string;
  },
  sceneDescription: string,
  clipIndex: number,
  totalClips: number,
): string {
  const dialogue = seg.segmentText?.trim() || '';
  const action = seg.action?.trim() || '';
  const movement = seg.movement?.trim() || '';
  const emotion = seg.emotion?.trim() || '';
  const cameraHint = seg.cameraHint?.trim() || '';
  const physicalDetail = seg.physicalDetail?.trim() || '';
  const sceneNote = seg.sceneNote?.trim() || '';
  const transitionNote = seg.transitionNote?.trim() || '';
  const startPoseNote = seg.startPose?.trim() || '';
  const endPoseNote = seg.endPose?.trim() || '';
  const visualContinuityNote = seg.visualContinuity?.trim() || '';

  const promptParts: string[] = [];

  // Scene context
  if (sceneDescription) {
    promptParts.push(`Cinematic scene set in ${sceneDescription}, shot on ARRI Alexa with anamorphic lenses.`);
  }

  // Environment lock
  promptParts.push('[SAME ENVIRONMENT: Continue in the exact same location with consistent lighting and props.]');

  // Camera direction
  if (cameraHint && GOLDEN_CAMERA_MAP[cameraHint]) {
    promptParts.push(GOLDEN_CAMERA_MAP[cameraHint] + '.');
  }

  // Narrative beat
  if (clipIndex === totalClips - 1) {
    promptParts.push('CLOSING MOMENT: This is the payoff — land the final beat with impact and conviction.');
  } else {
    promptParts.push('BUILDING MOMENTUM: The story is developing — natural escalation of energy and engagement.');
  }

  // Physical action & movement
  if (action) promptParts.push(`CHARACTER ACTION: ${action}.`);
  if (movement) promptParts.push(`CHARACTER MOVEMENT: ${movement}.`);
  if (physicalDetail) promptParts.push(`PHYSICAL DETAIL: ${physicalDetail}.`);

  // Scene note
  if (sceneNote) promptParts.push(`SCENE NOTE: ${sceneNote}.`);

  // Transition & pose chaining
  if (transitionNote) promptParts.push(`TRANSITION: ${transitionNote}.`);
  if (startPoseNote) promptParts.push(`STARTING POSE: Character begins in this position: ${startPoseNote}.`);
  if (endPoseNote) promptParts.push(`ENDING POSE: Character must end in this position for next clip continuity: ${endPoseNote}.`);
  if (visualContinuityNote) promptParts.push(`VISUAL CONTINUITY: ${visualContinuityNote}.`);

  // Dialogue — the backbone
  if (dialogue) {
    promptParts.push(`Speaking naturally with authentic delivery: "${dialogue}".`);
  }

  // Emotion/performance style
  if (emotion) {
    promptParts.push(`Performance energy: ${emotion}.`);
  }

  // Lifelike motion
  promptParts.push(GOLDEN_LIFELIKE_DIRECTIVE);

  // Quality baseline
  promptParts.push(GOLDEN_QUALITY_BASELINE);

  return promptParts.join(' ');
}
