-- ════════════════════════════════════════════════════════════════════════
-- Crossover VFX upgrade — turn the 50 templates into "ultra-real"
-- productions by attaching to each:
--   • An expanded, camera/lens/lighting-detailed prompt.
--   • A negative prompt to reject artifacts the AI tends to make.
--   • A recipe slug that selects the Python VFX pipeline branch
--     (glass shatter, water breach, paint pour, smoke billow, neon zap,
--     rip-tear, leap-landing, etc.) — each recipe drives real physics
--     (Voronoi tessellation, particle systems, liquid sim) on top of the
--     diffusion output.
--   • Per-template audio cues (SFX library tag + music genre).
--   • A color-grade LUT slug (ACES / OCIO workflow).
--   • A render quality target (resolution, fps, interpolation, upscale).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Add the new columns ──────────────────────────────────────────────
ALTER TABLE public.vfx_templates
  ADD COLUMN IF NOT EXISTS negative_prompt   text,
  ADD COLUMN IF NOT EXISTS recipe_slug       text,                       -- VFX recipe selector
  ADD COLUMN IF NOT EXISTS motion_hint       text,                       -- AnimateDiff / motion module hint
  ADD COLUMN IF NOT EXISTS preferred_model   text DEFAULT 'cogvideox-5b' -- diffusion model preference
    CHECK (preferred_model IN ('hunyuan','cogvideox-5b','ltx-video','wan22','mochi','svd-img2vid')),
  ADD COLUMN IF NOT EXISTS sfx_tags          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS music_genre       text,
  ADD COLUMN IF NOT EXISTS color_lut         text DEFAULT 'aces-default',
  ADD COLUMN IF NOT EXISTS target_fps        int  NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS target_height     int  NOT NULL DEFAULT 1920,
  ADD COLUMN IF NOT EXISTS upscale_factor    int  NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS interpolate       bool NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS depth_compositing bool NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS subject_id_method text
    CHECK (subject_id_method IS NULL OR subject_id_method IN ('pulid','instantid','ip-adapter','none')),
  ADD COLUMN IF NOT EXISTS particle_density  int  NOT NULL DEFAULT 220,
  ADD COLUMN IF NOT EXISTS prompt_version    int  NOT NULL DEFAULT 1;

-- ── 2. Upgrade the prompts + attach recipes / audio / LUTs ──────────────
-- Single transaction so we don't end up half-upgraded if anything throws.
DO $$
BEGIN

-- Camera / lens / film-grain boilerplate appended to every prompt to nudge
-- the diffusion model toward cinematic realism. Tweaked per category.
-- ── 1. VERTICAL UI BREAKS ──
UPDATE public.vfx_templates SET
  pure_prompt = 'Cinematic 35mm anamorphic shot on a Panavision Millennium DXL. A smartphone floats mid-air against deep matte-black void, the vertical TikTok UI illuminated edge-to-edge. A hip-hop dancer inside the feed pops to the beat, then explodes forward with a perfectly timed leap — the phone glass shatters into thousands of Voronoi-tessellated shards that catch volumetric rim-light. The dancer lands flawlessly in a gritty concrete warehouse, dust kicks up around their sneakers, cinematic depth of field, 24fps motion blur, 8K detail, hyper-realistic skin micro-details, anamorphic lens flares.',
  negative_prompt = 'cartoon, drawing, 3D render, blurry, low resolution, deformed, mutated, extra limbs, plastic skin, oversaturated, watermark, text overlay, low fps, choppy motion',
  recipe_slug = 'glass_shatter', motion_hint = 'tilt-shift_leap', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['glass_break_thick','hip_hop_kick','sneaker_scuff','warehouse_reverb'],
  music_genre = 'trap_breaks', color_lut = 'urban_concrete',
  particle_density = 380, subject_id_method = 'pulid'
WHERE slug = 'the-dancers-leap';

UPDATE public.vfx_templates SET
  pure_prompt = 'Cinematic 50mm spherical lens. Wide vertical Instagram Reels interface fills the frame, neon-saturated digital filter aesthetic. A streetwear influencer (oversized jacket, chunky sneakers, gold chain) takes a confident step forward; their leading foot crosses the digital boundary, instantly transitioning from flat compressed filter look to photorealistic cinematic key lighting. Behind them the alley walls are graffiti-covered, real puddles reflect orange sodium lamps. Soft anamorphic flares, deep film grain, 8K texture, true-to-life motion physics on the jacket.',
  negative_prompt = 'cartoon, animation, low quality, blurry, fake plastic skin, watermark, distorted face, missing limbs',
  recipe_slug = 'frame_dissolve', motion_hint = 'forward_step', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['filter_whoosh','street_ambient','sneaker_step_wet','sodium_hum'],
  music_genre = 'lo_fi_streetwear', color_lut = 'sodium_alley',
  subject_id_method = 'pulid'
WHERE slug = 'the-hypebeast-step-out';

UPDATE public.vfx_templates SET
  pure_prompt = 'Split-screen camera move: starting on a flat vertical TikTok cooking video, the lens dolly-pushes through Z-space as the perspective transitions to fully spatial 3D. A gourmet chef tilts a steaming copper pan of fresh pasta — the food carries inertia, hands cross the phone bezel, and gravity flips to real-world physics: tomato sauce splashes onto a real Carrara-marble kitchen counter with accurate fluid dynamics, steam rises in volumetric haze. 35mm cinematic look, shallow depth of field locked on the splash.',
  negative_prompt = 'low quality, blurry, distorted hands, plastic food, cartoon, watermark',
  recipe_slug = 'paint_pour', motion_hint = 'spill_volumetric', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['sauce_splash','marble_clatter','steam_hiss','kitchen_ambient'],
  music_genre = 'soft_jazz', color_lut = 'warm_kitchen',
  particle_density = 600
WHERE slug = 'the-chefs-feast-spill';

