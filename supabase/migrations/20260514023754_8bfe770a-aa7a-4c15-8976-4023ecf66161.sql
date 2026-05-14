
INSERT INTO public.avatar_templates
  (name, description, personality, gender, age_range, ethnicity, style, avatar_type,
   face_image_url, thumbnail_url, voice_id, voice_provider, voice_name, tags,
   is_active, is_premium, sort_order)
VALUES
  -- ── Independence Day ──
  ('Lady Liberty Spark', 'Stylized Lady Liberty in glowing patriotic palette', 'inspiring, proud, hopeful',
   'female', 'adult', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/3b82f6?text=🗽', 'https://placehold.co/256x384/1a1a2e/3b82f6?text=🗽',
   'nova', 'openai', 'Nova',
   ARRAY['independence','holiday','4thjuly','patriotic','animated','kids']::text[], true, false, 120),

  ('Star-Spangled Scout', 'Cheerful kid avatar in red, white and blue with sparklers', 'energetic, joyful, brave',
   'neutral', 'kid', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/ef4444?text=🎆', 'https://placehold.co/256x384/1a1a2e/ef4444?text=🎆',
   'echo', 'openai', 'Echo',
   ARRAY['independence','holiday','4thjuly','patriotic','fireworks','kids','animated']::text[], true, false, 121),

  -- ── Easter ──
  ('Bunny Bloom', 'Friendly Easter bunny holding a basket of pastel eggs', 'soft, warm, playful',
   'neutral', 'kid', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/f9a8d4?text=🐰', 'https://placehold.co/256x384/1a1a2e/f9a8d4?text=🐰',
   'fable', 'openai', 'Fable',
   ARRAY['easter','holiday','bunny','animal','spring','kids','animated']::text[], true, false, 122),

  ('Pastel Chick', 'Tiny spring chick popping out of a decorated egg', 'cute, curious, cheerful',
   'neutral', 'kid', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/fde047?text=🐣', 'https://placehold.co/256x384/1a1a2e/fde047?text=🐣',
   'fable', 'openai', 'Fable',
   ARRAY['easter','holiday','spring','kids','animated','cute']::text[], true, false, 123),

  -- ── Christmas extras ──
  ('Saint Nick Modern', 'Sleek modern reinterpretation of Santa with a tailored red coat', 'jolly, generous, warm',
   'male', 'senior', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/dc2626?text=🎅', 'https://placehold.co/256x384/1a1a2e/dc2626?text=🎅',
   'onyx', 'openai', 'Onyx',
   ARRAY['christmas','holiday','santa','animated','winter','kids']::text[], true, false, 124),

  ('Mrs. Claus Cocoa', 'Cozy Mrs. Claus with a steaming mug and warm smile', 'kind, warm, nurturing',
   'female', 'senior', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/f87171?text=☕', 'https://placehold.co/256x384/1a1a2e/f87171?text=☕',
   'shimmer', 'openai', 'Shimmer',
   ARRAY['christmas','holiday','animated','winter','kids']::text[], true, false, 125),

  -- ── Halloween / Thanksgiving ──
  ('Jack o'' Lantern Pal', 'Smiling pumpkin character with friendly glow', 'spooky-cute, playful',
   'neutral', 'kid', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/f97316?text=🎃', 'https://placehold.co/256x384/1a1a2e/f97316?text=🎃',
   'echo', 'openai', 'Echo',
   ARRAY['halloween','holiday','pumpkin','kids','animated']::text[], true, false, 126),

  ('Tom Turkey Feast', 'Cartoon turkey in a chef apron ready for the feast', 'jolly, warm, festive',
   'male', 'adult', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/b45309?text=🦃', 'https://placehold.co/256x384/1a1a2e/b45309?text=🦃',
   'onyx', 'openai', 'Onyx',
   ARRAY['thanksgiving','holiday','turkey','animal','kids','animated']::text[], true, false, 127),

  -- ── Diwali / Hanukkah / Lunar New Year ──
  ('Diya Glow', 'Festive Diwali host surrounded by glowing diya lamps', 'warm, vibrant, welcoming',
   'female', 'adult', 'south asian', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/f59e0b?text=🪔', 'https://placehold.co/256x384/1a1a2e/f59e0b?text=🪔',
   'nova', 'openai', 'Nova',
   ARRAY['diwali','holiday','indian','south asian','animated']::text[], true, false, 128),

  ('Dreidel Dani', 'Cheerful Hanukkah host with a glowing menorah backdrop', 'warm, festive, kind',
   'neutral', 'kid', 'jewish', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/3b82f6?text=🕎', 'https://placehold.co/256x384/1a1a2e/3b82f6?text=🕎',
   'fable', 'openai', 'Fable',
   ARRAY['hanukkah','holiday','jewish','kids','animated']::text[], true, false, 129),

  ('Lunar Phoenix', 'Stylized Lunar New Year host with red lanterns and gold trim', 'auspicious, bright, lively',
   'female', 'adult', 'east asian', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/dc2626?text=🏮', 'https://placehold.co/256x384/1a1a2e/dc2626?text=🏮',
   'shimmer', 'openai', 'Shimmer',
   ARRAY['lunarnewyear','holiday','east asian','asian','animated']::text[], true, false, 130),

  -- ── Seasonal ──
  ('Sunbeam Surfer', 'Summer beach character with surfboard and golden tan light', 'sunny, easygoing, fun',
   'neutral', 'young adult', 'animated', 'casual', 'animated',
   'https://placehold.co/512x768/1a1a2e/fbbf24?text=🏄', 'https://placehold.co/256x384/1a1a2e/fbbf24?text=🏄',
   'echo', 'openai', 'Echo',
   ARRAY['summer','seasonal','casual','animated','beach']::text[], true, false, 131),

  ('Maple Drift', 'Autumn character with falling maple leaves and cozy scarf', 'cozy, reflective, warm',
   'female', 'adult', 'animated', 'casual', 'animated',
   'https://placehold.co/512x768/1a1a2e/ea580c?text=🍁', 'https://placehold.co/256x384/1a1a2e/ea580c?text=🍁',
   'shimmer', 'openai', 'Shimmer',
   ARRAY['autumn','fall','seasonal','animated','casual']::text[], true, false, 132),

  ('Aurora Mitten', 'Winter wonderland host with mittens and aurora-lit backdrop', 'serene, cool, inviting',
   'female', 'young adult', 'animated', 'casual', 'animated',
   'https://placehold.co/512x768/1a1a2e/60a5fa?text=❄️', 'https://placehold.co/256x384/1a1a2e/60a5fa?text=❄️',
   'nova', 'openai', 'Nova',
   ARRAY['winter','seasonal','frost','animated','casual']::text[], true, false, 133),

  ('Petal Bloom', 'Spring host surrounded by cherry blossoms and soft pastels', 'fresh, hopeful, gentle',
   'female', 'young adult', 'east asian', 'casual', 'animated',
   'https://placehold.co/512x768/1a1a2e/f9a8d4?text=🌸', 'https://placehold.co/256x384/1a1a2e/f9a8d4?text=🌸',
   'shimmer', 'openai', 'Shimmer',
   ARRAY['spring','seasonal','hanami','animated','casual']::text[], true, false, 134),

  -- ── Original pop-style heroes (no licensed IP) ──
  ('Web Drifter', 'Original red-and-blue masked street hero swinging through neon city', 'agile, witty, brave',
   'male', 'young adult', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/ef4444?text=🕷️', 'https://placehold.co/256x384/1a1a2e/ef4444?text=🕷️',
   'echo', 'openai', 'Echo',
   ARRAY['superhero','hero','fantasy','animated','urban']::text[], true, false, 135),

  ('Stealth Spider Noir', 'Monochrome shadow variant of the web hero, trench-coat silhouette', 'mysterious, sharp, cool',
   'male', 'adult', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/e2e8f0?text=🕸️', 'https://placehold.co/256x384/1a1a2e/e2e8f0?text=🕸️',
   'onyx', 'openai', 'Onyx',
   ARRAY['superhero','hero','fantasy','animated','noir','mystery']::text[], true, false, 136),

  ('Crimson Arc', 'Original sleek crimson-and-gold armored hero with arc-light core', 'confident, smart, bold',
   'male', 'adult', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/dc2626?text=🤖', 'https://placehold.co/256x384/1a1a2e/dc2626?text=🤖',
   'onyx', 'openai', 'Onyx',
   ARRAY['superhero','hero','tech','futuristic','animated']::text[], true, false, 137),

  ('Solar Forge', 'Gold-plated armored hero variant with solar reactor chest', 'commanding, brilliant, bold',
   'male', 'adult', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/f59e0b?text=⚙️', 'https://placehold.co/256x384/1a1a2e/f59e0b?text=⚙️',
   'onyx', 'openai', 'Onyx',
   ARRAY['superhero','hero','tech','futuristic','animated']::text[], true, false, 138),

  ('Storm Cloak', 'Caped storm-wielding hero with crackling lightning aura', 'powerful, noble, fierce',
   'male', 'adult', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/8b5cf6?text=⚡', 'https://placehold.co/256x384/1a1a2e/8b5cf6?text=⚡',
   'onyx', 'openai', 'Onyx',
   ARRAY['superhero','hero','fantasy','animated','powerful']::text[], true, false, 139),

  ('Shield Maiden Vox', 'Star-shield wielding hero in chrome and sapphire armor', 'brave, principled, bold',
   'female', 'adult', 'animated', 'creative', 'animated',
   'https://placehold.co/512x768/1a1a2e/3b82f6?text=🛡️', 'https://placehold.co/256x384/1a1a2e/3b82f6?text=🛡️',
   'nova', 'openai', 'Nova',
   ARRAY['superhero','hero','fantasy','animated','warrior']::text[], true, false, 140)

ON CONFLICT (name) DO NOTHING;
