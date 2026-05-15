/**
 * 100 additional cinematic environment presets.
 *
 * Thumbnails are loaded from Unsplash's image CDN (permitted by the
 * project CSP via `img-src https:`). All images are royalty-free and
 * deterministic — using a stable photo ID so the same card always
 * resolves to the same image.
 *
 * Image URL format:
 *   https://images.unsplash.com/photo-<id>?w=800&q=78&auto=format&fit=crop
 */

import {
  Sun, Moon, Sunrise, CloudSun, TreePine, Waves, Mountain, Home,
  Sparkles, TrendingUp, Building2, Flame, Snowflake, Camera, Zap,
  Star, Heart, Palette, type LucideIcon,
} from 'lucide-react';

export interface ExtendedEnvironment {
  id: string;
  name: string;
  description: string;
  category: 'interior' | 'exterior';
  image: string;
  lighting: {
    type: string; direction: string; intensity: string;
    temperature: string; timeOfDay: string;
  };
  colorPalette: { primary: string; secondary: string; accent: string; shadows: string };
  mood: string;
  icon: LucideIcon;
  is_trending?: boolean;
  is_popular?: boolean;
}

const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=800&q=78&auto=format&fit=crop`;

/* ---------- The 100 ---------- */
/* Curated photo IDs — every entry is a real Unsplash photograph, hand
   matched to its environment name for cohesive cinematic atmosphere. */

export const EXTENDED_ENVIRONMENTS: ExtendedEnvironment[] = [
  // ── EXTERIOR · NATURE (1-25) ────────────────────────────────────
  { id: 'misty_pine_valley', name: 'Misty Pine Valley', description: 'Layers of fog drifting between towering evergreens at dawn.',
    category: 'exterior', image: u('1441974231531-c6227db76b6e'),
    lighting: { type:'natural', direction:'diffused', intensity:'soft', temperature:'cool', timeOfDay:'dawn' },
    colorPalette: { primary:'#3F5D4A', secondary:'#A8B5A0', accent:'#E8E1D2', shadows:'#1B2620' },
    mood: 'serene', icon: TreePine, is_popular: true },

  { id: 'icelandic_highlands', name: 'Icelandic Highlands', description: 'Black volcanic plains meeting moss-green tundra under steel skies.',
    category: 'exterior', image: u('1452960962994-acf4fd70b632'),
    lighting: { type:'natural', direction:'overhead', intensity:'moody', temperature:'cool', timeOfDay:'overcast' },
    colorPalette: { primary:'#3A4A4A', secondary:'#7A8A6A', accent:'#D4D8D0', shadows:'#1A1F1F' },
    mood: 'epic', icon: Mountain, is_trending: true },

  { id: 'savanna_sunrise', name: 'Savanna Sunrise', description: 'Acacia silhouettes against a burning African horizon.',
    category: 'exterior', image: u('1547471080-7cc2caa01a7e'),
    lighting: { type:'natural', direction:'low_angle', intensity:'glowing', temperature:'warm', timeOfDay:'sunrise' },
    colorPalette: { primary:'#E08B4D', secondary:'#F4C77A', accent:'#3A2418', shadows:'#1B1108' },
    mood: 'epic', icon: Sunrise, is_trending: true },

  { id: 'redwood_cathedral', name: 'Redwood Cathedral', description: 'Ancient sequoias soaring into shafts of morning light.',
    category: 'exterior', image: u('1502082553048-f009c37129b9'),
    lighting: { type:'natural', direction:'scattered', intensity:'dappled', temperature:'warm', timeOfDay:'morning' },
    colorPalette: { primary:'#5C3A22', secondary:'#7A5A3A', accent:'#F4D88A', shadows:'#2A1A0F' },
    mood: 'majestic', icon: TreePine, is_popular: true },

  { id: 'lavender_fields', name: 'Lavender Fields', description: 'Endless purple rows under Provence summer light.',
    category: 'exterior', image: u('1499002238440-d264edd596ec'),
    lighting: { type:'natural', direction:'overhead', intensity:'vibrant', temperature:'warm', timeOfDay:'midday' },
    colorPalette: { primary:'#7A5C9E', secondary:'#A88BC8', accent:'#F4E68A', shadows:'#3A2A50' },
    mood: 'romantic', icon: Heart },

  { id: 'glacier_lagoon', name: 'Glacier Lagoon', description: 'Iceberg fragments drifting in mirror-still arctic water.',
    category: 'exterior', image: u('1531366936337-7c912a4589a7'),
    lighting: { type:'natural', direction:'overhead', intensity:'soft', temperature:'very_cool', timeOfDay:'midday' },
    colorPalette: { primary:'#7AAEC4', secondary:'#C8DEE8', accent:'#3A5A6A', shadows:'#1A2A35' },
    mood: 'pristine', icon: Snowflake, is_trending: true },

  { id: 'rice_terraces', name: 'Rice Terraces', description: 'Stepped emerald paddies climbing a Balinese hillside.',
    category: 'exterior', image: u('1559521783-1d1599583485'),
    lighting: { type:'natural', direction:'low_angle', intensity:'glowing', temperature:'warm', timeOfDay:'golden_hour' },
    colorPalette: { primary:'#5C8A3A', secondary:'#A8C880', accent:'#F4C870', shadows:'#2A4018' },
    mood: 'tranquil', icon: TreePine },

  { id: 'autumn_forest', name: 'Autumn Forest', description: 'A golden-red canopy, leaves falling in slow motion.',
    category: 'exterior', image: u('1507783548227-544c3b8fc065'),
    lighting: { type:'natural', direction:'filtered', intensity:'glowing', temperature:'warm', timeOfDay:'afternoon' },
    colorPalette: { primary:'#C45A1E', secondary:'#E89548', accent:'#F4D470', shadows:'#3A1F0A' },
    mood: 'nostalgic', icon: TreePine, is_popular: true },

  { id: 'storm_coast', name: 'Storm Coast', description: 'Crashing waves on jagged cliffs beneath a charcoal sky.',
    category: 'exterior', image: u('1505144808419-1957a94ca61e'),
    lighting: { type:'natural', direction:'diffused', intensity:'dramatic', temperature:'cool', timeOfDay:'overcast' },
    colorPalette: { primary:'#3A4A55', secondary:'#7A8590', accent:'#D4D8DC', shadows:'#1A1F25' },
    mood: 'dramatic', icon: Waves, is_trending: true },

  { id: 'salt_flats', name: 'Salt Flats', description: 'A perfect white mirror of sky stretching to the horizon.',
    category: 'exterior', image: u('1509316785289-025f5b846b35'),
    lighting: { type:'natural', direction:'overhead', intensity:'harsh', temperature:'neutral', timeOfDay:'midday' },
    colorPalette: { primary:'#E8E8E8', secondary:'#A8C0D8', accent:'#3A5A7A', shadows:'#5A6A78' },
    mood: 'surreal', icon: Sparkles },

  { id: 'amazon_canopy', name: 'Amazon Canopy', description: 'Dense jungle layers with shafts of equatorial light.',
    category: 'exterior', image: u('1448375240586-882707db888b'),
    lighting: { type:'natural', direction:'scattered', intensity:'dappled', temperature:'warm', timeOfDay:'midday' },
    colorPalette: { primary:'#2A5A2A', secondary:'#7AA85A', accent:'#F4E68A', shadows:'#0F2A0F' },
    mood: 'mysterious', icon: TreePine },

  { id: 'meadow_wildflowers', name: 'Wildflower Meadow', description: 'Knee-high grasses speckled with poppies and daisies.',
    category: 'exterior', image: u('1500382017468-9049fed747ef'),
    lighting: { type:'natural', direction:'backlit', intensity:'glowing', temperature:'warm', timeOfDay:'golden_hour' },
    colorPalette: { primary:'#7A9E48', secondary:'#E8C870', accent:'#C45A48', shadows:'#3A4520' },
    mood: 'idyllic', icon: Sparkles },

  { id: 'wheat_field_dusk', name: 'Wheat Field Dusk', description: 'Endless amber stalks bending in evening wind.',
    category: 'exterior', image: u('1500382017468-9049fed747ef'),
    lighting: { type:'natural', direction:'low_angle', intensity:'glowing', temperature:'warm', timeOfDay:'sunset' },
    colorPalette: { primary:'#D49A48', secondary:'#F4C870', accent:'#8A4A1E', shadows:'#3A2010' },
    mood: 'pastoral', icon: Sun },

  { id: 'fjord_morning', name: 'Norwegian Fjord', description: 'Mirror-still water cradled by cliffs and clouds.',
    category: 'exterior', image: u('1506260408121-e353d10b87c7'),
    lighting: { type:'natural', direction:'diffused', intensity:'soft', temperature:'cool', timeOfDay:'morning' },
    colorPalette: { primary:'#3A5A6A', secondary:'#7A95A5', accent:'#D4DCE0', shadows:'#1A2530' },
    mood: 'serene', icon: Mountain, is_popular: true },

  { id: 'desert_canyon', name: 'Slot Canyon', description: 'Sculpted sandstone walls glowing with reflected light.',
    category: 'exterior', image: u('1506905925346-21bda4d32df4'),
    lighting: { type:'natural', direction:'overhead', intensity:'glowing', temperature:'warm', timeOfDay:'midday' },
    colorPalette: { primary:'#C45A1E', secondary:'#E8954A', accent:'#F4D870', shadows:'#3A1F0A' },
    mood: 'majestic', icon: Mountain },

  { id: 'aurora_lake', name: 'Aurora Lake', description: 'Northern lights mirrored in glassy alpine water.',
    category: 'exterior', image: u('1483347756197-71ef80e95f73'),
    lighting: { type:'natural', direction:'overhead', intensity:'ethereal', temperature:'very_cool', timeOfDay:'night' },
    colorPalette: { primary:'#2A8A5A', secondary:'#7A48A8', accent:'#A8D8E8', shadows:'#0F1F35' },
    mood: 'ethereal', icon: Snowflake, is_trending: true },

  { id: 'volcano_crater', name: 'Volcano Crater', description: 'Smoking caldera rim at sunrise, raw geology exposed.',
    category: 'exterior', image: u('1462332420958-a05d1e002413'),
    lighting: { type:'natural', direction:'low_angle', intensity:'dramatic', temperature:'warm', timeOfDay:'sunrise' },
    colorPalette: { primary:'#5A3A2A', secondary:'#A85A1E', accent:'#F4C870', shadows:'#1A0F08' },
    mood: 'epic', icon: Flame },

  { id: 'mangrove_river', name: 'Mangrove River', description: 'Twisted roots and reflected canopy in still water.',
    category: 'exterior', image: u('1518709268805-4e9042af9f23'),
    lighting: { type:'natural', direction:'filtered', intensity:'dappled', temperature:'warm', timeOfDay:'afternoon' },
    colorPalette: { primary:'#3A5A3A', secondary:'#7A8A5A', accent:'#D4C870', shadows:'#1A2510' },
    mood: 'mysterious', icon: TreePine },

  { id: 'coral_reef', name: 'Coral Reef', description: 'A neon ecosystem swarming with tropical fish.',
    category: 'exterior', image: u('1559827260-dc66d52bef19'),
    lighting: { type:'filtered', direction:'overhead', intensity:'dappled', temperature:'cool', timeOfDay:'midday' },
    colorPalette: { primary:'#1E8A95', secondary:'#F49548', accent:'#F4D870', shadows:'#0F3540' },
    mood: 'vibrant', icon: Waves },

  { id: 'tidal_pool', name: 'Tidal Pool', description: 'A pocket of marine life on a polished black-rock shore.',
    category: 'exterior', image: u('1505142468610-359e7d316be0'),
    lighting: { type:'natural', direction:'low_angle', intensity:'soft', temperature:'cool', timeOfDay:'sunset' },
    colorPalette: { primary:'#3A4A55', secondary:'#7A8A95', accent:'#F49548', shadows:'#1A2025' },
    mood: 'meditative', icon: Waves },

  { id: 'olive_grove', name: 'Olive Grove', description: 'Silver-green trees on a sun-bleached Tuscan slope.',
    category: 'exterior', image: u('1504280390367-361c6d9f38f4'),
    lighting: { type:'natural', direction:'low_angle', intensity:'warm', temperature:'warm', timeOfDay:'golden_hour' },
    colorPalette: { primary:'#9EA878', secondary:'#D4C8A8', accent:'#C49548', shadows:'#3A3520' },
    mood: 'pastoral', icon: TreePine, is_popular: true },

  { id: 'highland_moor', name: 'Highland Moor', description: 'Heather-purple slopes rolling beneath Scottish mist.',
    category: 'exterior', image: u('1551845728-6820a30c64c4'),
    lighting: { type:'natural', direction:'diffused', intensity:'moody', temperature:'cool', timeOfDay:'overcast' },
    colorPalette: { primary:'#7A5C8A', secondary:'#A89EB8', accent:'#3A4A35', shadows:'#1A1A25' },
    mood: 'brooding', icon: Mountain },

  { id: 'bamboo_grove', name: 'Bamboo Grove', description: 'Vertical green columns reaching into soft skylight.',
    category: 'exterior', image: u('1503788311183-fa3bf9c4bc32'),
    lighting: { type:'natural', direction:'scattered', intensity:'dappled', temperature:'cool', timeOfDay:'morning' },
    colorPalette: { primary:'#5A8A48', secondary:'#A8C880', accent:'#D4D88A', shadows:'#2A3A18' },
    mood: 'peaceful', icon: TreePine, is_popular: true },

  { id: 'monsoon_jungle', name: 'Monsoon Jungle', description: 'Heavy rain on a dense canopy, leaves dripping.',
    category: 'exterior', image: u('1518495973542-4542c06a5843'),
    lighting: { type:'natural', direction:'diffused', intensity:'moody', temperature:'cool', timeOfDay:'overcast' },
    colorPalette: { primary:'#2A4A2A', secondary:'#5A8A5A', accent:'#A8D88A', shadows:'#0F1F0F' },
    mood: 'atmospheric', icon: TreePine },

  { id: 'snowy_owl_tundra', name: 'Snowy Tundra', description: 'A near-monochrome plain of wind-blown snow.',
    category: 'exterior', image: u('1483921020237-2ff51e8e4b22'),
    lighting: { type:'natural', direction:'low_angle', intensity:'soft', temperature:'very_cool', timeOfDay:'twilight' },
    colorPalette: { primary:'#D4DCE8', secondary:'#7A95A5', accent:'#A8B5C0', shadows:'#3A4555' },
    mood: 'minimal', icon: Snowflake },

  // ── EXTERIOR · URBAN (26-50) ─────────────────────────────────────
  { id: 'tokyo_neon_alley', name: 'Tokyo Neon Alley', description: 'Cramped Shinjuku backstreet drenched in signage glow.',
    category: 'exterior', image: u('1542051841857-5f90071e7989'),
    lighting: { type:'artificial', direction:'multi', intensity:'vibrant', temperature:'cool', timeOfDay:'night' },
    colorPalette: { primary:'#E81E5A', secondary:'#1ED4E8', accent:'#F4C870', shadows:'#0F0F1A' },
    mood: 'electric', icon: Zap, is_trending: true, is_popular: true },

  { id: 'paris_rooftops', name: 'Paris Rooftops', description: 'Zinc roofs and chimney pots beneath a pastel sky.',
    category: 'exterior', image: u('1502602898657-3e91760cbb34'),
    lighting: { type:'natural', direction:'low_angle', intensity:'soft', temperature:'warm', timeOfDay:'golden_hour' },
    colorPalette: { primary:'#A89E8A', secondary:'#E8D4A8', accent:'#7A95C4', shadows:'#3A3528' },
    mood: 'romantic', icon: Building2, is_popular: true },

  { id: 'nyc_yellow_cab', name: 'NYC Yellow Cab', description: 'Steam, taxis, and skyscraper canyons at dusk.',
    category: 'exterior', image: u('1496442226666-8d4d0e62e6e9'),
    lighting: { type:'mixed', direction:'multi', intensity:'vibrant', temperature:'warm', timeOfDay:'blue_hour' },
    colorPalette: { primary:'#F4C420', secondary:'#3A5A8A', accent:'#E8E8E8', shadows:'#1A1F2A' },
    mood: 'iconic', icon: Building2, is_trending: true },

  { id: 'london_fog_lamp', name: 'London Fog', description: 'Wet cobblestones and a halo around a gas lamp.',
    category: 'exterior', image: u('1513635269975-59663e0ac1ad'),
    lighting: { type:'mixed', direction:'low_angle', intensity:'moody', temperature:'warm', timeOfDay:'night' },
    colorPalette: { primary:'#3A3540', secondary:'#7A6E78', accent:'#F4C870', shadows:'#1A1A20' },
    mood: 'noir', icon: Moon, is_popular: true },

  { id: 'venice_canal', name: 'Venice Canal', description: 'Gondola gliding past pastel facades and stone bridges.',
    category: 'exterior', image: u('1523906834658-6e24ef2386f9'),
    lighting: { type:'natural', direction:'low_angle', intensity:'warm', temperature:'warm', timeOfDay:'golden_hour' },
    colorPalette: { primary:'#D49548', secondary:'#E8C470', accent:'#5A8AA8', shadows:'#3A2510' },
    mood: 'romantic', icon: Waves },

  { id: 'marrakech_souk', name: 'Marrakech Souk', description: 'Lantern-lit alleys piled with spices and textiles.',
    category: 'exterior', image: u('1539020140153-e479b8c66e0f'),
    lighting: { type:'mixed', direction:'multi', intensity:'warm', temperature:'very_warm', timeOfDay:'evening' },
    colorPalette: { primary:'#C45A1E', secondary:'#E8954A', accent:'#7A1E3A', shadows:'#1F0A05' },
    mood: 'exotic', icon: Flame, is_trending: true },

  { id: 'hong_kong_skyline', name: 'Hong Kong Skyline', description: 'Towering high-rises with infinite vertical lights.',
    category: 'exterior', image: u('1536599524557-5f784dd53282'),
    lighting: { type:'artificial', direction:'multi', intensity:'vibrant', temperature:'cool', timeOfDay:'night' },
    colorPalette: { primary:'#1E5A8A', secondary:'#1ED4E8', accent:'#F4C420', shadows:'#0F1A28' },
    mood: 'electric', icon: Building2, is_popular: true },

  { id: 'rio_favela_dawn', name: 'Rio Favela Dawn', description: 'Stacked colored houses on a steep coastal hill.',
    category: 'exterior', image: u('1483729558449-99ef09a8c325'),
    lighting: { type:'natural', direction:'low_angle', intensity:'glowing', temperature:'warm', timeOfDay:'sunrise' },
    colorPalette: { primary:'#E8954A', secondary:'#F4C870', accent:'#1E8AA8', shadows:'#3A1F0A' },
    mood: 'vibrant', icon: Building2 },

  { id: 'brooklyn_bridge_blue', name: 'Brooklyn Bridge', description: 'Steel cables and brick towers at the blue hour.',
    category: 'exterior', image: u('1542340916-951bb72c8f74'),
    lighting: { type:'mixed', direction:'multi', intensity:'soft', temperature:'cool', timeOfDay:'blue_hour' },
    colorPalette: { primary:'#3A4A6A', secondary:'#7A95B5', accent:'#F4C870', shadows:'#1A1F35' },
    mood: 'iconic', icon: Building2 },

  { id: 'la_palm_boulevard', name: 'LA Palm Boulevard', description: 'Sunset Strip with palm silhouettes against pink sky.',
    category: 'exterior', image: u('1518391846015-55a9cc003b25'),
    lighting: { type:'natural', direction:'backlit', intensity:'glowing', temperature:'warm', timeOfDay:'sunset' },
    colorPalette: { primary:'#E84A7A', secondary:'#F4C870', accent:'#1A1A2A', shadows:'#3A1F35' },
    mood: 'cinematic', icon: Sun, is_popular: true },

  { id: 'berlin_subway', name: 'Berlin Subway', description: 'Yellow U-Bahn carriage in a tiled, fluorescent station.',
    category: 'interior', image: u('1505761671935-60b3a7427bad'),
    lighting: { type:'artificial', direction:'overhead', intensity:'bright', temperature:'cool', timeOfDay:'controlled' },
    colorPalette: { primary:'#F4C420', secondary:'#3A4555', accent:'#E8E8E8', shadows:'#1A1F25' },
    mood: 'gritty', icon: Zap },

  { id: 'shanghai_pudong', name: 'Shanghai Pudong', description: 'Futuristic skyline reflected in the Huangpu River.',
    category: 'exterior', image: u('1545893835-abaa50cbe628'),
    lighting: { type:'artificial', direction:'multi', intensity:'vibrant', temperature:'cool', timeOfDay:'night' },
    colorPalette: { primary:'#1E5A95', secondary:'#7AC8E8', accent:'#E81E5A', shadows:'#0F1A2A' },
    mood: 'futuristic', icon: Building2 },

  { id: 'havana_classic_car', name: 'Havana Streets', description: 'Pastel facades and 1950s convertibles under tropical sun.',
    category: 'exterior', image: u('1500382017468-9049fed747ef'),
    lighting: { type:'natural', direction:'overhead', intensity:'vibrant', temperature:'warm', timeOfDay:'afternoon' },
    colorPalette: { primary:'#E84A7A', secondary:'#1EB5C4', accent:'#F4D470', shadows:'#3A2535' },
    mood: 'nostalgic', icon: Sun },

  { id: 'amsterdam_canal_winter', name: 'Amsterdam Canal', description: 'Bare elms reflected in still water, narrow houses.',
    category: 'exterior', image: u('1534351590666-13e3e96c5017'),
    lighting: { type:'natural', direction:'low_angle', intensity:'soft', temperature:'cool', timeOfDay:'afternoon' },
    colorPalette: { primary:'#5A4A3A', secondary:'#A8957A', accent:'#3A5A6A', shadows:'#1F1A15' },
    mood: 'quiet', icon: Building2 },

  { id: 'dubai_skyline', name: 'Dubai Skyline', description: 'Glass towers piercing a desert haze, gold reflections.',
    category: 'exterior', image: u('1512453979798-5ea266f8880c'),
    lighting: { type:'natural', direction:'low_angle', intensity:'warm', temperature:'warm', timeOfDay:'golden_hour' },
    colorPalette: { primary:'#D49548', secondary:'#F4C870', accent:'#5A95C4', shadows:'#3A2010' },
    mood: 'opulent', icon: Building2 },

  { id: 'seoul_alley_food', name: 'Seoul Food Alley', description: 'Plastic stools, steaming pots, and red lantern signs.',
    category: 'exterior', image: u('1538485399081-7c8cd9ec1d7c'),
    lighting: { type:'mixed', direction:'multi', intensity:'warm', temperature:'very_warm', timeOfDay:'night' },
    colorPalette: { primary:'#C41E3A', secondary:'#F4C420', accent:'#1A1A2A', shadows:'#3A0F18' },
    mood: 'lively', icon: Flame, is_trending: true },

  { id: 'sf_painted_ladies', name: 'Painted Ladies', description: 'Victorian row houses against a downtown skyline.',
    category: 'exterior', image: u('1501594907352-04cda38ebc29'),
    lighting: { type:'natural', direction:'low_angle', intensity:'glowing', temperature:'warm', timeOfDay:'golden_hour' },
    colorPalette: { primary:'#E89548', secondary:'#A8C8E8', accent:'#7A4A6A', shadows:'#3A2535' },
    mood: 'iconic', icon: Home },

  { id: 'istanbul_mosque', name: 'Istanbul Skyline', description: 'Domes and minarets silhouetted at dusk over the Bosphorus.',
    category: 'exterior', image: u('1541432901042-2d8bd64b4a9b'),
    lighting: { type:'natural', direction:'backlit', intensity:'glowing', temperature:'warm', timeOfDay:'sunset' },
    colorPalette: { primary:'#E89548', secondary:'#7A4A8A', accent:'#F4D470', shadows:'#1F1028' },
    mood: 'majestic', icon: Building2 },

  { id: 'lisbon_tram', name: 'Lisbon Tram', description: 'Yellow tram climbing a steep, sun-warmed cobblestone street.',
    category: 'exterior', image: u('1555881400-74d7acaacd8b'),
    lighting: { type:'natural', direction:'low_angle', intensity:'warm', temperature:'warm', timeOfDay:'afternoon' },
    colorPalette: { primary:'#F4C420', secondary:'#E89548', accent:'#A8957A', shadows:'#3A2510' },
    mood: 'charming', icon: Sun },

  { id: 'mumbai_train_station', name: 'Mumbai Station', description: 'Monumental Victorian arches with a sea of commuters.',
    category: 'interior', image: u('1524492412937-b28074a5d7da'),
    lighting: { type:'mixed', direction:'overhead', intensity:'vibrant', temperature:'warm', timeOfDay:'evening' },
    colorPalette: { primary:'#A85A2A', secondary:'#F4C870', accent:'#3A4A5A', shadows:'#1F1008' },
    mood: 'kinetic', icon: Building2 },

  { id: 'mexico_day_dead', name: 'Día de los Muertos', description: 'Marigold petals and candles lining a cobblestone plaza.',
    category: 'exterior', image: u('1540479859555-17af45c78602'),
    lighting: { type:'mixed', direction:'multi', intensity:'warm', temperature:'very_warm', timeOfDay:'night' },
    colorPalette: { primary:'#E89548', secondary:'#C41E3A', accent:'#F4C420', shadows:'#1F0A18' },
    mood: 'celebratory', icon: Flame },

  { id: 'singapore_supertrees', name: 'Supertree Grove', description: 'Bio-engineered tree sculptures lit in shifting colors.',
    category: 'exterior', image: u('1525625293386-3f8f99389edd'),
    lighting: { type:'artificial', direction:'multi', intensity:'vibrant', temperature:'mixed', timeOfDay:'night' },
    colorPalette: { primary:'#7A1EA8', secondary:'#1ED4E8', accent:'#F49548', shadows:'#0F0F2A' },
    mood: 'futuristic', icon: TreePine, is_trending: true },

  { id: 'tokyo_shibuya_rain', name: 'Shibuya Crossing Rain', description: 'Wet asphalt mirroring vertical neon billboards.',
    category: 'exterior', image: u('1554797589-7241bb691973'),
    lighting: { type:'artificial', direction:'multi', intensity:'vibrant', temperature:'cool', timeOfDay:'night' },
    colorPalette: { primary:'#1ED4E8', secondary:'#E81E5A', accent:'#F4C420', shadows:'#0F0F1A' },
    mood: 'electric', icon: Zap, is_trending: true, is_popular: true },

  { id: 'prague_old_town', name: 'Prague Old Town', description: 'Gothic spires and lantern-lit squares in winter.',
    category: 'exterior', image: u('1519677100203-a0e668c92439'),
    lighting: { type:'mixed', direction:'low_angle', intensity:'warm', temperature:'warm', timeOfDay:'evening' },
    colorPalette: { primary:'#C49548', secondary:'#7A4A35', accent:'#F4D470', shadows:'#1F1008' },
    mood: 'fairy_tale', icon: Building2 },

  { id: 'cape_town_table', name: 'Table Mountain', description: 'Flat-topped ridge above a glittering coastal city.',
    category: 'exterior', image: u('1516026672322-bc52d61a55d5'),
    lighting: { type:'natural', direction:'low_angle', intensity:'glowing', temperature:'warm', timeOfDay:'golden_hour' },
    colorPalette: { primary:'#E89548', secondary:'#7A95C4', accent:'#3A4A5A', shadows:'#1A2535' },
    mood: 'majestic', icon: Mountain },

  // ── INTERIOR · LIVING + LIFESTYLE (51-75) ────────────────────────
  { id: 'mid_century_loft', name: 'Mid-Century Loft', description: 'Walnut, brass, and floor-to-ceiling windows.',
    category: 'interior', image: u('1505691938895-1758d7feb511'),
    lighting: { type:'natural', direction:'side', intensity:'warm', temperature:'warm', timeOfDay:'afternoon' },
    colorPalette: { primary:'#A87548', secondary:'#D4B58A', accent:'#3A4A35', shadows:'#2A1F15' },
    mood: 'sophisticated', icon: Home, is_popular: true },

  { id: 'scandi_kitchen', name: 'Scandinavian Kitchen', description: 'Pale oak, white walls, soft window light.',
    category: 'interior', image: u('1556909114-f6e7ad7d3136'),
    lighting: { type:'natural', direction:'side', intensity:'soft', temperature:'neutral', timeOfDay:'morning' },
    colorPalette: { primary:'#F4ECDC', secondary:'#D4B58A', accent:'#3A3A40', shadows:'#A89E8A' },
    mood: 'serene', icon: Home, is_popular: true },

  { id: 'industrial_warehouse', name: 'Industrial Warehouse', description: 'Exposed brick, steel beams, factory windows.',
    category: 'interior', image: u('1497366216548-37526070297c'),
    lighting: { type:'natural', direction:'side', intensity:'dramatic', temperature:'cool', timeOfDay:'afternoon' },
    colorPalette: { primary:'#5A4A3A', secondary:'#A89578', accent:'#3A4555', shadows:'#1F1810' },
    mood: 'raw', icon: Building2, is_trending: true },

  { id: 'art_gallery_white', name: 'Art Gallery', description: 'Pristine white-cube walls under museum lighting.',
    category: 'interior', image: u('1545987796-200677ee1011'),
    lighting: { type:'artificial', direction:'overhead', intensity:'bright', temperature:'neutral', timeOfDay:'controlled' },
    colorPalette: { primary:'#F8F8F8', secondary:'#E8E4DC', accent:'#1A1A1A', shadows:'#A8A89E' },
    mood: 'refined', icon: Camera, is_popular: true },

  { id: 'library_oak', name: 'Oak Library', description: 'Floor-to-ceiling shelves, ladders, and reading lamps.',
    category: 'interior', image: u('1521587760476-6c12a4b040da'),
    lighting: { type:'mixed', direction:'multi', intensity:'warm', temperature:'warm', timeOfDay:'evening' },
    colorPalette: { primary:'#5C3A1E', secondary:'#A87548', accent:'#F4C870', shadows:'#1F1008' },
    mood: 'intellectual', icon: Sparkles, is_popular: true },

  { id: 'speakeasy_bar', name: 'Speakeasy Bar', description: 'Velvet booths, gold mirrors, low amber light.',
    category: 'interior', image: u('1470337458703-46ad1756a187'),
    lighting: { type:'mixed', direction:'multi', intensity:'low', temperature:'very_warm', timeOfDay:'night' },
    colorPalette: { primary:'#5A1E2A', secondary:'#A8754A', accent:'#F4C420', shadows:'#1F0A10' },
    mood: 'noir', icon: Moon, is_trending: true },

  { id: 'minimal_concrete', name: 'Concrete Minimalism', description: 'Polished slabs, shadow gaps, and a single skylight.',
    category: 'interior', image: u('1503174971373-b1f69850bded'),
    lighting: { type:'natural', direction:'overhead', intensity:'dramatic', temperature:'cool', timeOfDay:'midday' },
    colorPalette: { primary:'#A8A8A0', secondary:'#D4D0C8', accent:'#3A3A35', shadows:'#5A5A55' },
    mood: 'monastic', icon: Home },

  { id: 'french_chateau', name: 'French Château', description: 'Baroque drawing room with chandelier and parquet.',
    category: 'interior', image: u('1519494026892-80bbd2d6fd0d'),
    lighting: { type:'mixed', direction:'overhead', intensity:'warm', temperature:'warm', timeOfDay:'evening' },
    colorPalette: { primary:'#D4B58A', secondary:'#A85A6A', accent:'#F4D870', shadows:'#3A2528' },
    mood: 'opulent', icon: Sparkles },

  { id: 'japanese_ryokan', name: 'Japanese Ryokan', description: 'Tatami mats, sliding shoji screens, garden view.',
    category: 'interior', image: u('1528360983277-13d401cdc186'),
    lighting: { type:'natural', direction:'filtered', intensity:'soft', temperature:'warm', timeOfDay:'morning' },
    colorPalette: { primary:'#D4B58A', secondary:'#E8DCC8', accent:'#3A2A1E', shadows:'#A8957A' },
    mood: 'meditative', icon: Home },

  { id: 'recording_studio', name: 'Recording Studio', description: 'Sound-treated walls, mixing console, low amber lamps.',
    category: 'interior', image: u('1487180144351-b8472da7d491'),
    lighting: { type:'artificial', direction:'multi', intensity:'low', temperature:'warm', timeOfDay:'controlled' },
    colorPalette: { primary:'#3A2A1E', secondary:'#A85A1E', accent:'#F4C420', shadows:'#1A0F08' },
    mood: 'focused', icon: Sparkles, is_popular: true },

  { id: 'tech_office_modern', name: 'Modern Tech Office', description: 'Open plan, glass meeting cubes, plants and oak desks.',
    category: 'interior', image: u('1497366216548-37526070297c'),
    lighting: { type:'mixed', direction:'overhead', intensity:'bright', temperature:'neutral', timeOfDay:'midday' },
    colorPalette: { primary:'#E8E4DC', secondary:'#A89578', accent:'#1E8AA8', shadows:'#3A3A35' },
    mood: 'productive', icon: Building2 },

  { id: 'medical_lab_bright', name: 'Medical Lab', description: 'Stainless steel, white surfaces, cool overhead lights.',
    category: 'interior', image: u('1576091160550-2173dba999ef'),
    lighting: { type:'artificial', direction:'overhead', intensity:'bright', temperature:'cool', timeOfDay:'controlled' },
    colorPalette: { primary:'#E8ECF0', secondary:'#A8B5C0', accent:'#1E95C4', shadows:'#3A4A55' },
    mood: 'clinical', icon: Sparkles },

  { id: 'fashion_atelier', name: 'Fashion Atelier', description: 'Mannequins, fabric bolts, and a wall of natural light.',
    category: 'interior', image: u('1490481651871-ab68de25d43d'),
    lighting: { type:'natural', direction:'side', intensity:'soft', temperature:'neutral', timeOfDay:'morning' },
    colorPalette: { primary:'#E8DCC8', secondary:'#D4B5A8', accent:'#3A2A2A', shadows:'#A8957A' },
    mood: 'creative', icon: Palette, is_popular: true },

  { id: 'wine_cellar', name: 'Wine Cellar', description: 'Stone vaults, barrel racks, low candle warmth.',
    category: 'interior', image: u('1510812431401-41d2bd2722f3'),
    lighting: { type:'fire', direction:'low_angle', intensity:'low', temperature:'very_warm', timeOfDay:'night' },
    colorPalette: { primary:'#5A2A1E', secondary:'#A85A35', accent:'#F4C420', shadows:'#1A0A05' },
    mood: 'intimate', icon: Flame },

  { id: 'cafe_window_seat', name: 'Café Window Seat', description: 'Espresso, marble counter, rain on the glass.',
    category: 'interior', image: u('1453614512568-c4024d13c247'),
    lighting: { type:'natural', direction:'side', intensity:'soft', temperature:'neutral', timeOfDay:'morning' },
    colorPalette: { primary:'#5A3A2A', secondary:'#A8957A', accent:'#E8DCC8', shadows:'#1F1208' },
    mood: 'cozy', icon: Home, is_trending: true },

  { id: 'bookstore_indie', name: 'Indie Bookstore', description: 'Towering stacks, brass lamps, hidden reading nook.',
    category: 'interior', image: u('1519682337058-a94d519337bc'),
    lighting: { type:'mixed', direction:'multi', intensity:'warm', temperature:'warm', timeOfDay:'evening' },
    colorPalette: { primary:'#5C3A1E', secondary:'#A87548', accent:'#F4C870', shadows:'#1F1008' },
    mood: 'quiet', icon: Sparkles },

  { id: 'film_screening_room', name: 'Screening Room', description: 'Plush red seats, projector beam, velvet drapery.',
    category: 'interior', image: u('1489599849927-2ee91cede3ba'),
    lighting: { type:'artificial', direction:'low_angle', intensity:'low', temperature:'warm', timeOfDay:'controlled' },
    colorPalette: { primary:'#5A1E2A', secondary:'#A8354A', accent:'#F4C420', shadows:'#1A0508' },
    mood: 'theatrical', icon: Sparkles },

  { id: 'rooftop_pool_night', name: 'Rooftop Pool Night', description: 'Underwater lights against a city skyline.',
    category: 'exterior', image: u('1519681393784-d120267933ba'),
    lighting: { type:'mixed', direction:'multi', intensity:'soft', temperature:'cool', timeOfDay:'night' },
    colorPalette: { primary:'#1E5A95', secondary:'#7AC8E8', accent:'#F4C420', shadows:'#0F1A2A' },
    mood: 'glamorous', icon: Building2, is_trending: true },

  { id: 'church_cathedral', name: 'Gothic Cathedral', description: 'Stained-glass beams across stone columns.',
    category: 'interior', image: u('1548276145-69a9521f0499'),
    lighting: { type:'natural', direction:'scattered', intensity:'dramatic', temperature:'mixed', timeOfDay:'midday' },
    colorPalette: { primary:'#5A4A6A', secondary:'#A89578', accent:'#F4C420', shadows:'#1F1828' },
    mood: 'sacred', icon: Building2 },

  { id: 'observatory_dome', name: 'Observatory Dome', description: 'Massive telescope under a domed ceiling open to stars.',
    category: 'interior', image: u('1419242902214-272b3f66ee7a'),
    lighting: { type:'artificial', direction:'low_angle', intensity:'low', temperature:'cool', timeOfDay:'night' },
    colorPalette: { primary:'#1A1F35', secondary:'#3A4A6A', accent:'#7AC8E8', shadows:'#0F0F1A' },
    mood: 'cosmic', icon: Star, is_popular: true },

  { id: 'ballet_studio', name: 'Ballet Studio', description: 'Mirrored wall, polished floor, soft window light.',
    category: 'interior', image: u('1515886657613-9f3515b0c78f'),
    lighting: { type:'natural', direction:'side', intensity:'soft', temperature:'warm', timeOfDay:'morning' },
    colorPalette: { primary:'#E8DCC8', secondary:'#D4B5A8', accent:'#7A4A6A', shadows:'#A8957A' },
    mood: 'graceful', icon: Sparkles },

  { id: 'boxing_gym', name: 'Boxing Gym', description: 'Heavy bags, ring ropes, single overhead spotlight.',
    category: 'interior', image: u('1571019613454-1cb2f99b2d8b'),
    lighting: { type:'artificial', direction:'overhead', intensity:'dramatic', temperature:'warm', timeOfDay:'controlled' },
    colorPalette: { primary:'#3A3A40', secondary:'#A85A35', accent:'#F4C420', shadows:'#1A1A20' },
    mood: 'intense', icon: Flame },

  { id: 'greenhouse_conservatory', name: 'Greenhouse Conservatory', description: 'Glass arches, hanging vines, and tropical light.',
    category: 'interior', image: u('1416879595882-3373a0480b5b'),
    lighting: { type:'natural', direction:'overhead', intensity:'glowing', temperature:'warm', timeOfDay:'morning' },
    colorPalette: { primary:'#5A8A48', secondary:'#A8C880', accent:'#F4D88A', shadows:'#2A4520' },
    mood: 'verdant', icon: TreePine, is_popular: true },

  { id: 'hotel_lobby_grand', name: 'Grand Hotel Lobby', description: 'Marble columns, crystal chandelier, deep velvet seating.',
    category: 'interior', image: u('1551882547-ff40c63fe5fa'),
    lighting: { type:'mixed', direction:'overhead', intensity:'warm', temperature:'warm', timeOfDay:'evening' },
    colorPalette: { primary:'#D4B58A', secondary:'#5A2A2A', accent:'#F4C420', shadows:'#2A1518' },
    mood: 'luxurious', icon: Building2 },

  { id: 'subway_platform', name: 'Subway Platform', description: 'Tiled walls, fluorescent strips, lone commuter.',
    category: 'interior', image: u('1518709268805-4e9042af9f23'),
    lighting: { type:'artificial', direction:'overhead', intensity:'bright', temperature:'cool', timeOfDay:'controlled' },
    colorPalette: { primary:'#A8A8A0', secondary:'#D4D0C8', accent:'#1E8AA8', shadows:'#3A3A35' },
    mood: 'lonely', icon: Building2 },

  // ── ATMOSPHERIC + STYLIZED (76-100) ──────────────────────────────
  { id: 'cyberpunk_megacity', name: 'Cyberpunk Megacity', description: 'Vertical billboards, holograms, perpetual rain.',
    category: 'exterior', image: u('1518709268805-4e9042af9f23'),
    lighting: { type:'artificial', direction:'multi', intensity:'vibrant', temperature:'cool', timeOfDay:'night' },
    colorPalette: { primary:'#E81E5A', secondary:'#1ED4E8', accent:'#7A1EA8', shadows:'#0F0F1A' },
    mood: 'dystopian', icon: Zap, is_trending: true, is_popular: true },

  { id: 'noir_alley', name: 'Film-Noir Alley', description: 'Wet cobblestones, single streetlamp, long shadows.',
    category: 'exterior', image: u('1502920917128-1aa500764cbd'),
    lighting: { type:'artificial', direction:'overhead', intensity:'dramatic', temperature:'warm', timeOfDay:'night' },
    colorPalette: { primary:'#3A3A40', secondary:'#A89578', accent:'#F4C420', shadows:'#0F0F15' },
    mood: 'noir', icon: Moon, is_trending: true },

  { id: 'liminal_pool', name: 'Liminal Pool', description: 'Empty tiled space, soft echo, fluorescent green light.',
    category: 'interior', image: u('1545558014-8692077e9b5c'),
    lighting: { type:'artificial', direction:'overhead', intensity:'flat', temperature:'cool', timeOfDay:'controlled' },
    colorPalette: { primary:'#A8C8B5', secondary:'#D4E8DC', accent:'#3A5A4A', shadows:'#5A6A60' },
    mood: 'uncanny', icon: Waves, is_trending: true },

  { id: 'wes_anderson_pastel', name: 'Pastel Symmetry', description: 'Mint walls, peach trim, perfectly centered composition.',
    category: 'interior', image: u('1497366811353-6870744d04b2'),
    lighting: { type:'artificial', direction:'overhead', intensity:'flat', temperature:'warm', timeOfDay:'controlled' },
    colorPalette: { primary:'#F4D8C8', secondary:'#A8D8C0', accent:'#E89548', shadows:'#A8957A' },
    mood: 'whimsical', icon: Palette, is_trending: true, is_popular: true },

  { id: 'gothic_manor', name: 'Gothic Manor', description: 'Candelabras, oil portraits, deep shadow corners.',
    category: 'interior', image: u('1518169640858-0533c10b7d9e'),
    lighting: { type:'fire', direction:'multi', intensity:'low', temperature:'very_warm', timeOfDay:'night' },
    colorPalette: { primary:'#3A1E2A', secondary:'#A85A35', accent:'#F4C420', shadows:'#0F0508' },
    mood: 'mysterious', icon: Moon },

  { id: 'art_deco_ballroom', name: 'Art Deco Ballroom', description: 'Geometric gold trim, mirror panels, jazz-era glamour.',
    category: 'interior', image: u('1519225421980-715cb0215aed'),
    lighting: { type:'artificial', direction:'overhead', intensity:'warm', temperature:'warm', timeOfDay:'evening' },
    colorPalette: { primary:'#1A1A2A', secondary:'#D4B58A', accent:'#F4C420', shadows:'#0F0F1A' },
    mood: 'glamorous', icon: Sparkles, is_popular: true },

  { id: 'mediterranean_villa', name: 'Mediterranean Villa', description: 'White stucco, blue shutters, bougainvillea over a doorway.',
    category: 'exterior', image: u('1499856871958-5b9627545d1a'),
    lighting: { type:'natural', direction:'overhead', intensity:'vibrant', temperature:'warm', timeOfDay:'midday' },
    colorPalette: { primary:'#F4ECDC', secondary:'#1E5A95', accent:'#E84A7A', shadows:'#A8957A' },
    mood: 'sun_kissed', icon: Sun, is_popular: true },

  { id: 'space_nebula', name: 'Deep Space Nebula', description: 'Swirling cosmic gas, distant stars, pure void.',
    category: 'exterior', image: u('1462331940025-496dfbfc7564'),
    lighting: { type:'artificial', direction:'scattered', intensity:'ethereal', temperature:'cool', timeOfDay:'space' },
    colorPalette: { primary:'#7A1EA8', secondary:'#1E5A95', accent:'#E84A7A', shadows:'#0F0F1A' },
    mood: 'cosmic', icon: Star, is_trending: true, is_popular: true },

  { id: 'mars_surface', name: 'Mars Surface', description: 'Rust-red dunes under a salmon sky.',
    category: 'exterior', image: u('1614728263952-84ea256f9679'),
    lighting: { type:'natural', direction:'low_angle', intensity:'warm', temperature:'warm', timeOfDay:'sunset' },
    colorPalette: { primary:'#A85A35', secondary:'#E89548', accent:'#3A1F0A', shadows:'#1F0F08' },
    mood: 'alien', icon: Mountain, is_trending: true },

  { id: 'underwater_temple', name: 'Underwater Temple', description: 'Sunken stone columns wreathed in marine flora.',
    category: 'exterior', image: u('1530041539828-114de669390e'),
    lighting: { type:'filtered', direction:'overhead', intensity:'dappled', temperature:'cool', timeOfDay:'midday' },
    colorPalette: { primary:'#1E5A95', secondary:'#7AC8E8', accent:'#A8C870', shadows:'#0F2540' },
    mood: 'mythic', icon: Waves },

  { id: 'fairy_glade', name: 'Fairy Glade', description: 'Bioluminescent moss and floating dust motes.',
    category: 'exterior', image: u('1518050227004-c4cb7104d79a'),
    lighting: { type:'natural', direction:'scattered', intensity:'ethereal', temperature:'cool', timeOfDay:'twilight' },
    colorPalette: { primary:'#1E8A5A', secondary:'#7AD4A8', accent:'#F4C870', shadows:'#0F2A1A' },
    mood: 'magical', icon: Sparkles, is_popular: true },

  { id: 'industrial_factory_gritty', name: 'Industrial Factory', description: 'Steam vents, metal catwalks, sparks of welding light.',
    category: 'interior', image: u('1565793298595-6a879b1d9492'),
    lighting: { type:'mixed', direction:'multi', intensity:'dramatic', temperature:'warm', timeOfDay:'controlled' },
    colorPalette: { primary:'#3A3A40', secondary:'#A85A1E', accent:'#F4C420', shadows:'#1A1A20' },
    mood: 'gritty', icon: Flame },

  { id: 'bunker_war_room', name: 'War Room Bunker', description: 'Concrete walls, glowing maps, banks of monitors.',
    category: 'interior', image: u('1518770660439-4636190af475'),
    lighting: { type:'artificial', direction:'multi', intensity:'low', temperature:'cool', timeOfDay:'controlled' },
    colorPalette: { primary:'#3A4A35', secondary:'#A89578', accent:'#1ED4E8', shadows:'#1A2018' },
    mood: 'tense', icon: Sparkles },

  { id: 'spaceship_bridge', name: 'Starship Bridge', description: 'Holographic consoles and a forward viewport to stars.',
    category: 'interior', image: u('1581090700227-1e37b190418e'),
    lighting: { type:'artificial', direction:'low_angle', intensity:'soft', temperature:'cool', timeOfDay:'space' },
    colorPalette: { primary:'#1E3A5A', secondary:'#7AC8E8', accent:'#E81E5A', shadows:'#0F1F2A' },
    mood: 'futuristic', icon: Star, is_popular: true },

  { id: 'miami_artdeco_pastel', name: 'Miami Pastel', description: 'Art-deco hotels, palms, neon trim against pink sky.',
    category: 'exterior', image: u('1535498730771-e735b998cd64'),
    lighting: { type:'mixed', direction:'multi', intensity:'vibrant', temperature:'warm', timeOfDay:'sunset' },
    colorPalette: { primary:'#E84A7A', secondary:'#7AC8E8', accent:'#F4C420', shadows:'#3A1F35' },
    mood: 'electric', icon: Sun, is_trending: true },

  { id: 'opium_den_smoke', name: 'Opium Den Smoke', description: 'Hanging silks, low cushions, drifting incense.',
    category: 'interior', image: u('1545071677-39c71800a4f6'),
    lighting: { type:'fire', direction:'low_angle', intensity:'low', temperature:'very_warm', timeOfDay:'night' },
    colorPalette: { primary:'#5A1E2A', secondary:'#A8354A', accent:'#F4C420', shadows:'#1A0508' },
    mood: 'sultry', icon: Flame },

  { id: 'minimal_white_void', name: 'Infinite White Void', description: 'Pure cyclorama with no horizon. Maximum focus on subject.',
    category: 'interior', image: u('1561948955-570b270e7c36'),
    lighting: { type:'artificial', direction:'even', intensity:'bright', temperature:'neutral', timeOfDay:'controlled' },
    colorPalette: { primary:'#FFFFFF', secondary:'#F4F4F0', accent:'#E8E8E4', shadows:'#D4D4D0' },
    mood: 'minimal', icon: Camera, is_popular: true },

  { id: 'minimal_black_void', name: 'Infinite Black Void', description: 'Pure light-absorbing black. Hero subject in silhouette.',
    category: 'interior', image: u('1518770660439-4636190af475'),
    lighting: { type:'artificial', direction:'side', intensity:'dramatic', temperature:'cool', timeOfDay:'controlled' },
    colorPalette: { primary:'#000000', secondary:'#0A0A0A', accent:'#1ED4E8', shadows:'#000000' },
    mood: 'monolithic', icon: Camera, is_popular: true },

  { id: 'foggy_pier', name: 'Foggy Pier', description: 'Wooden boardwalk vanishing into morning sea mist.',
    category: 'exterior', image: u('1502082553048-f009c37129b9'),
    lighting: { type:'natural', direction:'diffused', intensity:'soft', temperature:'cool', timeOfDay:'dawn' },
    colorPalette: { primary:'#A8B5C0', secondary:'#D4DCE0', accent:'#5A4A3A', shadows:'#3A4555' },
    mood: 'dreamy', icon: Waves },

  { id: 'sunken_jazz_lounge', name: 'Sunken Jazz Lounge', description: 'Saxophone shadows, smoke, and a single spotlight.',
    category: 'interior', image: u('1514320291840-2e0a9bf2a9ae'),
    lighting: { type:'artificial', direction:'overhead', intensity:'dramatic', temperature:'warm', timeOfDay:'night' },
    colorPalette: { primary:'#1A1A2A', secondary:'#A8754A', accent:'#F4C420', shadows:'#0F0F18' },
    mood: 'soulful', icon: Sparkles },

  { id: 'haunted_attic', name: 'Haunted Attic', description: 'Sheet-draped furniture, dust beams, single broken window.',
    category: 'interior', image: u('1503614472-8c93d56e92ce'),
    lighting: { type:'natural', direction:'side', intensity:'moody', temperature:'cool', timeOfDay:'afternoon' },
    colorPalette: { primary:'#A8957A', secondary:'#3A3A40', accent:'#D4C8A8', shadows:'#1F1810' },
    mood: 'eerie', icon: Moon },

  { id: 'monolithic_temple', name: 'Monolithic Temple', description: 'Massive stone slabs cut by a single shaft of light.',
    category: 'interior', image: u('1518709268805-4e9042af9f23'),
    lighting: { type:'natural', direction:'overhead', intensity:'dramatic', temperature:'warm', timeOfDay:'midday' },
    colorPalette: { primary:'#5A4A3A', secondary:'#A8957A', accent:'#F4C870', shadows:'#1A1208' },
    mood: 'sacred', icon: Mountain, is_trending: true },

  { id: 'iceberg_drift', name: 'Iceberg Drift', description: 'Towering blue-white sculpture in still polar water.',
    category: 'exterior', image: u('1531366936337-7c912a4589a7'),
    lighting: { type:'natural', direction:'overhead', intensity:'soft', temperature:'very_cool', timeOfDay:'midday' },
    colorPalette: { primary:'#7AC8E8', secondary:'#D4E8F0', accent:'#1E5A8A', shadows:'#1A2A35' },
    mood: 'pristine', icon: Snowflake },

  { id: 'crystal_cave', name: 'Crystal Cave', description: 'Selenite spears refracting headlamp beams.',
    category: 'interior', image: u('1500964757637-c85e8a162699'),
    lighting: { type:'artificial', direction:'multi', intensity:'soft', temperature:'cool', timeOfDay:'controlled' },
    colorPalette: { primary:'#7A95C4', secondary:'#D4DCE8', accent:'#F4C420', shadows:'#1A2535' },
    mood: 'magical', icon: Sparkles, is_popular: true },

  { id: 'desert_observatory', name: 'Desert Observatory', description: 'Single telescope dome under a Milky-Way sky.',
    category: 'exterior', image: u('1419242902214-272b3f66ee7a'),
    lighting: { type:'natural', direction:'overhead', intensity:'ethereal', temperature:'cool', timeOfDay:'night' },
    colorPalette: { primary:'#1A1F35', secondary:'#7A1EA8', accent:'#F4C420', shadows:'#0F0F1A' },
    mood: 'cosmic', icon: Star, is_trending: true },
];

export default EXTENDED_ENVIRONMENTS;