UPDATE public.vfx_templates SET
  pure_prompt = 'Horror-cinematography 35mm, low-key candlelight. A dark vertical TikTok horror stream interface glows on a phone. Suddenly, razor-sharp obsidian claws rip through the red TikTok UI sidebar, splitting the screen like wet flesh. A nightmare creature pulls itself out — high-frequency skin micro-detail, glistening eyes catching the candle flames, slow drips of black ichor. The creature steps into a real candle-lit Victorian room, shadows stretch unnaturally. Brutal contrast, deep blacks, single hot key light.',
  negative_prompt = 'cartoon, comic art, low resolution, blurry, friendly, cute, watermark, low contrast',
  recipe_slug = 'rip_tear', motion_hint = 'predatory_emerge', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['claw_rip_screen','low_growl_subwoofer','candle_flicker','heartbeat'],
  music_genre = 'horror_drone', color_lut = 'candle_noir',
  particle_density = 280
WHERE slug = 'the-monster-jump-scare';

UPDATE public.vfx_templates SET
  pure_prompt = 'High-fashion editorial lighting. A vertical mobile UI screen shows a fashion model in slow walk. As she steps forward, every TikTok heart and comment icon in the right rail transforms into physical, photoreal autumn leaves with accurate translucency and curling edges, scattering in a gentle wind. She crosses the screen boundary onto a real haute-couture runway: polished black floor with rim-light reflection, dramatic side-lighting, soft volumetric haze, model''s gown catches the breeze with cloth simulation accuracy. Vogue cover quality.',
  negative_prompt = 'low quality, blurry, plastic skin, distorted features, watermark, amateur lighting',
  recipe_slug = 'leap_landing', motion_hint = 'graceful_walk', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['leaves_rustle','runway_clicks','camera_flashes','wind_subtle'],
  music_genre = 'cinematic_string', color_lut = 'editorial_high_fashion',
  particle_density = 140, subject_id_method = 'pulid'
WHERE slug = 'the-beauty-guru-runway';

UPDATE public.vfx_templates SET
  pure_prompt = 'Cinematic 35mm, neon-saturated palette. A live-stream vertical TikTok UI. A streamer cracks open a chrome-lidded energy drink can — a giant tidal wave of glowing electric-blue and magenta liquid erupts through the phone glass with accurate fluid dynamics (SPH simulation grade). The liquid carries momentum forward, drenching a real-world room: water beads roll across a wooden floor, glass shards float on the surface, reflective bokeh dances across wet surfaces.',
  negative_prompt = 'cartoon, low quality, low fps, distorted, watermark, fake-looking water',
  recipe_slug = 'water_breach', motion_hint = 'tidal_burst', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['can_pop_loud','liquid_wave_crash','glass_shatter','floor_splash'],
  music_genre = 'edm_high_energy', color_lut = 'neon_cyber',
  particle_density = 900
WHERE slug = 'the-liquid-streamer-splash';

UPDATE public.vfx_templates SET
  pure_prompt = 'Cyberpunk neon nightscape. A vertical mobile app frame in a hand. A character in iridescent neon jacket and mirror-visor helmet begins to glitch — their body resolves from low-poly voxels through SDF distortion artifacts into a fully rendered photorealistic human. RGB chromatic aberration peaks at the transition. They step out onto a rain-slick Tokyo street: reflective puddles double the neon signs above, shop holograms flicker, accurate scene-referred reflectance.',
  negative_prompt = 'cartoon, anime style, low quality, watermark, distorted face',
  recipe_slug = 'neon_zap', motion_hint = 'glitch_resolve', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['glitch_static','synth_zap','rain_ambient','neon_buzz'],
  music_genre = 'synthwave_dark', color_lut = 'tokyo_neon_rain',
  particle_density = 320, subject_id_method = 'ip-adapter'
WHERE slug = 'the-cyberpunk-glitch';

UPDATE public.vfx_templates SET
  pure_prompt = 'Studio Ghibli-meets-photoreal lens. An anime character on a vertical phone screen draws a glowing katana. With one perfectly timed strike — frame-precision impact — the digital TikTok UI splits like silk fabric, revealing the seam between worlds. The character (anime-stylized but with photoreal lighting and skin micro-detail) steps through into a real bamboo forest: dappled morning sunlight, accurate volumetric god rays, real bamboo plant motion in the wind.',
  negative_prompt = 'low quality, distorted face, low resolution, watermark, low contrast',
  recipe_slug = 'rip_tear', motion_hint = 'sword_slash_precision', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['katana_unsheathe','fabric_tear_silk','bamboo_creak','forest_ambient'],
  music_genre = 'ambient_japanese', color_lut = 'forest_morning',
  particle_density = 200, subject_id_method = 'pulid'
WHERE slug = 'the-anime-sword-slash';

UPDATE public.vfx_templates SET
  pure_prompt = 'Street magic documentary cinematography, handheld 35mm. A vertical phone shows a magician in close-up. They throw a deck of playing cards directly at the lens — the cards physically smash through the glass with accurate impact physics (each card a rigid body), shards of glass and printed card backs scatter forward in slow-motion. The magician steps out behind the swarm of cards into the real-world frame: cobblestone street, late evening blue-hour light, breath visible in cold air.',
  negative_prompt = 'cartoon, low quality, blurry, fake-looking, watermark, plastic skin',
  recipe_slug = 'glass_shatter', motion_hint = 'card_throw', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['card_shuffle_throw','glass_shatter_thin','footsteps_cobble','breath_cold'],
  music_genre = 'street_magic_orchestra', color_lut = 'blue_hour_street',
  particle_density = 540, subject_id_method = 'pulid'
WHERE slug = 'the-illusionist-reveal';

UPDATE public.vfx_templates SET
  pure_prompt = 'Sports cinematography, high-key daylight. A vertical workout video UI fills the phone. An athlete on a treadmill accelerates frame by frame — the digital video progress bar tenses like a stretched red rubber band, hyper-extending until it snaps with elastic recoil. The athlete bursts through and lands on a real polished athletic track: tartan red surface, accurate sweat micro-detail, slow-motion impact ripples through the calf muscles. 4K detail, professional sports photography vibe.',
  negative_prompt = 'cartoon, low quality, low contrast, distorted body, watermark',
  recipe_slug = 'leap_landing', motion_hint = 'sprint_finish_lunge', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['rubber_band_snap','sneaker_landing','heartbeat_high','stadium_crowd'],
  music_genre = 'epic_workout', color_lut = 'sports_hdr',
  particle_density = 180, subject_id_method = 'pulid'
