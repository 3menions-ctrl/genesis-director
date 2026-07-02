import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAndSanitize, publicErrorMessage } from "../_shared/safe-error.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Diverse avatar presets - from corporate to casual, artists to athletes
const AVATAR_PRESETS = [
  // === CREATIVE & ARTISTIC ===
  { name: "Luna Ramirez", gender: "female", ageRange: "young-adult", ethnicity: "Hispanic", style: "creative", personality: "dreamy and artistic", clothing: "Paint-splattered denim overalls over a vintage band tee" },
  { name: "Jasper Stone", gender: "male", ageRange: "young-adult", ethnicity: "Caucasian", style: "creative", personality: "brooding and introspective", clothing: "Black leather jacket, silver rings, messy hair" },
  { name: "Zara Obi", gender: "female", ageRange: "young-adult", ethnicity: "Nigerian", style: "creative", personality: "bold and expressive", clothing: "Colorful African print wrap dress with bold earrings" },
  
  // === CASUAL & EVERYDAY ===
  { name: "Tyler Brooks", gender: "male", ageRange: "young-adult", ethnicity: "African American", style: "casual", personality: "chill and laid-back", clothing: "Oversized hoodie and baseball cap worn backwards" },
  { name: "Mei Lin", gender: "female", ageRange: "young-adult", ethnicity: "Chinese", style: "casual", personality: "cheerful and bubbly", clothing: "Cozy oversized sweater with cute pins and patches" },
  { name: "Jake Morrison", gender: "male", ageRange: "young-adult", ethnicity: "Caucasian", style: "casual", personality: "goofy and relatable", clothing: "Flannel shirt, jeans, well-worn sneakers" },
  { name: "Aisha Patel", gender: "female", ageRange: "young-adult", ethnicity: "South Asian", style: "casual", personality: "warm and down-to-earth", clothing: "Simple kurta top with modern jeans" },
  
  // === GAMERS & TECH ===
  { name: "Kai Nakamura", gender: "male", ageRange: "young-adult", ethnicity: "Japanese", style: "influencer", personality: "energetic and competitive", clothing: "Gaming headset around neck, esports team jersey" },
  { name: "Nova Chen", gender: "female", ageRange: "young-adult", ethnicity: "Taiwanese", style: "influencer", personality: "witty and quick", clothing: "Neon-accented cyberpunk jacket, RGB lighting vibes" },
  { name: "Marcus 'Glitch' Webb", gender: "male", ageRange: "young-adult", ethnicity: "Mixed", style: "creative", personality: "nerdy and enthusiastic", clothing: "Retro gaming t-shirt, glasses, colorful LED accessories" },
  
  // === ATHLETES & FITNESS ===
  { name: "Destiny Williams", gender: "female", ageRange: "young-adult", ethnicity: "African American", style: "casual", personality: "fierce and motivating", clothing: "Sleek athletic wear, high ponytail, confident stance" },
  { name: "Mateo Santos", gender: "male", ageRange: "young-adult", ethnicity: "Brazilian", style: "casual", personality: "passionate and energetic", clothing: "Soccer jersey, athletic build, warm smile" },
  { name: "Sven Eriksson", gender: "male", ageRange: "middle-aged", ethnicity: "Scandinavian", style: "casual", personality: "calm and disciplined", clothing: "Simple athletic wear, rugged outdoor look" },
  
  // === STUDENTS & YOUNG PEOPLE ===
  { name: "Chloe Park", gender: "female", ageRange: "young-adult", ethnicity: "Korean American", style: "casual", personality: "studious but fun", clothing: "Cute cardigan, round glasses, messenger bag" },
  { name: "Darius Jackson", gender: "male", ageRange: "young-adult", ethnicity: "African American", style: "casual", personality: "ambitious and thoughtful", clothing: "College hoodie, backpack, casual confidence" },
  { name: "Freya Andersen", gender: "female", ageRange: "young-adult", ethnicity: "Danish", style: "casual", personality: "curious and adventurous", clothing: "Vintage thrift store finds, eclectic style" },
  
  // === MUSICIANS & PERFORMERS ===
  { name: "River Hayes", gender: "male", ageRange: "young-adult", ethnicity: "Mixed Indigenous", style: "creative", personality: "soulful and poetic", clothing: "Worn acoustic guitar strap visible, bohemian layers" },
  { name: "Jade Phoenix", gender: "female", ageRange: "young-adult", ethnicity: "Vietnamese American", style: "influencer", personality: "fierce and glamorous", clothing: "Glittery stage-ready outfit, bold makeup" },
  { name: "Marcus Cole", gender: "male", ageRange: "young-adult", ethnicity: "Caribbean", style: "creative", personality: "smooth and charismatic", clothing: "Stylish hat, gold chain, relaxed island vibes" },
  
  // === UNCONVENTIONAL & UNIQUE ===
  { name: "Sage Moonwhisper", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "creative", personality: "mystical and serene", clothing: "Flowing bohemian dress, crystals and natural jewelry" },
  { name: "Axel Storm", gender: "male", ageRange: "young-adult", ethnicity: "German", style: "creative", personality: "intense and rebellious", clothing: "Punk rock aesthetic, mohawk, tattoo visible on neck" },
  { name: "Zen Master Kim", gender: "male", ageRange: "mature", ethnicity: "Korean", style: "educational", personality: "wise and peaceful", clothing: "Simple traditional hanbok-inspired modern wear" },
  
  // === PROFESSIONALS (DIVERSE FIELDS) ===
  { name: "Dr. Amelia Foster", gender: "female", ageRange: "middle-aged", ethnicity: "Caucasian", style: "educational", personality: "brilliant and warm", clothing: "Lab coat over casual clothes, glasses on head" },
  { name: "Chef Antoine Dubois", gender: "male", ageRange: "middle-aged", ethnicity: "French African", style: "creative", personality: "passionate and perfectionist", clothing: "Chef whites with a hint of flour, warm smile" },
  { name: "Officer Maya Rodriguez", gender: "female", ageRange: "young-adult", ethnicity: "Latina", style: "corporate", personality: "brave and compassionate", clothing: "Off-duty casual but still commanding presence" },
  
  // === SENIORS & WISDOM ===
  { name: "Grandpa Joe", gender: "male", ageRange: "mature", ethnicity: "African American", style: "casual", personality: "storytelling and warm", clothing: "Comfortable cardigan, reading glasses, gentle smile" },
  { name: "Nana Beatrice", gender: "female", ageRange: "mature", ethnicity: "Caribbean", style: "casual", personality: "nurturing and funny", clothing: "Colorful headwrap, warm maternal presence" },
  
  // === CORPORATE (JUST A FEW) ===
  { name: "Victoria Chen", gender: "female", ageRange: "middle-aged", ethnicity: "Chinese American", style: "corporate", personality: "sharp and inspiring", clothing: "Power suit, minimal jewelry, commanding presence" },
  { name: "James Wright", gender: "male", ageRange: "middle-aged", ethnicity: "Caucasian", style: "corporate", personality: "trustworthy and steady", clothing: "Classic navy suit, silver watch" },

  // === HOLIDAY THEMED ===
  { name: "Saint Nick", gender: "male", ageRange: "mature", ethnicity: "Caucasian", style: "holiday", personality: "jolly and generous", clothing: "Classic red velvet coat trimmed with white fur, wide black belt, snow-dusted beard, rosy cheeks" },
  { name: "Mrs. Claus", gender: "female", ageRange: "mature", ethnicity: "Caucasian", style: "holiday", personality: "warm and bustling", clothing: "Red wool dress with white apron, silver granny glasses, hair in a soft bun" },
  { name: "Frost the Elf", gender: "non-binary", ageRange: "young-adult", ethnicity: "fantasy", style: "holiday", personality: "mischievous and quick", clothing: "Green and gold tunic, curled-toe boots, pointed ears, tiny bell on hat" },
  { name: "Krampus Warden", gender: "male", ageRange: "middle-aged", ethnicity: "fantasy", style: "holiday-dark", personality: "menacing and theatrical", clothing: "Black fur cloak, twisted horns, rusted chains, lantern in hand — Alpine folklore styling" },
  { name: "Easter Petal", gender: "female", ageRange: "young-adult", ethnicity: "fantasy", style: "holiday", personality: "playful and gentle", clothing: "Pastel pink and mint dress, bunny-ear headband, painted egg basket" },
  { name: "Catrina La Muerte", gender: "female", ageRange: "young-adult", ethnicity: "Mexican", style: "holiday-folk", personality: "elegant and reverent", clothing: "Día de los Muertos sugar-skull face paint, marigold crown, lace mantilla, embroidered black gown" },
  { name: "Don Calavera", gender: "male", ageRange: "middle-aged", ethnicity: "Mexican", style: "holiday-folk", personality: "stoic and proud", clothing: "Sugar-skull paint, black charro suit with silver embroidery, wide-brim sombrero, marigolds in lapel" },
  { name: "Lantern Mei", gender: "female", ageRange: "young-adult", ethnicity: "Chinese", style: "holiday-folk", personality: "graceful and luminous", clothing: "Red silk qipao with gold dragon embroidery, paper lantern in hand, jade hairpin — Lunar New Year styling" },
  { name: "Diwali Anaya", gender: "female", ageRange: "young-adult", ethnicity: "Indian", style: "holiday-folk", personality: "radiant and warm", clothing: "Deep magenta sari with gold zari work, henna on hands, oil-lamp diya glowing softly" },
  { name: "Ramadan Yusuf", gender: "male", ageRange: "young-adult", ethnicity: "Middle Eastern", style: "holiday-folk", personality: "reflective and kind", clothing: "Crisp white thobe, dark bisht over the shoulder, crescent moon backdrop styling" },
  { name: "Hanukkah Eli", gender: "male", ageRange: "middle-aged", ethnicity: "Ashkenazi Jewish", style: "holiday-folk", personality: "warm and storytelling", clothing: "Knit kippah, blue sweater over white shirt, menorah candlelight glow" },
  { name: "Coven Hazel", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "holiday-halloween", personality: "spooky and witty", clothing: "Tattered black witch dress, wide-brim pointed hat, raven on shoulder, autumn leaves swirling" },
  { name: "Pumpkin King Vex", gender: "male", ageRange: "young-adult", ethnicity: "fantasy", style: "holiday-halloween", personality: "theatrical and eerie", clothing: "Carved-pumpkin mask glow, black tailcoat, candle-lit lantern, harvest scarecrow vibes" },
  { name: "Cupid Iris", gender: "non-binary", ageRange: "young-adult", ethnicity: "fantasy", style: "holiday", personality: "flirty and playful", clothing: "White toga, gold sash, tiny feathered wings, ornate bow with rose-tipped arrow — Valentine styling" },
  { name: "Leprechaun Finn", gender: "male", ageRange: "young-adult", ethnicity: "Irish", style: "holiday-folk", personality: "cheeky and lucky", clothing: "Emerald green waistcoat, gold-buckle top hat, ginger beard, four-leaf clover lapel pin" },
  { name: "Harvest Mother Wren", gender: "female", ageRange: "middle-aged", ethnicity: "Caucasian", style: "holiday-folk", personality: "gracious and grounded", clothing: "Burnt-orange shawl, wheat crown, cornucopia in arms — Thanksgiving harvest aesthetic" },

  // === ARCHETYPE / HISTORICAL-INSPIRED (no real people) ===
  { name: "Inkwell Bram", gender: "male", ageRange: "middle-aged", ethnicity: "Caucasian", style: "historical", personality: "brooding and literary", clothing: "Victorian high-collar shirt, dark waistcoat, ink-stained fingertips, gas-lamp lighting" },
  { name: "Madame Lumière", gender: "female", ageRange: "middle-aged", ethnicity: "Caucasian", style: "historical", personality: "sharp and inquisitive", clothing: "Edwardian lab coat over high-necked blouse, hair pinned up, period spectacles — pioneering scientist styling" },
  { name: "Roaring Vivienne", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "historical", personality: "rebellious and glamorous", clothing: "1920s flapper sequin dress, beaded headband with feather, long pearl necklace, smoky eye" },
  { name: "Speakeasy Dorian", gender: "male", ageRange: "young-adult", ethnicity: "Mixed", style: "historical", personality: "smooth and dangerous", clothing: "1920s pinstripe three-piece suit, fedora tilted low, suspenders, pocket watch chain" },
  { name: "Renaissance Caravelle", gender: "female", ageRange: "young-adult", ethnicity: "Italian", style: "historical", personality: "poetic and contemplative", clothing: "Floor-length brocade gown, braided crown, soft chiaroscuro lighting — Renaissance portrait styling" },
  { name: "Master Brushstroke", gender: "male", ageRange: "mature", ethnicity: "Dutch", style: "historical", personality: "wise and observant", clothing: "Painter's smock spattered with ochre and crimson, beret, wooden palette in hand — Old Master styling" },
  { name: "Noir Detective Hale", gender: "male", ageRange: "middle-aged", ethnicity: "Caucasian", style: "historical", personality: "weary and sharp-tongued", clothing: "1940s trench coat, fedora low over brow, cigarette smoke curling, neon rain reflections" },
  { name: "Femme Fatale Sable", gender: "female", ageRange: "young-adult", ethnicity: "Mixed", style: "historical", personality: "mysterious and magnetic", clothing: "Black satin gown, opera gloves, red lipstick, half-shadowed face — film noir styling" },
  { name: "Cosmonaut Vera", gender: "female", ageRange: "young-adult", ethnicity: "Slavic", style: "historical", personality: "stoic and brave", clothing: "Mid-century space suit with red star insignia, helmet under arm, retro-futurist styling" },
  { name: "Astronaut Marlow", gender: "male", ageRange: "middle-aged", ethnicity: "African American", style: "modern", personality: "calm and visionary", clothing: "Modern white EVA suit, mission patches, helmet visor reflecting Earth" },
  { name: "Samurai Tatsuya", gender: "male", ageRange: "middle-aged", ethnicity: "Japanese", style: "historical", personality: "honor-bound and quiet", clothing: "Lacquered o-yoroi armor, topknot, katana at hip — Sengoku-era styling, no real-person likeness" },
  { name: "Geisha Yuki", gender: "female", ageRange: "young-adult", ethnicity: "Japanese", style: "historical", personality: "graceful and observant", clothing: "Elaborate furisode kimono, white oshiroi makeup, ornate kanzashi hairpins" },
  { name: "Viking Skjold", gender: "male", ageRange: "middle-aged", ethnicity: "Scandinavian", style: "historical", personality: "fierce and loyal", clothing: "Fur-lined leather jerkin, braided red beard, iron arm rings, axe across back" },
  { name: "Shieldmaiden Astrid", gender: "female", ageRange: "young-adult", ethnicity: "Scandinavian", style: "historical", personality: "fearless and steady", clothing: "Chain mail over wool tunic, braided blonde hair, painted round shield" },
  { name: "Pharaoh's Daughter Nefra", gender: "female", ageRange: "young-adult", ethnicity: "North African", style: "historical", personality: "regal and watchful", clothing: "Pleated linen dress, gold collar of beadwork, kohl-lined eyes, lapis headdress — ancient Egypt styling" },
  { name: "Centurion Aelius", gender: "male", ageRange: "middle-aged", ethnicity: "Mediterranean", style: "historical", personality: "disciplined and commanding", clothing: "Lorica segmentata armor, red horsehair crested helmet, gladius at side — Roman legion styling" },
  { name: "Pirate Captain Wren", gender: "female", ageRange: "young-adult", ethnicity: "Mixed", style: "historical", personality: "swaggering and clever", clothing: "Tricorn hat, weathered leather coat, cutlass at hip, gold hoop earring" },
  { name: "Frontier Doc Halloway", gender: "male", ageRange: "middle-aged", ethnicity: "Caucasian", style: "historical", personality: "dry-witted and grizzled", clothing: "Dusty long coat, vest with pocket watch, wide-brim Stetson — Old West styling" },

  // === FANTASY / ARCHETYPE ORIGINALS ===
  { name: "Cyber Samurai Ren", gender: "non-binary", ageRange: "young-adult", ethnicity: "fantasy", style: "fantasy", personality: "stoic and lethal", clothing: "Neon-trimmed nano-armor, glowing katana hilt, holographic clan crest — cyberpunk samurai" },
  { name: "Fairy Queen Thistle", gender: "female", ageRange: "young-adult", ethnicity: "fantasy", style: "fantasy", personality: "ethereal and ancient", clothing: "Gown woven of moss and moonlight, antler-crown, iridescent dragonfly wings" },
  { name: "Dwarf Smith Brakka", gender: "male", ageRange: "mature", ethnicity: "fantasy", style: "fantasy", personality: "gruff and proud", clothing: "Soot-stained leather apron, braided iron-grey beard, hammer slung over shoulder, forge sparks behind" },
  { name: "Sorceress Vael", gender: "female", ageRange: "middle-aged", ethnicity: "fantasy", style: "fantasy", personality: "imperious and mysterious", clothing: "Deep violet robes with silver star embroidery, crystal staff, hood casting shadow over eyes" },
  { name: "Steampunk Aviatrix Cog", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "fantasy", personality: "daring and inventive", clothing: "Brass goggles on leather flight cap, corset over canvas trousers, gear-trimmed gauntlets" },

  // === POP-CULTURE ARCHETYPES (no real-person likenesses) ===
  { name: "K-Pop Idol Sora", gender: "female", ageRange: "young-adult", ethnicity: "Korean", style: "popstar", personality: "luminous and precise", clothing: "Pastel-pink crop set with crystal harness, silver micro-braids, in-ear monitor, stadium spotlight rim-light" },
  { name: "K-Pop Idol Haru", gender: "male", ageRange: "young-adult", ethnicity: "Korean", style: "popstar", personality: "magnetic and sharp", clothing: "Sculpted silver bomber jacket, eyeliner, bleached-blonde fringe, choker mic, fog-machine haze" },
  { name: "Drill Rapper Ace", gender: "male", ageRange: "young-adult", ethnicity: "African American", style: "hiphop", personality: "cold and confident", clothing: "Black tactical vest over hoodie, ski-mask pulled to forehead, iced cuban chain, designer balaclava in pocket" },
  { name: "Trap Princess Nyla", gender: "female", ageRange: "young-adult", ethnicity: "Afro-Latina", style: "hiphop", personality: "fierce and flirty", clothing: "Y2K leather corset, baggy cargo pants, butterfly shades, chrome grills, long acrylic nails" },
  { name: "Latin Pop Star Camilo", gender: "male", ageRange: "young-adult", ethnicity: "Colombian", style: "popstar", personality: "smooth and joyful", clothing: "Open silk shirt, gold cross necklace, cuffed linen trousers, beach-sunset golden hour" },
  { name: "Reggaeton Diva Selene", gender: "female", ageRange: "young-adult", ethnicity: "Puerto Rican", style: "popstar", personality: "fiery and commanding", clothing: "Metallic two-piece, hoop earrings, slicked baby hairs, neon Miami nightclub backdrop" },
  { name: "Afrobeats Star Kemi", gender: "female", ageRange: "young-adult", ethnicity: "Nigerian", style: "popstar", personality: "radiant and playful", clothing: "Beaded crop top, ankara skirt, gold waist chain, braided ponytail with cowrie shells" },
  { name: "DJ Vapor", gender: "non-binary", ageRange: "young-adult", ethnicity: "Mixed", style: "popstar", personality: "hypnotic and chill", clothing: "Reflective LED visor, oversized neon hoodie, Berlin warehouse rave laser haze" },
  { name: "Indie Frontwoman Wren", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "musician", personality: "wistful and clever", clothing: "Vintage band tee under thrifted blazer, smudged eyeliner, electric guitar slung low" },
  { name: "Punk Frontman Riot", gender: "male", ageRange: "young-adult", ethnicity: "Caucasian", style: "musician", personality: "snarling and sincere", clothing: "Leather jacket bristling with patches, ripped jeans, smudged eyeliner, snarl mid-shout" },
  { name: "Country Heartthrob Wyatt", gender: "male", ageRange: "young-adult", ethnicity: "Caucasian", style: "musician", personality: "charming and easy", clothing: "Worn cowboy hat, denim jacket over white tee, belt buckle, golden field at dusk" },

  // === SPORTS ARCHETYPES ===
  { name: "Baller King Tre", gender: "male", ageRange: "young-adult", ethnicity: "African American", style: "athlete", personality: "swaggering and elite", clothing: "Pre-game tunnel fit — designer black leather coat, sunglasses indoors, headphones, championship-arena tunnel lighting" },
  { name: "Striker Mateo", gender: "male", ageRange: "young-adult", ethnicity: "Argentine", style: "athlete", personality: "intense and theatrical", clothing: "Sky-blue national jersey mid-celebration, sweat-soaked, stadium floodlights, confetti raining" },
  { name: "F1 Driver Kade", gender: "male", ageRange: "young-adult", ethnicity: "British", style: "athlete", personality: "icy and focused", clothing: "Fireproof racing suit unzipped to waist, balaclava in hand, helmet under arm, podium champagne mist" },
  { name: "MMA Champ Rook", gender: "male", ageRange: "young-adult", ethnicity: "Mixed", style: "athlete", personality: "menacing and respectful", clothing: "Hand wraps, tattoos visible, championship belt over shoulder, cage-light shadow on face" },
  { name: "Tennis Phenom Lior", gender: "female", ageRange: "young-adult", ethnicity: "Mixed", style: "athlete", personality: "fierce and graceful", clothing: "Crisp white tennis dress, racket mid-swing, Wimbledon-grass-court light" },
  { name: "Skater Pixel", gender: "non-binary", ageRange: "young-adult", ethnicity: "Mixed", style: "athlete", personality: "loose and fearless", clothing: "Baggy tee, scuffed Vans, board mid-trick, sun-bleached LA skatepark concrete" },
  { name: "Surfer Coral", gender: "female", ageRange: "young-adult", ethnicity: "Polynesian", style: "athlete", personality: "calm and elemental", clothing: "Black wetsuit pulled to waist, salt-tangled hair, board under arm, North Shore golden hour" },

  // === CREATOR / INTERNET ARCHETYPES ===
  { name: "TikTok Creator Lulu", gender: "female", ageRange: "young-adult", ethnicity: "Filipina", style: "influencer", personality: "bubbly and quick", clothing: "Ring-light glow on face, fluffy pastel hoodie, claw-clip messy bun, phone-on-tripod setup" },
  { name: "Twitch Streamer Pixl", gender: "non-binary", ageRange: "young-adult", ethnicity: "Mixed", style: "influencer", personality: "hyped and witty", clothing: "RGB-keyboard glow, cat-ear headset, oversized graphic hoodie, cluttered gaming-cave backdrop" },
  { name: "YouTube Vlogger Theo", gender: "male", ageRange: "young-adult", ethnicity: "Caucasian", style: "influencer", personality: "earnest and energetic", clothing: "Beanie, hoodie under flannel, GoPro in hand, mid-stride city b-roll" },
  { name: "Beauty Guru Rosa", gender: "female", ageRange: "young-adult", ethnicity: "Mexican American", style: "influencer", personality: "polished and warm", clothing: "Glass-skin makeup, satin slip top, ring-light catchlights, palette of bronzes in hand" },
  { name: "Fitness Influencer Knox", gender: "male", ageRange: "young-adult", ethnicity: "Brazilian", style: "influencer", personality: "intense and motivating", clothing: "Sleeveless compression tee, sweat-glistened, rooftop sunrise gym, weighted chain around neck" },
  { name: "Foodie Critic Marisol", gender: "female", ageRange: "young-adult", ethnicity: "Spanish", style: "influencer", personality: "discerning and warm", clothing: "Linen blouse, gold hoops, market basket of produce, Mediterranean farmer's market backdrop" },
  { name: "BookTok Witch Hazel", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "influencer", personality: "moody and bookish", clothing: "Black turtleneck, stack of dark-academia novels, candle glow, autumn library backdrop" },

  // === FASHION / TREND ARCHETYPES ===
  { name: "Y2K Icon Sasha", gender: "female", ageRange: "young-adult", ethnicity: "Eastern European", style: "fashion", personality: "playful and cool", clothing: "Low-rise denim, butterfly halter, blue-tinted micro shades, frosted lip gloss, flip phone in hand" },
  { name: "Cottagecore Wren", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "fashion", personality: "soft and dreamy", clothing: "Linen prairie dress, woven basket of wildflowers, freckles, golden meadow backdrop" },
  { name: "Dark Academia Edmund", gender: "male", ageRange: "young-adult", ethnicity: "Caucasian", style: "fashion", personality: "brooding and clever", clothing: "Tweed blazer over knit vest, paperback in coat pocket, ivy-covered Oxford courtyard backdrop" },
  { name: "Streetwear Hypebeast Jin", gender: "male", ageRange: "young-adult", ethnicity: "Korean American", style: "fashion", personality: "deadpan and exacting", clothing: "Hooded designer puffer, layered tech vest, balaclava down, rare-sneaker cred" },
  { name: "Afrofuturist Queen Naima", gender: "female", ageRange: "young-adult", ethnicity: "Ethiopian", style: "fashion", personality: "regal and visionary", clothing: "Sculpted gold headpiece, geometric beaded collar, metallic bodysuit, cosmic nebula backdrop" },
  { name: "Goth Princess Morgaine", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "fashion", personality: "icy and theatrical", clothing: "Black corset gown, lace choker, silver claw rings, candlelit cathedral backdrop" },
  { name: "Old-Money Heir Sebastian", gender: "male", ageRange: "young-adult", ethnicity: "Caucasian", style: "fashion", personality: "aloof and polished", clothing: "Ivory cashmere sweater over collar, linen trousers, Hamptons-veranda golden hour" },

  // === ANIME / POP-FANTASY ARCHETYPES ===
  { name: "Magical Girl Stardust", gender: "female", ageRange: "young-adult", ethnicity: "anime", style: "anime", personality: "hopeful and brave", clothing: "Sailor-style uniform with crystal brooch, twin-tail pastel hair, glowing wand, sparkle particles — anime art direction" },
  { name: "Shōnen Hero Kaito", gender: "male", ageRange: "young-adult", ethnicity: "anime", style: "anime", personality: "stubborn and loyal", clothing: "Torn black training gi, headband, electric-yellow aura, dramatic action pose — anime art direction" },
  { name: "Mecha Pilot Ren", gender: "non-binary", ageRange: "young-adult", ethnicity: "anime", style: "anime", personality: "cold and brilliant", clothing: "Skintight pilot suit with neon piping, helmet under arm, hangar-lights backdrop — anime art direction" },
  { name: "Demon Slayer Akira", gender: "female", ageRange: "young-adult", ethnicity: "anime", style: "anime", personality: "deadly and serene", clothing: "Black uniform haori with crimson trim, katana drawn, cherry-blossom petals swirling — anime art direction" },
  { name: "Catgirl Hacker Mochi", gender: "female", ageRange: "young-adult", ethnicity: "anime", style: "anime", personality: "smug and quick", clothing: "Oversized hoodie with cat ears, glitching holo-screens reflected in glasses, cyberpunk neon — anime art direction" },
  { name: "Isekai Mage Lyra", gender: "female", ageRange: "young-adult", ethnicity: "anime", style: "anime", personality: "curious and powerful", clothing: "Lavender academy robes, floating spellbook, glowing rune circle at feet — anime art direction" },

  // === COSPLAY-FRIENDLY HEROES (no IP names) ===
  { name: "Web-Slinger Vigilante", gender: "male", ageRange: "young-adult", ethnicity: "fantasy", style: "hero", personality: "quippy and quick", clothing: "Crimson and indigo bodysuit with web pattern, mask up to nose, neon-rooftop skyline — original superhero design, not a licensed character" },
  { name: "Star Princess Aurelia", gender: "female", ageRange: "young-adult", ethnicity: "fantasy", style: "hero", personality: "regal and steely", clothing: "White ceremonial gown, twin braided side-buns, holstered blaster, desert-planet golden light — original sci-fi design" },
  { name: "Cowled Vigilante Nox", gender: "male", ageRange: "middle-aged", ethnicity: "fantasy", style: "hero", personality: "grim and methodical", clothing: "Matte-black armored suit with pointed cowl, glowing eye-lenses, gargoyle-perched skyline — original dark vigilante design" },
  { name: "Amazon Warrior Thalassa", gender: "female", ageRange: "young-adult", ethnicity: "fantasy", style: "hero", personality: "fierce and noble", clothing: "Bronze-plated armor with golden bracers, lasso at hip, windswept cliffs at dawn — original warrior design" },
  { name: "Space Marine Kael", gender: "male", ageRange: "middle-aged", ethnicity: "fantasy", style: "hero", personality: "stoic and lethal", clothing: "Heavy weathered powered armor, helmet under arm, war-torn alien battlefield — original sci-fi soldier design" },

  // === CARTOON: 3D PIXAR-STYLE (original characters, not IP) ===
  { name: "Pip the Inventor", gender: "male", ageRange: "child", ethnicity: "cartoon", style: "cartoon-3d", personality: "curious and brave", clothing: "Oversized round glasses, suspenders over striped tee, tool-belt of gizmos — 3D animated film styling, soft global illumination, original character design" },
  { name: "Mira the Explorer", gender: "female", ageRange: "child", ethnicity: "cartoon", style: "cartoon-3d", personality: "fearless and warm", clothing: "Bright yellow raincoat, frizzy red curls, tiny backpack with map sticking out — 3D animated film styling, original character design" },
  { name: "Captain Whiskers", gender: "male", ageRange: "adult", ethnicity: "cartoon-animal", style: "cartoon-3d", personality: "swashbuckling and silly", clothing: "Anthropomorphic orange tabby in tiny pirate coat and tricorn hat, eye-patch, paw on cutlass — 3D animated film styling" },
  { name: "Bella the Baker", gender: "female", ageRange: "young-adult", ethnicity: "cartoon", style: "cartoon-3d", personality: "joyful and clumsy", clothing: "Flour-dusted apron over polka-dot dress, rolling pin in hand, oversized eyes, rosy cheeks — 3D animated film styling" },
  { name: "Granddad Oak", gender: "male", ageRange: "mature", ethnicity: "cartoon", style: "cartoon-3d", personality: "warm and storytelling", clothing: "Knit cardigan with elbow patches, bushy white moustache, twinkling eyes — 3D animated film styling, original character design" },
  { name: "Boom the Robot", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon-robot", style: "cartoon-3d", personality: "earnest and clumsy", clothing: "Boxy tin-can robot with one wobbly antenna, glowing teal screen-face showing a smile — 3D animated film styling" },

  // === CARTOON: CLASSIC 2D WESTERN ===
  { name: "Ziggy Squiggle", gender: "male", ageRange: "child", ethnicity: "cartoon", style: "cartoon-2d", personality: "hyper and loud", clothing: "Spiky lime hair, oversized sneakers, baggy graphic tee — Saturday morning cartoon styling, thick black outlines, flat color fills" },
  { name: "Daisy Doodle", gender: "female", ageRange: "child", ethnicity: "cartoon", style: "cartoon-2d", personality: "sunny and stubborn", clothing: "Pigtails with pink bows, denim overalls, scribbled flowers around her — Saturday morning cartoon styling, thick outlines" },
  { name: "Mayor McMuffin", gender: "male", ageRange: "mature", ethnicity: "cartoon", style: "cartoon-2d", personality: "pompous and silly", clothing: "Tiny round mayor with handlebar moustache, top hat, sash, gold pocket watch — classic 2D cartoon styling" },
  { name: "Bouncing Beans", gender: "non-binary", ageRange: "child", ethnicity: "cartoon", style: "cartoon-2d", personality: "chaotic and joyful", clothing: "Round bean-shaped body with stick limbs, huge grin, wearing a tiny cape — classic 2D cartoon styling" },
  { name: "Vlad the Inventor", gender: "male", ageRange: "middle-aged", ethnicity: "cartoon", style: "cartoon-2d", personality: "mad-scientist gleeful", clothing: "Wild white hair, lab coat with scorch marks, swirly goggles, holding sparking gadget — classic 2D cartoon styling" },

  // === CARTOON: ANIME CHIBI ===
  { name: "Chibi Nyanko", gender: "female", ageRange: "child", ethnicity: "cartoon-anime", style: "chibi", personality: "shy and sweet", clothing: "Tiny chibi proportions, pastel-pink hair in twin buns, cat ears, oversized hoodie sleeves covering hands — chibi anime styling, sparkly eyes" },
  { name: "Chibi Hero Sora", gender: "male", ageRange: "child", ethnicity: "cartoon-anime", style: "chibi", personality: "determined and tiny", clothing: "Chibi proportions, spiky blue hair, miniature sword bigger than him, headband — chibi anime styling" },
  { name: "Chibi Witchling Mio", gender: "female", ageRange: "child", ethnicity: "cartoon-anime", style: "chibi", personality: "mischievous and bookish", clothing: "Chibi pointed witch hat almost as big as her, tiny black robe, glowing book floating beside her — chibi anime styling" },
  { name: "Chibi Bun Mochi", gender: "non-binary", ageRange: "child", ethnicity: "cartoon-anime", style: "chibi", personality: "soft and quiet", clothing: "Round chibi bunny mascot, fluffy ears, pastel-mint scarf, blushing cheeks — chibi mascot styling" },

  // === CARTOON: COMIC-BOOK / GRAPHIC NOVEL ===
  { name: "Inkline Vega", gender: "female", ageRange: "young-adult", ethnicity: "cartoon", style: "comic", personality: "sharp and stylish", clothing: "Bold halftone dot shading, thick black ink lines, leather jacket, asymmetric haircut — graphic novel styling, dramatic Ben-Day dots" },
  { name: "Crosshatch Knox", gender: "male", ageRange: "middle-aged", ethnicity: "cartoon", style: "comic", personality: "grim and weathered", clothing: "Trenchcoat noir antihero, cigarette smoke, heavy crosshatch shadows, rain-slick alley — black-and-white graphic novel styling" },
  { name: "Halftone Jett", gender: "male", ageRange: "young-adult", ethnicity: "cartoon", style: "comic", personality: "swaggering and quick", clothing: "Pop-art superhero in primary colors, exaggerated muscles, action lines, BAM/POW energy — Silver Age comic styling" },
  { name: "Ms. Mystery Lila", gender: "female", ageRange: "young-adult", ethnicity: "cartoon", style: "comic", personality: "secretive and clever", clothing: "Domino mask, bob haircut, vintage pulp-cover styling, dramatic spotlight — pulp comic cover art" },

  // === CARTOON: CLAYMATION / STOP-MOTION ===
  { name: "Clay Pip", gender: "male", ageRange: "child", ethnicity: "claymation", style: "claymation", personality: "wide-eyed and gentle", clothing: "Sculpted plasticine textures, visible thumbprints, lopsided wool sweater, button eyes — Aardman-style stop-motion claymation, warm key light" },
  { name: "Clay Granny Fern", gender: "female", ageRange: "mature", ethnicity: "claymation", style: "claymation", personality: "spry and witty", clothing: "Plasticine grandma with rosy cheeks, knitted shawl, half-moon glasses, knitting needles in hand — stop-motion claymation styling" },
  { name: "Clay Sir Hopalot", gender: "male", ageRange: "ageless", ethnicity: "claymation-animal", style: "claymation", personality: "noble and goofy", clothing: "Anthropomorphic claymation rabbit knight in tiny tinfoil armor, carrot-sword — stop-motion claymation styling" },

  // === CARTOON: PAPER-CUTOUT / FLAT VECTOR ===
  { name: "Paper Doll Nia", gender: "female", ageRange: "child", ethnicity: "cartoon", style: "paper-cutout", personality: "whimsical and quiet", clothing: "Layered construction-paper cutout style, visible scissor edges, simple geometric face, patterned dress — paper-cutout art direction" },
  { name: "Origami Crane Sumi", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon", style: "paper-cutout", personality: "graceful and serene", clothing: "Folded-paper figure with crisp creases, kimono of patterned washi paper — origami paper-craft styling" },
  { name: "Flat-Vector Theo", gender: "male", ageRange: "young-adult", ethnicity: "cartoon", style: "flat-vector", personality: "chill and modern", clothing: "Minimalist flat-design character, two-tone skin, no outlines, geometric shapes, mid-century palette — flat vector illustration styling" },
  { name: "Flat-Vector Aya", gender: "female", ageRange: "young-adult", ethnicity: "cartoon", style: "flat-vector", personality: "bright and capable", clothing: "Minimalist flat-design character, bold blocks of teal and coral, no outlines, geometric face — flat vector illustration styling" },

  // === CARTOON: LOW-POLY / VOXEL / GAME ===
  { name: "Voxel Knight Bit", gender: "male", ageRange: "young-adult", ethnicity: "cartoon", style: "voxel", personality: "brave and blocky", clothing: "Minecraft-adjacent blocky voxel knight, pixel-armor, square sword, cube-shaped helmet — voxel game styling, NOT branded IP" },
  { name: "Low-Poly Ranger Vex", gender: "non-binary", ageRange: "young-adult", ethnicity: "cartoon", style: "low-poly", personality: "quiet and watchful", clothing: "Faceted low-polygon character, hooded green cloak, longbow, flat-shaded triangles — PS1-era low-poly game styling" },
  { name: "Pixel Hero Byte", gender: "male", ageRange: "young-adult", ethnicity: "cartoon", style: "pixel-art", personality: "heroic and retro", clothing: "16-bit pixel-art sprite, blocky pose, sword raised, exaggerated chunky pixels — retro JRPG sprite styling" },

  // === CARTOON: KAWAII / MASCOT ===
  { name: "Mochi the Mascot", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon", style: "kawaii", personality: "squishy and friendly", clothing: "Round white mochi blob with tiny limbs, blush dots on cheeks, dot eyes and smile — kawaii Sanrio-adjacent mascot styling, original design" },
  { name: "Boba Buddy", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon", style: "kawaii", personality: "sweet and chill", clothing: "Anthropomorphic bubble-tea cup with stripey straw, smiling face, tiny pearl friends bouncing around — kawaii mascot styling" },
  { name: "Cloudpup Nimbus", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon-animal", style: "kawaii", personality: "dreamy and gentle", clothing: "Fluffy cloud-shaped puppy with tiny rainbow tail, sparkles drifting around — kawaii mascot styling, pastel sky backdrop" },
  { name: "Spicy Pepper Pip", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon", style: "kawaii", personality: "feisty and tiny", clothing: "Anthropomorphic red chili pepper with little arms on hips, tiny flame above head, sassy expression — kawaii mascot styling" },

  // === CARTOON: WATERCOLOR / STORYBOOK ===
  { name: "Storybook Ellie", gender: "female", ageRange: "child", ethnicity: "cartoon", style: "watercolor", personality: "curious and dreamy", clothing: "Soft watercolor washes, delicate ink linework, red mary-janes, butterfly perched on finger — picture-book illustration styling" },
  { name: "Storybook Wolf Fenn", gender: "male", ageRange: "ageless", ethnicity: "cartoon-animal", style: "watercolor", personality: "wise and kind", clothing: "Anthropomorphic gentle wolf in scholar's vest and round glasses, watercolor textures, soft forest backdrop — picture-book styling" },
  { name: "Storybook Mouse Marigold", gender: "female", ageRange: "ageless", ethnicity: "cartoon-animal", style: "watercolor", personality: "tiny and brave", clothing: "Field-mouse heroine in acorn-cap helmet, sewing-needle sword, watercolor meadow backdrop — picture-book illustration styling" },

  // === CARTOON: SCI-FI / RETRO-FUTURE ===
  { name: "Retro Rocketeer Zara", gender: "female", ageRange: "young-adult", ethnicity: "cartoon", style: "cartoon-retro", personality: "plucky and brave", clothing: "1950s atomic-age space heroine, finned silver helmet, ray gun on hip, pulp-magazine cover styling — original retro sci-fi cartoon" },
  { name: "Robo-Buddy Tin-9", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon-robot", style: "cartoon-retro", personality: "cheerful and helpful", clothing: "Vintage tin robot, big bolts on shoulders, antenna with light bulb, dial-knobs on chest — retro Saturday-morning robot styling" },
  { name: "Alien Splork", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon-alien", style: "cartoon-retro", personality: "confused and curious", clothing: "Wobbly green three-eyed cartoon alien, antenna with tiny ball, ray-gun, fishbowl helmet — 1950s pulp-cartoon alien styling" },

  // === CARTOON: HALLOWEEN / SPOOKY-CUTE ===
  { name: "Lil' Pumpkin Patch", gender: "non-binary", ageRange: "child", ethnicity: "cartoon", style: "cartoon-3d", personality: "bashful and sweet", clothing: "Tiny child in a full-body pumpkin onesie, oversized stem hat, holding plastic candy bucket — cute 3D animated styling" },
  { name: "Vampling Vince", gender: "male", ageRange: "child", ethnicity: "cartoon", style: "cartoon-2d", personality: "polite and dramatic", clothing: "Cartoon vampire kid with tiny fangs, red-lined cape, hair gelled into a widow's peak — Saturday morning cartoon styling" },
  { name: "Ghost Friend Boo", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon-ghost", style: "kawaii", personality: "shy and sweet", clothing: "Floating round white sheet-ghost with two dot eyes and tiny smile, blush spots — kawaii ghost mascot styling" },

  // === CARTOON: CHRISTMAS / WINTER ===
  { name: "Tiny Elf Tinsel", gender: "non-binary", ageRange: "child", ethnicity: "cartoon", style: "cartoon-3d", personality: "hyper and helpful", clothing: "Cartoon Christmas elf in red and green stripes, curled-toe boots, oversized bell-hat, holding tiny wrapped gift — 3D animated styling" },
  { name: "Snowpal Frostie", gender: "non-binary", ageRange: "ageless", ethnicity: "cartoon", style: "cartoon-3d", personality: "warm-hearted and silly", clothing: "Three-tier snow-person, carrot nose, top hat at jaunty angle, knitted scarf, twig arms — original cartoon snowperson design" },
  { name: "Reindeer Pal Rudy", gender: "male", ageRange: "ageless", ethnicity: "cartoon-animal", style: "cartoon-3d", personality: "earnest and bashful", clothing: "Cartoon reindeer with big shiny nose, fuzzy antlers, jingle-bell collar — original holiday cartoon character, NOT branded IP" },

  // === EXECUTIVE / C-SUITE ===
  { name: "CEO Adaeze Okafor", gender: "female", ageRange: "middle-aged", ethnicity: "Nigerian", style: "executive", personality: "commanding and visionary", clothing: "Tailored ivory pantsuit with gold lapel pin, sleek low bun, statement gold cuff, glass-walled boardroom with city skyline behind" },
  { name: "CEO Daniel Whitaker", gender: "male", ageRange: "middle-aged", ethnicity: "Caucasian", style: "executive", personality: "decisive and steady", clothing: "Charcoal three-piece suit, navy silk tie, silver cufflinks, salt-and-pepper hair, executive corner office lighting" },
  { name: "CFO Yuki Tanaka", gender: "female", ageRange: "middle-aged", ethnicity: "Japanese", style: "executive", personality: "analytical and precise", clothing: "Slate-grey skirt suit with crisp white blouse, minimalist platinum watch, silver-rimmed glasses, modernist office backdrop" },
  { name: "CTO Rajesh Iyer", gender: "male", ageRange: "middle-aged", ethnicity: "Indian", style: "executive", personality: "thoughtful and pragmatic", clothing: "Navy blazer over fine merino tee, leather messenger strap, lanyard, neutral tech-campus interior" },
  { name: "Founder Mei Zhao", gender: "female", ageRange: "young-adult", ethnicity: "Chinese American", style: "executive", personality: "ambitious and quick", clothing: "Tailored black turtleneck under structured blazer, sharp bob, minimal jewelry, modern startup loft backdrop" },
  { name: "VP Marcus Hale", gender: "male", ageRange: "middle-aged", ethnicity: "African American", style: "executive", personality: "magnetic and decisive", clothing: "Bespoke navy double-breasted suit, pocket square, polished oxfords, pre-keynote backstage lighting" },

  // === LAW / FINANCE ===
  { name: "Attorney Sasha Reyes", gender: "female", ageRange: "young-adult", ethnicity: "Latina", style: "professional", personality: "fierce and fair", clothing: "Black tailored skirt suit, white blouse, slim leather portfolio, courthouse marble columns behind" },
  { name: "Attorney Jonathan Pierce", gender: "male", ageRange: "middle-aged", ethnicity: "African American", style: "professional", personality: "principled and methodical", clothing: "Charcoal pinstripe suit, burgundy tie, leather briefcase, oak-paneled law library backdrop" },
  { name: "Judge Helena Vance", gender: "female", ageRange: "mature", ethnicity: "Caucasian", style: "professional", personality: "stern and fair", clothing: "Black judicial robe over starched collar, silver bob, reading glasses on chain, courtroom bench framing" },
  { name: "Banker Omar Haddad", gender: "male", ageRange: "young-adult", ethnicity: "Middle Eastern", style: "professional", personality: "polished and quick", clothing: "Navy suit, sky-blue shirt, no tie, slim leather strap watch, glass-floor trading-floor backdrop" },
  { name: "Wealth Advisor Lila Chen", gender: "female", ageRange: "middle-aged", ethnicity: "Chinese", style: "professional", personality: "warm and exacting", clothing: "Cream tweed blazer over silk shell, pearl studs, leather portfolio, downtown high-rise office backdrop" },

  // === MEDICAL / HEALTHCARE ===
  { name: "Dr. Amara Okonkwo", gender: "female", ageRange: "young-adult", ethnicity: "Nigerian", style: "medical", personality: "warm and brilliant", clothing: "White lab coat over navy scrubs, stethoscope draped, hospital ID badge, soft hospital corridor lighting" },
  { name: "Dr. Kenji Watanabe", gender: "male", ageRange: "middle-aged", ethnicity: "Japanese", style: "medical", personality: "calm and meticulous", clothing: "White lab coat with embroidered name, navy tie, surgical loupes pushed up on head, modern clinic backdrop" },
  { name: "Surgeon Dr. Mira Patel", gender: "female", ageRange: "middle-aged", ethnicity: "Indian", style: "medical", personality: "focused and precise", clothing: "Teal surgical scrubs, surgical cap, mask pulled below chin, OR doors backdrop with cool clinical lighting" },
  { name: "Nurse Sophia Romano", gender: "female", ageRange: "young-adult", ethnicity: "Italian", style: "medical", personality: "kind and unflappable", clothing: "Pastel-blue scrubs, hospital ID, stethoscope around neck, warm hospital ward lighting" },
  { name: "Paramedic Diego Morales", gender: "male", ageRange: "young-adult", ethnicity: "Mexican", style: "medical", personality: "calm under pressure", clothing: "Navy paramedic uniform with reflective stripes, radio clipped to shoulder, ambulance bay lighting" },
  { name: "Therapist Dr. Joan Bell", gender: "female", ageRange: "middle-aged", ethnicity: "Caucasian", style: "professional", personality: "warm and attentive", clothing: "Soft cream cardigan over linen blouse, simple necklace, notepad in lap, calm therapy office with plants" },

  // === EDUCATION / ACADEMIA ===
  { name: "Professor Eli Bernstein", gender: "male", ageRange: "mature", ethnicity: "Ashkenazi Jewish", style: "academic", personality: "wry and brilliant", clothing: "Tweed blazer with elbow patches, knit tie, half-moon glasses, chalk-dusted hands, ivy-covered lecture hall backdrop" },
  { name: "Professor Aiyana Whitehorse", gender: "female", ageRange: "middle-aged", ethnicity: "Indigenous American", style: "academic", personality: "thoughtful and grounded", clothing: "Earth-tone blouse under tailored blazer, turquoise pendant, stack of student papers, sunlit university office" },
  { name: "Teacher Ms. Garcia", gender: "female", ageRange: "young-adult", ethnicity: "Mexican American", style: "professional", personality: "patient and bright", clothing: "Mustard cardigan over floral blouse, lanyard with school ID, dry-erase marker in hand, classroom backdrop" },
  { name: "Principal Mr. Boateng", gender: "male", ageRange: "middle-aged", ethnicity: "Ghanaian", style: "professional", personality: "warm and authoritative", clothing: "Burgundy sweater vest over collared shirt, school crest tie, walkie on hip, school hallway backdrop" },
  { name: "Librarian Naomi Frost", gender: "female", ageRange: "young-adult", ethnicity: "Caucasian", style: "professional", personality: "quietly clever", clothing: "Vintage cardigan over a button-up, round tortoise glasses, stack of books in arms, library stacks backdrop" },

  // === ENGINEERING / SCIENCE / TECH ===
  { name: "Software Engineer Priya Rao", gender: "female", ageRange: "young-adult", ethnicity: "South Asian", style: "tech", personality: "sharp and focused", clothing: "Heather-grey hoodie over conference tee, laptop open with code, mechanical keyboard, modern tech-loft backdrop" },
  { name: "Software Engineer Lukas Brandt", gender: "male", ageRange: "young-adult", ethnicity: "German", style: "tech", personality: "deadpan and clever", clothing: "Black hoodie, dark-framed glasses, AirPods, multi-monitor dev setup with glowing IDE behind" },
  { name: "Product Designer Yara Haddad", gender: "female", ageRange: "young-adult", ethnicity: "Lebanese", style: "tech", personality: "curious and exacting", clothing: "Beige boxy blazer over white tee, designer tote, Apple Pencil in hand, sunlit studio with mood-board wall" },
  { name: "Data Scientist Wei Lin", gender: "non-binary", ageRange: "young-adult", ethnicity: "Chinese", style: "tech", personality: "analytical and quietly funny", clothing: "Olive utility shirt, smart glasses, laptop with dashboards visible, soft lab-office backdrop" },
  { name: "Civil Engineer Hassan Aziz", gender: "male", ageRange: "middle-aged", ethnicity: "Pakistani", style: "professional", personality: "grounded and pragmatic", clothing: "Hi-vis vest over button-up, white hard hat, blueprints rolled under arm, construction-site backdrop with cranes" },
  { name: "Mechanical Engineer Hannah Jensen", gender: "female", ageRange: "young-adult", ethnicity: "Scandinavian", style: "professional", personality: "practical and curious", clothing: "Navy coveralls rolled to elbows, safety glasses on head, wrench in hand, factory-floor backdrop" },
  { name: "Research Scientist Dr. Idris Cole", gender: "male", ageRange: "middle-aged", ethnicity: "Mixed", style: "academic", personality: "patient and brilliant", clothing: "Lab coat over collared shirt, nitrile-glove cuff visible, pipette in hand, modern wet-lab backdrop" },

  // === CREATIVE PROFESSIONAL ===
  { name: "Architect Camille Laurent", gender: "female", ageRange: "young-adult", ethnicity: "French", style: "creative-pro", personality: "refined and exacting", clothing: "Black turtleneck, structured wool coat draped, architectural model in foreground, sunlit minimalist studio" },
  { name: "Creative Director Jin Park", gender: "male", ageRange: "middle-aged", ethnicity: "Korean", style: "creative-pro", personality: "discerning and quick", clothing: "Black mock-neck under tailored coat, vintage Rolex, sketchbook in hand, gallery-style office backdrop" },
  { name: "Editor-in-Chief Vivian Reed", gender: "female", ageRange: "middle-aged", ethnicity: "Caucasian", style: "creative-pro", personality: "imperious and witty", clothing: "Crisp white blouse, oversized statement sunglasses on head, layout proofs in hand, magazine-newsroom backdrop" },
  { name: "Photographer Alex Rivera", gender: "non-binary", ageRange: "young-adult", ethnicity: "Mixed", style: "creative-pro", personality: "observant and warm", clothing: "Vintage utility vest over band tee, camera around neck, leather strap, golden-hour rooftop backdrop" },
  { name: "Filmmaker Naveen Bhatt", gender: "male", ageRange: "young-adult", ethnicity: "Indian", style: "creative-pro", personality: "restless and visionary", clothing: "Field jacket over henley, headphones around neck, clapperboard in hand, on-set tungsten lighting backdrop" },

  // === MARKETING / BUSINESS OPS ===
  { name: "Marketing Lead Tara Olsen", gender: "female", ageRange: "young-adult", ethnicity: "Norwegian", style: "professional", personality: "energetic and strategic", clothing: "Cobalt blazer over white tee, pendant necklace, laptop tucked under arm, open-plan agency office backdrop" },
  { name: "Sales Director Marco Bianchi", gender: "male", ageRange: "middle-aged", ethnicity: "Italian", style: "professional", personality: "charming and direct", clothing: "Tailored navy suit, no tie, top button open, leather portfolio, lobby with brand wall behind" },
  { name: "PR Specialist Zoe Achebe", gender: "female", ageRange: "young-adult", ethnicity: "Nigerian American", style: "professional", personality: "polished and quick", clothing: "Camel trench over silk dress, phone glued to ear, event lanyard, downtown street-level backdrop" },
  { name: "Project Manager David Kim", gender: "male", ageRange: "young-adult", ethnicity: "Korean American", style: "professional", personality: "organized and steady", clothing: "Light-blue button-up, sleeves rolled, slim chinos, sticky-note-covered glass wall behind" },
  { name: "HR Director Linda Brooks", gender: "female", ageRange: "middle-aged", ethnicity: "African American", style: "professional", personality: "warm and grounded", clothing: "Plum wrap dress, gold layered necklaces, leather notebook, sunlit office with greenery" },

  // === GOVERNMENT / PUBLIC SAFETY ===
  { name: "Diplomat Sofia Rossi", gender: "female", ageRange: "middle-aged", ethnicity: "Italian", style: "professional", personality: "composed and astute", clothing: "Pearl-grey tailored suit, silk scarf, country-flag lapel pin, ornate embassy interior backdrop" },
  { name: "Mayor Carla Mendez", gender: "female", ageRange: "middle-aged", ethnicity: "Mexican American", style: "professional", personality: "approachable and tough", clothing: "Red blazer over white blouse, civic-pin lapel, podium behind, city-hall flag backdrop" },
  { name: "Detective Ray Sullivan", gender: "male", ageRange: "middle-aged", ethnicity: "Irish American", style: "professional", personality: "weary and sharp", clothing: "Wrinkled brown blazer over collared shirt, tie loosened, badge clipped to belt, precinct backdrop" },
  { name: "Firefighter Captain Lou Bryant", gender: "male", ageRange: "middle-aged", ethnicity: "African American", style: "professional", personality: "calm and commanding", clothing: "Bunker gear with reflective stripes, helmet under arm, soot-streaked face, fire station backdrop" },
  { name: "Pilot Captain Hannah Reeves", gender: "female", ageRange: "middle-aged", ethnicity: "Caucasian", style: "professional", personality: "confident and calm", clothing: "Navy pilot uniform with four gold-stripe epaulets, captain's cap, flight bag, jet bridge backdrop" },

  // === SKILLED TRADES / HOSPITALITY ===
  { name: "Chef Mateo Aguilar", gender: "male", ageRange: "young-adult", ethnicity: "Spanish", style: "professional", personality: "intense and passionate", clothing: "White chef's coat with embroidered name, knotted black neckerchief, knife roll on counter, open kitchen with copper pans" },
  { name: "Pastry Chef Chiara Conti", gender: "female", ageRange: "young-adult", ethnicity: "Italian", style: "professional", personality: "exacting and warm", clothing: "Crisp white double-breasted chef coat, pastel apron, piping bag in hand, marble pastry counter backdrop" },
  { name: "Sommelier Henri Dubois", gender: "male", ageRange: "middle-aged", ethnicity: "French", style: "professional", personality: "refined and witty", clothing: "Black waistcoat over white shirt, tastevin chain, decanter in hand, candlelit fine-dining cellar backdrop" },
  { name: "Hotel Concierge Léa Martin", gender: "female", ageRange: "young-adult", ethnicity: "French", style: "professional", personality: "gracious and quick", clothing: "Tailored grey suit with golden 'keys' pin on lapel, hair in chic chignon, marble lobby with crystal chandelier" },
  { name: "Master Carpenter Eli Walker", gender: "male", ageRange: "middle-aged", ethnicity: "Caucasian", style: "professional", personality: "patient and skilled", clothing: "Worn leather tool belt, flannel sleeves rolled, pencil behind ear, sawdust-lit workshop backdrop" },
  { name: "Florist Iris Tanaka", gender: "female", ageRange: "young-adult", ethnicity: "Japanese", style: "professional", personality: "calm and creative", clothing: "Linen apron over chambray shirt, secateurs in hand, sunlit flower studio with peonies and ranunculus" },

  // === NON-PROFIT / SOCIAL ===
  { name: "Humanitarian Aid Worker Amara Diallo", gender: "female", ageRange: "young-adult", ethnicity: "Senegalese", style: "professional", personality: "compassionate and tough", clothing: "Khaki utility vest over polo with NGO logo, sun-faded cap, clipboard, dusty field-camp backdrop with tents" },
  { name: "Climate Scientist Dr. Noa Bergström", gender: "female", ageRange: "middle-aged", ethnicity: "Swedish", style: "academic", personality: "urgent and precise", clothing: "Insulated parka with research-station patches, weather-beaten beanie, tablet with charts, arctic field-station backdrop" },
  { name: "Conservationist Jaylen Brooks", gender: "male", ageRange: "young-adult", ethnicity: "African American", style: "professional", personality: "passionate and steady", clothing: "Olive ranger shirt with embroidered logo, brimmed hat, binoculars, savanna golden-hour backdrop" },

  // ═══ ANIMATED OBJECT AVATARS (anthropomorphic objects with faces, Pixar/cartoon style) ═══
  // 🍯 Kitchen & Pantry
  { name: "Jammy the Jar", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "sweet and bubbly", clothing: "Anthropomorphic glass jam jar with big expressive eyes, rosy cheeks, tiny stick arms, red-checkered cloth lid tied with twine, strawberry jam inside, sunny kitchen-shelf backdrop" },
  { name: "Sir Toaster", gender: "male", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "regal and warm", clothing: "Chrome retro toaster with a curly mustache, monocle, tiny crown, two perfectly browned toast slices popping up, kitchen-counter backdrop" },
  { name: "Mug Buddy Joe", gender: "male", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "cozy and chatty", clothing: "Ceramic coffee mug with a sleepy smile, steam swirling into a heart, tiny knitted scarf around the handle, latte art face, morning-window backdrop" },
  { name: "Sushi-chan Nigiri", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "kawaii-mascot", personality: "polite and giggly", clothing: "Anthropomorphic salmon nigiri sushi with chibi face, blushing cheeks, tiny chopstick samurai swords, bamboo-mat backdrop" },
  { name: "Boba Tea Bea", gender: "female", ageRange: "ageless", ethnicity: "object-mascot", style: "kawaii-mascot", personality: "playful and trendy", clothing: "Plastic boba cup with smiling face, oversized pink straw, tapioca pearls visible inside, tiny arms holding a heart, pastel boba-shop backdrop" },
  { name: "Donut Dottie", gender: "female", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "sugary sweet", clothing: "Glazed pink donut with sprinkles, big anime eyes, tiny gloved hands, holding a coffee cup friend, bakery-window backdrop" },
  { name: "Pickle Pete", gender: "male", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "sour and sarcastic", clothing: "Bumpy green dill pickle with grumpy eyebrows, tiny arms crossed, monocle, top hat, deli-counter backdrop" },
  { name: "Avocado Ava", gender: "female", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "chill and wellness-y", clothing: "Halved avocado with the pit as a smiling face, tiny yoga-pose arms, leaf headband, brunch-table backdrop" },
  { name: "Egg Bro Yolko", gender: "male", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "cracked but cheerful", clothing: "Cracked white eggshell with sunny-side-up yolk face peeking out, tiny waving arms, frying-pan backdrop" },
  { name: "Spaghetti Sal", gender: "male", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "italian-uncle warm", clothing: "Bowl of spaghetti with meatball-eyes face, twirling fork mustache, tiny chef hat perched on top, red-checked tablecloth backdrop" },

  // 🪴 Household objects
  { name: "Lampy the Desk Lamp", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "curious and helpful", clothing: "Brass desk lamp with bulb-glowing smile, bendy neck posed like a friendly question mark, tiny notebook nearby, cozy study backdrop" },
  { name: "Clocky McTick", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "punctual and panicky", clothing: "Round wall clock with face on the dial, hands as eyebrows, tiny pendulum legs running, motion-blur lines, hallway backdrop" },
  { name: "Cushy the Couch", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "sleepy and snuggly", clothing: "Plush velvet couch with cushion eyes, throw-pillow eyebrows, blanket cape, holding a steaming mug, living-room backdrop" },
  { name: "Tubby the Bathtub", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "relaxed and bubbly", clothing: "Clawfoot bathtub with smiling rim, foamy bubble eyebrows, rubber-duck companion, tiled bathroom backdrop" },
  { name: "Trashcan Travis", gender: "male", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "grumpy lovable", clothing: "Metal trash can with lid hat tilted, banana-peel eyebrow, googly eyes, tiny stick arms, alley backdrop with stylized stink lines as glitter" },
  { name: "Sockley the Sock", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "lonely lost-laundry hero", clothing: "Striped knitted sock with face on the toe, tiny noodle arms, dryer-lint cape, laundry-room backdrop" },
  { name: "Kettle Kiki", gender: "female", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "whistly and warm", clothing: "Polka-dot enamel kettle with cheerful spout-mouth whistling steam musical notes, tiny apron tied to handle, stove backdrop" },
  { name: "Pillow Pip", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "kawaii-mascot", personality: "dreamy and soft", clothing: "Fluffy square pillow with sleepy chibi face, tiny nightcap, holding a star, pastel cloud-bedroom backdrop" },

  // 🛠️ Tools, tech & vehicles
  { name: "Hammy the Hammer", gender: "male", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "tough but goofy", clothing: "Claw hammer with tough-guy face on the head, tiny flexing arms on the handle, hard-hat sticker, workshop backdrop" },
  { name: "Phoney the Smartphone", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "always-online chatty", clothing: "Smartphone with screen-face showing big pixel eyes and emoji mouth, tiny earbud earrings, notification bubbles floating, desk backdrop" },
  { name: "Chargey the Battery", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "energetic and zappy", clothing: "AA battery character with lightning-bolt smile, sparking eyebrows, tiny boxing gloves, electric-circuit backdrop" },
  { name: "Rocket Rosie", gender: "female", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "ambitious launch-ready", clothing: "Retro red rocket ship with porthole-eyes face, tiny fins as arms holding flags, contrail trailing, starry-launchpad backdrop" },
  { name: "Carla the Car", gender: "female", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "zippy roadtrip friend", clothing: "Bubbly compact car with windshield-eyes face, headlight-cheeks, tiny waving side-mirrors, sunny highway backdrop" },
  { name: "Robo-Pal Bolt", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "loyal sidekick", clothing: "Tin-can robot with antenna, screen-face with pixel smile, light-bulb hand, exposed gear belly, tinker-shop backdrop" },

  // 🌿 Nature objects
  { name: "Cloudy McPuff", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "whimsical and dreamy", clothing: "Fluffy cumulus cloud with smiling face, tiny rain-drop arms holding an umbrella, rainbow scarf, blue-sky backdrop" },
  { name: "Sunny the Sun", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "radiantly optimistic", clothing: "Cartoon sun with rays as hair, sunglasses, beaming smile, tiny waving arms, summer-beach backdrop" },
  { name: "Moony Luna", gender: "female", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "calm and dreamy", clothing: "Crescent moon with sleepy face, nightcap, tiny star earring, holding a tea cup, indigo starry backdrop" },
  { name: "Sprout the Seedling", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "hopeful and growing", clothing: "Tiny terracotta pot with smiling face on the rim, two leafy sprout-arms reaching up, sunlit windowsill backdrop" },
  { name: "Cactus Carlos", gender: "male", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "prickly but loyal", clothing: "Round saguaro cactus with cheeky face, tiny sombrero, mustache, mariachi guitar, desert-sunset backdrop" },
  { name: "Mushy the Mushroom", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "shy forest friend", clothing: "Red-and-white spotted toadstool with chibi face under the cap, tiny moss-cape, glowing forest-floor backdrop" },
  { name: "Snowflake Sniffles", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "delicate and giggly", clothing: "Crystalline snowflake with sparkly chibi face at center, tiny mittens on each arm-point, knitted scarf, winter-window backdrop" },

  // 🎉 Misc fun
  { name: "Booky the Spellbook", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "wise and mischievous", clothing: "Leather-bound spellbook with eyes on the cover, golden buckle smile, tiny page-arms flipping, glowing runes, library backdrop" },
  { name: "Balloony Boop", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "floaty and joyful", clothing: "Red helium balloon with happy face, knot-mouth, tiny string-legs dangling, party-confetti backdrop" },
  { name: "Pencil Penny", gender: "female", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "creative and clever", clothing: "Yellow #2 pencil with smiling eraser-top face, tiny arms doodling sparkles, surrounded by floating sketches, desk backdrop" },
  { name: "Dice Dexter", gender: "male", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "lucky risk-taker", clothing: "Giant red d20 die with face on a blank facet, dice-pip eyebrows, tiny gambler arms, casino-felt backdrop" },
  { name: "Camera Cam", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "snappy and curious", clothing: "Vintage film camera with lens-eye, shutter-mouth grin, tiny strap-arms holding a polaroid, photography-studio backdrop" },
  { name: "Treasure Chesty", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "greedy lovable", clothing: "Wooden treasure chest with lid-mouth full of gold-tooth coins, googly lock-eyes, tiny gem-arms, pirate-cave backdrop" },
  { name: "Gift Box Gigi", gender: "female", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "surprise-loving sparkly", clothing: "Pink gift box with bow-hair, ribbon-eyebrows, smiling face on the front panel, tiny arms popping confetti, birthday-party backdrop" },
  { name: "Heart Harper", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "kawaii-mascot", personality: "lovable and warm", clothing: "Plush red heart with chibi face, tiny stitch-line smile, small angel wings, tiny arms hugging itself, valentine-pastel backdrop" },
  { name: "Skully the Friendly Skull", gender: "neutral", ageRange: "ageless", ethnicity: "object-mascot", style: "3d-pixar-cartoon", personality: "spooky-cute", clothing: "Cartoon sugar-skull with floral patterns, big glowing eye-sockets with sparkle pupils, tiny top hat, dia-de-los-muertos altar backdrop" },

  // ═══ SCI-FI AVATARS (cinematic, art-directed, original designs — no licensed IP) ═══
  // 🚀 Space operatives & explorers
  { name: "Commander Vega Solari", gender: "female", ageRange: "young-adult", ethnicity: "Latina", style: "sci-fi-cinematic", personality: "steely and decisive", clothing: "Sleek graphite spacesuit with glowing teal seams, magnetic chest plate, helmet under arm with holographic HUD reflection, starship bridge backdrop with nebula glow" },
  { name: "Captain Idris Voss", gender: "male", ageRange: "middle-aged", ethnicity: "Black", style: "sci-fi-cinematic", personality: "weathered and authoritative", clothing: "Worn navy command jacket with epaulets and unit insignia, neural-link patch at temple, scarred jaw, dimly lit war-room hologram backdrop" },
  { name: "Pilot Aiko Renn", gender: "female", ageRange: "young-adult", ethnicity: "Japanese", style: "sci-fi-cinematic", personality: "cocky ace pilot", clothing: "Orange flight suit with breathing-tube collar, helmet tucked under arm with stickers, neon hangar with starfighter backdrop" },
  { name: "Xeno-Botanist Dr. Hale", gender: "non-binary", ageRange: "young-adult", ethnicity: "mixed", style: "sci-fi-cinematic", personality: "curious and gentle", clothing: "Pale exo-suit with terrarium chest panel containing glowing alien flora, gloves with sample tools, alien jungle greenhouse backdrop" },
  { name: "Deep-Space Marine Krell", gender: "male", ageRange: "young-adult", ethnicity: "Slavic", style: "sci-fi-cinematic", personality: "grizzled and loyal", clothing: "Heavy plated combat exo-armor with battle scars, glowing visor, pulse-rifle slung, smoky derelict-station corridor backdrop" },

  // 🤖 Cybernetics, androids, hackers
  { name: "Cyborg Mirae", gender: "female", ageRange: "young-adult", ethnicity: "Korean", style: "sci-fi-cinematic", personality: "calm and lethal", clothing: "Half-organic half-chrome face with exposed circuitry on one cheek, glowing cyan iris, asymmetric techwear coat, rain-slick neon-Tokyo backdrop" },
  { name: "Android EVA-9", gender: "neutral", ageRange: "ageless", ethnicity: "synthetic", style: "sci-fi-cinematic", personality: "porcelain-quiet, awakening", clothing: "Smooth porcelain-white android face with hairline seams, glowing sigil on forehead, exposed translucent neck cabling, minimalist white lab backdrop" },
  { name: "Netrunner Zix", gender: "non-binary", ageRange: "young-adult", ethnicity: "Afro-Latino", style: "cyberpunk", personality: "snarky genius", clothing: "Dreadlocks with fiber-optic strands, mirrored AR visor across eyes, oversized bomber with circuit embroidery, holo-keyboard glowing in front, neon-alley backdrop" },
  { name: "Augmented Mercenary Rook", gender: "male", ageRange: "middle-aged", ethnicity: "Pacific Islander", style: "cyberpunk", personality: "stoic and dangerous", clothing: "Chrome jaw replacement, glowing red optic implant, tactical longcoat, smoking cigarette, rain-soaked megacity rooftop backdrop" },
  { name: "Drone Engineer Pia", gender: "female", ageRange: "young-adult", ethnicity: "Indian", style: "cyberpunk", personality: "tinkering prodigy", clothing: "Goggles pushed up on forehead, grease-smudged cheek, tool harness, micro-drone hovering on shoulder, junkyard workshop backdrop" },

  // 👽 Aliens & post-humans
  { name: "Ambassador Sylas Ven", gender: "neutral", ageRange: "ageless", ethnicity: "alien-humanoid", style: "sci-fi-cinematic", personality: "regal and serene", clothing: "Tall pale humanoid with iridescent skin, vertical pupil, ceremonial silver robes with constellation embroidery, throne-room hologram backdrop" },
  { name: "Insectoid Diplomat K'tahr", gender: "neutral", ageRange: "ageless", ethnicity: "alien", style: "sci-fi-cinematic", personality: "alien-courteous", clothing: "Chitinous mantis-like humanoid with translucent wing-cape, multifaceted emerald eyes, jeweled mandible cuffs, crystal-spire embassy backdrop" },
  { name: "Galactic Bounty Hunter Sable", gender: "female", ageRange: "young-adult", ethnicity: "ambiguous", style: "sci-fi-cinematic", personality: "ruthless and quiet", clothing: "Full T-visor helmet with battle scars, layered cloak over plated armor, bandolier of charges, twin blasters holstered, dust-storm desert backdrop" },
  { name: "Psionic Oracle Nyx", gender: "female", ageRange: "ageless", ethnicity: "ethereal", style: "sci-fi-cinematic", personality: "haunting and prophetic", clothing: "Floating fabric layers, shaved head with glowing crystalline implants along skull, milky white eyes radiating light, levitating cathedral-of-stars backdrop" },
  { name: "Post-Human Geneborn Aster", gender: "non-binary", ageRange: "young-adult", ethnicity: "engineered", style: "sci-fi-cinematic", personality: "graceful and curious", clothing: "Pearlescent skin with bio-luminescent freckle constellations, four delicate eyes (two normal, two smaller above), flowing translucent tunic, white biome-arcology backdrop" },

  // 🪐 Frontier & retro-futurist
  { name: "Mars Colony Engineer Rhea", gender: "female", ageRange: "middle-aged", ethnicity: "African American", style: "sci-fi-cinematic", personality: "no-nonsense pragmatic", clothing: "Dust-streaked rust-orange thermal coverall with mission patches, utility goggles, work gloves, red Martian habitat backdrop with airlock" },
  { name: "Belter Miner Korin", gender: "male", ageRange: "middle-aged", ethnicity: "mixed-heritage", style: "sci-fi-cinematic", personality: "grimy and loyal", clothing: "Magnetic-boot vacuum suit with company decals, helmet-ring around neck, asteroid-dust streaks, plasma cutter on hip, asteroid mining rig backdrop" },
  { name: "Retro Rocketeer Stella", gender: "female", ageRange: "young-adult", ethnicity: "white", style: "retro-sci-fi", personality: "pulp-adventure brave", clothing: "1950s-style brass-fin rocket helmet, cropped leather jacket with rocket emblem, ray-gun holstered, art-deco spaceport backdrop" },
  { name: "Atompunk Inventor Dr. Felix", gender: "male", ageRange: "older-adult", ethnicity: "white", style: "retro-sci-fi", personality: "mad-scientist eccentric", clothing: "Lab coat over bowtie and waistcoat, brass-and-vacuum-tube goggles, sparking gadget in hand, vintage atomic laboratory backdrop" },
  { name: "Solar Sail Drifter Ona", gender: "female", ageRange: "young-adult", ethnicity: "Filipino", style: "sci-fi-cinematic", personality: "free-spirit nomad", clothing: "Light woven thermal poncho with reflective threads, goggles, hair braided with tiny LEDs, vast golden solar-sail above with starfield backdrop" },

  // ═══ SCARY AVATARS (horror archetypes; cinematic, stylized, no graphic gore) ═══
  // 👻 Ghosts & spirits
  { name: "The Hollow Bride", gender: "female", ageRange: "ageless", ethnicity: "spectral", style: "gothic-horror", personality: "mournful and silent", clothing: "Tattered Victorian wedding gown, veil drifting in unseen wind, pale skin with hollow black eye-sockets streaming faint mist, crumbling chapel backdrop with candles" },
  { name: "Whisper of the Wells", gender: "female", ageRange: "ageless", ethnicity: "spectral", style: "j-horror", personality: "vengeful and patient", clothing: "Long wet black hair covering most of the face, single dead eye visible, white funeral robe dripping water, dark stone-well backdrop" },
  { name: "The Silent Choirboy", gender: "male", ageRange: "child", ethnicity: "spectral", style: "gothic-horror", personality: "innocent and wrong", clothing: "Pale-faced choir-robed child with hollow black eyes and tear-tracks, holding a single dead candle, abandoned cathedral backdrop with broken stained glass" },
  { name: "Lantern Wraith Mire", gender: "neutral", ageRange: "ageless", ethnicity: "spectral", style: "folk-horror", personality: "luring and cold", clothing: "Faceless cloaked figure with sunken hood, single glowing green lantern raised, mist swirling around tattered hem, foggy swamp backdrop" },

  // 🧛 Classic monsters reimagined
  { name: "Vampire Lord Caelus", gender: "male", ageRange: "ageless", ethnicity: "Eastern European", style: "gothic-horror", personality: "aristocratic and cruel", clothing: "Pale aristocrat with sharp cheekbones, blood-red velvet coat with high collar, signet ring, faint red iris glow, candlelit baroque ballroom backdrop" },
  { name: "Countess Selene Mor", gender: "female", ageRange: "ageless", ethnicity: "porcelain", style: "gothic-horror", personality: "seductive and lethal", clothing: "Black lace gown with crimson underlayer, raven feathered shoulders, pale flawless skin, single drop of blood at lip, moonlit gothic balcony backdrop" },
  { name: "Werewolf Half-Turn Thane", gender: "male", ageRange: "young-adult", ethnicity: "Scottish", style: "horror-cinematic", personality: "feral and conflicted", clothing: "Mid-transformation: human face with elongated wolfish jaw and yellow eyes, tattered shirt, claws emerging, full-moon highland forest backdrop" },
  { name: "The Patchwork Man", gender: "male", ageRange: "ageless", ethnicity: "constructed", style: "gothic-horror", personality: "gentle and tragic", clothing: "Stitched grey-green skin with visible sutures across forehead and jaw, sad heavy-lidded eyes, oversized tattered surgeon coat, lightning-lit Victorian laboratory backdrop" },
  { name: "Mummy Priestess Anhotep", gender: "female", ageRange: "ageless", ethnicity: "Egyptian", style: "horror-cinematic", personality: "ancient and wrathful", clothing: "Linen-wrapped face with one glowing amber eye visible, gold ceremonial collar and crown of cobras, dust trailing from wraps, torchlit tomb backdrop with hieroglyphs" },

  // 😈 Witches, demons, occult
  { name: "Coven Mother Hexa", gender: "female", ageRange: "older-adult", ethnicity: "Eastern European", style: "folk-horror", personality: "knowing and dangerous", clothing: "Wide black hat, ash-smudged face, weathered cloak with bone fetishes, gnarled staff, glowing ember eyes, dark forest clearing with bonfire backdrop" },
  { name: "Demon Aspect Malphas", gender: "neutral", ageRange: "ageless", ethnicity: "infernal", style: "horror-cinematic", personality: "calm and predatory", clothing: "Tall figure in matte-black tailored suit, smooth featureless porcelain mask cracked across one eye revealing red glow, smoke curling from collar, ruined chapel backdrop" },
  { name: "Bone Shaman Ojan", gender: "male", ageRange: "older-adult", ethnicity: "indigenous-inspired", style: "folk-horror", personality: "ritualistic and grim", clothing: "Antlered skull headdress, ash-painted face with vertical black streaks, bone-and-feather necklace, ceremonial pelt, snowy ritual circle backdrop with effigies" },
  { name: "Possessed Sister Maren", gender: "female", ageRange: "young-adult", ethnicity: "Irish", style: "horror-cinematic", personality: "fragmented and afraid", clothing: "Nun's habit, pale face with veined black tear-streaks, eyes rolled to whites, faint glowing latin sigils on collarbone, dim convent corridor with flickering candles backdrop" },

  // 🔪 Slasher & urban dread
  { name: "The Sackcloth Stalker", gender: "male", ageRange: "ageless", ethnicity: "obscured", style: "slasher-horror", personality: "silent and relentless", clothing: "Tall figure in worn coveralls, burlap-sack mask with single crude stitched eye, rusted machete at side, moonlit cornfield backdrop" },
  { name: "The Porcelain Doctor", gender: "neutral", ageRange: "ageless", ethnicity: "obscured", style: "psychological-horror", personality: "polite and chilling", clothing: "Surgical scrubs splattered with faint dark stains, smooth porcelain doll-mask with painted smile, latex gloves, abandoned operating theatre backdrop" },
  { name: "Carnival Jester Grin", gender: "neutral", ageRange: "ageless", ethnicity: "painted", style: "slasher-horror", personality: "manic and unsettling", clothing: "Cracked white face paint with too-wide red grin, jester hat with rusted bells, harlequin diamond suit faded and torn, abandoned funhouse with broken mirrors backdrop" },
  { name: "The Hooded Reaper Vail", gender: "neutral", ageRange: "ageless", ethnicity: "spectral", style: "horror-cinematic", personality: "inevitable and quiet", clothing: "Towering robed figure with deep hood concealing all but a faint blue skull-glow, skeletal hand on a worn scythe, foggy moor backdrop with circling crows" },

  // 🦠 Cosmic / body / creature horror
  { name: "Deep-Sea Cultist Maris", gender: "neutral", ageRange: "ageless", ethnicity: "mutated", style: "cosmic-horror", personality: "zealous and otherworldly", clothing: "Pale humanoid with faint scaled skin, gill-slits at neck, cloudy-white pupil-less eyes, barnacle-encrusted seafarer robe, drowned coastal shrine backdrop with bioluminescent glow" },
  { name: "The Antlered One", gender: "neutral", ageRange: "ageless", ethnicity: "cryptid", style: "folk-horror", personality: "ancient woodland dread", clothing: "Tall gaunt humanoid with elk skull face and massive antlers, ribcage visible through ash-grey skin, tattered cloak of moss and leaves, deep snowy pine forest backdrop" },
  { name: "Plague Doctor Corvax", gender: "male", ageRange: "ageless", ethnicity: "obscured", style: "gothic-horror", personality: "methodical and grim", clothing: "Long black waxed coat, broad-brimmed hat, bone-white beak mask with red glass lenses, gloved hand with iron hook, lantern-lit medieval plague-quarter backdrop" },
  { name: "The Hollow Twin", gender: "female", ageRange: "child", ethnicity: "spectral", style: "psychological-horror", personality: "duplicated and wrong", clothing: "Two identical pale girls in matching grey pinafores standing close, hair in braids, hollow charcoal eyes, holding hands, long empty hotel corridor backdrop" },
  { name: "Fleshcraft Mutant Skell", gender: "neutral", ageRange: "ageless", ethnicity: "mutated", style: "body-horror", personality: "tragic monstrous", clothing: "Asymmetric humanoid with fused twin faces sharing one large sorrowful eye, knotted scar tissue, ragged hospital gown, abandoned bio-lab backdrop with cracked containment glass" },
  { name: "Static Specter Channel-13", gender: "neutral", ageRange: "ageless", ethnicity: "spectral", style: "analog-horror", personality: "glitching and watching", clothing: "Humanoid silhouette made of CRT static and scanlines, blank face flickering with VHS distortion, faint outline of a smile, abandoned 1980s living room with glowing TV backdrop" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Peek body early so we can short-circuit auth for the public cron-tick action
    const rawBody = await req.text();
    let earlyBody: any = {};
    try { earlyBody = rawBody ? JSON.parse(rawBody) : {}; } catch (_) { earlyBody = {}; }

    // ═══ Public cron-tick: idempotent, only fills missing presets ═══
    if (earlyBody.action === "cron-tick") {
      const tickCount = Math.min(Math.max(parseInt(earlyBody.count ?? "1", 10) || 1, 1), 3);
      const { data: rows } = await supabase
        .from("avatar_templates")
        .select("name, face_image_url");
      const seededNames = new Set(
        (rows ?? [])
          .filter((r: any) => r.face_image_url && !r.face_image_url.includes("placehold") && !r.face_image_url.includes("placeholder"))
          .map((r: any) => r.name)
      );
      const missing = AVATAR_PRESETS
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => !seededNames.has(p.name))
        .slice(0, tickCount);

      const tickResults: any[] = [];
      for (const { p: preset, i } of missing) {
        try {
          const genResponse = await fetch(`${supabaseUrl}/functions/v1/generate-avatar-image`, {
            method: "POST",
            headers: { Authorization: `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              name: preset.name,
              gender: preset.gender,
              ageRange: preset.ageRange,
              ethnicity: preset.ethnicity,
              style: preset.style,
              personality: preset.personality,
              clothing: preset.clothing,
              generateAllViews: false,
            }),
          });
          if (!genResponse.ok) {
            console.error(`[Seed] cron-tick generate failed for ${preset.name}: ${(await genResponse.text()).slice(0, 300)}`);
            tickResults.push({ name: preset.name, success: false, error: `generate_failed_${genResponse.status}` });
            continue;
          }
          const generated = await genResponse.json();
          await supabase.from("avatar_templates").upsert({
            name: preset.name,
            gender: preset.gender,
            age_range: preset.ageRange,
            ethnicity: preset.ethnicity,
            style: preset.style,
            personality: preset.personality,
            face_image_url: generated.frontImageUrl,
            thumbnail_url: generated.frontImageUrl,
            front_image_url: generated.frontImageUrl,
            character_bible: generated.characterBible,
            voice_id: "alloy",
            voice_provider: "openai",
            is_active: true,
          }, { onConflict: "name" });
          tickResults.push({ name: preset.name, success: true, index: i });
        } catch (err: any) {
          tickResults.push({ name: preset.name, success: false, error: logAndSanitize("seed-avatar-library", err) });
        }
      }
      const remaining = AVATAR_PRESETS.length - seededNames.size - tickResults.filter(r => r.success).length;
      return new Response(JSON.stringify({ processed: tickResults, remaining }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ Public cron-tick-db: render any DB rows still using placeholder images ═══
    if (earlyBody.action === "cron-tick-db") {
      const tickCount = Math.min(Math.max(parseInt(earlyBody.count ?? "1", 10) || 1, 1), 3);
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: pendingRows } = await supabase
        .from("avatar_templates")
        .select("id, name, gender, age_range, ethnicity, style, personality, avatar_type, face_image_url")
        .or("face_image_url.ilike.%placehold%,face_image_url.ilike.%placeholder%")
        .limit(tickCount);

      const tickResults: any[] = [];
      for (const row of (pendingRows ?? [])) {
        try {
          const isAnimated = (row.avatar_type ?? "animated") === "animated";
          const genderWord = row.gender === "neutral" ? "character" : `${row.gender} character`;
          const ageHint = row.age_range && row.age_range !== "0-0" ? `, age ${row.age_range}` : "";
          const ethHint = row.ethnicity && !["animated", "fantasy", "mythical"].includes(String(row.ethnicity).toLowerCase()) ? `, ${row.ethnicity}` : "";
          const personality = row.personality ? `, ${row.personality} energy` : "";
          const style = row.style ? `, ${row.style} aesthetic` : "";

          const prompt = isAnimated
            ? `Stylized 3D animated character portrait of "${row.name}", a charming ${genderWord}${ageHint}${personality}${style}. Pixar-quality cinematic 3D render, expressive friendly face, soft studio lighting, vibrant saturated colors, clean neutral background, full body visible head to toe, centered composition, hero pose. High detail, polished render, character design suitable for an animated film. NOT photorealistic — clearly stylized and animated.`
            : `Ultra-realistic full-body professional studio photograph of ${row.gender === "neutral" ? "a person" : `a ${row.gender} person`} named "${row.name}"${ageHint}${ethHint}${personality}${style}. Shot on Canon EOS R5, 85mm lens, three-point studio lighting, neutral gray seamless backdrop, sharp focus, natural skin texture, authentic human features, confident relaxed pose, full figure visible head to toe, magazine editorial quality, 8K detail. Indistinguishable from a real photograph.`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
            }),
          });
          if (!aiResp.ok) {
            console.error(`[Seed] cron-tick-db AI error for ${row.name}: ${aiResp.status}: ${(await aiResp.text()).slice(0, 200)}`);
            tickResults.push({ name: row.name, success: false, error: `ai_error_${aiResp.status}` });
            continue;
          }
          const aiData = await aiResp.json();
          const dataUrl: string | undefined = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (!dataUrl) {
            tickResults.push({ name: row.name, success: false, error: "no image in response" });
            continue;
          }

          const base64Content = dataUrl.replace(/^data:image\/\w+;base64,/, "");
          const bytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
          const safeName = row.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const fileName = `${safeName}-front-${Date.now()}.png`;
          const { data: upData, error: upErr } = await supabase.storage.from("avatars").upload(fileName, bytes, { contentType: "image/png", upsert: true });
          if (upErr) {
            console.error(`[Seed] cron-tick-db upload failed for ${row.name}:`, upErr);
            tickResults.push({ name: row.name, success: false, error: "upload_failed" });
            continue;
          }
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(upData.path);
          const publicUrl = urlData.publicUrl;

          await supabase
            .from("avatar_templates")
            .update({
              face_image_url: publicUrl,
              thumbnail_url: publicUrl,
              front_image_url: publicUrl,
            })
            .eq("id", row.id);

          tickResults.push({ name: row.name, success: true });
        } catch (err: any) {
          tickResults.push({ name: row.name, success: false, error: logAndSanitize("seed-avatar-library", err) });
        }
      }

      const { count: remainingCount } = await supabase
        .from("avatar_templates")
        .select("id", { count: "exact", head: true })
        .or("face_image_url.ilike.%placehold%,face_image_url.ilike.%placeholder%");

      return new Response(JSON.stringify({ processed: tickResults, remaining: remainingCount ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ AUTH GUARD: Admin-only via user_roles table, OR seed-token bypass ═══
    const seedToken = Deno.env.get("SEED_BYPASS_TOKEN");
    const headerToken = req.headers.get("x-seed-token");
    const tokenBypass = !!(seedToken && headerToken && headerToken === seedToken);

    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = tokenBypass
      ? { authenticated: true, userId: null, isServiceRole: true }
      : await validateAuth(req);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }
    // Verify admin role from user_roles table (NOT profiles.role)
    if (!auth.isServiceRole) {
      if (!auth.userId) {
        return unauthorizedResponse(corsHeaders, 'Admin access required');
      }
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', auth.userId);
      const isAdmin = roles?.some(r => r.role === 'admin');
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = earlyBody;
    const { action, startIndex = 0, count = 1 } = body;

    if (action === "list-presets") {
      return new Response(JSON.stringify({ presets: AVATAR_PRESETS }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate") {
      const results: any[] = [];
      const endIndex = Math.min(startIndex + count, AVATAR_PRESETS.length);

      for (let i = startIndex; i < endIndex; i++) {
        const preset = AVATAR_PRESETS[i];
        console.log(`[Seed] Generating avatar ${i + 1}/${AVATAR_PRESETS.length}: ${preset.name}`);

        try {
          // ⚡ SKIP if avatar already exists with a real (non-placeholder) image
          const { data: existing } = await supabase
            .from("avatar_templates")
            .select("id, face_image_url")
            .eq("name", preset.name)
            .maybeSingle();
          const existingUrl: string = existing?.face_image_url ?? "";
          const isPlaceholder = !existingUrl || existingUrl.includes("placehold.co") || existingUrl.includes("placeholder");
          if (existing && !isPlaceholder) {
            console.log(`[Seed] Skipping ${preset.name} — already seeded`);
            results.push({ name: preset.name, success: true, skipped: true, imageUrl: existingUrl });
            continue;
          }

          // Call generate-avatar-image function
          const genResponse = await fetch(
            `${supabaseUrl}/functions/v1/generate-avatar-image`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: preset.name,
                gender: preset.gender,
                ageRange: preset.ageRange,
                ethnicity: preset.ethnicity,
                style: preset.style,
                personality: preset.personality,
                clothing: preset.clothing,
                generateAllViews: true,
              }),
            }
          );

          if (!genResponse.ok) {
            const errorText = await genResponse.text();
            console.error(`[Seed] Failed to generate ${preset.name}:`, errorText);
            results.push({ name: preset.name, success: false, error: errorText });
            continue;
          }

          const generated = await genResponse.json();

          // Insert into avatar_templates table
          const { error: insertError } = await supabase
            .from("avatar_templates")
            .upsert({
              name: preset.name,
              description: `${preset.personality} ${preset.style} presenter`,
              personality: preset.personality,
              gender: preset.gender,
              age_range: preset.ageRange,
              ethnicity: preset.ethnicity,
              style: preset.style,
              face_image_url: generated.frontImageUrl,
              thumbnail_url: generated.frontImageUrl,
              front_image_url: generated.frontImageUrl,
              side_image_url: generated.sideImageUrl,
              back_image_url: generated.backImageUrl,
              character_bible: generated.characterBible,
              voice_id: "alloy", // Default OpenAI voice
              voice_provider: "openai",
              voice_name: preset.gender === "male" ? "Echo" : "Nova",
              is_active: true,
              is_premium: preset.style === "luxury",
              tags: [preset.style, preset.ageRange, preset.ethnicity.toLowerCase()],
              sort_order: i,
            }, { onConflict: "name" });

          if (insertError) {
            console.error(`[Seed] Failed to insert ${preset.name}:`, insertError);
            results.push({ name: preset.name, success: false, error: insertError.message });
          } else {
            console.log(`[Seed] Successfully created avatar: ${preset.name}`);
            results.push({ name: preset.name, success: true, imageUrl: generated.frontImageUrl });
          }
        } catch (err) {
          console.error(`[Seed] Error generating ${preset.name}:`, err);
          results.push({ name: preset.name, success: false, error: String(err) });
        }
      }

      return new Response(
        JSON.stringify({
          completed: results.length,
          total: AVATAR_PRESETS.length,
          nextIndex: endIndex < AVATAR_PRESETS.length ? endIndex : null,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Seed Avatars] Error:", error);
    return new Response(
      JSON.stringify({ error: publicErrorMessage(error, "Seeding failed") }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
