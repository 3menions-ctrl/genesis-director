-- ════════════════════════════════════════════════════════════════════════
-- Crossover — VFX template library for the "break through the screen"
-- generation surface.
--
-- A template is a pre-engineered prompt + creative metadata describing one
-- of the "next-gen clip" patterns the user wants the platform to produce:
-- characters / objects crossing from a digital UI (TikTok feed, YouTube
-- player, retro CRT, oil painting) into a physical real-world environment.
--
-- The Crossover page browses these templates, then dispatches the chosen
-- one through the same mode-router → hollywood-pipeline path the rest of
-- the platform uses, with the template's `pure_prompt` as the base and
-- optional user customizations (subject character, source video, mood)
-- merged in.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.vfx_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  -- Editorial
  name          text NOT NULL,
  category      text NOT NULL CHECK (category IN (
    'vertical_ui', 'desktop_ui', 'social_feed', 'retro_holo', 'surreal'
  )),
  -- The raw AI prompt — the proven shot description.
  pure_prompt   text NOT NULL,
  -- Short tagline for the card.
  hook          text,
  -- Visual hint for the preview chrome the composer shows.
  chrome_kind   text NOT NULL CHECK (chrome_kind IN (
    'tiktok','reels','youtube','netflix','desktop','crt','arcade','hologram',
    'comic','painting','mirror','radar','oscilloscope','thermal','xray',
    'instagram','facebook','tablet','phone','tv','projector','generic'
  )),
  aspect_ratio  text NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16','16:9','1:1','4:3','21:9')),
  -- Editorial ordering inside a category.
  sort_order    int NOT NULL DEFAULT 100,
  -- Whether this template is plausibly customizable with a user-supplied
  -- subject image (true for everything that has a clear "subject" — a
  -- dancer, a streamer, etc).
  accepts_subject bool NOT NULL DEFAULT true,
  -- Whether this template is plausibly customizable with a user-supplied
  -- source video (the "video inside the UI"). False for templates where
  -- the UI content is intrinsic to the prompt (e.g., terminal code rain).
  accepts_source_video bool NOT NULL DEFAULT true,
  -- Hero thumbnail (Unsplash etc. — replaced once we have a real render).
  thumbnail_url text,
  -- Display flags.
  is_featured   bool NOT NULL DEFAULT false,
  is_live       bool NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vfx_templates_cat   ON public.vfx_templates(category, sort_order) WHERE is_live;
CREATE INDEX IF NOT EXISTS idx_vfx_templates_live  ON public.vfx_templates(is_live, sort_order);

-- Anyone (including anon) can read live templates.
ALTER TABLE public.vfx_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "VFX templates public read" ON public.vfx_templates;
CREATE POLICY "VFX templates public read" ON public.vfx_templates FOR SELECT USING (is_live);

-- Admins can manage (slug-uniqueness enforced by the table).
DROP POLICY IF EXISTS "Admins manage VFX templates" ON public.vfx_templates;
CREATE POLICY "Admins manage VFX templates" ON public.vfx_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ════════════════════════════════════════════════════════════════════════
-- Seed 50 templates — across 5 categories of 10 each.
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO public.vfx_templates (slug, name, category, chrome_kind, aspect_ratio, sort_order, hook, pure_prompt, is_featured) VALUES
-- ── 1. Vertical UI Breaks (TikTok, Reels, Vertical) ──
('the-dancers-leap', 'The Dancer''s Leap', 'vertical_ui', 'tiktok', '9:16', 10,
 'Hip-hop leap shattering the phone glass into a real warehouse.',
 'A smartphone floating in mid-air displaying a vertical TikTok UI interface. A hip-hop dancer inside the video suddenly leaps forward, shattering the phone glass. The dancer lands flawlessly in a real-world gritty concrete warehouse space. Hyper-realistic, 8k resolution, volumetric shattering physics.', true),

('the-hypebeast-step-out', 'The Hypebeast Step-Out', 'vertical_ui', 'reels', '9:16', 20,
 'Streetwear influencer steps out of Reels into an urban alley.',
 'Wide shot of a vertical Instagram Reels interface. A streetwear influencer steps completely forward out of the digital video boundaries, foot first, transitioning smoothly from a digital filter aesthetic to photorealistic cinematic lighting in an urban alleyway.', false),