WHERE slug = 'the-kinetic-fitness-leap';

-- ── 2. DESKTOP UI BREAKS ──
UPDATE public.vfx_templates SET
  pure_prompt = 'Sweaty esports gaming cinematography — Twitch documentary aesthetic. Wide 16:9 desktop monitor: chaotic esports stream with a YouTube progress bar overlay, RGB chassis lighting reflected on a high-refresh-rate panel. A frustrated gamer in a hoodie suddenly dives headfirst out of the monitor screen — the LCD panel cracks into Voronoi shards, glowing pixels scatter through the air like 60Hz embers, debris of plastic bezel pieces tumble in slow motion. They land hard on a real wooden office floor: scattered chips, controller cable, the kind of slightly cluttered real desk setup.',
  negative_prompt = 'cartoon, low quality, blurry, distorted, friendly, watermark',
  recipe_slug = 'glass_shatter', motion_hint = 'dive_forward_panic', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['monitor_crack','pixel_glitch','wood_floor_slam','rage_breath'],
  music_genre = 'gamer_dubstep_drop', color_lut = 'rgb_setup_gaming',
  particle_density = 460, subject_id_method = 'pulid'
WHERE slug = 'the-gamers-rage-leap';

UPDATE public.vfx_templates SET
  pure_prompt = 'Broadcast television cinematography. A flat television screen shows a polished news broadcast — three-camera setup look, lower-third graphic floating mid-frame with breaking-news ticker. The anchor (slick suit, perfectly groomed) climbs over the digital anchor desk, pushes through the floating lower-third like it''s a physical pane of glass that shatters into red-and-white shards, then steps down into a real dimly lit living room — leather couch, table lamp, hardwood floor. The transition from broadcast key lighting to warm tungsten room lighting is dramatic.',
  negative_prompt = 'cartoon, low quality, blurry, distorted, watermark',
  recipe_slug = 'glass_shatter', motion_hint = 'climb_over', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['glass_thin_break','tv_news_jingle_chop','footsteps_hardwood','table_lamp_hum'],
  music_genre = 'news_to_lounge', color_lut = 'broadcast_to_warm',
  particle_density = 260
WHERE slug = 'the-news-anchor-desk-jump';

UPDATE public.vfx_templates SET
  pure_prompt = 'Soft warm ASMR documentary aesthetic — macro 100mm lens, shallow depth of field. A wide YouTube browser UI on a laptop. An ASMR creator reaches both hands directly toward the lens; her arms physically extend past the browser window frame in 3D — accurate skin sub-surface scattering, fingernails catch the lighting — holding a real shock-mount microphone in the real desk space. The transition from compressed video to real spatial light is subtle but unmistakable.',
  negative_prompt = 'low quality, distorted hands, fake-looking, watermark, plastic skin',
  recipe_slug = 'frame_dissolve', motion_hint = 'hand_reach_3d', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['hand_reach_whoosh','mic_handling','breath_close_asmr'],
  music_genre = 'asmr_calm', color_lut = 'warm_macro',
  particle_density = 60, subject_id_method = 'pulid'
WHERE slug = 'the-asmr-hand-reach';

UPDATE public.vfx_templates SET
  pure_prompt = 'Premium home-cinema vibe, 70mm IMAX feel. A dark home theater room with a massive projector screen playing an epic space sci-fi movie. A photoreal astronaut in detailed spacesuit (accurate fabric folds, helmet visor reflection, mission patches) floats forward in zero-g, drifting through the projection beam into the real room''s air. Volumetric haze from the projector beam wraps their body. The astronaut''s tether dangles realistically. Behind them: the empty leather cinema seats.',
  negative_prompt = 'cartoon, low quality, distorted, fake-looking suit, watermark',
  recipe_slug = 'frame_dissolve', motion_hint = 'zero_g_drift', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['spacesuit_radio_static','projector_hum','suit_thrusters_subtle'],
  music_genre = 'cosmic_orchestra', color_lut = 'imax_deepspace',
  particle_density = 120
WHERE slug = 'the-sci-fi-movie-breach';

UPDATE public.vfx_templates SET
  pure_prompt = 'Tropical travel documentary cinematography, 35mm. A laptop sitting on a wooden desk displays a 4K beach travel video on YouTube. A massive turquoise ocean wave crashes inside the video frame — the wave physically bursts out of the laptop screen with photoreal fluid dynamics (SPH simulation), water splashes across the desk, sand grains scatter, tropical seashells tumble out. Volumetric mist hangs in the air. The transition from compressed video to real water is seamless.',
  negative_prompt = 'cartoon, low quality, fake water, watermark, low contrast',
  recipe_slug = 'water_breach', motion_hint = 'wave_breach', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['ocean_wave_crash','laptop_screen_break','seashell_clack','seagull_distant'],
  music_genre = 'tropical_breeze', color_lut = 'tropical_hdr',
  particle_density = 950
WHERE slug = 'the-travel-vlogger-splash';

UPDATE public.vfx_templates SET
  pure_prompt = 'Concert documentary cinematography. A wide concert stream on a tablet on a music studio table. The lead singer (sweat, stage makeup, accurate skin micro-detail) slides forward on their knees across the digital stage, bursting through the YouTube border frame which crackles like neon glass. They land sliding across a real polished hardwood studio floor — boots leave smudge marks, neon stage lights spill into reality and reflect on the polished wood, smoke machines pump volumetric haze.',
  negative_prompt = 'cartoon, low quality, distorted, watermark',
  recipe_slug = 'rip_tear', motion_hint = 'knee_slide', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['neon_zap','wood_slide','crowd_roar','mic_feedback'],
  music_genre = 'pop_anthem_chorus', color_lut = 'concert_neon',
  particle_density = 380, subject_id_method = 'pulid'
