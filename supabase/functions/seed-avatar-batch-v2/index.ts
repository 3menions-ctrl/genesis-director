import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// VOICE MAPPING - OpenAI TTS voices mapped to gender/persona
// ============================================================================
const VOICE_MAP = {
  male: {
    default: { id: "echo", name: "Echo" },
    deep: { id: "onyx", name: "Onyx" },
    warm: { id: "fable", name: "Fable" },
    neutral: { id: "alloy", name: "Alloy" },
  },
  female: {
    default: { id: "nova", name: "Nova" },
    warm: { id: "shimmer", name: "Shimmer" },
    neutral: { id: "alloy", name: "Alloy" },
  },
};

function getVoiceForAvatar(gender: string, personality: string): { id: string; name: string } {
  const isDeep = personality.toLowerCase().includes("wise") || 
                 personality.toLowerCase().includes("commanding") ||
                 personality.toLowerCase().includes("authoritative");
  const isWarm = personality.toLowerCase().includes("warm") || 
                 personality.toLowerCase().includes("nurturing") ||
                 personality.toLowerCase().includes("gentle");
  
  if (gender === "male") {
    if (isDeep) return VOICE_MAP.male.deep;
    if (isWarm) return VOICE_MAP.male.warm;
    return VOICE_MAP.male.default;
  } else {
    if (isWarm) return VOICE_MAP.female.warm;
    return VOICE_MAP.female.default;
  }
}

// ============================================================================
// AVATAR PRESET INTERFACE
// ============================================================================
interface AvatarPreset {
  name: string;
  gender: "male" | "female";
  ageRange: "young-adult" | "middle-aged" | "mature" | "ancient";
  ethnicity: string;
  style: string;
  personality: string;
  clothing: string;
  avatarType: "realistic" | "animated";
  category: string; // For organization
  era?: string; // Historical era if applicable
  tags: string[];
}

// ============================================================================
// BATCH V2: 70 NEW AVATARS
// Distribution:
// - 15 Global Cultures (Modern) - Realistic
// - 12 Historical Figures - Realistic  
// - 10 Popular Human Archetypes - Animated
// - 15 Realistic Animals
// - 18 Animated Animals
// ============================================================================

