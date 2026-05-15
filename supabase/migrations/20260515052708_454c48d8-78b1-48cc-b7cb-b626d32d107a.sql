
UPDATE genesis_environment_templates SET thumbnail_url = CASE template_name
  WHEN 'Abandoned Cathedral'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/abandoned-cathedral.jpg'
  WHEN 'Amazon Rainforest Canopy'  THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/amazon-rainforest-canopy.jpg'
  WHEN 'Ancient Roman Forum'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/ancient-roman-forum.jpg'
  WHEN 'Antarctic Ice Field'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/antarctic-ice-field.jpg'
  WHEN 'Brooklyn Loft Studio'      THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/brooklyn-loft-studio.jpg'
  WHEN 'Central Park Spring'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/central-park-spring.jpg'
  WHEN 'Cyberpunk Megacity Roof'   THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/cyberpunk-megacity-roof.jpg'
  WHEN 'Dubai Skyline Penthouse'   THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/dubai-skyline-penthouse.jpg'
  WHEN 'Iceland Glacier Lagoon'    THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/iceland-glacier-lagoon.jpg'
  WHEN 'LA Canyon Sunset'          THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/la-canyon-sunset.jpg'
  WHEN 'Lagos Beach Sunset'        THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/lagos-beach-sunset.jpg'
  WHEN 'London Foggy Embankment'   THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/london-foggy-embankment.jpg'
  WHEN 'Marrakech Souk'            THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/marrakech-souk.jpg'
  WHEN 'Mars Colony Habitat'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/mars-colony-habitat.jpg'
  WHEN 'Medieval Castle Hall'      THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/medieval-castle-hall.jpg'
  WHEN 'Modern Glass Office'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/modern-glass-office.jpg'
  WHEN 'Mojave Desert Dunes'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/mojave-desert-dunes.jpg'
  WHEN 'MSG Event Night'           THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/msg-event-night.jpg'
  WHEN 'Mumbai Monsoon Street'     THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/mumbai-monsoon-street.jpg'
  WHEN 'Neon Arcade 1985'          THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/neon-arcade-1985.jpg'
  WHEN 'NYC Subway Platform'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/nyc-subway-platform.jpg'
  WHEN 'Paris Rooftop Dusk'        THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/paris-rooftop-dusk.jpg'
  WHEN 'Sahara Caravan Dawn'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/sahara-caravan-dawn.jpg'
  WHEN 'Santorini Cliffside'       THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/santorini-cliffside.jpg'
  WHEN 'Seoul Han River Bridge'    THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/seoul-han-river-bridge.jpg'
  WHEN 'Snowy Mountain Cabin'      THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/snowy-mountain-cabin.jpg'
  WHEN 'Space Station Observation' THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/space-station-observation.jpg'
  WHEN 'Speakeasy Jazz Bar'        THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/speakeasy-jazz-bar.jpg'
  WHEN 'Times Square Day'          THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/times-square-day.jpg'
  WHEN 'Times Square Night'        THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/times-square-night.jpg'
  WHEN 'Tokyo Neon Alley'          THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/tokyo-neon-alley.jpg'
  WHEN 'Tropical Infinity Pool'    THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/tropical-infinity-pool.jpg'
  WHEN 'Underwater Coral Reef'     THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/underwater-coral-reef.jpg'
  WHEN 'Victorian Library'         THEN 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/thumbnails/environments/victorian-library.jpg'
  ELSE thumbnail_url
END
WHERE template_name IN (
  'Abandoned Cathedral','Amazon Rainforest Canopy','Ancient Roman Forum','Antarctic Ice Field',
  'Brooklyn Loft Studio','Central Park Spring','Cyberpunk Megacity Roof','Dubai Skyline Penthouse',
  'Iceland Glacier Lagoon','LA Canyon Sunset','Lagos Beach Sunset','London Foggy Embankment',
  'Marrakech Souk','Mars Colony Habitat','Medieval Castle Hall','Modern Glass Office',
  'Mojave Desert Dunes','MSG Event Night','Mumbai Monsoon Street','Neon Arcade 1985',
  'NYC Subway Platform','Paris Rooftop Dusk','Sahara Caravan Dawn','Santorini Cliffside',
  'Seoul Han River Bridge','Snowy Mountain Cabin','Space Station Observation','Speakeasy Jazz Bar',
  'Times Square Day','Times Square Night','Tokyo Neon Alley','Tropical Infinity Pool',
  'Underwater Coral Reef','Victorian Library'
);