WHERE slug = 'the-pop-star-stage-slide';

UPDATE public.vfx_templates SET
  pure_prompt = 'BBC Nature Documentary cinematography. A desktop monitor shows a nature documentary in 8K. A massive Bengal tiger (accurate fur shader, stripe variation, breath visible) locks predatory eye contact with the camera. Without warning, it pounces forward — paws and full body burst through the LCD with photoreal weight and momentum. The screen panel cracks into geometric shards. The tiger lands in a real modern living room: hardwood floor, modern sofa, accurate paw imprint shadow.',
  negative_prompt = 'cartoon, low quality, distorted, cute, watermark',
  recipe_slug = 'glass_shatter', motion_hint = 'predator_pounce', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['tiger_roar_deep','glass_shatter_panel','paw_landing_heavy','heartbeat_low'],
  music_genre = 'documentary_tension', color_lut = 'natural_documentary',
  particle_density = 520
WHERE slug = 'the-tiger-pounce';

UPDATE public.vfx_templates SET
  pure_prompt = 'Underwater documentary cinematography. A massive TV in a modern living room shows a deep-ocean dive scene. A scuba diver in detailed gear (accurate wetsuit, regulator, dive computer) swims closer until their dome-port helmet cracks through the TV glass panel with realistic impact physics. Saltwater gushes out in a thick volumetric column, carrying bubbles, sea-foam, and a few small fish. The diver steps onto soft beige carpet — wet boot prints trail behind them, sea-foam catches at their fins.',
  negative_prompt = 'cartoon, low quality, fake water, watermark',
  recipe_slug = 'water_breach', motion_hint = 'underwater_emerge', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['underwater_bubbles','regulator_breath','glass_thick_break','carpet_squish'],
  music_genre = 'oceanic_ambient', color_lut = 'underwater_to_warm',
  particle_density = 880
WHERE slug = 'the-deep-sea-diver-breach';

UPDATE public.vfx_templates SET
  pure_prompt = 'Matrix-inspired cinematography, green-tinged digital aesthetic. A computer monitor displays lines of falling green code on jet black. A pale hand reaches out from deep within the glowing katakana stream — fingers individually distinct, the hand transitions from glowing emerald digital glyphs to fully photoreal skin with accurate sub-surface scattering. The hand grips the plastic frame of the monitor and pulls a full cyberpunk agent (long black trench coat, sunglasses, slick hair) into the real office space — accurate cloth physics on the coat.',
  negative_prompt = 'low quality, cartoon, fake-looking, watermark, distorted hand',
  recipe_slug = 'neon_zap', motion_hint = 'hand_emerge_grip', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['matrix_code_whisper','electric_hum','coat_swoosh','heel_concrete'],
  music_genre = 'cyber_industrial', color_lut = 'matrix_green',
  particle_density = 420, subject_id_method = 'pulid'
WHERE slug = 'the-matrix-code-developer';

UPDATE public.vfx_templates SET
  pure_prompt = 'Motorsport cinematography, high-speed shutter. A wide laptop screen plays a sports car drift race. A bright orange drift car spins out, rear tires lit with friction sparks, thick white tire smoke billowing aggressively. The smoke physically billows out of the laptop screen with volumetric simulation — accurate density, swirling turbulence, occluding the office furniture as it fills the real-world space. Slow motion. Fluorescent office lighting visible through the smoke.',
  negative_prompt = 'cartoon, low quality, blurry, watermark, fake smoke',
  recipe_slug = 'smoke_billow', motion_hint = 'volumetric_release', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['tire_screech','engine_roar','smoke_woosh','office_fan_subtle'],
  music_genre = 'racing_orchestral', color_lut = 'orange_smoke',
  particle_density = 1000
WHERE slug = 'the-automotive-burnout';

-- ── 3. SOCIAL FEED BREAKS ──
UPDATE public.vfx_templates SET
  pure_prompt = 'Surrealist cinematography, infinite blue void with subtle volumetric lighting. A massive digital Facebook newsfeed interface floats in a void, scrolling slowly. A vibrant cartoon character (3D Pixar-quality, expressive face) grabs the edges of its own image post box and physically rips the digital canvas like wet paper — accurate paper-tear simulation, edges curl, fibres visible. They step out into a photorealistic real-world scene: a real city sidewalk, accurate ambient occlusion, perfect contact shadows. The transition between art styles is fluid.',
  negative_prompt = 'low quality, blurry, watermark, distorted',
  recipe_slug = 'rip_tear', motion_hint = 'paper_rip_emerge', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['paper_tear_wet','sidewalk_ambient','character_grunt'],
  music_genre = 'whimsical_orchestra', color_lut = 'pixar_to_real',
  particle_density = 240
WHERE slug = 'the-meme-rip-through';

UPDATE public.vfx_templates SET
  pure_prompt = 'Romantic wedding cinematography, golden hour lighting. A smartphone displaying an Instagram carousel of polaroid-style wedding photos. The couple inside one of the square frames suddenly moves in slow motion — they step out of the white border layout, transitioning from compressed Instagram filter look to real photorealistic flesh and fabric. The bride''s dress catches the breeze with accurate cloth physics, the groom''s tie fluttering. They land on a real grassy garden floor: dew on the grass, accurate soft shadows, distant garden fairy lights bokeh.',
  negative_prompt = 'low quality, distorted face, watermark, plastic skin',
  recipe_slug = 'frame_dissolve', motion_hint = 'walk_forward_dignified', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['cloth_swish','grass_step_soft','distant_celebration','wind_whisper'],
  music_genre = 'wedding_strings', color_lut = 'golden_hour_garden',
  particle_density = 100, subject_id_method = 'pulid'
WHERE slug = 'the-wedding-album-walkout';

