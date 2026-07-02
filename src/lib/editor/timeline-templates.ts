/**
 * The 50 — one-click timeline templates for the editor.
 *
 * Each is a complete LOOK + PACING + AUDIO recipe consumed by
 * applyTimelineTemplate(). Organized into 10 categories × 5 templates.
 * Vertical (9:16) and portrait (4:5) templates are flagged `mobileFirst`
 * so the picker can surface them first on phones.
 *
 * Looks are CSS filter strings (the editor's lightweight grade); transitions
 * map 1:1 to the ffmpeg xfade names so the bake reproduces them exactly.
 */
import type { TimelineTemplate } from "./timeline-template-apply";

// ── Shared looks (CSS filter grades) ────────────────────────────────────────
const LOOK = {
  tealOrange: "contrast(1.12) saturate(1.18) brightness(0.99) sepia(0.06)",
  noir: "grayscale(1) contrast(1.32) brightness(0.95)",
  warmVintage: "sepia(0.24) saturate(1.2) contrast(1.06) brightness(1.02)",
  coldThriller: "contrast(1.16) saturate(0.86) brightness(0.95) hue-rotate(-8deg)",
  vibrant: "saturate(1.42) contrast(1.12) brightness(1.05)",
  dreamy: "brightness(1.08) saturate(1.12) contrast(0.95)",
  punchy: "contrast(1.22) saturate(1.32) brightness(1.03)",
  pastel: "saturate(1.12) brightness(1.07) contrast(0.95) sepia(0.05)",
  moody: "contrast(1.2) saturate(0.9) brightness(0.9)",
  clean: "contrast(1.05) saturate(1.06) brightness(1.02)",
  goldenHour: "sepia(0.18) saturate(1.28) brightness(1.05) contrast(1.04)",
  neon: "saturate(1.5) contrast(1.18) brightness(1.04) hue-rotate(4deg)",
} as const;

// Each CSS look → the closest BAKEABLE LUT (from lut-library.ts). The CSS
// filter is preview-only; this LUT is what the stitcher actually bakes, so the
// exported video matches the previewed look. Keyed by the LOOK value so every
// template that uses LOOK.x automatically gets a graded export (see mk()).
const LOOK_LUT: Record<string, string> = {
  [LOOK.tealOrange]: "teal-orange",
  [LOOK.noir]: "noir",
  [LOOK.warmVintage]: "portra-400",
  [LOOK.coldThriller]: "fincher-cold",
  [LOOK.vibrant]: "punch-up",
  [LOOK.dreamy]: "dreampunk",
  [LOOK.punchy]: "punch-up",
  [LOOK.pastel]: "anderson-budapest",
  [LOOK.moody]: "moonlight",
  [LOOK.clean]: "rec709-show",
  [LOOK.goldenHour]: "kodak-2383",
  [LOOK.neon]: "80s-neon",
};

const G = {
  ember: ["#f59e0b", "#7c2d12"] as [string, string],
  ocean: ["#22d3ee", "#0c4a6e"] as [string, string],
  violet: ["#a78bfa", "#3b0764"] as [string, string],
  rose: ["#fb7185", "#831843"] as [string, string],
  forest: ["#34d399", "#064e3b"] as [string, string],
  slate: ["#94a3b8", "#0f172a"] as [string, string],
  gold: ["#fcd34d", "#78350f"] as [string, string],
  ink: ["#cbd5e1", "#020617"] as [string, string],
  candy: ["#f472b6", "#7e22ce"] as [string, string],
  sky: ["#7dd3fc", "#1e3a8a"] as [string, string],
};

/** Tiny builder to keep 50 entries readable without losing type-safety.
 *  Auto-derives the bakeable `lutId` from the template's CSS look (unless one
 *  was set explicitly) so EVERY template's grade actually reaches the export. */
function mk(t: TimelineTemplate): TimelineTemplate {
  return { ...t, lutId: t.lutId ?? LOOK_LUT[t.filter] };
}

