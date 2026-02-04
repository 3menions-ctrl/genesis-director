/**
 * WORLD-CLASS CINEMATOGRAPHY ENGINE v1.0
 * 
 * Hollywood-grade camera work and dynamic movement system
 * Ensures each clip is visually distinct with professional cinematography
 * Designed for maximum visual impact and variety
 */

// ============================================================================
// CAMERA MOVEMENT LIBRARY - Hollywood Standard
// ============================================================================

export const CAMERA_MOVEMENTS = {
  // Classic Hollywood moves
  dolly_in: [
    "smooth dolly push-in toward the subject, building intimacy",
    "gradual forward movement closing distance with emotional impact",
    "elegant dolly approach revealing subtle details",
  ],
  dolly_out: [
    "slow dolly pull-back revealing the full scene context",
    "retreating camera movement expanding the visual scope",
    "widening perspective dolly revealing environmental grandeur",
  ],
  tracking_left: [
    "fluid lateral tracking shot moving left across the scene",
    "smooth side-to-side camera glide following movement",
    "parallel tracking with natural momentum",
  ],
  tracking_right: [
    "elegant rightward tracking shot with steady momentum",
    "horizontal camera motion sweeping across the frame",
    "lateral dolly movement with cinematic fluidity",
  ],
  crane_up: [
    "graceful crane shot rising above the subject",
    "ascending camera movement revealing scope and scale",
    "upward sweeping crane adding vertical dimension",
  ],
  crane_down: [
    "descending crane shot landing on the subject",
    "overhead camera lowering to intimate framing",
    "sweeping downward reveal with dramatic effect",
  ],
  orbit_left: [
    "360-degree orbiting shot circling counterclockwise",
    "rotational camera movement arcing around the subject",
    "cinematic arc shot revealing multiple angles",
  ],
  orbit_right: [
    "clockwise orbital movement around the subject",
    "dynamic arc shot showcasing dimensional presence",
    "rotating camera perspective with smooth execution",
  ],
  steadicam_follow: [
    "professional steadicam following the subject organically",
    "floating camera movement with natural breathing",
    "smooth pursuit shot maintaining perfect framing",
  ],
  handheld_intimate: [
    "subtle handheld motion adding documentary authenticity",
    "organic camera movement with controlled micro-movements",
    "naturalistic handheld creating immediacy",
  ],
  static_locked: [
    "rock-solid locked-off shot with precise composition",
    "perfectly stable static frame emphasizing performance",
    "tripod-mounted stillness with intentional gravitas",
  ],
  push_focus: [
    "subtle forward motion with shifting focus plane",
    "gentle push-in with rack focus effect",
    "approaching shot with depth-of-field play",
  ],
};

// ============================================================================
// CAMERA ANGLES LIBRARY - Cinematic Grammar
// ============================================================================