UPDATE public.vfx_templates SET
  pure_prompt = 'Hallmark commercial cinematography, warm bright daylight. A tablet displaying a grid of pet videos. A golden retriever puppy in one of the video boxes leaps high into the air with photoreal fur dynamics (accurate fur shader, follicle direction, gentle ear flop). The puppy crosses the screen boundary seamlessly, landing as a real living puppy on a plush living room rug — paws make subtle indentations, fur catches sunlight, tongue lolls out happily.',
  negative_prompt = 'cartoon, low quality, fake fur, watermark, scary',
  recipe_slug = 'leap_landing', motion_hint = 'puppy_bound_joy', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['puppy_yip','paws_thud','rug_squish','happy_panting'],
  music_genre = 'cute_acoustic', color_lut = 'warm_living_room',
  particle_density = 80
WHERE slug = 'the-pet-app-dog-bound';

UPDATE public.vfx_templates SET
  pure_prompt = 'Macro food cinematography. A desktop screen shows a food blogging website with a hero shot of a perfect cheeseburger. A macro video of melted cheese on top of the patty starts to physically droop over the digital UI container box — accurate viscous fluid simulation, the cheese pulls into long strands with surface tension, drips down the front of the physical computer stand and pools on the wooden desk. Slow-motion realism.',
  negative_prompt = 'cartoon, low quality, fake cheese, watermark',
  recipe_slug = 'paint_pour', motion_hint = 'viscous_drip', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['cheese_stretch','soft_drip','desk_creak'],
  music_genre = 'sensual_jazz', color_lut = 'food_warm_appetite',
  particle_density = 180
WHERE slug = 'the-food-photo-melt';

UPDATE public.vfx_templates SET
  pure_prompt = 'Museum documentary cinematography. An iPad displaying a digital painting app showing an oil portrait of a Victorian gentleman. The portrait blinks — face transitions from oil-paint brushstrokes to hyper-realistic skin, beard hair individually detailed. He reaches out of the canvas with arm extended in 3D, lifts himself out, and steps into a modern white-walled art gallery room — polished concrete floor, recessed lighting, accurate hard shadows.',
  negative_prompt = 'low quality, distorted face, cartoon, watermark',
  recipe_slug = 'frame_dissolve', motion_hint = 'portrait_emerge', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['canvas_creak','footstep_polished_concrete','distant_gallery_chatter'],
  music_genre = 'classical_string_quartet', color_lut = 'oil_paint_to_real',
  particle_density = 60, subject_id_method = 'pulid'
WHERE slug = 'the-art-exhibition-breach';

UPDATE public.vfx_templates SET
  pure_prompt = 'Real-estate luxury cinematography. A screen displaying a 360-degree virtual real-estate walkthrough app. The camera moves forward through a digital doorway — but instead of loading the next room, the perspective inverts: the viewer physically steps out of the digital frame into a real luxury penthouse interior. Floor-to-ceiling windows reveal sunset cityscape, marble floors with mirror-perfect reflections, recessed amber lighting, plush velvet armchair in foreground.',
  negative_prompt = 'low quality, distorted, fake-looking, watermark',
  recipe_slug = 'frame_dissolve', motion_hint = 'first_person_step', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['heel_marble_step','city_distant_ambient','wind_high_floor'],
  music_genre = 'luxury_jazz', color_lut = 'penthouse_sunset',
  particle_density = 90
WHERE slug = 'the-real-estate-virtual-tour';

UPDATE public.vfx_templates SET
  pure_prompt = 'Concert documentary cinematography, handheld. A smartphone shows a crowded music festival live-stream from front-stage. The cheering crowd surges forward; the front row festival-goers physically spill out over the phone''s notch and screen borders — accurate body weight, fabric of t-shirts and bandanas, dust kicked up — onto a real wooden tabletop. Slow motion. Stage lights in the background pulse.',
  negative_prompt = 'low quality, cartoon, watermark, distorted',
  recipe_slug = 'leap_landing', motion_hint = 'crowd_surge', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['crowd_roar_close','footsteps_table','distant_drop'],
  music_genre = 'festival_dance', color_lut = 'festival_purple_haze',
  particle_density = 600
WHERE slug = 'the-concert-stream-surge';

UPDATE public.vfx_templates SET
  pure_prompt = 'Corporate motion-graphics cinematography. A clean corporate website on a desktop with 3D charts. A dynamic 3D arrow on a data chart grows exponentially, breaks out of the web browser container with accurate panel-shatter physics, then transforms in mid-air into a physical neon-glass structural arrow with internal LED accents — accurate glass refraction, internal light bloom. It floats in a sleek modern office space with polished concrete floor.',
  negative_prompt = 'low quality, cartoon, watermark, distorted',
  recipe_slug = 'neon_zap', motion_hint = 'chart_explode_form', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['glass_grow','neon_hum_bright','office_ambient'],
  music_genre = 'corporate_uplifting', color_lut = 'corporate_clean',
  particle_density = 320
WHERE slug = 'the-infographic-explosion';

UPDATE public.vfx_templates SET
  pure_prompt = 'Sports cinematography, golden hour. A mobile app shows a running route map interface. A stylized vector silhouette runner on the GPS map suddenly inflates with volume, transforms into a real photoreal human runner mid-stride — accurate skin micro-detail, sweat, muscle definition. They break out of the screen tracking line onto a real asphalt road: long shadow, golden hour rim light, accurate motion blur on the limbs.',
  negative_prompt = 'cartoon, low quality, watermark, distorted',
  recipe_slug = 'leap_landing', motion_hint = 'sprint_emerge', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['footsteps_asphalt','breath_running','breeze_evening'],
  music_genre = 'epic_running', color_lut = 'golden_hour_sport',
  particle_density = 120, subject_id_method = 'pulid'
WHERE slug = 'the-fitness-progress-leap';