('the-chefs-feast-spill', 'The Chef''s Feast Spill', 'vertical_ui', 'tiktok', '9:16', 30,
 'Pasta spills out of the phone onto a real marble counter.',
 'Split-screen perspective shifting into 3D space. A gourmet chef on a TikTok interface tilts a steaming pan of pasta toward the camera; the food and the chef''s hands physically cross the phone border, spilling onto a real-world marble kitchen counter.', false),

('the-monster-jump-scare', 'The Monster Jump-Scare', 'vertical_ui', 'tiktok', '9:16', 40,
 'A creature rips out of the red TikTok sidebar.',
 'A vertical phone screen displaying a dark horror stream. Suddenly, a terrifying creature rips through the red TikTok UI sidebar overlay with sharp claws, breaking out of the phone screen into a dark, candle-lit room. High-contrast shadows, cinematic horror grading.', false),

('the-beauty-guru-runway', 'The Beauty Guru Runway', 'vertical_ui', 'tiktok', '9:16', 50,
 'TikTok hearts scatter like autumn leaves as a model walks out.',
 'A vertical mobile UI screen showing a fashion model. The model walks forward, the colorful TikTok heart and comment icons scatter away like physical autumn leaves as she gracefully steps into a real, high-fashion runway environment.', false),

('the-liquid-streamer-splash', 'The Liquid Streamer Splash', 'vertical_ui', 'tiktok', '9:16', 60,
 'A neon energy drink wave blasts out of a livestream.',
 'A live-stream vertical UI interface. A streamer cracks open a glowing neon energy drink, causing a giant tidal wave of colorful liquid to physically blast through the smartphone screen glass, drenching the real room in front of it.', false),

('the-cyberpunk-glitch', 'The Cyberpunk Glitch', 'vertical_ui', 'phone', '9:16', 70,
 'Voxels → flesh as a cyberpunk steps onto a wet Tokyo street.',
 'A vertical mobile app frame. A neon-clad cyberpunk character glitch-teleports through the screen interface, their body shifting from digital voxels to a fully rendered 3D human body as they step onto a wet, real-world Tokyo street.', false),

('the-anime-sword-slash', 'The Anime Sword Slash', 'vertical_ui', 'tiktok', '9:16', 80,
 'A katana slash splits the TikTok UI like fabric.',
 'An anime character on a phone screen draws a glowing katana. With one swift motion, they slash the digital borders of the TikTok UI. The screen splits open like fabric, and the character steps out into a real bamboo forest.', false),

('the-illusionist-reveal', 'The Illusionist Reveal', 'vertical_ui', 'phone', '9:16', 90,
 'Cards smash through the glass and the magician steps out.',
 'A vertical street magic video. The magician throws a deck of cards directly at the camera; the cards physically smash through the smartphone glass screen, scattering into the real-world frame as the magician steps out behind them.', false),

('the-kinetic-fitness-leap', 'The Kinetic Fitness Leap', 'vertical_ui', 'tiktok', '9:16', 100,
 'The progress bar snaps as the athlete lands on a real track.',
 'A vertical workout video UI. An athlete running on a treadmill accelerates, then sprints directly forward, breaking past the digital video progress bar which snaps like a rubber band as they land on a real-world athletic track.', false),

-- ── 2. Desktop UI Breaks (YouTube, Netflix, Desktop) ──
('the-gamers-rage-leap', 'The Gamer''s Rage Leap', 'desktop_ui', 'youtube', '16:9', 10,
 'Gamer dives headfirst out of the monitor.',
 'A wide 16:9 desktop PC monitor showing a chaotic esports stream with a YouTube progress bar. The frustrated gamer suddenly dives headfirst out of the monitor screen, landing directly onto a real wooden office floor. Debris and glowing pixels scatter everywhere.', true),

