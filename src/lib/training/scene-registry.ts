/**
 * Training scene registry — 52 scenes across 6 worlds.
 *
 * Preserves all 25 scenes that already shipped on TrainingVideo.tsx (the
 * BACKGROUND_PRESETS array) and adds 27 more from the broader environment
 * asset library. Every scene is enriched with mood, lighting profile,
 * color palette, voice pairings, and use cases.
 */
import type { TrainingSceneBlueprint } from "./scene-blueprint";

// Existing 25 scenes (preserved from TrainingVideo.tsx)
import whiteStudioImg from "@/assets/environments/white-studio.jpg";
import homeStudioImg from "@/assets/environments/home-studio.jpg";
import goldenHourStudioImg from "@/assets/environments/golden-hour-studio.jpg";
import podcastStudioImg from "@/assets/environments/podcast-studio.jpg";
import newsStudioImg from "@/assets/environments/news-studio.jpg";
import greenScreenImg from "@/assets/environments/green-screen.jpg";
import corporateBoardroomImg from "@/assets/environments/corporate-boardroom.jpg";
import startupOfficeImg from "@/assets/environments/startup-office.jpg";
import executiveLibraryImg from "@/assets/environments/executive-library.jpg";
import modernMinimalistImg from "@/assets/environments/modern-minimalist.jpg";
import urbanLuxuryImg from "@/assets/environments/urban-luxury.jpg";
import lectureHallImg from "@/assets/environments/lecture-hall.jpg";
import modernClassroomImg from "@/assets/environments/modern-classroom.jpg";
import webinarStageImg from "@/assets/environments/webinar-stage.jpg";
import scienceLabImg from "@/assets/environments/science-lab.jpg";
import medicalTrainingImg from "@/assets/environments/medical-training.jpg";
import workshopTrainingImg from "@/assets/environments/workshop-training.jpg";
import coffeeShopImg from "@/assets/environments/coffee-shop.jpg";
import cozyFirelightImg from "@/assets/environments/cozy-firelight.jpg";
import cozyCabinImg from "@/assets/environments/cozy-cabin.jpg";
import zenGardenImg from "@/assets/environments/zen-garden.jpg";
import neonNightsImg from "@/assets/environments/neon-nights.jpg";
import tropicalParadiseImg from "@/assets/environments/tropical-paradise.jpg";
import mountainSummitImg from "@/assets/environments/mountain-summit.jpg";
import cherryBlossomImg from "@/assets/environments/cherry-blossom.jpg";
import spaceStationImg from "@/assets/environments/space-station.jpg";

// New scenes (added — bringing total to 52)
import brooklynLoftStudioImg from "@/assets/environments/brooklyn-loft-studio.jpg";
import modernGlassOfficeImg from "@/assets/environments/modern-glass-office.jpg";
import speakeasyJazzBarImg from "@/assets/environments/speakeasy-jazz-bar.jpg";
import victorianLibraryImg from "@/assets/environments/victorian-library.jpg";
import snowyMountainCabinImg from "@/assets/environments/snowy-mountain-cabin.jpg";
import coastalSerenityImg from "@/assets/environments/coastal-serenity.jpg";
import parisRooftopDuskImg from "@/assets/environments/paris-rooftop-dusk.jpg";
import santoriniCliffsideImg from "@/assets/environments/santorini-cliffside.jpg";
import tropicalInfinityPoolImg from "@/assets/environments/tropical-infinity-pool.jpg";
import alpineDawnImg from "@/assets/environments/alpine-dawn.jpg";
import icelandGlacierLagoonImg from "@/assets/environments/iceland-glacier-lagoon.jpg";
import mojaveDesertDunesImg from "@/assets/environments/mojave-desert-dunes.jpg";
import forestMystiqueImg from "@/assets/environments/forest-mystique.jpg";
import amazonRainforestCanopyImg from "@/assets/environments/amazon-rainforest-canopy.jpg";
import antarcticIceFieldImg from "@/assets/environments/antarctic-ice-field.jpg";
import centralParkSpringImg from "@/assets/environments/central-park-spring.jpg";
import saharaCaravanDawnImg from "@/assets/environments/sahara-caravan-dawn.jpg";
import londonFoggyEmbankmentImg from "@/assets/environments/london-foggy-embankment.jpg";
import spaceStationObservationImg from "@/assets/environments/space-station-observation.jpg";
import marsColonyHabitatImg from "@/assets/environments/mars-colony-habitat.jpg";
import medievalCastleHallImg from "@/assets/environments/medieval-castle-hall.jpg";
import ancientRomanForumImg from "@/assets/environments/ancient-roman-forum.jpg";
import cyberpunkMegacityRoofImg from "@/assets/environments/cyberpunk-megacity-roof.jpg";
import neonNoirCityImg from "@/assets/environments/neon-noir-city.jpg";
import steampunkLabImg from "@/assets/environments/steampunk-lab.jpg";
import dubaiSkylinePenthouseImg from "@/assets/environments/dubai-skyline-penthouse.jpg";
import abandonedCathedralImg from "@/assets/environments/abandoned-cathedral.jpg";