UPDATE public.vfx_templates SET
  pure_prompt = 'Premium e-commerce product cinematography. A tablet shows an e-commerce shopping app with a rotating 3D sneaker on a turntable. The shoe suddenly stops rotating, drops completely out of the digital interface with accurate gravity simulation, and lands as a physical, real-life premium sneaker on a hardwood floor — accurate leather, mesh, accurate rubber sole bounce, the tongue settles, laces flutter. Soft product-photography lighting.',
  negative_prompt = 'cartoon, low quality, watermark, distorted',
  recipe_slug = 'frame_dissolve', motion_hint = 'product_drop', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['sneaker_drop','rubber_bounce','wood_floor_settle'],
  music_genre = 'hip_hop_lo_fi', color_lut = 'product_clean_white',
  particle_density = 40
WHERE slug = 'the-marketplace-shoe-drop';

-- ── 4. RETRO / HOLO BREAKS ──
UPDATE public.vfx_templates SET
  pure_prompt = '1980s analog horror cinematography. An old flickering CRT television set, curved glass, dusty wood-paneled cabinet, brutal scanline static. A retro-styled character (high contrast clothing, slightly fuzzy edges) slowly emerges through the thick curved glass — their body shifts in phases: analog scanline ghosting, RGB color separation, then resolves to fully solid photoreal flesh as they fully cross the boundary. The room is a dim 1980s living room — orange shag carpet, dust particles in the lamp light.',
  negative_prompt = 'modern, clean, low quality, watermark',
  recipe_slug = 'neon_zap', motion_hint = 'crt_emerge_phased', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['crt_static','crt_hum_60hz','glass_creak','dusty_carpet_step'],
  music_genre = 'analog_horror_synth', color_lut = 'crt_retro_warm',
  particle_density = 220, subject_id_method = 'pulid'
WHERE slug = 'the-crt-ghost-walk';

UPDATE public.vfx_templates SET
  pure_prompt = 'Sci-fi blockbuster cinematography. A futuristic sleek desktop setup with a flat blue glowing holographic interface floating above the desk surface. The holo shatters like crystalline digital ice — geometric Voronoi shards spinning out and dissolving back into light beams. Out of the residual light beam, a hyper-realistic AI android assistant steps forward — accurate brushed-metal skin shader with subtle internal LED veins, accurate cloth simulation on its uniform. It stands solid on a brushed-aluminum metal floor.',
  negative_prompt = 'cartoon, low quality, watermark, friendly',
  recipe_slug = 'glass_shatter', motion_hint = 'holo_resolve', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['holo_crystal_shatter','android_servo_whir','metal_floor_step'],
  music_genre = 'sci_fi_orchestral', color_lut = 'sci_fi_blue_steel',
  particle_density = 480
WHERE slug = 'the-holographic-ai-assembly';

UPDATE public.vfx_templates SET
  pure_prompt = 'Arcade documentary cinematography, harsh neon lighting. A neon retro 80s arcade cabinet plays an 8-bit fighting game with pixelated sprites. The pixelated main character pulls off a glowing special-move animation — sparks of 8-bit pixels burst out, then crystallise into Voronoi glass shards as the screen shatters. The character resolves mid-air from 8-bit pixels to photoreal martial artist (gi, calloused knuckles, accurate motion blur), landing in the real arcade room with neon Tron-grid floor.',
  negative_prompt = 'cartoon, low quality, watermark',
  recipe_slug = 'glass_shatter', motion_hint = 'pixel_to_real', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['arcade_special_move','glass_shatter','gi_swoosh','arcade_ambient'],
  music_genre = 'chiptune_to_orchestral', color_lut = 'arcade_neon',
  particle_density = 400, subject_id_method = 'pulid'
WHERE slug = 'the-arcade-cabinet-leap';

UPDATE public.vfx_templates SET
  pure_prompt = 'Surveillance thriller cinematography, harsh fluorescent lighting. A 3×3 grid of black-and-white security monitor screens in a dark control room. A suspect (hooded jacket, baseball cap pulled low) in one of the camera feeds suddenly turns to face the camera, makes eye contact, then physically climbs forward through that specific monitor frame — accurate glass-panel break confined to that one screen — and drops into the dark control room as a real person. The other 8 screens keep showing their feeds.',
  negative_prompt = 'cartoon, low quality, watermark, distorted',
  recipe_slug = 'rip_tear', motion_hint = 'climb_forward_threatening', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['monitor_break','fluorescent_flicker','footstep_concrete','breath_low'],
  music_genre = 'thriller_pulse', color_lut = 'surveillance_green',
  particle_density = 200
WHERE slug = 'the-surveillance-cam-fugitive';

UPDATE public.vfx_templates SET
  pure_prompt = 'Military thriller cinematography. A high-tech monitor shows bright orange-and-blue thermal camera imaging. A glowing thermal silhouette of a person leaps forward toward the screen glass — at the moment of impact, the silhouette resolves instantly into a fully clothed photoreal tactical operative: accurate gear, plate carrier, NVGs flipped up, gloves with knuckle armor. They break into the real dim room, boots hit concrete with weight.',
  negative_prompt = 'cartoon, low quality, watermark, friendly',
  recipe_slug = 'glass_shatter', motion_hint = 'tactical_breach', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['glass_thick_smash','gear_jingle','boot_concrete','radio_chatter'],
  music_genre = 'tactical_thriller', color_lut = 'tactical_dim',
  particle_density = 360, subject_id_method = 'pulid'
WHERE slug = 'the-thermal-signature-leap';

UPDATE public.vfx_templates SET
  pure_prompt = 'Laboratory cinematography, harsh fluorescent. A laboratory oscilloscope screen with a bright glowing green laser audio waveform pulsing. The sound wave spikes violently — physically ripping through the glass screen as a glowing neon-green wire/laser beam with accurate light bloom and energy transfer. It wraps around real machinery in the room: brushed-metal shelves, wires, scientific instruments. Accurate caustic patterns where the energy beam wraps metal.',
  negative_prompt = 'cartoon, low quality, watermark',
  recipe_slug = 'neon_zap', motion_hint = 'wave_burst_wrap', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['oscilloscope_buzz','glass_punch','laser_hum','metal_resonance'],
  music_genre = 'lab_electronic', color_lut = 'oscilloscope_green',
  particle_density = 300
WHERE slug = 'the-oscilloscope-waveform-fracture';

