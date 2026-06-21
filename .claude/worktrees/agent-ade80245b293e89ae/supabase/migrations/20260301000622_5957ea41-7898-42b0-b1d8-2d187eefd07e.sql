
DO $$
DECLARE
  fake_names text[] := ARRAY[
    'Marcus Chen', 'Sofia Rodriguez', 'James Okonkwo', 'Yuki Tanaka', 'Emma Larsson',
    'Raj Patel', 'Olivia Smith', 'Liam Mueller', 'Aisha Khan', 'Noah Anderson',
    'Mia Johansson', 'Lucas Silva', 'Chloe Dupont', 'Ethan Williams', 'Hana Kim',
    'Alex Moreau', 'Isabella Rossi', 'Daniel Park', 'Zara Ahmed', 'Ryan Thompson',
    'Mei Wang', 'Oscar Nielsen', 'Amara Diop', 'Jack Murphy', 'Priya Sharma',
    'Leo Petrov', 'Ava Brown', 'Mateo Garcia', 'Fatima Al-Rashid', 'Ben Taylor',
    'Nina Ivanova', 'Sam Cooper', 'Layla Hassan', 'Felix Schneider', 'Ruby Chen',
    'Omar Sayed', 'Freya Olsen', 'Kai Nakamura', 'Iris Kowalski', 'Hugo Martin',
    'Zoe Papadopoulos', 'Finn O''Brien', 'Luna Morales', 'Theo Santos', 'Ada Osei',
    'Max Fischer', 'Nadia Popova', 'Jasper Lee', 'Elara Singh', 'Remy Blanc',
    'Suki Yamamoto', 'Arlo James', 'Dina Khoury', 'Erik Lindgren', 'Maya Reeves',
    'Nico Bianchi', 'Tara Flynn', 'Samir Nazari', 'Willow Hart', 'Axel Bergman',
    'Kira Volkov', 'Jules Fontaine', 'Noor Malik', 'Soren Dahl', 'Ivy Chang',
    'Rafael Mendez', 'Stella Novak', 'Tobias Weber', 'Lena Hoffman', 'Diego Torres',
    'Pearl Adeyemi', 'Milo Grant', 'Raina Desai', 'Oskar Voss', 'Juno Sato',
    'Cruz Rivera', 'Thea Bakker', 'Idris Cole', 'Sage Brennan', 'Yara Darwish',
    'Roman Koval', 'Celeste Liu', 'Declan Walsh', 'Nyla Foster', 'Elio Ferrara',
    'Wren Sinclair', 'Tariq Abbas', 'Soleil Mercier', 'Bodhi Nguyen', 'Lyra Jensen',
    'Zain Raza', 'Clover McKay', 'Dante Esposito', 'Anika Lundberg', 'Kenzo Ito',
    'Isla Barrett', 'Rohan Gupta', 'Neve Sullivan', 'Caspian Reed', 'Amira Farah'
  ];
  display_names text[] := ARRAY[
    'MarcusChen', 'SofiaCreates', 'JamesO_Films', 'YukiTanaka', 'EmmaDirects',
    'RajVisions', 'OliviaSmith', 'LiamMakes', 'AishaK', 'NoahA_Studio',
    'MiaJ', 'LucasFilms_BR', 'ChloeDupont', 'EthanW', 'HanaKim',
    'AlexMoreau', 'IsaFilmmaker', 'DanielPark', 'ZaraCreative', 'RyanT_Cinema',
    'MeiWang', 'OscarN', 'AmaraD', 'JackMurph', 'PriyaSharma',
    'LeoPetrov', 'AvaBrown', 'MateoG', 'FatimaAR', 'BenTaylor',
    'NinaIvanova', 'SamCooper', 'LaylaH', 'FelixSchneider', 'RubyChen',
    'OmarSayed', 'FreyaOlsen', 'KaiNak', 'IrisKowalski', 'HugoMartin',
    'ZoePapa', 'FinnOB', 'LunaMorales', 'TheoSantos', 'AdaOsei',
    'MaxFischer', 'NadiaP', 'JasperLee', 'ElaraSingh', 'RemyBlanc',
    'SukiYama', 'ArloJ', 'DinaK', 'ErikLindgren', 'MayaReeves',
    'NicoBianchi', 'TaraFlynn', 'SamirN', 'WillowHart', 'AxelB',
    'KiraVolkov', 'JulesFont', 'NoorMalik', 'SorenDahl', 'IvyChang',
    'RafaelM', 'StellaNovak', 'TobiasW', 'LenaHoffman', 'DiegoT',
    'PearlAdeyemi', 'MiloGrant', 'RainaDesai', 'OskarVoss', 'JunoSato',
    'CruzRivera', 'TheaBakker', 'IdrisCole', 'SageBrennan', 'YaraDarwish',
    'RomanKoval', 'CelesteLiu', 'DeclanWalsh', 'NylaFoster', 'ElioF',
    'WrenSinclair', 'TariqAbbas', 'SoleilM', 'BodhiNguyen', 'LyraJensen',
    'ZainRaza', 'CloverMcKay', 'DanteEsposito', 'AnikaL', 'KenzoIto',
    'IslaBarrett', 'RohanGupta', 'NeveSullivan', 'CaspianReed', 'AmiraFarah'
  ];
  countries text[] := ARRAY[
    'US','MX','NG','JP','SE','IN','US','DE','PK','CA',
    'SE','BR','FR','AU','KR','FR','IT','KR','AE','US',
    'CN','DK','SN','IE','IN','RU','US','AR','SA','GB',
    'RU','US','LB','DE','CN','EG','NO','JP','PL','FR',
    'GR','IE','MX','BR','GH','AT','UA','US','IN','FR',
    'JP','US','JO','SE','US','IT','IE','IR','US','SE',
    'RU','FR','PK','DK','TW','MX','CZ','DE','DE','CO',
    'NG','US','IN','DE','JP','PR','NL','US','US','EG',
    'UA','CN','IE','US','IT','US','PK','FR','VN','DK',
    'PK','US','IT','SE','JP','AU','IN','IE','US','SO'
  ];
  new_uid uuid;
  fake_email text;
  days_ago integer;
  i integer;