const AVATAR_PRESETS_V2: AvatarPreset[] = [
  // =========================================================================
  // SECTION 1: GLOBAL CULTURES - MODERN (15 Realistic)
  // =========================================================================
  {
    name: "Yuki Tanaka",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Japanese",
    style: "corporate",
    personality: "Graceful and precise with subtle warmth",
    clothing: "Modern minimalist blazer over silk blouse, elegant pearl earrings, sleek black heels",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["japanese", "asian", "corporate", "modern", "professional"],
  },
  {
    name: "Raj Sharma",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Indian",
    style: "educational",
    personality: "Wise and articulate with gentle authority",
    clothing: "Tailored kurta with modern western pants, polished leather shoes, subtle gold watch",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["indian", "south-asian", "educational", "wisdom", "professional"],
  },
  {
    name: "Amara Okafor",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Nigerian",
    style: "creative",
    personality: "Vibrant and confident with magnetic presence",
    clothing: "Bold Ankara print dress with modern silhouette, statement gold jewelry, elegant heeled sandals",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["nigerian", "african", "creative", "bold", "fashion"],
  },
  {
    name: "Hassan Al-Farsi",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Saudi Arabian",
    style: "luxury",
    personality: "Dignified and hospitable with quiet confidence",
    clothing: "Impeccably tailored modern thobe with subtle embroidery, luxury watch, polished dress shoes",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["saudi", "middle-eastern", "luxury", "elegant", "dignified"],
  },
  {
    name: "Sofia Reyes",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Mexican",
    style: "influencer",
    personality: "Warm and vivacious with infectious enthusiasm",
    clothing: "Trendy embroidered blouse with modern jeans, colorful statement earrings, stylish boots",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["mexican", "latina", "influencer", "warm", "vibrant"],
  },
  {
    name: "Kwame Mensah",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Ghanaian",
    style: "casual",
    personality: "Friendly and charismatic with natural leadership",
    clothing: "Modern kente-inspired shirt, well-fitted chinos, clean white sneakers",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["ghanaian", "african", "casual", "charismatic", "leader"],
  },
  {
    name: "Ingrid Svensson",
    gender: "female",
    ageRange: "middle-aged",
    ethnicity: "Swedish",
    style: "corporate",
    personality: "Calm and methodical with dry wit",
    clothing: "Scandinavian minimalist blazer, crisp white shirt, tailored trousers, elegant flats",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["swedish", "scandinavian", "corporate", "minimalist", "professional"],
  },
  {
    name: "Chen Wei",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Chinese",
    style: "tech",
    personality: "Innovative and focused with quiet intensity",
    clothing: "Modern tech-casual - premium hoodie, slim joggers, designer sneakers",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["chinese", "asian", "tech", "innovative", "modern"],
  },
  {
    name: "Fatou Diallo",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Senegalese",
    style: "educational",
    personality: "Thoughtful and inspiring with natural grace",
    clothing: "Elegant modern boubou dress with contemporary styling, gold hoop earrings, leather sandals",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["senegalese", "african", "educational", "graceful", "inspiring"],
  },
  {
    name: "Dmitri Volkov",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Russian",
    style: "corporate",
    personality: "Strategic and commanding with hidden warmth",
    clothing: "Dark tailored suit, subtle pocket square, polished oxford shoes, silver cufflinks",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["russian", "eastern-european", "corporate", "commanding", "strategic"],
  },
  {
    name: "Priya Nair",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "South Indian",
    style: "creative",
    personality: "Artistic and expressive with gentle spirit",
    clothing: "Contemporary saree-inspired dress, traditional jewelry modernized, elegant heels",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["indian", "south-asian", "creative", "artistic", "elegant"],
  },
  {
    name: "João Silva",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Brazilian",
    style: "casual",
    personality: "Easygoing and passionate with infectious energy",
    clothing: "Linen shirt partially unbuttoned, fitted shorts, quality leather sandals",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["brazilian", "latin-american", "casual", "passionate", "energetic"],
  },
  {
    name: "Aisha Mohammed",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Egyptian",
    style: "luxury",
    personality: "Elegant and poised with quiet strength",
    clothing: "Modern modest fashion - flowing designer abaya with contemporary cuts, luxury handbag, heeled boots",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["egyptian", "middle-eastern", "luxury", "elegant", "modern-modest"],
  },
  {
    name: "Kofi Asante",
    gender: "male",
    ageRange: "mature",
    ethnicity: "Ghanaian",
    style: "educational",
    personality: "Wise and nurturing with commanding presence",
    clothing: "Traditional kente cloth draped elegantly, modern dress pants, leather dress shoes",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["ghanaian", "african", "educational", "wise", "elder"],
  },
  {
    name: "Min-Ji Park",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Korean",
    style: "influencer",
    personality: "Trendy and engaging with playful charm",
    clothing: "K-fashion inspired outfit - oversized blazer, mini skirt, chunky sneakers, trendy accessories",
    avatarType: "realistic",
    category: "global-modern",
    tags: ["korean", "asian", "influencer", "trendy", "k-fashion"],
  },
  
  // =========================================================================
  // SECTION 2: HISTORICAL FIGURES (12 Realistic)
  // =========================================================================
  {
    name: "Marcus Aurelius",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Roman Italian",
    style: "educational",
    personality: "Stoic and philosophical with quiet wisdom",
    clothing: "Elegant Roman toga with purple trim, leather sandals, simple gold laurel crown",
    avatarType: "realistic",
    category: "historical",
    era: "Ancient Rome",
    tags: ["roman", "ancient", "philosopher", "stoic", "emperor"],
  },
  {
    name: "Cleopatra",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Egyptian Greek",
    style: "luxury",
    personality: "Regal and cunning with magnetic charisma",
    clothing: "Royal Egyptian linen dress with gold embroidery, elaborate gold collar necklace, golden sandals, kohl-lined eyes",
    avatarType: "realistic",
    category: "historical",
    era: "Ancient Egypt",
    tags: ["egyptian", "ancient", "queen", "regal", "pharaoh"],
  },
  {
    name: "Takeda Shingen",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Japanese",
    style: "corporate",
    personality: "Strategic and honorable with fierce determination",
    clothing: "Formal samurai kimono and hakama, subtle family crest, traditional geta sandals",
    avatarType: "realistic",
    category: "historical",
    era: "Feudal Japan",
    tags: ["japanese", "samurai", "warrior", "strategic", "feudal"],
  },
  {
    name: "Queen Amina",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Nigerian Hausa",
    style: "corporate",
    personality: "Fierce and strategic with commanding authority",
    clothing: "Royal Hausa warrior queen attire with elaborate headwrap, gold jewelry, leather warrior boots",
    avatarType: "realistic",
    category: "historical",
    era: "16th Century Africa",
    tags: ["nigerian", "african", "warrior-queen", "leader", "hausa"],
  },
  {
    name: "Leonardo da Vinci",
    gender: "male",
    ageRange: "mature",
    ethnicity: "Italian",
    style: "creative",
    personality: "Curious and brilliant with endless wonder",
    clothing: "Renaissance artist tunic with paint stains, leather belt with tools, soft leather boots, flowing hair and beard",
    avatarType: "realistic",
    category: "historical",
    era: "Renaissance Italy",
    tags: ["italian", "renaissance", "artist", "genius", "inventor"],
  },
  {
    name: "Empress Wu Zetian",
    gender: "female",
    ageRange: "middle-aged",
    ethnicity: "Chinese",
    style: "luxury",
    personality: "Calculating and powerful with iron will",
    clothing: "Ornate Tang Dynasty imperial robes in gold and red, elaborate phoenix headdress, embroidered silk shoes",
    avatarType: "realistic",
    category: "historical",
    era: "Tang Dynasty China",
    tags: ["chinese", "empress", "powerful", "tang-dynasty", "imperial"],
  },
  {
    name: "Erik the Red",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Norse Viking",
    style: "casual",
    personality: "Adventurous and bold with fierce independence",
    clothing: "Viking wool tunic with leather armor accents, fur-lined cloak, leather boots, braided red beard",
    avatarType: "realistic",
    category: "historical",
    era: "Viking Age",
    tags: ["viking", "norse", "explorer", "adventurer", "warrior"],
  },
  {
    name: "Mansa Musa",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Malian West African",
    style: "luxury",
    personality: "Generous and wise with immense dignity",
    clothing: "Elaborate gold-embroidered royal robes, ornate gold crown, royal sandals, holding golden staff",
    avatarType: "realistic",
    category: "historical",
    era: "Mali Empire",
    tags: ["malian", "african", "emperor", "wealthy", "generous"],
  },
  {
    name: "Lady Murasaki",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Japanese",
    style: "creative",
    personality: "Observant and poetic with refined sensibility",
    clothing: "Elegant Heian period junihitoe (twelve-layer robe) in soft purples and whites, long flowing hair, delicate fan",
    avatarType: "realistic",
    category: "historical",
    era: "Heian Japan",
    tags: ["japanese", "heian", "writer", "court-lady", "artistic"],
  },
  {
    name: "Pachacuti Inca",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Incan Peruvian",
    style: "corporate",
    personality: "Visionary and commanding with divine authority",
    clothing: "Royal Incan tunic with intricate geometric patterns, gold ear spools, feathered headdress, leather sandals",
    avatarType: "realistic",
    category: "historical",
    era: "Inca Empire",
    tags: ["incan", "peruvian", "emperor", "builder", "visionary"],
  },
  {
    name: "Queen Victoria",
    gender: "female",
    ageRange: "mature",
    ethnicity: "British English",
    style: "corporate",
    personality: "Dignified and moral with stubborn determination",
    clothing: "Elaborate Victorian mourning dress in black silk, widow's cap, jet jewelry, lace-up boots",
    avatarType: "realistic",
    category: "historical",
    era: "Victorian England",
    tags: ["british", "victorian", "queen", "empire", "dignified"],
  },
  {
    name: "Genghis Khan",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Mongolian",
    style: "corporate",
    personality: "Strategic and relentless with unifying vision",
    clothing: "Mongolian deel robe with fur trim, leather boots, simple iron crown, bow at side",
    avatarType: "realistic",
    category: "historical",
    era: "Mongol Empire",
    tags: ["mongolian", "conqueror", "emperor", "strategic", "warrior"],
  },
  
  // =========================================================================
  // SECTION 3: POPULAR HUMAN ARCHETYPES - ANIMATED (10)
  // =========================================================================
  {
    name: "Captain Nova",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Mixed Ethnicity",
    style: "creative",
    personality: "Heroic and inspiring with unwavering courage",
    clothing: "Sleek superhero suit in blue and silver, flowing cape, high-tech boots, glowing emblem on chest",
    avatarType: "animated",
    category: "archetype",
    tags: ["superhero", "animated", "hero", "powerful", "inspiring"],
  },
  {
    name: "Professor Sage",
    gender: "male",
    ageRange: "mature",
    ethnicity: "Caucasian",
    style: "educational",
    personality: "Wise and mysterious with ancient knowledge",
    clothing: "Long flowing wizard robes in deep purple with star patterns, pointed hat, mystical staff, long white beard",
    avatarType: "animated",
    category: "archetype",
    tags: ["wizard", "animated", "magic", "wise", "mystical"],
  },
  {
    name: "Dr. Quantum",
    gender: "female",
    ageRange: "middle-aged",
    ethnicity: "South Asian",
    style: "educational",
    personality: "Brilliant and curious with infectious enthusiasm for science",
    clothing: "Futuristic lab coat with holographic displays, safety goggles on forehead, high-tech gloves, sleek boots",
    avatarType: "animated",
    category: "archetype",
    tags: ["scientist", "animated", "genius", "innovation", "futuristic"],
  },
  {
    name: "Commander Orion",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "African American",
    style: "tech",
    personality: "Brave and decisive with natural leadership",
    clothing: "Advanced space suit in white and gold, helmet under arm, mission patches, magnetic boots",
    avatarType: "animated",
    category: "archetype",
    tags: ["astronaut", "animated", "space", "leader", "explorer"],
  },
  {
    name: "Chef Gustavo",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Italian",
    style: "creative",
    personality: "Passionate and perfectionist with theatrical flair",
    clothing: "Pristine white chef coat with gold buttons, tall chef hat, checkered pants, chef clogs, twirled mustache",
    avatarType: "animated",
    category: "archetype",
    tags: ["chef", "animated", "culinary", "passionate", "gourmet"],
  },
  {
    name: "Striker",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Brazilian",
    style: "casual",
    personality: "Energetic and competitive with team spirit",
    clothing: "Soccer jersey with number 10, shorts, cleats, captain's armband, athletic build",
    avatarType: "animated",
    category: "archetype",
    tags: ["athlete", "animated", "soccer", "competitive", "sports"],
  },
  {
    name: "Detective Noir",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Japanese American",
    style: "creative",
    personality: "Sharp and observant with dry wit",
    clothing: "Classic detective trench coat, fedora hat, magnifying glass in pocket, sensible heels",
    avatarType: "animated",
    category: "archetype",
    tags: ["detective", "animated", "mystery", "smart", "noir"],
  },
  {
    name: "DJ Pulse",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Mixed Caribbean",
    style: "influencer",
    personality: "Energetic and creative with infectious rhythm",
    clothing: "Neon-accented streetwear, futuristic headphones, LED-lit sneakers, holographic jacket",
    avatarType: "animated",
    category: "archetype",
    tags: ["dj", "animated", "music", "party", "neon"],
  },
  {
    name: "Sensei Kai",
    gender: "male",
    ageRange: "mature",
    ethnicity: "Japanese",
    style: "educational",
    personality: "Disciplined and patient with hidden humor",
    clothing: "Traditional martial arts gi in white with black belt, bare feet, calm meditative stance",
    avatarType: "animated",
    category: "archetype",
    tags: ["sensei", "animated", "martial-arts", "wisdom", "discipline"],
  },
  {
    name: "Princess Aurora",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Caucasian",
    style: "luxury",
    personality: "Kind and adventurous with hidden strength",
    clothing: "Elegant ball gown in rose gold, delicate tiara, glass slippers, flowing cape",
    avatarType: "animated",
    category: "archetype",
    tags: ["princess", "animated", "royalty", "elegant", "fairytale"],
  },
  
  // =========================================================================
  // SECTION 4: REALISTIC ANIMALS (15)
  // =========================================================================
  {
    name: "Leo the Lion",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "African Savanna",
    style: "corporate",
    personality: "Majestic and commanding with noble authority",
    clothing: "Photorealistic male African lion with magnificent golden mane, powerful stance, dignified expression, natural savanna backdrop",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["lion", "animal", "majestic", "king", "wildlife"],
  },
  {
    name: "Luna the Wolf",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Arctic",
    style: "creative",
    personality: "Mysterious and loyal with fierce independence",
    clothing: "Photorealistic arctic white wolf with piercing blue eyes, thick winter coat, alert stance, snowy forest setting",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["wolf", "animal", "arctic", "mysterious", "wildlife"],
  },
  {
    name: "Apollo the Eagle",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "North American",
    style: "corporate",
    personality: "Visionary and free with sharp precision",
    clothing: "Photorealistic bald eagle with white head feathers, golden beak, powerful wings slightly spread, mountain backdrop",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["eagle", "animal", "freedom", "vision", "majestic"],
  },
  {
    name: "Titan the Elephant",
    gender: "male",
    ageRange: "mature",
    ethnicity: "African Savanna",
    style: "educational",
    personality: "Wise and gentle with incredible memory",
    clothing: "Photorealistic African elephant with large tusks, weathered gray skin, intelligent eyes, watering hole setting",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["elephant", "animal", "wise", "gentle-giant", "wildlife"],
  },
  {
    name: "Shere the Tiger",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Bengal Indian",
    style: "luxury",
    personality: "Powerful and graceful with intense focus",
    clothing: "Photorealistic Bengal tiger with vibrant orange and black stripes, muscular build, jungle backdrop, amber eyes",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["tiger", "animal", "powerful", "fierce", "bengal"],
  },
  {
    name: "Kodiak the Bear",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Alaskan",
    style: "casual",
    personality: "Strong and protective with hidden gentleness",
    clothing: "Photorealistic Kodiak brown bear with thick fur, massive build, riverside setting, catching salmon",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["bear", "animal", "strong", "protective", "wilderness"],
  },
  {
    name: "Ember the Fox",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Red Fox European",
    style: "creative",
    personality: "Clever and adaptable with playful cunning",
    clothing: "Photorealistic red fox with vibrant orange fur, bushy tail, bright curious eyes, autumn forest setting",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["fox", "animal", "clever", "playful", "cunning"],
  },
  {
    name: "Athena the Owl",
    gender: "female",
    ageRange: "mature",
    ethnicity: "Great Horned North American",
    style: "educational",
    personality: "Wise and observant with silent wisdom",
    clothing: "Photorealistic great horned owl with distinctive ear tufts, penetrating yellow eyes, perched on ancient oak branch, twilight setting",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["owl", "animal", "wise", "nocturnal", "knowledge"],
  },
  {
    name: "Storm the Horse",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Arabian",
    style: "luxury",
    personality: "Noble and spirited with untamed freedom",
    clothing: "Photorealistic black Arabian stallion with flowing mane, muscular build, dramatic desert sunset backdrop",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["horse", "animal", "noble", "spirited", "arabian"],
  },
  {
    name: "Marina the Dolphin",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Pacific",
    style: "casual",
    personality: "Playful and intelligent with joyful spirit",
    clothing: "Photorealistic bottlenose dolphin leaping from crystal blue water, sleek gray body, sparkling ocean spray, sunny tropical setting",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["dolphin", "animal", "playful", "intelligent", "ocean"],
  },
  {
    name: "Kong the Gorilla",
    gender: "male",
    ageRange: "mature",
    ethnicity: "Mountain African",
    style: "educational",
    personality: "Gentle and protective with deep intelligence",
    clothing: "Photorealistic silverback mountain gorilla with silver back fur, powerful build, thoughtful expression, misty forest backdrop",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["gorilla", "animal", "gentle-giant", "intelligent", "silverback"],
  },
  {
    name: "Bamboo the Panda",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Chinese Mountain",
    style: "casual",
    personality: "Peaceful and endearing with calm demeanor",
    clothing: "Photorealistic giant panda with distinctive black and white markings, round face, bamboo forest setting, munching on bamboo",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["panda", "animal", "peaceful", "adorable", "chinese"],
  },
  {
    name: "Hart the Deer",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "European Red Deer",
    style: "creative",
    personality: "Graceful and alert with quiet dignity",
    clothing: "Photorealistic red deer stag with magnificent antlers, rich brown coat, forest clearing at dawn, morning mist",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["deer", "animal", "graceful", "forest", "stag"],
  },
  {
    name: "Talon the Hawk",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Red-Tailed American",
    style: "corporate",
    personality: "Focused and precise with hunter's instinct",
    clothing: "Photorealistic red-tailed hawk with spread wings, sharp talons, piercing gaze, soaring over open plains",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["hawk", "animal", "focused", "predator", "soaring"],
  },
  {
    name: "Shadow the Panther",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Black Leopard African",
    style: "luxury",
    personality: "Sleek and mysterious with silent power",
    clothing: "Photorealistic black panther (melanistic leopard) with glossy black coat, faint rosettes, glowing green eyes, moonlit jungle",
    avatarType: "realistic",
    category: "animal-realistic",
    tags: ["panther", "animal", "mysterious", "sleek", "nocturnal"],
  },
  
  // =========================================================================
  // SECTION 5: ANIMATED ANIMALS (18)
  // =========================================================================
  {
    name: "Rex the Lion",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Animated African",
    style: "corporate",
    personality: "Regal and inspiring with theatrical flair",
    clothing: "Pixar-style animated lion king with golden mane, crown, royal cape, standing heroically",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["lion", "animated", "king", "regal", "cartoon"],
  },
  {
    name: "Frost the Wolf",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Animated Arctic",
    style: "creative",
    personality: "Adventurous and loyal with wild spirit",
    clothing: "Disney-style animated white wolf with expressive blue eyes, fluffy fur, wearing adventure scarf",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["wolf", "animated", "adventure", "loyal", "cartoon"],
  },
  {
    name: "Blaze the Phoenix",
    gender: "female",
    ageRange: "ancient",
    ethnicity: "Mythical",
    style: "luxury",
    personality: "Majestic and eternal with fiery passion",
    clothing: "Stunning animated phoenix with flaming feathers in red orange and gold, wings spread wide, magical fire effects",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["phoenix", "animated", "mythical", "fire", "rebirth"],
  },
  {
    name: "Spark the Dragon",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Fantasy Eastern",
    style: "creative",
    personality: "Playful and mischievous with hidden wisdom",
    clothing: "Dreamworks-style animated Chinese dragon, long serpentine body, whiskers, friendly expression, floating on clouds",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["dragon", "animated", "eastern", "mythical", "playful"],
  },
  {
    name: "Patches the Fox",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Animated Forest",
    style: "casual",
    personality: "Clever and charming with roguish wit",
    clothing: "Pixar-style animated red fox wearing a detective cap and vest, sly grin, bushy tail",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["fox", "animated", "clever", "detective", "charming"],
  },
  {
    name: "Bubbles the Dolphin",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Animated Ocean",
    style: "casual",
    personality: "Joyful and acrobatic with endless optimism",
    clothing: "Disney-style animated dolphin with sparkly blue skin, wearing a pearl necklace, jumping through rainbow bubbles",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["dolphin", "animated", "joyful", "ocean", "playful"],
  },
  {
    name: "Professor Hoot",
    gender: "male",
    ageRange: "mature",
    ethnicity: "Animated Forest",
    style: "educational",
    personality: "Scholarly and patient with dry humor",
    clothing: "Pixar-style animated owl wearing tiny spectacles, graduation cap, holding a scroll, distinguished feathers",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["owl", "animated", "professor", "wise", "scholarly"],
  },
  {
    name: "Honey the Bear",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Animated Forest",
    style: "casual",
    personality: "Sweet and nurturing with cozy warmth",
    clothing: "Dreamworks-style animated brown bear cub wearing a cute bow, holding honey pot, adorable expression",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["bear", "animated", "sweet", "cute", "cozy"],
  },
  {
    name: "Thunder the Horse",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Animated Western",
    style: "casual",
    personality: "Brave and free-spirited with cowboy charm",
    clothing: "Disney-style animated mustang with flowing black mane, wearing a bandana, galloping pose, wild west backdrop",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["horse", "animated", "wild", "western", "brave"],
  },
  {
    name: "Stripes the Tiger",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Animated Jungle",
    style: "influencer",
    personality: "Cool and confident with street style",
    clothing: "Pixar-style animated tiger wearing sunglasses and a leather jacket, hip pose, urban jungle setting",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["tiger", "animated", "cool", "confident", "urban"],
  },
  {
    name: "Frosty the Penguin",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Animated Antarctic",
    style: "corporate",
    personality: "Dapper and proper with British charm",
    clothing: "Disney-style animated emperor penguin wearing a bow tie and top hat, gentlemanly pose",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["penguin", "animated", "dapper", "gentleman", "arctic"],
  },
  {
    name: "Maple the Squirrel",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Animated Forest",
    style: "casual",
    personality: "Hyperactive and organized with boundless energy",
    clothing: "Pixar-style animated red squirrel with big fluffy tail, wearing a tiny apron, holding acorn, excited expression",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["squirrel", "animated", "energetic", "cute", "organized"],
  },
  {
    name: "Scales the Snake",
    gender: "male",
    ageRange: "young-adult",
    ethnicity: "Animated Jungle",
    style: "creative",
    personality: "Smooth and sophisticated with hypnotic charm",
    clothing: "Dreamworks-style animated python with iridescent scales, wearing a small fedora, coiled elegantly, friendly smile",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["snake", "animated", "smooth", "sophisticated", "charming"],
  },
  {
    name: "Bounce the Kangaroo",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Animated Australian",
    style: "casual",
    personality: "Athletic and cheerful with boxing spirit",
    clothing: "Pixar-style animated kangaroo wearing boxing gloves and headband, sporty pose, joey peeking from pouch",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["kangaroo", "animated", "athletic", "australian", "boxing"],
  },
  {
    name: "Whiskers the Cat",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Animated Domestic",
    style: "luxury",
    personality: "Elegant and sassy with aristocratic air",
    clothing: "Disney-style animated Persian cat with fluffy white fur, wearing a diamond collar, lounging on velvet cushion",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["cat", "animated", "elegant", "sassy", "aristocratic"],
  },
  {
    name: "Bongo the Gorilla",
    gender: "male",
    ageRange: "middle-aged",
    ethnicity: "Animated Jungle",
    style: "casual",
    personality: "Gentle and musical with rhythm soul",
    clothing: "Pixar-style animated gorilla wearing a colorful Hawaiian shirt, holding bongo drums, friendly grin",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["gorilla", "animated", "musical", "gentle", "rhythm"],
  },
  {
    name: "Coco the Parrot",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Animated Tropical",
    style: "influencer",
    personality: "Chatty and colorful with party vibes",
    clothing: "Dreamworks-style animated macaw with rainbow feathers, wearing tiny sunglasses, tropical party setting",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["parrot", "animated", "colorful", "tropical", "chatty"],
  },
  {
    name: "Shimmer the Unicorn",
    gender: "female",
    ageRange: "young-adult",
    ethnicity: "Mythical Fantasy",
    style: "luxury",
    personality: "Magical and pure with ethereal grace",
    clothing: "Disney-style animated unicorn with flowing rainbow mane and tail, spiral horn, sparkles and stars, dreamy meadow",
    avatarType: "animated",
    category: "animal-animated",
    tags: ["unicorn", "animated", "magical", "fantasy", "ethereal"],
  },
];

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function buildRealisticHumanPrompt(preset: AvatarPreset, view: "front" | "side" | "back"): string {
  const viewInstructions = {
    front: "facing directly toward the camera, centered composition, natural confident expression, looking at viewer",
    side: "profile view facing left, showing side of face and body clearly, same person with identical features",
    back: "back view facing away from camera, showing hair and back of outfit, same person",
  };

  const ageDescriptor = preset.ageRange === "young-adult" 
    ? "in their mid-20s to early 30s" 
    : preset.ageRange === "middle-aged" 
    ? "in their early 40s to 50s" 
    : preset.ageRange === "mature"
    ? "in their late 50s to 70s"
    : "timeless appearance";

  return `Ultra-realistic professional photograph of a ${preset.gender} person named ${preset.name}, ${ageDescriptor}, ${preset.ethnicity} ethnicity. ${viewInstructions[view]}.

CRITICAL - PHOTOREALISM REQUIREMENTS:
- This MUST look like an actual photograph taken by a professional photographer
- Real human skin with natural pores, subtle imperfections, and realistic texture
- Natural skin tones with realistic subsurface scattering
- Authentic human eyes with natural catchlights and slight moisture
- Real hair with individual strands visible, natural shine and movement
- Genuine facial expressions with micro-expressions
- NO CGI, NO 3D render, NO digital art style - purely photographic

CRITICAL - FULL BODY COMPOSITION:
- FULL BODY shot from head to feet - entire person must be visible
- Standing in a natural, relaxed confident pose
- Full figure including legs and shoes clearly visible
- Professional studio photography framing with person centered

LIGHTING & PHOTOGRAPHY:
- Professional studio lighting (three-point setup)
- Soft key light creating natural shadows
- Shot on high-end camera (Canon EOS R5 quality)
- 85mm portrait lens, shallow depth of field on background
- 8K resolution, extremely sharp focus

CHARACTER - ${preset.name}:
- ${preset.personality}
- ${preset.era ? `Historical era: ${preset.era}` : "Contemporary modern setting"}
- Warm, genuine expression appropriate to personality

OUTFIT & STYLING:
- ${preset.clothing}
- Visible from head to toe including footwear

BACKGROUND: Clean neutral gray seamless studio backdrop with subtle gradient.

ABSOLUTE REQUIREMENTS:
- Indistinguishable from a real photograph of a real person
- Full body visible from head to toe
- Professional photography quality
- Must look like a genuine human being`;
}

