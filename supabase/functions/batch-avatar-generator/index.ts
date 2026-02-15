import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Voice mapping
const VOICE_MAP = {
  male: { default: "echo", deep: "onyx", warm: "fable" },
  female: { default: "nova", warm: "shimmer" },
};

function getVoice(gender: string, personality: string): string {
  const isDeep = /wise|commanding|authoritative|fierce|strategic/i.test(personality);
  const isWarm = /warm|nurturing|gentle|friendly/i.test(personality);
  
  if (gender === "male") {
    if (isDeep) return VOICE_MAP.male.deep;
    if (isWarm) return VOICE_MAP.male.warm;
    return VOICE_MAP.male.default;
  }
  return isWarm ? VOICE_MAP.female.warm : VOICE_MAP.female.default;
}

// Avatar preset definition
interface AvatarPreset {
  name: string;
  gender: "male" | "female";
  ageRange: string;
  ethnicity: string;
  style: string;
  personality: string;
  clothing: string;
  avatarType: "realistic" | "animated";
  category: string;
  era?: string;
  tags: string[];
}

// All 70 avatar presets
const PRESETS: AvatarPreset[] = [
  // GLOBAL CULTURES - MODERN (15)
  { name: "Yuki Tanaka", gender: "female", ageRange: "young-adult", ethnicity: "Japanese", style: "corporate", personality: "Graceful and precise with subtle warmth", clothing: "Modern minimalist blazer over silk blouse, elegant pearl earrings, sleek black heels", avatarType: "realistic", category: "global-modern", tags: ["japanese", "asian", "corporate"] },
  { name: "Raj Sharma", gender: "male", ageRange: "middle-aged", ethnicity: "Indian", style: "educational", personality: "Wise and articulate with gentle authority", clothing: "Tailored kurta with modern western pants, polished leather shoes", avatarType: "realistic", category: "global-modern", tags: ["indian", "south-asian", "educational"] },
  { name: "Amara Okafor", gender: "female", ageRange: "young-adult", ethnicity: "Nigerian", style: "creative", personality: "Vibrant and confident with magnetic presence", clothing: "Bold Ankara print dress with modern silhouette, statement gold jewelry", avatarType: "realistic", category: "global-modern", tags: ["nigerian", "african", "creative"] },
  { name: "Hassan Al-Farsi", gender: "male", ageRange: "middle-aged", ethnicity: "Saudi Arabian", style: "luxury", personality: "Dignified and hospitable with quiet confidence", clothing: "Impeccably tailored modern thobe with subtle embroidery, luxury watch", avatarType: "realistic", category: "global-modern", tags: ["saudi", "middle-eastern", "luxury"] },
  { name: "Sofia Reyes", gender: "female", ageRange: "young-adult", ethnicity: "Mexican", style: "influencer", personality: "Warm and vivacious with infectious enthusiasm", clothing: "Trendy embroidered blouse with modern jeans, colorful statement earrings", avatarType: "realistic", category: "global-modern", tags: ["mexican", "latina", "influencer"] },
  { name: "Kwame Mensah", gender: "male", ageRange: "young-adult", ethnicity: "Ghanaian", style: "casual", personality: "Friendly and charismatic with natural leadership", clothing: "Modern kente-inspired shirt, well-fitted chinos, clean white sneakers", avatarType: "realistic", category: "global-modern", tags: ["ghanaian", "african", "casual"] },
  { name: "Ingrid Svensson", gender: "female", ageRange: "middle-aged", ethnicity: "Swedish", style: "corporate", personality: "Calm and methodical with dry wit", clothing: "Scandinavian minimalist blazer, crisp white shirt, tailored trousers", avatarType: "realistic", category: "global-modern", tags: ["swedish", "scandinavian", "corporate"] },
  { name: "Chen Wei", gender: "male", ageRange: "young-adult", ethnicity: "Chinese", style: "tech", personality: "Innovative and focused with quiet intensity", clothing: "Modern tech-casual - premium hoodie, slim joggers, designer sneakers", avatarType: "realistic", category: "global-modern", tags: ["chinese", "asian", "tech"] },
  { name: "Fatou Diallo", gender: "female", ageRange: "young-adult", ethnicity: "Senegalese", style: "educational", personality: "Thoughtful and inspiring with natural grace", clothing: "Elegant modern boubou dress, gold hoop earrings, leather sandals", avatarType: "realistic", category: "global-modern", tags: ["senegalese", "african", "educational"] },
  { name: "Dmitri Volkov", gender: "male", ageRange: "middle-aged", ethnicity: "Russian", style: "corporate", personality: "Strategic and commanding with hidden warmth", clothing: "Dark tailored suit, subtle pocket square, polished oxford shoes", avatarType: "realistic", category: "global-modern", tags: ["russian", "eastern-european", "corporate"] },
  { name: "Priya Nair", gender: "female", ageRange: "young-adult", ethnicity: "South Indian", style: "creative", personality: "Artistic and expressive with gentle spirit", clothing: "Contemporary saree-inspired dress, traditional jewelry modernized", avatarType: "realistic", category: "global-modern", tags: ["indian", "south-asian", "creative"] },
  { name: "João Silva", gender: "male", ageRange: "young-adult", ethnicity: "Brazilian", style: "casual", personality: "Easygoing and passionate with infectious energy", clothing: "Linen shirt partially unbuttoned, fitted shorts, quality leather sandals", avatarType: "realistic", category: "global-modern", tags: ["brazilian", "latin-american", "casual"] },
  { name: "Aisha Mohammed", gender: "female", ageRange: "young-adult", ethnicity: "Egyptian", style: "luxury", personality: "Elegant and poised with quiet strength", clothing: "Modern modest fashion - flowing designer abaya, luxury handbag", avatarType: "realistic", category: "global-modern", tags: ["egyptian", "middle-eastern", "luxury"] },
  { name: "Kofi Asante", gender: "male", ageRange: "mature", ethnicity: "Ghanaian", style: "educational", personality: "Wise and nurturing with commanding presence", clothing: "Traditional kente cloth draped elegantly, modern dress pants", avatarType: "realistic", category: "global-modern", tags: ["ghanaian", "african", "educational", "elder"] },
  { name: "Min-Ji Park", gender: "female", ageRange: "young-adult", ethnicity: "Korean", style: "influencer", personality: "Trendy and engaging with playful charm", clothing: "K-fashion inspired outfit - oversized blazer, mini skirt, chunky sneakers", avatarType: "realistic", category: "global-modern", tags: ["korean", "asian", "influencer", "k-fashion"] },

  // HISTORICAL FIGURES (12)
  { name: "Marcus Aurelius", gender: "male", ageRange: "middle-aged", ethnicity: "Roman Italian", style: "educational", personality: "Stoic and philosophical with quiet wisdom", clothing: "Elegant Roman toga with purple trim, leather sandals, simple gold laurel crown", avatarType: "realistic", category: "historical", era: "Ancient Rome", tags: ["roman", "ancient", "philosopher"] },
  { name: "Cleopatra", gender: "female", ageRange: "young-adult", ethnicity: "Egyptian Greek", style: "luxury", personality: "Regal and cunning with magnetic charisma", clothing: "Royal Egyptian linen dress with gold embroidery, elaborate gold collar necklace", avatarType: "realistic", category: "historical", era: "Ancient Egypt", tags: ["egyptian", "ancient", "queen"] },
  { name: "Takeda Shingen", gender: "male", ageRange: "middle-aged", ethnicity: "Japanese", style: "corporate", personality: "Strategic and honorable with fierce determination", clothing: "Formal samurai kimono and hakama, subtle family crest, traditional geta", avatarType: "realistic", category: "historical", era: "Feudal Japan", tags: ["japanese", "samurai", "warrior"] },
  { name: "Queen Amina", gender: "female", ageRange: "young-adult", ethnicity: "Nigerian Hausa", style: "corporate", personality: "Fierce and strategic with commanding authority", clothing: "Royal Hausa warrior queen attire with elaborate headwrap, gold jewelry", avatarType: "realistic", category: "historical", era: "16th Century Africa", tags: ["nigerian", "african", "warrior-queen"] },
  { name: "Leonardo da Vinci", gender: "male", ageRange: "mature", ethnicity: "Italian", style: "creative", personality: "Curious and brilliant with endless wonder", clothing: "Renaissance artist tunic with paint stains, leather belt, flowing hair and beard", avatarType: "realistic", category: "historical", era: "Renaissance Italy", tags: ["italian", "renaissance", "artist", "genius"] },
  { name: "Empress Wu Zetian", gender: "female", ageRange: "middle-aged", ethnicity: "Chinese", style: "luxury", personality: "Calculating and powerful with iron will", clothing: "Ornate Tang Dynasty imperial robes in gold and red, elaborate phoenix headdress", avatarType: "realistic", category: "historical", era: "Tang Dynasty China", tags: ["chinese", "empress", "powerful"] },
  { name: "Erik the Red", gender: "male", ageRange: "middle-aged", ethnicity: "Norse Viking", style: "casual", personality: "Adventurous and bold with fierce independence", clothing: "Viking wool tunic with leather armor accents, fur-lined cloak, braided red beard", avatarType: "realistic", category: "historical", era: "Viking Age", tags: ["viking", "norse", "explorer"] },
  { name: "Mansa Musa", gender: "male", ageRange: "middle-aged", ethnicity: "Malian West African", style: "luxury", personality: "Generous and wise with immense dignity", clothing: "Elaborate gold-embroidered royal robes, ornate gold crown, holding golden staff", avatarType: "realistic", category: "historical", era: "Mali Empire", tags: ["malian", "african", "emperor", "wealthy"] },
  { name: "Lady Murasaki", gender: "female", ageRange: "young-adult", ethnicity: "Japanese", style: "creative", personality: "Observant and poetic with refined sensibility", clothing: "Elegant Heian period junihitoe (twelve-layer robe) in soft purples, delicate fan", avatarType: "realistic", category: "historical", era: "Heian Japan", tags: ["japanese", "heian", "writer"] },
  { name: "Pachacuti Inca", gender: "male", ageRange: "middle-aged", ethnicity: "Incan Peruvian", style: "corporate", personality: "Visionary and commanding with divine authority", clothing: "Royal Incan tunic with intricate geometric patterns, gold ear spools, feathered headdress", avatarType: "realistic", category: "historical", era: "Inca Empire", tags: ["incan", "peruvian", "emperor"] },
  { name: "Queen Victoria", gender: "female", ageRange: "mature", ethnicity: "British English", style: "corporate", personality: "Dignified and moral with stubborn determination", clothing: "Elaborate Victorian mourning dress in black silk, widow's cap, jet jewelry", avatarType: "realistic", category: "historical", era: "Victorian England", tags: ["british", "victorian", "queen"] },
  { name: "Genghis Khan", gender: "male", ageRange: "middle-aged", ethnicity: "Mongolian", style: "corporate", personality: "Strategic and relentless with unifying vision", clothing: "Mongolian deel robe with fur trim, leather boots, simple iron crown", avatarType: "realistic", category: "historical", era: "Mongol Empire", tags: ["mongolian", "conqueror", "emperor"] },

  // ANIMATED HUMAN ARCHETYPES (10)
  { name: "Captain Nova", gender: "female", ageRange: "young-adult", ethnicity: "Mixed Ethnicity", style: "creative", personality: "Heroic and inspiring with unwavering courage", clothing: "Sleek superhero suit in blue and silver, flowing cape, glowing emblem", avatarType: "animated", category: "archetype", tags: ["superhero", "hero", "powerful"] },
  { name: "Professor Sage", gender: "male", ageRange: "mature", ethnicity: "Caucasian", style: "educational", personality: "Wise and mysterious with ancient knowledge", clothing: "Long flowing wizard robes in deep purple with star patterns, pointed hat, mystical staff", avatarType: "animated", category: "archetype", tags: ["wizard", "magic", "wise"] },
  { name: "Dr. Quantum", gender: "female", ageRange: "middle-aged", ethnicity: "South Asian", style: "educational", personality: "Brilliant and curious with infectious enthusiasm for science", clothing: "Futuristic lab coat with holographic displays, safety goggles, high-tech gloves", avatarType: "animated", category: "archetype", tags: ["scientist", "genius", "futuristic"] },
  { name: "Commander Orion", gender: "male", ageRange: "young-adult", ethnicity: "African American", style: "tech", personality: "Brave and decisive with natural leadership", clothing: "Advanced space suit in white and gold, helmet under arm, mission patches", avatarType: "animated", category: "archetype", tags: ["astronaut", "space", "leader"] },
  { name: "Chef Gustavo", gender: "male", ageRange: "middle-aged", ethnicity: "Italian", style: "creative", personality: "Passionate and perfectionist with theatrical flair", clothing: "Pristine white chef coat with gold buttons, tall chef hat, twirled mustache", avatarType: "animated", category: "archetype", tags: ["chef", "culinary", "passionate"] },
  { name: "Ninja Sakura", gender: "female", ageRange: "young-adult", ethnicity: "Japanese", style: "creative", personality: "Silent and deadly with hidden depth", clothing: "Modern ninja outfit in black and pink, utility belt, katana on back", avatarType: "animated", category: "archetype", tags: ["ninja", "warrior", "stealth"] },
  { name: "Detective Morgan", gender: "male", ageRange: "middle-aged", ethnicity: "British", style: "corporate", personality: "Analytical and observant with dry humor", clothing: "Classic trench coat, deerstalker hat, magnifying glass, polished shoes", avatarType: "animated", category: "archetype", tags: ["detective", "mystery", "analytical"] },
  { name: "Princess Aurora", gender: "female", ageRange: "young-adult", ethnicity: "Fantasy European", style: "luxury", personality: "Kind and brave with hidden strength", clothing: "Elegant ball gown in rose gold with crystal embellishments, delicate tiara", avatarType: "animated", category: "archetype", tags: ["princess", "royalty", "elegant"] },
  { name: "Robo-Max", gender: "male", ageRange: "young-adult", ethnicity: "Robotic", style: "tech", personality: "Logical yet learning human emotions", clothing: "Sleek humanoid robot body in chrome and blue, glowing eyes and chest core", avatarType: "animated", category: "archetype", tags: ["robot", "AI", "futuristic"] },
  { name: "Pirate Captain Jade", gender: "female", ageRange: "young-adult", ethnicity: "Caribbean Mixed", style: "casual", personality: "Adventurous and roguish with heart of gold", clothing: "Weathered captain's coat, tricorn hat with feather, cutlass at hip, sea boots", avatarType: "animated", category: "archetype", tags: ["pirate", "adventure", "captain"] },

  // REALISTIC ANIMALS (15)
  { name: "Leo the Lion", gender: "male", ageRange: "middle-aged", ethnicity: "African Savanna", style: "corporate", personality: "Regal and commanding with protective instinct", clothing: "Magnificent golden mane, powerful muscular build, intense amber eyes", avatarType: "realistic", category: "animal-realistic", tags: ["lion", "feline", "king", "predator"] },
  { name: "Arctic Wolf", gender: "male", ageRange: "young-adult", ethnicity: "Arctic Tundra", style: "casual", personality: "Loyal and intelligent with pack mentality", clothing: "Pure white thick winter coat, piercing ice-blue eyes, powerful build", avatarType: "realistic", category: "animal-realistic", tags: ["wolf", "canine", "arctic", "pack"] },
  { name: "Empress Eagle", gender: "female", ageRange: "mature", ethnicity: "North American", style: "luxury", personality: "Majestic and keen-eyed with soaring spirit", clothing: "Gleaming golden-brown plumage, piercing yellow eyes, powerful talons", avatarType: "realistic", category: "animal-realistic", tags: ["eagle", "bird", "raptor", "majestic"] },
  { name: "Shadow Panther", gender: "female", ageRange: "young-adult", ethnicity: "South American Jungle", style: "creative", personality: "Mysterious and graceful with deadly precision", clothing: "Sleek jet-black coat with subtle spots, luminous green eyes, lithe powerful body", avatarType: "realistic", category: "animal-realistic", tags: ["panther", "feline", "jungle", "stealth"] },
  { name: "Titan the Tiger", gender: "male", ageRange: "middle-aged", ethnicity: "Bengal India", style: "corporate", personality: "Powerful and solitary with fierce dignity", clothing: "Striking orange coat with black stripes, massive paws, intense golden eyes", avatarType: "realistic", category: "animal-realistic", tags: ["tiger", "feline", "bengal", "powerful"] },
  { name: "Sage Elephant", gender: "female", ageRange: "mature", ethnicity: "African Savanna", style: "educational", personality: "Wise and nurturing with incredible memory", clothing: "Weathered grey skin with wrinkles of wisdom, large expressive ears, gentle eyes", avatarType: "realistic", category: "animal-realistic", tags: ["elephant", "wise", "gentle", "matriarch"] },
  { name: "Phoenix Fox", gender: "female", ageRange: "young-adult", ethnicity: "European Forest", style: "creative", personality: "Clever and adaptable with playful cunning", clothing: "Brilliant red-orange fur, bushy white-tipped tail, bright intelligent eyes", avatarType: "realistic", category: "animal-realistic", tags: ["fox", "canine", "clever", "forest"] },
  { name: "Storm Stallion", gender: "male", ageRange: "young-adult", ethnicity: "Arabian Desert", style: "luxury", personality: "Noble and spirited with untamed freedom", clothing: "Gleaming black coat, flowing mane and tail, proud arched neck, powerful build", avatarType: "realistic", category: "animal-realistic", tags: ["horse", "stallion", "arabian", "noble"] },
  { name: "Ocean Dolphin", gender: "female", ageRange: "young-adult", ethnicity: "Tropical Ocean", style: "influencer", personality: "Playful and intelligent with joyful spirit", clothing: "Sleek grey-blue skin, curved dorsal fin, perpetual smile, streamlined body", avatarType: "realistic", category: "animal-realistic", tags: ["dolphin", "marine", "playful", "intelligent"] },
  { name: "Guardian Bear", gender: "male", ageRange: "mature", ethnicity: "North American Forest", style: "educational", personality: "Protective and powerful with gentle heart", clothing: "Massive brown fur coat, powerful shoulders and paws, wise brown eyes", avatarType: "realistic", category: "animal-realistic", tags: ["bear", "grizzly", "protective", "forest"] },
  { name: "Mystic Owl", gender: "male", ageRange: "mature", ethnicity: "European Woodland", style: "educational", personality: "Wise and all-seeing with ancient knowledge", clothing: "Stunning spotted brown feathers, large golden eyes, distinctive ear tufts", avatarType: "realistic", category: "animal-realistic", tags: ["owl", "bird", "wise", "nocturnal"] },
  { name: "Snow Leopard", gender: "female", ageRange: "young-adult", ethnicity: "Himalayan Mountains", style: "luxury", personality: "Elusive and graceful with silent strength", clothing: "Thick smoky-grey spotted coat, long fluffy tail, pale green eyes", avatarType: "realistic", category: "animal-realistic", tags: ["leopard", "feline", "himalayan", "rare"] },
  { name: "Coral Turtle", gender: "male", ageRange: "mature", ethnicity: "Pacific Ocean", style: "casual", personality: "Patient and enduring with ancient wisdom", clothing: "Beautifully patterned shell in greens and browns, wise ancient eyes, flippers", avatarType: "realistic", category: "animal-realistic", tags: ["turtle", "marine", "ancient", "patient"] },
  { name: "Jungle Gorilla", gender: "male", ageRange: "mature", ethnicity: "Central African Rainforest", style: "corporate", personality: "Gentle giant with commanding presence", clothing: "Impressive silverback fur, powerful build, intelligent brown eyes", avatarType: "realistic", category: "animal-realistic", tags: ["gorilla", "primate", "silverback", "gentle"] },
  { name: "Desert Falcon", gender: "female", ageRange: "young-adult", ethnicity: "Arabian Desert", style: "luxury", personality: "Swift and precise with regal bearing", clothing: "Sleek brown and white plumage, sharp hooked beak, piercing dark eyes", avatarType: "realistic", category: "animal-realistic", tags: ["falcon", "bird", "raptor", "swift"] },

  // ANIMATED ANIMALS (18)
  { name: "Duke the Dog", gender: "male", ageRange: "young-adult", ethnicity: "Golden Retriever", style: "casual", personality: "Loyal and enthusiastic with boundless optimism", clothing: "Friendly golden fur, wearing a blue bandana, wagging tail, happy expression", avatarType: "animated", category: "animal-animated", tags: ["dog", "canine", "friendly", "loyal"] },
  { name: "Whiskers the Cat", gender: "female", ageRange: "young-adult", ethnicity: "Tabby Cat", style: "influencer", personality: "Sassy and independent with hidden affection", clothing: "Sleek tabby fur, stylish pink collar with bell, confident pose, swishing tail", avatarType: "animated", category: "animal-animated", tags: ["cat", "feline", "sassy", "stylish"] },
  { name: "Professor Penguin", gender: "male", ageRange: "mature", ethnicity: "Emperor Penguin", style: "educational", personality: "Dignified and intellectual with dry humor", clothing: "Classic tuxedo-like coloring, tiny spectacles, holding a book, bow tie", avatarType: "animated", category: "animal-animated", tags: ["penguin", "professor", "intellectual", "formal"] },
  { name: "Bella Bunny", gender: "female", ageRange: "young-adult", ethnicity: "White Rabbit", style: "creative", personality: "Sweet and energetic with creative spark", clothing: "Fluffy white fur, pink inner ears, wearing artist's beret, paint-splattered apron", avatarType: "animated", category: "animal-animated", tags: ["bunny", "rabbit", "creative", "sweet"] },
  { name: "Rocky Raccoon", gender: "male", ageRange: "young-adult", ethnicity: "North American Raccoon", style: "casual", personality: "Mischievous and resourceful with heart of gold", clothing: "Classic masked face, striped tail, wearing a tiny backpack, adventurer's vest", avatarType: "animated", category: "animal-animated", tags: ["raccoon", "mischievous", "adventurer", "clever"] },
  { name: "Sage Serpent", gender: "female", ageRange: "mature", ethnicity: "Mythical Snake", style: "educational", personality: "Wise and mystical with ancient secrets", clothing: "Emerald green scales with golden patterns, jeweled crown, wise knowing eyes", avatarType: "animated", category: "animal-animated", tags: ["snake", "serpent", "mystical", "wise"] },
  { name: "Captain Parrot", gender: "male", ageRange: "middle-aged", ethnicity: "Scarlet Macaw", style: "casual", personality: "Colorful and talkative with pirate spirit", clothing: "Vibrant red, blue, yellow feathers, tiny captain's hat, eye patch, perched pose", avatarType: "animated", category: "animal-animated", tags: ["parrot", "bird", "pirate", "colorful"] },
  { name: "Honey the Bear", gender: "female", ageRange: "young-adult", ethnicity: "Honey Bear", style: "casual", personality: "Sweet and cuddly with surprising strength", clothing: "Warm honey-brown fur, wearing a pink sweater, holding honey pot, friendly smile", avatarType: "animated", category: "animal-animated", tags: ["bear", "sweet", "cuddly", "friendly"] },
  { name: "Flash the Cheetah", gender: "male", ageRange: "young-adult", ethnicity: "African Cheetah", style: "tech", personality: "Swift and focused with competitive drive", clothing: "Spotted golden coat, racing goggles on head, running shoes, athletic build", avatarType: "animated", category: "animal-animated", tags: ["cheetah", "feline", "fast", "athletic"] },
  { name: "Luna Moth", gender: "female", ageRange: "young-adult", ethnicity: "Fantasy Moth", style: "creative", personality: "Ethereal and dreamy with magical presence", clothing: "Iridescent purple and blue wings, glittering antenna, fairy-like appearance", avatarType: "animated", category: "animal-animated", tags: ["moth", "fairy", "magical", "ethereal"] },
  { name: "Sir Tortoise", gender: "male", ageRange: "mature", ethnicity: "Giant Tortoise", style: "educational", personality: "Patient and wise with timeless perspective", clothing: "Ancient weathered shell, tiny monocle, bow tie, distinguished expression", avatarType: "animated", category: "animal-animated", tags: ["tortoise", "wise", "patient", "distinguished"] },
  { name: "Finn the Frog", gender: "male", ageRange: "young-adult", ethnicity: "Tree Frog", style: "influencer", personality: "Cheerful and musical with infectious happiness", clothing: "Bright green skin with blue accents, tiny headphones, hip-hop style cap", avatarType: "animated", category: "animal-animated", tags: ["frog", "amphibian", "musical", "cheerful"] },
  { name: "Rosie the Red Panda", gender: "female", ageRange: "young-adult", ethnicity: "Himalayan Red Panda", style: "creative", personality: "Adorable and curious with gentle nature", clothing: "Fluffy red-brown fur, striped tail, wearing flower crown, bamboo snack", avatarType: "animated", category: "animal-animated", tags: ["red-panda", "cute", "gentle", "curious"] },
  { name: "Admiral Octopus", gender: "male", ageRange: "middle-aged", ethnicity: "Pacific Octopus", style: "corporate", personality: "Intelligent and multi-talented with many skills", clothing: "Rich purple skin, tiny naval captain's hat, multiple tentacles holding different tools", avatarType: "animated", category: "animal-animated", tags: ["octopus", "marine", "intelligent", "capable"] },
  { name: "Duchess Deer", gender: "female", ageRange: "young-adult", ethnicity: "White-Tailed Deer", style: "luxury", personality: "Elegant and gentle with noble grace", clothing: "Graceful spotted coat, small flower crown, pearl necklace, elegant pose", avatarType: "animated", category: "animal-animated", tags: ["deer", "elegant", "gentle", "noble"] },
  { name: "Scout the Squirrel", gender: "male", ageRange: "young-adult", ethnicity: "Red Squirrel", style: "casual", personality: "Energetic and prepared with boundless enthusiasm", clothing: "Fluffy red fur, bushy tail, tiny backpack full of acorns, adventure hat", avatarType: "animated", category: "animal-animated", tags: ["squirrel", "energetic", "prepared", "adventurous"] },
  { name: "Coral the Seahorse", gender: "female", ageRange: "young-adult", ethnicity: "Tropical Seahorse", style: "creative", personality: "Graceful and artistic with unique perspective", clothing: "Iridescent coral-colored body, tiny artist's palette, spiral tail, delicate features", avatarType: "animated", category: "animal-animated", tags: ["seahorse", "marine", "artistic", "graceful"] },
  { name: "Blaze the Dragon", gender: "male", ageRange: "young-adult", ethnicity: "Fantasy Dragon", style: "creative", personality: "Fiery and protective with hidden gentle heart", clothing: "Brilliant red and gold scales, small wings, friendly smoke puffs, warm amber eyes", avatarType: "animated", category: "animal-animated", tags: ["dragon", "fantasy", "fiery", "protective"] },
];