('the-news-anchor-desk-jump', 'The News Anchor Desk Jump', 'desktop_ui', 'tv', '16:9', 20,
 'Anchor climbs over the lower-third into the living room.',
 'A flat television screen showing a professional news broadcast. The news anchor suddenly climbs over the digital anchor desk, pushes past the lower-third graphic text layer, and steps down into a real, dimly lit living room.', false),

('the-asmr-hand-reach', 'The ASMR Hand Reach', 'desktop_ui', 'youtube', '16:9', 30,
 'ASMR arms physically reach out of the browser frame.',
 'A wide YouTube browser UI layout on a laptop. An ASMR creator reaches her hands directly toward the lens; her arms physically extend past the browser window frame into the real world, holding a physical microphone in the real room.', false),

('the-sci-fi-movie-breach', 'The Sci-Fi Movie Breach', 'desktop_ui', 'projector', '16:9', 40,
 'A cinematic astronaut drifts out of a home theater screen.',
 'A dark home theater room with a large projector screen playing a space sci-fi movie. A giant cinematic astronaut floating in zero-g slowly drifts completely forward, floating out of the movie screen frame into the real room''s air.', false),

('the-travel-vlogger-splash', 'The Travel Vlogger Splash', 'desktop_ui', 'youtube', '16:9', 50,
 'A wave bursts out of the laptop flooding the desk.',
 'A laptop sitting on a desk displaying a 4K beach travel video on YouTube. A massive ocean wave crashes inside the video frame, physically bursting out of the laptop screen, flooding the desk with real water, sand, and tropical seashells.', false),

('the-pop-star-stage-slide', 'The Pop Star Stage Slide', 'desktop_ui', 'youtube', '16:9', 60,
 'Singer slides off-stage through the YouTube border onto hardwood.',
 'A wide concert stream on a tablet. The lead singer slides across the digital stage on their knees, bursting right through the YouTube border frame and sliding across a real polished hardwood studio floor. Neon stage lights spill into reality.', false),

('the-tiger-pounce', 'The Tiger Pounce', 'desktop_ui', 'youtube', '16:9', 70,
 'A Bengal tiger pounces through the glass into a living room.',
 'A desktop monitor showing a nature documentary. A massive Bengal tiger locking eyes with the camera suddenly pounces forward, its massive paws shattering the glass screen as it transitions into a real modern living room layout.', false),

('the-deep-sea-diver-breach', 'The Deep-Sea Diver Breach', 'desktop_ui', 'tv', '16:9', 80,
 'Diver cracks through the TV bringing seawater into the carpet.',
 'A massive TV showing an underwater ocean scene. A scuba diver swims closer and closer until their helmet cracks through the glass panel. Water gushes out, and the diver steps onto the carpet, trailing sea foam.', false),

('the-matrix-code-developer', 'The Matrix Code Developer', 'desktop_ui', 'desktop', '16:9', 90,
 'A hand reaches out of the green code and pulls an agent through.',
 'A computer monitor displaying lines of green code. A hand reaches out from deep within the glowing digital text, physically gripping the plastic frame of the monitor and pulling a full cyberpunk agent into the real world office.', true),

('the-automotive-burnout', 'The Automotive Burnout', 'desktop_ui', 'desktop', '16:9', 100,
 'Tire smoke billows out of the laptop, filling the room with fog.',
 'A wide laptop screen showing a sports car race. A drift car spins out, its rear tires smoking aggressively; the thick white tire smoke physically billows out from the laptop screen, filling the real-world office space with fog.', false),

-- ── 3. Social Feeds & App Interface Breaks ──
('the-meme-rip-through', 'The Meme Rip-Through', 'social_feed', 'facebook', '16:9', 10,
 'A cartoon rips its own post box like paper and steps out.',
 'A massive digital Facebook newsfeed interface floating in a void. A funny viral cartoon character grabs the edges of its own image post box and physically rips the digital canvas open like paper, stepping out into a photorealistic real world scene.', false),

('the-wedding-album-walkout', 'The Wedding Album Walkout', 'social_feed', 'instagram', '1:1', 20,
 'Bride and groom step out of the Instagram grid onto grass.',
 'A smartphone displaying an Instagram photo carousel grid. A bride and groom inside one of the square photo frames suddenly start moving in slow motion, stepping out of the white border layout onto a real-world grassy garden floor.', false),