function buildRealisticAnimalPrompt(preset: AvatarPreset): string {
  return `${preset.clothing}

CRITICAL - PHOTOREALISM REQUIREMENTS:
- This MUST look like a National Geographic quality wildlife photograph
- Real animal with natural fur/feathers/scales texture
- Authentic animal anatomy and proportions
- Natural lighting as if in real habitat
- NO anthropomorphization - this is a real animal
- NO clothing, NO accessories - pure wildlife

PHOTOGRAPHY QUALITY:
- Professional wildlife photography (Canon 600mm f/4 lens quality)
- Sharp focus on the animal's eyes
- Natural depth of field
- 8K resolution, extremely detailed
- Award-winning nature photography style

ANIMAL PRESENCE:
- ${preset.personality}
- Natural animal behavior and posture
- Dignified, noble presence appropriate to species
- Eyes that convey intelligence and character

ABSOLUTE REQUIREMENTS:
- Indistinguishable from a real wildlife photograph
- Museum-quality nature photography
- The animal should command attention and respect`;
}

function buildAnimatedPrompt(preset: AvatarPreset): string {
  const isAnimal = preset.category.includes("animal");
  
  if (isAnimal) {
    return `High-quality stylized 3D animated character: ${preset.clothing}

CRITICAL - 3D ANIMATED STYLE:
- Premium Pixar/Disney/Dreamworks quality 3D character
- Stylized proportions with appealing character design
- Large expressive eyes with emotional depth
- Smooth polished surfaces with subtle subsurface scattering
- High-end CGI render quality (Unreal Engine 5 / Octane render quality)
- Clearly stylized animated character, NOT photorealistic

FULL BODY COMPOSITION:
- Full body character visible from head to feet/paws
- Dynamic appealing pose showing personality
- Character centered in frame with proper spacing
- Visible ground plane for grounding

CHARACTER PERSONALITY:
- ${preset.personality}
- Expressive face showing clear emotion
- Body language that conveys character

LIGHTING & RENDERING:
- Professional studio lighting with dramatic rim light
- Soft diffused key light with warm tones
- High-quality ray-traced global illumination
- Clean gradient background (dark to light gray)

ABSOLUTE REQUIREMENTS:
- Premium animated character quality
- Full body visible including feet/paws
- Appealing, memorable character design
- Suitable for video presentations`;
  } else {
    // Human archetype animated
    return `High-quality stylized 3D character render: ${preset.gender} character named ${preset.name}, ${preset.ethnicity}.

CRITICAL - 3D ANIMATED STYLE:
- Premium Pixar/Disney-quality 3D character
- Stylized proportions - slightly larger eyes, refined features
- Smooth, polished skin with subtle subsurface scattering
- High-end CGI render quality (Unreal Engine 5 / Octane render quality)
- Clean, appealing character design with personality
- NOT photorealistic - clearly stylized 3D animated character

FULL BODY COMPOSITION:
- FULL BODY shot from head to feet - entire character must be visible
- Standing in a confident, dynamic pose
- Full figure including legs and stylized shoes clearly visible
- Character centered in frame with proper spacing
- Visible floor/ground plane for grounding

LIGHTING & RENDERING:
- Professional studio lighting with dramatic rim light
- Soft diffused key light with warm tones
- Cool fill light for contrast and depth
- High-quality ray-traced global illumination
- Clean gradient background (dark to light gray)

CHARACTER - ${preset.name}:
- ${preset.personality}
- Expressive, engaging expression
- Clear personality visible through pose and expression

OUTFIT:
- ${preset.clothing}

ABSOLUTE REQUIREMENTS:
- Premium 3D animated character quality (Pixar/Disney level)
- Full body visible from head to toe including feet
- Clearly stylized (not photorealistic)
- Professional character art suitable for video presentations`;
  }
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

async function generateImage(prompt: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  console.log("[BatchV2] Generating image...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[BatchV2] API error:", errorText);
    
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error(`Image generation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

async function uploadToStorage(supabase: any, base64Data: string, fileName: string): Promise<string> {
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const bytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));

  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(fileName, bytes, { contentType: "image/png", upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, startIndex = 0, count = 1 } = body;

    // List all presets
    if (action === "list-presets") {
      const summary = {
        total: AVATAR_PRESETS_V2.length,
        categories: {
          "global-modern": AVATAR_PRESETS_V2.filter(p => p.category === "global-modern").length,
          "historical": AVATAR_PRESETS_V2.filter(p => p.category === "historical").length,
          "archetype": AVATAR_PRESETS_V2.filter(p => p.category === "archetype").length,
          "animal-realistic": AVATAR_PRESETS_V2.filter(p => p.category === "animal-realistic").length,
          "animal-animated": AVATAR_PRESETS_V2.filter(p => p.category === "animal-animated").length,
        },
        presets: AVATAR_PRESETS_V2.map((p, i) => ({
          index: i,
          name: p.name,
          category: p.category,
          avatarType: p.avatarType,
          gender: p.gender,
        })),
      };
      
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate avatars
    if (action === "generate") {
      const results: any[] = [];
      const endIndex = Math.min(startIndex + count, AVATAR_PRESETS_V2.length);

      for (let i = startIndex; i < endIndex; i++) {
        const preset = AVATAR_PRESETS_V2[i];
        console.log(`[BatchV2] Generating avatar ${i + 1}/${AVATAR_PRESETS_V2.length}: ${preset.name} (${preset.category})`);

        try {
          const timestamp = Date.now();
          const baseName = preset.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
          
          let frontImageUrl: string | null = null;
          let sideImageUrl: string | null = null;
          let backImageUrl: string | null = null;

          // Determine generation approach based on type
          const isRealisticHuman = preset.avatarType === "realistic" && !preset.category.includes("animal");
          const isRealisticAnimal = preset.avatarType === "realistic" && preset.category.includes("animal");
          const isAnimated = preset.avatarType === "animated";

          if (isRealisticHuman) {
            // Generate front, side, back views
            const frontPrompt = buildRealisticHumanPrompt(preset, "front");
            const frontBase64 = await generateImage(frontPrompt);
            if (frontBase64) {
              frontImageUrl = await uploadToStorage(supabase, frontBase64, `${baseName}-front-${timestamp}.png`);
            }

            // Add delay to avoid rate limits
            await new Promise(r => setTimeout(r, 3000));

            const sidePrompt = buildRealisticHumanPrompt(preset, "side");
            const sideBase64 = await generateImage(sidePrompt);
            if (sideBase64) {
              sideImageUrl = await uploadToStorage(supabase, sideBase64, `${baseName}-side-${timestamp}.png`);
            }

            await new Promise(r => setTimeout(r, 3000));

            const backPrompt = buildRealisticHumanPrompt(preset, "back");
            const backBase64 = await generateImage(backPrompt);
            if (backBase64) {
              backImageUrl = await uploadToStorage(supabase, backBase64, `${baseName}-back-${timestamp}.png`);
            }
          } else if (isRealisticAnimal) {
            // Animals get single high-quality image
            const prompt = buildRealisticAnimalPrompt(preset);
            const base64 = await generateImage(prompt);
            if (base64) {
              frontImageUrl = await uploadToStorage(supabase, base64, `${baseName}-${timestamp}.png`);
            }
          } else if (isAnimated) {
            // Animated characters get single stylized image
            const prompt = buildAnimatedPrompt(preset);
            const base64 = await generateImage(prompt);
            if (base64) {
              frontImageUrl = await uploadToStorage(supabase, base64, `${baseName}-animated-${timestamp}.png`);
            }
          }

          if (!frontImageUrl) {
            results.push({ name: preset.name, success: false, error: "Failed to generate image" });
            continue;
          }

          // Get appropriate voice
          const voice = getVoiceForAvatar(preset.gender, preset.personality);

          // Build character bible
          const characterBible = {
            front_view: `${preset.name}, ${preset.gender}, ${preset.ageRange}, ${preset.ethnicity}, ${preset.personality}`,
            side_view: sideImageUrl ? `${preset.name}, profile view, same features` : null,
            back_view: backImageUrl ? `${preset.name}, back view, same outfit` : null,
            hair_description: preset.category.includes("animal") ? null : "As depicted in reference images",
            clothing_description: preset.clothing,
            body_type: preset.category.includes("animal") ? "Natural animal anatomy" : "Natural human proportions",
            distinguishing_features: [preset.personality, ...preset.tags],
            negative_prompts: preset.avatarType === "animated" 
              ? ["photorealistic", "real photo", "different character"]
              : ["cartoon", "anime", "CGI", "different person"],
          };

          // Insert into database
          const { error: insertError } = await supabase
            .from("avatar_templates")
            .upsert({
              name: preset.name,
              description: `${preset.personality} - ${preset.category.replace("-", " ")}`,
              personality: preset.personality,
              gender: preset.gender,
              age_range: preset.ageRange,
              ethnicity: preset.ethnicity,
              style: preset.style,
              avatar_type: preset.avatarType,
              face_image_url: frontImageUrl,
              thumbnail_url: frontImageUrl,
              front_image_url: frontImageUrl,
              side_image_url: sideImageUrl,
              back_image_url: backImageUrl,
              character_bible: characterBible,
              voice_id: voice.id,
              voice_provider: "openai",
              voice_name: voice.name,
              is_active: true,
              is_premium: preset.style === "luxury" || preset.category === "historical",
              tags: preset.tags,
              sort_order: 100 + i, // Start after existing avatars
            }, { onConflict: "name" });

          if (insertError) {
            console.error(`[BatchV2] DB insert failed for ${preset.name}:`, insertError);
            results.push({ name: preset.name, success: false, error: insertError.message });
          } else {
            console.log(`[BatchV2] ✓ ${preset.name} created successfully`);
            results.push({ 
              name: preset.name, 
              success: true, 
              imageUrl: frontImageUrl,
              category: preset.category,
              avatarType: preset.avatarType,
            });
          }

          // Delay between avatars to avoid rate limits
          await new Promise(r => setTimeout(r, 2000));

        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[BatchV2] Error for ${preset.name}:`, errorMsg);
          
          if (errorMsg === "RATE_LIMITED") {
            // Return partial results and let admin resume
            return new Response(JSON.stringify({
              completed: results.length,
              total: AVATAR_PRESETS_V2.length,
              nextIndex: i, // Resume from this avatar
              rateLimited: true,
              message: "Rate limited. Wait 60 seconds and resume.",
              results,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          
          results.push({ name: preset.name, success: false, error: errorMsg });
        }
      }

      return new Response(JSON.stringify({
        completed: results.length,
        total: AVATAR_PRESETS_V2.length,
        nextIndex: endIndex < AVATAR_PRESETS_V2.length ? endIndex : null,
        results,
        successCount: results.filter(r => r.success).length,
        failCount: results.filter(r => !r.success).length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'list-presets' or 'generate'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[BatchV2] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