UPDATE public.vfx_templates SET
  pure_prompt = 'Top-gun cinematography, sun-drenched. A multi-monitor curved flight simulator cockpit setup in a darkened simulator room. The digital fighter jet on the center monitor accelerates to mach speed — the nose cone of the aircraft physically punches through the center monitor with accurate panel breach physics, dragging volumetric supersonic vapor cones into the real room. Real wind blasts papers off a nearby desk. Realistic cloud streamers fill the cockpit.',
  negative_prompt = 'cartoon, low quality, fake-looking, watermark',
  recipe_slug = 'water_breach', motion_hint = 'supersonic_breach', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['supersonic_boom','glass_punch','wind_howl','papers_flutter'],
  music_genre = 'top_gun_synth', color_lut = 'jet_cockpit_blue',
  particle_density = 800
WHERE slug = 'the-flight-simulator-takeoff';

UPDATE public.vfx_templates SET
  pure_prompt = 'Cyberpunk laboratory cinematography. A terminal screen raining vertical green code, full Matrix aesthetic. A digital avatar walks slowly forward; the falling code begins to "stick" to their body like real rain — the green katakana glyphs transition into actual physical letters that drip and form on their skin and clothing. They step out of the terminal into a dark cyber-lab: server rack LEDs, water on the concrete floor reflecting the code-rain.',
  negative_prompt = 'cartoon, low quality, watermark',
  recipe_slug = 'neon_zap', motion_hint = 'walk_forward_resolve', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['matrix_whispers','server_hum','step_water','code_glyph'],
  music_genre = 'cyber_minimalism', color_lut = 'matrix_servers',
  particle_density = 500
WHERE slug = 'the-matrix-digital-drop';

UPDATE public.vfx_templates SET
  pure_prompt = 'Naval thriller cinematography. A glowing green naval radar display screen with sweeping arc. A physical submarine periscope (accurate metallic finish, rivets, view-port glass) breaks through the glass interface — the screen becomes a liquid mercury-like surface, the periscope rises up out of it dripping with luminescent green liquid into a dim military office. Volumetric haze.',
  negative_prompt = 'cartoon, low quality, watermark',
  recipe_slug = 'paint_pour', motion_hint = 'periscope_rise', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['sonar_ping','metal_creak','liquid_drip_thick','office_ambient_low'],
  music_genre = 'submarine_tension', color_lut = 'radar_mercury_green',
  particle_density = 280
WHERE slug = 'the-radar-screen-sonar-ping';

UPDATE public.vfx_templates SET
  pure_prompt = 'Medical thriller cinematography. A medical lightbox shows a skeletal X-ray of a hand. The skeleton fingers suddenly twitch, then reach forward through the plastic film with accurate parchment-tear physics. As the bone hand enters the room''s warm tungsten lighting, time-lapse: muscle layers grow over the bones with anatomical accuracy, then skin layers form with sub-surface scattering, fingernails complete. The transition is slow-motion and clinical.',
  negative_prompt = 'cartoon, low quality, watermark',
  recipe_slug = 'frame_dissolve', motion_hint = 'anatomical_grow', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['xray_film_tear','flesh_grow_squelch','medical_ambient'],
  music_genre = 'medical_unsettling', color_lut = 'xray_to_warm_tungsten',
  particle_density = 80
WHERE slug = 'the-x-ray-reveal';

-- ── 5. SURREAL ──
UPDATE public.vfx_templates SET
  pure_prompt = 'Comic book to live action transition, ultra cinematic. A flat black-and-white comic book page lies on a desk under desk-lamp lighting. A dynamic superhero panel sketch begins to move — frame-by-frame stop-motion at first, then breaks through the panel borders into 3D space, ink lines transitioning to colored cel-shading then to fully photoreal 3D human hero with accurate fabric, muscle, lighting. They stand triumphant on the real desk surface, accurate contact shadows, real cape fluttering with cloth physics.',
  negative_prompt = 'low quality, watermark',
  recipe_slug = 'frame_dissolve', motion_hint = 'panel_to_real', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['comic_page_rustle','ink_to_real','cape_flutter','desk_creak'],
  music_genre = 'heroic_orchestral', color_lut = 'comic_to_real',
  particle_density = 220, subject_id_method = 'pulid'
WHERE slug = 'the-comic-book-inking';

UPDATE public.vfx_templates SET
  pure_prompt = 'Art gallery cinematography. A classic golden-framed oil painting of a stormy ocean hanging on a gallery wall. The textured impasto painted waves suddenly begin to move — the oil paint becomes viscous fluid with accurate SPH simulation, splashing thick wet colorful oil paint over the gilded frame and onto the polished gallery floor with realistic puddles and splatter patterns. Each color (blue, white, gray) maintains its pigment-like viscosity.',
  negative_prompt = 'low quality, cartoon, watermark',
  recipe_slug = 'paint_pour', motion_hint = 'oil_paint_splash', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['paint_splatter','liquid_drip_thick','gallery_silence'],
  music_genre = 'orchestral_stormy', color_lut = 'oil_paint_natural',
  particle_density = 700
WHERE slug = 'the-oil-painting-splash';

UPDATE public.vfx_templates SET
  pure_prompt = 'Theatrical cinematography. A bright white theatrical projection screen showing a dark shadow puppet silhouette mid-gesture. The shadow figure suddenly reaches forward in 3D and rips the physical white screen fabric with accurate cloth-tear simulation — fibres pull, edges fray. They step through the tear as a fully detailed photoreal person — accurate skin, period-appropriate costume, stage-light rim glow. Behind them: the dim backstage.',
  negative_prompt = 'low quality, watermark',
  recipe_slug = 'rip_tear', motion_hint = 'fabric_tear_step', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['fabric_tear_loud','stage_creak','footsteps_wood'],
  music_genre = 'theatrical_overture', color_lut = 'theatrical_stage',
  particle_density = 80, subject_id_method = 'pulid'
WHERE slug = 'the-silhouette-shadow-tear';