// Build prompts for different avatar types
function buildPrompt(p: AvatarPreset, view: "front" | "side" | "back" = "front"): string {
  const isAnimal = p.category.includes("animal");
  const isAnimated = p.avatarType === "animated";
  
  if (isAnimal && isAnimated) {
    return `Premium 3D animated character portrait of ${p.name}, a ${p.ethnicity}.

STYLE: High-end 3D CGI animation (Pixar/DreamWorks quality), expressive cartoon character design.

CHARACTER:
- ${p.personality}
- ${p.clothing}

TECHNICAL:
- Full body visible, clean studio background
- Vibrant colors, expressive features
- Professional animation studio quality
- Anthropomorphic with personality
- Ultra high resolution`;
  }
  
  if (isAnimal && !isAnimated) {
    return `Ultra-realistic professional wildlife photograph of ${p.name}.

ANIMAL: ${p.ethnicity}

APPEARANCE:
- ${p.clothing}
- ${p.personality}

PHOTOGRAPHY STYLE:
- National Geographic quality
- Professional wildlife photography
- Natural lighting, sharp focus
- Full body visible, studio backdrop
- 8K resolution, photorealistic
- Ultra high resolution`;
  }
  
  if (isAnimated) {
    return `Premium 3D animated character of ${p.name}, ${p.gender} ${p.ethnicity}.

STYLE: High-end 3D CGI (Pixar/DreamWorks quality)

CHARACTER:
- ${p.personality}
- ${p.ageRange} appearance

OUTFIT:
- ${p.clothing}

TECHNICAL:
- Full body portrait, head to toe
- Clean studio background
- Expressive, engaging pose
- Professional character art
- Ultra high resolution`;
  }
  
  // Realistic human
  const viewDesc = view === "front" ? "facing directly toward camera" : view === "side" ? "profile view facing left" : "back view facing away";
  
  return `Ultra-realistic professional photograph of ${p.name}, ${p.gender} ${p.ethnicity}${p.era ? ` from ${p.era}` : ""}.

VIEW: ${viewDesc}, full body from head to toe

CHARACTER:
- ${p.ageRange} age range
- ${p.personality}

OUTFIT:
- ${p.clothing}

PHOTOGRAPHY:
- Professional studio lighting
- Shot on Canon EOS R5, 85mm lens
- 8K resolution, extremely sharp
- Clean neutral gray background
- Indistinguishable from real photograph
- Ultra high resolution`;
}

