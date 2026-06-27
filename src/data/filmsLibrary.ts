/**
 * filmsLibrary — catalog of films from the previous database (58 films · 186
 * playable clips), hosted on the legacy public bucket. Used to fill the app's
 * galleries, walls and media surfaces with real generated content.
 * Generated from the uploaded films-library CSV (manifests resolved to clip URLs).
 */
export interface Film { title: string; id: string; clips: string[]; }

export const FILMS: Film[] = [
  { title: 'Adorable Intruder Alert', id: 'c042deb9-3be5-41ef-9e63-acad0d064c6e', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/c042deb9-3be5-41ef-9e63-acad0d064c6e/avatar_c042deb9-3be5-41ef-9e63-acad0d064c6e_clip1_lipsync_1771738208320.mp4',
  ] },
  { title: 'Post Escape', id: 'f644c316-8719-42a6-b170-4acc992a292a', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f644c316-8719-42a6-b170-4acc992a292a/clip0_f644c316-8719-42a6-b170-4acc992a292a_clip0_1779135178848.mp4',
  ] },
  { title: 'Reality Rip', id: '45370b0e-39b3-4a6f-9dc4-16ca18916f47', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/45370b0e-39b3-4a6f-9dc4-16ca18916f47/clip0_45370b0e-39b3-4a6f-9dc4-16ca18916f47_clip0_1779132717410.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/45370b0e-39b3-4a6f-9dc4-16ca18916f47/clip1_45370b0e-39b3-4a6f-9dc4-16ca18916f47_clip1_1779132866981.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/45370b0e-39b3-4a6f-9dc4-16ca18916f47/clip2_45370b0e-39b3-4a6f-9dc4-16ca18916f47_clip2_1779133071828.mp4',
  ] },
  { title: 'Epic Urban Showdown', id: '4330107e-d7e4-4173-b3af-4ce15e2d118b', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4330107e-d7e4-4173-b3af-4ce15e2d118b/clip0_4330107e-d7e4-4173-b3af-4ce15e2d118b_clip0_1777683602274.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4330107e-d7e4-4173-b3af-4ce15e2d118b/clip1_4330107e-d7e4-4173-b3af-4ce15e2d118b_clip1_1777683753980.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4330107e-d7e4-4173-b3af-4ce15e2d118b/clip2_4330107e-d7e4-4173-b3af-4ce15e2d118b_clip2_1777683444782.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4330107e-d7e4-4173-b3af-4ce15e2d118b/clip4_4330107e-d7e4-4173-b3af-4ce15e2d118b_clip4_1777686274665.mp4',
  ] },
  { title: 'Battle for Her Heart', id: '23cf4063-88bb-4a8e-9252-e24c51409c2e', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip0_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip0_1777678099245.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip1_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip1_1777678422573.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip2_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip2_1777678585873.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip3_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip3_1777679012672.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip4_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip4_1777679167768.mp4',
  ] },
  { title: 'Adorable Intruder', id: '73b568d0-c626-47a8-b6a1-1dfaf0452b11', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/73b568d0-c626-47a8-b6a1-1dfaf0452b11/clip0_73b568d0-c626-47a8-b6a1-1dfaf0452b11_clip0_1771784591916.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/73b568d0-c626-47a8-b6a1-1dfaf0452b11/clip1_73b568d0-c626-47a8-b6a1-1dfaf0452b11_clip1_1771785280741.mp4',
  ] },
  { title: 'Meet Hoppy: Your Adorable Guide', id: 'b50d6ab1-c49a-4e51-a435-0b0b0b9c7049', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/b50d6ab1-c49a-4e51-a435-0b0b0b9c7049/avatar_b50d6ab1-c49a-4e51-a435-0b0b0b9c7049_clip1_lipsync_1771735085809.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b50d6ab1-c49a-4e51-a435-0b0b0b9c7049/clip1_b50d6ab1-c49a-4e51-a435-0b0b0b9c7049_clip1_1771735493005.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b50d6ab1-c49a-4e51-a435-0b0b0b9c7049/clip2_b50d6ab1-c49a-4e51-a435-0b0b0b9c7049_clip2_1771735807363.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b50d6ab1-c49a-4e51-a435-0b0b0b9c7049/clip3_b50d6ab1-c49a-4e51-a435-0b0b0b9c7049_clip3_1771736174608.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b50d6ab1-c49a-4e51-a435-0b0b0b9c7049/clip4_b50d6ab1-c49a-4e51-a435-0b0b0b9c7049_clip4_1771736566586.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b50d6ab1-c49a-4e51-a435-0b0b0b9c7049/clip5_b50d6ab1-c49a-4e51-a435-0b0b0b9c7049_clip5_1771736918675.mp4',
  ] },
  { title: 'Adorable Intruder', id: 'fb50fcdc-bed9-4423-a5cb-871a26f77ee1', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fb50fcdc-bed9-4423-a5cb-871a26f77ee1/avatar_fb50fcdc-bed9-4423-a5cb-871a26f77ee1_clip1_lipsync_1771727043052.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb50fcdc-bed9-4423-a5cb-871a26f77ee1/clip1_fb50fcdc-bed9-4423-a5cb-871a26f77ee1_clip1_1771727411344.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb50fcdc-bed9-4423-a5cb-871a26f77ee1/clip2_fb50fcdc-bed9-4423-a5cb-871a26f77ee1_clip2_1771727762676.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb50fcdc-bed9-4423-a5cb-871a26f77ee1/clip3_fb50fcdc-bed9-4423-a5cb-871a26f77ee1_clip3_1771728082236.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb50fcdc-bed9-4423-a5cb-871a26f77ee1/clip4_fb50fcdc-bed9-4423-a5cb-871a26f77ee1_clip4_1771728441026.mp4',
  ] },
  { title: 'Whispers Of The Infinite', id: '929fbaf6-b0dc-4e2b-9d75-3dbf1b8cc09b', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/929fbaf6-b0dc-4e2b-9d75-3dbf1b8cc09b/auto_clip0_929fbaf6-b0dc-4e2b-9d75-3dbf1b8cc09b_clip0_1771723927113.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/929fbaf6-b0dc-4e2b-9d75-3dbf1b8cc09b/auto_clip1_929fbaf6-b0dc-4e2b-9d75-3dbf1b8cc09b_clip1_1771724854105.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/929fbaf6-b0dc-4e2b-9d75-3dbf1b8cc09b/auto_clip2_929fbaf6-b0dc-4e2b-9d75-3dbf1b8cc09b_clip2_1771725184656.mp4',
  ] },
  { title: 'Morning Joy with Hoppy', id: 'f05c88f5-665f-403a-801d-63d65329f2a5', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f05c88f5-665f-403a-801d-63d65329f2a5/clip_f05c88f5-665f-403a-801d-63d65329f2a5_0_1771653627621.mp4',
  ] },
  { title: 'Cinematic Short 53 (6 clips)', id: 'fb6ced60-e955-42a3-af73-6c8380f5f2c9', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb6ced60-e955-42a3-af73-6c8380f5f2c9/clip_fb6ced60-e955-42a3-af73-6c8380f5f2c9_0_1769869121694.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb6ced60-e955-42a3-af73-6c8380f5f2c9/clip_fb6ced60-e955-42a3-af73-6c8380f5f2c9_1_1769869294892.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb6ced60-e955-42a3-af73-6c8380f5f2c9/clip_fb6ced60-e955-42a3-af73-6c8380f5f2c9_2_1769869439894.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb6ced60-e955-42a3-af73-6c8380f5f2c9/clip_fb6ced60-e955-42a3-af73-6c8380f5f2c9_3_1769869585517.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb6ced60-e955-42a3-af73-6c8380f5f2c9/clip_fb6ced60-e955-42a3-af73-6c8380f5f2c9_4_1769869738956.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fb6ced60-e955-42a3-af73-6c8380f5f2c9/clip_fb6ced60-e955-42a3-af73-6c8380f5f2c9_5_1769869880359.mp4',
  ] },
  { title: 'Cinematic Short 5 (2 clips)', id: '240a771c-ecd9-47e4-99a9-46b910b65adc', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/240a771c-ecd9-47e4-99a9-46b910b65adc/clip_240a771c-ecd9-47e4-99a9-46b910b65adc_0_1769651757885.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/240a771c-ecd9-47e4-99a9-46b910b65adc/clip_240a771c-ecd9-47e4-99a9-46b910b65adc_1_1769651931678.mp4',
  ] },
  { title: 'Cinematic Short 41 (6 clips)', id: 'bef0ae5e-bea4-4dfd-86bf-f0b4dd448701', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/bef0ae5e-bea4-4dfd-86bf-f0b4dd448701/clip_bef0ae5e-bea4-4dfd-86bf-f0b4dd448701_0_1769630188709.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/bef0ae5e-bea4-4dfd-86bf-f0b4dd448701/clip_bef0ae5e-bea4-4dfd-86bf-f0b4dd448701_1_1769630391592.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/bef0ae5e-bea4-4dfd-86bf-f0b4dd448701/clip_bef0ae5e-bea4-4dfd-86bf-f0b4dd448701_2_1769631202429.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/bef0ae5e-bea4-4dfd-86bf-f0b4dd448701/clip_bef0ae5e-bea4-4dfd-86bf-f0b4dd448701_3_1769631346981.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/bef0ae5e-bea4-4dfd-86bf-f0b4dd448701/clip_bef0ae5e-bea4-4dfd-86bf-f0b4dd448701_4_1769631485553.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/bef0ae5e-bea4-4dfd-86bf-f0b4dd448701/clip_bef0ae5e-bea4-4dfd-86bf-f0b4dd448701_5_1769631632056.mp4',
  ] },
  { title: 'Cinematic Short 7 (5 clips)', id: '2d374fa9-30d5-420a-b8f4-be868f83060e', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/2d374fa9-30d5-420a-b8f4-be868f83060e/clip_2d374fa9-30d5-420a-b8f4-be868f83060e_0_1769692142351.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/2d374fa9-30d5-420a-b8f4-be868f83060e/clip_2d374fa9-30d5-420a-b8f4-be868f83060e_1_1769692287150.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/2d374fa9-30d5-420a-b8f4-be868f83060e/clip_2d374fa9-30d5-420a-b8f4-be868f83060e_2_1769692428632.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/2d374fa9-30d5-420a-b8f4-be868f83060e/clip_2d374fa9-30d5-420a-b8f4-be868f83060e_3_1769692569360.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/2d374fa9-30d5-420a-b8f4-be868f83060e/clip_2d374fa9-30d5-420a-b8f4-be868f83060e_4_1769692710833.mp4',
  ] },
  { title: 'Cinematic Short 9 (6 clips)', id: '3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa/clip_3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa_0_1769697139601.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa/clip_3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa_1_1769697282662.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa/clip_3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa_2_1769697429258.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa/clip_3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa_3_1769697571316.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa/clip_3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa_4_1769697712184.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa/clip_3bdaf4e4-2bff-44d6-bb7d-854c6308c5aa_5_1769697856433.mp4',
  ] },
  { title: 'Cinematic Short 18 (2 clips)', id: '58a0369b-e176-461b-a5c7-c86e87f6a396', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/58a0369b-e176-461b-a5c7-c86e87f6a396/clip_58a0369b-e176-461b-a5c7-c86e87f6a396_1_1769866718934.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/58a0369b-e176-461b-a5c7-c86e87f6a396/clip_58a0369b-e176-461b-a5c7-c86e87f6a396_2_1769866867892.mp4',
  ] },
  { title: 'Cinematic Short 22 (2 clips)', id: '6ab0e126-9260-4e08-ab6c-6b80bc809ce4', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/6ab0e126-9260-4e08-ab6c-6b80bc809ce4/clip_6ab0e126-9260-4e08-ab6c-6b80bc809ce4_0_1769591410327.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/6ab0e126-9260-4e08-ab6c-6b80bc809ce4/clip_6ab0e126-9260-4e08-ab6c-6b80bc809ce4_1_1769591566628.mp4',
  ] },
  { title: 'Cinematic Short 25 (3 clips)', id: '749322ef-37d5-470e-a020-408f418227d9', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/749322ef-37d5-470e-a020-408f418227d9/clip_749322ef-37d5-470e-a020-408f418227d9_0_1769785607276.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/749322ef-37d5-470e-a020-408f418227d9/clip_749322ef-37d5-470e-a020-408f418227d9_1_1769785745007.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/749322ef-37d5-470e-a020-408f418227d9/clip_749322ef-37d5-470e-a020-408f418227d9_2_1769785912787.mp4',
  ] },
  { title: 'Cinematic Short 31 (2 clips)', id: 'a1b63fc1-0b9f-43f8-997f-338b60adf6d8', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/a1b63fc1-0b9f-43f8-997f-338b60adf6d8/clip_a1b63fc1-0b9f-43f8-997f-338b60adf6d8_0_1769646946364.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/a1b63fc1-0b9f-43f8-997f-338b60adf6d8/clip_a1b63fc1-0b9f-43f8-997f-338b60adf6d8_1_1769647116965.mp4',
  ] },
  { title: 'Cinematic Short 33 (1 clips)', id: 'a771ea4b-5b5e-4a64-82ab-05c785af4ec8', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/a771ea4b-5b5e-4a64-82ab-05c785af4ec8/clip_a771ea4b-5b5e-4a64-82ab-05c785af4ec8_0_1769596058171.mp4',
  ] },
  { title: 'Cinematic Short 20 (1 clips)', id: '600e0d75-59c0-4754-8ff8-89d883ce0a44', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/600e0d75-59c0-4754-8ff8-89d883ce0a44/clip_600e0d75-59c0-4754-8ff8-89d883ce0a44_0_1769625804448.mp4',
  ] },
  { title: 'Cinematic Short 4 (3 clips)', id: '15d02486-3ed4-4610-9b9d-8c5cfcf95aa5', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/15d02486-3ed4-4610-9b9d-8c5cfcf95aa5/clip_15d02486-3ed4-4610-9b9d-8c5cfcf95aa5_0_1769810676357.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/15d02486-3ed4-4610-9b9d-8c5cfcf95aa5/clip_15d02486-3ed4-4610-9b9d-8c5cfcf95aa5_1_1769810819190.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/15d02486-3ed4-4610-9b9d-8c5cfcf95aa5/clip_15d02486-3ed4-4610-9b9d-8c5cfcf95aa5_2_1769810969491.mp4',
  ] },
  { title: 'Cinematic Short 49 (5 clips)', id: 'de569c7e-e728-4a71-9ba4-35bc820f6712', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/de569c7e-e728-4a71-9ba4-35bc820f6712/clip_de569c7e-e728-4a71-9ba4-35bc820f6712_0_1769622980775.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/de569c7e-e728-4a71-9ba4-35bc820f6712/clip_de569c7e-e728-4a71-9ba4-35bc820f6712_1_1769623138823.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/de569c7e-e728-4a71-9ba4-35bc820f6712/clip_de569c7e-e728-4a71-9ba4-35bc820f6712_2_1769623296523.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/de569c7e-e728-4a71-9ba4-35bc820f6712/clip_de569c7e-e728-4a71-9ba4-35bc820f6712_3_1769623507901.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/de569c7e-e728-4a71-9ba4-35bc820f6712/clip_de569c7e-e728-4a71-9ba4-35bc820f6712_4_1769624081438.mp4',
  ] },
  { title: 'Cinematic Short 50 (4 clips)', id: 'f06b5648-605e-42fe-9ee8-eb362d60b65d', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f06b5648-605e-42fe-9ee8-eb362d60b65d/clip_f06b5648-605e-42fe-9ee8-eb362d60b65d_0_1769636954403.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f06b5648-605e-42fe-9ee8-eb362d60b65d/clip_f06b5648-605e-42fe-9ee8-eb362d60b65d_1_1769637129166.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f06b5648-605e-42fe-9ee8-eb362d60b65d/clip_f06b5648-605e-42fe-9ee8-eb362d60b65d_2_1769637290429.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f06b5648-605e-42fe-9ee8-eb362d60b65d/clip_f06b5648-605e-42fe-9ee8-eb362d60b65d_3_1769638098983.mp4',
  ] },
  { title: 'Cinematic Short 51 (2 clips)', id: 'f336b6ec-256b-408a-b9e1-93b9a2950b53', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f336b6ec-256b-408a-b9e1-93b9a2950b53/clip_f336b6ec-256b-408a-b9e1-93b9a2950b53_0_1769778284208.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f336b6ec-256b-408a-b9e1-93b9a2950b53/clip_f336b6ec-256b-408a-b9e1-93b9a2950b53_1_1769778431867.mp4',
  ] },
  { title: 'Cinematic Short 17 (3 clips)', id: '53f298c8-30c6-4e18-a8fa-0e535d41c64f', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/53f298c8-30c6-4e18-a8fa-0e535d41c64f/clip_53f298c8-30c6-4e18-a8fa-0e535d41c64f_0_1769835737293.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/53f298c8-30c6-4e18-a8fa-0e535d41c64f/clip_53f298c8-30c6-4e18-a8fa-0e535d41c64f_1_1769835878385.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/53f298c8-30c6-4e18-a8fa-0e535d41c64f/clip_53f298c8-30c6-4e18-a8fa-0e535d41c64f_2_1769836023805.mp4',
  ] },
  { title: 'Cinematic Short 14 (5 clips)', id: '4567c084-29fa-4816-bdb1-7740be8514e2', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4567c084-29fa-4816-bdb1-7740be8514e2/clip_4567c084-29fa-4816-bdb1-7740be8514e2_0_1769628937459.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4567c084-29fa-4816-bdb1-7740be8514e2/clip_4567c084-29fa-4816-bdb1-7740be8514e2_1_1769629087000.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4567c084-29fa-4816-bdb1-7740be8514e2/clip_4567c084-29fa-4816-bdb1-7740be8514e2_2_1769629245932.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4567c084-29fa-4816-bdb1-7740be8514e2/clip_4567c084-29fa-4816-bdb1-7740be8514e2_3_1769629412022.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4567c084-29fa-4816-bdb1-7740be8514e2/clip_4567c084-29fa-4816-bdb1-7740be8514e2_4_1769629560333.mp4',
  ] },
  { title: 'Cinematic Short 27 (6 clips)', id: '868f22ae-915e-4ccd-97fb-3edef142bcdb', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/868f22ae-915e-4ccd-97fb-3edef142bcdb/clip_868f22ae-915e-4ccd-97fb-3edef142bcdb_0_1769696024180.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/868f22ae-915e-4ccd-97fb-3edef142bcdb/clip_868f22ae-915e-4ccd-97fb-3edef142bcdb_1_1769696170902.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/868f22ae-915e-4ccd-97fb-3edef142bcdb/clip_868f22ae-915e-4ccd-97fb-3edef142bcdb_2_1769696316478.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/868f22ae-915e-4ccd-97fb-3edef142bcdb/clip_868f22ae-915e-4ccd-97fb-3edef142bcdb_3_1769696466823.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/868f22ae-915e-4ccd-97fb-3edef142bcdb/clip_868f22ae-915e-4ccd-97fb-3edef142bcdb_4_1769696608438.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/868f22ae-915e-4ccd-97fb-3edef142bcdb/clip_868f22ae-915e-4ccd-97fb-3edef142bcdb_5_1769696758958.mp4',
  ] },
  { title: 'Cinematic Short 42 (3 clips)', id: 'c222c0a2-bc51-4a34-89b4-ea189363d519', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/c222c0a2-bc51-4a34-89b4-ea189363d519/clip_c222c0a2-bc51-4a34-89b4-ea189363d519_0_1769799186756.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/c222c0a2-bc51-4a34-89b4-ea189363d519/clip_c222c0a2-bc51-4a34-89b4-ea189363d519_1_1769799333760.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/c222c0a2-bc51-4a34-89b4-ea189363d519/clip_c222c0a2-bc51-4a34-89b4-ea189363d519_2_1769799485199.mp4',
  ] },
  { title: 'Cinematic Short 30 (1 clips)', id: '9e5db466-562a-4a77-b1f5-bad8b088c052', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/9e5db466-562a-4a77-b1f5-bad8b088c052/clip_9e5db466-562a-4a77-b1f5-bad8b088c052_0_1771465518586.mp4',
  ] },
  { title: 'Cinematic Short 34 (2 clips)', id: 'ab5a0bc4-3987-4c74-975b-58c6fe22802f', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/ab5a0bc4-3987-4c74-975b-58c6fe22802f/clip_ab5a0bc4-3987-4c74-975b-58c6fe22802f_1_1770427937755.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/ab5a0bc4-3987-4c74-975b-58c6fe22802f/clip_ab5a0bc4-3987-4c74-975b-58c6fe22802f_2_1770428083632.mp4',
  ] },
  { title: 'Cinematic Short 1 (1 clips)', id: '03f258eb-b0be-43fb-b318-a5f726331238', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/03f258eb-b0be-43fb-b318-a5f726331238/clip_03f258eb-b0be-43fb-b318-a5f726331238_1_1771595407219.mp4',
  ] },
  { title: 'Cinematic Short 52 (3 clips)', id: 'f557faac-72e7-4b7a-bebd-cf65719ff87c', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f557faac-72e7-4b7a-bebd-cf65719ff87c/clip_f557faac-72e7-4b7a-bebd-cf65719ff87c_0_1769913614683.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f557faac-72e7-4b7a-bebd-cf65719ff87c/clip_f557faac-72e7-4b7a-bebd-cf65719ff87c_1_1769913754676.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/f557faac-72e7-4b7a-bebd-cf65719ff87c/clip_f557faac-72e7-4b7a-bebd-cf65719ff87c_2_1769913896170.mp4',
  ] },
  { title: 'Cinematic Short 3 (2 clips)', id: '0e387913-1347-41f2-83b7-2336cbe37692', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/0e387913-1347-41f2-83b7-2336cbe37692/clip_0e387913-1347-41f2-83b7-2336cbe37692_0_1771424874042.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/0e387913-1347-41f2-83b7-2336cbe37692/clip_0e387913-1347-41f2-83b7-2336cbe37692_1_1771425018315.mp4',
  ] },
  { title: 'Cinematic Short 26 (1 clips)', id: '829e9799-a071-4a13-a039-b59cd5618751', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/829e9799-a071-4a13-a039-b59cd5618751/clip_829e9799-a071-4a13-a039-b59cd5618751_0_1771544610930.mp4',
  ] },
  { title: 'Cinematic Short 43 (1 clips)', id: 'c25ed50a-90b2-437a-b55d-cdca78148624', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/c25ed50a-90b2-437a-b55d-cdca78148624/clip_c25ed50a-90b2-437a-b55d-cdca78148624_0_1771544692198.mp4',
  ] },
  { title: 'Cinematic Short 54 (6 clips)', id: 'fc7775d9-2e0e-4b62-8490-fa8319cb5577', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fc7775d9-2e0e-4b62-8490-fa8319cb5577/clip_fc7775d9-2e0e-4b62-8490-fa8319cb5577_0_1771466276543.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fc7775d9-2e0e-4b62-8490-fa8319cb5577/clip_fc7775d9-2e0e-4b62-8490-fa8319cb5577_1_1771466458061.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fc7775d9-2e0e-4b62-8490-fa8319cb5577/clip_fc7775d9-2e0e-4b62-8490-fa8319cb5577_2_1771466644118.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fc7775d9-2e0e-4b62-8490-fa8319cb5577/clip_fc7775d9-2e0e-4b62-8490-fa8319cb5577_3_1771466797171.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fc7775d9-2e0e-4b62-8490-fa8319cb5577/clip_fc7775d9-2e0e-4b62-8490-fa8319cb5577_4_1771466987653.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/fc7775d9-2e0e-4b62-8490-fa8319cb5577/clip_fc7775d9-2e0e-4b62-8490-fa8319cb5577_5_1771467145546.mp4',
  ] },
  { title: 'Cinematic Short 16 (2 clips)', id: '53274436-45ce-429d-bd89-ad1957d0f948', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/53274436-45ce-429d-bd89-ad1957d0f948/clip_53274436-45ce-429d-bd89-ad1957d0f948_0_1771462660975.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/53274436-45ce-429d-bd89-ad1957d0f948/clip_53274436-45ce-429d-bd89-ad1957d0f948_1_1771462813231.mp4',
  ] },
  { title: 'Cinematic Short 48 (5 clips)', id: 'dd2b725a-d7b1-49a1-ae71-b930b52dec89', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/dd2b725a-d7b1-49a1-ae71-b930b52dec89/clip_dd2b725a-d7b1-49a1-ae71-b930b52dec89_0_1770011593410.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/dd2b725a-d7b1-49a1-ae71-b930b52dec89/clip_dd2b725a-d7b1-49a1-ae71-b930b52dec89_1_1770011738173.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/dd2b725a-d7b1-49a1-ae71-b930b52dec89/clip_dd2b725a-d7b1-49a1-ae71-b930b52dec89_2_1770011885205.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/dd2b725a-d7b1-49a1-ae71-b930b52dec89/clip_dd2b725a-d7b1-49a1-ae71-b930b52dec89_3_1770012030344.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/dd2b725a-d7b1-49a1-ae71-b930b52dec89/clip_dd2b725a-d7b1-49a1-ae71-b930b52dec89_4_1770012180675.mp4',
  ] },
  { title: 'Cinematic Short 12 (1 clips)', id: '439076a6-1946-47d3-b23b-f334df9025eb', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/439076a6-1946-47d3-b23b-f334df9025eb/clip_439076a6-1946-47d3-b23b-f334df9025eb_2_1771382984518.mp4',
  ] },
  { title: 'Avatar Presentation 3 (5 clips)', id: 'ef4c6ba0-5beb-4829-9645-09f854b6bbb5', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/ef4c6ba0-5beb-4829-9645-09f854b6bbb5/avatar_ef4c6ba0-5beb-4829-9645-09f854b6bbb5_1770044335841.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/ef4c6ba0-5beb-4829-9645-09f854b6bbb5/avatar_ef4c6ba0-5beb-4829-9645-09f854b6bbb5_1770044343663.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/ef4c6ba0-5beb-4829-9645-09f854b6bbb5/avatar_clip1_ef4c6ba0-5beb-4829-9645-09f854b6bbb5_1770044624428.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/ef4c6ba0-5beb-4829-9645-09f854b6bbb5/avatar_clip0_ef4c6ba0-5beb-4829-9645-09f854b6bbb5_1770044624362.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/ef4c6ba0-5beb-4829-9645-09f854b6bbb5/avatar_clip1_ef4c6ba0-5beb-4829-9645-09f854b6bbb5_1770044638614.mp4',
  ] },
  { title: 'Cinematic Short 21 (6 clips)', id: '648372c9-4fe1-462e-ab5c-2d336392bf77', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/648372c9-4fe1-462e-ab5c-2d336392bf77/clip_648372c9-4fe1-462e-ab5c-2d336392bf77_0_1771503279523.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/648372c9-4fe1-462e-ab5c-2d336392bf77/clip_648372c9-4fe1-462e-ab5c-2d336392bf77_1_1771503445854.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/648372c9-4fe1-462e-ab5c-2d336392bf77/clip_648372c9-4fe1-462e-ab5c-2d336392bf77_2_1771503595529.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/648372c9-4fe1-462e-ab5c-2d336392bf77/clip_648372c9-4fe1-462e-ab5c-2d336392bf77_3_1771503803548.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/648372c9-4fe1-462e-ab5c-2d336392bf77/clip_648372c9-4fe1-462e-ab5c-2d336392bf77_4_1771504062071.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/648372c9-4fe1-462e-ab5c-2d336392bf77/clip_648372c9-4fe1-462e-ab5c-2d336392bf77_5_1771504204149.mp4',
  ] },
  { title: 'Cinematic Short 28 (2 clips)', id: '913e0ac7-dba4-47b0-b3a9-870d20a62d7f', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/913e0ac7-dba4-47b0-b3a9-870d20a62d7f/clip_913e0ac7-dba4-47b0-b3a9-870d20a62d7f_0_1771505483722.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/913e0ac7-dba4-47b0-b3a9-870d20a62d7f/clip_913e0ac7-dba4-47b0-b3a9-870d20a62d7f_1_1771505532347.mp4',
  ] },
  { title: 'Cinematic Short 36 (4 clips)', id: 'b03bfbd3-4979-4c79-8da0-499c3c84f6e5', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b03bfbd3-4979-4c79-8da0-499c3c84f6e5/clip_b03bfbd3-4979-4c79-8da0-499c3c84f6e5_0_1771544009584.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b03bfbd3-4979-4c79-8da0-499c3c84f6e5/clip_b03bfbd3-4979-4c79-8da0-499c3c84f6e5_1_1771544055409.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b03bfbd3-4979-4c79-8da0-499c3c84f6e5/clip_b03bfbd3-4979-4c79-8da0-499c3c84f6e5_2_1771544088767.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b03bfbd3-4979-4c79-8da0-499c3c84f6e5/clip_b03bfbd3-4979-4c79-8da0-499c3c84f6e5_3_1771544119500.mp4',
  ] },
  { title: 'Cinematic Short 38 (6 clips)', id: 'b7c1eb33-d1db-4192-b611-7436e620c9b2', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b7c1eb33-d1db-4192-b611-7436e620c9b2/clip_b7c1eb33-d1db-4192-b611-7436e620c9b2_0_1770428596743.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b7c1eb33-d1db-4192-b611-7436e620c9b2/clip_b7c1eb33-d1db-4192-b611-7436e620c9b2_1_1770428742960.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b7c1eb33-d1db-4192-b611-7436e620c9b2/clip_b7c1eb33-d1db-4192-b611-7436e620c9b2_2_1770428884675.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b7c1eb33-d1db-4192-b611-7436e620c9b2/clip_b7c1eb33-d1db-4192-b611-7436e620c9b2_3_1770429034534.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b7c1eb33-d1db-4192-b611-7436e620c9b2/clip_b7c1eb33-d1db-4192-b611-7436e620c9b2_4_1770429185906.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/b7c1eb33-d1db-4192-b611-7436e620c9b2/clip_b7c1eb33-d1db-4192-b611-7436e620c9b2_5_1770429331886.mp4',
  ] },
  { title: 'Cinematic Short 15 (2 clips)', id: '4eb68721-fd86-49d6-99b0-2b246f9fe44a', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4eb68721-fd86-49d6-99b0-2b246f9fe44a/clip_4eb68721-fd86-49d6-99b0-2b246f9fe44a_0_1769982031088.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4eb68721-fd86-49d6-99b0-2b246f9fe44a/clip_4eb68721-fd86-49d6-99b0-2b246f9fe44a_1_1769982182170.mp4',
  ] },
  { title: 'Cinematic Short 19 (1 clips)', id: '5cc64de7-f568-4b32-9e80-73f7c9e16e72', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/5cc64de7-f568-4b32-9e80-73f7c9e16e72/clip_5cc64de7-f568-4b32-9e80-73f7c9e16e72_0_1771466142322.mp4',
  ] },
  { title: 'Avatar Presentation 1 (2 clips)', id: '2a2925cc-20d1-4161-ab15-2c22dff093bf', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/2a2925cc-20d1-4161-ab15-2c22dff093bf/avatar_clip1_2a2925cc-20d1-4161-ab15-2c22dff093bf_1770609635627.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/2a2925cc-20d1-4161-ab15-2c22dff093bf/avatar_clip2_2a2925cc-20d1-4161-ab15-2c22dff093bf_1770609828406.mp4',
  ] },
  { title: 'Cinematic Short 40 (1 clips)', id: 'bc5ab68a-d85e-4dfc-b82b-1ad8a6b3aaae', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/bc5ab68a-d85e-4dfc-b82b-1ad8a6b3aaae/clip_bc5ab68a-d85e-4dfc-b82b-1ad8a6b3aaae_1_1771420340067.mp4',
  ] },
  { title: 'Cinematic Short 23 (2 clips)', id: '70863b55-1097-4ea1-9a9e-99b80a77abf6', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/70863b55-1097-4ea1-9a9e-99b80a77abf6/clip_70863b55-1097-4ea1-9a9e-99b80a77abf6_0_1770590477127.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/70863b55-1097-4ea1-9a9e-99b80a77abf6/clip_70863b55-1097-4ea1-9a9e-99b80a77abf6_1_1770590895328.mp4',
  ] },
  { title: 'Cinematic Short 24 (2 clips)', id: '7126e563-d381-4db1-9774-0e1fb33ba436', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/7126e563-d381-4db1-9774-0e1fb33ba436/clip_7126e563-d381-4db1-9774-0e1fb33ba436_0_1770611588874.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/7126e563-d381-4db1-9774-0e1fb33ba436/clip_7126e563-d381-4db1-9774-0e1fb33ba436_1_1770611754187.mp4',
  ] },
  { title: 'Cinematic Short 8 (2 clips)', id: '36b8542f-578c-4aa4-9df7-dc0498aa23ac', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/36b8542f-578c-4aa4-9df7-dc0498aa23ac/clip_36b8542f-578c-4aa4-9df7-dc0498aa23ac_0_1771425232117.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/36b8542f-578c-4aa4-9df7-dc0498aa23ac/clip_36b8542f-578c-4aa4-9df7-dc0498aa23ac_1_1771425558657.mp4',
  ] },
  { title: 'Echoes of Normalcy', id: 'd571f407-9dbd-4996-9bd6-825be4b33f66', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/d571f407-9dbd-4996-9bd6-825be4b33f66/clip_d571f407-9dbd-4996-9bd6-825be4b33f66_0_1770518760774.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/d571f407-9dbd-4996-9bd6-825be4b33f66/clip_d571f407-9dbd-4996-9bd6-825be4b33f66_1_1770518902341.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/d571f407-9dbd-4996-9bd6-825be4b33f66/clip_d571f407-9dbd-4996-9bd6-825be4b33f66_2_1770519042838.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/d571f407-9dbd-4996-9bd6-825be4b33f66/clip_d571f407-9dbd-4996-9bd6-825be4b33f66_3_1770519183033.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/d571f407-9dbd-4996-9bd6-825be4b33f66/clip_d571f407-9dbd-4996-9bd6-825be4b33f66_4_1770519324040.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/d571f407-9dbd-4996-9bd6-825be4b33f66/clip_d571f407-9dbd-4996-9bd6-825be4b33f66_5_1770519464550.mp4',
  ] },
  { title: 'Zombie Family Reunion', id: '1a2a7b5c-aa1c-4535-894f-ecb28bcc2392', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1a2a7b5c-aa1c-4535-894f-ecb28bcc2392/clip_1a2a7b5c-aa1c-4535-894f-ecb28bcc2392_0_1770348144429.mp4',
  ] },
  { title: 'Enchanted Library Chronicles', id: '6fb5c360-6b46-43b7-8d31-59c9ada01e9b', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/6fb5c360-6b46-43b7-8d31-59c9ada01e9b/clip_6fb5c360-6b46-43b7-8d31-59c9ada01e9b_0_1770311296943.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/6fb5c360-6b46-43b7-8d31-59c9ada01e9b/clip_6fb5c360-6b46-43b7-8d31-59c9ada01e9b_1_1770311446373.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/6fb5c360-6b46-43b7-8d31-59c9ada01e9b/clip_6fb5c360-6b46-43b7-8d31-59c9ada01e9b_2_1770311591569.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/6fb5c360-6b46-43b7-8d31-59c9ada01e9b/clip_6fb5c360-6b46-43b7-8d31-59c9ada01e9b_3_1770311737037.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/6fb5c360-6b46-43b7-8d31-59c9ada01e9b/clip_6fb5c360-6b46-43b7-8d31-59c9ada01e9b_4_1770311877822.mp4',
  ] },
  { title: 'Colorful Identity Unveiled', id: '1faa84ce-8e63-4198-9b5f-56ed46e2c90f', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_0_1770301653316.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_1_1770301794066.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_2_1770301934317.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_3_1770302075486.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_4_1770302214102.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_5_1770302354672.mp4',
  ] },
  { title: 'Clarity Above Chaos', id: '987b785f-fa04-4218-9422-fb82e745ecdc', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/987b785f-fa04-4218-9422-fb82e745ecdc/clip_987b785f-fa04-4218-9422-fb82e745ecdc_0_1770296541773.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/987b785f-fa04-4218-9422-fb82e745ecdc/clip_987b785f-fa04-4218-9422-fb82e745ecdc_1_1770296963561.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/987b785f-fa04-4218-9422-fb82e745ecdc/clip_987b785f-fa04-4218-9422-fb82e745ecdc_2_1770297103794.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/987b785f-fa04-4218-9422-fb82e745ecdc/clip_987b785f-fa04-4218-9422-fb82e745ecdc_3_1770297244545.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/987b785f-fa04-4218-9422-fb82e745ecdc/clip_987b785f-fa04-4218-9422-fb82e745ecdc_4_1770297385420.mp4',
  ] },
  { title: 'Ultimate Image Showcase', id: '4db11462-cdf1-489a-90c5-6ef183f42160', clips: [
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_0_1770261017341.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_1_1770261160981.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_2_1770261354819.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_3_1770261499306.mp4',
    'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_4_1770262038360.mp4',
  ] },
];