UPDATE public.vfx_templates SET
  pure_prompt = 'Whimsical cinematography. A laptop display shows a 3D animation of paper folding. The animated paper origami crane flies toward the edge of the web browser — at the boundary, it physically transitions to a real, lightweight, hand-folded paper origami bird with accurate paper texture and slight imperfections. It flutters and flies in a graceful arc around the room, casting accurate shadows on the wall, paper-rustle sound. Lit by warm window light.',
  negative_prompt = 'low quality, cartoon, watermark',
  recipe_slug = 'frame_dissolve', motion_hint = 'origami_flight', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['paper_flap','room_ambient_quiet'],
  music_genre = 'whimsical_piano', color_lut = 'window_warm_natural',
  particle_density = 40
WHERE slug = 'the-origami-unfolding';

UPDATE public.vfx_templates SET
  pure_prompt = 'Luxury commercial cinematography. A sleek tablet displays a modern gold-aesthetic video loop showing a small molten gold statue. The liquid gold statue leans forward; molten gold drips over the screen bezel with accurate liquid-metal simulation — surface tension, gleam, slight smoking. The gold pools onto a real polished walnut desktop, then hardens into a solid physical sculpture of a small figure with detailed engravings.',
  negative_prompt = 'low quality, cartoon, watermark',
  recipe_slug = 'paint_pour', motion_hint = 'liquid_metal_set', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['liquid_metal_drip','crystal_set','luxury_chime'],
  music_genre = 'luxury_minimal', color_lut = 'gold_warm_luxe',
  particle_density = 240
WHERE slug = 'the-golden-liquid-statue';

UPDATE public.vfx_templates SET
  pure_prompt = 'Weather documentary cinematography. A wide computer monitor displays a chaotic supercell weather storm. A miniature powerful funnel-cloud vortex spins out of the screen center — accurate volumetric tornado simulation with internal swirls — pulling real papers and lightweight office objects on the desk into its rotating air currents. Paper sheets levitate, accurate cloth aerodynamics. The miniature tornado is roughly 30cm tall but cinematically intense.',
  negative_prompt = 'low quality, fake-looking, watermark',
  recipe_slug = 'smoke_billow', motion_hint = 'tornado_emerge', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['wind_howl_high','paper_rustle','tornado_roar'],
  music_genre = 'storm_documentary', color_lut = 'storm_gray_yellow',
  particle_density = 700
WHERE slug = 'the-tornado-vortex';

UPDATE public.vfx_templates SET
  pure_prompt = 'Sci-fi disaster cinematography. A high-end TV displays a slow-motion lightning storm. A massive bolt of plasma-purple electricity arcs directly at the camera, shattering the screen panel with accurate glass breakage, and shoots a real crackling purple plasma arc across the room with branching forks of secondary lightning. It grounds out on a metal desk lamp with accurate electrical discharge sparks. Air ionization glow.',
  negative_prompt = 'cartoon, low quality, watermark',
  recipe_slug = 'neon_zap', motion_hint = 'lightning_arc', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['thunder_crack','electric_arc','glass_punch','lamp_buzz'],
  music_genre = 'storm_synth', color_lut = 'plasma_purple',
  particle_density = 540
WHERE slug = 'the-lightning-arc';

UPDATE public.vfx_templates SET
  pure_prompt = 'Surreal art cinematography. A mobile phone screen shows an abstract ink-bleeding video. Black ink hits the edge of the phone screen and physically leaks over the edge like liquid tar with accurate viscous fluid simulation — slow, syrupy, glistening. It creeps across a real-world wood table texture in real-time, following the wood grain, pooling in the cracks, casting accurate contact shadows. Macro 100mm lens.',
  negative_prompt = 'low quality, cartoon, watermark',
  recipe_slug = 'paint_pour', motion_hint = 'viscous_spread', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['viscous_drip','wood_subtle_squeak'],
  music_genre = 'ambient_minimal_dark', color_lut = 'ink_macro_dark',
  particle_density = 220
WHERE slug = 'the-ink-blot-expansion';

UPDATE public.vfx_templates SET
  pure_prompt = 'Surreal bathroom cinematography. A large wall mirror with a translucent digital smart-mirror UI overlay (weather widget, calendar). A person stands in front of it brushing teeth. The digital reflection suddenly stops mirroring the user — its eyes glance at them — then cracks the glass from the inside outward with accurate radial crack pattern, and the reflection steps out of the mirror into the physical bathroom space. Slightly off-sync gestures.',
  negative_prompt = 'low quality, cartoon, watermark',
  recipe_slug = 'glass_shatter', motion_hint = 'reflection_emerge', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['glass_radial_crack','tile_step','sink_drip'],
  music_genre = 'horror_suspense_minimal', color_lut = 'bathroom_clinical',
  particle_density = 320, subject_id_method = 'pulid'
WHERE slug = 'the-mirror-image-reverse';

UPDATE public.vfx_templates SET
  pure_prompt = 'Documentary period-piece cinematography. A sepia-toned vintage portrait photograph on a modern tablet screen — Victorian woman, formal gown, accurate period detail. She begins to walk in smooth slow motion, stepping out of the faded sepia borders. As she crosses the threshold, sepia tones bloom into full modern color — accurate skin micro-detail, fabric of the gown catches modern lighting, eyes resolve from etched detail to wet expressive depth. She lands on a modern office floor — temporal collision.',
  negative_prompt = 'cartoon, low quality, watermark, distorted face',
  recipe_slug = 'frame_dissolve', motion_hint = 'vintage_to_modern', preferred_model = 'hunyuan',
  sfx_tags = ARRAY['old_photograph_creak','footsteps_modern_floor','clock_ticking'],
  music_genre = 'sepia_to_modern_string', color_lut = 'sepia_to_full_color',
  particle_density = 90, subject_id_method = 'pulid'
WHERE slug = 'the-vintage-photograph-step';

-- Mark all as prompt_version 2 so the renderer knows to use the new pipeline.
UPDATE public.vfx_templates SET prompt_version = 2;

END $$;