export const CAMERA_ANGLES = {
  // Eye-level variations
  eye_level_centered: [
    "direct eye-level framing with centered composition",
    "straight-on neutral angle at subject height",
    "level camera placement for natural connection",
  ],
  eye_level_offset: [
    "eye-level shot with subject positioned off-center using rule of thirds",
    "level angle with asymmetrical composition creating visual interest",
    "natural height camera with negative space emphasis",
  ],
  
  // Low angle (power/heroic)
  low_angle_subtle: [
    "slightly low camera angle adding subtle authority",
    "upward tilt from chest height enhancing presence",
    "mild low angle conveying quiet confidence",
  ],
  low_angle_dramatic: [
    "dramatic low angle shooting upward toward the subject",
    "hero shot from below emphasizing power and stature",
    "striking upward perspective with sky visible",
  ],
  
  // High angle (vulnerability/overview)
  high_angle_gentle: [
    "gentle high angle looking down with empathy",
    "overhead perspective creating intimacy",
    "elevated viewpoint with caring quality",
  ],
  high_angle_omniscient: [
    "high bird's-eye perspective surveying the scene",
    "overhead shot creating god's-eye narrative distance",
    "elevated omniscient framing",
  ],
  
  // Dutch/canted (tension/unease)
  dutch_subtle: [
    "subtle dutch tilt adding dynamic tension",
    "slight camera cant creating visual unease",
    "mild angular tilt enhancing energy",
  ],
  dutch_dramatic: [
    "bold dutch angle creating dramatic instability",
    "severe camera tilt amplifying tension",
    "extreme canted framing for maximum impact",
  ],
  
  // Over-shoulder and POV
  over_shoulder_left: [
    "over-the-shoulder shot from behind left side",
    "OTS framing with subject facing right",
    "shoulder-level perspective establishing spatial relationship",
  ],
  over_shoulder_right: [
    "over-the-shoulder angle from right side",
    "OTS composition with subject facing left",
    "intimate shoulder-perspective framing",
  ],
  pov_immersive: [
    "subjective POV shot from the speaker's perspective",
    "first-person viewpoint creating audience connection",
    "immersive point-of-view framing",
  ],
  
  // Profile and three-quarter
  three_quarter_left: [
    "three-quarter angle from subject's left side",
    "45-degree profile revealing depth and dimension",
    "angled perspective showing facial contours",
  ],
  three_quarter_right: [
    "three-quarter composition from subject's right",
    "dimensional 45-degree angle with depth",
    "sculptural perspective emphasizing form",
  ],
  profile_silhouette: [
    "striking profile shot with rim lighting",
    "side-view silhouette with dramatic edge light",
    "profile angle creating iconic composition",
  ],
};

// ============================================================================
// SHOT SIZES LIBRARY - Frame Grammar
// ============================================================================

export const SHOT_SIZES = {
  extreme_wide: [
    "extreme wide establishing shot placing subject in vast environment",
    "panoramic vista shot with subject as focal point",
    "expansive environmental frame showing full context",
  ],
  wide: [
    "full-body wide shot showing complete figure and surroundings",
    "master shot establishing spatial relationships",
    "wide framing with environmental storytelling",
  ],
  medium_wide: [
    "medium-wide shot from knees up with comfortable headroom",
    "cowboy shot showing gesture and environment balance",
    "three-quarter body framing with context",
  ],
  medium: [
    "classic medium shot from waist up",
    "standard interview framing with expressive potential",
    "mid-shot balancing subject and background",
  ],
  medium_close: [
    "medium close-up from chest level",
    "tighter framing emphasizing upper body expression",
    "intimate mid-close capturing emotional nuance",
  ],
  close_up: [
    "powerful close-up focusing on face and expression",
    "tight facial framing with emotional intensity",
    "intimate close shot capturing micro-expressions",
  ],
  extreme_close_up: [
    "extreme close-up on eyes and mouth for maximum intensity",
    "macro-level facial detail shot",
    "ultra-tight framing on expressive features",
  ],
};

// ============================================================================
// LIGHTING STYLES LIBRARY - Mood & Atmosphere
// ============================================================================

export const LIGHTING_STYLES = {
  // Classic three-point
  classic_key: [
    "professional three-point lighting with dominant key light",
    "balanced studio illumination with soft shadows",
    "commercial-grade lighting setup with fill and rim",
  ],
  
  // Dramatic/noir
  chiaroscuro: [
    "dramatic chiaroscuro lighting with deep shadows and highlights",
    "high-contrast noir-style illumination",
    "painterly light and shadow interplay",
  ],
  rembrandt: [
    "Rembrandt lighting with characteristic nose shadow triangle",
    "classic portrait lighting creating depth",
    "sculptural side-lighting with dramatic mood",
  ],
  
  // Natural/environmental
  golden_hour: [
    "warm golden hour lighting with amber tones",
    "magic hour glow with long shadows",
    "sunset-quality warm illumination",
  ],
  blue_hour: [
    "cool blue hour twilight lighting",
    "dusk ambiance with soft blue tones",
    "twilight atmosphere with natural gradients",
  ],
  overcast_soft: [
    "soft overcast natural lighting without harsh shadows",
    "diffused daylight with even illumination",
    "cloudy-day softbox quality light",
  ],
  
  // Stylized
  neon_accent: [
    "vibrant neon accent lighting with color contrast",
    "urban night lighting with neon reflections",
    "contemporary colored edge lighting",
  ],
  rim_dramatic: [
    "dramatic rim lighting separating subject from background",
    "edge-lit silhouette with glowing contour",
    "backlit halo effect with subject definition",
  ],
  volumetric: [
    "atmospheric volumetric lighting with visible light rays",
    "god-rays effect with hazy atmosphere",
    "cinematic light beams cutting through space",
  ],
};