('the-pet-app-dog-bound', 'The Pet App Dog Bound', 'social_feed', 'tablet', '1:1', 30,
 'A puppy leaps out of the feed and lands as a real puppy.',
 'A tablet displaying an app feed full of pet videos. A golden retriever puppy running in one of the video boxes leaps high into the air, crossing the screen boundary flawlessly and landing as a real puppy on a living room rug.', false),

('the-food-photo-melt', 'The Food Photo Melt', 'social_feed', 'desktop', '16:9', 40,
 'Melted cheese droops over the digital UI onto the computer stand.',
 'A desktop screen showing a food blogging website. A macro video of melting cheese on a burger starts to physically droop over the digital UI container box, oozing down the front of the physical computer stand.', false),

('the-art-exhibition-breach', 'The Art Exhibition Breach', 'social_feed', 'tablet', '16:9', 50,
 'An oil portrait blinks and steps out into a modern gallery.',
 'An iPad displaying a digital painting app. A painted oil portrait of a historical figure blinks, becomes hyper-realistic, and physically reaches out of the canvas, stepping out into a modern art gallery room.', false),

('the-real-estate-virtual-tour', 'The Real Estate Virtual Tour', 'social_feed', 'tablet', '16:9', 60,
 'Viewer walks through the doorway into a real penthouse.',
 'A screen displaying a 360-degree real estate walkthrough app. The camera moves forward through a digital doorway, but instead of loading the next room, the viewer physically steps out of the screen layout into a real luxury penthouse mansion.', false),

('the-concert-stream-surge', 'The Concert Stream Surge', 'social_feed', 'phone', '9:16', 70,
 'Festival crowd spills over the phone notch onto a tabletop.',
 'A smartphone showing a crowded music festival live-stream. The cheering crowd surges forward, and the front row of festival-goers physically spills out over the phone''s notch and screen borders onto a real tabletop.', false),

('the-infographic-explosion', 'The Infographic Explosion', 'social_feed', 'desktop', '16:9', 80,
 'A 3D chart arrow breaks the browser and becomes a real neon prop.',
 'A clean corporate website with 3D charts and graphics. A dynamic 3D arrow on a data chart grows exponentially, breaks out of the web browser container, and transforms into a physical neon glass structural arrow floating in an office.', false),

('the-fitness-progress-leap', 'The Fitness Progress Leap', 'social_feed', 'phone', '9:16', 90,
 'GPS vector runner turns into a real human on asphalt.',
 'A mobile app showing a running route map interface. A stylized vector silhouette runner on the GPS map suddenly turns into a real human runner, breaking out of the screen tracking line onto a real asphalt road.', false),

('the-marketplace-shoe-drop', 'The Marketplace Shoe Drop', 'social_feed', 'tablet', '1:1', 100,
 'A 3D sneaker drops out of the e-commerce UI as a real shoe.',
 'A tablet showing an e-commerce shopping app with a rotating 3D shoe. The shoe suddenly stops rotating, drops completely out of the digital interface, and falls as a physical, real sneaker onto the floor below.', false),

-- ── 4. Sci-Fi / Holograms / Retro Monitor Breaks ──
('the-crt-ghost-walk', 'The CRT Ghost Walk', 'retro_holo', 'crt', '4:3', 10,
 'A retro figure walks through curved CRT glass.',
 'An old, flickering 1980s CRT television set with heavy static glitching. A retro-styled character slowly emerges through the thick, curved glass screen, their body shifting from analog scanlines to a solid, real-world physical form.', true),

('the-holographic-ai-assembly', 'The Holographic AI Assembly', 'retro_holo', 'hologram', '16:9', 20,
 'A holo shatters and a real android assistant steps out.',
 'A futuristic sci-fi desktop setup. A flat blue glowing hologram interface suddenly shatters like digital ice, and a hyper-realistic AI android assistant steps out of the light beam, standing solid on the metal floor.', false),

