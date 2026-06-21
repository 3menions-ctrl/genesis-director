/**
 * BASE_PRESETS — the 20 hand-curated cinematic environments.
 *
 * Extracted from src/pages/Environments.tsx so the registry can consume
 * both this and EXTENDED_ENVIRONMENTS as a single source.
 * Shape matches ExtendedEnvironment so they merge cleanly.
 */
import {
  Sunrise, Zap, Flame, Sun, Waves, Star, TreePine, Building2,
  Snowflake, Sparkles, CloudSun, Heart, Camera, Mountain,
} from "lucide-react";
import type { ExtendedEnvironment } from "./environment-extensions";

import goldenHourMagicImg from "@/assets/environments/golden-hour-magic.jpg";
import neonNightsImg from "@/assets/environments/neon-nights.jpg";
import cozyCabinImg from "@/assets/environments/cozy-cabin.jpg";
import desertDunesImg from "@/assets/environments/desert-dunes.jpg";
import volcanicDramaImg from "@/assets/environments/volcanic-drama.jpg";
import cherryBlossomImg from "@/assets/environments/cherry-blossom.jpg";
import underwaterDreamsImg from "@/assets/environments/underwater-dreams.jpg";
import spaceStationImg from "@/assets/environments/space-station.jpg";
import enchantedForestImg from "@/assets/environments/enchanted-forest.jpg";
import urbanLuxuryImg from "@/assets/environments/urban-luxury.jpg";
import arcticAuroraImg from "@/assets/environments/arctic-aurora.jpg";
import retroArcadeImg from "@/assets/environments/retro-arcade.jpg";
import ancientRuinsImg from "@/assets/environments/ancient-ruins.jpg";
import tropicalParadiseImg from "@/assets/environments/tropical-paradise.jpg";
import postApocalypticImg from "@/assets/environments/post-apocalyptic.jpg";
import whiteStudioImg from "@/assets/environments/white-studio.jpg";
import steampunkLabImg from "@/assets/environments/steampunk-lab.jpg";
import cloudNineImg from "@/assets/environments/cloud-nine.jpg";
import zenGardenImg from "@/assets/environments/zen-garden.jpg";
import mountainSummitImg from "@/assets/environments/mountain-summit.jpg";