// ============================================================================
// MOTION DYNAMICS LIBRARY - Subject Movement
// ============================================================================

export const SUBJECT_MOTION = {
  static_confident: [
    "standing with confident stillness and grounded presence",
    "static but alive with subtle weight shifts",
    "poised and centered with controlled energy",
  ],
  subtle_shift: [
    "gentle weight shifts and natural micro-movements",
    "subtle swaying with organic rhythm",
    "living stillness with breathing motion",
  ],
  gesture_expressive: [
    "expressive hand gestures punctuating speech",
    "animated gesticulation matching verbal emphasis",
    "dynamic hand and arm movements for engagement",
  ],
  walking_forward: [
    "walking purposefully toward camera while speaking",
    "confident approach with maintained eye contact",
    "forward stride with engaging presence",
  ],
  walking_lateral: [
    "walking parallel to camera with natural gait",
    "lateral movement through the scene while speaking",
    "side-to-side traversal with dynamic energy",
  ],
  seated_engaged: [
    "seated position with engaged forward lean",
    "sitting comfortably with attentive posture",
    "chair-based presence with expressive upper body",
  ],
  leaning_casual: [
    "casually leaning against a surface with relaxed energy",
    "comfortable lean position conveying accessibility",
    "relaxed stance with grounded confidence",
  ],
};

// ============================================================================
// CLIP SEQUENCE PLANNER - Ensures Visual Variety
// ============================================================================

interface CinematicStyle {
  cameraMovement: string;
  cameraAngle: string;
  shotSize: string;
  lighting: string;
  subjectMotion: string;
}

/**
 * Get a unique cinematic style for each clip index
 * Ensures no two consecutive clips have similar visual treatment
 */
export function getClipCinematicStyle(clipIndex: number, totalClips: number): CinematicStyle {
  // Predefined progression patterns for multi-clip sequences
  const movementProgression = [
    'dolly_in', 'tracking_right', 'crane_up', 'orbit_left', 'dolly_out',
    'steadicam_follow', 'tracking_left', 'crane_down', 'orbit_right', 'push_focus',
  ];
  
  const angleProgression = [
    'eye_level_offset', 'low_angle_subtle', 'three_quarter_left', 'high_angle_gentle',
    'dutch_subtle', 'three_quarter_right', 'low_angle_dramatic', 'eye_level_centered',
    'over_shoulder_left', 'profile_silhouette',
  ];
  
  const sizeProgression = [
    'medium', 'medium_close', 'wide', 'close_up', 'medium_wide',
    'medium', 'extreme_close_up', 'medium_wide', 'close_up', 'wide',
  ];
  
  const lightingProgression = [
    'classic_key', 'rembrandt', 'golden_hour', 'chiaroscuro', 'rim_dramatic',
    'overcast_soft', 'neon_accent', 'volumetric', 'blue_hour', 'classic_key',
  ];
  
  const motionProgression = [
    'gesture_expressive', 'walking_forward', 'subtle_shift', 'static_confident',
    'walking_lateral', 'leaning_casual', 'gesture_expressive', 'seated_engaged',
    'walking_forward', 'subtle_shift',
  ];
  
  const idx = clipIndex % 10;
  
  return {
    cameraMovement: movementProgression[idx],
    cameraAngle: angleProgression[idx],
    shotSize: sizeProgression[idx],
    lighting: lightingProgression[idx],
    subjectMotion: motionProgression[idx],
  };
}

/**
 * Select a random prompt from a category
 */