('the-arcade-cabinet-leap', 'The Arcade Cabinet Leap', 'retro_holo', 'arcade', '4:3', 30,
 'An 8-bit fighter shatters the glass and lands real.',
 'A neon retro 80s arcade cabinet machine playing an 8-bit fighting game. The pixelated main character pulls off a special move that shatters the arcade glass screen, instantly transforming into a photorealistic martial artist landing in the real arcade room.', false),

('the-surveillance-cam-fugitive', 'The Surveillance Cam Fugitive', 'retro_holo', 'desktop', '16:9', 40,
 'A suspect climbs forward through a single monitor in a wall of 9.',
 'A grid of 9 security monitor screens in a dark control room. A suspect in one of the black-and-white camera feeds turns, looks at the camera, and physically climbs forward through the specific monitor frame, dropping into the dark control room as a real person.', false),

('the-thermal-signature-leap', 'The Thermal Signature Leap', 'retro_holo', 'thermal', '16:9', 50,
 'A thermal silhouette jumps through and becomes a real operator.',
 'A high-tech monitor showing bright orange and blue thermal camera imaging. A glowing thermal silhouette jumps forward towards the glass screen, instantly turning into a fully clothed, photorealistic tactical operative as they break into the real room.', false),

('the-oscilloscope-waveform-fracture', 'The Oscilloscope Waveform Fracture', 'retro_holo', 'oscilloscope', '16:9', 60,
 'A green waveform spikes out as a glowing neon wire.',
 'A laboratory oscilloscope screen with a bright green laser audio waveform. The sound wave spikes violently, physically ripping through the screen like a glowing neon wire, wrapping around real machinery in the room.', false),

('the-flight-simulator-takeoff', 'The Flight Simulator Takeoff', 'retro_holo', 'desktop', '16:9', 70,
 'The jet nose punches through bringing wind and clouds.',
 'A multi-monitor curved flight simulator cockpit setup. The digital fighter jet on the screen accelerates so fast that the nose cone of the plane physically punches through the center monitor, bringing real wind and volumetric clouds into the room.', false),

('the-matrix-digital-drop', 'The Matrix Digital Drop', 'retro_holo', 'desktop', '16:9', 80,
 'An avatar walks out wearing falling code like rain.',
 'A terminal screen raining vertical green code. A digital avatar inside the screen walks forward; the falling code sticks to their body like real rain as they step out of the terminal into a dark cyber-lab.', false),

('the-radar-screen-sonar-ping', 'The Radar Screen Sonar Ping', 'retro_holo', 'radar', '1:1', 90,
 'A periscope rises out of a glowing green radar.',
 'A glowing green naval radar display screen. A physical submarine periscope breaks through the glass interface, rising up out of the liquid-like screen surface into an office room.', false),

('the-x-ray-reveal', 'The X-Ray Reveal', 'retro_holo', 'xray', '16:9', 100,
 'A skeletal hand reaches out and grows skin in real light.',
 'A medical lightbox showing a skeletal X-ray video. The skeleton suddenly reaches its hand forward, breaking through the plastic film; as the hand enters the room''s warm lighting, it instantly grows realistic skin and muscle.', false),

-- ── 5. Artistic, Surreal & Cinematic Crossings ──
('the-comic-book-inking', 'The Comic Book Inking', 'surreal', 'comic', '16:9', 10,
 'A black-and-white panel hero pulls themselves into 3D color.',
 'A flat, black-and-white comic book page lying on a desk. A dynamic superhero sketch in one of the panels begins to move, breaks through the panel borders, and pulls itself up into a fully rendered, colorful, 3D photorealistic human hero standing on the desk.', true),

('the-oil-painting-splash', 'The Oil Painting Splash', 'surreal', 'painting', '16:9', 20,
 'Painted waves splash wet oil paint onto the gallery floor.',
 'A classic golden framed oil painting of a stormy ocean hanging on a gallery wall. The textured painted waves suddenly begin to move dynamically, splashing thick, colorful wet oil paint out of the frame and onto the polished gallery floor.', false),