BEGIN
  FOR i IN 1..100 LOOP
    new_uid := gen_random_uuid();
    fake_email := lower(replace(replace(fake_names[i], ' ', '.'), '''', '')) || '_' || substr(md5(random()::text), 1, 4) || '@gmail.com';
    days_ago := 5 + floor(random() * 120)::integer;

    -- Insert into auth.users
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token
    ) VALUES (
      new_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      fake_email,
      crypt('FakePass123!_' || i::text, gen_salt('bf')),
      now() - (days_ago || ' days')::interval,
      now() - (days_ago || ' days')::interval,
      now() - (floor(random() * days_ago) || ' days')::interval,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', display_names[i], 'full_name', fake_names[i]),
      false,
      ''
    );

    -- Update the auto-created profile with rich data
    UPDATE profiles SET
      display_name = display_names[i],
      full_name = fake_names[i],
      avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || lower(split_part(fake_names[i], ' ', 1)),
      credits_balance = floor(random() * 500)::integer,
      total_credits_purchased = floor(random() * 1000 + 100)::integer,
      total_credits_used = floor(random() * 500)::integer,
      onboarding_completed = true,
      account_tier = 'free',
      country = countries[i],
      has_seen_welcome_video = true,
      has_seen_welcome_offer = true,
      created_at = now() - (days_ago || ' days')::interval,
      updated_at = now() - (floor(random() * 3) || ' days')::interval
    WHERE id = new_uid;

    -- Gamification
    INSERT INTO user_gamification (user_id, xp_total, level, current_streak, longest_streak, last_activity_date)
    VALUES (
      new_uid,
      floor(random() * 5000)::integer,
      floor(random() * 15 + 1)::integer,
      floor(random() * 14)::integer,
      floor(random() * 30)::integer,
      CURRENT_DATE - (floor(random() * 5)::integer)
    )
    ON CONFLICT (user_id) DO UPDATE SET
      xp_total = EXCLUDED.xp_total,
      level = EXCLUDED.level,
      current_streak = EXCLUDED.current_streak,
      longest_streak = EXCLUDED.longest_streak,
      last_activity_date = EXCLUDED.last_activity_date;
  END LOOP;
END $$;