export const BASE_PRESETS: ExtendedEnvironment[] = [
  { id: "golden_hour_magic", name: "Golden Hour Magic",
    description: "That perfect 30-minute window of warm, dreamy sunlight everyone chases",
    category: "exterior", image: goldenHourMagicImg,
    lighting: { type: "natural", direction: "backlit", intensity: "soft", temperature: "warm", timeOfDay: "golden_hour" },
    colorPalette: { primary: "#FFB347", secondary: "#FFCC80", accent: "#FF8C00", shadows: "#8B4513" },
    mood: "dreamy", icon: Sunrise, is_trending: true, is_popular: true },
  { id: "neon_nights", name: "Neon Nights",
    description: "Electric city lights, rain-slicked streets, cyberpunk energy",
    category: "exterior", image: neonNightsImg,
    lighting: { type: "artificial", direction: "multi", intensity: "vibrant", temperature: "cool", timeOfDay: "night" },
    colorPalette: { primary: "#FF1493", secondary: "#00FFFF", accent: "#9400D3", shadows: "#0D0D1A" },
    mood: "electric", icon: Zap, is_trending: true, is_popular: true },
  { id: "cozy_cabin", name: "Cozy Cabin",
    description: "Warm firelight, wooden textures, hygge vibes for storytelling",
    category: "interior", image: cozyCabinImg,
    lighting: { type: "fire", direction: "ambient", intensity: "low", temperature: "very_warm", timeOfDay: "evening" },
    colorPalette: { primary: "#8B4513", secondary: "#D2691E", accent: "#FFD700", shadows: "#3D1F0F" },
    mood: "intimate", icon: Flame, is_trending: true },
  { id: "desert_dunes", name: "Desert Dunes",
    description: "Endless golden sand waves under blazing sun, epic Sahara vibes",
    category: "exterior", image: desertDunesImg,
    lighting: { type: "natural", direction: "overhead", intensity: "harsh", temperature: "warm", timeOfDay: "sunset" },
    colorPalette: { primary: "#C2B280", secondary: "#DEB887", accent: "#CD853F", shadows: "#8B7355" },
    mood: "epic", icon: Sun, is_trending: true },
  { id: "volcanic_drama", name: "Volcanic Drama",
    description: "Molten lava rivers, apocalyptic skies, raw elemental power",
    category: "exterior", image: volcanicDramaImg,
    lighting: { type: "fire", direction: "below", intensity: "harsh", temperature: "very_warm", timeOfDay: "night" },
    colorPalette: { primary: "#8B0000", secondary: "#FF4500", accent: "#FFD700", shadows: "#1A0000" },
    mood: "intense", icon: Flame, is_trending: true, is_popular: true },
  { id: "cherry_blossom", name: "Cherry Blossom",
    description: "Soft pink petals, koi pond, serene Japanese spring garden",
    category: "exterior", image: cherryBlossomImg,
    lighting: { type: "natural", direction: "filtered", intensity: "soft", temperature: "warm", timeOfDay: "afternoon" },
    colorPalette: { primary: "#FFB7C5", secondary: "#FFC0CB", accent: "#8B4513", shadows: "#DB7093" },
    mood: "romantic", icon: Heart, is_trending: true },
  { id: "underwater_dreams", name: "Underwater Dreams",
    description: "Bioluminescent deep sea, coral reefs, aquatic mystery",
    category: "exterior", image: underwaterDreamsImg,
    lighting: { type: "filtered", direction: "overhead", intensity: "dappled", temperature: "cool", timeOfDay: "midday" },
    colorPalette: { primary: "#006994", secondary: "#00CED1", accent: "#00FF7F", shadows: "#00008B" },
    mood: "mysterious", icon: Waves, is_trending: true },
  { id: "space_station", name: "Space Station",
    description: "Futuristic orbital hub with Earth views, sci-fi minimalism",
    category: "interior", image: spaceStationImg,
    lighting: { type: "artificial", direction: "ambient", intensity: "soft", temperature: "cool", timeOfDay: "space" },
    colorPalette: { primary: "#E8E8E8", secondary: "#B0C4DE", accent: "#4169E1", shadows: "#2F4F4F" },
    mood: "futuristic", icon: Star, is_trending: true, is_popular: true },
  { id: "enchanted_forest", name: "Enchanted Forest",
    description: "Glowing mushrooms, fireflies, mystical fairy tale woodland",
    category: "exterior", image: enchantedForestImg,
    lighting: { type: "natural", direction: "scattered", intensity: "dappled", temperature: "cool", timeOfDay: "twilight" },
    colorPalette: { primary: "#228B22", secondary: "#32CD32", accent: "#FFD700", shadows: "#013220" },
    mood: "magical", icon: TreePine, is_trending: true, is_popular: true },
  { id: "urban_luxury", name: "Urban Luxury",
    description: "Penthouse infinity pool, city skyline at twilight, glamour",
    category: "interior", image: urbanLuxuryImg,
    lighting: { type: "mixed", direction: "ambient", intensity: "soft", temperature: "warm", timeOfDay: "blue_hour" },
    colorPalette: { primary: "#1A1A1A", secondary: "#333333", accent: "#9370DB", shadows: "#0D0D0D" },
    mood: "luxurious", icon: Building2, is_trending: true },
  { id: "arctic_aurora", name: "Arctic Aurora",
    description: "Northern lights dancing over frozen tundra, cosmic wonder",
    category: "exterior", image: arcticAuroraImg,
    lighting: { type: "natural", direction: "overhead", intensity: "ethereal", temperature: "very_cool", timeOfDay: "night" },
    colorPalette: { primary: "#00FF00", secondary: "#9400D3", accent: "#E8F4F8", shadows: "#191970" },
    mood: "ethereal", icon: Snowflake, is_popular: true },
  { id: "retro_arcade", name: "Retro Arcade",
    description: "80s synthwave nostalgia, neon machines, checkered floors",
    category: "interior", image: retroArcadeImg,
    lighting: { type: "artificial", direction: "multi", intensity: "vibrant", temperature: "cool", timeOfDay: "night" },
    colorPalette: { primary: "#FF1493", secondary: "#00CED1", accent: "#FFD700", shadows: "#1A1A2E" },
    mood: "nostalgic", icon: Sparkles },
  { id: "ancient_ruins", name: "Ancient Ruins",
    description: "Greek temple at sunset, ivy-covered marble, timeless history",
    category: "exterior", image: ancientRuinsImg,
    lighting: { type: "natural", direction: "low_angle", intensity: "warm", temperature: "warm", timeOfDay: "golden_hour" },
    colorPalette: { primary: "#D4A574", secondary: "#F5DEB3", accent: "#556B2F", shadows: "#8B7355" },
    mood: "historic", icon: Building2, is_popular: true },
  { id: "tropical_paradise", name: "Tropical Paradise",
    description: "Pristine beach at sunset, palm silhouettes, vacation dreams",
    category: "exterior", image: tropicalParadiseImg,
    lighting: { type: "natural", direction: "backlit", intensity: "vibrant", temperature: "warm", timeOfDay: "sunset" },
    colorPalette: { primary: "#FF6B6B", secondary: "#40E0D0", accent: "#FF8C00", shadows: "#2E8B57" },
    mood: "paradise", icon: Waves, is_popular: true },
  { id: "post_apocalyptic", name: "Post-Apocalyptic",
    description: "Overgrown abandoned city, nature reclaiming concrete, haunting beauty",
    category: "exterior", image: postApocalypticImg,
    lighting: { type: "natural", direction: "diffused", intensity: "moody", temperature: "desaturated", timeOfDay: "overcast" },
    colorPalette: { primary: "#556B2F", secondary: "#8B8378", accent: "#CD853F", shadows: "#3D3D3D" },
    mood: "dramatic", icon: CloudSun },
  { id: "white_studio", name: "White Studio",
    description: "Clean professional backdrop, perfect for products and talking heads",
    category: "interior", image: whiteStudioImg,
    lighting: { type: "artificial", direction: "even", intensity: "bright", temperature: "neutral", timeOfDay: "controlled" },
    colorPalette: { primary: "#FFFFFF", secondary: "#F5F5F5", accent: "#333333", shadows: "#E0E0E0" },
    mood: "professional", icon: Camera, is_popular: true },
  { id: "steampunk_lab", name: "Steampunk Lab",
    description: "Victorian brass machinery, copper pipes, industrial invention",
    category: "interior", image: steampunkLabImg,
    lighting: { type: "artificial", direction: "ambient", intensity: "warm", temperature: "very_warm", timeOfDay: "evening" },
    colorPalette: { primary: "#B8860B", secondary: "#CD7F32", accent: "#FFD700", shadows: "#3D2914" },
    mood: "inventive", icon: Sparkles },
  { id: "cloud_nine", name: "Cloud Nine",
    description: "Heavenly cloudscape, golden rays, ethereal ascension",
    category: "exterior", image: cloudNineImg,
    lighting: { type: "natural", direction: "backlit", intensity: "glowing", temperature: "warm", timeOfDay: "golden_hour" },
    colorPalette: { primary: "#FFFAF0", secondary: "#FFD700", accent: "#87CEEB", shadows: "#D3D3D3" },
    mood: "divine", icon: CloudSun },
  { id: "zen_garden", name: "Zen Garden",
    description: "Raked sand patterns, bamboo, misty morning meditation",
    category: "exterior", image: zenGardenImg,
    lighting: { type: "natural", direction: "diffused", intensity: "soft", temperature: "neutral", timeOfDay: "dawn" },
    colorPalette: { primary: "#90EE90", secondary: "#F5F5DC", accent: "#228B22", shadows: "#696969" },
    mood: "peaceful", icon: TreePine },
  { id: "mountain_summit", name: "Mountain Summit",
    description: "Epic peak above clouds at sunrise, achievement and adventure",
    category: "exterior", image: mountainSummitImg,
    lighting: { type: "natural", direction: "low_angle", intensity: "dramatic", temperature: "warm", timeOfDay: "dawn" },
    colorPalette: { primary: "#4682B4", secondary: "#FFD700", accent: "#FF6347", shadows: "#2F4F4F" },
    mood: "epic", icon: Mountain, is_popular: true },
];