/**
 * Clips that 404 on the legacy bucket (verified dead) — filtered out so the
 * galleries never attempt them and never show a black tile. Re-run a health
 * check if the legacy host changes; runtime onError handling covers the rest.
 */
const BROKEN_CLIPS = new Set<string>([
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_0_1770301653316.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_1_1770301794066.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_2_1770301934317.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_3_1770302075486.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_4_1770302214102.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/1faa84ce-8e63-4198-9b5f-56ed46e2c90f/clip_1faa84ce-8e63-4198-9b5f-56ed46e2c90f_5_1770302354672.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip0_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip0_1777678099245.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip1_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip1_1777678422573.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip2_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip2_1777678585873.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip3_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip3_1777679012672.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/23cf4063-88bb-4a8e-9252-e24c51409c2e/clip4_23cf4063-88bb-4a8e-9252-e24c51409c2e_clip4_1777679167768.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/2a2925cc-20d1-4161-ab15-2c22dff093bf/avatar_clip1_2a2925cc-20d1-4161-ab15-2c22dff093bf_1770609635627.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/2a2925cc-20d1-4161-ab15-2c22dff093bf/avatar_clip2_2a2925cc-20d1-4161-ab15-2c22dff093bf_1770609828406.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_0_1770261017341.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_1_1770261160981.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_2_1770261354819.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_3_1770261499306.mp4',
  'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/4db11462-cdf1-489a-90c5-6ef183f42160/clip_4db11462-cdf1-489a-90c5-6ef183f42160_4_1770262038360.mp4',
]);

/** Films with their dead clips removed; films left with no playable clip are dropped. */
export const PLAYABLE_FILMS: Film[] = FILMS
  .map((f) => ({ ...f, clips: f.clips.filter((c) => !BROKEN_CLIPS.has(c)) }))
  .filter((f) => f.clips.length > 0);

/** One representative (playable) clip per film — for gallery walls. */
export const FILM_REELS: { title: string; src: string }[] = PLAYABLE_FILMS.map((f) => ({ title: f.title, src: f.clips[0] }));

/** Every playable clip, flattened — for big media surfaces. */
export const ALL_CLIPS: string[] = PLAYABLE_FILMS.flatMap((f) => f.clips);