export const TIMELINE_TEMPLATES: TimelineTemplate[] = [
  // ── Cinematic (16:9) ──────────────────────────────────────────────────────
  mk({
    id: "cine-epic", name: "Epic Opener", description: "Slow push-ins, deep teal-orange grade, a swelling score.",
    category: "cinematic", aspectRatio: "16:9", vibe: "Grand", filter: LOOK.tealOrange,
    transition: "fadeblack", transitionDurationSec: 0.6, fadeInSec: 0.8, fadeOutSec: 0.8, speed: 0.95,
    slots: [
      { prompt: "Sweeping aerial over a mountain range at dawn, volumetric light", durationSec: 5 },
      { prompt: "Lone figure walking toward camera, dramatic backlight", durationSec: 4 },
      { prompt: "Extreme close-up of determined eyes, shallow depth of field", durationSec: 3 },
      { prompt: "Wide reveal of a vast city skyline, golden hour", durationSec: 5 },
    ],
    introTitle: "BEGINS", outroTitle: "THE STORY", music: "strings", gradient: G.ember,
  }),
  mk({
    id: "cine-noir", name: "Neo Noir", description: "High-contrast black & white, hard cuts, rain-soaked tension.",
    category: "cinematic", aspectRatio: "16:9", vibe: "Moody", filter: LOOK.noir,
    transition: "dissolve", transitionDurationSec: 0.4, fadeInSec: 0.5, fadeOutSec: 0.6,
    slots: [
      { prompt: "Rain-slick city street at night, neon reflections, noir mood", durationSec: 4 },
      { prompt: "Silhouette in a doorway, venetian-blind shadows", durationSec: 3 },
      { prompt: "Cigarette smoke curling in a single shaft of light", durationSec: 3 },
      { prompt: "Detective's hand on a revolver under a desk lamp", durationSec: 4 },
    ],
    introTitle: "CHAPTER ONE", outroTitle: "TO BE CONTINUED", music: "strings", gradient: G.ink,
  }),
  mk({
    id: "cine-thriller", name: "Cold Thriller", description: "Desaturated, clinical, a creeping unease.",
    category: "cinematic", aspectRatio: "16:9", vibe: "Tense", filter: LOOK.coldThriller,
    transition: "fade", transitionDurationSec: 0.35, fadeInSec: 0.4, fadeOutSec: 0.5,
    slots: [
      { prompt: "Empty corridor with flickering fluorescent lights", durationSec: 4 },
      { prompt: "Close-up of a clock ticking past midnight", durationSec: 3 },
      { prompt: "Figure glimpsed through frosted glass", durationSec: 3 },
      { prompt: "Wide shot of an isolated house under a grey sky", durationSec: 5 },
    ],
    introTitle: "11:59 PM", outroTitle: "RUN", music: "swell", gradient: G.slate,
  }),
  mk({
    id: "cine-golden", name: "Golden Hour Drama", description: "Warm, romantic, sun-flared and tender.",
    category: "cinematic", aspectRatio: "16:9", vibe: "Warm", filter: LOOK.goldenHour,
    transition: "fadewhite", transitionDurationSec: 0.6, fadeInSec: 0.9, fadeOutSec: 0.9, speed: 0.9,
    slots: [
      { prompt: "Couple laughing in a field at sunset, lens flare", durationSec: 5 },
      { prompt: "Hands intertwining, soft golden backlight", durationSec: 3 },
      { prompt: "Slow walk along a beach as the sun dips", durationSec: 5 },
    ],
    introTitle: "ALWAYS", outroTitle: "FOREVER", music: "mountain", gradient: G.gold,
  }),
  mk({
    id: "cine-scifi", name: "Sci-Fi Cold Open", description: "Steely blues, radial wipes, a vast unknown.",
    category: "cinematic", aspectRatio: "21:9", vibe: "Vast", filter: LOOK.coldThriller,
    transition: "radial", transitionDurationSec: 0.5, fadeInSec: 0.6, fadeOutSec: 0.7,
    slots: [
      { prompt: "Spacecraft drifting past a ringed planet, cinematic scale", durationSec: 5 },
      { prompt: "Astronaut floating, reflection of stars in the visor", durationSec: 4 },
      { prompt: "Vast alien landscape under twin moons", durationSec: 5 },
    ],
    introTitle: "YEAR 2199", outroTitle: "FIRST CONTACT", music: "swell", gradient: G.sky,
  }),

  // ── Social / Vertical (9:16) ──────────────────────────────────────────────
  mk({
    id: "social-hook", name: "Scroll-Stopper", description: "Punchy vertical hook, fast cuts, bold energy.",
    category: "social", aspectRatio: "9:16", vibe: "Punchy", filter: LOOK.punchy, mobileFirst: true,
    transition: "slideleft", transitionDurationSec: 0.25, fadeInSec: 0.2, fadeOutSec: 0.2,
    slots: [
      { prompt: "Creator pointing at camera with an excited expression, vertical", durationSec: 2 },
      { prompt: "Fast product reveal on a colorful background", durationSec: 2 },
      { prompt: "Quick reaction shot, big smile, studio lighting", durationSec: 2 },
      { prompt: "Bold text-friendly clean background for a call to action", durationSec: 3 },
    ],
    introTitle: "WAIT FOR IT", outroTitle: "FOLLOW FOR MORE", music: "swell", gradient: G.candy,
  }),
  mk({
    id: "social-grwm", name: "GRWM Vertical", description: "Soft pastel vlog look for get-ready-with-me.",
    category: "social", aspectRatio: "9:16", vibe: "Soft", filter: LOOK.pastel, mobileFirst: true,
    transition: "fade", transitionDurationSec: 0.3, fadeInSec: 0.3, fadeOutSec: 0.3,
    slots: [
      { prompt: "Person at a vanity mirror, soft natural light, vertical", durationSec: 3 },
      { prompt: "Close-up applying makeup, cozy aesthetic", durationSec: 3 },
      { prompt: "Outfit reveal twirl in a bright bedroom", durationSec: 3 },
    ],
    introTitle: "GRWM", outroTitle: "READY ✨", music: "mountain", gradient: G.rose,
  }),
  mk({
    id: "social-neon", name: "Neon Night Out", description: "Saturated neon, slide cuts, club energy.",
    category: "social", aspectRatio: "9:16", vibe: "Neon", filter: LOOK.neon, mobileFirst: true,
    transition: "slideup", transitionDurationSec: 0.22, fadeInSec: 0.2, fadeOutSec: 0.2,
    slots: [
      { prompt: "Friends walking through neon-lit streets at night, vertical", durationSec: 2 },
      { prompt: "Cocktails clinking under colorful bar lights", durationSec: 2 },
      { prompt: "Dance floor with vivid laser lights", durationSec: 3 },
    ],
    introTitle: "TONIGHT", outroTitle: "📍", music: "swell", gradient: G.violet,
  }),
  mk({
    id: "social-asmr", name: "Cozy ASMR", description: "Dreamy, slow, satisfying close-ups.",
    category: "social", aspectRatio: "9:16", vibe: "Calm", filter: LOOK.dreamy, mobileFirst: true,
    transition: "dissolve", transitionDurationSec: 0.5, fadeInSec: 0.5, fadeOutSec: 0.5, speed: 0.85,
    slots: [
      { prompt: "Macro of coffee being poured slowly, steam rising, vertical", durationSec: 4 },
      { prompt: "Hands kneading dough in warm light", durationSec: 4 },
      { prompt: "Candle flame flickering in a cozy room", durationSec: 3 },
    ],
    introTitle: "breathe", outroTitle: "🤍", music: "mountain", gradient: G.gold,
  }),
  mk({
    id: "social-meme", name: "Meme Cut", description: "Hard zooms, vibrant, comedic timing.",
    category: "social", aspectRatio: "9:16", vibe: "Funny", filter: LOOK.vibrant, mobileFirst: true,
    transition: "fadeblack", transitionDurationSec: 0.15, fadeInSec: 0.1, fadeOutSec: 0.1,
    slots: [
      { prompt: "Exaggerated surprised reaction, zoom in, vertical", durationSec: 2 },
      { prompt: "Deadpan stare at camera, comedic", durationSec: 2 },
      { prompt: "Chaotic background gag moment", durationSec: 2 },
    ],
    introTitle: "POV:", outroTitle: "LMAO", music: "swell", gradient: G.candy,
  }),

  // ── Vlog ──────────────────────────────────────────────────────────────────
  mk({
    id: "vlog-daily", name: "Daily Vlog", description: "Clean handheld look, breezy cuts.",
    category: "vlog", aspectRatio: "16:9", vibe: "Casual", filter: LOOK.clean,
    transition: "fade", transitionDurationSec: 0.3, fadeInSec: 0.3, fadeOutSec: 0.3,
    slots: [
      { prompt: "Morning coffee by a sunny window, handheld feel", durationSec: 3 },
      { prompt: "Walking through a busy market, POV", durationSec: 4 },
      { prompt: "Working at a laptop in a cozy cafe", durationSec: 3 },
      { prompt: "Sunset from a rooftop, end of day", durationSec: 4 },
    ],
    introTitle: "a day with me", outroTitle: "see you tomorrow", music: "mountain", gradient: G.sky,
  }),
  mk({
    id: "vlog-travel-diary", name: "Travel Diary", description: "Warm vintage film, nostalgic pacing.",
    category: "vlog", aspectRatio: "16:9", vibe: "Nostalgic", filter: LOOK.warmVintage,
    transition: "fadewhite", transitionDurationSec: 0.5, fadeInSec: 0.5, fadeOutSec: 0.5,
    slots: [
      { prompt: "Vintage train window with countryside rolling by", durationSec: 4 },
      { prompt: "Old town cobblestone street, warm afternoon", durationSec: 4 },
      { prompt: "Local cafe table with postcards and a map", durationSec: 3 },
    ],
    introTitle: "Day 1", outroTitle: "until next time", music: "mountain", gradient: G.gold,
  }),
  mk({
    id: "vlog-cook", name: "Kitchen Story", description: "Bright, appetizing, top-down food beats.",
    category: "vlog", aspectRatio: "16:9", vibe: "Tasty", filter: LOOK.vibrant,
    transition: "dissolve", transitionDurationSec: 0.35, fadeInSec: 0.3, fadeOutSec: 0.3,
    slots: [
      { prompt: "Top-down of fresh ingredients laid on a wood board", durationSec: 3 },
      { prompt: "Sizzling pan close-up, steam and butter", durationSec: 3 },
      { prompt: "Final plated dish, garnish drop in slow motion", durationSec: 4 },
    ],
    introTitle: "let's cook", outroTitle: "bon appétit", music: "mountain", gradient: G.ember,
  }),
  mk({
    id: "vlog-fitness", name: "Fitness Journey", description: "Punchy, energetic, motivational cuts.",
    category: "vlog", aspectRatio: "9:16", vibe: "Driven", filter: LOOK.punchy, mobileFirst: true,
    transition: "slideleft", transitionDurationSec: 0.25, fadeInSec: 0.2, fadeOutSec: 0.2,
    slots: [
      { prompt: "Lacing up running shoes at dawn, vertical", durationSec: 2 },
      { prompt: "Sprint down an empty road, dynamic motion", durationSec: 3 },
      { prompt: "Triumphant finish, arms raised, sunrise", durationSec: 3 },
    ],
    introTitle: "DAY 1", outroTitle: "KEEP GOING", music: "strings", gradient: G.forest,
  }),
  mk({
    id: "vlog-study", name: "Study With Me", description: "Calm pastel focus, gentle pacing.",
    category: "vlog", aspectRatio: "16:9", vibe: "Focused", filter: LOOK.pastel,
    transition: "fade", transitionDurationSec: 0.4, fadeInSec: 0.4, fadeOutSec: 0.4, speed: 0.95,
    slots: [
      { prompt: "Desk with notebooks, soft lamp, rainy window", durationSec: 4 },
      { prompt: "Pen writing in a journal, close-up", durationSec: 3 },
      { prompt: "Cup of tea steaming beside an open book", durationSec: 4 },
    ],
    introTitle: "focus", outroTitle: "good work", music: "swell", gradient: G.sky,
  }),

  // ── Commercial ────────────────────────────────────────────────────────────
  mk({
    id: "com-product", name: "Product Hero", description: "Crisp punchy look, snappy reveals.",
    category: "commercial", aspectRatio: "16:9", vibe: "Crisp", filter: LOOK.punchy,
    transition: "wipeleft", transitionDurationSec: 0.3, fadeInSec: 0.3, fadeOutSec: 0.3,
    slots: [
      { prompt: "Product rotating on a clean seamless backdrop, studio light", durationSec: 3 },
      { prompt: "Macro detail of the product's texture", durationSec: 2 },
      { prompt: "Product in use by a happy person, bright setting", durationSec: 3 },
      { prompt: "Logo-ready clean end frame", durationSec: 3 },
    ],
    introTitle: "INTRODUCING", outroTitle: "AVAILABLE NOW", music: "strings", gradient: G.ocean,
  }),
  mk({
    id: "com-fashion", name: "Fashion Spot", description: "Editorial, high-contrast, runway energy.",
    category: "commercial", aspectRatio: "9:16", vibe: "Editorial", filter: LOOK.moody, mobileFirst: true,
    transition: "slideup", transitionDurationSec: 0.25, fadeInSec: 0.2, fadeOutSec: 0.3,
    slots: [
      { prompt: "Model striding toward camera, studio strobe, vertical", durationSec: 2 },
      { prompt: "Fabric flowing in slow motion, dramatic light", durationSec: 3 },
      { prompt: "Confident pose, bold styling, seamless backdrop", durationSec: 2 },
    ],
    introTitle: "NEW SEASON", outroTitle: "THE COLLECTION", music: "swell", gradient: G.candy,
  }),
  mk({
    id: "com-tech", name: "Tech Launch", description: "Sleek cold blues, radial reveals.",
    category: "commercial", aspectRatio: "16:9", vibe: "Sleek", filter: LOOK.coldThriller,
    transition: "radial", transitionDurationSec: 0.4, fadeInSec: 0.4, fadeOutSec: 0.4,
    slots: [
      { prompt: "Device materializing from particles on black, premium", durationSec: 3 },
      { prompt: "Screen UI animating, macro close-up", durationSec: 3 },
      { prompt: "Hand holding the device, soft rim light", durationSec: 3 },
    ],
    introTitle: "THE FUTURE", outroTitle: "PRE-ORDER", music: "swell", gradient: G.slate,
  }),
  mk({
    id: "com-food", name: "Food Commercial", description: "Mouth-watering, vibrant, slow drips.",
    category: "commercial", aspectRatio: "16:9", vibe: "Juicy", filter: LOOK.vibrant,
    transition: "dissolve", transitionDurationSec: 0.35, fadeInSec: 0.3, fadeOutSec: 0.3, speed: 0.9,
    slots: [
      { prompt: "Burger stacked in slow motion, sauce dripping, macro", durationSec: 3 },
      { prompt: "Fresh ingredients tossed in the air, studio light", durationSec: 3 },
      { prompt: "Final dish glistening under warm light", durationSec: 3 },
    ],
    introTitle: "CRAVING?", outroTitle: "ORDER NOW", music: "mountain", gradient: G.ember,
  }),
  mk({
    id: "com-realestate", name: "Real Estate Tour", description: "Clean, bright, smooth glide reveals.",
    category: "commercial", aspectRatio: "16:9", vibe: "Bright", filter: LOOK.clean,
    transition: "smoothleft", transitionDurationSec: 0.5, fadeInSec: 0.5, fadeOutSec: 0.5,
    slots: [
      { prompt: "Glide through a sunlit modern living room", durationSec: 4 },
      { prompt: "Kitchen with marble counters, soft daylight", durationSec: 3 },
      { prompt: "Backyard pool at golden hour, wide", durationSec: 4 },
    ],
    introTitle: "FOR SALE", outroTitle: "BOOK A VIEWING", music: "mountain", gradient: G.sky,
  }),

  // ── Trailer ───────────────────────────────────────────────────────────────
  mk({
    id: "trailer-action", name: "Action Trailer", description: "Hard fade-to-blacks, escalating cuts.",
    category: "trailer", aspectRatio: "21:9", vibe: "Explosive", filter: LOOK.tealOrange,
    transition: "fadeblack", transitionDurationSec: 0.3, fadeInSec: 0.3, fadeOutSec: 0.4,
    slots: [
      { prompt: "Hero turning toward an explosion in slow motion", durationSec: 3 },
      { prompt: "Car chase through a tunnel, motion blur", durationSec: 3 },
      { prompt: "Close-up of a clenched fist, sparks", durationSec: 2 },
      { prompt: "Massive set-piece wide shot, debris flying", durationSec: 4 },
    ],
    introTitle: "THIS SUMMER", outroTitle: "COMING SOON", music: "strings", gradient: G.ember,
  }),
  mk({
    id: "trailer-horror", name: "Horror Teaser", description: "Pitch-dark, sudden cuts, dread.",
    category: "trailer", aspectRatio: "16:9", vibe: "Dread", filter: LOOK.moody,
    transition: "fadeblack", transitionDurationSec: 0.5, fadeInSec: 0.6, fadeOutSec: 0.8,
    slots: [
      { prompt: "Dark hallway, a door creaking open by itself", durationSec: 4 },
      { prompt: "Pale figure standing motionless in shadow", durationSec: 2 },
      { prompt: "Flashlight beam revealing something on the wall", durationSec: 3 },
    ],
    introTitle: "DON'T", outroTitle: "LOOK BACK", music: "swell", gradient: G.ink,
  }),
  mk({
    id: "trailer-doc", name: "Documentary", description: "Honest, warm, contemplative pacing.",
    category: "trailer", aspectRatio: "16:9", vibe: "Honest", filter: LOOK.warmVintage,
    transition: "fade", transitionDurationSec: 0.5, fadeInSec: 0.6, fadeOutSec: 0.6, speed: 0.95,
    slots: [
      { prompt: "Weathered hands working a craft, natural light", durationSec: 4 },
      { prompt: "Portrait of an elder looking off-camera", durationSec: 4 },
      { prompt: "Wide landscape that shaped a life", durationSec: 5 },
    ],
    introTitle: "A TRUE STORY", outroTitle: "THEIR JOURNEY", music: "mountain", gradient: G.gold,
  }),
  mk({
    id: "trailer-fantasy", name: "Fantasy Epic", description: "Lush teal-orange, sweeping reveals.",
    category: "trailer", aspectRatio: "21:9", vibe: "Mythic", filter: LOOK.tealOrange,
    transition: "fadewhite", transitionDurationSec: 0.6, fadeInSec: 0.8, fadeOutSec: 0.8,
    slots: [
      { prompt: "Castle on a cliff above a sea of clouds", durationSec: 5 },
      { prompt: "Warrior drawing a glowing sword", durationSec: 3 },
      { prompt: "Dragon rising over a burning forest", durationSec: 4 },
    ],
    introTitle: "AN AGE OF LEGEND", outroTitle: "THE PROPHECY", music: "strings", gradient: G.forest,
  }),
  mk({
    id: "trailer-romance", name: "Romance Trailer", description: "Tender golden hues, soft white fades.",
    category: "trailer", aspectRatio: "16:9", vibe: "Tender", filter: LOOK.goldenHour,
    transition: "fadewhite", transitionDurationSec: 0.6, fadeInSec: 0.7, fadeOutSec: 0.7, speed: 0.92,
    slots: [
      { prompt: "Two people meeting eyes across a busy cafe", durationSec: 4 },
      { prompt: "Rain dance under an umbrella, laughing", durationSec: 4 },
      { prompt: "Quiet embrace at a train station goodbye", durationSec: 4 },
    ],
    introTitle: "SOMETIMES", outroTitle: "LOVE FINDS YOU", music: "mountain", gradient: G.rose,
  }),

  // ── Travel ────────────────────────────────────────────────────────────────
  mk({
    id: "travel-montage", name: "Travel Montage", description: "Vibrant, fast, wanderlust energy.",
    category: "travel", aspectRatio: "16:9", vibe: "Wander", filter: LOOK.vibrant,
    transition: "slideleft", transitionDurationSec: 0.3, fadeInSec: 0.3, fadeOutSec: 0.3,
    slots: [
      { prompt: "Plane wing above the clouds at sunrise", durationSec: 3 },
      { prompt: "Bustling foreign street market, vibrant colors", durationSec: 3 },
      { prompt: "Jumping into a turquoise ocean from a boat", durationSec: 3 },
      { prompt: "Mountaintop panorama, arms wide", durationSec: 4 },
    ],
    introTitle: "ESCAPE", outroTitle: "WHERE NEXT?", music: "mountain", gradient: G.ocean,
  }),
  mk({
    id: "travel-vertical", name: "City Reel", description: "Vertical city pulse, snappy slides.",
    category: "travel", aspectRatio: "9:16", vibe: "Urban", filter: LOOK.punchy, mobileFirst: true,
    transition: "slideup", transitionDurationSec: 0.25, fadeInSec: 0.2, fadeOutSec: 0.2,
    slots: [
      { prompt: "Looking up at skyscrapers, vertical, fast clouds", durationSec: 2 },
      { prompt: "Crossing a packed crosswalk, motion energy", durationSec: 3 },
      { prompt: "Rooftop view at blue hour, city lights", durationSec: 3 },
    ],
    introTitle: "48 HOURS IN", outroTitle: "SAVE THIS", music: "swell", gradient: G.violet,
  }),
  mk({
    id: "travel-nature", name: "Into the Wild", description: "Lush greens, smooth glides, awe.",
    category: "travel", aspectRatio: "16:9", vibe: "Serene", filter: LOOK.dreamy,
    transition: "smoothleft", transitionDurationSec: 0.5, fadeInSec: 0.5, fadeOutSec: 0.5, speed: 0.92,
    slots: [
      { prompt: "Mist rolling over a green valley at dawn", durationSec: 5 },
      { prompt: "Waterfall cascading into a clear pool", durationSec: 4 },
      { prompt: "Forest trail with sun rays through trees", durationSec: 4 },
    ],
    introTitle: "DISCONNECT", outroTitle: "BREATHE", music: "mountain", gradient: G.forest,
  }),
  mk({
    id: "travel-roadtrip", name: "Road Trip", description: "Warm film grain, easygoing fades.",
    category: "travel", aspectRatio: "16:9", vibe: "Free", filter: LOOK.warmVintage,
    transition: "fade", transitionDurationSec: 0.4, fadeInSec: 0.4, fadeOutSec: 0.4,
    slots: [
      { prompt: "Open desert highway from a car window, golden", durationSec: 4 },
      { prompt: "Gas station stop at dusk, retro vibe", durationSec: 3 },
      { prompt: "Campfire under a sky full of stars", durationSec: 4 },
    ],
    introTitle: "MILE ZERO", outroTitle: "THE LONG WAY", music: "mountain", gradient: G.gold,
  }),
  mk({
    id: "travel-luxury", name: "Luxury Escape", description: "Crisp, bright, aspirational glides.",
    category: "travel", aspectRatio: "16:9", vibe: "Lux", filter: LOOK.clean,
    transition: "smoothright", transitionDurationSec: 0.5, fadeInSec: 0.5, fadeOutSec: 0.5,
    slots: [
      { prompt: "Infinity pool overlooking a tropical sea", durationSec: 4 },
      { prompt: "Overwater villa at golden hour", durationSec: 4 },
      { prompt: "Champagne on a yacht deck, sun glinting", durationSec: 3 },
    ],
    introTitle: "PARADISE", outroTitle: "YOU DESERVE IT", music: "mountain", gradient: G.sky,
  }),

  // ── Music ─────────────────────────────────────────────────────────────────
  mk({
    id: "music-lyric", name: "Lyric Video", description: "Neon glow, beat-synced slide cuts.",
    category: "music", aspectRatio: "16:9", vibe: "Glow", filter: LOOK.neon,
    transition: "slideleft", transitionDurationSec: 0.2, fadeInSec: 0.2, fadeOutSec: 0.2,
    slots: [
      { prompt: "Abstract neon liquid flowing, music-video aesthetic", durationSec: 3 },
      { prompt: "Silhouette dancing in colored smoke", durationSec: 3 },
      { prompt: "Glowing particles swirling on black", durationSec: 3 },
    ],
    introTitle: "♪", outroTitle: "OUT NOW", music: "swell", gradient: G.violet,
  }),
  mk({
    id: "music-perf", name: "Performance Cut", description: "High-contrast stage energy, hard cuts.",
    category: "music", aspectRatio: "9:16", vibe: "Stage", filter: LOOK.moody, mobileFirst: true,
    transition: "fadeblack", transitionDurationSec: 0.2, fadeInSec: 0.2, fadeOutSec: 0.2,
    slots: [
      { prompt: "Singer at a mic under a spotlight, vertical", durationSec: 2 },
      { prompt: "Crowd hands raised in stage haze", durationSec: 2 },
      { prompt: "Guitarist mid-solo, dramatic backlight", durationSec: 3 },
    ],
    introTitle: "LIVE", outroTitle: "ENCORE", music: "strings", gradient: G.ember,
  }),
  mk({
    id: "music-lofi", name: "Lo-Fi Loop", description: "Dreamy pastel calm, slow dissolves.",
    category: "music", aspectRatio: "16:9", vibe: "Chill", filter: LOOK.pastel,
    transition: "dissolve", transitionDurationSec: 0.6, fadeInSec: 0.6, fadeOutSec: 0.6, speed: 0.85,
    slots: [
      { prompt: "Rainy window with a city blurred beyond, cozy", durationSec: 5 },
      { prompt: "Desk with headphones and a warm lamp", durationSec: 4 },
      { prompt: "Cat sleeping by a record player", durationSec: 5 },
    ],
    introTitle: "lofi beats", outroTitle: "stay cozy", music: "mountain", gradient: G.candy,
  }),
  mk({
    id: "music-edm", name: "EDM Drop", description: "Hyper-saturated, fast, festival energy.",
    category: "music", aspectRatio: "9:16", vibe: "Hype", filter: LOOK.neon, mobileFirst: true,
    transition: "slideup", transitionDurationSec: 0.15, fadeInSec: 0.1, fadeOutSec: 0.1,
    slots: [
      { prompt: "Festival crowd jumping under lasers, vertical", durationSec: 2 },
      { prompt: "DJ hands on a controller, strobe light", durationSec: 2 },
      { prompt: "Confetti exploding over a main stage", durationSec: 2 },
    ],
    introTitle: "DROP IT", outroTitle: "🔊", music: "swell", gradient: G.violet,
  }),
  mk({
    id: "music-acoustic", name: "Acoustic Session", description: "Warm intimate film, gentle fades.",
    category: "music", aspectRatio: "16:9", vibe: "Intimate", filter: LOOK.warmVintage,
    transition: "fade", transitionDurationSec: 0.5, fadeInSec: 0.5, fadeOutSec: 0.5,
    slots: [
      { prompt: "Singer with an acoustic guitar in a sunlit room", durationSec: 5 },
      { prompt: "Close-up of fingers on guitar strings", durationSec: 3 },
      { prompt: "Soft smile mid-song, warm window light", durationSec: 4 },
    ],
    introTitle: "unplugged", outroTitle: "thank you", music: "mountain", gradient: G.gold,
  }),

  // ── Corporate ─────────────────────────────────────────────────────────────
  mk({
    id: "corp-about", name: "About Us", description: "Clean, trustworthy, smooth pacing.",
    category: "corporate", aspectRatio: "16:9", vibe: "Trust", filter: LOOK.clean,
    transition: "smoothleft", transitionDurationSec: 0.5, fadeInSec: 0.5, fadeOutSec: 0.5,
    slots: [
      { prompt: "Bright modern office with people collaborating", durationSec: 4 },
      { prompt: "Close-up of a handshake, professional", durationSec: 3 },
      { prompt: "Team smiling in a glass meeting room", durationSec: 4 },
    ],
    introTitle: "WHO WE ARE", outroTitle: "LET'S BUILD", music: "strings", gradient: G.ocean,
  }),
  mk({
    id: "corp-explainer", name: "Explainer", description: "Friendly, bright, snappy wipes.",
    category: "corporate", aspectRatio: "16:9", vibe: "Clear", filter: LOOK.vibrant,
    transition: "wiperight", transitionDurationSec: 0.35, fadeInSec: 0.3, fadeOutSec: 0.3,
    slots: [
      { prompt: "Person presenting at a clean whiteboard", durationSec: 3 },
      { prompt: "Animated-style icons floating around a laptop", durationSec: 3 },
      { prompt: "Happy customer using an app, bright room", durationSec: 3 },
    ],
    introTitle: "HOW IT WORKS", outroTitle: "GET STARTED", music: "mountain", gradient: G.sky,
  }),
  mk({
    id: "corp-recruit", name: "We're Hiring", description: "Energetic, human, warm clean grade.",
    category: "corporate", aspectRatio: "9:16", vibe: "Human", filter: LOOK.clean, mobileFirst: true,
    transition: "slideleft", transitionDurationSec: 0.3, fadeInSec: 0.3, fadeOutSec: 0.3,
    slots: [
      { prompt: "Diverse team laughing together, vertical, bright", durationSec: 3 },
      { prompt: "Someone presenting an idea, engaged faces", durationSec: 3 },
      { prompt: "Office culture moment, casual and warm", durationSec: 3 },
    ],
    introTitle: "JOIN US", outroTitle: "APPLY TODAY", music: "strings", gradient: G.forest,
  }),
  mk({
    id: "corp-testimonial", name: "Testimonial", description: "Intimate, honest, soft focus.",
    category: "corporate", aspectRatio: "16:9", vibe: "Candid", filter: LOOK.dreamy,
    transition: "fade", transitionDurationSec: 0.4, fadeInSec: 0.4, fadeOutSec: 0.4,
    slots: [
      { prompt: "Customer speaking warmly to camera, soft bokeh", durationSec: 5 },
      { prompt: "Product subtly in use in the background", durationSec: 3 },
      { prompt: "Genuine smile, natural window light", durationSec: 4 },
    ],
    introTitle: "REAL STORIES", outroTitle: "JOIN THEM", music: "mountain", gradient: G.gold,
  }),
  mk({
    id: "corp-event", name: "Event Recap", description: "Lively highlight reel, quick cuts.",
    category: "corporate", aspectRatio: "16:9", vibe: "Lively", filter: LOOK.punchy,
    transition: "slideright", transitionDurationSec: 0.3, fadeInSec: 0.3, fadeOutSec: 0.3,
    slots: [
      { prompt: "Keynote speaker on a big stage, crowd", durationSec: 3 },
      { prompt: "Networking moment, people chatting and laughing", durationSec: 3 },
      { prompt: "Branded venue wide shot at golden hour", durationSec: 3 },
    ],
    introTitle: "2026 SUMMIT", outroTitle: "SEE YOU NEXT YEAR", music: "strings", gradient: G.ocean,
  }),

  // ── Story ─────────────────────────────────────────────────────────────────
  mk({
    id: "story-coming", name: "Coming of Age", description: "Warm nostalgic film, gentle white fades.",
    category: "story", aspectRatio: "16:9", vibe: "Tender", filter: LOOK.warmVintage,
    transition: "fadewhite", transitionDurationSec: 0.6, fadeInSec: 0.7, fadeOutSec: 0.7, speed: 0.95,
    slots: [
      { prompt: "Teenagers biking down a suburban street at dusk", durationSec: 4 },
      { prompt: "Laughing on a porch with string lights", durationSec: 4 },
      { prompt: "Looking out over the town from a hill", durationSec: 4 },
    ],
    introTitle: "that summer", outroTitle: "we grew up", music: "mountain", gradient: G.gold,
  }),
  mk({
    id: "story-mystery", name: "Mystery", description: "Cold, suspenseful, slow dissolves.",
    category: "story", aspectRatio: "16:9", vibe: "Cryptic", filter: LOOK.coldThriller,
    transition: "dissolve", transitionDurationSec: 0.5, fadeInSec: 0.5, fadeOutSec: 0.6,
    slots: [
      { prompt: "A single letter on an empty table, dim light", durationSec: 4 },
      { prompt: "Footsteps in fog, only legs visible", durationSec: 3 },
      { prompt: "A door slowly opening to white light", durationSec: 4 },
    ],
    introTitle: "SOMETHING", outroTitle: "ISN'T RIGHT", music: "swell", gradient: G.slate,
  }),
  mk({
    id: "story-hero", name: "Hero's Journey", description: "Epic teal-orange, rising fades to black.",
    category: "story", aspectRatio: "21:9", vibe: "Epic", filter: LOOK.tealOrange,
    transition: "fadeblack", transitionDurationSec: 0.5, fadeInSec: 0.6, fadeOutSec: 0.7,
    slots: [
      { prompt: "Ordinary person staring at a distant storm", durationSec: 4 },
      { prompt: "Training montage moment, sweat and resolve", durationSec: 3 },
      { prompt: "Standing triumphant on a peak at sunrise", durationSec: 5 },
    ],
    introTitle: "EVERY HERO", outroTitle: "STARTS SOMEWHERE", music: "strings", gradient: G.ember,
  }),
  mk({
    id: "story-childrens", name: "Storybook", description: "Soft pastel whimsy, dreamy dissolves.",
    category: "story", aspectRatio: "16:9", vibe: "Whimsy", filter: LOOK.pastel,
    transition: "dissolve", transitionDurationSec: 0.6, fadeInSec: 0.6, fadeOutSec: 0.6, speed: 0.9,
    slots: [
      { prompt: "Whimsical cottage in a flower meadow, storybook style", durationSec: 4 },
      { prompt: "A friendly creature waving hello", durationSec: 3 },
      { prompt: "Rainbow arching over rolling hills", durationSec: 4 },
    ],
    introTitle: "Once upon a time", outroTitle: "The End", music: "mountain", gradient: G.candy,
  }),
  mk({
    id: "story-memoir", name: "Memoir", description: "Honest, warm, contemplative.",
    category: "story", aspectRatio: "16:9", vibe: "Reflective", filter: LOOK.goldenHour,
    transition: "fade", transitionDurationSec: 0.5, fadeInSec: 0.6, fadeOutSec: 0.6, speed: 0.95,
    slots: [
      { prompt: "Old photographs spread on a wooden table", durationSec: 4 },
      { prompt: "Hands turning the pages of a worn journal", durationSec: 3 },
      { prompt: "Empty chair by a window in afternoon light", durationSec: 4 },
    ],
    introTitle: "I remember", outroTitle: "and I'm grateful", music: "mountain", gradient: G.gold,
  }),

  // ── Lifestyle ─────────────────────────────────────────────────────────────
  mk({
    id: "life-morning", name: "Morning Routine", description: "Bright pastel calm, gentle fades.",
    category: "lifestyle", aspectRatio: "9:16", vibe: "Fresh", filter: LOOK.pastel, mobileFirst: true,
    transition: "fade", transitionDurationSec: 0.35, fadeInSec: 0.3, fadeOutSec: 0.3,
    slots: [
      { prompt: "Sunlight on white sheets, slow wake-up, vertical", durationSec: 3 },
      { prompt: "Pouring water into a glass, fresh morning", durationSec: 3 },
      { prompt: "Stretching by a sunny window", durationSec: 3 },
    ],
    introTitle: "5 AM", outroTitle: "let's go", music: "mountain", gradient: G.sky,
  }),
  mk({
    id: "life-wellness", name: "Wellness", description: "Serene dreamy calm, slow dissolves.",
    category: "lifestyle", aspectRatio: "16:9", vibe: "Zen", filter: LOOK.dreamy,
    transition: "dissolve", transitionDurationSec: 0.6, fadeInSec: 0.6, fadeOutSec: 0.6, speed: 0.85,
    slots: [
      { prompt: "Yoga pose silhouette at sunrise on a beach", durationSec: 5 },
      { prompt: "Hands cupping a warm tea, steam rising", durationSec: 4 },
      { prompt: "Candles and plants in a calm spa room", durationSec: 4 },
    ],
    introTitle: "slow down", outroTitle: "be well", music: "mountain", gradient: G.forest,
  }),
  mk({
    id: "life-fashion-haul", name: "Fashion Haul", description: "Vibrant try-on energy, snappy slides.",
    category: "lifestyle", aspectRatio: "9:16", vibe: "Chic", filter: LOOK.vibrant, mobileFirst: true,
    transition: "slideleft", transitionDurationSec: 0.22, fadeInSec: 0.2, fadeOutSec: 0.2,
    slots: [
      { prompt: "Outfit reveal twirl in front of a mirror, vertical", durationSec: 2 },
      { prompt: "Close-up of accessory details, bright", durationSec: 2 },
      { prompt: "Confident walk toward camera, studio light", durationSec: 3 },
    ],
    introTitle: "HAUL", outroTitle: "which one? 👀", music: "swell", gradient: G.candy,
  }),
  mk({
    id: "life-home", name: "Home Makeover", description: "Clean bright reveals, smooth glides.",
    category: "lifestyle", aspectRatio: "16:9", vibe: "Cozy", filter: LOOK.clean,
    transition: "smoothleft", transitionDurationSec: 0.5, fadeInSec: 0.4, fadeOutSec: 0.4,
    slots: [
      { prompt: "Before: empty plain room, flat light", durationSec: 3 },
      { prompt: "After: styled cozy living room, warm light", durationSec: 4 },
      { prompt: "Detail of a decorated shelf, plants and books", durationSec: 3 },
    ],
    introTitle: "BEFORE", outroTitle: "AFTER ✨", music: "mountain", gradient: G.gold,
  }),
  mk({
    id: "life-pet", name: "Pet Diary", description: "Bright, playful, warm and snappy.",
    category: "lifestyle", aspectRatio: "9:16", vibe: "Playful", filter: LOOK.vibrant, mobileFirst: true,
    transition: "fadeblack", transitionDurationSec: 0.2, fadeInSec: 0.2, fadeOutSec: 0.2,
    slots: [
      { prompt: "Puppy running toward camera in a park, vertical", durationSec: 2 },
      { prompt: "Close-up of a happy dog tilting its head", durationSec: 2 },
      { prompt: "Pet curling up to sleep, cozy", durationSec: 3 },
    ],
    introTitle: "my best friend", outroTitle: "🐾", music: "mountain", gradient: G.rose,
  }),
];

/** Lookup by id. */
export function getTimelineTemplate(id: string): TimelineTemplate | undefined {
  return TIMELINE_TEMPLATES.find((t) => t.id === id);
}