('the-silhouette-shadow-tear', 'The Silhouette Shadow Tear', 'surreal', 'projector', '16:9', 30,
 'A shadow puppet rips the projection screen open.',
 'A bright white projection screen showing a dark shadow puppet silhouette. The shadow figure suddenly reaches forward and rips the physical white fabric of the screen open, stepping through the tear as a fully detailed, photorealistic person.', false),

('the-origami-unfolding', 'The Origami Unfolding', 'surreal', 'desktop', '16:9', 40,
 'A digital paper bird turns into a real flying origami.',
 'A laptop display showing a 3D animation of paper folding. The digital paper bird flies toward the edge of the web browser, physically turning into a real, physical paper origami bird that flies around the real laptop user''s room.', false),

('the-golden-liquid-statue', 'The Golden Liquid Statue', 'surreal', 'tablet', '16:9', 50,
 'A liquid gold statue drips out and hardens on the desk.',
 'A sleek tablet displaying a modern gold aesthetic video loop. A liquid gold statue inside the video leans forward; the liquid gold drips over the screen bezel, pooling onto a real desktop and hardening into a solid physical sculpture.', false),

('the-tornado-vortex', 'The Tornado Vortex', 'surreal', 'desktop', '16:9', 60,
 'A funnel cloud spins out of the screen pulling papers in.',
 'A wide computer monitor displaying a chaotic weather storm video. A miniature, powerful funnel cloud vortex spins out of the screen center, pulling real papers and lightweight office objects on the desk into its spinning air currents.', false),

('the-lightning-arc', 'The Lightning Arc', 'surreal', 'tv', '16:9', 70,
 'A purple lightning bolt shatters the TV and arcs across the room.',
 'A high-end TV displaying a slow-motion lightning storm. A massive bolt of electricity arcs directly at the camera, shattering the screen panel and shooting a real, crackling purple plasma arc across the room to ground out on a metal desk lamp.', false),

('the-ink-blot-expansion', 'The Ink Blot Expansion', 'surreal', 'phone', '9:16', 80,
 'Black ink leaks past the phone screen across a real table.',
 'A mobile screen showing an abstract ink bleeding video. The black ink hits the edge of the phone screen, physically leaking over the edge like liquid tar, creeping across a real-world wood table texture in real-time.', false),

('the-mirror-image-reverse', 'The Mirror-Image Reverse', 'surreal', 'mirror', '9:16', 90,
 'A smart-mirror reflection breaks the glass and steps out.',
 'A large wall mirror displaying a digital UI overlay like a smart mirror app. The digital reflection of a person suddenly stops mirroring the user, cracks the glass from the inside, and steps out of the mirror into the physical bathroom space.', false),

('the-vintage-photograph-step', 'The Vintage Photograph Step', 'surreal', 'tablet', '16:9', 100,
 'A sepia figure walks out of a vintage photo gaining color.',
 'A sepia-toned vintage photo layout on a modern tablet screen. The historical figure inside the antique photo begins to walk in smooth slow motion, stepping out of the faded sepia borders and gaining full modern color and realism as they land on a modern office floor.', false)
ON CONFLICT (slug) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- RPC — single-roundtrip "browse by category" with optional search.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.crossover_browse(
  p_category text DEFAULT NULL,
  p_query    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t.*) ORDER BY t.sort_order ASC), '[]'::jsonb)
  FROM (
    SELECT id, slug, name, category, pure_prompt, hook, chrome_kind, aspect_ratio,
           accepts_subject, accepts_source_video, thumbnail_url, is_featured, sort_order
    FROM public.vfx_templates
    WHERE is_live
      AND (p_category IS NULL OR category = p_category)
      AND (p_query IS NULL OR length(trim(p_query)) = 0
           OR name ILIKE '%' || p_query || '%'
           OR hook ILIKE '%' || p_query || '%'
           OR pure_prompt ILIKE '%' || p_query || '%')
    ORDER BY is_featured DESC, sort_order ASC
  ) t;
$$;
REVOKE EXECUTE ON FUNCTION public.crossover_browse(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.crossover_browse(text, text) TO anon, authenticated;
