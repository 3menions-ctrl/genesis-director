import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ═══ AUTH GUARD: Admin-only via user_roles table ═══
    const { validateAuth, unauthorizedResponse } = await import("../_shared/auth-guard.ts");
    const auth = await validateAuth(req);
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

    const body = await req.json();
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Seeding failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