function selectPrompt(prompts: string[]): string {
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Build a world-class cinematographic prompt for a specific clip
 */
export function buildWorldClassCinematicPrompt(
  clipIndex: number,
  totalClips: number,
  scriptExcerpt: string,
  sceneDescription?: string
): string {
  const style = getClipCinematicStyle(clipIndex, totalClips);
  
  // Get specific prompts for each element
  const movementPrompt = selectPrompt(CAMERA_MOVEMENTS[style.cameraMovement as keyof typeof CAMERA_MOVEMENTS] || CAMERA_MOVEMENTS.static_locked);
  const anglePrompt = selectPrompt(CAMERA_ANGLES[style.cameraAngle as keyof typeof CAMERA_ANGLES] || CAMERA_ANGLES.eye_level_centered);
  const sizePrompt = selectPrompt(SHOT_SIZES[style.shotSize as keyof typeof SHOT_SIZES] || SHOT_SIZES.medium);
  const lightingPrompt = selectPrompt(LIGHTING_STYLES[style.lighting as keyof typeof LIGHTING_STYLES] || LIGHTING_STYLES.classic_key);
  const motionPrompt = selectPrompt(SUBJECT_MOTION[style.subjectMotion as keyof typeof SUBJECT_MOTION] || SUBJECT_MOTION.gesture_expressive);
  
  // Scene context
  const sceneContext = sceneDescription?.trim() 
    ? `Cinematic scene set in ${sceneDescription.trim()}.`
    : "Professional cinematic environment with depth and atmosphere.";
  
  // Build the complete world-class prompt
  const prompt = `${sceneContext} ${sizePrompt}. ${anglePrompt}. ${movementPrompt}. ${lightingPrompt}. The subject is ${motionPrompt}, speaking naturally with authentic emotion: "${scriptExcerpt.substring(0, 80)}${scriptExcerpt.length > 80 ? '...' : ''}". Ultra-high definition 4K quality, film-grain texture, natural skin tones, professional color grading, cinematic depth of field, award-winning cinematography.`;
  
  return prompt;
}

/**
 * Build a simple variety prompt when cinematic mode is disabled
 * Still ensures variety but less extreme
 */
export function buildStandardVarietyPrompt(
  clipIndex: number,
  scriptExcerpt: string,
  sceneDescription?: string
): string {
  // Simpler variety for non-cinematic mode
  const simpleAngles = [
    "centered medium shot",
    "slightly angled medium close-up",
    "comfortable wide shot",
    "intimate close-up",
    "three-quarter medium shot",
  ];
  
  const simpleMotion = [
    "speaking naturally with subtle gestures",
    "engaging warmly with expressive delivery",
    "presenting confidently with clear diction",
    "communicating authentically with natural energy",
    "delivering thoughtfully with measured pace",
  ];
  
  const angle = simpleAngles[clipIndex % simpleAngles.length];
  const motion = simpleMotion[clipIndex % simpleMotion.length];
  
  const sceneContext = sceneDescription?.trim() 
    ? `Scene: ${sceneDescription.trim()}.`
    : "Professional studio setting.";
  
  return `${sceneContext} ${angle} of the person ${motion}: "${scriptExcerpt.substring(0, 80)}${scriptExcerpt.length > 80 ? '...' : ''}". Professional lighting, sharp focus, natural colors, high-quality video.`;
}

/**
 * Get a descriptive label for the current clip's style (for UI display)
 */
export function getStyleDescription(clipIndex: number): string {
  const style = getClipCinematicStyle(clipIndex, 10);
  const styleLabels: Record<string, string> = {
    dolly_in: "Push-In",
    dolly_out: "Pull-Back", 
    tracking_left: "Track Left",
    tracking_right: "Track Right",
    crane_up: "Crane Up",
    crane_down: "Crane Down",
    orbit_left: "Arc Left",
    orbit_right: "Arc Right",
    steadicam_follow: "Steadicam",
    handheld_intimate: "Handheld",
    static_locked: "Locked",
    push_focus: "Push Focus",
  };
  
  return styleLabels[style.cameraMovement] || "Dynamic";
}
