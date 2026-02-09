/**
 * WORLD-CLASS CINEMATOGRAPHY ENGINE v2.0
 * 
 * Hollywood-grade camera work, dynamic movement system, and scene journeys
 * Ensures each clip is visually distinct with professional cinematography
 * Designed for maximum visual impact and variety
 * 
 * SINGLE SOURCE OF TRUTH - imported by edge functions
 */

// ============================================================================
// CAMERA MOVEMENT LIBRARY - Hollywood Standard
// ============================================================================

export const CAMERA_MOVEMENTS: Record<string, string[]> = {
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
    "subtle orbiting shot arcing counterclockwise around the subject",
    "rotational camera movement revealing multiple angles",
    "cinematic arc shot with smooth execution",
  ],
  orbit_right: [
    "clockwise orbital movement around the subject",
    "dynamic arc shot showcasing dimensional presence",
    "rotating camera perspective with cinematic fluidity",
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

export const CAMERA_ANGLES: Record<string, string[]> = {
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

export const SHOT_SIZES: Record<string, string[]> = {
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

export const LIGHTING_STYLES: Record<string, string[]> = {
  classic_key: [
    "professional three-point lighting with dominant key light",
    "balanced studio illumination with soft shadows",
    "commercial-grade lighting setup with fill and rim",
  ],
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

// CRITICAL: All motions enforce "ALREADY IN POSITION" - no entering/walking into scenes
// Avatars must start fully situated in their environment from frame 1
export const SUBJECT_MOTION: Record<string, string[]> = {
  static_confident: [
    "already positioned, standing with confident stillness and grounded presence",
    "already in place, static but alive with subtle weight shifts",
    "already situated, poised and centered with controlled energy",
  ],
  subtle_shift: [
    "already positioned, with gentle weight shifts and natural micro-movements",
    "already in place, with subtle swaying and organic rhythm",
    "already situated, with living stillness and breathing motion",
  ],
  gesture_expressive: [
    "already positioned, using expressive hand gestures punctuating speech",
    "already in place, with animated gesticulation matching verbal emphasis",
    "already situated, with dynamic hand and arm movements for engagement",
  ],
  seated_engaged: [
    "already seated with engaged forward lean",
    "already sitting comfortably with attentive posture",
    "already positioned in chair with expressive upper body",
  ],
  leaning_casual: [
    "already leaning casually against a surface with relaxed energy",
    "already positioned in comfortable lean conveying accessibility",
    "already in relaxed stance with grounded confidence",
  ],
};

// ============================================================================
// SCENE JOURNEY TEMPLATES - 21 Categories × 5 Locations Each
// ============================================================================

export const SCENE_JOURNEYS: Record<string, string[]> = {
  professional: [
    "modern executive office with floor-to-ceiling windows and city skyline view",
    "sleek conference room with minimalist design and ambient lighting",
    "stylish coffee shop with warm wood accents and natural light",
    "upscale hotel lobby with marble floors and contemporary art",
    "rooftop terrace overlooking the urban landscape at golden hour",
  ],
  creative: [
    "artistic loft studio with exposed brick and creative installations",
    "trendy gallery space with white walls and dramatic spotlights",
    "bohemian café with eclectic décor and vintage furniture",
    "outdoor urban art district with colorful murals",
    "modern design studio with sleek workstations and inspiration boards",
  ],
  lifestyle: [
    "cozy living room with warm lighting and comfortable seating",
    "bright modern kitchen with marble countertops",
    "peaceful garden patio with lush greenery and soft daylight",
    "charming bookstore with wooden shelves and reading nooks",
    "scenic walking path through a park with dappled sunlight",
  ],
  tech: [
    "futuristic tech hub with holographic displays and neon accents",
    "modern startup office with open floor plan and creative zones",
    "sleek data center with server racks and blue lighting",
    "innovation lab with prototype displays and collaborative spaces",
    "high-rise observation deck with panoramic city views at dusk",
  ],
  cinematic: [
    "dramatic film noir setting with venetian blinds and moody shadows",
    "elegant theater backstage with velvet curtains and stage lights",
    "atmospheric jazz lounge with dim lighting and vintage aesthetic",
    "grand library with towering bookshelves and warm lamplight",
    "art deco penthouse with city lights twinkling through windows",
  ],
  education: [
    "prestigious university lecture hall with wooden accents and natural light",
    "intimate seminar room with whiteboard and scholarly atmosphere",
    "grand academic library with arched windows and reading tables",
    "modern research lab with scientific equipment and clean lines",
    "campus courtyard with historic architecture and autumn leaves",
  ],
  medical: [
    "modern medical office with clean lines and calming blue accents",
    "state-of-the-art hospital atrium with natural light and greenery",
    "private consultation room with warm, reassuring décor",
    "wellness center with zen-inspired minimalist design",
    "outdoor healing garden with water features and serenity",
  ],
  legal: [
    "distinguished law firm office with mahogany furniture and legal tomes",
    "impressive courthouse rotunda with marble columns and natural light",
    "private boardroom with panoramic views and leather seating",
    "elegant client reception area with tasteful art and soft lighting",
    "rooftop legal office with city skyline at twilight",
  ],
  finance: [
    "prestigious trading floor with multiple screens and dynamic energy",
    "private wealth management office with refined elegance",
    "modern bank headquarters lobby with architectural grandeur",
    "exclusive client lounge with city views and premium finishes",
    "historic financial district exterior with iconic architecture",
  ],
  fitness: [
    "modern gym facility with state-of-the-art equipment and mirrors",
    "peaceful yoga studio with bamboo floors and soft natural light",
    "outdoor training area with scenic mountain backdrop",
    "luxury spa reception with calming water features",
    "rooftop wellness deck overlooking the city at sunrise",
  ],
  travel: [
    "luxury airport lounge with panoramic runway views",
    "boutique hotel suite with floor-to-ceiling ocean views",
    "exotic marketplace with vibrant colors and local atmosphere",
    "scenic overlook at a dramatic coastal cliff",
    "charming European café on a cobblestone street at sunset",
  ],
  culinary: [
    "professional chef's kitchen with stainless steel and copper accents",
    "upscale restaurant dining room with elegant table settings",
    "rustic farmhouse kitchen with exposed beams and natural warmth",
    "outdoor farmers market with colorful produce displays",
    "rooftop bar with city lights and craft cocktail atmosphere",
  ],
  nature: [
    "serene lakeside dock with morning mist and calm waters",
    "lush forest clearing with dappled sunlight through trees",
    "dramatic mountain peak overlook at golden hour",
    "peaceful beach with gentle waves and sunset colors",
    "botanical garden greenhouse with exotic plants and humid warmth",
  ],
  entertainment: [
    "professional recording studio with soundproof walls and mixing boards",
    "intimate concert venue with dramatic stage lighting",
    "backstage dressing room with Hollywood-style mirror lights",
    "rooftop party venue with city skyline and festive atmosphere",
    "elegant gala ballroom with crystal chandeliers and formal décor",
  ],
  realestate: [
    "stunning penthouse living room with floor-to-ceiling windows",
    "modern kitchen showroom with premium appliances and finishes",
    "luxurious master bedroom with designer furnishings",
    "impressive home office with built-in shelving and city views",
    "expansive backyard with pool and outdoor living space",
  ],
  fashion: [
    "high-end fashion boutique with minimalist displays and soft lighting",
    "professional photo studio with backdrop and fashion lighting",
    "luxury beauty salon with elegant mirrors and décor",
    "designer atelier with fabric swatches and dress forms",
    "fashion show backstage with models and creative chaos",
  ],
  spiritual: [
    "peaceful meditation room with soft cushions and candles",
    "zen garden with raked sand and carefully placed stones",
    "ancient temple interior with warm amber lighting",
    "mountain retreat cabin with panoramic nature views",
    "sunrise yoga platform overlooking misty valleys",
  ],
  gaming: [
    "professional esports arena with LED displays and team branding",
    "high-end gaming setup with RGB lighting and multiple monitors",
    "game development studio with concept art on walls",
    "streaming room with professional audio setup and green screen",
    "gaming lounge with arcade machines and neon accents",
  ],
  science: [
    "cutting-edge research laboratory with high-tech equipment",
    "space mission control center with multiple displays",
    "observatory dome with telescope and starry views",
    "marine biology lab with aquarium tanks and specimens",
    "clean room facility with advanced manufacturing equipment",
  ],
  luxury: [
    "private jet interior with cream leather and champagne service",
    "yacht deck with ocean views and premium furnishings",
    "five-star hotel presidential suite with opulent décor",
    "exclusive members club with velvet seating and cigar lounge",
    "luxury car showroom with spotlit vehicles and marble floors",
  ],
};

// ============================================================================
// CLIP SEQUENCE PROGRESSION ARRAYS
// ============================================================================

export const MOVEMENT_PROGRESSION = [
  'dolly_in', 'tracking_right', 'crane_up', 'orbit_left', 'dolly_out',
  'steadicam_follow', 'tracking_left', 'crane_down', 'orbit_right', 'push_focus',
];

export const ANGLE_PROGRESSION = [
  'eye_level_offset', 'low_angle_subtle', 'three_quarter_left', 'high_angle_gentle',
  'dutch_subtle', 'three_quarter_right', 'low_angle_dramatic', 'eye_level_centered',
  'over_shoulder_left', 'profile_silhouette',
];

export const SIZE_PROGRESSION = [
  'medium', 'medium_close', 'wide', 'close_up', 'medium_wide',
  'medium', 'extreme_close_up', 'medium_wide', 'close_up', 'wide',
];

export const LIGHTING_PROGRESSION = [
  'classic_key', 'rembrandt', 'golden_hour', 'chiaroscuro', 'rim_dramatic',
  'overcast_soft', 'neon_accent', 'volumetric', 'blue_hour', 'classic_key',
];

// CRITICAL: No walking/movement into scene - avatars must START already positioned
// Walking motions removed to ensure avatars begin IN their environment, not moving into it
export const MOTION_PROGRESSION = [
  'gesture_expressive', 'subtle_shift', 'static_confident', 'gesture_expressive',
  'leaning_casual', 'subtle_shift', 'gesture_expressive', 'seated_engaged',
  'static_confident', 'subtle_shift',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Select a random prompt from a category
 */
export function selectPrompt(prompts: string[]): string {
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Detect the appropriate journey type based on base scene description
 */
export function detectJourneyType(baseScene: string | undefined): string {
  if (!baseScene) return 'professional';
  
  const lower = baseScene.toLowerCase();
  
  if (lower.includes('tech') || lower.includes('future') || lower.includes('digital') || lower.includes('cyber') || lower.includes('startup') || lower.includes('coding')) return 'tech';
  if (lower.includes('art') || lower.includes('creative') || lower.includes('gallery') || lower.includes('paint') || lower.includes('design')) return 'creative';
  if (lower.includes('home') || lower.includes('cozy') || lower.includes('casual') || lower.includes('relax')) return 'lifestyle';
  if (lower.includes('film') || lower.includes('dramatic') || lower.includes('noir') || lower.includes('theater') || lower.includes('movie')) return 'cinematic';
  if (lower.includes('school') || lower.includes('university') || lower.includes('education') || lower.includes('learn') || lower.includes('teach') || lower.includes('lecture') || lower.includes('academic')) return 'education';
  if (lower.includes('medical') || lower.includes('health') || lower.includes('hospital') || lower.includes('doctor') || lower.includes('clinic') || lower.includes('wellness')) return 'medical';
  if (lower.includes('legal') || lower.includes('law') || lower.includes('court') || lower.includes('attorney') || lower.includes('corporate')) return 'legal';
  if (lower.includes('finance') || lower.includes('bank') || lower.includes('invest') || lower.includes('trading') || lower.includes('wealth') || lower.includes('money')) return 'finance';
  if (lower.includes('fitness') || lower.includes('gym') || lower.includes('workout') || lower.includes('yoga') || lower.includes('exercise') || lower.includes('sport')) return 'fitness';
  if (lower.includes('travel') || lower.includes('adventure') || lower.includes('vacation') || lower.includes('hotel') || lower.includes('airport') || lower.includes('destination')) return 'travel';
  if (lower.includes('food') || lower.includes('culinary') || lower.includes('chef') || lower.includes('restaurant') || lower.includes('kitchen') || lower.includes('cook')) return 'culinary';
  if (lower.includes('nature') || lower.includes('outdoor') || lower.includes('forest') || lower.includes('mountain') || lower.includes('beach') || lower.includes('garden') || lower.includes('lake')) return 'nature';
  if (lower.includes('music') || lower.includes('entertainment') || lower.includes('concert') || lower.includes('studio') || lower.includes('perform') || lower.includes('party')) return 'entertainment';
  if (lower.includes('real estate') || lower.includes('property') || lower.includes('house') || lower.includes('architect') || lower.includes('interior')) return 'realestate';
  if (lower.includes('fashion') || lower.includes('beauty') || lower.includes('style') || lower.includes('boutique') || lower.includes('model') || lower.includes('runway')) return 'fashion';
  if (lower.includes('spiritual') || lower.includes('meditation') || lower.includes('mindful') || lower.includes('zen') || lower.includes('temple') || lower.includes('retreat')) return 'spiritual';
  if (lower.includes('gaming') || lower.includes('esport') || lower.includes('stream') || lower.includes('game') || lower.includes('arcade') || lower.includes('video game')) return 'gaming';
  if (lower.includes('science') || lower.includes('research') || lower.includes('lab') || lower.includes('experiment') || lower.includes('space') || lower.includes('discover')) return 'science';
  if (lower.includes('luxury') || lower.includes('premium') || lower.includes('exclusive') || lower.includes('yacht') || lower.includes('private jet') || lower.includes('vip')) return 'luxury';
  
  return 'professional';
}

/**
 * Get scene description for a specific clip in the sequence
 * Creates a coherent visual journey across the video
 */
export function getProgressiveScene(
  baseScene: string | undefined,
  clipIndex: number,
  totalClips: number
): string {
  // For 1-2 clips, use the same scene throughout
  if (totalClips < 3) {
    return baseScene?.trim() || "professional studio with cinematic lighting";
  }
  
  // Detect journey type from base scene description
  const journeyType = detectJourneyType(baseScene);
  const journey = SCENE_JOURNEYS[journeyType];
  
  // Calculate how many scene changes based on clip count
  // 3-4 clips: 2 scenes, 5-6 clips: 3 scenes, 7+ clips: 4-5 scenes
  const sceneChangeCount = Math.min(journey.length, Math.ceil(totalClips / 2));
  
  // Determine which scene this clip should use
  const sceneIndex = Math.floor((clipIndex / totalClips) * sceneChangeCount);
  return journey[Math.min(sceneIndex, journey.length - 1)];
}

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
  const idx = clipIndex % 10;
  
  return {
    cameraMovement: MOVEMENT_PROGRESSION[idx],
    cameraAngle: ANGLE_PROGRESSION[idx],
    shotSize: SIZE_PROGRESSION[idx],
    lighting: LIGHTING_PROGRESSION[idx],
    subjectMotion: MOTION_PROGRESSION[idx],
  };
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
  const movementPrompt = selectPrompt(CAMERA_MOVEMENTS[style.cameraMovement] || CAMERA_MOVEMENTS.static_locked);
  const anglePrompt = selectPrompt(CAMERA_ANGLES[style.cameraAngle] || CAMERA_ANGLES.eye_level_centered);
  const sizePrompt = selectPrompt(SHOT_SIZES[style.shotSize] || SHOT_SIZES.medium);
  const lightingPrompt = selectPrompt(LIGHTING_STYLES[style.lighting] || LIGHTING_STYLES.classic_key);
  const motionPrompt = selectPrompt(SUBJECT_MOTION[style.subjectMotion] || SUBJECT_MOTION.gesture_expressive);
  
  // DYNAMIC SCENE PROGRESSION
  const progressiveScene = getProgressiveScene(sceneDescription, clipIndex, totalClips);
  const sceneContext = `Cinematic scene in ${progressiveScene}, shot with professional cinematography.`;
  
  const qualityBaseline = "Ultra-high definition 4K quality, film-grain texture, natural skin tones, professional color grading, cinematic depth of field, award-winning cinematography.";
  
  return `${sceneContext} ${sizePrompt}. ${anglePrompt}. ${movementPrompt}. ${lightingPrompt}. The subject is ${motionPrompt}, speaking naturally with authentic emotion: "${scriptExcerpt.substring(0, 80)}${scriptExcerpt.length > 80 ? '...' : ''}". Lifelike fluid movements, natural micro-expressions, authentic lip sync, subtle breathing motion, realistic eye movements and blinks. ${qualityBaseline}`;
}

/**
 * Build a simple variety prompt when cinematic mode is disabled
 */
export function buildStandardVarietyPrompt(
  clipIndex: number,
  scriptExcerpt: string,
  sceneDescription?: string
): string {
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