async function generateImage(prompt: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
    if (response.status === 429) throw new Error("RATE_LIMITED");
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ═══ AUTH GUARD: Service-role only (admin seed function) ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
    if (!auth.authenticated || !auth.isServiceRole) {
      return unauthorizedResponse(corsHeaders, 'Service-role access required');
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, startIndex = 0, count = 5 } = await req.json();

    if (action === "list") {
      return new Response(JSON.stringify({
        total: PRESETS.length,
        presets: PRESETS.map((p, i) => ({ index: i, name: p.name, category: p.category, type: p.avatarType })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate") {
      const results: any[] = [];
      const endIndex = Math.min(startIndex + count, PRESETS.length);

      for (let i = startIndex; i < endIndex; i++) {
        const preset = PRESETS[i];
        console.log(`[Batch] ${i + 1}/${PRESETS.length}: ${preset.name}`);

        try {
          const timestamp = Date.now();
          const baseName = preset.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
          
          const isRealisticHuman = preset.avatarType === "realistic" && !preset.category.includes("animal");
          
          let frontImageUrl: string | null = null;
          let sideImageUrl: string | null = null;
          let backImageUrl: string | null = null;

          // Generate front image (all types need this)
          const frontPrompt = buildPrompt(preset, "front");
          const frontBase64 = await generateImage(frontPrompt);
          if (frontBase64) {
            frontImageUrl = await uploadToStorage(supabase, frontBase64, `batch-v2/${baseName}-front-${timestamp}.png`);
          }

          // For realistic humans, generate side and back views
          if (isRealisticHuman && frontImageUrl) {
            await new Promise(r => setTimeout(r, 2000));
            
            const sidePrompt = buildPrompt(preset, "side");
            const sideBase64 = await generateImage(sidePrompt);
            if (sideBase64) {
              sideImageUrl = await uploadToStorage(supabase, sideBase64, `batch-v2/${baseName}-side-${timestamp}.png`);
            }

            await new Promise(r => setTimeout(r, 2000));

            const backPrompt = buildPrompt(preset, "back");
            const backBase64 = await generateImage(backPrompt);
            if (backBase64) {
              backImageUrl = await uploadToStorage(supabase, backBase64, `batch-v2/${baseName}-back-${timestamp}.png`);
            }
          }

          if (!frontImageUrl) {
            results.push({ name: preset.name, success: false, error: "Failed to generate" });
            continue;
          }

          const voice = getVoice(preset.gender, preset.personality);
          
          const characterBible = {
            front_view: `${preset.name}, ${preset.gender}, ${preset.ethnicity}, ${preset.personality}`,
            side_view: sideImageUrl ? `${preset.name}, profile view` : null,
            back_view: backImageUrl ? `${preset.name}, back view` : null,
            clothing_description: preset.clothing,
            distinguishing_features: [preset.personality, ...preset.tags],
            negative_prompts: preset.avatarType === "animated" ? ["photorealistic"] : ["cartoon", "anime"],
          };

          const { error: insertError } = await supabase.from("avatar_templates").upsert({
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
            voice_id: voice,
            voice_provider: "openai",
            voice_name: voice.charAt(0).toUpperCase() + voice.slice(1),
            is_active: true,
            is_premium: preset.style === "luxury" || preset.category === "historical",
            tags: preset.tags,
            sort_order: 100 + i,
          }, { onConflict: "name" });

          if (insertError) {
            results.push({ name: preset.name, success: false, error: insertError.message });
          } else {
            console.log(`[Batch] ✓ ${preset.name}`);
            results.push({ name: preset.name, success: true, category: preset.category });
          }

          await new Promise(r => setTimeout(r, 1500));

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg === "RATE_LIMITED") {
            return new Response(JSON.stringify({
              rateLimited: true,
              nextIndex: i,
              completed: results.filter(r => r.success).length,
              results,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          results.push({ name: preset.name, success: false, error: msg });
        }
      }

      return new Response(JSON.stringify({
        completed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        nextIndex: endIndex < PRESETS.length ? endIndex : null,
        total: PRESETS.length,
        results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Use action: list or generate" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Batch] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