// ─────────────────────────────────────────────────────────────────────────────
// 52 SCENES
// ─────────────────────────────────────────────────────────────────────────────
export const TRAINING_SCENE_BLUEPRINTS: TrainingSceneBlueprint[] = [
  // ─── STUDIOS & SETS (7) ──────────────────────────────────────
  {
    id: "white_studio", name: "White Studio",
    description: "Clean white cyclorama with soft diffused lighting — the most neutral, broadcast-ready backdrop.",
    generatorPrompt: "Subject framed against a clean white cyclorama studio with soft diffused key + fill lighting, professional broadcast-ready backdrop, no distractions, eye-line slightly above lens.",
    image: whiteStudioImg, world: "studio", mood: "professional",
    isFeatured: true, isPopular: true,
    lighting: "soft", timeOfDay: "controlled", temperature: "neutral", productionTier: "professional",
    colorPalette: { primary: "#FFFFFF", secondary: "#E0E0E0", accent: "#333333" },
    voicePairings: ["professional", "conversational"],
    useCases: ["corporate-training", "presentation", "explainer", "course-narration"],
  },
  {
    id: "home_studio", name: "Home Studio",
    description: "Modern home office with ring light + acoustic panels — approachable yet polished.",
    generatorPrompt: "Subject in a modern home office studio, ring light catching their eyes, acoustic panels softening the background, warm desk lamp adding depth, intimate-but-professional creator setting.",
    image: homeStudioImg, world: "studio", mood: "intimate",
    isPopular: true,
    lighting: "soft", timeOfDay: "controlled", temperature: "warm", productionTier: "professional",
    colorPalette: { primary: "#F5E6D3", secondary: "#A0826D", accent: "#FFD700" },
    voicePairings: ["conversational", "energetic"],
    useCases: ["vlog-vo", "podcast-intro", "social-vo", "explainer"],
  },
  {
    id: "golden_hour_studio", name: "Golden Hour Studio",
    description: "Warm golden hour streaming through windows — cinematic amber tones, romantic ambiance.",
    generatorPrompt: "Subject in a studio bathed in golden-hour window light, warm amber tones spilling across the frame, lens flare softening highlights, romantic cinematic ambiance, hint of haze.",
    image: goldenHourStudioImg, world: "studio", mood: "warm-cinematic",
    isFeatured: true,
    lighting: "cinematic", timeOfDay: "golden-hour", temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#FFB347", secondary: "#FFCC80", accent: "#8B4513" },
    voicePairings: ["narrative", "conversational"],
    useCases: ["podcast-intro", "audiobook", "course-narration"],
  },
  {
    id: "podcast_studio", name: "Podcast Studio",
    description: "Foam panels + boom mic visible — intimate broadcast feel.",
    generatorPrompt: "Subject in a professional podcast studio, foam acoustic panels behind them, boom microphone visible in frame, warm desk lamp, intimate broadcast atmosphere, lo-fi cinematic look.",
    image: podcastStudioImg, world: "studio", mood: "intimate",
    lighting: "moody", timeOfDay: "controlled", temperature: "warm", productionTier: "professional",
    colorPalette: { primary: "#2A1F1A", secondary: "#8B5A2B", accent: "#FFD700" },
    voicePairings: ["conversational", "narrative"],
    useCases: ["podcast-intro", "audiobook", "vlog-vo"],
  },
  {
    id: "news_studio", name: "News Studio",
    description: "Broadcast desk + monitors — authoritative media set.",
    generatorPrompt: "Subject at a broadcast news desk, glowing monitors behind them, professional lighting grid, authoritative news-anchor framing, blue-and-amber color grade.",
    image: newsStudioImg, world: "studio", mood: "authoritative",
    lighting: "high-key", timeOfDay: "controlled", temperature: "cool", productionTier: "premium",
    colorPalette: { primary: "#1A2B4A", secondary: "#D4A24C", accent: "#FFFFFF" },
    voicePairings: ["professional", "authoritative"],
    useCases: ["presentation", "documentary", "course-narration"],
  },
  {
    id: "green_screen", name: "Green Screen",
    description: "Chroma-key green for compositing onto anything later.",
    generatorPrompt: "Subject against a perfectly lit green chroma-key screen, even soft diffused lighting on the subject, no spill, ready for downstream compositing.",
    image: greenScreenImg, world: "studio", mood: "neutral",
    lighting: "high-key", timeOfDay: "controlled", temperature: "neutral", productionTier: "professional",
    colorPalette: { primary: "#00B140", secondary: "#FFFFFF", accent: "#333333" },
    voicePairings: ["professional", "energetic"],
    useCases: ["explainer", "product-demo", "ad-spot"],
  },
  {
    id: "brooklyn_loft_studio", name: "Brooklyn Loft Studio",
    description: "Exposed-brick creative loft with industrial windows — artsy professional.",
    generatorPrompt: "Subject in a Brooklyn loft creative studio, exposed brick wall behind them, tall industrial windows letting in cool overcast daylight, polished concrete floor, artsy-professional energy.",
    image: brooklynLoftStudioImg, world: "studio", mood: "creative",
    isNew: true,
    lighting: "cinematic", timeOfDay: "midday", temperature: "cool", productionTier: "premium",
    colorPalette: { primary: "#8B6F47", secondary: "#D4D4D8", accent: "#1F2937" },
    voicePairings: ["conversational", "narrative"],
    useCases: ["vlog-vo", "podcast-intro", "course-narration"],
  },

  // ─── CORPORATE & OFFICE (8) ─────────────────────────────────
  {
    id: "corporate_boardroom", name: "Corporate Boardroom",
    description: "Mahogany table + city skyline through windows — premium executive set.",
    generatorPrompt: "Subject at the head of a corporate boardroom, mahogany conference table stretching behind them, floor-to-ceiling windows revealing a city skyline, sophisticated executive lighting.",
    image: corporateBoardroomImg, world: "corporate", mood: "executive",
    isFeatured: true,
    lighting: "cinematic", timeOfDay: "midday", temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#3D2817", secondary: "#C9A24A", accent: "#1F2937" },
    voicePairings: ["professional", "authoritative"],
    useCases: ["corporate-training", "presentation", "explainer"],
  },
  {
    id: "startup_office", name: "Startup Office",
    description: "Open-plan + exposed brick + standing desks — tech-company energy.",
    generatorPrompt: "Subject in a modern startup open-plan office, exposed brick wall, standing desks and motion blur of team members in the background, energetic tech-company atmosphere.",
    image: startupOfficeImg, world: "corporate", mood: "energetic",
    isPopular: true,
    lighting: "high-key", timeOfDay: "midday", temperature: "warm", productionTier: "professional",
    colorPalette: { primary: "#7C4A2D", secondary: "#FBBF24", accent: "#1F2937" },
    voicePairings: ["energetic", "conversational"],
    useCases: ["product-demo", "ad-spot", "presentation"],
  },
  {
    id: "executive_library", name: "Executive Library",
    description: "Leather chairs + book-lined walls — prestigious academic feel.",
    generatorPrompt: "Subject in a traditional executive library, leather wingback chair beside them, book-lined walnut shelves rising behind, brass reading lamp, prestigious academic atmosphere.",
    image: executiveLibraryImg, world: "corporate", mood: "prestige",
    lighting: "moody", timeOfDay: "evening", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#2A1A0F", secondary: "#8B5A2B", accent: "#D4A24C" },
    voicePairings: ["authoritative", "narrative"],
    useCases: ["documentary", "audiobook", "course-narration"],
  },
  {
    id: "modern_minimalist", name: "Modern Minimalist",
    description: "Concrete walls + designer furniture — architectural lighting.",
    generatorPrompt: "Subject in an ultra-clean minimalist space, polished concrete walls, single designer chair, architectural directional light from above, no clutter, museum-quality framing.",
    image: modernMinimalistImg, world: "corporate", mood: "modern",
    lighting: "cinematic", timeOfDay: "controlled", temperature: "cool", productionTier: "premium",
    colorPalette: { primary: "#D4D4D8", secondary: "#52525B", accent: "#FFFFFF" },
    voicePairings: ["professional", "narrative"],
    useCases: ["ad-spot", "presentation", "trailer"],
  },
  {
    id: "urban_luxury", name: "Urban Luxury",
    description: "Penthouse + floor-to-ceiling windows + city lights — sophisticated.",
    generatorPrompt: "Subject in a high-rise penthouse, floor-to-ceiling windows revealing nightlit city skyline, ambient warm interior light, luxurious modern furnishings just out of focus.",
    image: urbanLuxuryImg, world: "corporate", mood: "luxurious",
    lighting: "moody", timeOfDay: "night", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#1A1A1A", secondary: "#9370DB", accent: "#FFB347" },
    voicePairings: ["authoritative", "narrative"],
    useCases: ["trailer", "ad-spot", "documentary"],
  },
  {
    id: "modern_glass_office", name: "Modern Glass Office",
    description: "Glass walls + tech-forward — perfect for product launches.",
    generatorPrompt: "Subject in a modern glass-walled corporate office, recessed LED lighting catching the geometry, transparent meeting room behind them, tech-forward premium feel.",
    image: modernGlassOfficeImg, world: "corporate", mood: "tech",
    isNew: true,
    lighting: "high-key", timeOfDay: "midday", temperature: "cool", productionTier: "premium",
    colorPalette: { primary: "#E0F2FE", secondary: "#0C4A6E", accent: "#FFFFFF" },
    voicePairings: ["professional", "energetic"],
    useCases: ["product-demo", "presentation", "explainer"],
  },
  {
    id: "victorian_library", name: "Victorian Library",
    description: "Gilded oak shelves + leather + fireplace — heritage gravitas.",
    generatorPrompt: "Subject in a Victorian library, gilded oak shelves rising two floors behind them, a hearth crackling out of frame casting warm flicker, leather wingback chair beside, heritage-prestige atmosphere.",
    image: victorianLibraryImg, world: "corporate", mood: "heritage",
    isNew: true,
    lighting: "moody", timeOfDay: "evening", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#3D1F0F", secondary: "#B8860B", accent: "#F5E6D3" },
    voicePairings: ["authoritative", "narrative"],
    useCases: ["documentary", "audiobook", "course-narration"],
  },
  {
    id: "dubai_skyline_penthouse", name: "Dubai Skyline Penthouse",
    description: "Wraparound desert-city skyline at golden hour — true prestige.",
    generatorPrompt: "Subject on a Dubai penthouse terrace, the Burj Khalifa silhouette rising in the desert haze behind them at golden hour, infinity-pool reflection catching the light, ultimate prestige location.",
    image: dubaiSkylinePenthouseImg, world: "corporate", mood: "luxurious",
    isNew: true, isFeatured: true,
    lighting: "cinematic", timeOfDay: "golden-hour", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#FFB347", secondary: "#3B5998", accent: "#FFD700" },
    voicePairings: ["authoritative", "narrative"],
    useCases: ["trailer", "ad-spot", "presentation"],
  },

  // ─── EDUCATION & TRAINING (6) ───────────────────────────────
  {
    id: "lecture_hall", name: "Lecture Hall",
    description: "Tiered seating + projection screen — academic teaching set.",
    generatorPrompt: "Subject at the podium of a university lecture hall, tiered wooden seating curving up behind them, projection screen glow softening the back wall, academic teaching atmosphere.",
    image: lectureHallImg, world: "education", mood: "academic",
    lighting: "cinematic", timeOfDay: "controlled", temperature: "warm", productionTier: "professional",
    colorPalette: { primary: "#3D2817", secondary: "#D4A24C", accent: "#1F2937" },
    voicePairings: ["professional", "narrative"],
    useCases: ["course-narration", "presentation", "explainer"],
  },
  {
    id: "modern_classroom", name: "Modern Classroom",
    description: "Interactive whiteboard + collaborative seating.",
    generatorPrompt: "Subject in a contemporary classroom, interactive whiteboard glowing behind them, collaborative round tables in the background, modern educational atmosphere.",
    image: modernClassroomImg, world: "education", mood: "approachable",
    lighting: "high-key", timeOfDay: "midday", temperature: "neutral", productionTier: "professional",
    colorPalette: { primary: "#E0E7FF", secondary: "#3B82F6", accent: "#F59E0B" },
    voicePairings: ["conversational", "professional"],
    useCases: ["course-narration", "explainer"],
  },
  {
    id: "webinar_stage", name: "Webinar Stage",
    description: "Branded backdrop + presentation screen — virtual event ready.",
    generatorPrompt: "Subject on a professional webinar stage, branded backdrop behind them, presentation screen glow softening the wall, premium virtual-event lighting.",
    image: webinarStageImg, world: "education", mood: "professional",
    lighting: "high-key", timeOfDay: "controlled", temperature: "neutral", productionTier: "premium",
    colorPalette: { primary: "#1E3A5F", secondary: "#FBBF24", accent: "#FFFFFF" },
    voicePairings: ["professional", "energetic"],
    useCases: ["presentation", "course-narration", "ad-spot"],
  },
  {
    id: "science_lab", name: "Science Lab",
    description: "Equipment + monitors — research environment.",
    generatorPrompt: "Subject in a high-tech research laboratory, glass-fronted equipment racks glowing softly behind them, monitors with scrolling data, cool clinical lighting, scientific atmosphere.",
    image: scienceLabImg, world: "education", mood: "scientific",
    lighting: "cinematic", timeOfDay: "controlled", temperature: "cool", productionTier: "premium",
    colorPalette: { primary: "#0E1E2A", secondary: "#22D3EE", accent: "#FBBF24" },
    voicePairings: ["professional", "narrative"],
    useCases: ["documentary", "course-narration", "explainer"],
  },
  {
    id: "medical_training", name: "Medical Training",
    description: "Anatomical models + clinical setting — healthcare education.",
    generatorPrompt: "Subject in a medical training facility, anatomical models on shelves behind them, clinical bright lighting, healthcare educational atmosphere, professional clean look.",
    image: medicalTrainingImg, world: "education", mood: "clinical",
    lighting: "high-key", timeOfDay: "controlled", temperature: "cool", productionTier: "professional",
    colorPalette: { primary: "#E0F2FE", secondary: "#3B82F6", accent: "#FFFFFF" },
    voicePairings: ["professional", "conversational"],
    useCases: ["course-narration", "explainer", "corporate-training"],
  },
  {
    id: "workshop_training", name: "Workshop Training",
    description: "Tools + workbenches — hands-on skills training.",
    generatorPrompt: "Subject in a hands-on workshop space, organized tool wall behind them, workbench in the foreground catching warm overhead light, practical skills training atmosphere.",
    image: workshopTrainingImg, world: "education", mood: "hands-on",
    lighting: "cinematic", timeOfDay: "midday", temperature: "warm", productionTier: "professional",
    colorPalette: { primary: "#7C4A2D", secondary: "#FBBF24", accent: "#1F2937" },
    voicePairings: ["conversational", "energetic"],
    useCases: ["explainer", "product-demo", "course-narration"],
  },

  // ─── LIFESTYLE & URBAN (11) ─────────────────────────────────
  {
    id: "coffee_shop", name: "Coffee Shop",
    description: "Warm corner + exposed brick + ambient bustle.",
    generatorPrompt: "Subject in a cozy coffee shop corner, exposed brick wall behind them, warm pendant lights, soft bokeh of customers in background, café ambient bustle, casual and inviting.",
    image: coffeeShopImg, world: "lifestyle", mood: "casual",
    isPopular: true,
    lighting: "moody", timeOfDay: "morning", temperature: "warm", productionTier: "professional",
    colorPalette: { primary: "#3D2817", secondary: "#D4A574", accent: "#FBBF24" },
    voicePairings: ["conversational", "energetic"],
    useCases: ["vlog-vo", "podcast-intro", "social-vo"],
  },
  {
    id: "cozy_firelight", name: "Cozy Firelight",
    description: "Intimate fireside with warm flickering light.",
    generatorPrompt: "Subject in an intimate fireside setting, warm flickering firelight catching their face from below-left, comfortable seating around them, relaxed evening atmosphere.",
    image: cozyFirelightImg, world: "lifestyle", mood: "intimate",
    lighting: "moody", timeOfDay: "evening", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#2A1A0F", secondary: "#D2691E", accent: "#FFD700" },
    voicePairings: ["narrative", "conversational"],
    useCases: ["podcast-intro", "audiobook", "drama"],
  },
  {
    id: "cozy_cabin", name: "Cozy Cabin",
    description: "Rustic wood beams + fireplace — mountain lodge comfort.",
    generatorPrompt: "Subject inside a rustic mountain cabin, wooden ceiling beams overhead, stone fireplace behind them casting warm flicker, mountain lodge hygge comfort.",
    image: cozyCabinImg, world: "lifestyle", mood: "intimate",
    lighting: "moody", timeOfDay: "evening", temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#8B4513", secondary: "#D2691E", accent: "#FFD700" },
    voicePairings: ["conversational", "narrative"],
    useCases: ["podcast-intro", "audiobook", "vlog-vo"],
  },
  {
    id: "zen_garden", name: "Zen Garden",
    description: "Raked sand + bamboo — meditative outdoor space.",
    generatorPrompt: "Subject in a tranquil zen garden, raked sand patterns leading into frame, bamboo softly swaying, bonsai catching morning light, peaceful meditative atmosphere.",
    image: zenGardenImg, world: "lifestyle", mood: "peaceful",
    lighting: "soft", timeOfDay: "morning", temperature: "neutral", productionTier: "premium",
    colorPalette: { primary: "#90EE90", secondary: "#F5F5DC", accent: "#228B22" },
    voicePairings: ["narrative", "conversational"],
    useCases: ["audiobook", "course-narration", "documentary"],
  },
  {
    id: "neon_nights", name: "Neon Nights",
    description: "Cyberpunk LEDs + wet streets — electric urban energy.",
    generatorPrompt: "Subject on a neon-lit city street at night, magenta + cyan LED strips reflected in wet pavement, halation bloom on the lights, cyberpunk urban nightlife.",
    image: neonNightsImg, world: "lifestyle", mood: "electric",
    lighting: "neon", timeOfDay: "night", temperature: "cool", productionTier: "cinematic",
    colorPalette: { primary: "#FF1493", secondary: "#00FFFF", accent: "#9400D3" },
    voicePairings: ["energetic", "authoritative"],
    useCases: ["trailer", "ad-spot", "social-vo"],
  },
  {
    id: "speakeasy_jazz_bar", name: "Speakeasy Jazz Bar",
    description: "Velvet booths + low amber light + brass details — vintage cool.",
    generatorPrompt: "Subject in a 1920s speakeasy jazz bar, velvet booth behind them, low amber tungsten light, brass details catching warm highlights, vintage cocktail-hour atmosphere.",
    image: speakeasyJazzBarImg, world: "lifestyle", mood: "vintage",
    isNew: true,
    lighting: "moody", timeOfDay: "night", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#3D1F0F", secondary: "#FFD700", accent: "#B8860B" },
    voicePairings: ["narrative", "authoritative"],
    useCases: ["audiobook", "documentary", "drama"],
  },
  {
    id: "snowy_mountain_cabin", name: "Snowy Mountain Cabin",
    description: "Snow-dusted windows + crackling hearth — winter retreat.",
    generatorPrompt: "Subject inside a snowy mountain cabin, snow-dusted window catching the cool exterior light, hearth crackling out of frame with warm flicker, winter-retreat coziness.",
    image: snowyMountainCabinImg, world: "lifestyle", mood: "intimate",
    isNew: true,
    lighting: "moody", timeOfDay: "morning", temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#3D2817", secondary: "#E0F2FE", accent: "#FFD700" },
    voicePairings: ["narrative", "conversational"],
    useCases: ["audiobook", "podcast-intro", "vlog-vo"],
  },
  {
    id: "coastal_serenity", name: "Coastal Serenity",
    description: "Driftwood deck + sea breeze — barefoot luxury.",
    generatorPrompt: "Subject on a driftwood deck overlooking the ocean, sea breeze catching their hair, soft golden-hour light skimming the waves behind, barefoot-luxury vibe.",
    image: coastalSerenityImg, world: "lifestyle", mood: "serene",
    isNew: true,
    lighting: "cinematic", timeOfDay: "golden-hour", temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#0EA5E9", secondary: "#FFD700", accent: "#FFFFFF" },
    voicePairings: ["conversational", "narrative"],
    useCases: ["vlog-vo", "podcast-intro", "audiobook"],
  },
  {
    id: "paris_rooftop_dusk", name: "Paris Rooftop · Dusk",
    description: "Mansard rooftops + Eiffel silhouette — postcard cinematic.",
    generatorPrompt: "Subject on a Paris rooftop at dusk, mansard slate rooftops cascading away, Eiffel Tower silhouette in the soft purple-blue gradient sky, postcard-perfect cinematic atmosphere.",
    image: parisRooftopDuskImg, world: "lifestyle", mood: "romantic",
    isNew: true, isFeatured: true,
    lighting: "cinematic", timeOfDay: "evening", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#3B5998", secondary: "#FFB347", accent: "#FFD700" },
    voicePairings: ["narrative", "conversational"],
    useCases: ["audiobook", "trailer", "ad-spot"],
  },
  {
    id: "santorini_cliffside", name: "Santorini Cliffside",
    description: "Whitewashed walls + Aegean blue — Mediterranean luxury.",
    generatorPrompt: "Subject on a Santorini cliffside terrace, whitewashed walls glowing in late-afternoon sun, Aegean Sea stretching to the horizon in deep blue, sun-drenched Mediterranean luxury.",
    image: santoriniCliffsideImg, world: "lifestyle", mood: "luxurious",
    isNew: true,
    lighting: "cinematic", timeOfDay: "afternoon" as never, temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#FFFFFF", secondary: "#0EA5E9", accent: "#FFD700" },
    voicePairings: ["conversational", "narrative"],
    useCases: ["vlog-vo", "trailer", "ad-spot"],
  },
  {
    id: "tropical_infinity_pool", name: "Tropical Infinity Pool",
    description: "Glass-edge pool meeting the ocean — resort prestige.",
    generatorPrompt: "Subject beside a tropical infinity pool, glass-edge water meeting the ocean horizon, palm silhouettes catching warm late-day light, premium resort-prestige atmosphere.",
    image: tropicalInfinityPoolImg, world: "lifestyle", mood: "luxurious",
    isNew: true,
    lighting: "cinematic", timeOfDay: "golden-hour", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#40E0D0", secondary: "#FFB347", accent: "#FFD700" },
    voicePairings: ["conversational", "narrative"],
    useCases: ["ad-spot", "trailer", "vlog-vo"],
  },
  {
    id: "london_foggy_embankment", name: "London · Foggy Embankment",
    description: "Big Ben silhouette + gaslamp glow — moody literary.",
    generatorPrompt: "Subject on the London Thames embankment in fog, Big Ben silhouette barely visible through the mist, gaslamp glow softening the cobblestones, moody literary atmosphere.",
    image: londonFoggyEmbankmentImg, world: "lifestyle", mood: "literary",
    isNew: true,
    lighting: "moody", timeOfDay: "evening", temperature: "cool", productionTier: "cinematic",
    colorPalette: { primary: "#3D3D3D", secondary: "#FFB347", accent: "#5B7C99" },
    voicePairings: ["narrative", "authoritative"],
    useCases: ["audiobook", "documentary", "drama"],
  },

  // ─── NATURE & OUTDOOR (12) ──────────────────────────────────
  {
    id: "tropical_paradise", name: "Tropical Paradise",
    description: "Pristine beach + palm silhouettes — vacation backdrop.",
    generatorPrompt: "Subject on a pristine tropical beach, palm silhouettes against a sunset sky, gentle waves lapping behind, paradise vacation backdrop, warm sunset rim light.",
    image: tropicalParadiseImg, world: "nature", mood: "paradise",
    isPopular: true,
    lighting: "cinematic", timeOfDay: "golden-hour", temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#FF6B6B", secondary: "#40E0D0", accent: "#FF8C00" },
    voicePairings: ["conversational", "narrative"],
    useCases: ["vlog-vo", "ad-spot", "trailer"],
  },
  {
    id: "mountain_summit", name: "Mountain Summit",
    description: "Peak above the clouds at sunrise — achievement.",
    generatorPrompt: "Subject at the summit of a mountain peak above a sea of clouds, dawn light cresting the horizon catching their silhouette, achievement-adventure atmosphere.",
    image: mountainSummitImg, world: "nature", mood: "epic",
    isFeatured: true, isPopular: true,
    lighting: "cinematic", timeOfDay: "morning", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#4682B4", secondary: "#FFD700", accent: "#FF6347" },
    voicePairings: ["authoritative", "narrative"],
    useCases: ["trailer", "documentary", "ad-spot"],
  },
  {
    id: "cherry_blossom", name: "Cherry Blossom",
    description: "Pink petals + koi pond — Japanese garden serenity.",
    generatorPrompt: "Subject in a Japanese cherry blossom garden in spring, soft pink petals drifting through frame, koi pond catching dappled afternoon light, serene traditional garden.",
    image: cherryBlossomImg, world: "nature", mood: "romantic",
    isPopular: true,
    lighting: "soft", timeOfDay: "afternoon" as never, temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#FFB7C5", secondary: "#FFC0CB", accent: "#228B22" },
    voicePairings: ["narrative", "conversational"],
    useCases: ["audiobook", "documentary", "vlog-vo"],
  },
  {
    id: "alpine_dawn", name: "Alpine Dawn",
    description: "First light hitting snow-dusted peaks — pristine majesty.",
    generatorPrompt: "Subject overlooking an alpine valley at dawn, first light catching snow-dusted peaks in pink and gold, breath visible in the cool air, pristine mountain majesty.",
    image: alpineDawnImg, world: "nature", mood: "majestic",
    isNew: true,
    lighting: "cinematic", timeOfDay: "morning", temperature: "cool", productionTier: "cinematic",
    colorPalette: { primary: "#FFB7C5", secondary: "#E0F2FE", accent: "#FFD700" },
    voicePairings: ["narrative", "authoritative"],
    useCases: ["documentary", "audiobook", "trailer"],
  },
  {
    id: "iceland_glacier_lagoon", name: "Iceland Glacier Lagoon",
    description: "Icebergs in mirror-still arctic water — pristine wonder.",
    generatorPrompt: "Subject on the shore of an Iceland glacier lagoon, iceberg fragments drifting in the mirror-still water behind them, pale arctic sky, pristine wonder atmosphere.",
    image: icelandGlacierLagoonImg, world: "nature", mood: "pristine",
    isNew: true,
    lighting: "soft", timeOfDay: "midday", temperature: "cold", productionTier: "cinematic",
    colorPalette: { primary: "#7AAEC4", secondary: "#C8DEE8", accent: "#3A5A6A" },
    voicePairings: ["narrative", "professional"],
    useCases: ["documentary", "audiobook", "course-narration"],
  },
  {
    id: "mojave_desert_dunes", name: "Mojave Desert Dunes",
    description: "Sand waves + endless horizon — epic emptiness.",
    generatorPrompt: "Subject standing on a Mojave dune ridge, ripples of sand stretching to the horizon, late-afternoon shadows raking across the dunes, epic empty grandeur.",
    image: mojaveDesertDunesImg, world: "nature", mood: "epic",
    isNew: true,
    lighting: "cinematic", timeOfDay: "afternoon" as never, temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#DEB887", secondary: "#CD853F", accent: "#8B4513" },
    voicePairings: ["authoritative", "narrative"],
    useCases: ["documentary", "trailer", "audiobook"],
  },
  {
    id: "forest_mystique", name: "Forest Mystique",
    description: "Shafts of light through pines — mystical wilderness.",
    generatorPrompt: "Subject deep in a misty pine forest, shafts of light cutting through the canopy, fog drifting between the trunks, mystical wilderness atmosphere.",
    image: forestMystiqueImg, world: "nature", mood: "mystical",
    isNew: true,
    lighting: "moody", timeOfDay: "morning", temperature: "cool", productionTier: "cinematic",
    colorPalette: { primary: "#3F5D4A", secondary: "#A8B5A0", accent: "#E8E1D2" },
    voicePairings: ["narrative", "conversational"],
    useCases: ["audiobook", "documentary", "drama"],
  },
  {
    id: "amazon_rainforest_canopy", name: "Amazon Rainforest Canopy",
    description: "Lush green explosion + filtered light — primal nature.",
    generatorPrompt: "Subject on an Amazon rainforest canopy walkway, lush emerald foliage exploding around them, filtered jungle light, primal-nature atmosphere with ambient bird calls.",
    image: amazonRainforestCanopyImg, world: "nature", mood: "primal",
    isNew: true,
    lighting: "moody", timeOfDay: "midday", temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#228B22", secondary: "#FBBF24", accent: "#3D2817" },
    voicePairings: ["narrative", "conversational"],
    useCases: ["documentary", "audiobook", "course-narration"],
  },
  {
    id: "antarctic_ice_field", name: "Antarctic Ice Field",
    description: "Endless white + low sun — extreme remote majesty.",
    generatorPrompt: "Subject on an Antarctic ice field, endless white stretching to a polar horizon, low sun raking across the ice, breath visible, extreme-remote majesty.",
    image: antarcticIceFieldImg, world: "nature", mood: "extreme",
    isNew: true,
    lighting: "high-key", timeOfDay: "midday", temperature: "cold", productionTier: "cinematic",
    colorPalette: { primary: "#E0F2FE", secondary: "#7AAEC4", accent: "#FFFFFF" },
    voicePairings: ["narrative", "authoritative"],
    useCases: ["documentary", "trailer", "audiobook"],
  },
  {
    id: "central_park_spring", name: "Central Park · Spring",
    description: "Blooming trees + lake reflection — urban green oasis.",
    generatorPrompt: "Subject on a Central Park path in spring, cherry blossoms and tulips lining the walk, lake reflecting the Manhattan skyline behind, urban green oasis.",
    image: centralParkSpringImg, world: "nature", mood: "fresh",
    isNew: true,
    lighting: "soft", timeOfDay: "morning", temperature: "warm", productionTier: "professional",
    colorPalette: { primary: "#FFB7C5", secondary: "#90EE90", accent: "#FFD700" },
    voicePairings: ["conversational", "narrative"],
    useCases: ["vlog-vo", "podcast-intro", "documentary"],
  },
  {
    id: "sahara_caravan_dawn", name: "Sahara Caravan · Dawn",
    description: "Camels silhouetted on dunes at first light — timeless.",
    generatorPrompt: "Subject in a Sahara caravan setting at dawn, camel silhouettes on the dune ridge behind, first burning light cresting the horizon, timeless desert atmosphere.",
    image: saharaCaravanDawnImg, world: "nature", mood: "timeless",
    isNew: true,
    lighting: "cinematic", timeOfDay: "morning", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#E08B4D", secondary: "#F4C77A", accent: "#3A2418" },
    voicePairings: ["narrative", "authoritative"],
    useCases: ["audiobook", "documentary", "trailer"],
  },
  {
    id: "abandoned_cathedral", name: "Abandoned Cathedral",
    description: "Crumbling stone + shafts of light — sacred ruin.",
    generatorPrompt: "Subject inside an abandoned cathedral, crumbling stone arches rising behind them, shafts of light pouring through broken stained glass, sacred-ruin atmosphere.",
    image: abandonedCathedralImg, world: "nature", mood: "sacred",
    isNew: true,
    lighting: "moody", timeOfDay: "midday", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#3D2817", secondary: "#FFD700", accent: "#E0E7FF" },
    voicePairings: ["narrative", "authoritative"],
    useCases: ["audiobook", "documentary", "drama"],
  },

  // ─── SCI-FI & FANTASY (8) ───────────────────────────────────
  {
    id: "space_station", name: "Space Station",
    description: "Curved walls + holographic displays — futuristic minimalism.",
    generatorPrompt: "Subject inside a futuristic space station, curved white walls catching cool ambient light, holographic displays floating behind them, sci-fi minimalist atmosphere.",
    image: spaceStationImg, world: "scifi", mood: "futuristic",
    isFeatured: true, isPopular: true,
    lighting: "cinematic", timeOfDay: "controlled", temperature: "cool", productionTier: "cinematic",
    colorPalette: { primary: "#E8E8E8", secondary: "#B0C4DE", accent: "#4169E1" },
    voicePairings: ["authoritative", "professional"],
    useCases: ["trailer", "documentary", "ad-spot"],
  },
  {
    id: "space_station_observation", name: "Space Station · Observation Deck",
    description: "Earth visible through panoramic window — cosmic perspective.",
    generatorPrompt: "Subject on a space station observation deck, panoramic curved window revealing Earth from orbit behind them, cool blue Earth-glow rim-lighting their silhouette, cosmic perspective.",
    image: spaceStationObservationImg, world: "scifi", mood: "cosmic",
    isNew: true,
    lighting: "cinematic", timeOfDay: "controlled", temperature: "cool", productionTier: "cinematic",
    colorPalette: { primary: "#0EA5E9", secondary: "#FFFFFF", accent: "#FFD700" },
    voicePairings: ["narrative", "authoritative"],
    useCases: ["trailer", "documentary", "audiobook"],
  },
  {
    id: "mars_colony_habitat", name: "Mars Colony Habitat",
    description: "Red landscape outside + warm interior glow — frontier vision.",
    generatorPrompt: "Subject inside a Mars colony habitat, red Martian landscape visible through a large viewport behind them, warm interior LED glow contrasting the cool red exterior, frontier-vision atmosphere.",
    image: marsColonyHabitatImg, world: "scifi", mood: "frontier",
    isNew: true, isFeatured: true,
    lighting: "moody", timeOfDay: "controlled", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#8B0000", secondary: "#FBBF24", accent: "#1F2937" },
    voicePairings: ["authoritative", "narrative"],
    useCases: ["trailer", "documentary", "drama"],
  },
  {
    id: "cyberpunk_megacity_roof", name: "Cyberpunk Megacity · Rooftop",
    description: "Towering neon megacity below — synthwave authority.",
    generatorPrompt: "Subject on a cyberpunk megacity rooftop, neon-soaked towers stretching away below them, holographic billboards reflecting in puddles of rain, magenta + cyan synthwave grade.",
    image: cyberpunkMegacityRoofImg, world: "scifi", mood: "synthwave",
    isNew: true,
    lighting: "neon", timeOfDay: "night", temperature: "cool", productionTier: "cinematic",
    colorPalette: { primary: "#FF2EA6", secondary: "#22D3EE", accent: "#0B0B14" },
    voicePairings: ["authoritative", "energetic"],
    useCases: ["trailer", "ad-spot", "social-vo"],
  },
  {
    id: "neon_noir_city", name: "Neon Noir City",
    description: "Rain-slicked street + signage shimmer — classic noir.",
    generatorPrompt: "Subject on a neon noir city street, rain-slicked pavement reflecting magenta and cyan signage, halation bloom on every light source, anamorphic streaks, classic-noir grade.",
    image: neonNoirCityImg, world: "scifi", mood: "noir",
    isNew: true,
    lighting: "neon", timeOfDay: "night", temperature: "cool", productionTier: "cinematic",
    colorPalette: { primary: "#0B0B14", secondary: "#FF2EA6", accent: "#22D3EE" },
    voicePairings: ["authoritative", "narrative"],
    useCases: ["trailer", "audiobook", "drama"],
  },
  {
    id: "medieval_castle_hall", name: "Medieval Castle Hall",
    description: "Stone walls + iron chandelier + torchlight — fantasy gravitas.",
    generatorPrompt: "Subject in a medieval castle great hall, weathered stone walls rising behind them, iron chandelier overhead, torchlight flickering, fantasy-gravitas atmosphere.",
    image: medievalCastleHallImg, world: "scifi", mood: "fantasy",
    isNew: true,
    lighting: "moody", timeOfDay: "evening", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#3D2817", secondary: "#FFD700", accent: "#B8860B" },
    voicePairings: ["authoritative", "narrative"],
    useCases: ["audiobook", "drama", "trailer"],
  },
  {
    id: "ancient_roman_forum", name: "Ancient Roman Forum",
    description: "Marble columns + Mediterranean sun — historical prestige.",
    generatorPrompt: "Subject in the ancient Roman forum, marble columns rising behind them, harsh Mediterranean midday sun raking across the stone, historical-prestige atmosphere.",
    image: ancientRomanForumImg, world: "scifi", mood: "historical",
    isNew: true,
    lighting: "high-key", timeOfDay: "midday", temperature: "warm", productionTier: "cinematic",
    colorPalette: { primary: "#D4A574", secondary: "#F5DEB3", accent: "#556B2F" },
    voicePairings: ["narrative", "authoritative"],
    useCases: ["documentary", "audiobook", "trailer"],
  },
  {
    id: "steampunk_lab", name: "Steampunk Lab",
    description: "Brass machinery + copper pipes — Victorian invention.",
    generatorPrompt: "Subject in a steampunk laboratory, brass machinery and copper pipes lining the walls behind them, gaslamp flicker, Victorian-invention atmosphere.",
    image: steampunkLabImg, world: "scifi", mood: "inventive",
    isNew: true,
    lighting: "moody", timeOfDay: "evening", temperature: "warm", productionTier: "premium",
    colorPalette: { primary: "#B8860B", secondary: "#CD7F32", accent: "#FFD700" },
    voicePairings: ["narrative", "conversational"],
    useCases: ["audiobook", "drama", "documentary"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export function getAllTrainingScenes(): TrainingSceneBlueprint[] {
  return TRAINING_SCENE_BLUEPRINTS;
}

export function getTrainingScene(id: string): TrainingSceneBlueprint | undefined {
  return TRAINING_SCENE_BLUEPRINTS.find(s => s.id === id);
}

export function getTrainingScenesByWorld(world: TrainingSceneBlueprint["world"]): TrainingSceneBlueprint[] {
  return TRAINING_SCENE_BLUEPRINTS.filter(s => s.world === world);
}
